import { randomUUID } from 'node:crypto';
import { GeneratoreDiId } from '../domain/generatore-di-id';

/**
 * L'adapter del `GeneratoreDiId`.
 *
 * Come per l'orologio, la sorgente di non determinismo vive qui e in nessun altro
 * posto: nei test il generatore è un contatore, e le asserzioni sugli identificativi
 * restano leggibili.
 */
export class GeneratoreDiUuid extends GeneratoreDiId {
  genera(): string {
    return randomUUID();
  }
}
