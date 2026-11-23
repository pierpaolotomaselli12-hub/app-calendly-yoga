-- ════════════════════════════════════════════════════════════════════
-- Sicurezza: Supabase Auth + RLS + funzioni per prenotazioni e crediti
-- ════════════════════════════════════════════════════════════════════
-- Prima: tutte le tabelle erano leggibili/modificabili/cancellabili da
-- chiunque con la chiave pubblica; admin = password nel JavaScript;
-- login studente = sola email; crediti scalati dal browser.
--
-- Dopo:
--   • slots, events: lettura pubblica, scrittura solo admin
--   • bookings, waitlist, event_bookings, event_waitlist, students:
--     ogni studente vede solo i propri dati, l'admin vede tutto,
--     scrittura diretta solo admin
--   • le azioni degli studenti passano da funzioni SECURITY DEFINER
--     che controllano posti, crediti e scadenze lato server
--   • i posti occupati si leggono con slot_counts() / event_counts()
--     (solo numeri, nessun dato personale)
--   • admin = utenti Auth elencati nella tabella admins (per user_id)
-- ════════════════════════════════════════════════════════════════════

begin;

-- ── Tabelle di supporto ─────────────────────────────────────────────

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- nessuna policy: la tabella si legge solo tramite is_admin()

alter table public.students
  add column if not exists user_id uuid unique references auth.users(id) on delete set null;

-- ── Funzioni di supporto ────────────────────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null
     and exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- email dello studente collegato all'utente loggato (null se non registrato)
create or replace function public.my_student_email()
returns text
language sql stable security definer set search_path = public
as $$
  select lower(s.email) from public.students s where s.user_id = auth.uid();
$$;

-- ora italiana, per le regole di scadenza
create or replace function public.now_rome()
returns timestamp
language sql stable
as $$ select (now() at time zone 'Europe/Rome'); $$;

-- ── Policy: via tutte quelle vecchie ────────────────────────────────

do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('slots','events','bookings','waitlist','event_bookings','event_waitlist','students','admins')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.slots          enable row level security;
alter table public.events         enable row level security;
alter table public.bookings       enable row level security;
alter table public.waitlist       enable row level security;
alter table public.event_bookings enable row level security;
alter table public.event_waitlist enable row level security;
alter table public.students       enable row level security;

-- slots / events: lettura pubblica, scrittura admin
create policy "slots_select_all"   on public.slots  for select to anon, authenticated using (true);
create policy "slots_admin_write"  on public.slots  for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "events_select_all"  on public.events for select to anon, authenticated using (true);
create policy "events_admin_write" on public.events for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- prenotazioni e liste d'attesa: i propri dati o admin
create policy "bookings_select_own_or_admin" on public.bookings for select to authenticated
  using (public.is_admin() or lower(email) = public.my_student_email());
create policy "bookings_admin_write" on public.bookings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "waitlist_select_own_or_admin" on public.waitlist for select to authenticated
  using (public.is_admin() or lower(email) = public.my_student_email());
create policy "waitlist_admin_write" on public.waitlist for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "event_bookings_select_own_or_admin" on public.event_bookings for select to authenticated
  using (public.is_admin() or lower(email) = public.my_student_email());
create policy "event_bookings_admin_write" on public.event_bookings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "event_waitlist_select_own_or_admin" on public.event_waitlist for select to authenticated
  using (public.is_admin() or lower(email) = public.my_student_email());
create policy "event_waitlist_admin_write" on public.event_waitlist for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- studenti: il proprio profilo o admin
create policy "students_select_own_or_admin" on public.students for select to authenticated
  using (public.is_admin() or user_id = auth.uid());
create policy "students_admin_write" on public.students for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── Conteggi pubblici (solo numeri) ─────────────────────────────────

create or replace function public.slot_counts()
returns table (slot_id uuid, booked int, waiting int)
language sql stable security definer set search_path = public
as $$
  select s.id,
         (select count(*) from public.bookings b where b.slot_id = s.id)::int,
         (select count(*) from public.waitlist w where w.slot_id = s.id)::int
  from public.slots s;
$$;

create or replace function public.event_counts()
returns table (event_id uuid, booked int, waiting int)
language sql stable security definer set search_path = public
as $$
  select e.id,
         (select count(*) from public.event_bookings b where b.event_id = e.id)::int,
         (select count(*) from public.event_waitlist w where w.event_id = e.id)::int
  from public.events e;
$$;

-- ── Registrazione studente ──────────────────────────────────────────
-- Collega l'utente Auth al profilo studente. Se esiste già un profilo
-- con la stessa email e non ancora collegato (studenti creati prima di
-- questa migrazione o dall'admin), lo collega mantenendo i crediti.

create or replace function public.register_student(p_first_name text, p_last_name text, p_phone text)
returns public.students
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_row public.students;
begin
  if v_uid is null or v_email = '' then raise exception 'not_authenticated'; end if;
  if length(trim(coalesce(p_first_name,''))) = 0 or length(trim(coalesce(p_last_name,''))) = 0 then
    raise exception 'invalid_input';
  end if;

  select * into v_row from public.students where user_id = v_uid;
  if found then return v_row; end if;

  select * into v_row from public.students where lower(email) = v_email for update;
  if found then
    if v_row.user_id is not null then raise exception 'email_taken'; end if;
    update public.students set user_id = v_uid where id = v_row.id returning * into v_row;
    return v_row;
  end if;

  insert into public.students (first_name, last_name, email, phone, user_id)
  values (left(trim(p_first_name), 80), left(trim(p_last_name), 80), v_email, left(trim(coalesce(p_phone,'')), 40), v_uid)
  returning * into v_row;
  return v_row;
end $$;

-- ── Prenotazione lezione (scala 1 credito) ──────────────────────────

create or replace function public.book_slot(p_slot_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_student public.students;
  v_slot public.slots;
  v_count int;
  v_id uuid;
begin
  select * into v_student from public.students where user_id = auth.uid() for update;
  if not found then raise exception 'not_registered'; end if;

  select * into v_slot from public.slots where id = p_slot_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_slot.date < public.now_rome()::date then raise exception 'past'; end if;

  if exists (select 1 from public.bookings where slot_id = p_slot_id and lower(email) = lower(v_student.email)) then
    raise exception 'already_booked';
  end if;

  select count(*) into v_count from public.bookings where slot_id = p_slot_id;
  if v_count >= v_slot.max_participants then raise exception 'full'; end if;
  if v_student.lesson_credits <= 0 then raise exception 'no_credits'; end if;

  insert into public.bookings (slot_id, first_name, last_name, email, phone)
  values (p_slot_id, v_student.first_name, v_student.last_name, v_student.email, v_student.phone)
  returning id into v_id;

  update public.students set lesson_credits = lesson_credits - 1 where id = v_student.id;
  return v_id;
end $$;

-- ── Disdetta lezione (entro le 10:00 del giorno, restituisce il credito) ──

create or replace function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_student public.students;
  v_booking public.bookings;
  v_slot public.slots;
begin
  select * into v_student from public.students where user_id = auth.uid() for update;
  if not found then raise exception 'not_registered'; end if;

  select * into v_booking from public.bookings
  where id = p_booking_id and lower(email) = lower(v_student.email);
  if not found then raise exception 'not_found'; end if;

  select * into v_slot from public.slots where id = v_booking.slot_id;
  if public.now_rome() >= (v_slot.date + time '10:00') then raise exception 'too_late'; end if;

  delete from public.bookings where id = v_booking.id;
  update public.students set lesson_credits = lesson_credits + 1 where id = v_student.id;
end $$;

-- ── Lista d'attesa lezione ──────────────────────────────────────────

create or replace function public.join_waitlist(p_slot_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_student public.students;
  v_id uuid;
begin
  select * into v_student from public.students where user_id = auth.uid();
  if not found then raise exception 'not_registered'; end if;
  if not exists (select 1 from public.slots where id = p_slot_id and date >= public.now_rome()::date) then
    raise exception 'not_found';
  end if;
  if exists (select 1 from public.waitlist where slot_id = p_slot_id and lower(email) = lower(v_student.email)) then
    raise exception 'already_waitlisted';
  end if;
  insert into public.waitlist (slot_id, first_name, last_name, email, phone)
  values (p_slot_id, v_student.first_name, v_student.last_name, v_student.email, v_student.phone)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.leave_waitlist(p_entry_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.waitlist where id = p_entry_id and lower(email) = public.my_student_email();
  if not found then raise exception 'not_found'; end if;
end $$;

-- ── Eventi (nessun credito, come prima) ─────────────────────────────

create or replace function public.book_event(p_event_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_student public.students;
  v_event public.events;
  v_count int;
  v_id uuid;
begin
  select * into v_student from public.students where user_id = auth.uid();
  if not found then raise exception 'not_registered'; end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_event.date < public.now_rome()::date then raise exception 'past'; end if;
  if exists (select 1 from public.event_bookings where event_id = p_event_id and lower(email) = lower(v_student.email)) then
    raise exception 'already_booked';
  end if;
  select count(*) into v_count from public.event_bookings where event_id = p_event_id;
  if v_count >= v_event.max_participants then raise exception 'full'; end if;
  insert into public.event_bookings (event_id, first_name, last_name, email, phone)
  values (p_event_id, v_student.first_name, v_student.last_name, v_student.email, v_student.phone)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.cancel_event_booking(p_booking_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_booking public.event_bookings;
  v_event public.events;
begin
  select * into v_booking from public.event_bookings
  where id = p_booking_id and lower(email) = public.my_student_email();
  if not found then raise exception 'not_found'; end if;
  select * into v_event from public.events where id = v_booking.event_id;
  if public.now_rome() >= (v_event.date + time '10:00') then raise exception 'too_late'; end if;
  delete from public.event_bookings where id = v_booking.id;
end $$;

create or replace function public.join_event_waitlist(p_event_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_student public.students;
  v_id uuid;
begin
  select * into v_student from public.students where user_id = auth.uid();
  if not found then raise exception 'not_registered'; end if;
  if not exists (select 1 from public.events where id = p_event_id and date >= public.now_rome()::date) then
    raise exception 'not_found';
  end if;
  if exists (select 1 from public.event_waitlist where event_id = p_event_id and lower(email) = lower(v_student.email)) then
    raise exception 'already_waitlisted';
  end if;
  insert into public.event_waitlist (event_id, first_name, last_name, email, phone)
  values (p_event_id, v_student.first_name, v_student.last_name, v_student.email, v_student.phone)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.leave_event_waitlist(p_entry_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.event_waitlist where id = p_entry_id and lower(email) = public.my_student_email();
  if not found then raise exception 'not_found'; end if;
end $$;

-- ── Permessi sulle funzioni ─────────────────────────────────────────

revoke all on function public.is_admin()                       from public;
revoke all on function public.my_student_email()               from public;
revoke all on function public.slot_counts()                    from public;
revoke all on function public.event_counts()                   from public;
revoke all on function public.register_student(text,text,text) from public;
revoke all on function public.book_slot(uuid)                  from public;
revoke all on function public.cancel_booking(uuid)             from public;
revoke all on function public.join_waitlist(uuid)              from public;
revoke all on function public.leave_waitlist(uuid)             from public;
revoke all on function public.book_event(uuid)                 from public;
revoke all on function public.cancel_event_booking(uuid)       from public;
revoke all on function public.join_event_waitlist(uuid)        from public;
revoke all on function public.leave_event_waitlist(uuid)       from public;

-- Supabase concede di default EXECUTE ad anon: lo togliamo dove serve il login
do $$
declare f text;
begin
  foreach f in array array[
    'public.is_admin()','public.my_student_email()','public.register_student(text,text,text)',
    'public.book_slot(uuid)','public.cancel_booking(uuid)','public.join_waitlist(uuid)','public.leave_waitlist(uuid)',
    'public.book_event(uuid)','public.cancel_event_booking(uuid)','public.join_event_waitlist(uuid)','public.leave_event_waitlist(uuid)'
  ] loop
    execute format('revoke all on function %s from anon', f);
  end loop;
end $$;

grant execute on function public.slot_counts()  to anon, authenticated;
grant execute on function public.event_counts() to anon, authenticated;
grant execute on function public.is_admin()                       to authenticated;
grant execute on function public.my_student_email()               to authenticated;
grant execute on function public.register_student(text,text,text) to authenticated;
grant execute on function public.book_slot(uuid)                  to authenticated;
grant execute on function public.cancel_booking(uuid)             to authenticated;
grant execute on function public.join_waitlist(uuid)              to authenticated;
grant execute on function public.leave_waitlist(uuid)             to authenticated;
grant execute on function public.book_event(uuid)                 to authenticated;
grant execute on function public.cancel_event_booking(uuid)       to authenticated;
grant execute on function public.join_event_waitlist(uuid)        to authenticated;
grant execute on function public.leave_event_waitlist(uuid)       to authenticated;

-- realtime anche per gli eventi (prima mancavano)
do $$
begin
  begin alter publication supabase_realtime add table public.events;         exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.event_bookings; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.event_waitlist; exception when duplicate_object then null; end;
end $$;

commit;
