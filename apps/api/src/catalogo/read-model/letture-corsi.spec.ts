import { CorsoSnapshot } from '../infrastructure/persistence/corso.snapshot';
import { CorsiInMemoria } from '../infrastructure/persistence/repository-corsi.in-memoria';
import { LettureCorsiInMemoria } from './letture-corsi.in-memoria';

/** R3 — `architecture.md` §4.5. Snapshot costruiti a mano, nessun aggregato. */

const corso = (
  parziale: Partial<CorsoSnapshot> & Pick<CorsoSnapshot, 'id' | 'titolo'>,
): CorsoSnapshot => ({
  titoloNormalizzato: (parziale.titolo ?? '').toLowerCase(),
  descrizione: 'Descrizione di prova',
  durataOre: 16,
  argomento: 'Architettura',
  stato: 'BOZZA',
  versione: 1,
  ...parziale,
});

const conCorsi = (...snapshot: CorsoSnapshot[]) => {
  const archivio = new CorsiInMemoria();
  snapshot.forEach((c) => archivio.salva(c.id, c, 0));
  return new LettureCorsiInMemoria(archivio);
};

describe('R3 — catalogo corsi', () => {
  it('elenca i corsi in ogni stato: è la vista di gestione, non una vetrina', () => {
    const letture = conCorsi(
      corso({ id: 'c-1', titolo: 'Bozza', stato: 'BOZZA' }),
      corso({ id: 'c-2', titolo: 'Pubblicato', stato: 'PUBBLICATO' }),
      corso({ id: 'c-3', titolo: 'Ritirato', stato: 'RITIRATO' }),
    );

    expect(letture.listaCorsi().map((c) => c.stato)).toEqual([
      'BOZZA',
      'PUBBLICATO',
      'RITIRATO',
    ]);
  });

  it('ordina per titolo normalizzato, quindi senza dipendere dalle maiuscole', () => {
    const letture = conCorsi(
      corso({ id: 'c-1', titolo: 'event storming' }),
      corso({ id: 'c-2', titolo: 'Aggregati' }),
      corso({ id: 'c-3', titolo: 'Bounded context' }),
    );

    expect(letture.listaCorsi().map((c) => c.titolo)).toEqual([
      'Aggregati',
      'Bounded context',
      'event storming',
    ]);
  });

  /**
   * Il conteggio delle sessioni è un dato di `iscrizioni`: comporlo qui sarebbe la foreign
   * key fra moduli che `domain.md` §2.9 ha rifiutato. Il test presidia l'assenza.
   */
  it('non porta il conteggio delle sessioni programmate', () => {
    const letture = conCorsi(corso({ id: 'c-1', titolo: 'DDD' }));

    expect(letture.listaCorsi()[0]).toEqual({
      id: 'c-1',
      titolo: 'DDD',
      descrizione: 'Descrizione di prova',
      durataOre: 16,
      argomento: 'Architettura',
      stato: 'BOZZA',
    });
  });
});
