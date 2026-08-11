import { Button } from '@repo/ui/components/button'
import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'

import { api } from '@/app/api'
import { useLettura } from '@/app/lettura'
import { CardSessione } from '@/iscrizioni/componenti/card-sessione'
import { FormSessione } from '@/iscrizioni/componenti/form-sessione'

/**
 * R4 — le sessioni di un corso, con programmazione e annullamento (§4.5, §4.11).
 *
 * Legge due volte, come il catalogo: `sessions.list({ courseId })` sta in `iscrizioni`, e
 * il corso — che serve per il titolo e per sapere se è pubblicato — sta in `catalogo`.
 * Sono due contesti, e questa pagina li attraversa senza fonderli.
 */
export function SessioniDelCorsoPage() {
  const { corsoId = '' } = useParams()
  const [programmazioneAperta, setProgrammazioneAperta] = useState(false)

  const { stato, ricarica } = useLettura(
    useCallback(
      () =>
        Promise.all([
          api.sessions.list({ courseId: corsoId }),
          api.courses.list(),
        ]),
      [corsoId],
    ),
  )

  if (stato.fase === 'caricamento') {
    return <p className="text-sm text-muted-foreground">Caricamento…</p>
  }

  if (stato.fase === 'errore') {
    return <p className="text-sm text-destructive">{stato.messaggio}</p>
  }

  const [sessioni, corsi] = stato.dati
  const corso = corsi.find((c) => c.id === corsoId)

  if (corso === undefined) {
    return <p className="text-sm text-destructive">Il corso non esiste più.</p>
  }

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Sessioni · {corso.title}</h2>
          <Link
            to="/corsi"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Torna al catalogo
          </Link>
        </div>

        {/*
         * Si programma solo su un corso pubblicato: è l'api a dirlo con `CorsoNonPubblicato`
         * (422), e qui il bottone lascia il posto alla ragione per cui manca — che è più
         * utile di un rifiuto dopo la compilazione del modulo.
         */}
        {corso.state === 'PUBLISHED' && !programmazioneAperta && (
          <Button onClick={() => setProgrammazioneAperta(true)}>
            Nuova sessione
          </Button>
        )}
      </div>

      {corso.state === 'DRAFT' && (
        <p className="text-sm text-muted-foreground">
          Il corso è in bozza: va pubblicato prima di potervi programmare sessioni.
        </p>
      )}

      {corso.state === 'WITHDRAWN' && (
        <p className="text-sm text-muted-foreground">
          Il corso è stato ritirato: non si programmano altre sessioni.
        </p>
      )}

      {programmazioneAperta && (
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h3 className="mb-3 font-medium">Nuova sessione</h3>
          <FormSessione
            corsoId={corsoId}
            onAnnulla={() => setProgrammazioneAperta(false)}
            invia={async (sessione) => {
              await api.sessions.schedule(sessione)
              setProgrammazioneAperta(false)
              ricarica()
            }}
          />
        </div>
      )}

      {sessioni.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessuna sessione per questo corso.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessioni.map((sessione) => (
            <li key={sessione.id}>
              <CardSessione sessione={sessione} onCambiata={ricarica} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
