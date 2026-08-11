import type { ErrorBody } from '@repo/contracts';

/**
 * Il trasporto: una `fetch` tipizzata, l'header `X-Utente`, e un errore HTTP che diventa
 * un'eccezione — `architecture.md` §4.11.
 *
 * Gli identificativi di questo pacchetto sono **in inglese** e rispecchiano la tabella
 * delle rotte di §4.6: qui non c'è dominio da nominare, c'è HTTP. L'italiano riprende
 * dentro le app, dove si parla di sessioni e iscrizioni.
 */

/**
 * Un errore di risposta, con il corpo di §4.4 già interpretato.
 *
 * Il campo che conta è `error`, non `message`: distinguere `IscrizioneDuplicata` da
 * `SessioneGiaIniziata` guardando la prosa italiana significherebbe che un refuso nel
 * messaggio cambia il comportamento dell'interfaccia.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly error: ErrorBody['error'];

  constructor(status: number, error: ErrorBody['error'], message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.error = error;
  }
}

/** Errore di rete, o risposta illeggibile: non è il server che rifiuta, è il canale. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('La richiesta non ha raggiunto il server.', { cause });
    this.name = 'NetworkError';
  }
}

export interface ClientOptions {
  /**
   * Prefisso delle rotte. Il default è relativo di proposito: in sviluppo lo inoltra il
   * proxy di Vite, in produzione le due cose stanno dietro lo stesso host, e in nessuno
   * dei due casi il codice conosce un dominio.
   */
  readonly baseUrl?: string;

  /**
   * Chi sta chiamando, letto a ogni richiesta e non catturato una volta: il selettore
   * utente lo cambia a runtime. È l'unico punto in cui l'identità entra nel frontend,
   * come `leggiUtenteCorrente` è l'unico nel backend.
   */
  readonly currentUser: () => string;
}

export interface Client {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch(path: string, body: unknown): Promise<void>;
  del(path: string): Promise<void>;
}

export function createClient({
  baseUrl = '/api',
  currentUser,
}: ClientOptions): Client {
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'X-Utente': currentUser(),
          ...(body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (causa) {
      throw new NetworkError(causa);
    }

    if (!response.ok) {
      throw await leggiErrore(response);
    }

    /*
     * `204` è la risposta di sette rotte su dodici: il comando è stato eseguito e non c'è
     * nulla da restituire. Chiamare `json()` qui solleverebbe su un corpo vuoto.
     */
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T);
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    patch: async (path: string, body: unknown) => {
      await request<void>('PATCH', path, body);
    },
    del: async (path: string) => {
      await request<void>('DELETE', path);
    },
  };
}

/**
 * Il corpo d'errore è quello di §4.4, ma non se ne può dipendere: un 502 del proxy o una
 * pagina HTML non hanno quella forma. Se manca, si ricade sullo stato.
 */
async function leggiErrore(response: Response): Promise<HttpError> {
  try {
    const corpo = (await response.json()) as Partial<ErrorBody>;
    const messaggio = leggiMessaggio(corpo.message);

    if (typeof corpo.error === 'string' && messaggio !== null) {
      return new HttpError(response.status, corpo.error, messaggio);
    }
  } catch {
    // corpo assente o non JSON: sotto c'è la risposta onesta
  }

  return new HttpError(
    response.status,
    'RispostaNonInterpretabile',
    `${response.status} ${response.statusText}`,
  );
}

/**
 * `message` è una stringa nel corpo di §4.4, ma è un **array** quando a rifiutare è la
 * `ValidationPipe`: `{"message": ["durationHours must not be less than 1"], "error":
 * "Bad Request"}`. §4.4 prevede quel caso — è l'`error` che vale il nome dell'eccezione
 * HTTP di Nest — e trattarlo come corpo illeggibile scarterebbe l'unica riga che dice
 * *quale* campo è sbagliato, lasciando all'utente un «400 Bad Request».
 */
function leggiMessaggio(message: unknown): string | null {
  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message)) {
    const righe = message.filter((riga) => typeof riga === 'string');
    return righe.length > 0 ? righe.join('. ') : null;
  }

  return null;
}
