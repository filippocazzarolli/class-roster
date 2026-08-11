import { PubblicatoreDiEventi } from '../../shared/domain/pubblicatore-di-eventi';
import { SessioneNonTrovata } from '../domain/errori';
import { RepositorySessioni } from '../domain/ports/repository-sessioni';
import { SessioneId } from '../domain/value-objects/identificativi';
import * as comandi from './comandi';
import { conRiprova } from './con-riprova';

/**
 * Annulla una sessione — per decisione del responsabile o perché il corso è stato
 * ritirato (P2).
 *
 * L'evento che ne esce porta con sé **tutti i destinatari**, iscritti e in attesa
 * (HS-10): dopo l'annullamento nessuno dovrà chiedere a `iscrizioni` a chi scrivere.
 *
 * Non c'è controllo sull'inizio: una sessione già iniziata si può ancora annullare, e
 * ha senso — l'annullamento racconta un fatto, non prenota il futuro.
 */
export class AnnullaSessioneUseCase {
  constructor(
    private readonly sessioni: RepositorySessioni,
    private readonly bus: PubblicatoreDiEventi,
  ) {}

  async esegui(comando: comandi.AnnullaSessione): Promise<void> {
    const sessioneId = SessioneId.da(comando.sessioneId);

    const eventi = await conRiprova(() => {
      const sessione = this.sessioni.perId(sessioneId);
      if (sessione === null) {
        throw new SessioneNonTrovata(
          `Sessione ${comando.sessioneId} inesistente.`,
        );
      }

      sessione.annulla(comando.motivo);
      this.sessioni.salva(sessione);

      const emessi = sessione.eventiNonPubblicati();
      sessione.svuotaEventi();
      return emessi;
    });

    this.bus.pubblica(eventi);
  }
}
