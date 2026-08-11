import { StatoDichiarato } from '../../../shared/http/registro-stati-http';
import {
  CorsoNonTrovato,
  CorsoRitiratoNonModificabile,
  TitoloCorsoGiaUsato,
  TransizioneCorsoNonAmmessa,
} from '../../domain/errori';

/** La tabella di §4.4 per il contesto `catalogo`. */
export const STATI_HTTP_CATALOGO: readonly StatoDichiarato[] = [
  [CorsoNonTrovato, 404],
  [TitoloCorsoGiaUsato, 409],
  [TransizioneCorsoNonAmmessa, 409],
  [CorsoRitiratoNonModificabile, 409],
];
