import { Controller, Get } from '@nestjs/common';
import type { MyEnrollment } from '@repo/contracts';
import { Orologio } from '../../../shared/domain/orologio';
import { Utente } from '../../../shared/http/utente-corrente';
// `import type` perché il tipo compare in una firma decorata: con emitDecoratorMetadata
// un import normale finirebbe nei metadati a runtime, e un'interfaccia lì non esiste.
import type { UtenteCorrente } from '../../../shared/http/utente-corrente';
import { LettureSessioni } from '../../read-model/letture-sessioni';
import { aMyEnrollment } from './read-dto';

/**
 * R2 — `GET /api/enrollments/me`, `architecture.md` §4.5 e §4.6.
 *
 * **Un controller a sé, e non un `@Get('mine')` dentro `SessionsController`.** La risorsa
 * qui è l'iscrizione, non la sessione: l'elenco attraversa tutte le sessioni e ne
 * seleziona una per volta, quindi non è un sottoinsieme di `/sessions`. Restano nello
 * stesso modulo — l'iscrizione è un'entità interna alla `Sessione` — e questo è l'unico
 * punto in cui compare come risorsa HTTP a sé stante.
 *
 * `me` al posto di un parametro, come in `DELETE /sessions/:id/enrollments/me`: non
 * esiste modo di chiedere le iscrizioni di un altro, perché non c'è alcun campo da
 * manomettere (INV-9, HS-11).
 */
@Controller('enrollments')
export class EnrollmentsController {
  constructor(
    private readonly letture: LettureSessioni,
    private readonly orologio: Orologio,
  ) {}

  @Get('me')
  mieIscrizioni(@Utente() utente: UtenteCorrente): MyEnrollment[] {
    return this.letture
      .listaMieIscrizioni(utente.id, this.orologio.adesso())
      .map(aMyEnrollment);
  }
}
