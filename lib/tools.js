/**
 * The Mailgun tools.
 *
 * Four tools, all speaking the Mailgun HTTP API: send a message (with
 * per-message open and click tracking), read the event feed that carries the
 * delivery and engagement counters, list the sending domains on the account,
 * and read the aggregate statistics for the configured domain.
 */

/** How long one Mailgun call may take. */
const TIMEOUT_MS = 30_000;

/**
 * Compile a JSON-schema parameter block.
 *
 * @param {object} spec - the parameter spec.
 * @returns {object} the JSON schema for the tool parameters.
 */
function parameters(spec) {
	const properties = {};
	const required = [];
	for (const [key, prop] of Object.entries(spec)) {
		const node = {};
		if (typeof prop.type === 'string') node.type = prop.type;
		else if (Array.isArray(prop.type)) node.oneOf = prop.type.map(type => ({ type }));
		if (typeof prop.description === 'string') node.description = prop.description;
		if (prop.default !== undefined) node.default = prop.default;
		properties[key] = node;
		if (prop.required === true) required.push(key);
	}
	return { type: 'object', properties, required };
}

/**
 * Split a comma-separated address list.
 *
 * @param {string|undefined} value - the raw list.
 * @returns {string[]} the addresses.
 */
function addressList(value) {
	if (typeof value !== 'string') return [];
	return value.split(',').map(part => part.trim()).filter(part => part !== '');
}

/**
 * Render helper for mailgun_send.
 */
function renderSend(_args, value) {
	return [{
		type: 'text',
		text: `✅ Sent via Mailgun\n` +
			`Message ID: ${value.id}\n` +
			`Domain: ${value.domain}\n` +
			`From: ${value.from}\n` +
			`To: ${Array.isArray(value.to) ? value.to.join(', ') : value.to}\n` +
			`Account: ${value.account}`
	}];
}

/**
 * Render helper for mailgun_events.
 */
function renderEvents(_args, value) {
	const items = value.items ?? [];
	if (items.length === 0) {
		return [{ type: 'text', text: 'No events found.' }];
	}
	const lines = items.slice(0, 20).map(ev =>
		`• ${ev.event?.toUpperCase() || 'EVENT'} | ${ev.recipient || '—'} | ${ev.timestamp ? new Date(ev.timestamp * 1000).toLocaleString() : '—'}`
	);
	return [{
		type: 'text',
		text: `📬 ${items.length} event${items.length !== 1 ? 's' : ''} found (showing ${lines.length}):\n\n` + lines.join('\n')
	}];
}

/**
 * Render helper for mailgun_domains.
 */
function renderDomains(_args, value) {
	const items = value.items ?? [];
	if (items.length === 0) {
		return [{ type: 'text', text: 'No sending domains found.' }];
	}
	const lines = items.map(d =>
		`• ${d.name} — ${d.state || 'unknown'} ${d.tracking === 'active' ? '📊 tracking' : ''}`
	);
	return [{
		type: 'text',
		text: `🌐 ${items.length} domain${items.length !== 1 ? 's' : ''}:\n\n` + lines.join('\n')
	}];
}

/**
 * Render helper for mailgun_stats.
 */
function renderStats(_args, value) {
	return [{
		type: 'text',
		text: `📈 Domain Statistics\n` +
			`• Sent: ${value.sent ?? value.total_sent ?? '—'}\n` +
			`• Delivered: ${value.delivered ?? value.total_delivered ?? '—'}\n` +
			`• Opened: ${value.opened ?? value.total_opened ?? '—'}\n` +
			`• Clicked: ${value.clicked ?? value.total_clicked ?? '—'}\n` +
			`• Failed: ${value.failed ?? value.total_failed ?? '—'}\n` +
			`• Complained: ${value.complained ?? value.total_complained ?? '—'}`
	}];
}

/**
 * The tool definitions.
 *
 * @param {object} service - the Mailgun service.
 * @returns {object[]} the tool definitions.
 */
export function buildMailgunTools(service) {
	const sendSchema = {
		type: 'object',
		properties: {
			id: { type: 'string', description: 'Mailgun message ID' },
			message: { type: 'string' },
			domain: { type: 'string' },
			from: { type: 'string' },
			to: { type: 'array', items: { type: 'string' } },
			account: { type: 'string' },
		},
		required: ['id', 'domain', 'from', 'to', 'account'],
	};

	const eventsSchema = {
		type: 'object',
		properties: {
			items: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						event: { type: 'string' },
						recipient: { type: 'string' },
						timestamp: { type: 'number' },
						message: { type: 'object' },
					},
				},
			},
			paging: { type: 'object' },
		},
	};

	const domainsSchema = {
		type: 'object',
		properties: {
			items: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						name: { type: 'string' },
						state: { type: 'string' },
						tracking: { type: 'string' },
					},
				},
			},
		},
	};

	const statsSchema = {
		type: 'object',
		properties: {
			sent: { type: 'number' },
			delivered: { type: 'number' },
			opened: { type: 'number' },
			clicked: { type: 'number' },
			failed: { type: 'number' },
			complained: { type: 'number' },
		},
	};

	return [
		{
			name: 'mailgun_send',
			description: 'Send one email through the Mailgun HTTP API. Tracking is per message: the open and click flags are set on the send itself, so the dashboard toggle does not matter. Returns the Mailgun message id. The API key comes from the harness credential store; the sending domain and From address come from the plugin configuration. Use mailgun_events afterwards to read delivery, open and click events for that message.',
			parameters: parameters({
				to: { type: 'string', required: true, description: 'Recipient(s), comma-separated' },
				subject: { type: 'string', required: true, description: 'Subject line' },
				text: { type: 'string', description: 'Plain-text body' },
				html: { type: 'string', description: 'HTML body; takes precedence over text when both are given' },
				cc: { type: 'string', description: 'CC recipients, comma-separated' },
				bcc: { type: 'string', description: 'BCC recipients, comma-separated' },
				from: { type: 'string', description: 'Override the configured From address' },
				domain: { type: 'string', description: 'Override the configured sending domain' },
				account: { type: 'string', description: 'Which configured Mailgun account to use (id or label); defaults to the default account' },
				tag: { type: 'string', description: 'Campaign tag for the statistics grouping' },
				tracking: { type: 'boolean', description: 'Track opens and clicks, default true' },
				testMode: { type: 'boolean', description: 'Validate the message without delivering it, default false' },
			}),
			output: {
				schema: sendSchema,
				render: renderSend,
			},
			timeoutMs: TIMEOUT_MS,
			async execute(rawArgs, exec) {
				const args = rawArgs ?? {};
				const to = addressList(args.to);
				if (to.length === 0) throw new Error('to 不能为空 / at least one recipient is required');
				if (typeof args.subject !== 'string' || args.subject.trim() === '') throw new Error('subject 不能为空 / a subject is required');
				if (typeof args.text !== 'string' && typeof args.html !== 'string') throw new Error('请填写 text 或 html 正文 / a body is required');
				return await service.send({
					to,
					subject: args.subject.trim(),
					text: typeof args.text === 'string' ? args.text : undefined,
					html: typeof args.html === 'string' ? args.html : undefined,
					cc: addressList(args.cc),
					bcc: addressList(args.bcc),
					from: typeof args.from === 'string' && args.from.trim() !== '' ? args.from.trim() : undefined,
					domain: typeof args.domain === 'string' && args.domain.trim() !== '' ? args.domain.trim() : undefined,
					account: typeof args.account === 'string' && args.account.trim() !== '' ? args.account.trim() : undefined,
					tag: typeof args.tag === 'string' && args.tag.trim() !== '' ? args.tag.trim() : undefined,
					tracking: args.tracking !== false,
					testMode: args.testMode === true,
					signal: exec?.signal,
				});
			},
		},
		{
			name: 'mailgun_events',
			description: 'Read the Mailgun event feed for the sending domain: delivered, opened, clicked, failed and complained, plus bounces. This is where the tracking counters live. Filter by event name (accepted, delivered, opened, clicked, failed, complained, unsubscribed, rejected) and by recipient. Events arrive in reverse chronological order unless ascending is set.',
			parameters: parameters({
				event: { type: 'string', description: 'Event name or comma-separated list, e.g. opened or failed,delivered' },
				recipient: { type: 'string', description: 'Only events for this recipient address' },
				limit: { type: 'integer', description: 'How many events to return, 1-300, default 25' },
				ascending: { type: 'boolean', description: 'Oldest first, default false' },
				domain: { type: 'string', description: 'Override the configured sending domain' },
				account: { type: 'string', description: 'Which configured Mailgun account to use (id or label); defaults to the default account' },
			}),
			output: {
				schema: eventsSchema,
				render: renderEvents,
			},
			timeoutMs: TIMEOUT_MS,
			async execute(rawArgs, exec) {
				const args = rawArgs ?? {};
				return await service.events({
					event: typeof args.event === 'string' && args.event.trim() !== '' ? args.event.trim() : undefined,
					recipient: typeof args.recipient === 'string' && args.recipient.trim() !== '' ? args.recipient.trim() : undefined,
					limit: args.limit,
					ascending: args.ascending === true,
					domain: typeof args.domain === 'string' && args.domain.trim() !== '' ? args.domain.trim() : undefined,
					account: typeof args.account === 'string' && args.account.trim() !== '' ? args.account.trim() : undefined,
					signal: exec?.signal,
				});
			},
		},
		{
			name: 'mailgun_domains',
			description: 'List the sending domains on this Mailgun account with their state (active or disabled) and their tracking settings. Use it to find the domain name a send must target, and to check whether a domain is still active.',
			parameters: parameters({
				limit: { type: 'integer', description: 'How many domains to return, 1-100, default 20' },
				account: { type: 'string', description: 'Which configured Mailgun account to use (id or label); defaults to the default account' },
			}),
			output: {
				schema: domainsSchema,
				render: renderDomains,
			},
			timeoutMs: TIMEOUT_MS,
			async execute(rawArgs, exec) {
				const account = typeof rawArgs?.account === 'string' && rawArgs.account.trim() !== '' ? rawArgs.account.trim() : undefined;
				return await service.domains({ limit: rawArgs?.limit, account, signal: exec?.signal });
			},
		},
		{
			name: 'mailgun_stats',
			description: 'Read the aggregate counters for the sending domain: total sent, delivered, opened, clicked, failed, complained and unsubscribed. Use it for a quick health read; use mailgun_events for the per-message detail.',
			parameters: parameters({
				domain: { type: 'string', description: 'Override the configured sending domain' },
				account: { type: 'string', description: 'Which configured Mailgun account to use (id or label); defaults to the default account' },
			}),
			output: {
				schema: statsSchema,
				render: renderStats,
			},
			timeoutMs: TIMEOUT_MS,
			async execute(rawArgs, exec) {
				const domain = typeof rawArgs?.domain === 'string' && rawArgs.domain.trim() !== '' ? rawArgs.domain.trim() : undefined;
				const account = typeof rawArgs?.account === 'string' && rawArgs.account.trim() !== '' ? rawArgs.account.trim() : undefined;
				return await service.stats({ domain, account, signal: exec?.signal });
			},
		},
	];
}