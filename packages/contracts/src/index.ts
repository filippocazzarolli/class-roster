/**
 * Il confine HTTP di `architecture.md` §4.6, in un posto solo.
 *
 * Barrel per chi vuole un import unico; i sottopercorsi (`@repo/contracts/courses`)
 * restano disponibili e sono quelli che usa l'api, un file di DTO per contesto.
 */
export type * from './common';
export type * from './courses';
export type * from './enrollments';
export type * from './errors';
export type * from './sessions';
