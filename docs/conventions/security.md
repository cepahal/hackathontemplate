# Security Conventions

## Baseline
- Secrets only in env / secret manager
- Least privilege for DB and API keys
- HTTPS in deployed environments
- Dependency installs from trusted sources; pin when the project pins

## App-level checks
| Area | Rule |
|---|---|
| Authn | Verified session/JWT |
| Authz | Ownership/role on every sensitive op |
| Input | Validate/allowlist |
| Output | Encode untrusted HTML |
| Files | Type, size, storage path controls |
| SSRF | Allowlist outbound URLs |
| AI | Untrusted content cannot escalate tools/privileges |

## Incident hygiene
If a secret leaks into git history: rotate immediately; do not just delete the file in a new commit.
