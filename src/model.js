// Influencer field model: validation, normalisation, derived fields, duplicate keys.

export const CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah'];
export const GENDERS = ['female', 'male', 'other'];
export const AVAILABILITY = ['available', 'limited', 'unavailable', 'unknown'];
export const PRICE_SOURCES = ['influencer', 'management', 'rate_card', 'team'];
export const STATUSES = ['pending', 'info_requested', 'approved', 'rejected'];

export const TIERS = [
	{ key: 'nano', label: 'Nano', min: 0, max: 9999 },
	{ key: 'micro', label: 'Micro', min: 10000, max: 99999 },
	{ key: 'mid', label: 'Mid-tier', min: 100000, max: 499999 },
	{ key: 'macro', label: 'Macro', min: 500000, max: 999999 },
	{ key: 'celebrity', label: 'Celebrity', min: 1000000, max: Infinity }
];

export const PRICE_FIELDS = ['price_ig_reel', 'price_ig_story', 'price_ig_post', 'price_ig_carousel', 'price_tt_video', 'price_tt_live', 'price_package'];
export const STAT_FIELDS = [
	'ig_followers', 'ig_avg_views', 'ig_avg_likes', 'ig_avg_comments',
	'tt_followers', 'tt_avg_views', 'tt_avg_likes', 'tt_avg_comments'
];
export const RATE_FIELDS = ['ig_er', 'tt_er'];
const TEXT_FIELDS = {
	full_name: 160, photo_url: 1000, city: 60, gender: 20, nationality: 80, email: 200, whatsapp: 40, agency: 160,
	bio: 2000, content_types: 500, availability: 20, audience_country: 80, audience_city: 80,
	ig_username: 60, tt_username: 60, price_source: 20, admin_notes: 4000
};

// Every column an editor (or importer) may write.
export const WRITABLE = [...Object.keys(TEXT_FIELDS), 'languages', ...STAT_FIELDS, ...RATE_FIELDS, ...PRICE_FIELDS];

// Fields an influencer may change. Those in REVIEW need admin approval once the profile is live.
export const SELF_EDITABLE = WRITABLE.filter((f) => !['admin_notes', 'photo_url', 'price_source'].includes(f));
export const REVIEW = new Set([
	'full_name', 'city', 'ig_username', 'tt_username', ...STAT_FIELDS, ...RATE_FIELDS, ...PRICE_FIELDS, 'categories', 'photo'
]);

export const FIELD_LABELS = {
	full_name: 'Full name', city: 'City', gender: 'Gender', nationality: 'Nationality', languages: 'Languages', email: 'Email',
	whatsapp: 'WhatsApp', agency: 'Management agency', bio: 'Bio', content_types: 'Content types', availability: 'Availability',
	audience_country: 'Top audience country', audience_city: 'Top audience city', ig_username: 'Instagram username',
	ig_followers: 'Instagram followers', ig_er: 'Instagram engagement %', ig_avg_views: 'Instagram avg Reel views',
	ig_avg_likes: 'Instagram avg likes', ig_avg_comments: 'Instagram avg comments', tt_username: 'TikTok username',
	tt_followers: 'TikTok followers', tt_er: 'TikTok engagement %', tt_avg_views: 'TikTok avg views', tt_avg_likes: 'TikTok avg likes',
	tt_avg_comments: 'TikTok avg comments', price_ig_reel: 'IG Reel price', price_ig_story: 'IG Story price', price_ig_post: 'IG Post price',
	price_ig_carousel: 'IG Carousel price', price_tt_video: 'TikTok Video price', price_tt_live: 'TikTok Live price',
	price_package: 'Package price', categories: 'Categories', photo: 'Profile picture'
};

// "@name", "instagram.com/name/", "https://www.tiktok.com/@name?lang=en" -> "name"
export function handle(v, platform) {
	let s = String(v || '').trim();
	if (!s) return null;
	const m = s.match(platform === 'tt' ? /tiktok\.com\/@?([^/?#\s]+)/i : /instagram\.com\/([^/?#\s]+)/i);
	if (m) s = m[1];
	s = s.replace(/^@+/, '').trim().toLowerCase();
	if (!/^[a-z0-9._]{1,40}$/.test(s)) return null;
	return s;
}

// Accepts 95000, "95,000", "95k", "1.2M"
export function num(v) {
	if (v === null || v === undefined || v === '') return null;
	if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
	const s = String(v).trim().toLowerCase().replace(/[, ]/g, '').replace(/aed|dhs?|\$/g, '');
	const m = s.match(/^(\d+(?:\.\d+)?)([km])?$/);
	if (!m) return null;
	let n = parseFloat(m[1]);
	if (m[2] === 'k') n *= 1e3;
	if (m[2] === 'm') n *= 1e6;
	return Math.round(n);
}

export function rate(v) {
	if (v === null || v === undefined || v === '') return null;
	const n = parseFloat(String(v).replace('%', '').trim());
	if (!Number.isFinite(n) || n < 0 || n > 100) return null;
	return Math.round(n * 100) / 100;
}

export const digits = (v) => {
	const d = String(v || '').replace(/[^\d]/g, '');
	return d.length >= 7 ? d : null;
};
export const cleanEmail = (v) => {
	const s = String(v || '').trim().toLowerCase();
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
};

function cleanCity(v) {
	const s = String(v || '').trim();
	if (!s) return null;
	const hit = CITIES.find((c) => c.toLowerCase() === s.toLowerCase().replace('abudhabi', 'abu dhabi'));
	return hit || s.slice(0, 60);
}
function cleanGender(v) {
	const s = String(v || '').trim().toLowerCase();
	if (!s) return null;
	if (['f', 'female', 'woman'].includes(s)) return 'female';
	if (['m', 'male', 'man'].includes(s)) return 'male';
	return 'other';
}
export function cleanLanguages(v) {
	const list = Array.isArray(v) ? v : String(v || '').split(/[,;/|]/);
	const out = [];
	for (const x of list) {
		const t = String(x).trim();
		if (!t) continue;
		const n = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
		if (!out.includes(n)) out.push(n.slice(0, 40));
	}
	return out.slice(0, 12);
}

// Normalise a partial patch. Only keys present in `input` are returned.
export function cleanPatch(input, allowed = WRITABLE) {
	const out = {};
	for (const f of allowed) {
		if (!(f in input)) continue;
		const v = input[f];
		if (f === 'languages') out[f] = JSON.stringify(cleanLanguages(v));
		else if (STAT_FIELDS.includes(f) || PRICE_FIELDS.includes(f)) out[f] = num(v);
		else if (RATE_FIELDS.includes(f)) out[f] = rate(v);
		else if (f === 'ig_username') out[f] = handle(v, 'ig');
		else if (f === 'tt_username') out[f] = handle(v, 'tt');
		else if (f === 'email') out[f] = cleanEmail(v);
		else if (f === 'city') out[f] = cleanCity(v);
		else if (f === 'gender') out[f] = cleanGender(v);
		else if (f === 'availability') out[f] = AVAILABILITY.includes(v) ? v : 'unknown';
		else if (f === 'price_source') out[f] = PRICE_SOURCES.includes(v) ? v : null;
		else if (f === 'photo_url') {
			const s = String(v || '').trim();
			out[f] = /^https:\/\//i.test(s) ? s.slice(0, 1000) : null;
		} else {
			const s = String(v ?? '').trim().slice(0, TEXT_FIELDS[f] || 500);
			out[f] = s || null;
		}
	}
	if ('full_name' in out && !out.full_name) delete out.full_name;
	if ('whatsapp' in out && out.whatsapp && !digits(out.whatsapp)) out.whatsapp = null;
	return out;
}

export function tierFor(followers) {
	if (!followers) return null;
	return (TIERS.find((t) => followers >= t.min && followers <= t.max) || TIERS[0]).key;
}

// Derived columns, computed from the full row after a patch is merged.
export function derive(row) {
	const total = Math.max(row.ig_followers || 0, row.tt_followers || 0);
	const prices = PRICE_FIELDS.filter((f) => f !== 'price_package').map((f) => row[f]).filter((x) => x > 0);
	return {
		total_followers: total,
		tier: tierFor(total),
		min_price: prices.length ? Math.min(...prices) : null,
		search_text: [row.full_name, row.ig_username, row.tt_username, row.agency, row.nationality, row.bio, row.content_types]
			.filter(Boolean).join(' ').toLowerCase().slice(0, 3000)
	};
}

// Look for existing records sharing a unique identifier.
export async function findDuplicates(env, row, excludeId = 0) {
	const ors = [];
	const binds = [];
	if (row.ig_username) ors.push('ig_username = ?') && binds.push(row.ig_username);
	if (row.tt_username) ors.push('tt_username = ?') && binds.push(row.tt_username);
	if (row.email) ors.push('email = ?') && binds.push(row.email);
	const wa = digits(row.whatsapp);
	if (wa) ors.push("REPLACE(REPLACE(REPLACE(REPLACE(whatsapp,'+',''),' ',''),'-',''),'(','') LIKE ?") && binds.push('%' + wa.slice(-9));
	if (!ors.length) return [];
	const { results } = await env.DB.prepare(
		`SELECT id, full_name, status, ig_username, tt_username, email, whatsapp FROM influencers
		 WHERE (${ors.join(' OR ')}) AND id != ? AND status != 'rejected' LIMIT 10`
	).bind(...binds, excludeId).all();
	return results
		.map((r) => {
			const reasons = [];
			if (row.ig_username && r.ig_username === row.ig_username) reasons.push('Instagram @' + row.ig_username);
			if (row.tt_username && r.tt_username === row.tt_username) reasons.push('TikTok @' + row.tt_username);
			if (row.email && r.email === row.email) reasons.push('email');
			if (wa && digits(r.whatsapp) && digits(r.whatsapp).slice(-9) === wa.slice(-9)) reasons.push('WhatsApp number');
			return { id: r.id, full_name: r.full_name, status: r.status, reasons };
		})
		.sort((a, b) => (b.status === 'approved') - (a.status === 'approved') || a.id - b.id);
}
