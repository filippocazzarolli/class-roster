import { Corso, DettagliCorso } from './corso';
import {
  CorsoRitiratoNonModificabile,
  TransizioneCorsoNonAmmessa,
} from './errori';
import { NOMI_EVENTI_CATALOGO } from './eventi';
import { Argomento } from './value-objects/argomento';
import { Descrizione } from './value-objects/descrizione';
import { DurataInOre } from './value-objects/durata-in-ore';
import { CorsoId } from './value-objects/identificativi';
import { TitoloCorso } from './value-objects/titolo-corso';

/**
 * Test di dominio del contesto `catalogo` — livello 1 di `architecture.md` §4.10.
 *
 * Il ciclo di vita è tutto ciò che il `Corso` custodisce: INV-1 non è qui (HS-7), e
 * infatti non compare in nessuno di questi test.
 */

const dettagli = (titolo = 'Kubernetes base'): DettagliCorso => ({
  titolo: TitoloCorso.da(titolo),
  descrizione: Descrizione.da('Introduzione pratica agli orchestratori.'),
  durataInOre: DurataInOre.da(16),
  argomento: Argomento.da('Cloud'),
});

const corsoInBozza = (): Corso => Corso.crea(CorsoId.da('corso-1'), dettagli());

const corsoPubblicato = (): Corso => {
  const corso = corsoInBozza();
  corso.pubblica();
  return corso;
};

describe('Corso', () => {
  it('nasce in bozza ed emette CorsoCreato', () => {
    const corso = corsoInBozza();

    expect(corso.stato).toBe('BOZZA');
    expect(corso.eventiNonPubblicati().map((e) => e.nome)).toEqual([
      NOMI_EVENTI_CATALOGO.CORSO_CREATO,
    ]);
  });

  it('si pubblica solo ciò che è in bozza', () => {
    const corso = corsoPubblicato();

    expect(corso.stato).toBe('PUBBLICATO');
    expect(() => corso.pubblica()).toThrow(TransizioneCorsoNonAmmessa);
  });

  it('si ritira solo ciò che è pubblicato', () => {
    expect(() => corsoInBozza().ritira()).toThrow(TransizioneCorsoNonAmmessa);

    const corso = corsoPubblicato();
    expect(() => corso.ritira()).not.toThrow();
    expect(corso.stato).toBe('RITIRATO');
  });

  it('un corso ritirato non si ripubblica: RITIRATO è terminale', () => {
    const corso = corsoPubblicato();
    corso.ritira();

    expect(() => corso.pubblica()).toThrow(TransizioneCorsoNonAmmessa);
    expect(() => corso.ritira()).toThrow(TransizioneCorsoNonAmmessa);
  });

  it('un corso ritirato non si modifica', () => {
    const corso = corsoPubblicato();
    corso.ritira();

    expect(() => corso.modificaDettagli(dettagli('Altro titolo'))).toThrow(
      CorsoRitiratoNonModificabile,
    );
  });

  it("modificare i dettagli di un corso pubblicato emette l'evento che aggiorna la replica", () => {
    const corso = corsoPubblicato();
    corso.svuotaEventi();

    corso.modificaDettagli(dettagli('Kubernetes avanzato'));

    const [evento] = corso.eventiNonPubblicati();
    expect(evento.nome).toBe(NOMI_EVENTI_CATALOGO.DETTAGLI_CORSO_MODIFICATI);
    expect(evento.payload.titolo).toBe('Kubernetes avanzato');
  });

  it('due titoli che differiscono per maiuscole e spazi sono lo stesso titolo', () => {
    expect(
      TitoloCorso.da('Kubernetes  Base').eLoStessoDi(
        TitoloCorso.da('kubernetes base'),
      ),
    ).toBe(true);
  });
});
