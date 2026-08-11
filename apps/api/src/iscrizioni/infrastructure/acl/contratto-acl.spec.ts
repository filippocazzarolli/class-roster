import * as eventiCatalogo from '../../../catalogo/domain/eventi';
import { NOMI_EVENTI_CATALOGO } from '../../../catalogo/domain/eventi';
import { EventoDiDominio } from '../../../shared/domain/evento-di-dominio';
import { EventoImbustato } from '../../../shared/event-bus/event-bus-in-process';
import { CorsoId } from '../../domain/value-objects/identificativi';
import {
  EVENTI_CATALOGO_ASCOLTATI,
  ReplicaCorsiPubblicati,
} from './replica-corsi-pubblicati';

/**
 * **Test di contratto 2** — l'ACL parla la stessa lingua del catalogo
 * (`architecture.md` §4.9).
 *
 * Questo file importa **entrambi i lati**, cosa che il divieto fra contesti proibisce al
 * codice di produzione. I test sono esentati, ed è una scelta e non una scorciatoia:
 * osservano il sistema da fuori, ed è esattamente così che si verifica che i due lati di
 * un contratto coincidano.
 *
 * Il contratto ha **due metà**, e servono entrambe:
 *
 * 1. **I nomi** — senza questa verifica, rinominare un evento nel catalogo lascerebbe
 *    l'ACL in ascolto di un nome che nessuno pubblica più, e il sintomo sarebbe «le
 *    sessioni non si programmano più», a settimane di distanza dalla causa.
 * 2. **I payload** — l'ACL legge `evento.payload.titolo` e `evento.payload.corsoId` per
 *    nome. Rinominare un campo nel catalogo non romperebbe alcuna compilazione: la
 *    replica si riempirebbe di `undefined` in silenzio. Per questo gli eventi qui sotto
 *    non sono scritti a mano, ma **prodotti dalle factory vere del catalogo**.
 */

const imbusta = (evento: EventoDiDominio, n = 1): EventoImbustato => ({
  ...evento,
  eventId: `evento-${n}`,
  occorsoIl: '2026-09-01 08:00',
});

const corso = CorsoId.da('corso-1');

describe('Contratto ACL ↔ catalogo — i nomi', () => {
  it("ogni nome ascoltato dall'ACL è un nome che il catalogo pubblica davvero", () => {
    const pubblicati: string[] = Object.values(NOMI_EVENTI_CATALOGO);

    for (const ascoltato of Object.values(EVENTI_CATALOGO_ASCOLTATI)) {
      expect(pubblicati).toContain(ascoltato);
    }
  });

  it("l'ACL ascolta i tre eventi che alimentano la replica", () => {
    expect(Object.values(EVENTI_CATALOGO_ASCOLTATI)).toEqual([
      NOMI_EVENTI_CATALOGO.CORSO_PUBBLICATO,
      NOMI_EVENTI_CATALOGO.CORSO_RITIRATO,
      NOMI_EVENTI_CATALOGO.DETTAGLI_CORSO_MODIFICATI,
    ]);
  });

  it('CorsoCreato non è fra questi: un corso in bozza non entra nella replica', () => {
    expect(Object.values(EVENTI_CATALOGO_ASCOLTATI)).not.toContain(
      NOMI_EVENTI_CATALOGO.CORSO_CREATO,
    );
  });
});

describe('Contratto ACL ↔ catalogo — i payload', () => {
  it('un CorsoPubblicato prodotto dal catalogo alimenta la replica', () => {
    const acl = new ReplicaCorsiPubblicati();

    acl.gestisci(
      imbusta(
        eventiCatalogo.corsoPubblicato({
          corsoId: 'corso-1',
          titolo: 'Kubernetes base',
        }),
      ),
    );

    expect(acl.ePubblicato(corso)).toBe(true);
    expect(acl.titoloDi(corso)?.valore).toBe('Kubernetes base');
  });

  it('un DettagliCorsoModificati aggiorna il titolo di un corso già noto', () => {
    const acl = new ReplicaCorsiPubblicati();
    acl.gestisci(
      imbusta(
        eventiCatalogo.corsoPubblicato({
          corsoId: 'corso-1',
          titolo: 'Kubernetes base',
        }),
      ),
    );

    acl.gestisci(
      imbusta(
        eventiCatalogo.dettagliCorsoModificati({
          corsoId: 'corso-1',
          titolo: 'Kubernetes avanzato',
          argomento: 'Cloud',
          durataInOre: 16,
        }),
        2,
      ),
    );

    expect(acl.titoloDi(corso)?.valore).toBe('Kubernetes avanzato');
    expect(acl.ePubblicato(corso)).toBe(true);
  });

  /**
   * Il caso che protegge INV-2: se la modifica dei dettagli facesse *nascere* la voce,
   * un corso mai pubblicato diventerebbe programmabile.
   */
  it('un DettagliCorsoModificati su un corso mai pubblicato non crea la voce', () => {
    const acl = new ReplicaCorsiPubblicati();

    acl.gestisci(
      imbusta(
        eventiCatalogo.dettagliCorsoModificati({
          corsoId: 'corso-1',
          titolo: 'Corso in bozza',
          argomento: 'Cloud',
          durataInOre: 8,
        }),
      ),
    );

    expect(acl.ePubblicato(corso)).toBe(false);
    expect(acl.titoloDi(corso)).toBeNull();
  });

  it('un CorsoRitirato spegne il corso ma ne conserva il titolo', () => {
    const acl = new ReplicaCorsiPubblicati();
    acl.gestisci(
      imbusta(
        eventiCatalogo.corsoPubblicato({
          corsoId: 'corso-1',
          titolo: 'Kubernetes base',
        }),
      ),
    );

    acl.gestisci(
      imbusta(eventiCatalogo.corsoRitirato({ corsoId: 'corso-1' }), 2),
    );

    expect(acl.ePubblicato(corso)).toBe(false);
    // Le sessioni già programmate continuano a mostrare il titolo.
    expect(acl.titoloDi(corso)?.valore).toBe('Kubernetes base');
  });

  it('un CorsoCreato, se pure arrivasse, non entrerebbe nella replica', () => {
    const acl = new ReplicaCorsiPubblicati();

    acl.gestisci(
      imbusta(
        eventiCatalogo.corsoCreato({
          corsoId: 'corso-1',
          titolo: 'Corso in bozza',
          argomento: 'Cloud',
          durataInOre: 8,
        }),
      ),
    );

    expect(acl.ePubblicato(corso)).toBe(false);
  });
});
