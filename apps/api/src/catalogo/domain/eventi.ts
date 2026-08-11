import { EventoDiDominio } from '../../shared/domain/evento-di-dominio';

/**
 * I nomi sul bus del contesto `catalogo` — `architecture.md` §4.3.
 *
 * Tre di questi quattro sono il contratto con `iscrizioni`: l'ACL li traduce nella
 * replica locale dei corsi pubblicati (P5), ed è l'unico modo in cui i due contesti si
 * parlano. Cambiare un payload qui è cambiare un contratto pubblico — per questo la
 * versione sta nel nome.
 */
export const NOMI_EVENTI_CATALOGO = {
  CORSO_CREATO: 'catalogo.CorsoCreato.v1',
  DETTAGLI_CORSO_MODIFICATI: 'catalogo.DettagliCorsoModificati.v1',
  CORSO_PUBBLICATO: 'catalogo.CorsoPubblicato.v1',
  CORSO_RITIRATO: 'catalogo.CorsoRitirato.v1',
} as const;

const evento = (
  nome: string,
  aggregateId: string,
  payload: Record<string, unknown>,
): EventoDiDominio => ({ nome, aggregateId, payload });

export const corsoCreato = (payload: {
  corsoId: string;
  titolo: string;
  argomento: string;
  durataInOre: number;
}): EventoDiDominio =>
  evento(NOMI_EVENTI_CATALOGO.CORSO_CREATO, payload.corsoId, payload);

export const dettagliCorsoModificati = (payload: {
  corsoId: string;
  titolo: string;
  argomento: string;
  durataInOre: number;
}): EventoDiDominio =>
  evento(
    NOMI_EVENTI_CATALOGO.DETTAGLI_CORSO_MODIFICATI,
    payload.corsoId,
    payload,
  );

export const corsoPubblicato = (payload: {
  corsoId: string;
  titolo: string;
}): EventoDiDominio =>
  evento(NOMI_EVENTI_CATALOGO.CORSO_PUBBLICATO, payload.corsoId, payload);

export const corsoRitirato = (payload: { corsoId: string }): EventoDiDominio =>
  evento(NOMI_EVENTI_CATALOGO.CORSO_RITIRATO, payload.corsoId, payload);
