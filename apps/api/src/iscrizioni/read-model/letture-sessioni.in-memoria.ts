import { IstanteLocale } from '../../shared/domain/istante-locale';
import {
  IscrizioneSnapshot,
  SessioneSnapshot,
} from '../infrastructure/persistence/sessione.snapshot';
import { SessioniInMemoria } from '../infrastructure/persistence/repository-sessioni.in-memoria';
import {
  LettureSessioni,
  LuogoDTO,
  MiaIscrizioneDTO,
  SessioneApertaDTO,
  SessioneDelCorsoDTO,
} from './letture-sessioni';

/** INV-10: le stesse 24 ore che l'aggregato pretende, qui solo per mostrarle. */
const ORE_DI_PREAVVISO = 24;

/**
 * R1 e R2 sugli snapshot dell'archivio — `architecture.md` §4.5.
 *
 * Legge `SessioniInMemoria`, la stessa collezione su cui scrive il repository, e **non il
 * repository**: nessun aggregato viene ricostruito, nessun oggetto di dominio esce da qui.
 * `SessioniInMemoria` è un provider a sé proprio per rendere possibile questa lettura
 * senza aprire una porta sul repository.
 *
 * Sono scansioni con `filter` e `map`, non query: su decine di sessioni è irrilevante, e
 * vale la pena scriverlo così invece di introdurre un indice inverso da mantenere
 * allineato a ogni salvataggio — cioè la proiezione materializzata che §4.5 ha escluso.
 */
export class LettureSessioniInMemoria extends LettureSessioni {
  constructor(private readonly sessioni: SessioniInMemoria) {
    super();
  }

  listaSessioniAperte(adesso: IstanteLocale): SessioneApertaDTO[] {
    return this.sessioni
      .tutti()
      .filter((s) => s.stato === 'PROGRAMMATA' && adesso.precede(inizioDi(s)))
      .map((s) => {
        const iscritti = quanti(s.iscrizioni, 'ISCRITTO');

        return {
          id: s.id,
          corsoId: s.corsoId,
          corsoTitolo: s.corsoTitolo,
          data: s.data,
          oraInizio: s.oraInizio,
          luogo: luogoDi(s),
          docente: s.docente,
          capienza: s.capienza,
          iscritti,
          inAttesa: quanti(s.iscrizioni, 'IN_ATTESA'),
          postiResidui: s.capienza - iscritti,
        };
      })
      .sort(perDataEOra);
  }

  /**
   * Con SQL era una join guidata da un indice su `dipendente_id`; qui è una scansione.
   *
   * Include le sessioni **annullate** in cui il dipendente risulta iscritto: annullare una
   * sessione non cancella le iscrizioni — l'aggregato le conserva, e sono i destinatari
   * dell'evento `SessioneAnnullata` (HS-10). Nasconderle qui significherebbe che chi si
   * era iscritto non vede più nulla, senza sapere perché.
   */
  listaMieIscrizioni(
    dipendenteId: string,
    adesso: IstanteLocale,
  ): MiaIscrizioneDTO[] {
    return this.sessioni
      .tutti()
      .flatMap((s) => {
        const mia = s.iscrizioni.find((i) => i.dipendenteId === dipendenteId);
        return mia === undefined ? [] : [componiDTO(s, mia, adesso)];
      })
      .sort((a, b) => -perDataEOra(a, b));
  }

  /**
   * Senza `corsoId` restituisce tutte le sessioni, ed è la chiamata che compone R3: la
   * vista catalogo la fa **una volta** e conta per corso, invece di una richiesta per riga
   * dell'elenco. Con `corsoId` è l'elenco della vista «programmazione sessioni».
   *
   * L'ordine è dal più recente al più vecchio, come R2: in una vista di gestione ciò su cui
   * si agisce sta in cima, e ciò che è già passato non ci finisce mai.
   */
  listaSessioni(corsoId?: string): SessioneDelCorsoDTO[] {
    return this.sessioni
      .tutti()
      .filter((s) => corsoId === undefined || s.corsoId === corsoId)
      .map((s) => ({
        id: s.id,
        corsoId: s.corsoId,
        corsoTitolo: s.corsoTitolo,
        data: s.data,
        oraInizio: s.oraInizio,
        luogo: luogoDi(s),
        docente: s.docente,
        capienza: s.capienza,
        iscritti: quanti(s.iscrizioni, 'ISCRITTO'),
        inAttesa: quanti(s.iscrizioni, 'IN_ATTESA'),
        stato: s.stato,
        motivoAnnullamento: s.motivoAnnullamento,
      }))
      .sort((a, b) => -perDataEOra(a, b));
  }
}

const quanti = (
  iscrizioni: readonly IscrizioneSnapshot[],
  stato: IscrizioneSnapshot['stato'],
): number => iscrizioni.filter((i) => i.stato === stato).length;

const inizioDi = (s: SessioneSnapshot): IstanteLocale =>
  IstanteLocale.da(s.data, s.oraInizio);

/**
 * `luogoNome` è `string | null` nello snapshot, perché una tabella non ha somme di tipi.
 * Ricomporre la somma qui è la stessa traduzione che fa il mapper verso il dominio: il
 * client riceve la forma onesta, non quella che la persistenza ha imposto.
 */
const luogoDi = (s: SessioneSnapshot): LuogoDTO =>
  s.luogoTipo === 'AULA'
    ? { tipo: 'AULA', nome: s.luogoNome ?? '' }
    : { tipo: 'ONLINE' };

/**
 * L'ordinamento è un confronto fra **stringhe**: `YYYY-MM-DD` e `HH:MM` sono
 * lessicograficamente ordinabili, quindi l'ordine cronologico esce per costruzione (§4.7).
 */
const perDataEOra = (
  a: { data: string; oraInizio: string },
  b: { data: string; oraInizio: string },
): number =>
  a.data !== b.data
    ? a.data < b.data
      ? -1
      : 1
    : a.oraInizio < b.oraInizio
      ? -1
      : a.oraInizio > b.oraInizio
        ? 1
        : 0;

const componiDTO = (
  s: SessioneSnapshot,
  mia: IscrizioneSnapshot,
  adesso: IstanteLocale,
): MiaIscrizioneDTO => {
  const inizio = inizioDi(s);
  const limite = inizio.menoOre(ORE_DI_PREAVVISO);

  const comune = {
    sessioneId: s.id,
    corsoTitolo: s.corsoTitolo,
    data: s.data,
    oraInizio: s.oraInizio,
    luogo: luogoDi(s),
    statoSessione: s.stato,
    annullabileFinoA: `${limite.data.valore}T${limite.ora.valore}`,
    /*
     * Su una sessione annullata l'annullamento dell'iscrizione è rifiutato prima di
     * arrivare a INV-10 (`esigiNonAnnullata`): il suggerimento deve dire la stessa cosa,
     * altrimenti l'interfaccia offre un bottone che il dominio respinge sempre.
     */
    annullabile: s.stato === 'PROGRAMMATA' && adesso.precede(limite),
  };

  if (mia.stato === 'ISCRITTO') {
    return { ...comune, stato: 'ISCRITTO' };
  }

  return {
    ...comune,
    stato: 'IN_ATTESA',
    posizione: posizioneInCoda(s.iscrizioni, mia),
    // HS-9: nessuna transizione di stato, la decadenza è derivata qui.
    decaduta: !adesso.precede(inizio),
  };
};

/**
 * La posizione in coda, contata da 1 e **relativa alla coda di adesso**.
 *
 * Non è derivabile da `ordine`, che è un progressivo di arrivo e non scala quando qualcuno
 * esce: chi era terzo con ordine 4 diventa secondo senza che il suo ordine cambi. È la
 * stessa regola di `Sessione.posizioneInCoda`, riscritta sugli snapshot — duplicazione
 * consapevole, perché l'alternativa è ricostruire l'aggregato per contare.
 */
const posizioneInCoda = (
  iscrizioni: readonly IscrizioneSnapshot[],
  mia: IscrizioneSnapshot,
): number =>
  iscrizioni
    .filter((i) => i.stato === 'IN_ATTESA')
    .sort((a, b) => a.ordine - b.ordine)
    .findIndex((i) => i.dipendenteId === mia.dipendenteId) + 1;
