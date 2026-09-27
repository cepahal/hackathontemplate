# AI snippets for reading drills

## Snippet A — React fetch
```tsx
useEffect(() => {
  fetch(`/api/projects/${projectId}`)
    .then(r => r.json())
    .then(setProject);
}, [projectId]);
```

## Snippet B — FastAPI get by id
```python
@app.get("/api/projects/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Project).filter(Project.id == project_id).first()
```

## Snippet C — create with client user_id
```python
class ProjectIn(BaseModel):
    title: str
    user_id: int

@app.post("/api/projects")
def create(p: ProjectIn, db: Session = Depends(get_db)):
    row = Project(title=p.title, owner_id=p.user_id)
    db.add(row); db.commit(); return row
```

## Snippet D — webhook
```python
@app.post("/webhooks/stripe")
async def stripe(request: Request, db: Session = Depends(get_db)):
    event = await request.json()
    mark_paid(db, event["data"]["object"]["id"])
    return {"ok": True}
```

Use with `drills/beginner/02-read-snippet-b.md` etc.
