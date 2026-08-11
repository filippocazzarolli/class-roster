import { Orologio } from '../../shared/domain/orologio';
import { PubblicatoreDiEventi } from '../../shared/domain/pubblicatore-di-eventi';
import { SessioneNonTrovata } from '../domain/errori';
import { RepositorySessioni } from '../domain/ports/repository-sessioni';
import { Capienza } from '../domain/value-objects/capienza';
import { SessioneId } from '../domain/value-objects/identificativi';
import * as comandi from './comandi';
import { conRiprova } from './con-riprova';

/**
 * Modifica la capienza — in aumento scorre la coda (HS-14), in riduzione si rifiuta se
 * toglierebbe il posto a qualcuno (HS-2).
 *
 * L'aumento può produrre più `DipendentePromosso` in un colpo solo: sono i posti nuovi
 * consegnati ai primi della coda, nello stesso atto, perché lasciarli liberi con gente
 * in attesa violerebbe INV-8.
 */
export class ModificaCapienzaUseCase {
  constructor(
    private readonly sessioni: RepositorySessioni,
    private readonly orologio: Orologio,
    private readonly bus: PubblicatoreDiEventi,
  ) {}

  async esegui(comando: comandi.ModificaCapienzaSessione): Promise<void> {
    const sessioneId = SessioneId.da(comando.sessioneId);
    const capienza = Capienza.da(comando.capienza);

    const eventi = await conRiprova(() => {
      const sessione = this.sessioni.perId(sessioneId);
      if (sessione === null) {
        throw new SessioneNonTrovata(
          `Sessione ${comando.sessioneId} inesistente.`,
        );
      }

      sessione.modificaCapienza(capienza, this.orologio.adesso());
      this.sessioni.salva(sessione);

      const emessi = sessione.eventiNonPubblicati();
      sessione.svuotaEventi();
      return emessi;
    });

    this.bus.pubblica(eventi);
  }
}
