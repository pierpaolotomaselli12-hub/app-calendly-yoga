-- Gestione amministratori dalla dashboard (sezione "Amministratori").
-- Solo chi è già admin può elencare, abilitare e togliere admin.
-- Per abilitare qualcuno, la persona deve avere già un account confermato
-- (password creata da /admin/login e link di conferma aperto).
begin;

create or replace function public.list_admins()
returns table (user_id uuid, email text, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select a.user_id, a.email, a.created_at from public.admins a order by a.created_at;
end $$;

create or replace function public.add_admin(p_email text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_email text;
  v_confirmed timestamptz;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select u.id, lower(u.email), u.email_confirmed_at into v_id, v_email, v_confirmed
  from auth.users u where lower(u.email) = lower(trim(coalesce(p_email, '')));
  if v_id is null then raise exception 'no_account'; end if;
  if v_confirmed is null then raise exception 'not_confirmed'; end if;
  if exists (select 1 from public.admins where user_id = v_id) then raise exception 'already_admin'; end if;
  insert into public.admins (user_id, email) values (v_id, v_email);
  return v_email;
end $$;

create or replace function public.remove_admin(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_user_id = auth.uid() then raise exception 'self'; end if;
  if (select count(*) from public.admins) <= 1 then raise exception 'last_admin'; end if;
  delete from public.admins where user_id = p_user_id;
  if not found then raise exception 'not_found'; end if;
end $$;

revoke all on function public.list_admins()       from public, anon;
revoke all on function public.add_admin(text)      from public, anon;
revoke all on function public.remove_admin(uuid)   from public, anon;
grant execute on function public.list_admins()     to authenticated;
grant execute on function public.add_admin(text)   to authenticated;
grant execute on function public.remove_admin(uuid) to authenticated;

commit;
