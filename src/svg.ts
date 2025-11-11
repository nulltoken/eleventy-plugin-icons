import type { Attributes } from './types';

import { XMLBuilder, XMLParser } from 'fast-xml-parser';

import { log, mergeAttributes } from './utils';

const parser = new XMLParser({
	ignoreAttributes: false,
	ignoreDeclaration: true,
	commentPropName: '#comment',
	preserveOrder: true,
});

const builder = new XMLBuilder({
	ignoreAttributes: false,
	commentPropName: '#comment',
	preserveOrder: true,
	format: true,
	suppressEmptyNode: true,
	unpairedTags: ['hr', 'br', 'link', 'meta'],
});

/**
 * Parses an SVG string and merges given attributes with existing ones.
 *
 * @param raw - The raw SVG string.
 * @param attributes - The attributes to be merged.
 * @param overwrite - Flag indicating whether to overwrite existing attributes.
 * @returns The modified SVG string.
 */
export function parseSVG(
	id: string | undefined,
	raw: string,
	attributes: Attributes,
	overwrite: boolean,
): [string, string] {
	const parsed = parser.parse(raw);
	const defs: any[] = [];
	const defIds: string[] = [];

	// biome-ignore lint/suspicious/noImplicitAnyLet: fast-xml-parser's XMLParser#parse() is poorly typed.
	let svg;
	let existingAttributes: Attributes = {};
	for (const node of parsed) {
		if ('svg' in node) {
			svg = node.svg;

			if (id !== undefined) {
				for (const subNode of svg) {
					if (!('defs' in subNode)) {
						continue;
					}

					for (const def of subNode.defs) {
						if (!('@_id' in def[':@'])) {
							log.warn("'def' node without an 'id' attribute");
							continue;
						}

						defs.push(def);

						const defId = def[':@']['@_id'];

						defIds.push(defId);
					}

					// TODO: maytbe find an alternative
					// biome-ignore lint/performance/noDelete: Haven't researched yet a proper way to do this
					delete subNode.defs;
				}
			}

			if (':@' in node) {
				existingAttributes = node[':@'];
				existingAttributes = Object.keys(existingAttributes).reduce(
					(accumulator: typeof existingAttributes, key) => {
						accumulator[key.replace(/^@_/, '')] = existingAttributes[key];
						return accumulator;
					},
					{},
				);
			}

			const newAttributes = mergeAttributes(
				// Combine given attributes with existing ones depending on `overwrite`.
				overwrite
					? // Overwrite all:
						[]
					: // Combine all:
						[
							...new Set(
								[existingAttributes, attributes].flatMap((object) =>
									Object.keys(object),
								),
							),
						],
				// Existing attributes will be overwritten by newer ones because `attributes` is after `existingAttributes`.
				[existingAttributes, attributes],
			);

			node[':@'] = Object.keys(newAttributes).reduce(
				(accumulator: typeof newAttributes, key) => {
					accumulator[`@_${key}`] = newAttributes[key];
					return accumulator;
				},
				{},
			);

			break;
		}
	}
	if (!svg) log.error('No SVG element found.');

	let svgOut = builder.build(parsed) as string;

	if (id === undefined) {
		return [svgOut, ''];
	}

	let strDefs = builder.build(defs) as string;

	for (const defId of defIds) {
		svgOut = svgOut.replaceAll(`="url(#${defId})"`, `="url(#${id}-${defId})"`);
		strDefs = strDefs
			.replaceAll(`id="${defId}"`, `id="${id}-${defId}"`)
			.replaceAll(`xlink:href="#${defId}"`, `xlink:href="#${id}-${defId}"`)
			.replaceAll(`href="#${defId}"`, `href="#${id}-${defId}"`);
	}

	return [svgOut, strDefs];
}
