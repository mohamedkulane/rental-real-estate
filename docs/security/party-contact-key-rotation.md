# Party contact key rotation runbook

Contact encryption, lookup indexing, and authentication-rate bucketing use three separate 32-byte hexadecimal secrets. Never reuse them in production.

## Rotation procedure

1. Generate a new encryption key and increment `PARTY_DATA_ENCRYPTION_KEY_VERSION` (for example `v1` to `v2`).
2. Put every still-needed old key in `PARTY_DATA_DECRYPTION_KEYS` as comma-separated `version:hex-key` entries.
3. Keep `PARTY_CONTACT_LOOKUP_KEY` stable during encryption-only rotation. Rotate it only when the same controlled backfill is executed.
4. Back up the database and schedule a maintenance window.
5. Run `pnpm security:rotate-party-key` first. This is a dry run: it decrypts every contact, validates the key ring, and writes nothing.
6. After approval, run `pnpm security:rotate-party-key -- --apply`.
7. Verify Party list masking and authorized detail access, then remove an old decryption key only after no ciphertext begins with its version.

The command prints counts only; it never prints plaintext or keys. Updates run in batches of 100 transactions. Deployment must retain the old keys until rollback is no longer required.
