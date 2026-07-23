import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		},
		rules: {
			// TypeScript already reports unknown identifiers, and unlike this rule
			// it understands ambient declarations such as the Plotly CDN global.
			'no-undef': 'off',

			// A leading underscore marks a binding that exists only to hold a
			// position, such as the key in `Object.entries(x).map(([_, v]) => v)`.
			// Naming it is the clearest way to write that, so it should not then
			// be reported as unused.
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_'
				}
			],

			// Only report a destructuring when *every* binding in it could be
			// const. The default ("any") reports `let { a, b } = f()` when just one
			// of them is never reassigned, and taking that advice does not compile:
			// spider-graph/attack.ts reassigns `attack` on the line after
			// destructuring it alongside `range`, which it does not.
			'prefer-const': ['error', { destructuring: 'all' }]
		}
	},
	{
		files: ['**/*.svelte'],
		rules: {
			// Svelte reactive statements (`$: value;`) are expressions by design.
			'@typescript-eslint/no-unused-expressions': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	},
	{
		// Replaces the old .eslintignore, which ESLint 10 no longer reads.
		ignores: [
			'.DS_Store',
			'node_modules/',
			'build/',
			'.svelte-kit/',
			'package/',
			'.env',
			'.env.*',
			'!.env.example',
			'pnpm-lock.yaml',
			'package-lock.json',
			'yarn.lock'
		]
	}
);
