import { IstanteLocale } from '../../shared/domain/istante-locale';
import { DataConservata, OraConservata } from '../../shared/persistence/tipi';

/**
 * Le letture di `iscrizioni` — R1 e R2 di `architecture.md` §4.5.
 *
 * ## Perché una porta separata dai repository
 *
 * Perché è l'unica cosa che impedisce al read model di diventare la scorciatoia per
 * arrivare agli aggregati. Con l'archivio in memoria `repositorySessioni.perId(...)`
 * restituisce una `Sessione` pronta da interrogare, e nulla — a parte questa separazione —
 * impedirebbe di usarla per comporre una lista. Il giorno in cui accadesse, «le letture
 * non passano dai repository» sarebbe già una frase falsa nei documenti.
 *
 * Questa porta restituisce **solo DTO**: strutture piatte, senza comportamento, che
 * nessuno può confondere con un aggregato.
 *
 * ## Perché i DTO sono in italiano
 *
 * Perché la traduzione avviene nei controller e in nessun altro punto (§4.6). Il read
 * model sta dentro il modulo `iscrizioni`, e dentro il modulo si parla la lingua del
 * dominio: `iscritti`, `inAttesa`, `postiResidui`. È il controller a produrre `enrolled`,
 * `waiting`, `remainingSeats` per `@repo/contracts`.
 *
 * ## Perché `adesso` è un parametro
 *
 * Perché il tempo entra solo dalla porta `Orologio` (§4.1). Entrambe le letture derivano
 * campi che dipendono dall'istante corrente, e leggerlo qui dentro renderebbe le due
 * letture non deterministiche nei test — con l'aggravante che non hanno invarianti da
 * difendere, quindi nessuno se ne accorgerebbe.
 */
export abstract class LettureSessioni {
  /** R1 — le sessioni programmate non ancora iniziate, con i posti residui. */
  abstract listaSessioniAperte(adesso: IstanteLocale): SessioneApertaDTO[];

  /** R2 — le iscrizioni di un dipendente, dalla più recente. */
  abstract listaMieIscrizioni(
    dipendenteId: string,
    adesso: IstanteLocale,
  ): MiaIscrizioneDTO[];

  /**
   * R4 — le sessioni, per la vista del responsabile: tutte, o quelle di un corso.
   *
   * Nessun `adesso`: a differenza di R1 e R2 non c'è alcun campo derivato dal tempo, e
   * nessun filtro da applicargli. Il responsabile vede anche le sessioni passate — è la
   * sua vista di gestione, non una vetrina — quindi l'orologio qui non serve.
   */
  abstract listaSessioni(corsoId?: string): SessioneDelCorsoDTO[];
}

/** Il luogo, come somma di due casi — la stessa forma che ha nel dominio. */
export type LuogoDTO =
  | { readonly tipo: 'AULA'; readonly nome: string }
  | { readonly tipo: 'ONLINE' };

export type StatoSessioneDTO = 'PROGRAMMATA' | 'ANNULLATA';

/**
 * R1 — una sessione aperta.
 *
 * `postiResidui = capienza − iscritti`, calcolato qui e non conservato: sarebbe un dato
 * derivato in archivio, cioè un secondo posto da tenere allineato.
 *
 * > Questo numero **si mostra e non si usa per decidere** (§4.5). Chi decide se il posto
 * > c'è è la `Sessione`, con l'aggregato caricato per intero.
 */
export interface SessioneApertaDTO {
  readonly id: string;
  readonly corsoId: string;
  readonly corsoTitolo: string;
  readonly data: DataConservata;
  readonly oraInizio: OraConservata;
  readonly luogo: LuogoDTO;
  readonly docente: string;
  readonly capienza: number;
  readonly iscritti: number;
  readonly inAttesa: number;
  readonly postiResidui: number;
}

/** I dati della sessione che accompagnano ogni mia iscrizione. */
interface SessioneDellaMiaIscrizione {
  readonly sessioneId: string;
  readonly corsoTitolo: string;
  readonly data: DataConservata;
  readonly oraInizio: OraConservata;
  readonly luogo: LuogoDTO;
  readonly statoSessione: StatoSessioneDTO;
}

/**
 * R2 — una mia iscrizione, con i due campi derivati che §4.5 assegna a questa lettura.
 *
 * `annullabileFinoA = inizio − 24h` e `annullabile = adesso < annullabileFinoA` (INV-10);
 * `decaduta` è la traduzione di HS-9 e sta **solo** nel caso `IN_ATTESA`, perché è lì che
 * `aggregation.md` §3.8 l'ha assegnata: un campo comune renderebbe scrivibile
 * `{ stato: 'ISCRITTO', decaduta: true }`, che non esiste.
 *
 * `annullabile` è un **suggerimento per l'interfaccia, non un permesso**: il rifiuto vero
 * arriva dall'aggregato, come `AnnullamentoFuoriTermine`.
 */
export type MiaIscrizioneDTO = SessioneDellaMiaIscrizione & {
  readonly annullabileFinoA: string;
  readonly annullabile: boolean;
} & (
    | { readonly stato: 'ISCRITTO' }
    | {
        readonly stato: 'IN_ATTESA';
        readonly posizione: number;
        readonly decaduta: boolean;
      }
  );

/**
 * R4 — una sessione nell'elenco del responsabile.
 *
 * Non ha `postiResidui`: lui vede quanti sono iscritti, non quanti posti restano. Non è
 * una svista di simmetria con R1 — è la stessa ragione per cui §4.11 vieta un
 * `CardSessione` condiviso fra le due app: due attori guardano due cose.
 */
export interface SessioneDelCorsoDTO {
  readonly id: string;
  readonly corsoId: string;
  readonly corsoTitolo: string;
  readonly data: DataConservata;
  readonly oraInizio: OraConservata;
  readonly luogo: LuogoDTO;
  readonly docente: string;
  readonly capienza: number;
  readonly iscritti: number;
  readonly inAttesa: number;
  readonly stato: StatoSessioneDTO;
  readonly motivoAnnullamento: MotivoAnnullamentoDTO | null;
}

export type MotivoAnnullamentoDTO = 'DECISIONE_RESPONSABILE' | 'CORSO_RITIRATO';
