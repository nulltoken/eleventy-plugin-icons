import type { Options } from './options';
import type { Attributes, DeepPartial, Prettify } from './types';

import assert from 'node:assert';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import memoize from 'just-memoize';

import {
	Icon,
	createSprite,
	createSpriteReference,
	getExtraIcons,
} from './icon';
import { mergeOptions, validateOptions } from './options';
import { parseSVG } from './svg';
import { handleIconShortcodeAttributes } from './utils';

const placeHolderSvgSpriteUrl = '/*__EleventyPluginIconSpriteUrl__*/';
const placeHolderSvgSpriteContent = '/*__EleventyPluginIconSpriteContent__*/';
const placeHolderIcon = (id: string) => `/*__EleventyPluginIcon:(${id})__*/`;

export default function (
	eleventyConfig: any,
	opts: Prettify<DeepPartial<Options>>,
) {
	const usedIcons: Set<Icon> = new Set<Icon>();

	if (opts === null || typeof opts !== 'object')
		throw new Error(`options: expected an object but received ${typeof opts}`);

	const options = mergeOptions(opts as Options);
	validateOptions(options);

	eleventyConfig.addTransform(
		'eleventy-plugin-icon/delayed',
		async function (this: { page: { icons: Icon[] } }, content: string) {
			this.page.icons = this.page.icons || [];

			const pageSpritesheet = await spriteContent(
				new Set<Icon>(this.page.icons),
			);
			const allIcons = [...usedIcons, ...this.page.icons];

			for (const icon of allIcons) {
				usedIcons.add(icon);
			}

			const relFileUrl = await getFileRelativeUrl(usedIcons, options);

			// Extract all occurrences of the icon placeholder and their ids
			const iconPlaceholderRegex =
				/\/\*__EleventyPluginIcon:\(([^)]+)\)__\*\//g;

			while (true) {
				const match = iconPlaceholderRegex.exec(content);
				if (match === null) {
					break;
				}

				const icon = [...allIcons].find((icon) => icon.id === match[1]);
				assert(icon !== undefined, `Icon with id '${match[1]}' not found.`);

				const res = await generateSVG(icon);
				content = content.replaceAll(match[0], res);
			}

			const pattern = relFileUrl === undefined ? '' : `/${relFileUrl}`;
			content = content.replaceAll(placeHolderSvgSpriteUrl, pattern);

			content = content.replaceAll(
				placeHolderSvgSpriteContent,
				pageSpritesheet,
			);
			return content;
		},
	);

	const generateSVG = async (icon: Icon): Promise<string> => {
		const content = await icon.content(options);
		if (!content) {
			return '';
		}

		const attributes = handleIconShortcodeAttributes(
			icon.attributes,
			options,
			icon,
		);

		switch (options.mode) {
			case 'inline':
				return parseSVG(
					undefined,
					content,
					attributes,
					options.icon.overwriteExistingAttributes,
				)[0];
			case 'sprite':
				return createSpriteReference(
					attributes,
					options.icon.id(icon.name, icon.source),
					placeHolderSvgSpriteUrl,
				);
		}
	};

	eleventyConfig.addShortcode(
		options.icon.shortcode,
		function (
			this: { page: { icons: Icon[] } },
			input: any,
			attrs: Attributes | string = {},
		) {
			const icon = new Icon(input, options, attrs);

			this.page.icons = this.page.icons || [];
			this.page.icons.push(icon);

			// Keep track of used icons for generating sprite.
			usedIcons.add(icon);

			return placeHolderIcon(icon.id);
		},
	);

	eleventyConfig.addShortcode(options.sprite.shortcode, () => {
		return placeHolderSvgSpriteContent;
	});

	eleventyConfig.addShortcode('getSvgSpriteUrl', () => {
		if (options.mode === 'inline') {
			throw new Error(
				"Incorrect usage of 'getSvgSpriteUrl' shortcode has been detected. This can only be used in 'sprite' mode.",
			);
		}

		if (
			options.sprite.writeFile === false &&
			options.sprite.writeToDirectory === false
		) {
			throw new Error(
				"Incorrect usage of 'getSvgSpriteUrl' shortcode has been detected. This can only be used when 'sprite.writeFile' or 'sprite.writeToDirectory' is defined.",
			);
		}

		return placeHolderSvgSpriteUrl;
	});

	eleventyConfig.on(
		'eleventy.after',
		async ({
			directories,
		}: {
			directories: {
				input: string;
				output: string;
			};
		}) => {
			const relFileUrl = await getFileRelativeUrl(usedIcons, options);

			if (relFileUrl === undefined) {
				// Either inline generation or sprite without any persistence.
				return;
			}

			const sprite = await spriteContent(usedIcons);

			assert(sprite !== undefined, 'Unexpected undefined sprite value');

			const outputFilepath = path.join(directories.output, relFileUrl);

			const fileDirectory = path.parse(outputFilepath).dir;
			try {
				await fs.readdir(fileDirectory);
			} catch {
				await fs.mkdir(fileDirectory, { recursive: true });
			}

			await fs.writeFile(outputFilepath, sprite);
		},
	);

	for (const source of options.sources) {
		eleventyConfig.addWatchTarget(source.path);
	}

	const spriteContent = async (icons: Set<Icon>) => {
		return await createSprite(
			[...icons, ...(await getExtraIcons(options))],
			options,
		);
	};

	const buildSpriteUrlFilename = async (icons: Set<Icon>) => {
		return `${hash(await spriteContent(icons))}.svg`;
	};

	const getFileRelativeUrl = async (
		icons: Set<Icon>,
		opts: Options,
	): Promise<string | undefined> => {
		if (opts.sprite.writeFile !== false) {
			return pathToUrl(path.join(opts.sprite.writeFile as string));
		}

		if (opts.sprite.writeToDirectory !== false) {
			const directory = path.join(opts.sprite.writeToDirectory as string);
			return pathToUrl(
				path.join(directory, await buildSpriteUrlFilename(icons)),
			);
		}

		return undefined;
	};

	const pathToUrl = (pathStr: string) => pathStr.split(path.sep).join('/');

	const hash = memoize((content: string) => {
		const sha256Hash = createHash('sha256')
			.update(content)
			.digest('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');

		return sha256Hash.substring(0, 10);
	});
}
