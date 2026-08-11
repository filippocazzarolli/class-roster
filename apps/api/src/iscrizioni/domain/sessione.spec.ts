import { IstanteLocale } from '../../shared/domain/istante-locale';
import {
  AnnullamentoFuoriTermine,
  CapienzaInferioreAgliIscritti,
  CapienzaNonValida,
  CorsoNonPubblicato,
  IscrizioneDuplicata,
  IscrizioneNonTrovata,
  SessioneAnnullataNonIscrivibile,
  SessioneGiaAnnullata,
  SessioneGiaIniziata,
} from './errori';
import { NOMI_EVENTI_ISCRIZIONI } from './eventi';
import { CorsoPubblicato, Sessione } from './sessione';
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

/**
 * Test di dominio — `architecture.md` §4.10, livello 1.
 *
 * Nessuna infrastruttura: si istanzia un aggregato, si invoca un metodo, si verifica
 * l'esito. L'orologio è una costante e l'ordine della coda è deterministico per
 * costruzione (INV-7), quindi non c'è nulla da stabilizzare.
 *
 * Che questi test girino senza persistenza, senza HTTP e senza NestJS è l'intero punto
 * dell'esercizio.
 */

const INIZIO = IstanteLocale.da('2026-09-10', '09:00');
const MOLTO_PRIMA = IstanteLocale.da('2026-09-01', '08:00');

const corso: CorsoPubblicato = {
  corsoId: CorsoId.da('corso-1'),
  titolo: TitoloCorso.da('Kubernetes base'),
};

const dipendente = (nome: string): [DipendenteId, Email] => [
  DipendenteId.da(nome),
  Email.da(`${nome}@example.com`),
];

const sessioneCon = (capienza: number, adesso = MOLTO_PRIMA): Sessione =>
  Sessione.programma(
    {
      id: SessioneId.da('sessione-1'),
      inizio: INIZIO,
      luogo: Luogo.aula('Aula 3'),
      docente: Docente.da('Marta Rossi'),
      capienza: Capienza.da(capienza),
    },
    corso,
    adesso,
  );

const iscrivi = (
  sessione: Sessione,
  nome: string,
  adesso = MOLTO_PRIMA,
): void => {
  const [id, email] = dipendente(nome);
  sessione.iscrivi(id, email, adesso);
};

const nomiEventi = (sessione: Sessione): string[] =>
  sessione.eventiNonPubblicati().map((e) => e.nome);

const codaDi = (sessione: Sessione): string[] =>
  sessione
    .iscrizioniInOrdine()
    .filter((i) => i.eInAttesa())
    .map((i) => i.dipendenteId.valore);

const iscrittiDi = (sessione: Sessione): string[] =>
  sessione
    .iscrizioniInOrdine()
    .filter((i) => i.eIscritto())
    .map((i) => i.dipendenteId.valore);

describe('Sessione', () => {
  it("il posto numero capienza+1 finisce in lista d'attesa, non viene respinto", () => {
    const sessione = sessioneCon(2);

    iscrivi(sessione, 'anna');
    iscrivi(sessione, 'bruno');
    expect(() => iscrivi(sessione, 'carla')).not.toThrow();

    expect(iscrittiDi(sessione)).toEqual(['anna', 'bruno']);
    expect(codaDi(sessione)).toEqual(['carla']);
    expect(nomiEventi(sessione)).toContain(
      NOMI_EVENTI_ISCRIZIONI.DIPENDENTE_MESSO_IN_ATTESA,
    );
  });

  it('chi annulla libera il posto per il primo in attesa, non per un altro', () => {
    const sessione = sessioneCon(1);
    iscrivi(sessione, 'anna');
    iscrivi(sessione, 'bruno');
    iscrivi(sessione, 'carla');

    sessione.annullaIscrizione(DipendenteId.da('anna'), MOLTO_PRIMA);

    expect(iscrittiDi(sessione)).toEqual(['bruno']);
    expect(codaDi(sessione)).toEqual(['carla']);
  });

  it('tre in coda, uno annulla: promosso il primo, gli altri scalano', () => {
    const sessione = sessioneCon(1);
    iscrivi(sessione, 'anna');
    iscrivi(sessione, 'bruno');
    iscrivi(sessione, 'carla');
    iscrivi(sessione, 'dario');

    sessione.annullaIscrizione(DipendenteId.da('anna'), MOLTO_PRIMA);

    expect(iscrittiDi(sessione)).toEqual(['bruno']);
    expect(codaDi(sessione)).toEqual(['carla', 'dario']);
  });

  it('nessuno si iscrive due volte alla stessa sessione', () => {
    const sessione = sessioneCon(10);
    iscrivi(sessione, 'anna');

    expect(() => iscrivi(sessione, 'anna')).toThrow(IscrizioneDuplicata);
  });

  it("non si annulla l'iscrizione di un altro", () => {
    const sessione = sessioneCon(10);
    iscrivi(sessione, 'anna');

    expect(() =>
      sessione.annullaIscrizione(DipendenteId.da('bruno'), MOLTO_PRIMA),
    ).toThrow(IscrizioneNonTrovata);
    expect(iscrittiDi(sessione)).toEqual(['anna']);
  });

  it("a 25 ore dall'inizio l'annullamento passa, a 23 no", () => {
    const venticinqueOrePrima = IstanteLocale.da('2026-09-09', '08:00');
    const ventitreOrePrima = IstanteLocale.da('2026-09-09', '10:00');

    const inTempo = sessioneCon(10);
    iscrivi(inTempo, 'anna');
    expect(() =>
      inTempo.annullaIscrizione(DipendenteId.da('anna'), venticinqueOrePrima),
    ).not.toThrow();

    const tardi = sessioneCon(10);
    iscrivi(tardi, 'anna');
    expect(() =>
      tardi.annullaIscrizione(DipendenteId.da('anna'), ventitreOrePrima),
    ).toThrow(AnnullamentoFuoriTermine);
  });

  it('non ci si iscrive a una sessione annullata', () => {
    const sessione = sessioneCon(10);
    sessione.annulla('DECISIONE_RESPONSABILE');

    expect(() => iscrivi(sessione, 'anna')).toThrow(
      SessioneAnnullataNonIscrivibile,
    );
  });

  it('non ci si iscrive a una sessione già iniziata', () => {
    const sessione = sessioneCon(10);
    const aSessioneIniziata = IstanteLocale.da('2026-09-10', '09:00');

    expect(() => iscrivi(sessione, 'anna', aSessioneIniziata)).toThrow(
      SessioneGiaIniziata,
    );
  });

  it('una sessione non si programma con capienza 0', () => {
    expect(() => Capienza.da(0)).toThrow(CapienzaNonValida);
  });

  it('ridurre la capienza sotto gli iscritti è rifiutato', () => {
    const sessione = sessioneCon(3);
    iscrivi(sessione, 'anna');
    iscrivi(sessione, 'bruno');

    expect(() =>
      sessione.modificaCapienza(Capienza.da(1), MOLTO_PRIMA),
    ).toThrow(CapienzaInferioreAgliIscritti);
    expect(sessione.capienza.valore).toBe(3);

    // Ridurre **fino** al numero di iscritti è invece ammesso, e non promuove nessuno.
    expect(() =>
      sessione.modificaCapienza(Capienza.da(2), MOLTO_PRIMA),
    ).not.toThrow();
  });

  it('aumentare la capienza di 2 promuove i primi 2 in coda', () => {
    const sessione = sessioneCon(1);
    iscrivi(sessione, 'anna');
    iscrivi(sessione, 'bruno');
    iscrivi(sessione, 'carla');
    iscrivi(sessione, 'dario');

    sessione.modificaCapienza(Capienza.da(3), MOLTO_PRIMA);

    expect(iscrittiDi(sessione)).toEqual(['anna', 'bruno', 'carla']);
    expect(codaDi(sessione)).toEqual(['dario']);
    expect(
      nomiEventi(sessione).filter(
        (n) => n === NOMI_EVENTI_ISCRIZIONI.DIPENDENTE_PROMOSSO,
      ),
    ).toHaveLength(2);
  });

  it('chi era in attesa e si sfila non promuove nessuno', () => {
    const sessione = sessioneCon(1);
    iscrivi(sessione, 'anna');
    iscrivi(sessione, 'bruno');
    iscrivi(sessione, 'carla');

    sessione.annullaIscrizione(DipendenteId.da('bruno'), MOLTO_PRIMA);

    expect(iscrittiDi(sessione)).toEqual(['anna']);
    expect(codaDi(sessione)).toEqual(['carla']);
    expect(nomiEventi(sessione)).toContain(
      NOMI_EVENTI_ISCRIZIONI.ATTESA_ANNULLATA,
    );
    expect(nomiEventi(sessione)).not.toContain(
      NOMI_EVENTI_ISCRIZIONI.DIPENDENTE_PROMOSSO,
    );
  });

  it('annullare una sessione già annullata è rifiutato', () => {
    const sessione = sessioneCon(10);
    sessione.annulla('DECISIONE_RESPONSABILE');

    expect(() => sessione.annulla('CORSO_RITIRATO')).toThrow(
      SessioneGiaAnnullata,
    );
  });
});

describe('Sessione — programmazione', () => {
  it('non si programma una sessione per un corso non pubblicato', () => {
    expect(() =>
      Sessione.programma(
        {
          id: SessioneId.da('sessione-2'),
          inizio: INIZIO,
          luogo: Luogo.online(),
          docente: Docente.da('Marta Rossi'),
          capienza: Capienza.da(5),
        },
        null,
        MOLTO_PRIMA,
      ),
    ).toThrow(CorsoNonPubblicato);
  });

  it("l'annullamento della sessione porta con sé tutti i destinatari", () => {
    const sessione = sessioneCon(1);
    iscrivi(sessione, 'anna');
    iscrivi(sessione, 'bruno');
    sessione.svuotaEventi();

    sessione.annulla('CORSO_RITIRATO');

    const [evento] = sessione.eventiNonPubblicati();
    expect(evento.nome).toBe(NOMI_EVENTI_ISCRIZIONI.SESSIONE_ANNULLATA);
    expect(evento.payload.destinatari).toEqual([
      { dipendenteId: 'anna', email: 'anna@example.com', stato: 'ISCRITTO' },
      { dipendenteId: 'bruno', email: 'bruno@example.com', stato: 'IN_ATTESA' },
    ]);
  });
});
