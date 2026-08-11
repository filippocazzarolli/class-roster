import { Module, OnModuleInit } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import {
  CreaCorsoUseCase,
  ModificaDettagliCorsoUseCase,
  PubblicaCorsoUseCase,
  RitiraCorsoUseCase,
} from './catalogo/application/use-case';
import { RepositoryCorsi } from './catalogo/domain/ports/repository-corsi';
import { CoursesController } from './catalogo/infrastructure/http/courses.controller';
import { STATI_HTTP_CATALOGO } from './catalogo/infrastructure/http/stati-http.catalogo';
import {
  CorsiInMemoria,
  IndiceTitoliCorsi,
  RepositoryCorsiInMemoria,
} from './catalogo/infrastructure/persistence/repository-corsi.in-memoria';
import { LettureCorsi } from './catalogo/read-model/letture-corsi';
import { LettureCorsiInMemoria } from './catalogo/read-model/letture-corsi.in-memoria';

import { AnnullaIscrizioneUseCase } from './iscrizioni/application/annulla-iscrizione.use-case';
import { AnnullaSessioneUseCase } from './iscrizioni/application/annulla-sessione.use-case';
import { IscrivitiUseCase } from './iscrizioni/application/iscriviti.use-case';
import { ModificaCapienzaUseCase } from './iscrizioni/application/modifica-capienza.use-case';
import { AnnullaSessioniCorsoRitiratoPolicy } from './iscrizioni/application/policy/annulla-sessioni-corso-ritirato.policy';
import { ProgrammaSessioneUseCase } from './iscrizioni/application/programma-sessione.use-case';
import { CorsiPubblicati } from './iscrizioni/domain/ports/corsi-pubblicati';
import { RepositorySessioni } from './iscrizioni/domain/ports/repository-sessioni';
import { ReplicaCorsiPubblicati } from './iscrizioni/infrastructure/acl/replica-corsi-pubblicati';
import { HandlerCorsoRitirato } from './iscrizioni/infrastructure/event-handlers/corso-ritirato.handler';
import { EnrollmentsController } from './iscrizioni/infrastructure/http/enrollments.controller';
import { SessionsController } from './iscrizioni/infrastructure/http/sessions.controller';
import { STATI_HTTP_ISCRIZIONI } from './iscrizioni/infrastructure/http/stati-http.iscrizioni';
import {
  RepositorySessioniInMemoria,
  SessioniInMemoria,
} from './iscrizioni/infrastructure/persistence/repository-sessioni.in-memoria';
import { LettureSessioni } from './iscrizioni/read-model/letture-sessioni';
import { LettureSessioniInMemoria } from './iscrizioni/read-model/letture-sessioni.in-memoria';

import { EventBusInProcess } from './shared/event-bus/event-bus-in-process';
import { GeneratoreDiId } from './shared/domain/generatore-di-id';
import { Orologio } from './shared/domain/orologio';
import { PubblicatoreDiEventi } from './shared/domain/pubblicatore-di-eventi';
import { FiltroEccezioniDiDominio } from './shared/http/filtro-eccezioni';
import { RegistroStatiHttp } from './shared/http/registro-stati-http';
import { STATI_HTTP_SHARED } from './shared/http/stati-http.shared';
import { GeneratoreDiUuid } from './shared/infrastructure/generatore-di-uuid';
import { OrologioDiSistema } from './shared/infrastructure/orologio-di-sistema';

/**
 * Il cablaggio — l'unico file che conosce tutti i moduli.
 *
 * I due bounded context non si importano fra loro (divieto 1): si incontrano soltanto
 * qui e sul bus. Questo file è il prezzo di quel divieto, ed è un prezzo che si paga una
 * volta sola, in un posto visibile.
 *
 * Le porte sono usate come **token di iniezione**: chi dipende da `RepositorySessioni`
 * riceve l'implementazione in memoria senza saperlo. Sostituirla con una su database
 * significherebbe cambiare una riga, in questo file.
 *
 * Le letture sono cablate **sulle collezioni, non sui repository**: `LettureSessioni`
 * riceve `SessioniInMemoria` e `LettureCorsi` riceve `CorsiInMemoria`. È qui che la
 * disciplina di §4.5 diventa una dipendenza dichiarata invece di una buona intenzione —
 * il read model non ha modo di raggiungere un aggregato perché non gli è stato dato.
 */
@Module({
  controllers: [CoursesController, SessionsController, EnrollmentsController],
  providers: [
    // ─── Archivio ───────────────────────────────────────────────────────────
    SessioniInMemoria,
    CorsiInMemoria,
    IndiceTitoliCorsi,

    // ─── Adapter delle porte trasversali ────────────────────────────────────
    { provide: Orologio, useClass: OrologioDiSistema },
    { provide: GeneratoreDiId, useClass: GeneratoreDiUuid },
    {
      provide: EventBusInProcess,
      useFactory: (id: GeneratoreDiId, orologio: Orologio) =>
        new EventBusInProcess(id, orologio),
      inject: [GeneratoreDiId, Orologio],
    },
    { provide: PubblicatoreDiEventi, useExisting: EventBusInProcess },

    // ─── Repository ─────────────────────────────────────────────────────────
    {
      provide: RepositorySessioni,
      useFactory: (sessioni: SessioniInMemoria) =>
        new RepositorySessioniInMemoria(sessioni),
      inject: [SessioniInMemoria],
    },
    {
      provide: RepositoryCorsi,
      useFactory: (corsi: CorsiInMemoria, indice: IndiceTitoliCorsi) =>
        new RepositoryCorsiInMemoria(corsi, indice),
      inject: [CorsiInMemoria, IndiceTitoliCorsi],
    },

    // ─── Read model: legge le collezioni, non i repository (§4.5) ───────────
    {
      provide: LettureSessioni,
      useFactory: (sessioni: SessioniInMemoria) =>
        new LettureSessioniInMemoria(sessioni),
      inject: [SessioniInMemoria],
    },
    {
      provide: LettureCorsi,
      useFactory: (corsi: CorsiInMemoria) => new LettureCorsiInMemoria(corsi),
      inject: [CorsiInMemoria],
    },

    // ─── ACL: la replica è insieme una porta del dominio e un handler del bus ─
    ReplicaCorsiPubblicati,
    { provide: CorsiPubblicati, useExisting: ReplicaCorsiPubblicati },

    // ─── Use case: iscrizioni ───────────────────────────────────────────────
    {
      provide: ProgrammaSessioneUseCase,
      useFactory: (
        sessioni: RepositorySessioni,
        corsi: CorsiPubblicati,
        orologio: Orologio,
        id: GeneratoreDiId,
        bus: PubblicatoreDiEventi,
      ) => new ProgrammaSessioneUseCase(sessioni, corsi, orologio, id, bus),
      inject: [
        RepositorySessioni,
        CorsiPubblicati,
        Orologio,
        GeneratoreDiId,
        PubblicatoreDiEventi,
      ],
    },
    {
      provide: IscrivitiUseCase,
      useFactory: (
        sessioni: RepositorySessioni,
        orologio: Orologio,
        bus: PubblicatoreDiEventi,
      ) => new IscrivitiUseCase(sessioni, orologio, bus),
      inject: [RepositorySessioni, Orologio, PubblicatoreDiEventi],
    },
    {
      provide: AnnullaIscrizioneUseCase,
      useFactory: (
        sessioni: RepositorySessioni,
        orologio: Orologio,
        bus: PubblicatoreDiEventi,
      ) => new AnnullaIscrizioneUseCase(sessioni, orologio, bus),
      inject: [RepositorySessioni, Orologio, PubblicatoreDiEventi],
    },
    {
      provide: ModificaCapienzaUseCase,
      useFactory: (
        sessioni: RepositorySessioni,
        orologio: Orologio,
        bus: PubblicatoreDiEventi,
      ) => new ModificaCapienzaUseCase(sessioni, orologio, bus),
      inject: [RepositorySessioni, Orologio, PubblicatoreDiEventi],
    },
    {
      provide: AnnullaSessioneUseCase,
      useFactory: (sessioni: RepositorySessioni, bus: PubblicatoreDiEventi) =>
        new AnnullaSessioneUseCase(sessioni, bus),
      inject: [RepositorySessioni, PubblicatoreDiEventi],
    },
    {
      provide: AnnullaSessioniCorsoRitiratoPolicy,
      useFactory: (
        sessioni: RepositorySessioni,
        annulla: AnnullaSessioneUseCase,
        orologio: Orologio,
      ) => new AnnullaSessioniCorsoRitiratoPolicy(sessioni, annulla, orologio),
      inject: [RepositorySessioni, AnnullaSessioneUseCase, Orologio],
    },
    {
      provide: HandlerCorsoRitirato,
      useFactory: (policy: AnnullaSessioniCorsoRitiratoPolicy) =>
        new HandlerCorsoRitirato(policy),
      inject: [AnnullaSessioniCorsoRitiratoPolicy],
    },

    // ─── Use case: catalogo ─────────────────────────────────────────────────
    {
      provide: CreaCorsoUseCase,
      useFactory: (
        corsi: RepositoryCorsi,
        id: GeneratoreDiId,
        bus: PubblicatoreDiEventi,
      ) => new CreaCorsoUseCase(corsi, id, bus),
      inject: [RepositoryCorsi, GeneratoreDiId, PubblicatoreDiEventi],
    },
    {
      provide: ModificaDettagliCorsoUseCase,
      useFactory: (corsi: RepositoryCorsi, bus: PubblicatoreDiEventi) =>
        new ModificaDettagliCorsoUseCase(corsi, bus),
      inject: [RepositoryCorsi, PubblicatoreDiEventi],
    },
    {
      provide: PubblicaCorsoUseCase,
      useFactory: (corsi: RepositoryCorsi, bus: PubblicatoreDiEventi) =>
        new PubblicaCorsoUseCase(corsi, bus),
      inject: [RepositoryCorsi, PubblicatoreDiEventi],
    },
    {
      provide: RitiraCorsoUseCase,
      useFactory: (corsi: RepositoryCorsi, bus: PubblicatoreDiEventi) =>
        new RitiraCorsoUseCase(corsi, bus),
      inject: [RepositoryCorsi, PubblicatoreDiEventi],
    },

    // ─── HTTP ───────────────────────────────────────────────────────────────
    {
      provide: RegistroStatiHttp,
      useFactory: () =>
        new RegistroStatiHttp()
          .registra(STATI_HTTP_SHARED)
          .registra(STATI_HTTP_ISCRIZIONI)
          .registra(STATI_HTTP_CATALOGO),
    },
    {
      provide: APP_FILTER,
      useFactory: (registro: RegistroStatiHttp) =>
        new FiltroEccezioniDiDominio(registro),
      inject: [RegistroStatiHttp],
    },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly bus: EventBusInProcess,
    private readonly acl: ReplicaCorsiPubblicati,
    private readonly corsoRitirato: HandlerCorsoRitirato,
  ) {}

  /**
   * **L'ordine di queste due righe è una decisione di dominio, non di cablaggio.**
   *
   * Prima l'ACL aggiorna la replica, poi la policy annulla le sessioni future: è la
   * condizione perché la finestra di inconsistenza di HS-8 resti auto-riparante. È il
   * tipo di dipendenza che si dimentica in sei mesi — `domain.md` §2.7.
   */
  onModuleInit(): void {
    this.bus.sottoscrivi(this.acl);
    this.bus.sottoscrivi(this.corsoRitirato);
  }
}
