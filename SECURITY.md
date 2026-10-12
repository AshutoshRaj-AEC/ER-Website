# Security

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Email
**eklautarecords@gmail.com** with the details and steps to reproduce, and
we'll get back to you as soon as we can.

## How the app is protected

This repository is public on purpose: it contains no secrets, and access
control is enforced by the database, not by hiding code.

- **No secrets in the repo.** The only key here is the Supabase *publishable*
  key, which is designed to be public. Server-side secrets (email credentials,
  API keys, OAuth client secret) live only in Supabase and Google settings.
- **Row-level security on every table.** Artists can only read and change
  their own rows. Admin rights require a confirmed sign-in with an address on
  the admin list. Private areas (Song Vault, Spotify Insights) are owner-only;
  admins can't see them.
- **Private storage.** All file buckets are private, size-limited and
  restricted by file type. Downloads use short-lived signed links.
- **Upload limits per artist**, enforced in the database: pending and daily
  submission limits and per-bucket storage allowances.
- **Security headers** (see `netlify.toml`): a Content Security Policy that
  only allows this site and the services it uses, plus anti-framing, no-sniff,
  referrer and permissions policies.
- **Server-side checks are tested.** See `supabase/tests/insights_security.sql`
  and `npm test`.
