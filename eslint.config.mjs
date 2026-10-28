import js from '@eslint/js';
import parser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.release/**',
      '.local-data/**',
      'test-results/**',
      'playwright-report/**',
      'server/domain.mjs',
      'server/application.mjs',
      'native/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: {
      parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Legacy unused imports are cleaned up during component extraction. TypeScript
      // checks unresolved identifiers in TS/TSX; ESLint checks them in JavaScript.
      'no-unused-vars': 'off',
      'preserve-caught-error': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  { files: ['**/*.{ts,tsx}'], rules: { 'no-undef': 'off' } },
];
