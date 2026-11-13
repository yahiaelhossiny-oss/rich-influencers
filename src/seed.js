// One-off server-side import of the web-research dataset (13 Nov 2026).
// Runs from the scheduled trigger; idempotent via the meta flag and per-handle existence checks.
import records from './seed/web-research-2026-11-13.json';
import { derive } from './model.js';

const FLAG = 'seed:web-research-2026-11-13';

export async function runSeed(env) {
	await env.DB.prepare('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)').run();
	const done = await env.DB.prepare('SELECT v FROM meta WHERE k = ?').bind(FLAG).first();
	if (done) return { skipped: true };
	const now = Date.now();
	const stmts = [];
	for (const { row, cats } of records) {
		const r = { ...row, status: 'approved', source: 'import', created_at: now, updated_at: now, approved_at: now, approved_by: 'Web research import', stats_updated_at: now };
		Object.assign(r, derive(r));
		const cols = Object.keys(r);
		const ig = r.ig_username || '', tt = r.tt_username || '';
		stmts.push(env.DB.prepare(
			`INSERT INTO influencers (${cols.join(',')}) SELECT ${cols.map(() => '?').join(',')}
			 WHERE NOT EXISTS (SELECT 1 FROM influencers WHERE (ig_username = ? AND ? != '') OR (tt_username = ? AND ? != ''))`
		).bind(...cols.map((c) => r[c] ?? null), ig, ig, tt, tt));
		const idSql = ig ? 'SELECT id FROM influencers WHERE ig_username = ?' : 'SELECT id FROM influencers WHERE tt_username = ?';
		cats.forEach((c, i) => stmts.push(env.DB.prepare(
			`INSERT OR IGNORE INTO influencer_categories (influencer_id, category_id, is_primary) SELECT (${idSql}), id, ? FROM categories WHERE name = ?`
		).bind(ig || tt, i === 0 ? 1 : 0, c)));
	}
	for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
	const n = await env.DB.prepare("SELECT COUNT(*) n FROM influencers WHERE approved_by = 'Web research import'").first();
	await env.DB.batch([
		env.DB.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').bind(FLAG, JSON.stringify({ at: now, records: records.length, in_db: n.n })),
		env.DB.prepare('INSERT INTO notifications (kind, title, body, link, created_at) VALUES (?, ?, ?, ?, ?)')
			.bind('import', `${n.n} influencers added from public web research`, 'Dubai, Abu Dhabi and Sharjah creators from public ranking sites. Unverified: check stats and rates before outreach. Sources are in each profile\'s internal notes.', '/#/discover?sort=followers', now)
	]);
	return { inserted: n.n };
}
