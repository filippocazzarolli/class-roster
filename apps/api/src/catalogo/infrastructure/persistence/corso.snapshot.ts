import { Versionato } from '../../../shared/persistence/tipi';

/**
 * `catalogo_corsi` — lo stato di un corso, senza comportamento.
 *
 * `titoloNormalizzato` è conservato accanto al titolo e non ricalcolato al volo: è la
 * chiave su cui l'indice garantisce INV-1 (HS-7), e conservarla rende esplicito che
 * l'unicità è un fatto della persistenza — esattamente dove la decisione l'ha messa.
 */
export interface CorsoSnapshot extends Versionato {
  readonly id: string;
  readonly titolo: string;
  readonly titoloNormalizzato: string;
  readonly descrizione: string;
  readonly durataOre: number;
  readonly argomento: string;
  readonly stato: 'BOZZA' | 'PUBBLICATO' | 'RITIRATO';
}
