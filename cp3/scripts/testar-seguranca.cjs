'use strict';
const mqtt = require('../nodered/node_modules/mqtt');
const { FINAL_HOST } = require('../nodered/prepare.cjs');
const { prefix } = require('../nodered/lib/monitor.cjs');
const env=process.env, host=env.MQTT_CLOUD_HOST;
const denied=error=>[4,5,0x86,0x87].includes(Number(error?.code || error?.reasonCode));
function connect(credentials) {
  return new Promise((resolve,reject)=>{
    const c=mqtt.connect(`mqtts://${host}:8883`,{protocolVersion:5,servername:host,rejectUnauthorized:true,
      minVersion:'TLSv1.2',reconnectPeriod:0,connectTimeout:10000,
      clientId:`cp3-security-${Date.now()}-${Math.random().toString(16).slice(2,8)}`,
      ...(credentials?{username:env.MQTT_CLOUD_USER,password:env.MQTT_CLOUD_PASSWORD}:{})});
    c.once('connect',()=>resolve(c));
    c.once('error',error=>{c.end(true);reject(error)});
  });
}
function operation(client, action, topic) {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>finish(new Error('Sem confirmação do broker; teste inconclusivo')),10000);
    const onDisconnect=packet=>finish(Object.assign(new Error('Conexão encerrada'),{code:packet.reasonCode}));
    function finish(error,result){clearTimeout(timer);client.removeListener('disconnect',onDisconnect);error?reject(error):resolve(result)}
    client.once('disconnect',onDisconnect);
    if(action==='subscribe') client.subscribe(topic,{qos:1},(error,granted)=>{
      if(!error && granted?.some(g=>g.qos>=128)) error=Object.assign(new Error('Assinatura negada'),{code:granted.find(g=>g.qos>=128).qos});
      finish(error,granted);
    });
    else client.publish(topic,'verificacao-cp3',{qos:1,retain:false},(error,packet)=>{
      if(!error && packet?.reasonCode>=128) error=Object.assign(new Error('Publicação negada'),{code:packet.reasonCode});
      finish(error,packet);
    });
  });
}
async function run(){
  if(env.CP3_MODE!=='teste' || !host || host===FINAL_HOST) throw new Error('Execute somente na SUA conta, com CP3_MODE=teste. Conta final proibida.');
  if(!env.MQTT_CLOUD_USER || !env.MQTT_CLOUD_PASSWORD) throw new Error('Configure as credenciais no .env local');
  const allowed=prefix(env.MATRICULAS || '1038854_1028775')+'diagnostico/seguranca';
  // Namespace reservado para este teste na própria conta, nunca o prefixo de outra equipe.
  const forbidden=`cp3-teste-negado/${env.MATRICULAS || '1038854_1028775'}/verificacao`;
  let unauthenticated;
  try { unauthenticated=await connect(false); } catch(error) { if(!denied(error)) throw new Error('Falha de rede/TLS, não evidência de recusa por credenciais'); }
  if(unauthenticated){unauthenticated.end(true);throw new Error('FALHA: broker aceitou conexão sem credenciais')}
  console.log('OK: conexão sem credenciais recusada; certificado validado.');
  let client=await connect(true);
  try {await operation(client,'subscribe',allowed);await operation(client,'publish',allowed)} finally {client.end(true)}
  console.log('OK: assinatura e publicação permitidas no prefixo da dupla.');
  for(const action of ['subscribe','publish']){
    client=await connect(true);let refused=false;
    try {await operation(client,action,forbidden)} catch(error){if(denied(error))refused=true;else throw new Error(`${action}: resultado inconclusivo`)} finally {client.end(true)}
    if(!refused)throw new Error(`FALHA: ${action} fora do prefixo foi aceito`);
    console.log(`OK: ${action} fora do prefixo negado.`);
  }
}
run().catch(error=>{console.error(error.message);process.exitCode=1});
