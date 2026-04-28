import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { config as baseConfig } from './base.js'

/** @type {import("eslint").Linter.FlatConfig[]} */
export const config = [
    ...baseConfig,
    { plugins: { 'react-hooks': reactHooks }, rules: reactHooks.configs.recommended.rules },
    reactRefresh.configs.vite,
    { files: ['**/*.{ts,tsx}'], languageOptions: { ecmaVersion: 2020, globals: globals.browser } }
]
