import { CollezioneInMemoria } from '../../../shared/persistence/collezione-in-memoria';
import { IndiceUnico } from '../../../shared/persistence/indice-unico';
import { Corso } from '../../domain/corso';
import { TitoloCorsoGiaUsato } from '../../domain/errori';
import { RepositoryCorsi } from '../../domain/ports/repository-corsi';
import { CorsoId } from '../../domain/value-objects/identificativi';
import { TitoloCorso } from '../../domain/value-objects/titolo-corso';
import { aDominio, aSnapshot } from './corso.mapper';
import { CorsoSnapshot } from './corso.snapshot';

/** `catalogo_corsi` — la collezione, prefissata dal modulo che la possiede. */
export class CorsiInMemoria extends CollezioneInMemoria<CorsoSnapshot> {}

/** L'indice `titoloNormalizzato → CorsoId` su cui poggia INV-1. */
export class IndiceTitoliCorsi extends IndiceUnico {}

/**
 * L'implementazione della porta `RepositoryCorsi`.
 *
 * Oltre a caricare e salvare, è **il custode di INV-1** — l'unica invariante che nessun
 * aggregato difende (HS-7). Il dominio non sa cosa sia un indice: riceve
 * `TitoloCorsoGiaUsato`, che è un'eccezione di dominio con un nome del linguaggio ubiquo.
 */
export class RepositoryCorsiInMemoria extends RepositoryCorsi {
  constructor(
    private readonly corsi: CorsiInMemoria,
    private readonly indiceTitoli: IndiceTitoliCorsi,
  ) {
    super();
  }

  perId(id: CorsoId): Corso | null {
    const snapshot = this.corsi.perId(id.valore);
    return snapshot === null ? null : aDominio(snapshot);
  }

  /**
   * L'unicità si verifica **prima** del check-and-set, e le due operazioni restano
   * indivisibili perché fra loro non c'è alcun `await`: è la condizione, dichiarata in
   * §4.7, sotto cui questa garanzia regge.
   *
   * Il titolo si registra **dopo** la scrittura riuscita: se il salvataggio fallisse per
   * conflitto di versione, l'indice resterebbe altrimenti a rivendicare un titolo per un
   * corso che non è stato scritto.
   */
  salva(corso: Corso): void {
    const titolo = corso.dettagli.titolo;

    if (this.indiceTitoli.occupata(titolo.normalizzato, corso.id.valore)) {
      throw new TitoloCorsoGiaUsato(
        `Esiste già un corso intitolato «${titolo.valore}».`,
      );
    }

    this.corsi.salva(
      corso.id.valore,
      aSnapshot(corso, corso.versioneLetta + 1),
      corso.versioneLetta,
    );
    this.indiceTitoli.registra(titolo.normalizzato, corso.id.valore);
  }

  titoloEsiste(titolo: TitoloCorso, escluso?: CorsoId): boolean {
    return this.indiceTitoli.occupata(titolo.normalizzato, escluso?.valore);
  }
}
