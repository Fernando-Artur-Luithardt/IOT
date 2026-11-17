-- Execute no SQL Editor do SEU projeto, depois de supabase_schema.sql.
-- Preencha canal e chave SOMENTE no Table Editor > integracoes (nao neste arquivo).
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- cron.schedule com o mesmo nome atualiza o agendamento existente.
select cron.schedule(
  'thingspeak_a_cada_minuto', '* * * * *',
  'select public.fn_enviar_thingspeak()'
);

-- Uma resposta HTTP 200 com corpo 0 tambem indica que o ThingSpeak recusou a escrita.
-- Confira os dados no canal e as respostas, nao apenas o sucesso do cron.
-- select status_code, content, timed_out from net._http_response order by created desc limit 5;
