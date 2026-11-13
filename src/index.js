import {
	hashPassword, verifyPassword, createTeamSession, readTeamSession, createInfSession, readInfSession,
	cookie, clearCookie, TEAM_COOKIE, INF_COOKIE, newToken
} from './auth.js';
import {
	cleanPatch, derive, findDuplicates, cleanLanguages, handle, digits, cleanEmail, num, rate,
	WRITABLE, SELF_EDITABLE, REVIEW, FIELD_LABELS, TIERS, CITIES, PRICE_FIELDS, STATUSES
} from './model.js';
import { notify, sendEmail, esc } from './notify.js';
import { runSeed } from './seed.js';

const now = () => Date.now();
const ROLES = ['admin', 'editor', 'viewer'];
const canEdit = (s) => s && (s.role === 'admin' || s.role === 'editor');
const isAdmin = (s) => s && s.role === 'admin';
const PAGE = 60;

const json = (data, status = 200, headers = {}) =>
	new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const err = (message, status = 400, extra = {}) => json({ error: message, ...extra }, status);
async function body(request) {
	try { return await request.json(); } catch { return {}; }
}
const parse = (s, d = null) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const ids = (v) => String(v || '').split(',').map((x) => parseInt(x, 10)).filter((x) => x > 0);
const list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);

// ---------- throttling ----------
async function throttled(env, key, max, windowMs) {
	const since = now() - windowMs;
	const r = await env.DB.prepare('SELECT COUNT(*) n FROM throttle WHERE k = ? AND at > ?').bind(key, since).first();
	if (r.n >= max) return true;
	await env.DB.batch([
		env.DB.prepare('INSERT INTO throttle (k, at) VALUES (?, ?)').bind(key, now()),
		env.DB.prepare('DELETE FROM throttle WHERE at < ?').bind(now() - 86400000)
	]);
	return false;
}
const ipOf = (req) => req.headers.get('CF-Connecting-IP') || 'local';

// ---------- presentation ----------
function photoOf(r) {
	if (r.photo_key) return '/media/' + r.photo_key;
	return r.photo_url || '';
}
function present(r, cats = []) {
	return {
		...r,
		languages: parse(r.languages, []),
		photo: photoOf(r),
		ig_url: r.ig_username ? `https://www.instagram.com/${r.ig_username}/` : '',
		tt_url: r.tt_username ? `https://www.tiktok.com/@${r.tt_username}` : '',
		categories: cats
	};
}
async function categoriesFor(env, idList) {
	const map = new Map(idList.map((i) => [i, []]));
	if (!idList.length) return map;
	const { results } = await env.DB.prepare(
		`SELECT ic.influencer_id iid, c.id, c.name, ic.is_primary FROM influencer_categories ic JOIN categories c ON c.id = ic.category_id
		 WHERE ic.influencer_id IN (${idList.map((x) => +x).join(',')}) ORDER BY ic.is_primary DESC, c.sort`
	).all();
	for (const r of results) map.get(r.iid)?.push({ id: r.id, name: r.name, primary: !!r.is_primary });
	return map;
}

// ---------- write helpers ----------
async function loadInf(env, id) {
	return env.DB.prepare('SELECT * FROM influencers WHERE id = ?').bind(id).first();
}

function catStatements(env, id, catIds, primary) {
	const clean = [...new Set((catIds || []).map((x) => +x).filter((x) => x > 0))].slice(0, 12);
	if (primary && !clean.includes(+primary)) clean.unshift(+primary);
	const st = [env.DB.prepare('DELETE FROM influencer_categories WHERE influencer_id = ?').bind(id)];
	for (const c of clean) st.push(env.DB.prepare('INSERT OR IGNORE INTO influencer_categories (influencer_id, category_id, is_primary) VALUES (?, ?, ?)').bind(id, c, c === +primary ? 1 : 0));
	return st;
}

// Merge a cleaned patch into an existing row, recompute derived fields, persist.
async function applyPatch(env, id, patch, { categories, primary, extra = {} } = {}) {
	const cur = await loadInf(env, id);
	if (!cur) throw new Error('not found');
	const merged = { ...cur, ...patch, ...extra };
	const statsTouched = Object.keys(patch).some((k) => /_(followers|er|avg_)/.test(k));
	const set = { ...patch, ...extra, ...derive(merged), updated_at: now() };
	if (statsTouched) set.stats_updated_at = now();
	const cols = Object.keys(set);
	const stmts = [env.DB.prepare(`UPDATE influencers SET ${cols.map((c) => c + ' = ?').join(', ')} WHERE id = ?`).bind(...cols.map((c) => set[c]), id)];
	if (categories) stmts.push(...catStatements(env, id, categories, primary));
	await env.DB.batch(stmts);
	return { ...merged, ...set };
}

async function insertInf(env, patch, { status, source, categories, primary, extra = {} }) {
	const t = now();
	const row = { ...patch, ...extra, status, source, created_at: t, updated_at: t };
	if (!row.full_name) throw new Error('Full name is required.');
	if (row.languages === undefined) row.languages = '[]';
	Object.assign(row, derive(row));
	if (status === 'approved') row.approved_at = t;
	const cols = Object.keys(row);
	const r = await env.DB.prepare(`INSERT INTO influencers (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')}) RETURNING id`).bind(...cols.map((c) => row[c])).first();
	if (categories && categories.length) await env.DB.batch(catStatements(env, r.id, categories, primary));
	return r.id;
}

const log = (env, iid, by, action, detail = '') =>
	env.DB.prepare('INSERT INTO activity (influencer_id, at, by_name, action, detail) VALUES (?, ?, ?, ?, ?)').bind(iid, now(), by, action, detail).run();

async function storePhoto(env, file, prefix) {
	if (!file || typeof file === 'string' || !file.size) return null;
	const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
	const ext = types[file.type];
	if (!ext) throw new Error('Profile picture must be JPG, PNG or WEBP.');
	if (file.size > 5 * 1024 * 1024) throw new Error('Profile picture must be under 5 MB.');
	const key = `photos/${prefix}-${newToken().slice(0, 12)}.${ext}`;
	await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' } });
	return key;
}

// ---------- search ----------
const DELIVERABLES = {
	ig_reel: 'price_ig_reel', ig_story: 'price_ig_story', ig_post: 'price_ig_post', ig_carousel: 'price_ig_carousel',
	tt_video: 'price_tt_video', tt_live: 'price_tt_live', package: 'price_package'
};
const BIG = 1e12;

function buildSearch(p, team) {
	const where = [];
	const b = [];
	const platform = ['ig', 'tt'].includes(p.get('platform')) ? p.get('platform') : 'any';

	const statuses = list(p.get('status')).filter((x) => STATUSES.includes(x));
	if (team && statuses.length) where.push(`i.status IN (${statuses.map(() => '?').join(',')})`) && b.push(...statuses);
	else where.push("i.status = 'approved'");

	const q = (p.get('q') || '').trim().toLowerCase().replace(/^@/, '');
	if (q) where.push('(i.search_text LIKE ? OR i.full_name LIKE ?)') && b.push(`%${q}%`, `%${q}%`);

	const cities = list(p.get('city'));
	if (cities.length) {
		const known = cities.filter((c) => c !== 'other');
		const parts = [];
		if (known.length) parts.push(`i.city IN (${known.map(() => '?').join(',')})`) && b.push(...known);
		if (cities.includes('other')) parts.push(`(i.city IS NULL OR i.city NOT IN (${CITIES.map(() => '?').join(',')}))`) && b.push(...CITIES);
		where.push('(' + parts.join(' OR ') + ')');
	}
	const cats = ids(p.get('category'));
	if (cats.length) where.push(`i.id IN (SELECT influencer_id FROM influencer_categories WHERE category_id IN (${cats.join(',')}))`);

	const genders = list(p.get('gender'));
	if (genders.length) where.push(`i.gender IN (${genders.map(() => '?').join(',')})`) && b.push(...genders);

	const langs = cleanLanguages(p.get('language') || '');
	if (langs.length) where.push(`EXISTS (SELECT 1 FROM json_each(i.languages) WHERE value IN (${langs.map(() => '?').join(',')}))`) && b.push(...langs);

	const nats = list(p.get('nationality')).map((x) => x.toLowerCase());
	if (nats.length) where.push(`lower(i.nationality) IN (${nats.map(() => '?').join(',')})`) && b.push(...nats);

	const aud = (p.get('audience') || '').trim().toLowerCase();
	if (aud) where.push('(lower(i.audience_country) LIKE ? OR lower(i.audience_city) LIKE ?)') && b.push(`%${aud}%`, `%${aud}%`);

	const tiers = list(p.get('tier')).filter((t) => TIERS.some((x) => x.key === t));
	if (tiers.length) where.push(`i.tier IN (${tiers.map(() => '?').join(',')})`) && b.push(...tiers);

	const avail = list(p.get('availability'));
	if (avail.length) where.push(`i.availability IN (${avail.map(() => '?').join(',')})`) && b.push(...avail);

	if (platform === 'ig') where.push('i.ig_username IS NOT NULL');
	if (platform === 'tt') where.push('i.tt_username IS NOT NULL');

	// Platform-aware numeric ranges: on "any", a match on either platform counts.
	const plats = platform === 'any' ? ['ig', 'tt'] : [platform];
	const range = (col, min, max) => {
		const parts = plats.map((pl) => {
			const c = `i.${pl}_${col}`;
			const conds = [];
			if (min != null) conds.push(`${c} >= ?`) && b.push(min);
			if (max != null) conds.push(`${c} <= ?`) && b.push(max);
			return '(' + conds.join(' AND ') + ')';
		});
		where.push('(' + parts.join(' OR ') + ')');
	};
	const fmin = num(p.get('fmin')), fmax = num(p.get('fmax'));
	if (fmin != null || fmax != null) range('followers', fmin, fmax);
	const ermin = rate(p.get('ermin')), ermax = rate(p.get('ermax'));
	if (ermin != null || ermax != null) range('er', ermin, ermax);
	const vmin = num(p.get('vmin'));
	if (vmin != null) range('avg_views', vmin, null);

	// Price: one deliverable, or any deliverable on the chosen platform.
	const deliv = DELIVERABLES[p.get('deliverable')];
	let priceCols = deliv ? [deliv] : PRICE_FIELDS.filter((f) => f !== 'price_package' && (platform === 'any' || f.startsWith('price_' + platform)));
	const pmin = num(p.get('pmin')), pmax = num(p.get('pmax'));
	if (pmin != null || pmax != null) {
		where.push('(' + priceCols.map((c) => {
			const conds = [`i.${c} IS NOT NULL`];
			if (pmin != null) conds.push(`i.${c} >= ?`) && b.push(pmin);
			if (pmax != null) conds.push(`i.${c} <= ?`) && b.push(pmax);
			return '(' + conds.join(' AND ') + ')';
		}).join(' OR ') + ')');
	}
	if (p.get('has_price') === '1') where.push('(' + priceCols.map((c) => `i.${c} IS NOT NULL`).join(' OR ') + ')');
	if (p.get('has_contact') === '1') where.push('(i.email IS NOT NULL OR i.whatsapp IS NOT NULL)');

	// Sorting
	const dir = p.get('dir') === 'asc' ? 'ASC' : 'DESC';
	const pick = (col) => (platform === 'any' ? `max(COALESCE(i.ig_${col},-1), COALESCE(i.tt_${col},-1))` : `COALESCE(i.${platform}_${col},-1)`);
	const priceExpr = priceCols.length === 1 ? `COALESCE(i.${priceCols[0]}, ${BIG})` : `min(${priceCols.map((c) => `COALESCE(i.${c}, ${BIG})`).join(',')})`;
	const sorts = {
		followers: `${pick('followers')} ${dir}`,
		er: `${pick('er')} ${dir}`,
		views: `${pick('avg_views')} ${dir}`,
		// No-price rows always last, whichever direction.
		price: `(${priceExpr} = ${BIG}) ASC, ${priceExpr} ${p.get('dir') === 'desc' ? 'DESC' : 'ASC'}`,
		newest: `i.created_at ${dir}`,
		updated: `i.updated_at ${dir}`,
		name: `i.full_name COLLATE NOCASE ${p.get('dir') === 'desc' ? 'DESC' : 'ASC'}`
	};
	const order = (sorts[p.get('sort')] || sorts.followers) + ', i.id DESC';
	return { where: where.join(' AND '), binds: b, order };
}

async function search(env, p, team, limit = PAGE) {
	const { where, binds, order } = buildSearch(p, team);
	const page = Math.max(1, parseInt(p.get('page') || '1', 10));
	const [rows, count] = await Promise.all([
		env.DB.prepare(`SELECT i.* FROM influencers i WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...binds, limit, (page - 1) * limit).all(),
		env.DB.prepare(`SELECT COUNT(*) n FROM influencers i WHERE ${where}`).bind(...binds).first()
	]);
	const cats = await categoriesFor(env, rows.results.map((r) => r.id));
	return { total: count.n, page, pages: Math.ceil(count.n / limit), results: rows.results.map((r) => present(r, cats.get(r.id))) };
}

// ---------- CSV ----------
const CSV_COLS = [
	['id', 'ID'], ['status', 'Status'], ['full_name', 'Full name'], ['city', 'City'], ['gender', 'Gender'], ['nationality', 'Nationality'],
	['languages', 'Languages'], ['categories', 'Categories'], ['tier', 'Tier'], ['email', 'Email'], ['whatsapp', 'WhatsApp'], ['agency', 'Agency'],
	['ig_username', 'Instagram username'], ['ig_url', 'Instagram link'], ['ig_followers', 'IG followers'], ['ig_er', 'IG engagement %'],
	['ig_avg_views', 'IG avg Reel views'], ['ig_avg_likes', 'IG avg likes'], ['ig_avg_comments', 'IG avg comments'],
	['tt_username', 'TikTok username'], ['tt_url', 'TikTok link'], ['tt_followers', 'TikTok followers'], ['tt_er', 'TikTok engagement %'],
	['tt_avg_views', 'TikTok avg views'], ['tt_avg_likes', 'TikTok avg likes'], ['tt_avg_comments', 'TikTok avg comments'],
	['price_ig_reel', 'IG Reel (AED)'], ['price_ig_story', 'IG Story (AED)'], ['price_ig_post', 'IG Post (AED)'], ['price_ig_carousel', 'IG Carousel (AED)'],
	['price_tt_video', 'TikTok Video (AED)'], ['price_tt_live', 'TikTok Live (AED)'], ['price_package', 'Package (AED)'],
	['availability', 'Availability'], ['audience_country', 'Top audience country'], ['audience_city', 'Top audience city']
];
function toCsv(rows, cols, extraCols = []) {
	const all = [...cols, ...extraCols];
	const cell = (v) => {
		if (v == null) return '';
		if (Array.isArray(v)) v = v.map((x) => (typeof x === 'object' ? x.name : x)).join('; ');
		const s = String(v);
		return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	};
	return '﻿' + [all.map((c) => cell(c[1])).join(','), ...rows.map((r) => all.map((c) => cell(r[c[0]])).join(','))].join('\r\n');
}
const csvResponse = (text, name) =>
	new Response(text, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' } });

// ---------- registration / influencer self-service ----------
async function readForm(request) {
	const ct = request.headers.get('Content-Type') || '';
	if (ct.includes('multipart/form-data')) {
		const fd = await request.formData();
		return { data: parse(fd.get('data'), {}), photo: fd.get('photo'), password: fd.get('password'), website: fd.get('website') };
	}
	const b = await body(request);
	return { data: b.data || {}, password: b.password, photo: null, website: b.website };
}

function validateRegistration(d) {
	const errors = {};
	if (!d.full_name) errors.full_name = 'Enter your full name.';
	if (!d.email) errors.email = 'Enter a valid email address.';
	if (!d.whatsapp) errors.whatsapp = 'Enter your phone / WhatsApp number.';
	if (!d.city) errors.city = 'Choose your city.';
	if (!d.ig_username && !d.tt_username) errors.ig_username = 'Add at least one Instagram or TikTok username.';
	return errors;
}

async function publicApi(request, env, ctx, url, path) {
	const method = request.method;
	const secure = url.protocol === 'https:';

	if (path === '/options' && method === 'GET') {
		const { results } = await env.DB.prepare('SELECT id, name FROM categories WHERE active = 1 ORDER BY sort, name').all();
		return json({ categories: results, cities: CITIES });
	}

	if (path === '/register' && method === 'POST') {
		const f = await readForm(request);
		if (f.website) return json({ ok: true }); // honeypot
		if (await throttled(env, 'reg:' + ipOf(request), 8, 3600000)) return err('Too many registrations from this connection. Try again in an hour.', 429);
		const raw = f.data || {};
		if (!raw.consent) return err('Please accept the consent statement to register.', 400, { fields: { consent: 'Required' } });
		const password = String(f.password || '');
		if (password.length < 8) return err('Choose a password of at least 8 characters.', 400, { fields: { password: 'At least 8 characters' } });
		const d = cleanPatch(raw, SELF_EDITABLE);
		const fields = validateRegistration(d);
		if (Object.keys(fields).length) return err('Please check the highlighted fields.', 400, { fields });

		const existingAcc = await env.DB.prepare('SELECT id FROM accounts WHERE email = ?').bind(d.email).first();
		if (existingAcc) return err('This email is already registered. Log in to update your profile.', 409, { login: true });

		const dups = await findDuplicates(env, d);
		const claimed = [];
		for (const x of dups) {
			const acc = await env.DB.prepare('SELECT id FROM accounts WHERE influencer_id = ?').bind(x.id).first();
			if (acc) claimed.push(x);
		}
		if (claimed.length) return err('A profile with this Instagram, TikTok or phone number is already registered. Log in with the email you used, or contact RICH.', 409, { login: true });

		let photoKey = null;
		try { photoKey = await storePhoto(env, f.photo, 'reg'); } catch (e) { return err(e.message, 400, { fields: { photo: e.message } }); }

		const cats = (raw.categories || []).map(Number);
		const extra = { consent_at: now(), price_source: PRICE_FIELDS.some((k) => d[k]) ? 'influencer' : null };
		if (photoKey) extra.photo_key = photoKey;
		if (dups.length) {
			extra.duplicate_of = dups[0].id;
			extra.duplicate_reason = dups[0].reasons.join(', ');
		}
		const iid = await insertInf(env, d, { status: 'pending', source: 'registration', categories: cats, primary: +raw.primary_category || cats[0], extra });
		const h = await hashPassword(password);
		const acc = await env.DB.prepare('INSERT INTO accounts (email, pass_hash, pass_salt, influencer_id, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id')
			.bind(d.email, h.hash, h.salt, iid, now()).first();
		await log(env, iid, d.full_name, 'registered', dups.length ? `Possible duplicate of #${dups[0].id} (${extra.duplicate_reason})` : '');
		const handles = [d.ig_username && 'IG @' + d.ig_username, d.tt_username && 'TikTok @' + d.tt_username].filter(Boolean).join(' · ');
		await notify(env, ctx, {
			kind: 'registration',
			title: `New influencer registration: ${d.full_name}`,
			body: [d.city, handles, dups.length ? `Possible duplicate of ${dups[0].full_name}` : ''].filter(Boolean).join('\n'),
			link: `/#/influencer/${iid}`
		});
		const token = await createInfSession(env, acc.id);
		return json({ ok: true, id: iid }, 200, { 'Set-Cookie': cookie(INF_COOKIE, token, secure) });
	}

	if (path === '/login' && method === 'POST') {
		const { email, password } = await body(request);
		if (await throttled(env, 'ilogin:' + ipOf(request), 20, 900000)) return err('Too many attempts. Try again in 15 minutes.', 429);
		const a = await env.DB.prepare('SELECT * FROM accounts WHERE email = ?').bind(cleanEmail(email) || '').first();
		if (!a || !(await verifyPassword(String(password || ''), a.pass_salt, a.pass_hash))) return err('Email or password is incorrect.', 401);
		const token = await createInfSession(env, a.id);
		return json({ ok: true }, 200, { 'Set-Cookie': cookie(INF_COOKIE, token, secure) });
	}

	const s = await readInfSession(env, request);
	if (path === '/logout' && method === 'POST') {
		if (s) await env.DB.prepare('DELETE FROM account_sessions WHERE token = ?').bind(s.token).run();
		return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(INF_COOKIE, secure) });
	}
	if (!s) return err('Please log in.', 401);
	if (!s.iid) return err('Your profile was removed. Contact RICH.', 404);
	const inf = await loadInf(env, s.iid);
	if (!inf) return err('Profile not found.', 404);

	if (path === '/me' && method === 'GET') {
		const cats = await categoriesFor(env, [inf.id]);
		const pend = await env.DB.prepare("SELECT data, photo_key, created_at FROM profile_updates WHERE influencer_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1").bind(inf.id).first();
		const p = present(inf, cats.get(inf.id));
		const safe = {};
		for (const k of [...SELF_EDITABLE, 'id', 'status', 'info_request', 'photo', 'ig_url', 'tt_url', 'categories', 'languages', 'created_at', 'updated_at']) safe[k] = p[k];
		if (inf.status === 'rejected') safe.reject_reason = inf.reject_reason;
		return json({
			profile: safe,
			pending_update: pend ? { fields: Object.keys(parse(pend.data, {})).map((k) => FIELD_LABELS[k] || k).concat(pend.photo_key ? ['Profile picture'] : []), at: pend.created_at } : null
		});
	}

	if (path === '/me' && method === 'PUT') {
		const f = await readForm(request);
		const raw = f.data || {};
		const d = cleanPatch(raw, SELF_EDITABLE);
		const merged = { ...inf, ...d };
		const fields = validateRegistration(merged);
		if (Object.keys(fields).length) return err('Please check the highlighted fields.', 400, { fields });
		if (d.email && d.email !== inf.email) {
			const taken = await env.DB.prepare('SELECT id FROM accounts WHERE email = ? AND id != ?').bind(d.email, s.aid).first();
			if (taken) return err('That email belongs to another account.', 409, { fields: { email: 'Already in use' } });
		}
		let photoKey = null;
		try { photoKey = await storePhoto(env, f.photo, 'inf' + inf.id); } catch (e) { return err(e.message, 400, { fields: { photo: e.message } }); }
		const catIds = Array.isArray(raw.categories) ? raw.categories.map(Number) : null;
		const primary = +raw.primary_category || (catIds && catIds[0]);

		if (inf.status !== 'approved') {
			// Not live yet: apply everything; a resubmission goes back into the review queue.
			const extra = {};
			if (photoKey) extra.photo_key = photoKey;
			if (inf.status === 'info_requested' || inf.status === 'rejected') extra.status = 'pending';
			await applyPatch(env, inf.id, d, { categories: catIds, primary, extra });
			if (d.email) await env.DB.prepare('UPDATE accounts SET email = ? WHERE id = ?').bind(d.email, s.aid).run();
			await log(env, inf.id, inf.full_name, 'self-updated', extra.status ? 'Resubmitted for review' : '');
			if (extra.status) await notify(env, ctx, { kind: 'resubmitted', title: `${merged.full_name} updated their registration`, body: 'Ready for review again.', link: `/#/influencer/${inf.id}` });
			return json({ ok: true, review: false });
		}

		// Live profile: split into instant changes and changes that need review.
		const direct = {};
		const review = {};
		for (const [k, v] of Object.entries(d)) {
			if (String(v ?? '') === String(inf[k] ?? '')) continue;
			(REVIEW.has(k) ? review : direct)[k] = v;
		}
		if (catIds) {
			const cur = (await categoriesFor(env, [inf.id])).get(inf.id);
			const curIds = cur.map((c) => c.id).sort().join(',');
			const curPrimary = (cur.find((c) => c.primary) || {}).id;
			if ([...new Set(catIds)].sort().join(',') !== curIds || +primary !== +curPrimary) review.categories = { ids: catIds, primary };
		}
		if (Object.keys(direct).length) {
			await applyPatch(env, inf.id, direct);
			if (direct.email) await env.DB.prepare('UPDATE accounts SET email = ? WHERE id = ?').bind(direct.email, s.aid).run();
			await log(env, inf.id, inf.full_name, 'self-updated', Object.keys(direct).map((k) => FIELD_LABELS[k] || k).join(', '));
		}
		const needsReview = Object.keys(review).length || photoKey;
		if (needsReview) {
			const prev = await env.DB.prepare("SELECT id, data, photo_key FROM profile_updates WHERE influencer_id = ? AND status = 'pending'").bind(inf.id).first();
			const data = { ...(prev ? parse(prev.data, {}) : {}), ...review };
			const pk = photoKey || (prev && prev.photo_key) || null;
			if (prev) await env.DB.prepare('UPDATE profile_updates SET data = ?, photo_key = ?, created_at = ? WHERE id = ?').bind(JSON.stringify(data), pk, now(), prev.id).run();
			else await env.DB.prepare('INSERT INTO profile_updates (influencer_id, data, photo_key, created_at) VALUES (?, ?, ?, ?)').bind(inf.id, JSON.stringify(data), pk, now()).run();
			const labels = Object.keys(review).map((k) => FIELD_LABELS[k] || k).concat(photoKey ? ['Profile picture'] : []);
			await notify(env, ctx, { kind: 'profile_update', title: `${inf.full_name} submitted profile changes`, body: labels.join(', '), link: '/#/pending' });
		}
		return json({ ok: true, review: !!needsReview });
	}

	if (path === '/password' && method === 'POST') {
		const { current, next } = await body(request);
		const a = await env.DB.prepare('SELECT * FROM accounts WHERE id = ?').bind(s.aid).first();
		if (!(await verifyPassword(String(current || ''), a.pass_salt, a.pass_hash))) return err('Current password is incorrect.', 403);
		if (String(next || '').length < 8) return err('New password must be at least 8 characters.');
		const h = await hashPassword(String(next));
		await env.DB.batch([
			env.DB.prepare('UPDATE accounts SET pass_hash = ?, pass_salt = ? WHERE id = ?').bind(h.hash, h.salt, s.aid),
			env.DB.prepare('DELETE FROM account_sessions WHERE account_id = ? AND token != ?').bind(s.aid, s.token)
		]);
		return json({ ok: true });
	}
	return err('Not found.', 404);
}

// ---------- team API ----------
async function teamApi(request, env, ctx, url, path) {
	const method = request.method;
	const secure = url.protocol === 'https:';
	const seg = path.split('/').filter(Boolean);

	if (path === '/setup' && method === 'GET') {
		const r = await env.DB.prepare('SELECT COUNT(*) n FROM users').first();
		return json({ needed: r.n === 0 });
	}
	if (path === '/setup' && method === 'POST') {
		const r = await env.DB.prepare('SELECT COUNT(*) n FROM users').first();
		if (r.n > 0) return err('Setup is already complete.', 403);
		const b = await body(request);
		if (env.SETUP_KEY && b.setup_key !== env.SETUP_KEY) return err('Setup key is incorrect.', 403);
		const email = cleanEmail(b.email);
		if (!email || !b.display_name || String(b.password || '').length < 8) return err('Enter a name, a valid email and a password of 8+ characters.');
		const h = await hashPassword(String(b.password));
		const u = await env.DB.prepare("INSERT INTO users (email, display_name, role, pass_hash, pass_salt, created_at) VALUES (?, ?, 'admin', ?, ?, ?) RETURNING id")
			.bind(email, String(b.display_name).trim().slice(0, 120), h.hash, h.salt, now()).first();
		const token = await createTeamSession(env, u.id);
		return json({ ok: true }, 200, { 'Set-Cookie': cookie(TEAM_COOKIE, token, secure) });
	}
	if (path === '/login' && method === 'POST') {
		if (await throttled(env, 'tlogin:' + ipOf(request), 20, 900000)) return err('Too many attempts. Try again in 15 minutes.', 429);
		const { email, password } = await body(request);
		const u = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(cleanEmail(email) || '').first();
		if (!u || !u.active || !(await verifyPassword(String(password || ''), u.pass_salt, u.pass_hash))) return err('Email or password is incorrect.', 401);
		const token = await createTeamSession(env, u.id);
		await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now()).run();
		return json({ ok: true }, 200, { 'Set-Cookie': cookie(TEAM_COOKIE, token, secure) });
	}

	const s = await readTeamSession(env, request);
	if (path === '/logout' && method === 'POST') {
		if (s) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(s.token).run();
		return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(TEAM_COOKIE, secure) });
	}
	if (!s) return err('Please sign in.', 401);
	const editOnly = () => (canEdit(s) ? null : err('Your role is view-only.', 403));

	if (path === '/me' && method === 'GET') {
		const [p, u, n] = await Promise.all([
			env.DB.prepare("SELECT COUNT(*) n FROM influencers WHERE status IN ('pending','info_requested')").first(),
			env.DB.prepare("SELECT COUNT(*) n FROM profile_updates WHERE status = 'pending'").first(),
			env.DB.prepare('SELECT COUNT(*) n FROM notifications WHERE created_at > ?').bind(s.seen).first()
		]);
		return json({ user: { id: s.uid, name: s.name, email: s.email, role: s.role }, counts: { pending: p.n, updates: u.n, unread: n.n } });
	}
	if (path === '/password' && method === 'POST') {
		const { current, next } = await body(request);
		const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(s.uid).first();
		if (!(await verifyPassword(String(current || ''), u.pass_salt, u.pass_hash))) return err('Current password is incorrect.', 403);
		if (String(next || '').length < 8) return err('New password must be at least 8 characters.');
		const h = await hashPassword(String(next));
		await env.DB.batch([
			env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?').bind(h.hash, h.salt, s.uid),
			env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').bind(s.uid, s.token)
		]);
		return json({ ok: true });
	}

	// ----- options & overview -----
	if (path === '/options' && method === 'GET') {
		const [cats, langs, nats, auds] = await Promise.all([
			env.DB.prepare('SELECT c.id, c.name, c.active, c.sort, (SELECT COUNT(*) FROM influencer_categories ic JOIN influencers i ON i.id = ic.influencer_id WHERE ic.category_id = c.id AND i.status = \'approved\') n FROM categories c ORDER BY c.sort, c.name').all(),
			env.DB.prepare("SELECT value, COUNT(*) n FROM influencers, json_each(influencers.languages) WHERE status = 'approved' GROUP BY value ORDER BY n DESC LIMIT 60").all(),
			env.DB.prepare("SELECT nationality value, COUNT(*) n FROM influencers WHERE status = 'approved' AND nationality IS NOT NULL GROUP BY lower(nationality) ORDER BY n DESC LIMIT 80").all(),
			env.DB.prepare("SELECT audience_country value, COUNT(*) n FROM influencers WHERE status = 'approved' AND audience_country IS NOT NULL GROUP BY lower(audience_country) ORDER BY n DESC LIMIT 40").all()
		]);
		return json({ categories: cats.results, languages: langs.results, nationalities: nats.results, audiences: auds.results, cities: CITIES, tiers: TIERS.map((t) => ({ key: t.key, label: t.label, min: t.min, max: t.max === Infinity ? null : t.max })) });
	}
	if (path === '/overview' && method === 'GET') {
		const [tot, byCity, byTier, byCat, recent] = await Promise.all([
			env.DB.prepare("SELECT COUNT(*) n, SUM(ig_username IS NOT NULL) ig, SUM(tt_username IS NOT NULL) tt, SUM(min_price IS NOT NULL) priced FROM influencers WHERE status = 'approved'").first(),
			env.DB.prepare("SELECT COALESCE(city,'Unknown') k, COUNT(*) n FROM influencers WHERE status = 'approved' GROUP BY k ORDER BY n DESC").all(),
			env.DB.prepare("SELECT COALESCE(tier,'unknown') k, COUNT(*) n FROM influencers WHERE status = 'approved' GROUP BY k").all(),
			env.DB.prepare("SELECT c.name k, COUNT(*) n FROM influencer_categories ic JOIN categories c ON c.id = ic.category_id JOIN influencers i ON i.id = ic.influencer_id WHERE i.status = 'approved' GROUP BY c.id ORDER BY n DESC LIMIT 12").all(),
			env.DB.prepare('SELECT id, kind, title, body, link, created_at FROM notifications ORDER BY id DESC LIMIT 8').all()
		]);
		return json({ totals: tot, by_city: byCity.results, by_tier: byTier.results, by_category: byCat.results, recent: recent.results });
	}

	// ----- notifications -----
	if (path === '/notifications' && method === 'GET') {
		const { results } = await env.DB.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 50').all();
		return json({ notifications: results, seen: s.seen });
	}
	if (path === '/notifications/seen' && method === 'POST') {
		await env.DB.prepare('UPDATE users SET notif_seen_at = ? WHERE id = ?').bind(now(), s.uid).run();
		return json({ ok: true });
	}

	// ----- directory -----
	if (path === '/influencers' && method === 'GET') return json(await search(env, url.searchParams, true));
	if (path === '/influencers/export' && method === 'GET') {
		const r = await search(env, url.searchParams, true, 5000);
		return csvResponse(toCsv(r.results, CSV_COLS), `rich-influencers-${new Date().toISOString().slice(0, 10)}.csv`);
	}
	if (path === '/influencers/compare' && method === 'GET') {
		const list2 = ids(url.searchParams.get('ids')).slice(0, 6);
		if (!list2.length) return json({ results: [] });
		const { results } = await env.DB.prepare(`SELECT * FROM influencers WHERE id IN (${list2.join(',')})`).all();
		const cats = await categoriesFor(env, list2);
		const byId = new Map(results.map((r) => [r.id, present(r, cats.get(r.id))]));
		return json({ results: list2.map((i) => byId.get(i)).filter(Boolean) });
	}
	if (path === '/influencers' && method === 'POST') {
		const e = editOnly(); if (e) return e;
		const b = await body(request);
		const d = cleanPatch(b.data || {});
		if (!d.full_name) return err('Full name is required.');
		const dups = await findDuplicates(env, d);
		if (dups.length && !b.force) return err('A matching profile already exists.', 409, { duplicates: dups });
		const extra = {};
		if (PRICE_FIELDS.some((k) => d[k]) && !d.price_source) extra.price_source = 'team';
		const iid = await insertInf(env, d, { status: b.status === 'pending' ? 'pending' : 'approved', source: 'manual', categories: b.categories, primary: b.primary_category, extra: { ...extra, approved_by: s.name } });
		await log(env, iid, s.name, 'created');
		return json({ id: iid });
	}

	if (seg[0] === 'influencers' && seg[1] && /^\d+$/.test(seg[1])) {
		const id = +seg[1];
		const inf = await loadInf(env, id);
		if (!inf) return err('Influencer not found.', 404);

		if (!seg[2] && method === 'GET') {
			const [cats, camps, act, updates, acc] = await Promise.all([
				categoriesFor(env, [id]),
				env.DB.prepare('SELECT c.id, c.name, c.client, c.status cstatus, ci.status, ci.agreed_price FROM campaign_influencers ci JOIN campaigns c ON c.id = ci.campaign_id WHERE ci.influencer_id = ? ORDER BY c.updated_at DESC').bind(id).all(),
				env.DB.prepare('SELECT * FROM activity WHERE influencer_id = ? ORDER BY id DESC LIMIT 40').bind(id).all(),
				env.DB.prepare("SELECT * FROM profile_updates WHERE influencer_id = ? AND status = 'pending'").bind(id).all(),
				env.DB.prepare('SELECT email, created_at FROM accounts WHERE influencer_id = ?').bind(id).first()
			]);
			const dups = await findDuplicates(env, inf, id);
			return json({
				influencer: present(inf, cats.get(id)),
				campaigns: camps.results,
				activity: act.results,
				updates: updates.results.map((u) => updateView(u, inf)),
				duplicates: dups,
				account: acc
			});
		}
		if (!seg[2] && method === 'PUT') {
			const e = editOnly(); if (e) return e;
			const b = await body(request);
			const d = cleanPatch(b.data || {});
			const merged = { ...inf, ...d };
			const dups = await findDuplicates(env, merged, id);
			const hard = dups.filter((x) => x.status === 'approved' && x.reasons.some((r) => r.startsWith('Instagram') || r.startsWith('TikTok')));
			if (hard.length && !b.force) return err(`${hard[0].full_name} already uses ${hard[0].reasons[0]}.`, 409, { duplicates: hard });
			if (PRICE_FIELDS.some((k) => k in d && d[k] !== inf[k]) && !('price_source' in d)) d.price_source = 'team';
			await applyPatch(env, id, d, { categories: Array.isArray(b.categories) ? b.categories : null, primary: b.primary_category });
			const changed = Object.keys(d).filter((k) => String(d[k] ?? '') !== String(inf[k] ?? ''));
			if (changed.length || b.categories) await log(env, id, s.name, 'edited', changed.map((k) => FIELD_LABELS[k] || k).join(', '));
			return json({ ok: true });
		}
		if (seg[2] === 'photo' && method === 'POST') {
			const e = editOnly(); if (e) return e;
			const fd = await request.formData();
			let key;
			try { key = await storePhoto(env, fd.get('photo'), 'inf' + id); } catch (x) { return err(x.message); }
			if (!key) return err('Choose an image.');
			await applyPatch(env, id, {}, { extra: { photo_key: key } });
			await log(env, id, s.name, 'photo updated');
			return json({ ok: true, photo: '/media/' + key });
		}
		if (seg[2] === 'review' && method === 'POST') {
			const e = editOnly(); if (e) return e;
			const { action, message } = await body(request);
			const acc = await env.DB.prepare('SELECT email FROM accounts WHERE influencer_id = ?').bind(id).first();
			const to = acc ? [acc.email] : inf.email ? [inf.email] : [];
			const joinUrl = (env.APP_URL || url.origin) + '/join/';
			if (action === 'approve') {
				await env.DB.prepare("UPDATE influencers SET status = 'approved', approved_at = ?, approved_by = ?, info_request = NULL, reject_reason = NULL, duplicate_of = NULL, duplicate_reason = NULL, updated_at = ? WHERE id = ?").bind(now(), s.name, now(), id).run();
				await log(env, id, s.name, 'approved');
				if (inf.status !== 'approved') ctx.waitUntil(sendEmail(env, to, 'Welcome to the RICH Influencer Network', `<p>Hi ${esc(inf.full_name)},</p><p>Your profile has been approved and is now part of the RICH Influencer Network. Our team will reach out when a campaign fits your content.</p><p>You can keep your followers, rates and contact details up to date any time: <a href="${joinUrl}">${joinUrl}</a></p><p>RICH Agency</p>`));
				return json({ ok: true });
			}
			if (action === 'reject') {
				await env.DB.prepare("UPDATE influencers SET status = 'rejected', reject_reason = ?, updated_at = ? WHERE id = ?").bind(String(message || '').slice(0, 1000) || null, now(), id).run();
				await log(env, id, s.name, 'rejected', message || '');
				return json({ ok: true });
			}
			if (action === 'request_info') {
				if (!message) return err('Write what you need from the influencer.');
				await env.DB.prepare("UPDATE influencers SET status = 'info_requested', info_request = ?, updated_at = ? WHERE id = ?").bind(String(message).slice(0, 2000), now(), id).run();
				await log(env, id, s.name, 'requested info', message);
				ctx.waitUntil(sendEmail(env, to, 'RICH Influencer Network: a few more details needed', `<p>Hi ${esc(inf.full_name)},</p><p>Thanks for registering. Before we can approve your profile we need:</p><blockquote>${esc(message).replace(/\n/g, '<br>')}</blockquote><p>Log in and update your profile here: <a href="${joinUrl}">${joinUrl}</a></p><p>RICH Agency</p>`));
				return json({ ok: true, emailed: !!(env.RESEND_API_KEY && to.length) });
			}
			if (action === 'reopen') {
				await env.DB.prepare("UPDATE influencers SET status = 'pending', updated_at = ? WHERE id = ?").bind(now(), id).run();
				await log(env, id, s.name, 'moved back to pending');
				return json({ ok: true });
			}
			return err('Unknown action.');
		}
		if (seg[2] === 'merge' && method === 'POST') {
			const e = editOnly(); if (e) return e;
			const { into } = await body(request);
			const target = await loadInf(env, +into);
			if (!target || target.id === id) return err('Choose the profile to merge into.');
			const fill = {};
			for (const k of [...WRITABLE, 'photo_key']) {
				if (k === 'admin_notes') continue;
				const v = inf[k];
				if (v == null || v === '' || v === '[]') continue;
				fill[k] = v;
			}
			if (target.admin_notes || inf.admin_notes) fill.admin_notes = [target.admin_notes, inf.admin_notes].filter(Boolean).join('\n');
			if (inf.consent_at) fill.consent_at = inf.consent_at;
			const both = await categoriesFor(env, [id, target.id]);
			const catIds = [...new Set([...both.get(target.id), ...both.get(id)].map((c) => c.id))];
			const primary = (both.get(id).find((c) => c.primary) || both.get(target.id).find((c) => c.primary) || {}).id;
			const { photo_key, ...rest } = fill;
			await applyPatch(env, target.id, rest, { categories: catIds, primary, extra: photo_key ? { photo_key } : {} });
			await env.DB.batch([
				env.DB.prepare('UPDATE accounts SET influencer_id = ? WHERE influencer_id = ?').bind(target.id, id),
				env.DB.prepare('UPDATE OR IGNORE campaign_influencers SET influencer_id = ? WHERE influencer_id = ?').bind(target.id, id),
				env.DB.prepare('UPDATE activity SET influencer_id = ? WHERE influencer_id = ?').bind(target.id, id),
				env.DB.prepare('DELETE FROM influencers WHERE id = ?').bind(id)
			]);
			await log(env, target.id, s.name, 'merged', `Registration #${id} merged into this profile`);
			return json({ ok: true, id: target.id });
		}
		if (!seg[2] && method === 'DELETE') {
			if (!isAdmin(s)) return err('Only admins can delete profiles.', 403);
			await env.DB.batch([
				env.DB.prepare('UPDATE accounts SET influencer_id = NULL WHERE influencer_id = ?').bind(id),
				env.DB.prepare('DELETE FROM influencers WHERE id = ?').bind(id)
			]);
			if (inf.photo_key) ctx.waitUntil(env.MEDIA.delete(inf.photo_key));
			return json({ ok: true });
		}
	}

	// ----- review queue -----
	if (path === '/pending' && method === 'GET') {
		const [regs, upd] = await Promise.all([
			env.DB.prepare("SELECT i.*, d.full_name dup_name, d.status dup_status FROM influencers i LEFT JOIN influencers d ON d.id = i.duplicate_of WHERE i.status IN ('pending','info_requested') ORDER BY i.status = 'info_requested', i.created_at DESC LIMIT 500").all(),
			env.DB.prepare("SELECT u.*, i.full_name, i.photo_key inf_photo_key, i.photo_url inf_photo_url FROM profile_updates u JOIN influencers i ON i.id = u.influencer_id WHERE u.status = 'pending' ORDER BY u.created_at DESC LIMIT 200").all()
		]);
		const cats = await categoriesFor(env, regs.results.map((r) => r.id));
		const full = new Map();
		if (upd.results.length) {
			const { results } = await env.DB.prepare(`SELECT * FROM influencers WHERE id IN (${upd.results.map((u) => +u.influencer_id).join(',')})`).all();
			for (const r of results) full.set(r.id, r);
		}
		return json({
			registrations: regs.results.map((r) => ({ ...present(r, cats.get(r.id)), duplicate: r.duplicate_of ? { id: r.duplicate_of, full_name: r.dup_name, status: r.dup_status, reason: r.duplicate_reason } : null })),
			updates: upd.results.map((u) => ({ ...updateView(u, full.get(u.influencer_id) || {}), full_name: u.full_name, photo: photoOf({ photo_key: u.inf_photo_key, photo_url: u.inf_photo_url }) }))
		});
	}
	if (seg[0] === 'updates' && seg[1] && method === 'POST') {
		const e = editOnly(); if (e) return e;
		const u = await env.DB.prepare("SELECT * FROM profile_updates WHERE id = ? AND status = 'pending'").bind(+seg[1]).first();
		if (!u) return err('This update was already handled.', 404);
		const { action, note, fields } = await body(request);
		if (action === 'approve') {
			const data = parse(u.data, {});
			// Optional partial approval: only the listed fields.
			const keep = Array.isArray(fields) ? new Set(fields) : null;
			const patch = {};
			for (const [k, v] of Object.entries(data)) if (k !== 'categories' && (!keep || keep.has(k))) patch[k] = v;
			const extra = {};
			if (u.photo_key && (!keep || keep.has('photo'))) extra.photo_key = u.photo_key;
			if (PRICE_FIELDS.some((k) => k in patch)) extra.price_source = 'influencer';
			const c = data.categories && (!keep || keep.has('categories')) ? data.categories : null;
			await applyPatch(env, u.influencer_id, cleanPatch(patch, SELF_EDITABLE), { categories: c ? c.ids : null, primary: c ? c.primary : null, extra });
			await env.DB.prepare("UPDATE profile_updates SET status = 'approved', reviewed_at = ?, reviewed_by = ?, note = ? WHERE id = ?").bind(now(), s.name, note || null, u.id).run();
			await log(env, u.influencer_id, s.name, 'approved profile changes', Object.keys(patch).concat(extra.photo_key ? ['photo'] : [], c ? ['categories'] : []).map((k) => FIELD_LABELS[k] || k).join(', '));
			return json({ ok: true });
		}
		if (action === 'reject') {
			await env.DB.prepare("UPDATE profile_updates SET status = 'rejected', reviewed_at = ?, reviewed_by = ?, note = ? WHERE id = ?").bind(now(), s.name, note || null, u.id).run();
			await log(env, u.influencer_id, s.name, 'rejected profile changes', note || '');
			return json({ ok: true });
		}
		return err('Unknown action.');
	}

	// ----- bulk import -----
	if (path === '/import' && method === 'POST') {
		const e = editOnly(); if (e) return e;
		const b = await body(request);
		const rows = Array.isArray(b.rows) ? b.rows.slice(0, 200) : [];
		const mode = b.mode === 'update' ? 'update' : 'skip';
		const status = b.status === 'pending' ? 'pending' : 'approved';
		const { results: catRows } = await env.DB.prepare('SELECT id, name FROM categories').all();
		const catByName = new Map(catRows.map((c) => [c.name.toLowerCase(), c.id]));
		// Prefetch identifiers once (keeps D1 query count low per request).
		const keys = { ig: [], tt: [], em: [] };
		const prepared = rows.map((raw, i) => {
			const d = cleanPatch(raw);
			if (d.ig_username) keys.ig.push(d.ig_username);
			if (d.tt_username) keys.tt.push(d.tt_username);
			if (d.email) keys.em.push(d.email);
			return { i, raw, d };
		});
		const existing = new Map();
		const addHits = async (col, vals) => {
			for (let k = 0; k < vals.length; k += 90) {
				const chunk = vals.slice(k, k + 90);
				const { results } = await env.DB.prepare(`SELECT id, ig_username, tt_username, email FROM influencers WHERE ${col} IN (${chunk.map(() => '?').join(',')}) AND status != 'rejected'`).bind(...chunk).all();
				for (const r of results) {
					if (r.ig_username) existing.set('ig:' + r.ig_username, r.id);
					if (r.tt_username) existing.set('tt:' + r.tt_username, r.id);
					if (r.email) existing.set('em:' + r.email, r.id);
				}
			}
		};
		await addHits('ig_username', keys.ig);
		await addHits('tt_username', keys.tt);
		await addHits('email', keys.em);

		const report = { created: 0, updated: 0, skipped: 0, errors: [] };
		const seen = new Set();
		for (const { i, raw, d } of prepared) {
			if (!d.full_name) { report.errors.push({ row: raw.__row || i + 2, error: 'Missing full name' }); continue; }
			if (!d.ig_username && !d.tt_username) { report.errors.push({ row: raw.__row || i + 2, error: 'Needs an Instagram or TikTok username' }); continue; }
			const idKeys = [d.ig_username && 'ig:' + d.ig_username, d.tt_username && 'tt:' + d.tt_username, d.email && 'em:' + d.email].filter(Boolean);
			if (idKeys.some((k) => seen.has(k))) { report.skipped++; continue; } // duplicate inside the file
			idKeys.forEach((k) => seen.add(k));
			const match = idKeys.map((k) => existing.get(k)).find(Boolean);
			const catNames = String(raw.categories || '').split(/[;,|]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
			const catIds = catNames.map((n) => catByName.get(n)).filter(Boolean);
			const extra = {};
			if (PRICE_FIELDS.some((k) => d[k])) extra.price_source = d.price_source || 'rate_card';
			try {
				if (match) {
					if (mode === 'skip') { report.skipped++; continue; }
					// Refresh data, but never rename an existing profile from a spreadsheet.
					const patch = Object.fromEntries(Object.entries(d).filter(([k, v]) => k !== 'full_name' && v != null && v !== '[]'));
					await applyPatch(env, match, patch, { categories: catIds.length ? catIds : null, primary: catIds[0], extra });
					report.updated++;
				} else {
					const nid = await insertInf(env, d, { status, source: 'import', categories: catIds, primary: catIds[0], extra: { ...extra, approved_by: status === 'approved' ? s.name : null } });
					idKeys.forEach((k) => existing.set(k, nid));
					report.created++;
				}
			} catch (x) {
				report.errors.push({ row: raw.__row || i + 2, error: x.message });
			}
		}
		if (report.created && status === 'pending') await notify(env, ctx, { kind: 'import', title: `${s.name} imported ${report.created} influencers for review`, link: '/#/pending' });
		return json(report);
	}

	// ----- categories -----
	if (path === '/categories' && method === 'POST') {
		const e = editOnly(); if (e) return e;
		const { name } = await body(request);
		const n = String(name || '').trim().slice(0, 60);
		if (!n) return err('Enter a category name.');
		const ex = await env.DB.prepare('SELECT id FROM categories WHERE lower(name) = lower(?)').bind(n).first();
		if (ex) return err('That category already exists.');
		const r = await env.DB.prepare('INSERT INTO categories (name, sort) VALUES (?, 500) RETURNING id').bind(n).first();
		return json({ id: r.id });
	}
	if (seg[0] === 'categories' && seg[1] && method === 'PATCH') {
		if (!isAdmin(s)) return err('Only admins can edit categories.', 403);
		const b = await body(request);
		const c = await env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(+seg[1]).first();
		if (!c) return err('Category not found.', 404);
		await env.DB.prepare('UPDATE categories SET name = ?, active = ?, sort = ? WHERE id = ?')
			.bind(String(b.name ?? c.name).trim().slice(0, 60) || c.name, b.active == null ? c.active : b.active ? 1 : 0, b.sort == null ? c.sort : +b.sort, c.id).run();
		return json({ ok: true });
	}

	// ----- campaigns -----
	if (path === '/campaigns' && method === 'GET') {
		const { results } = await env.DB.prepare(
			`SELECT c.*, COUNT(ci.influencer_id) n, SUM(ci.status IN ('confirmed','live','completed')) confirmed, SUM(COALESCE(ci.agreed_price,0)) committed
			 FROM campaigns c LEFT JOIN campaign_influencers ci ON ci.campaign_id = c.id GROUP BY c.id ORDER BY c.status = 'archived', c.updated_at DESC`
		).all();
		return json({ campaigns: results });
	}
	if (path === '/campaigns' && method === 'POST') {
		const e = editOnly(); if (e) return e;
		const b = await body(request);
		if (!String(b.name || '').trim()) return err('Name the campaign.');
		const r = await env.DB.prepare('INSERT INTO campaigns (name, client, brief, budget, start_date, end_date, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id')
			.bind(String(b.name).trim().slice(0, 160), String(b.client || '').slice(0, 160) || null, String(b.brief || '').slice(0, 8000) || null, num(b.budget), String(b.start_date || '').slice(0, 10) || null, String(b.end_date || '').slice(0, 10) || null, 'planning', s.name, now(), now()).first();
		return json({ id: r.id });
	}
	if (seg[0] === 'campaigns' && seg[1]) {
		const cid = +seg[1];
		const c = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ?').bind(cid).first();
		if (!c) return err('Campaign not found.', 404);
		const touch = () => env.DB.prepare('UPDATE campaigns SET updated_at = ? WHERE id = ?').bind(now(), cid).run();
		const members = async () => {
			const { results } = await env.DB.prepare('SELECT i.*, ci.status ci_status, ci.deliverables ci_deliverables, ci.agreed_price ci_price, ci.notes ci_notes, ci.added_by ci_added_by, ci.added_at ci_added_at FROM campaign_influencers ci JOIN influencers i ON i.id = ci.influencer_id WHERE ci.campaign_id = ? ORDER BY ci.added_at').bind(cid).all();
			const cats = await categoriesFor(env, results.map((r) => r.id));
			return results.map((r) => present(r, cats.get(r.id)));
		};
		if (!seg[2] && method === 'GET') return json({ campaign: c, influencers: await members() });
		if (!seg[2] && method === 'PATCH') {
			const e = editOnly(); if (e) return e;
			const b = await body(request);
			const pick = (k, max) => (k in b ? String(b[k] || '').slice(0, max) || null : c[k]);
			await env.DB.prepare('UPDATE campaigns SET name = ?, client = ?, brief = ?, budget = ?, start_date = ?, end_date = ?, status = ?, updated_at = ? WHERE id = ?')
				.bind(pick('name', 160) || c.name, pick('client', 160), pick('brief', 8000), 'budget' in b ? num(b.budget) : c.budget, pick('start_date', 10), pick('end_date', 10),
					['planning', 'active', 'completed', 'archived'].includes(b.status) ? b.status : c.status, now(), cid).run();
			return json({ ok: true });
		}
		if (!seg[2] && method === 'DELETE') {
			if (!isAdmin(s)) return err('Only admins can delete campaigns.', 403);
			await env.DB.prepare('DELETE FROM campaigns WHERE id = ?').bind(cid).run();
			return json({ ok: true });
		}
		if (seg[2] === 'export' && method === 'GET') {
			const rows = (await members()).map((r) => ({ ...r, ci_status: r.ci_status.replace(/_/g, ' ') }));
			return csvResponse(toCsv(rows, CSV_COLS.filter((x) => !['status', 'email', 'whatsapp'].includes(x[0]) || url.searchParams.get('contacts') === '1'),
				[['ci_status', 'Campaign status'], ['ci_deliverables', 'Deliverables'], ['ci_price', 'Agreed price (AED)'], ['ci_notes', 'Notes']]),
				`${c.name.replace(/[^\w-]+/g, '-').toLowerCase()}-shortlist.csv`);
		}
		if (seg[2] === 'influencers' && !seg[3] && method === 'POST') {
			const e = editOnly(); if (e) return e;
			const b = await body(request);
			const add = ids((b.influencer_ids || []).join(',')).slice(0, 200);
			if (!add.length) return err('Choose influencers to add.');
			await env.DB.batch(add.map((iid) => env.DB.prepare('INSERT OR IGNORE INTO campaign_influencers (campaign_id, influencer_id, added_by, added_at) VALUES (?, ?, ?, ?)').bind(cid, iid, s.name, now())));
			await touch();
			return json({ ok: true });
		}
		if (seg[2] === 'influencers' && seg[3]) {
			const e = editOnly(); if (e) return e;
			const iid = +seg[3];
			if (method === 'PATCH') {
				const b = await body(request);
				const cur = await env.DB.prepare('SELECT * FROM campaign_influencers WHERE campaign_id = ? AND influencer_id = ?').bind(cid, iid).first();
				if (!cur) return err('Not on this campaign.', 404);
				const ST = ['shortlisted', 'sent_to_client', 'client_approved', 'contacted', 'confirmed', 'live', 'completed', 'declined'];
				await env.DB.prepare('UPDATE campaign_influencers SET status = ?, deliverables = ?, agreed_price = ?, notes = ? WHERE campaign_id = ? AND influencer_id = ?')
					.bind(ST.includes(b.status) ? b.status : cur.status, 'deliverables' in b ? String(b.deliverables || '').slice(0, 1000) || null : cur.deliverables,
						'agreed_price' in b ? num(b.agreed_price) : cur.agreed_price, 'notes' in b ? String(b.notes || '').slice(0, 2000) || null : cur.notes, cid, iid).run();
				await touch();
				return json({ ok: true });
			}
			if (method === 'DELETE') {
				await env.DB.prepare('DELETE FROM campaign_influencers WHERE campaign_id = ? AND influencer_id = ?').bind(cid, iid).run();
				await touch();
				return json({ ok: true });
			}
		}
	}

	// ----- team users -----
	if (seg[0] === 'users') {
		if (!isAdmin(s)) return err('Only admins can manage users.', 403);
		if (!seg[1] && method === 'GET') {
			const { results } = await env.DB.prepare('SELECT id, email, display_name, role, active, created_at FROM users ORDER BY active DESC, display_name COLLATE NOCASE').all();
			return json({ users: results });
		}
		if (!seg[1] && method === 'POST') {
			const b = await body(request);
			const email = cleanEmail(b.email);
			if (!email) return err('Enter a valid email.');
			if (!b.display_name) return err('Enter a name.');
			if (!ROLES.includes(b.role)) return err('Pick a role.');
			if (String(b.password || '').length < 8) return err('Temporary password must be at least 8 characters.');
			if (await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()) return err('A user with this email already exists.');
			const h = await hashPassword(String(b.password));
			const r = await env.DB.prepare('INSERT INTO users (email, display_name, role, pass_hash, pass_salt, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
				.bind(email, String(b.display_name).trim().slice(0, 120), b.role, h.hash, h.salt, now()).first();
			return json({ id: r.id });
		}
		if (seg[1] && method === 'PATCH') {
			const uid = +seg[1];
			const b = await body(request);
			const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(uid).first();
			if (!u) return err('User not found.', 404);
			if (uid === s.uid && ((b.role && b.role !== 'admin') || b.active === false)) return err('You can’t remove your own admin access.');
			const stmts = [env.DB.prepare('UPDATE users SET role = ?, active = ?, display_name = ? WHERE id = ?')
				.bind(ROLES.includes(b.role) ? b.role : u.role, b.active == null ? u.active : b.active ? 1 : 0, b.display_name ? String(b.display_name).slice(0, 120) : u.display_name, uid)];
			if (b.password) {
				if (String(b.password).length < 8) return err('Password must be at least 8 characters.');
				const h = await hashPassword(String(b.password));
				stmts.push(env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?').bind(h.hash, h.salt, uid));
			}
			if (b.password || b.active === false) stmts.push(env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(uid));
			await env.DB.batch(stmts);
			return json({ ok: true });
		}
	}
	return err('Not found.', 404);
}

function updateView(u, inf) {
	const data = parse(u.data, {});
	const changes = Object.entries(data).map(([k, v]) => ({
		field: k,
		label: FIELD_LABELS[k] || k,
		from: k === 'categories' ? null : k === 'languages' ? parse(inf[k], []).join(', ') : inf[k],
		to: k === 'categories' ? v : k === 'languages' ? parse(v, []).join(', ') : v
	}));
	if (u.photo_key) changes.push({ field: 'photo', label: 'Profile picture', from: photoOf(inf), to: '/media/' + u.photo_key });
	return { id: u.id, influencer_id: u.influencer_id, created_at: u.created_at, changes };
}

// ---------- entry ----------
export default {
	async scheduled(event, env, ctx) {
		ctx.waitUntil(runSeed(env).then((r) => console.log('seed', JSON.stringify(r))).catch((e) => console.error('seed failed', e)));
	},
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const path = url.pathname;
		try {
			if (path.startsWith('/api/')) {
				if (request.method !== 'GET') {
					const origin = request.headers.get('Origin');
					if (origin && origin !== url.origin) return err('Bad origin.', 403);
				}
				if (path.startsWith('/api/join/')) return await publicApi(request, env, ctx, url, path.slice('/api/join'.length));
				return await teamApi(request, env, ctx, url, path.slice('/api'.length));
			}
			if (path.startsWith('/media/')) {
				const key = decodeURIComponent(path.slice(7));
				if (!/^photos\/[\w.-]+$/.test(key)) return new Response('Not found', { status: 404 });
				const obj = await env.MEDIA.get(key);
				if (!obj) return new Response('Not found', { status: 404 });
				return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' } });
			}
			if (path === '/join') return Response.redirect(url.origin + '/join/', 301);
			return env.ASSETS.fetch(request);
		} catch (e) {
			console.error(e);
			if (path.startsWith('/api/')) return err('Something went wrong. Try again.', 500);
			return new Response('Something went wrong.', { status: 500 });
		}
	}
};
