/**
 * dsh-mailgun — client half (browser bundle).
 *
 * Registers one entry in the `settings.section` slot: the "Mailgun" section
 * of the harness Settings page, where the user adds the Mailgun accounts and
 * pastes the API key of each one.
 *
 * Several accounts are supported, because one Mailgun account is one
 * credential and one sending domain. Each card holds the label, the sending
 * domain, the region, the From address and the API key.
 *
 * The API key is write-only from this side: the backend reports only whether
 * a key is stored, never its value, so the browser never holds a key it did
 * not just type.
 *
 * Every visible string goes through the Client locale service, and the
 * navigation icon is the plugin's own artwork, so the section and the plugin
 * row in Plugin Manager show the same mark.
 */
(function () {
	// The factory id MUST equal the package id: the module system resolves a
	// graph row's factory by its row id. Registering under another id makes the
	// bundle look like it "loaded without registering".
	window.__ModuleLoader__.load({
		id: 'dsh-mailgun',
		factory: function (require) {
			var React = require('react');
			var h = React.createElement;

			/** The backend route the browser half talks to. */
			var SETTINGS_URL = '/api/dsh-mailgun/settings';

			/** Slot the harness Settings renders one section per entry in. */
			var SLOT_SETTINGS = 'settings.section';

			/** Slot for the settings section icon. */
			var SLOT_SETTINGS_ICON = 'settings.section.icon';

			/** Own id inside that slot. */
			var SECTION_ID = 'dsh-mailgun';

			/**
			 * Namespace the visible strings live under. It is not the package
			 * name: the package's own exported locale files are read by the
			 * host for the plugin's metadata, and the locale service refuses a
			 * second registration of the same locale under one namespace.
			 */
			var LOCALE_ID = 'dsh-mailgun.settings';

			/** Client services this half needs. */
			var inject = ['slots', 'locale'];

			/**
			 * The plugin artwork, inlined so the navigation icon is the same
			 * mark the plugin row shows in Plugin Manager.
			 */
			var ICON_DATA = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJNYWlsZ3VuIj4gPHRpdGxlPk1haWxndW48L3RpdGxlPiA8IS0tIEEgcGFwZXIgcGxhbmUgaW4gZmxpZ2h0OiB0aGUgc2VuZC1hbmQtdHJhY2sgaGFsZiBvZiB0aGUgcGx1Z2luLCBkcmF3biB3aXRob3V0IHRoZSByZWQgb2YgdGhlIE1haWxndW4gYnJhbmQgc28gdGhlIHNldCByZWFkcyBhcyBvbmUgZmFtaWx5LiBCb2xkIGFuZCBkaWdpdGFsIGluayBwbGF0ZSwgYnJhbmQgY3lhbiBnbHlwaCwgcGFwZXIgZm9sZC4gLS0+IDxkZWZzPiA8bGluZWFyR3JhZGllbnQgaWQ9Im1nLXBsYXRlIiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+IDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzA5MWMzNiIvPiA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwNTEyMWYiLz4gPC9saW5lYXJHcmFkaWVudD4gPC9kZWZzPiA8cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHJ4PSIxNCIgZmlsbD0idXJsKCNtZy1wbGF0ZSkiLz4gPCEtLSB0aGUgdXBwZXIgd2luZyAtLT4gPHBhdGggZD0iTTEyIDI2IEw1MCAxNSBMMjYgMzEgWiIgZmlsbD0iIzU3ZWJlZSIvPiA8IS0tIHRoZSBsb3dlciBmb2xkLCBpbiBwYXBlciwgc28gdGhlIHBsYW5lIHN0aWxsIHJlYWRzIGluIGdyZXlzY2FsZSAtLT4gPHBhdGggZD0iTTEyIDI2IEwyNiAzMSBMMjEgNDQgWiIgZmlsbD0iI2ZmZmZmZiIvPiA8IS0tIG1vbm9ncmFtIC0tPiA8cmVjdCB4PSIzNiIgeT0iNDIiIHdpZHRoPSIyNCIgaGVpZ2h0PSIxOCIgcng9IjYiIGZpbGw9IiMwOTFjMzYiIHN0cm9rZT0iIzU3ZWJlZSIgc3Ryb2tlLXdpZHRoPSIyIi8+IDx0ZXh0IHg9IjQ4IiB5PSI1NSIgZm9udC1mYW1pbHk9InVpLXNhbnMtc2VyaWYsLWFwcGxlLXN5c3RlbSxTZWdvZSBVSSxSb2JvdG8sc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMSIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjAuMyI+TUc8L3RleHQ+IDwvc3ZnPg==';

			/**
			 * The visible strings, in the languages this plugin ships.
			 *
			 * The keys are flat: the locale service translates one key at a
			 * time, so a nested object would have to be read out of a
			 * dictionary value by hand.
			 */
			var copy = {
				en: {
					title: 'Mailgun',
					intro: 'One Mailgun account is one API key and one sending domain. Add each account you want to send from; the agent picks the default account unless you name one. Keys are stored in the harness credential store, never in this page.',
					empty: 'No Mailgun account yet. Add one below.',
					addAccount: 'Add Mailgun account',
					add: 'Add account',
					cancel: 'Cancel',
					save: 'Save',
					remove: 'Remove',
					makeDefault: 'Make default',
					test: 'Test connection',
					defaultAccount: 'default account',
					label: 'Label',
					domain: 'Sending domain',
					region: 'Region',
					regionUs: 'US (api.mailgun.net)',
					regionEu: 'EU (api.eu.mailgun.net)',
					from: 'From address',
					senderName: 'Sender name',
					apiKey: 'API key',
					keyStored: 'key stored',
					noKeyYet: 'no key yet',
					saved: 'Saved.',
					added: 'Account added. The form stays open for the next one.',
					addMore: 'The form stays open, so you can add the next account right away.',
					removed: 'Removed.',
					keyAccepted: 'Key accepted.',
				},
				zh: {
					title: 'Mailgun',
					intro: '一个 Mailgun 账户就是一个 API 密钥和一个发信域名。添加每个你想发送的账户；除非指定，智能体会使用默认账户。密钥保存在 Harness 的凭据存储中，不会出现在这个页面上。',
					empty: '还没有 Mailgun 账户。请在下方添加。',
					addAccount: '添加 Mailgun 账户',
					add: '添加账户',
					cancel: '取消',
					save: '保存',
					remove: '移除',
					makeDefault: '设为默认',
					test: '测试连接',
					defaultAccount: '默认账户',
					label: '名称',
					domain: '发信域名',
					region: '区域',
					regionUs: '美国 (api.mailgun.net)',
					regionEu: '欧洲 (api.eu.mailgun.net)',
					from: '发件地址',
					senderName: '发件人名称',
					apiKey: 'API 密钥',
					keyStored: '密钥已保存',
					noKeyYet: '尚无密钥',
					saved: '已保存。',
					added: '账户已添加。表单保持打开，可以继续添加下一个。',
					addMore: '表单会保持打开，可以马上添加下一个账户。',
					removed: '已移除。',
					keyAccepted: '密钥有效。',
				},
			};

			/**
			 * Stylesheet, rendered by the component itself so unmounting the
			 * section removes it again. Only `--dsw-*` custom properties are
			 * used, each with a literal fallback.
			 */
			var CSS = [
				'.mgsec{display:flex;flex-direction:column;gap:14px;padding:4px 0}',
				'.mgsec_intro{font-size:12px;line-height:18px;color:var(--dsw-alias-text-secondary,#6b7280);margin:0}',
				'.mgsec_card{display:flex;flex-direction:column;gap:10px;border:1px solid var(--dsw-alias-border-subtle,#e5e7eb);border-radius:10px;padding:14px}',
				'.mgsec_row{display:flex;flex-direction:column;gap:4px}',
				'.mgsec_label{font-size:12px;line-height:16px;color:var(--dsw-alias-text-secondary,#6b7280)}',
				'.mgsec_input{font:inherit;font-size:13px;line-height:20px;padding:7px 9px;border-radius:7px;border:1px solid var(--dsw-alias-border-subtle,#d1d5db);background:var(--dsw-alias-surface-default,#fff);color:var(--dsw-alias-text-primary,#111827);min-width:0}',
				'.mgsec_input:focus{outline:2px solid var(--dsw-alias-accent-primary,#2563eb);outline-offset:1px}',
				'.mgsec_grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}',
				'.mgsec_actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
				'.mgsec_btn{font:inherit;font-size:12px;line-height:18px;padding:6px 12px;border-radius:7px;border:1px solid var(--dsw-alias-border-subtle,#d1d5db);background:var(--dsw-alias-surface-default,#fff);color:var(--dsw-alias-text-primary,#111827);cursor:pointer}',
				'.mgsec_btn:hover{background:var(--dsw-alias-surface-hover,#f3f4f6)}',
				'.mgsec_btn_primary{background:var(--dsw-alias-accent-primary,#2563eb);border-color:transparent;color:#fff}',
				'.mgsec_btn_primary:hover{background:var(--dsw-alias-accent-primary-hover,#1d4ed8)}',
				'.mgsec_btn_danger{color:var(--dsw-alias-state-error-primary,#dc2626)}',
				'.mgsec_badge{font-size:11px;line-height:16px;padding:2px 8px;border-radius:999px;background:var(--dsw-alias-surface-hover,#f3f4f6);color:var(--dsw-alias-text-secondary,#6b7280)}',
				'.mgsec_badge_ok{background:rgba(22,163,74,.12);color:var(--dsw-alias-state-success-primary,#16a34a)}',
				'.mgsec_status{font-size:12px;line-height:18px;margin:0}',
				'.mgsec_status_error{color:var(--dsw-alias-state-error-primary,#dc2626)}',
				'.mgsec_status_ok{color:var(--dsw-alias-state-success-primary,#16a34a)}',
				'.mgsec_list{display:flex;flex-direction:column;gap:8px}',
				'.mgsec_empty{font-size:12px;line-height:18px;color:var(--dsw-alias-text-secondary,#6b7280);margin:0}',
			].join('');

			/**
			 * Read the current account list from the backend.
			 *
			 * @returns {Promise<object>} the view.
			 */
			function loadView() {
				return fetch(SETTINGS_URL, { headers: { accept: 'application/json' } })
					.then(function (response) { return response.json(); })
					.then(function (body) {
						if (!body || body.ok !== true) {
							throw new Error((body && body.error && body.error.message) || 'could not read the Mailgun settings');
						}
						return body.value;
					});
			}

			/**
			 * Send one action to the backend.
			 *
			 * @param {object} payload - the action.
			 * @returns {Promise<object>} the backend view.
			 */
			function postAction(payload) {
				return fetch(SETTINGS_URL, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
				})
					.then(function (response) { return response.json(); })
					.then(function (body) {
						if (!body || body.ok !== true) {
							throw new Error((body && body.error && body.error.message) || 'the Mailgun settings could not be saved');
						}
						// The whole result is returned: `save` carries the fresh
						// view, `test` carries the domain list. Reading only the
						// view would report an empty domain list.
						return body.value;
					});
			}

			/**
			 * One editable account card.
			 *
			 * @param {object} props - the component props.
			 * @returns {object} the element tree.
			 */
			function AccountCard(props) {
				var account = props.account;
				var t = props.t;
				var state = React.useState({
					label: account.label || '',
					domain: account.domain || '',
					region: account.region || 'us',
					from: account.from || '',
					senderName: account.senderName || '',
				});
				var apiKeyState = React.useState('');
				var busyState = React.useState(false);
				var notice = { current: null };

				var draft = state[0];
				var setDraft = state[1];
				var apiKey = apiKeyState[0];
				var setApiKey = apiKeyState[1];
				// `useState` returns a pair: the value and the setter. Holding the
				// pair in `busy` and calling it would throw a TypeError before
				// the request was ever sent, which is why nothing saved.
				var busy = busyState[0];
				var setBusy = busyState[1];

				function patch(field, value) {
					setDraft(function (previous) {
						var next = {};
						for (var key in previous) next[key] = previous[key];
						next[field] = value;
						return next;
					});
				}

				function report(message, ok) {
					notice.current = { message: message, ok: ok !== false };
					props.onNotice(notice.current);
				}

				function save() {
					setBusy(true);
					props.onSave({
						action: 'save',
						account: {
							id: account.id,
							label: draft.label,
							domain: draft.domain,
							region: draft.region,
							from: draft.from,
							senderName: draft.senderName,
						},
						apiKey: apiKey !== '' ? apiKey : undefined,
						makeDefault: props.isDefault,
					})
						.then(function () {
							setApiKey('');
							report(t('saved'), true);
						})
						.catch(function (error) { report(error.message, false); })
						.finally(function () { setBusy(false); });
				}

				function test() {
					setBusy(true);
					props.onTest(account.id)
						.then(function (domains) {
							report(
								t('keyAccepted') + ' ' + domains.length + ' sending domain(s): '
								+ domains.map(function (d) { return d.name; }).join(', '),
								true,
							);
						})
						.catch(function (error) { report(error.message, false); })
						.finally(function () { setBusy(false); });
				}

				function remove() {
					setBusy(true);
					props.onRemove(account.id)
						.then(function () { report(t('removed'), true); })
						.catch(function (error) { report(error.message, false); })
						.finally(function () { setBusy(false); });
				}

				return h('div', { className: 'mgsec_card' },
					h('div', { className: 'mgsec_row' },
						h('label', { className: 'mgsec_label' }, t('label')),
						h('input', {
							className: 'mgsec_input',
							value: draft.label,
							placeholder: 'Bold & Digital',
							onChange: function (event) { patch('label', event.target.value); },
						}),
					),
					h('div', { className: 'mgsec_grid' },
						h('div', { className: 'mgsec_row' },
							h('label', { className: 'mgsec_label' }, t('domain')),
							h('input', {
								className: 'mgsec_input',
								value: draft.domain,
								placeholder: 'mg.example.com',
								onChange: function (event) { patch('domain', event.target.value); },
							}),
						),
						h('div', { className: 'mgsec_row' },
							h('label', { className: 'mgsec_label' }, t('region')),
							h('select', {
								className: 'mgsec_input',
								value: draft.region,
								onChange: function (event) { patch('region', event.target.value); },
							}, ['us', 'eu'].map(function (value) {
								return h('option', { key: value, value: value }, t(value === 'eu' ? 'regionEu' : 'regionUs'));
							})),
						),
					),
					h('div', { className: 'mgsec_grid' },
						h('div', { className: 'mgsec_row' },
							h('label', { className: 'mgsec_label' }, t('from')),
							h('input', {
								className: 'mgsec_input',
								value: draft.from,
								placeholder: 'noreply@example.com',
								onChange: function (event) { patch('from', event.target.value); },
							}),
						),
						h('div', { className: 'mgsec_row' },
							h('label', { className: 'mgsec_label' }, t('senderName')),
							h('input', {
								className: 'mgsec_input',
								value: draft.senderName,
								placeholder: 'Bold & Digital',
								onChange: function (event) { patch('senderName', event.target.value); },
							}),
						),
					),
					h('div', { className: 'mgsec_row' },
						h('label', { className: 'mgsec_label' }, t('apiKey')),
						h('input', {
							className: 'mgsec_input',
							type: 'password',
							value: apiKey,
							placeholder: account.hasKey ? 'Stored — type to replace' : 'key-…',
							onChange: function (event) { setApiKey(event.target.value); },
						}),
						h('span', { className: 'mgsec_badge' + (account.hasKey ? ' mgsec_badge_ok' : '') },
							account.hasKey ? t('keyStored') : t('noKeyYet')),
					),
					h('div', { className: 'mgsec_actions' },
						h('button', { className: 'mgsec_btn mgsec_btn_primary', type: 'button', disabled: busy[0], onClick: save }, t('save')),
						h('button', { className: 'mgsec_btn', type: 'button', disabled: busy[0], onClick: test }, t('test')),
						!props.isDefault
							? h('button', { className: 'mgsec_btn', type: 'button', disabled: busy[0], onClick: props.onMakeDefault }, t('makeDefault'))
							: h('span', { className: 'mgsec_badge mgsec_badge_ok' }, t('defaultAccount')),
						h('button', { className: 'mgsec_btn mgsec_btn_danger', type: 'button', disabled: busy[0], onClick: remove }, t('remove')),
					),
				);
			}

			/**
			 * The Mailgun settings section.
			 *
			 * @param {object} props - the section props, including the bound
			 *   translator.
			 * @returns {object} the element tree.
			 */
			function MailgunSettingsSection(props) {
				var t = props.t;
				var viewState = React.useState(null);
				var view = viewState[0];
				var setView = viewState[1];
				var noticeState = React.useState(null);
				var notice = noticeState[0];
				var setNotice = noticeState[1];
				var newState = React.useState({ label: '', domain: '', region: 'us', from: '', senderName: '', apiKey: '' });
				var draft = newState[0];
				var setDraft = newState[1];
				var addingState = React.useState(false);
				var busyState = React.useState(false);
				// Same pair rule as in the card: the value and the setter are two
				// different things, and calling the pair would throw.
				var adding = addingState[0];
				var setAdding = addingState[1];
				var busy = busyState[0];
				var setBusy = busyState[1];

				React.useEffect(function () {
					var alive = true;
					loadView()
						.then(function (value) { if (alive) setView(value); })
						.catch(function (error) { if (alive) setNotice({ message: error.message, ok: false }); });
					return function () { alive = false; };
				}, []);

				function refresh() {
					return loadView().then(function (value) { setView(value); return value; });
				}

				/**
				 * Change one field of the add form.
				 *
				 * The update is functional, so two fields edited before the
				 * next render cannot overwrite each other with a stale copy
				 * of the draft.
				 *
				 * @param {string} field - the field name.
				 * @param {string} value - the new value.
				 */
				function patch(field, value) {
					setDraft(function (previous) {
						var next = {};
						for (var key in previous) next[key] = previous[key];
						next[field] = value;
						return next;
					});
				}

				function save(payload) {
					return postAction(payload).then(function (value) {
						// The backend answers every action with the fresh view
						// beside the action result.
						if (value && value.view) setView(value.view);
						return value;
					});
				}

				function test(id) {
					return postAction({ action: 'test', id: id }).then(function (result) {
						return result.domains || [];
					});
				}

				function remove(id) {
					return save({ action: 'remove', id: id });
				}

				function makeDefault(id) {
					return save({
						action: 'save',
						account: { id: id },
						makeDefault: true,
					});
				}

				function addAccount() {
					setBusy(true);
					save({
						action: 'save',
						account: {
							label: draft.label,
							domain: draft.domain,
							region: draft.region,
							from: draft.from,
							senderName: draft.senderName,
						},
						apiKey: draft.apiKey !== '' ? draft.apiKey : undefined,
					})
						.then(function () {
							// The panel stays open and the fields clear, so a
							// second account is one more click away instead of
							// another trip through the button.
							setDraft({ label: '', domain: '', region: 'us', from: '', senderName: '', apiKey: '' });
							setNotice({ message: t('added'), ok: true });
						})
						.catch(function (error) { setNotice({ message: error.message, ok: false }); })
						.finally(function () { setBusy(false); });
				}

				var accounts = (view && view.accounts) || [];

				return h('div', { className: 'mgsec' },
					// The stylesheet lives inside the component, so unmounting
					// the section removes it again.
					h('style', null, CSS),
					h('p', { className: 'mgsec_intro' }, t('intro')),
					notice
						? h('p', { className: 'mgsec_status ' + (notice.ok ? 'mgsec_status_ok' : 'mgsec_status_error') }, notice.message)
						: null,
					h('div', { className: 'mgsec_list' },
						accounts.length === 0
							? h('p', { className: 'mgsec_empty' }, t('empty'))
							: accounts.map(function (account) {
								return h(AccountCard, {
									key: account.id,
									account: account,
									t: t,
									isDefault: view.defaultAccount === account.id,
									onSave: save,
									onTest: test,
									onRemove: remove,
									onMakeDefault: function () { return makeDefault(account.id); },
									onNotice: setNotice,
								});
							}),
					),
					adding
						? h('div', { className: 'mgsec_card' },
							h('div', { className: 'mgsec_row' },
								h('label', { className: 'mgsec_label' }, t('label')),
								h('input', {
									className: 'mgsec_input',
									value: draft.label,
									placeholder: 'Bold & Digital',
									onChange: function (event) { patch('label', event.target.value); },
								}),
							),
							h('div', { className: 'mgsec_grid' },
								h('div', { className: 'mgsec_row' },
									h('label', { className: 'mgsec_label' }, t('domain')),
									h('input', {
										className: 'mgsec_input',
										value: draft.domain,
										placeholder: 'mg.example.com',
										onChange: function (event) { patch('domain', event.target.value); },
									}),
								),
								h('div', { className: 'mgsec_row' },
									h('label', { className: 'mgsec_label' }, t('region')),
									h('select', {
										className: 'mgsec_input',
										value: draft.region,
										onChange: function (event) { patch('region', event.target.value); },
									}, ['us', 'eu'].map(function (value) {
										return h('option', { key: value, value: value }, t(value === 'eu' ? 'regionEu' : 'regionUs'));
									})),
								),
							),
							h('div', { className: 'mgsec_row' },
								h('label', { className: 'mgsec_label' }, t('from')),
								h('input', {
									className: 'mgsec_input',
									value: draft.from,
									placeholder: 'noreply@example.com',
									onChange: function (event) { patch('from', event.target.value); },
								}),
							),
							h('div', { className: 'mgsec_row' },
								h('label', { className: 'mgsec_label' }, t('senderName')),
								h('input', {
									className: 'mgsec_input',
									value: draft.senderName,
									placeholder: 'Bold & Digital',
									onChange: function (event) { patch('senderName', event.target.value); },
								}),
							),
							h('div', { className: 'mgsec_row' },
								h('label', { className: 'mgsec_label' }, t('apiKey')),
								h('input', {
									className: 'mgsec_input',
									type: 'password',
									value: draft.apiKey,
									placeholder: 'key-…',
									onChange: function (event) { patch('apiKey', event.target.value); },
								}),
							),
							h('div', { className: 'mgsec_actions' },
								h('button', { className: 'mgsec_btn mgsec_btn_primary', type: 'button', disabled: busy[0], onClick: addAccount }, t('add')),
								h('button', { className: 'mgsec_btn', type: 'button', onClick: function () { setAdding(false); } }, t('cancel')),
							),
							h('p', { className: 'mgsec_empty' }, t('addMore')),
						)
						: h('div', { className: 'mgsec_actions' },
							h('button', { className: 'mgsec_btn', type: 'button', onClick: function () { setAdding(true); } }, t('addAccount')),
						),
				);
			}

			/**
			 * Register the settings section and its navigation icon.
			 *
			 * @param {object} ctx - the client context.
			 */
			function apply(ctx) {
				// The strings live in the Client locale service, so the section
				// follows the app's language.
				ctx.effect(function () {
					return ctx.locale.register(LOCALE_ID, copy);
				});
				var t = ctx.locale.bind(LOCALE_ID);

				ctx.slots.inject(SLOT_SETTINGS_ICON, function () {
					return ctx.slots.register({
						name: SLOT_SETTINGS_ICON,
						id: SECTION_ID,
					}, function SettingsIcon(props) {
						var size = (props && props.size) || 20;
						return h('img', {
							src: ICON_DATA,
							alt: '',
							'aria-hidden': true,
							width: size,
							height: size,
							style: { objectFit: 'contain', display: 'block', flexShrink: 0 },
						});
					});
				});

				ctx.slots.inject(SLOT_SETTINGS, function () {
					return ctx.slots.register({
						name: SLOT_SETTINGS,
						id: SECTION_ID,
						order: 46,
						label: function () { return t('title'); },
						locale: LOCALE_ID,
					}, function Section() {
						return h(MailgunSettingsSection, { t: t });
					});
				});
			}

			return { inject: inject, apply: apply };
		}
	});
})();
