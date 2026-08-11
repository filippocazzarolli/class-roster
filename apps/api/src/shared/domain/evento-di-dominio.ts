/**
 * Un fatto accaduto nel dominio, prodotto da un aggregato.
 *
 * Porta il nome sul bus (`<contesto>.<Evento>.v<versione>`, `architecture.md` §4.3),
 * l'identificativo dell'aggregato che lo ha emesso e il payload.
 *
 * **Non porta `eventId` né `occorsoIl`**: sono parte della busta, e la busta viene
 * chiusa dall'event bus in `shared/event-bus`. Se li aggiungesse l'aggregato,
 * `domain/` avrebbe bisogno di `GeneratoreDiId` e `Orologio` in ogni metodo che
 * emette — cioè di due porte in più per un dato che il dominio non usa mai per
 * decidere.
 */
export interface EventoDiDominio {
  readonly nome: string;
  readonly aggregateId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}
