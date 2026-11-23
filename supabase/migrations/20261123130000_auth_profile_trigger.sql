-- Con la conferma email attiva, la registrazione non dà subito una sessione:
-- il profilo studente si crea (o si collega) quando l'email viene confermata.
-- Nome, cognome e telefono arrivano dai metadati passati a signUp().
-- Gli account senza nome (es. l'admin) non creano un profilo studente.

begin;

create or replace function public.handle_confirmed_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(new.email);
  v_first text := trim(coalesce(new.raw_user_meta_data ->> 'first_name', ''));
  v_last  text := trim(coalesce(new.raw_user_meta_data ->> 'last_name', ''));
  v_phone text := trim(coalesce(new.raw_user_meta_data ->> 'phone', ''));
begin
  if new.email_confirmed_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then return new; end if;
  if exists (select 1 from public.students where user_id = new.id) then return new; end if;

  -- profilo già esistente con la stessa email e non collegato: lo collego (mantiene i crediti)
  update public.students set user_id = new.id
  where lower(email) = v_email and user_id is null;
  if found then return new; end if;

  if v_first <> '' and v_last <> '' then
    insert into public.students (first_name, last_name, email, phone, user_id)
    values (left(v_first, 80), left(v_last, 80), v_email, left(v_phone, 40), new.id)
    on conflict (email) do nothing;
  end if;
  return new;
end $$;

revoke all on function public.handle_confirmed_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.handle_confirmed_user();

commit;
