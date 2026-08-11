import { DipendenteId } from './value-objects/identificativi';
import { Email } from './value-objects/email';

export type StatoIscrizione = 'ISCRITTO' | 'IN_ATTESA';

/**
 * Entità interna all'aggregato `Sessione` — `aggregation.md` §3.3.
 *
 * È un'entità e non un value object perché ha **identità locale** (il `dipendenteId`)
 * e uno stato che cambia restando la stessa iscrizione: chi viene promosso da
 * `IN_ATTESA` a `ISCRITTO` non diventa un'altra iscrizione, è la stessa persona con un
 * esito migliore.
 *
 * L'identità è locale in senso stretto: non esiste modo di riferire un'`Iscrizione`
 * da fuori l'aggregato, e non serve.
 */
export class Iscrizione {
  private constructor(
    readonly dipendenteId: DipendenteId,
    readonly email: Email,
    private statoCorrente: StatoIscrizione,
    /**
     * Progressivo di arrivo nella sessione — INV-7.
     *
     * Non è un timestamp, ed è una decisione: due iscrizioni nello stesso millisecondo
     * produrrebbero un ordine indefinito, e l'ordine indefinito in una coda equa è
     * precisamente il difetto che il committente ha chiesto di non avere. Assegnato
     * dall'aggregato, che le vede tutte, quindi senza collisioni possibili — e
     * deterministico nei test, senza toccare l'orologio.
     */
    readonly ordine: number,
  ) {}

  static crea(
    dipendenteId: DipendenteId,
    email: Email,
    stato: StatoIscrizione,
    ordine: number,
  ): Iscrizione {
    return new Iscrizione(dipendenteId, email, stato, ordine);
  }

  get stato(): StatoIscrizione {
    return this.statoCorrente;
  }

  eDi(dipendenteId: DipendenteId): boolean {
    return this.dipendenteId.equivaleA(dipendenteId);
  }

  eIscritto(): boolean {
    return this.statoCorrente === 'ISCRITTO';
  }

  eInAttesa(): boolean {
    return this.statoCorrente === 'IN_ATTESA';
  }

  /** Chiamabile solo dalla radice: è la radice a sapere se c'è un posto da consegnare. */
  promuovi(): void {
    this.statoCorrente = 'ISCRITTO';
  }
}
