import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // shadcn/ui component files contain pattern false-positives for Fast Refresh:
  // - internal helper functions in component files
  // - ref reads during render for form editors (React docs explicitly endorse this)
  {
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      'react-hooks/refs': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
])
