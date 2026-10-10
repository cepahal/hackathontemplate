-- Explicit operator migration for a dedicated Tiger Data or PostgreSQL database.
-- Never applied by the adapter or application startup. Run as the schema owner.
begin;

create schema if not exists integration_metrics;
revoke all on schema integration_metrics from public;

-- A regular table guarantees global event-ID uniqueness even with a hypertable below.
create table if not exists integration_metrics.event_ids (
    event_id uuid primary key,
    occurred_at timestamptz not null,
    unique (event_id, occurred_at)
);

create table if not exists integration_metrics.events (
    event_id uuid not null,
    occurred_at timestamptz not null,
    source text not null check (source ~ '^[a-z][a-z0-9_]{0,63}$'),
    kind text not null check (kind ~ '^[a-z][a-z0-9_]{0,63}$'),
    outcome text not null check (outcome in ('success', 'failure', 'pending')),
    duration_ms integer check (duration_ms between 0 and 86400000),
    primary key (event_id, occurred_at),
    foreign key (event_id, occurred_at) references integration_metrics.event_ids (event_id, occurred_at)
);

create index if not exists integration_events_source_time_idx
    on integration_metrics.events (source, occurred_at, event_id);

revoke all on integration_metrics.event_ids, integration_metrics.events from public;

commit;

-- Optional dedicated application role grants (replace the role name explicitly):
-- grant usage on schema integration_metrics to your_application_role;
-- grant select, insert on integration_metrics.event_ids, integration_metrics.events to your_application_role;
-- Do not grant update/delete or expose this schema through a public client/API.
