# `apps/api` — l'implementazione

API dell'academy aziendale: catalogo dei corsi, sessioni a posti limitati, lista d'attesa.
NestJS 11, TypeScript in modalità `strict`, archivio **in memoria**.

Questo non è un servizio da mandare in produzione: è un **caso di studio di Domain Driven
Design**, e la struttura delle cartelle è il primo artefatto del modello. Ogni scelta di
layout qui dentro risponde a una domanda di dominio, non a una convenzione di framework —
e le domande, con le loro risposte lunghe, stanno in [`doc/`](../../doc).

Questo file spiega **dov'è ogni cosa e perché è lì**.

---

## Indice

- [Come si esegue](#come-si-esegue)
- [Le rotte](#le-rotte)
- [La mappa](#la-mappa)
- [Perché questa struttura](#perché-questa-struttura)
  - [1. Il primo livello sono i bounded context](#1-il-primo-livello-sono-i-bounded-context-non-gli-strati)
  - [2. Dentro ogni contesto, tre strati](#2-dentro-ogni-contesto-tre-strati)
  - [3. `shared/` non è un cestino](#3-shared-non-è-un-cestino)
- [La regola della dipendenza](#la-regola-della-dipendenza)
- [I guardiani](#i-guardiani)
- [Due lingue, un confine solo](#due-lingue-un-confine-solo)
- [Come sono organizzati i test](#come-sono-organizzati-i-test)
- [I capitoli di dettaglio](#i-capitoli-di-dettaglio)
- [Quello che non c'è ancora](#quello-che-non-cè-ancora)
- [Dove sta scritto il resto](#dove-sta-scritto-il-resto)

---

## Come si esegue

Dalla radice del monorepo, oppure da questa cartella:

```bash
pnpm dev            # nest start --watch, su http://localhost:3001
pnpm build          # nest build → dist/
pnpm test           # jest — tutte le suite sotto src/
pnpm test:e2e       # il percorso completo via HTTP, su un'app Nest vera
pnpm lint           # eslint, --max-warnings 0: i guardiani architetturali stanno qui
pnpm check-types    # tsc --noEmit
```

Tutte le rotte hanno prefisso `/api`. Non esiste autenticazione: **chi chiama si dichiara**
con l'header `X-Utente`, e il sistema gli crede.

```bash
curl -X POST http://localhost:3001/api/sessions/<id>/enrollments \
     -H 'X-Utente: mario@example.com'
```

Quell'header è l'**unico punto del sistema in cui l'identità entra**
([`shared/http/utente-corrente.ts`](src/shared/http/utente-corrente.ts)): l'email viene
normalizzata e trasformata in un UUID v5 deterministico. Il giorno in cui diventasse un SSO
vero, a cambiare sarebbe quel file e nient'altro — nessun controller, nessun caso d'uso,
nessun aggregato sa da dove arriva l'identità.

> Lo stato vive in memoria: **al riavvio il sistema è vuoto**, identità comprese.

## Le rotte

| Metodo   | Rotta                                | Cosa fa                                   |
| -------- | ------------------------------------ | ----------------------------------------- |
| `POST`   | `/api/courses`                       | Crea un corso in bozza                    |
| `PATCH`  | `/api/courses/:id`                   | Ne modifica i dettagli                    |
| `POST`   | `/api/courses/:id/publish`           | Lo pubblica                               |
| `POST`   | `/api/courses/:id/withdraw`          | Lo ritira → fa scattare **P2**            |
| `POST`   | `/api/sessions`                      | Programma una sessione                    |
| `PATCH`  | `/api/sessions/:id/capacity`         | Ne modifica la capienza                   |
| `POST`   | `/api/sessions/:id/cancel`           | La annulla                                |
| `POST`   | `/api/sessions/:id/enrollments`      | Iscrive **chi chiama** → `201` in ogni caso, con la posizione in coda |
| `DELETE` | `/api/sessions/:id/enrollments/me`   | Annulla **la propria** iscrizione         |

Due dettagli che sembrano di forma e sono di sostanza:

- **`publish`, `withdraw`, `cancel` sono transizioni con un nome**, non `PATCH { "state": … }`.
  Un URL che accetta lo stato desiderato invita il client a proporre la transizione
  successiva, e quella decisione spetta all'aggregato.
- **L'iscrizione risponde `201` sia a `ENROLLED` sia a `WAITLISTED`.** A posti esauriti non
  si viene respinti: si entra in coda. Un `409` sulla lista d'attesa sarebbe la traduzione
  HTTP di un errore che il dominio ha deliberatamente evitato di commettere. `position`
  accompagna solo il secondo caso, ed è un'unione discriminata anche nel DTO:
  `{ status: 'ENROLLED', position: 3 }` non è scrivibile.

## La mappa

```
src/
├── catalogo/                 ← bounded context: il ciclo di vita del corso (supporting)
│   ├── domain/                  ↳ capitolo dedicato: src/catalogo/README.md
│   ├── application/
│   └── infrastructure/
│
├── iscrizioni/               ← bounded context: posti, coda, annullamenti — il core
│   ├── domain/                  ↳ capitolo dedicato: src/iscrizioni/README.md
│   ├── application/
│   └── infrastructure/
│
├── shared/                   ← ciò che è davvero di tutti, e niente di più
│   ├── domain/                  ↳ capitolo dedicato: src/shared/README.md
│   ├── persistence/          ← la collezione in memoria con il controllo di versione
│   ├── event-bus/            ← il bus in-process
│   ├── http/                 ← filtro eccezioni, registro degli stati, utente corrente
│   └── infrastructure/       ← orologio di sistema, generatore di UUID
│
├── app.module.ts             ← il cablaggio: l'unico file che conosce tutti i moduli
└── main.ts                   ← prefisso /api e ValidationPipe
```

Le tre cartelle di primo livello hanno un capitolo tutto loro:
**[`iscrizioni/`](src/iscrizioni/README.md)**, **[`catalogo/`](src/catalogo/README.md)** e
**[`shared/`](src/shared/README.md)**.

## Perché questa struttura

### 1. Il primo livello sono i bounded context, non gli strati

La prima cartella che si apre non è `controllers/` né `services/`: è `catalogo/` o
`iscrizioni/`. Sono **due modelli distinti**, non due sottocartelle dello stesso.

La prova che siano davvero due sta in una parola che significa cose diverse ai due lati del
confine: **corso**. Per il catalogo è un contenuto con titolo, descrizione, durata,
argomento e un ciclo di vita — bozza, pubblicato, ritirato. Per le iscrizioni è due campi,
`corsoId` e `titolo`, copiati da una replica locale. Un modello unico dovrebbe accontentare
entrambe le letture e non riuscirebbe ad accontentarne nessuna.

Da qui la conseguenza dura, il **divieto di import fra contesti**: nessun file di
`iscrizioni/` importa da `catalogo/`, e viceversa. Si incontrano in due posti soltanto — sul
**bus degli eventi** e in `app.module.ts`, che li cabla.

Il prezzo è visibile e volutamente non nascosto: `TitoloCorso` esiste due volte, una per
contesto, e le due classi non sono identiche — quella del catalogo espone anche una forma
normalizzata (minuscolo, spazi compattati) perché lì serve a garantire che due corsi non
abbiano lo stesso titolo (`INV-1`); quella delle iscrizioni non ce l'ha, perché lì il titolo
è una copia per lo storico e quell'invariante non la riguarda. La duplicazione **è** il
confine: rimuoverla significherebbe rimuovere il confine.

### 2. Dentro ogni contesto, tre strati

```
contesto/
├── domain/           le regole. Nessun import di framework, nessun I/O, nessun orologio.
│   ├── <aggregato>.ts
│   ├── value-objects/
│   ├── errori.ts     i rifiuti — eccezioni, non eventi
│   ├── eventi.ts     i fatti accaduti — i nomi sul bus
│   └── ports/        le interfacce di ciò che serve al dominio, definite dal dominio
│
├── application/      i casi d'uso: orchestrano, non decidono.
│   ├── comandi.ts    oggetti comando, primitivi, in italiano
│   ├── *.use-case.ts carica → invoca l'aggregato → salva → pubblica
│   └── policy/       le reazioni agli eventi, espresse come casi d'uso
│
└── infrastructure/   il mondo esterno, tutto qui e da nessun'altra parte.
    ├── http/         controller, DTO in inglese, tabella eccezione → stato
    ├── persistence/  snapshot, mapper, repository
    ├── acl/          l'anticorruption layer (solo `iscrizioni`)
    └── event-handlers/
```

La riga che conta è la prima: **`domain/` non importa nulla**. Non `@nestjs/common`, non
`class-validator`, non l'archivio. Un aggregato che conosce il framework è un aggregato che
non si può più leggere come una descrizione del dominio, e non si può testare senza avviarlo.

Il caso più insidioso non è il framework, è il **tempo**. Se una regola come «si annulla fino
a 24 ore prima» leggesse `new Date()` da dentro l'aggregato, il test di quella regola
dipenderebbe da quando lo esegui. Qui l'istante corrente **arriva sempre come parametro**,
dalla porta `Orologio` — e una regola ESLint impedisce di dimenticarsene.

`ports/` è la cartella che rende possibile tutto questo: contiene le **classi astratte** che
il dominio usa (`RepositorySessioni`, `CorsiPubblicati`, `Orologio`, `GeneratoreDiId`,
`PubblicatoreDiEventi`). Le definisce chi ne ha bisogno, le implementa `infrastructure/`. È
il verso in cui punta la freccia — architettura esagonale, porte e adattatori — e in
`app.module.ts` quelle stesse classi astratte fanno da **token di iniezione**: chi dipende da
`RepositorySessioni` riceve l'implementazione in memoria senza mai saperlo.

### 3. `shared/` non è un cestino

Il criterio per entrare in `shared/` è stretto: **ciò che sarebbe identico in qualunque
dominio**. Date e ore come stringhe validate, la gerarchia degli errori, il controllo di
versione dell'archivio, il bus, il filtro delle eccezioni.

Ciò che entra non è mai un concetto di business. `Capienza` sta in `iscrizioni/`, non in
`shared/`, anche se «un numero maggiore di zero» sembrerebbe generico: generico è il vincolo,
non il significato. Il giorno in cui `shared/` contenesse `Sessione`, i due contesti sarebbero
tornati a essere uno.

Una nota su `shared/domain/istante-locale.ts`: data e ora sono **stringhe** (`YYYY-MM-DD`,
`HH:MM`), mai `Date`. Un `Date` porta con sé un fuso orario che qui non serve e che
introdurrebbe bug stagionali sull'ora legale; le stringhe in questo formato sono per
costruzione ordinabili lessicograficamente, che è tutto ciò che serve per confrontare due
istanti. Anche `menoOre(24)` è aritmetica intera pura, senza mai passare da `Date`.

## La regola della dipendenza

```
   HTTP ─┐
         ├─→  application  ─→  domain
   bus ──┘         │             ↑
                   └── porte ────┘   (definite dentro, implementate fuori)
```

| Da              | Può importare                       | Non può importare                              |
| --------------- | ----------------------------------- | ---------------------------------------------- |
| `domain`        | `shared/domain`                     | framework, `application`, `infrastructure`, l'altro contesto |
| `application`   | il proprio `domain`, `shared/domain` | `infrastructure`, l'altro contesto            |
| `infrastructure`| tutto ciò che sta nel proprio contesto | l'altro contesto                            |
| `shared`        | solo sé stesso                      | qualunque contesto                             |

L'unica eccezione, esplicita: **i test sono esentati dal divieto fra contesti**. Non è una
scorciatoia — osservano il sistema da fuori, ed è esattamente così che si verifica che i due
lati di un contratto coincidano
([`contratto-acl.spec.ts`](src/iscrizioni/infrastructure/acl/contratto-acl.spec.ts)).

## I guardiani

Le discipline che restano nella testa di chi scrive durano finché quella persona resta nel
progetto. Quelle qui sopra sono **eseguibili**, e stanno in
[`eslint.config.mjs`](eslint.config.mjs):

| Regola                 | Dove si applica              | Cosa impedisce                                        |
| ---------------------- | ---------------------------- | ----------------------------------------------------- |
| `no-restricted-imports`| `**/domain/**`               | import di `@nestjs/*`, `class-validator`, `infrastructure/`, `application/` |
| `no-restricted-imports`| `iscrizioni/**`, `catalogo/**` | import fra i due contesti                           |
| `no-restricted-syntax` | `**/domain/**`, `**/application/**` | `new Date()`, `Date.now()`                     |
| `no-restricted-syntax` | `**/domain/**`               | `Math.random()`                                       |

Insieme a queste, due **test di contratto** presidiano ciò che ESLint non può vedere:

- [`contratto-stati-http.spec.ts`](src/shared/http/contratto-stati-http.spec.ts) — enumera
  per riflessione ogni classe di errore esportata dai tre moduli e fallisce se una non ha
  uno stato HTTP dichiarato. Aggiungere un'eccezione senza mapparla rompe la suite, invece
  di produrre un `500` il giorno in cui quel rifiuto capita davvero.
- [`contratto-acl.spec.ts`](src/iscrizioni/infrastructure/acl/contratto-acl.spec.ts) —
  verifica che i nomi degli eventi che `iscrizioni` ascolta siano quelli che `catalogo`
  pubblica. Sono scritti due volte di proposito, perché il contratto è la stringa sul bus e
  non un import condiviso.

> ⚠️ In ESLint flat config le regole **non si fondono**: per un dato file vince l'ultimo
> blocco che definisce quella regola. Un file in `iscrizioni/domain/` corrisponde sia alla
> regola della dipendenza sia al divieto fra contesti, quindi i due insiemi di pattern sono
> **ricomposti esplicitamente** in un blocco dedicato. Separarli disattiverebbe il primo, in
> silenzio — è già successo, e il test negativo lo ha scoperto.

## Due lingue, un confine solo

Il dominio parla **italiano**, perché è la lingua in cui il committente ha descritto le
regole: `Sessione`, `Capienza`, `AnnullamentoFuoriTermine`, `iscrizioni.DipendentePromosso.v1`.
Tradurre «lista d'attesa» in `waitlist` dentro il modello significherebbe che ogni
conversazione con chi conosce il dominio passa da un dizionario.

Il confine HTTP parla **inglese**, perché è un'interfaccia tecnica: rotte, campi dei DTO,
`ENROLLED`, `WAITLISTED`.

La traduzione avviene **nel controller e in nessun altro punto**: `courseId` → `corsoId`,
`WAITLISTED` ← `IN_ATTESA`. Nessun caso d'uso e nessun aggregato ha mai visto una parola
inglese, nessun DTO ha mai visto una parola italiana. L'unica cosa che attraversa il confine
senza tradursi è il **nome dell'eccezione**, che compare in italiano nel campo `error` della
risposta — e lo fa apposta: è ciò che permette al frontend di distinguere i casi senza
interpretare la prosa del messaggio.

## Come sono organizzati i test

Quattro livelli, per costo crescente e per raggio decrescente:

| Livello | Dove                                          | Cosa verifica                                             |
| ------- | --------------------------------------------- | --------------------------------------------------------- |
| 1       | `*/domain/*.spec.ts`                          | le regole, su oggetti puri: niente Nest, niente archivio, orologio finto |
| 2       | `iscrizioni/application/use-case.spec.ts`     | l'orchestrazione, con doppi che si comportano come l'archivio vero |
| 3       | `*/infrastructure/persistence/*.spec.ts`, `shared/event-bus/*.spec.ts` | mapper, repository e bus: andata e ritorno, unicità, conflitti di versione, idempotenza |
| 4       | `test/*.e2e-spec.ts` (`pnpm test:e2e`)        | il percorso completo via HTTP, e il confine: header, campi non dichiarati, forma del corpo d'errore |

Trasversali ai livelli, i due **test di contratto** (`contratto-*.spec.ts`): non verificano un
comportamento ma un accordo — che ogni eccezione abbia uno stato HTTP, e che l'ACL parli la
lingua del catalogo, nomi **e** payload. Sono gli unici a cui è concesso importare entrambi i
lati di un confine.

Il livello 2 ha una regola non negoziabile che è costata un test rosso per essere imparata:
**i doppi del repository fanno snapshot come quello vero**. Un doppio che conserva il
riferimento all'aggregato rende `salva()` decorativo — la mutazione è già nell'archivio prima
ancora della chiamata — e i test passano per il motivo sbagliato.

## I capitoli di dettaglio

Questo README si ferma alla struttura. Chi vuole leggere il codice file per file trova due
approfondimenti:

| Capitolo | Cosa contiene |
| --- | --- |
| **[`src/iscrizioni/README.md`](src/iscrizioni/README.md)** | Il core domain, file per file: l'aggregato `Sessione` e i suoi quattro comandi, perché la promozione dalla coda sta **dentro** `annullaIscrizione` e non in una policy, i value object e le decisioni che li distinguono, la forma comune dei casi d'uso, l'ACL con la sua finestra di inconsistenza dichiarata, il percorso completo di una richiesta e la tabella «dove è presidiata ogni invariante» |
| **[`src/catalogo/README.md`](src/catalogo/README.md)** | Il supporting domain, e soprattutto **il contrasto con il core**: cosa cambia concretamente fra un dominio differenziante e uno amministrativo. Il ciclo di vita del corso e perché `RITIRATO` è terminale, `INV-1` come unica invariante che nessun aggregato può difendere, l'ordine delle tre operazioni dentro `salva`, e l'elenco di ciò che il catalogo deliberatamente non fa |
| **[`src/shared/README.md`](src/shared/README.md)** | Il criterio d'ingresso e cosa ne resta fuori; perché nel modello non esiste `Date`; la gerarchia degli errori; le due cose che il database faceva di nascosto e che ora sono scritte a mano (il clone difensivo e il vincolo di unicità); il bus e cosa si è perso togliendo l'outbox; il filtro delle eccezioni; e la tabella di cosa cambierebbe davvero il giorno del database |

## Quello che non c'è ancora

Dichiarato, non dimenticato:

- **Il read model** (`R1`/`R2`/`R3`) e le tre rotte `GET` di `architecture.md` §4.6.
  Le collezioni sono già provider a sé proprio perché le letture possano attingere agli
  snapshot senza passare dai repository.
- **Il contesto `notifiche`**: oggi gli eventi `SessioneAnnullata` e `DipendentePromosso`
  portano già con sé tutti i destinatari e tutti i dati per scrivere il messaggio, ma nessuno
  li ascolta. Finché non esiste, l'ultimo passo del percorso e2e — «e la notifica compare nel
  log» — resta l'unico non verificato.
- Un test per l'**esaurimento dei tentativi** di `con-riprova`
  (`ConflittoDiVersioneNonRisolto` → `503` con `Retry-After`).

## Dove sta scritto il resto

Questo README spiega il **come**. Il **perché**, con le alternative scartate e il prezzo di
ciascuna, sta in [`doc/`](../../doc):

| Documento                                       | Contiene                                                   |
| ----------------------------------------------- | ---------------------------------------------------------- |
| [`event-storming.md`](../../doc/event-storming.md) | i fatti del dominio, gli hotspot `HS-*`                  |
| [`domain.md`](../../doc/domain.md)              | il linguaggio ubiquo, la mappa dei contesti, i divieti      |
| [`aggregation.md`](../../doc/aggregation.md)    | gli aggregati e le invarianti `INV-1`…`INV-12`              |
| [`architecture.md`](../../doc/architecture.md)  | gli strati, gli eventi, la persistenza, i guardiani         |

I commenti nel codice citano quei documenti per sezione (`aggregation.md` §3.4, `INV-8`,
`HS-4`): sono riferimenti veri, non decorazioni.
