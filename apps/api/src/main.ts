import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  /**
   * Risponde alla domanda «questa richiesta HTTP è ben formata?», che è diversa da
   * «questo valore può esistere nel mio dominio?» — a cui rispondono i value object
   * (`architecture.md` §4.2).
   *
   * `whitelist` e `forbidNonWhitelisted` scartano i campi non dichiarati invece di
   * ignorarli: un client che invia `employeeId` a `POST /enrollments` deve ricevere un
   * rifiuto esplicito, non il silenzio di un campo scartato senza dirlo.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
