# Hackathon Incident — Migration broke dashboard


## Scene
Migration dropped `activity.meta` JSON column; API still selects it.
Dashboard blank with 500s.

Demo in 90 minutes. New column was for a non-demo feature.

## Your job
Safest recovery path ranked; state data loss risks of down-migration vs forward-fix.
