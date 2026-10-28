-- Schedules the Algo UPSC background jobs in the USS project.
-- Run once in the SQL editor after the functions are deployed. Needs the
-- pg_cron and pg_net extensions, and the service-role key stored in Vault as
-- 'upsc_service_role_key' (Dashboard > Project Settings > Vault).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Study alerts: every 10 minutes.
select cron.schedule('upsc-alerts', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://vspbbwpehvenmxddgbhm.supabase.co/functions/v1/upsc-alerts',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'upsc_service_role_key')),
    body := '{}'::jsonb)
$$);

-- Weekly report: Sundays 18:00 IST (12:30 UTC).
select cron.schedule('upsc-weekly-report', '30 12 * * 0', $$
  select net.http_post(
    url := 'https://vspbbwpehvenmxddgbhm.supabase.co/functions/v1/upsc-weekly-report',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'upsc_service_role_key')),
    body := '{}'::jsonb)
$$);
