import { Logger } from '@nestjs/common';
import { EventoDiDominio } from '../domain/evento-di-dominio';
import { GeneratoreDiId } from '../domain/generatore-di-id';
import { Orologio } from '../domain/orologio';
import { PubblicatoreDiEventi } from '../domain/pubblicatore-di-eventi';

/** L'evento con la busta chiusa: è ciò che gli handler ricevono. */
export interface EventoImbustato extends EventoDiDominio {
  readonly eventId: string;
  readonly occorsoIl: string;
}

export interface HandlerDiEventi {
  /** Nome stabile: è la chiave con cui si ricorda cosa ha già gestito. */
  readonly nome: string;
  readonly ascolta: readonly string[];
  gestisci(evento: EventoImbustato): Promise<void> | void;
}

/**
 * Il bus in-process — `architecture.md` §4.8.
 *
 * Chiude la busta (`eventId`, `occorsoIl`) e consegna agli handler **dopo** che
 * l'aggregato è stato salvato. Non c'è outbox: serviva a rendere atomici stato ed
 * evento dentro una transazione, e senza transazione non protegge da nulla — se il
 * processo muore, muore anche lo stato.
 *
 * Ciò che si perde davvero, ed è dichiarato: **senza outbox non c'è recupero**. Un
 * handler che fallisce perde il suo evento e nessuno lo ripesca. È accettabile perché il
 * peggiore degli esiti è una notifica mancata su un log.
 *
 * ## Ordine e idempotenza
 *
 * Gli handler di uno stesso evento sono invocati **in ordine di registrazione**, e su
 * `CorsoRitirato` quest'ordine è vincolante: prima l'ACL aggiorna la replica, poi la
 * policy annulla le sessioni. Se fosse il contrario, una sessione programmata nella
 * finestra di HS-8 sopravvivrebbe al ritiro.
 *
 * Il registro `(handler, eventId)` rende ogni consegna ripetibile senza danni: non
 * dipendeva dal database ma dalla forma della consegna, e resta.
 */
export class EventBusInProcess extends PubblicatoreDiEventi {
  private readonly logger = new Logger(EventBusInProcess.name);
  private readonly handler: HandlerDiEventi[] = [];
  private readonly gestiti = new Set<string>();

  constructor(
    private readonly id: GeneratoreDiId,
    private readonly orologio: Orologio,
  ) {
    super();
  }

  sottoscrivi(handler: HandlerDiEventi): void {
    this.handler.push(handler);
  }

  pubblica(eventi: readonly EventoDiDominio[]): void {
    for (const evento of eventi) {
      const imbustato: EventoImbustato = {
        ...evento,
        eventId: this.id.genera(),
        occorsoIl: this.orologio.adesso().toString(),
      };

      // La consegna è asincrona rispetto al chiamante — l'use case ha già risposto — ma
      // gli handler restano in ordine fra loro.
      void this.consegna(imbustato);
    }
  }

  private async consegna(evento: EventoImbustato): Promise<void> {
    for (const handler of this.handler) {
      if (!handler.ascolta.includes(evento.nome)) continue;

      const chiave = `${handler.nome}|${evento.eventId}`;
      if (this.gestiti.has(chiave)) continue;
      this.gestiti.add(chiave);

      try {
        await handler.gestisci(evento);
      } catch (errore) {
        // Nessuna coda a cui restituirlo: si registra e si prosegue con gli altri.
        this.logger.error(
          `Handler ${handler.nome} fallito su ${evento.nome}: ${
            errore instanceof Error ? errore.message : String(errore)
          }`,
        );
      }
    }
  }
}
