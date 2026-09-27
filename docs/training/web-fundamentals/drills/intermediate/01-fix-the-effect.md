# Intermediate 01 — Fix the effect (reason first)

```tsx
function Search({ query }: { query: string }) {
  const [results, setResults] = useState([]);
  useEffect(() => {
    fetch(`/api/search?q=${query}`).then(r => r.json()).then(setResults);
  }, [query, results]);
  return <ul>{results.map(...)}</ul>;
}
```

1. What goes wrong?
2. WHY (event loop / React model)?
3. Minimal fix shape?
4. Remaining race?
