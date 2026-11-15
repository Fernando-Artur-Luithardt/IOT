const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const flows = JSON.parse(fs.readFileSync('cp2-broker/nodered/flows.json'));
const parser = flows.find(n => n.id === 'parse');
const run = new Function('msg', 'env', 'node', parser.func);
const env = {get: () => '123_456'};
const node = {warn: () => {}};
const topic = 'unidavi/iot/t27/123_456/';
const parse = (suffix, payload) => run({topic: topic + suffix, payload}, env, node);
test('todos os sensores e atuadores das duas espécies chegam ao widget correto', () => {
  for (const [i, species] of ['aroeira-vermelha', 'inga'].entries()) {
    for (const [j, sensor] of ['umidade-solo', 'luminosidade', 'temperatura'].entries()) {
      const unit = j === 2 ? '°C' : '%';
      const result = parse(`${species}/sensor/${sensor}`, JSON.stringify({valor: 25.5, unidade: unit}));
      assert.equal(result[i*6+j].payload, `25.5 ${unit}`);
      assert.equal(result.filter(Boolean).length, 1);
    }
    for (const [j, actuator] of ['irrigacao', i === 0 ? 'sombreamento' : 'ventilacao'].entries()) {
      for (const estado of ['ligado', 'desligado'])
        assert.equal(parse(`${species}/atuador/${actuator}`, JSON.stringify({estado}))[i*6+3+j].payload, estado);
    }
    for (const state of ['online','offline'])
      assert.equal(parse(`${species}/status`, state)[i*6+5].payload, state);
  }
});
test('descarta JSON inválido, unidades erradas, tópicos alheios e HTML', () => {
  for (const value of ['{', '{"valor":"30","unidade":"%"}', '{"valor":101,"unidade":"%"}', '{"valor":30,"unidade":"<img>"}', 'null'])
    assert.equal(parse('inga/sensor/umidade-solo', value), null);
  assert.equal(parse('inga/status', '<script>'), null);
  assert.equal(parse('inga/atuador/sombreamento', '{"estado":"ligado"}'), null);
  assert.equal(parse('outra/status', 'online'), null);
  assert.equal(run({topic:'unidavi/iot/t27/999/inga/status',payload:'online'}, env, node), null);
  assert.equal(run({topic:topic+'inga/status',payload:'online'}, {get:()=>'PREENCHER'}, node), null);
});
test('fluxo exportado coincide com parser e todas as ligações existem', () => {
  assert.equal(parser.func, fs.readFileSync('cp2-broker/nodered/parse-message.js','utf8'));
  const ids = new Set(flows.map(n=>n.id));
  assert.equal(ids.size, flows.length);
  for (const n of flows) for (const wire of (n.wires || []).flat()) assert.ok(ids.has(wire));
  assert.equal(flows.filter(n=>n.type==='ui-text').length,12);
});
