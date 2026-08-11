import { NavLink, Navigate, Route, Routes } from 'react-router'

import { ElencoCorsiPage } from '@/catalogo/pagine/elenco-corsi'
import { ModificaCorsoPage } from '@/catalogo/pagine/modifica-corso'
import { NuovoCorsoPage } from '@/catalogo/pagine/nuovo-corso'
import { SessioniDelCorsoPage } from '@/iscrizioni/pagine/sessioni-del-corso'
import { TutteLeSessioniPage } from '@/iscrizioni/pagine/tutte-le-sessioni'

/**
 * Le rotte del responsabile formazione — le due viste di §4.11.
 *
 * L'indirizzo dice a quale contesto appartiene ciò che si sta guardando: `/corsi` è
 * `catalogo`, `/sessioni` è `iscrizioni`, e `/corsi/:id/sessioni` sta a cavallo dei due
 * perché è la vista che li compone. È la stessa divisione delle cartelle sotto `src/`.
 */
function App() {
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Formazione</h1>
          <p className="text-sm text-muted-foreground">
            Responsabile formazione
          </p>
        </div>
        <nav className="flex gap-4 text-sm">
          <VoceDiMenu to="/corsi">Catalogo corsi</VoceDiMenu>
          <VoceDiMenu to="/sessioni">Sessioni</VoceDiMenu>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/corsi" replace />} />
        <Route path="/corsi" element={<ElencoCorsiPage />} />
        <Route path="/corsi/nuovo" element={<NuovoCorsoPage />} />
        <Route path="/corsi/:corsoId/modifica" element={<ModificaCorsoPage />} />
        <Route
          path="/corsi/:corsoId/sessioni"
          element={<SessioniDelCorsoPage />}
        />
        <Route path="/sessioni" element={<TutteLeSessioniPage />} />
        <Route
          path="*"
          element={
            <p className="text-sm text-muted-foreground">Pagina non trovata.</p>
          }
        />
      </Routes>
    </div>
  )
}

function VoceDiMenu({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        isActive
          ? 'font-medium text-foreground underline underline-offset-4'
          : 'text-muted-foreground hover:text-foreground'
      }
    >
      {children}
    </NavLink>
  )
}

export default App
