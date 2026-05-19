# Player Nickname Design

## Goal

After registration, a player must set a nickname before they can enter the first game flow. The implementation should also leave a backend path for later nickname edits, without exposing that edit UI to players yet.

## Scope

- Store a nullable `nickname` on `User`.
- Require the nickname step only for newly registered sessions.
- Do not block existing login sessions that have no nickname.
- Do not expose an in-game nickname edit control yet.
- Use the saved nickname in player ghost snapshots and battle player snapshots.

## Backend

Registration keeps the current auto-login behavior and returns `needsNickname: true` with the public user payload. A new authenticated endpoint, `POST /api/profile/nickname`, accepts `{ nickname }`, trims it, validates that it is 2 to 16 characters, saves it on the current user, and returns the updated public user. This endpoint is the future nickname-edit path.

The `/api/me`, login, and registration user payloads include `id`, `email`, and `nickname`. Matchmaking reads the current user before creating a ghost snapshot so the saved nickname is used instead of the fixed player ghost name. Battle start reads the current user and passes the saved nickname into `snapshotFromRun`.

## Frontend

The client user type gains `id` and `nickname`. After registration succeeds with `needsNickname: true`, the app renders a required nickname setup screen before showing dog selection or an active run. The setup screen posts to `/api/profile/nickname`, updates local user state from the response, and then proceeds to the normal logged-in flow.

Login remains unchanged from the player perspective. Existing users without a nickname are not forced through the setup screen unless they have just registered in the current session.

## Validation And Errors

Nicknames are trimmed server-side. Empty or one-character nicknames are rejected. Nicknames longer than 16 characters are rejected. Duplicate nicknames are allowed for now because no product rule requires uniqueness.

## Testing

API tests cover registration returning `needsNickname`, authenticated nickname creation, unauthenticated rejection, invalid nickname rejection, and nickname use in ghost and battle snapshots. Frontend structure tests cover the presence of the nickname setup state and endpoint path.
