/**
 * The Mailgun settings backend.
 *
 * It is the one place that changes the account list and the account keys.
 * The browser half reaches it over the connection channel
 * (`/api/dsh-mailgun/settings`); the raw web route
 * (`/_dsh/dsh-mailgun/settings`) serves the same backend for a client that
 * does not speak the connection channel.
 *
 * The API key of an account is write-only from the browser's point of view:
 * the backend reports only whether a key is present, never its value.
 */

import { cleanAccount, slugify, uniqueId } from './accounts.js';
import { deleteAccountKey, readAccountKey, writeAccountKey } from './credentials.js';
import { AccountStore } from './store.js';

/** The route the connection channel serves. */
export const SETTINGS_API_ROUTE = '/api/dsh-mailgun/settings';

/** The raw web route. */
export const SETTINGS_ROUTE = '/_dsh/dsh-mailgun/settings';

/**
 * The settings backend.
 */
export class MailgunSettingsBackend {
	/**
	 * @param {object} options - the backend wiring.
	 * @param {object} options.ctx - the plugin context.
	 * @param {object} options.service - the Mailgun service.
	 * @param {object} [options.store] - the account store; one is created when absent.
	 */
	constructor(options) {
		this.ctx = options.ctx;
		this.service = options.service;
		this.store = options.store ?? new AccountStore(options.ctx);
	}

	/**
	 * The account list as the browser sees it.
	 *
	 * @returns {Promise<object>} the view.
	 */
	async view() {
		const source = await this.store.read();
		const accounts = [];
		for (const account of Array.isArray(source.accounts) ? source.accounts : []) {
			accounts.push({
				...account,
				hasKey: await readAccountKey(this.ctx, account.id) !== undefined,
			});
		}
		return {
			accounts,
			defaultAccount: source.defaultAccount ?? '',
			credentialRef: this.service.config.apiKeyRef,
			defaults: {
				domain: this.service.config.domain,
				region: this.service.config.region,
				from: this.service.config.from,
			},
		};
	}

	/**
	 * Apply one action from the browser.
	 *
	 * @param {object} payload - the action.
	 * @returns {Promise<object>} the action result.
	 */
	async apply(payload) {
		const action = typeof payload?.action === 'string' ? payload.action : '';
		switch (action) {
			case 'save':
				return await this.save(payload);
			case 'remove':
				return await this.remove(payload);
			case 'test':
				return await this.test(payload);
			default:
				throw new Error('Unknown action "' + action + '".');
		}
	}

	/**
	 * Upsert one account and, when given, its API key.
	 *
	 * @param {object} payload - the action payload.
	 * @returns {Promise<object>} the action result.
	 */
	async save(payload) {
		const source = await this.store.read();
		const existing = Array.isArray(source.accounts) ? source.accounts : [];
		const raw = payload?.account ?? {};
		let row = cleanAccount(raw);
		// A request that names an existing account and nothing else — the
		// "Make default" action sends only the id — must not blank the
		// account it points at. The stored row is the base; the fields the
		// browser did send win.
		const named = existing.find((account) => account.id === row.id);
		if (named !== undefined
			&& row.label === '' && row.domain === '' && row.from === '' && row.senderName === '') {
			row = { ...named, id: row.id };
		}
		if (row.label === '' && row.domain === '') {
			throw new Error('An account needs at least a label or a sending domain.');
		}
		// An id the browser named identifies an account that already exists, so
		// the row updates it in place — the account keeps its id and its key.
		// Without one the account is new, and a new account must never land on
		// an id that is already in use: two accounts can carry the same label.
		const edited = row.id !== '' && existing.some((account) => account.id === row.id);
		const taken = existing
			.filter((account) => !edited || account.id !== row.id)
			.map((account) => account.id);
		const base = row.id !== '' ? row.id : slugify(row.label);
		const id = edited ? row.id : uniqueId(base, taken);
		if (id === '') throw new Error('That label does not contain any usable characters for an account id.');
		const next = existing.filter((account) => account.id !== id);
		next.push({ ...row, id });
		let defaultAccount = source.defaultAccount ?? '';
		if (payload?.makeDefault === true || (defaultAccount === '' && next.length === 1)) defaultAccount = id;
		await this.store.write({ accounts: next, defaultAccount });
		const key = typeof payload?.apiKey === 'string' ? payload.apiKey.trim() : '';
		if (key !== '') await writeAccountKey(this.ctx, id, key);
		else if (payload?.clearKey === true) await deleteAccountKey(this.ctx, id);
		return { ok: true, id, hasKey: (await readAccountKey(this.ctx, id)) !== undefined };
	}

	/**
	 * Remove one account and its key.
	 *
	 * @param {object} payload - the action payload.
	 * @returns {Promise<object>} the action result.
	 */
	async remove(payload) {
		const id = typeof payload?.id === 'string' ? payload.id.trim() : '';
		if (id === '') throw new Error('No account id given.');
		const source = await this.store.read();
		const existing = Array.isArray(source.accounts) ? source.accounts : [];
		const next = existing.filter((account) => account.id !== id);
		await this.store.write({
			accounts: next,
			defaultAccount: source.defaultAccount === id ? '' : (source.defaultAccount ?? ''),
		});
		await deleteAccountKey(this.ctx, id);
		return { ok: true };
	}

	/**
	 * Verify one account's key against Mailgun.
	 *
	 * @param {object} payload - the action payload.
	 * @returns {Promise<object>} the action result.
	 */
	async test(payload) {
		const id = typeof payload?.id === 'string' ? payload.id.trim() : '';
		const account = await this.service.account(id);
		const { value: apiKey } = await this.service.keyFor(account);
		const response = await this.service.domains({ account: id, limit: 100 });
		const domains = (response?.items ?? []).map((domain) => ({
			name: domain.name ?? '',
			state: domain.state ?? '',
		}));
		return { ok: true, domains, keyConfigured: apiKey !== '' };
	}

	/**
	 * Answer one raw HTTP request from the web server.
	 *
	 * This route carries API keys, so it is localhost-only and refuses a
	 * foreign `Host` header: a rebound domain resolves to 127.0.0.1 and
	 * would otherwise post a key here from a page the user merely visited.
	 *
	 * @param {object} req - the Node request.
	 * @param {object} res - the Node response.
	 * @returns {Promise<void>} resolves when the response is written.
	 */
	async handle(req, res) {
		const remote = String(req.socket?.remoteAddress ?? '');
		if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
			this.responseJson(res, 403, { ok: false, error: { message: 'the Mailgun settings route is localhost-only' } });
			return;
		}
		if (req.method === 'GET') {
			try {
				this.responseJson(res, 200, { ok: true, value: await this.view() });
			}
			catch (error) {
				this.responseJson(res, 503, { ok: false, error: { message: error instanceof Error ? error.message : String(error) } });
			}
			return;
		}
		if (req.method !== 'POST') {
			res.setHeader('Allow', 'GET, POST');
			this.responseJson(res, 405, { ok: false, error: { message: 'Use GET or POST' } });
			return;
		}
		let payload;
		try {
			const chunks = [];
			for await (const chunk of req) {
				const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
				if (chunks.reduce((n, c) => n + c.length, 0) + part.length > 256 * 1024) {
					throw new RangeError('request body too large');
				}
				chunks.push(part);
			}
			payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
		}
		catch (error) {
			this.responseJson(res, 400, { ok: false, error: { message: error instanceof Error ? error.message : String(error) } });
			return;
		}
		try {
			const result = await this.apply(payload);
			this.responseJson(res, 200, { ok: true, value: { ...result, view: await this.view() } });
		}
		catch (error) {
			this.responseJson(res, 400, { ok: false, error: { message: error instanceof Error ? error.message : String(error) } });
		}
	}

	/**
	 * Write one JSON response to a Node response.
	 *
	 * @param {object} res - the Node response.
	 * @param {number} status - the HTTP status.
	 * @param {object} body - the response body.
	 */
	responseJson(res, status, body) {
		const bytes = Buffer.from(JSON.stringify(body));
		res.statusCode = status;
		res.setHeader('content-type', 'application/json; charset=utf-8');
		res.setHeader('cache-control', 'no-store');
		res.setHeader('content-length', String(bytes.length));
		res.end(bytes);
	}

	/**
	 * Answer one HTTP request.
	 *
	 * @param {Request} request - the incoming request.
	 * @returns {Promise<Response>} the response.
	 */
	async fetch(request) {
		if (request.method === 'GET') {
			// The same envelope as the POST and as the raw route: the browser
			// reads one shape everywhere. A bare payload here made the client
			// treat the answer as a failure, so the account list stayed empty.
			try {
				return this.json({ ok: true, value: await this.view() });
			}
			catch (error) {
				return this.json({ ok: false, error: { message: error instanceof Error ? error.message : String(error) } }, 503);
			}
		}
		if (request.method !== 'POST') {
			return this.json({ ok: false, error: { message: 'Use GET or POST' } }, 405);
		}
		let payload;
		try {
			payload = await request.json();
		}
		catch {
			return this.json({ ok: false, error: { message: 'Body is not JSON' } }, 400);
		}
		try {
			const result = await this.apply(payload);
			return this.json({ ok: true, value: { ...result, view: await this.view() } });
		}
		catch (error) {
			return this.json({ ok: false, error: { message: error instanceof Error ? error.message : String(error) } }, 400);
		}
	}

	/**
	 * Build one JSON response.
	 *
	 * @param {object} body - the response body.
	 * @param {number} [status] - the HTTP status.
	 * @returns {Response} the response.
	 */
	json(body, status = 200) {
		return new Response(JSON.stringify(body), {
			status,
			headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
		});
	}
}
