import { ValoreNonValido } from '../../../shared/domain/errori';

const LUNGHEZZA_MASSIMA = 100;

/**
 * L'argomento di un corso — non vuoto, ≤ 100 caratteri.
 *
 * È una stringa e non un'enumerazione: il committente non ha mai parlato di un elenco
 * chiuso di argomenti, e chiuderlo qui significherebbe inventare una regola che nessuno
 * ha chiesto — con l'aggravante di doverla poi mantenere.
 */
export class Argomento {
  private constructor(readonly valore: string) {}

  static da(valore: string): Argomento {
    const pulito = valore.trim();
    if (pulito.length === 0) {
      throw new ValoreNonValido("L'argomento non può essere vuoto.");
    }
    if (pulito.length > LUNGHEZZA_MASSIMA) {
      throw new ValoreNonValido(
        `L'argomento supera i ${LUNGHEZZA_MASSIMA} caratteri.`,
      );
    }
    return new Argomento(pulito);
  }

  toString(): string {
    return this.valore;
  }
}
