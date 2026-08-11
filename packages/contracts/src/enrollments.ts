import type { IsoDate, IsoInstant, TimeOfDay } from './common';
import type { Place, SessionState } from './sessions';

/**
 * Le rotte di `iscrizioni` che riguardano l'iscrizione — `architecture.md` §4.6.
 *
 * `POST /api/sessions/:id/enrollments` **non ha corpo**: il dipendente arriva
 * dall'header `X-Utente`, e INV-9 non è manomettibile perché non c'è nulla da manomettere
 * (`aggregation.md` §3.9). Per lo stesso motivo non esiste un `EnrollRequest`.
 */

export type EnrollmentStatus = 'ENROLLED' | 'WAITLISTED';

/**
 * I due esiti dell'iscrizione, entrambi `201`: a posti esauriti non si viene respinti.
 *
 * Unione discriminata e non un campo opzionale: `position` esiste **se e solo se** si è
 * finiti in coda, e `{ status: 'ENROLLED', position: 3 }` non deve essere scrivibile.
 *
 * È il tipo che rende impossibile prevedere l'esito prima della risposta — che è
 * esattamente ciò che §4.11 chiede al frontend di non fare.
 */
export type EnrollmentResult =
  | { readonly status: 'ENROLLED' }
  | { readonly status: 'WAITLISTED'; readonly position: number };

/*
 * ─────────────────────────────────────────────────────────────────────────────────────
 * R2 — Le mie iscrizioni (`architecture.md` §4.5)
 *
 * Implementata: il read model di `iscrizioni` la serve su `GET /api/enrollments/me`, con
 * i campi derivati — `cancellable`, `expired` — già calcolati.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */

/** I dati della sessione che accompagnano ogni mia iscrizione. */
interface EnrolledSession {
  readonly sessionId: string;
  readonly courseTitle: string;
  readonly date: IsoDate;
  readonly startTime: TimeOfDay;
  readonly place: Place;

  /**
   * Lo stato della sessione, che qui **serve**: annullare una sessione non cancella le
   * iscrizioni — l'aggregato le conserva, perché sono i destinatari dell'evento
   * `SessioneAnnullata` (HS-10). Una sessione annullata compare quindi in questa lista, e
   * senza questo campo l'interfaccia non avrebbe modo di dirlo.
   */
  readonly sessionState: SessionState;
}

/**
 * `GET /api/enrollments/me`
 *
 * Due campi sono **derivati** e non stanno in nessuno snapshot (§4.5):
 *
 * - `cancellableUntil = inizio − 24h` e `cancellable = adesso < cancellableUntil` (INV-10);
 * - `expired`, la traduzione di HS-9: chi è in coda a sessione iniziata non è mai stato
 *   promosso, e non lo sarà. Sta **solo** nel caso `WAITLISTED`, perché è lì che il
 *   dominio l'ha assegnato (`aggregation.md` §3.8) — un campo comune renderebbe
 *   scrivibile `{ status: 'ENROLLED', expired: true }`, che non esiste.
 *
 * `cancellable` è un **suggerimento per l'interfaccia, non un permesso**: il rifiuto vero
 * arriva dall'aggregato, come `AnnullamentoFuoriTermine`.
 */
export type MyEnrollment = EnrolledSession & {
  readonly cancellableUntil: IsoInstant;
  readonly cancellable: boolean;
} & (
    | { readonly status: 'ENROLLED' }
    | {
        readonly status: 'WAITLISTED';
        readonly position: number;
        readonly expired: boolean;
      }
  );
