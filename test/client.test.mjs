/**
 * Client bundle sanity test.
 *
 * The browser half of a DSH plugin is loaded outside React: `apply(ctx)` runs
 * in the module system, not in a component render. A hook called from `apply`
 * therefore throws in the browser ("Invalid hook call") and the module never
 * registers — the settings section and its icon silently disappear.
 *
 * This test loads the bundle the way the browser does, with a React stub whose
 * hooks throw, and checks that `apply` registers both slot contributions.
 *
 *   node --test test/*.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(here, '..', 'lib', 'client.js');

/** A React stub whose hooks refuse to run outside a component render. */
function reactStub() {
	return {
		createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
		useState: () => { throw new Error('Invalid hook call: useState outside a component render'); },
		useEffect: () => { throw new Error('Invalid hook call: useEffect outside a component render'); },
		useRef: () => { throw new Error('Invalid hook call: useRef outside a component render'); },
		useMemo: () => { throw new Error('Invalid hook call: useMemo outside a component render'); },
	};
}

/** Load the client bundle and return its module exports. */
async function loadBundle() {
	let registration = null;
	globalThis.window = {
		__ModuleLoader__: {
			load(spec) { registration = spec; },
		},
	};
	await import(`file://${bundlePath}?t=${Date.now()}`);
	assert.ok(registration, 'the bundle did not register itself with the module loader');
	assert.equal(registration.id, 'dsh-mailgun', 'the factory id must equal the package id');
	return registration.factory((id) => {
		if (id === 'react') return reactStub();
		throw new Error(`unexpected require("${id}")`);
	});
}

/** A client context that records what the module registers. */
function contextStub() {
	const registered = [];
	const injected = [];
	return {
		registered,
		injected,
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
			inject(name, factory) { injected.push({ name, factory }); },
			register(options, component) { registered.push({ options, component }); return () => {}; },
		},
	};
}

test('the client bundle registers the settings section and its icon', async () => {
	const module = await loadBundle();
	assert.deepEqual(module.inject, ['slots', 'locale']);

	const ctx = contextStub();
	module.apply(ctx);

	// The slot system calls the injected factory when the seat exists; the
	// stub calls it right away so the registration is observable.
	for (const entry of ctx.injected) entry.factory();

	const names = ctx.injected.map((entry) => entry.name);
	assert.ok(names.includes('settings.section'), 'no settings.section contribution');
	assert.ok(names.includes('settings.section.icon'), 'no settings.section.icon contribution');

	const section = ctx.registered.find((entry) => entry.options.name === 'settings.section');
	const icon = ctx.registered.find((entry) => entry.options.name === 'settings.section.icon');
	assert.ok(section, 'the settings section was not registered');
	assert.ok(icon, 'the settings section icon was not registered');

	// The icon only renders when its id matches the section's id.
	assert.equal(icon.options.id, section.options.id, 'the icon id must match the section id');
	assert.equal(section.options.label(), 'Mailgun', 'the section label must come from the locale service');
});

test('the section icon is the plugin artwork', async () => {
	const module = await loadBundle();
	const ctx = contextStub();
	module.apply(ctx);
	for (const entry of ctx.injected) entry.factory();

	const icon = ctx.registered.find((entry) => entry.options.name === 'settings.section.icon');
	const element = icon.component({ size: 20 });
	assert.equal(element.props.src.startsWith('data:image/svg+xml;base64,'), true);
});
