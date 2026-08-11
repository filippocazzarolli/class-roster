import { ValoreNonValido } from '../../../shared/domain/errori';

const FORMATO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * L'indirizzo di chi si iscrive.
 *
 * Vive **dentro** `iscrizioni` come dato replicato, non come riferimento a
 * un'anagrafica: HS-10 (`domain.md` §2.8) ha deciso che l'indirizzo viaggia dentro
 * l'evento, così il contesto notifiche non deve interrogare il core per sapere a chi
 * scrivere.
 */
export class Email {
  private constructor(readonly valore: string) {}

  static da(valore: string): Email {
    const pulita = valore.trim();
    if (!FORMATO.test(pulita)) {
      throw new ValoreNonValido(`Email non valida: "${valore}".`);
    }
    return new Email(pulita);
  }

  toString(): string {
    return this.valore;
  }
}
