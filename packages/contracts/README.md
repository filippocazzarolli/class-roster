# `@repo/contracts`

Il confine HTTP, dichiarato una volta sola: la forma dei corpi di richiesta e risposta delle
rotte di `architecture.md` §4.6, in inglese, senza un solo tipo di dominio.

**Sono soltanto tipi.** Nessuna funzione, nessuna costante, nessun `enum`: il pacchetto non
esiste a runtime. Per questo `exports` dichiara solo la condizione `types` — se un giorno
qualcuno provasse a importarne un valore, il bundler non troverebbe nulla da caricare, ed è
il fallimento giusto nel momento giusto.

## Chi lo usa, e come

| Lato | Uso |
|---|---|
| `apps/api` | i DTO `class-validator` fanno `implements` di questi tipi: i decoratori restano nel backend, la forma sta qui. Una divergenza è un errore di compilazione, non un bug scoperto dal browser |
| `apps/web-*`, `@repo/api-client` | li consumano come unico vocabolario del confine — mai `apps/api/src/**` (`architecture.md` §4.11) |

## Cosa non c'è

Le tre letture di `architecture.md` §4.5 — R1, R2, R3 — **non sono ancora implementate nel
backend**. I loro tipi qui dentro sono marcati come proposta: sono derivati dai campi che §4.5
dichiara, e vanno confermati nel momento in cui il read model viene scritto.
