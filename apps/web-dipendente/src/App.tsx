import { NavLink, Navigate, Route, Routes } from 'react-router'

import { MieIscrizioniPage } from '@/iscrizioni/pagine/mie-iscrizioni'
import { SessioniApertePage } from '@/iscrizioni/pagine/sessioni-aperte'

/**
 * Le rotte del dipendente — le due viste di §4.11.
 *
 * Sotto `src/` c'è **una sola cartella di contesto**, `iscrizioni/`, contro le due di
 * `web-formazione`. Non è un'asimmetria da correggere: è la dimostrazione che le app non
 * coincidono con i bounded context — il dipendente ne consuma uno, il responsabile ne
 * attraversa due, e va bene così.
 */
function App() {
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold">I miei corsi</h1>
          <p className="text-sm text-muted-foreground">Dipendente</p>
        </div>
        <nav className="flex gap-4 text-sm">
          <VoceDiMenu to="/sessioni">Sessioni aperte</VoceDiMenu>
          <VoceDiMenu to="/iscrizioni">Le mie iscrizioni</VoceDiMenu>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/sessioni" replace />} />
        <Route path="/sessioni" element={<SessioniApertePage />} />
        <Route path="/iscrizioni" element={<MieIscrizioniPage />} />
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
      end
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
