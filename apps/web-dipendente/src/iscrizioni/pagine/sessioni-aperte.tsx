import type { EnrollmentResult, MyEnrollment, OpenSession } from '@repo/contracts'
import { Button } from '@repo/ui/components/button'
import { useCallback, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { api } from '@/app/api'
import { messaggioDiErrore } from '@/app/errori'
import { useLettura } from '@/app/lettura'
import { formattaDataEOra } from '@/app/formato'
import { CardSessioneAperta } from '@/iscrizioni/componenti/card-sessione-aperta'

/**
 * R1 — le sessioni aperte, con i posti residui (§4.5).
 *
 * «Aperta» non è uno stato della sessione ma la congiunzione di due condizioni —
 * programmata e non ancora iniziata — ed è per questo che la rotta è il sottopercorso
 * letterale `/sessions/open` e non un filtro che il client compone a modo suo (§4.6).
 *
 * La pagina ha una seconda modalità: con `?cambio=<idSessione>` è il primo passo del
 * cambio sessione (HS-5), che non è un comando ma una sequenza.
 */
export function SessioniApertePage() {
  const [parametri] = useSearchParams()
  const cambioDa = parametri.get('cambio')

  const { stato } = useLettura(
    useCallback(
      () =>
        Promise.all([
          api.sessions.listOpen(),
          // Serve solo per raccontare da quale sessione si sta uscendo.
          cambioDa === null
            ? Promise.resolve<MyEnrollment[]>([])
            : api.enrollments.listMine(),
        ]),
      [cambioDa],
    ),
  )

  const [nuovaIscrizione, setNuovaIscrizione] = useState<{
    esito: EnrollmentResult
    sessione: OpenSession
  } | null>(null)

  if (stato.fase === 'caricamento') {
    return <p className="text-sm text-muted-foreground">Caricamento…</p>
  }

  if (stato.fase === 'errore') {
    return <p className="text-sm text-destructive">{stato.messaggio}</p>
  }

  const [aperte, mieIscrizioni] = stato.dati
  const daCambiare = mieIscrizioni.find((i) => i.sessionId === cambioDa)

  /*
   * In modalità cambio si mostrano solo le sessioni dello stesso corso, e mai quella da
   * cui si sta uscendo: `IscrizioneDuplicata` la rifiuterebbe comunque, ma proporla come
   * alternativa a sé stessa non ha senso.
   */
  const visibili =
    daCambiare === undefined
      ? aperte
      : aperte.filter(
          (s) =>
            s.id !== cambioDa &&
            s.courseTitle === daCambiare.courseTitle,
        )

  return (
    <main className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">
        {daCambiare === undefined ? 'Sessioni aperte' : 'Cambia sessione'}
      </h2>

      {daCambiare !== undefined && (
        <SequenzaDiCambio
          daCambiare={daCambiare}
          nuovaIscrizione={nuovaIscrizione}
        />
      )}

      {visibili.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {daCambiare === undefined
            ? 'Nessuna sessione aperta al momento.'
            : 'Non ci sono altre sessioni aperte per questo corso.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibili.map((sessione) => (
            <li key={sessione.id}>
              <CardSessioneAperta
                sessione={sessione}
                onIscritto={(esito, s) =>
                  setNuovaIscrizione({ esito, sessione: s })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

/**
 * Il cambio sessione, guidato — HS-5.
 *
 * **Non esiste un comando «cambia sessione»** (`aggregation.md` §3.6): esistono due
 * comandi, e l'ordine fra loro non è indifferente. Prima ci si iscrive alla nuova, poi si
 * annulla la vecchia; l'ordine inverso libera il posto un istante prima di riprenderlo, e
 * in quell'istante lo prende qualcun altro dalla lista d'attesa.
 *
 * L'interfaccia quindi *guida* la sequenza e non la esegue da sola — soprattutto non
 * annulla in automatico quando la nuova iscrizione è finita in coda, dove annullare
 * significherebbe scambiare un posto certo con uno incerto.
 */
function SequenzaDiCambio({
  daCambiare,
  nuovaIscrizione,
}: {
  daCambiare: MyEnrollment
  nuovaIscrizione: { esito: EnrollmentResult; sessione: OpenSession } | null
}) {
  const navigate = useNavigate()
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function annullaLaVecchia() {
    setInCorso(true)
    setErrore(null)

    try {
      await api.enrollments.cancelMine(daCambiare.sessionId)
      navigate('/iscrizioni')
    } catch (e: unknown) {
      setErrore(messaggioDiErrore(e))
      setInCorso(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
      <p className="text-muted-foreground">
        Stai lasciando la sessione del{' '}
        <strong className="text-foreground">
          {formattaDataEOra(daCambiare.date, daCambiare.startTime)}
        </strong>
        . Prima iscriviti alla nuova, poi annulla questa: in quest’ordine non resti mai
        senza posto.
      </p>

      {nuovaIscrizione === null ? (
        <p className="text-muted-foreground">
          <strong className="text-foreground">Passo 1 di 2</strong> — scegli la nuova
          sessione qui sotto.
        </p>
      ) : (
        <>
          <p>
            <strong>Passo 2 di 2</strong> —{' '}
            {nuovaIscrizione.esito.status === 'ENROLLED' ? (
              <>
                sei iscritto alla sessione del{' '}
                {formattaDataEOra(
                  nuovaIscrizione.sessione.date,
                  nuovaIscrizione.sessione.startTime,
                )}
                . Ora puoi annullare quella precedente.
              </>
            ) : (
              <>
                sei finito in <strong>lista d’attesa</strong> (posizione{' '}
                {nuovaIscrizione.esito.position}) sulla nuova sessione.
              </>
            )}
          </p>

          {nuovaIscrizione.esito.status === 'WAITLISTED' && (
            <p className="text-amber-700 dark:text-amber-500">
              Annullando quella precedente rinunceresti a un posto per una posizione in
              coda. Conviene solo se sei sicuro.
            </p>
          )}

          {errore && <p className="text-destructive">{errore}</p>}

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={
                nuovaIscrizione.esito.status === 'ENROLLED'
                  ? 'default'
                  : 'destructive'
              }
              disabled={inCorso}
              onClick={annullaLaVecchia}
            >
              {inCorso ? 'Annullamento…' : 'Annulla la sessione precedente'}
            </Button>
            <Button size="sm" variant="ghost" render={<Link to="/iscrizioni" />}>
              Tienile entrambe
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
