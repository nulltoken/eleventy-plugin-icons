import { describe, expect, test } from 'vitest';

import { parseSVG } from '../src/svg';
import { attributesToString } from '../src/utils';

describe('attributesToString()', () => {
	test('should convert single attribute to string', () => {
		expect(attributesToString({ class: 'abc' })).toBe('class="abc"');
	});

	test('should convert multiple attributes to string', () => {
		expect(attributesToString({ class: 'abc', id: '123' })).toBe(
			'class="abc" id="123"',
		);
	});
});

describe('parseSVG()', () => {
	test('should add class attribute to SVG element', () => {
		const [svgOut, _] = parseSVG(
			'irrelevant',
			'<svg/>',
			{ class: 'abc' },
			false,
		);
		expect(svgOut).toContain('<svg class="abc"/>');
	});

	test('should append class to existing class attribute', () => {
		const [svgOut, _] = parseSVG(
			'irrelevant',
			'<svg class="abc" />',
			{ class: 'def' },
			false,
		);
		expect(svgOut).toContain('<svg class="abc def"/>');
	});

	test('should replace class attribute with new class', () => {
		const [svgOut, _] = parseSVG(
			'irrelevant',
			'<svg class="abc" />',
			{ class: 'def' },
			true,
		);
		expect(svgOut).toContain('<svg class="def"/>');
	});
});
