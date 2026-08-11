import { ConflittoDiVersione } from '../../shared/domain/errori';
import { EventoDiDominio } from '../../shared/domain/evento-di-dominio';
import { GeneratoreDiId } from '../../shared/domain/generatore-di-id';
import { IstanteLocale } from '../../shared/domain/istante-locale';
import { Orologio } from '../../shared/domain/orologio';
import { PubblicatoreDiEventi } from '../../shared/domain/pubblicatore-di-eventi';
import { CorsoNonPubblicato, SessioneNonTrovata } from '../domain/errori';
import { NOMI_EVENTI_ISCRIZIONI } from '../domain/eventi';
import { Iscrizione } from '../domain/iscrizione';
import { CorsiPubblicati } from '../domain/ports/corsi-pubblicati';
import { RepositorySessioni } from '../domain/ports/repository-sessioni';
import { Sessione } from '../domain/sessione';
import { CorsoId, SessioneId } from '../domain/value-objects/identificativi';
import { TitoloCorso } from '../domain/value-objects/titolo-corso';
import { AnnullaIscrizioneUseCase } from './annulla-iscrizione.use-case';
import { AnnullaSessioneUseCase } from './annulla-sessione.use-case';
import { IscrivitiUseCase } from './iscriviti.use-case';
import { ModificaCapienzaUseCase } from './modifica-capienza.use-case';
import { AnnullaSessioniCorsoRitiratoPolicy } from './policy/annulla-sessioni-corso-ritirato.policy';
import { ProgrammaSessioneUseCase } from './programma-sessione.use-case';

/**
 * Test degli use case — livello 2 di `architecture.md` §4.10.
 *
 * Verificano **orchestrazione ed eventi prodotti**, non le regole: quelle sono già
 * coperte dai test di dominio, e ripeterle qui significherebbe pagarle due volte.
 *
 * Il doppio del repository **conserva snapshot e non riferimenti**, come pretende §4.7.
 * Non è pignoleria: con i riferimenti, una mutazione è già nell'archivio prima che
 * `salva` venga chiamato, e il test della riprova qui sotto fallisce trovando
 * l'iscrizione del tentativo annullato. È l'aliasing descritto in §4.7, osservato dal
 * vivo.
 */

/** Il mapper minimo che il repository vero avrà in `infrastructure/persistence`. */
const snapshotDi = (s: Sessione, versione: number): Sessione =>
  Sessione.ricostruisci({
    id: s.id,
    corsoId: s.corsoId,
    titoloCorso: s.titoloCorso,
    inizio: s.inizio,
    luogo: s.luogo,
    docente: s.docente,
    capienza: s.capienza,
    stato: s.stato,
    motivoAnnullamento: s.motivoAnnullamento,
    // I value object sono immutabili e si condividono; le iscrizioni no — `promuovi`
    // le muta, quindi vanno ricreate o il clone resterebbe legato all'originale.
    iscrizioni: s
      .iscrizioniInOrdine()
      .map((i) => Iscrizione.crea(i.dipendenteId, i.email, i.stato, i.ordine)),
    versione,
  });

class RepositorySessioniFalso extends RepositorySessioni {
  private readonly archivio = new Map<string, Sessione>();
  /** Sollevato una sola volta, per simulare la scrittura di qualcun altro. */
  conflittoAlProssimoSalvataggio = false;

  perId(id: SessioneId): Sessione | null {
    const conservata = this.archivio.get(id.valore);
    return conservata === undefined
      ? null
      : snapshotDi(conservata, conservata.versioneLetta);
  }

  salva(sessione: Sessione): void {
    if (this.conflittoAlProssimoSalvataggio) {
      this.conflittoAlProssimoSalvataggio = false;
      throw new ConflittoDiVersione(
        `Qualcun altro ha scritto ${sessione.id.valore}.`,
      );
    }
    this.archivio.set(
      sessione.id.valore,
      snapshotDi(sessione, sessione.versioneLetta + 1),
    );
  }

  futureDelCorso(corsoId: CorsoId, adesso: IstanteLocale): Sessione[] {
    return [...this.archivio.values()]
      .filter(
        (s) => s.corsoId.valore === corsoId.valore && !s.eIniziata(adesso),
      )
      .map((s) => snapshotDi(s, s.versioneLetta));
  }
}

class CorsiPubblicatiFalso extends CorsiPubblicati {
  private readonly pubblicati = new Map<string, string>();

  pubblica(corsoId: string, titolo: string): void {
    this.pubblicati.set(corsoId, titolo);
  }

  ritira(corsoId: string): void {
    this.pubblicati.delete(corsoId);
  }

  ePubblicato(corsoId: CorsoId): boolean {
    return this.pubblicati.has(corsoId.valore);
  }

  titoloDi(corsoId: CorsoId): TitoloCorso | null {
    const titolo = this.pubblicati.get(corsoId.valore);
    return titolo === undefined ? null : TitoloCorso.da(titolo);
  }
}

class OrologioFermo extends Orologio {
  constructor(private istante = IstanteLocale.da('2026-09-01', '08:00')) {
    super();
  }

  adesso(): IstanteLocale {
    return this.istante;
  }

  spostaA(data: string, ora: string): void {
    this.istante = IstanteLocale.da(data, ora);
  }
}

class ContatoreDiId extends GeneratoreDiId {
  private prossimo = 1;

  genera(): string {
    return `id-${this.prossimo++}`;
  }
}

class BusDiProva extends PubblicatoreDiEventi {
  readonly pubblicati: EventoDiDominio[] = [];

  pubblica(eventi: readonly EventoDiDominio[]): void {
    this.pubblicati.push(...eventi);
  }

  nomi(): string[] {
    return this.pubblicati.map((e) => e.nome);
  }

  svuota(): void {
    this.pubblicati.length = 0;
  }
}

const contesto = () => {
  const sessioni = new RepositorySessioniFalso();
  const corsiPubblicati = new CorsiPubblicatiFalso();
  const orologio = new OrologioFermo();
  const bus = new BusDiProva();

  const annullaSessione = new AnnullaSessioneUseCase(sessioni, bus);

  return {
    sessioni,
    corsiPubblicati,
    orologio,
    bus,
    programma: new ProgrammaSessioneUseCase(
      sessioni,
      corsiPubblicati,
      orologio,
      new ContatoreDiId(),
      bus,
    ),
    iscriviti: new IscrivitiUseCase(sessioni, orologio, bus),
    annullaIscrizione: new AnnullaIscrizioneUseCase(sessioni, orologio, bus),
    modificaCapienza: new ModificaCapienzaUseCase(sessioni, orologio, bus),
    annullaSessione,
    policyP2: new AnnullaSessioniCorsoRitiratoPolicy(
      sessioni,
      annullaSessione,
      orologio,
    ),
  };
};

const programmaUnaSessione = (
  c: ReturnType<typeof contesto>,
  capienza = 1,
  data = '2026-09-10',
): string => {
  c.corsiPubblicati.pubblica('corso-1', 'Kubernetes base');
  const { sessioneId } = c.programma.esegui({
    corsoId: 'corso-1',
    data,
    oraInizio: '09:00',
    luogo: { tipo: 'AULA', nome: 'Aula 3' },
    docente: 'Marta Rossi',
    capienza,
  });
  c.bus.svuota();
  return sessioneId;
};

describe('ProgrammaSessione', () => {
  it('rifiuta un corso assente dalla replica — INV-2', () => {
    const c = contesto();

    expect(() =>
      c.programma.esegui({
        corsoId: 'corso-mai-pubblicato',
        data: '2026-09-10',
        oraInizio: '09:00',
        luogo: { tipo: 'ONLINE' },
        docente: 'Marta Rossi',
        capienza: 10,
      }),
    ).toThrow(CorsoNonPubblicato);
  });

  it('copia il titolo dalla replica e pubblica SessioneProgrammata', () => {
    const c = contesto();
    c.corsiPubblicati.pubblica('corso-1', 'Kubernetes base');

    c.programma.esegui({
      corsoId: 'corso-1',
      data: '2026-09-10',
      oraInizio: '09:00',
      luogo: { tipo: 'ONLINE' },
      docente: 'Marta Rossi',
      capienza: 10,
    });

    const [evento] = c.bus.pubblicati;
    expect(evento.nome).toBe(NOMI_EVENTI_ISCRIZIONI.SESSIONE_PROGRAMMATA);
    expect(evento.payload.titoloCorso).toBe('Kubernetes base');
  });
});

describe('Iscriviti', () => {
  it("restituisce l'esito, e a posti esauriti è IN_ATTESA e non un rifiuto", async () => {
    const c = contesto();
    const sessioneId = programmaUnaSessione(c, 1);

    const primo = await c.iscriviti.esegui({
      sessioneId,
      dipendenteId: 'anna',
      email: 'anna@example.com',
    });
    const secondo = await c.iscriviti.esegui({
      sessioneId,
      dipendenteId: 'bruno',
      email: 'bruno@example.com',
    });

    expect(primo.esito).toBe('ISCRITTO');
    expect(secondo.esito).toBe('IN_ATTESA');
  });

  it('chi finisce in coda riceve la propria posizione, contata da 1', async () => {
    const c = contesto();
    const sessioneId = programmaUnaSessione(c, 1);

    const esiti = [];
    for (const nome of ['anna', 'bruno', 'carla', 'dario']) {
      esiti.push(
        await c.iscriviti.esegui({
          sessioneId,
          dipendenteId: nome,
          email: `${nome}@example.com`,
        }),
      );
    }

    expect(esiti).toEqual([
      { esito: 'ISCRITTO' },
      { esito: 'IN_ATTESA', posizione: 1 },
      { esito: 'IN_ATTESA', posizione: 2 },
      { esito: 'IN_ATTESA', posizione: 3 },
    ]);
  });

  /**
   * La posizione è **relativa alla coda di adesso**, non al progressivo di arrivo: chi
   * era terzo diventa secondo quando il primo della coda si sfila, pur conservando il
   * proprio `ordine`. Chi si iscrive dopo lo vede subito.
   */
  it('la posizione scala quando qualcuno esce dalla coda', async () => {
    const c = contesto();
    const sessioneId = programmaUnaSessione(c, 1);
    for (const nome of ['anna', 'bruno', 'carla']) {
      await c.iscriviti.esegui({
        sessioneId,
        dipendenteId: nome,
        email: `${nome}@example.com`,
      });
    }

    // Bruno era primo in coda e si sfila: nessuno viene promosso (era in attesa).
    await c.annullaIscrizione.esegui({ sessioneId, dipendenteId: 'bruno' });

    const dario = await c.iscriviti.esegui({
      sessioneId,
      dipendenteId: 'dario',
      email: 'dario@example.com',
    });

    expect(dario).toEqual({ esito: 'IN_ATTESA', posizione: 2 });
  });

  it('su una sessione inesistente solleva SessioneNonTrovata', async () => {
    const c = contesto();

    await expect(
      c.iscriviti.esegui({
        sessioneId: 'non-esiste',
        dipendenteId: 'anna',
        email: 'anna@example.com',
      }),
    ).rejects.toThrow(SessioneNonTrovata);
  });

  it('un conflitto di versione non arriva al chiamante: il comando si riapplica', async () => {
    const c = contesto();
    const sessioneId = programmaUnaSessione(c, 1);
    c.sessioni.conflittoAlProssimoSalvataggio = true;

    const esito = await c.iscriviti.esegui({
      sessioneId,
      dipendenteId: 'anna',
      email: 'anna@example.com',
    });

    expect(esito.esito).toBe('ISCRITTO');
    expect(c.bus.nomi()).toEqual([NOMI_EVENTI_ISCRIZIONI.DIPENDENTE_ISCRITTO]);
  });
});

describe('AnnullaIscrizione', () => {
  it('pubblica IscrizioneAnnullata e DipendentePromosso insieme — HS-4', async () => {
    const c = contesto();
    const sessioneId = programmaUnaSessione(c, 1);
    await c.iscriviti.esegui({
      sessioneId,
      dipendenteId: 'anna',
      email: 'anna@example.com',
    });
    await c.iscriviti.esegui({
      sessioneId,
      dipendenteId: 'bruno',
      email: 'bruno@example.com',
    });
    c.bus.svuota();

    await c.annullaIscrizione.esegui({ sessioneId, dipendenteId: 'anna' });

    expect(c.bus.nomi()).toEqual([
      NOMI_EVENTI_ISCRIZIONI.ISCRIZIONE_ANNULLATA,
      NOMI_EVENTI_ISCRIZIONI.DIPENDENTE_PROMOSSO,
    ]);
  });
});

describe('ModificaCapienza', () => {
  it("l'aumento pubblica un DipendentePromosso per ciascun posto nuovo — HS-14", async () => {
    const c = contesto();
    const sessioneId = programmaUnaSessione(c, 1);
    for (const nome of ['anna', 'bruno', 'carla']) {
      await c.iscriviti.esegui({
        sessioneId,
        dipendenteId: nome,
        email: `${nome}@example.com`,
      });
    }
    c.bus.svuota();

    await c.modificaCapienza.esegui({ sessioneId, capienza: 3 });

    expect(c.bus.nomi()).toEqual([
      NOMI_EVENTI_ISCRIZIONI.CAPIENZA_SESSIONE_MODIFICATA,
      NOMI_EVENTI_ISCRIZIONI.DIPENDENTE_PROMOSSO,
      NOMI_EVENTI_ISCRIZIONI.DIPENDENTE_PROMOSSO,
    ]);
  });
});

describe('Policy P2 — il ritiro annulla le sessioni future', () => {
  it('annulla le future e lascia stare le passate — INV-11', async () => {
    const c = contesto();
    const futura = programmaUnaSessione(c, 5, '2026-09-10');
    const passata = programmaUnaSessione(c, 5, '2026-09-05');

    // Il tempo passa: la seconda sessione è ormai alle spalle.
    c.orologio.spostaA('2026-09-07', '08:00');
    c.bus.svuota();

    await c.policyP2.esegui('corso-1');

    expect(c.sessioni.perId(SessioneId.da(futura))?.stato).toBe('ANNULLATA');
    expect(c.sessioni.perId(SessioneId.da(passata))?.stato).toBe('PROGRAMMATA');
    expect(c.bus.nomi()).toEqual([NOMI_EVENTI_ISCRIZIONI.SESSIONE_ANNULLATA]);
  });

  it('una seconda consegna dello stesso evento non è un problema', async () => {
    const c = contesto();
    programmaUnaSessione(c, 5, '2026-09-10');

    await c.policyP2.esegui('corso-1');
    await expect(c.policyP2.esegui('corso-1')).resolves.toBeUndefined();
  });
});
