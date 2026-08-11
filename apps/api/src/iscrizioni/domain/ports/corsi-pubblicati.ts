import { CorsoId } from '../value-objects/identificativi';
import { TitoloCorso } from '../value-objects/titolo-corso';

/**
 * Porta: la replica locale del catalogo, vista dal dominio.
 *
 * È l'unico modo in cui `iscrizioni` sa se un corso è pubblicato (INV-2), e non è una
 * lettura del modulo `catalogo`: è una **copia alimentata per evento** dall'ACL
 * (HS-8, `domain.md` §2.7). Il dominio la vede come una porta e non come una tabella
 * altrui, ed è ciò che tiene in piedi il divieto 1.
 *
 * La consistenza è **eventuale e auto-riparante**: fra il ritiro di un corso e
 * l'aggiornamento della replica esiste una finestra in cui questa porta risponde
 * ancora «pubblicato». La policy P2 ripara annullando le sessioni programmate nel
 * frattempo — purché l'ACL aggiorni **prima** che la policy annulli
 * (`architecture.md` §4.8).
 */
export abstract class CorsiPubblicati {
  abstract ePubblicato(corsoId: CorsoId): boolean;

  abstract titoloDi(corsoId: CorsoId): TitoloCorso | null;
}
