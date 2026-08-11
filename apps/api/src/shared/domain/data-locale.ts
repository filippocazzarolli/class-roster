import { ValoreNonValido } from './errori';

const FORMATO = /^\d{4}-\d{2}-\d{2}$/;

const eBisestile = (anno: number): boolean =>
  (anno % 4 === 0 && anno % 100 !== 0) || anno % 400 === 0;

const giorniDelMese = (anno: number, mese: number): number =>
  [31, eBisestile(anno) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    mese - 1
  ];

/**
 * Una data del calendario, senza fuso orario e senza ora: `YYYY-MM-DD`.
 *
 * Non usa `Date` (`architecture.md` §4.1): è una stringa validata con aritmetica
 * esplicita, così nessun fuso orario può rientrare da una porta di servizio e il
 * confronto lessicografico coincide con quello cronologico.
 */
export class DataLocale {
  private constructor(readonly valore: string) {}

  static da(valore: string): DataLocale {
    if (!FORMATO.test(valore)) {
      throw new ValoreNonValido(
        `Data non valida: "${valore}". Atteso YYYY-MM-DD.`,
      );
    }
    const [anno, mese, giorno] = valore.split('-').map(Number);
    if (mese < 1 || mese > 12) {
      throw new ValoreNonValido(
        `Data non valida: "${valore}". Il mese non esiste.`,
      );
    }
    if (giorno < 1 || giorno > giorniDelMese(anno, mese)) {
      throw new ValoreNonValido(
        `Data non valida: "${valore}". Il giorno non esiste in quel mese.`,
      );
    }
    return new DataLocale(valore);
  }

  precede(altra: DataLocale): boolean {
    return this.valore < altra.valore;
  }

  confronta(altra: DataLocale): number {
    return this.valore < altra.valore ? -1 : this.valore > altra.valore ? 1 : 0;
  }

  equivaleA(altra: DataLocale): boolean {
    return this.valore === altra.valore;
  }

  toString(): string {
    return this.valore;
  }
}
