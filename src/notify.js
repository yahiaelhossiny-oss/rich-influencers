// In-app notifications, plus optional Slack/Google Chat webhook and email (Resend).
//   NOTIFY_WEBHOOK_URL  incoming webhook; receives {"text": "..."}
//   RESEND_API_KEY      enables email
//   NOTIFY_EMAIL        team inbox(es), comma separated
//   MAIL_FROM           e.g. "RICH Influencers <influencers@richagency.ae>" (verified in Resend)
//   APP_URL             public base URL used in links, e.g. https://influencers.richagency.ae

export async function notify(env, ctx, { kind, title, body = '', link = '' }) {
	await env.DB.prepare('INSERT INTO notifications (kind, title, body, link, created_at) VALUES (?, ?, ?, ?, ?)')
		.bind(kind, title, body, link, Date.now()).run();
	const base = env.APP_URL || '';
	const full = link ? base + link : '';
	const jobs = [];
	if (env.NOTIFY_WEBHOOK_URL) {
		jobs.push(fetch(env.NOTIFY_WEBHOOK_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: `*${title}*${body ? '\n' + body : ''}${full ? '\n' + full : ''}` })
		}).catch(() => {}));
	}
	if (env.NOTIFY_EMAIL) {
		jobs.push(sendEmail(env, env.NOTIFY_EMAIL.split(',').map((s) => s.trim()), title,
			`<p><b>${esc(title)}</b></p>${body ? `<p>${esc(body).replace(/\n/g, '<br>')}</p>` : ''}${full ? `<p><a href="${esc(full)}">Open in RICH Influencers</a></p>` : ''}`));
	}
	if (jobs.length) ctx.waitUntil(Promise.all(jobs));
}

export async function sendEmail(env, to, subject, html) {
	if (!env.RESEND_API_KEY || !env.MAIL_FROM || !to || !to.length) return;
	try {
		await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: env.MAIL_FROM, to, subject, html })
		});
	} catch {}
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
