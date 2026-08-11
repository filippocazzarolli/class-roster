# web-formazione

L'app del **responsabile formazione** — `architecture.md` §4.11.

```
pnpm dev          # http://localhost:5174, con /api inoltrato a :3001
```

## Struttura

Le cartelle di primo livello sotto `src/` sono i **bounded context**, non i tipi tecnici:

```
src/
├── app/            ciò che non appartiene a nessun contesto
│   ├── api.ts          createApi, costruito una volta sola
│   ├── errori.ts       HttpError → frase, sul nome dell'eccezione
│   ├── formato.ts      date, ore e luoghi resi leggibili
│   └── lettura.ts      useLettura: lo stato di una lettura del read model
├── catalogo/       ← contesto `catalogo`
│   ├── pagine/         elenco, creazione, modifica
│   └── componenti/     form del corso, etichetta di stato
└── iscrizioni/     ← contesto `iscrizioni`
    ├── pagine/         sessioni di un corso, tutte le sessioni
    └── componenti/     card della sessione, form di programmazione
```

**Perché per contesto.** Questa app ne attraversa due, `web-dipendente` uno solo: è la
prova che §4.11 chiedeva di rendere visibile — le app non coincidono con i bounded
context. Con cartelle per tipo (`pages/`, `components/`, `hooks/`) quel fatto sarebbe
invisibile, e la vista catalogo — che compone R3 leggendo da entrambi — sembrerebbe una
schermata come le altre invece che il punto in cui i due contesti si toccano.

Non si imita invece la struttura dell'api: niente `domain/`, `application/`,
`infrastructure/`. Il frontend consuma DTO e non ha oggetti di dominio (§4.11), quindi
quelle cartelle sarebbero un guscio vuoto che ne imita la forma senza averne le ragioni.

## Cosa vive qui e non in `packages/ui`

`iscrizioni/componenti/card-sessione.tsx` esiste anche in `web-dipendente`, diversa. È
deliberato: §4.11 vieta un `CardSessione` condiviso, perché il responsabile vede gli
iscritti e un bottone «Annulla» mentre il dipendente vede i posti residui e un bottone
«Iscriviti». Un componente solo diventerebbe un albero di `if` sull'attore. In `ui` va solo
ciò che non sa di dominio.

## Le viste

| Rotta | Lettura | Comandi |
|---|---|---|
| `/corsi` | R3 — `GET /courses` **+** `GET /sessions` composte qui | `publish`, `withdraw` |
| `/corsi/nuovo` | — | `POST /courses` |
| `/corsi/:id/modifica` | R3, filtrata per id | `PATCH /courses/:id` |
| `/corsi/:id/sessioni` | R4 — `GET /sessions?courseId=` | `POST /sessions`, `capacity`, `cancel` |
| `/sessioni` | R4 senza filtro | `capacity`, `cancel` |

Le due letture di R3 restano **due chiamate composte nel frontend**: una lettura sola che
attraversasse i due archivi sarebbe la foreign key fra moduli rifiutata da `domain.md`
§2.9.

## Identità

Non c'è autenticazione: l'header `X-Utente` lo imposta `app/api.ts`, con un indirizzo
fisso. `packages/dev-identity` — il selettore utente di §4.11 — non è ancora scritto;
quando arriverà, il punto di aggancio è già la funzione `currentUser` passata a
`createApi`.
