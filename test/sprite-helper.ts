import Eleventy from '@11ty/eleventy';
import merge from 'merge';

import pluginIcons from '../src/index';
import { withFixture } from './utils';

export const buildEleventy = (
	fixture: string,
	options: any,
	outputDirectory = '_site',
) => {
	const config = buildConfig();

	return new Eleventy(withFixture(fixture), outputDirectory, config);

	function buildConfig(): any {
		return {
			config: (eleventyConfig: any) => {
				eleventyConfig.addPlugin(pluginIcons, options);
			},
		};
	}
};

export const buildOptions = (
	additionalOptions?: Record<string, unknown>,
): any => {
	const options: any = {
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

	return merge.recursive(true, options, additionalOptions);
};
