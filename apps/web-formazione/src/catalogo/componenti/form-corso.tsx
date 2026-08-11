import type { CreateCourseRequest } from '@repo/contracts'
import { Button } from '@repo/ui/components/button'
import { Field, FieldError, FieldLabel } from '@repo/ui/components/field'
import { Form } from '@repo/ui/components/form'
import { Input } from '@repo/ui/components/input'
import { Textarea } from '@repo/ui/components/textarea'
import { useState } from 'react'
import { Link } from 'react-router'

import { campoInErrore, messaggioDiErrore } from '@/app/errori'

/**
 * Il form dei dettagli di un corso, uno solo per creazione e modifica.
 *
 * Non è riuso opportunistico: `UpdateCourseRequest` **è** `CreateCourseRequest`, e non è
 * parziale — `modificaDettagli` sostituisce i dettagli in blocco, e campi opzionali
 * suggerirebbero una semantica di merge che l'aggregato non ha (`contracts/courses.ts`).
 * Due form separati inviterebbero prima o poi a scriverne uno parziale.
 *
 * I **vincoli di lunghezza non stanno qui**: li dichiara la `ValidationPipe` del DTO e li
 * ridichiara il value object nel dominio (§4.2). Replicarli darebbe tre punti da tenere
 * allineati e la falsa impressione che il frontend sappia cosa è valido — non lo sa, lo
 * chiede. Resta `required`, che non è una regola di dominio ma il minimo per non spedire
 * un modulo vuoto e aspettare un giro di rete per scoprirlo.
 */
export function FormCorso({
  valoriIniziali,
  testoInvio,
  invia,
}: {
  valoriIniziali?: CreateCourseRequest
  testoInvio: string
  invia: (corso: CreateCourseRequest) => Promise<void>
}) {
  const [invioInCorso, setInvioInCorso] = useState(false)
  const [erroriDiCampo, setErroriDiCampo] = useState<Record<string, string>>({})
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(null)

  async function onSubmit(valori: Record<string, unknown>) {
    setErroriDiCampo({})
    setErroreGenerale(null)
    setInvioInCorso(true)

    /*
     * I valori arrivano dal form come stringhe, anche da `type="number"`: la conversione è
     * esplicita perché `durationHours` è un `number`, e un `"8"` che passa per JSON diventa
     * un `400` della `ValidationPipe` invece di un corso.
     */
    const corso: CreateCourseRequest = {
      title: String(valori.title ?? '').trim(),
      description: String(valori.description ?? '').trim(),
      durationHours: Number(valori.durationHours),
      topic: String(valori.topic ?? '').trim(),
    }

    try {
      await invia(corso)
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
      <Field name="title" className="w-full">
        <FieldLabel>Titolo</FieldLabel>
        <Input
          required
          defaultValue={valoriIniziali?.title}
          placeholder="Introduzione al DDD"
        />
        <FieldError />
      </Field>

      <Field name="description" className="w-full">
        <FieldLabel>Descrizione</FieldLabel>
        <Textarea
          required
          defaultValue={valoriIniziali?.description}
          placeholder="Di cosa parla il corso e a chi si rivolge."
        />
        <FieldError />
      </Field>

      <Field name="durationHours" className="w-full">
        <FieldLabel>Durata in ore</FieldLabel>
        <Input
          required
          type="number"
          defaultValue={valoriIniziali?.durationHours}
          placeholder="8"
        />
        <FieldError />
      </Field>

      <Field name="topic" className="w-full">
        <FieldLabel>Argomento</FieldLabel>
        <Input
          required
          defaultValue={valoriIniziali?.topic}
          placeholder="Progettazione software"
        />
        <FieldError />
      </Field>

      {erroreGenerale && (
        <p className="text-sm text-destructive">{erroreGenerale}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={invioInCorso}>
          {invioInCorso ? 'Salvataggio…' : testoInvio}
        </Button>
        <Button variant="ghost" render={<Link to="/corsi" />}>
          Annulla
        </Button>
      </div>
    </Form>
  )
}
