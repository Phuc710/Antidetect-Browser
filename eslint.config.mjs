import tsEslint from 'typescript-eslint';
import apify from '@apify/eslint-config';
import prettier from 'eslint-config-prettier';

export default [
    {
        ignores: [
            '**/dist',
            'node_modules',
            'coverage',
            '**/*.d.ts',
            'scripts',
            'eslint.config.mjs',
            'vitest.config.ts',
            'open_browser.js',
            'packages/fingerprint-injector/src/browser-runtime/**',
            'packages/fingerprint-injector/src/utils.js',
        ],
    },
    ...apify,
    prettier,
    {
        files: [
            'packages/fingerprint-generator/src/types/**/*.ts',
            'packages/fingerprint-injector/src/services/fingerprint-injector.service.ts',
            'packages/fingerprint-injector/src/types/**/*.ts',
            'packages/shared/src/contracts/fingerprint-envelope.ts',
            'packages/shared/src/index.ts',
        ],
        languageOptions: {
            parser: tsEslint.parser,
            parserOptions: {
                project: 'tsconfig.eslint.json',
            },
        },
    },
    {
        files: [
            'packages/fingerprint-generator/src/types/**/*.ts',
            'packages/fingerprint-injector/src/services/fingerprint-injector.service.ts',
            'packages/fingerprint-injector/src/types/**/*.ts',
            'packages/shared/src/contracts/fingerprint-envelope.ts',
            'packages/shared/src/index.ts',
        ],
        plugins: {
            '@typescript-eslint': tsEslint.plugin,
        },
        rules: {
            'no-void': 0,
            'no-underscore-dangle': 0,
            'max-classes-per-file': 0,
            'no-console': 'warn',
        },
    },
];
