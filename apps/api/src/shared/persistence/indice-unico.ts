/**
 * Un indice che rifiuta le chiavi già presenti.
 *
 * Esiste per INV-1 (HS-7): l'unicità del titolo è un'invariante di **insieme**, che
 * nessun aggregato può difendere perché per costruzione non vede gli altri. Con un
 * database sarebbe un vincolo `UNIQUE`; qui è questa mappa, controllata dentro `salva`
 * dal repository che la possiede.
 *
 * ## La garanzia, detta per intero
 *
 * `UNIQUE` reggeva sotto concorrenza perché verifica e scrittura erano un'operazione
 * sola, indivisibile per proprietà del motore. Qui `verifica` e `registra` reggono
 * perché il processo è uno e il salvataggio è sincrono — non c'è `await` fra le due. È
 * una garanzia **condizionata a un'ipotesi di deploy**, non a una proprietà
 * dell'archivio, ed è la prima cosa che cade il giorno dei due processi
 * (`architecture.md` §4.7).
 */
export class IndiceUnico {
  private readonly chiavi = new Map<string, string>();

  /** L'identificativo che occupa la chiave, se c'è. */
  proprietarioDi(chiave: string): string | null {
    return this.chiavi.get(chiave) ?? null;
  }

  occupata(chiave: string, escluso?: string): boolean {
    const proprietario = this.chiavi.get(chiave);
    return proprietario !== undefined && proprietario !== escluso;
  }

  /**
   * Registra la chiave per quell'identificativo, liberando quella che occupava prima.
   *
   * Il rilascio della chiave precedente è ciò che permette di rinominare un corso senza
   * lasciarsi dietro il vecchio titolo occupato per sempre.
   */
  registra(chiave: string, id: string): void {
    for (const [esistente, proprietario] of this.chiavi) {
      if (proprietario === id && esistente !== chiave) {
        this.chiavi.delete(esistente);
      }
    }
    this.chiavi.set(chiave, id);
  }

  /** Solo per i test. */
  svuota(): void {
    this.chiavi.clear();
  }
}
