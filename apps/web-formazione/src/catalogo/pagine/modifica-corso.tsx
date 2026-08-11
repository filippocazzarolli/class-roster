import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'

import { api } from '@/app/api'
import { useLettura } from '@/app/lettura'
import { FormCorso } from '@/catalogo/componenti/form-corso'

/**
 * `PATCH /api/courses/:id` — il comando `ModificaDettagliCorso` di §4.6.
 *
 * I valori iniziali si prendono dall'elenco di R3 e non da un `GET /courses/:id`, che
 * §4.6 non prevede: le rotte sono quelle della tabella, e inventarne una per comodità di
 * questa schermata aggiungerebbe superficie all'api per un caso che la lettura esistente
 * già copre.
 */
export function ModificaCorsoPage() {
  const { corsoId } = useParams()
  const navigate = useNavigate()

  const { stato } = useLettura(
    useCallback(async () => {
      const corsi = await api.courses.list()
      return corsi.find((corso) => corso.id === corsoId) ?? null
    }, [corsoId]),
  )

  if (stato.fase === 'caricamento') {
    return <p className="text-sm text-muted-foreground">Caricamento…</p>
  }

  if (stato.fase === 'errore') {
    return <p className="text-sm text-destructive">{stato.messaggio}</p>
  }

  const corso = stato.dati

  if (corso === null) {
    return <p className="text-sm text-destructive">Il corso non esiste più.</p>
  }

  return (
    <main className="flex max-w-lg flex-col gap-4">
      <h2 className="text-lg font-medium">Modifica corso</h2>

      <FormCorso
        testoInvio="Salva modifiche"
        valoriIniziali={{
          title: corso.title,
          description: corso.description,
          durationHours: corso.durationHours,
          topic: corso.topic,
        }}
        invia={async (dettagli) => {
          await api.courses.update(corso.id, dettagli)
          navigate('/corsi')
        }}
      />
    </main>
  )
}
