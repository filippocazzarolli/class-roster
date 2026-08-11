/**
 * Porta: la sorgente degli identificativi.
 *
 * `aggregation.md` §3.10 — stessa ragione dell'`Orologio`: identificativi
 * deterministici nei test, e nessun `Math.random()` nel dominio.
 */
export abstract class GeneratoreDiId {
  abstract genera(): string;
}
