# Advanced 01 — Promise.all partial failure

```js
const [user, projects, notifs] = await Promise.all([
  api.me(), api.projects(), api.notifications(),
]);
```
Notifications endpoint 500s.

1. What does UI see?
2. Better pattern for demo resilience?
3. How does this connect to failure boundaries?
