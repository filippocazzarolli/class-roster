import { IstanteLocale } from '../../../shared/domain/istante-locale';
import { Sessione } from '../sessione';
import { CorsoId, SessioneId } from '../value-objects/identificativi';

/**
 * Porta: come il dominio carica e salva le sessioni — `aggregation.md` §3.10.
 *
 * Definita qui e implementata in `infrastructure/persistence`. L'aggregato si carica e
 * si salva **per intero**, iscrizioni comprese: senza di esse non può difendere INV-4,
 * e un caricamento parziale sarebbe un aggregato che decide alla cieca.
 *
 * `salva` solleva `ConflittoDiVersione` se lo snapshot è cambiato dopo il caricamento
 * (`architecture.md` §4.7): la riprova vive nell'application service, non qui.
 */
export abstract class RepositorySessioni {
  abstract perId(id: SessioneId): Sessione | null;

  abstract salva(sessione: Sessione): void;

  /** Serve alla policy P2: il ritiro di un corso annulla le sue sessioni **future**. */
  abstract futureDelCorso(corsoId: CorsoId, adesso: IstanteLocale): Sessione[];
}
