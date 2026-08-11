import { GeneratoreDiId } from '../../shared/domain/generatore-di-id';
import { PubblicatoreDiEventi } from '../../shared/domain/pubblicatore-di-eventi';
import { Corso, DettagliCorso } from '../domain/corso';
import { CorsoNonTrovato, TitoloCorsoGiaUsato } from '../domain/errori';
import { RepositoryCorsi } from '../domain/ports/repository-corsi';
import { Argomento } from '../domain/value-objects/argomento';
import { Descrizione } from '../domain/value-objects/descrizione';
import { DurataInOre } from '../domain/value-objects/durata-in-ore';
import { CorsoId } from '../domain/value-objects/identificativi';
import { TitoloCorso } from '../domain/value-objects/titolo-corso';
import * as comandi from './comandi';

/**
 * Gli use case del catalogo.
 *
 * Sono in un file solo perché sono quattro e fanno tutti la stessa cosa: carica,
 * chiedi all'aggregato, salva, pubblica. Spezzarli in quattro file replicherebbe la
 * forma di `iscrizioni/application` senza averne la sostanza — lì ogni use case ha una
 * propria storia (la riprova, la replica ACL, i due esiti), qui no.
 *
 * **Non usano `conRiprova`.** Il catalogo non ha contesa: le sue scritture sono atti
 * amministrativi di una persona sola, e il conflitto di versione che il repository può
 * comunque sollevare risalirebbe come 503 — corretto, e in pratica irraggiungibile.
 */

const dettagliDa = (dati: {
  titolo: string;
  descrizione: string;
  durataInOre: number;
  argomento: string;
}): DettagliCorso => ({
  titolo: TitoloCorso.da(dati.titolo),
  descrizione: Descrizione.da(dati.descrizione),
  durataInOre: DurataInOre.da(dati.durataInOre),
  argomento: Argomento.da(dati.argomento),
});

export class CreaCorsoUseCase {
  constructor(
    private readonly corsi: RepositoryCorsi,
    private readonly id: GeneratoreDiId,
    private readonly bus: PubblicatoreDiEventi,
  ) {}

  esegui(comando: comandi.CreaCorso): { corsoId: string } {
    const dettagli = dettagliDa(comando);

    // Controllo preventivo: non serve alla correttezza — la garantisce il repository
    // dentro `salva` — ma evita che il messaggio d'errore del caso normale dipenda
    // dalla gestione di un errore infrastrutturale (HS-7).
    if (this.corsi.titoloEsiste(dettagli.titolo)) {
      throw new TitoloCorsoGiaUsato(
        `Esiste già un corso intitolato «${dettagli.titolo.valore}».`,
      );
    }

    const corso = Corso.crea(CorsoId.da(this.id.genera()), dettagli);
    this.corsi.salva(corso);
    this.bus.pubblica(corso.eventiNonPubblicati());
    corso.svuotaEventi();

    return { corsoId: corso.id.valore };
  }
}

export class ModificaDettagliCorsoUseCase {
  constructor(
    private readonly corsi: RepositoryCorsi,
    private readonly bus: PubblicatoreDiEventi,
  ) {}

  esegui(comando: comandi.ModificaDettagliCorso): void {
    const corsoId = CorsoId.da(comando.corsoId);
    const corso = this.esigiCorso(corsoId);
    const dettagli = dettagliDa(comando);

    if (this.corsi.titoloEsiste(dettagli.titolo, corsoId)) {
      throw new TitoloCorsoGiaUsato(
        `Esiste già un corso intitolato «${dettagli.titolo.valore}».`,
      );
    }

    corso.modificaDettagli(dettagli);
    this.corsi.salva(corso);
    this.bus.pubblica(corso.eventiNonPubblicati());
    corso.svuotaEventi();
  }

  private esigiCorso(corsoId: CorsoId): Corso {
    const corso = this.corsi.perId(corsoId);
    if (corso === null) {
      throw new CorsoNonTrovato(`Corso ${corsoId.valore} inesistente.`);
    }
    return corso;
  }
}

export class PubblicaCorsoUseCase {
  constructor(
    private readonly corsi: RepositoryCorsi,
    private readonly bus: PubblicatoreDiEventi,
  ) {}

  esegui(comando: comandi.PubblicaCorso): void {
    const corsoId = CorsoId.da(comando.corsoId);
    const corso = this.corsi.perId(corsoId);
    if (corso === null) {
      throw new CorsoNonTrovato(`Corso ${comando.corsoId} inesistente.`);
    }

    corso.pubblica();
    this.corsi.salva(corso);
    this.bus.pubblica(corso.eventiNonPubblicati());
    corso.svuotaEventi();
  }
}

/**
 * Il ritiro è il comando con la conseguenza più lunga: l'evento che pubblica fa
 * aggiornare la replica in `iscrizioni` e poi scattare la policy P2, che annulla le
 * sessioni future. **In quest'ordine** — se la policy annullasse prima
 * dell'aggiornamento della replica, una sessione programmata nella finestra
 * sopravvivrebbe al ritiro (`architecture.md` §4.8).
 */
export class RitiraCorsoUseCase {
  constructor(
    private readonly corsi: RepositoryCorsi,
    private readonly bus: PubblicatoreDiEventi,
  ) {}

  esegui(comando: comandi.RitiraCorso): void {
    const corsoId = CorsoId.da(comando.corsoId);
    const corso = this.corsi.perId(corsoId);
    if (corso === null) {
      throw new CorsoNonTrovato(`Corso ${comando.corsoId} inesistente.`);
    }

    corso.ritira();
    this.corsi.salva(corso);
    this.bus.pubblica(corso.eventiNonPubblicati());
    corso.svuotaEventi();
  }
}
