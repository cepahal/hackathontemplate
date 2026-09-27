# Hackathon Incident — API 200 UI nothing


Reuse intermediate 02 but add: TypeScript types say `Activity[]` but runtime JSON is `{items:[]}`.
AI added a zod schema then bypassed it with `as any`.

## Your job
Where is the root cause? What regression guard?
