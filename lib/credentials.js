/**
 * Credential resolution for the Mailgun API keys.
 *
 * Two kinds of secret reach this plugin:
 *
 *  - A **record** per account: `dsh-mailgun/<id>` in the harness credential
 *    store, holding that account's API key. The record half of the seam is
 *    right for it — an API key belongs to this plugin, has no environment to
 *    be read from, and must not sit in the settings document.
 *  - A **reference**: the plugin-level `MAILGUN_API_KEY`, resolved from the
 *    environment, the managed credentials document and `.env` fallbacks. It
 *    backs the single-account case and the bundle-level default.
 *
 * A key never reaches a log line, a tool result or the browser: the settings
 * backend reports only whether a key is present.
 */

import { credentialKeyFor } from './accounts.js';

/** The plugin-level credential reference. */
export const API_KEY_REF = 'MAILGUN_API_KEY';

/**
 * Find the credential service on a plugin context.
 *
 * @param {object} ctx - the plugin context.
 * @returns {object|null} the service, or null when this profile has none.
 */
function resolveCredentialsService(ctx) {
	try {
		const direct = ctx?.credentials;
		if (direct && typeof direct.resolve === 'function') return direct;
	}
	catch { /* A context that cannot resolve the service is "no service". */ }
	try {
		const resolved = typeof ctx?.get === 'function' ? ctx.get('credentials') : null;
		if (resolved && typeof resolved.resolve === 'function') return resolved;
	}
	catch { /* Same: a missing service is a supported configuration. */ }
	return null;
}

/**
 * Read the plugin-level API key reference.
 *
 * @param {object} ctx - the plugin context.
 * @param {string} ref - the credential reference name.
 * @returns {Promise<{value: string, source: string}>} the key and where it came from.
 */
export async function resolveApiKey(ctx, ref) {
	const service = resolveCredentialsService(ctx);
	if (service) {
		try {
			const resolved = await service.resolve(ref);
			if (resolved && typeof resolved.value === 'string' && resolved.value !== '') {
				return { value: resolved.value, source: resolved.source ?? 'credentials' };
			}
		}
		catch { /* Fall through to the environment. */ }
	}
	const fromEnv = process.env[ref];
	if (typeof fromEnv === 'string' && fromEnv !== '') return { value: fromEnv, source: 'env' };
	throw new Error(
		'Mailgun API key not found. Set the "' + ref + '" credential in the harness credential store, or add the key on the Mailgun settings page.',
	);
}

/**
 * Read one account's API key.
 *
 * @param {object} ctx - the plugin context.
 * @param {string} id - the account id.
 * @returns {Promise<string|undefined>} the key, or undefined when the account has none.
 */
export async function readAccountKey(ctx, id) {
	const service = resolveCredentialsService(ctx);
	if (!service || typeof service.readRecord !== 'function') return undefined;
	try {
		const record = await service.readRecord(credentialKeyFor(id));
		const key = record?.payload?.key ?? record?.key;
		return typeof key === 'string' && key !== '' ? key : undefined;
	}
	catch {
		return undefined;
	}
}

/**
 * Write one account's API key.
 *
 * @param {object} ctx - the plugin context.
 * @param {string} id - the account id.
 * @param {string} key - the API key.
 * @returns {Promise<void>} resolves when the record is committed.
 */
export async function writeAccountKey(ctx, id, key) {
	const service = resolveCredentialsService(ctx);
	if (!service || typeof service.modifyRecord !== 'function') {
		throw new Error('This profile has no credential store, so the API key cannot be stored.');
	}
	await service.modifyRecord(credentialKeyFor(id), () => ({
		kind: 'api-key',
		key,
	}));
}

/**
 * Delete one account's API key.
 *
 * @param {object} ctx - the plugin context.
 * @param {string} id - the account id.
 * @returns {Promise<void>} resolves when the record is gone.
 */
export async function deleteAccountKey(ctx, id) {
	const service = resolveCredentialsService(ctx);
	if (!service) return;
	try {
		if (typeof service.deleteRecord === 'function') {
			await service.deleteRecord(credentialKeyFor(id));
			return;
		}
		if (typeof service.modifyRecord === 'function') {
			await service.modifyRecord(credentialKeyFor(id), () => undefined);
		}
	}
	catch { /* A missing record is already the wanted state. */ }
}
