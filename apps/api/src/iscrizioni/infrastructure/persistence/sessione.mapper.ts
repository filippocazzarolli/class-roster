import { IstanteLocale } from '../../../shared/domain/istante-locale';
import { Iscrizione } from '../../domain/iscrizione';
import { Sessione } from '../../domain/sessione';
import { Capienza } from '../../domain/value-objects/capienza';
import { Docente } from '../../domain/value-objects/docente';
import { Email } from '../../domain/value-objects/email';
import {
  CorsoId,
  DipendenteId,
  SessioneId,
} from '../../domain/value-objects/identificativi';
import { Luogo } from '../../domain/value-objects/luogo';
import { TitoloCorso } from '../../domain/value-objects/titolo-corso';
import { SessioneSnapshot } from './sessione.snapshot';

/**
 * Il mapper fra l'aggregato e il suo snapshot, **scritto a mano**.
 *
 * È lavoro in più ed è deliberato. Appena si lascia che sia un ORM a fare la traduzione,
 * è l'ORM a dettare la forma del modello: il costruttore privato diventa pubblico perché
 * gli serve, `Iscrizione.ordine` diventa un `@Column`, e la classe smette di poter
 * garantire i propri invarianti alla costruzione.
 *
 * Qui difende anche da qualcosa di più insidioso: senza questa traduzione il repository
 * conserverebbe il **riferimento** all'aggregato, e chi muta una `Sessione` senza
 * salvarla vedrebbe comunque la mutazione al caricamento successivo — con `salva()`
 * ridotto a una chiamata decorativa (`architecture.md` §4.7).
 */

export const aSnapshot = (
  sessione: Sessione,
  versione: number,
): SessioneSnapshot => ({
  id: sessione.id.valore,
  corsoId: sessione.corsoId.valore,
  corsoTitolo: sessione.titoloCorso.valore,
  data: sessione.inizio.data.valore,
  oraInizio: sessione.inizio.ora.valore,
  luogoTipo: sessione.luogo.tipo,
  luogoNome: sessione.luogo.nome,
  docente: sessione.docente.nome,
  capienza: sessione.capienza.valore,
  stato: sessione.stato,
  motivoAnnullamento: sessione.motivoAnnullamento,
  iscrizioni: sessione.iscrizioniInOrdine().map((i) => ({
    dipendenteId: i.dipendenteId.valore,
    email: i.email.valore,
    stato: i.stato,
    ordine: i.ordine,
  })),
  versione,
});

/**
 * L'aggregato si ricostruisce **per intero**, iscrizioni comprese: senza di esse non può
 * difendere INV-4, e un caricamento parziale sarebbe un aggregato che decide alla cieca.
 */
export const aDominio = (snapshot: SessioneSnapshot): Sessione =>
  Sessione.ricostruisci({
    id: SessioneId.da(snapshot.id),
    corsoId: CorsoId.da(snapshot.corsoId),
    titoloCorso: TitoloCorso.da(snapshot.corsoTitolo),
    inizio: IstanteLocale.da(snapshot.data, snapshot.oraInizio),
    luogo:
      snapshot.luogoTipo === 'AULA'
        ? Luogo.aula(snapshot.luogoNome ?? '')
        : Luogo.online(),
    docente: Docente.da(snapshot.docente),
    capienza: Capienza.da(snapshot.capienza),
    stato: snapshot.stato,
    motivoAnnullamento: snapshot.motivoAnnullamento,
    iscrizioni: snapshot.iscrizioni.map((i) =>
      Iscrizione.crea(
        DipendenteId.da(i.dipendenteId),
        Email.da(i.email),
        i.stato,
        i.ordine,
      ),
    ),
    versione: snapshot.versione,
  });
