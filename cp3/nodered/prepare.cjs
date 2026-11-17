'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { prefix } = require('./lib/monitor.cjs');
const FINAL_HOST = 'a8bb7dc1940348a7939da47ef2447f98.s1.eu.hivemq.cloud';
function prepare(env, destination) {
  const mode = env.CP3_MODE || 'preview';
  if (!['preview', 'teste', 'entrega'].includes(mode)) throw new Error('CP3_MODE inválido');
  const team = env.MATRICULAS || '1038854_1028775';
  const base = prefix(team);
  if (mode !== 'preview') {
    for (const key of ['MQTT_CLOUD_HOST', 'MQTT_CLOUD_USER', 'MQTT_CLOUD_PASSWORD', 'NODE_RED_CREDENTIAL_SECRET'])
      if (!env[key] || /^(PREENCHER|SEU_|SUA_)/.test(env[key])) throw new Error(`Configure ${key} no arquivo .env local`);
    if (mode === 'teste' && env.MQTT_CLOUD_HOST === FINAL_HOST) throw new Error('Testes na conta final do professor são proibidos');
    if (!/^[a-z0-9.-]+$/i.test(env.MQTT_CLOUD_HOST)) throw new Error('Use somente o hostname do broker TLS');
  }
  const flows = JSON.parse(fs.readFileSync(path.join(__dirname, 'flows.json'), 'utf8'));
  for (const n of flows) {
    if (n.id === 'cp3-flow') n.env = [{ name: 'MATRICULAS', value: team, type: 'str' }];
    if (n.id === 'cloud') Object.assign(n, {
      broker: env.MQTT_CLOUD_HOST || 'localhost', clientid: `nodered-${team}-${env.DEVICE_ID || 'mega01'}`,
      autoConnect: mode !== 'preview', willTopic: `${base}ponte/status`, closeTopic: `${base}ponte/status`
    });
    if (n.id === 'local') Object.assign(n, { broker: env.MQTT_LOCAL_HOST || 'mosquitto', autoConnect: mode !== 'preview', clientid: `ponte-local-${team}` });
    if (n.id === 'cloud-tls') n.servername = env.MQTT_CLOUD_HOST || 'localhost';
    if (n.type === 'mqtt in') n.topic = `${base}#`;
  }
  fs.mkdirSync(destination, { recursive: true });
  const modules = path.join(destination, 'node_modules');
  if (!fs.existsSync(modules)) fs.symlinkSync(path.join(__dirname, 'node_modules'), modules, 'dir');
  fs.writeFileSync(path.join(destination, 'package.json'), JSON.stringify({
    name: 'cp3-runtime', private: true, dependencies: { '@flowfuse/node-red-dashboard': '1.29.0' }
  }));
  fs.writeFileSync(path.join(destination, 'flows.json'), JSON.stringify(flows, null, 2));
  // Node-RED resolves credential environment references and keeps them out of exports.
  fs.writeFileSync(path.join(destination, 'flows_cred.json'), JSON.stringify({ cloud: {
    user: '${MQTT_CLOUD_USER}', password: '${MQTT_CLOUD_PASSWORD}'
  } }), { mode: 0o600 });
  return flows;
}
if (require.main === module) {
  try { prepare(process.env, process.argv[2] || path.join(__dirname, '.runtime')); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { prepare, FINAL_HOST };
