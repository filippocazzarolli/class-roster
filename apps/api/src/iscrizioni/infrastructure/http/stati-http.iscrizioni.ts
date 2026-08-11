import { StatoDichiarato } from '../../../shared/http/registro-stati-http';
import {
  AnnullamentoFuoriTermine,
  CapienzaInferioreAgliIscritti,
  CapienzaNonValida,
  CorsoNonPubblicato,
  IscrizioneDuplicata,
  IscrizioneNonTrovata,
  SessioneAnnullataNonIscrivibile,
  SessioneGiaAnnullata,
  SessioneGiaIniziata,
  SessioneNelPassato,
  SessioneNonTrovata,
} from '../../domain/errori';

/**
 * La tabella di §4.4 per il contesto `iscrizioni`, e il criterio che la governa:
 *
 * - **409** — lo *stato dell'aggregato* rifiuta un comando che in un altro momento
 *   sarebbe stato valido, o che è già stato eseguito. Il client può riconciliarsi
 *   rileggendo.
 * - **422** — una *regola di business* rifiuta i dati o il momento della richiesta, e
 *   rileggere non cambia nulla. Include tutto ciò che dipende dal trascorrere del tempo,
 *   perché il tempo non torna indietro.
 */
export const STATI_HTTP_ISCRIZIONI: readonly StatoDichiarato[] = [
  [SessioneNonTrovata, 404],
  [IscrizioneNonTrovata, 404],
  [IscrizioneDuplicata, 409],
  [SessioneGiaAnnullata, 409],
  [SessioneAnnullataNonIscrivibile, 409],
  [CorsoNonPubblicato, 422],
  [CapienzaNonValida, 422],
  [CapienzaInferioreAgliIscritti, 422],
  [SessioneNelPassato, 422],
  [SessioneGiaIniziata, 422],
  [AnnullamentoFuoriTermine, 422],
];
