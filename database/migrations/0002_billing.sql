-- Apply after 0001_core.sql. All writes are server-side through the service-role RPC.
begin;
create table public.webhook_events (
  id text primary key,
  event_type text not null,
  event_created bigint not null,
  processed_at timestamptz not null default now()
);
create table public.billing_subscriptions (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id text,
  status text not null,
  price_id text,
  last_event_created bigint not null,
  updated_at timestamptz not null default now()
);
create table public.billing_orders (like public.billing_subscriptions including all);
alter table public.billing_orders add constraint billing_orders_owner_fk
  foreign key (owner_id) references auth.users(id) on delete cascade;
alter table public.webhook_events enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_orders enable row level security;
revoke all on public.webhook_events, public.billing_subscriptions, public.billing_orders from anon, authenticated;
grant select on public.billing_subscriptions, public.billing_orders to authenticated;
grant all on public.webhook_events, public.billing_subscriptions, public.billing_orders to service_role;
create policy own_subscriptions on public.billing_subscriptions for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy own_orders on public.billing_orders for select to authenticated
  using ((select auth.uid()) = owner_id);
create index billing_subscriptions_owner_idx on public.billing_subscriptions(owner_id);
create index billing_orders_owner_idx on public.billing_orders(owner_id);

create function public.apply_billing_event(
  p_event_id text, p_event_type text, p_created bigint, p_owner_id uuid,
  p_kind text, p_object_id text, p_customer_id text, p_status text, p_price_id text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare inserted_count integer;
begin
  if p_kind not in ('subscription','order') then raise exception 'Unsupported billing kind'; end if;
  insert into public.webhook_events(id,event_type,event_created)
    values(p_event_id,p_event_type,p_created) on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return false; end if;
  if p_kind = 'subscription' then
    insert into public.billing_subscriptions(id,owner_id,customer_id,status,price_id,last_event_created)
      values(p_object_id,p_owner_id,p_customer_id,p_status,p_price_id,p_created)
      on conflict(id) do update set status=excluded.status, customer_id=excluded.customer_id,
        price_id=excluded.price_id, last_event_created=excluded.last_event_created, updated_at=now()
      where public.billing_subscriptions.owner_id=excluded.owner_id
        and public.billing_subscriptions.last_event_created <= excluded.last_event_created;
  else
    insert into public.billing_orders(id,owner_id,customer_id,status,price_id,last_event_created)
      values(p_object_id,p_owner_id,p_customer_id,p_status,p_price_id,p_created)
      on conflict(id) do update set status=excluded.status, customer_id=excluded.customer_id,
        price_id=excluded.price_id, last_event_created=excluded.last_event_created, updated_at=now()
      where public.billing_orders.owner_id=excluded.owner_id
        and public.billing_orders.last_event_created <= excluded.last_event_created;
  end if;
  return true;
end;
$$;
revoke all on function public.apply_billing_event(text,text,bigint,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.apply_billing_event(text,text,bigint,uuid,text,text,text,text,text) to service_role;
commit;
