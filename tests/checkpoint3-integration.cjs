'use strict';
// Brokers and HTTPS endpoint are local test doubles. Never contacts HiveMQ/Supabase accounts.
const net=require('node:net'),tls=require('node:tls'),https=require('node:https');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const aedes=require('../cp3/nodered/node_modules/aedes');
const mqtt=require('../cp3/nodered/node_modules/mqtt');
const prefix='unidavi/iot/t28/1038854_1028775/';
const admin='http://127.0.0.1:1881/editor';
async function api(route,method='GET',body){const r=await fetch(admin+route,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.headers.get('content-type')?.includes('json')?r.json():r.text()}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,label){const until=Date.now()+22000;while(Date.now()<until){if(await fn())return;await sleep(150)}throw Error('Timeout: '+label)}
async function main(){
  const original=await api('/flows');
  assert.ok(original.filter(n=>n.type==='mqtt-broker').every(n=>!n.autoConnect),'Execute somente no preview');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'iot-cp3-tls-'));
  const local=aedes(),cloud=aedes(),connections=new Set(),received=[],boards=[];
  let cloudConnections=0,servername='';
  cloud.authenticate=(client,user,password,done)=>{const ok=user==='teste'&&String(password)==='teste';if(ok)cloudConnections++;done(null,ok)};
  const config='[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=ext\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost\nbasicConstraints=critical,CA:TRUE\nkeyUsage=digitalSignature,keyEncipherment,keyCertSign\n';
  fs.writeFileSync(path.join(dir,'openssl.cnf'),config);
  execFileSync('/usr/bin/openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(dir,'key.pem'),'-out',path.join(dir,'cert.pem'),'-days','1','-config',path.join(dir,'openssl.cnf')],{stdio:'ignore'});
  const security={key:fs.readFileSync(path.join(dir,'key.pem')),cert:fs.readFileSync(path.join(dir,'cert.pem'))};
  const localServer=net.createServer(local.handle);
  const cloudServer=tls.createServer(security,s=>{servername=s.servername;cloud.handle(s)});
  const database=https.createServer(security,(req,res)=>{
    let body='';req.on('data',c=>body+=c);req.on('end',()=>{
      received.push({url:req.url,headers:req.headers,rows:JSON.parse(body)});
      res.writeHead(201);res.end();
    });
  });
  const servers=[localServer,cloudServer,database];
  for(const s of servers){s.on('connection',socket=>{connections.add(socket);socket.on('close',()=>connections.delete(socket))});await new Promise(r=>s.listen(0,r))}
  const state=async()=>{try{return await (await fetch('http://127.0.0.1:1881/__cp3_test')).json()}catch{return null}};
  try{
    const flows=JSON.parse(JSON.stringify(original));
    for(const n of flows){
      if(n.id==='cp3-flow')n.env.push({name:'SUPABASE_URL',type:'str',value:`https://localhost:${database.address().port}`},{name:'SUPABASE_KEY',type:'str',value:'sb_publishable_teste_local'});
      if(n.id==='local')Object.assign(n,{broker:'localhost',port:String(localServer.address().port),autoConnect:true});
      if(n.id==='cloud')Object.assign(n,{broker:'localhost',port:String(cloudServer.address().port),autoConnect:true,credentials:{user:'teste',password:'teste'}});
      if(n.id==='cloud-tls')Object.assign(n,{ca:path.join(dir,'cert.pem'),servername:'localhost'});
      if(n.id==='supabase-http')n.tls='cloud-tls';
    }
    flows.push({id:'test-http',type:'http in',z:'cp3-flow',url:'/__cp3_test',method:'get',upload:false,wires:[['test-state']]},
      {id:'test-state',type:'function',z:'cp3-flow',func:"msg.payload=flow.get('monitor');return msg;",outputs:1,wires:[['test-response']]},
      {id:'test-response',type:'http response',z:'cp3-flow',statusCode:'',headers:{},wires:[]},
      {id:'test-reset',type:'inject',z:'cp3-flow',props:[{p:'payload'}],payload:'',payloadType:'str',once:false,repeat:'',wires:[['test-clear']]},
      {id:'test-clear',type:'function',z:'cp3-flow',func:"flow.set('monitor',global.get('cp3').create('1038854_1028775'));return {kind:'tick'};",outputs:1,wires:[['monitor']]});
    await api('/flows','POST',flows);
    await wait(async()=>{const s=await state();return s?.broker&&s?.bridge==='online'},'ponte conectada com TLS');
    assert.equal(servername,'localhost');assert.equal(cloudConnections,1);
    for(const slug of ['aroeira-vermelha','inga']){
      const c=mqtt.connect(`mqtt://localhost:${localServer.address().port}`,{clientId:'placa-teste-'+slug,reconnectPeriod:0,will:{topic:prefix+slug+'/status',payload:'offline',qos:1,retain:true}});
      boards.push(c);await new Promise((resolve,reject)=>{c.once('connect',resolve);c.once('error',reject)});
      const pub=(suffix,payload,retain=false)=>new Promise((resolve,reject)=>c.publish(prefix+slug+'/'+suffix,typeof payload==='object'?JSON.stringify(payload):payload,{qos:1,retain},e=>e?reject(e):resolve()));
      await pub('status','online',true);
      for(const actuator of ['irrigacao',slug==='inga'?'ventilacao':'sombreamento'])await pub('atuador/'+actuator,{estado:'desligado'},true);
      for(const [name,value]of Object.entries({'umidade-solo':80,luminosidade:41,temperatura:24.7}))await pub('sensor/'+name,{valor:value,unidade:name==='temperatura'?'°C':'%'});
    }
    await wait(async()=>{const s=await state();return s?.species.inga.general?.value==='NORMAL'&&s?.species['aroeira-vermelha'].general?.value==='NORMAL'},'dados atravessaram os dois brokers');
    await wait(()=>['leituras','estados_atuadores','status_placa','estados_gerais'].every(t=>received.some(r=>r.url==='/rest/v1/'+t)),'quatro tabelas no endpoint HTTPS');
    for(const req of received){assert.equal(req.headers.apikey,'sb_publishable_teste_local');assert.equal(req.headers.authorization,undefined);assert.equal(req.headers.prefer,'return=minimal')}
    const readings=received.filter(r=>r.url==='/rest/v1/leituras').flatMap(r=>r.rows);
    assert.ok(readings.some(r=>r.especie==='inga'&&r.sensor==='temperatura'&&r.valor===24.7));
    boards[1].stream.destroy();
    await wait(async()=>((await state())?.species.inga.general?.value==='OFFLINE'),'ultima vontade local encaminhada pelo TLS');
    console.log('Integração OK: MQTT local → Node-RED → MQTT/TLS com SNI, uma conexão cloud, retorno no painel, quatro POST HTTPS e LWT. Contas externas não usadas.');
  }finally{
    for(const c of boards)c.end(true);
    try{await api('/inject/test-reset','POST',{})}catch{}
    const restore=JSON.parse(JSON.stringify(original));
    restore.find(n=>n.id==='cloud').credentials={user:'${MQTT_CLOUD_USER}',password:'${MQTT_CLOUD_PASSWORD}'};
    await api('/flows','POST',restore);
    for(const socket of connections)socket.destroy();
    for(const s of servers)s.close();
    local.close();cloud.close();
    fs.rmSync(dir,{recursive:true,force:true});
  }
}
main().catch(e=>{console.error(e);process.exitCode=1});
