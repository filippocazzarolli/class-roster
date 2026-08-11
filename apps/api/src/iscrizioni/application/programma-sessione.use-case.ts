import { GeneratoreDiId } from '../../shared/domain/generatore-di-id';
import { Orologio } from '../../shared/domain/orologio';
import { PubblicatoreDiEventi } from '../../shared/domain/pubblicatore-di-eventi';
import { IstanteLocale } from '../../shared/domain/istante-locale';
import { CorsiPubblicati } from '../domain/ports/corsi-pubblicati';
import { RepositorySessioni } from '../domain/ports/repository-sessioni';
import { CorsoPubblicato, Sessione } from '../domain/sessione';
import { Capienza } from '../domain/value-objects/capienza';
import { Docente } from '../domain/value-objects/docente';
import { CorsoId, SessioneId } from '../domain/value-objects/identificativi';
import { Luogo } from '../domain/value-objects/luogo';
import * as comandi from './comandi';

/**
 * Programma una sessione — INV-2, INV-3 e il rifiuto di programmare nel passato.
 *
 * La verifica del corso pubblicato passa dalla porta `CorsiPubblicati`, cioè dalla
 * **replica locale** alimentata dall'ACL: `iscrizioni` non interroga mai il catalogo
 * (divieto 1). La consistenza è eventuale e auto-riparante — se il corso è stato
 * ritirato un istante fa, questa sessione nasce e la policy P2 la annulla subito dopo
 * (HS-8).
 *
 * Non usa `conRiprova`: crea un aggregato nuovo, quindi non c'è versione da contendere.
 */
export class ProgrammaSessioneUseCase {
  constructor(
    private readonly sessioni: RepositorySessioni,
    private readonly corsiPubblicati: CorsiPubblicati,
    private readonly orologio: Orologio,
    private readonly id: GeneratoreDiId,
    private readonly bus: PubblicatoreDiEventi,
  ) {}

  esegui(comando: comandi.ProgrammaSessione): { sessioneId: string } {
    const corsoId = CorsoId.da(comando.corsoId);
    const titolo = this.corsiPubblicati.titoloDi(corsoId);

    const corso: CorsoPubblicato | null =
      this.corsiPubblicati.ePubblicato(corsoId) && titolo !== null
        ? { corsoId, titolo }
        : null;

    const sessione = Sessione.programma(
      {
        id: SessioneId.da(this.id.genera()),
        inizio: IstanteLocale.da(comando.data, comando.oraInizio),
        luogo:
          comando.luogo.tipo === 'AULA'
            ? Luogo.aula(comando.luogo.nome)
            : Luogo.online(),
        docente: Docente.da(comando.docente),
        capienza: Capienza.da(comando.capienza),
      },
      corso,
      this.orologio.adesso(),
    );

    this.sessioni.salva(sessione);
    this.bus.pubblica(sessione.eventiNonPubblicati());
    sessione.svuotaEventi();

    return { sessioneId: sessione.id.valore };
  }
}
