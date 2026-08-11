import { createApi } from '@repo/api-client'

/**
 * Il client dell'api, costruito una volta sola — `architecture.md` §4.11.
 *
 * `currentUser` è una funzione e non una stringa perché l'identità va letta a ogni
 * richiesta: quando arriverà `packages/dev-identity` il selettore cambierà l'utente a
 * runtime, e questo è già il punto in cui agganciarlo. Finché non c'è, l'header `X-Utente`
 * lo imposta chi costruisce il client — cioè questa riga.
 */
const UTENTE_CORRENTE = 'formazione@example.com'

export const api = createApi({ currentUser: () => UTENTE_CORRENTE })
