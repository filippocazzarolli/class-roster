import { EventoDiDominio } from '../../shared/domain/evento-di-dominio';

/**
 * I nomi sul bus del contesto `iscrizioni` — `architecture.md` §4.3.
 *
 * La versione nel nome rende il versionamento un'operazione additiva: si pubblica
 * `.v2` accanto a `.v1` finché tutti i sottoscrittori sono migrati.
 */
export const NOMI_EVENTI_ISCRIZIONI = {
  SESSIONE_PROGRAMMATA: 'iscrizioni.SessioneProgrammata.v1',
  CAPIENZA_SESSIONE_MODIFICATA: 'iscrizioni.CapienzaSessioneModificata.v1',
  SESSIONE_ANNULLATA: 'iscrizioni.SessioneAnnullata.v1',
  DIPENDENTE_ISCRITTO: 'iscrizioni.DipendenteIscritto.v1',
  DIPENDENTE_MESSO_IN_ATTESA: 'iscrizioni.DipendenteMessoInAttesa.v1',
  ISCRIZIONE_ANNULLATA: 'iscrizioni.IscrizioneAnnullata.v1',
  ATTESA_ANNULLATA: 'iscrizioni.AttesaAnnullata.v1',
  DIPENDENTE_PROMOSSO: 'iscrizioni.DipendentePromosso.v1',
} as const;

export interface DestinatarioAnnullamento {
  readonly dipendenteId: string;
  readonly email: string;
  readonly stato: 'ISCRITTO' | 'IN_ATTESA';
}

const evento = (
  nome: string,
  aggregateId: string,
  payload: Record<string, unknown>,
): EventoDiDominio => ({ nome, aggregateId, payload });

export const sessioneProgrammata = (payload: {
  sessioneId: string;
  corsoId: string;
  titoloCorso: string;
  data: string;
  oraInizio: string;
  luogo: { tipo: string; nome: string | null };
  docente: string;
  capienza: number;
}): EventoDiDominio =>
  evento(
    NOMI_EVENTI_ISCRIZIONI.SESSIONE_PROGRAMMATA,
    payload.sessioneId,
    payload,
  );

export const capienzaSessioneModificata = (payload: {
  sessioneId: string;
  capienzaPrecedente: number;
  capienza: number;
}): EventoDiDominio =>
  evento(
    NOMI_EVENTI_ISCRIZIONI.CAPIENZA_SESSIONE_MODIFICATA,
    payload.sessioneId,
    payload,
  );

/**
 * Porta l'elenco completo dei destinatari — HS-10, `domain.md` §2.8.
 *
 * Se non lo facesse, il contesto notifiche dovrebbe interrogare `iscrizioni` *dopo*
 * l'annullamento per sapere a chi scrivere: leggere lo stato del core dall'esterno,
 * nel momento peggiore.
 */
export const sessioneAnnullata = (payload: {
  sessioneId: string;
  titoloCorso: string;
  data: string;
  oraInizio: string;
  motivo: string;
  destinatari: readonly DestinatarioAnnullamento[];
}): EventoDiDominio =>
  evento(
    NOMI_EVENTI_ISCRIZIONI.SESSIONE_ANNULLATA,
    payload.sessioneId,
    payload,
  );

export const dipendenteIscritto = (payload: {
  sessioneId: string;
  dipendenteId: string;
  email: string;
}): EventoDiDominio =>
  evento(
    NOMI_EVENTI_ISCRIZIONI.DIPENDENTE_ISCRITTO,
    payload.sessioneId,
    payload,
  );

export const dipendenteMessoInAttesa = (payload: {
  sessioneId: string;
  dipendenteId: string;
  email: string;
  posizione: number;
}): EventoDiDominio =>
  evento(
    NOMI_EVENTI_ISCRIZIONI.DIPENDENTE_MESSO_IN_ATTESA,
    payload.sessioneId,
    payload,
  );

export const iscrizioneAnnullata = (payload: {
  sessioneId: string;
  dipendenteId: string;
}): EventoDiDominio =>
  evento(
    NOMI_EVENTI_ISCRIZIONI.ISCRIZIONE_ANNULLATA,
    payload.sessioneId,
    payload,
  );

export const attesaAnnullata = (payload: {
  sessioneId: string;
  dipendenteId: string;
}): EventoDiDominio =>
  evento(NOMI_EVENTI_ISCRIZIONI.ATTESA_ANNULLATA, payload.sessioneId, payload);

/**
 * Porta titolo, data e ora oltre all'indirizzo, ed è ridondante di proposito: senza di
 * essi la notifica sarebbe costretta a una query per scrivere «sei passato da lista
 * d'attesa a iscritto per *Kubernetes base*, martedì 12 alle 09:00». Un evento è
 * autosufficiente o non è un evento (`architecture.md` §4.3).
 */
export const dipendentePromosso = (payload: {
  sessioneId: string;
  titoloCorso: string;
  data: string;
  oraInizio: string;
  dipendenteId: string;
  email: string;
}): EventoDiDominio =>
  evento(
    NOMI_EVENTI_ISCRIZIONI.DIPENDENTE_PROMOSSO,
    payload.sessioneId,
    payload,
  );
