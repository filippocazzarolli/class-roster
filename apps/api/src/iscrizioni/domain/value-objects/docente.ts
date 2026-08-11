import { ValoreNonValido } from '../../../shared/domain/errori';

/**
 * Il nome di chi tiene la sessione.
 *
 * È un value object e **non un'entità**: HS-6 (`domain.md` §2.6). Il docente non
 * formula comandi, non ha un ciclo di vita nel sistema e nessuna invariante lo
 * riguarda — promuoverlo a entità avrebbe creato un terzo contesto per custodire un
 * nome.
 */
export class Docente {
  private constructor(readonly nome: string) {}

  static da(nome: string): Docente {
    const pulito = nome.trim();
    if (pulito.length === 0) {
      throw new ValoreNonValido('Il nome del docente non può essere vuoto.');
    }
    return new Docente(pulito);
  }

  toString(): string {
    return this.nome;
  }
}
