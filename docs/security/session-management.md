# Session Management

Successful login creates a PostgreSQL-backed session and sets a 256-bit opaque token in an HttpOnly, SameSite cookie. Browser JavaScript cannot read it. Only a SHA-256 token digest is stored. Sessions record creation, expiry, throttled last activity, IP address, user agent, revocation time, and revocation reason.

Every protected request rechecks expiry, revocation, user status, employee status, current roles, and current branch assignments. Authorization changes therefore take effect without issuing a new token. Session activity is persisted at a bounded interval instead of writing on every request.

Logout revokes the current session and clears the cookie. Authorized administrators can revoke a session with a reason. User suspension/disablement and password resets revoke active sessions. Default expiry is environment validated.
