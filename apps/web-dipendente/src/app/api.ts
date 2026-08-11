import { createApi } from '@repo/api-client'

/**
 * Il client dell'api, costruito una volta sola — `architecture.md` §4.11.
 *
 * `currentUser` è una funzione e non una stringa perché l'identità va letta a ogni
 * richiesta: quando arriverà `packages/dev-identity` il selettore cambierà l'utente a
 * runtime, e questo è già il punto in cui agganciarlo. Finché non c'è, l'header `X-Utente`
 * lo imposta chi costruisce il client — cioè questa riga.
 *
 * Qui l'identità pesa più che in `web-formazione`: è ciò che rende «le mie iscrizioni»
 * *mie*, ed è la metà di INV-9 che sta fuori dall'aggregato — il dipendente non arriva mai
 * dal corpo della richiesta (`aggregation.md` §3.9). Per provare la lista d'attesa con due
 * persone diverse, oggi si cambia questa riga.
 */
const UTENTE_CORRENTE = 'anna@example.com'

export const api = createApi({ currentUser: () => UTENTE_CORRENTE })
