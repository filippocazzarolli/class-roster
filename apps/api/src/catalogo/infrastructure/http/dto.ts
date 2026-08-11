import type {
  CreateCourseRequest,
  UpdateCourseRequest,
} from '@repo/contracts/courses';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

/**
 * I DTO delle rotte di `catalogo` — in inglese, tradotti nel controller.
 *
 * La **forma** dei corpi sta in `@repo/contracts`, ed è ciò che il frontend consuma; qui
 * restano i decoratori, che sono infrastruttura di validazione HTTP e non riguardano il
 * client. L'`implements` è il guardiano di quel patto: aggiungere un campo qui senza
 * dichiararlo nel contratto — o rinominarlo là senza toccare qui — non compila.
 */

export class CreateCourseDto implements CreateCourseRequest {
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
export class UpdateCourseDto
  extends CreateCourseDto
  implements UpdateCourseRequest {}
