import type { Course, CourseState } from '@repo/contracts';
import { CorsoDTO, StatoCorsoDTO } from '../../read-model/letture-corsi';

/**
 * La traduzione italiano → inglese di R3 — `architecture.md` §4.6.
 *
 * Chiamata solo dal controller: è lo stesso confine che all'andata traduce `title` in
 * `titolo`. Il tipo di ritorno viene da `@repo/contracts`, quindi una divergenza fra
 * lettura e contratto non compila.
 */
export const aCourse = (c: CorsoDTO): Course => ({
  id: c.id,
  title: c.titolo,
  description: c.descrizione,
  durationHours: c.durataOre,
  topic: c.argomento,
  state: aCourseState(c.stato),
});

/**
 * Qui la traduzione dei valori **avviene**, a differenza di `AULA`/`ONLINE`: `BOZZA`,
 * `PUBBLICATO` e `RITIRATO` non compaiono in nessun DTO in ingresso — non esiste una rotta
 * che accetti uno stato, perché le transizioni hanno un nome proprio (`publish`,
 * `withdraw`). Non c'è quindi alcun vocabolario in ingresso da rispettare.
 */
const aCourseState = (stato: StatoCorsoDTO): CourseState =>
  stato === 'BOZZA'
    ? 'DRAFT'
    : stato === 'PUBBLICATO'
      ? 'PUBLISHED'
      : 'WITHDRAWN';
