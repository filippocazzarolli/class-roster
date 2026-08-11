import {
  EventoImbustato,
  HandlerDiEventi,
} from '../../../shared/event-bus/event-bus-in-process';
import { CorsiPubblicati } from '../../domain/ports/corsi-pubblicati';
import { CorsoId } from '../../domain/value-objects/identificativi';
import { TitoloCorso } from '../../domain/value-objects/titolo-corso';

/**
 * L'anticorruption layer di `iscrizioni` — HS-8, `domain.md` §2.7.
 *
 * ## I nomi degli eventi sono stringhe, non import
 *
 * Sembrerebbe più sicuro importare `NOMI_EVENTI_CATALOGO` dal catalogo. Sarebbe
 * l'inizio della fine: il divieto 1 (`domain.md` §2.9) vieta l'import fra contesti, e
 * «solo per le costanti» è l'eccezione con cui i due moduli tornano a essere uno.
 *
 * Il contratto è **il nome sul bus**, e come ogni contratto va scritto due volte e
 * verificato: il test di contratto di §4.9 importa entrambi i lati — i test sono
 * esentati dal divieto proprio per questo — e fallisce se divergono.
 */
export const EVENTI_CATALOGO_ASCOLTATI = {
  CORSO_PUBBLICATO: 'catalogo.CorsoPubblicato.v1',
  CORSO_RITIRATO: 'catalogo.CorsoRitirato.v1',
  DETTAGLI_MODIFICATI: 'catalogo.DettagliCorsoModificati.v1',
} as const;

interface VoceReplica {
  readonly titolo: string;
  readonly pubblicato: boolean;
}

/**
 * `iscrizioni_corsi_pubblicati` — la replica locale, e l'implementazione della porta
 * `CorsiPubblicati`.
 *
 * Non è una lettura del catalogo: è una **copia alimentata per evento**, e il dominio la
 * vede come una porta. La consistenza è eventuale e auto-riparante — fra il ritiro e
 * l'arrivo di questo aggiornamento esiste una finestra in cui `ePubblicato` risponde
 * ancora `true`, e la policy P2 ripara annullando le sessioni nate nel frattempo.
 */
export class ReplicaCorsiPubblicati
  extends CorsiPubblicati
  implements HandlerDiEventi
{
  readonly nome = 'AclCatalogo';
  readonly ascolta = Object.values(EVENTI_CATALOGO_ASCOLTATI);

  private readonly corsi = new Map<string, VoceReplica>();

  ePubblicato(corsoId: CorsoId): boolean {
    return this.corsi.get(corsoId.valore)?.pubblicato ?? false;
  }

  titoloDi(corsoId: CorsoId): TitoloCorso | null {
    const voce = this.corsi.get(corsoId.valore);
    return voce === undefined ? null : TitoloCorso.da(voce.titolo);
  }

  gestisci(evento: EventoImbustato): void {
    const corsoId = String(evento.payload.corsoId);
    const attuale = this.corsi.get(corsoId);

    switch (evento.nome) {
      case EVENTI_CATALOGO_ASCOLTATI.CORSO_PUBBLICATO:
        this.corsi.set(corsoId, {
          titolo: String(evento.payload.titolo),
          pubblicato: true,
        });
        break;

      case EVENTI_CATALOGO_ASCOLTATI.CORSO_RITIRATO:
        // Si conserva il titolo: le sessioni già programmate continuano a mostrarlo.
        this.corsi.set(corsoId, {
          titolo: attuale?.titolo ?? '',
          pubblicato: false,
        });
        break;

      case EVENTI_CATALOGO_ASCOLTATI.DETTAGLI_MODIFICATI:
        // Aggiorna il titolo **solo se il corso è già noto**: un corso in bozza non deve
        // comparire nella replica, o INV-2 si aprirebbe un varco.
        if (attuale !== undefined) {
          this.corsi.set(corsoId, {
            titolo: String(evento.payload.titolo),
            pubblicato: attuale.pubblicato,
          });
        }
        break;
    }
  }
}
