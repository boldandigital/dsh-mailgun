/**
 * The Mailgun service.
 *
 * It owns the account list, the credential lookup and the four API calls the
 * tools make. Every call resolves the account first — by name, by id, or the
 * configured default — and then resolves that account's key, so a key
 * rotated in the credential store takes effect on the next send without a
 * restart.
 */

import { apiBase, listDomains, listEvents, domainStats, sendMessage } from './api.js';
import { readAccountKey, resolveApiKey, API_KEY_REF } from './credentials.js';
import { readConfig } from './config.js';

/** The service. */
export class MailgunService {
	/**
	 * @param {object} ctx - the plugin context.
	 * @param {object} raw - the plugin configuration.
	 * @param {object} [options] - the live account source.
	 * @param {() => Promise<{accounts: object[], defaultAccount: string}>} [options.accounts] - reads the current accounts.
	 */
	constructor(ctx, raw, options = {}) {
		this.ctx = ctx;
		this.raw = raw;
		this.readAccounts = options.accounts ?? (() => ({ accounts: [], defaultAccount: '' }));
	}

	/** The current configuration. */
	get config() {
		return readConfig(this.raw);
	}

	/**
	 * The API base URL for the configured region.
	 *
	 * @returns {string} the base URL.
	 */
	get base() {
		return this.baseFor(this.config.region);
	}

	/**
	 * The API base URL for one region.
	 *
	 * @param {string} region - the Mailgun region.
	 * @returns {string} the base URL.
	 */
	baseFor(region) {
		return apiBase(region);
	}

	/**
	 * Every configured account.
	 *
	 * @returns {Promise<object[]>} the accounts.
	 */
	async accounts() {
		const source = (await this.readAccounts()) ?? {};
		return Array.isArray(source.accounts) ? source.accounts : [];
	}

	/**
	 * The account list with the plugin-level defaults folded in.
	 *
	 * An account that names no domain inherits the bundle configuration, so a
	 * single-account install needs no account at all.
	 *
	 * @returns {Promise<object[]>} the resolved accounts.
	 */
	async resolvedAccounts() {
		const config = this.config;
		return (await this.accounts()).map((account) => ({
			...account,
			domain: account.domain !== '' ? account.domain : config.domain,
			region: account.region ?? config.region,
			from: account.from !== '' ? account.from : config.from,
		}));
	}

	/**
	 * Find one account by id, by label, or the default one.
	 *
	 * @param {string} [wanted] - the account id or label.
	 * @returns {Promise<object>} the account.
	 */
	async account(wanted) {
		const accounts = await this.resolvedAccounts();
		const needle = typeof wanted === 'string' ? wanted.trim() : '';
		if (needle !== '') {
			const found = accounts.find((account) => account.id === needle || account.label === needle);
			if (found) return found;
			const available = accounts.map((account) => account.id).join(', ');
			throw new Error(
				'Unknown Mailgun account "' + needle + '". Available: ' + (available !== '' ? available : '(none configured)') + '.',
			);
		}
		const source = (await this.readAccounts()) ?? {};
		const defaultId = source.defaultAccount ?? '';
		if (defaultId !== '') {
			const found = accounts.find((account) => account.id === defaultId);
			if (found) return found;
		}
		if (accounts.length === 1) return accounts[0];
		if (accounts.length === 0) {
			// A single-account install may rely on the bundle configuration
			// alone: the domain, region and From come from the patch and the
			// key from the plugin-level credential reference.
			return { id: '', label: '', domain: this.config.domain, region: this.config.region, from: this.config.from };
		}
		throw new Error(
			'No Mailgun account selected. Pass an account name, or set a default on the Mailgun settings page. Available: '
			+ accounts.map((account) => account.id).join(', ') + '.',
		);
	}

	/**
	 * Resolve the API key for one account.
	 *
	 * @param {object} account - the account.
	 * @returns {Promise<{value: string, source: string}>} the key and its source.
	 */
	async keyFor(account) {
		if (account?.id) {
			const key = await readAccountKey(this.ctx, account.id);
			if (key) return { value: key, source: 'account' };
		}
		return await resolveApiKey(this.ctx, this.config.apiKeyRef);
	}

	/**
	 * Send one message.
	 *
	 * @param {object} options - the send options.
	 * @returns {Promise<object>} the Mailgun response.
	 */
	async send(options) {
		const account = await this.account(options.account);
		const { value: apiKey } = await this.keyFor(account);
		const from = options.from ?? account.from;
		if (typeof from !== 'string' || from.trim() === '') {
			throw new Error('No From address is configured for this account. Set one on the Mailgun settings page.');
		}
		const domain = options.domain ?? account.domain;
		if (typeof domain !== 'string' || domain.trim() === '') {
			throw new Error('No sending domain is configured for this account. Set one on the Mailgun settings page.');
		}
		const response = await sendMessage({
			base: this.baseFor(account.region),
			domain,
			apiKey,
			from: from.trim(),
			to: options.to,
			cc: options.cc,
			bcc: options.bcc,
			subject: options.subject,
			text: options.text,
			html: options.html,
			tracking: options.tracking,
			tag: options.tag,
			testMode: options.testMode,
			signal: options.signal,
			senderName: account.senderName,
		});
		return { ...response, account: account.id || account.label || 'default', domain, from: from.trim(), to: options.to };
	}

	/**
	 * Read the event feed.
	 *
	 * @param {object} options - the query options.
	 * @returns {Promise<object>} the events response.
	 */
	async events(options) {
		const account = await this.account(options.account);
		const { value: apiKey } = await this.keyFor(account);
		const domain = options.domain ?? account.domain;
		return await listEvents({
			base: this.baseFor(account.region),
			domain,
			apiKey,
			event: options.event,
			recipient: options.recipient,
			limit: options.limit,
			ascending: options.ascending,
			signal: options.signal,
		});
	}

	/**
	 * List the sending domains.
	 *
	 * @param {object} options - the query options.
	 * @returns {Promise<object>} the domains response.
	 */
	async domains(options) {
		const account = await this.account(options.account);
		const { value: apiKey } = await this.keyFor(account);
		return await listDomains({ base: this.baseFor(account.region), apiKey, limit: options.limit, signal: options.signal });
	}

	/**
	 * Read the domain statistics.
	 *
	 * @param {object} options - the query options.
	 * @returns {Promise<object>} the stats response.
	 */
	async stats(options) {
		const account = await this.account(options.account);
		const { value: apiKey } = await this.keyFor(account);
		const domain = options.domain ?? account.domain;
		return await domainStats({ base: this.baseFor(account.region), domain, apiKey, signal: options.signal });
	}
}
