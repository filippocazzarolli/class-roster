import { useCallback, useEffect, useState } from 'react'

import { messaggioDiErrore } from './errori'

/**
 * Lo stato di una lettura, come unione discriminata invece che come tre variabili
 * indipendenti: così «sta caricando *e* ha fallito» non è nemmeno rappresentabile, mentre
 * con `isLoading`/`error`/`dati` lo è sempre e va escluso a mano a ogni render.
 */
export type Lettura<T> =
  | { fase: 'caricamento' }
  | { fase: 'pronto'; dati: T }
  | { fase: 'errore'; messaggio: string }

/**
 * Esegue una lettura del read model e ne segue lo stato.
 *
 * `ricarica` esiste perché ogni comando invalida ciò che si sta guardando: dopo un
 * `publish` o un `cancel` la vista va riletta dall'api e non aggiornata a mano nello stato
 * locale. Ricalcolare in locale ciò che il read model deriva — `postiResidui`, `decaduta`,
 * `annullabile` — significherebbe riscrivere nel frontend le regole di §4.5, e vederle
 * divergere alla prima modifica.
 */
export function useLettura<T>(
  leggi: () => Promise<T>,
  dipendenze: readonly unknown[] = [],
): { stato: Lettura<T>; ricarica: () => void } {
  const [stato, setStato] = useState<Lettura<T>>({ fase: 'caricamento' })
  const [contatore, setContatore] = useState(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- le dipendenze le dichiara chi chiama
  const eseguiLettura = useCallback(leggi, dipendenze)

  useEffect(() => {
    /*
     * `StrictMode` monta due volte in sviluppo, e chi naviga via prima della risposta
     * lascia comunque la richiesta in volo: senza questo flag il `setStato` di una lettura
     * superata riscriverebbe il risultato di quella buona.
     */
    let annullato = false
    setStato({ fase: 'caricamento' })

    eseguiLettura()
      .then((dati) => {
        if (!annullato) setStato({ fase: 'pronto', dati })
      })
      .catch((errore: unknown) => {
        if (!annullato)
          setStato({ fase: 'errore', messaggio: messaggioDiErrore(errore) })
      })

    return () => {
      annullato = true
    }
  }, [eseguiLettura, contatore])

  return { stato, ricarica: () => setContatore((n) => n + 1) }
}
