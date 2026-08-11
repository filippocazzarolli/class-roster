import { IstanteLocale } from '../domain/istante-locale';
import { Orologio } from '../domain/orologio';

const dueCifre = (n: number): string => String(n).padStart(2, '0');

/**
 * L'adapter dell'`Orologio` sul tempo di sistema.
 *
 * **È l'unico posto del progetto in cui `new Date()` è lecito**, ed è deliberato: il
 * guardiano ESLint di §4.9 lo vieta in `domain/` e `application/`, non qui. Tutta
 * l'impurità del tempo è confinata in queste righe.
 *
 * Legge i componenti **locali** (`getFullYear`, non `getUTCFullYear`): il modello parla
 * di date e ore locali senza fuso, e convertire in UTC sposterebbe di un giorno le
 * sessioni serali.
 */
export class OrologioDiSistema extends Orologio {
  adesso(): IstanteLocale {
    const ora = new Date();
    return IstanteLocale.da(
      `${ora.getFullYear()}-${dueCifre(ora.getMonth() + 1)}-${dueCifre(ora.getDate())}`,
      `${dueCifre(ora.getHours())}:${dueCifre(ora.getMinutes())}`,
    );
  }
}
