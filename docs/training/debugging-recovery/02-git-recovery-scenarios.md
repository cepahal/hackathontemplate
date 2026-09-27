# Git Recovery Scenarios (A–H)

For each scenario: diagnose → safest strategy → commands → verify.  
**Destructive steps always state what is lost.**

---

## Scenario A — AI modified 15 files and broke the project

### Diagnose
```bash
git status
git diff --stat
git diff
```
Ask: Are changes committed? Pushed? Any good files mixed with bad?

### Safest strategies (pick by state)

**A1 — Uncommitted, all bad**  
Loss if you restore: uncommitted AI edits (gone unless stashed).
```bash
git stash push -u -m "ai-broken-15-files"   # safety net
git restore .
git clean -fdn                              # dry-run untracked
# git clean -fd                             # only if dry-run OK
```
Verify: app runs; `git status` clean.

**A2 — Uncommitted, mix of good and bad**  
Do **not** `restore .`. Restore only bad paths after reviewing diff.
```bash
git diff -- path/to/bad1 path/to/bad2
git restore -- path/to/bad1 path/to/bad2
```

**A3 — Committed locally, not pushed**  
```bash
git log --oneline -5
git reset --hard HEAD~1    # LOSES that commit's tip content from branch (recover via reflog)
# safer keep files: git reset --soft HEAD~1
```

**A4 — Pushed**  
```bash
git revert <bad-sha>       # does NOT delete history
```

---

## Scenario B — Accidentally deleted useful changes

### Diagnose
Were they committed? Stashed? Only in working tree?

### Strategies
- **Never committed:** check IDE local history; if `restore`/`clean` already ran, may be gone
- **Stashed:** `git stash list` → `git stash show -p` → `git stash apply`
- **Committed then reset:** `git reflog` → find hash → `git switch -c recover <hash>` or `cherry-pick`
- **Committed on another branch:** `git log --all --oneline -- path`

Verify: diff contains the lost hunks; tests/demo path OK.

---

## Scenario C — Committed a bad implementation (local)

### Diagnose
```bash
git log -1
git status -sb   # ahead of origin?
```

### Strategies
- Want to rewrite last commit content: fix files → `git commit --amend` **only if not pushed and you own the commit**
- Want to drop last commit keep files: `git reset --soft HEAD~1`
- Want history clean drop: `git reset --hard HEAD~1` — **loses uncommitted + that commit from branch tip**

Prefer soft/mixed until you understand the diff.

---

## Scenario D — Pushed a bad commit

### Diagnose
```bash
git log origin/main -3 --oneline
```

### Safest
```bash
git revert <bad-sha>
git push
```
**Avoid** `reset --hard` + force-push to shared `main` during hackathon unless whole team agrees and you understand rewriting remote history.

Verify: CI/demo on reverted state; teammates pull.

---

## Scenario E — Reset too far

### Diagnose
```bash
git reflog -20
```
Find the commit where things were still good (`HEAD@{n}`).

### Recover
```bash
git branch rescue/<name> HEAD@{n}   # pointer first — no loss
git switch rescue/<name>
# or move branch back: git reset --hard HEAD@{n}
```
What `--hard` loses: uncommitted work + commits not reachable from any ref (eventually GC). Branch/tag first.

Verify: `git log -5`; app behavior from yesterday.

---

## Scenario F — Two teammates modified the same code

### Diagnose
```bash
git status
# conflict markers? merge in progress?
```

### Strategy
1. Communicate ownership of the file
2. Open both versions: `git show :2:file` / `:3:file` (during merge) or compare branches
3. Merge **intent**, not blindly "accept current"
4. Run tests for both features

Never let AI auto-resolve conflicts without reading them.

---

## Scenario G — AI generated changes on top of someone else's work

### Diagnose
```bash
git log --oneline --graph -15
git blame path/to/file
git diff main...HEAD --stat
```

### Strategy
- If AI commit is separable: `git revert <ai-sha>` or reset local AI commit
- If intertwined: branch from pre-AI (`reflog`/`log`), cherry-pick teammate commits, re-apply minimal AI fix manually
- Create `backup/ai-attempt` before rewriting

---

## Scenario H — Worked yesterday, broken after several commits

### Diagnose
```bash
git log --oneline --since="yesterday"
git bisect start
git bisect bad
git bisect good <yesterday-good-sha>
# run test each step → git bisect good|bad
git bisect reset
```
Fast path under time pressure: inspect last 3 AI commits with `git show` before full bisect.

### Fix
Revert or surgically fix the bisect culprit; add a regression check on the demo path.

---

## Universal verification checklist

- [ ] `git status` matches expectation
- [ ] Demo path works (or known remaining break documented)
- [ ] No secrets reintroduced
- [ ] Teammates know if history was rewritten (should be rare)
