module.exports = {
  extends: ['@exodus/eslint-config/javascript'],
  rules: {
    'unicorn/consistent-function-scoping': 'off',
  },
  overrides: [
    {
      files: ['**/tests/**/*.?([cm])[jt]s?(x)'],
      rules: {
        '@exodus/import/no-extraneous-dependencies': 'off',
        'unicorn/no-array-callback-reference': 'off',
      },
    },
    {
      files: ['**/*.?([cm])[jt]s?(x)'],
    },
  ],
}
