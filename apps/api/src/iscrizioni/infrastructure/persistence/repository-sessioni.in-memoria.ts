import { IstanteLocale } from '../../../shared/domain/istante-locale';
import { CollezioneInMemoria } from '../../../shared/persistence/collezione-in-memoria';
import { RepositorySessioni } from '../../domain/ports/repository-sessioni';
import { Sessione } from '../../domain/sessione';
import { CorsoId, SessioneId } from '../../domain/value-objects/identificativi';
import { aDominio, aSnapshot } from './sessione.mapper';
import { SessioneSnapshot } from './sessione.snapshot';

/**
 * `iscrizioni_sessioni` — la collezione, con il nome prefissato dal modulo che la
 * possiede. È un provider a sé perché il read model legge gli stessi snapshot senza
 * passare da questo repository (`architecture.md` §4.5).
 */
export class SessioniInMemoria extends CollezioneInMemoria<SessioneSnapshot> {}

/**
 * L'implementazione della porta `RepositorySessioni`.
 *
 * Carica e salva l'aggregato **per intero**, traducendo con il mapper in entrambe le
 * direzioni: nessun oggetto di dominio finisce mai dentro l'archivio.
 */
export class RepositorySessioniInMemoria extends RepositorySessioni {
  constructor(private readonly sessioni: SessioniInMemoria) {
    super();
  }

  perId(id: SessioneId): Sessione | null {
    const snapshot = this.sessioni.perId(id.valore);
    return snapshot === null ? null : aDominio(snapshot);
  }

  /**
   * La versione cresce di uno a ogni salvataggio, e il confronto con quella letta è ciò
   * che intercetta la scrittura di qualcun altro (`ConflittoDiVersione`).
   */
  salva(sessione: Sessione): void {
    this.sessioni.salva(
      sessione.id.valore,
      aSnapshot(sessione, sessione.versioneLetta + 1),
      sessione.versioneLetta,
    );
  }

  /**
   * Le sessioni del corso non ancora iniziate — serve alla policy P2 (INV-11).
   *
   * Il confronto avviene sulle **stringhe** dello snapshot, non sugli aggregati: data e
   * ora sono lessicograficamente ordinabili per costruzione (§4.7), quindi filtrare
   * prima e ricostruire dopo evita di istanziare aggregati che verrebbero subito
   * scartati.
   *
   * Non filtra per stato: una sessione già annullata può comparire, e la policy la
   * ignora — sotto consegna at-least-once è l'esito normale di una riconsegna.
   */
  futureDelCorso(corsoId: CorsoId, adesso: IstanteLocale): Sessione[] {
    const oggi = adesso.data.valore;
    const ora = adesso.ora.valore;

    return this.sessioni
      .tutti()
      .filter(
        (s) =>
          s.corsoId === corsoId.valore &&
          (s.data > oggi || (s.data === oggi && s.oraInizio > ora)),
      )
      .map(aDominio);
  }
}
