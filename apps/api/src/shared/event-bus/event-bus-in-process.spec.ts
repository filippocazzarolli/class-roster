import { Logger } from '@nestjs/common';
import { EventoDiDominio } from '../domain/evento-di-dominio';
import { GeneratoreDiId } from '../domain/generatore-di-id';
import { IstanteLocale } from '../domain/istante-locale';
import { Orologio } from '../domain/orologio';
import {
  EventBusInProcess,
  EventoImbustato,
  HandlerDiEventi,
} from './event-bus-in-process';

/**
 * Test del bus — livello 3 di `architecture.md` §4.10.
 *
 * Verifica le tre garanzie che il bus dà e che nessun altro livello osserva:
 * **idempotenza** della consegna, **ordine** di consegna, e **isolamento** dei
 * fallimenti di un handler.
 *
 * L'idempotenza in particolare è ciò che resta dopo la rimozione dell'outbox (§4.8): non
 * dipendeva dal database ma dalla forma della consegna, e senza un test è
 * un'affermazione.
 */

const NOME = 'catalogo.CorsoRitirato.v1';
const ALTRO_NOME = 'catalogo.CorsoPubblicato.v1';

const evento = (nome = NOME): EventoDiDominio => ({
  nome,
  aggregateId: 'corso-1',
  payload: { corsoId: 'corso-1' },
});

/** Restituisce sempre lo stesso id: è così che si riconsegna *lo stesso* evento. */
class GeneratoreFisso extends GeneratoreDiId {
  constructor(private readonly id = 'evento-1') {
    super();
  }

  genera(): string {
    return this.id;
  }
}

class OrologioFermo extends Orologio {
  adesso(): IstanteLocale {
    return IstanteLocale.da('2026-09-01', '08:00');
  }
}

class HandlerSpia implements HandlerDiEventi {
  readonly ricevuti: EventoImbustato[] = [];

  constructor(
    readonly nome: string,
    readonly ascolta: readonly string[] = [NOME],
    private readonly traccia: string[] = [],
  ) {}

  gestisci(evento: EventoImbustato): void {
    this.ricevuti.push(evento);
    this.traccia.push(this.nome);
  }
}

class HandlerCheFallisce implements HandlerDiEventi {
  readonly ascolta = [NOME];

  constructor(readonly nome: string) {}

  gestisci(): void {
    throw new Error('esplosione deliberata');
  }
}

/** La consegna è asincrona rispetto a `pubblica`: si attende che la coda si svuoti. */
const consegnato = (): Promise<void> =>
  new Promise((risolvi) => setImmediate(risolvi));

const bus = (id: GeneratoreDiId = new GeneratoreFisso()): EventBusInProcess =>
  new EventBusInProcess(id, new OrologioFermo());

describe('EventBusInProcess — la busta', () => {
  it('chiude la busta con eventId e occorsoIl', async () => {
    const spia = new HandlerSpia('Spia');
    const b = bus();
    b.sottoscrivi(spia);

    b.pubblica([evento()]);
    await consegnato();

    expect(spia.ricevuti).toHaveLength(1);
    expect(spia.ricevuti[0].eventId).toBe('evento-1');
    expect(spia.ricevuti[0].occorsoIl).toBe('2026-09-01 08:00');
    expect(spia.ricevuti[0].payload).toEqual({ corsoId: 'corso-1' });
  });

  it('un handler riceve solo gli eventi che dichiara di ascoltare', async () => {
    const spia = new HandlerSpia('Spia', [ALTRO_NOME]);
    const b = bus();
    b.sottoscrivi(spia);

    b.pubblica([evento(NOME)]);
    await consegnato();

    expect(spia.ricevuti).toHaveLength(0);
  });
});

describe('EventBusInProcess — idempotenza', () => {
  it('la stessa consegna allo stesso handler avviene una volta sola', async () => {
    const spia = new HandlerSpia('Spia');
    const b = bus();
    b.sottoscrivi(spia);

    // Stesso evento, stesso eventId: è la riconsegna di §4.8.
    b.pubblica([evento()]);
    b.pubblica([evento()]);
    await consegnato();

    expect(spia.ricevuti).toHaveLength(1);
  });

  /**
   * La chiave è `(handler, eventId)` e non il solo `eventId`: due handler devono
   * ricevere entrambi lo stesso evento, altrimenti il primo consumerebbe la consegna
   * degli altri — e su `CorsoRitirato` la policy P2 non scatterebbe mai.
   */
  it('due handler diversi ricevono entrambi lo stesso evento', async () => {
    const primo = new HandlerSpia('Primo');
    const secondo = new HandlerSpia('Secondo');
    const b = bus();
    b.sottoscrivi(primo);
    b.sottoscrivi(secondo);

    b.pubblica([evento()]);
    await consegnato();

    expect(primo.ricevuti).toHaveLength(1);
    expect(secondo.ricevuti).toHaveLength(1);
  });

  it('due eventi distinti arrivano entrambi', async () => {
    const spia = new HandlerSpia('Spia');
    let n = 0;
    const b = bus({ genera: () => `evento-${++n}` } as GeneratoreDiId);
    b.sottoscrivi(spia);

    b.pubblica([evento(), evento()]);
    await consegnato();

    expect(spia.ricevuti.map((e) => e.eventId)).toEqual([
      'evento-1',
      'evento-2',
    ]);
  });
});

describe('EventBusInProcess — ordine e fallimenti', () => {
  /**
   * L'ordine di registrazione è l'ordine di consegna, e su `CorsoRitirato` è vincolante:
   * prima l'ACL aggiorna la replica, poi la policy annulla le sessioni (§4.8).
   */
  it('gli handler ricevono in ordine di sottoscrizione', async () => {
    const traccia: string[] = [];
    const b = bus();
    b.sottoscrivi(new HandlerSpia('AclCatalogo', [NOME], traccia));
    b.sottoscrivi(new HandlerSpia('AnnullaSessioni', [NOME], traccia));

    b.pubblica([evento()]);
    await consegnato();

    expect(traccia).toEqual(['AclCatalogo', 'AnnullaSessioni']);
  });

  it('un handler che fallisce non impedisce agli altri di ricevere', async () => {
    const errori = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const superstite = new HandlerSpia('Superstite');
    const b = bus();
    b.sottoscrivi(new HandlerCheFallisce('Esplosivo'));
    b.sottoscrivi(superstite);

    b.pubblica([evento()]);
    await consegnato();

    expect(superstite.ricevuti).toHaveLength(1);
    // Il fallimento non è silenzioso: senza outbox, il log è l'unica traccia che resta.
    expect(errori).toHaveBeenCalled();

    errori.mockRestore();
  });
});
