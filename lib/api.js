/**
 * The Mailgun HTTP API client.
 *
 * Everything speaks the documented v3 REST API: `POST /v3/{domain}/messages`
 * for sending, `GET /v3/{domain}/events` for the delivery and engagement
 * feed, `GET /v3/domains` for the sending domains and
 * `GET /v3/{domain}/stats/total` for the counters.
 *
 * Tracking is per message: `o:tracking`, `o:tracking-opens` and
 * `o:tracking-clicks` are send-time flags, because the dashboard toggle
 * cannot be relied on for a restricted key.
 */

import { apiBase } from './config.js';

/** The error a failed Mailgun call produces. */
export class MailgunError extends Error {
	/**
	 * @param {string} message - the human-readable failure.
	 * @param {object} [details] - the parsed Mailgun error body.
	 */
	constructor(message, details) {
		super(message);
		this.name = 'MailgunError';
		this.status = details?.status ?? 0;
		this.code = details?.code ?? '';
		this.details = details;
	}
}

/**
 * Perform one Mailgun API call.
 *
 * @param {object} options - the call options.
 * @param {string} options.base - the API base URL for the region.
 * @param {string} options.path - the path below the base URL.
 * @param {string} options.apiKey - the Mailgun API key.
 * @param {object} [options.query] - query parameters.
 * @param {URLSearchParams} [options.form] - the form body for a send.
 * @param {string} [options.method] - the HTTP method; defaults to GET.
 * @param {AbortSignal} [options.signal] - the caller's cancellation signal.
 * @returns {Promise<object>} the parsed JSON response.
 */
export async function call(options) {
	const { base, path, apiKey, query, form, method = 'GET', signal } = options;
	const url = new URL(base + path);
	for (const [key, value] of Object.entries(query ?? {})) {
		if (value === undefined || value === null || value === '') continue;
		// A list is sent as one repeated parameter per value. Mailgun reads
		// `?event=accepted&event=delivered` as two filters, while a single
		// `?event=accepted,delivered` is one unknown event name and matches
		// nothing at all.
		if (Array.isArray(value)) {
			for (const item of value) {
				if (item !== undefined && item !== null && item !== '') url.searchParams.append(key, String(item));
			}
			continue;
		}
		url.searchParams.set(key, String(value));
	}
	const headers = { Authorization: 'Basic ' + Buffer.from('api:' + apiKey).toString('base64') };
	let body;
	if (form) {
		headers['Content-Type'] = 'application/x-www-form-urlencoded';
		body = form.toString();
	}
	let response;
	try {
		response = await fetch(url, { method, headers, body, signal });
	}
	catch (error) {
		if (error?.name === 'AbortError') throw error;
		throw new MailgunError('Mailgun API request failed: ' + (error?.message ?? error));
	}
	const text = await response.text();
	let parsed;
	try {
		parsed = text === '' ? {} : JSON.parse(text);
	}
	catch {
		parsed = { message: text.slice(0, 400) };
	}
	if (!response.ok) {
		throw new MailgunError(
			'Mailgun API error ' + response.status + ': ' + (parsed?.message ?? text.slice(0, 300)),
			{ status: response.status, code: parsed?.code ?? '', ...parsed },
		);
	}
	return parsed;
}

/**
 * Send one message through the Mailgun API.
 *
 * @param {object} options - the send options.
 * @param {string} options.base - the API base URL.
 * @param {string} options.domain - the sending domain.
 * @param {string} options.apiKey - the Mailgun API key.
 * @param {string} options.from - the From address.
 * @param {string[]} options.to - the recipients.
 * @param {string} [options.cc] - the CC recipients.
 * @param {string} [options.bcc] - the BCC recipients.
 * @param {string} options.subject - the subject line.
 * @param {string} [options.text] - the plain-text body.
 * @param {string} [options.html] - the HTML body.
 * @param {boolean} [options.tracking] - whether to track opens and clicks.
 * @param {string} [options.tag] - the campaign tag.
 * @param {boolean} [options.testMode] - whether to validate without delivering.
 * @param {AbortSignal} [options.signal] - the cancellation signal.
 * @returns {Promise<object>} the Mailgun response (the message id lives in `id`).
 */
export async function sendMessage(options) {
	const {
		base, domain, apiKey, from, to, cc, bcc, subject,
		text, html, tracking = true, tag, testMode = false, signal,
		senderName,
	} = options;
	const form = new URLSearchParams();
	form.set('from', from);
	if (senderName) form.set('sender_name', senderName);
	for (const address of to) form.append('to', address);
	for (const address of cc ?? []) form.append('cc', address);
	for (const address of bcc ?? []) form.append('bcc', address);
	form.set('subject', subject);
	if (text) form.set('text', text);
	if (html) form.set('html', html);
	// Tracking is a per-message flag: the dashboard toggle cannot be trusted
	// for a key that cannot open the tracking endpoints.
	if (tracking) {
		form.set('o:tracking', 'yes');
		form.set('o:tracking-opens', 'yes');
		form.set('o:tracking-clicks', 'htmlonly');
	}
	else {
		form.set('o:tracking', 'no');
	}
	if (tag) form.set('o:tag', tag);
	if (testMode) form.set('o:testmode', 'yes');
	return await call({ base, path: '/' + encodeURIComponent(domain) + '/messages', apiKey, method: 'POST', form, signal });
}

/**
 * Read the event feed for a domain.
 *
 * @param {object} options - the query options.
 * @param {string} options.base - the API base URL.
 * @param {string} options.domain - the sending domain.
 * @param {string} options.apiKey - the Mailgun API key.
 * @param {string} [options.event] - one event name, or a comma-separated list.
 * @param {string} [options.recipient] - filter by recipient.
 * @param {number} [options.limit] - the number of events to return.
 * @param {boolean} [options.ascending] - the sort order.
 * @param {AbortSignal} [options.signal] - the cancellation signal.
 * @returns {Promise<object>} the parsed events response.
 */
export async function listEvents(options) {
	const { base, domain, apiKey, event, recipient, limit = 25, ascending = false, signal } = options;
	return await call({
		base,
		path: '/' + encodeURIComponent(domain) + '/events',
		apiKey,
		query: {
			// One parameter per event name; a comma-separated list in a single
			// parameter is one unknown name to Mailgun.
			event: eventNames(event),
			recipient,
			limit: Math.min(Math.max(Number(limit) || 25, 1), 300),
			ascending: ascending ? 'yes' : 'no',
		},
		signal,
	});
}

/**
 * Split an event filter into its names.
 *
 * @param {string|string[]|undefined} event - one name, a comma-separated list, or a list.
 * @returns {string[]|undefined} the names, or undefined when no filter was given.
 */
export function eventNames(event) {
	if (event === undefined || event === null || event === '') return undefined;
	const names = (Array.isArray(event) ? event : String(event).split(','))
		.map((name) => String(name).trim())
		.filter((name) => name !== '');
	return names.length === 0 ? undefined : names;
}

/**
 * List the sending domains on the account.
 *
 * @param {object} options - the query options.
 * @param {string} options.base - the API base URL.
 * @param {string} options.apiKey - the Mailgun API key.
 * @param {number} [options.limit] - the number of domains to return.
 * @param {AbortSignal} [options.signal] - the cancellation signal.
 * @returns {Promise<object>} the parsed domains response.
 */
export async function listDomains(options) {
	const { base, apiKey, limit = 20, signal } = options;
	return await call({ base, path: '/domains', apiKey, query: { limit: Math.min(Math.max(Number(limit) || 20, 1), 100) }, signal });
}

/**
 * Read the aggregate counters for a domain.
 *
 * @param {object} options - the query options.
 * @param {string} options.base - the API base URL.
 * @param {string} options.domain - the sending domain.
 * @param {string} options.apiKey - the Mailgun API key.
 * @param {AbortSignal} [options.signal] - the cancellation signal.
 * @returns {Promise<object>} the parsed stats response.
 */
export async function domainStats(options) {
	const { base, domain, apiKey, signal } = options;
	return await call({ base, path: '/' + encodeURIComponent(domain) + '/stats/total', apiKey, signal });
}

/** The API base for a region. */
export { apiBase };
