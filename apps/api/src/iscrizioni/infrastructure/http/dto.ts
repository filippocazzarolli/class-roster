import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/**
 * I DTO delle rotte di `iscrizioni` — **in inglese**, mentre il dominio è in italiano.
 * La traduzione avviene nel controller e in nessun altro punto (`architecture.md` §4.6).
 *
 * La validazione qui **non è ridondante** rispetto ai value object: «questa richiesta
 * HTTP è ben formata?» e «questo valore può esistere nel mio dominio?» sono domande
 * distinte. Cancellare la `ValidationPipe` deve lasciare il dominio altrettanto sicuro,
 * solo con messaggi peggiori.
 */

/**
 * `Luogo` nel dominio è una **somma di due casi** — `Aula(nome) | Online` — e il DTO deve
 * dire la stessa cosa: il nome è richiesto per `AULA` e non deve comparire per `ONLINE`.
 *
 * Senza `@ValidateIf` i decoratori si applicherebbero comunque, e una sessione online
 * verrebbe rifiutata con «name must be a string» — un vincolo che il modello non ha.
 */
export class PlaceDto {
  @IsIn(['AULA', 'ONLINE'])
  type!: 'AULA' | 'ONLINE';

  @ValidateIf((dto: PlaceDto) => dto.type === 'AULA')
  @IsString()
  @Length(1, 100)
  name?: string;
}

export class ScheduleSessionDto {
  @IsString()
  @IsNotEmpty()
  courseId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date deve essere YYYY-MM-DD' })
  date!: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime deve essere HH:MM' })
  startTime!: string;

  @ValidateNested()
  @Type(() => PlaceDto)
  place!: PlaceDto;

  @IsString()
  @Length(1, 200)
  teacher!: string;

  @IsInt()
  @Min(1)
  capacity!: number;
}

export class ChangeCapacityDto {
  @IsInt()
  @Min(1)
  capacity!: number;
}

export class CancelSessionDto {
  @IsIn(['DECISIONE_RESPONSABILE', 'CORSO_RITIRATO'])
  reason!: 'DECISIONE_RESPONSABILE' | 'CORSO_RITIRATO';
}

/**
 * **L'iscrizione non ha un corpo con l'identificativo del dipendente**: quello arriva
 * dall'`UtenteCorrente`. INV-9 non è manomettibile perché non c'è nulla da manomettere
 * (`aggregation.md` §3.9) — ed è per questo che qui non esiste un `EnrollDto`.
 */

/**
 * I due esiti dell'iscrizione, entrambi `201`: a posti esauriti non si viene respinti.
 *
 * Unione discriminata e non un campo opzionale: `position` esiste **se e solo se** si è
 * finiti in coda, e `{ status: 'ENROLLED', position: 3 }` non deve essere scrivibile
 * (`architecture.md` §4.6).
 */
export type EnrollmentResultDto =
  | { readonly status: 'ENROLLED' }
  | { readonly status: 'WAITLISTED'; readonly position: number };
