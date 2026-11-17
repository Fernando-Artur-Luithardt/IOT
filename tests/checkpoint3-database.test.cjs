const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const local = createRequire(path.join(__dirname,'../cp3/nodered/package.json'));
const { PGlite } = local('@electric-sql/pglite');
test('schema real: equipe, espécies, RLS insert-only, idempotência e campos ThingSpeak',async()=>{
  const db=new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create schema extensions;');
    const sql=fs.readFileSync(path.join(__dirname,'../cp3/supabase/supabase_schema.sql'),'utf8');
    await db.exec(sql); await db.exec(sql);
    assert.equal((await db.query('select count(*)::int as n from especies')).rows[0].n,18);
    assert.equal((await db.query('select count(*)::int as n from equipe_especies')).rows[0].n,2);
    assert.equal(Number((await db.query("select limite from regras where perfil_id=4 and atuador='ventilacao'")).rows[0].limite),30);
    await db.exec('set role anon');
    const insertion=`insert into leituras(equipe,especie,sensor,valor,unidade,evento_id) values('1038854_1028775','inga','temperatura',31.5,'°C','00000000-0000-4000-8000-000000000001')`;
    await db.exec(insertion); await db.exec(insertion);
    for(const query of ['select * from leituras','select * from integracoes','delete from leituras',"update leituras set valor=0",'select * from v_ultima_leitura','select fn_enviar_thingspeak()']) {
      await assert.rejects(()=>db.exec(query));
    }
    await assert.rejects(()=>db.exec("insert into leituras(equipe,especie,sensor,valor) values('outra','inga','temperatura',20)"));
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::int as n from leituras')).rows[0].n,1);
    await db.exec("insert into estados_atuadores(equipe,especie,atuador,ligado) values('1038854_1028775','inga','ventilacao',true); insert into estados_gerais(equipe,especie,estado) values('1038854_1028775','inga','ATUANDO')");
    const row=(await db.query('select * from v_thingspeak_payload')).rows[0];
    assert.equal(Number(row.f4),31.5);assert.equal(row.f5,3);assert.equal(Number(row.f6),1);assert.equal(row.f7,6);assert.equal(row.f3,null);
  } finally { await db.close(); }
});
