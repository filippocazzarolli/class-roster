import { Orologio } from '../../shared/domain/orologio';
import { PubblicatoreDiEventi } from '../../shared/domain/pubblicatore-di-eventi';
import { SessioneNonTrovata } from '../domain/errori';
import { RepositorySessioni } from '../domain/ports/repository-sessioni';
import { Email } from '../domain/value-objects/email';
import {
  DipendenteId,
  SessioneId,
} from '../domain/value-objects/identificativi';
import * as comandi from './comandi';
import { conRiprova } from './con-riprova';

/**
 * I due esiti dell'iscrizione, come **somma di due casi** e non come coppia di campi
 * opzionali: la posizione esiste se e solo se si è finiti in coda, e il tipo lo dice.
 *
 * È la stessa forma di `Luogo` nel dominio, per la stessa ragione: «iscritto con una
 * posizione in coda» è uno stato che non deve poter essere rappresentato.
 */
export type EsitoIscrizione =
  | { readonly esito: 'ISCRITTO' }
  | { readonly esito: 'IN_ATTESA'; readonly posizione: number };

/**
 * Iscrive un dipendente, oppure lo mette in coda.
 *
 * **Restituisce l'esito, non lo prevede.** A posti esauriti non c'è rifiuto: c'è
 * `IN_ATTESA`. È la ragione per cui il DTO di risposta ha due esiti e non uno
 * (`architecture.md` §4.6), e per cui il frontend non deve mai disabilitare il bottone
 * «Iscriviti» leggendo i posti residui.
 */
export class IscrivitiUseCase {
  constructor(
    private readonly sessioni: RepositorySessioni,
    private readonly orologio: Orologio,
    private readonly bus: PubblicatoreDiEventi,
  ) {}

  async esegui(comando: comandi.Iscriviti): Promise<EsitoIscrizione> {
    const sessioneId = SessioneId.da(comando.sessioneId);
    const dipendenteId = DipendenteId.da(comando.dipendenteId);
    const email = Email.da(comando.email);

    const { risultato, eventi } = await conRiprova(() => {
      // Ricaricata a ogni tentativo: è la condizione perché la riprova abbia senso.
      const sessione = this.sessioni.perId(sessioneId);
      if (sessione === null) {
        throw new SessioneNonTrovata(
          `Sessione ${comando.sessioneId} inesistente.`,
        );
      }

      sessione.iscrivi(dipendenteId, email, this.orologio.adesso());
      this.sessioni.salva(sessione);

      // La posizione si legge **dopo** il salvataggio e dall'aggregato appena deciso:
      // è quella della coda di adesso, non quella dell'evento emesso al primo tentativo.
      const posizione = sessione.posizioneInCoda(dipendenteId);

      const emessi = sessione.eventiNonPubblicati();
      sessione.svuotaEventi();

      return {
        risultato:
          posizione === null
            ? ({ esito: 'ISCRITTO' } as const)
            : ({ esito: 'IN_ATTESA', posizione } as const),
        eventi: emessi,
      };
    });

    this.bus.pubblica(eventi);
    return risultato;
  }
}
