# Security Review Workflow

Use when the change touches auth, authorization, user content, files, SSRF-prone fetches, secrets, or AI tools.

## Checklist
- [ ] Authentication required where expected
- [ ] Authorization/ownership enforced server-side
- [ ] No IDOR via predictable IDs
- [ ] Injection: SQL/NoSQL/command/template
- [ ] XSS: unsafe HTML / `dangerouslySetInnerHTML` / unescaped templates
- [ ] CSRF: cookie session mutations protected
- [ ] SSRF: outbound URL allowlists
- [ ] Secrets not in client, git, or logs
- [ ] Uploads constrained (type/size/path)
- [ ] Sensitive data not over-exposed in API responses
- [ ] AI prompt injection cannot escalate tools/privileges
- [ ] Unsafe tool usage gated and validated

## Output
Only real issues with severity (P0/P1/P2), impact, and fix direction.
Prompt: `prompts/security/full-security-review.md`
