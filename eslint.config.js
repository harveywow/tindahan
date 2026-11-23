/**
 * ESLint flat configuration.
 *
 * Why flat config instead of .eslintrc.json: ESLint v9+ only reads
 * eslint.config.js by default, so this is the current language standard.
 * The rules mirror the project's style guide (see README "Code style").
 */
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['js/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      camelcase: ['error', { properties: 'never' }],
      curly: ['error', 'all'],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-implicit-globals': 'error',
      'max-lines-per-function': ['warn', { max: 40, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', 10],
      'max-params': ['warn', 4],
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],
    },
  },
  {
    // Test suites are long lists of small cases; a describe() block is
    // naturally longer than 40 lines, so the length rule is relaxed there.
    files: ['tests/**/*.js'],
    rules: { 'max-lines-per-function': 'off' },
  },
];
