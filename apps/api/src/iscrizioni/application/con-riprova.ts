import {
  ConflittoDiVersione,
  ConflittoDiVersioneNonRisolto,
} from '../../shared/domain/errori';

/** Attese fra un tentativo e il successivo, in millisecondi — `architecture.md` §4.7. */
const ATTESE_MS = [0, 10, 25];

const attendi = (ms: number): Promise<void> =>
  ms === 0
    ? Promise.resolve()
    : new Promise((risolvi) => setTimeout(risolvi, ms));

/**
 * Esegue un comando e, se qualcun altro ha scritto nel frattempo, lo **riesegue su uno
 * stato aggiornato**.
 *
 * La riprova vive qui e non nel dominio: l'aggregato non sa cosa sia una contesa, sa
 * solo applicare la regola dei posti allo stato che ha davanti. Al secondo tentativo
 * l'iscrizione dell'altro è visibile e la normale regola produce l'esito giusto — il
 * rifiuto per duplicato, oppure l'ingresso in lista d'attesa. **Non esiste un ramo di
 * codice per «ho perso la gara»**: c'è solo la regola di dominio applicata a uno stato
 * aggiornato.
 *
 * `operazione` deve **ricaricare l'aggregato a ogni tentativo**, altrimenti riapplica il
 * comando a uno stato vecchio e il conflitto si ripresenta identico.
 *
 * Nota onesta, da `architecture.md` §4.7: con l'archivio in memoria e un solo processo
 * questo meccanismo è **corretto ma inerte** — fra il caricamento e il salvataggio non
 * c'è punto di sospensione in cui un'altra esecuzione possa inserirsi. Diventa
 * indispensabile al primo `await` dentro la persistenza, cioè al primo database.
 */
export async function conRiprova<T>(operazione: () => T): Promise<T> {
  let ultimo: ConflittoDiVersione | null = null;

  for (const attesa of ATTESE_MS) {
    await attendi(attesa);
    try {
      return operazione();
    } catch (errore) {
      if (!(errore instanceof ConflittoDiVersione)) throw errore;
      ultimo = errore;
    }
  }

  throw new ConflittoDiVersioneNonRisolto(
    `Contesa non risolta dopo ${ATTESE_MS.length} tentativi: ${ultimo?.message ?? ''}`,
  );
}
