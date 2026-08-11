import { Corso } from '../../domain/corso';
import { Argomento } from '../../domain/value-objects/argomento';
import { Descrizione } from '../../domain/value-objects/descrizione';
import { DurataInOre } from '../../domain/value-objects/durata-in-ore';
import { CorsoId } from '../../domain/value-objects/identificativi';
import { TitoloCorso } from '../../domain/value-objects/titolo-corso';
import { CorsoSnapshot } from './corso.snapshot';

export const aSnapshot = (corso: Corso, versione: number): CorsoSnapshot => ({
  id: corso.id.valore,
  titolo: corso.dettagli.titolo.valore,
  titoloNormalizzato: corso.dettagli.titolo.normalizzato,
  descrizione: corso.dettagli.descrizione.valore,
  durataOre: corso.dettagli.durataInOre.valore,
  argomento: corso.dettagli.argomento.valore,
  stato: corso.stato,
  versione,
});

export const aDominio = (snapshot: CorsoSnapshot): Corso =>
  Corso.ricostruisci({
    id: CorsoId.da(snapshot.id),
    dettagli: {
      titolo: TitoloCorso.da(snapshot.titolo),
      descrizione: Descrizione.da(snapshot.descrizione),
      durataInOre: DurataInOre.da(snapshot.durataOre),
      argomento: Argomento.da(snapshot.argomento),
    },
    stato: snapshot.stato,
    versione: snapshot.versione,
  });
