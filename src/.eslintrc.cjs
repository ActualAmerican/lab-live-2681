/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2021: true },
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  ignorePatterns: ['**/dist/**', '**/build/**'],
  rules: {
    'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
    'no-undef': 'off', // because globals (window.bus, shapeRegistry) exist at runtime
    'no-console': 'off',
    eqeqeq: ['error', 'smart'],
    curly: ['error', 'multi-line'],
    'no-restricted-syntax': [
      'warn',
      { selector: 'Literal[value=/^hud:/]', message: 'Shapes must not emit hud:* directly' },
    ],
  },
  overrides: [
    {
      files: ['src/shapes/**/*.js'],
      rules: {
        'no-restricted-syntax': [
          'warn',
          { selector: 'Literal[value=/^hud:/]', message: 'Do not emit hud:* from shapes' },
        ],
      },
    },
  ],
};
