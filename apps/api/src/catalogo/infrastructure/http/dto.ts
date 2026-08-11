import { IsInt, IsString, Length, Max, Min } from 'class-validator';

/** I DTO delle rotte di `catalogo` — in inglese, tradotti nel controller. */

export class CreateCourseDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsString()
  @Length(1, 2000)
  description!: string;

  @IsInt()
  @Min(1)
  @Max(200)
  durationHours!: number;

  @IsString()
  @Length(1, 100)
  topic!: string;
}

/**
 * La modifica richiede **tutti** i campi, come la creazione.
 *
 * Non è un `PATCH` parziale per comodità di chi chiama: `modificaDettagli` sostituisce i
 * dettagli in blocco, e un DTO con campi opzionali suggerirebbe una semantica di merge
 * che l'aggregato non ha. Il metodo HTTP resta `PATCH` perché modifica una parte della
 * risorsa — lo stato del corso non si tocca da qui.
 */
export class UpdateCourseDto extends CreateCourseDto {}
