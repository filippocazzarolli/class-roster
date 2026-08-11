import type { CancelReason, CourseSession } from '@repo/contracts'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import { Field, FieldLabel } from '@repo/ui/components/field'
import { Input } from '@repo/ui/components/input'
import { Select } from '@repo/ui/components/select'
import { useState } from 'react'

import { api } from '@/app/api'
import { messaggioDiErrore } from '@/app/errori'
import { formattaDataEOra, formattaLuogo } from '@/app/formato'

/**
 * La sessione **vista dal responsabile**.
 *
 * Vive in `web-formazione` e non in `packages/ui`, ed è la stessa card che
 * `web-dipendente` ha in una versione diversa: §4.11 vieta esplicitamente un
 * `CardSessione` condiviso, perché il dipendente vede i posti residui e un bottone
 * «Iscriviti», il responsabile vede il numero di iscritti e un bottone «Annulla». Un
 * componente solo diventerebbe in due settimane un albero di `if` sull'attore — cioè il
 * ruolo reintrodotto nel codice comune, che è ciò che dividere le app doveva evitare.
 *
 * Coerentemente, `CourseSession` non ha `remainingSeats`: qui non si mostrano i posti che
 * restano, si mostra chi c'è.
 */
export function CardSessione({
  sessione,
  onCambiata,
}: {
  sessione: CourseSession
  onCambiata: () => void
}) {
  const [azione, setAzione] = useState<'nessuna' | 'capienza' | 'annulla'>(
    'nessuna',
  )
  const [errore, setErrore] = useState<string | null>(null)
  const annullata = sessione.state === 'CANCELLED'

  function chiudi() {
    setAzione('nessuna')
    setErrore(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {formattaDataEOra(sessione.date, sessione.startTime)}
        </CardTitle>
        <CardDescription>
          {formattaLuogo(sessione.place)} · {sessione.teacher}
        </CardDescription>
        <CardAction>
          {annullata ? (
            <Badge variant="destructive">Annullata</Badge>
          ) : (
            <Badge variant="positive">Programmata</Badge>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        <span>
          Iscritti: <strong className="text-foreground">{sessione.enrolled}</strong>{' '}
          su {sessione.capacity}
        </span>
        {sessione.waiting > 0 && (
          <span>
            In lista d’attesa:{' '}
            <strong className="text-foreground">{sessione.waiting}</strong>
          </span>
        )}
        {/*
         * Il motivo dell'annullamento è parte di ciò che il responsabile deve leggere:
         * §4.5 lo dice esplicitamente parlando di R4, ed è la ragione per cui le sessioni
         * annullate restano in questa lista invece di sparire.
         */}
        {annullata && sessione.cancellationReason !== null && (
          <span>Motivo: {MOTIVI[sessione.cancellationReason]}</span>
        )}
      </CardContent>

      {errore && (
        <CardContent className="text-sm text-destructive">{errore}</CardContent>
      )}

      {azione === 'capienza' && (
        <CardContent>
          <FormCapienza
            sessione={sessione}
            onErrore={setErrore}
            onFatto={() => {
              chiudi()
              onCambiata()
            }}
            onAnnulla={chiudi}
          />
        </CardContent>
      )}

      {azione === 'annulla' && (
        <CardContent>
          <FormAnnullamento
            sessione={sessione}
            onErrore={setErrore}
            onFatto={() => {
              chiudi()
              onCambiata()
            }}
            onAnnulla={chiudi}
          />
        </CardContent>
      )}

      {/*
       * Su una sessione annullata non resta nulla da fare: `SessioneGiaAnnullata` la
       * rifiuterebbe, e la capienza di una sessione che non si terrà non significa niente.
       */}
      {!annullata && azione === 'nessuna' && (
        <CardFooter className="gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAzione('capienza')}
          >
            Modifica capienza
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setAzione('annulla')}
          >
            Annulla sessione
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

/**
 * `PATCH /api/sessions/:id/capacity` — l'unico dettaglio modificabile.
 *
 * Per tutto il resto si annulla e si riprogramma (HS-13): data, luogo e docente non si
 * cambiano, e non c'è un modulo che lasci credere il contrario.
 */
function FormCapienza({
  sessione,
  onErrore,
  onFatto,
  onAnnulla,
}: {
  sessione: CourseSession
  onErrore: (messaggio: string | null) => void
  onFatto: () => void
  onAnnulla: () => void
}) {
  const [capienza, setCapienza] = useState(String(sessione.capacity))
  const [inCorso, setInCorso] = useState(false)

  async function salva() {
    setInCorso(true)
    onErrore(null)

    try {
      await api.sessions.changeCapacity(sessione.id, {
        capacity: Number(capienza),
      })
      onFatto()
    } catch (e: unknown) {
      onErrore(messaggioDiErrore(e))
      setInCorso(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Field name="capacity" className="max-w-40">
        <FieldLabel>Nuova capienza</FieldLabel>
        <Input
          type="number"
          value={capienza}
          onValueChange={setCapienza}
          disabled={inCorso}
        />
      </Field>

      {/*
       * Nessun avviso preventivo del tipo «non puoi scendere sotto gli iscritti»: la
       * capienza sotto gli iscritti si rifiuta senza espellere nessuno (HS-2), e a dirlo
       * è l'aggregato con `CapienzaInferioreAgliIscritti`. Anticiparlo qui col numero
       * letto dal read model significherebbe decidere al suo posto su un dato che nel
       * frattempo può essere cambiato.
       */}
      <div className="flex gap-2">
        <Button size="sm" disabled={inCorso} onClick={salva}>
          {inCorso ? 'Salvataggio…' : 'Salva capienza'}
        </Button>
        <Button size="sm" variant="ghost" disabled={inCorso} onClick={onAnnulla}>
          Annulla
        </Button>
      </div>
    </div>
  )
}

/** `POST /api/sessions/:id/cancel` — una transizione con un nome, non un `PATCH`. */
function FormAnnullamento({
  sessione,
  onErrore,
  onFatto,
  onAnnulla,
}: {
  sessione: CourseSession
  onErrore: (messaggio: string | null) => void
  onFatto: () => void
  onAnnulla: () => void
}) {
  const [motivo, setMotivo] = useState<CancelReason>('DECISIONE_RESPONSABILE')
  const [inCorso, setInCorso] = useState(false)

  async function annulla() {
    setInCorso(true)
    onErrore(null)

    try {
      await api.sessions.cancel(sessione.id, { reason: motivo })
      onFatto()
    } catch (e: unknown) {
      onErrore(messaggioDiErrore(e))
      setInCorso(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Field name="reason" className="max-w-72">
        <FieldLabel>Motivo dell’annullamento</FieldLabel>
        <Select
          value={motivo}
          onChange={(evento) =>
            setMotivo(evento.currentTarget.value as CancelReason)
          }
          disabled={inCorso}
        >
          {(Object.keys(MOTIVI) as CancelReason[]).map((valore) => (
            <option key={valore} value={valore}>
              {MOTIVI[valore]}
            </option>
          ))}
        </Select>
      </Field>

      <p className="text-xs text-muted-foreground">
        Gli iscritti restano registrati sulla sessione: sono i destinatari della notifica di
        annullamento.
      </p>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={inCorso}
          onClick={annulla}
        >
          {inCorso ? 'Annullamento…' : 'Conferma annullamento'}
        </Button>
        <Button size="sm" variant="ghost" disabled={inCorso} onClick={onAnnulla}>
          Torna indietro
        </Button>
      </div>
    </div>
  )
}

/**
 * I motivi, tradotti.
 *
 * ⚠️ I valori sono in italiano anche sul filo — è il `@IsIn` del DTO, e `contracts`
 * rispecchia il backend invece di correggerlo. Se cambiano, cambiano insieme lì e qui.
 */
const MOTIVI: Record<CancelReason, string> = {
  DECISIONE_RESPONSABILE: 'Decisione del responsabile',
  CORSO_RITIRATO: 'Corso ritirato',
}
