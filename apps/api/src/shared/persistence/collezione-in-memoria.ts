import { ConflittoDiVersione } from '../domain/errori';
import { Versionato } from './tipi';

/**
 * Una collezione di snapshot in memoria, con controllo di versione.
 *
 * È il sostituto della tabella: una mappa da identificativo a snapshot, dove lo snapshot
 * è una struttura **piatta e senza comportamento**. Il giorno in cui servisse un
 * database, è questa classe a cambiare — non il dominio, non gli use case.
 *
 * ## Perché entra e esce sempre una copia
 *
 * `structuredClone` su ogni lettura e su ogni scrittura non è prudenza eccessiva: senza,
 * chi ha ottenuto uno snapshot potrebbe mutarlo e vedere la mutazione comparire
 * nell'archivio senza aver chiamato `salva`. Sarebbe l'aliasing descritto in §4.7 — con
 * l'aggravante di essere invisibile, perché il sistema continuerebbe a funzionare e i
 * test a passare, per il motivo sbagliato.
 */
export class CollezioneInMemoria<S extends Versionato> {
  private readonly elementi = new Map<string, S>();

  perId(id: string): S | null {
    const trovato = this.elementi.get(id);
    return trovato === undefined ? null : structuredClone(trovato);
  }

  tutti(): S[] {
    return [...this.elementi.values()].map((e) => structuredClone(e));
  }

  /**
   * Check-and-set: scrive solo se nessun altro ha scritto dopo la nostra lettura.
   *
   * `versioneLetta` è la versione che l'aggregato aveva quando è stato caricato. Se
   * quella conservata non coincide più, qualcun altro è passato di qui: solleva
   * `ConflittoDiVersione`, e sarà `con-riprova` a ricaricare e riapplicare il comando.
   *
   * Con un solo processo e salvataggio sincrono il conflitto non si verifica
   * spontaneamente — non c'è punto di sospensione fra la lettura e questa riga. Il
   * meccanismo è corretto e oggi inerte, come dichiarato in §4.7.
   */
  salva(id: string, snapshot: S, versioneLetta: number): void {
    const attuale = this.elementi.get(id);

    if (attuale !== undefined && attuale.versione !== versioneLetta) {
      throw new ConflittoDiVersione(
        `Versione ${versioneLetta} non più attuale per ${id}: nell'archivio c'è la ${attuale.versione}.`,
      );
    }

    this.elementi.set(id, structuredClone(snapshot));
  }

  esiste(id: string): boolean {
    return this.elementi.has(id);
  }

  /** Solo per i test: riporta l'archivio allo stato iniziale. */
  svuota(): void {
    this.elementi.clear();
  }
}
