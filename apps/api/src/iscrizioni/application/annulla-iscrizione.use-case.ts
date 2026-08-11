import { Orologio } from '../../shared/domain/orologio';
import { PubblicatoreDiEventi } from '../../shared/domain/pubblicatore-di-eventi';
import { SessioneNonTrovata } from '../domain/errori';
import { RepositorySessioni } from '../domain/ports/repository-sessioni';
import {
  DipendenteId,
  SessioneId,
} from '../domain/value-objects/identificativi';
import * as comandi from './comandi';
import { conRiprova } from './con-riprova';

/**
 * Annulla la propria iscrizione — e, se qualcuno aspetta, **il posto è suo**.
 *
 * La promozione non è qui: è dentro l'aggregato, nello stesso metodo e nello stesso
 * atto (HS-4). Questo use case non sa nemmeno che è avvenuta — la vede solo passare fra
 * gli eventi da pubblicare, ed è il segno che il confine è al posto giusto.
 */
export class AnnullaIscrizioneUseCase {
  constructor(
    private readonly sessioni: RepositorySessioni,
    private readonly orologio: Orologio,
    private readonly bus: PubblicatoreDiEventi,
  ) {}

  async esegui(comando: comandi.AnnullaIscrizione): Promise<void> {
    const sessioneId = SessioneId.da(comando.sessioneId);
    const dipendenteId = DipendenteId.da(comando.dipendenteId);

    const eventi = await conRiprova(() => {
      const sessione = this.sessioni.perId(sessioneId);
      if (sessione === null) {
        throw new SessioneNonTrovata(
          `Sessione ${comando.sessioneId} inesistente.`,
        );
      }

      sessione.annullaIscrizione(dipendenteId, this.orologio.adesso());
      this.sessioni.salva(sessione);

      const emessi = sessione.eventiNonPubblicati();
      sessione.svuotaEventi();
      return emessi;
    });

    this.bus.pubblica(eventi);
  }
}
