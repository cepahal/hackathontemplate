-- Hosted integration verification. Apply both migrations first, then replace the account IDs.
-- Run as project owner. All changes below roll back.
begin;
do $$
declare
  user_a uuid := '00000000-0000-0000-0000-000000000001';
  user_b uuid := '00000000-0000-0000-0000-000000000002';
  suffix text := replace(gen_random_uuid()::text, '-', '');
  object_id text;
  applied boolean;
begin
  if user_a = user_b or (select count(*) from auth.users where id in (user_a,user_b)) <> 2 then
    raise exception 'Configure two different real test Auth user IDs first.';
  end if;
  object_id := 'sub_verify_' || suffix;
  applied := public.apply_billing_event('evt_new_' || suffix, 'test', 200, user_a,
    'subscription', object_id, 'cus_verify', 'active', 'price_verify');
  if not applied then raise exception 'FAILED: first event was not accepted.'; end if;
  applied := public.apply_billing_event('evt_new_' || suffix, 'test', 200, user_a,
    'subscription', object_id, 'cus_verify', 'canceled', 'price_verify');
  if applied then raise exception 'FAILED: duplicate event was applied twice.'; end if;
  perform public.apply_billing_event('evt_old_' || suffix, 'test', 100, user_a,
    'subscription', object_id, 'cus_verify', 'canceled', 'price_verify');
  if (select status from public.billing_subscriptions where id=object_id) <> 'active' then
    raise exception 'FAILED: older event overwrote newer state.';
  end if;
  perform public.apply_billing_event('evt_other_' || suffix, 'test', 300, user_b,
    'subscription', object_id, 'cus_other', 'canceled', 'price_verify');
  if not exists (select 1 from public.billing_subscriptions
    where id=object_id and owner_id=user_a and status='active') then
    raise exception 'FAILED: billing owner or state transferred to a different account.';
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',user_b::text,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if exists (select 1 from public.billing_subscriptions where id=object_id) then
    raise exception 'FAILED: other account could read billing state.';
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',user_a::text,'role','authenticated')::text,true);
  if not exists (select 1 from public.billing_subscriptions where id=object_id) then
    raise exception 'FAILED: owner could not read billing state.';
  end if;
  begin
    update public.billing_subscriptions set status='active' where id=object_id;
    raise exception 'FAILED: client could modify billing state.';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.apply_billing_event('evt_forged_' || suffix,'test',400,user_a,
      'subscription',object_id,'cus_verify','active','price_verify');
    raise exception 'FAILED: client could invoke service-role RPC.';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  raise notice 'Billing isolation, duplicate and event-order checks passed; rolling back.';
end;
$$;
rollback;
