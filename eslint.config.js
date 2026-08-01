import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        CustomEvent: 'readonly',
        document: 'readonly',
        Event: 'readonly',
        window: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error'
    }
  },
  {
    files: ['vite.config.ts', 'build/**/*.ts'],
    languageOptions: { globals: { process: 'readonly' } }
  },
  {
    files: ['public/legacy/**/*.js'],
    languageOptions: {
      globals: {
        alert: 'readonly',
        Blob: 'readonly',
        confirm: 'readonly',
        crypto: 'readonly',
        document: 'readonly',
        FileReader: 'readonly',
        localStorage: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off'
    }
  }
);
