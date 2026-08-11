import type { MyEnrollment } from '@repo/contracts'
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
import { Link } from 'react-router'

import { api } from '@/app/api'
import { messaggioDiErrore } from '@/app/errori'
import {
  formattaDataEOra,
  formattaIstante,
  formattaLuogo,
} from '@/app/formato'

/**
 * Una mia iscrizione — R2 (§4.5).
 *
 * Tre situazioni che non sono errori e vanno mostrate come tali: la sessione **annullata**
 * (l'aggregato conserva le iscrizioni, perché sono i destinatari dell'evento — HS-10), la
 * posizione in **lista d'attesa**, e la coda **decaduta** di HS-9 — chi è in coda a
 * sessione iniziata non è mai stato promosso e non lo sarà.
 */
export function CardMiaIscrizione({
  iscrizione,
  onCambiata,
}: {
  iscrizione: MyEnrollment
  onCambiata: () => void
}) {
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const annullata = iscrizione.sessionState === 'CANCELLED'
  const decaduta =
    iscrizione.status === 'WAITLISTED' && iscrizione.expired

  async function annullaIscrizione() {
    setInCorso(true)
    setErrore(null)

    try {
      await api.enrollments.cancelMine(iscrizione.sessionId)
      onCambiata()
    } catch (e: unknown) {
      setErrore(messaggioDiErrore(e))
      setInCorso(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{iscrizione.courseTitle}</CardTitle>
        <CardDescription>
          {formattaDataEOra(iscrizione.date, iscrizione.startTime)} ·{' '}
          {formattaLuogo(iscrizione.place)}
        </CardDescription>
        <CardAction>
          <StatoIscrizione iscrizione={iscrizione} />
        </CardAction>
      </CardHeader>

      <CardContent className="text-muted-foreground">
        {annullata ? (
          'La sessione è stata annullata dal responsabile.'
        ) : decaduta ? (
          "La sessione è iniziata mentre eri in lista d'attesa: non verrai più promosso."
        ) : (
          <>
            {/*
             * `cancellableUntil` è `inizio − 24h` (INV-10), derivato dal read model e non
             * ricalcolato qui: rifare quella sottrazione nel frontend significherebbe avere
             * due posti dove la regola è scritta, e vederli divergere.
             */}
            Annullabile fino al {formattaIstante(iscrizione.cancellableUntil)}
            {!iscrizione.cancellable && ' — il termine è passato'}
          </>
        )}
      </CardContent>

      {errore && (
        <CardContent className="text-sm text-destructive">{errore}</CardContent>
      )}

      {!annullata && !decaduta && (
        <CardFooter className="gap-2">
          {/*
           * Il bottone resta anche quando `cancellable` è `false`: quel campo è un
           * **suggerimento per l'interfaccia, non un permesso** (§4.5), e il rifiuto vero
           * arriva dall'aggregato come `AnnullamentoFuoriTermine`. Nasconderlo qui
           * significherebbe far decidere al read model, che può essere invecchiato.
           */}
          <Button
            size="sm"
            variant="destructive"
            disabled={inCorso}
            onClick={annullaIscrizione}
          >
            {inCorso ? 'Annullamento…' : 'Annulla iscrizione'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            render={<Link to={`/sessioni?cambio=${iscrizione.sessionId}`} />}
          >
            Cambia sessione
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

function StatoIscrizione({ iscrizione }: { iscrizione: MyEnrollment }) {
  if (iscrizione.sessionState === 'CANCELLED') {
    return <Badge variant="destructive">Sessione annullata</Badge>
  }

  if (iscrizione.status === 'ENROLLED') {
    return <Badge variant="positive">Iscritto</Badge>
  }

  if (iscrizione.expired) {
    return <Badge variant="neutral">Coda decaduta</Badge>
  }

  return (
    <Badge variant="warning">In attesa · {iscrizione.position}ª posizione</Badge>
  )
}
