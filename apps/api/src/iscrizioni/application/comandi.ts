import { MotivoAnnullamento } from '../domain/sessione';

/**
 * Gli oggetti comando dell'application layer — `architecture.md` §4.2.
 *
 * **In italiano**, come il dominio. Il DTO HTTP che li alimenta è in inglese, e la
 * traduzione avviene nel controller e in nessun altro punto.
 *
 * I campi sono primitivi: i value object li costruisce l'use case. È ciò che permette a
 * un comando di nascere da un test, da una policy o da un futuro job di importazione
 * senza passare da HTTP.
 *
 * **Due assenze deliberate.** In `Iscriviti` e `AnnullaIscrizione` il `dipendenteId` non
 * arriva mai dal corpo della richiesta: lo inietta il controller dall'`UtenteCorrente`
 * (INV-9, HS-11). E in nessun comando compare un istante — il tempo arriva dalla porta
 * `Orologio`, altrimenti la regola delle 24 ore sarebbe aggirabile con un campo.
 */

export interface ProgrammaSessione {
  readonly corsoId: string;
  readonly data: string;
  readonly oraInizio: string;
  readonly luogo: { tipo: 'AULA'; nome: string } | { tipo: 'ONLINE' };
  readonly docente: string;
  readonly capienza: number;
}

export interface ModificaCapienzaSessione {
  readonly sessioneId: string;
  readonly capienza: number;
}

export interface AnnullaSessione {
  readonly sessioneId: string;
  readonly motivo: MotivoAnnullamento;
}

export interface Iscriviti {
  readonly sessioneId: string;
  readonly dipendenteId: string;
  readonly email: string;
}

export interface AnnullaIscrizione {
  readonly sessioneId: string;
  readonly dipendenteId: string;
}
