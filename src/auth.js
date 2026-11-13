// Password hashing and sessions (PBKDF2-SHA256), shared by team users and influencer accounts.
const ITER = 100000;
const enc = new TextEncoder();
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

export const TEAM_COOKIE = 'rip_team';
export const INF_COOKIE = 'rip_inf';

const b64 = (bytes) => {
	let s = '';
	const a = new Uint8Array(bytes);
	for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
	return btoa(s);
};
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

export async function hashPassword(password, saltBytes) {
	const salt = saltBytes || rand(16);
	const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, key, 256);
	return { hash: b64(bits), salt: b64(salt) };
}

export async function verifyPassword(password, saltB64, hashB64) {
	try {
		const { hash } = await hashPassword(password, unb64(saltB64));
		if (hash.length !== hashB64.length) return false;
		let d = 0;
		for (let i = 0; i < hash.length; i++) d |= hash.charCodeAt(i) ^ hashB64.charCodeAt(i);
		return d === 0;
	} catch {
		return false;
	}
}

export const newToken = () => b64(rand(32)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function readCookie(request, name) {
	const c = request.headers.get('Cookie') || '';
	const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
	return m ? m[1] : null;
}

export const cookie = (name, token, secure) =>
	`${name}=${token}; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`;
export const clearCookie = (name, secure) => `${name}=; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax; Path=/; Max-Age=0`;

export async function createTeamSession(env, userId) {
	const token = newToken();
	await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, userId, Date.now() + SESSION_TTL * 1000).run();
	return token;
}

export async function readTeamSession(env, request) {
	const token = readCookie(request, TEAM_COOKIE);
	if (!token) return null;
	const r = await env.DB.prepare(
		`SELECT s.expires_at, u.id, u.email, u.display_name, u.role, u.active, u.notif_seen_at
		 FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
	).bind(token).first();
	if (!r || !r.active || r.expires_at < Date.now()) return null;
	return { uid: r.id, role: r.role, name: r.display_name, email: r.email, seen: r.notif_seen_at, token };
}

export async function createInfSession(env, accountId) {
	const token = newToken();
	await env.DB.prepare('INSERT INTO account_sessions (token, account_id, expires_at) VALUES (?, ?, ?)').bind(token, accountId, Date.now() + SESSION_TTL * 1000).run();
	return token;
}

export async function readInfSession(env, request) {
	const token = readCookie(request, INF_COOKIE);
	if (!token) return null;
	const r = await env.DB.prepare(
		`SELECT s.expires_at, a.id, a.email, a.influencer_id FROM account_sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token = ?`
	).bind(token).first();
	if (!r || r.expires_at < Date.now()) return null;
	return { aid: r.id, email: r.email, iid: r.influencer_id, token };
}
