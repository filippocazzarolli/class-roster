import { Body, Controller, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  CreaCorsoUseCase,
  ModificaDettagliCorsoUseCase,
  PubblicaCorsoUseCase,
  RitiraCorsoUseCase,
} from '../../application/use-case';
import { CreateCourseDto, UpdateCourseDto } from './dto';

/**
 * Le rotte di `catalogo` — `architecture.md` §4.6.
 *
 * `publish` e `withdraw` sono transizioni con un nome, non `PATCH { "state": "…" }`:
 * il ciclo di vita del corso è una decisione dell'aggregato, e l'URL non deve invitare
 * il client a proporla.
 *
 * Nessun prefisso di ruolo — niente `/api/admin/courses`. Non esiste autorizzazione, e
 * un prefisso che nomina chi chiama codificherebbe nell'URL un'informazione che non
 * riguarda la risorsa.
 */
@Controller('courses')
export class CoursesController {
  constructor(
    private readonly crea: CreaCorsoUseCase,
    private readonly modifica: ModificaDettagliCorsoUseCase,
    private readonly pubblica: PubblicaCorsoUseCase,
    private readonly ritira: RitiraCorsoUseCase,
  ) {}

  @Post()
  creaCorso(@Body() dto: CreateCourseDto): { id: string } {
    const { corsoId } = this.crea.esegui({
      titolo: dto.title,
      descrizione: dto.description,
      durataInOre: dto.durationHours,
      argomento: dto.topic,
    });

    return { id: corsoId };
  }

  @Patch(':id')
  @HttpCode(204)
  modificaDettagli(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ): void {
    this.modifica.esegui({
      corsoId: id,
      titolo: dto.title,
      descrizione: dto.description,
      durataInOre: dto.durationHours,
      argomento: dto.topic,
    });
  }

  @Post(':id/publish')
  @HttpCode(204)
  pubblicaCorso(@Param('id') id: string): void {
    this.pubblica.esegui({ corsoId: id });
  }

  /** Il ritiro fa scattare P2 sulle sessioni future — per evento, mai per chiamata. */
  @Post(':id/withdraw')
  @HttpCode(204)
  ritiraCorso(@Param('id') id: string): void {
    this.ritira.esegui({ corsoId: id });
  }
}
