import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { Course, CreatedResponse } from '@repo/contracts';
import {
  CreaCorsoUseCase,
  ModificaDettagliCorsoUseCase,
  PubblicaCorsoUseCase,
  RitiraCorsoUseCase,
} from '../../application/use-case';
import { LettureCorsi } from '../../read-model/letture-corsi';
import { CreateCourseDto, UpdateCourseDto } from './dto';
import { aCourse } from './read-dto';

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
    private readonly letture: LettureCorsi,
  ) {}

  /**
   * R3 — `architecture.md` §4.5.
   *
   * L'elenco **non porta il conteggio delle sessioni programmate**: quel dato è di
   * `iscrizioni`, e comporlo qui costerebbe una riga e una foreign key fra moduli
   * (`domain.md` §2.9). Le due letture restano separate e si compongono nel frontend.
   *
   * Nessun filtro per stato: il responsabile deve vedere anche le bozze e i corsi
   * ritirati — è la sua vista di gestione, non una vetrina.
   */
  @Get()
  elencoCorsi(): Course[] {
    return this.letture.listaCorsi().map(aCourse);
  }

  @Post()
  creaCorso(@Body() dto: CreateCourseDto): CreatedResponse {
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
