# class-roster

Esercizio di **Domain Driven Design**: l'academy interna di un'azienda, con catalogo corsi,
sessioni a posti limitati e lista d'attesa.

L'obiettivo non è il software funzionante. È il **percorso che porta dal dominio al codice** —
e il fatto che ogni scelta lungo quel percorso sia scritta, motivata e rintracciabile.

> ⚠️ **Stato: solo documentazione.** Non c'è ancora codice. La cartella [`doc/`](doc/) è, al
> momento, l'intero progetto.

---

## Il dominio in tre righe

Il responsabile della formazione cura un catalogo di corsi e ne programma le sessioni: una
data, un luogo, un docente, un numero massimo di partecipanti. Il dipendente si iscrive; a
posti esauriti entra in lista d'attesa. Quando qualcuno annulla, il posto liberato va al primo
della coda — non al primo che ricarica la pagina.

L'ultima frase è tutto l'esercizio. Il resto è contorno.

---

## Perché vale la pena leggerlo

**Due aggregati in tutto il sistema.** `Corso` e `Sessione`. È poco, ed è il segno che i
confini sono stati tracciati sul verbo — *decidere* — e non sul sostantivo.

**Un'invariante che il committente non ha mai pronunciato.** «Se ci sono posti liberi, la lista
d'attesa è vuota» non compare in nessun requisito: nasce incrociando due regole dette. È
diventata l'argomento decisivo di tre decisioni su quattordici, ed è il risultato più utile
dell'event storming.

**Ogni decisione ha un costo dichiarato.** Nessuna sezione si chiude con «è la best practice».
Quattordici punti di decisione non ovvia, ciascuno con l'alternativa scartata, il prezzo pagato
e — dove ha senso — quale nuovo requisito lo farebbe cambiare idea.

**Si comincia dall'event storming.** Non esiste un documento di specifiche a monte: c'è il
dominio raccontato, e da lì tutto è derivato un documento alla volta. Ogni scelta tecnica
compare nel momento in cui il dominio la rende necessaria, mai prima.

---

## La documentazione

Il punto di ingresso è **[`doc/README.md`](doc/README.md)**: indice, mappa delle decisioni e
percorsi di lettura secondo cosa cerchi.

I quattro documenti vanno letti in sequenza — ognuno chiude ciò che il precedente ha lasciato
aperto, e nessuno anticipa decisioni che spettano al successivo:

| # | Documento | La domanda a cui risponde |
|---|---|---|
| 1 | [event-storming.md](doc/event-storming.md) | Cosa **accade** nel dominio: eventi, comandi, attori, policy — e cosa non torna |
| 2 | [domain.md](doc/domain.md) | Dove passano i **confini**: sottodomini, bounded context, come si parlano |
| 3 | [aggregation.md](doc/aggregation.md) | Chi **custodisce** quale invariante: aggregati, entità, value object |
| 4 | [architecture.md](doc/architecture.md) | Come diventa **codice**: contratti, persistenza, guardiani, test |

Se hai dieci minuti: `doc/README.md`, poi `event-storming.md` §1.0 e `aggregation.md` §3.6.

---

## Come sarà fatto

| Ambito | Scelta |
|---|---|
| Monorepo | Turborepo + pnpm |
| Backend | NestJS — **un solo progetto**, moduli per bounded context |
| Frontend | React, **due app**: una per attore |
| Persistenza | SQL state-based con Drizzle — SQLite in sviluppo, schema portabile su Postgres |
| Eventi fra contesti | Event bus in-process, handler asincroni, tabella outbox |
| Identità | Nessuna autenticazione: header `X-Utente`, letto in un solo punto |

```
apps/
├── api/                  iscrizioni · catalogo · notifiche · shared
├── web-dipendente/       sessioni aperte, le mie iscrizioni
└── web-formazione/       catalogo corsi, programmazione sessioni
packages/
├── contracts/            DTO e tipi delle rotte — nessun tipo di dominio
├── api-client/           fetch tipizzato
├── ui/                   componenti ignoranti di dominio
└── dev-identity/         selettore utente
```

Il numero di app frontend è **invisibile al backend**: i moduli dell'API sono i bounded
context, mai gli attori. E `packages/contracts` è il punto in cui la traduzione è già avvenuta
— il frontend vede `Session`, mai `Sessione`.

---

## Le regole che il codice dovrà rispettare

Poche, e imposte da guardiani automatici invece che dalla buona volontà — la configurazione sta
in `doc/architecture.md` §4.9.

- **Il dominio non conosce il framework.** Test brutale: cancellando `infrastructure/`, il
  dominio compila ancora.
- **`iscrizioni` e `catalogo` non si importano.** Se serve un dato, arriva per evento e passa
  dall'anticorruption layer.
- **Nessuna foreign key fra moduli.** Il `corsoId` dentro `iscrizioni` è una copia, non un
  riferimento.
- **Niente `new Date()`** nel dominio: il tempo entra da una porta.
- **Il dominio è in italiano**, rotte e DTO in inglese, traduzione solo nei controller.

---

Il criterio che ha arbitrato ogni decisione della documentazione, e che varrà identico per ogni
riga di codice:

> Questa decisione rende **più visibile** il modello di dominio, o lo nasconde dietro
> l'infrastruttura?
