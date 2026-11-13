/**
 * The account-list backend.
 *
 * The settings page is the only way to add a Mailgun account, so the list has
 * to hold more than one: several accounts are several sending domains, and a
 * plugin that kept only the last one saved would silently drop a credential.
 *
 *   node --test test/accounts.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountStore } from '../lib/store.js';
import { cleanAccount, slugify, uniqueId } from '../lib/accounts.js';

/**
 * A plugin context with a credential store that keeps its records in memory.
 *
 * The store follows the harness shape: a record is `{kind, key}`, and the
 * plugin reads it back through `readRecord`.
 *
 * @returns {object} the context.
 */
function contextStub() {
	const records = new Map();
	return {
		records,
		credentials: {
			async resolve() {
				return { value: '', source: 'credentials' };
			},
			async readRecord(key) {
				return records.get(key);
			},
			async modifyRecord(key, mutate) {
				const current = records.get(key);
				const next = await mutate(current);
				if (next === undefined) records.delete(key);
				else records.set(key, next);
				return next;
			},
			async deleteRecord(key) {
				records.delete(key);
			},
		},
	};
}

/**
 * The backend, over a throwaway store.
 *
 * @returns {Promise<object>} the backend and its context.
 */
async function backendStub() {
	const home = mkdtempSync(join(tmpdir(), 'dsh-mailgun-test-'));
	const ctx = contextStub();
	ctx.dshHomePath = home;
	const store = new AccountStore(ctx);
	// The backend talks to the service only for the key and the domains; the
	// list itself is what this test is about.
	const service = {
		config: { apiKeyRef: 'MAILGUN_API_KEY', domain: '', region: 'us', from: '' },
		async keyFor(account) {
			const record = ctx.credentials.records.get('dsh-mailgun/' + account.id);
			return { value: record === undefined ? '' : record.secret };
		},
	};
	const { MailgunSettingsBackend } = await import('../lib/settings-web.js');
	return { backend: new MailgunSettingsBackend({ ctx, service, store }), ctx, home };
}

test('two accounts with different labels are both kept', async () => {
	const { backend, home } = await backendStub();
	try {
		await backend.save({ action: 'save', account: { label: 'Bold & Digital', domain: 'mg.bold.example' } });
		await backend.save({ action: 'save', account: { label: 'HostSalt', domain: 'mg.hostsalt.example' } });

		const view = await backend.view();
		assert.equal(view.accounts.length, 2, 'the second account replaced the first');
		assert.deepEqual(
			view.accounts.map((account) => account.id).sort(),
			['bold-digital', 'hostsalt'],
		);
	}
	finally {
		rmSync(home, { recursive: true, force: true });
	}
});

test('two accounts with the same label are both kept', async () => {
	const { backend, home } = await backendStub();
	try {
		await backend.save({ action: 'save', account: { label: 'Shared', domain: 'a.example' } });
		await backend.save({ action: 'save', account: { label: 'Shared', domain: 'b.example' } });

		const view = await backend.view();
		assert.equal(view.accounts.length, 2, 'the second account replaced the first');
		assert.equal(new Set(view.accounts.map((account) => account.id)).size, 2, 'both accounts share one id');
	}
	finally {
		rmSync(home, { recursive: true, force: true });
	}
});

test('each account keeps its own key', async () => {
	const { backend, ctx, home } = await backendStub();
	try {
		await backend.save({ action: 'save', account: { label: 'One' }, apiKey: 'key-one' });
		await backend.save({ action: 'save', account: { label: 'Two' }, apiKey: 'key-two' });

		const view = await backend.view();
		assert.equal(view.accounts.length, 2);
		assert.equal(view.accounts.every((account) => account.hasKey), true, 'an account lost its key');
		const keys = [...ctx.records.values()].map((record) => record.key).sort();
		assert.deepEqual(keys, ['key-one', 'key-two']);
	}
	finally {
		rmSync(home, { recursive: true, force: true });
	}
});

test('editing an account keeps the others', async () => {
	const { backend, home } = await backendStub();
	try {
		await backend.save({ action: 'save', account: { label: 'One' } });
		await backend.save({ action: 'save', account: { label: 'Two' } });

		const view = await backend.view();
		const first = view.accounts.find((account) => account.id === 'one');
		await backend.save({ action: 'save', account: { ...first, label: 'One renamed' } });

		const after = await backend.view();
		assert.equal(after.accounts.length, 2, 'editing one account dropped the other');
		assert.equal(after.accounts.find((account) => account.id === 'one').label, 'One renamed');
	}
	finally {
		rmSync(home, { recursive: true, force: true });
	}
});

test('the first account becomes the default, and removing it clears the default', async () => {
	const { backend, home } = await backendStub();
	try {
		await backend.save({ action: 'save', account: { label: 'One' } });
		await backend.save({ action: 'save', account: { label: 'Two' } });

		let view = await backend.view();
		assert.equal(view.defaultAccount, 'one', 'the first account is not the default');

		await backend.remove({ action: 'remove', id: 'one' });
		view = await backend.view();
		assert.equal(view.accounts.length, 1);
		assert.equal(view.defaultAccount, '', 'the default still names a removed account');
	}
	finally {
		rmSync(home, { recursive: true, force: true });
	}
});

test('uniqueId keeps every taken id out of the way', () => {
	assert.equal(uniqueId('alpha', []), 'alpha');
	assert.equal(uniqueId('alpha', ['alpha']), 'alpha-2');
	assert.equal(uniqueId('alpha', ['alpha', 'alpha-2']), 'alpha-3');
	assert.equal(uniqueId('', ['account-2']), 'account-3');
});
