import { Corso } from '../corso';
import { CorsoId } from '../value-objects/identificativi';
import { TitoloCorso } from '../value-objects/titolo-corso';

/**
 * Porta: come il dominio carica e salva i corsi — `aggregation.md` §3.10.
 *
 * `titoloEsiste` è la parte insolita, e non è una comodità: INV-1 è un'invariante di
 * insieme che nessun aggregato può difendere (HS-7). L'implementazione la garantisce
 * dentro `salva`, sollevando `TitoloCorsoGiaUsato`; questo metodo serve al controllo
 * preventivo dell'application service, che produce lo stesso errore nel caso normale —
 * non per correttezza, ma per non far dipendere il messaggio comune dalla gestione di
 * un errore infrastrutturale.
 */
export abstract class RepositoryCorsi {
  abstract perId(id: CorsoId): Corso | null;

  abstract salva(corso: Corso): void;

  /** `escluso` permette di modificare un corso senza collidere con sé stesso. */
  abstract titoloEsiste(titolo: TitoloCorso, escluso?: CorsoId): boolean;
}
