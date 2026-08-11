import { useCallback } from 'react'
import { Link } from 'react-router'

import { api } from '@/app/api'
import { useLettura } from '@/app/lettura'
import { CardMiaIscrizione } from '@/iscrizioni/componenti/card-mia-iscrizione'

/**
 * R2 — le mie iscrizioni (§4.5).
 *
 * Nessun filtro: ci sono anche le sessioni annullate e le code decadute, perché sono
 * proprio i casi che il dipendente deve poter vedere. L'ordinamento arriva già dal read
 * model — data e ora discendenti — e non si rifà qui.
 */
export function MieIscrizioniPage() {
  const { stato, ricarica } = useLettura(
    useCallback(() => api.enrollments.listMine(), []),
  )

  return (
    <main className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Le mie iscrizioni</h2>

      {stato.fase === 'caricamento' && (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      )}

      {stato.fase === 'errore' && (
        <p className="text-sm text-destructive">{stato.messaggio}</p>
      )}

      {stato.fase === 'pronto' &&
        (stato.dati.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Non sei iscritto a nessuna sessione. Le trovi fra le{' '}
            <Link to="/sessioni" className="underline underline-offset-4">
              sessioni aperte
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {stato.dati.map((iscrizione) => (
              <li key={iscrizione.sessionId}>
                <CardMiaIscrizione
                  iscrizione={iscrizione}
                  onCambiata={ricarica}
                />
              </li>
            ))}
          </ul>
        ))}
    </main>
  )
}
