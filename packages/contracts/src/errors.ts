/**
 * Il corpo d'errore uniforme e i nomi che ci compaiono — `architecture.md` §4.4.
 */

/**
 * I nomi delle eccezioni di dominio, **in italiano**, così come li mette in risposta
 * `FiltroEccezioniDiDominio`.
 *
 * Non è una svista: il nome trapela deliberatamente perché è linguaggio ubiquo, ed è ciò
 * che permette al frontend di distinguere i casi senza interpretare la prosa del
 * messaggio. Rotte e campi restano inglesi; il *valore* di `error` no.
 *
 * L'elenco è la tabella di §4.4 — `stati-http.catalogo.ts`, `stati-http.iscrizioni.ts`,
 * `stati-http.shared.ts` — e va tenuto allineato a mano: sono le uniche stringhe di questo
 * pacchetto che il compilatore dell'api non verifica. Chi consuma questo tipo tenga sempre
 * un ramo di default.
 */
export type DomainErrorName =
  // catalogo
  | 'CorsoNonTrovato' //                   404
  | 'TitoloCorsoGiaUsato' //               409
  | 'TransizioneCorsoNonAmmessa' //        409
  | 'CorsoRitiratoNonModificabile' //      409
  // iscrizioni
  | 'SessioneNonTrovata' //                404
  | 'IscrizioneNonTrovata' //              404
  | 'IscrizioneDuplicata' //               409
  | 'SessioneGiaAnnullata' //              409
  | 'SessioneAnnullataNonIscrivibile' //   409
  | 'CorsoNonPubblicato' //                422
  | 'CapienzaNonValida' //                 422
  | 'CapienzaInferioreAgliIscritti' //     422
  | 'SessioneNelPassato' //                422
  | 'SessioneGiaIniziata' //               422
  | 'AnnullamentoFuoriTermine' //          422
  // trasversali
  | 'ValoreNonValido' //                   400
  | 'ConflittoDiVersioneNonRisolto'; //    503

/**
 * La forma di ogni risposta d'errore, di dominio o no.
 *
 * `error` è un `DomainErrorName` quando l'errore viene dal dominio, ed è il nome
 * dell'eccezione HTTP di Nest (`Bad Request`, `Not Found`) negli altri casi — per esempio
 * quando la `ValidationPipe` rifiuta un campo non dichiarato, o quando manca `X-Utente`.
 */
export interface ErrorBody {
  readonly error: DomainErrorName | AltroNomeDiErrore;
  readonly message: string;
  readonly status: number;
}

/**
 * `string`, ma scritto in modo che TypeScript non assorba `DomainErrorName` nell'unione:
 * l'editor continua a suggerire i nomi noti, e una stringa qualsiasi resta accettata.
 * Con un semplice `| string` l'unione collasserebbe, e non ci sarebbe più nulla da
 * suggerire né da confrontare.
 */
type AltroNomeDiErrore = string & Record<never, never>;
