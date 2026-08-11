# `catalogo/` — il supporting domain

> Capitolo di dettaglio del [README di `apps/api`](../../README.md).
> Il gemello di questo capitolo è [`iscrizioni/`](../iscrizioni/README.md), ed è il
> confronto fra i due a dire la cosa più interessante.

Il catalogo tiene l'elenco dei corsi e il loro ciclo di vita: bozza → pubblicato → ritirato.
Serve, ma **non è ciò che distingue questa azienda**: un ciclo di vita editoriale si potrebbe
comprare da un CMS qualunque, e nessuno se ne accorgerebbe.

Per questo è **supporting** e non core. La classificazione non è un'etichetta da diagramma:
si traduce in quanto lavoro di modellazione merita, e la differenza si vede nel codice riga
per riga.

## Il contrasto, in una tabella

| | `catalogo` (supporting) | `iscrizioni` (core) |
| --- | --- | --- |
| Aggregato | radice con **soli value object** | radice + entità interna (`Iscrizione`) |
| Invarianti custodite | **una**, e non sta nell'aggregato | undici, quasi tutte dentro l'aggregato |
| Casi d'uso | 4, in **un solo file** | 5 file distinti + una policy |
| Riprova ottimistica | no | sì, su 4 casi d'uso su 5 |
| Eventi emessi | 4 | 8 |
| Stati HTTP usati | `404`, `409` | `404`, `409`, **`422`** |
| Righe di `domain/` (senza test) | 386 | 934 |

L'ultima riga della tabella è quella che vale la pena leggere due volte: **il catalogo non usa
mai `422`**. Un `422` significa «una regola di business rifiuta questa richiesta, e rileggere
non cambia nulla» — cioè che esistono regole che dipendono dal *quando* e dal *quanto*. Nel
catalogo non ce ne sono: ci sono solo transizioni di stato ammesse o no (`409`) e cose che non
esistono (`404`). È il profilo tipico di un dominio amministrativo.

Se un giorno il catalogo cominciasse a produrre `422`, o se il suo aggregato acquisisse una
gerarchia interna, varrebbe la pena chiedersi se sia ancora davvero supporting.

---

## La mappa

```
catalogo/
├── domain/
│   ├── corso.ts                     ← la radice: un ciclo di vita e quattro value object
│   ├── errori.ts                    ← 4 rifiuti
│   ├── eventi.ts                    ← 4 fatti, tre dei quali sono contratto pubblico
│   ├── value-objects/
│   │   ├── titolo-corso.ts          ← l'unico con una forma normalizzata
│   │   ├── descrizione.ts   durata-in-ore.ts   argomento.ts   identificativi.ts
│   └── ports/
│       └── repository-corsi.ts      ← perId, salva… e titoloEsiste
│
├── application/
│   ├── comandi.ts
│   └── use-case.ts                  ← tutti e quattro, in un file solo
│
├── infrastructure/
│   ├── http/
│   │   ├── courses.controller.ts    ← 4 comandi + R3
│   │   ├── dto.ts
│   │   ├── read-dto.ts              ← la traduzione IT → EN della lettura
│   │   └── stati-http.catalogo.ts
│   └── persistence/
│       ├── corso.snapshot.ts        ← conserva anche il titolo normalizzato
│       ├── corso.mapper.ts
│       └── repository-corsi.in-memoria.ts   ← il custode di INV-1
│
└── read-model/
    ├── letture-corsi.ts             ← la porta, e i DTO che restituisce
    └── letture-corsi.in-memoria.ts  ← R3 sugli snapshot, mai sugli aggregati
```

---

## `domain/` — un ciclo di vita, e nient'altro

### `corso.ts`

Una radice con **nessuna entità interna**: solo value object e uno stato.

```
      crea()            pubblica()            ritira()
  ∅ ─────────→ BOZZA ──────────────→ PUBBLICATO ─────────→ RITIRATO
                 │                        │                    │
                 └──── modificaDettagli() ┘                    ✗
                                                        (terminale, HS-12)
```

Le tre transizioni sono tutto ciò che l'aggregato custodisce, e ognuna ha una precondizione
sola:

| Comando | Precondizione | Se fallisce |
| --- | --- | --- |
| `pubblica()` | lo stato è `BOZZA` | `TransizioneCorsoNonAmmessa` |
| `ritira()` | lo stato è `PUBBLICATO` | `TransizioneCorsoNonAmmessa` |
| `modificaDettagli(d)` | lo stato **non** è `RITIRATO` | `CorsoRitiratoNonModificabile` |

**`RITIRATO` è terminale** (`HS-12`), e non per pigrizia implementativa. Il ritiro è
distruttivo: fa scattare la policy P2, che annulla le sessioni future di quel corso e notifica
gli iscritti. Un «ripensamento» che riportasse il corso a `PUBBLICATO` non potrebbe
disannullare quelle sessioni né ritirare quelle email. Il messaggio d'errore dice la strada
alternativa — *per ripartire, creane uno nuovo* — perché è l'unica onesta.

`modificaDettagli` vale anche su un corso **pubblicato**, ed è deliberato: l'evento che ne
esce è il modo in cui `iscrizioni` aggiorna il titolo nella propria replica. Cambiare il
titolo di un corso pubblicato è una cosa normale; è la ragione per cui l'ACL ascolta
`DettagliCorsoModificati`.

Come nell'altro contesto, il costruttore è privato e ci sono due sole strade per ottenere
un'istanza: `crea` (applica le regole, emette eventi) e `ricostruisci` (non fa né l'una né
l'altra, ed è riservato al mapper).

### Ciò che l'aggregato **non** custodisce

`INV-1` — «due corsi non hanno lo stesso titolo» — **non è qui**, e non per dimenticanza.

È un'invariante di **insieme**: riguarda la collezione di tutti i corsi, e un `Corso` per
costruzione non vede gli altri (`HS-7`). Difenderla nell'aggregato richiederebbe di passargli
l'elenco dei titoli esistenti — cioè di dargli accesso al repository, che è il modo più rapido
per trasformare un aggregato in un servizio.

Vive quindi nella persistenza, ed è l'unica eccezione alla regola «le invarianti stanno negli
aggregati». Il fatto che sia **una sola** è ciò che la rende accettabile: un'eccezione
motivata e circoscritta, non un precedente.

Chi la viola riceve comunque `TitoloCorsoGiaUsato`, che è **un'eccezione di dominio**: chi la
riceve non sa e non deve sapere se sotto ci fosse un indice, un vincolo `UNIQUE` o una mappa.

### `value-objects/`

| File | Vincolo | La decisione |
| --- | --- | --- |
| `titolo-corso.ts` | non vuoto, ≤ 200 | Espone anche `normalizzato` (minuscolo, spazi compattati) e `eLoStessoDi`. La normalizzazione vive qui perché è una regola sul **significato** del titolo, non sul modo di conservarlo: il repository si limita a usarla come chiave |
| `argomento.ts` | non vuoto, ≤ 100 | **Stringa e non enumerazione.** Il committente non ha mai parlato di un elenco chiuso: chiuderlo qui significherebbe inventare una regola che nessuno ha chiesto, con l'aggravante di doverla poi mantenere |
| `descrizione.ts` | non vuota, ≤ 2000 | — |
| `durata-in-ore.ts` | intero fra 1 e 200 | — |
| `identificativi.ts` | `CorsoId` non vuoto | Esiste un `CorsoId` anche in `iscrizioni`, ed è **duplicazione deliberata**: «solo per un tipo» è la prima eccezione con cui si ricostruisce il modello unico che i contesti esistono per evitare. Hanno la stessa forma oggi; niente garantisce che l'abbiano domani, ed è esattamente il punto |

`titolo-corso.ts` è il file da confrontare con il suo omonimo in
[`iscrizioni/`](../iscrizioni/README.md#value-objects): stesso nome, due classi diverse. Qui
il titolo è un dato che si redige e su cui poggia un'invariante di unicità; lì è un'etichetta
copiata per lo storico. La differenza fra le due classi **è** il confine fra i contesti.

### `errori.ts` — quattro rifiuti

| Classe | Stato | Origine |
| --- | --- | --- |
| `CorsoNonTrovato` | `404` | identificativo inesistente |
| `TitoloCorsoGiaUsato` | `409` | `INV-1` — **dalla persistenza**, non dall'aggregato |
| `TransizioneCorsoNonAmmessa` | `409` | pubblicare ciò che non è in bozza, ritirare ciò che non è pubblicato |
| `CorsoRitiratoNonModificabile` | `409` | `HS-12` |

Tutti `404` o `409`, come si diceva: il catalogo rifiuta per **stato**, mai per regola di
business legata al tempo o alla quantità.

### `eventi.ts` — quattro fatti, tre contratti

```
catalogo.CorsoCreato.v1                ← nessuno lo ascolta (ed è giusto così)
catalogo.DettagliCorsoModificati.v1    ┐
catalogo.CorsoPubblicato.v1            ├ il contratto con `iscrizioni`, via ACL
catalogo.CorsoRitirato.v1              ┘
```

**`CorsoCreato` non è ascoltato da nessuno**, ed è una scelta con un test che la protegge: un
corso in bozza **non deve** entrare nella replica di `iscrizioni`, altrimenti si potrebbe
programmare una sessione per un corso mai pubblicato e `INV-2` si aprirebbe un varco. Il test
lo verifica per nome:

```ts
it('CorsoCreato non è fra questi: un corso in bozza non entra nella replica', …)
```

Gli altri tre sono **contratto pubblico**: cambiarne il payload è cambiare un'interfaccia che
qualcun altro consuma. Per questo la versione sta nel nome — `.v2` si affianca a `.v1` finché
i sottoscrittori migrano, invece di cambiare in silenzio il significato di un nome esistente.

### `ports/repository-corsi.ts`

Tre metodi, e il terzo è quello insolito:

```ts
abstract titoloEsiste(titolo: TitoloCorso, escluso?: CorsoId): boolean;
```

Non è una comodità. `INV-1` è garantita **dentro `salva`**, che solleva `TitoloCorsoGiaUsato`;
questo metodo serve al controllo preventivo dell'application service, e produce lo stesso
errore nel caso normale.

Perché avere entrambi? Non per correttezza — quella ce l'ha già `salva` — ma per non far
dipendere il messaggio d'errore del caso comune dalla gestione di un errore infrastrutturale.
Il controllo preventivo è la strada felice; il controllo dentro `salva` è la garanzia.

Il parametro `escluso` permette di modificare un corso senza collidere con sé stesso.

---

## `application/` — quattro casi d'uso, un file

I quattro use case stanno in `use-case.ts`, insieme. È una deviazione consapevole dalla forma
di `iscrizioni/application/`, dove ogni caso d'uso ha il suo file:

> Fanno tutti la stessa cosa — carica, chiedi all'aggregato, salva, pubblica — e nessuno ha
> una storia propria. Spezzarli in quattro file replicherebbe la forma dell'altro contesto
> senza averne la sostanza.

Lì ogni caso d'uso ha qualcosa da raccontare: la riprova, la replica ACL, i due esiti
dell'iscrizione. Qui no, e fingere il contrario renderebbe il codice più simmetrico e meno
sincero.

**Nessuno usa `conRiprova`.** Il catalogo non ha contesa: le sue scritture sono atti
amministrativi di una persona sola. Il conflitto di versione che il repository può comunque
sollevare risalirebbe come `503` — corretto, e in pratica irraggiungibile.

| Caso d'uso | Nota |
| --- | --- |
| `CreaCorsoUseCase` | Controlla `titoloEsiste` prima di creare, poi lascia che sia `salva` a garantire |
| `ModificaDettagliCorsoUseCase` | Stesso controllo, ma con `escluso: corsoId` — un corso non collide con sé stesso |
| `PubblicaCorsoUseCase` | L'evento che emette **fa nascere la voce nella replica** di `iscrizioni` |
| `RitiraCorsoUseCase` | Il comando con la conseguenza più lunga: l'evento aggiorna la replica **e poi** fa scattare P2. In quest'ordine, e l'ordine è fissato in `app.module.ts` |

---

## `infrastructure/`

### `persistence/` — il custode di `INV-1`

`repository-corsi.in-memoria.ts` è l'unico repository del progetto che fa qualcosa di più che
tradurre e salvare. L'ordine delle tre operazioni dentro `salva` è la parte interessante:

```ts
salva(corso: Corso): void {
  // 1. l'indice, PRIMA: se il titolo è di un altro, non si scrive nulla
  if (this.indiceTitoli.occupata(titolo.normalizzato, corso.id.valore)) {
    throw new TitoloCorsoGiaUsato(…);
  }

  // 2. il check-and-set sulla versione
  this.corsi.salva(corso.id.valore, aSnapshot(corso, corso.versioneLetta + 1), corso.versioneLetta);

  // 3. il titolo si registra DOPO la scrittura riuscita
  this.indiceTitoli.registra(titolo.normalizzato, corso.id.valore);
}
```

Il passo 3 è quello che si sbaglia facilmente. Se l'indice si aggiornasse **prima** del
salvataggio, un salvataggio fallito per conflitto di versione lascerebbe l'indice a
rivendicare un titolo per un corso che non è mai stato scritto — e quel titolo resterebbe
occupato per sempre, senza che nessun corso lo porti. C'è un test che verifica esattamente
questo:

```ts
it("un salvataggio fallito non lascia il titolo occupato nell'indice", …)
```

Le due operazioni restano indivisibili perché fra loro **non c'è alcun `await`**: è la stessa
garanzia condizionata all'ipotesi di deploy descritta in
[`shared/`](../shared/README.md#indice-unicots--il-vincolo-unique).

`corso.snapshot.ts` conserva `titoloNormalizzato` **accanto** al titolo invece di ricalcolarlo
al volo: è la chiave su cui poggia l'indice, e conservarla rende esplicito che l'unicità è un
fatto della persistenza — esattamente dove la decisione l'ha messa.

### `http/`

**`courses.controller.ts`** — quattro rotte. `publish` e `withdraw` sono transizioni con un
nome, non `PATCH { "state": … }`: il ciclo di vita è una decisione dell'aggregato, e l'URL non
deve invitare il client a proporla.

Nessun prefisso di ruolo — niente `/api/admin/courses`. Non esiste autorizzazione, e un
prefisso che nomina chi chiama codificherebbe nell'URL un'informazione che non riguarda la
risorsa.

**`dto.ts`** — `UpdateCourseDto extends CreateCourseDto`, cioè **la modifica richiede tutti i
campi**.

Non è pigrizia: `modificaDettagli` sostituisce i dettagli in blocco, e un DTO con campi
opzionali suggerirebbe una semantica di merge che l'aggregato non ha. Il metodo resta `PATCH`
perché modifica *una parte* della risorsa — lo stato del corso non si tocca da lì.

---

## Cosa il catalogo non fa

L'elenco delle cose assenti dice quanto le altre due:

- **Non sa di avere clienti.** Non c'è un import di `iscrizioni/`, e una regola ESLint lo
  impedisce con il messaggio *«il catalogo non sa di avere clienti»*. Pubblica eventi e non sa
  chi li ascolti.
- **Non annulla sessioni.** Il ritiro di un corso *causa* l'annullamento, ma la decisione è
  della policy P2, che vive in `iscrizioni/application/policy/`. Se il catalogo chiamasse
  direttamente quel caso d'uso, i due contesti sarebbero uno.
- **Non conosce `INV-11`** («si annullano solo le sessioni future»), né sa che esistano le
  sessioni.
- **Non conosce il conteggio delle sessioni** che la vista catalogo mostra accanto a ogni
  corso: `GET /api/courses` (R3) restituisce i corsi e nient'altro, e la composizione con il
  dato di `iscrizioni` avviene nel frontend — `read-model/letture-corsi.ts`.

---

## I test

| File | Livello | Cosa verifica |
| --- | --- | --- |
| [`domain/corso.spec.ts`](domain/corso.spec.ts) | 1 | Le tre transizioni, `RITIRATO` terminale, l'evento che aggiorna la replica, l'equivalenza fra titoli che differiscono per maiuscole e spazi |
| [`infrastructure/persistence/repository-corsi.spec.ts`](infrastructure/persistence/repository-corsi.spec.ts) | 3 | Andata e ritorno, che modificare senza salvare non cambi l'archivio, **`INV-1` in cinque scenari** e il lock ottimistico |

Vale la pena notare la divisione: `corso.spec.ts` non contiene **nemmeno un test su `INV-1`**,
perché a quel livello non è verificabile. Sta tutto nel test del repository — e questa
separazione è la prova, a posteriori, che la decisione di `HS-7` è stata implementata dove
diceva di essere.

---

Le motivazioni estese stanno in [`domain.md`](../../../../doc/domain.md) (la mappa dei
contesti, core vs supporting) e [`aggregation.md`](../../../../doc/aggregation.md) §3.2.
