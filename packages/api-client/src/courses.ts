import type {
  Course,
  CreateCourseRequest,
  CreatedResponse,
  UpdateCourseRequest,
} from '@repo/contracts';
import type { Client } from './client';

/**
 * Le rotte di `catalogo` — `architecture.md` §4.6. Una funzione per riga della tabella,
 * nessuna scorciatoia in più.
 *
 * `publish` e `withdraw` sono transizioni con un nome, non un `PATCH { state: … }`: il
 * client non deve nemmeno poter *scrivere* una transizione che non esiste.
 */
export function courses(client: Client) {
  return {
    create: (body: CreateCourseRequest) =>
      client.post<CreatedResponse>('/courses', body),

    update: (id: string, body: UpdateCourseRequest) =>
      client.patch(`/courses/${id}`, body),

    publish: (id: string) => client.post<void>(`/courses/${id}/publish`),

    withdraw: (id: string) => client.post<void>(`/courses/${id}/withdraw`),

    /** R3 — l'elenco dei corsi, senza il conteggio delle sessioni (§4.5). */
    list: () => client.get<Course[]>('/courses'),
  };
}
