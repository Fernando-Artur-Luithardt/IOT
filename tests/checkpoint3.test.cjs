const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const monitor = require('../cp3/nodered/lib/monitor.cjs');
const db = require('../cp3/nodered/lib/persistence.cjs');
const bridge = require('../cp3/nodered/lib/bridge.cjs');
const { build } = require('../cp3/nodered/build-flow.cjs');
const { prepare, FINAL_HOST } = require('../cp3/nodered/prepare.cjs');
const team = '1038854_1028775';
const root = monitor.prefix(team);
const start = Date.parse('2026-11-16T15:00:00Z');
const message = (species, suffix, payload, retain=false) => ({topic:`${root}${species}/${suffix}`,payload:typeof payload==='object'?JSON.stringify(payload):payload,retain});
const sensor = (state, slug, name, value, now=start) => monitor.apply(state,message(slug,`sensor/${name}`,{valor:value,unidade:name==='temperatura'?'°C':'%'}),now);
const actuator = (state, slug, name, on, now=start, retain=false) => monitor.apply(state,message(slug,`atuador/${name}`,{estado:on?'ligado':'desligado'},retain),now);
function ready() {
  const state=monitor.create(team);
  monitor.apply(state,{kind:'broker',connected:true},start);
  monitor.apply(state,{topic:root+'ponte/status',payload:'online'},start);
  for (const slug of Object.keys(monitor.SCENARIOS)) {
    monitor.apply(state,message(slug,'status','online'),start);
    for (const rule of monitor.SCENARIOS[slug].rules) {
      sensor(state,slug,rule.sensor,rule.op==='<'?rule.limit:rule.limit,start);
      actuator(state,slug,rule.actuator,false,start);
    }
  }
  monitor.tick(state,start);
  return state;
}
test('validação estrita do prefixo, espécies, unidades, números e tópicos',()=>{
  const good=message('inga','sensor/temperatura',{valor:30,unidade:'°C'});
  assert.equal(monitor.parse(good,team).value,30);
  const bad=[
    {...good,topic:good.topic.replace('t28','t27')}, {...good,topic:good.topic.replace(team,'999_888')},
    {...good,topic:root+'__proto__/status',payload:'online'}, {...good,payload:'{'},
    {...good,payload:'null'}, {...good,payload:'{"valor":"30","unidade":"°C"}'},
    {...good,payload:'{"valor":true,"unidade":"°C"}'}, {...good,payload:{valor:Infinity,unidade:'°C'}},
    {...good,payload:{valor:30,unidade:'<script>'}}, {...good,retain:true},
    message('inga','sensor/umidade-solo',{valor:101,unidade:'%'}),
    message('inga','atuador/sombreamento',{estado:'ligado'}),message('inga','status','ONLINE')
  ];
  for(const m of bad) assert.equal(monitor.parse(m,team),null);
  assert.equal(monitor.parse(good,'a/#'),null);
});
test('limiares oficiais e estados NORMAL/ATUANDO nas duas espécies',()=>{
  const state=ready();
  for (const s of Object.values(state.species)) assert.equal(s.general.value,'NORMAL');
  sensor(state,'aroeira-vermelha','umidade-solo',29.9);
  actuator(state,'aroeira-vermelha','irrigacao',true);
  sensor(state,'inga','temperatura',30.1); actuator(state,'inga','ventilacao',true);
  monitor.tick(state,start);
  for (const s of Object.values(state.species)) assert.equal(s.general.value,'ATUANDO');
  assert.equal(monitor.SCENARIOS.inga.rules[1].limit,30);
});
test('ALERTA exige divergência por MAIS de 2 intervalos; leitura velha tem prioridade',()=>{
  const state=ready();
  sensor(state,'inga','temperatura',31); monitor.tick(state,start);
  assert.notEqual(state.species.inga.general.value,'ALERTA');
  for(const offset of [8000,16000]) {
    sensor(state,'inga','temperatura',31,start+offset);sensor(state,'inga','umidade-solo',60,start+offset);
    monitor.tick(state,start+offset);
  }
  assert.notEqual(state.species.inga.general.value,'ALERTA');
  monitor.tick(state,start+16001);
  assert.equal(state.species.inga.general.value,'ALERTA');
  actuator(state,'inga','ventilacao',true,start+17000);monitor.tick(state,start+17000);
  assert.equal(state.species.inga.general.value,'ATUANDO');
  monitor.tick(state,start+40001);
  assert.equal(state.species.inga.general.value,'SEM DADOS');
});
test('sensor faltante ou atrasado, status offline e queda do broker não aparentam atualidade',()=>{
  const state=ready();
  sensor(state,'inga','umidade-solo',60,start+24001);monitor.tick(state,start+24001);
  assert.equal(state.species.inga.general.value,'SEM DADOS');
  assert.equal(monitor.snapshot(state,'inga',start+24001).sensors[1].current,false);
  monitor.apply(state,message('inga','status','offline'),start+25000);
  monitor.apply(state,{kind:'broker',connected:false},start+25000);monitor.tick(state,start+25000);
  assert.equal(state.species.inga.general.value,'OFFLINE');
  assert.ok(monitor.snapshot(state,'inga',start+25000).actuators.every(a=>!a.current));
  assert.equal(state.species['aroeira-vermelha'].general.value,'SEM DADOS');
});
test('reconexão exige amostras e estados atuais; mensagens retidas não criam leituras novas',()=>{
  const state=ready();
  monitor.apply(state,{kind:'broker',connected:false},start+1000);
  monitor.apply(state,{kind:'broker',connected:true},start+2000);
  monitor.tick(state,start+2000);
  assert.equal(state.species.inga.general.value,'SEM DADOS');
  assert.equal(monitor.snapshot(state,'inga',start+2000).sensors[0].current,false);
  for(const rule of monitor.SCENARIOS.inga.rules) {
    sensor(state,'inga',rule.sensor,rule.limit,start+3000);
    actuator(state,'inga',rule.actuator,false,start+3000,true);
  }
  monitor.tick(state,start+3000);
  assert.equal(state.species.inga.general.value,'NORMAL');
  assert.ok(monitor.snapshot(state,'inga',start+3000).actuators.every(a=>a.observed && a.since===start+3000));
});
test('nenhum valor zero é inventado antes da primeira amostra',()=>{
  const state=monitor.create(team); monitor.tick(state,start);
  for(const slug of Object.keys(monitor.SCENARIOS)) {
    const view=monitor.snapshot(state,slug,start);
    assert.ok(view.sensors.every(s=>s.value===null && s.age===null));
    assert.ok(view.actuators.every(a=>a.value===null && !a.current));
    assert.equal(view.general.value,'SEM DADOS');
  }
});
test('histórico mantém 30 minutos, sobreviverá ao contexto e não muda com troca de aba',()=>{
  const state=ready();
  for(let i=1;i<=300;i++) sensor(state,'inga','temperatura',20+i/100,start+i*8000);
  monitor.tick(state,start+300*8000);
  const restored=JSON.parse(JSON.stringify(state));
  const before=JSON.stringify(restored.species.inga.history);
  monitor.snapshot(restored,'aroeira-vermelha',start+300*8000);
  const view=monitor.snapshot(restored,'inga',start+300*8000);
  const points=view.sensors.find(s=>s.sensor==='temperatura').history;
  assert.equal(points.length,226);
  assert.equal(points.at(-1).x-points[0].x,monitor.WINDOW);
  assert.equal(JSON.stringify(restored.species.inga.history),before);
});
test('eventos: toda leitura, mas somente mudanças de estado/status/estado geral',()=>{
  const state=ready(); const count=state.outbox.length;
  actuator(state,'inga','ventilacao',false,start+1000,true);
  monitor.apply(state,message('inga','status','online',true),start+1000);
  monitor.tick(state,start+1000);
  assert.equal(state.outbox.length,count);
  sensor(state,'inga','temperatura',30,start+2000);
  assert.equal(state.outbox.length,count+1);
  assert.equal(new Set(state.outbox.map(v=>v.row.evento_id)).size,state.outbox.length);
});
test('ponte valida namespace, preserva retain e não repassa telemetria antiga após falha',()=>{
  const state=bridge.create();
  bridge.route(state,{kind:'local-link',connected:true},team);
  const old=message('inga','atuador/irrigacao',{estado:'ligado'});
  assert.deepEqual(bridge.route(state,old,team),[]);
  bridge.route(state,message('inga','sensor/temperatura',{valor:31,unidade:'°C'}),team);
  const sync=bridge.route(state,{kind:'cloud-link',connected:true},team);
  assert.equal(sync.length,2);assert.equal(sync[0].topic,root+'ponte/status');
  assert.equal(sync[1].retain,true);
  assert.deepEqual(bridge.route(state,{...old,topic:'unidavi/iot/t28/999/inga/status'},team),[]);
  assert.deepEqual(bridge.route(state,{topic:root+'ponte/status',payload:'offline'},team),[]);
  assert.equal(bridge.route(state,{kind:'local-link',connected:false},team)[0].payload,'offline');
});
test('chave pública, URLs HTTPS e retorno mínimo; chaves secretas são recusadas',()=>{
  const c=db.configuration('https://example.supabase.co','sb_publishable_exemplo');
  assert.equal(c.headers.Authorization,undefined);
  assert.match(c.headers.Prefer,/return=minimal/);
  const jwt=role=>`eyJ.${Buffer.from(JSON.stringify({role})).toString('base64url')}.example`;
  assert.match(db.configuration('https://example.supabase.co',jwt('anon')).headers.Authorization,/^Bearer/);
  for(const key of ['sb_secret_exemplo',jwt('service_role'),'invalida']) assert.throws(()=>db.configuration('https://example.supabase.co',key));
  assert.throws(()=>db.configuration('http://example.supabase.co','sb_publishable_exemplo'));
});
test('erro de persistência conserva fila e IDs, repete e confirma sem perder eventos novos',()=>{
  const state=ready(), key='sb_publishable_exemplo', url='https://example.supabase.co';
  const req=db.next(state,start,url,key), ids=req.cp3Ids;
  assert.equal(req.followRedirects,false);assert.equal(req.requestTimeout,10000);
  const n=state.outbox.length;
  db.acknowledge(state,{...req,statusCode:503,payload:'segredo-que-nao-deve-aparecer'},start+100);
  assert.equal(state.outbox.length,n);assert.ok(!state.db.includes('segredo'));
  assert.equal(db.next(state,start+500,url,key),null);
  const retry=db.next(state,start+10000,url,key);
  assert.deepEqual(retry.cp3Ids,ids);
  sensor(state,'inga','temperatura',29,start+10001);
  db.acknowledge(state,{...retry,statusCode:201},start+10002);
  assert.equal(state.outbox.length,n-ids.length+1);
  assert.equal(state.failures,0);
});
test('fluxo exportado, configurações TLS e dependências do grafo',()=>{
  const flows=build();
  assert.deepEqual(flows,JSON.parse(fs.readFileSync(path.join(__dirname,'../cp3/nodered/flows.json'))));
  const ids=new Set(flows.map(n=>n.id)); assert.equal(ids.size,flows.length);
  for(const node of flows) for(const id of (node.wires||[]).flat()) assert.ok(ids.has(id),id);
  assert.equal(flows.filter(n=>n.type==='ui-page').length,2);
  assert.equal(flows.filter(n=>n.type==='ui-group').length,8);
  const cloud=flows.find(n=>n.id==='cloud'); assert.equal(cloud.usetls,true); assert.equal(cloud.port,'8883');
  assert.equal(flows.find(n=>n.id==='cloud-tls').verifyservercert,true);
  assert.ok(flows.every(n=>!n.credentials));
  const html=flows.filter(n=>n.type==='ui-template').map(n=>n.format).join('');
  assert.ok(html.includes('stroke-dasharray'));
});
test('preparo desliga conexões no preview e recusa testes no broker do professor',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp3-prepare-'));
  try {
    const flows=prepare({},dir);
    assert.ok(flows.filter(n=>n.type==='mqtt-broker').every(n=>!n.autoConnect));
    const env={CP3_MODE:'teste',MQTT_CLOUD_HOST:FINAL_HOST,MQTT_CLOUD_USER:'exemplo',MQTT_CLOUD_PASSWORD:'exemplo',NODE_RED_CREDENTIAL_SECRET:'exemplo'};
    assert.throws(()=>prepare(env,dir),/proibidos/);
    env.MQTT_CLOUD_HOST='teste.s1.eu.hivemq.cloud';prepare(env,dir);
    const credentials=JSON.parse(fs.readFileSync(path.join(dir,'flows_cred.json')));
    assert.equal(credentials.cloud.password,'${MQTT_CLOUD_PASSWORD}');
    assert.ok(!fs.readFileSync(path.join(dir,'flows.json'),'utf8').includes('exemplo'));
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
