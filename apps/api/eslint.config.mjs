// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** La dipendenza punta verso l'interno, e il dominio non conosce il mondo. */
const REGOLA_DELLA_DIPENDENZA = [
  {
    group: ['@nestjs/*', 'class-validator', 'class-transformer', '**/infrastructure/**'],
    message: "Il dominio non conosce il framework né l'archivio. Definisci una porta.",
  },
  {
    group: ['**/application/**', '**/read-model/**'],
    message:
      "La dipendenza punta verso l'interno: domain non importa dagli strati esterni.",
  },
];

/**
 * Il read model legge gli snapshot, mai gli aggregati — architecture.md §4.5.
 *
 * Con l'archivio in memoria `repositorySessioni.perId(...)` restituisce un oggetto di
 * dominio pronto da interrogare: senza questa regola, «le letture non passano dai
 * repository» resterebbe affidata alla memoria di chi scrive. Le primitive di
 * `shared/domain` — IstanteLocale, Orologio — restano ammesse: sono il modo in cui il
 * tempo entra, e non sono aggregati di nessun contesto.
 */
const DIVIETO_AGGREGATI = {
  group: ['../domain/**', '**/iscrizioni/domain/**', '**/catalogo/domain/**'],
  message:
    'Il read model legge gli snapshot dall\'archivio, mai gli aggregati ricostruiti (§4.5).',
};

const DIVIETO_CATALOGO = {
  group: ['**/catalogo/**', 'src/catalogo/*'],
  message:
    "Bounded context: se serve un dato dal catalogo, arriva per evento e passa dall'ACL.",
};

const DIVIETO_ISCRIZIONI = {
  group: ['**/iscrizioni/**', 'src/iscrizioni/*'],
  message: 'Bounded context: il catalogo non sa di avere clienti.',
};

/** Il tempo entra solo dalla porta Orologio — vale in domain e in application. */
const NIENTE_OROLOGIO = [
  {
    selector: "NewExpression[callee.name='Date']",
    message: "Niente orologio qui: l'istante corrente arriva dalla porta Orologio.",
  },
  {
    selector: "MemberExpression[object.name='Date'][property.name='now']",
    message: 'Idem: usa la porta Orologio.',
  },
];

/** Il dominio è deterministico: nessuna sorgente di casualità. */
const NIENTE_CASO = {
  selector: "MemberExpression[object.name='Math'][property.name='random']",
  message: 'Il dominio è deterministico: usa GeneratoreDiId.',
};

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // I guardiani architetturali — architecture.md §4.9
  //
  // Le discipline non restano buone intenzioni. I pattern sono relativi ad
  // apps/api, perché questa configurazione vive qui.
  //
  // ⚠️ In flat config le regole NON si fondono: per un dato file vince l'ultimo
  // blocco che definisce quella regola. Un file in `iscrizioni/domain/` matcha
  // sia la regola della dipendenza sia il divieto fra contesti, quindi i due
  // insiemi di pattern vanno **composti esplicitamente** in un blocco proprio.
  // Separarli in due blocchi disattiverebbe silenziosamente il primo.
  // ───────────────────────────────────────────────────────────────────────────

  {
    files: ['src/**/domain/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: REGOLA_DELLA_DIPENDENZA }],
      'no-restricted-syntax': ['error', ...NIENTE_OROLOGIO, NIENTE_CASO],
    },
  },
  {
    files: ['src/**/application/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...NIENTE_OROLOGIO],
    },
  },

  // I due divieti fra contesti. I test sono esentati, ed è una scelta e non una
  // scorciatoia: osservano il sistema da fuori, ed è esattamente così che si
  // verifica che i due lati di un contratto coincidano.
  {
    files: ['src/iscrizioni/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [DIVIETO_CATALOGO] }],
    },
  },
  {
    files: ['src/catalogo/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [DIVIETO_ISCRIZIONI] }],
    },
  },

  // Il read model: niente aggregati, niente orologio di sistema. I pattern del
  // divieto fra contesti sono ripetuti qui perché i due blocchi qui sopra li
  // definiscono già per lo stesso file — e in flat config vince l'ultimo, non
  // l'unione dei due.
  {
    files: ['src/iscrizioni/read-model/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [DIVIETO_AGGREGATI, DIVIETO_CATALOGO] },
      ],
      'no-restricted-syntax': ['error', ...NIENTE_OROLOGIO],
    },
  },
  {
    files: ['src/catalogo/read-model/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [DIVIETO_AGGREGATI, DIVIETO_ISCRIZIONI] },
      ],
      'no-restricted-syntax': ['error', ...NIENTE_OROLOGIO],
    },
  },

  // Dove i due insiemi si sovrappongono, e vanno quindi ripetuti insieme.
  {
    files: ['src/iscrizioni/**/domain/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...REGOLA_DELLA_DIPENDENZA, DIVIETO_CATALOGO] },
      ],
    },
  },
  {
    files: ['src/catalogo/**/domain/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...REGOLA_DELLA_DIPENDENZA, DIVIETO_ISCRIZIONI] },
      ],
    },
  },
);
