# web-dipendente

L'app del **dipendente** — `architecture.md` §4.11.

```
pnpm dev          # http://localhost:5173, con /api inoltrato a :3001
```

## Struttura

Come in `web-formazione`, le cartelle sotto `src/` sono i **bounded context**:

```
src/
├── app/            ciò che non appartiene a nessun contesto
│   ├── api.ts          createApi, costruito una volta sola
│   ├── errori.ts       HttpError → frase, sul nome dell'eccezione
│   ├── formato.ts      date, ore e luoghi resi leggibili
│   └── lettura.ts      useLettura: lo stato di una lettura del read model
└── iscrizioni/     ← l'unico contesto che questa app consuma
    ├── pagine/         sessioni aperte, le mie iscrizioni
    └── componenti/     card della sessione aperta, card della mia iscrizione
```

**Una sola cartella di contesto**, contro le due di `web-formazione`. Non è
un'asimmetria da correggere: è esattamente ciò che §4.11 voleva rendere visibile — il
dipendente consuma un contesto, il responsabile ne attraversa due, e le app non coincidono
con i bounded context.

`app/errori.ts` e `app/formato.ts` sono **copie** di quelle dell'altra app, non un pacchetto
condiviso: gli errori coperti sono quelli che *questo* attore può provocare, e sono altri.
§4.11 chiede di duplicare e di condividere solo quando le due copie sono rimaste identiche
abbastanza a lungo.

## Le viste

| Rotta | Lettura | Comandi |
|---|---|---|
| `/sessioni` | R1 — `GET /sessions/open` | `POST /sessions/:id/enrollments` |
| `/sessioni?cambio=:id` | R1 + R2 | il cambio sessione, guidato |
| `/iscrizioni` | R2 — `GET /enrollments/me` | `DELETE /sessions/:id/enrollments/me` |

## Due comportamenti che vengono dal dominio

Non sono scelte di interfaccia, e §4.11 chiede di implementarli come tali:

- **Il bottone «Iscriviti» resta abilitato anche a zero posti residui.** Sarà
  `status: WAITLISTED` a dire cosa è successo. `remainingSeats` si mostra e non si usa per
  decidere: chi decide se il posto c'è è la `Sessione`, con l'aggregato caricato per intero
  e il lock ottimistico. Lo stesso vale per `cancellable`, che è un suggerimento e non un
  permesso — il rifiuto vero arriva come `AnnullamentoFuoriTermine`.
- **Il cambio sessione è una sequenza guidata** (HS-5): prima l'iscrizione alla nuova, poi
  l'annullamento della vecchia. Non esiste un comando dedicato, e quest'ordine è quello che
  non fa perdere il posto. L'interfaccia guida i due passi ma non li esegue da sola: se la
  nuova iscrizione finisce in lista d'attesa, annullare la vecchia significherebbe
  scambiare un posto certo con uno incerto, e la decisione resta a chi la subisce.

## Identità

Non c'è autenticazione: l'header `X-Utente` lo imposta `app/api.ts`, con un indirizzo
fisso. Qui pesa più che nell'altra app — è ciò che rende «le mie iscrizioni» *mie*, ed è la
metà di INV-9 che sta fuori dall'aggregato. Per provare la lista d'attesa con due persone
diverse, oggi si cambia quella riga; `packages/dev-identity` (§4.11) non è ancora scritto.
