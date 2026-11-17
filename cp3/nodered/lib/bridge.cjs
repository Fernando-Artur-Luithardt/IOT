'use strict';
const { parse, prefix } = require('./monitor.cjs');
function create() { return { local: false, cloud: false, retained: {} }; }
function route(state, msg, team) {
  const health = () => ({ topic: `${prefix(team)}ponte/status`, payload: state.local ? 'online' : 'offline', qos: '1', retain: true });
  if (msg.kind === 'local-link') {
    state.local = msg.connected === true;
    return state.cloud ? [health()] : [];
  }
  if (msg.kind === 'cloud-link') {
    state.cloud = msg.connected === true;
    return state.cloud ? [health(), ...(state.local ? Object.values(state.retained) : [])] : [];
  }
  const event = parse(msg, team);
  if (!event || event.kind === 'bridge') return [];
  const out = { topic: msg.topic, payload: msg.payload, qos: event.kind === 'sensor' ? '0' : '1', retain: event.kind !== 'sensor' };
  if (out.retain) state.retained[out.topic] = out;
  // Do not queue old samples while the WAN is down. Only current retained states are resynchronized.
  return state.cloud && state.local ? [out] : [];
}
module.exports = { create, route };
