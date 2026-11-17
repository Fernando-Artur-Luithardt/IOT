'use strict';
const TABLES = ['leituras', 'estados_atuadores', 'status_placa', 'estados_gerais'];
function configuration(url, key) {
  if (!url || !key) throw new Error('Supabase não configurado');
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/')
    throw new Error('SUPABASE_URL deve ser a origem HTTPS do projeto');
  let jwt = false;
  if (!key.startsWith('sb_publishable_')) {
    try { jwt = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { /* reject */ }
    if (!jwt) throw new Error('Use somente a chave pública anon/publishable');
  }
  const headers = { apikey: key, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  if (jwt) headers.Authorization = `Bearer ${key}`;
  return { url: endpoint.origin, headers };
}
function next(state, now, url, key) {
  if (!state.outbox.length || now < state.retryAt) return null;
  if (state.flight && now - state.flight.at < 30000) return null;
  let config;
  try { config = configuration(url, key); } catch (error) { state.db = error.message; return null; }
  const table = state.outbox[0].table;
  if (!TABLES.includes(table)) throw new Error('Tabela não permitida');
  const batch = state.outbox.filter(item => item.table === table).slice(0, 100);
  const ids = batch.map(item => item.row.evento_id);
  state.flight = { ids, at: now };
  state.db = 'Enviando';
  return { method: 'POST', url: `${config.url}/rest/v1/${table}`, headers: config.headers,
    requestTimeout: 10000, followRedirects: false,
    payload: batch.map(item => item.row), cp3Ids: ids, cp3Attempt: now };
}
function acknowledge(state, msg, now) {
  if (!state.flight || msg.cp3Attempt !== state.flight.at) return;
  const ids = new Set(state.flight.ids);
  if (!msg.error && msg.statusCode >= 200 && msg.statusCode < 300) {
    state.outbox = state.outbox.filter(item => !ids.has(item.row.evento_id));
    state.failures = 0; state.retryAt = 0; state.db = 'Conectado';
  } else {
    state.failures++;
    state.retryAt = now + Math.min(60000, 2000 * 2 ** Math.min(5, state.failures));
    // Never expose response bodies, headers, URLs with keys, or transport errors to the UI/debug.
    state.db = Number.isInteger(msg.statusCode) ? `Falha HTTP ${msg.statusCode}; nova tentativa agendada` : 'Falha de conexão; nova tentativa agendada';
  }
  state.flight = null;
}
module.exports = { configuration, next, acknowledge };
