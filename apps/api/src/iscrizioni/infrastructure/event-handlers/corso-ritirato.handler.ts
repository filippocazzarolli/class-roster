import {
  EventoImbustato,
  HandlerDiEventi,
} from '../../../shared/event-bus/event-bus-in-process';
import { AnnullaSessioniCorsoRitiratoPolicy } from '../../application/policy/annulla-sessioni-corso-ritirato.policy';
import { EVENTI_CATALOGO_ASCOLTATI } from '../acl/replica-corsi-pubblicati';

/**
 * L'adapter che collega l'evento `CorsoRitirato` alla policy P2.
 *
 * Esiste per tenere la policy ignara del bus: `AnnullaSessioniCorsoRitiratoPolicy`
 * riceve un `corsoId` e non sa da dove arrivi — potrebbe essere un evento, un test o un
 * comando manuale.
 *
 * **Va sottoscritto dopo l'ACL.** L'ordine di registrazione è l'ordine di consegna, e su
 * `CorsoRitirato` è vincolante: se le sessioni si annullassero prima
 * dell'aggiornamento della replica, una sessione programmata nella finestra di HS-8
 * sopravvivrebbe al ritiro (`architecture.md` §4.8, `domain.md` §2.7).
 */
export class HandlerCorsoRitirato implements HandlerDiEventi {
  readonly nome = 'AnnullaSessioniCorsoRitirato';
  readonly ascolta = [EVENTI_CATALOGO_ASCOLTATI.CORSO_RITIRATO];

  constructor(private readonly policy: AnnullaSessioniCorsoRitiratoPolicy) {}

  async gestisci(evento: EventoImbustato): Promise<void> {
    await this.policy.esegui(String(evento.payload.corsoId));
  }
}
