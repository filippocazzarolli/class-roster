import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type {
  CourseSession,
  CreatedResponse,
  OpenSession,
} from '@repo/contracts';
import { Orologio } from '../../../shared/domain/orologio';
import { Utente } from '../../../shared/http/utente-corrente';
// `import type` perché il tipo compare in una firma decorata: con emitDecoratorMetadata
// un import normale finirebbe nei metadati a runtime, e un'interfaccia lì non esiste.
import type { UtenteCorrente } from '../../../shared/http/utente-corrente';
import { AnnullaIscrizioneUseCase } from '../../application/annulla-iscrizione.use-case';
import { AnnullaSessioneUseCase } from '../../application/annulla-sessione.use-case';
import { IscrivitiUseCase } from '../../application/iscriviti.use-case';
import { ModificaCapienzaUseCase } from '../../application/modifica-capienza.use-case';
import { ProgrammaSessioneUseCase } from '../../application/programma-sessione.use-case';
import { LettureSessioni } from '../../read-model/letture-sessioni';
import { aCourseSession, aOpenSession } from './read-dto';
import {
  CancelSessionDto,
  ChangeCapacityDto,
  EnrollmentResultDto,
  ListSessionsQueryDto,
  ScheduleSessionDto,
} from './dto';

/**
 * Le rotte di `iscrizioni` — `architecture.md` §4.6.
 *
 * **Qui e solo qui avviene la traduzione** inglese → italiano: `courseId` diventa
 * `corsoId`, `WAITLISTED` nasce da `IN_ATTESA`. Nessun use case e nessun aggregato ha
 * mai visto una parola inglese.
 *
 * Le rotte sono **deliberatamente non CRUD** dove il dominio non è CRUD: `cancel` è una
 * transizione con un nome, non un `PATCH { state: … }` — che inviterebbe il client a
 * proporre la transizione successiva, decisione che spetta all'aggregato.
 */
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly programma: ProgrammaSessioneUseCase,
    private readonly modificaCapienza: ModificaCapienzaUseCase,
    private readonly annullaSessione: AnnullaSessioneUseCase,
    private readonly iscriviti: IscrivitiUseCase,
    private readonly annullaIscrizione: AnnullaIscrizioneUseCase,
    private readonly letture: LettureSessioni,
    private readonly orologio: Orologio,
  ) {}

  /**
   * R1 — `architecture.md` §4.5.
   *
   * `open` è un sottopercorso letterale e non un filtro (`?state=open`): «aperta» non è
   * uno stato della sessione, è la congiunzione di due condizioni — programmata e non
   * ancora iniziata — che il client non deve poter comporre a modo suo.
   *
   * L'istante corrente arriva dalla porta `Orologio` e viene **passato** alla lettura: è
   * il controller, che sta in infrastructure, a leggere il tempo. La lettura lo riceve, e
   * per questo è deterministica nei test.
   */
  @Get('open')
  sessioniAperte(): OpenSession[] {
    return this.letture
      .listaSessioniAperte(this.orologio.adesso())
      .map(aOpenSession);
  }

  /**
   * R4 — `architecture.md` §4.5.
   *
   * `courseId` è un **filtro opzionale**, e le due chiamate servono due viste di
   * `web-formazione`: senza filtro compone R3 — la vista catalogo chiama una volta e conta
   * per corso — con filtro è l'elenco della vista «programmazione sessioni».
   *
   * Dichiarata **dopo** `@Get('open')`: Nest confronta le rotte nell'ordine di
   * registrazione, e `open` è un percorso letterale che deve essere riconosciuto prima che
   * questa rotta più generica possa intercettarlo.
   *
   * Nessun `Orologio`: R4 non ha campi derivati dal tempo né filtri su di esso.
   */
  @Get()
  sessioniDelCorso(@Query() query: ListSessionsQueryDto): CourseSession[] {
    return this.letture.listaSessioni(query.courseId).map(aCourseSession);
  }

  @Post()
  programmaSessione(@Body() dto: ScheduleSessionDto): CreatedResponse {
    const { sessioneId } = this.programma.esegui({
      corsoId: dto.courseId,
      data: dto.date,
      oraInizio: dto.startTime,
      luogo:
        dto.place.type === 'AULA'
          ? { tipo: 'AULA', nome: dto.place.name ?? '' }
          : { tipo: 'ONLINE' },
      docente: dto.teacher,
      capienza: dto.capacity,
    });

    return { id: sessioneId };
  }

  @Patch(':id/capacity')
  @HttpCode(204)
  async cambiaCapienza(
    @Param('id') id: string,
    @Body() dto: ChangeCapacityDto,
  ): Promise<void> {
    await this.modificaCapienza.esegui({
      sessioneId: id,
      capienza: dto.capacity,
    });
  }

  @Post(':id/cancel')
  @HttpCode(204)
  async annulla(
    @Param('id') id: string,
    @Body() dto: CancelSessionDto,
  ): Promise<void> {
    await this.annullaSessione.esegui({ sessioneId: id, motivo: dto.reason });
  }

  /**
   * Nessun corpo con l'identificativo del dipendente: viene dall'`UtenteCorrente`.
   *
   * Risponde **201 in entrambi i casi**, perché entrambi sono successi. Un 409 per la
   * lista d'attesa sarebbe la traduzione HTTP dell'errore che il dominio ha evitato.
   *
   * `position` accompagna solo `WAITLISTED`: chi è in coda ha diritto di sapere quanti
   * ha davanti, chi è iscritto non è in nessuna coda (`architecture.md` §4.6).
   */
  @Post(':id/enrollments')
  async iscrivi(
    @Param('id') id: string,
    @Utente() utente: UtenteCorrente,
  ): Promise<EnrollmentResultDto> {
    const risultato = await this.iscriviti.esegui({
      sessioneId: id,
      dipendenteId: utente.id,
      email: utente.email,
    });

    return risultato.esito === 'ISCRITTO'
      ? { status: 'ENROLLED' }
      : { status: 'WAITLISTED', position: risultato.posizione };
  }

  /**
   * `me` al posto di un parametro, ed è metà della difesa di INV-9 (HS-11): un attacco
   * non ha nulla da manomettere perché non c'è alcun campo da manomettere.
   */
  @Delete(':id/enrollments/me')
  @HttpCode(204)
  async disiscrivi(
    @Param('id') id: string,
    @Utente() utente: UtenteCorrente,
  ): Promise<void> {
    await this.annullaIscrizione.esegui({
      sessioneId: id,
      dipendenteId: utente.id,
    });
  }
}
