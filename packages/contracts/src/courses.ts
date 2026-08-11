/**
 * Le rotte di `catalogo` — `architecture.md` §4.6.
 */

/**
 * `POST /api/courses`.
 *
 * I vincoli di lunghezza non stanno qui: li dichiara la `ValidationPipe` nel DTO, e li
 * ridichiara il value object nel dominio (§4.2). Un tipo non può esprimerli, e fingere di
 * farlo con un template literal type darebbe una falsa sicurezza al frontend.
 */
export interface CreateCourseRequest {
  readonly title: string;
  readonly description: string;
  readonly durationHours: number;
  readonly topic: string;
}

/**
 * `PATCH /api/courses/:id`.
 *
 * Identica alla creazione, e non parziale: `modificaDettagli` sostituisce i dettagli in
 * blocco, e campi opzionali suggerirebbero una semantica di merge che l'aggregato non ha.
 */
export type UpdateCourseRequest = CreateCourseRequest;

/*
 * ─────────────────────────────────────────────────────────────────────────────────────
 * R3 — Catalogo corsi (`architecture.md` §4.5)
 *
 * Implementata: `letture-corsi.ts` la serve su `GET /api/courses`, e i campi qui sotto
 * sono quelli che risponde.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * Lo stato del corso, **tradotto**: nel dominio è `BOZZA | PUBBLICATO | RITIRATO`, e la
 * traduzione avviene nel controller e in nessun altro punto (§4.6).
 */
export type CourseState = 'DRAFT' | 'PUBLISHED' | 'WITHDRAWN';

/**
 * `GET /api/courses` — elenco piatto, con lo stato.
 *
 * **Senza il conteggio delle sessioni programmate**, che è un dato di `iscrizioni`: §4.5
 * lo dichiara come seconda lettura separata, composta nel frontend. Una `scheduledSessions`
 * qui dentro sarebbe la foreign key fra moduli che `domain.md` §2.9 ha rifiutato.
 */
export interface Course {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly durationHours: number;
  readonly topic: string;
  readonly state: CourseState;
}
