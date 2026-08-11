import { ErroreDiDominio } from '../../shared/domain/errori';

/**
 * I rifiuti del contesto `iscrizioni`.
 *
 * Sono **eccezioni e non eventi** (`architecture.md` §4.4): un comando rifiutato non è
 * un fatto accaduto nel dominio. Il nome è in italiano perché è linguaggio ubiquo, e
 * trapela deliberatamente nel campo `error` della risposta HTTP.
 *
 * Ogni classe qui dentro ha uno stato HTTP dichiarato in §4.4, e un test di contratto
 * fallisce se qualcuna resta senza.
 */

/** 404 — identificativo inesistente. */
export class SessioneNonTrovata extends ErroreDiDominio {}

/** 404 — INV-9: l'iscrizione cercata non è di chi la sta annullando, o non esiste. */
export class IscrizioneNonTrovata extends ErroreDiDominio {}

/** 409 — INV-5: due iscrizioni dello stesso dipendente alla stessa sessione. */
export class IscrizioneDuplicata extends ErroreDiDominio {}

/** 409 — INV-12: una sessione annullata non torna attiva. */
export class SessioneGiaAnnullata extends ErroreDiDominio {}

/** 409 — INV-6: su una sessione annullata non si entra e non si esce. */
export class SessioneAnnullataNonIscrivibile extends ErroreDiDominio {}

/** 422 — INV-2: la replica ACL non conosce quel corso come pubblicato. */
export class CorsoNonPubblicato extends ErroreDiDominio {}

/** 422 — INV-3: capienza non intera o inferiore a 1. */
export class CapienzaNonValida extends ErroreDiDominio {}

/** 422 — HS-2: ridurre la capienza sotto gli iscritti si rifiuta, nessuno viene espulso. */
export class CapienzaInferioreAgliIscritti extends ErroreDiDominio {}

/** 422 — programmare una sessione a un istante già trascorso. */
export class SessioneNelPassato extends ErroreDiDominio {}

/** 422 — INV-6, e dipende dal tempo: rileggere non cambia l'esito. */
export class SessioneGiaIniziata extends ErroreDiDominio {}

/** 422 — INV-10: si annulla fino a 24 ore prima dell'inizio, non oltre. */
export class AnnullamentoFuoriTermine extends ErroreDiDominio {}
