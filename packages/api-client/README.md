# `@repo/api-client`

Le dodici rotte di `architecture.md` §4.6, una funzione per riga, tipizzate su
`@repo/contracts`. Nient'altro: nessuna cache, nessun retry, nessuna logica di vista.

- `createApi({ currentUser })` costruisce il client una volta, nel *composition root* dell'app.
- Un errore HTTP diventa `HttpError`, con `status` e `error` (il nome dell'eccezione di
  dominio di §4.4) già interpretati; un errore di canale diventa `NetworkError`.
- L'header `X-Utente` è letto a ogni richiesta da `currentUser()`, così il selettore utente
  può cambiarlo a runtime.

Le tre funzioni di lettura — `courses.list`, `sessions.listOpen`, `enrollments.listMine` —
chiamano rotte che il backend **non espone ancora**: il read model di §4.5 è dichiarato
mancante nella checklist di §4.12.
