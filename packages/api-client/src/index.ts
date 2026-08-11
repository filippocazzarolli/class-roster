import { type Client, type ClientOptions, createClient } from './client';
import { courses } from './courses';
import { enrollments } from './enrollments';
import { sessions } from './sessions';

export { createClient, HttpError, NetworkError } from './client';
export type { Client, ClientOptions } from './client';
export { courses } from './courses';
export { enrollments } from './enrollments';
export { sessions } from './sessions';

/**
 * Il client completo, costruito una volta nel `composition root` dell'app.
 *
 * I tre gruppi restano separati e non diventano un oggetto piatto di dodici metodi:
 * `web-dipendente` usa `sessions` ed `enrollments`, `web-formazione` usa `courses` e
 * `sessions`. Che le app tocchino gruppi diversi è la tabella di §4.11 che si vede nel
 * codice, invece di essere ricordata a mente.
 */
export function createApi(options: ClientOptions) {
  const client: Client = createClient(options);

  return {
    client,
    courses: courses(client),
    sessions: sessions(client),
    enrollments: enrollments(client),
  };
}

export type Api = ReturnType<typeof createApi>;
