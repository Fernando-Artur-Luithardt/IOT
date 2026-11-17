# Checkpoint 2 — Monitoramento de espécies nativas

Arduino Mega, aroeira-vermelha e ingá. Mantém os sensores e limiares do Checkpoint 1; acrescenta Wi-Fi/MQTT, LCD e Node-RED local.

## Hardware

- Arduino **Mega 2560 + ESP8266 WiFi Shield V1.0**, com firmware AT compatível com WiFiEspAT 1.5.0. Rede Wi-Fi de 2,4 GHz.
- Comunicação por **Serial1**: TX do ESP → RX1/pino **19**; TX1/pino **18** → RX do ESP, com adaptação de nível **5 V → 3,3 V** no sentido Mega → ESP; GND comum. Use os sinais UART do ESP, não conecte o TX do Mega diretamente ao RX de 3,3 V.
- Alimente o shield pela entrada de alimentação especificada nele (normalmente 5 V via encaixe, usando o regulador do shield). Não alimente o ESP pelo pino 3,3 V do Mega.
- Para a variante **WangTongze V1.0 com quatro DIP switches**, mantenha SW1/SW2 OFF para isolar D0/D1; SW3 OFF para execução normal. Ligue a Serial1 pelo conector UART/Debug com a conversão de nível acima. A inscrição V1.0 aparece em variantes diferentes: confira a serigrafia/manual antes de alterar DIP switches; não use a configuração de uma Mega com ESP integrado. Há relatos documentados de defeito no circuito de conversão dessa variante, por isso não se presume que o Debug Port aceite 5 V.
- LCD **1602A versão 5.5 paralelo 16×2**: RS/E/D4/D5/D6/D7 → **30/31/32/33/34/35**, RW → GND. Alimentação e contraste em [docs/montagem.md](docs/montagem.md).
- Solo/potenciômetro → A1; luminosidade/LDR → A0; DHT22 → 7.
- LED irrigação aroeira → 22; LED irrigação ingá → 26; relé ventilação → 9. Motor de passo **28BYJ-48 5 V + ULN2003**: IN1/IN2/IN3/IN4 → **40/41/42/43**, alimentação externa 5 V e GND comum. Iniciar com a tela aberta. Percurso configurável em `PASSO_POSICAO_SOMBRA`: 1024 meios passos (aproximadamente ¼ de volta).

O `diagram.json` representa sensores, LEDs, relé e LCD no Wokwi. Quatro LEDs adicionais representam somente os sinais IN1–IN4; **não simulam o motor, o driver nem o shield Wi-Fi**. A montagem física e a alimentação do motor estão em [docs/montagem.md](docs/montagem.md). Sem rede, sensores, regras, motor e display continuam sendo atendidos. O motor não possui referência automática: reiniciar exige posicionar a tela aberta previamente.

Confira primeiro o mapa completo de ligações e o teste sem rede em **[docs/montagem.md](docs/montagem.md)**.

## Configurar e executar

1. As matrículas de Fernando e Carlos estão configuradas em `config.h`. O prefixo da dupla é `1038854_1028775`. Copiar `wifi_secrets.example.h` para `wifi_secrets.h` e preencher SSID/senha localmente. Esse arquivo é ignorado pelo Git. A rede usa DHCP. Ajustar `ESP_BAUD` ao baud do firmware AT (padrão configurado: 115200). Alterar `DEVICE_ID` caso haja outra placa.
2. Instalar as bibliotecas de `libraries.txt` no Arduino IDE. Abrir `sketch.ino` junto com `checkpoint2.h`, `atuadores.h`, `config.h` e `wifi_secrets.h`, selecionar **Arduino Mega 2560** e carregar **no Mega**, preservando o firmware AT do ESP8266. Monitor Serial em **115200 baud**. Se o IDE pedir uma pasta `sketch`, copiar o `.ino` e todos esses `.h` juntos para ela.
3. Iniciar o Docker Desktop. No terminal:

   ```sh
   cd cp2-broker
   cp .env.example .env
   docker compose up -d --build
   ```

4. Ajustar a mesma matrícula no `.env`. Editor: <http://localhost:1880>. Dashboard: <http://localhost:1880/dashboard/estufas>. O fluxo já é carregado; o nó de debug mostra tópico e payload originais. Após mudar `.env`, executar `docker compose up -d` novamente.
5. Primeiro testar com broker local: `MQTT_HOST=mosquitto` no `.env` e IP LAN do computador em `MQTT_HOST` no firmware. Recarregar o firmware e recriar o serviço. Na entrega, restaurar **`test.mosquitto.org` nos dois lugares**.

O fluxo exportado está em `cp2-broker/nodered/flows.json`. Também pode ser importado em outro Node-RED com `@flowfuse/node-red-dashboard` instalado e variáveis de ambiente `MATRICULAS`, `MQTT_HOST`, `MQTT_PORT` e `MQTT_TOPIC` configuradas. Na primeira execução, o Compose copia o fluxo para `/data/checkpoint2-flows.json`, separado dos fluxos antigos. Execuções seguintes preservam suas edições. Para atualizar a partir do repositório, importe o JSON pelo editor. Exporte pelo editor alterações feitas durante os testes.

## Firmware identificado e biblioteca Wi-Fi

A consulta física `AT+GMR` retornou **AT 1.7.6.0 / SDK 3.0.6-dev / Wroom 02**. O projeto agora usa **WiFiEspAT 1.5.0**, com recepção passiva para AT 1.7. Não é necessário atualizar o firmware do ESP para experimentar esta versão. O aviso `Unsupported firmware 3.0.6` da antiga WiFiEsp se referia ao SDK; isoladamente ele não comprovava a causa do timeout.

No Arduino IDE, instalar **WiFiEspAT**, de Juraj Andrassy. O cabeçalho correto é `WiFiEspAT.h`. O timeout MQTT foi ajustado para 5 s e o serial agora informa separadamente inicialização AT, conexão Wi-Fi/IP e estado da conexão MQTT. A solução ainda deve ser validada com a placa real.

## Diagnóstico do shield

Sem `wifi_secrets.h`, o monitoramento local funciona e o LCD mostra Wi-Fi desligado. Se aparecer `[CP2] Falha ao inicializar ESP/recepcao passiva.`, confira alimentação, RX/TX cruzados, DIP switches e baud. Use o diagnóstico `diagnostics/esp8266_at/esp8266_at.ino` para verificar se `AT` responde `OK` e consultar `AT+GMR`. Um firmware de fábrica de outro tipo pode precisar ser substituído por firmware AT compatível; o código do projeto não grava o ESP. Confirme o modelo/flash antes de atualizar o módulo.

## Comportamento

- Leitura a cada **8 segundos**, após a inicialização existente (primeira leitura cerca de 18 segundos após o início do temporizador). Conferir se o intervalo corresponde ao requisito documentado no CP1.
- Publica solo `%`, luminosidade relativa `%` e temperatura `°C` para cada espécie; os sensores físicos são compartilhados, como no CP1. Não publica temperatura inválida; LCD mostra `ERRO` e a regra conserva a última temperatura válida, conforme o firmware original.
- Estados dos atuadores são retidos e publicados inicialmente, após reconexão e quando mudam. Estado pendente é reenviado se a publicação falhar; sem rede, conserva-se o estado atual, não o histórico de transições.
- Duas sessões MQTT, uma por espécie, cada uma com `online` retido e última vontade `offline` retida. O broker detecta a desconexão após o timeout, não instantaneamente.
- LCD alterna a espécie a cada leitura e páginas a cada 1,5 s para sensores, atuadores e Wi-Fi/MQTT. O aviso `>>> PUBLICANDO >>>` é repartido em duas linhas e dura cerca de 1,5 s após a última publicação bem-sucedida do lote. Não usa `delay` para o aviso.
- Tentativas de Wi-Fi são espaçadas por 30 s; MQTT, por 5 s. WiFiEspAT executa chamadas AT síncronas, inclusive esperas longas. Um adaptador de `Stream` e o `yield()` do AVR atendem sensores, regras e LCD durante essas esperas, sem executar comandos de rede recursivos. Estados de conexão exibidos são consultados e armazenados separadamente. Validar a cadência na placa ao desligar o ponto de acesso e ao reiniciar o shield.
- No painel, leituras representam **a última amostra recebida**; consulte o status antes de considerá-las atuais. Cada espécie tem seu próprio grupo.

## Testes e entrega

```sh
sh tests/firmware.test.sh
node --test tests/flow.test.cjs
docker compose -f cp2-broker/docker-compose.yml config --quiet
```

O teste nativo usa periféricos simulados para verificar a execução local durante esperas, os limiares, a sequência de meios passos, ida/volta e inversão do motor e a preservação de publicações pendentes; não substitui o teste do shield e do motor físicos.

Seguir `docs/checkpoint2-entrega.md` para incorporar os Blocos 4, 6, 8, 9 e 10 **ao documento original do projeto**, registrar testes físicos e anexar evidências. Avaliação por pares e resultados observados devem ser preenchidos pela dupla.

Após os testes, desligar a placa, aguardar os dois status `offline` e remover somente as mensagens retidas da dupla:

```sh
sh scripts/limpar-retidas.sh 1038854_1028775 test.mosquitto.org
```

## Referências de implementação

- [WiFiEspAT — biblioteca e firmware AT](https://github.com/JAndrassy/WiFiEspAT)
- [Shield WangTongze V1.0 — switches e particularidades elétricas](https://www.espruino.com/arduino-esp8266)
- [PubSubClient](https://pubsubclient.knolleary.net/api)
- [FlowFuse Dashboard](https://dashboard.flowfuse.com/getting-started)
