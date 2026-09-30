# 0007. No Face ID sign-in in v1

**Status:** Accepted · 2026-09-29

## Context
Face ID sign-in (passkeys) was built on Supabase Auth's passkey beta and tested with a virtual authenticator. On a real iPhone, setup didn't work the way the owner wanted. A passkey also can't be the first sign-in: it's added after signing in with Google or an email link.

## Decision
Remove passkeys (the feature was reverted). Sign-in stays **Google** and **email magic link**. Face ID moves to the roadmap and gets another look when Supabase passkeys leave beta.

## Consequences
- A simpler sign-in, with fewer beta dependencies.
- The email link needs a custom SMTP sender to reach anyone beyond the Supabase team. Until then, Google is the way in for the family. (The email link was later replaced by email + password: [0008](0008-email-and-password-instead-of-an-email-link.md).)
