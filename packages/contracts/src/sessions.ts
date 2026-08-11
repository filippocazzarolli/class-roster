// Import relativi **senza estensione**: questi file vengono compilati due volte, dal
// bundler delle app e da `tsc` dell'api con `moduleResolution: nodenext`. Un `./common.ts`
// passerebbe il primo e fallirebbe il secondo.
import type { IsoDate, TimeOfDay } from './common';

/**
 * Le rotte di `iscrizioni` che riguardano la sessione — `architecture.md` §4.6.
 */

/** `AULA` richiede il nome dell'aula, `ONLINE` non deve averlo. */
export type PlaceType = 'AULA' | 'ONLINE';

/**
 * Il luogo **in richiesta**: forma piatta, con `name` opzionale.
 *
 * È la forma che HTTP può trasportare e che `@ValidateIf` sa validare — non la stessa che
 * il dominio ha, dove `Luogo` è una somma di due casi (`domain.md` §2.6). La versione
 * onesta, il tipo unione `Place` qui sotto, vale in risposta: in ingresso il contratto
 * deve poter descrivere anche la richiesta sbagliata, altrimenti non c'è nulla da rifiutare.
 */
export interface PlaceRequest {
  readonly type: PlaceType;
  readonly name?: string;
}

/** Il luogo **in risposta**: la somma dei due casi, come nel dominio. */
export type Place =
  | { readonly type: 'AULA'; readonly name: string }
  | { readonly type: 'ONLINE' };

/**
 * Lo stato della sessione, **tradotto**: nel dominio è `PROGRAMMATA | ANNULLATA`.
 */
export type SessionState = 'SCHEDULED' | 'CANCELLED';

/** `POST /api/sessions` */
export interface ScheduleSessionRequest {
  readonly courseId: string;
  readonly date: IsoDate;
  readonly startTime: TimeOfDay;
  readonly place: PlaceRequest;
  readonly teacher: string;
  readonly capacity: number;
}

/** `PATCH /api/sessions/:id/capacity` */
export interface ChangeCapacityRequest {
  readonly capacity: number;
}

/**
 * Il motivo dell'annullamento.
 *
 * ⚠️ Valori in italiano: sono quelli che il DTO accetta oggi (`@IsIn`), mentre §4.6 vuole
 * inglesi rotte e DTO. Il contratto rispecchia il backend, non lo corregge — se i valori
 * cambiano, cambiano insieme qui e nel DTO, e il compilatore lo impone.
 */
export type CancelReason = 'DECISIONE_RESPONSABILE' | 'CORSO_RITIRATO';

/** `POST /api/sessions/:id/cancel` */
export interface CancelSessionRequest {
  readonly reason: CancelReason;
}

/**
 * `GET /api/sessions?courseId=…` — il filtro è **opzionale**.
 *
 * Omesso, la lettura è quella che compone R3: la vista catalogo chiama una volta e conta
 * le sessioni per corso, invece di una richiesta per riga. Presente, è l'elenco della vista
 * «programmazione sessioni». Una lettura sola, con un filtro — non due rotte.
 */
export interface ListSessionsQuery {
  readonly courseId?: string;
}

/*
 * ─────────────────────────────────────────────────────────────────────────────────────
 * R1 — Sessioni aperte, con posti residui (`architecture.md` §4.5)
 *
 * Implementata: il read model di `iscrizioni` la serve su `GET /api/sessions/open`, e i
 * campi qui sotto sono quelli che risponde.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * `GET /api/sessions/open`
 *
 * `remainingSeats` **si mostra e non si usa per decidere** (§4.5): chi decide se il posto
 * c'è è la `Sessione`, con l'aggregato caricato per intero e il lock ottimistico. Il
 * bottone «Iscriviti» resta abilitato anche a zero.
 */
export interface OpenSession {
  readonly id: string;
  readonly courseId: string;
  readonly courseTitle: string;
  readonly date: IsoDate;
  readonly startTime: TimeOfDay;
  readonly place: Place;
  readonly teacher: string;
  readonly capacity: number;
  readonly enrolled: number;
  readonly waiting: number;
  readonly remainingSeats: number;
}

/*
 * ─────────────────────────────────────────────────────────────────────────────────────
 * R4 — Le sessioni di un corso (`architecture.md` §4.5)
 * ─────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * `GET /api/sessions?courseId=…`
 *
 * La sessione **vista dal responsabile**, e per questo diversa da `OpenSession`: nessun
 * `remainingSeats` — lui vede quanti sono iscritti, non quanti posti restano — e nessun
 * filtro sul tempo o sullo stato, perché è la sua vista di gestione e deve mostrare anche
 * le sessioni passate e quelle annullate.
 *
 * Che le due letture producano due tipi invece di uno con campi opzionali è la stessa
 * decisione di §4.11 sul non condividere `CardSessione`: sono due attori che guardano due
 * cose, e unirle porterebbe a un tipo con metà dei campi sempre indefiniti.
 */
export interface CourseSession {
  readonly id: string;
  readonly courseId: string;
  readonly courseTitle: string;
  readonly date: IsoDate;
  readonly startTime: TimeOfDay;
  readonly place: Place;
  readonly teacher: string;
  readonly capacity: number;
  readonly enrolled: number;
  readonly waiting: number;
  readonly state: SessionState;

  /** Presente solo su una sessione annullata: `null` altrove. */
  readonly cancellationReason: CancelReason | null;
}
