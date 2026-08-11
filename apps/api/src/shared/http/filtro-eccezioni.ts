import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErroreDiDominio } from '../domain/errori';
import { RegistroStatiHttp } from './registro-stati-http';

interface CorpoErrore {
  readonly error: string;
  readonly message: string;
  readonly status: number;
}

/**
 * Traduce le eccezioni di dominio in stati HTTP — `architecture.md` §4.4.
 *
 * **È l'unico punto del sistema che conosce i codici di stato.** Nessuna classe di
 * `domain/` sa cosa sia un 409: l'aggregato solleva `IscrizioneDuplicata`, e che quella
 * diventi un 409 è una decisione dello strato HTTP, presa qui e in nessun altro posto.
 *
 * Il nome dell'eccezione **trapela deliberatamente** nel campo `error`, in italiano
 * perché è linguaggio ubiquo: è ciò che permette al frontend di distinguere i casi senza
 * interpretare la prosa del messaggio. Rotte e campi restano inglesi.
 */
@Catch()
export class FiltroEccezioniDiDominio implements ExceptionFilter {
  private readonly logger = new Logger(FiltroEccezioniDiDominio.name);

  constructor(private readonly registro: RegistroStatiHttp) {}

  catch(eccezione: unknown, host: ArgumentsHost): void {
    const risposta = host.switchToHttp().getResponse<Response>();

    if (eccezione instanceof ErroreDiDominio) {
      const stato = this.registro.statoPer(eccezione);

      if (stato === null) {
        // Un'eccezione di dominio senza stato dichiarato è un difetto della tabella di
        // §4.4, non una richiesta sbagliata: 500, e a voce alta. Il test di contratto
        // di §4.9 esiste perché questo ramo non venga mai raggiunto in produzione.
        this.logger.error(
          `${eccezione.name} non ha uno stato HTTP dichiarato: aggiungilo al registro.`,
        );
        return this.invia(risposta, {
          error: 'ErroreNonMappato',
          message: eccezione.message,
          status: 500,
        });
      }

      if (stato === 503) {
        risposta.setHeader('Retry-After', '1');
      }

      return this.invia(risposta, {
        error: eccezione.name,
        message: eccezione.message,
        status: stato,
      });
    }

    // Le eccezioni HTTP di Nest — 404 di rotta, 400 della ValidationPipe — passano con
    // il loro stato e il loro corpo: non sono rifiuti del dominio e non devono
    // travestirsi da tali.
    if (eccezione instanceof HttpException) {
      const corpo = eccezione.getResponse();
      return this.invia(
        risposta,
        typeof corpo === 'string'
          ? {
              error: eccezione.name,
              message: corpo,
              status: eccezione.getStatus(),
            }
          : ({
              ...corpo,
              status: eccezione.getStatus(),
            } as unknown as CorpoErrore),
      );
    }

    this.logger.error(
      eccezione instanceof Error ? eccezione.stack : String(eccezione),
    );
    return this.invia(risposta, {
      error: 'ErroreInterno',
      message: 'Errore imprevisto.',
      status: 500,
    });
  }

  private invia(risposta: Response, corpo: CorpoErrore): void {
    risposta.status(corpo.status).json(corpo);
  }
}
