module.exports = {
  parserOptions: {
    ecmaVersion: 2019,
    sourceType: 'module'
  },
  env: {
    es6: true,
    browser: true,
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  plugins: [
    'svelte3'
  ],
  ignorePatterns: [
    'public/build/'
  ],
  overrides: [
    {
      files: ['**/*.svelte'],
      processor: 'svelte3/svelte3'
    }
  ],
  rules: {
    // semi: ['error', 'never'] // uncomment if you want to remove ;
  },
  settings: {
    // ...
  }
}