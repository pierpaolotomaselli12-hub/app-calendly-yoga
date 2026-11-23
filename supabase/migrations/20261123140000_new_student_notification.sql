-- Avviso a Laura quando uno studente si registra: la Edge Function send-email
-- (tipo new_student) segna qui la data di invio, così l'avviso parte una volta sola.
begin;
alter table public.students add column if not exists welcome_notified_at timestamptz;
-- gli iscritti già presenti non generano avvisi
update public.students set welcome_notified_at = now() where welcome_notified_at is null;
commit;
