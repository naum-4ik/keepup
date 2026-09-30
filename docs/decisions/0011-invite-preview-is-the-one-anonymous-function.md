# 0011. The invite preview is the one anonymous function

**Status:** Accepted · 2026-09-30

## Context
The invite page has to say what you are joining before you sign in. Until now no `public` function could be called without a session.

## Decision
- `invite_preview(token)` is the only `public` function granted to `anon`. For a valid, unexpired, unrevoked token it returns the group name and kind, the inviter's first name and the member count. For anything else it returns nothing.
- Tokens are 24 URL-safe characters from 18 random bytes. Invites expire and admins can revoke them. Accepting needs a signed-in adult.
- The guard test allowlists exactly this function, so any other anonymous grant fails CI.

## Consequences
- A visitor learns something only if they hold a live link, and only those four facts.
- Cost: anyone with the link can see the preview until it expires or is revoked. That is how invite links work.
