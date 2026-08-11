import { ValoreNonValido } from '../../../shared/domain/errori';

const MINIMO = 1;
const MASSIMO = 200;

/** La durata di un corso — intero fra 1 e 200 ore. */
export class DurataInOre {
  private constructor(readonly valore: number) {}

  static da(valore: number): DurataInOre {
    if (!Number.isInteger(valore) || valore < MINIMO || valore > MASSIMO) {
      throw new ValoreNonValido(
        `La durata deve essere un intero fra ${MINIMO} e ${MASSIMO} ore, ricevuto: ${valore}.`,
      );
    }
    return new DurataInOre(valore);
  }

  toString(): string {
    return String(this.valore);
  }
}
