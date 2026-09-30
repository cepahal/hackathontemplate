# Hosted verification record

Status: **NOT RUN**. No configured Supabase test project and two test accounts were available for
this maintenance change. Offline tests and green CI do not change this status.

Follow [the two-account procedure](README.md#first-hosted-gate-two-account-rls) first. Replace each
pending result only after observing the actual hosted outcome. Record project aliases, not secrets
or personal account identifiers. Do not commit tokens, passwords, or connection strings.

| Evidence | Recorded result |
| --- | --- |
| Verification date (UTC) | Pending |
| Git commit tested | Pending |
| Test project alias | Pending |
| Migration files successfully applied | Pending |
| Two distinct test Auth accounts created | Pending |
| Complete `database/tests/rls.sql` execution | NOT RUN |
| RLS success notice / client execution result | Pending |
| Final rollback completed | Pending |
| Redacted errors and follow-up fixes | Pending |

## Subsequent gates (separate results)

- [ ] Authenticated project CRUD through the app, persistence after refresh, and cross-account denial.
- [ ] Email/password login, configured Google login, logout, and session refresh.
- [ ] Private realtime channel and membership revocation checks.
- [ ] `database/tests/billing.sql` with the same test accounts, followed by Stripe test-mode acceptance.
- [ ] Each enabled AI/external provider with real test credentials and documented outcomes.

Record detailed evidence in `docs/DELIVERY.md` when a gate is completed. Passing RLS SQL does not
prove HTTP token validation, browser sessions, OAuth, deployment, or any external provider.
