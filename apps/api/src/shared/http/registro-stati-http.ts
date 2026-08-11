import { ErroreDiDominio } from '../domain/errori';

export type CostruttoreErrore = new (...argomenti: never[]) => ErroreDiDominio;

/** Una riga della tabella di `architecture.md` §4.4. */
export type StatoDichiarato = readonly [CostruttoreErrore, number];

/**
 * La tabella «eccezione di dominio → stato HTTP», costruita a pezzi.
 *
 * Ogni contesto dichiara i propri stati e li registra qui: se questo file conoscesse le
 * eccezioni di `iscrizioni` e `catalogo`, `shared/` diventerebbe il punto in cui i due
 * contesti si incontrano — che è precisamente ciò che i divieti di `domain.md` §2.9
 * escludono.
 *
 * Serve anche al **test di contratto** di §4.9: un test fallisce se una classe di errore
 * esportata da un contesto non compare qui, così la tabella non è più affidata alla
 * memoria di chi aggiunge un'eccezione.
 */
export class RegistroStatiHttp {
  private readonly stati = new Map<CostruttoreErrore, number>();

  registra(dichiarazioni: readonly StatoDichiarato[]): this {
    for (const [errore, stato] of dichiarazioni) {
      this.stati.set(errore, stato);
    }
    return this;
  }

  /** Confronto sul costruttore esatto: una sottoclasse deve dichiarare il proprio stato. */
  statoPer(errore: Error): number | null {
    return this.stati.get(errore.constructor as CostruttoreErrore) ?? null;
  }

  dichiarati(): CostruttoreErrore[] {
    return [...this.stati.keys()];
  }
}
