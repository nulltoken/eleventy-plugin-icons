import fs from 'node:fs/promises';
import path from 'node:path';

import merge from 'merge';
import { describe, expect, test } from 'vitest';

import {
	getFixtureContentFromURL,
	getFixtureResultsWithOptions,
} from './setup';

const SPRITE_OPTIONS: any = {
	mode: 'sprite',
	sources: [
		{
			name: 'custom',
			path: 'test/fixtures/icons',
			default: true,
			getFileName: (icon: string) => `icon-${icon}.svg`,
		},
		{ name: 'lucide', path: 'node_modules/lucide-static/icons' },
	],
	icon: {
		shortcode: 'sprite',
		errorNotFound: false,
	},
};

const results = await getFixtureResultsWithOptions('sprite', SPRITE_OPTIONS);

test('a spritesheet should be created with at least one icon on the page', () => {
	const file = getFixtureContentFromURL(results, '/spritesheet/');

	expect(file).toMatchSnapshot();
});

test('a spritesheet should NOT be created with zero icons on the page', () => {
	const file = getFixtureContentFromURL(results, '/empty-spritesheet/');

	expect(file).toBe('');
});

describe('supports external svg reference', () => {
	const outputSpriteDirectory = path.join(import.meta.dirname, '_site_sprite');

	test('when writeFile is set', async () => {
		const results = await getFixtureResultsWithOptions(
			'sprite-external',
			merge.recursive(true, SPRITE_OPTIONS, {
				sprite: {
					writeFile: 'assets/icons/sprites.svg',
				},
			}),
			outputSpriteDirectory,
		);
		const file = getFixtureContentFromURL(results, '/external-reference/');

		expect(file).toMatchSnapshot();

		expect(
			await fs.readFile(
				path.join(outputSpriteDirectory, 'assets/icons/sprites.svg'),
				'utf-8',
			),
		).toMatchSnapshot();
	});
});
