create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sapient-class-and-study-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'sapient_project_url') || '/functions/v1/class-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'sapient_push_cron_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
