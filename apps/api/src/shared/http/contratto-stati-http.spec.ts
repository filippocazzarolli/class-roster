import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import * as erroriCatalogo from '../../catalogo/domain/errori';
import { STATI_HTTP_CATALOGO } from '../../catalogo/infrastructure/http/stati-http.catalogo';
import * as erroriIscrizioni from '../../iscrizioni/domain/errori';
import { STATI_HTTP_ISCRIZIONI } from '../../iscrizioni/infrastructure/http/stati-http.iscrizioni';
import { ConflittoDiVersione, ErroreDiDominio } from '../domain/errori';
import * as erroriShared from '../domain/errori';
import { RegistroStatiHttp } from './registro-stati-http';
import { STATI_HTTP_SHARED } from './stati-http.shared';

/**
 * **Test di contratto 1** — ogni errore ha uno stato HTTP (`architecture.md` §4.9).
 *
 * «Che ogni eccezione compaia in questa tabella non è affidato alla memoria»: questo è
 * il test che lo garantisce. Aggiungere una classe di errore senza dichiararne lo stato
 * fa fallire la suite, invece di produrre un 500 il giorno in cui quel rifiuto capita
 * davvero.
 *
 * ## Perché la cartella si scandisce davvero
 *
 * Un elenco di moduli importati a mano avrebbe lo stesso difetto del barrel: si dimentica
 * di aggiornarlo, e il giorno in cui nasce un terzo contesto — o un secondo file di
 * errori dentro uno esistente — le sue eccezioni non sarebbero controllate da nessuno, in
 * silenzio.
 *
 * Qui i moduli sono importati staticamente (per averne i tipi) **e** il filesystem viene
 * scandito per verificare che l'elenco sia completo: se compare un `errori.ts` sotto un
 * `domain/` che questo file non conosce, il primo test fallisce indicando quale.
 */

/** `src/`, che è la cartella due livelli sopra questo file. */
const RADICE = join(__dirname, '..', '..');

const inFormaPortabile = (percorso: string): string =>
  relative(RADICE, percorso).split(sep).join('/');

const fileDiErroriSotto = (cartella: string): string[] =>
  readdirSync(cartella, { withFileTypes: true }).flatMap((voce) => {
    const percorso = join(cartella, voce.name);

    if (voce.isDirectory()) return fileDiErroriSotto(percorso);

    return voce.name === 'errori.ts' && percorso.includes(`${sep}domain${sep}`)
      ? [inFormaPortabile(percorso)]
      : [];
  });

/** I moduli di errori conosciuti da questo test, con il percorso che li individua. */
const MODULI_DICHIARATI: Readonly<Record<string, object>> = {
  'iscrizioni/domain/errori.ts': erroriIscrizioni,
  'catalogo/domain/errori.ts': erroriCatalogo,
  'shared/domain/errori.ts': erroriShared,
};

const eClasseDiErrore = (
  valore: unknown,
): valore is new () => ErroreDiDominio =>
  typeof valore === 'function' && valore.prototype instanceof ErroreDiDominio;

const classiEsportateDa = (modulo: object): (new () => ErroreDiDominio)[] =>
  Object.values(modulo).filter(eClasseDiErrore);

const registro = new RegistroStatiHttp()
  .registra(STATI_HTTP_SHARED)
  .registra(STATI_HTTP_ISCRIZIONI)
  .registra(STATI_HTTP_CATALOGO);

/**
 * L'unica eccezione di dominio che **non deve** avere uno stato: non arriva mai al
 * chiamante, perché `con-riprova` la intercetta e riapplica il comando. Se un giorno
 * comparisse in una risposta HTTP sarebbe un difetto dell'application service, non una
 * riga mancante nella tabella.
 */
const NON_ATTRAVERSA_HTTP: readonly unknown[] = [ConflittoDiVersione];

describe('Contratto: eccezione di dominio → stato HTTP', () => {
  it('nessun file di errori sfugge a questo test', () => {
    expect(fileDiErroriSotto(RADICE).sort()).toEqual(
      Object.keys(MODULI_DICHIARATI).sort(),
    );
  });

  for (const [percorso, modulo] of Object.entries(MODULI_DICHIARATI)) {
    it(`ogni eccezione di ${percorso} ha uno stato dichiarato`, () => {
      const senzaStato = classiEsportateDa(modulo)
        .filter((classe) => !NON_ATTRAVERSA_HTTP.includes(classe))
        .filter((classe) => registro.statoPer(new classe()) === null)
        .map((classe) => classe.name);

      expect(senzaStato).toEqual([]);
    });
  }

  it('gli stati dichiarati sono quelli previsti da §4.4', () => {
    const stati = new Set(
      [
        ...STATI_HTTP_SHARED,
        ...STATI_HTTP_ISCRIZIONI,
        ...STATI_HTTP_CATALOGO,
      ].map(([, stato]) => stato),
    );

    expect([...stati].sort((a, b) => a - b)).toEqual([400, 404, 409, 422, 503]);
  });

  it('il registro distingue le classi: una non dichiarata resta senza stato', () => {
    class ErroreMaiDichiarato extends ErroreDiDominio {}

    expect(registro.statoPer(new ErroreMaiDichiarato('x'))).toBeNull();
  });
});
