import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Request } from 'express';

export interface UtenteCorrente {
  readonly id: string;
  readonly email: string;
}

const HEADER = 'x-utente';

/** Namespace fisso per l'UUID v5: cambiarlo cambierebbe l'identità di tutti. */
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * UUID v5 (SHA-1) sul namespace fisso — deterministico per costruzione.
 *
 * Scritto a mano invece di aggiungere una dipendenza: sono dieci righe, e l'alternativa
 * porterebbe un pacchetto intero per una funzione sola.
 */
const uuidV5 = (nome: string): string => {
  const bytesNamespace = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1')
    .update(Buffer.concat([bytesNamespace, Buffer.from(nome, 'utf8')]))
    .digest();

  hash[6] = (hash[6] & 0x0f) | 0x50; // versione 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // variante RFC 4122

  const esa = hash.subarray(0, 16).toString('hex');
  return [
    esa.substring(0, 8),
    esa.substring(8, 12),
    esa.substring(12, 16),
    esa.substring(16, 20),
    esa.substring(20, 32),
  ].join('-');
};

/**
 * Legge `X-Utente` e ne ricava l'utente corrente.
 *
 * **Questo è l'unico punto del sistema in cui l'identità entra.** Non c'è
 * autenticazione né autorizzazione: il client dichiara e il sistema crede
 * (`aggregation.md` §3.9). Il giorno in cui diventasse un SSO vero, a cambiare sarebbe
 * questo file e nient'altro — nessun controller, nessun use case, nessun aggregato sa da
 * dove arriva l'identità.
 *
 * INV-9 non dipende da questa fiducia: non difende da chi mente sulla propria identità,
 * ma da chi tenta di annullare l'iscrizione **di un altro** — e quella strada non esiste,
 * né nella firma dell'aggregato né nella forma della rotta.
 */
export const leggiUtenteCorrente = (richiesta: Request): UtenteCorrente => {
  const email = richiesta.headers[HEADER];

  if (typeof email !== 'string' || email.trim().length === 0) {
    throw new BadRequestException(
      `Header ${HEADER} mancante: dichiara chi sei con "${HEADER}: tua@email".`,
    );
  }

  const pulita = email.trim().toLowerCase();
  return { id: uuidV5(pulita), email: pulita };
};

export const Utente = createParamDecorator(
  (_: unknown, contesto: ExecutionContext) =>
    leggiUtenteCorrente(contesto.switchToHttp().getRequest<Request>()),
);
