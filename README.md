# Checkpoint 3 — Espécies nativas

**Mega + ESP8266 AT → Mosquitto local → ponte Node-RED → HiveMQ TLS → dashboard e Supabase → ThingSpeak.**

A ponte segue a orientação informada pela dupla: MQTT local na porta 1883 e saída TLS na porta 8883. O Node-RED valida o certificado e o hostname, usa SNI e autenticação. Publicação e assinatura compartilham **uma conexão cloud**; o firmware mantém duas sessões locais para uma última vontade por espécie.

Equipe `1038854_1028775`: Fernando Artur Luithardt e Carlos Eduardo Nogueira de Oliveira. Espécies: aroeira-vermelha e ingá. Prefixo: `unidavi/iot/t28/1038854_1028775/#`.

## Executar

1. Copie `cp3/.env.example` para `cp3/.env`. O modo `preview` abre o painel sem conectar a brokers ou contas externas.
2. Inicie Docker e execute:

   ```sh
   docker compose --env-file cp3/.env -f cp3/docker-compose.yml up -d --build
   ```

3. Abra [Aroeira-vermelha](http://localhost:1881/dashboard/aroeira-vermelha), [Ingá](http://localhost:1881/dashboard/inga) ou o [editor Node-RED](http://localhost:1881/editor).
4. Para dados reais, preencha a sua conta HiveMQ no `.env`, use `CP3_MODE=teste` e recrie o serviço. Ajuste `MQTT_HOST` em `config.h` para o IP LAN do computador e grave `sketch.ino` no Mega, com os `.h` e bibliotecas de `libraries.txt`.
5. Siga [o guia do CP3](docs/checkpoint3.md) para instalar o SQL, configurar a chave pública do Supabase e ativar o ThingSpeak.

Sem Docker, com Node.js 22 ou superior:

```sh
cd cp3/nodered
npm ci
npm run build
node --env-file=../.env prepare.cjs
node --env-file=../.env node_modules/node-red/red.js --settings settings.cjs --userDir .runtime flows.json
```

## Implementação

- Duas abas com Estado geral, Sensores, Atuadores e Histórico.
- Valores/unidades, idade, faixas do cenário, estado e regra dos atuadores.
- Recálculo a cada 5 s: SEM DADOS após 24 s; ALERTA após divergência por mais de 16 s; OFFLINE por última vontade.
- Histórico de 30 minutos, limiar tracejado e contexto persistente.
- Ponte restrita ao prefixo, com retorno do HiveMQ alimentando painel e banco.
- Fila de gravação e novas tentativas; identificador de evento evita duplicatas após timeout.
- SQL do professor adaptado às matrículas/espécies; RLS insert-only e ThingSpeak alimentado pelo banco a cada minuto.

**Correção de cenário:** a ventilação do ingá passou de 25 para **30 °C**, conforme a família 4 do documento oficial. Os demais limiares permanecem iguais.

## Validar

```sh
sh tests/firmware.test.sh
node --test tests/flow.test.cjs tests/checkpoint3.test.cjs tests/checkpoint3-database.test.cjs
```

Com o preview ativo em `localhost:1881`:

```sh
node tests/checkpoint3-browser.cjs
node tests/checkpoint3-integration.cjs
```

O teste visual usa Chrome no macOS e dados sintéticos, removidos ao terminar. O teste de integração cria brokers e um endpoint HTTPS locais; verifica TLS/SNI, retorno ao painel, quatro POSTs e última vontade. Não acessa contas externas. O teste SQL usa PostgreSQL embarcado (PGlite); `pg_net`/`pg_cron` precisam ser conferidos no Supabase real.

## Materiais

- [Configuração, demonstração e evidências](docs/checkpoint3.md).
- [Montagem](docs/montagem.md), [fluxo final](cp3/nodered/flows.json) e [SQL](cp3/supabase/supabase_schema.sql).
- O CP2 permanece em `cp2-broker/`; [README anterior](docs/checkpoint2-referencia.md) é referência histórica. O firmware atual usa `t28`; o fluxo antigo `t27` não é o painel final.

Faltam a configuração das contas e os ensaios físicos para comprovar a entrega completa. O motor de passo continua sem sensor de referência: iniciar com a tela aberta e verificar sua posição após falta de energia.
