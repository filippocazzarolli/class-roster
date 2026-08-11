import { useCallback } from 'react'
import { Link } from 'react-router'

import { api } from '@/app/api'
import { useLettura } from '@/app/lettura'
import { CardSessione } from '@/iscrizioni/componenti/card-sessione'

/**
 * R4 **senza filtro** — tutte le sessioni, di ogni corso.
 *
 * È la stessa lettura della pagina di un corso, chiamata senza `courseId`: il filtro è
 * opzionale proprio per questo (§4.5). Non c'è nessun filtro sul tempo né sullo stato, ed
 * è voluto — è la vista di gestione, quindi le sessioni passate e quelle annullate ci
 * devono essere: è su quelle che si ragiona.
 */
export function TutteLeSessioniPage() {
  const { stato, ricarica } = useLettura(
    useCallback(() => api.sessions.list(), []),
  )

  return (
    <main className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Tutte le sessioni</h2>

      {stato.fase === 'caricamento' && (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      )}

      {stato.fase === 'errore' && (
        <p className="text-sm text-destructive">{stato.messaggio}</p>
      )}

      {stato.fase === 'pronto' &&
        (stato.dati.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessuna sessione programmata. Si parte dal{' '}
            <Link to="/corsi" className="underline underline-offset-4">
              catalogo
            </Link>
            , scegliendo un corso pubblicato.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {stato.dati.map((sessione) => (
              <li key={sessione.id}>
                {/*
                 * Il titolo del corso arriva già dentro `CourseSession`: R4 lo include, e
                 * senza servirebbe una seconda lettura per mostrare un elenco misto.
                 */}
                <p className="mb-1 text-sm font-medium">
                  {sessione.courseTitle}
                </p>
                <CardSessione sessione={sessione} onCambiata={ricarica} />
              </li>
            ))}
          </ul>
        ))}
    </main>
  )
}
