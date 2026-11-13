# RICH Influencers

Influencer database, search and campaign shortlisting for RICH Agency, plus the public **Join the RICH Influencer Network** registration portal (English / Arabic).

Runs on Cloudflare Workers + D1 + R2, same setup as RICH Briefs and the Content Calendar.

| URL | Who |
|---|---|
| `/` | RICH team dashboard (login required) |
| `/join/` | Influencer registration, login and self-service profile |

## Already done on your Cloudflare account

- D1 database `rich-influencers` created, all tables built, 18 default categories loaded
- R2 bucket `rich-influencer-media` created (profile pictures)
- `wrangler.toml` already points at both

## Deploy (5 minutes)

```bash
npm install
npx wrangler login        # once, opens the browser
npx wrangler deploy
```

Open the `*.workers.dev` URL it prints. The first screen creates the first admin account, and it only appears while there are no team accounts. So do this straight after deploying, or set a key first with `npx wrangler secret put SETUP_KEY`.

Custom domain (e.g. `influencers.richagency.ae`): Cloudflare dashboard → Workers → rich-influencers → Settings → Domains. Then set `APP_URL` in `wrangler.toml` and deploy again.

To deploy from GitHub like your other Workers: push this folder to a repo and connect it under Workers → rich-influencers → Settings → Build.

## Notifications (optional)

New registrations always show in the dashboard (badge + bell). To also get them elsewhere:

```bash
npx wrangler secret put NOTIFY_WEBHOOK_URL   # Slack or Google Chat incoming webhook
npx wrangler secret put RESEND_API_KEY       # email via resend.com
npx wrangler secret put NOTIFY_EMAIL         # team inbox, comma separated
npx wrangler secret put MAIL_FROM            # "RICH Influencers <influencers@yourdomain.ae>"
```

With email configured, influencers are also emailed when they're approved or when you request more info.

## How the registration pipeline works

1. Influencer submits `/join/` → record saved as **pending**, login created, team notified.
2. Duplicates are checked on Instagram username, TikTok username, email and WhatsApp number.
   - Matches a profile that already has a login → blocked, told to log in.
   - Matches an imported profile with no login → saved but flagged; **Merge** links them to the existing record.
3. Team reviews in **Review queue**: Approve, Request info, Reject, or Edit first. Non-duplicates can be bulk-approved.
4. Approved = searchable in Discover immediately.
5. Influencers log in to update their profile. Bio, contacts, languages and availability update instantly. Followers, stats, rates, handles, name, city, categories and photo go to **Review queue → Profile updates**, where you can approve field by field.

## Building the database

There's no scraping in this build. Instagram and TikTok don't allow it, and scraped follower counts go stale fast. Three supported routes in:

- **Registration page.** Share `/join/` in bio links, outreach DMs and with management agencies.
- **CSV import** (Import menu). Download the template, or upload any sheet and map the columns. Safe to re-import an updated sheet: existing profiles are matched by handle or email and skipped or refreshed.
- **Manual add** for one-offs.

For verified stats at scale (engagement, audience location), export from a licensed tool such as Modash, HypeAuditor or Upfluence and import the CSV. Only store contact details that were provided to you or published by the influencer for business use.

## Roles

- **Admin:** everything, plus users, categories, deletes
- **Editor:** add, edit, approve, import, campaigns
- **Viewer:** search, view and compare only

## Local development

```bash
npx wrangler d1 execute rich-influencers --local --file=schema.sql
npx wrangler dev
```

Add your logo as `public/logo.png` (it's used in the sidebar, login and join page; the text wordmark shows until then). Brand colours are CSS variables at the top of `public/app.css`.
