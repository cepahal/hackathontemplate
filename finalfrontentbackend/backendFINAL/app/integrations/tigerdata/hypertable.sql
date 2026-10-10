-- OPTIONAL: run explicitly after schema.sql, only where TimescaleDB is installed.
-- Skip this file for standard PostgreSQL; all client operations still work.
-- The migration owner must have permission to install the extension.
begin;

create extension if not exists timescaledb;

select create_hypertable(
    'integration_metrics.events',
    by_range('occurred_at'),
    if_not_exists => true,
    migrate_data => true
);

commit;

-- Keep event_ids as a regular table; never delete its rows during event retention.
-- The hypertable's primary key includes occurred_at as required by TimescaleDB.
