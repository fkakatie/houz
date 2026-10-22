import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'refs/', 'dev/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      indent: ['error', 2, { SwitchCase: 1 }],
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single', { allowTemplateLiterals: true }],
      semi: ['error', 'always'],
    },
  },
  { files: ['scripts/**/*.js'], languageOptions: { globals: globals.browser } },
  { files: ['tests/**/*.js', 'eslint.config.js'], languageOptions: { globals: globals.node } },
];
