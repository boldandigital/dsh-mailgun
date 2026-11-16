/**
 * The settings section, driven the way the browser drives it.
 *
 * The section is a React component, so every interactive control has to be
 * reachable from a click handler. This test renders the real section with a
 * tiny React stand-in, opens the "add account" form, types into it and presses
 * "Add account"; the request the browser would send is then asserted.
 *
 * The bug this guards against is a `useState` pair being called as a function:
 * that throws a TypeError inside the click handler, before any request is
 * made, so nothing is ever saved and no error is shown.
 *
 *   node --test test/section.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(here, '..', 'lib', 'client.js');

/**
 * A minimal React stand-in: hooks with a real setter, and a re-render of the
 * whole tree whenever a setter runs.
 *
 * @returns {object} the React stub, the flush helper and the re-render hook.
 */
function reactStub() {
	const hooks = [];
	let index = 0;
	let rerender = () => {};
	const pending = [];

	function useState(initial) {
		const slot = index;
		index += 1;
		if (!(slot in hooks)) hooks[slot] = typeof initial === 'function' ? initial() : initial;
		const setter = (value) => {
			const current = hooks[slot];
			hooks[slot] = typeof value === 'function' ? value(current) : value;
			pending.push(() => rerender());
		};
		return [hooks[slot], setter];
	}

	function flush() {
		while (pending.length > 0) {
			const run = pending.shift();
			run();
		}
	}

	const React = {
		createElement: (type, props, ...children) => {
			const merged = Object.assign({}, props);
			if (children.length === 1) merged.children = children[0];
			else if (children.length > 1) merged.children = children;
			if (typeof type === 'function') return type(merged);
			return { type, props: merged, children: merged.children };
		},
		useState,
		useEffect: (effect) => { effect(); },
	};

	return {
		React,
		flush,
		reset() { index = 0; },
		setRerender(fn) { rerender = fn; },
	};
}

/**
 * Load the client bundle and return its factory.
 *
 * @returns {Promise<Function>} the module factory.
 */
async function loadFactory() {
	let registration = null;
	globalThis.window = { __ModuleLoader__: { load(spec) { registration = spec; } } };
	await import(`file://${bundlePath}?t=${Date.now()}`);
	assert.ok(registration, 'the bundle did not register itself');
	return registration.factory;
}

/**
 * Walk a rendered tree and collect every element.
 *
 * @param {object} node - the tree root.
 * @returns {object[]} every element in the tree.
 */
function elementsOf(node) {
	if (node === null || node === undefined || typeof node !== 'object') return [];
	if (Array.isArray(node)) return node.flatMap((child) => elementsOf(child));
	const children = node.props?.children ?? node.children;
	return [node, ...elementsOf(children)];
}

/**
 * The text of one element.
 *
 * @param {object} element - the element.
 * @returns {string} its text.
 */
function textOf(element) {
	if (element === null || element === undefined) return '';
	const children = element.props?.children ?? element.children;
	if (children === undefined || children === null) return '';
	if (typeof children === 'string') return children;
	if (Array.isArray(children)) return children.map((child) => textOf(child)).join('');
	return textOf(children);
}

/**
 * The account list the stubbed backend reports.
 *
 * @param {object[]} accounts - the accounts in the list.
 * @returns {object} the view.
 */
function viewStub(accounts = []) {
	return { accounts, defaultAccount: '', credentialRef: 'MAILGUN_API_KEY', defaults: {} };
}

/**
 * One account as the backend reports it.
 *
 * @param {string} id - the account id.
 * @param {string} label - the label.
 * @returns {object} the account.
 */
function accountStub(id, label) {
	return { id, label, domain: id + '.example', region: 'us', from: '', senderName: '', hasKey: true };
}

/**
 * Render the Mailgun settings section against a stubbed backend.
 *
 * @returns {Promise<object>} the tree, the requests and the flush helper.
 */
async function renderSection(options = {}) {
	const { React, flush, reset, setRerender } = reactStub();
	const factory = await loadFactory();
	const module = factory((id) => {
		if (id === 'react') return React;
		throw new Error(`unexpected require("${id}")`);
	});

	const requests = [];
	const list = options.accounts ?? [];
	globalThis.fetch = (url, init) => {
		requests.push({ url, init });
		const body = init?.body ? JSON.parse(init.body) : null;
		if (body === null) {
			// The list is read with GET; the answer carries the account list.
			return Promise.resolve({ json: () => Promise.resolve({ ok: true, value: viewStub(list) }) });
		}
		const value = body.action === 'test'
			? { ok: true, domains: [{ name: 'mg.example' }], keyConfigured: true, view: viewStub(list) }
			: { ok: true, id: 'example', hasKey: false, view: viewStub(list) };
		return Promise.resolve({ json: () => Promise.resolve({ ok: true, value }) });
	};

	const registered = [];
	const injected = [];
	const ctx = {
		effect(fn) { return fn(); },
		locale: {
			register(ns, dicts) { this.dicts = { ns, dicts }; return () => {}; },
			bind(ns) {
				const dicts = this.dicts?.dicts ?? {};
				const locale = dicts.en ?? {};
				return (key) => locale[key] ?? key;
			},
		},
		slots: {
			inject(name, factoryFn) { injected.push({ name, factoryFn }); },
			register(options, component) { registered.push({ options, component }); return () => {}; },
		},
	};
	module.apply(ctx);
	for (const entry of injected) entry.factoryFn();
	const section = registered.find((entry) => entry.options.name === 'settings.section');
	const t = ctx.locale.bind('dsh-mailgun.settings');

	let tree = section.component({ t });
	setRerender(() => {
		reset();
		tree = section.component({ t });
	});

	return { get tree() { return tree; }, requests, flush };
}

test('the add form opens and sends the account to the backend', async () => {
	const harness = await renderSection();
	// The initial load reads the account list.
	await new Promise((resolve) => setTimeout(resolve, 0));
	harness.flush();

	const buttons = () => elementsOf(harness.tree).filter((element) => element.type === 'button');
	const addAccount = buttons().find((button) => textOf(button) === 'Add Mailgun account');
	assert.ok(addAccount, 'the "Add Mailgun account" button is missing');
	addAccount.props.onClick();
	harness.flush();

	assert.ok(buttons().find((button) => textOf(button) === 'Add account'), 'the "Add account" button is missing');

	const inputs = elementsOf(harness.tree).filter((element) => element.type === 'input');
	assert.ok(inputs.length >= 5, 'the add form did not open');
	inputs[0].props.onChange({ target: { value: 'Example' } });
	harness.flush();
	const domainInput = elementsOf(harness.tree).filter((element) => element.type === 'input')[1];
	domainInput.props.onChange({ target: { value: 'mg.example.com' } });
	harness.flush();

	// The button is re-read after the edits: React swaps the handler on
	// re-render, and the payload is built from the draft of that render.
	buttons().find((button) => textOf(button) === 'Add account').props.onClick();
	await new Promise((resolve) => setTimeout(resolve, 0));

	const post = harness.requests.find((request) => request.init?.method === 'POST');
	assert.ok(post, 'no save request was sent');
	assert.equal(post.url, '/api/dsh-mailgun/settings');
	const payload = JSON.parse(post.init.body);
	assert.equal(payload.action, 'save');
	assert.equal(payload.account.label, 'Example');
	assert.equal(payload.account.domain, 'mg.example.com');
});

test('the "Make default" action keeps the fields of the account it names', async () => {
	const { MailgunSettingsBackend } = await import('../lib/settings-web.js');
	const { mkdtempSync, rmSync } = await import('node:fs');
	const { tmpdir } = await import('node:os');
	const { join } = await import('node:path');
	const home = mkdtempSync(join(tmpdir(), 'dsh-mailgun-test-'));
	try {
		const ctx = { dshHomePath: home, credentials: { async readRecord() {}, async modifyRecord() {} } };
		const service = { config: { apiKeyRef: 'MAILGUN_API_KEY' } };
		const backend = new MailgunSettingsBackend({ ctx, service });
		await backend.save({ action: 'save', account: { label: 'Example', domain: 'mg.example.com' } });
		await backend.save({ action: 'save', account: { id: 'example' }, makeDefault: true });

		const view = await backend.view();
		assert.equal(view.accounts.length, 1);
		assert.equal(view.accounts[0].label, 'Example', 'making an account default blanked it');
		assert.equal(view.accounts[0].domain, 'mg.example.com');
		assert.equal(view.defaultAccount, 'example');
	}
	finally {
		rmSync(home, { recursive: true, force: true });
	}
});

test('the saved accounts are listed, collapsed, and open on a click', async () => {
	const accounts = [accountStub('hostsalt', 'HostSalt'), accountStub('gpl-love', 'GPL LOVE')];
	const harness = await renderSection({ accounts });
	await new Promise((resolve) => setTimeout(resolve, 0));
	harness.flush();

	const buttons = () => elementsOf(harness.tree).filter((element) => element.type === 'button');
	const headers = buttons().filter((button) => button.props.className === 'mgsec_head');
	assert.equal(headers.length, 2, 'the saved accounts are not listed');
	assert.equal(textOf(headers[0]).includes('HostSalt'), true, 'the account label is missing');

	// Collapsed is the standard state: the form of an account is not open.
	const inputs = elementsOf(harness.tree).filter((element) => element.type === 'input');
	assert.equal(inputs.length, 0, 'an account opened itself');
	assert.equal(buttons().some((button) => textOf(button) === 'Save'), false, 'a collapsed account still shows its form');

	// Clicking the header opens that one account.
	headers[0].props.onClick();
	harness.flush();
	const openInputs = elementsOf(harness.tree).filter((element) => element.type === 'input');
	assert.equal(openInputs.length, 5, 'the account did not open');
	assert.equal(buttons().some((button) => textOf(button) === 'Save'), true, 'the opened account has no form');

	// The other account stays closed.
	const openHeaders = buttons().filter((button) => button.props.className === 'mgsec_head');
	assert.equal(openHeaders.filter((header) => header.props['aria-expanded'] === true).length, 1, 'more than one account is open');
});

test('a bare payload without the envelope is still read as the list', async () => {
	const { React, flush, reset, setRerender } = reactStub();
	const factory = await loadFactory();
	const module = factory((id) => {
		if (id === 'react') return React;
		throw new Error(`unexpected require("${id}")`);
	});
	// An answer without the `{ ok, value }` envelope must not empty the list.
	globalThis.fetch = () => Promise.resolve({
		json: () => Promise.resolve(viewStub([accountStub('hostsalt', 'HostSalt')])),
	});
	const registered = [];
	const injected = [];
	const ctx = {
		effect(fn) { return fn(); },
		locale: {
			register(ns, dicts) { this.dicts = { ns, dicts }; return () => {}; },
			bind(ns) {
				const dicts = this.dicts?.dicts ?? {};
				const locale = dicts.en ?? {};
				return (key) => locale[key] ?? key;
			},
		},
		slots: {
			inject(name, factoryFn) { injected.push({ name, factoryFn }); },
			register(options, component) { registered.push({ options, component }); return () => {}; },
		},
	};
	module.apply(ctx);
	for (const entry of injected) entry.factoryFn();
	const section = registered.find((entry) => entry.options.name === 'settings.section');
	const t = ctx.locale.bind('dsh-mailgun.settings');
	let tree = section.component({ t });
	setRerender(() => { reset(); tree = section.component({ t }); });
	await new Promise((resolve) => setTimeout(resolve, 0));
	flush();

	const headers = elementsOf(tree).filter((element) => element.type === 'button' && element.props.className === 'mgsec_head');
	assert.equal(headers.length, 1, 'the list stayed empty');
});
