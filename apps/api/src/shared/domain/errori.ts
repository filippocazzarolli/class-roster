/**
 * Radice di ogni rifiuto espresso dal dominio.
 *
 * Il filtro in `shared/http` traduce queste eccezioni in stati HTTP
 * (`architecture.md` §4.4): nessuna classe di `domain/` sa cosa sia un 409.
 */
export abstract class ErroreDiDominio extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Un value object rifiuta il valore con cui lo si vuole costruire.
 *
 * `architecture.md` §4.2 chiede che ogni vincolo sia verificato due volte: nel DTO
 * per rispondere «questa richiesta è ben formata?» e nel value object per rispondere
 * «questo valore può esistere nel mio dominio?». Nel percorso HTTP la `ValidationPipe`
 * intercetta prima, quindi questa eccezione si vede solo quando il comando arriva da
 * un test, da una policy o da un handler — cioè esattamente i casi per cui esiste.
 */
export class ValoreNonValido extends ErroreDiDominio {}

/**
 * Qualcun altro ha scritto l'aggregato dopo che noi l'avevamo letto.
 *
 * La solleva il repository quando la `versione` dello snapshot non è più quella letta
 * (`architecture.md` §4.7). **Non arriva mai al chiamante**: la intercetta
 * `con-riprova` nell'application service, che ricarica ed esegue di nuovo il comando.
 */
export class ConflittoDiVersione extends ErroreDiDominio {}

/**
 * 503 con `Retry-After: 1` — la contesa non si è risolta entro i tentativi previsti.
 *
 * È un fallimento **tecnico e ritentabile**, e va tenuto distinto da un rifiuto di
 * dominio, che è definitivo: al client conviene riprovare, non cambiare richiesta.
 */
export class ConflittoDiVersioneNonRisolto extends ErroreDiDominio {}
