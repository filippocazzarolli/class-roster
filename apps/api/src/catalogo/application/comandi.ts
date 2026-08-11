/**
 * Gli oggetti comando del catalogo — `architecture.md` §4.2, in italiano come il dominio.
 */

export interface CreaCorso {
  readonly titolo: string;
  readonly descrizione: string;
  readonly durataInOre: number;
  readonly argomento: string;
}

export interface ModificaDettagliCorso {
  readonly corsoId: string;
  readonly titolo: string;
  readonly descrizione: string;
  readonly durataInOre: number;
  readonly argomento: string;
}

export interface PubblicaCorso {
  readonly corsoId: string;
}

export interface RitiraCorso {
  readonly corsoId: string;
}
