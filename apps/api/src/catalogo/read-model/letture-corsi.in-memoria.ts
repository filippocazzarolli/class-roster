import { CorsiInMemoria } from '../infrastructure/persistence/repository-corsi.in-memoria';
import { CorsoDTO, LettureCorsi } from './letture-corsi';

/**
 * R3 sugli snapshot dell'archivio — `architecture.md` §4.5.
 *
 * Legge `CorsiInMemoria`, non `RepositoryCorsi`: nessun `Corso` viene ricostruito.
 */
export class LettureCorsiInMemoria extends LettureCorsi {
  constructor(private readonly archivio: CorsiInMemoria) {
    super();
  }

  /**
   * L'ordine è alfabetico, e il confronto avviene su `titoloNormalizzato` — lo stesso
   * campo su cui l'indice garantisce INV-1, conservato accanto al titolo proprio per non
   * essere ricalcolato al volo.
   *
   * Non `localeCompare`: dipende dalla versione di ICU della piattaforma, e un ordinamento
   * che cambia con l'ambiente è un test che passa qui e fallisce altrove. Il confronto fra
   * stringhe normalizzate è deterministico, che è ciò che serve a un elenco.
   */
  listaCorsi(): CorsoDTO[] {
    return this.archivio
      .tutti()
      .sort((a, b) =>
        a.titoloNormalizzato < b.titoloNormalizzato
          ? -1
          : a.titoloNormalizzato > b.titoloNormalizzato
            ? 1
            : 0,
      )
      .map((c) => ({
        id: c.id,
        titolo: c.titolo,
        descrizione: c.descrizione,
        durataOre: c.durataOre,
        argomento: c.argomento,
        stato: c.stato,
      }));
  }
}
