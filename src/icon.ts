import type { Options } from './options';
import type { Attributes } from './types';

import fs from 'node:fs/promises';
import path from 'node:path';

import memoize from 'just-memoize';

import { parseSVG } from './svg';
import { attributesToString, log, stringify } from './utils';

import { v4 as uuidv4 } from 'uuid';

export class Icon {
	public name = '';
	public source = '';
	public path = '';
	public attributes: Attributes | string = {};
	public id = uuidv4();

	constructor(
		input: { name: string; source: string } | string,
		options: Options,
		attributes: Attributes | string,
	) {
		this.attributes = attributes;

		if (typeof input === 'object') {
			this.name = input.name;
			this.source = input.source;
		} else if (typeof input === 'string') {
			if (input.includes(options.icon.delimiter)) {
				const [source, icon] = input.split(options.icon.delimiter);
				this.name = icon;
				this.source = source;
			} else {
				this.name = input;
				this.source =
					options.sources.find((source) => source.default === true)?.name || '';
				if (!this.source)
					log.error(
						`Icon '${input}' lacks a delimiter and no default source is set.`,
					);
			}
		} else {
			log.error(`Invalid input type for Icon constructor: '${typeof input}'.`);
		}

		const sourceObject = options.sources.find(
			(source) => source.name === this.source,
		);
		if (sourceObject) {
			const fileName = sourceObject?.getFileName
				? sourceObject.getFileName(this.name)
				: `${this.name}.svg`;
			this.path = path.join(sourceObject.path, fileName);
		} else {
			log.error(`Source '${this.source}' is not defined in options.sources.`);
		}
	}

	stringified = () => stringify(this);

	// eslint-disable-next-line unicorn/consistent-function-scoping
	content = memoize(async (options: Options) => {
		try {
			let content = await fs.readFile(this.path, 'utf-8');
			if (!content) {
				log.warn(`Icon ${this.stringified()} appears to be empty.`);
				content = '';
			}
			return options.icon.transform
				? await options.icon.transform(content)
				: content;
		} catch {
			log[options.icon.errorNotFound ? 'error' : 'warn'](
				`Icon ${this.stringified()} not found.`,
			);
		}
	});
}

export const createSprite = memoize(
	async (icons: Icon[], options: Options): Promise<string> => {
		// Sort icons by name for consistent ordering and stable hashing output.
		const sortedIcons = (icons || []).sort((a, b) => {
			if (a.name === b.name) {
				return 0;
			}
			return a.name < b.name ? -1 : 1;
		});

		// Create an array of promises that generate symbol definitions for each icon.
		const symbols = await Promise.all(
			[...new Set(sortedIcons)].map(
				async (icon): Promise<[string, string] | undefined> => {
					const content = await icon.content(options);
					// If content exists, convert it to a symbol element and add attributes.
					if (content) {
						const id = options.icon.id(icon.name, icon.source);
						const [svgOut, strDefs] = parseSVG(id, content, { id }, true);

						return [
							svgOut.replace(/<svg/, '<symbol').replace(/<\/svg>/, '</symbol>'),
							strDefs,
						];
					}
					return undefined;
				},
			),
		);

		// Combine the generated symbol strings and filter out empty ones.

		const parsed = symbols.filter((x) => x !== undefined);

		if (parsed.length === 0) {
			// Return an empty string if no symbols were generated.
			return '';
		}

		const symbolsString = [...new Set(parsed.map((x) => x[0]))].join('');
		const defsString = [...new Set(parsed.map((x) => x[1]))].join('');

		return `<svg ${attributesToString(
			options.sprite.attributes,
		)}><defs>${defsString}</defs>${symbolsString}</svg>`;
	},
);

export const getExtraIcons = async (options: Options): Promise<Icon[]> => {
	const icons = [];
	const sources = [];

	if (options.sprite.extraIcons.all === true) {
		sources.push(...options.sources);
	} else {
		for (const name of options.sprite.extraIcons.sources) {
			const source = options.sources.find((source) => source.name === name);
			if (source) {
				sources.push(source);
			} else {
				log.error(
					`options.sprite.extraIcons.sources: Source '${name}' is not defined in options.sources.`,
				);
			}
		}

		for (const icon of options.sprite.extraIcons.icons) {
			if (sources.some((source) => source.name === icon.source)) {
				log.warn(
					`options.sprite.extraIcons.icons: icons from source '${icon.source}' already included from options.sprite.extraIcons.sources: ${JSON.stringify(
						icon,
					)}.`,
				);
			} else {
				icons.push(new Icon(icon, options, {}));
			}
		}
	}

	for (const source of sources) {
		for (const file of await fs.readdir(source.path)) {
			if (file.endsWith('.svg')) {
				icons.push(
					new Icon(
						{
							name: file.replace('.svg', ''),
							source: source.name,
						},
						options,
						{},
					),
				);
			}
		}
	}

	return icons;
};

export const createSpriteReference = (
	attributes: Attributes,
	id: string,
	spriteUrl: string | undefined,
): string => {
	return `<svg ${attributesToString(
		attributes,
	)}><use href="${spriteUrl ?? ''}#${id}"></use></svg>`;
};
