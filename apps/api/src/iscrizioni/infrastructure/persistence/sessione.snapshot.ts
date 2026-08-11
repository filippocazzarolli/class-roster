import {
  DataConservata,
  OraConservata,
  Versionato,
} from '../../../shared/persistence/tipi';

/**
 * `iscrizioni_sessioni` — lo stato di una sessione, senza comportamento.
 *
 * **Le iscrizioni sono annidate**, non in una collezione a sé. Con SQL erano una tabella
 * separata legata dall'unica foreign key del sistema; qui il confine dell'aggregato si
 * esprime meglio ancora — non esiste una collezione di iscrizioni da cui qualcuno possa
 * pescarle scavalcando la `Sessione`, che è esattamente ciò che il confine significa
 * (`architecture.md` §4.7).
 *
 * `corsoId` non ha alcun legame dichiarato con `catalogo_corsi`: è una copia, e
 * `domain.md` §2.9 ha deciso che tale resti.
 */
export interface IscrizioneSnapshot {
  readonly dipendenteId: string;
  readonly email: string;
  readonly stato: 'ISCRITTO' | 'IN_ATTESA';
  readonly ordine: number;
}

export interface SessioneSnapshot extends Versionato {
  readonly id: string;
  readonly corsoId: string;
  readonly corsoTitolo: string;
  readonly data: DataConservata;
  readonly oraInizio: OraConservata;
  readonly luogoTipo: 'AULA' | 'ONLINE';
  readonly luogoNome: string | null;
  readonly docente: string;
  readonly capienza: number;
  readonly stato: 'PROGRAMMATA' | 'ANNULLATA';
  readonly motivoAnnullamento:
    | 'DECISIONE_RESPONSABILE'
    | 'CORSO_RITIRATO'
    | null;
  readonly iscrizioni: readonly IscrizioneSnapshot[];
}
