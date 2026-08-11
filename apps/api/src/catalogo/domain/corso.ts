import { EventoDiDominio } from '../../shared/domain/evento-di-dominio';
import {
  CorsoRitiratoNonModificabile,
  TransizioneCorsoNonAmmessa,
} from './errori';
import * as eventi from './eventi';
import { Argomento } from './value-objects/argomento';
import { Descrizione } from './value-objects/descrizione';
import { DurataInOre } from './value-objects/durata-in-ore';
import { CorsoId } from './value-objects/identificativi';
import { TitoloCorso } from './value-objects/titolo-corso';

export type StatoCorso = 'BOZZA' | 'PUBBLICATO' | 'RITIRATO';

export interface DettagliCorso {
  readonly titolo: TitoloCorso;
  readonly descrizione: Descrizione;
  readonly durataInOre: DurataInOre;
  readonly argomento: Argomento;
}

/**
 * Aggregato radice del contesto `catalogo` — `aggregation.md` §3.2.
 *
 * **Nessuna entità interna**: una radice con soli value object. È il profilo tipico di
 * un aggregato supporting, ed è un'informazione utile — se avesse richiesto una
 * gerarchia, varrebbe la pena chiedersi se sia davvero supporting.
 *
 * Non custodisce INV-1: l'unicità del titolo riguarda l'insieme dei corsi, e questo
 * corso non vede gli altri (HS-7). La difende la persistenza.
 */
export class Corso {
  private constructor(
    readonly id: CorsoId,
    private dettagliCorrenti: DettagliCorso,
    private statoCorrente: StatoCorso,
    readonly versioneLetta: number,
  ) {}

  private readonly eventiEmessi: EventoDiDominio[] = [];

  static crea(id: CorsoId, dettagli: DettagliCorso): Corso {
    const corso = new Corso(id, dettagli, 'BOZZA', 0);
    corso.eventiEmessi.push(
      eventi.corsoCreato({
        corsoId: id.valore,
        titolo: dettagli.titolo.valore,
        argomento: dettagli.argomento.valore,
        durataInOre: dettagli.durataInOre.valore,
      }),
    );
    return corso;
  }

  /** Ricostruzione dallo snapshot: non emette eventi, non applica regole. */
  static ricostruisci(stato: {
    id: CorsoId;
    dettagli: DettagliCorso;
    stato: StatoCorso;
    versione: number;
  }): Corso {
    return new Corso(stato.id, stato.dettagli, stato.stato, stato.versione);
  }

  /**
   * HS-12: un corso ritirato non si modifica, perché `RITIRATO` è terminale.
   *
   * Vale anche su un corso `PUBBLICATO`, e l'evento che ne esce è il modo in cui
   * `iscrizioni` aggiorna il titolo nella propria replica.
   */
  modificaDettagli(dettagli: DettagliCorso): void {
    if (this.statoCorrente === 'RITIRATO') {
      throw new CorsoRitiratoNonModificabile(
        `Il corso ${this.id.valore} è ritirato: per ripartire, creane uno nuovo.`,
      );
    }

    this.dettagliCorrenti = dettagli;
    this.eventiEmessi.push(
      eventi.dettagliCorsoModificati({
        corsoId: this.id.valore,
        titolo: dettagli.titolo.valore,
        argomento: dettagli.argomento.valore,
        durataInOre: dettagli.durataInOre.valore,
      }),
    );
  }

  pubblica(): void {
    if (this.statoCorrente !== 'BOZZA') {
      throw new TransizioneCorsoNonAmmessa(
        `Si pubblica solo ciò che è in bozza: il corso ${this.id.valore} è ${this.statoCorrente}.`,
      );
    }

    this.statoCorrente = 'PUBBLICATO';
    this.eventiEmessi.push(
      eventi.corsoPubblicato({
        corsoId: this.id.valore,
        titolo: this.dettagliCorrenti.titolo.valore,
      }),
    );
  }

  /**
   * Il ritiro è distruttivo e definitivo: fa scattare la policy P2, che annulla le
   * sessioni **future** del corso (INV-11). Non esiste il ripensamento — HS-12.
   */
  ritira(): void {
    if (this.statoCorrente !== 'PUBBLICATO') {
      throw new TransizioneCorsoNonAmmessa(
        `Si ritira solo ciò che è pubblicato: il corso ${this.id.valore} è ${this.statoCorrente}.`,
      );
    }

    this.statoCorrente = 'RITIRATO';
    this.eventiEmessi.push(eventi.corsoRitirato({ corsoId: this.id.valore }));
  }

  get stato(): StatoCorso {
    return this.statoCorrente;
  }

  get dettagli(): DettagliCorso {
    return this.dettagliCorrenti;
  }

  get titolo(): TitoloCorso {
    return this.dettagliCorrenti.titolo;
  }

  ePubblicato(): boolean {
    return this.statoCorrente === 'PUBBLICATO';
  }

  eventiNonPubblicati(): readonly EventoDiDominio[] {
    return [...this.eventiEmessi];
  }

  svuotaEventi(): void {
    this.eventiEmessi.length = 0;
  }
}
