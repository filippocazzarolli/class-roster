import { ValoreNonValido } from './errori';

const FORMATO = /^\d{2}:\d{2}$/;

/**
 * Un'ora del giorno, senza fuso orario: `HH:MM`.
 *
 * Stessa scelta di `DataLocale`: stringa validata, mai `Date`.
 */
export class OraLocale {
  private constructor(readonly valore: string) {}

  static da(valore: string): OraLocale {
    if (!FORMATO.test(valore)) {
      throw new ValoreNonValido(`Ora non valida: "${valore}". Atteso HH:MM.`);
    }
    const [ore, minuti] = valore.split(':').map(Number);
    if (ore > 23 || minuti > 59) {
      throw new ValoreNonValido(
        `Ora non valida: "${valore}". Fuori dall'intervallo del giorno.`,
      );
    }
    return new OraLocale(valore);
  }

  precede(altra: OraLocale): boolean {
    return this.valore < altra.valore;
  }

  confronta(altra: OraLocale): number {
    return this.valore < altra.valore ? -1 : this.valore > altra.valore ? 1 : 0;
  }

  toString(): string {
    return this.valore;
  }
}
