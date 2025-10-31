import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

import { buildEleventy, buildOptions } from './sprite-helper';
import { getFixtureContentFromURL } from './utils';

const fixtureFolder = 'sprite-external';

describe('supports external svg reference', () => {
	const outputSpriteDirectory = path.join(import.meta.dirname, '_site_sprite');

	test('when writeFile is set', async () => {
		const pluginOptions = buildOptions({
			sprite: {
				writeFile: 'assets/icons/sprites.svg',
			},
		});
		const elev = buildEleventy(
			fixtureFolder,
			pluginOptions,
			outputSpriteDirectory,
		);

		const results = await elev.toJSON();
		const file = getFixtureContentFromURL(results, '/external-reference/');

		expect(file).toMatchSnapshot();

		expect(
			await fs.readFile(
				path.join(outputSpriteDirectory, 'assets/icons/sprites.svg'),
				'utf-8',
			),
		).toMatchSnapshot();
	});

	test('when writeToDirectory is set', async () => {
		const pluginOptions = buildOptions({
			sprite: {
				writeToDirectory: 'assets/icons',
			},
		});
		const elevExternal = buildEleventy(
			fixtureFolder,
			pluginOptions,
			outputSpriteDirectory,
		);

		const results = await elevExternal.toJSON();

		const file = getFixtureContentFromURL(results, '/external-reference/');

		expect(file).toMatchSnapshot();

		expect(
			await fs.readFile(
				path.join(outputSpriteDirectory, 'assets/icons/ieV1V-ezXX.svg'),
				'utf-8',
			),
		).toMatchSnapshot();
	});
});
