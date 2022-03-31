// const path = require('path');

module.exports = {
  root: true,
  extends: ['plugin:prettier/recommended', 'prettier/@typescript-eslint'],
  plugins: ['jest', '@typescript-eslint'],
  env: {
    browser: true,
    node: true,
    es6: true,
    'jest/globals': true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    // project: './tsconfig.json',
    ecmaVersion: 11, // ECMAScript 2020
    sourceType: 'module',
  },
  // settings: {
  //   'import/resolver': {
  //     webpack: {
  //       config: path.join(__dirname, './webpack.prod.js'),
  //     },
  //   },
  // },
  rules: {
    'no-var-requires': 'off',
    'global-require': 'off',
    'no-use-before-define': 'off',

    // @typescript-eslint
    '@typescript-eslint/no-use-before-define': ['error'],
    '@typescript-eslint/no-var-requires': 'off',
  },

  globals: {
    DashTVPlayer: true,
    BASE64: true,
    stringToArray: true,
  },
};
