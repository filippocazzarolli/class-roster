import { CapienzaNonValida } from '../errori';

/**
 * Il numero massimo di partecipanti. Intero ≥ 1 — INV-3.
 *
 * È l'unica invariante custodita da un value object anziché dall'aggregato
 * (`aggregation.md` §3.5): non riguarda la relazione fra la capienza e altro,
 * riguarda il valore in sé. Un `Capienza` che esiste è per costruzione valido.
 */
export class Capienza {
  private constructor(readonly valore: number) {}

  static da(valore: number): Capienza {
    if (!Number.isInteger(valore) || valore < 1) {
      throw new CapienzaNonValida(
        `La capienza deve essere un intero ≥ 1, ricevuto: ${valore}.`,
      );
    }
    return new Capienza(valore);
  }

  eMaggioreDi(altra: Capienza): boolean {
    return this.valore > altra.valore;
  }

  toString(): string {
    return String(this.valore);
  }
}
