-- Test della migrazione di sicurezza. Va eseguito DOPO la migrazione e DENTRO
-- una transazione che termina con ROLLBACK: crea utenti e dati finti.
-- Ogni riga di risultato: passo, atteso, ottenuto.

create temp table t (n serial, step text, expected text, got text);
grant all on t to anon, authenticated;
grant usage on sequence t_n_seq to anon, authenticated;

insert into auth.users (id, instance_id, aud, role, email)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test.studente@example.com'),
       ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test.admin@example.com'),
       ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test.altro@example.com');
insert into public.admins (user_id, email) values ('22222222-2222-2222-2222-222222222222', 'test.admin@example.com');
insert into public.slots (id, title, type, date, time, duration, max_participants, notes)
values ('33333333-3333-3333-3333-333333333333', 'TEST', 'test', current_date + 7, '18:00', 60, 1, '');

create or replace function pg_temp.as_user(uid text, email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.try(sql text) returns text language plpgsql as $$
declare r text;
begin
  execute sql into r;
  return coalesce(r, 'ok');
exception when others then
  return 'ERR:' || sqlerrm;
end $$;

-- ── Visitatore anonimo ──
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into t (step, expected, got) values
 ('anon legge studenti', '0', (select count(*)::text from public.students));
insert into t (step, expected, got) values
 ('anon legge prenotazioni', '0', (select count(*)::text from public.bookings));
insert into t (step, expected, got) values
 ('anon legge lezioni', '>0', (select count(*)::text from public.slots));
insert into t (step, expected, got) values
 ('anon conteggi', '>0', (select count(*)::text from public.slot_counts()));
insert into t (step, expected, got) values
 ('anon cancella lezioni', 'ERR o 0', pg_temp.try('with d as (delete from public.slots returning 1) select count(*)::text from d'));
insert into t (step, expected, got) values
 ('anon si regala crediti', 'ERR o 0', pg_temp.try('with u as (update public.students set lesson_credits = 99 returning 1) select count(*)::text from u'));
insert into t (step, expected, got) values
 ('anon prenota', 'ERR', pg_temp.try($q$select public.book_slot('33333333-3333-3333-3333-333333333333')::text$q$));
reset role;

-- ── Studente ──
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'test.studente@example.com');
insert into t (step, expected, got) values
 ('studente si registra', 'ok', pg_temp.try($q$select (public.register_student('Test','Studente','333')).email$q$));
insert into t (step, expected, got) values
 ('studente vede solo sé', '1', (select count(*)::text from public.students));
insert into t (step, expected, got) values
 ('studente non è admin', 'false', (select public.is_admin()::text));
insert into t (step, expected, got) values
 ('prenota senza crediti', 'ERR no_credits', pg_temp.try($q$select public.book_slot('33333333-3333-3333-3333-333333333333')::text$q$));
insert into t (step, expected, got) values
 ('si regala crediti', '0', pg_temp.try('with u as (update public.students set lesson_credits = 99 returning 1) select count(*)::text from u'));
insert into t (step, expected, got) values
 ('crea lezione', 'ERR', pg_temp.try($q$insert into public.slots (title,type,date,time,duration,max_participants,notes) values ('x','x',current_date,'10:00',60,1,'') returning 'inserita'$q$));
reset role;

-- ── Admin ricarica i crediti ──
select pg_temp.as_user('22222222-2222-2222-2222-222222222222', 'test.admin@example.com');
insert into t (step, expected, got) values
 ('admin è admin', 'true', (select public.is_admin()::text));
insert into t (step, expected, got) values
 ('admin vede tutti gli studenti', '>=3', (select count(*)::text from public.students));
insert into t (step, expected, got) values
 ('admin dà 2 crediti', '1', pg_temp.try($q$with u as (update public.students set lesson_credits = 2 where email = 'test.studente@example.com' returning 1) select count(*)::text from u$q$));
reset role;

-- ── Studente prenota e disdice ──
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'test.studente@example.com');
insert into t (step, expected, got) values
 ('prenota', 'uuid', pg_temp.try($q$select public.book_slot('33333333-3333-3333-3333-333333333333')::text$q$));
insert into t (step, expected, got) values
 ('crediti dopo prenotazione', '1', (select lesson_credits::text from public.students));
insert into t (step, expected, got) values
 ('prenota di nuovo', 'ERR already_booked', pg_temp.try($q$select public.book_slot('33333333-3333-3333-3333-333333333333')::text$q$));
insert into t (step, expected, got) values
 ('vede la sua prenotazione', '1', (select count(*)::text from public.bookings));
reset role;

-- ── Un altro studente: lezione piena, non vede i dati altrui ──
select pg_temp.as_user('44444444-4444-4444-4444-444444444444', 'test.altro@example.com');
insert into t (step, expected, got) values
 ('altro si registra', 'ok', pg_temp.try($q$select (public.register_student('Altro','Studente','444')).email$q$));
insert into t (step, expected, got) values
 ('altro vede prenotazioni altrui', '0', (select count(*)::text from public.bookings));
insert into t (step, expected, got) values
 ('conteggio pubblico posti', '1', (select booked::text from public.slot_counts() where slot_id = '33333333-3333-3333-3333-333333333333'));
insert into t (step, expected, got) values
 ('altro disdice prenotazione altrui', 'ERR not_found', pg_temp.try($q$select public.cancel_booking((select id from public.bookings limit 1))::text$q$));
reset role;

-- ── Il primo studente disdice: credito restituito ──
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'test.studente@example.com');
insert into t (step, expected, got) values
 ('disdice', 'ok', pg_temp.try($q$select public.cancel_booking((select id from public.bookings where email = 'test.studente@example.com' limit 1))::text$q$));
insert into t (step, expected, got) values
 ('crediti dopo disdetta', '2', (select lesson_credits::text from public.students));
reset role;

select n, step, expected, got from t order by n;
