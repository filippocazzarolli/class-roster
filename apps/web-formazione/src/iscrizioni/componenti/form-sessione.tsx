import type { PlaceType, ScheduleSessionRequest } from '@repo/contracts'
import { Button } from '@repo/ui/components/button'
import { Field, FieldError, FieldLabel } from '@repo/ui/components/field'
import { Form } from '@repo/ui/components/form'
import { Input } from '@repo/ui/components/input'
import { Select } from '@repo/ui/components/select'
import { useState } from 'react'

import { campoInErrore, messaggioDiErrore } from '@/app/errori'

/**
 * `POST /api/sessions` — il comando `ProgrammaSessione` di §4.6.
 *
 * Il corso non è un campo del modulo: si programma una sessione *di un corso*, arrivandoci
 * dalla sua pagina. Un selettore qui dentro renderebbe possibile ciò che l'indirizzo già
 * esclude.
 */
export function FormSessione({
  corsoId,
  invia,
  onAnnulla,
}: {
  corsoId: string
  invia: (sessione: ScheduleSessionRequest) => Promise<void>
  onAnnulla: () => void
}) {
  const [tipoLuogo, setTipoLuogo] = useState<PlaceType>('AULA')
  const [invioInCorso, setInvioInCorso] = useState(false)
  const [erroriDiCampo, setErroriDiCampo] = useState<Record<string, string>>({})
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(null)

  async function onSubmit(valori: Record<string, unknown>) {
    setErroriDiCampo({})
    setErroreGenerale(null)
    setInvioInCorso(true)

    const sessione: ScheduleSessionRequest = {
      courseId: corsoId,
      date: String(valori.date ?? ''),
      startTime: String(valori.startTime ?? ''),
      /*
       * `PlaceRequest` è piatto con `name` opzionale perché è la forma che HTTP trasporta e
       * che `@ValidateIf` sa validare (`contracts/sessions.ts`): su `ONLINE` il campo non
       * va inviato affatto, non inviato vuoto — `forbidNonWhitelisted` rifiuta un `name`
       * che non dovrebbe esserci.
       */
      place:
        tipoLuogo === 'AULA'
          ? { type: 'AULA', name: String(valori.placeName ?? '').trim() }
          : { type: 'ONLINE' },
      teacher: String(valori.teacher ?? '').trim(),
      capacity: Number(valori.capacity),
    }

    try {
      await invia(sessione)
    } catch (errore: unknown) {
      const campo = campoInErrore(errore)
      const messaggio = messaggioDiErrore(errore)

      if (campo) setErroriDiCampo({ [campo]: messaggio })
      else setErroreGenerale(messaggio)

      setInvioInCorso(false)
    }
  }

  return (
    <Form errors={erroriDiCampo} onFormSubmit={onSubmit}>
      <div className="flex flex-wrap gap-3">
        <Field name="date" className="max-w-44">
          <FieldLabel>Data</FieldLabel>
          {/*
           * `type="date"` restituisce già `YYYY-MM-DD`, che è esattamente `IsoDate`: non
           * c'è nessuna conversione da fare, e soprattutto nessun `Date` da costruire —
           * data e ora restano stringhe locali senza fuso (§4.1).
           */}
          <Input required type="date" />
          <FieldError />
        </Field>

        <Field name="startTime" className="max-w-32">
          <FieldLabel>Ora di inizio</FieldLabel>
          <Input required type="time" />
          <FieldError />
        </Field>

        <Field name="capacity" className="max-w-32">
          <FieldLabel>Capienza</FieldLabel>
          <Input required type="number" placeholder="12" />
          <FieldError />
        </Field>
      </div>

      <Field name="teacher">
        <FieldLabel>Docente</FieldLabel>
        <Input required placeholder="Nome e cognome" />
        <FieldError />
      </Field>

      <div className="flex flex-wrap gap-3">
        <Field name="placeType" className="max-w-40">
          <FieldLabel>Luogo</FieldLabel>
          <Select
            value={tipoLuogo}
            onChange={(evento) =>
              setTipoLuogo(evento.currentTarget.value as PlaceType)
            }
          >
            <option value="AULA">In aula</option>
            <option value="ONLINE">Online</option>
          </Select>
        </Field>

        {tipoLuogo === 'AULA' && (
          <Field name="placeName" className="max-w-64">
            <FieldLabel>Nome dell’aula</FieldLabel>
            <Input required placeholder="Aula Magna" />
            <FieldError />
          </Field>
        )}
      </div>

      {erroreGenerale && (
        <p className="text-sm text-destructive">{erroreGenerale}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={invioInCorso}>
          {invioInCorso ? 'Programmazione…' : 'Programma sessione'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={invioInCorso}
          onClick={onAnnulla}
        >
          Annulla
        </Button>
      </div>
    </Form>
  )
}
