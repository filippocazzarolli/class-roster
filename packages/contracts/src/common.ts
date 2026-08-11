/**
 * Ciò che ricorre su più rotte — `architecture.md` §4.6.
 */

/**
 * Data e ora restano **stringhe**, e separate.
 *
 * Non è pigrizia: nel dominio `DataLocale` e `OraLocale` sono due value object distinti,
 * senza fuso orario, e l'ordinamento è un confronto lessicografico che funziona per
 * costruzione (§4.1). Un `Date` qui reintrodurrebbe il fuso orario del browser in un
 * modello che ha deciso di non averne.
 */
export type IsoDate = string;

/** `HH:MM`, ora locale della sessione. */
export type TimeOfDay = string;

/**
 * Un istante, `YYYY-MM-DDTHH:MM`. Compare solo nelle letture, per i valori derivati da un
 * calcolo sul tempo — `cancellableUntil` di R2. Anche qui senza fuso: è la stessa scala di
 * `IstanteLocale` nel dominio.
 */
export type IsoInstant = string;

/** La risposta di chi crea una risorsa: `POST /api/courses`, `POST /api/sessions`. */
export interface CreatedResponse {
  readonly id: string;
}
