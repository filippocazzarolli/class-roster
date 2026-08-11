import type { Course, CourseSession } from '@repo/contracts'
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
import { useCallback, useState } from 'react'
import { Link } from 'react-router'

import { api } from '@/app/api'
import { messaggioDiErrore } from '@/app/errori'
import { useLettura } from '@/app/lettura'
import { StatoCorso } from '@/catalogo/componenti/stato-corso'

/**
 * R3 — il catalogo corsi, con il conteggio delle sessioni programmate (§4.5).
 *
 * **Due letture separate, composte qui.** `GET /courses` sta in `catalogo`,
 * `GET /sessions` in `iscrizioni`, e comporle è compito del frontend: una lettura sola che
 * attraversasse i due archivi sarebbe la foreign key fra moduli che `domain.md` §2.9 ha
 * rifiutato — costerebbe una riga, dato che in memoria sono due mappe nello stesso
 * processo, e proprio per questo la disciplina qui conta più di quando c'era SQL.
 *
 * `sessions.list()` senza `courseId` è una chiamata sola per l'intera vista: il filtro
 * opzionale di R4 esiste per evitare la richiesta per riga, cioè l'N+1 (§4.5).
 */
export function ElencoCorsiPage() {
  const { stato, ricarica } = useLettura(
    useCallback(
      () => Promise.all([api.courses.list(), api.sessions.list()]),
      [],
    ),
  )

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Catalogo corsi</h2>
        <Button render={<Link to="/corsi/nuovo" />}>Nuovo corso</Button>
      </div>

      {stato.fase === 'caricamento' && (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      )}

      {stato.fase === 'errore' && (
        <p className="text-sm text-destructive">{stato.messaggio}</p>
      )}

      {stato.fase === 'pronto' && (
        <ElencoCorsi
          corsi={stato.dati[0]}
          sessioni={stato.dati[1]}
          onCambiato={ricarica}
        />
      )}
    </main>
  )
}

function ElencoCorsi({
  corsi,
  sessioni,
  onCambiato,
}: {
  corsi: Course[]
  sessioni: CourseSession[]
  onCambiato: () => void
}) {
  if (corsi.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nessun corso in catalogo. Il primo si crea da «Nuovo corso».
      </p>
    )
  }

  /*
   * Solo le sessioni `SCHEDULED`: R4 restituisce anche le annullate — è la vista di
   * gestione e devono esserci (§4.5) — ma «tre sessioni programmate» non deve contare
   * quelle che sono state annullate.
   */
  const programmatePerCorso = new Map<string, number>()
  for (const sessione of sessioni) {
    if (sessione.state !== 'SCHEDULED') continue
    const corrente = programmatePerCorso.get(sessione.courseId) ?? 0
    programmatePerCorso.set(sessione.courseId, corrente + 1)
  }

  return (
    <ul className="flex flex-col gap-3">
      {corsi.map((corso) => (
        <li key={corso.id}>
          <RigaCorso
            corso={corso}
            sessioniProgrammate={programmatePerCorso.get(corso.id) ?? 0}
            onCambiato={onCambiato}
          />
        </li>
      ))}
    </ul>
  )
}

function RigaCorso({
  corso,
  sessioniProgrammate,
  onCambiato,
}: {
  corso: Course
  sessioniProgrammate: number
  onCambiato: () => void
}) {
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function esegui(transizione: () => Promise<void>) {
    setInCorso(true)
    setErrore(null)

    try {
      await transizione()
      onCambiato()
    } catch (e: unknown) {
      setErrore(messaggioDiErrore(e))
      setInCorso(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{corso.title}</CardTitle>
        <CardDescription>
          {corso.topic} · {corso.durationHours} ore ·{' '}
          {sessioniProgrammate === 0
            ? 'nessuna sessione programmata'
            : `${sessioniProgrammate} ${sessioniProgrammate === 1 ? 'sessione programmata' : 'sessioni programmate'}`}
        </CardDescription>
        <CardAction>
          <StatoCorso stato={corso.state} />
        </CardAction>
      </CardHeader>

      <CardContent className="text-muted-foreground">
        {corso.description}
      </CardContent>

      {errore && (
        <CardContent className="text-sm text-destructive">{errore}</CardContent>
      )}

      <CardFooter className="gap-2">
        {/*
         * Le azioni seguono lo stato del corso — «Pubblica» solo da bozza, e nulla su un
         * corso ritirato, che è terminale (HS-12).
         *
         * Non è la stessa cosa che disabilitare «Iscriviti» a zero posti, che §4.11 vieta:
         * là si predirebbe l'esito di una decisione presa dall'aggregato sotto concorrenza,
         * qui si nasconde un comando che in questo stato non esiste. Se lo stato letto è
         * comunque invecchiato, l'api risponde `TransizioneCorsoNonAmmessa` e il messaggio
         * compare qui sopra.
         */}
        {corso.state === 'DRAFT' && (
          <Button
            size="sm"
            disabled={inCorso}
            onClick={() => esegui(() => api.courses.publish(corso.id))}
          >
            Pubblica
          </Button>
        )}

        {corso.state === 'PUBLISHED' && (
          <Button
            size="sm"
            variant="destructive"
            disabled={inCorso}
            onClick={() => esegui(() => api.courses.withdraw(corso.id))}
          >
            Ritira
          </Button>
        )}

        {corso.state !== 'WITHDRAWN' && (
          <Button
            size="sm"
            variant="outline"
            render={<Link to={`/corsi/${corso.id}/modifica`} />}
          >
            Modifica
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          render={<Link to={`/corsi/${corso.id}/sessioni`} />}
        >
          Sessioni
        </Button>
      </CardFooter>
    </Card>
  )
}
