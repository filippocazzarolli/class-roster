import { ConflittoDiVersione } from '../../../shared/domain/errori';
import { Corso, DettagliCorso } from '../../domain/corso';
import { TitoloCorsoGiaUsato } from '../../domain/errori';
import { Argomento } from '../../domain/value-objects/argomento';
import { Descrizione } from '../../domain/value-objects/descrizione';
import { DurataInOre } from '../../domain/value-objects/durata-in-ore';
import { CorsoId } from '../../domain/value-objects/identificativi';
import { TitoloCorso } from '../../domain/value-objects/titolo-corso';
import {
  CorsiInMemoria,
  IndiceTitoliCorsi,
  RepositoryCorsiInMemoria,
} from './repository-corsi.in-memoria';

/**
 * Test dell'infrastruttura del catalogo — livello 3 di `architecture.md` §4.10.
 *
 * Qui vive **INV-1**, e solo qui: nessun test di dominio può verificarla, perché
 * riguarda l'insieme dei corsi e un `Corso` non vede gli altri (HS-7).
 */

const dettagli = (titolo: string): DettagliCorso => ({
  titolo: TitoloCorso.da(titolo),
  descrizione: Descrizione.da('Introduzione pratica agli orchestratori.'),
  durataInOre: DurataInOre.da(16),
  argomento: Argomento.da('Cloud'),
});

const contesto = () => {
  const corsi = new CorsiInMemoria();
  const indice = new IndiceTitoliCorsi();
  return {
    corsi,
    indice,
    repository: new RepositoryCorsiInMemoria(corsi, indice),
  };
};

describe('RepositoryCorsiInMemoria — round-trip', () => {
  it('un corso salvato e riletto è identico', () => {
    const { repository } = contesto();
    const corso = Corso.crea(
      CorsoId.da('corso-1'),
      dettagli('Kubernetes base'),
    );
    corso.pubblica();
    repository.salva(corso);

    const riletto = repository.perId(CorsoId.da('corso-1'))!;

    expect(riletto.stato).toBe('PUBBLICATO');
    expect(riletto.dettagli.titolo.valore).toBe('Kubernetes base');
    expect(riletto.dettagli.durataInOre.valore).toBe(16);
    expect(riletto.dettagli.argomento.valore).toBe('Cloud');
  });

  it("modificare un corso senza salvarlo non cambia l'archivio", () => {
    const { repository } = contesto();
    repository.salva(
      Corso.crea(CorsoId.da('corso-1'), dettagli('Kubernetes base')),
    );

    const caricato = repository.perId(CorsoId.da('corso-1'))!;
    caricato.pubblica();

    expect(repository.perId(CorsoId.da('corso-1'))!.stato).toBe('BOZZA');
  });
});

describe('RepositoryCorsiInMemoria — INV-1, il titolo è unico', () => {
  it('due corsi con lo stesso titolo: il secondo è rifiutato', () => {
    const { repository } = contesto();
    repository.salva(
      Corso.crea(CorsoId.da('corso-1'), dettagli('Kubernetes base')),
    );

    expect(() =>
      repository.salva(
        Corso.crea(CorsoId.da('corso-2'), dettagli('Kubernetes base')),
      ),
    ).toThrow(TitoloCorsoGiaUsato);
  });

  it('maiuscole e spazi non fanno un titolo diverso', () => {
    const { repository } = contesto();
    repository.salva(
      Corso.crea(CorsoId.da('corso-1'), dettagli('Kubernetes base')),
    );

    expect(() =>
      repository.salva(
        Corso.crea(CorsoId.da('corso-2'), dettagli('  KUBERNETES   BASE  ')),
      ),
    ).toThrow(TitoloCorsoGiaUsato);
  });

  it('un corso può essere risalvato con il proprio titolo', () => {
    const { repository } = contesto();
    const corso = Corso.crea(
      CorsoId.da('corso-1'),
      dettagli('Kubernetes base'),
    );
    repository.salva(corso);

    const riletto = repository.perId(CorsoId.da('corso-1'))!;
    riletto.pubblica();

    expect(() => repository.salva(riletto)).not.toThrow();
  });

  it('rinominare un corso libera il titolo precedente', () => {
    const { repository } = contesto();
    repository.salva(
      Corso.crea(CorsoId.da('corso-1'), dettagli('Kubernetes base')),
    );

    const riletto = repository.perId(CorsoId.da('corso-1'))!;
    riletto.modificaDettagli(dettagli('Kubernetes avanzato'));
    repository.salva(riletto);

    expect(() =>
      repository.salva(
        Corso.crea(CorsoId.da('corso-2'), dettagli('Kubernetes base')),
      ),
    ).not.toThrow();
  });

  it('titoloEsiste risponde anche prima del salvataggio, escludendo sé stessi', () => {
    const { repository } = contesto();
    repository.salva(
      Corso.crea(CorsoId.da('corso-1'), dettagli('Kubernetes base')),
    );

    expect(repository.titoloEsiste(TitoloCorso.da('kubernetes  base'))).toBe(
      true,
    );
    expect(
      repository.titoloEsiste(
        TitoloCorso.da('Kubernetes base'),
        CorsoId.da('corso-1'),
      ),
    ).toBe(false);
    expect(repository.titoloEsiste(TitoloCorso.da("Tutt'altro"))).toBe(false);
  });
});

describe('RepositoryCorsiInMemoria — lock ottimistico', () => {
  it('chi salva su una versione superata riceve ConflittoDiVersione', () => {
    const { repository } = contesto();
    repository.salva(
      Corso.crea(CorsoId.da('corso-1'), dettagli('Kubernetes base')),
    );

    const mio = repository.perId(CorsoId.da('corso-1'))!;
    const altrui = repository.perId(CorsoId.da('corso-1'))!;

    altrui.pubblica();
    repository.salva(altrui);

    mio.modificaDettagli(dettagli('Kubernetes avanzato'));
    expect(() => repository.salva(mio)).toThrow(ConflittoDiVersione);
  });

  it("un salvataggio fallito non lascia il titolo occupato nell'indice", () => {
    const { repository } = contesto();
    repository.salva(
      Corso.crea(CorsoId.da('corso-1'), dettagli('Kubernetes base')),
    );

    const mio = repository.perId(CorsoId.da('corso-1'))!;
    const altrui = repository.perId(CorsoId.da('corso-1'))!;
    altrui.pubblica();
    repository.salva(altrui);

    mio.modificaDettagli(dettagli('Titolo mai scritto'));
    expect(() => repository.salva(mio)).toThrow(ConflittoDiVersione);

    // Il titolo del salvataggio fallito deve essere ancora libero per chiunque.
    expect(repository.titoloEsiste(TitoloCorso.da('Titolo mai scritto'))).toBe(
      false,
    );
  });
});
