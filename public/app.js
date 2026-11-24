/* RICH Influencers: team dashboard (vanilla JS, hash routing) */
(() => {
'use strict';

// ---------- utilities ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const app = $('#app');

async function api(path, opts = {}) {
	const o = { method: opts.method || 'GET', headers: {} };
	if (opts.body instanceof FormData) o.body = opts.body;
	else if (opts.body !== undefined) { o.body = JSON.stringify(opts.body); o.headers['Content-Type'] = 'application/json'; }
	const r = await fetch('/api' + path, o);
	const data = await r.json().catch(() => ({}));
	if (r.status === 401 && !path.startsWith('/login') && !path.startsWith('/setup')) { state.me = null; route(); throw new Error('Please sign in.'); }
	if (!r.ok) { const e = new Error(data.error || 'Request failed'); e.data = data; e.status = r.status; throw e; }
	return data;
}

function toast(msg, bad) {
	$$('.toast').forEach((x) => x.remove());
	const t = document.createElement('div');
	t.className = 'toast' + (bad ? ' bad' : '');
	t.textContent = msg;
	document.body.appendChild(t);
	setTimeout(() => t.remove(), 3200);
}
const fail = (e) => toast(e.message || String(e), true);

const fmtN = (n) => {
	if (n == null || n === '') return '–';
	n = +n;
	if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
	if (n >= 1e4) return Math.round(n / 1e3) + 'K';
	if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
	return String(n);
};
const fmtFull = (n) => (n == null ? '–' : (+n).toLocaleString('en-US'));
const aed = (n) => (n == null ? null : 'AED ' + (+n).toLocaleString('en-US'));
const pct = (n) => (n == null ? '–' : (+n).toFixed(2).replace(/\.?0+$/, '') + '%');
const date = (ms) => (ms ? new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' }) : '');
const dateTime = (ms) => (ms ? new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }) : '');
const initials = (n) => String(n || '?').split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
const avatar = (r, cls = '') => r.photo
	? `<img class="avatar ${cls}" src="${esc(r.photo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=&quot;avatar ${cls}&quot;>${esc(initials(r.full_name))}</div>'">`
	: `<div class="avatar ${cls}">${esc(initials(r.full_name))}</div>`;
const canEdit = () => state.me && ['admin', 'editor'].includes(state.me.role);
const isAdmin = () => state.me && state.me.role === 'admin';

const ICON = {
	home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
	search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
	inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-7z"/></svg>',
	flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22V4m0 0h13l-2 4 2 4H4"/></svg>',
	upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4m0 0l-5 5m5-5l5 5M4 20h16"/></svg>',
	cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
	bell: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
	ig: '<svg viewBox="0 0 24 24" fill="none" stroke="#c13584" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="#c13584"/></svg>',
	tt: '<svg viewBox="0 0 24 24" fill="#111"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9a7.3 7.3 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5z"/></svg>',
	plus: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>',
	download: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v12m0 0l-5-5m5 5l5-5M4 20h16"/></svg>'
};

const TIERS = { nano: 'Nano', micro: 'Micro', mid: 'Mid-tier', macro: 'Macro', celebrity: 'Celebrity' };
const STATUS = { pending: ['Pending review', 'warn'], info_requested: ['Info requested', 'accent'], approved: ['Approved', 'ok'], rejected: ['Rejected', 'bad'] };
const AVAIL = { available: 'Available', limited: 'Limited availability', unavailable: 'Not available', unknown: 'Unknown' };
const GENDER = { female: 'Female', male: 'Male', other: 'Other / prefer not to say' };
const PRICE_LABELS = [
	['price_ig_reel', 'IG Reel'], ['price_ig_story', 'IG Story'], ['price_ig_post', 'IG Post'], ['price_ig_carousel', 'IG Carousel'],
	['price_tt_video', 'TikTok Video'], ['price_tt_live', 'TikTok Live'], ['price_package', 'Package']
];
const CI_STATUS = {
	shortlisted: 'Shortlisted', sent_to_client: 'Sent to client', client_approved: 'Client approved', contacted: 'Contacted',
	confirmed: 'Confirmed', live: 'Live', completed: 'Completed', declined: 'Declined'
};

const state = { me: null, counts: {}, options: null, selected: new Map() };

// ---------- shell ----------
function shell(active, title, actions, content) {
	const c = state.counts;
	const nav = [
		['home', '#/', 'Overview', ICON.home],
		['discover', '#/discover', 'Discover', ICON.search],
		['pending', '#/pending', 'Review queue', ICON.inbox, (c.pending || 0) + (c.updates || 0)],
		['campaigns', '#/campaigns', 'Campaigns', ICON.flag],
		...(canEdit() ? [['import', '#/import', 'Import', ICON.upload]] : []),
		['settings', '#/settings', 'Settings', ICON.cog]
	];
	app.innerHTML = `<div class="shell">
		<aside class="side">
			<div class="brand"><img class="logo" src="/logo-white.png" alt="RICH"><small>Influencer Network</small></div>
			<nav class="nav">${nav.map(([k, h, l, i, b]) => `<a href="${h}" class="${k === active ? 'on' : ''}">${i}<span>${l}</span>${b ? `<span class="badge">${b}</span>` : ''}</a>`).join('')}</nav>
			<div class="spacer"></div>
			<div class="me"><b>${esc(state.me.name)}</b>${esc(state.me.role)} · <a id="logout">Sign out</a><br><a href="/join/" target="_blank">Open registration page ↗</a></div>
		</aside>
		<div class="main">
			<header class="topbar"><h1>${title}</h1><div class="grow"></div>${actions || ''}
				<button class="icon-btn" id="bell" title="Notifications">${ICON.bell}${c.unread ? '<span class="dot"></span>' : ''}</button></header>
			<div class="page" id="page">${content || ''}</div>
		</div>
	</div>`;
	$('#logout').onclick = async () => { await api('/logout', { method: 'POST' }); state.me = null; route(); };
	$('#bell').onclick = openNotifications;
	return $('#page');
}

async function refreshCounts() {
	try {
		const r = await api('/me');
		state.me = r.user; state.counts = r.counts;
		const b = $('.nav a[href="#/pending"] .badge');
		const n = r.counts.pending + r.counts.updates;
		if (b) b.textContent = n; else if (n) { const a = $('.nav a[href="#/pending"]'); a && a.insertAdjacentHTML('beforeend', `<span class="badge">${n}</span>`); }
		const bell = $('#bell');
		if (bell && r.counts.unread && !$('.dot', bell)) bell.insertAdjacentHTML('beforeend', '<span class="dot"></span>');
	} catch {}
}
setInterval(() => state.me && refreshCounts(), 60000);

async function openNotifications() {
	const r = await api('/notifications');
	modal(`<h3>Notifications</h3>
		${r.notifications.length ? `<div class="timeline">${r.notifications.map((n) => `<div style="${n.created_at > r.seen ? 'font-weight:600' : ''}">
			${n.link ? `<a href="${esc(n.link)}" data-close>${esc(n.title)}</a>` : esc(n.title)}
			${n.body ? `<div class="muted small" style="font-weight:400;white-space:pre-line">${esc(n.body)}</div>` : ''}
			<div class="faint small" style="font-weight:400">${dateTime(n.created_at)}</div></div>`).join('')}</div>` : '<div class="empty"><b>No notifications yet</b>New registrations and profile changes show up here.</div>'}
		<div class="actions"><button class="btn ghost" data-close>Close</button></div>`);
	await api('/notifications/seen', { method: 'POST' });
	state.counts.unread = 0;
	$('#bell .dot')?.remove();
}

function modal(html, wide) {
	const bg = document.createElement('div');
	bg.className = 'modal-bg';
	bg.innerHTML = `<div class="modal card" style="${wide ? 'max-width:760px' : ''}">${html}</div>`;
	document.body.appendChild(bg);
	const close = () => bg.remove();
	bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
	document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', k); } });
	return { el: $('.modal', bg), close };
}

function ask(title, { label = '', placeholder = '', value = '', ok = 'Save', textarea = false, required = true, hint = '' } = {}) {
	return new Promise((resolve) => {
		const m = modal(`<h3>${esc(title)}</h3>${hint ? `<p class="muted" style="margin-top:-6px">${esc(hint)}</p>` : ''}
			<label class="f"><span>${esc(label)}</span>${textarea ? `<textarea id="askv" placeholder="${esc(placeholder)}">${esc(value)}</textarea>` : `<input type="text" id="askv" value="${esc(value)}" placeholder="${esc(placeholder)}">`}</label>
			<div class="actions"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="askok">${esc(ok)}</button></div>`);
		const inp = $('#askv', m.el);
		inp.focus();
		$('#askok', m.el).onclick = () => { const v = inp.value.trim(); if (required && !v) return inp.focus(); m.close(); resolve(v); };
		m.el.parentElement.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === m.el.parentElement) resolve(null); });
	});
}

async function loadOptions(force) {
	if (!state.options || force) state.options = await api('/options');
	return state.options;
}

// ---------- auth screens ----------
async function authScreen() {
	const { needed } = await api('/setup');
	app.innerHTML = `<div class="auth"><form class="card stack" id="f">
		<div><img src="/logo.png" alt="RICH" style="height:30px"></div>
		<div><h1>${needed ? 'Create the first admin' : 'Sign in to RICH Influencers'}</h1>
		<div class="muted">${needed ? 'This screen only appears once, before any team account exists.' : 'Team access only. Influencers register at <a href="/join/">/join</a>.'}</div></div>
		${needed ? `<label class="f"><span>Your name</span><input type="text" name="display_name" required></label>` : ''}
		<label class="f"><span>Email</span><input type="email" name="email" required autocomplete="username"></label>
		<label class="f"><span>Password</span><input type="password" name="password" required minlength="8" autocomplete="${needed ? 'new-password' : 'current-password'}"></label>
		${needed ? `<label class="f"><span>Setup key (only if one was configured)</span><input type="password" name="setup_key"></label>` : ''}
		<div class="err" id="e"></div>
		<button class="btn" style="width:100%;justify-content:center">${needed ? 'Create admin and continue' : 'Sign in'}</button>
	</form></div>`;
	$('#f').onsubmit = async (ev) => {
		ev.preventDefault();
		const d = Object.fromEntries(new FormData(ev.target));
		try { await api(needed ? '/setup' : '/login', { method: 'POST', body: d }); await boot(); } catch (e) { $('#e').textContent = e.message; }
	};
}

// ---------- overview ----------
async function viewHome() {
	const page = shell('home', 'Overview', canEdit() ? `<a class="btn ghost" href="#/influencer/new">${ICON.plus} Add influencer</a>` : '', '<div class="muted">Loading…</div>');
	const o = await api('/overview');
	const t = o.totals;
	const bars = (items, key, label = (x) => x) => {
		const max = Math.max(1, ...items.map((x) => x.n));
		return `<div class="bars">${items.map((x) => `<div class="b" data-f="${esc(key)}" data-v="${esc(x.k)}"><span>${esc(label(x.k))}</span><div class="track"><div class="fill" style="width:${(x.n / max) * 100}%"></div></div><span class="num">${x.n}</span></div>`).join('') || '<div class="muted small">No data yet</div>'}</div>`;
	};
	const tierOrder = ['nano', 'micro', 'mid', 'macro', 'celebrity'];
	const tiers = tierOrder.map((k) => ({ k, n: (o.by_tier.find((x) => x.k === k) || { n: 0 }).n }));
	const pend = state.counts.pending + state.counts.updates;
	page.innerHTML = `
		${pend ? `<a href="#/pending" class="banner warn" style="display:block;text-decoration:none;margin-bottom:18px"><b>${pend} item${pend === 1 ? '' : 's'} waiting for review.</b> ${state.counts.pending} new registration${state.counts.pending === 1 ? '' : 's'}, ${state.counts.updates} profile update${state.counts.updates === 1 ? '' : 's'}.</a>` : ''}
		<div class="kpis">
			<div class="card pad kpi"><div class="v">${fmtFull(t.n || 0)}</div><div class="l">Approved influencers</div></div>
			<div class="card pad kpi"><div class="v">${fmtFull(t.ig || 0)}</div><div class="l">On Instagram</div></div>
			<div class="card pad kpi"><div class="v">${fmtFull(t.tt || 0)}</div><div class="l">On TikTok</div></div>
			<div class="card pad kpi"><div class="v">${fmtFull(t.priced || 0)}</div><div class="l">With rates on file</div></div>
		</div>
		<div class="grid3" style="margin-top:18px">
			<div class="card pad"><h2 class="sec" style="margin-top:0">By city</h2>${bars(o.by_city, 'city')}</div>
			<div class="card pad"><h2 class="sec" style="margin-top:0">By tier</h2>${bars(tiers, 'tier', (k) => TIERS[k])}</div>
			<div class="card pad"><h2 class="sec" style="margin-top:0">Top categories</h2>${bars(o.by_category, 'catname')}</div>
		</div>
		<h2 class="sec">Recent activity</h2>
		<div class="card pad timeline">${o.recent.map((n) => `<div>${n.link ? `<a href="${esc(n.link)}">${esc(n.title)}</a>` : esc(n.title)} <span class="faint small">· ${dateTime(n.created_at)}</span></div>`).join('') || '<span class="muted">Nothing yet. Share the registration page with influencers to start filling the network.</span>'}</div>`;
	$$('.bars .b', page).forEach((b) => (b.onclick = async () => {
		const f = b.dataset.f, v = b.dataset.v;
		if (f === 'catname') {
			const opts = await loadOptions();
			const c = opts.categories.find((x) => x.name === v);
			location.hash = '#/discover?category=' + (c ? c.id : '');
		} else location.hash = `#/discover?${f}=${encodeURIComponent(v === 'Unknown' ? 'other' : v)}`;
	}));
}

// ---------- discover ----------
let searchTimer = null;
let searchSeq = 0;
const getParams = () => new URLSearchParams((location.hash.split('?')[1] || ''));

async function viewDiscover() {
	const opts = await loadOptions();
	const p = getParams();
	const page = shell('discover', 'Discover influencers',
		`<a class="btn ghost" id="exportBtn">${ICON.download} Export CSV</a>${canEdit() ? `<a class="btn" href="#/influencer/new">${ICON.plus} Add</a>` : ''}`, '');
	const chipSet = (name, items) => {
		const on = new Set((p.get(name) || '').split(',').filter(Boolean));
		return `<div class="chips" data-multi="${name}">${items.map(([v, l, n]) => `<span class="chip ${on.has(String(v)) ? 'on' : ''}" data-v="${esc(v)}">${esc(l)}${n != null ? `<span class="n">${n}</span>` : ''}</span>`).join('')}</div>`;
	};
	const seg = (name, items) => `<div class="seg" data-single="${name}">${items.map(([v, l]) => `<button type="button" data-v="${v}" class="${(p.get(name) || '') === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
	const inp = (name, ph, type = 'text') => `<input type="${type}" data-k="${name}" placeholder="${ph}" value="${esc(p.get(name) || '')}">`;
	const team = canEdit();
	page.innerHTML = `<div class="discover">
		<aside class="card filters" id="filters">
			<h3>Location</h3>${chipSet('city', [...opts.cities.map((c) => [c, c]), ['other', 'Other / unknown']])}
			<h3>Category</h3>${chipSet('category', opts.categories.filter((c) => c.active).map((c) => [c.id, c.name, c.n]))}
			<h3>Platform</h3>${seg('platform', [['', 'Any'], ['ig', 'Instagram'], ['tt', 'TikTok']])}
			<h3>Followers</h3>
			<div class="range">${inp('fmin', 'Min e.g. 80k')}${inp('fmax', 'Max e.g. 100k')}</div>
			<div class="chips" style="margin-top:8px" data-multi="tier">${Object.entries(TIERS).map(([k, l]) => `<span class="chip ${(p.get('tier') || '').split(',').includes(k) ? 'on' : ''}" data-v="${k}">${l}</span>`).join('')}</div>
			<div class="faint small" style="margin-top:6px">Nano &lt;10K · Micro 10–100K · Mid 100–500K · Macro 500K–1M · Celebrity 1M+</div>
			<button class="btn ghost" id="reset" style="width:100%;justify-content:center;margin-top:18px">Reset all filters</button>
		</aside>
		<section>
			<div class="resultbar">
				<div class="count" id="count">…</div>
				<input type="text" class="search" data-k="q" placeholder="Search name, @handle, agency…" value="${esc(p.get('q') || '')}">
				<div class="grow" style="flex:1"></div>
				<select data-k="sort" style="width:auto">
					${[['followers', 'Followers'], ['er', 'Engagement'], ['views', 'Avg views'], ['price', 'Price'], ['newest', 'Newest'], ['name', 'Name']].map(([k, l]) => `<option value="${k}" ${(p.get('sort') || 'followers') === k ? 'selected' : ''}>Sort: ${l}</option>`).join('')}
				</select>
				<select data-k="dir" style="width:auto">
					<option value="desc" ${p.get('dir') !== 'asc' ? 'selected' : ''}>High → low</option><option value="asc" ${p.get('dir') === 'asc' ? 'selected' : ''}>Low → high</option>
				</select>
				<div class="seg" style="width:auto" data-view><button type="button" data-v="cards" class="${p.get('view') !== 'table' ? 'on' : ''}">Cards</button><button type="button" data-v="table" class="${p.get('view') === 'table' ? 'on' : ''}">Table</button></div>
			</div>
			<div class="activef" id="activef"></div>
			<div id="results"></div>
		</section>
	</div>`;

	const filters = $('#filters');
	const setParam = (k, v) => {
		const q = getParams();
		if (v === '' || v == null || v === false) q.delete(k); else q.set(k, v);
		if (k !== 'page') q.delete('page');
		history.replaceState(null, '', '#/discover' + (q.toString() ? '?' + q : ''));
		loadResults();
	};
	$$('[data-multi]', page).forEach((g) => g.addEventListener('click', (e) => {
		const c = e.target.closest('.chip'); if (!c) return;
		c.classList.toggle('on');
		setParam(g.dataset.multi, $$('.chip.on', g).map((x) => x.dataset.v).join(','));
	}));
	$$('[data-single]', page).forEach((g) => g.addEventListener('click', (e) => {
		const b = e.target.closest('button'); if (!b) return;
		$$('button', g).forEach((x) => x.classList.toggle('on', x === b));
		setParam(g.dataset.single, b.dataset.v);
	}));
	$('[data-view]', page).addEventListener('click', (e) => {
		const b = e.target.closest('button'); if (!b) return;
		$$('[data-view] button').forEach((x) => x.classList.toggle('on', x === b));
		setParam('view', b.dataset.v === 'cards' ? '' : b.dataset.v);
	});
	$$('[data-k]', page).forEach((el) => {
		const k = el.dataset.k;
		const handler = () => setParam(k, el.type === 'checkbox' ? (el.checked ? '1' : '') : el.value.trim());
		if (el.tagName === 'SELECT' || el.type === 'checkbox') el.onchange = handler;
		else el.oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(handler, 300); };
	});
	$('#reset').onclick = () => { location.hash = '#/discover'; };
	$('#exportBtn').onclick = () => { location.href = '/api/influencers/export?' + getParams().toString(); };
	loadResults();
}

function mergeTop(defaults, found) {
	const map = new Map(found.map((x) => [x.value, x.n]));
	const out = defaults.map((d) => [d, d, map.get(d) || 0]);
	for (const f of found) if (!defaults.includes(f.value)) out.push([f.value, f.value, f.n]);
	return out;
}

const FILTER_LABELS = {
	city: 'City', category: 'Category', platform: 'Platform', fmin: 'Followers ≥', fmax: 'Followers ≤', tier: 'Tier', language: 'Language',
	gender: 'Gender', ermin: 'ER ≥', ermax: 'ER ≤', vmin: 'Views ≥', deliverable: 'Deliverable', pmin: 'Price ≥', pmax: 'Price ≤',
	has_price: 'Has rates', nationality: 'Nationality', audience: 'Audience', availability: 'Availability', has_contact: 'Has contact', status: 'Status', q: 'Search'
};

async function loadResults() {
	const seq = ++searchSeq;
	const p = getParams();
	const box = $('#results');
	if (!box) return;
	box.style.opacity = '.5';
	let r;
	try { r = await api('/influencers?' + p.toString()); } catch (e) { box.style.opacity = 1; return fail(e); }
	if (seq !== searchSeq) return;
	box.style.opacity = 1;
	$('#count').textContent = `${fmtFull(r.total)} influencer${r.total === 1 ? '' : 's'}`;

	// Active filter pills
	const cats = new Map(state.options.categories.map((c) => [String(c.id), c.name]));
	const pills = [];
	for (const [k, v] of p) {
		if (!FILTER_LABELS[k] || !v) continue;
		let shown = v;
		if (k === 'category') shown = v.split(',').map((x) => cats.get(x) || x).join(', ');
		if (k === 'platform') shown = v === 'ig' ? 'Instagram' : 'TikTok';
		if (k === 'tier') shown = v.split(',').map((x) => TIERS[x]).join(', ');
		if (k === 'has_price' || k === 'has_contact') shown = 'yes';
		pills.push(`<span class="pill" data-k="${k}">${FILTER_LABELS[k]}: ${esc(shown)} ✕</span>`);
	}
	$('#activef').innerHTML = pills.join('');
	$$('#activef .pill').forEach((x) => (x.onclick = () => { const q = getParams(); q.delete(x.dataset.k); location.hash = '#/discover?' + q; }));

	if (!r.results.length) {
		box.innerHTML = `<div class="card empty"><b>No influencers match these filters</b>Try widening the follower range or removing a filter.</div>`;
		return;
	}
	const platform = p.get('platform') || '';
	box.innerHTML = (p.get('view') === 'table' ? resultsTable(r.results) : `<div class="cards">${r.results.map((x) => card(x, platform)).join('')}</div>`) +
		(r.pages > 1 ? `<div class="pager"><button class="btn ghost sm" data-pg="${r.page - 1}" ${r.page <= 1 ? 'disabled' : ''}>← Prev</button><span class="muted">Page ${r.page} of ${r.pages}</span><button class="btn ghost sm" data-pg="${r.page + 1}" ${r.page >= r.pages ? 'disabled' : ''}>Next →</button></div>` : '');
	$$('[data-pg]', box).forEach((b) => (b.onclick = () => { const q = getParams(); q.set('page', b.dataset.pg); history.replaceState(null, '', '#/discover?' + q); loadResults(); window.scrollTo(0, 0); }));
	$$('[data-open]', box).forEach((el) => (el.onclick = (e) => { if (e.target.closest('a,input')) return; location.hash = '#/influencer/' + el.dataset.open; }));
	$$('input.pick', box).forEach((cb) => (cb.onchange = () => {
		const row = r.results.find((x) => x.id === +cb.dataset.id);
		if (cb.checked) state.selected.set(row.id, row); else state.selected.delete(row.id);
		cb.closest('.ic')?.classList.toggle('sel', cb.checked);
		renderTray();
	}));
	renderTray();
}

function priceChips(x, max = 4) {
	const list = PRICE_LABELS.filter(([k]) => x[k]).map(([k, l]) => `<span class="price">${l} ${aed(x[k])}</span>`);
	if (!list.length) return '<span class="price na">Contact for rates</span>';
	return list.slice(0, max).join('') + (list.length > max ? `<span class="price na">+${list.length - max}</span>` : '');
}
function platBox(x, pl) {
	const u = x[pl + '_username'];
	if (!u) return `<div class="plat off"><div class="pn">${ICON[pl]} ${pl === 'ig' ? 'Instagram' : 'TikTok'}</div><div class="pf">–</div><div class="pe">Not listed</div></div>`;
	return `<a class="plat" href="${esc(x[pl + '_url'])}" target="_blank" rel="noopener"><div class="pn">${ICON[pl]} @${esc(u)}</div>
		<div class="pf">${fmtN(x[pl + '_followers'])}</div><div class="pe">ER ${pct(x[pl + '_er'])}${x[pl + '_avg_views'] ? ' · ' + fmtN(x[pl + '_avg_views']) + ' views' : ''}</div></a>`;
}
function card(x) {
	const sel = state.selected.has(x.id);
	const cats = x.categories.slice(0, 3).map((c) => c.name).join(' · ');
	const st = x.status !== 'approved' ? ` <span class="pill ${STATUS[x.status][1]}">${STATUS[x.status][0]}</span>` : '';
	return `<div class="card ic ${sel ? 'sel' : ''}">
		<input type="checkbox" class="pick" data-id="${x.id}" ${sel ? 'checked' : ''} title="Select to compare or shortlist">
		<div class="head" data-open="${x.id}">${avatar(x)}<div><div class="name">${esc(x.full_name)}${st}</div>
			<div class="sub">${esc(cats || 'No category')}</div>
			<div class="sub">${esc(x.city || 'Location unknown')}${x.tier ? ` · <span class="pill tier-${x.tier}">${TIERS[x.tier]}</span>` : ''}</div></div></div>
		<div class="plats">${platBox(x, 'ig')}${platBox(x, 'tt')}</div>
		<div class="prices">${priceChips(x)}</div>
	</div>`;
}
function resultsTable(rows) {
	return `<div class="card" style="overflow:auto"><table class="t"><thead><tr><th></th><th>Influencer</th><th>City</th><th>Category</th><th class="num">IG followers</th><th class="num">IG ER</th><th class="num">TikTok</th><th class="num">TT ER</th><th class="num">Reel</th><th class="num">TT video</th><th>Links</th></tr></thead><tbody>
		${rows.map((x) => `<tr class="click" data-open="${x.id}"><td><input type="checkbox" class="pick" data-id="${x.id}" ${state.selected.has(x.id) ? 'checked' : ''}></td>
			<td><div class="row">${avatar(x, 'sm')}<div><b>${esc(x.full_name)}</b>${x.tier ? `<div class="faint small">${TIERS[x.tier]}</div>` : ''}</div></div></td>
			<td>${esc(x.city || '–')}</td><td class="small">${esc(x.categories.slice(0, 2).map((c) => c.name).join(', '))}</td>
			<td class="num">${fmtN(x.ig_followers)}</td><td class="num">${pct(x.ig_er)}</td><td class="num">${fmtN(x.tt_followers)}</td><td class="num">${pct(x.tt_er)}</td>
			<td class="num">${x.price_ig_reel ? fmtFull(x.price_ig_reel) : '–'}</td><td class="num">${x.price_tt_video ? fmtFull(x.price_tt_video) : '–'}</td>
			<td>${x.ig_url ? `<a href="${esc(x.ig_url)}" target="_blank" rel="noopener">IG</a>` : ''} ${x.tt_url ? `<a href="${esc(x.tt_url)}" target="_blank" rel="noopener">TT</a>` : ''}</td></tr>`).join('')}
	</tbody></table></div>`;
}

function renderTray() {
	$('.tray')?.remove();
	const n = state.selected.size;
	if (!n) return;
	const t = document.createElement('div');
	t.className = 'tray';
	t.innerHTML = `<b>${n} selected</b><button class="btn ghost sm" id="tcmp" ${n < 2 ? 'disabled' : ''}>Compare</button>${canEdit() ? '<button class="btn accent sm" id="tadd">Add to campaign</button>' : ''}<button class="btn ghost sm" id="tclr">Clear</button>`;
	document.body.appendChild(t);
	$('#tcmp').onclick = () => { location.hash = '#/compare?ids=' + [...state.selected.keys()].slice(0, 6).join(','); };
	$('#tclr').onclick = () => { state.selected.clear(); $$('input.pick').forEach((c) => { c.checked = false; c.closest('.ic')?.classList.remove('sel'); }); renderTray(); };
	const add = $('#tadd'); if (add) add.onclick = () => addToCampaign([...state.selected.keys()]);
}

async function addToCampaign(idList) {
	const { campaigns } = await api('/campaigns');
	const open = campaigns.filter((c) => c.status !== 'archived' && c.status !== 'completed');
	const m = modal(`<h3>Add ${idList.length} influencer${idList.length === 1 ? '' : 's'} to a campaign</h3>
		${open.length ? `<label class="f"><span>Existing campaign</span><select id="cp">${open.map((c) => `<option value="${c.id}">${esc(c.name)}${c.client ? ' · ' + esc(c.client) : ''}</option>`).join('')}</select></label>
		<div class="muted small" style="margin:12px 0">or create a new one</div>` : ''}
		<div class="grid2"><label class="f"><span>New campaign name</span><input type="text" id="cn"></label><label class="f"><span>Client</span><input type="text" id="cc"></label></div>
		<div class="actions"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="cgo">Add</button></div>`);
	$('#cgo', m.el).onclick = async () => {
		try {
			let id = $('#cp', m.el)?.value;
			const name = $('#cn', m.el).value.trim();
			if (name) id = (await api('/campaigns', { method: 'POST', body: { name, client: $('#cc', m.el).value } })).id;
			if (!id) return toast('Choose or name a campaign.', true);
			await api(`/campaigns/${id}/influencers`, { method: 'POST', body: { influencer_ids: idList } });
			m.close();
			toast('Added to campaign');
			state.selected.clear(); renderTray();
			location.hash = '#/campaign/' + id;
		} catch (e) { fail(e); }
	};
}

// ---------- compare ----------
async function viewCompare() {
	const p = getParams();
	const page = shell('discover', 'Compare influencers', `<a class="btn ghost" href="javascript:history.back()">← Back</a>${canEdit() ? '<button class="btn accent" id="cadd">Add all to campaign</button>' : ''}`, '');
	const { results } = await api('/influencers/compare?ids=' + (p.get('ids') || ''));
	if (!results.length) { page.innerHTML = '<div class="card empty"><b>Nothing to compare</b>Select influencers in Discover first.</div>'; return; }
	const best = (k, low) => {
		const vals = results.map((r) => r[k]).filter((v) => v != null);
		if (vals.length < 2) return null;
		return low ? Math.min(...vals) : Math.max(...vals);
	};
	const row = (label, fn, k, low) => {
		const b = k ? best(k, low) : null;
		return `<tr><th>${label}</th>${results.map((r) => `<td style="${b != null && r[k] === b ? 'font-weight:800;color:var(--ok)' : ''}">${fn(r)}</td>`).join('')}</tr>`;
	};
	page.innerHTML = `<div class="card" style="overflow:auto"><table class="t compare">
		<tr><th></th>${results.map((r) => `<td><a href="#/influencer/${r.id}" style="text-decoration:none">${avatar(r, 'lg')}<div style="font-weight:700;font-size:15px;margin-top:8px">${esc(r.full_name)}</div></a></td>`).join('')}</tr>
		${row('City', (r) => esc(r.city || '–'))}
		${row('Categories', (r) => esc(r.categories.map((c) => c.name).join(', ') || '–'))}
		${row('Tier', (r) => (r.tier ? TIERS[r.tier] : '–'))}
		${row('Languages', (r) => esc(r.languages.join(', ') || '–'))}
		${row('Gender', (r) => GENDER[r.gender] || '–')}
		${row('Nationality', (r) => esc(r.nationality || '–'))}
		${row('Instagram', (r) => (r.ig_url ? `<a href="${esc(r.ig_url)}" target="_blank" rel="noopener">@${esc(r.ig_username)}</a>` : '–'))}
		${row('IG followers', (r) => fmtFull(r.ig_followers), 'ig_followers')}
		${row('IG engagement', (r) => pct(r.ig_er), 'ig_er')}
		${row('IG avg Reel views', (r) => fmtFull(r.ig_avg_views), 'ig_avg_views')}
		${row('TikTok', (r) => (r.tt_url ? `<a href="${esc(r.tt_url)}" target="_blank" rel="noopener">@${esc(r.tt_username)}</a>` : '–'))}
		${row('TikTok followers', (r) => fmtFull(r.tt_followers), 'tt_followers')}
		${row('TikTok engagement', (r) => pct(r.tt_er), 'tt_er')}
		${row('TikTok avg views', (r) => fmtFull(r.tt_avg_views), 'tt_avg_views')}
		${PRICE_LABELS.map(([k, l]) => row(l, (r) => aed(r[k]) || '<span class="faint">Contact for rates</span>', k, true)).join('')}
		${row('Top audience', (r) => esc([r.audience_country, r.audience_city].filter(Boolean).join(' · ') || '–'))}
		${row('Availability', (r) => AVAIL[r.availability])}
		${row('Agency', (r) => esc(r.agency || '–'))}
	</table></div><p class="faint small">Best value in each numeric row is highlighted (highest reach/engagement, lowest price).</p>`;
	const b = $('#cadd'); if (b) b.onclick = () => addToCampaign(results.map((r) => r.id));
}

// ---------- influencer profile ----------
const FORM = [
	{ title: 'Personal details', fields: [
		['full_name', 'Full name', 'text', { required: true }], ['city', 'City', 'city'], ['gender', 'Gender', 'select', GENDER],
		['nationality', 'Nationality', 'text'], ['languages', 'Languages (comma separated)', 'langs'], ['email', 'Contact email', 'email'],
		['whatsapp', 'WhatsApp / phone', 'text'], ['agency', 'Management agency', 'text'], ['photo_url', 'Profile picture URL (optional)', 'url']
	] },
	{ title: 'Content', fields: [['bio', 'Short bio', 'textarea'], ['content_types', 'Type of content', 'text'], ['availability', 'Availability for collaborations', 'select', AVAIL]] },
	{ title: 'Instagram', fields: [
		['ig_username', 'Username or profile link', 'text'], ['ig_followers', 'Followers', 'num'], ['ig_er', 'Engagement rate %', 'num'],
		['ig_avg_views', 'Avg Reel views', 'num'], ['ig_avg_likes', 'Avg likes', 'num'], ['ig_avg_comments', 'Avg comments', 'num']
	] },
	{ title: 'TikTok', fields: [
		['tt_username', 'Username or profile link', 'text'], ['tt_followers', 'Followers', 'num'], ['tt_er', 'Engagement rate %', 'num'],
		['tt_avg_views', 'Avg video views', 'num'], ['tt_avg_likes', 'Avg likes', 'num'], ['tt_avg_comments', 'Avg comments', 'num']
	] },
	{ title: 'Rates (AED)', fields: [...PRICE_LABELS.map(([k, l]) => [k, l, 'num']), ['price_source', 'Rates provided by', 'select', { '': '–', influencer: 'Influencer', management: 'Management', rate_card: 'Verified rate card', team: 'RICH team' }]] },
	{ title: 'Audience', fields: [['audience_country', 'Top audience country', 'text'], ['audience_city', 'Top audience city', 'text']] },
	{ title: 'Internal notes', fields: [['admin_notes', 'Notes (team only)', 'textarea']] }
];

function fieldHtml([k, label, type, extra], v) {
	const val = v ?? '';
	let input;
	if (type === 'textarea') input = `<textarea name="${k}">${esc(val)}</textarea>`;
	else if (type === 'select') input = `<select name="${k}">${Object.entries(extra).map(([o, l]) => `<option value="${o}" ${String(val) === o ? 'selected' : ''}>${esc(l)}</option>`).join('')}${!val && !('' in extra) ? '<option value="" selected>–</option>' : ''}</select>`;
	else if (type === 'city') input = `<input type="text" name="${k}" list="citylist" value="${esc(val)}"><datalist id="citylist"><option>Dubai</option><option>Abu Dhabi</option><option>Sharjah</option></datalist>`;
	else if (type === 'langs') input = `<input type="text" name="${k}" value="${esc(Array.isArray(val) ? val.join(', ') : val)}" placeholder="Arabic, English">`;
	else input = `<input type="${type === 'num' ? 'text' : type}" name="${k}" value="${esc(val)}" ${type === 'num' ? 'inputmode="decimal"' : ''} ${extra && extra.required ? 'required' : ''}>`;
	return `<label class="f"${type === 'textarea' ? ' style="grid-column:1/-1"' : ''}><span>${esc(label)}</span>${input}</label>`;
}

function catPicker(selected, primary) {
	const opts = state.options.categories.filter((c) => c.active || selected.includes(c.id));
	return `<div class="catpick" id="catpick">${opts.map((c) => `<span class="chip ${selected.includes(c.id) ? 'on' : ''} ${c.id === primary ? 'primary' : ''}" data-id="${c.id}">${esc(c.name)}</span>`).join('')}</div>
		<div class="faint small" style="margin-top:6px">Click to select. Double-click to set the main category (gold).</div>`;
}
function bindCatPicker(root) {
	const box = $('#catpick', root);
	box.addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; c.classList.toggle('on'); if (!c.classList.contains('on')) c.classList.remove('primary'); });
	box.addEventListener('dblclick', (e) => { const c = e.target.closest('.chip'); if (!c) return; $$('.chip', box).forEach((x) => x.classList.remove('primary')); c.classList.add('on', 'primary'); });
	return () => {
		const on = $$('.chip.on', box).map((c) => +c.dataset.id);
		const pr = $('.chip.primary', box);
		return { categories: on, primary_category: pr ? +pr.dataset.id : on[0] };
	};
}

async function viewInfluencer(id) {
	await loadOptions();
	if (id === 'new') return editInfluencer(null);
	const page = shell('discover', 'Influencer', '', '<div class="muted">Loading…</div>');
	let d;
	try { d = await api('/influencers/' + id); } catch (e) { page.innerHTML = `<div class="card empty"><b>${esc(e.message)}</b></div>`; return; }
	const x = d.influencer;
	const [stLabel, stCls] = STATUS[x.status];
	$('.topbar h1').innerHTML = esc(x.full_name);
	const actions = $('.topbar .grow');
	actions.insertAdjacentHTML('afterend', `${canEdit() ? `<button class="btn ghost" id="addc">Add to campaign</button><button class="btn" id="edit">Edit</button>` : ''}`);

	const stat = (l, v) => `<div class="stat"><div class="l">${l}</div><div class="v">${v}</div></div>`;
	const platSection = (pl, name) => x[pl + '_username'] ? `
		<h2 class="sec">${ICON[pl].replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"')} ${name} · <a href="${esc(x[pl + '_url'])}" target="_blank" rel="noopener" style="text-transform:none;letter-spacing:0">@${esc(x[pl + '_username'])} ↗</a></h2>
		<div class="stats">${stat('Followers', fmtFull(x[pl + '_followers']))}${stat('Engagement', pct(x[pl + '_er']))}${stat(pl === 'ig' ? 'Avg Reel views' : 'Avg views', fmtFull(x[pl + '_avg_views']))}${stat('Avg likes', fmtFull(x[pl + '_avg_likes']))}${stat('Avg comments', fmtFull(x[pl + '_avg_comments']))}</div>` : '';

	const review = ['pending', 'info_requested'].includes(x.status) && canEdit();
	const dupBlock = d.duplicates.length ? `<div class="banner warn" style="margin-bottom:16px"><b>Possible duplicate.</b> ${d.duplicates.map((dp) => `<a href="#/influencer/${dp.id}">${esc(dp.full_name)}</a> (${STATUS[dp.status][0].toLowerCase()}) shares ${esc(dp.reasons.join(', '))}${review && canEdit() ? ` · <a href="#" data-merge="${dp.id}">Merge into this profile</a>` : ''}`).join('<br>')}</div>` : '';

	page.innerHTML = `
		${review ? `<div class="card pad" style="margin-bottom:16px;border-color:#f0d8b6;background:#fffaf2">
			<div class="row wrap"><div style="flex:1"><b>${x.status === 'info_requested' ? 'Waiting on the influencer' : 'New registration waiting for review'}</b>
			<div class="muted small">${x.status === 'info_requested' ? 'Requested: ' + esc(x.info_request) : `Registered ${dateTime(x.created_at)} via ${esc(x.source)}. Edit anything before approving.`}</div></div>
			<button class="btn ok" data-act="approve">Approve</button><button class="btn ghost" data-act="request_info">Request info</button><button class="btn bad" data-act="reject">Reject</button></div></div>` : ''}
		${x.status === 'rejected' && canEdit() ? `<div class="banner warn" style="margin-bottom:16px">Rejected${x.reject_reason ? ': ' + esc(x.reject_reason) : ''}. <a href="#" data-act="reopen">Move back to review</a></div>` : ''}
		${dupBlock}
		${d.updates.map((u) => updateCard(u)).join('')}
		<div class="profile">
			<div>
				<div class="card pad">
					<div class="phead">${avatar(x, 'lg')}<div>
						<h2>${esc(x.full_name)}</h2>
						<div class="row wrap" style="margin-top:6px"><span class="pill ${stCls}">${stLabel}</span>${x.tier ? `<span class="pill tier-${x.tier}">${TIERS[x.tier]}</span>` : ''}
						${x.categories.map((c) => `<span class="pill ${c.primary ? 'accent' : ''}">${esc(c.name)}</span>`).join('')}</div>
						<div class="muted" style="margin-top:8px">${esc([x.city, x.nationality, x.languages.join(', ')].filter(Boolean).join(' · '))}</div>
					</div></div>
					${x.bio ? `<p style="margin:16px 0 0;white-space:pre-line">${esc(x.bio)}</p>` : ''}
					${platSection('ig', 'Instagram')}
					${platSection('tt', 'TikTok')}
					<h2 class="sec">Rates</h2>
					<div class="ratecard">${PRICE_LABELS.map(([k, l]) => `<div class="stat"><div class="l">${l}</div><div class="v" style="${x[k] ? '' : 'font-size:13px;color:var(--muted);font-weight:500'}">${x[k] ? aed(x[k]) : 'Contact for rates'}</div></div>`).join('')}</div>
					${x.price_source ? `<div class="faint small" style="margin-top:8px">Rates provided by: ${esc({ influencer: 'the influencer', management: 'management', rate_card: 'verified rate card', team: 'RICH team' }[x.price_source])}</div>` : ''}
				</div>
			</div>
			<div class="stack">
				<div class="card pad"><dl class="kv">
					<dt>Email</dt><dd>${x.email ? `<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : '–'}</dd>
					<dt>WhatsApp</dt><dd>${x.whatsapp ? `<a href="https://wa.me/${esc(x.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">${esc(x.whatsapp)}</a>` : '–'}</dd>
					<dt>Agency</dt><dd>${esc(x.agency || '–')}</dd>
					<dt>Gender</dt><dd>${GENDER[x.gender] || '–'}</dd>
					<dt>Availability</dt><dd>${AVAIL[x.availability]}</dd>
					<dt>Content</dt><dd>${esc(x.content_types || '–')}</dd>
					<dt>Top audience</dt><dd>${esc([x.audience_country, x.audience_city].filter(Boolean).join(' · ') || '–')}</dd>
					<dt>Self-service login</dt><dd>${d.account ? esc(d.account.email) : '<span class="faint">None</span>'}</dd>
					<dt>Stats updated</dt><dd>${date(x.stats_updated_at) || '–'}</dd>
					<dt>Added</dt><dd>${date(x.created_at)} · ${esc(x.source)}</dd>
				</dl></div>
				${x.admin_notes ? `<div class="card pad"><b class="small muted">INTERNAL NOTES</b><p style="white-space:pre-line;margin:6px 0 0">${esc(x.admin_notes)}</p></div>` : ''}
				<div class="card pad"><b class="small muted">CAMPAIGNS</b>${d.campaigns.length ? `<div class="timeline">${d.campaigns.map((c) => `<div><a href="#/campaign/${c.id}">${esc(c.name)}</a> <span class="pill">${CI_STATUS[c.status]}</span>${c.agreed_price ? ` <span class="faint small">${aed(c.agreed_price)}</span>` : ''}</div>`).join('')}</div>` : '<div class="muted small" style="margin-top:6px">Not on any campaign yet.</div>'}</div>
				<div class="card pad"><b class="small muted">HISTORY</b><div class="timeline">${d.activity.map((a) => `<div><b>${esc(a.action)}</b> · ${esc(a.by_name || '')}${a.detail ? `<div class="muted small">${esc(a.detail)}</div>` : ''}<div class="faint small">${dateTime(a.at)}</div></div>`).join('') || '<div class="muted small">No history.</div>'}</div></div>
				${isAdmin() ? '<button class="btn bad sm" id="del">Delete profile</button>' : ''}
			</div>
		</div>`;

	const review_ = async (action) => {
		let message = '';
		if (action === 'request_info') { message = await ask('Request more information', { label: 'What do you need from them?', textarea: true, placeholder: 'e.g. Please add your TikTok username and a recent rate card.', ok: 'Send request', hint: 'They will see this when they log in (and by email if email is configured).' }); if (message == null) return; }
		if (action === 'reject') { message = await ask('Reject registration', { label: 'Reason (internal, optional)', textarea: true, required: false, ok: 'Reject' }); if (message == null) return; }
		try { await api(`/influencers/${x.id}/review`, { method: 'POST', body: { action, message } }); toast({ approve: 'Approved. Now live in Discover.', reject: 'Rejected', request_info: 'Request sent', reopen: 'Moved to review' }[action]); refreshCounts(); viewInfluencer(x.id); } catch (e) { fail(e); }
	};
	$$('[data-act]', page).forEach((b) => (b.onclick = (e) => { e.preventDefault(); review_(b.dataset.act); }));
	$$('[data-merge]', page).forEach((b) => (b.onclick = async (e) => {
		e.preventDefault();
		if (!confirm('Merge this registration into the existing profile? Details they submitted fill in or replace the existing ones, categories are combined, and their login is linked to the existing profile.')) return;
		try { const r = await api(`/influencers/${x.id}/merge`, { method: 'POST', body: { into: +b.dataset.merge } }); toast('Merged'); refreshCounts(); location.hash = '#/influencer/' + r.id; } catch (er) { fail(er); }
	}));
	bindUpdateCards(page, () => viewInfluencer(x.id));
	const ed = $('#edit'); if (ed) ed.onclick = () => editInfluencer(x);
	const ac = $('#addc'); if (ac) ac.onclick = () => addToCampaign([x.id]);
	const del = $('#del'); if (del) del.onclick = async () => { if (!confirm(`Delete ${x.full_name} permanently?`)) return; await api('/influencers/' + x.id, { method: 'DELETE' }); toast('Deleted'); location.hash = '#/discover'; };
}

function updateCard(u, withName) {
	const fmt = (c, v) => {
		if (c.field === 'photo') return v ? `<img class="avatar sm" src="${esc(v)}">` : '–';
		if (c.field === 'categories') return esc((v.ids || []).map((i) => (state.options.categories.find((x) => x.id === +i) || {}).name).filter(Boolean).join(', '));
		if (v == null || v === '') return '–';
		if (c.field.startsWith('price_')) return aed(v);
		if (/_followers|_avg_/.test(c.field)) return fmtFull(v);
		return esc(v);
	};
	return `<div class="card pad" style="margin-bottom:16px;border-color:#b9dcec" data-update="${u.id}">
		<div class="row wrap"><div style="flex:1"><b>${withName ? `<a href="#/influencer/${u.influencer_id}">${esc(u.full_name)}</a> submitted` : 'Submitted'} profile changes</b> <span class="faint small">${dateTime(u.created_at)}</span></div>
		${canEdit() ? `<button class="btn ok sm" data-uact="approve">Approve selected</button><button class="btn bad sm" data-uact="reject">Reject all</button>` : ''}</div>
		<table class="t diff" style="margin-top:10px"><thead><tr><th>Field</th><th>Current</th><th>New</th><th style="width:40px">Apply</th></tr></thead><tbody>
		${u.changes.map((c) => `<tr><td>${esc(c.label)}</td><td>${c.field === 'categories' ? '' : fmt(c, c.from)}</td><td>${fmt(c, c.to)}</td><td><input type="checkbox" checked data-field="${esc(c.field)}"></td></tr>`).join('')}
		</tbody></table></div>`;
}
function bindUpdateCards(root, after) {
	$$('[data-update]', root).forEach((card) => $$('[data-uact]', card).forEach((b) => (b.onclick = async () => {
		const fields = $$('input[data-field]:checked', card).map((c) => c.dataset.field);
		try {
			await api('/updates/' + card.dataset.update, { method: 'POST', body: { action: b.dataset.uact, fields } });
			toast(b.dataset.uact === 'approve' ? 'Changes applied' : 'Changes rejected');
			refreshCounts(); after();
		} catch (e) { fail(e); }
	})));
}

async function editInfluencer(x) {
	await loadOptions();
	const isNew = !x;
	x = x || { languages: [], categories: [], availability: 'unknown' };
	const page = shell('discover', isNew ? 'Add influencer' : 'Edit ' + esc(x.full_name), `<a class="btn ghost" href="${isNew ? '#/discover' : '#/influencer/' + x.id}">Cancel</a><button class="btn" id="save">Save</button>`, '');
	const selCats = x.categories.map((c) => c.id);
	const primary = (x.categories.find((c) => c.primary) || {}).id;
	page.innerHTML = `<form class="card pad" id="ef" style="max-width:900px">
		${!isNew ? `<div class="formsec"><h3>Profile picture</h3><div class="row">${avatar(x, 'lg')}<label class="btn ghost">Upload new<input type="file" accept="image/jpeg,image/png,image/webp" id="ph" hidden></label></div></div>` : ''}
		<div class="formsec"><h3>Categories</h3>${catPicker(selCats, primary)}</div>
		${FORM.map((s) => `<div class="formsec"><h3>${s.title}</h3><div class="grid3">${s.fields.map((f) => fieldHtml(f, x[f[0]])).join('')}</div></div>`).join('')}
		${isNew ? `<div class="formsec"><label class="row"><input type="checkbox" name="__pending"> Add as pending (needs review) instead of approved</label></div>` : ''}
	</form>`;
	const getCats = bindCatPicker(page);
	const ph = $('#ph');
	if (ph) ph.onchange = async () => {
		const fd = new FormData(); fd.append('photo', ph.files[0]);
		try { await api(`/influencers/${x.id}/photo`, { method: 'POST', body: fd }); toast('Photo updated'); const img = $('.avatar.lg', page); const r = await api('/influencers/' + x.id); img.outerHTML = avatar(r.influencer, 'lg'); } catch (e) { fail(e); }
	};
	const save = async (force) => {
		const fd = Object.fromEntries(new FormData($('#ef')));
		const pend = fd.__pending; delete fd.__pending;
		const payload = { data: fd, ...getCats(), force };
		try {
			if (isNew) {
				payload.status = pend ? 'pending' : 'approved';
				const r = await api('/influencers', { method: 'POST', body: payload });
				toast('Influencer added'); location.hash = '#/influencer/' + r.id;
			} else {
				await api('/influencers/' + x.id, { method: 'PUT', body: payload });
				toast('Saved'); state.options = null; location.hash = '#/influencer/' + x.id; route();
			}
		} catch (e) {
			if (e.status === 409 && e.data.duplicates) {
				const list = e.data.duplicates.map((d) => `${d.full_name} (${d.reasons.join(', ')})`).join('\n');
				if (confirm(`${e.message}\n\n${list}\n\nSave anyway?`)) save(true);
			} else fail(e);
		}
	};
	$('#save').onclick = () => { if (!$('#ef').reportValidity()) return; save(false); };
}

// ---------- review queue ----------
async function viewPending() {
	const tab = getParams().get('tab') || 'registrations';
	const page = shell('pending', 'Review queue', '', '<div class="muted">Loading…</div>');
	const d = await api('/pending');
	const pend = d.registrations.filter((r) => r.status === 'pending');
	const waiting = d.registrations.filter((r) => r.status === 'info_requested');
	const tabs = [['registrations', `Pending registrations (${pend.length})`], ['waiting', `Info requested (${waiting.length})`], ['updates', `Profile updates (${d.updates.length})`]];
	const regRow = (r) => `<div class="qitem" data-id="${r.id}">
		${avatar(r)}
		<div><a href="#/influencer/${r.id}" style="font-weight:700;text-decoration:none">${esc(r.full_name)}</a>
			${r.duplicate ? `<span class="pill warn" title="${esc(r.duplicate.reason)}">Possible duplicate of ${esc(r.duplicate.full_name)}</span>` : ''}
			<div class="meta"><span>${esc(r.city || '–')}</span><span>${esc(r.categories.map((c) => c.name).join(', ') || 'No category')}</span>
			${r.ig_username ? `<a href="${esc(r.ig_url)}" target="_blank" rel="noopener">IG @${esc(r.ig_username)} · ${fmtN(r.ig_followers)}</a>` : ''}
			${r.tt_username ? `<a href="${esc(r.tt_url)}" target="_blank" rel="noopener">TT @${esc(r.tt_username)} · ${fmtN(r.tt_followers)}</a>` : ''}
			<span>${r.min_price ? 'From ' + aed(r.min_price) : 'No rates'}</span><span>${esc(r.source)} · ${dateTime(r.created_at)}</span></div>
			${r.status === 'info_requested' ? `<div class="small" style="margin-top:4px">Asked: <i>${esc(r.info_request)}</i></div>` : ''}</div>
		<div class="row">${canEdit() ? (r.duplicate ? `<a class="btn ghost sm" href="#/influencer/${r.id}">Review duplicate</a>` : `<button class="btn ok sm" data-q="approve">Approve</button>`) : ''}<a class="btn ghost sm" href="#/influencer/${r.id}">Open</a></div></div>`;
	page.innerHTML = `<div class="tabs">${tabs.map(([k, l]) => `<a href="#/pending?tab=${k}" class="${tab === k ? 'on' : ''}">${l}</a>`).join('')}</div>
		${tab === 'registrations' ? (pend.length ? `${canEdit() && pend.some((r) => !r.duplicate) ? `<div class="row" style="margin-bottom:12px"><span class="muted">Registrations without duplicate flags can be approved in one go.</span><div style="flex:1"></div><button class="btn ok sm" id="approveAll">Approve all non-duplicates (${pend.filter((r) => !r.duplicate).length})</button></div>` : ''}<div class="card">${pend.map(regRow).join('')}</div>` : '<div class="card empty"><b>All caught up</b>New registrations from the join page land here automatically.</div>') : ''}
		${tab === 'waiting' ? (waiting.length ? `<div class="card">${waiting.map(regRow).join('')}</div>` : '<div class="card empty"><b>Nobody is waiting</b>Registrations you asked for more details appear here until they update their profile.</div>') : ''}
		${tab === 'updates' ? (d.updates.length ? d.updates.map((u) => updateCard(u, true)).join('') : '<div class="card empty"><b>No pending profile changes</b>When approved influencers change followers, rates or handles, the changes wait here.</div>') : ''}`;
	$$('[data-q]', page).forEach((b) => (b.onclick = async () => {
		const id = b.closest('[data-id]').dataset.id;
		try { await api(`/influencers/${id}/review`, { method: 'POST', body: { action: 'approve' } }); b.closest('.qitem').remove(); toast('Approved'); refreshCounts(); } catch (e) { fail(e); }
	}));
	const all = $('#approveAll');
	if (all) all.onclick = async () => {
		const list = pend.filter((r) => !r.duplicate);
		if (!confirm(`Approve ${list.length} registrations? They become searchable immediately.`)) return;
		all.disabled = true;
		for (const r of list) { try { await api(`/influencers/${r.id}/review`, { method: 'POST', body: { action: 'approve' } }); } catch {} }
		toast(`Approved ${list.length}`); refreshCounts(); viewPending();
	};
	bindUpdateCards(page, viewPending);
}

// ---------- campaigns ----------
async function viewCampaigns() {
	const page = shell('campaigns', 'Campaigns', canEdit() ? `<button class="btn" id="newc">${ICON.plus} New campaign</button>` : '', '');
	const { campaigns } = await api('/campaigns');
	const st = { planning: ['Planning', ''], active: ['Active', 'ok'], completed: ['Completed', 'accent'], archived: ['Archived', ''] };
	page.innerHTML = campaigns.length ? `<div class="card" style="overflow:auto"><table class="t"><thead><tr><th>Campaign</th><th>Client</th><th>Status</th><th>Dates</th><th class="num">Influencers</th><th class="num">Confirmed</th><th class="num">Committed</th><th class="num">Budget</th></tr></thead><tbody>
		${campaigns.map((c) => `<tr class="click" onclick="location.hash='#/campaign/${c.id}'"><td><b>${esc(c.name)}</b></td><td>${esc(c.client || '–')}</td><td><span class="pill ${st[c.status][1]}">${st[c.status][0]}</span></td>
		<td class="small">${esc([c.start_date, c.end_date].filter(Boolean).join(' → ') || '–')}</td><td class="num">${c.n}</td><td class="num">${c.confirmed || 0}</td><td class="num">${c.committed ? aed(c.committed) : '–'}</td><td class="num">${c.budget ? aed(c.budget) : '–'}</td></tr>`).join('')}
	</tbody></table></div>` : '<div class="card empty"><b>No campaigns yet</b>Create one, then shortlist influencers into it from Discover.</div>';
	const n = $('#newc');
	if (n) n.onclick = () => {
		const m = modal(`<h3>New campaign</h3><div class="stack">
			<label class="f"><span>Campaign name</span><input type="text" id="n1"></label>
			<div class="grid2"><label class="f"><span>Client</span><input type="text" id="n2"></label><label class="f"><span>Budget (AED)</span><input type="text" id="n3" inputmode="numeric"></label></div>
			<div class="grid2"><label class="f"><span>Start</span><input type="date" id="n4"></label><label class="f"><span>End</span><input type="date" id="n5"></label></div>
			<label class="f"><span>Client brief</span><textarea id="n6" placeholder="e.g. Arabic-speaking food bloggers in Dubai, ~90K IG followers, 1 Reel + 3 Stories each"></textarea></label></div>
			<div class="actions"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="ngo">Create</button></div>`);
		$('#ngo', m.el).onclick = async () => {
			try {
				const r = await api('/campaigns', { method: 'POST', body: { name: $('#n1', m.el).value, client: $('#n2', m.el).value, budget: $('#n3', m.el).value, start_date: $('#n4', m.el).value, end_date: $('#n5', m.el).value, brief: $('#n6', m.el).value } });
				m.close(); location.hash = '#/campaign/' + r.id;
			} catch (e) { fail(e); }
		};
	};
}

async function viewCampaign(id) {
	const page = shell('campaigns', 'Campaign', '', '<div class="muted">Loading…</div>');
	const { campaign: c, influencers } = await api('/campaigns/' + id);
	$('.topbar h1').textContent = c.name;
	$('.topbar .grow').insertAdjacentHTML('afterend', `<a class="btn ghost" href="/api/campaigns/${c.id}/export">${ICON.download} Client shortlist CSV</a><a class="btn ghost" href="/api/campaigns/${c.id}/export?contacts=1">Internal CSV (with contacts)</a>${canEdit() ? `<a class="btn" href="#/discover">${ICON.plus} Find influencers</a>` : ''}`);
	const committed = influencers.filter((i) => !['declined'].includes(i.ci_status)).reduce((s, i) => s + (i.ci_price || 0), 0);
	const reach = influencers.filter((i) => i.ci_status !== 'declined').reduce((s, i) => s + (i.total_followers || 0), 0);
	const ed = canEdit();
	page.innerHTML = `
		<div class="grid4">
			<div class="card pad kpi"><div class="v">${influencers.length}</div><div class="l">Influencers</div></div>
			<div class="card pad kpi"><div class="v">${influencers.filter((i) => ['confirmed', 'live', 'completed'].includes(i.ci_status)).length}</div><div class="l">Confirmed</div></div>
			<div class="card pad kpi"><div class="v">${fmtN(reach)}</div><div class="l">Combined reach</div></div>
			<div class="card pad kpi"><div class="v" style="${c.budget && committed > c.budget ? 'color:var(--bad)' : ''}">${committed ? fmtN(committed) : '0'}</div><div class="l">AED committed${c.budget ? ` of ${fmtN(c.budget)} budget` : ''}</div></div>
		</div>
		<div class="card pad" style="margin-top:16px">
			<div class="grid4">
				<label class="f"><span>Client</span><input type="text" data-c="client" value="${esc(c.client || '')}" ${ed ? '' : 'disabled'}></label>
				<label class="f"><span>Status</span><select data-c="status" ${ed ? '' : 'disabled'}>${['planning', 'active', 'completed', 'archived'].map((s) => `<option ${c.status === s ? 'selected' : ''} value="${s}">${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select></label>
				<label class="f"><span>Budget (AED)</span><input type="text" data-c="budget" value="${c.budget ?? ''}" ${ed ? '' : 'disabled'}></label>
				<label class="f"><span>Dates</span><div class="row"><input type="date" data-c="start_date" value="${esc(c.start_date || '')}" ${ed ? '' : 'disabled'}><input type="date" data-c="end_date" value="${esc(c.end_date || '')}" ${ed ? '' : 'disabled'}></div></label>
			</div>
			<label class="f" style="margin-top:12px"><span>Brief</span><textarea data-c="brief" ${ed ? '' : 'disabled'}>${esc(c.brief || '')}</textarea></label>
		</div>
		<h2 class="sec">Shortlist</h2>
		${influencers.length ? `<div class="card" style="overflow:auto"><table class="t"><thead><tr><th>Influencer</th><th class="num">IG</th><th class="num">TikTok</th><th>Rates on file</th><th>Status</th><th>Deliverables</th><th>Agreed (AED)</th><th>Notes</th><th></th></tr></thead><tbody>
		${influencers.map((i) => `<tr data-i="${i.id}"><td><a href="#/influencer/${i.id}" class="row" style="text-decoration:none">${avatar(i, 'sm')}<div><b>${esc(i.full_name)}</b><div class="faint small">${esc(i.city || '')}</div></div></a></td>
			<td class="num">${i.ig_url ? `<a href="${esc(i.ig_url)}" target="_blank" rel="noopener">${fmtN(i.ig_followers)}</a>` : '–'}<div class="faint small">${i.ig_er ? pct(i.ig_er) : ''}</div></td>
			<td class="num">${i.tt_url ? `<a href="${esc(i.tt_url)}" target="_blank" rel="noopener">${fmtN(i.tt_followers)}</a>` : '–'}<div class="faint small">${i.tt_er ? pct(i.tt_er) : ''}</div></td>
			<td class="small">${PRICE_LABELS.filter(([k]) => i[k]).slice(0, 3).map(([k, l]) => `${l}: ${fmtFull(i[k])}`).join('<br>') || '<span class="faint">Contact for rates</span>'}</td>
			<td><select data-f="status" style="min-width:150px" ${ed ? '' : 'disabled'}>${Object.entries(CI_STATUS).map(([k, l]) => `<option value="${k}" ${i.ci_status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
			<td><input type="text" data-f="deliverables" value="${esc(i.ci_deliverables || '')}" placeholder="e.g. 1 Reel" ${ed ? '' : 'disabled'}></td>
			<td><input type="text" data-f="agreed_price" value="${i.ci_price ?? ''}" style="width:100px" ${ed ? '' : 'disabled'}></td>
			<td><input type="text" data-f="notes" value="${esc(i.ci_notes || '')}" ${ed ? '' : 'disabled'}></td>
			<td>${ed ? '<button class="btn bad sm" data-rm>Remove</button>' : ''}</td></tr>`).join('')}
		</tbody></table></div>` : '<div class="card empty"><b>No influencers yet</b>Go to Discover, select influencers, then "Add to campaign".</div>'}
		${isAdmin() ? '<button class="btn bad sm" id="delc" style="margin-top:20px">Delete campaign</button>' : ''}`;
	$$('[data-c]', page).forEach((el) => (el.onchange = async () => { try { await api('/campaigns/' + c.id, { method: 'PATCH', body: { [el.dataset.c]: el.value } }); toast('Saved'); } catch (e) { fail(e); } }));
	$$('tr[data-i]', page).forEach((tr) => {
		$$('[data-f]', tr).forEach((el) => (el.onchange = async () => { try { await api(`/campaigns/${c.id}/influencers/${tr.dataset.i}`, { method: 'PATCH', body: { [el.dataset.f]: el.value } }); toast('Saved'); if (el.dataset.f !== 'notes' && el.dataset.f !== 'deliverables') viewCampaign(c.id); } catch (e) { fail(e); } }));
		const rm = $('[data-rm]', tr); if (rm) rm.onclick = async () => { await api(`/campaigns/${c.id}/influencers/${tr.dataset.i}`, { method: 'DELETE' }); tr.remove(); toast('Removed'); };
	});
	const dc = $('#delc'); if (dc) dc.onclick = async () => { if (!confirm('Delete this campaign? Influencer profiles are not affected.')) return; await api('/campaigns/' + c.id, { method: 'DELETE' }); location.hash = '#/campaigns'; };
}

// ---------- import ----------
const IMPORT_FIELDS = [
	['full_name', 'Full name', ['name', 'full name', 'influencer', 'influencer name']],
	['ig_username', 'Instagram username', ['instagram', 'ig', 'ig username', 'instagram handle', 'instagram username', 'instagram link', 'ig handle']],
	['tt_username', 'TikTok username', ['tiktok', 'tt', 'tiktok username', 'tiktok handle', 'tiktok link', 'tt handle']],
	['city', 'City', ['city', 'location', 'emirate']], ['gender', 'Gender', ['gender', 'sex']], ['nationality', 'Nationality', ['nationality']],
	['languages', 'Languages', ['languages', 'language']], ['categories', 'Categories', ['categories', 'category', 'niche', 'niches']],
	['email', 'Email', ['email', 'e-mail', 'contact email']], ['whatsapp', 'WhatsApp', ['whatsapp', 'phone', 'mobile', 'number', 'phone number']],
	['agency', 'Agency', ['agency', 'management', 'management agency']], ['bio', 'Bio', ['bio', 'description']],
	['ig_followers', 'IG followers', ['ig followers', 'instagram followers', 'followers']], ['ig_er', 'IG engagement %', ['ig er', 'ig engagement', 'instagram engagement', 'engagement rate', 'er']],
	['ig_avg_views', 'IG avg Reel views', ['ig views', 'avg reel views', 'reel views', 'ig avg views']], ['ig_avg_likes', 'IG avg likes', ['ig likes', 'avg likes']], ['ig_avg_comments', 'IG avg comments', ['ig comments', 'avg comments']],
	['tt_followers', 'TikTok followers', ['tiktok followers', 'tt followers']], ['tt_er', 'TikTok engagement %', ['tiktok engagement', 'tt er', 'tt engagement']],
	['tt_avg_views', 'TikTok avg views', ['tiktok views', 'tt views', 'tt avg views']], ['tt_avg_likes', 'TikTok avg likes', ['tt likes', 'tiktok likes']], ['tt_avg_comments', 'TikTok avg comments', ['tt comments', 'tiktok comments']],
	['price_ig_reel', 'IG Reel price', ['reel', 'reel price', 'ig reel', 'instagram reel']], ['price_ig_story', 'IG Story price', ['story', 'story price', 'ig story']],
	['price_ig_post', 'IG Post price', ['post', 'post price', 'ig post']], ['price_ig_carousel', 'IG Carousel price', ['carousel', 'carousel price']],
	['price_tt_video', 'TikTok Video price', ['tiktok video', 'tt video', 'tiktok price']], ['price_tt_live', 'TikTok Live price', ['tiktok live', 'tt live']],
	['price_package', 'Package price', ['package', 'package price', 'bundle']], ['availability', 'Availability', ['availability']],
	['audience_country', 'Top audience country', ['audience country', 'audience', 'top audience']], ['audience_city', 'Top audience city', ['audience city']],
	['photo_url', 'Photo URL', ['photo', 'photo url', 'profile picture', 'image']], ['admin_notes', 'Notes', ['notes', 'comments']]
];

function parseCsv(text) {
	const rows = []; let row = []; let cur = ''; let q = false;
	text = text.replace(/^﻿/, '');
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
		else if (ch === '"') q = true;
		else if (ch === ',' || ch === ';' && !text.slice(0, 2000).includes(',')) { row.push(cur); cur = ''; }
		else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
		else cur += ch;
	}
	if (cur || row.length) { row.push(cur); rows.push(row); }
	return rows.filter((r) => r.some((c) => c.trim()));
}

function viewImport() {
	const page = shell('import', 'Import influencers', `<button class="btn ghost" id="tpl">${ICON.download} Download template</button>`, '');
	page.innerHTML = `<div style="max-width:900px" class="stack">
		<div class="banner info">Import a spreadsheet of influencers (CSV). Columns are matched automatically and you can adjust the matching. Profiles are de-duplicated by Instagram username, TikTok username and email, so you can safely re-import an updated sheet.</div>
		<label class="drop" id="drop"><input type="file" accept=".csv,text/csv" id="file" hidden><b>Choose a CSV file</b><div class="muted small" style="margin-top:6px">or drop it here. Excel / Google Sheets: File → Download → CSV.</div></label>
		<div id="step2"></div></div>`;
	$('#tpl').onclick = () => {
		const head = IMPORT_FIELDS.map((f) => f[1]);
		const ex = ['Sample Name', 'samplehandle', 'samplehandle', 'Dubai', 'Female', 'Emirati', 'Arabic, English', 'Food & Restaurants; Lifestyle', 'name@example.com', '+971500000000', '', 'Short bio', '92000', '3.4', '25000', '2100', '80', '41000', '5.1', '60000', '3000', '45', '4500', '1500', '3000', '3500', '4000', '', '9000', 'available', 'United Arab Emirates', 'Dubai', '', ''];
		const csv = '﻿' + [head, ex].map((r) => r.map((c) => (/[,"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\r\n');
		const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'rich-influencer-import-template.csv'; a.click();
	};
	const drop = $('#drop');
	drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
	drop.ondragleave = () => drop.classList.remove('over');
	drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); };
	$('#file').onchange = (e) => e.target.files[0] && readFile(e.target.files[0]);

	function readFile(file) {
		const fr = new FileReader();
		fr.onload = () => mapStep(parseCsv(String(fr.result)), file.name);
		fr.readAsText(file);
	}
	function mapStep(rows, name) {
		if (rows.length < 2) return toast('That file has no data rows.', true);
		const head = rows[0].map((h) => h.trim());
		const norm = (s) => s.toLowerCase().replace(/[^a-z0-9% ]/g, ' ').replace(/\s+/g, ' ').trim();
		const guess = head.map((h) => {
			const n = norm(h);
			const exact = IMPORT_FIELDS.find((f) => norm(f[1]) === n || f[0] === n || f[2].includes(n));
			return exact ? exact[0] : '';
		});
		const data = rows.slice(1);
		$('#step2').innerHTML = `<div class="card pad">
			<b>${esc(name)}</b> · ${data.length} rows
			<table class="t" style="margin-top:12px"><thead><tr><th>Column in your file</th><th>Example</th><th>Maps to</th></tr></thead><tbody>
			${head.map((h, i) => `<tr><td><b>${esc(h)}</b></td><td class="muted small">${esc((data.find((r) => r[i]) || [])[i] || '')}</td><td><select data-col="${i}"><option value="">Ignore</option>${IMPORT_FIELDS.map((f) => `<option value="${f[0]}" ${guess[i] === f[0] ? 'selected' : ''}>${f[1]}</option>`).join('')}</select></td></tr>`).join('')}
			</tbody></table>
			<div class="grid2" style="margin-top:16px">
				<label class="f"><span>When a profile already exists</span><select id="mode"><option value="skip">Skip it</option><option value="update">Update it with the sheet's numbers, rates and contacts</option></select></label>
				<label class="f"><span>New profiles are added as</span><select id="st"><option value="approved">Approved (searchable now)</option><option value="pending">Pending (goes to Review queue)</option></select></label>
			</div>
			<p class="muted small">Categories in the sheet must match category names in Settings (separate several with ";"). Prices are in AED. Only use data you are allowed to hold: self-reported, from management, from rate cards or from a licensed analytics tool.</p>
			<div class="row"><button class="btn" id="go">Import ${data.length} rows</button><div class="progress" style="flex:1"><div id="bar"></div></div></div>
			<div id="report"></div></div>`;
		$('#go').onclick = async () => {
			const map = $$('[data-col]').map((s) => [+s.dataset.col, s.value]).filter(([, v]) => v);
			if (!map.some(([, v]) => v === 'full_name')) return toast('Map a column to "Full name".', true);
			const objs = data.map((r, i) => { const o = { __row: i + 2 }; for (const [c, k] of map) if (r[c] != null && r[c].trim() !== '') o[k] = r[c].trim(); return o; });
			const total = { created: 0, updated: 0, skipped: 0, errors: [] };
			$('#go').disabled = true;
			for (let i = 0; i < objs.length; i += 100) {
				try {
					const r = await api('/import', { method: 'POST', body: { rows: objs.slice(i, i + 100), mode: $('#mode').value, status: $('#st').value } });
					total.created += r.created; total.updated += r.updated; total.skipped += r.skipped; total.errors.push(...r.errors);
				} catch (e) { total.errors.push({ row: `${i + 2}–${i + 101}`, error: e.message }); }
				$('#bar').style.width = Math.min(100, ((i + 100) / objs.length) * 100) + '%';
			}
			state.options = null;
			$('#report').innerHTML = `<div class="banner ok" style="margin-top:14px"><b>Import finished.</b> ${total.created} added · ${total.updated} updated · ${total.skipped} skipped (already in the database or repeated in the file).</div>
				${total.errors.length ? `<div class="banner warn" style="margin-top:8px"><b>${total.errors.length} rows not imported:</b><br>${total.errors.slice(0, 30).map((e) => `Row ${e.row}: ${esc(e.error)}`).join('<br>')}</div>` : ''}
				<div class="row" style="margin-top:10px"><a class="btn" href="#/discover?sort=newest">View in Discover</a>${$('#st').value === 'pending' ? '<a class="btn ghost" href="#/pending">Review queue</a>' : ''}</div>`;
			refreshCounts();
		};
	}
}

// ---------- settings ----------
async function viewSettings() {
	const page = shell('settings', 'Settings', '', '');
	const opts = await loadOptions(true);
	const users = isAdmin() ? (await api('/users')).users : [];
	page.innerHTML = `<div class="grid2" style="align-items:start">
		<div class="card pad"><div class="row"><b style="flex:1">Categories</b>${canEdit() ? `<button class="btn sm" id="addcat">${ICON.plus} Add category</button>` : ''}</div>
			<table class="t" style="margin-top:10px"><tbody>${opts.categories.map((c) => `<tr data-cat="${c.id}" style="${c.active ? '' : 'opacity:.5'}"><td>${esc(c.name)}</td><td class="num muted">${c.n}</td>
			<td style="text-align:right">${isAdmin() ? `<button class="btn ghost sm" data-ren>Rename</button> <button class="btn ghost sm" data-tog>${c.active ? 'Hide' : 'Show'}</button>` : ''}</td></tr>`).join('')}</tbody></table>
			<div class="faint small" style="margin-top:8px">Hidden categories stay on existing profiles but are not offered on the registration form or filters.</div></div>
		<div class="stack">
			${isAdmin() ? `<div class="card pad"><div class="row"><b style="flex:1">Team members</b><button class="btn sm" id="adduser">${ICON.plus} Add member</button></div>
			<table class="t" style="margin-top:10px"><tbody>${users.map((u) => `<tr data-user="${u.id}" style="${u.active ? '' : 'opacity:.5'}"><td><b>${esc(u.display_name)}</b><div class="faint small">${esc(u.email)}</div></td>
				<td><select data-role ${u.id === state.me.id ? 'disabled' : ''}>${['admin', 'editor', 'viewer'].map((r) => `<option ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
				<td style="text-align:right">${u.id === state.me.id ? '<span class="faint small">You</span>' : `<button class="btn ghost sm" data-pw>Reset password</button> <button class="btn ghost sm" data-act>${u.active ? 'Deactivate' : 'Activate'}</button>`}</td></tr>`).join('')}</tbody></table>
			<div class="faint small" style="margin-top:8px">Admin: everything. Editor: add, edit, approve, campaigns. Viewer: search and view only.</div></div>` : ''}
			<div class="card pad"><b>Your password</b><div class="grid2" style="margin-top:10px"><input type="password" id="pw1" placeholder="Current password"><input type="password" id="pw2" placeholder="New password (8+ characters)"></div><button class="btn sm" id="pwgo" style="margin-top:10px">Change password</button></div>
			<div class="card pad"><b>Registration page</b><p class="muted small">Share this link with influencers and management agencies. Submissions land in the Review queue automatically.</p>
			<div class="row"><input type="text" readonly value="${esc(location.origin + '/join/')}" id="jl"><button class="btn ghost sm" id="cp">Copy</button></div></div>
		</div></div>`;
	const ac = $('#addcat'); if (ac) ac.onclick = async () => { const n = await ask('New category', { label: 'Category name', ok: 'Add' }); if (!n) return; try { await api('/categories', { method: 'POST', body: { name: n } }); toast('Category added'); viewSettings(); } catch (e) { fail(e); } };
	$$('[data-cat]', page).forEach((tr) => {
		const id = tr.dataset.cat, c = opts.categories.find((x) => x.id === +id);
		const r = $('[data-ren]', tr); if (r) r.onclick = async () => { const n = await ask('Rename category', { label: 'Name', value: c.name }); if (!n) return; await api('/categories/' + id, { method: 'PATCH', body: { name: n } }); viewSettings(); };
		const t = $('[data-tog]', tr); if (t) t.onclick = async () => { await api('/categories/' + id, { method: 'PATCH', body: { active: !c.active } }); viewSettings(); };
	});
	const au = $('#adduser');
	if (au) au.onclick = () => {
		const m = modal(`<h3>Add team member</h3><div class="stack"><label class="f"><span>Name</span><input type="text" id="u1"></label><label class="f"><span>Email</span><input type="email" id="u2"></label>
			<label class="f"><span>Role</span><select id="u3"><option>editor</option><option>viewer</option><option>admin</option></select></label><label class="f"><span>Temporary password</span><input type="text" id="u4" value="${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 6)}"></label></div>
			<div class="actions"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="ugo">Add</button></div>`);
		$('#ugo', m.el).onclick = async () => { try { await api('/users', { method: 'POST', body: { display_name: $('#u1', m.el).value, email: $('#u2', m.el).value, role: $('#u3', m.el).value, password: $('#u4', m.el).value } }); m.close(); toast('Added. Share the temporary password with them.'); viewSettings(); } catch (e) { fail(e); } };
	};
	$$('[data-user]', page).forEach((tr) => {
		const id = tr.dataset.user, u = users.find((x) => x.id === +id);
		$('[data-role]', tr).onchange = async (e) => { try { await api('/users/' + id, { method: 'PATCH', body: { role: e.target.value } }); toast('Role updated'); } catch (er) { fail(er); } };
		const pw = $('[data-pw]', tr); if (pw) pw.onclick = async () => { const p = await ask('Reset password for ' + u.display_name, { label: 'New temporary password (8+ characters)' }); if (!p) return; try { await api('/users/' + id, { method: 'PATCH', body: { password: p } }); toast('Password reset'); } catch (e) { fail(e); } };
		const a = $('[data-act]', tr); if (a) a.onclick = async () => { await api('/users/' + id, { method: 'PATCH', body: { active: !u.active } }); viewSettings(); };
	});
	$('#pwgo').onclick = async () => { try { await api('/password', { method: 'POST', body: { current: $('#pw1').value, next: $('#pw2').value } }); toast('Password changed'); $('#pw1').value = $('#pw2').value = ''; } catch (e) { fail(e); } };
	$('#cp').onclick = () => { navigator.clipboard.writeText($('#jl').value); toast('Link copied'); };
}

// ---------- router ----------
async function route() {
	$('.tray')?.remove();
	if (!state.me) return authScreen();
	const h = location.hash.replace(/^#/, '') || '/';
	const path = h.split('?')[0];
	const seg = path.split('/').filter(Boolean);
	try {
		if (!seg.length) await viewHome();
		else if (seg[0] === 'discover') { await viewDiscover(); }
		else if (seg[0] === 'influencer' && seg[1]) await viewInfluencer(seg[1]);
		else if (seg[0] === 'compare') await viewCompare();
		else if (seg[0] === 'pending') await viewPending();
		else if (seg[0] === 'campaigns') await viewCampaigns();
		else if (seg[0] === 'campaign' && seg[1]) await viewCampaign(seg[1]);
		else if (seg[0] === 'import' && canEdit()) viewImport();
		else if (seg[0] === 'settings') await viewSettings();
		else location.hash = '#/';
	} catch (e) { if (state.me) fail(e); }
	if (seg[0] === 'discover') renderTray();
}
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); route(); });

async function boot() {
	try {
		const r = await api('/me');
		state.me = r.user; state.counts = r.counts;
	} catch { state.me = null; }
	route();
}
boot();
})();
