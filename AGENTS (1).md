<!-- BEGIN ACCEPTED POLICY -->
# AGENTS.md — Concurrent hackathon development doctrine

Protocol version: `1.0.0`  
Applies to every human-assisted AI session, tool, script, subagent, and contributor working on this project.

## 1. Purpose and authority

Build one coherent product while four or more contributors work concurrently. Prevent duplicate implementation, protect each contributor's work, and make independently developed components integrate through explicit technical contracts.

MUST, MUST NOT, SHOULD, and MAY mean required, prohibited, recommended, and optional within this project policy. These instructions do not override the agent platform's system instructions, tool permissions, or applicable safety rules.

Within project decisions, explicit human instructions outrank AI preferences. Record the instruction, author, scope, and exact technical consequences. A human's instruction to their agent does not silently cancel another human's ownership or overwrite their work. Conflicting human instructions require a recorded resolution from the affected owners or the team's designated decision owner. AI agents MUST NOT invent that resolution.

An accepted baseline governs compatible work until an authorized human approves a change. The first proposed stack does not become the baseline merely because it was proposed first. Ambiguous decisions that affect interfaces, architecture, ownership, or acceptance criteria require a human decision; pause only the affected work. Routine implementation inside an accepted contract and claimed scope can proceed autonomously.

This document is a cooperative protocol, not an automatic lock service. Its claims become authoritative through the shared Git transaction below. Isolated checkouts prevent direct local overwrites. Server protections and write gates are needed to constrain clients that ignore this policy; no Markdown file can guarantee compliance by arbitrary agents.

## 2. Required configuration — no invented defaults

The team MUST configure these values before shared project mutations. `UNCONFIGURED` means no write authority. Read-only inspection and preparation of proposals remain allowed.

| Setting | Initial value | Required content |
| --- | --- | --- |
| Project ID | UNCONFIGURED | Stable identifier for this repository/product |
| Git remote | UNCONFIGURED | Exact remote name and canonical repository URL |
| Coordination ref | `refs/heads/agent-coordination` | One shared remote branch for all sessions |
| Integration target ref | UNCONFIGURED | Exact protected target, e.g. `refs/heads/main` |
| Human roster | UNCONFIGURED | Stable owner IDs, display names, decision authority |
| Integration owner | UNCONFIGURED | Human or explicitly delegated integrator |
| Governance/recovery owner | UNCONFIGURED | Human authorized to resolve policy conflicts and recover fenced/stopped sessions |
| Notification transport | UNCONFIGURED | Authorized channel, or polling + human chat |
| Baseline | UNCONFIGURED | Accepted baseline ID, version, path, SHA-256 |
| Project layout | UNCONFIGURED | Exact source, test, contract, generated-output paths |
| Validation gates | UNCONFIGURED | Exact commands, environments, thresholds, required reviewers |

Place this file at the repository root. Move the scoped `AGENTS.md` files into the actual directories they govern, and record those paths. Do not create a parallel frontend/backend architecture simply because this kit uses those directory names.

## 3. One canonical overview; separate code workspaces

The authoritative live `AGENTS.md` is on the remote coordination ref. It contains the accepted root policy plus the live ledger initialized from `coordination/LEDGER_TEMPLATE.md`. Its tables summarize the current state and link every detailed event, baseline, contract, decision, and validation record. Project-branch copies are bootstrap instructions and potentially stale views, never current claim authority.

The coordination branch contains:

- `AGENTS.md`: policy, configuration, active overview, notices, and chronological event index.
- `events/<event_uuid>.json`: immutable, technically precise events.
- `baselines/<baseline_id>/<version>.json`: immutable baseline snapshots.
- `contracts/<contract_id>/<version>.json`: immutable contract snapshots and referenced schemas/fixtures.
- `decisions/<decision_uuid>.json`: human decisions, affected owners, approvals, and superseded decisions.
- `evidence/<evidence_uuid>/`: sanitized validation reports referenced by events.

Hash the accepted policy/configuration separately from the changing ledger: SHA-256 of the exact UTF-8 bytes starting at the BEGIN ACCEPTED POLICY marker through the END ACCEPTED POLICY marker, including both marker lines and their terminating LF. The hash itself belongs in the ledger/events outside that section. Heartbeats do not change the policy hash. An approved policy/configuration change requires `coordination:governance`, the configured human's recorded decision, an updated protocol/policy version as appropriate, and every active session's acknowledgement before its next mutation. Historical events remain under their recorded policy version.

Each session MUST use its own code checkout/worktree, private branch, and separate private coordination checkout. Never share a working directory, Git index, temporary directory, development-server port, test database, cache output, deployment slot, or mutable data namespace. Register exact allocations in the ledger. Private branches do not remove the need for claims: two private branches can still duplicate a feature or change the same interface incompatibly.

Port allocation records must include physical host/container network-namespace ID, protocol, bind address, and port number. The same loopback port on different isolated hosts is independent; wildcard binds can overlap loopback/specific-address binds on the same host. Use an actual availability check and conservative overlap rules, not just different textual addresses.

Read the current remote policy, all applicable scoped instructions, accepted baseline, relevant contracts, claims, recent events, and unresolved notices at startup. Register `SESSION_REGISTERED` with the policy version/hash and instruction paths actually loaded. Every tool must confirm its instructions were loaded; filenames alone do not prove that Codex, Claude, ChatGPT, or another agent read them. Subagents inherit this protocol and need their own identity and allocations if they mutate files independently.

## 4. Atomic coordination transaction

All ledger changes use this sequence. The same sequence applies to claims, heartbeats, intents, outcomes, notices, approvals, and state transitions.

1. Fetch the exact remote coordination HEAD into the private coordination checkout. Record its commit SHA. Inspect that version, not a remembered or cached view.
2. Re-evaluate task duplication, path/resource overlap, baseline compatibility, notices, and authorization against that HEAD.
3. Create exactly one child commit with that HEAD as its sole parent. Update the overview and append new events/snapshots together; never edit or delete historical events. A correction is a new event identifying what it supersedes.
4. Push this child commit with an ordinary fast-forward push to the exact coordination ref. Do not force, merge competing claims, or rebase a rejected claim without a fresh conflict check.
5. Authority exists only after the remote accepts the push. Record the accepted coordination SHA as the receipt. If rejected, fetch the new HEAD and rebuild the proposed transaction after rechecking every condition. A locally written claim grants nothing.

Two sibling claims cannot both land through ordinary fast-forward pushes. This serializes cooperative submissions; semantic conflict detection still depends on the checks above or a server validator. For enforceable coordination, protect this ref against force pushes/deletion and validate single-parent commits, schemas, append-only history, approvals, and non-overlapping claims server-side. Git author text is not identity proof; use authenticated accounts and record their verified attribution.

Private coordination drafts and the transaction itself are exempt from recursive mutation logging. The exemption covers only coordination checkout records and necessary Git metadata. It grants no project-source, contract-implementation, deployment, or shared-data write authority. Bootstrap installation by the team coordinator is a one-time explicit exception; record `BOOTSTRAP_COMPLETED` before normal development begins.

Initial creation of a uniquely allocated private checkout and read-only Git inspection/fetch metadata are also bootstrap/read exceptions. They must not modify an existing shared checkout, tracked source, shared branch, or application data. Register the resulting checkout/allocation before project development. Dependency installation, generators, test artifacts, migrations, and source edits remain mutations.

If the remote is unreachable, a result is uncertain, a record is inconsistent, or the agent cannot perform this transaction, stop dependent writes and publication. Investigate read-only and report the blocker. Determine the actual outcome before retrying an operation that might already have succeeded.

## 5. Declare the work before implementation

Create a `TASK_PROPOSED` record with all of these fields. A vague summary is insufficient.

| Field | Required specificity |
| --- | --- |
| Identity | Project ID, task UUID, session UUID, human owner ID, agent/tool/version when known |
| Objective | Canonical capability key, user outcome, duplicate-check search terms |
| Acceptance | Numbered criteria with inputs, observable outputs, units, thresholds, and evidence commands |
| Baseline | Accepted ID/version/SHA-256; proposed deviations and unresolved decisions |
| Scope | Canonical repo-relative paths; create/edit/delete/rename operations; both rename endpoints |
| Semantic resources | Feature IDs, routes/methods, contract IDs, schema/table IDs, config keys, dependency locks, deployment/data resources |
| Interfaces | Produced and consumed contract IDs/versions/hashes; exact implementation locations |
| Dependencies | Task IDs, provider owners, readiness conditions, mock/fixture provenance |
| Environment | Code branch/worktree, base code SHA, ports, outputs, test database/cache namespace |
| Impact | Affected owners/contracts, compatibility classification, notice IDs |
| Delivery | Planned checkpoints, estimate with units and stated uncertainty, validation plan, handoff artifacts |

Compare objectives and acceptance criteria with PROPOSED, active, review, integrated, and cancelled tasks. Different filenames do not prove different work. If another task already covers the outcome, reuse it, propose a complementary subtask, or request an explicit transfer. Do not start a duplicate implementation or expensive duplicate generation. Reading enough to establish overlap is allowed.

For an ambiguous overlap, record `BLOCKED` with the conflicting task IDs and a concrete decision request to the human. Example: “Task T1 owns `feature:profile-edit` and `PATCH /v1/profile`; your request overlaps its save flow. I can claim profile accessibility tests, or the owners can approve a scope split.” Never claim a conflict has been resolved without a recorded resolution.

## 6. Claim paths and meaning, all at once

An accepted `CLAIM_ACCEPTED` transaction assigns a claim UUID, monotonically increasing generation, task/session owner, explicit path set, and semantic resource set. Acquire the entire necessary set atomically or acquire none; do not hold a partial set while waiting for the rest.

- One exclusive writer per path or semantic resource. Concurrent reading is allowed; shared-resource mutation is not.
- Normalize paths to repository-relative `/` form. Reject `..`, traversal through symlinks, aliases, and case-only differences that collide on a supported filesystem. Record resolved paths. A directory-prefix claim covers all descendants. A prefix and any descendant overlap. For uncertain globs, conservatively treat possible overlap as a conflict or expand them to explicit paths.
- Claim both source and destination of renames, deletions, and generated-source outputs. Claim generator inputs only if mutated; record immutable read inputs by exact hash/dependency. Claim root manifests, lockfiles, global style tokens, migrations, routes, and CI configuration when touched.
- Semantic resources include `feature:<id>`, `contract:<id>`, `route:<METHOD>:<path>`, `schema:<id>`, `dependency-lock:<path>`, `config:<key>`, `port:<host>:<number>`, `dataset:<namespace>`, and `integration:<target-ref>`.
- Different functions in one file still conflict under this protocol. Split the file through an agreed task, serialize the edits, or assign one owner. Do not rely on “probably different lines.”
- A new resource or path requires an accepted scope extension before it is touched. Approval for a design change does not itself grant a file claim.

Record a heartbeat every 5 minutes and refresh the ledger before every mutation and at least every 2 minutes during long-running work. Ten minutes without a heartbeat marks a claim SUSPECT; it does not release it. If a tool will run longer than 5 minutes, arrange an independent heartbeat process or checkpoint it without losing ownership.

An observing agent or coordinator must publish the `STATE_CHANGED` event marking SUSPECT with the observed heartbeat age; the passage of time is not itself a recorded transaction. Treat an unrecorded stale owner as uncertain and pause dependent changes until reconciled.

Takeover requires the owner to confirm shutdown/handoff, or the designated recovery authority to confirm isolation/fencing of the old writer. Record `CLAIM_TRANSFERRED` with an incremented generation and the evidence. An old session that resumes must refresh, detect the invalid generation, and stop. Claims and generations are cooperative fences unless a write gate checks them; expiry alone cannot stop a stalled agent's local writes. Preserve its branch for recovery.

## 7. Every mutation has an accepted intent and an outcome

Before each editor save or mutating tool invocation, publish a one-use `MUTATION_INTENT`. One invocation may batch explicitly listed edits. The intent MUST specify mutation UUID, task/claim/generation, operation type, exact files, expected preimage hashes or `ABSENT`, baseline/contracts, sanitized command/tool arguments, and expected outputs. For private build/test/cache outputs whose filenames are generated dynamically, declare the exact isolated output directory and generation rule; report the actual file list afterward. This exception does not allow unspecified source edits.

`COMMIT_INTENT` and `PUSH_INTENT` are specialized one-use mutation intents for their respective invocations; they replace, rather than duplicate, `MUTATION_INTENT`. Their matching outcome types replace `MUTATION_OUTCOME`. `INTEGRATION_INTENT` describes the reviewed publication plan; every mutating invocation within that plan still needs its applicable one-use intent.

Refresh the ledger immediately before executing. Verify the claim generation, approvals, baseline, notices, and preimages still match. If they do not, stop and reconcile. Record `MUTATION_OUTCOME` immediately afterward with exit/status, actual paths, before/after SHA-256, added/deleted line counts where meaningful, generated-file count, start/end UTC, duration in milliseconds, and evidence. A failed or partial mutation is still an outcome. `null` plus a reason represents an unknown; fabricated zeroes or “all good” do not.

Unresolved intents must be reconciled after a crash before further writes. Inspect the actual filesystem/ref/service state rather than assuming rollback. Classify outcomes `SUCCEEDED`, `FAILED`, `PARTIAL`, or `UNKNOWN`. A contract change or destructive operation with UNKNOWN outcome blocks dependent work.

The precise event schema and logging rules are in `coordination/AGENTS.md` and `coordination/EVENT_TEMPLATE.json`. The overview links the event UUID and digest, so every agent can inspect what was planned, attempted, completed, blocked, and integrated.

## 8. Freeze a precise baseline; integrate through contracts

Read `architecture/AGENTS.md` before architecture or interface work. Publish `STACK_PROPOSED`, then obtain the designated human's `STACK_ACCEPTED` decision. Baselines must name exact languages, runtime/framework/compiler/tool versions, package manager, locked dependencies, module format, source layout, build/test commands and working directories, environments, ports, shared services, schema tools, and contract conventions. Record every unknown and why it matters.

Later components MUST fit that accepted baseline and consume its versioned contracts. If React + TypeScript and a Node.js API are accepted, a second contributor uses the accepted component conventions, types, routes, serialization, and build tooling. It must not silently choose another stack or alter the shared API. Propose a deviation with a migration/adaptation plan and await a human decision when necessary. No particular stack is selected by this kit.

For every cross-component boundary, accept an explicit contract before implementation against it. Use `architecture/CONTRACT_TEMPLATE.json`, with linked schemas and positive/negative fixtures. Specify:

- Producer and consumer owner/task IDs; transport, route/method or function/event name; exact version and content hash.
- Input and output schema; field names/types; required versus omitted versus nullable; identifier formats; encoding/content type; date/time timezone; units; numeric ranges/precision; enumerations; ordering; pagination.
- Validation and error schema; status/error codes; authentication/authorization; timeouts in ms; retry rules; idempotency; concurrency behavior; side effects; event ordering/delivery semantics when applicable.
- UI mappings and states; persistence mappings/migrations; exact consumer adapter or generated-client location; compatibility rules; representative fixtures; executable validation and acceptance evidence.

Input/output coherence means producer output satisfies the exact schema the consumer validates. Congruence includes meaning: matching names alone is insufficient if one value is seconds and the other milliseconds, one ID is a string and the other a number, or omitted and null trigger different behavior. Consumers must validate at boundaries; TypeScript types alone do not validate network JSON. An adapter must be explicit, owned, claimed, versioned, and tested against fixtures.

Accepted contract versions are immutable. Any output/input change, including a supposedly additive field, requires recorded compatibility analysis against every consumer's validation policy. Work from mocks may proceed only against accepted contract fixtures; label mock evidence. Mock success is not live integration success.

## 9. Impact notices, delivery, and decisions

Before a change that affects another owner, record `IMPACT_NOTICE` with exact affected contract/path/task IDs, before/after schema hashes, compatibility classification, quantified migration effects, affected tests, migration order, rollback plan, and the decision needed. Keep affected work BLOCKED while a required decision is pending; independent claimed work may continue.

Distinguish these events:

| Event | What it proves |
| --- | --- |
| `IMPACT_NOTICE` | Notice exists in the ledger |
| `NOTICE_DELIVERED` | Authorized transport supplied a delivery receipt, or receiving agent surfaced it in its human's chat and recorded evidence |
| `NOTICE_ACKNOWLEDGED` | Named recipient explicitly confirms reading it |
| `CHANGE_APPROVED` | Authorized human/delegated reviewer approves a specific version/scope |

Agents poll notices addressed to their owner, consumed contracts, or active tasks. They surface relevant notices to their human promptly and record the actual response. No silence, heartbeat, delivery receipt, or acknowledgement is approval. Record refusal and revised alternatives. Do not send external messages unless the human has authorized that channel/action. Polling alone does not notify an absent person; label undelivered notices accurately.

Record human decisions with stable decision UUID, supplied instruction, identity/authority evidence, affected resources, before/after baseline or contract versions, approvals from affected owners when required, and timestamp. Superseding decisions link their predecessors. Do not rewrite the history to match a new decision.

## 10. States and ownership lifecycle

| State | Meaning | Claim behavior |
| --- | --- | --- |
| PROPOSED | Work declared; overlap/decisions still being checked | No write authority |
| ACTIVE | Accepted claim and required decisions exist | Mutations allowed within scope |
| BLOCKED | Named dependency, conflict, unknown, or decision prevents affected work | Existing claims retained; log any explicit scope split |
| SUSPECT | Heartbeat stale or owner uncertain | Claims retained; recovery process required |
| READY_FOR_REVIEW | Implementation and evidence submitted | Claims retained; fixes need mutation intents |
| INTEGRATING | Exclusive integrator is applying the reviewed task | Claims retained until result verified |
| INTEGRATED | Accepted changes verified on exact target SHA | Release still requires `CLAIM_RELEASED` |
| CANCELLED | Task stopped with disposition recorded | Release after owner shutdown and artifact handoff |

Use `STATE_CHANGED` with previous/new states and evidence. No automatic transition frees ownership. Transfer/release is an explicit atomic event. Split partial progress into separately tracked tasks rather than marking an entire unfinished task integrated.

## 11. Commits, pushes, and integration

Before a code commit, accept `COMMIT_INTENT` with code base/head SHA, exact staged path list, expected diff digest, task/claim generation, tests and known gaps. Inspect the index; stage only explicit owned paths. Do not use `git add .`, `git add -A`, or `git commit -a`. Record `COMMIT_OUTCOME` with commit SHA, parent SHA(s), actual staged paths, and verification result.

Before a code push, accept `PUSH_INTENT` with remote, exact source commit and destination ref, expected remote old SHA, and authorized scope. Record `PUSH_OUTCOME` with confirmed remote new SHA or uncertainty. Agents push only their own authorized task branch; a private push does not integrate the task. Never force push, rewrite shared history, delete another contributor's branch, discard another person's changes, or run broad cleanup/reset/restore commands against shared work.

Only the configured integrator holding `integration:<target-ref>` may update the shared target. Follow `integration/AGENTS.md`: recheck current target SHA, task/claim validity, accepted baseline/contracts, unresolved notices, exact diff scope, and producer/consumer validation on the actual combined code. A review against an older target does not authorize merging an untested combination. Log integration intent, actual outcome, new target SHA, and evidence; release claims only after verified integration or confirmed handoff/cancellation.

Keep scopes small enough to integrate frequently. Prefer a complete demonstrable vertical slice with real contract validation over many disconnected components. Record demo data, expected outputs, setup commands, and fallback behavior. Do not claim a feature works end-to-end on the basis of unit tests or screenshots alone.

## 12. Precision, evidence, and handoff

Use UTC RFC3339 timestamps, explicit time units, full commit SHA strings, SHA-256 digests with algorithm labels, exact paths, commands with working directories, and exact versions. Secrets and personal data MUST be redacted; retain environment variable names and sanitized structures. Never include credentials in URLs, commands, fixtures, or logs.

For tests, record suite and command, environment, input fixture hashes, code SHA, passed/failed/skipped counts, exit code, report path/digest, and whether mocks or live services were used. For performance, record metric, unit, workload, sample count, environment, observed value, target, and pass/fail. “Fast,” “tested,” “compatible,” “mostly done,” and percentages without a denominator are not evidence.

Handoff includes exact code commit, touched files, contracts produced/consumed, implemented versus missing acceptance criteria, dependencies/notices, test evidence, known risks, reproduction commands, and next owner/action. Keep the overview concise; retain detailed events and verifiable archive references. Archive only through an accepted append-only archival transaction with immutable paths, digests, and commit references. Never remove unresolved claims/notices or drop history to shorten agent context.

When blocked, report the task IDs, exact conflicting resource or missing field, last accepted coordination SHA, work already preserved, and the specific human decision needed. Continue safe read-only investigation or separately claimed unaffected work. Never substitute an assumption for another component's contract.

## 13. Completion checklist

Before declaring a task complete, verify:

1. All writes have valid claims and matching intents/outcomes; no outcome remains unknown.
2. Baseline/contracts match; producer/consumer fixtures and live integration evidence exist.
3. Criteria have measured results, explicit gaps, and required human decisions.
4. Commit/push/integration SHAs are verified; no foreign changes were staged or overwritten.
5. Handoff/overview is current; release or transfer is explicitly accepted.

Detailed scoped policies: `architecture/AGENTS.md`, `coordination/AGENTS.md`, `frontend/AGENTS.md`, `backend/AGENTS.md`, `product/AGENTS.md`, and `integration/AGENTS.md`. They add precision; none may weaken this root protocol.
<!-- END ACCEPTED POLICY -->
