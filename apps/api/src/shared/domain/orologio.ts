import { IstanteLocale } from './istante-locale';

/**
 * Porta: l'unico modo in cui l'istante corrente entra nel dominio.
 *
 * `aggregation.md` §3.10 — INV-6 e INV-10 dipendono dal tempo, e un `new Date()` dentro
 * l'aggregato renderebbe la regola delle 24 ore non testabile. Nome in italiano perché
 * compare nelle firme dei metodi di dominio e si legge insieme alle regole.
 */
export abstract class Orologio {
  abstract adesso(): IstanteLocale;
}
