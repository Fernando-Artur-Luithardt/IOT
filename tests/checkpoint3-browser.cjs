'use strict';
const { chromium } = require('../cp3/nodered/node_modules/playwright-core');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const base='http://127.0.0.1:1881';
async function api(path,method='GET',body){
  const r=await fetch(base+'/editor'+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(!r.ok)throw new Error(`Admin HTTP ${r.status}`);
  return r.headers.get('content-type')?.includes('json')?r.json():r.text();
}
async function main(){
  const original=await api('/flows');
  assert.ok(original.filter(n=>n.type==='mqtt-broker').every(n=>n.autoConnect===false),'Somente o preview pode receber dados sintéticos');
  const z='cp3-flow';
  const fixtures=[];
  const script=`const p='unidavi/iot/t28/1038854_1028775/';
const mode=msg.payload;const rows=[{kind:'broker',connected:true},{topic:p+'ponte/status',payload:'online'}];
for(const slug of ['aroeira-vermelha','inga']){
rows.push({topic:p+slug+'/status',payload:mode==='offline'?'offline':'online'});
for(const [name,val] of Object.entries({'umidade-solo':mode==='acting'?20:80,luminosidade:mode==='acting'?95:41,temperatura:mode==='acting'?31:24.7})) rows.push({topic:p+slug+'/sensor/'+name,payload:JSON.stringify({valor:val,unidade:name==='temperatura'?'°C':'%'})});
for(const name of ['irrigacao',slug==='inga'?'ventilacao':'sombreamento'])rows.push({topic:p+slug+'/atuador/'+name,payload:JSON.stringify({estado:mode==='acting'?'ligado':'desligado'})});
}
return [rows];`;
  for(const mode of ['normal','acting','offline']) fixtures.push({id:'test-'+mode,type:'inject',z,name:'TESTE SINTÉTICO '+mode,props:[{p:'payload'}],payload:mode,payloadType:'str',once:false,repeat:'',wires:[['test-fixture']]});
  fixtures.push({id:'test-fixture',type:'function',z,name:'SOMENTE TESTES AUTOMATIZADOS',func:script,outputs:1,wires:[['monitor']]});
  fixtures.push({id:'test-reset',type:'inject',z,name:'Limpar dados sintéticos',props:[{p:'payload'}],payload:'',payloadType:'str',once:false,repeat:'',wires:[['test-clear']]});
  fixtures.push({id:'test-clear',type:'function',z,name:'Restaurar preview vazio',func:`flow.set('monitor',global.get('cp3').create('1038854_1028775'));return {kind:'tick'};`,outputs:1,wires:[['monitor']]});
  let browser;
  try {
    await api('/flows','POST',[...original,...fixtures]);
    browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1100}}), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/dashboard/aroeira-vermelha');
    await page.getByText('Aguardando primeira amostra').first().waitFor({timeout:20000});
    await api('/inject/test-normal','POST',{});
    await page.locator('.cp3-status strong').filter({hasText:'NORMAL'}).waitFor();
    await page.getByText('80.0',{exact:false}).first().waitFor();
    assert.equal(await page.locator('svg.cp3-chart').count(),2);
    fs.mkdirSync('/tmp/iot-cp3-browser',{recursive:true});
    await page.screenshot({path:'/tmp/iot-cp3-browser/simulado-normal.png',fullPage:true});
    await api('/inject/test-acting','POST',{});
    await page.locator('.cp3-status strong').filter({hasText:'ATUANDO'}).waitFor();
    await page.screenshot({path:'/tmp/iot-cp3-browser/simulado-atuando.png',fullPage:true});
    await page.goto(base+'/dashboard/inga');
    await page.getByText('31.0',{exact:false}).first().waitFor();
    await page.getByText('temperatura > 30 °C',{exact:false}).first().waitFor();
    await api('/inject/test-offline','POST',{});
    await page.locator('.cp3-status strong').filter({hasText:'OFFLINE'}).waitFor();
    assert.equal(await page.getByText('sem estado atual',{exact:true}).count(),2);
    await page.screenshot({path:'/tmp/iot-cp3-browser/simulado-offline.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'/tmp/iot-cp3-browser/simulado-mobile.png',fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
    assert.deepEqual(errors,[]);
    console.log('Browser OK: duas abas, valores, limiares, histórico, NORMAL/ATUANDO/OFFLINE, mobile e nenhum erro JavaScript. Dados sintéticos.');
  } finally {
    if(browser)await browser.close();
    try{await api('/inject/test-reset','POST',{})}finally{await api('/flows','POST',original)}
  }
}
main().catch(error=>{console.error(error);process.exitCode=1});
