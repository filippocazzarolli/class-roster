import { IstanteLocale } from '../../shared/domain/istante-locale';
import { SessioneSnapshot } from '../infrastructure/persistence/sessione.snapshot';
import { SessioniInMemoria } from '../infrastructure/persistence/repository-sessioni.in-memoria';
import { LettureSessioniInMemoria } from './letture-sessioni.in-memoria';

/**
 * R1 e R2 — `architecture.md` §4.5.
 *
 * I test costruiscono **snapshot a mano**, senza passare dagli aggregati: è la stessa
 * disciplina che il read model deve rispettare, applicata a chi lo verifica. Se questi
 * test avessero bisogno di `Sessione` per preparare i dati, vorrebbe dire che la lettura
 * non è davvero indipendente dal dominio.
 */

const ADESSO = IstanteLocale.da('2026-03-10', '09:00');

const sessione = (
  parziale: Partial<SessioneSnapshot> & Pick<SessioneSnapshot, 'id'>,
): SessioneSnapshot => ({
  corsoId: 'corso-1',
  corsoTitolo: 'DDD in pratica',
  data: '2026-06-01',
  oraInizio: '09:00',
  luogoTipo: 'AULA',
  luogoNome: 'Sala Verdi',
  docente: 'Eric Evans',
  capienza: 2,
  stato: 'PROGRAMMATA',
  motivoAnnullamento: null,
  iscrizioni: [],
  versione: 1,
  ...parziale,
});

const iscritto = (dipendenteId: string, ordine: number) => ({
  dipendenteId,
  email: `${dipendenteId}@example.com`,
  stato: 'ISCRITTO' as const,
  ordine,
});

const inAttesa = (dipendenteId: string, ordine: number) => ({
  dipendenteId,
  email: `${dipendenteId}@example.com`,
  stato: 'IN_ATTESA' as const,
  ordine,
});

const conSessioni = (...snapshot: SessioneSnapshot[]) => {
  const archivio = new SessioniInMemoria();
  snapshot.forEach((s) => archivio.salva(s.id, s, 0));
  return new LettureSessioniInMemoria(archivio);
};

describe('R1 — sessioni aperte', () => {
  it('mostra i posti residui come capienza meno gli iscritti', () => {
    const letture = conSessioni(
      sessione({
        id: 's-1',
        capienza: 3,
        iscrizioni: [iscritto('a', 1), iscritto('b', 2), inAttesa('c', 3)],
      }),
    );

    expect(letture.listaSessioniAperte(ADESSO)).toEqual([
      expect.objectContaining({
        capienza: 3,
        iscritti: 2,
        inAttesa: 1,
        postiResidui: 1,
      }),
    ]);
  });

  it('esclude le sessioni annullate e quelle già iniziate', () => {
    const letture = conSessioni(
      sessione({ id: 'aperta' }),
      sessione({ id: 'annullata', stato: 'ANNULLATA' }),
      sessione({ id: 'passata', data: '2026-01-01' }),
    );

    expect(letture.listaSessioniAperte(ADESSO).map((s) => s.id)).toEqual([
      'aperta',
    ]);
  });

  /** INV-6 confronta istanti, non date: una sessione di oggi più tardi è ancora aperta. */
  it('include la sessione di oggi che non è ancora iniziata, esclude quella passata', () => {
    const letture = conSessioni(
      sessione({ id: 'stamattina', data: '2026-03-10', oraInizio: '08:00' }),
      sessione({ id: 'oggi-dopo', data: '2026-03-10', oraInizio: '14:00' }),
    );

    expect(letture.listaSessioniAperte(ADESSO).map((s) => s.id)).toEqual([
      'oggi-dopo',
    ]);
  });

  it('ordina per data e ora crescenti', () => {
    const letture = conSessioni(
      sessione({ id: 'terza', data: '2026-07-01', oraInizio: '09:00' }),
      sessione({ id: 'seconda', data: '2026-06-01', oraInizio: '15:00' }),
      sessione({ id: 'prima', data: '2026-06-01', oraInizio: '09:00' }),
    );

    expect(letture.listaSessioniAperte(ADESSO).map((s) => s.id)).toEqual([
      'prima',
      'seconda',
      'terza',
    ]);
  });

  it('ricompone il luogo come somma di due casi', () => {
    const letture = conSessioni(
      sessione({ id: 'aula' }),
      sessione({
        id: 'online',
        luogoTipo: 'ONLINE',
        luogoNome: null,
        data: '2026-06-02',
      }),
    );

    expect(letture.listaSessioniAperte(ADESSO).map((s) => s.luogo)).toEqual([
      { tipo: 'AULA', nome: 'Sala Verdi' },
      { tipo: 'ONLINE' },
    ]);
  });
});

describe('R2 — le mie iscrizioni', () => {
  it('restituisce solo le sessioni in cui il dipendente compare', () => {
    const letture = conSessioni(
      sessione({ id: 'mia', iscrizioni: [iscritto('mario', 1)] }),
      sessione({ id: 'altrui', iscrizioni: [iscritto('lucia', 1)] }),
    );

    expect(letture.listaMieIscrizioni('mario', ADESSO)).toEqual([
      expect.objectContaining({ sessioneId: 'mia', stato: 'ISCRITTO' }),
    ]);
  });

  it("deriva il termine di annullamento a 24 ore dall'inizio (INV-10)", () => {
    const letture = conSessioni(
      sessione({
        id: 's-1',
        data: '2026-06-01',
        oraInizio: '09:00',
        iscrizioni: [iscritto('mario', 1)],
      }),
    );

    expect(letture.listaMieIscrizioni('mario', ADESSO)[0]).toMatchObject({
      annullabileFinoA: '2026-05-31T09:00',
      annullabile: true,
    });
  });

  it("nega l'annullamento dentro le 24 ore", () => {
    const letture = conSessioni(
      sessione({
        id: 's-1',
        data: '2026-03-10',
        oraInizio: '20:00',
        iscrizioni: [iscritto('mario', 1)],
      }),
    );

    expect(letture.listaMieIscrizioni('mario', ADESSO)[0]).toMatchObject({
      annullabileFinoA: '2026-03-09T20:00',
      annullabile: false,
    });
  });

  /**
   * Su una sessione annullata l'aggregato rifiuta prima di arrivare a INV-10: il
   * suggerimento dell'interfaccia deve dire la stessa cosa.
   */
  it("nega l'annullamento su una sessione annullata, anche se in termine", () => {
    const letture = conSessioni(
      sessione({
        id: 's-1',
        stato: 'ANNULLATA',
        motivoAnnullamento: 'DECISIONE_RESPONSABILE',
        iscrizioni: [iscritto('mario', 1)],
      }),
    );

    expect(letture.listaMieIscrizioni('mario', ADESSO)[0]).toMatchObject({
      statoSessione: 'ANNULLATA',
      annullabile: false,
    });
  });

  it("conta la posizione in coda sulla coda di adesso, non sull'ordine di arrivo", () => {
    const letture = conSessioni(
      sessione({
        id: 's-1',
        capienza: 1,
        // Chi aveva ordine 2 è uscito: mario resta terzo per ordine, secondo in coda.
        iscrizioni: [
          iscritto('a', 1),
          inAttesa('lucia', 3),
          inAttesa('mario', 4),
        ],
      }),
    );

    expect(letture.listaMieIscrizioni('mario', ADESSO)[0]).toMatchObject({
      stato: 'IN_ATTESA',
      posizione: 2,
    });
  });

  /** HS-9: nessuna transizione di stato, la decadenza è derivata qui. */
  it("marca decaduta l'attesa su una sessione già iniziata", () => {
    const letture = conSessioni(
      sessione({
        id: 'iniziata',
        data: '2026-01-01',
        iscrizioni: [inAttesa('mario', 1)],
      }),
      sessione({
        id: 'futura',
        data: '2026-06-01',
        iscrizioni: [inAttesa('mario', 1)],
      }),
    );

    expect(letture.listaMieIscrizioni('mario', ADESSO)).toEqual([
      expect.objectContaining({ sessioneId: 'futura', decaduta: false }),
      expect.objectContaining({ sessioneId: 'iniziata', decaduta: true }),
    ]);
  });

  it('non espone né posizione né decadenza a chi è iscritto', () => {
    const letture = conSessioni(
      sessione({ id: 's-1', iscrizioni: [iscritto('mario', 1)] }),
    );

    const mia = letture.listaMieIscrizioni('mario', ADESSO)[0];

    expect(mia.stato).toBe('ISCRITTO');
    expect(mia).not.toHaveProperty('posizione');
    expect(mia).not.toHaveProperty('decaduta');
  });

  it('ordina dalla sessione più recente alla più vecchia', () => {
    const letture = conSessioni(
      sessione({
        id: 'giugno',
        data: '2026-06-01',
        iscrizioni: [iscritto('mario', 1)],
      }),
      sessione({
        id: 'luglio',
        data: '2026-07-01',
        iscrizioni: [iscritto('mario', 1)],
      }),
      sessione({
        id: 'maggio',
        data: '2026-05-01',
        iscrizioni: [iscritto('mario', 1)],
      }),
    );

    expect(
      letture.listaMieIscrizioni('mario', ADESSO).map((i) => i.sessioneId),
    ).toEqual(['luglio', 'giugno', 'maggio']);
  });
});

describe('R4 — le sessioni del responsabile', () => {
  it('senza filtro restituisce tutte le sessioni: è la chiamata che compone R3', () => {
    const letture = conSessioni(
      sessione({ id: 's-1', corsoId: 'corso-a' }),
      sessione({ id: 's-2', corsoId: 'corso-b', data: '2026-06-02' }),
    );

    expect(
      letture
        .listaSessioni()
        .map((s) => s.id)
        .sort(),
    ).toEqual(['s-1', 's-2']);
  });

  it('con il filtro restituisce solo le sessioni di quel corso', () => {
    const letture = conSessioni(
      sessione({ id: 's-1', corsoId: 'corso-a' }),
      sessione({ id: 's-2', corsoId: 'corso-b', data: '2026-06-02' }),
    );

    expect(letture.listaSessioni('corso-a').map((s) => s.id)).toEqual(['s-1']);
  });

  /** È la vista di gestione: passato e annullato ci sono, perché su quelli si ragiona. */
  it('include le sessioni passate e annullate, con il motivo', () => {
    const letture = conSessioni(
      sessione({ id: 'passata', data: '2026-01-01' }),
      sessione({
        id: 'annullata',
        data: '2026-06-05',
        stato: 'ANNULLATA',
        motivoAnnullamento: 'CORSO_RITIRATO',
      }),
    );

    expect(letture.listaSessioni()).toEqual([
      expect.objectContaining({
        id: 'annullata',
        stato: 'ANNULLATA',
        motivoAnnullamento: 'CORSO_RITIRATO',
      }),
      expect.objectContaining({
        id: 'passata',
        stato: 'PROGRAMMATA',
        motivoAnnullamento: null,
      }),
    ]);
  });

  it('conta iscritti e in attesa, e non espone i posti residui', () => {
    const letture = conSessioni(
      sessione({
        id: 's-1',
        capienza: 1,
        iscrizioni: [iscritto('a', 1), inAttesa('b', 2), inAttesa('c', 3)],
      }),
    );

    const s = letture.listaSessioni()[0];

    expect(s).toMatchObject({ capienza: 1, iscritti: 1, inAttesa: 2 });
    expect(s).not.toHaveProperty('postiResidui');
  });

  it('ordina dalla sessione più recente alla più vecchia', () => {
    const letture = conSessioni(
      sessione({ id: 'giugno', data: '2026-06-01' }),
      sessione({ id: 'agosto', data: '2026-08-01' }),
      sessione({ id: 'luglio', data: '2026-07-01' }),
    );

    expect(letture.listaSessioni().map((s) => s.id)).toEqual([
      'agosto',
      'luglio',
      'giugno',
    ]);
  });
});
