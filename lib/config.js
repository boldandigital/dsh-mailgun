/**
 * Configuration for the Mailgun API tools.
 *
 * The API key is deliberately not part of this configuration. It is resolved
 * at call time from the harness credential store (the `MAILGUN_API_KEY`
 * reference) or the process environment, so a key never sits in a patch file
 * that gets synced, logged or committed.
 */

import z from '@deepseek-ai/schemastery';

/** Regions Mailgun operates in; the API host differs between them. */
export const REGIONS = ['us', 'eu'];

/** The credential reference the API key is read from. */
export const API_KEY_REF = 'MAILGUN_API_KEY';

/** The API base for a region. */
export function apiBase(region) {
	return region === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3';
}

/**
 * Normalize the raw plugin configuration.
 *
 * @param {object} raw - the plugin config from the loader.
 * @returns {{domain: string, region: string, from: string, senderName: string, apiKeyRef: string}} the resolved config.
 */
export function readConfig(raw) {
	const region = REGIONS.includes(raw?.region) ? raw.region : 'us';
	return {
		domain: typeof raw?.domain === 'string' ? raw.domain.trim() : '',
		region,
		from: typeof raw?.from === 'string' ? raw.from.trim() : '',
		senderName: typeof raw?.senderName === 'string' ? raw.senderName.trim() : '',
		apiKeyRef: typeof raw?.apiKeyRef === 'string' && raw.apiKeyRef.trim() !== '' ? raw.apiKeyRef.trim() : API_KEY_REF,
	};
}

/** Config schema for the loader. */
export const Config = z.object({
	domain: z.string().default(''),
	region: z.union(['us', 'eu']).default('us'),
	from: z.string().default(''),
	senderName: z.string().default(''),
	apiKeyRef: z.string().default(API_KEY_REF),
});
