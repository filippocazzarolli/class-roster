import type {
  CancelSessionRequest,
  ChangeCapacityRequest,
  CourseSession,
  CreatedResponse,
  ListSessionsQuery,
  OpenSession,
  ScheduleSessionRequest,
} from '@repo/contracts';
import type { Client } from './client';

/**
 * Le rotte di `iscrizioni` che riguardano la sessione — `architecture.md` §4.6.
 */
export function sessions(client: Client) {
  return {
    schedule: (body: ScheduleSessionRequest) =>
      client.post<CreatedResponse>('/sessions', body),

    changeCapacity: (id: string, body: ChangeCapacityRequest) =>
      client.patch(`/sessions/${id}/capacity`, body),

    cancel: (id: string, body: CancelSessionRequest) =>
      client.post<void>(`/sessions/${id}/cancel`, body),

    /** R1 — le sessioni aperte, con i posti residui. */
    listOpen: () => client.get<OpenSession[]>('/sessions/open'),

    /**
     * R4 — le sessioni viste dal responsabile.
     *
     * Senza `courseId` è una chiamata sola per l'intera vista catalogo, che conta le
     * sessioni per corso; con `courseId` è l'elenco di un corso. `URLSearchParams` invece
     * della concatenazione perché un identificativo finisce in un URL, e la codifica non
     * è un dettaglio che valga la pena ricordare a mano.
     */
    list: ({ courseId }: ListSessionsQuery = {}) => {
      const query =
        courseId === undefined ? '' : `?${new URLSearchParams({ courseId })}`;
      return client.get<CourseSession[]>(`/sessions${query}`);
    },
  };
}
