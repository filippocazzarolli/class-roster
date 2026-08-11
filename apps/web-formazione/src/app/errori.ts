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
 * I casi coperti sono quelli che il **responsabile** può provocare; per gli altri il
 * messaggio dell'api è comunque in italiano ed è comunque corretto.
 */
export function messaggioDiErrore(errore: unknown): string {
  if (errore instanceof NetworkError) {
    return "Il server non risponde. Verifica che l'api sia in esecuzione."
  }

  if (errore instanceof HttpError) {
    switch (errore.error) {
      // catalogo
      case 'TitoloCorsoGiaUsato':
        return 'Esiste già un corso con questo titolo.'
      case 'CorsoNonTrovato':
        return 'Il corso non esiste più.'
      case 'CorsoRitiratoNonModificabile':
        return 'Il corso è stato ritirato e non è più modificabile.'
      case 'TransizioneCorsoNonAmmessa':
        return 'Il corso non si trova in uno stato che permette questa operazione.'

      // iscrizioni, per la parte che riguarda la sessione
      case 'SessioneNonTrovata':
        return 'La sessione non esiste più.'
      case 'SessioneGiaAnnullata':
        return 'La sessione è già stata annullata.'
      case 'SessioneGiaIniziata':
        return 'La sessione è già iniziata.'
      case 'SessioneNelPassato':
        return 'Non si può programmare una sessione in una data già passata.'
      case 'CorsoNonPubblicato':
        return 'Si possono programmare sessioni solo per un corso pubblicato.'
      case 'CapienzaNonValida':
        return 'La capienza indicata non è valida.'
      case 'CapienzaInferioreAgliIscritti':
        return 'La nuova capienza è inferiore al numero di iscritti: nessuno viene espulso, quindi la modifica è rifiutata.'

      // trasversali
      case 'ConflittoDiVersioneNonRisolto':
        return 'Qualcun altro ha modificato questi dati nel frattempo. Riprova.'

      default:
        return errore.message
    }
  }

  return 'Si è verificato un errore imprevisto.'
}

/**
 * Il campo a cui un errore di dominio va attribuito, se ce n'è uno.
 *
 * Serve a `<Form errors={…}>`: un titolo duplicato è un difetto *di quel campo*, e
 * mostrarlo lì evita che l'utente debba indovinare quale dei valori rifare. Gli errori
 * che non riguardano un campo solo restano in cima al form.
 */
export function campoInErrore(errore: unknown): string | null {
  if (!(errore instanceof HttpError)) return null

  switch (errore.error) {
    case 'TitoloCorsoGiaUsato':
      return 'title'
    case 'CapienzaNonValida':
    case 'CapienzaInferioreAgliIscritti':
      return 'capacity'
    case 'SessioneNelPassato':
      return 'date'
    default:
      return null
  }
}
