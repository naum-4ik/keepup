# 0008. Email and password instead of an email link

**Status:** Accepted · 2026-09-30

## Context
Sign-in was Google or an email link. The link never reached most people: Supabase's built-in email only delivers to the project's own team, and Keepup has no custom SMTP sender yet. So anyone without Google couldn't get in.

## Decision
Sign-in is **Google** or **email + password** (at least 8 characters). The email link is removed. Email confirmation stays **off** until an SMTP sender is set up, so a new account works straight away and no email is ever sent.

## Consequences
- Everyone can sign up without relying on email delivery. The tests also got faster, with no mailbox to poll.
- There's no self-service password reset yet. "Forgot password?" points to signing in with Google (same email) or asking the owner.
- Without confirmation, someone could register another person's email. If that person later signs in with Google, the accounts link by email. That's accepted while Keepup is family and friends only. Before it opens to strangers, an SMTP sender goes in, confirmation is turned on and a reset flow is added.
