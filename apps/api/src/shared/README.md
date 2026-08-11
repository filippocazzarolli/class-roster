# `shared/` — ciò che è di tutti

> Capitolo di dettaglio del [README di `apps/api`](../../README.md).

Una cartella `shared/` è il posto in cui un progetto marcisce più in fretta. Comincia con due
utilità innocue, e finisce per contenere il modello: a quel punto i bounded context sono
tornati a essere uno, e nessuno se n'è accorto perché è successo una funzione alla volta.

Qui il criterio d'ingresso è dichiarato e stretto:

> **Entra in `shared/` ciò che sarebbe identico in un dominio qualunque.**
> Un concetto di business non entra, nemmeno se lo usano entrambi i contesti.

`Capienza` sta in `iscrizioni/`, benché «un intero maggiore di zero» sembri generico: generico
è il vincolo, non il significato. `Sessione` e `Corso` non compariranno mai qui. Ciò che c'è —
date senza fuso, una gerarchia di errori, un controllo di versione, un bus — sarebbe scritto
uguale per un gestionale di magazzino.

C'è anche una conseguenza in negativo, e vale la pena renderla esplicita: **`shared/` non
conosce i contesti**. Non un import di `iscrizioni/` o `catalogo/` in tutta la cartella. Il
punto in cui questo si vede meglio è il registro degli stati HTTP: sarebbe stato naturale
scriverci dentro la tabella completa delle eccezioni, e sarebbe stato il punto in cui i due
contesti si incontrano di nascosto. Invece il registro è **vuoto per costruzione** e ogni
contesto ci registra le proprie righe.

---

## Indice

- [La mappa](#la-mappa)
- [`domain/` — le primitive e le porte](#domain--le-primitive-e-le-porte)
  - [Il tempo: tre file e una scelta](#il-tempo-tre-file-e-una-scelta)
  - [`errori.ts` — la gerarchia dei rifiuti](#errorits--la-gerarchia-dei-rifiuti)
  - [`evento-di-dominio.ts` — il fatto senza busta](#evento-di-dominiots--il-fatto-senza-busta)
  - [Le tre porte trasversali](#le-tre-porte-trasversali)
- [`persistence/` — il sostituto del database](#persistence--il-sostituto-del-database)
- [`event-bus/` — la consegna](#event-bus--la-consegna)
- [`http/` — il confine](#http--il-confine)
- [`infrastructure/` — dove l'impurità è confinata](#infrastructure--dove-limpurità-è-confinata)
- [Il giorno del database](#il-giorno-del-database)

---

## La mappa

```
shared/
├── domain/                    ← nessun import, nemmeno di Nest
│   ├── data-locale.ts         YYYY-MM-DD, validata a mano
│   ├── ora-locale.ts          HH:MM
│   ├── istante-locale.ts      data + ora, e l'aritmetica di menoOre()
│   ├── errori.ts              ErroreDiDominio e i tre errori trasversali
│   ├── evento-di-dominio.ts   il fatto, senza busta
│   ├── orologio.ts            ┐
│   ├── generatore-di-id.ts    ├ le tre porte che ogni contesto usa
│   └── pubblicatore-di-eventi.ts ┘
│
├── persistence/
│   ├── tipi.ts                DataConservata, OraConservata, Versionato
│   ├── collezione-in-memoria.ts  la mappa con il check-and-set
│   └── indice-unico.ts        il sostituto del vincolo UNIQUE
│
├── event-bus/
│   └── event-bus-in-process.ts   busta, ordine, idempotenza
│
├── http/
│   ├── utente-corrente.ts     l'unico punto in cui entra l'identità
│   ├── registro-stati-http.ts la tabella, costruita a pezzi
│   ├── stati-http.shared.ts   le righe delle eccezioni trasversali
│   ├── filtro-eccezioni.ts    l'unico posto che conosce i codici di stato
│   └── contratto-stati-http.spec.ts
│
└── infrastructure/
    ├── orologio-di-sistema.ts    l'unico new Date() del progetto
    └── generatore-di-uuid.ts     l'unica sorgente di casualità
```

---

## `domain/` — le primitive e le porte

### Il tempo: tre file e una scelta

**Nel modello non esiste `Date`.** Non è una preferenza stilistica: è la decisione che
protegge tutte le regole che dipendono dal tempo.

Un `Date` porta con sé un fuso orario che questo dominio non ha. Una sessione «il 10 settembre
alle 09:00» è un fatto del calendario locale, non un istante assoluto sulla linea del tempo:
non cambia se chi legge è a Milano o a Tokyo, e non deve spostarsi di un'ora quando scatta
l'ora legale. Modellarla come `Date` avrebbe introdotto bug stagionali — il tipo di difetto
che si manifesta l'ultima domenica di ottobre.

| File | Cosa rappresenta | Come |
| --- | --- | --- |
| `data-locale.ts` | `YYYY-MM-DD` | Stringa validata, con il conteggio dei giorni del mese e gli anni bisestili calcolati a mano |
| `ora-locale.ts` | `HH:MM` | Stringa validata, `ore ≤ 23`, `minuti ≤ 59` |
| `istante-locale.ts` | data + ora | Composizione dei due, più i confronti e `menoOre` |

Il formato non è scelto a caso: `YYYY-MM-DD` e `HH:MM` sono **lessicograficamente ordinabili**,
quindi `"2026-09-10" < "2026-09-11"` è al tempo stesso un confronto fra stringhe e un confronto
fra date. Da questa proprietà discende gratis l'ordinamento delle liste e il filtro «sessioni
future» del repository, che confronta stringhe senza costruire nulla.

`menoOre(n)` è il metodo che rende esprimibile «inizio − 24h» di `INV-10`. Attraversa i confini
di giorno, mese e anno con **aritmetica intera pura**, usando l'algoritmo di conversione in
giorni-epoch di Howard Hinnant:

```ts
const minutiTotali =
  aGiorniEpoch(anno, mese, giorno) * MINUTI_AL_GIORNO + oreCorrenti * 60 + minuti - ore * 60;
```

Trenta righe di calendario scritte a mano invece di una dipendenza o di un `Date`. Il costo è
visibile una volta sola; il beneficio è che il dominio non ha alcun modo di conoscere un fuso
orario, nemmeno per sbaglio.

### `errori.ts` — la gerarchia dei rifiuti

```
ErroreDiDominio (astratta)
├── ValoreNonValido                  → 400
├── ConflittoDiVersione              → non attraversa mai HTTP
└── ConflittoDiVersioneNonRisolto    → 503 + Retry-After: 1
```

`ErroreDiDominio` fa una cosa sola e la fa in una riga:

```ts
this.name = new.target.name;
```

È ciò che permette al filtro HTTP di restituire `IscrizioneDuplicata` nel campo `error` senza
che nessuno scriva quella stringa a mano da qualche parte. Il nome della classe **è** il codice
d'errore dell'API.

I tre discendenti diretti sono i soli errori trasversali, e ciascuno racconta qualcosa:

**`ValoreNonValido`** — lo solleva un value object quando rifiuta il valore con cui lo si vuole
costruire. Sul percorso HTTP è **irraggiungibile**, perché la `ValidationPipe` intercetta
prima: esiste per i comandi che arrivano da un test, da una policy o da un handler. È la prova
che la doppia validazione non è ridondanza — il dominio si difende anche quando HTTP non c'è.

**`ConflittoDiVersione`** — l'unica eccezione di dominio che **non ha uno stato HTTP
dichiarato**, e a ragione: la intercetta `con-riprova` e non arriva mai al chiamante. Il test
di contratto la esclude esplicitamente, con il commento che spiega perché — se un giorno
comparisse in una risposta, sarebbe un difetto dell'application service, non una riga mancante
nella tabella.

**`ConflittoDiVersioneNonRisolto`** — `503`, non `409`. La distinzione è di significato: è un
fallimento **tecnico e ritentabile**, mentre un rifiuto di dominio è definitivo. Al client
conviene riprovare, non cambiare richiesta — ed è quello che dice l'header `Retry-After`.

### `evento-di-dominio.ts` — il fatto senza busta

```ts
export interface EventoDiDominio {
  readonly nome: string;
  readonly aggregateId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}
```

Tre campi, e soprattutto **due che non ci sono**: `eventId` e `occorsoIl`. Sono la busta, e la
chiude il bus.

Se li aggiungesse l'aggregato, ogni metodo che emette un evento avrebbe bisogno di
`GeneratoreDiId` e `Orologio` — due porte in più, iniettate ovunque, per due dati che il
dominio non usa mai per decidere. Il confine è preciso: **il dominio dichiara cosa è
accaduto, l'infrastruttura dichiara quando e con quale identificativo lo ha consegnato.**

### Le tre porte trasversali

| Porta | Astrae | Perché è una porta |
| --- | --- | --- |
| `Orologio` | `adesso(): IstanteLocale` | `INV-6` e `INV-10` dipendono dal tempo. Con `new Date()` dentro l'aggregato, il test della regola delle 24 ore dipenderebbe da quando lo esegui |
| `GeneratoreDiId` | `genera(): string` | Identificativi deterministici nei test: nelle suite il generatore è un contatore e le asserzioni restano leggibili |
| `PubblicatoreDiEventi` | `pubblica(eventi)` | Il caso d'uso pubblica senza sapere che dietro c'è un bus in-process — domani una coda vera |

Sono **classi astratte**, non interfacce, e non per gusto: TypeScript cancella le interfacce in
compilazione, mentre una classe sopravvive a runtime e può fare da **token di iniezione** in
NestJS. È ciò che permette a `app.module.ts` di scrivere `{ provide: Orologio, useClass:
OrologioDiSistema }` senza inventare stringhe magiche o simboli.

I nomi sono in italiano perché compaiono nelle firme dei metodi di dominio, e si leggono
insieme alle regole: `iscrivi(dipendenteId, email, adesso)` si legge come una frase.

---

## `persistence/` — il sostituto del database

Questa cartella è la risposta alla domanda «se togliamo il database, cosa resta da fare
esplicitamente?». La risposta è: **due cose, ed erano entrambe nascoste dentro SQL.**

### `collezione-in-memoria.ts` — il check-and-set

Una `Map<string, S>` di snapshot, con due proprietà che valgono più del contenitore.

**1. Entra e esce sempre una copia.**

```ts
perId(id: string): S | null {
  const trovato = this.elementi.get(id);
  return trovato === undefined ? null : structuredClone(trovato);
}
```

Non è prudenza eccessiva. Senza il clone, chi ottiene uno snapshot può mutarlo e vedere la
mutazione comparire nell'archivio **senza aver chiamato `salva`**. È l'aliasing che rende
`salva()` una chiamata decorativa — con l'aggravante di essere invisibile, perché il sistema
continua a funzionare e i test a passare per il motivo sbagliato.

Un database non ha questo problema perché la serializzazione lo risolve per conto suo. Toglierlo
significa riprodurne l'effetto a mano, ed è esattamente ciò che questa riga fa.

**2. Il lock ottimistico, per esteso.**

```ts
salva(id: string, snapshot: S, versioneLetta: number): void {
  const attuale = this.elementi.get(id);
  if (attuale !== undefined && attuale.versione !== versioneLetta) {
    throw new ConflittoDiVersione(…);
  }
  this.elementi.set(id, structuredClone(snapshot));
}
```

`versioneLetta` è la versione che l'aggregato aveva quando è stato caricato. Se quella
conservata non coincide più, qualcun altro è passato di qui.

> **Corretto e oggi inerte.** Con un solo processo e un salvataggio sincrono, fra la lettura e
> questa riga non c'è punto di sospensione: il conflitto non si verifica spontaneamente. È
> scritto ora perché il giorno del database sarebbe troppo tardi — a quel punto andrebbero
> riletti tutti i casi d'uso invece di una classe sola.

### `indice-unico.ts` — il vincolo `UNIQUE`

L'unicità del titolo di un corso (`INV-1`) è un'invariante **di insieme**: nessun aggregato può
difenderla, perché per costruzione un aggregato non vede gli altri. È l'eccezione che conferma
la regola «le invarianti stanno negli aggregati».

Con un database era un vincolo `UNIQUE`. Qui è questa mappa, controllata dentro `salva` dal
repository che la possiede — che verifica l'indice **prima** del check-and-set e registra il
titolo **dopo** la scrittura riuscita.

**La garanzia, detta per intero.** `UNIQUE` reggeva sotto concorrenza perché verifica e
scrittura erano un'operazione sola, indivisibile per proprietà del motore. Qui `occupata` e
`registra` reggono perché il processo è uno e il salvataggio è sincrono: non c'è `await` fra
le due. È una garanzia **condizionata a un'ipotesi di deploy**, non a una proprietà
dell'archivio — ed è la prima cosa che cade il giorno dei due processi. Sta scritto qui perché
chi lo scoprirà lo scopra leggendo, non in produzione.

`registra` libera la chiave precedente dello stesso identificativo: è ciò che permette di
rinominare un corso senza lasciarsi dietro il vecchio titolo occupato per sempre.

### `tipi.ts`

`DataConservata` e `OraConservata` sono alias di `string`, e `Versionato` è l'interfaccia che
ogni snapshot estende. Vivono tutti in un file solo perché il giorno in cui diventeranno colonne
di una tabella il lavoro sia **locale a un file**.

---

## `event-bus/` — la consegna

`event-bus-in-process.ts` fa tre cose: chiude la busta, consegna in ordine, non consegna due
volte.

**La busta.** `eventId` e `occorsoIl` vengono aggiunti qui, usando le porte `GeneratoreDiId` e
`Orologio` — le stesse che il dominio usa, così anche gli eventi restano deterministici nei
test.

**L'ordine è quello di registrazione**, e su `CorsoRitirato` è vincolante: prima l'ACL aggiorna
la replica, poi la policy annulla le sessioni. Non è un dettaglio del bus, è una condizione
perché la finestra di inconsistenza di `HS-8` resti auto-riparante. Le due righe che lo
stabiliscono stanno in `app.module.ts`, con il commento che dice perché non vanno invertite.

**L'idempotenza** è un `Set` di chiavi `handler|eventId`: la stessa consegna allo stesso
handler avviene una volta sola. Non dipendeva dal database — dipende dalla forma della
consegna — quindi è rimasta anche dopo che l'outbox è stato tolto.

### Cosa si è perso togliendo l'outbox, detto chiaramente

L'outbox serviva a rendere atomici stato ed evento dentro una transazione. Senza transazione
non protegge da nulla: se il processo muore, muore anche lo stato.

Quello che si perde davvero è il **recupero**. Un handler che fallisce perde il suo evento, e
nessuno lo ripesca: il bus registra l'errore e prosegue con gli altri handler. È accettabile
qui perché il peggiore degli esiti è una notifica mancata su un log — e non lo sarebbe in un
sistema che movimenta denaro.

Resta in piedi l'unica garanzia che l'ordine può dare: **si pubblica dopo aver salvato**, mai
prima.

---

## `http/` — il confine

### `filtro-eccezioni.ts`

**È l'unico punto del sistema che conosce i codici di stato.** Nessuna classe di `domain/` sa
cosa sia un 409: l'aggregato solleva `IscrizioneDuplicata`, e che quella diventi un 409 è una
decisione dello strato HTTP, presa qui e in nessun altro posto.

Tre rami, tre significati diversi:

| Cosa arriva | Cosa esce |
| --- | --- |
| `ErroreDiDominio` con stato dichiarato | quello stato, con `error` = nome della classe |
| `ErroreDiDominio` **senza** stato | `500`, e un `logger.error` esplicito: è un difetto della tabella, non una richiesta sbagliata |
| `HttpException` di Nest (404 di rotta, 400 della pipe) | passa con il suo stato e il suo corpo: non è un rifiuto del dominio e non deve travestirsi da tale |

Il ramo di mezzo non dovrebbe mai essere raggiunto: esiste il test di contratto proprio perché
resti irraggiungibile. Ma se lo fosse, il messaggio dice cosa fare — *aggiungilo al registro* —
invece di lasciare un `500` muto.

### `registro-stati-http.ts` e `stati-http.shared.ts`

Il registro è la tabella «eccezione → stato», **costruita a pezzi**. Ogni contesto dichiara le
proprie righe e le registra:

```ts
new RegistroStatiHttp()
  .registra(STATI_HTTP_SHARED)
  .registra(STATI_HTTP_ISCRIZIONI)
  .registra(STATI_HTTP_CATALOGO);
```

Se questo file conoscesse le eccezioni dei due contesti, `shared/` diventerebbe il punto in cui
si incontrano — che è precisamente ciò che i divieti escludono.

Il confronto avviene sul **costruttore esatto**: una sottoclasse deve dichiarare il proprio
stato invece di ereditarlo per caso.

`stati-http.shared.ts` dichiara due sole righe, e la seconda porta con sé uno **scostamento
dichiarato** dalla documentazione: `ValoreNonValido → 400` non è nella tabella di
`architecture.md` §4.4, che assegna i formati malformati alla `ValidationPipe`. Il commento
spiega perché c'è comunque — sul percorso HTTP è irraggiungibile, e resta il caso in cui il
comando arriva da una policy. Uno scostamento scritto è una decisione; uno scostamento
silenzioso è un debito.

### `utente-corrente.ts`

**L'unico punto del sistema in cui l'identità entra.** Legge l'header `X-Utente`, normalizza
l'email e ne deriva un UUID v5 deterministico (SHA-1 su un namespace fisso).

Non c'è autenticazione né autorizzazione: il client dichiara e il sistema crede. È una scelta
esplicita di scopo dell'esercizio, e ha una conseguenza precisa sul modello:

> `INV-9` **non dipende da questa fiducia.** Non difende da chi mente sulla propria identità,
> ma da chi tenta di annullare l'iscrizione **di un altro** — e quella strada non esiste, né
> nella firma dell'aggregato né nella forma della rotta (`DELETE …/enrollments/me`).

Il giorno in cui arrivasse un SSO vero, a cambiare sarebbe questo file e nient'altro: nessun
controller, nessun caso d'uso, nessun aggregato sa da dove arriva l'identità.

L'UUID v5 è **scritto a mano**, dieci righe, invece di aggiungere una dipendenza per una
funzione sola. Deterministico per costruzione: la stessa email produce sempre lo stesso
identificativo, anche fra riavvii — che è ciò che rende usabile un sistema senza anagrafica.

### `contratto-stati-http.spec.ts`

Enumera **per riflessione** ogni classe di errore esportata dai tre moduli e verifica che
ognuna abbia uno stato dichiarato:

```ts
const senzaStato = classiEsportateDa(modulo)
  .filter((classe) => !NON_ATTRAVERSA_HTTP.includes(classe))
  .filter((classe) => registro.statoPer(new classe()) === null)
  .map((classe) => classe.name);

expect(senzaStato).toEqual([]);
```

«Che ogni eccezione compaia in tabella non è affidato alla memoria»: questo è il test che lo
garantisce. Aggiungere una classe di errore senza dichiararne lo stato **fa fallire la suite**,
invece di produrre un `500` il giorno in cui quel rifiuto capita davvero — cioè mesi dopo, a un
utente, per un caso raro.

C'è però un secondo modo di sfuggirgli, meno ovvio: **creare un nuovo file di errori**, o un
terzo contesto, che il test non importa. Un elenco di moduli scritto a mano ha lo stesso difetto
del barrel — si dimentica di aggiornarlo. Per questo il test scandisce anche il filesystem:

```ts
it('nessun file di errori sfugge a questo test', () => {
  expect(fileDiErroriSotto(RADICE).sort()).toEqual(Object.keys(MODULI_DICHIARATI).sort());
});
```

Ogni `errori.ts` sotto una cartella `domain/` deve comparire fra quelli dichiarati. Verificato
con una violazione deliberata: un file di errori aggiunto altrove fa fallire la suite indicando
quale.

---

## `infrastructure/` — dove l'impurità è confinata

Due file, venti righe in tutto, e sono i due posti in cui il progetto smette di essere
deterministico.

**`orologio-di-sistema.ts`** — l'**unico `new Date()` lecito del progetto**. Il guardiano
ESLint lo vieta in `domain/` e `application/`, non qui: tutta l'impurità del tempo sta in
queste righe.

Legge i componenti **locali** (`getFullYear`, non `getUTCFullYear`), coerentemente con la
scelta di modellare date e ore locali senza fuso: convertire in UTC sposterebbe di un giorno le
sessioni serali.

**`generatore-di-uuid.ts`** — `randomUUID()` da `node:crypto`, e basta. Nei test il generatore
è un contatore.

Il valore di queste due classi non sta in ciò che fanno, sta in **quanto sono piccole**: sono
la misura di quanta impurità il resto del sistema si è tolto di dosso.

---

## Il giorno del database

Vale la pena elencare, in un posto solo, cosa cambierebbe davvero:

| Cosa | Cambia? |
| --- | --- |
| `domain/` dei due contesti | no |
| `application/` dei due contesti | no — i casi d'uso sono già `async`, e `conRiprova` già esiste |
| Le porte `RepositorySessioni`, `RepositoryCorsi` | firme da rendere `Promise` |
| Gli snapshot e i mapper | no: gli snapshot sono già righe di tabella con un altro nome |
| `collezione-in-memoria.ts` | **sì** — sostituita, e il check-and-set diventa una `WHERE versione = ?` |
| `indice-unico.ts` | **sì** — sostituito da un vincolo `UNIQUE` |
| `app.module.ts` | una riga per repository |
| `event-bus-in-process.ts` | qui tornerebbe l'outbox, che ora avrebbe una transazione da proteggere |

Che questa tabella sia corta è il risultato che l'architettura esagonale doveva produrre. Che
sia scritta prima di averne bisogno è ciò che permette di verificarla, invece di sperarci.

---

Le motivazioni estese stanno in [`architecture.md`](../../../../doc/architecture.md), §4.1
(niente database), §4.7 (persistenza e lock ottimistico) e §4.8 (eventi senza outbox).
