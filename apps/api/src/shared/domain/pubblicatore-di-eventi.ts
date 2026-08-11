import { EventoDiDominio } from './evento-di-dominio';

/**
 * Porta: dove finiscono gli eventi che un aggregato ha emesso.
 *
 * L'implementazione è il bus in-process di `shared/event-bus`, che chiude la busta
 * (`eventId`, `occorsoIl`) e consegna agli handler in modo asincrono e idempotente
 * (`architecture.md` §4.8).
 *
 * L'application service pubblica **dopo** il salvataggio, mai prima: senza outbox non
 * c'è atomicità fra stato ed evento, e l'ordine è l'unica garanzia rimasta — un evento
 * pubblicato prima di un salvataggio che poi fallisce racconterebbe un fatto mai
 * accaduto.
 */
export abstract class PubblicatoreDiEventi {
  abstract pubblica(eventi: readonly EventoDiDominio[]): void;
}
