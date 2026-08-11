import { ValoreNonValido } from '../../../shared/domain/errori';

/**
 * L'identificativo di un corso, **nella lingua del catalogo**.
 *
 * Esiste un `CorsoId` anche in `iscrizioni`, ed è una duplicazione deliberata: il
 * divieto 1 (`domain.md` §2.9) vieta l'import fra contesti, e «solo per un tipo» è la
 * prima eccezione con cui si ricostruisce il modello unico che i contesti esistono per
 * evitare. I due tipi hanno la stessa forma oggi; niente garantisce che l'abbiano
 * domani, ed è esattamente il punto.
 */
export class CorsoId {
  private constructor(readonly valore: string) {}

  static da(valore: string): CorsoId {
    if (valore.trim().length === 0) {
      throw new ValoreNonValido('CorsoId non può essere vuoto.');
    }
    return new CorsoId(valore);
  }

  equivaleA(altro: CorsoId): boolean {
    return this.valore === altro.valore;
  }

  toString(): string {
    return this.valore;
  }
}
