/**
 * I tipi con cui lo stato viene conservato — `architecture.md` §4.7.
 *
 * Date e ore restano **stringhe** `YYYY-MM-DD` e `HH:MM`, mai numeri: un intero in
 * millisecondi reintrodurrebbe il fuso orario che il modello ha escluso, e i due formati
 * sono lessicograficamente ordinabili — l'ordinamento di R1 e il filtro «sessioni
 * future» funzionano per costruzione, confrontando stringhe.
 *
 * Vivono tutti qui perché il giorno in cui diventeranno colonne di una tabella il lavoro
 * sia locale a un file.
 */

export type DataConservata = string;
export type OraConservata = string;

/** Ogni snapshot porta la versione: è il perno del lock ottimistico. */
export interface Versionato {
  readonly versione: number;
}
