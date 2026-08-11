import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * **Livello 4 di `architecture.md` §4.10** — il percorso completo via HTTP.
 *
 * Uno solo, e attraversa tutto: catalogo, bus, ACL, policy, aggregato, persistenza,
 * filtro delle eccezioni. Serve a verificare ciò che nessun livello inferiore vede — che
 * i pezzi siano davvero **cablati fra loro** — non a ripetere le regole, che sono già
 * coperte dai test di dominio.
 *
 * L'applicazione è costruita con lo stesso `ValidationPipe` e lo stesso prefisso di
 * `main.ts`: un e2e che configura l'app diversamente dalla produzione verifica un
 * sistema che non esiste.
 *
 * > Nota: il passo finale del percorso descritto in §4.10 — «e la notifica compare nel
 * > log» — non è verificabile finché il contesto `notifiche` non esiste. Gli eventi che
 * > lo alimenterebbero vengono comunque prodotti e sono verificati al livello 2.
 */

const UTENTE_A = 'anna@example.com';
const UTENTE_B = 'bruno@example.com';
const UTENTE_C = 'carla@example.com';

/** Il bus consegna dopo aver risposto: si concede un giro di event loop agli handler. */
const eventiConsegnati = (): Promise<void> =>
  new Promise((risolvi) => setTimeout(risolvi, 20));

describe('Percorso completo (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;

  beforeEach(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = modulo.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    http = app.getHttpServer();
  });

  afterEach(async () => {
    await app.close();
  });

  const creaCorsoPubblicato = async (titolo: string): Promise<string> => {
    const creato = await request(http)
      .post('/api/courses')
      .send({
        title: titolo,
        description: 'Introduzione pratica agli orchestratori.',
        durationHours: 16,
        topic: 'Cloud',
      })
      .expect(201);

    const corsoId = (creato.body as { id: string }).id;
    await request(http).post(`/api/courses/${corsoId}/publish`).expect(204);
    await eventiConsegnati();

    return corsoId;
  };

  const programmaSessione = async (
    corsoId: string,
    capacity: number,
  ): Promise<string> => {
    const sessione = await request(http)
      .post('/api/sessions')
      .send({
        courseId: corsoId,
        date: '2099-09-10',
        startTime: '09:00',
        place: { type: 'AULA', name: 'Aula 3' },
        teacher: 'Marta Rossi',
        capacity,
      })
      .expect(201);

    return (sessione.body as { id: string }).id;
  };

  const iscrivi = (sessioneId: string, utente: string) =>
    request(http)
      .post(`/api/sessions/${sessioneId}/enrollments`)
      .set('X-Utente', utente);

  /**
   * Il percorso di §4.10: pubblica corso → programma sessione da 1 posto → A si iscrive
   * → B va in coda → A annulla → **il posto è di B**.
   *
   * Che B sia stato promosso si verifica senza read model, e in modo più stringente di
   * una lettura: si iscrive un terzo. Se la promozione non fosse avvenuta il posto
   * sarebbe libero e C risulterebbe `ENROLLED` — è esattamente lo scavalco che HS-4
   * esiste per impedire.
   */
  it('il posto liberato va al primo della coda, non al primo che arriva', async () => {
    const corsoId = await creaCorsoPubblicato('Kubernetes base');
    const sessioneId = await programmaSessione(corsoId, 1);

    await iscrivi(sessioneId, UTENTE_A).expect(201).expect({
      status: 'ENROLLED',
    });

    await iscrivi(sessioneId, UTENTE_B).expect(201).expect({
      status: 'WAITLISTED',
      position: 1,
    });

    await request(http)
      .delete(`/api/sessions/${sessioneId}/enrollments/me`)
      .set('X-Utente', UTENTE_A)
      .expect(204);

    await iscrivi(sessioneId, UTENTE_C).expect(201).expect({
      status: 'WAITLISTED',
      position: 1,
    });
  });

  /**
   * Il ritiro di un corso attraversa il confine fra i due contesti: evento sul bus →
   * ACL → policy P2 → annullamento della sessione. Nessuna chiamata diretta fra moduli.
   */
  it('ritirare un corso annulla le sue sessioni future — attraverso il bus', async () => {
    const corsoId = await creaCorsoPubblicato('Kubernetes avanzato');
    const sessioneId = await programmaSessione(corsoId, 10);

    await request(http).post(`/api/courses/${corsoId}/withdraw`).expect(204);
    await eventiConsegnati();

    const rifiutata = await iscrivi(sessioneId, UTENTE_A).expect(409);

    expect(rifiutata.body).toMatchObject({
      error: 'SessioneAnnullataNonIscrivibile',
      status: 409,
    });
  });

  it('un corso mai pubblicato non è programmabile — INV-2 sulla replica', async () => {
    const creato = await request(http)
      .post('/api/courses')
      .send({
        title: 'Corso rimasto in bozza',
        description: 'Non sarà mai pubblicato.',
        durationHours: 8,
        topic: 'Cloud',
      })
      .expect(201);

    const rifiutata = await request(http)
      .post('/api/sessions')
      .send({
        courseId: (creato.body as { id: string }).id,
        date: '2099-09-10',
        startTime: '09:00',
        place: { type: 'ONLINE' },
        teacher: 'Marta Rossi',
        capacity: 5,
      })
      .expect(422);

    expect(rifiutata.body).toMatchObject({
      error: 'CorsoNonPubblicato',
      status: 422,
    });
  });

  describe('il confine HTTP', () => {
    it('senza X-Utente non ci si iscrive: 400', async () => {
      const corsoId = await creaCorsoPubblicato('Corso per il 400');
      const sessioneId = await programmaSessione(corsoId, 5);

      await request(http)
        .post(`/api/sessions/${sessioneId}/enrollments`)
        .expect(400);
    });

    it("una sessione online non richiede il nome dell'aula", async () => {
      const corsoId = await creaCorsoPubblicato('Corso online');

      await request(http)
        .post('/api/sessions')
        .send({
          courseId: corsoId,
          date: '2099-09-10',
          startTime: '09:00',
          place: { type: 'ONLINE' },
          teacher: 'Marta Rossi',
          capacity: 5,
        })
        .expect(201);
    });

    it('un campo non dichiarato è rifiutato, non ignorato in silenzio', async () => {
      await request(http)
        .post('/api/courses')
        .send({
          title: 'Corso con campo di troppo',
          description: 'Descrizione.',
          durationHours: 8,
          topic: 'Cloud',
          employeeId: 'tentativo-di-manomissione',
        })
        .expect(400);
    });

    it('un titolo già usato è rifiutato — INV-1', async () => {
      await creaCorsoPubblicato('Titolo irripetibile');

      const rifiutato = await request(http)
        .post('/api/courses')
        .send({
          title: '  TITOLO   IRRIPETIBILE  ',
          description: 'Stesso titolo, altre maiuscole e spazi.',
          durationHours: 8,
          topic: 'Cloud',
        })
        .expect(409);

      expect(rifiutato.body).toMatchObject({
        error: 'TitoloCorsoGiaUsato',
        status: 409,
      });
    });
  });
});
