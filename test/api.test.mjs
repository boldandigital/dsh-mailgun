/**
 * The Mailgun API calls.
 *
 *   node --test test/api.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { eventNames, listEvents } from '../lib/api.js';

/**
 * Capture the URL of one API call.
 *
 * @param {object} options - the listEvents options.
 * @returns {Promise<URL>} the requested URL.
 */
async function urlOf(options) {
	const original = globalThis.fetch;
	let seen = null;
	globalThis.fetch = async (url) => {
		seen = new URL(url);
		return { ok: true, status: 200, text: async () => '{"items":[]}' };
	};
	try {
		await listEvents(options);
	}
	finally {
		globalThis.fetch = original;
	}
	return seen;
}

test('an event filter is sent as one parameter per event name', async () => {
	const url = await urlOf({
		base: 'https://api.mailgun.net/v3',
		domain: 'mg.example.com',
		apiKey: 'key',
		event: 'accepted,delivered,failed',
	});
	assert.deepEqual(url.searchParams.getAll('event'), ['accepted', 'delivered', 'failed']);
});

test('one event name stays one parameter', async () => {
	const url = await urlOf({
		base: 'https://api.mailgun.net/v3',
		domain: 'mg.example.com',
		apiKey: 'key',
		event: 'delivered',
	});
	assert.deepEqual(url.searchParams.getAll('event'), ['delivered']);
});

test('no event filter sends no event parameter', async () => {
	const url = await urlOf({
		base: 'https://api.mailgun.net/v3',
		domain: 'mg.example.com',
		apiKey: 'key',
	});
	assert.deepEqual(url.searchParams.getAll('event'), []);
});

test('eventNames splits, trims and drops empty names', () => {
	assert.deepEqual(eventNames('accepted, delivered ,failed'), ['accepted', 'delivered', 'failed']);
	assert.deepEqual(eventNames('accepted'), ['accepted']);
	assert.deepEqual(eventNames(''), undefined);
	assert.deepEqual(eventNames(undefined), undefined);
});
