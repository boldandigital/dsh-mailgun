/**
 * The account store.
 *
 * The account list lives in its own document, `~/.dsh/data/dsh-mailgun/accounts.json`,
 * rather than in the profile patch or in the harness settings service.
 *
 * The reason is that the harness settings API is the one part of DSH whose
 * shape changed between releases: a host that provides the namespace-registration
 * API (`ctx.settings.register`) and a host that exposes the per-entry form API
 * (`ctx.settings.update`) need different code, and a plugin that binds to
 * either one breaks on the other. The account list is this plugin's own state,
 * so it keeps its own file: one contract, every host.
 *
 * The API keys are NOT here. They live in the harness credential store, one
 * record per account, so a key never touches a document the harness might
 * display or a file a user might sync.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/** The document's file name. */
export const STORE_FILE = 'accounts.json';

/** The store's directory, relative to the harness home. */
export const STORE_DIR = 'data/dsh-mailgun';

/**
 * The harness home directory.
 *
 * @param {object} ctx - the plugin context.
 * @returns {string} the absolute path.
 */
export function resolveHome(ctx) {
	const provided = ctx?.dshHomePath ?? ctx?.get?.('dshHomePath');
	if (typeof provided === 'string' && provided !== '') return resolve(provided);
	const fromEnv = process.env.DSH_HOME?.trim();
	if (typeof fromEnv === 'string' && fromEnv !== '') return resolve(fromEnv);
	return join(homedir(), '.dsh');
}

/**
 * The account store.
 */
export class AccountStore {
	/**
	 * @param {object} ctx - the plugin context.
	 */
	constructor(ctx) {
		this.ctx = ctx;
		this.root = resolve(resolveHome(ctx), STORE_DIR);
		this.file = join(this.root, STORE_FILE);
		this.cache = undefined;
	}

	/**
	 * Read the account list.
	 *
	 * A missing or unreadable document reads as an empty list rather than
	 * failing the plugin: a fresh install has no accounts yet, and that is not
	 * an error condition.
	 *
	 * @returns {Promise<{accounts: object[], defaultAccount: string}>} the stored state.
	 */
	async read() {
		if (this.cache !== undefined) return this.cache;
		let state = { accounts: [], defaultAccount: '' };
		try {
			const raw = await readFile(this.file, 'utf8');
			const parsed = JSON.parse(raw);
			const accounts = Array.isArray(parsed?.accounts) ? parsed.accounts : [];
			state = {
				accounts: accounts.filter((account) => account && typeof account === 'object'),
				defaultAccount: typeof parsed?.defaultAccount === 'string' ? parsed.defaultAccount : '',
			};
		}
		catch {
			// An absent document is a fresh install; an unreadable one must not
			// take the mail tools down with it.
		}
		this.cache = state;
		return state;
	}

	/**
	 * Write the account list.
	 *
	 * The write is atomic — a temporary file in the same directory, then a
	 * rename — so a crash mid-write can never leave a half-written account
	 * list behind.
	 *
	 * @param {{accounts: object[], defaultAccount: string}} state - the new state.
	 * @returns {Promise<{accounts: object[], defaultAccount: string}>} the written state.
	 */
	async write(state) {
		const next = {
			accounts: Array.isArray(state?.accounts) ? state.accounts : [],
			defaultAccount: typeof state?.defaultAccount === 'string' ? state.defaultAccount : '',
		};
		await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
		const temporary = this.file + '.tmp';
		await writeFile(temporary, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
		await rename(temporary, this.file);
		this.cache = next;
		return next;
	}
}
