import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'public/mockServiceWorker.js'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // RNF-19: WCAG 2.1 AA. Las reglas de accesibilidad se revisan en cada lint.
      ...jsxA11y.flatConfigs.recommended.rules,
      // Las regiones con scroll propio (tablas) reciben foco para desplazarlas con teclado.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['region'], tags: [] }],
      // Etiquetas que envuelven el control y su texto en varios niveles (opciones en tarjeta).
      'jsx-a11y/label-has-associated-control': ['error', { assert: 'either', depth: 5 }],
      // Permite quitar campos con `const { campo, ...resto } = objeto`.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
)
