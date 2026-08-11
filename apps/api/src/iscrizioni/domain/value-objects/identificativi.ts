import { ValoreNonValido } from '../../../shared/domain/errori';

/**
 * Identificativi **opachi**: il dominio non attribuisce significato alla loro forma,
 * gli chiede solo di essere non vuoti e confrontabili.
 *
 * `CorsoId` compare dentro `iscrizioni` come **copia replicata** e non come
 * riferimento a un dato del catalogo — è la decisione di `domain.md` §2.9, e il
 * fatto che qui non esista alcun modo di risalire al `Corso` ne è la conseguenza.
 */
abstract class Identificativo {
  protected constructor(readonly valore: string) {}

  equivaleA(altro: this): boolean {
    return this.valore === altro.valore;
  }

  toString(): string {
    return this.valore;
  }
}

const esigiNonVuoto = (valore: string, nome: string): string => {
  if (valore.trim().length === 0) {
    throw new ValoreNonValido(`${nome} non può essere vuoto.`);
  }
  return valore;
};

export class SessioneId extends Identificativo {
  static da(valore: string): SessioneId {
    return new SessioneId(esigiNonVuoto(valore, 'SessioneId'));
  }
}

export class CorsoId extends Identificativo {
  static da(valore: string): CorsoId {
    return new CorsoId(esigiNonVuoto(valore, 'CorsoId'));
  }
}

export class DipendenteId extends Identificativo {
  static da(valore: string): DipendenteId {
    return new DipendenteId(esigiNonVuoto(valore, 'DipendenteId'));
  }
}
