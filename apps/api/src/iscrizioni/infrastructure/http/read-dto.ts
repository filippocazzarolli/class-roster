import type {
  CourseSession,
  MyEnrollment,
  OpenSession,
  Place,
  SessionState,
} from '@repo/contracts';
import {
  LuogoDTO,
  MiaIscrizioneDTO,
  SessioneApertaDTO,
  SessioneDelCorsoDTO,
  StatoSessioneDTO,
} from '../../read-model/letture-sessioni';

/**
 * La traduzione italiano → inglese delle due letture — `architecture.md` §4.6.
 *
 * Sta accanto ai controller e viene chiamata solo da loro: è lo stesso confine in cui
 * `courseId` diventa `corsoId` all'andata. Il read model parla la lingua del modulo, il
 * contratto HTTP parla inglese, e questo file è la riga in cui le due cose si incontrano.
 *
 * Il tipo di ritorno viene da `@repo/contracts`: se un campo del contratto cambia nome, a
 * fallire è la compilazione di questo file — non una vista nel browser.
 */

export const aOpenSession = (s: SessioneApertaDTO): OpenSession => ({
  id: s.id,
  courseId: s.corsoId,
  courseTitle: s.corsoTitolo,
  date: s.data,
  startTime: s.oraInizio,
  place: aPlace(s.luogo),
  teacher: s.docente,
  capacity: s.capienza,
  enrolled: s.iscritti,
  waiting: s.inAttesa,
  remainingSeats: s.postiResidui,
});

export const aMyEnrollment = (i: MiaIscrizioneDTO): MyEnrollment => {
  const comune = {
    sessionId: i.sessioneId,
    courseTitle: i.corsoTitolo,
    date: i.data,
    startTime: i.oraInizio,
    place: aPlace(i.luogo),
    sessionState: aSessionState(i.statoSessione),
    cancellableUntil: i.annullabileFinoA,
    cancellable: i.annullabile,
  };

  return i.stato === 'ISCRITTO'
    ? { ...comune, status: 'ENROLLED' }
    : {
        ...comune,
        status: 'WAITLISTED',
        position: i.posizione,
        expired: i.decaduta,
      };
};

export const aCourseSession = (s: SessioneDelCorsoDTO): CourseSession => ({
  id: s.id,
  courseId: s.corsoId,
  courseTitle: s.corsoTitolo,
  date: s.data,
  startTime: s.oraInizio,
  place: aPlace(s.luogo),
  teacher: s.docente,
  capacity: s.capienza,
  enrolled: s.iscritti,
  waiting: s.inAttesa,
  state: aSessionState(s.stato),
  /*
   * Il motivo non si traduce, come `CancelReason` in ingresso: è lo stesso vocabolario
   * che il client usa per annullare, e due parole diverse per lo stesso fatto — una per
   * chiederlo, una per rileggerlo — sarebbero un vocabolario di troppo.
   */
  cancellationReason: s.motivoAnnullamento,
});

/**
 * `AULA` e `ONLINE` restano tali: sono i valori che il DTO in ingresso già accetta, e
 * tradurli solo in uscita darebbe al client due vocabolari per la stessa cosa.
 */
const aPlace = (luogo: LuogoDTO): Place =>
  luogo.tipo === 'AULA'
    ? { type: 'AULA', name: luogo.nome }
    : { type: 'ONLINE' };

const aSessionState = (stato: StatoSessioneDTO): SessionState =>
  stato === 'PROGRAMMATA' ? 'SCHEDULED' : 'CANCELLED';
