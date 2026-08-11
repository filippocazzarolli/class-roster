import { ValoreNonValido } from '../../../shared/domain/errori';

const LUNGHEZZA_MASSIMA = 200;

/**
 * Il titolo del corso, **copiato** dentro la sessione al momento della programmazione.
 *
 * È una copia e non un riferimento (`domain.md` §2.9): serve allo storico, perché una
 * sessione passata deve continuare a dire per quale corso si è tenuta anche se nel
 * catalogo quel titolo è nel frattempo cambiato.
 *
 * Qui non c'è normalizzazione: INV-1 riguarda il catalogo, e la difende la persistenza
 * del modulo `catalogo` (HS-7, `architecture.md` §4.7). Dentro `iscrizioni` il titolo è
 * solo un'etichetta.
 */
export class TitoloCorso {
  private constructor(readonly valore: string) {}

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
    return new TitoloCorso(pulito);
  }

  toString(): string {
    return this.valore;
  }
}
