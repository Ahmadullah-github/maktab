# Release public keys

The Windows release job must provision `license-public-keys.json` and
`update-public-keys.json` here before packaging. Each file uses this public-only format:

```json
{
  "schema_version": 1,
  "keys": [
    { "key_id": "license-2026-q3", "public_key": "-----BEGIN PUBLIC KEY-----\n..." }
  ]
}
```

During rotation, include both the retiring and replacement public keys. Only public Ed25519 keys
belong in the client artifact. Private signing keys remain in the independent release service's
secret store and must never be committed, copied into CI artifacts, or written to logs. See
`docs/engineering/LICENSE_RELEASE_OPERATIONS.md` for the overlap procedure.
