import { ErroreDiDominio } from '../../shared/domain/errori';

/** 404 — identificativo inesistente. */
export class CorsoNonTrovato extends ErroreDiDominio {}

/**
 * 409 — INV-1, e arriva **dalla persistenza**.
 *
 * È l'unica invariante che nessun aggregato può difendere: riguarda la collezione di
 * tutti i corsi, e un `Corso` per costruzione non vede gli altri (HS-7). Il repository
 * la verifica e solleva questa eccezione, che è di dominio: chi la riceve non sa e non
 * deve sapere se sotto ci fosse un indice, un vincolo `UNIQUE` o una mappa.
 */
export class TitoloCorsoGiaUsato extends ErroreDiDominio {}

/** 409 — pubblicare ciò che non è in bozza, ritirare ciò che non è pubblicato. */
export class TransizioneCorsoNonAmmessa extends ErroreDiDominio {}

/** 409 — HS-12: `RITIRATO` è terminale, e un corso ritirato non si modifica. */
export class CorsoRitiratoNonModificabile extends ErroreDiDominio {}
