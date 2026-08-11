import type { CourseState } from '@repo/contracts'
import { Badge } from '@repo/ui/components/badge'

/**
 * Lo stato del corso, tradotto per chi guarda.
 *
 * Sul filo `CourseState` è inglese — §4.6 traduce nel controller e in nessun altro punto,
 * e `contracts` è dove la traduzione è già avvenuta. L'italiano che ricompare qui è
 * un'altra cosa: è la lingua dell'interfaccia, non quella del dominio.
 */
export function StatoCorso({ stato }: { stato: CourseState }) {
  const etichetta = ETICHETTE[stato]

  // Uno stato che questo file non conosce si mostra com'è, invece di sparire.
  if (etichetta === undefined) return <Badge>{stato}</Badge>

  return <Badge variant={etichetta.tono}>{etichetta.testo}</Badge>
}

const ETICHETTE: Record<
  CourseState,
  { testo: string; tono: 'neutral' | 'positive' | 'destructive' }
> = {
  DRAFT: { testo: 'Bozza', tono: 'neutral' },
  PUBLISHED: { testo: 'Pubblicato', tono: 'positive' },
  WITHDRAWN: { testo: 'Ritirato', tono: 'destructive' },
}
