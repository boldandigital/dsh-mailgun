/**
 * The Mailgun account model.
 *
 * One account is one Mailgun credential plus the endpoints it belongs to:
 * the sending domain, the region and the From address. The account list
 * lives in `~/.dsh/data/dsh-mailgun/accounts.json`; see `./store.js`.
 *
 * The API key of an account is NOT stored here. It lives in the harness
 * credential store as a record keyed `dsh-mailgun/<id>`, which keeps the
 * secret out of the account document and out of every log line.
 */

import z from '@deepseek-ai/schemastery';

/** The credential-record scope this plugin owns. */
export const CREDENTIAL_SCOPE = 'dsh-mailgun';

/** One Mailgun account, without its key. */
export const AccountSchema = z.object({
	id: z.string().default(''),
	label: z.string().default(''),
	domain: z.string().default(''),
	region: z.union(['us', 'eu']).default('us'),
	from: z.string().default(''),
	senderName: z.string().default(''),
});

/**
 * Turn a label into an id the credential store accepts.
 *
 * The credential key grammar is `lowercase-hyphenated` on both sides of the
 * slash, so a label like "Bold & Digital" becomes `bold-digital` and a
 * label like "HostSalt (EU)" becomes `hostsalt-eu`.
 *
 * @param {string} label - the raw label.
 * @returns {string} a usable id, possibly empty when the label has no usable characters.
 */
export function slugify(label) {
	return String(label ?? '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-');
}

/**
 * Make an id unique within a set of taken ids.
 *
 * @param {string} base - the wanted id.
 * @param {Iterable<string>} taken - the ids already in use.
 * @returns {string} an id that is not taken.
 */
export function uniqueId(base, taken) {
	const used = new Set(taken);
	if (base !== '' && !used.has(base)) return base;
	for (let index = 2; ; index += 1) {
		const candidate = base === '' ? 'account-' + index : base + '-' + index;
		if (!used.has(candidate)) return candidate;
	}
}

/**
 * Validate one account row coming from the browser.
 *
 * The id is only kept when the browser named one, because that is what tells
 * an *edited* account apart from a *new* one. Deriving the id from the label
 * here would make every new account look like the account that already owns
 * that label, so adding a second one would replace the first.
 *
 * @param {object} row - the raw row.
 * @returns {{id: string, label: string, domain: string, region: string, from: string}} the clean row.
 */
export function cleanAccount(row) {
	const source = row && typeof row === 'object' ? row : {};
	return {
		id: slugify(source.id ?? ''),
		label: String(source.label ?? '').trim(),
		domain: String(source.domain ?? '').trim(),
		region: source.region === 'eu' ? 'eu' : 'us',
		from: String(source.from ?? '').trim(),
		senderName: String(source.senderName ?? '').trim(),
	};
}

/**
 * The credential-store key for one account.
 *
 * @param {string} id - the account id.
 * @returns {string} the record key.
 */
export function credentialKeyFor(id) {
	return CREDENTIAL_SCOPE + '/' + id;
}
