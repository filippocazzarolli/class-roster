# `iscrizioni/` — il core domain

> Capitolo di dettaglio del [README di `apps/api`](../../README.md).
> Qui si entra nei file uno per uno. Il gemello è [`catalogo/`](../catalogo/README.md), che
> apre con la tabella del contrasto fra i due.

Questo è il contesto per cui il sistema esiste. `catalogo/` è **supporting**: gestisce un
ciclo di vita editoriale che si potrebbe comprare da uno strumento qualunque. `iscrizioni/`
è il **core**, perché contiene l'unica cosa che il committente non può comprare altrove: le
regole su chi entra, chi aspetta e in quale ordine il posto liberato passa di mano.

È anche il posto in cui si concentrano quasi tutte le invarianti e tutti gli hotspot
dell'event storming. La densità delle decisioni per riga di codice, qui, è molto più alta che
altrove — ed è il motivo per cui vale la pena leggerlo file per file.

---

## Indice

- [La mappa del contesto](#la-mappa-del-contesto)
- [`domain/` — le regole](#domain--le-regole)
  - [`sessione.ts` — l'aggregato](#sessionets--laggregato)
  - [`iscrizione.ts` — l'entità interna](#iscrizionets--lentità-interna)
  - [`value-objects/`](#value-objects)
  - [`errori.ts` — i rifiuti](#errorits--i-rifiuti)
  - [`eventi.ts` — i fatti](#eventits--i-fatti)
  - [`ports/` — ciò che il dominio chiede al mondo](#ports--ciò-che-il-dominio-chiede-al-mondo)
- [`application/` — i casi d'uso](#application--i-casi-duso)
  - [La forma comune](#la-forma-comune)
  - [`con-riprova.ts`](#con-riprovats)
  - [`policy/` — P2](#policy--p2)
- [`infrastructure/` — il mondo esterno](#infrastructure--il-mondo-esterno)
  - [`persistence/`](#persistence)
  - [`http/`](#http)
  - [`acl/` — l'anticorruption layer](#acl--lanticorruption-layer)
  - [`event-handlers/`](#event-handlers)
- [Il flusso di una chiamata](#il-flusso-di-una-chiamata)
  - [Il caso generico](#il-caso-generico)
  - [I controlli, in ordine di apparizione](#i-controlli-in-ordine-di-apparizione)
  - [L'esempio: iscriversi a una sessione piena](#lesempio-iscriversi-a-una-sessione-piena)
  - [Quando il salvataggio trova la versione cambiata](#quando-il-salvataggio-trova-la-versione-cambiata)
  - [Cosa non c'è nel flusso](#cosa-non-cè-nel-flusso)
- [Il percorso completo di una richiesta](#il-percorso-completo-di-una-richiesta)
- [Dove sono presidiate le invarianti](#dove-sono-presidiate-le-invarianti)

---

## La mappa del contesto

```
iscrizioni/
├── domain/
│   ├── sessione.ts                  ← l'aggregato radice
│   ├── iscrizione.ts                ← entità interna all'aggregato
│   ├── errori.ts                    ← 11 rifiuti
│   ├── eventi.ts                    ← 8 fatti + i nomi sul bus
│   ├── value-objects/
│   │   ├── capienza.ts   docente.ts   email.ts
│   │   ├── identificativi.ts   luogo.ts   titolo-corso.ts
│   └── ports/
│       ├── repository-sessioni.ts   ← come si carica e si salva
│       └── corsi-pubblicati.ts      ← cosa so del catalogo (e come lo so)
│
├── application/
│   ├── comandi.ts                   ← 5 comandi, primitivi, in italiano
│   ├── con-riprova.ts               ← il lock ottimistico visto da fuori
│   ├── programma-sessione.use-case.ts
│   ├── modifica-capienza.use-case.ts
│   ├── annulla-sessione.use-case.ts
│   ├── iscriviti.use-case.ts
│   ├── annulla-iscrizione.use-case.ts
│   └── policy/
│       └── annulla-sessioni-corso-ritirato.policy.ts   ← P2
│
└── infrastructure/
    ├── http/
    │   ├── sessions.controller.ts   ← 5 rotte, e la traduzione IT ↔ EN
    │   ├── dto.ts                   ← i DTO in inglese
    │   └── stati-http.iscrizioni.ts ← eccezione → stato
    ├── persistence/
    │   ├── sessione.snapshot.ts     ← lo stato piatto, senza comportamento
    │   ├── sessione.mapper.ts       ← la traduzione, scritta a mano
    │   └── repository-sessioni.in-memoria.ts
    ├── acl/
    │   └── replica-corsi-pubblicati.ts   ← la copia locale del catalogo
    └── event-handlers/
        └── corso-ritirato.handler.ts
```

---

## `domain/` — le regole

### `sessione.ts` — l'aggregato

452 righe, ed è il file più importante del progetto.

**Il confine.** Le iscrizioni stanno **dentro** la sessione, non accanto ad essa. È la
decisione fondativa (`HS-3`), e la ragione è che «gli iscritti non superano la capienza» e
«la coda scorre in ordine d'arrivo» non sono due regole separate: sono i due lati della
stessa decisione, presa nello stesso istante sullo stesso dato. Se `Iscrizione` fosse un
aggregato a sé, ogni iscrizione dovrebbe leggere quante altre ce ne sono e fidarsi del
risultato — e fra la lettura e la scrittura ci sarebbe una finestra in cui il posto è già di
qualcun altro.

Il costruttore è **privato**. Un'istanza di `Sessione` nasce solo in due modi:

| Costruttore | Applica le regole? | Emette eventi? | Chi lo usa |
| --- | --- | --- | --- |
| `Sessione.programma(dati, corso, adesso)` | sì | sì | il caso d'uso di programmazione |
| `Sessione.ricostruisci(stato)` | **no** | **no** | solo il mapper della persistenza |

La distinzione non è cerimoniale: ricostruire dallo snapshot è **ripristinare un fatto già
accaduto**, non compierlo di nuovo. Se `ricostruisci` applicasse le regole, un aggregato
salvato ieri diventerebbe illegale oggi perché la sua data di inizio è nel frattempo passata,
e non si potrebbe più nemmeno leggere.

#### I quattro comandi

**`iscrivi(dipendenteId, email, adesso)`** — il metodo che racconta la regola centrale.

```ts
const cePosto = this.numeroIscritti() < this.capienzaCorrente.valore;
const stato: StatoIscrizione = cePosto ? 'ISCRITTO' : 'IN_ATTESA';
```

Notare cosa **non** c'è: un'eccezione per «posti esauriti». A posti pieni non si viene
respinti, si entra in coda — e questo si vede nella forma del codice, non in un commento. Se
`PostiEsauriti` comparisse fra le eccezioni, il modello avrebbe smesso di raccontare la stessa
storia del committente.

C'è anche una lettura non ovvia di `INV-8`: basta confrontare gli iscritti con la capienza,
senza guardare la coda, perché *finché la coda non è vuota non esistono posti liberi* — è
proprio ciò che `INV-8` garantisce. L'invariante non è solo un vincolo da difendere: è
un'ipotesi su cui il resto del codice può appoggiarsi.

**`annullaIscrizione(dipendenteId, adesso)`** — qui sta `HS-4`, e vale la pena leggerlo due
volte.

La promozione dalla coda avviene **dentro questo metodo**, nello stesso atto in cui il posto
si libera. Non è una policy che reagisce all'evento `IscrizioneAnnullata`.

Se fosse reattiva esisterebbe una finestra — breve quanto si vuole, ma esistente — in cui il
posto è libero e la coda non è vuota. In quella finestra un dipendente qualunque potrebbe
iscriversi e prendere quel posto **legittimamente**, perché la regola dei posti liberi
glielo consente. Il risultato sarebbe «il posto va al primo che ricarica la pagina», che è
esattamente ciò che la lista d'attesa esiste per impedire.

Chi annulla non «libera un posto»: **consegna il proprio posto al primo della coda**. È una
frase di dominio, e il codice la esegue letteralmente.

C'è un secondo caso, meno appariscente e altrettanto deciso: chi era **in attesa** e si sfila
non promuove nessuno — non c'era posto da consegnare. Esce un evento diverso
(`AttesaAnnullata` invece di `IscrizioneAnnullata`), perché sono due fatti diversi e il
contesto notifiche dovrà trattarli diversamente.

**`modificaCapienza(nuova, adesso)`** — due hotspot in un metodo solo:

- **In riduzione** (`HS-2`): se la nuova capienza è inferiore agli iscritti, si **rifiuta**.
  Nessuno viene espulso. Il messaggio d'errore indica la strada alternativa — annullare e
  riprogrammare — perché rimuovere qualcuno già iscritto sarebbe una decisione di business
  che nessuno ha preso.
- **In aumento** (`HS-14`): i posti nuovi scorrono la coda nello stesso atto. Lasciarli
  liberi con gente in attesa produrrebbe uno stato che `INV-8` dichiara impossibile — e
  `assicuraCoerenza` lo intercetterebbe subito.

**`annulla(motivo)`** — `INV-12`: `ANNULLATA` è terminale, e riannullare è rifiutato.

L'evento che ne esce porta con sé **l'elenco completo dei destinatari**, iscritti e in
attesa, con indirizzo e stato (`HS-10`). È l'unico modo perché dopo l'annullamento nessuno
debba chiedere a `iscrizioni` a chi scrivere: un evento è autosufficiente o non è un evento.

#### `assicuraCoerenza()` — la rete

In coda a ogni comando, un metodo privato ricontrolla le quattro condizioni:

| Controllo | Invariante |
| --- | --- |
| iscritti ≤ capienza | `INV-4` |
| non ci sono posti liberi con la coda non vuota | `INV-8` |
| nessun `ordine` duplicato | `INV-7` |
| nessun dipendente presente due volte | `INV-5` |

Solleva `Error` e non `ErroreDiDominio`, ed è deliberato: **se scatta, il difetto è in questo
file**, non nella richiesta. Non è un rifiuto da tradurre in uno stato HTTP, è un bug che deve
fare rumore. Costa cinque righe ed è una rete contro le regressioni future.

### `iscrizione.ts` — l'entità interna

È **un'entità, non un value object**: ha identità locale (il `dipendenteId`) e uno stato che
cambia restando la stessa iscrizione. Chi passa da `IN_ATTESA` a `ISCRITTO` non diventa
un'altra iscrizione — è la stessa persona con un esito migliore. Un value object, essendo
immutabile e senza identità, obbligherebbe a sostituirlo, e la sostituzione perderebbe il
filo del «è la stessa persona».

L'identità è **locale in senso stretto**: non esiste modo di riferire un'`Iscrizione` da
fuori l'aggregato, e non serve.

Il campo `ordine` merita una nota. È un **progressivo assegnato dall'aggregato**, non un
timestamp:

```ts
private prossimoOrdine(): number {
  return this.iscrizioniCorrenti.reduce((max, i) => Math.max(max, i.ordine), 0) + 1;
}
```

Due iscrizioni nello stesso millisecondo produrrebbero un ordine indefinito, e l'ordine
indefinito in una coda equa è precisamente il difetto da non avere. Assegnandolo l'aggregato,
che le vede tutte, le collisioni sono impossibili per costruzione — e i test restano
deterministici senza toccare l'orologio.

`promuovi()` è chiamabile solo dalla radice: è la radice a sapere se c'è un posto da
consegnare.

### `value-objects/`

| File | Cosa custodisce | La decisione |
| --- | --- | --- |
| `capienza.ts` | intero ≥ 1 | **L'unica invariante affidata a un value object** (`INV-3`): non riguarda la relazione fra la capienza e altro, riguarda il valore in sé. Un `Capienza` che esiste è valido |
| `luogo.ts` | `Aula(nome)` \| `Online` | Somma di due casi, non due campi opzionali: «aula senza nome» e «online con nome di aula» sono stati che non devono poter esistere |
| `identificativi.ts` | `SessioneId`, `CorsoId`, `DipendenteId` | Opachi: il dominio non attribuisce significato alla loro forma. `CorsoId` è una **copia**, non un riferimento — non esiste modo di risalire al `Corso` |
| `titolo-corso.ts` | il titolo, copiato | Nessuna normalizzazione, a differenza del gemello nel catalogo: qui è un'etichetta per lo storico, `INV-1` non lo riguarda |
| `email.ts` | l'indirizzo di chi si iscrive | Vive qui come **dato replicato**, non come riferimento a un'anagrafica (`HS-10`): viaggia dentro l'evento, così notifiche non interroga il core |
| `docente.ts` | il nome di chi tiene la sessione | **Value object e non entità** (`HS-6`): non formula comandi, non ha ciclo di vita, nessuna invariante lo riguarda. Promuoverlo avrebbe creato un terzo contesto per custodire un nome |

Il caso di `titolo-corso.ts` è quello che mostra meglio il costo del confine: due classi con
lo stesso nome, in due contesti, **deliberatamente diverse**. Non è duplicazione da
rifattorizzare — è la conseguenza del fatto che «titolo» significa due cose diverse ai due
lati.

### `errori.ts` — i rifiuti

Undici classi, tutte discendenti di `ErroreDiDominio`.

Sono **eccezioni e non eventi**, e la distinzione è di dominio: un evento è un fatto accaduto,
un comando rifiutato non è accaduto. Modellare `IscrizioneRifiutata` come evento vorrebbe dire
che nel racconto del dominio esiste il fatto «una persona non si è iscritta», che è un fatto
di cui nessuno ha bisogno.

I nomi sono **in italiano** e trapelano deliberatamente nel campo `error` della risposta HTTP:
è ciò che permette al frontend di distinguere i casi senza interpretare la prosa del
messaggio.

Ogni classe qui dentro ha uno stato dichiarato in `infrastructure/http/stati-http.iscrizioni.ts`,
e un [test di contratto](../shared/http/contratto-stati-http.spec.ts) fallisce se una resta
senza — aggiungere un'eccezione senza mapparla rompe la suite invece di produrre un `500` il
giorno in cui quel rifiuto capita davvero.

### `eventi.ts` — i fatti

Otto factory e la mappa dei nomi sul bus, nella forma `<contesto>.<Evento>.v<versione>`:

```
iscrizioni.SessioneProgrammata.v1        iscrizioni.DipendenteIscritto.v1
iscrizioni.CapienzaSessioneModificata.v1 iscrizioni.DipendenteMessoInAttesa.v1
iscrizioni.SessioneAnnullata.v1          iscrizioni.IscrizioneAnnullata.v1
iscrizioni.AttesaAnnullata.v1            iscrizioni.DipendentePromosso.v1
```

La versione nel nome rende il versionamento **additivo**: si pubblica `.v2` accanto a `.v1`
finché tutti i sottoscrittori sono migrati, invece di cambiare il significato di un nome
esistente e rompere chi ascoltava.

Due payload sono **ridondanti di proposito**:

- `SessioneAnnullata` porta l'elenco dei destinatari (`HS-10`);
- `DipendentePromosso` porta titolo, data e ora oltre all'indirizzo — senza di essi la
  notifica sarebbe costretta a una query per scrivere «sei passato da lista d'attesa a
  iscritto per *Kubernetes base*, giovedì 10 alle 09:00».

La ridondanza è il prezzo dell'autosufficienza, e si paga volentieri: l'alternativa è che chi
riceve l'evento debba interrogare il core proprio nel momento in cui il core ha appena
cambiato stato.

Gli eventi **non portano `eventId` né `occorsoIl`**: sono la busta, e la chiude il bus. Se li
aggiungesse l'aggregato, `domain/` avrebbe bisogno di `GeneratoreDiId` e `Orologio` in ogni
metodo che emette — due porte in più per dati che il dominio non usa mai per decidere.

### `ports/` — ciò che il dominio chiede al mondo

**`repository-sessioni.ts`** — tre metodi: `perId`, `salva`, `futureDelCorso`.

L'aggregato si carica e si salva **per intero**, iscrizioni comprese. Un caricamento parziale
sarebbe un aggregato che decide alla cieca: senza le iscrizioni non può difendere `INV-4`.

`salva` solleva `ConflittoDiVersione` se lo snapshot è cambiato dopo il caricamento — ma la
riprova non è qui, è nell'application service. Il dominio non sa cosa sia una contesa.

**`corsi-pubblicati.ts`** — due metodi: `ePubblicato`, `titoloDi`.

È l'unico modo in cui `iscrizioni` sa se un corso è pubblicato (`INV-2`), ed è la porta che
tiene in piedi il divieto di import fra contesti. Il dominio la vede come una porta, non come
una tabella altrui — e infatti dietro non c'è il catalogo, c'è una copia locale alimentata per
evento.

---

## `application/` — i casi d'uso

### La forma comune

Cinque casi d'uso, una struttura sola:

```ts
const eventi = await conRiprova(() => {
  const sessione = this.sessioni.perId(sessioneId);   // 1. carica (a ogni tentativo)
  if (sessione === null) throw new SessioneNonTrovata(…);

  sessione.faQualcosa(…, this.orologio.adesso());     // 2. l'aggregato decide
  this.sessioni.salva(sessione);                      // 3. salva

  const emessi = sessione.eventiNonPubblicati();
  sessione.svuotaEventi();
  return emessi;
});

this.bus.pubblica(eventi);                            // 4. pubblica, DOPO il salvataggio
```

Quattro cose che il caso d'uso fa, e una che non fa.

**Non decide.** Non c'è un `if` sui posti disponibili, non c'è un confronto fra date. Ogni
condizione di dominio è dentro l'aggregato. Il giorno in cui una regola comparisse qui,
esisterebbe in due posti — e il secondo prima o poi divergerebbe.

**L'ordine di 3 e 4 non è negoziabile.** Senza outbox non c'è atomicità fra stato ed evento, e
l'ordine è l'unica garanzia rimasta: un evento pubblicato prima di un salvataggio che poi
fallisce racconterebbe un fatto mai accaduto.

**`svuotaEventi()` sta dentro il blocco ritentabile**, ed è una riga nata da un test rosso.
Se il tentativo fallisce e il comando si riesegue, gli eventi del primo tentativo devono
sparire — altrimenti l'iscrizione riuscita al secondo giro pubblicherebbe anche il fantasma
del primo.

**Il tempo arriva da `this.orologio.adesso()`**, mai da `new Date()`, e una regola ESLint
copre `application/` oltre a `domain/` proprio per questo.

I cinque casi d'uso, con ciò che li distingue:

| Caso d'uso | Nota |
| --- | --- |
| `programma-sessione` | L'unico **senza** `conRiprova`: crea un aggregato nuovo, non c'è versione da contendere. Chiede a `CorsiPubblicati` e passa `null` all'aggregato se il corso non risulta pubblicato — la decisione resta dell'aggregato |
| `iscriviti` | Restituisce l'esito, non lo prevede — come **unione discriminata**: `{ esito: 'ISCRITTO' }` oppure `{ esito: 'IN_ATTESA', posizione }`. «Iscritto con una posizione in coda» è uno stato che non deve poter essere rappresentato, e il tipo lo impedisce. È la ragione per cui il frontend non deve disabilitare il bottone leggendo i posti residui |
| `annulla-iscrizione` | **Non sa che la promozione è avvenuta**: la vede solo passare fra gli eventi da pubblicare. È il segno che il confine è al posto giusto |
| `modifica-capienza` | Un aumento può produrre più `DipendentePromosso` in un colpo solo |
| `annulla-sessione` | Nessun controllo sull'inizio: una sessione già iniziata si può ancora annullare — l'annullamento racconta un fatto, non prenota il futuro |

### `con-riprova.ts`

Tre tentativi, attese `0 / 10 / 25` ms, poi `ConflittoDiVersioneNonRisolto` → `503` con
`Retry-After: 1`.

La parte interessante non è il ciclo, è ciò che il ciclo rende possibile:

> **Non esiste un ramo di codice per «ho perso la gara».**

Al secondo tentativo l'aggregato viene ricaricato e l'iscrizione dell'altro è visibile: la
normale regola dei posti produce da sola l'esito giusto — il rifiuto per duplicato, oppure
l'ingresso in lista d'attesa. La contesa non diventa un caso di dominio; resta un dettaglio
dell'application layer.

Da qui il vincolo su chi lo usa: **l'operazione deve ricaricare l'aggregato a ogni
tentativo**, altrimenti riapplica il comando a uno stato vecchio e il conflitto si ripresenta
identico.

> **Nota onesta.** Con l'archivio in memoria e un solo processo questo meccanismo è
> **corretto ma inerte**: fra il caricamento e il salvataggio non c'è punto di sospensione in
> cui un'altra esecuzione possa inserirsi. Diventa indispensabile al primo `await` dentro la
> persistenza, cioè al primo database. È scritto ora perché scriverlo dopo significherebbe
> rileggere tutti i casi d'uso.

### `comandi.ts`

Interfacce con campi **primitivi**, nomi **in italiano**. I value object li costruisce il caso
d'uso. È ciò che permette a un comando di nascere da un test, da una policy o da un futuro job
di importazione senza passare da HTTP.

Due assenze deliberate:

- In `Iscriviti` e `AnnullaIscrizione` **non c'è il `dipendenteId` fra i dati della
  richiesta**: lo inietta il controller dall'utente corrente (`INV-9`, `HS-11`).
- **In nessun comando compare un istante.** Se il tempo fosse un campo, la regola delle 24 ore
  sarebbe aggirabile con un valore nel corpo della richiesta.

### `policy/` — P2

`annulla-sessioni-corso-ritirato.policy.ts`: il ritiro di un corso annulla le sue sessioni
**future**, non quelle passate (`INV-11`).

Due dettagli che sembrano minuzie e non lo sono:

1. **Chiama il caso d'uso, non manipola gli aggregati.** Se annullasse direttamente, la regola
   «annullare una sessione già annullata è rifiutato» esisterebbe in due punti.
2. **Ignora `SessioneGiaAnnullata`.** Sotto consegna at-least-once una riconsegna dello stesso
   evento è l'esito normale, non un problema: la seconda volta le sessioni sono già annullate
   e va bene così.

La policy riceve un `corsoId` e **non sa da dove arrivi** — potrebbe essere un evento, un test
o un comando manuale. A collegarla al bus è l'handler in `infrastructure/`.

---

## `infrastructure/` — il mondo esterno

### `persistence/`

Tre file, tre responsabilità separate di proposito.

**`sessione.snapshot.ts`** — lo stato piatto, senza comportamento. Sostituisce la riga di
tabella.

Le **iscrizioni sono annidate** dentro lo snapshot della sessione, non in una collezione a
sé. Con SQL erano una tabella separata legata dall'unica foreign key del sistema; qui il
confine dell'aggregato si esprime ancora meglio — non esiste una collezione di iscrizioni da
cui qualcuno possa pescarle scavalcando la `Sessione`, che è precisamente ciò che il confine
significa.

Data e ora restano **stringhe**, mai numeri: un intero in millisecondi reintrodurrebbe il
fuso orario che il modello ha escluso, e i due formati sono lessicograficamente ordinabili —
il filtro «sessioni future» funziona per costruzione, confrontando stringhe.

**`sessione.mapper.ts`** — la traduzione, **scritta a mano**, in entrambe le direzioni.

È lavoro in più ed è deliberato. Appena si lascia che sia un ORM a tradurre, è l'ORM a dettare
la forma del modello: il costruttore privato diventa pubblico perché gli serve,
`Iscrizione.ordine` diventa un `@Column`, e la classe smette di poter garantire i propri
invarianti alla costruzione.

Difende anche da qualcosa di più insidioso. Senza traduzione, il repository conserverebbe il
**riferimento** all'aggregato: chi muta una `Sessione` senza salvarla vedrebbe comunque la
mutazione al caricamento successivo, con `salva()` ridotto a una chiamata decorativa. Il
sistema continuerebbe a funzionare e i test a passare — per il motivo sbagliato.

**`repository-sessioni.in-memoria.ts`** — l'implementazione della porta.

```ts
salva(sessione: Sessione): void {
  this.sessioni.salva(
    sessione.id.valore,
    aSnapshot(sessione, sessione.versioneLetta + 1),
    sessione.versioneLetta,          // ← il check-and-set confronta questa
  );
}
```

La classe `SessioniInMemoria` è un **provider a sé** e non un campo privato del repository:
serve perché il futuro read model possa leggere gli stessi snapshot senza passare da qui —
le letture non hanno bisogno di aggregati.

`futureDelCorso` filtra sulle **stringhe** dello snapshot e ricostruisce solo ciò che
sopravvive al filtro, invece di istanziare aggregati che verrebbero subito scartati. Non
filtra per stato: una sessione già annullata può comparire, e la policy la ignora.

### `http/`

**`sessions.controller.ts`** — cinque rotte, e **l'unico punto in cui avviene la traduzione**
inglese ↔ italiano. `courseId` → `corsoId`, `IN_ATTESA` → `WAITLISTED`.

Due rotte meritano attenzione:

- `POST /sessions/:id/enrollments` **non ha corpo**. L'identità di chi si iscrive viene dal
  decoratore `@Utente()`. Risponde `201` sia per `ENROLLED` sia per `WAITLISTED`, perché
  entrambi sono successi.
- `DELETE /sessions/:id/enrollments/me` — quel `me` al posto di un parametro è **metà della
  difesa di `INV-9`** (`HS-11`): un attacco non ha nulla da manomettere perché non c'è alcun
  campo da manomettere. L'altra metà è la firma dell'aggregato, che accetta il dipendente e
  cerca *la sua* iscrizione.

**`dto.ts`** — i DTO in inglese, con `class-validator`.

La validazione qui **non è ridondante** rispetto ai value object: «questa richiesta HTTP è ben
formata?» e «questo valore può esistere nel mio dominio?» sono domande distinte. Il criterio è
netto — cancellare la `ValidationPipe` deve lasciare il dominio altrettanto sicuro, solo con
messaggi peggiori.

`PlaceDto` è il caso che dimostra il costo di sbagliare la traduzione di un tipo somma:

```ts
@ValidateIf((dto: PlaceDto) => dto.type === 'AULA')
@IsString()
name?: string;
```

Senza `@ValidateIf` i decoratori si applicano comunque ai campi opzionali, e una sessione
online veniva rifiutata con «name must be a string» — un vincolo che il modello non ha. È un
bug che **nessun test unitario poteva vedere**, perché vive nella traduzione fra il DTO e il
dominio: è saltato fuori solo provando la rotta davvero.

**`stati-http.iscrizioni.ts`** — la tabella eccezione → stato, con il criterio esplicito:

- **409** — lo *stato dell'aggregato* rifiuta un comando che in un altro momento sarebbe stato
  valido, o che è già stato eseguito. Il client può riconciliarsi rileggendo.
- **422** — una *regola di business* rifiuta i dati o il momento, e rileggere non cambia
  nulla. Comprende tutto ciò che dipende dal trascorrere del tempo, perché il tempo non torna
  indietro.

### `acl/` — l'anticorruption layer

`replica-corsi-pubblicati.ts` è insieme due cose: l'**implementazione della porta**
`CorsiPubblicati` e un **handler del bus**. Tiene una mappa `corsoId → { titolo, pubblicato }`
alimentata da tre eventi del catalogo.

Non è una lettura del catalogo: è una **copia**, e il dominio non sa che esista un altro
modulo.

Il dettaglio più sottile sta in `DettagliCorsoModificati`: aggiorna il titolo **solo se il
corso è già noto** alla replica. Un corso ancora in bozza non deve comparire, o `INV-2` si
aprirebbe un varco — si potrebbe programmare una sessione per un corso mai pubblicato. Per la
stessa ragione l'ACL **non ascolta `CorsoCreato`**, e c'è un test che lo verifica
esplicitamente.

Su `CorsoRitirato` la voce resta in mappa con `pubblicato: false` **conservando il titolo**:
le sessioni già programmate continuano a mostrarlo.

I nomi degli eventi sono **stringhe, non import**:

```ts
export const EVENTI_CATALOGO_ASCOLTATI = {
  CORSO_PUBBLICATO: 'catalogo.CorsoPubblicato.v1',
  …
} as const;
```

Importare `NOMI_EVENTI_CATALOGO` sembrerebbe più sicuro e sarebbe l'inizio della fine: «solo
per le costanti» è l'eccezione con cui due contesti tornano a essere uno. Il contratto è **il
nome sul bus**, e come ogni contratto va scritto due volte e verificato — cosa che fa
[`contratto-acl.spec.ts`](infrastructure/acl/contratto-acl.spec.ts), importando entrambi i
lati perché i test sono esentati dal divieto.

**La finestra di `HS-8`, dichiarata.** Fra il ritiro di un corso e l'aggiornamento della
replica esiste un istante in cui `ePubblicato` risponde ancora `true` e una sessione può
nascere. Non è un difetto rimosso, è un difetto **conosciuto e riparato**: la policy P2
annulla anche quella sessione, purché l'ACL aggiorni **prima** che la policy annulli. La
consistenza è eventuale e auto-riparante.

### `event-handlers/`

`corso-ritirato.handler.ts` collega l'evento alla policy, e non fa altro. Esiste per tenere la
policy ignara del bus.

Va **sottoscritto dopo l'ACL**, e l'ordine è fissato in `app.module.ts`:

```ts
onModuleInit(): void {
  this.bus.sottoscrivi(this.acl);            // 1. la replica si aggiorna
  this.bus.sottoscrivi(this.corsoRitirato);  // 2. la policy annulla
}
```

Due righe che sembrano cablaggio e sono **una decisione di dominio**: invertite, una sessione
programmata nella finestra di `HS-8` sopravviverebbe al ritiro.

---

## Il flusso di una chiamata

Questa sezione risponde a una domanda sola: **quando arriva una richiesta HTTP, chi decide cosa
e in quale ordine?** Prima lo schema valido per tutte le rotte di comando, poi un esempio reale
seguito riga per riga.

La cosa da tenere d'occhio è **dove stanno i controlli**. Sono sparsi su cinque strati, e non
per disordine: ognuno risponde a una domanda diversa, e nessuno può rispondere a quella
dell'altro.

### Il caso generico

```
   ┌──────────────────────────────────────────────────────────────────────────┐
   │ HTTP                                                      main.ts        │
   │                                                                          │
   │  [1] routing         /api/… → controller, oppure 404                     │
   │  [2] ValidationPipe  la richiesta è ben formata?      → 400              │
   │  [3] @Utente()       chi sta chiamando?               → 400 senza header │
   └──────────────────────────────┬───────────────────────────────────────────┘
                                  │  DTO in inglese
   ┌──────────────────────────────▼───────────────────────────────────────────┐
   │ CONTROLLER                               infrastructure/http/            │
   │                                                                          │
   │  [4] traduce in comando italiano: nessun if, nessuna regola              │
   └──────────────────────────────┬───────────────────────────────────────────┘
                                  │  comando { campi primitivi }
   ┌──────────────────────────────▼───────────────────────────────────────────┐
   │ USE CASE                                       application/              │
   │                                                                          │
   │  [5] costruisce i value object   valore rappresentabile?  → 400          │
   │  [6] conRiprova ─┐                                                       │
   │  [7]   carica    │  l'aggregato esiste?                   → 404          │
   │  [8]   INVOCA L'AGGREGATO  ↓↓↓                                           │
   │  [9]   salva     │  qualcuno ha scritto?  ── sì ──→ torna a [7]          │
   │ [10]   raccoglie gli eventi e svuota                                     │
   │ [11] pubblica sul bus ── DOPO il salvataggio                             │
   └──────────────────────────────┬───────────────────────────────────────────┘
                                  │  sessione.iscrivi(…, adesso)
   ┌──────────────────────────────▼───────────────────────────────────────────┐
   │ AGGREGATO                                           domain/              │
   │                                                                          │
   │  (a) precondizioni di stato   annullata? iniziata?    → 409 / 422        │
   │  (b) regole di dominio        duplicato? fuori tempo? → 409 / 422        │
   │  (c) DECIDE, e muta se stesso ← l'unico punto in cui si decide           │
   │  (d) emette gli eventi                                                   │
   │  (e) assicuraCoerenza()       se scatta è un bug      → 500              │
   └──────────────────────────────┬───────────────────────────────────────────┘
                                  │  l'aggregato, mutato
   ┌──────────────────────────────▼───────────────────────────────────────────┐
   │ PERSISTENZA                     infrastructure/persistence/              │
   │                                                                          │
   │ [12] mapper → snapshot piatto: nessun oggetto di dominio in archivio     │
   │ [13] check-and-set sulla versione   → ConflittoDiVersione,               │
   │                                       intercettato da [6]                │
   └──────────────────────────────────────────────────────────────────────────┘

   Qualunque eccezione risalga → FiltroEccezioniDiDominio
                              → { error, message, status }, uniforme
```

Tre proprietà di questo schema meritano di essere dette a voce alta:

1. **Il flusso è a senso unico.** Ogni strato conosce solo quello sotto di sé, e l'aggregato non
   conosce nessuno. Nessuna freccia risale, tranne le eccezioni.
2. **La decisione avviene in un punto solo**, `(c)`. Tutto ciò che sta prima è preparazione,
   tutto ciò che sta dopo è registrazione.
3. **La riprova avvolge da `[7]` a `[10]`**, non solo il salvataggio: riprovare significa
   *ricaricare e ridecidere*, non ritentare la scrittura di una decisione vecchia.

### I controlli, in ordine di apparizione

| # | Controllo | Dove vive | A quale domanda risponde | Se fallisce |
| --- | --- | --- | --- | --- |
| `[1]` | Rotta esistente | Nest | «questo URL esiste?» | `404` |
| `[2]` | Forma del DTO | `ValidationPipe` + `dto.ts` | «questa **richiesta HTTP** è ben formata?» | `400` |
| `[3]` | Presenza dell'identità | `shared/http/utente-corrente.ts` | «chi sta chiamando?» | `400` |
| `[5]` | Value object | `domain/value-objects/` | «questo **valore** può esistere nel dominio?» | `400` (`ValoreNonValido`) |
| `[7]` | Esistenza dell'aggregato | use case | «di cosa stiamo parlando?» | `404` |
| `(a)` | Stato dell'aggregato | `Sessione` | «in questo **stato** il comando è ammesso?» | `409` / `422` |
| `(b)` | Regole di dominio | `Sessione` | «questa **richiesta** è ammessa adesso, da costui?» | `409` / `422` |
| `(e)` | Coerenza interna | `assicuraCoerenza()` | «l'aggregato è rimasto valido?» | `500` — è un bug |
| `[13]` | Versione | `CollezioneInMemoria` | «qualcuno ha scritto mentre decidevamo?» | riprova, mai visibile |

**`[2]` e `[5]` sembrano lo stesso controllo e non lo sono**, ed è il caso da capire per capire
tutto il resto. `@IsInt() @Min(1)` sul DTO e `Capienza.da()` nel dominio verificano lo stesso
numero, ma rispondono a domande diverse: la prima riguarda un client HTTP, la seconda vale
**anche quando il comando non arriva da HTTP** — da una policy, da un handler, da un test. Il
criterio è verificabile: cancellare la `ValidationPipe` deve lasciare il dominio altrettanto
sicuro, solo con messaggi peggiori.

**`(a)` e `(b)` sono separati perché producono stati diversi.** Una precondizione di stato è un `409`:
il client può riconciliarsi rileggendo, e in un altro momento lo stesso comando sarebbe passato.
Una regola di business è un `422`: rileggere non cambia nulla, perché il tempo non torna
indietro.

E soprattutto: **l'ordine non è ottimizzabile a piacere**. I controlli vanno dal più economico
al più costoso, ma la ragione vera è un'altra — «c'è posto per me?» è l'**ultima** domanda, e
non può essere anticipata. Chiederla prima, magari a un read model, significherebbe decidere su
un dato letto un istante fa, che è esattamente l'anti-pattern che fa prendere a due dipendenti
lo stesso ultimo posto.

### L'esempio: iscriversi a una sessione piena

La chiamata più significativa del sistema, perché attraversa ogni strato e finisce con
l'esito che il committente ha chiesto di non trattare come errore.

```http
POST /api/sessions/8f3e.../enrollments
X-Utente: bruno@example.com
```

Stato di partenza: sessione da **1 posto**, Anna già iscritta, coda vuota.

| | Cosa succede | File |
| --- | --- | --- |
| `[1]` | Nest instrada su `SessionsController.iscrivi` | `sessions.controller.ts` |
| `[2]` | La `ValidationPipe` non ha nulla da validare: **questa rotta non ha corpo**, e non per dimenticanza — il dipendente non è un campo (`INV-9`, `HS-11`) | `main.ts` |
| `[3]` | `@Utente()` legge `x-utente`, normalizza `bruno@example.com`, ne deriva l'UUID v5 `a1b2…`. Header assente → `400`, e qui finisce | `utente-corrente.ts` |
| `[4]` | Il controller costruisce il comando — e non fa altro: `{ sessioneId: '8f3e…', dipendenteId: 'a1b2…', email: 'bruno@example.com' }` | `sessions.controller.ts` |
| `[5]` | `SessioneId.da()`, `DipendenteId.da()`, `Email.da()`. Se l'header fosse `bruno` senza `@`, **qui** nascerebbe `ValoreNonValido` → `400`: nessun DTO valida quell'header, il value object è l'unica difesa | `value-objects/` |
| `[6]` | `conRiprova` apre il primo tentativo | `con-riprova.ts` |
| `[7]` | `repository.perId()` → snapshot clonato → `aDominio` → `Sessione.ricostruisci`. Nessuna regola viene applicata: si sta ripristinando un fatto, non compiendolo. `null` → `SessioneNonTrovata` → `404` | `repository-sessioni.in-memoria.ts` |
| `[8]` | `sessione.iscrivi(dipendenteId, email, orologio.adesso())` — **il tempo entra qui, da una porta**, non da `new Date()` | `iscriviti.use-case.ts` |
| `(a)` | `esigiNonAnnullata()` → `409` · `esigiNonIniziata(adesso)` → `422` | `sessione.ts` |
| `(b)` | Bruno è già presente? No. Se lo fosse: `IscrizioneDuplicata` → `409` | `sessione.ts` |
| `(c)` | `numeroIscritti() (1) < capienza (1)` è **falso** → `IN_ATTESA`, con `ordine = 2`. **Nessuna eccezione**: non è un rifiuto, è l'altro esito | `sessione.ts` |
| `(d)` | Emette `DipendenteMessoInAttesa` con `posizione: 1` | `eventi.ts` |
| `(e)` | `assicuraCoerenza()`: 1 ≤ 1 ✓, nessun posto libero con coda non vuota ✓, ordini distinti ✓ | `sessione.ts` |
| `[9]` | `repository.salva()` → `aSnapshot(…, versioneLetta + 1)` → check-and-set: la versione in archivio è ancora quella letta, la scrittura passa | `sessione.mapper.ts` |
| | `sessione.posizioneInCoda(bruno)` → `1` — letta **dopo** il salvataggio, sulla coda di adesso | `sessione.ts` |
| `[10]` | Raccoglie l'evento e chiama `svuotaEventi()`: se ci fosse una riprova, il fantasma del tentativo precedente non deve sopravvivere | `iscriviti.use-case.ts` |
| `[11]` | `bus.pubblica([DipendenteMessoInAttesa])` — **dopo** il salvataggio. La consegna agli handler è asincrona e non trattiene la risposta | `event-bus-in-process.ts` |
| `[4']` | Il controller ritraduce in inglese: `IN_ATTESA` → `WAITLISTED` | `sessions.controller.ts` |

```http
201 Created
{ "status": "WAITLISTED", "position": 1 }
```

**`201`, non `409`.** È il punto in cui l'intero esercizio si vede in una riga di risposta: a
posti esauriti non si viene respinti. Un `409` qui sarebbe la traduzione HTTP di un errore che
il dominio ha deliberatamente evitato di commettere.

Se invece la sessione avesse avuto un posto libero, sarebbe cambiato **solo il ramo `(c)`** —
stesso percorso, stesso numero di scritture, evento diverso e `{ "status": "ENROLLED" }`.

### Quando il salvataggio trova la versione cambiata

Stesso esempio, ma fra il passo `[7]` e il passo `[9]` qualcun altro ha scritto la stessa
sessione:

```
 [7] carica       versione 4
 (c) decide       "c'è posto: ISCRITTO"          ← deciso su uno stato ormai vecchio
 [9] salva        in archivio c'è la versione 5  → ConflittoDiVersione
      │
      └── conRiprova intercetta, attende 10 ms, e ricomincia da [7]
 [7] ricarica     versione 5, con l'iscrizione dell'altro
 (c) ridecide     "posti esauriti: IN_ATTESA"    ← la stessa regola, su uno stato aggiornato
 [9] salva        versione 6 ✓
```

Il punto è ciò che **non** compare in quello schema:

> Non esiste un ramo di codice per «ho perso la gara». C'è solo la regola di dominio riapplicata
> a uno stato aggiornato.

L'aggregato non sa che c'è stata una contesa, e non ha un caso in più da gestire. Esaurite le tre
riprove, `ConflittoDiVersioneNonRisolto` → `503` con `Retry-After: 1` — l'unico caso in cui il
client vede il meccanismo, ed è dichiarato come fallimento **tecnico** e ritentabile, non come
rifiuto di dominio.

*(Nota onesta, già scritta sopra: con un solo processo e persistenza sincrona questo ramo non
scatta spontaneamente. Il test di livello 3 lo costruisce a mano.)*

### Cosa non c'è nel flusso

L'elenco delle assenze dice quanto lo schema:

- **Nessuna autorizzazione.** Niente guard, niente ruoli, nessun `403`. `INV-9` non è un
  controllo di accesso: è la domanda «di chi è questa iscrizione?», e vive nel dominio.
- **Nessuna decisione nel controller.** Non c'è un `if` sui posti residui, né un controllo di
  stato prima di chiamare l'use case. Se ci fosse, la regola esisterebbe in due punti.
- **Nessuna lettura per decidere.** Il read model non compare in nessun passo di scrittura:
  serve a *mostrare*, mai a *decidere*.
- **Nessuna chiamata al catalogo.** Dove serve sapere se un corso è pubblicato — in
  `ProgrammaSessione` — si interroga la porta `CorsiPubblicati`, cioè una replica locale. Il
  confine fra contesti non viene mai attraversato in modo sincrono.

---

## Il percorso completo di una richiesta

Il secondo esempio, e quello che mostra `HS-4` in azione:
`DELETE /api/sessions/abc/enrollments/me`, con l'ultimo posto occupato e due persone in coda:

```
1. ValidationPipe          nessun corpo da validare
2. @Utente()               X-Utente → email normalizzata → UUID v5 deterministico
3. SessionsController      traduce in comando: { sessioneId, dipendenteId }
4. AnnullaIscrizioneUseCase
   └─ conRiprova ──┐
5.   repository    │       snapshot → mapper → Sessione ricostruita per intero
6.   Sessione.annullaIscrizione(dipendenteId, adesso)
     ├─ INV-6      │       non è annullata
     ├─ INV-9      │       cerca LA SUA iscrizione, non ne accetta altre
     ├─ INV-10     │       adesso < inizio − 24h
     ├─ rimuove    │       → evento IscrizioneAnnullata
     ├─ HS-4       │       promuove il primo in coda → evento DipendentePromosso
     └─ assicuraCoerenza   INV-4, INV-5, INV-7, INV-8
7.   repository.salva      mapper → snapshot → check-and-set sulla versione
8.   svuotaEventi ─┘
9. bus.pubblica            i due eventi, DOPO il salvataggio
10. 204 No Content
```

Se al passo 7 la versione non coincidesse, `ConflittoDiVersione` riporterebbe l'esecuzione al
passo 5 con lo stato aggiornato — senza che nessuna regola di dominio se ne accorga.

## Dove sono presidiate le invarianti

| # | Invariante | Presidiata da |
| --- | --- | --- |
| `INV-2` | Si programma solo su un corso pubblicato | `Sessione.programma` + porta `CorsiPubblicati` |
| `INV-3` | Capienza intera ≥ 1 | `Capienza` (value object) |
| `INV-4` | Iscritti ≤ capienza | `Sessione.iscrivi` + `assicuraCoerenza` |
| `INV-5` | Un dipendente una volta sola per sessione | `Sessione.iscrivi` + `assicuraCoerenza` |
| `INV-6` | Non ci si iscrive a sessione annullata o iniziata | `esigiNonAnnullata`, `esigiNonIniziata` |
| `INV-7` | Ordine di arrivo univoco | `Iscrizione.ordine`, assegnato dalla radice + `assicuraCoerenza` |
| `INV-8` | Mai posti liberi con la coda non vuota | `promuoviDallaCoda` + `assicuraCoerenza` |
| `INV-9` | Si annulla solo la propria iscrizione | firma di `annullaIscrizione` + rotta `/me` |
| `INV-10` | Annullamento fino a 24 ore prima | `annullaIscrizione` + `IstanteLocale.menoOre` |
| `INV-11` | Il ritiro annulla solo le sessioni future | policy P2 + `repository.futureDelCorso` |
| `INV-12` | `ANNULLATA` è terminale | `Sessione.annulla` |

`INV-1` (unicità del titolo del corso) non compare: è del catalogo, ed è l'unica invariante che
nessun aggregato può difendere — vive nella persistenza, in
[`shared/persistence/indice-unico.ts`](../shared/persistence/indice-unico.ts).

---

Le motivazioni estese, con le alternative scartate, stanno in
[`aggregation.md`](../../../../doc/aggregation.md) e
[`domain.md`](../../../../doc/domain.md).
