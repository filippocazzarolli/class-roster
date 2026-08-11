import type { EnrollmentResult, MyEnrollment } from '@repo/contracts';
import type { Client } from './client';

/**
 * Le rotte dell'iscrizione — `architecture.md` §4.6.
 */
export function enrollments(client: Client) {
  return {
    /**
     * Nessun corpo, e nessun identificativo del dipendente: arriva da `X-Utente`.
     *
     * Il tipo di ritorno è l'unione discriminata, quindi **l'esito si legge dalla
     * risposta**: chi chiama non ha modo di sapere in anticipo se sarà `ENROLLED` o
     * `WAITLISTED`, che è la regola di §4.11 resa impossibile da violare.
     */
    enroll: (sessionId: string) =>
      client.post<EnrollmentResult>(`/sessions/${sessionId}/enrollments`),

    /** `me` al posto di un parametro: metà della difesa di INV-9 (HS-11). */
    cancelMine: (sessionId: string) =>
      client.del(`/sessions/${sessionId}/enrollments/me`),

    /** R2 — le mie iscrizioni, con i campi derivati di §4.5. */
    listMine: () => client.get<MyEnrollment[]>('/enrollments/me'),
  };
}
