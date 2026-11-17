'use strict';
const { randomUUID } = require('node:crypto');

const INTERVAL = 8000;
const WINDOW = 30 * 60 * 1000;
const COLORS = { OFFLINE: '#c62828', 'SEM DADOS': '#6b7280', ALERTA: '#ef6c00', ATUANDO: '#1976d2', NORMAL: '#2e7d32' };
const SCENARIOS = {
  'aroeira-vermelha': {
    name: 'Aroeira-vermelha', scientific: 'Schinus terebinthifolia', family: 'Irrigação e sombreamento leve',
    rules: [
      { sensor: 'umidade-solo', unit: '%', max: 100, limit: 30, op: '<', actuator: 'irrigacao' },
      { sensor: 'luminosidade', unit: '%', max: 100, limit: 90, op: '>', actuator: 'sombreamento' }
    ]
  },
  inga: {
    name: 'Ingá', scientific: 'Inga vera', family: 'Irrigação e ventilação',
    rules: [
      { sensor: 'umidade-solo', unit: '%', max: 100, limit: 60, op: '<', actuator: 'irrigacao' },
      { sensor: 'temperatura', unit: '°C', max: 50, limit: 30, op: '>', actuator: 'ventilacao' }
    ]
  }
};
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
function validTeam(team) { return typeof team === 'string' && /^[a-z0-9_-]{1,40}$/.test(team); }
function prefix(team) {
  if (!validTeam(team)) throw new Error('Matrículas inválidas');
  return `unidavi/iot/t28/${team}/`;
}
function parse(msg, team) {
  if (!validTeam(team) || typeof msg.topic !== 'string' || !msg.topic.startsWith(prefix(team))) return null;
  const p = msg.topic.slice(prefix(team).length).split('/');
  const raw = Buffer.isBuffer(msg.payload) ? msg.payload.toString('utf8') : msg.payload;
  if (p.length === 2 && p[0] === 'ponte' && p[1] === 'status') {
    return ['online', 'offline'].includes(raw) ? { kind: 'bridge', value: raw } : null;
  }
  if (!own(SCENARIOS, p[0])) return null;
  const common = { species: p[0], retained: msg.retain === true };
  if (p.length === 2 && p[1] === 'status') {
    return ['online', 'offline'].includes(raw) ? { ...common, kind: 'status', value: raw } : null;
  }
  if (p.length !== 3) return null;
  let data;
  try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  if (!data || Array.isArray(data) || typeof data !== 'object') return null;
  if (p[1] === 'sensor') {
    if (!['umidade-solo', 'luminosidade', 'temperatura'].includes(p[2])) return null;
    const unit = p[2] === 'temperatura' ? '°C' : '%';
    if (typeof data.valor !== 'number' || !Number.isFinite(data.valor) || Math.abs(data.valor) > 999999.99 || data.unidade !== unit) return null;
    if (unit === '%' && (data.valor < 0 || data.valor > 100)) return null;
    // CP2 has no sample timestamp. A retained sample cannot establish freshness.
    if (common.retained) return null;
    return { ...common, kind: 'sensor', name: p[2], value: data.valor, unit };
  }
  if (p[1] === 'atuador' && SCENARIOS[p[0]].rules.some(r => r.actuator === p[2]) &&
      ['ligado', 'desligado'].includes(data.estado)) {
    return { ...common, kind: 'actuator', name: p[2], value: data.estado === 'ligado' };
  }
  return null;
}
function create(team) {
  prefix(team);
  return { version: 1, team, broker: false, bridge: 'offline', validAfter: 0,
    species: Object.fromEntries(Object.keys(SCENARIOS).map(slug => [slug, {
      status: null, sensors: {}, actuators: {}, history: {}, divergence: {}, general: null, validAfter: 0
    }])), outbox: [], flight: null, retryAt: 0, failures: 0, db: 'Não configurado', dropped: 0 };
}
function resetTransport(state, now) {
  state.broker = false; state.bridge = 'offline'; state.validAfter = now; state.flight = null;
  for (const s of Object.values(state.species)) s.divergence = {};
}
function enqueue(state, table, row) {
  // Do not silently lose records if a long outage fills the bounded disk-backed queue.
  if (state.outbox.length >= 50000) { state.dropped++; state.db = 'Fila cheia; há registros não armazenados'; return; }
  state.outbox.push({ table, row: { evento_id: randomUUID(), ...row } });
}
function expected(rule, value) { return rule.op === '<' ? value < rule.limit : value > rule.limit; }
function apply(state, msg, now) {
  if (msg.kind === 'broker') {
    if (state.broker !== msg.connected) {
      state.broker = msg.connected === true;
      state.validAfter = now;
      for (const s of Object.values(state.species)) s.divergence = {};
    }
  } else {
    const event = parse(msg, state.team);
    if (!event) return false;
    if (event.kind === 'bridge') {
      if (state.bridge !== event.value) { state.bridge = event.value; state.validAfter = now; }
    } else {
      const s = state.species[event.species];
      const row = { equipe: state.team, especie: event.species };
      const time = new Date(now).toISOString();
      if (event.kind === 'sensor') {
        s.sensors[event.name] = { value: event.value, at: now, unit: event.unit };
        (s.history[event.name] ||= []).push({ x: now, y: event.value });
        enqueue(state, 'leituras', { ...row, sensor: event.name, valor: event.value, unidade: event.unit, medido_em: time });
      } else if (event.kind === 'actuator') {
        const old = s.actuators[event.name];
        const changed = !old || old.value !== event.value;
        const afterGap = !!old && old.at < Math.max(state.validAfter, s.validAfter);
        s.actuators[event.name] = { value: event.value, at: now,
          since: changed || afterGap ? now : old.since,
          observed: afterGap || (changed ? event.retained : old.observed) };
        if (changed) enqueue(state, 'estados_atuadores', { ...row, atuador: event.name, ligado: event.value, registrado_em: time });
      } else if (event.kind === 'status' && s.status !== event.value) {
        s.status = event.value; s.validAfter = now; s.divergence = {};
        enqueue(state, 'status_placa', { ...row, status: event.value, registrado_em: time });
      }
    }
  }
  return true;
}
function assess(state, slug, now) {
  const s = state.species[slug], rules = SCENARIOS[slug].rules;
  if (s.status === 'offline') { s.divergence = {}; return ['OFFLINE', 'Placa desconectada.']; }
  if (!state.broker || state.bridge !== 'online') {
    s.divergence = {};
    return ['SEM DADOS', !state.broker ? 'Node-RED desconectado do HiveMQ.' : 'Ponte com o broker local indisponível.'];
  }
  const freshAfter = Math.max(state.validAfter, s.validAfter);
  const stale = rules.filter(r => !s.sensors[r.sensor] || s.sensors[r.sensor].at < freshAfter || now - s.sensors[r.sensor].at > 3 * INTERVAL);
  if (stale.length || s.status !== 'online') {
    s.divergence = {};
    return ['SEM DADOS', stale.length ? `Sem leitura recente: ${stale.map(r => r.sensor).join(', ')}.` : 'Aguardando status da placa.'];
  }
  const missing = rules.filter(r => !s.actuators[r.actuator] || s.actuators[r.actuator].at < freshAfter);
  if (missing.length) return ['SEM DADOS', `Aguardando estado atual: ${missing.map(r => r.actuator).join(', ')}.`];
  const mismatches = [];
  for (const r of rules) {
    const want = expected(r, s.sensors[r.sensor].value);
    if (want !== s.actuators[r.actuator].value) {
      s.divergence[r.actuator] ??= now;
      mismatches.push({ rule: r, want, expired: now - s.divergence[r.actuator] > 2 * INTERVAL });
    } else delete s.divergence[r.actuator];
  }
  if (mismatches.some(m => m.expired)) {
    return ['ALERTA', mismatches.filter(m => m.expired).map(m => `${m.rule.actuator}: esperado ${m.want ? 'ligado' : 'desligado'}`).join('; ')];
  }
  if (mismatches.length) return ['SEM DADOS', 'Aguardando sincronização dos atuadores (tolerância de 2 intervalos).'];
  const active = rules.filter(r => s.actuators[r.actuator].value).map(r => r.actuator);
  return active.length ? ['ATUANDO', `${active.join(', ')} ligado(s).`] : ['NORMAL', 'Todas as leituras na faixa verde.'];
}
function tick(state, now) {
  for (const [slug, s] of Object.entries(state.species)) {
    for (const [name, points] of Object.entries(s.history)) s.history[name] = points.filter(p => p.x >= now - WINDOW);
    const [value, reason] = assess(state, slug, now);
    if (s.general?.value !== value) {
      enqueue(state, 'estados_gerais', { equipe: state.team, especie: slug, estado: value, motivo: reason, registrado_em: new Date(now).toISOString() });
      s.general = { value, reason, since: now };
    } else s.general.reason = reason;
  }
}
function snapshot(state, slug, now) {
  const s = state.species[slug], scenario = SCENARIOS[slug];
  const transport = state.broker && state.bridge === 'online' && s.status === 'online';
  const after = Math.max(state.validAfter, s.validAfter);
  const sensors = scenario.rules.map(r => {
    const reading = s.sensors[r.sensor];
    return { ...r, value: reading?.value ?? null, at: reading?.at ?? null,
      age: reading ? Math.max(0, Math.floor((now - reading.at) / 1000)) : null,
      current: !!(transport && reading && reading.at >= after && now - reading.at <= INTERVAL * 3),
      history: s.history[r.sensor] || [] };
  });
  const actuators = scenario.rules.map(r => {
    const a = s.actuators[r.actuator], reading = sensors.find(v => v.sensor === r.sensor);
    const current = !!(transport && a && a.at >= after);
    return { name: r.actuator, rule: `${r.sensor} ${r.op} ${r.limit} ${r.unit}`,
      value: a?.value ?? null, current, since: a?.since ?? null, observed: a?.observed ?? false,
      coherent: current && reading.current ? a.value === expected(r, reading.value) : null };
  });
  return { slug, name: scenario.name, scientific: scenario.scientific, family: scenario.family,
    team: state.team, now, window: WINDOW, general: s.general, color: COLORS[s.general?.value] || COLORS['SEM DADOS'],
    broker: state.broker, bridge: state.bridge, board: s.status, sensors, actuators,
    persistence: { status: state.db, pending: state.outbox.length, dropped: state.dropped } };
}
module.exports = { INTERVAL, WINDOW, SCENARIOS, COLORS, prefix, parse, create, resetTransport, apply, tick, snapshot, expected };
