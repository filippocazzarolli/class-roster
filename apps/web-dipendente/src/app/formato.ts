import type { IsoDate, IsoInstant, Place, TimeOfDay } from '@repo/contracts'

/**
 * Date, ore e luoghi resi leggibili.
 *
 * **Nessuna di queste funzioni costruisce un `Date`**, ed è la regola che conta qui:
 * `new Date('2026-12-15')` è interpretata come mezzanotte UTC e a ovest di Greenwich
 * torna indietro di un giorno. §4.1 e `common.ts` tengono data e ora come stringhe locali
 * senza fuso proprio per non avere questo problema; ricostruirne uno per stampare un
 * mese in italiano lo reintrodurrebbe nell'ultimo metro.
 */

const MESI = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
]

/** `2026-12-15` → `15 dicembre 2026`. */
export function formattaData(data: IsoDate): string {
  const [anno, mese, giorno] = data.split('-')
  const nomeMese = MESI[Number(mese) - 1]

  // Formato sconosciuto: si mostra il valore così com'è, invece di un `undefined`.
  if (anno === undefined || nomeMese === undefined || giorno === undefined) {
    return data
  }

  return `${Number(giorno)} ${nomeMese} ${anno}`
}

/** `2026-12-15` + `09:30` → `15 dicembre 2026 alle 09:30`. */
export function formattaDataEOra(data: IsoDate, ora: TimeOfDay): string {
  return `${formattaData(data)} alle ${ora}`
}

/** `2026-12-14T09:30` → `14 dicembre 2026 alle 09:30`. */
export function formattaIstante(istante: IsoInstant): string {
  const [data, ora] = istante.split('T')
  return data === undefined || ora === undefined
    ? istante
    : formattaDataEOra(data, ora)
}

/**
 * Il luogo.
 *
 * `Place` in risposta è la somma di due casi e non una forma piatta con `name` opzionale
 * (`contracts/sessions.ts`), quindi qui non serve nessun controllo su un campo che
 * potrebbe mancare: nel ramo `AULA` il nome c'è per costruzione.
 */
export function formattaLuogo(luogo: Place): string {
  return luogo.type === 'ONLINE' ? 'Online' : luogo.name
}
