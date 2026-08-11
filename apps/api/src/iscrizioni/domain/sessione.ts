import { EventoDiDominio } from '../../shared/domain/evento-di-dominio';
import { IstanteLocale } from '../../shared/domain/istante-locale';
import {
  AnnullamentoFuoriTermine,
  CapienzaInferioreAgliIscritti,
  CorsoNonPubblicato,
  IscrizioneDuplicata,
  IscrizioneNonTrovata,
  SessioneAnnullataNonIscrivibile,
  SessioneGiaAnnullata,
  SessioneGiaIniziata,
  SessioneNelPassato,
} from './errori';
import * as eventi from './eventi';
import { Iscrizione, StatoIscrizione } from './iscrizione';
import { Capienza } from './value-objects/capienza';
import { Docente } from './value-objects/docente';
import { Email } from './value-objects/email';
import {
  CorsoId,
  DipendenteId,
  SessioneId,
} from './value-objects/identificativi';
import { Luogo } from './value-objects/luogo';
import { TitoloCorso } from './value-objects/titolo-corso';

export type StatoSessione = 'PROGRAMMATA' | 'ANNULLATA';
export type MotivoAnnullamento = 'DECISIONE_RESPONSABILE' | 'CORSO_RITIRATO';

/** Ore entro cui l'annullamento è ancora ammesso — INV-10. */
const ORE_DI_PREAVVISO = 24;

/**
 * Il corso come `iscrizioni` lo conosce: due campi copiati dalla replica ACL.
 *
 * Chi programma una sessione non interroga il catalogo (divieto 1, `domain.md` §2.9):
 * l'use case legge la porta `CorsiPubblicati` e passa qui il risultato, `null` se quel
 * corso non risulta pubblicato.
 */
export interface CorsoPubblicato {
  readonly corsoId: CorsoId;
  readonly titolo: TitoloCorso;
}

export interface DatiSessione {
  readonly id: SessioneId;
  readonly inizio: IstanteLocale;
  readonly luogo: Luogo;
  readonly docente: Docente;
  readonly capienza: Capienza;
}

/**
 * Aggregato radice del contesto `iscrizioni` — il cuore dell'esercizio.
 *
 * Custodisce posti, coda, termine di annullamento e stato. Tiene le iscrizioni
 * **dentro il proprio confine** (HS-3): «iscritti ≤ capienza» e «la coda scorre in
 * ordine» non sono due regole, sono i due lati della stessa decisione, presa nello
 * stesso istante sullo stesso dato.
 *
 * Non conosce il framework, la persistenza né l'orologio di sistema: l'istante corrente
 * arriva sempre come parametro, dalla porta `Orologio`.
 */
export class Sessione {
  private constructor(
    readonly id: SessioneId,
    readonly corsoId: CorsoId,
    readonly titoloCorso: TitoloCorso,
    readonly inizio: IstanteLocale,
    readonly luogo: Luogo,
    readonly docente: Docente,
    private capienzaCorrente: Capienza,
    private statoCorrente: StatoSessione,
    private motivoAnnullamentoCorrente: MotivoAnnullamento | null,
    private readonly iscrizioniCorrenti: Iscrizione[],
    readonly versioneLetta: number,
  ) {}

  private readonly eventiEmessi: EventoDiDominio[] = [];

  // ─── Costruzione ────────────────────────────────────────────────────────────

  /**
   * INV-2 (corso pubblicato), INV-3 (capienza, difesa dal VO) e il rifiuto di
   * programmare nel passato.
   */
  static programma(
    dati: DatiSessione,
    corso: CorsoPubblicato | null,
    adesso: IstanteLocale,
  ): Sessione {
    if (corso === null) {
      throw new CorsoNonPubblicato(
        'Non si programma una sessione per un corso che non risulta pubblicato.',
      );
    }
    if (!adesso.precede(dati.inizio)) {
      throw new SessioneNelPassato(
        `Inizio già trascorso: ${dati.inizio.toString()}.`,
      );
    }

    const sessione = new Sessione(
      dati.id,
      corso.corsoId,
      corso.titolo,
      dati.inizio,
      dati.luogo,
      dati.docente,
      dati.capienza,
      'PROGRAMMATA',
      null,
      [],
      0,
    );

    sessione.eventiEmessi.push(
      eventi.sessioneProgrammata({
        sessioneId: dati.id.valore,
        corsoId: corso.corsoId.valore,
        titoloCorso: corso.titolo.valore,
        data: dati.inizio.data.valore,
        oraInizio: dati.inizio.ora.valore,
        luogo: { tipo: dati.luogo.tipo, nome: dati.luogo.nome },
        docente: dati.docente.nome,
        capienza: dati.capienza.valore,
      }),
    );
    sessione.assicuraCoerenza();
    return sessione;
  }

  /** Ricostruzione dallo snapshot: non emette eventi, non applica regole. */
  static ricostruisci(stato: {
    id: SessioneId;
    corsoId: CorsoId;
    titoloCorso: TitoloCorso;
    inizio: IstanteLocale;
    luogo: Luogo;
    docente: Docente;
    capienza: Capienza;
    stato: StatoSessione;
    motivoAnnullamento: MotivoAnnullamento | null;
    iscrizioni: Iscrizione[];
    versione: number;
  }): Sessione {
    return new Sessione(
      stato.id,
      stato.corsoId,
      stato.titoloCorso,
      stato.inizio,
      stato.luogo,
      stato.docente,
      stato.capienza,
      stato.stato,
      stato.motivoAnnullamento,
      stato.iscrizioni,
      stato.versione,
    );
  }

  // ─── Comandi ────────────────────────────────────────────────────────────────

  /**
   * INV-5 (nessun doppione), INV-6 (né annullata né iniziata), INV-4 e INV-8 per la
   * scelta dell'esito.
   *
   * **Posti esauriti non è un rifiuto, è l'altro esito.** È la traduzione fedele di «se
   * i posti sono esauriti non viene respinto»: se comparisse fra le eccezioni, il
   * modello avrebbe smesso di raccontare la stessa storia del committente.
   */
  iscrivi(
    dipendenteId: DipendenteId,
    email: Email,
    adesso: IstanteLocale,
  ): void {
    this.esigiNonAnnullata();
    this.esigiNonIniziata(adesso);

    if (this.iscrizioniCorrenti.some((i) => i.eDi(dipendenteId))) {
      throw new IscrizioneDuplicata(
        `Il dipendente ${dipendenteId.valore} è già presente in questa sessione.`,
      );
    }

    // INV-8 letto al contrario: finché la coda non è vuota non esistono posti liberi,
    // quindi basta confrontare gli iscritti con la capienza.
    const cePosto = this.numeroIscritti() < this.capienzaCorrente.valore;
    const stato: StatoIscrizione = cePosto ? 'ISCRITTO' : 'IN_ATTESA';

    this.iscrizioniCorrenti.push(
      Iscrizione.crea(dipendenteId, email, stato, this.prossimoOrdine()),
    );

    this.eventiEmessi.push(
      cePosto
        ? eventi.dipendenteIscritto({
            sessioneId: this.id.valore,
            dipendenteId: dipendenteId.valore,
            email: email.valore,
          })
        : eventi.dipendenteMessoInAttesa({
            sessioneId: this.id.valore,
            dipendenteId: dipendenteId.valore,
            email: email.valore,
            posizione: this.inAttesaInOrdine().length,
          }),
    );
    this.assicuraCoerenza();
  }

  /**
   * INV-9 (solo la propria), INV-10 (termine delle 24 ore), INV-6 (non annullata) e —
   * la parte che conta — HS-4: **la promozione è qui dentro, non in una policy**.
   *
   * Chi annulla non «libera un posto»: consegna il proprio posto al primo della coda,
   * nello stesso atto. Se la promozione fosse reattiva esisterebbe una finestra in cui
   * il posto è libero e la coda non è vuota, e in quella finestra un dipendente
   * qualsiasi lo prenderebbe legittimamente — cioè «il posto va al primo che ricarica
   * la pagina», che è ciò che il committente non vuole.
   */
  annullaIscrizione(dipendenteId: DipendenteId, adesso: IstanteLocale): void {
    this.esigiNonAnnullata();

    const indice = this.iscrizioniCorrenti.findIndex((i) =>
      i.eDi(dipendenteId),
    );
    if (indice === -1) {
      throw new IscrizioneNonTrovata(
        `Nessuna iscrizione di ${dipendenteId.valore} in questa sessione.`,
      );
    }
    if (!adesso.precede(this.inizio.menoOre(ORE_DI_PREAVVISO))) {
      throw new AnnullamentoFuoriTermine(
        `L'annullamento è ammesso fino a ${ORE_DI_PREAVVISO} ore prima dell'inizio.`,
      );
    }

    const [rimossa] = this.iscrizioniCorrenti.splice(indice, 1);

    if (rimossa.eInAttesa()) {
      // Chi era in attesa e si sfila non libera nulla: non c'era posto da consegnare.
      this.eventiEmessi.push(
        eventi.attesaAnnullata({
          sessioneId: this.id.valore,
          dipendenteId: dipendenteId.valore,
        }),
      );
      this.assicuraCoerenza();
      return;
    }

    this.eventiEmessi.push(
      eventi.iscrizioneAnnullata({
        sessioneId: this.id.valore,
        dipendenteId: dipendenteId.valore,
      }),
    );
    this.promuoviDallaCoda(1);
    this.assicuraCoerenza();
  }

  /**
   * HS-2 in riduzione — si rifiuta, nessuno viene espulso — e HS-14 in aumento: i posti
   * nuovi scorrono la coda nello stesso atto, perché lasciarli liberi con gente in
   * attesa produrrebbe uno stato che INV-8 dichiara impossibile.
   */
  modificaCapienza(nuova: Capienza, adesso: IstanteLocale): void {
    this.esigiNonAnnullata();
    this.esigiNonIniziata(adesso);

    if (nuova.valore < this.numeroIscritti()) {
      throw new CapienzaInferioreAgliIscritti(
        `Ci sono ${this.numeroIscritti()} iscritti: la capienza non può scendere a ${nuova.valore}. ` +
          'Per liberare posti occorre annullare la sessione e riprogrammarla.',
      );
    }

    const precedente = this.capienzaCorrente;
    this.capienzaCorrente = nuova;

    this.eventiEmessi.push(
      eventi.capienzaSessioneModificata({
        sessioneId: this.id.valore,
        capienzaPrecedente: precedente.valore,
        capienza: nuova.valore,
      }),
    );

    this.promuoviDallaCoda(nuova.valore - this.numeroIscritti());
    this.assicuraCoerenza();
  }

  /** INV-12: `ANNULLATA` è terminale. */
  annulla(motivo: MotivoAnnullamento): void {
    if (this.statoCorrente === 'ANNULLATA') {
      throw new SessioneGiaAnnullata(
        `La sessione ${this.id.valore} è già annullata.`,
      );
    }

    this.statoCorrente = 'ANNULLATA';
    this.motivoAnnullamentoCorrente = motivo;

    this.eventiEmessi.push(
      eventi.sessioneAnnullata({
        sessioneId: this.id.valore,
        titoloCorso: this.titoloCorso.valore,
        data: this.inizio.data.valore,
        oraInizio: this.inizio.ora.valore,
        motivo,
        // I destinatari viaggiano dentro l'evento (HS-10): dopo l'annullamento nessuno
        // dovrà chiedere a `iscrizioni` a chi scrivere.
        destinatari: this.iscrizioniInOrdine().map((i) => ({
          dipendenteId: i.dipendenteId.valore,
          email: i.email.valore,
          stato: i.stato,
        })),
      }),
    );
  }

  // ─── Letture ────────────────────────────────────────────────────────────────

  get stato(): StatoSessione {
    return this.statoCorrente;
  }

  get motivoAnnullamento(): MotivoAnnullamento | null {
    return this.motivoAnnullamentoCorrente;
  }

  get capienza(): Capienza {
    return this.capienzaCorrente;
  }

  /** Copia difensiva: la coda non si manipola da fuori. */
  iscrizioniInOrdine(): readonly Iscrizione[] {
    return [...this.iscrizioniCorrenti].sort((a, b) => a.ordine - b.ordine);
  }

  numeroIscritti(): number {
    return this.iscrizioniCorrenti.filter((i) => i.eIscritto()).length;
  }

  numeroInAttesa(): number {
    return this.inAttesaInOrdine().length;
  }

  /**
   * La posizione in coda di chi è in attesa, contata da 1 — `null` se quel dipendente è
   * iscritto o non è presente.
   *
   * Non è derivabile da `ordine`, che è un progressivo di arrivo e non scala quando
   * qualcuno esce: chi era terzo con ordine 4 diventa secondo senza che il suo ordine
   * cambi. La posizione è **relativa alla coda di adesso**, e solo la radice la vede.
   */
  posizioneInCoda(dipendenteId: DipendenteId): number | null {
    const indice = this.inAttesaInOrdine().findIndex((i) =>
      i.eDi(dipendenteId),
    );
    return indice === -1 ? null : indice + 1;
  }

  postiResidui(): number {
    return this.capienzaCorrente.valore - this.numeroIscritti();
  }

  eIniziata(adesso: IstanteLocale): boolean {
    return !adesso.precede(this.inizio);
  }

  /** Gli eventi accumulati, che l'use case pubblica dopo il salvataggio. */
  eventiNonPubblicati(): readonly EventoDiDominio[] {
    return [...this.eventiEmessi];
  }

  svuotaEventi(): void {
    this.eventiEmessi.length = 0;
  }

  // ─── Interno ────────────────────────────────────────────────────────────────

  private inAttesaInOrdine(): Iscrizione[] {
    return this.iscrizioniCorrenti
      .filter((i) => i.eInAttesa())
      .sort((a, b) => a.ordine - b.ordine);
  }

  private prossimoOrdine(): number {
    return (
      this.iscrizioniCorrenti.reduce(
        (massimo, i) => Math.max(massimo, i.ordine),
        0,
      ) + 1
    );
  }

  /** Consegna `quanti` posti ai primi della coda, in ordine d'arrivo — INV-7, INV-8. */
  private promuoviDallaCoda(quanti: number): void {
    for (const promosso of this.inAttesaInOrdine().slice(
      0,
      Math.max(quanti, 0),
    )) {
      promosso.promuovi();
      this.eventiEmessi.push(
        eventi.dipendentePromosso({
          sessioneId: this.id.valore,
          titoloCorso: this.titoloCorso.valore,
          data: this.inizio.data.valore,
          oraInizio: this.inizio.ora.valore,
          dipendenteId: promosso.dipendenteId.valore,
          email: promosso.email.valore,
        }),
      );
    }
  }

  private esigiNonAnnullata(): void {
    if (this.statoCorrente === 'ANNULLATA') {
      throw new SessioneAnnullataNonIscrivibile(
        `La sessione ${this.id.valore} è annullata.`,
      );
    }
  }

  private esigiNonIniziata(adesso: IstanteLocale): void {
    if (this.eIniziata(adesso)) {
      throw new SessioneGiaIniziata(
        `La sessione ${this.id.valore} è iniziata il ${this.inizio.toString()}.`,
      );
    }
  }

  /**
   * L'invariante centrale, scritta una volta sola — `aggregation.md` §3.4.
   *
   * Invocata in coda a ogni comando: è una rete di sicurezza contro le regressioni
   * future, e costa cinque righe. Se scatta, il difetto è in questo file.
   */
  private assicuraCoerenza(): void {
    const iscritti = this.numeroIscritti();
    const ordini = this.iscrizioniCorrenti.map((i) => i.ordine);
    const dipendenti = this.iscrizioniCorrenti.map(
      (i) => i.dipendenteId.valore,
    );

    if (iscritti > this.capienzaCorrente.valore) {
      throw new Error(
        `INV-4 violata: ${iscritti} iscritti su ${this.capienzaCorrente.valore} posti.`,
      );
    }
    if (iscritti < this.capienzaCorrente.valore && this.numeroInAttesa() > 0) {
      throw new Error(
        "INV-8 violata: ci sono posti liberi e la lista d'attesa non è vuota.",
      );
    }
    if (new Set(ordini).size !== ordini.length) {
      throw new Error(
        'INV-7 violata: due iscrizioni hanno lo stesso ordine di arrivo.',
      );
    }
    if (new Set(dipendenti).size !== dipendenti.length) {
      throw new Error('INV-5 violata: un dipendente compare due volte.');
    }
  }
}
