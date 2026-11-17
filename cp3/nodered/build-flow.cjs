'use strict';
const fs = require('node:fs');
const path = require('node:path');
function build() {
  const z = 'cp3-flow';
  const flows = [
    { id:z, type:'tab', label:'CP3 · Ponte, painel e Supabase', disabled:false, info:'Leia docs/checkpoint3.md. Os módulos locais são carregados pelo settings.cjs. Nunca inclua credenciais neste fluxo.', env:[{name:'MATRICULAS',type:'str',value:'1038854_1028775'}] },
    { id:'local', type:'mqtt-broker', name:'Mosquitto local · Mega', broker:'${MQTT_LOCAL_HOST}', port:'1883', clientid:'${MQTT_LOCAL_CLIENT_ID}', autoConnect:false, usetls:false, protocolVersion:'4', keepalive:'15', cleansession:true, autoUnsubscribe:true, queueQoSZero:false },
    { id:'cloud', type:'mqtt-broker', name:'HiveMQ · TLS validado', broker:'${MQTT_CLOUD_HOST}', port:'8883', clientid:'${MQTT_CLOUD_CLIENT_ID}', autoConnect:false, usetls:true, tls:'cloud-tls', protocolVersion:'4', keepalive:'15', cleansession:true, autoUnsubscribe:true, queueQoSZero:false, willTopic:'${MQTT_BRIDGE_TOPIC}', willQos:'1', willRetain:true, willPayload:'offline', closeTopic:'${MQTT_BRIDGE_TOPIC}', closeQos:'1', closeRetain:true, closePayload:'offline' },
    { id:'cloud-tls', type:'tls-config', name:'Validar CA pública e hostname/SNI', cert:'',key:'',ca:'',certname:'',keyname:'',caname:'',servername:'${MQTT_CLOUD_HOST}',verifyservercert:true,alpnprotocol:'' },
    { id:'local-in',type:'mqtt in',z,name:'1 · Entrada MQTT local',topic:'unidavi/iot/t28/1038854_1028775/#',qos:'1',datatype:'utf8',broker:'local',nl:false,rap:true,rh:0,inputs:0,x:160,y:100,wires:[['bridge']] },
    { id:'cloud-out',type:'mqtt out',z,name:'Ponte → HiveMQ',topic:'',qos:'',retain:'',broker:'cloud',x:740,y:100,wires:[] },
    { id:'cloud-in',type:'mqtt in',z,name:'2 · Retorno do HiveMQ',topic:'unidavi/iot/t28/1038854_1028775/#',qos:'1',datatype:'utf8',broker:'cloud',nl:false,rap:true,rh:0,inputs:0,x:160,y:360,wires:[['monitor']] },
    { id:'local-status',type:'status',z,name:'Conexão local',scope:['local-in'],x:140,y:180,wires:[['local-link']] },
    { id:'cloud-status',type:'status',z,name:'Conexão TLS',scope:['cloud-in'],x:140,y:260,wires:[['cloud-link']] },
    { id:'tick',type:'inject',z,name:'3 · Recalcular a cada 5 s',props:[{p:'kind',v:'tick',vt:'str'}],repeat:'5',crontab:'',once:true,onceDelay:0.5,topic:'',x:180,y:440,wires:[['monitor']] },
    { id:'drain-tick',type:'inject',z,name:'4 · Drenar fila a cada 2 s',props:[{p:'payload'}],repeat:'2',crontab:'',once:true,onceDelay:1,topic:'',payload:'',payloadType:'date',x:170,y:640,wires:[['outbox']] },
    { id:'supabase-http',type:'http request',z,name:'POST · chave pública · insert only',method:'use',ret:'txt',paytoqs:'ignore',url:'',tls:'',persist:false,proxy:'',insecureHTTPParser:false,authType:'',senderr:false,headers:[],requestTimeout:'10000',followRedirects:false,x:700,y:640,wires:[['ack']] },
    { id:'http-catch',type:'catch',z,name:'Falha de transporte',scope:['supabase-http'],uncaught:false,x:720,y:720,wires:[['ack']] },
    { id:'base',type:'ui-base',name:'Espécies nativas · CP3',path:'/dashboard',includeClientData:true,acceptsClientConfig:[],showPathInSidebar:false,navigationStyle:'default',titleBarStyle:'default' },
    { id:'theme',type:'ui-theme',name:'Checkpoint 3',colors:{surface:'#ffffff',primary:'#2e7d32',bgPage:'#f1f4f7',groupBg:'#ffffff',groupOutline:'#d8dee5'},sizes:{density:'default',pagePadding:'18px',groupGap:'18px',groupBorderRadius:'8px',widgetGap:'14px'} }
  ];
  const fn = (id,name,func,outputs,wires,x,y,initialize='') => flows.push({id,type:'function',z,name,func,outputs,timeout:0,noerr:0,initialize,finalize:'',libs:[],x,y,wires});
  fn('bridge','Validar prefixo e encaminhar', `const api=global.get('cp3Bridge');
const state=flow.get('bridge') || api.create();
const output=api.route(state,msg,env.get('MATRICULAS'));
flow.set('bridge',state);
return [output];`,1,[['cloud-out']],450,100,`flow.set('bridge',global.get('cp3Bridge').create());`);
  fn('local-link','Estado da conexão local', `return {kind:'local-link',connected:msg.status?.fill==='green' && msg.status?.shape==='dot'};`,1,[['bridge']],420,180);
  fn('cloud-link','Estado da conexão TLS', `const connected=msg.status?.fill==='green' && msg.status?.shape==='dot';
return [{kind:'broker',connected},{kind:'cloud-link',connected}];`,2,[['monitor'],['bridge']],420,260);
  fn('monitor','Validar, guardar e calcular estado', `const api=global.get('cp3');
let state=flow.get('monitor');
const team=env.get('MATRICULAS');
if (!state || state.team!==team) state=api.create(team);
const now=Date.now();
if (msg.kind!=='tick') api.apply(state,msg,now);
api.tick(state,now);
flow.set('monitor',state);
return ['aroeira-vermelha','inga'].map(slug=>({payload:api.snapshot(state,slug,now)}));`,2,
    [['aroeira-general','aroeira-sensors','aroeira-actuators','aroeira-history'],['inga-general','inga-sensors','inga-actuators','inga-history']],440,400,
    `const api=global.get('cp3');
let state=flow.get('monitor');
if (!state || state.team!==env.get('MATRICULAS')) state=api.create(env.get('MATRICULAS'));
api.resetTransport(state,Date.now()); flow.set('monitor',state);`);
  fn('outbox','Fila persistente e novas tentativas', `const state=flow.get('monitor'); if (!state) return null;
const request=global.get('cp3Persistence').next(state,Date.now(),env.get('SUPABASE_URL'),env.get('SUPABASE_KEY'));
flow.set('monitor',state); return request;`,1,[['supabase-http']],430,640);
  fn('ack','Confirmar gravação sem expor chaves', `const state=flow.get('monitor'); if (!state) return null;
global.get('cp3Persistence').acknowledge(state,msg,Date.now());
flow.set('monitor',state);
node.status({fill:state.failures?'yellow':'green',shape:'dot',text:state.db});
return null;`,0,[],1010,640);
  for (const [index,[id,slug,name]] of [['aroeira','aroeira-vermelha','Aroeira-vermelha'],['inga','inga','Ingá']].entries()) {
    const page=`page-${id}`;
    flows.push({id:page,type:'ui-page',name,ui:'base',path:`/${slug}`,icon:'leaf',layout:'grid',theme:'theme',breakpoints:[{name:'Default',px:'0',cols:'3'},{name:'Tablet',px:'576',cols:'6'},{name:'Desktop',px:'1024',cols:'12'}],order:index+1,visible:'true',disabled:'false'});
    for (const [order,[kind,title]] of [['general','Estado geral'],['sensors','Sensores'],['actuators','Atuadores'],['history','Histórico']].entries()) {
      const group=`group-${id}-${kind}`;
      flows.push({id:group,type:'ui-group',name:title,page,width:'12',height:'1',order:order+1,showTitle:true,visible:'true',disabled:'false',groupType:'default'});
      flows.push({id:`${id}-${kind}`,type:'ui-template',z,group,page:'',ui:'',name:`${name} · ${title}`,order:1,width:'12',height:'0',format:fs.readFileSync(path.join(__dirname,`templates/${kind}.html`),'utf8'),storeOutMessages:true,passthru:false,resendOnRefresh:true,templateScope:'local',className:'',x:850+index*300,y:330+order*60,wires:[[]]});
    }
  }
  return flows;
}
if (require.main === module) fs.writeFileSync(path.join(__dirname,'flows.json'),JSON.stringify(build(),null,2)+'\n');
module.exports={build};
