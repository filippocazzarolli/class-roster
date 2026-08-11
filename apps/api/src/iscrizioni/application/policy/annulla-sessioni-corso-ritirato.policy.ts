import { Orologio } from '../../../shared/domain/orologio';
import { SessioneGiaAnnullata } from '../../domain/errori';
import { RepositorySessioni } from '../../domain/ports/repository-sessioni';
import { CorsoId } from '../../domain/value-objects/identificativi';
import { AnnullaSessioneUseCase } from '../annulla-sessione.use-case';

/**
 * **P2** — il ritiro di un corso annulla le sue sessioni **future**, non quelle passate
 * (INV-11).
 *
 * Reagisce a `catalogo.CorsoRitirato.v1`. Due dettagli che sembrano minuzie e non lo
 * sono:
 *
 * 1. **Chiama il caso d'uso, non manipola le sessioni.** Se annullasse direttamente
 *    l'aggregato, la regola «annullare una sessione già annullata è rifiutato» esisterebbe
 *    in due punti, e il secondo prima o poi divergerebbe.
 * 2. **Ignora `SessioneGiaAnnullata`.** Sotto consegna at-least-once una riconsegna
 *    dello stesso evento è l'esito normale, non un problema: la seconda volta le
 *    sessioni sono già annullate e va bene così.
 *
 * L'ordine rispetto all'ACL è vincolante — prima la replica, poi questa policy —
 * altrimenti una sessione programmata nella finestra di HS-8 sopravvivrebbe al ritiro
 * (`architecture.md` §4.8).
 */
export class AnnullaSessioniCorsoRitiratoPolicy {
  constructor(
    private readonly sessioni: RepositorySessioni,
    private readonly annullaSessione: AnnullaSessioneUseCase,
    private readonly orologio: Orologio,
  ) {}

  async esegui(corsoId: string): Promise<void> {
    const future = this.sessioni.futureDelCorso(
      CorsoId.da(corsoId),
      this.orologio.adesso(),
    );

    for (const sessione of future) {
      try {
        await this.annullaSessione.esegui({
          sessioneId: sessione.id.valore,
          motivo: 'CORSO_RITIRATO',
        });
      } catch (errore) {
        if (!(errore instanceof SessioneGiaAnnullata)) throw errore;
      }
    }
  }
}
