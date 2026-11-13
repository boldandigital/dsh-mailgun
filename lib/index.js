/**
 * @local/mailgun — the host half.
 *
 * Gives the agent the Mailgun HTTP API: send a message with per-message open
 * and click tracking, read the delivery and engagement events, list the
 * sending domains and read the domain counters.
 *
 * Several Mailgun accounts are supported. Each one owns its sending domain,
 * its region and its From address, and carries its own API key in the
 * harness credential store as the record `dsh-mailgun/<id>`. The account list
 * itself lives in `~/.dsh/data/dsh-mailgun/accounts.json` and is edited from
 * the harness Settings page, under "Mailgun".
 *
 * A key never enters the bundle patch, a settings document, a log line or a
 * tool result: the settings backend reports only whether a key is present.
 *
 * This plugin is send-and-track only. Reading mailboxes is the job of the
 * `dsh-email` plugin, which owns IMAP and SMTP.
 */

import { readConfig, Config } from './config.js';
import { MailgunService } from './service.js';
import { AccountStore } from './store.js';
import { buildMailgunTools } from './tools.js';
import { MailgunSettingsBackend, SETTINGS_API_ROUTE, SETTINGS_ROUTE } from './settings-web.js';

export { Config, readConfig };
export { AccountSchema } from './accounts.js';
export { AccountStore } from './store.js';
export { MailgunService } from './service.js';
export { MailgunError } from './api.js';
export { MailgunSettingsBackend, SETTINGS_API_ROUTE, SETTINGS_ROUTE } from './settings-web.js';

/** Service name this half registers on the plugin context. */
export const name = 'dsh-mailgun';

/** Host services this half needs. */
export const inject = ['tools', 'connection'];

/**
 * Apply the plugin: open the account store, register the tools and mount the
 * settings backend.
 *
 * @param {object} ctx - the plugin context.
 * @param {object} raw - the plugin configuration.
 */
export function apply(ctx, raw) {
	const config = readConfig(raw);

	// The account list is this plugin's own state, kept in its own document.
	// It deliberately does not ride the harness settings service: that API
	// changed shape between host releases, and the account list must work on
	// every one of them.
	const store = new AccountStore(ctx);
	const readAccounts = async () => await store.read();

	const service = new MailgunService(ctx, raw, { accounts: readAccounts });
	for (const tool of buildMailgunTools(service)) ctx.tools.register(tool);

	const backend = new MailgunSettingsBackend({ ctx, service, store });

	// The connection channel serves the browser half.
	ctx.connection?.fetch?.register?.({
		path: SETTINGS_API_ROUTE,
		methods: ['GET', 'POST'],
		requestBody: 'buffered',
		fetch: (request) => backend.fetch(request),
	});

	// The raw web route serves the same backend for a plain HTTP client.
	ctx.inject?.(['webServer'], (webCtx) => {
		webCtx.effect(() => {
			const dispose = webCtx.webServer.register({
				kind: 'exact',
				path: SETTINGS_ROUTE,
				handler: (req, res) => backend.handle(req, res),
			});
			return () => dispose();
		});
	});

	ctx.logger.info(
		'Mailgun enabled: %d account(s) configured; key reference %s',
		config.apiKeyRef,
	);
}
