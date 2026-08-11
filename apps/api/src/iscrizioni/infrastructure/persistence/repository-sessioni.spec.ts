import { ConflittoDiVersione } from '../../../shared/domain/errori';
import { IstanteLocale } from '../../../shared/domain/istante-locale';
import { conRiprova } from '../../application/con-riprova';
import { CorsoPubblicato, Sessione } from '../../domain/sessione';
import { Capienza } from '../../domain/value-objects/capienza';
import { Docente } from '../../domain/value-objects/docente';
import { Email } from '../../domain/value-objects/email';
import {
  CorsoId,
  DipendenteId,
  SessioneId,
} from '../../domain/value-objects/identificativi';
import { Luogo } from '../../domain/value-objects/luogo';
import { TitoloCorso } from '../../domain/value-objects/titolo-corso';
import {
  RepositorySessioniInMemoria,
  SessioniInMemoria,
} from './repository-sessioni.in-memoria';

/**
 * Test dell'infrastruttura — livello 3 di `architecture.md` §4.10.
 *
 * Non sono i test «con il database vero» della versione precedente del documento: sono i
 * test di ciò che l'archivio in memoria deve garantire, e che nessun altro livello
 * osserva.
 */

const INIZIO = IstanteLocale.da('2026-09-10', '09:00');
const ADESSO = IstanteLocale.da('2026-09-01', '08:00');

const corso: CorsoPubblicato = {
  corsoId: CorsoId.da('corso-1'),
  titolo: TitoloCorso.da('Kubernetes base'),
};

const nuovaSessione = (
  id = 'sessione-1',
  capienza = 2,
  inizio = INIZIO,
): Sessione =>
  Sessione.programma(
    {
      id: SessioneId.da(id),
      inizio,
      luogo: Luogo.aula('Aula 3'),
      docente: Docente.da('Marta Rossi'),
      capienza: Capienza.da(capienza),
    },
    corso,
    ADESSO,
  );

const iscrivi = (sessione: Sessione, nome: string): void =>
  sessione.iscrivi(
    DipendenteId.da(nome),
    Email.da(`${nome}@example.com`),
    ADESSO,
  );

const contesto = () => {
  const collezione = new SessioniInMemoria();
  return {
    collezione,
    repository: new RepositorySessioniInMemoria(collezione),
  };
};

describe('RepositorySessioniInMemoria — round-trip', () => {
  it('una sessione salvata e riletta è identica, ordine della coda compreso', () => {
    const { repository } = contesto();
    const sessione = nuovaSessione('sessione-1', 1);
    iscrivi(sessione, 'anna');
    iscrivi(sessione, 'bruno');
    iscrivi(sessione, 'carla');
    repository.salva(sessione);

    const riletta = repository.perId(SessioneId.da('sessione-1'));

    expect(riletta).not.toBeNull();
    expect(riletta!.titoloCorso.valore).toBe('Kubernetes base');
    expect(riletta!.inizio.toString()).toBe(sessione.inizio.toString());
    expect(riletta!.luogo.toString()).toBe('Aula Aula 3');
    expect(riletta!.capienza.valore).toBe(1);
    expect(
      riletta!
        .iscrizioniInOrdine()
        .map((i) => [i.dipendenteId.valore, i.stato, i.ordine]),
    ).toEqual([
      ['anna', 'ISCRITTO', 1],
      ['bruno', 'IN_ATTESA', 2],
      ['carla', 'IN_ATTESA', 3],
    ]);
  });

  it('una sessione annullata conserva il motivo', () => {
    const { repository } = contesto();
    const sessione = nuovaSessione();
    sessione.annulla('CORSO_RITIRATO');
    repository.salva(sessione);

    const riletta = repository.perId(SessioneId.da('sessione-1'));

    expect(riletta!.stato).toBe('ANNULLATA');
    expect(riletta!.motivoAnnullamento).toBe('CORSO_RITIRATO');
  });

  /**
   * Il test più importante di questo livello, e non esisteva nella versione con
   * database: lì era l'ORM a rendere impossibile l'errore che verifica.
   */
  it("mutare un aggregato senza salvarlo non cambia l'archivio", () => {
    const { repository } = contesto();
    const sessione = nuovaSessione('sessione-1', 5);
    repository.salva(sessione);

    // Caricata, mutata, e deliberatamente NON salvata.
    const caricata = repository.perId(SessioneId.da('sessione-1'))!;
    iscrivi(caricata, 'anna');

    const riletta = repository.perId(SessioneId.da('sessione-1'))!;
    expect(riletta.iscrizioniInOrdine()).toHaveLength(0);
    expect(caricata.iscrizioniInOrdine()).toHaveLength(1);
  });

  it('due caricamenti restituiscono aggregati indipendenti', () => {
    const { repository } = contesto();
    repository.salva(nuovaSessione('sessione-1', 5));

    const prima = repository.perId(SessioneId.da('sessione-1'))!;
    const seconda = repository.perId(SessioneId.da('sessione-1'))!;
    iscrivi(prima, 'anna');

    expect(seconda.iscrizioniInOrdine()).toHaveLength(0);
  });
});

describe('RepositorySessioniInMemoria — lock ottimistico', () => {
  it('chi salva su una versione superata riceve ConflittoDiVersione', () => {
    const { repository } = contesto();
    repository.salva(nuovaSessione('sessione-1', 5));

    // Due letture della stessa versione: è la contesa, costruita a mano perché in un
    // processo solo non si verifica da sé (§4.7).
    const mia = repository.perId(SessioneId.da('sessione-1'))!;
    const altrui = repository.perId(SessioneId.da('sessione-1'))!;

    iscrivi(altrui, 'bruno');
    repository.salva(altrui);

    iscrivi(mia, 'anna');
    expect(() => repository.salva(mia)).toThrow(ConflittoDiVersione);
  });

  it('con-riprova riapplica il comando allo stato aggiornato, e nessuno perde il posto', async () => {
    const { repository } = contesto();
    repository.salva(nuovaSessione('sessione-1', 1));

    let tentativi = 0;

    await conRiprova(() => {
      tentativi++;
      const sessione = repository.perId(SessioneId.da('sessione-1'))!;

      // Qualcun altro scrive **fra il nostro caricamento e il nostro salvataggio**, che
      // è l'unica finestra in cui il lock ottimistico ha qualcosa da dire.
      if (tentativi === 1) {
        const altrui = repository.perId(SessioneId.da('sessione-1'))!;
        iscrivi(altrui, 'bruno');
        repository.salva(altrui);
      }

      iscrivi(sessione, 'anna');
      repository.salva(sessione);
    });

    expect(tentativi).toBe(2);

    const finale = repository.perId(SessioneId.da('sessione-1'))!;
    expect(
      finale.iscrizioniInOrdine().map((i) => [i.dipendenteId.valore, i.stato]),
    ).toEqual([
      ['bruno', 'ISCRITTO'],
      ['anna', 'IN_ATTESA'],
    ]);
  });
});

describe('RepositorySessioniInMemoria — futureDelCorso', () => {
  it('restituisce solo le sessioni non ancora iniziate, di quel corso', () => {
    const { repository } = contesto();
    repository.salva(
      nuovaSessione('futura', 5, IstanteLocale.da('2026-09-10', '09:00')),
    );
    repository.salva(
      nuovaSessione('passata', 5, IstanteLocale.da('2026-09-02', '09:00')),
    );

    const future = repository.futureDelCorso(
      CorsoId.da('corso-1'),
      IstanteLocale.da('2026-09-05', '08:00'),
    );

    expect(future.map((s) => s.id.valore)).toEqual(['futura']);
  });

  it('ignora le sessioni di altri corsi', () => {
    const { repository } = contesto();
    repository.salva(nuovaSessione('sessione-1', 5));

    expect(repository.futureDelCorso(CorsoId.da('corso-2'), ADESSO)).toEqual(
      [],
    );
  });
});
