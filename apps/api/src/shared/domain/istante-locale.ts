import { DataLocale } from './data-locale';
import { OraLocale } from './ora-locale';

const MINUTI_AL_GIORNO = 24 * 60;

const dueCifre = (n: number): string => String(n).padStart(2, '0');

/**
 * Giorni trascorsi dal 1970-01-01, calcolati con l'algoritmo di Howard Hinnant.
 * Aritmetica intera pura: nessun `Date`, nessun fuso orario, nessun DST.
 */
const aGiorniEpoch = (anno: number, mese: number, giorno: number): number => {
  const a = anno - (mese <= 2 ? 1 : 0);
  const era = Math.floor(a / 400);
  const annoDellEra = a - era * 400;
  const giornoDellAnno =
    Math.floor((153 * (mese + (mese > 2 ? -3 : 9)) + 2) / 5) + giorno - 1;
  const giornoDellEra =
    annoDellEra * 365 +
    Math.floor(annoDellEra / 4) -
    Math.floor(annoDellEra / 100) +
    giornoDellAnno;
  return era * 146097 + giornoDellEra - 719468;
};

/** L'inverso esatto di `aGiorniEpoch`. */
const daGiorniEpoch = (giorniEpoch: number): [number, number, number] => {
  const z = giorniEpoch + 719468;
  const era = Math.floor(z / 146097);
  const giornoDellEra = z - era * 146097;
  const annoDellEra = Math.floor(
    (giornoDellEra -
      Math.floor(giornoDellEra / 1460) +
      Math.floor(giornoDellEra / 36524) -
      Math.floor(giornoDellEra / 146096)) /
      365,
  );
  const anno = annoDellEra + era * 400;
  const giornoDellAnno =
    giornoDellEra -
    (365 * annoDellEra +
      Math.floor(annoDellEra / 4) -
      Math.floor(annoDellEra / 100));
  const mp = Math.floor((5 * giornoDellAnno + 2) / 153);
  const giorno = giornoDellAnno - Math.floor((153 * mp + 2) / 5) + 1;
  const mese = mp + (mp < 10 ? 3 : -9);
  return [anno + (mese <= 2 ? 1 : 0), mese, giorno];
};

/**
 * Un istante del calendario locale: `DataLocale` + `OraLocale`.
 *
 * È l'unico modo in cui il tempo entra nel dominio, e arriva sempre dalla porta
 * `Orologio` (`aggregation.md` §3.10). INV-6 e INV-10 si esprimono confrontando
 * istanti, mai leggendo l'orologio di sistema.
 */
export class IstanteLocale {
  private constructor(
    readonly data: DataLocale,
    readonly ora: OraLocale,
  ) {}

  static di(data: DataLocale, ora: OraLocale): IstanteLocale {
    return new IstanteLocale(data, ora);
  }

  static da(data: string, ora: string): IstanteLocale {
    return new IstanteLocale(DataLocale.da(data), OraLocale.da(ora));
  }

  /**
   * L'istante di `ore` ore prima. Attraversa i confini di giorno, mese e anno con
   * aritmetica intera: è ciò che rende esprimibile «inizio − 24h» di INV-10 senza
   * introdurre un fuso orario nel dominio.
   */
  menoOre(ore: number): IstanteLocale {
    const [anno, mese, giorno] = this.data.valore.split('-').map(Number);
    const [oreCorrenti, minuti] = this.ora.valore.split(':').map(Number);

    const minutiTotali =
      aGiorniEpoch(anno, mese, giorno) * MINUTI_AL_GIORNO +
      oreCorrenti * 60 +
      minuti -
      ore * 60;

    const giorniEpoch = Math.floor(minutiTotali / MINUTI_AL_GIORNO);
    const minutiNelGiorno = minutiTotali - giorniEpoch * MINUTI_AL_GIORNO;
    const [a, m, g] = daGiorniEpoch(giorniEpoch);

    return IstanteLocale.da(
      `${String(a).padStart(4, '0')}-${dueCifre(m)}-${dueCifre(g)}`,
      `${dueCifre(Math.floor(minutiNelGiorno / 60))}:${dueCifre(minutiNelGiorno % 60)}`,
    );
  }

  precede(altro: IstanteLocale): boolean {
    return this.confronta(altro) < 0;
  }

  confronta(altro: IstanteLocale): number {
    const perData = this.data.confronta(altro.data);
    return perData !== 0 ? perData : this.ora.confronta(altro.ora);
  }

  toString(): string {
    return `${this.data.valore} ${this.ora.valore}`;
  }
}
