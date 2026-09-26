# 05 — React Mental Model

## WHAT
UI = function of state. **Components** declare UI; React **re-renders** when state/props change.

## WHY
AI loves `useEffect` and duplicate state. Most frontend bugs are **state model** bugs, not CSS.

## HOW
| Concept | Meaning |
|---|---|
| props | inputs from parent (read-only to child) |
| state | component-owned memory (`useState`) |
| render | calling your function → React commits DOM |
| re-render | state/props/context change → run again |
| hook | stateful API usable in function components |
| controlled input | value from state + onChange |
| derived state | compute from existing state/props — don't store copy |
| useEffect | synchronize with **external** systems after render |
| context | avoid deep prop drilling for stable shared values |
| server/client | Server Components vs client interactivity (Next) |

**useEffect rules of thumb:**  
If you can compute during render, don't use effect. Effects for: fetch, subscriptions, DOM APIs, syncing to external store.

### Anti-patterns to recognize
| Smell | Why bad |
|---|---|
| unnecessary state | mirrors props; desyncs |
| infinite useEffect | deps change every render → setState → loop |
| stale state | closure over old state in async |
| fetch race | older response wins |
| prop drilling | pass-through props with no use — consider context/composition |
| bad boundaries | giant component owns all server state |

## EXAMPLE
```tsx
const [q, setQ] = useState("");
const filtered = items.filter(i => i.name.includes(q)); // derived, not state
```

## FAILURE MODE
```tsx
useEffect(() => { setCount(count + 1); }, [count]); // infinite
```

## DEBUGGING
React DevTools: which state changed? Why Did You Render / log renders. Network: did effect fire twice (Strict Mode) causing double POST?

## AI-GENERATED CODE
Red flags: `useEffect(() => fetch...,)` missing cleanup/abort; copying props into state; context for everything; fetching in every child.
