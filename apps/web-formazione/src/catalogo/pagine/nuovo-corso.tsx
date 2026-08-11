import { useNavigate } from 'react-router'

import { api } from '@/app/api'
import { FormCorso } from '@/catalogo/componenti/form-corso'

/**
 * `POST /api/courses` — il comando `CreaCorso` di §4.6.
 *
 * Il corso nasce in bozza: non c'è nulla da scegliere sullo stato, perché `publish` è una
 * transizione con un nome e non un campo del modulo di creazione.
 */
export function NuovoCorsoPage() {
  const navigate = useNavigate()

  return (
    <main className="flex max-w-lg flex-col gap-4">
      <h2 className="text-lg font-medium">Nuovo corso</h2>

      <FormCorso
        testoInvio="Crea corso"
        invia={async (corso) => {
          await api.courses.create(corso)

          /*
           * Nessun messaggio di conferma: si torna al catalogo, dove il corso appena creato
           * è visibile in stato «Bozza». È il read model che conferma, non un avviso.
           */
          navigate('/corsi')
        }}
      />
    </main>
  )
}
