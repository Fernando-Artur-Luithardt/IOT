select * from public.v_estado_atual where equipe = '1038854_1028775';
select * from public.v_ultima_leitura where equipe = '1038854_1028775';
select especie, sensor, valor, unidade, medido_em at time zone 'America/Sao_Paulo' as hora
from public.leituras
where equipe = '1038854_1028775' and medido_em > now() - interval '30 minutes'
order by medido_em;
select * from public.v_thingspeak_payload where equipe = '1038854_1028775';
select 'leituras' as tabela, count(*) from public.leituras
union all select 'estados_atuadores', count(*) from public.estados_atuadores
union all select 'status_placa', count(*) from public.status_placa
union all select 'estados_gerais', count(*) from public.estados_gerais;
-- Consultas sem segredos: nao exportar a tabela integracoes.
