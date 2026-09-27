# Git recovery decision tree

```text
Is the damage committed?
├─ NO (working tree / staged only)
│  ├─ Need it later? → git stash push -u -m "..."
│  ├─ All bad? → git restore . (+ clean -fdn dry-run)
│  └─ Mixed? → git restore -- <bad-paths-only>
│
└─ YES
   ├─ Pushed / shared?
   │  ├─ YES → git revert <sha>   (safe history)
   │  └─ NO
   │     ├─ Keep file edits → git reset --soft HEAD~N
   │     ├─ Keep files unstaged → git reset --mixed HEAD~N
   │     └─ Discard commit+files → git reset --hard HEAD~N
   │           ⚠ state loss risk — branch/tag first
   │
Lost a commit after reset?
└─ git reflog → git branch rescue <good-hash>
```

Before `--hard` or `clean -fd`: say what will be lost.
