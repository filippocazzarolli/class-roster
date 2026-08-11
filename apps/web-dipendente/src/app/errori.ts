import { HttpError, NetworkError } from '@repo/api-client'

/**
 * Da eccezione del client a frase da mostrare.
 *
 * Il ramo si sceglie su `HttpError.error` — il nome dell'eccezione di dominio — e mai sul
 * messaggio: `contracts/errors.ts` lo dice esplicitamente, il nome è linguaggio ubiquo e
 * la prosa no. Il `default` restituisce il `message` dell'api invece di una frase inventata
 * qui: quell'elenco non è verificato dal compilatore e prima o poi ne arriverà uno che
 * questo file non conosce.
 *
 * È una **copia** di quello di `web-formazione`, non un modulo condiviso: i casi coperti
 * sono quelli che il *dipendente* può provocare, e sono altri. §4.11 chiede di duplicare e
 * di condividere solo quando le due copie sono rimaste identiche abbastanza a lungo —
 * queste due non lo sono mai state.
 */
export function messaggioDiErrore(errore: unknown): string {
  if (errore instanceof NetworkError) {
    return "Il server non risponde. Verifica che l'api sia in esecuzione."
  }

  if (errore instanceof HttpError) {
    switch (errore.error) {
      case 'IscrizioneDuplicata':
        return 'Sei già iscritto a questa sessione.'
      case 'IscrizioneNonTrovata':
        return 'Non risulti iscritto a questa sessione.'
      case 'SessioneNonTrovata':
        return 'La sessione non esiste più.'
      case 'SessioneGiaIniziata':
        return 'La sessione è già iniziata.'
      case 'SessioneGiaAnnullata':
      case 'SessioneAnnullataNonIscrivibile':
        return 'La sessione è stata annullata.'
      case 'AnnullamentoFuoriTermine':
        return "L'annullamento è possibile fino a 24 ore prima dell'inizio, e il termine è passato."
      case 'ConflittoDiVersioneNonRisolto':
        return 'Qualcun altro stava operando sulla stessa sessione. Riprova.'
      default:
        return errore.message
    }
  }

  return 'Si è verificato un errore imprevisto.'
}
