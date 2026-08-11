import { ValoreNonValido } from '../../../shared/domain/errori';

export type TipoLuogo = 'AULA' | 'ONLINE';

/**
 * Dove si tiene la sessione: un'aula con un nome, oppure online.
 *
 * Modellato come somma di due casi e non come coppia di campi opzionali: «aula senza
 * nome» e «online con nome di aula» sono stati che non devono poter esistere.
 */
export class Luogo {
  private constructor(
    readonly tipo: TipoLuogo,
    readonly nome: string | null,
  ) {}

  static aula(nome: string): Luogo {
    if (nome.trim().length === 0) {
      throw new ValoreNonValido("Il nome dell'aula non può essere vuoto.");
    }
    return new Luogo('AULA', nome.trim());
  }

  static online(): Luogo {
    return new Luogo('ONLINE', null);
  }

  toString(): string {
    return this.tipo === 'ONLINE' ? 'Online' : `Aula ${this.nome ?? ''}`.trim();
  }
}
