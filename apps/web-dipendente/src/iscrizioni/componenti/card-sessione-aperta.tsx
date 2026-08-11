import type { EnrollmentResult, OpenSession } from '@repo/contracts'
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
import { useState } from 'react'

import { api } from '@/app/api'
import { messaggioDiErrore } from '@/app/errori'
import { formattaDataEOra, formattaLuogo } from '@/app/formato'

/**
 * La sessione aperta, **vista dal dipendente**.
 *
 * È la copia divergente di quella del responsabile, e §4.11 vieta di unirle in
 * `packages/ui`: qui si mostrano i posti residui e un bottone «Iscriviti», là il numero di
 * iscritti e un bottone «Annulla». Somiglianza non è riuso.
 */
export function CardSessioneAperta({
  sessione,
  onIscritto,
}: {
  sessione: OpenSession
  onIscritto?: (esito: EnrollmentResult, sessione: OpenSession) => void
}) {
  const [esito, setEsito] = useState<EnrollmentResult | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)

  async function iscriviti() {
    setInCorso(true)
    setErrore(null)

    try {
      /*
       * Nessun corpo: il dipendente arriva da `X-Utente`, e INV-9 non è manomettibile
       * perché non c'è nulla da manomettere (§4.6).
       */
      const risultato = await api.enrollments.enroll(sessione.id)
      setEsito(risultato)
      onIscritto?.(risultato, sessione)
    } catch (e: unknown) {
      setErrore(messaggioDiErrore(e))
    } finally {
      setInCorso(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sessione.courseTitle}</CardTitle>
        <CardDescription>
          {formattaDataEOra(sessione.date, sessione.startTime)} ·{' '}
          {formattaLuogo(sessione.place)} · {sessione.teacher}
        </CardDescription>
        <CardAction>
          {/*
           * I posti residui **si mostrano e non si usano per decidere** (§4.5): a zero
           * l'etichetta cambia tono, ma è solo un'informazione. Chi decide se il posto c'è
           * è la `Sessione`, con l'aggregato caricato per intero e il lock ottimistico.
           */}
          {sessione.remainingSeats > 0 ? (
            <Badge variant="positive">
              {sessione.remainingSeats}{' '}
              {sessione.remainingSeats === 1 ? 'posto' : 'posti'}
            </Badge>
          ) : (
            <Badge variant="warning">Nessun posto libero</Badge>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="text-muted-foreground">
        {sessione.enrolled} iscritti su {sessione.capacity}
        {sessione.waiting > 0 && ` · ${sessione.waiting} in lista d'attesa`}
      </CardContent>

      {errore && (
        <CardContent className="text-sm text-destructive">{errore}</CardContent>
      )}

      {esito !== null && (
        <CardContent className="text-sm">
          {/*
           * **L'esito si legge dalla risposta, non si prevede** (§4.11). Entrambi i casi
           * sono un `201`: a posti esauriti non si viene respinti, si finisce in coda con
           * una posizione — ed è per questo che il tipo di ritorno è un'unione discriminata
           * e non un booleano.
           */}
          {esito.status === 'ENROLLED' ? (
            <span className="text-primary">Iscrizione confermata.</span>
          ) : (
            <span className="text-amber-700 dark:text-amber-500">
              Sei in lista d’attesa, in posizione {esito.position}. Se si libera un
              posto entrerai automaticamente.
            </span>
          )}
        </CardContent>
      )}

      {esito === null && (
        <CardFooter>
          {/*
           * Il bottone resta abilitato **anche a zero posti residui**, ed è la regola che
           * §4.11 protegge per nome: sarà `status: WAITLISTED` a dire cosa è successo. Un
           * `disabled={remainingSeats === 0}` aggiunto per gentilezza farebbe decidere al
           * frontend quale dei due esiti si verifica.
           */}
          <Button size="sm" disabled={inCorso} onClick={iscriviti}>
            {inCorso ? 'Iscrizione…' : 'Iscriviti'}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
