import { ValoreNonValido } from '../../../shared/domain/errori';

const LUNGHEZZA_MASSIMA = 2000;

/** La descrizione di un corso — non vuota, ≤ 2000 caratteri. */
export class Descrizione {
  private constructor(readonly valore: string) {}

  static da(valore: string): Descrizione {
    const pulita = valore.trim();
    if (pulita.length === 0) {
      throw new ValoreNonValido('La descrizione non può essere vuota.');
    }
    if (pulita.length > LUNGHEZZA_MASSIMA) {
      throw new ValoreNonValido(
        `La descrizione supera i ${LUNGHEZZA_MASSIMA} caratteri.`,
      );
    }
    return new Descrizione(pulita);
  }

  toString(): string {
    return this.valore;
  }
}
