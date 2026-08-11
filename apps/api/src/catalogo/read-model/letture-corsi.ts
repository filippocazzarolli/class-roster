/**
 * La lettura di `catalogo` — R3 di `architecture.md` §4.5.
 *
 * Porta separata dal repository per lo stesso motivo di `LettureSessioni`: restituisce DTO
 * e non `Corso`, così il read model non può diventare la scorciatoia verso l'aggregato.
 *
 * Nessun `adesso` fra i parametri: a differenza di R1 e R2, il catalogo non ha campi che
 * dipendono dal tempo. Il corso non ha un «quando».
 */
export abstract class LettureCorsi {
  /** R3 — l'elenco dei corsi, con lo stato. */
  abstract listaCorsi(): CorsoDTO[];
}

export type StatoCorsoDTO = 'BOZZA' | 'PUBBLICATO' | 'RITIRATO';

/**
 * R3 — un corso in elenco.
 *
 * **Senza il conteggio delle sessioni programmate**, che è un dato del modulo
 * `iscrizioni`: §4.5 dichiara R3 come due letture separate composte nel frontend. Un
 * campo `sessioniProgrammate` qui sarebbe la foreign key fra moduli che `domain.md` §2.9
 * ha rifiutato — scritta in TypeScript invece che in SQL, con lo stesso effetto.
 */
export interface CorsoDTO {
  readonly id: string;
  readonly titolo: string;
  readonly descrizione: string;
  readonly durataOre: number;
  readonly argomento: string;
  readonly stato: StatoCorsoDTO;
}
