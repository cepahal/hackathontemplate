# Git Mastery for Incident Response

Git is a **time machine and evidence log**, not a save button.

Mental model of state:

```text
Working tree  →  Staging (index)  →  Commits (history)  →  Remote
     ↑                  ↑                  ↑                 ↑
  edit files      git add           git commit          git push
```

Also: **reflog** is a personal diary of where HEAD moved (lifesaver).

---

## Command reference (practical)

### `git status`
- **Does:** Shows branch, staged/unstaged/untracked, ahead/behind
- **Changes:** Nothing (read-only)
- **Use:** Always first. Before every recovery decision
- **Not:** As a substitute for reading the diff
- **Reversible:** N/A
- **Mistakes:** Ignoring untracked files AI created
- **Hackathon:** "What did the AI touch since I last looked?"

### `git diff`
- **Does:** Unstaged changes (working tree vs index)
- **Changes:** Nothing
- **Use:** Review AI edits before add/commit
- **Not:** For already-staged changes (use `--cached`)
- **Mistakes:** Assuming empty `git diff` means clean — check `--cached` and untracked
- **Hackathon:** Spot drive-by rewrites in 15 files

### `git diff --cached` (staged)
- **Does:** Staged vs last commit
- **Changes:** Nothing
- **Use:** Pre-commit review; "what am I about to commit?"
- **Hackathon:** Catch secrets AI staged

### `git log`
- **Does:** Commit history (`--oneline`, `-n`, `--graph`)
- **Changes:** Nothing
- **Use:** Find when it last worked; identify bad commit
- **Mistakes:** Only reading messages — open the commit with `git show`
- **Hackathon:** `git log --oneline -15` before panic

### `git show`
- **Does:** One commit's metadata + patch (`git show HEAD`, `git show abc123`)
- **Changes:** Nothing
- **Use:** Inspect the suspicious commit
- **Hackathon:** "What exactly did that AI commit change?"

### `git branch`
- **Does:** List/create/delete branch pointers
- **Changes:** Refs only (unless `-d` deletes)
- **Use:** Orient; create recovery branches
- **Not:** Switching (prefer `git switch`)
- **Hackathon:** `git branch backup/before-ai-mess` before risky ops

### `git switch` / `git checkout`
- **Does:** Move HEAD to another branch/commit; `checkout` also historically restored files
- **Prefer:** `git switch <branch>` to change branches; `git restore` to discard file changes
- **Risk:** Uncommitted changes may block switch or come along
- **Hackathon:** Stay on feature branches; switch to `main` to verify known-good demo

### `git stash`
- **Does:** Shelves dirty working tree (optionally `-u` for untracked)
- **Changes:** Working tree → stash stack; can pop later
- **Use:** Temporarily clear mess to test clean tree / switch branch
- **Not:** Long-term backup (easy to forget/drop)
- **Reversible:** Usually (`stash pop`/`apply`); dropping stash loses it unless reflog helps
- **Mistakes:** Stashing without `-u` leaving AI's new files behind; `stash drop` too early
- **Hackathon:** Stash AI experiment, confirm main works, then decide

### `git restore`
- **Does:** Restore **files** in working tree/index from a known tree (`--staged`, `--source=`)
- **Changes:** Working tree and/or index — **does not create a new commit**
- **Use:** Throw away uncommitted AI edits to specific files; unstage
- **Not:** Undoing a commit already shared (use `revert`)
- **Reversible:** Only if you still have the content elsewhere (stash/commit/reflog). Uncommitted loss can be permanent
- **Mistakes:** `git restore .` wiping good + bad together without reviewing diff
- **Hackathon:** Surgical undo of 2 broken files keeping the other 13

### `git revert`
- **Does:** New commit that **undoes** an old commit's changes
- **Changes:** History grows (safe for shared branches)
- **Use:** Undo bad commit already pushed / shared
- **Not:** Cleaning local experiments (reset may be fine locally)
- **Reversible:** Revert the revert
- **Mistakes:** Reverting merge commits without `-m`; conflict panic
- **Hackathon:** Preferred public undo

### `git reset`
- **Does:** Move branch pointer (and optionally index/worktree)
  - `--soft`: move HEAD; keep index + worktree
  - `--mixed` (default): move HEAD + index; keep worktree
  - `--hard`: move HEAD + index + worktree — **destructive to uncommitted and discarded commits' tip**
- **Use:** Local rewrite of unpushed commits; unstage (`reset HEAD~` soft/mixed)
- **Not:** On commits already pushed to shared `main` without team consent
- **Reversible:** Often via `reflog` if you act soon; `--hard` loses uncommitted work not stashed
- **Mistakes:** `--hard` when you meant `--mixed`; resetting past good work
- **Hackathon:** Local only; prefer `revert` if pushed

### `git reflog`
- **Does:** Log of HEAD movements (checkout, commit, reset, rebase)
- **Changes:** Nothing (read)
- **Use:** Recover after "I reset too far" / lost commit
- **Not:** Forever — expires eventually
- **Hackathon:** Your parachute after panic resets

### `git cherry-pick`
- **Does:** Apply a commit's patch onto current branch
- **Use:** Pull one good fix onto release/demo branch
- **Mistakes:** Cherry-picking a commit that depends on earlier commits
- **Hackathon:** Extract the one auth fix onto `main` without taking the broken refactor

### `git merge`
- **Does:** Join histories; may create merge commit
- **Use:** Integrate teammate branch
- **Mistakes:** Merging without reading conflicts; accepting AI's conflict markers blindly
- **Hackathon:** Merge often in small chunks

### `git rebase`
- **Does:** Replay commits on new base (rewrites commit hashes)
- **Use:** Clean local history before PR
- **Not:** Rebase commits already pushed & shared unless team agrees (force-push risk)
- **Hackathon:** Usually avoid mid-incident; merge is fine

### `git bisect`
- **Does:** Binary search history for the commit that introduced a bug
- **Use:** "Worked yesterday, broken now" across many commits
- **Needs:** A clear good/bad test you can run each step
- **Hackathon:** When you have time (≥30m) and many commits; else check recent AI commits first with `git log`/`show`

---

## The critical five: restore vs revert vs reset vs reflog vs stash

| Tool | Operates on | Creates commit? | Typical intent | Data loss risk |
|---|---|---|---|---|
| **stash** | Dirty work | No (stash entry) | Hide WIP temporarily | Medium if dropped |
| **restore** | Files (worktree/index) | No | Discard or take file versions | High for uncommitted |
| **reset** | Branch tip (+ maybe files) | No (moves tip) | Rewrite local history / unstage | High with `--hard` |
| **revert** | History | **Yes** | Undo publicly | Low |
| **reflog** | Your HEAD history | No | Find lost tips | N/A (recovery aid) |

**Decision shortcut:**

```text
Uncommitted AI mess you want gone?
  → review diff → git restore <files>  (or stash first if unsure)

Committed locally, NOT pushed?
  → git reset --soft/--mixed to keep edits, or --hard if sure
  → OR git revert if you prefer additive history

Committed AND pushed / shared?
  → git revert

"I lost a commit"?
  → git reflog → git switch -c recovery <hash>  (or reset --hard <hash> only if you understand loss)
```

## Always before destructive ops

1. `git status`
2. `git branch backup/$(date +%H%M)` or `git tag recover/pre-reset`
3. State out loud: **what will be lost?**
4. Prefer copy (branch/tag) over hope
