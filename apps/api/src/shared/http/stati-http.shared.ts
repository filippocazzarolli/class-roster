import {
  ConflittoDiVersioneNonRisolto,
  ValoreNonValido,
} from '../domain/errori';
import { StatoDichiarato } from './registro-stati-http';

/**
 * Gli stati delle eccezioni trasversali.
 *
 * `ConflittoDiVersioneNonRisolto` → **503** con `Retry-After: 1` è in tabella (§4.4): è
 * un fallimento tecnico ritentabile, distinto da un rifiuto di dominio che è definitivo.
 *
 * `ValoreNonValido` → **400** **non è in tabella**, ed è uno scostamento dichiarato: §4.4
 * assegna i formati malformati alla `ValidationPipe` («400, mai dal dominio»), ma §4.2
 * pretende che la regola viva anche nel value object. Sul percorso HTTP questa eccezione
 * è irraggiungibile — il DTO intercetta prima — e resta il caso in cui il comando arriva
 * da una policy o da un handler. 400 è la risposta onesta: la richiesta non era
 * rappresentabile nel dominio.
 */
export const STATI_HTTP_SHARED: readonly StatoDichiarato[] = [
  [ValoreNonValido, 400],
  [ConflittoDiVersioneNonRisolto, 503],
];
