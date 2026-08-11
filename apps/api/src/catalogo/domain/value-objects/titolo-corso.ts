import { ValoreNonValido } from '../../../shared/domain/errori';

const LUNGHEZZA_MASSIMA = 200;

/**
 * Il titolo di un corso — non vuoto, ≤ 200 caratteri, **normalizzabile**.
 *
 * La normalizzazione (minuscolo, spazi compattati) è ciò su cui la persistenza
 * garantisce INV-1: due titoli che differiscono solo per maiuscole o spazi sono lo
 * stesso titolo. Vive qui e non nel repository perché è una regola sul *significato*
 * del titolo, non sul modo di conservarlo — il repository si limita a usare la forma
 * normalizzata come chiave (HS-7, `architecture.md` §4.7).
 *
 * Il `TitoloCorso` di `iscrizioni` non ha normalizzazione: lì il titolo è una copia per
 * lo storico, e INV-1 non lo riguarda.
 */
export class TitoloCorso {
  private constructor(
    readonly valore: string,
    readonly normalizzato: string,
  ) {}

  static da(valore: string): TitoloCorso {
    const pulito = valore.trim();
    if (pulito.length === 0) {
      throw new ValoreNonValido('Il titolo del corso non può essere vuoto.');
    }
    if (pulito.length > LUNGHEZZA_MASSIMA) {
      throw new ValoreNonValido(
        `Il titolo del corso supera i ${LUNGHEZZA_MASSIMA} caratteri.`,
      );
    }
    return new TitoloCorso(pulito, pulito.toLowerCase().replace(/\s+/g, ' '));
  }

  eLoStessoDi(altro: TitoloCorso): boolean {
    return this.normalizzato === altro.normalizzato;
  }

  toString(): string {
    return this.valore;
  }
}
