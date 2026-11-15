# Montagem do protótipo disponível

Montagem atual: Mega 2560 com ESP8266 WiFi Shield V1.0, LCD **1602A paralelo** (sem I2C), **servo posicional de 180°** para sombreamento, relé de um canal, LEDs, LDR e potenciômetro. O servo substitui o motor de passo e o ULN2003 das fotos anteriores; confirmar o modelo e sua tensão antes de alimentar. O sensor branco parece DHT22; o firmware mantém `DHT_TYPE DHT22`. Confirmar a identificação na frente do sensor antes do teste.

## Mapa do Mega

| Componente | Ligação de sinal |
|---|---|
| Potenciômetro de solo | Central → A1; extremos → 5 V e GND |
| LDR | A0 no ponto central do divisor descrito abaixo |
| Módulo de temperatura | OUT → 7; `+` → 5 V; `−` → GND, seguindo a serigrafia |
| LED de irrigação da aroeira | 22 → resistor 220 Ω → ânodo; cátodo → GND |
| LED de irrigação do ingá | 26 → resistor 220 Ω → ânodo; cátodo → GND |
| Relé de ventilação | IN → 9; alimentação conforme VCC/GND do módulo |
| Servo de sombreamento | Sinal → 42; alimentação externa e GND comum conforme abaixo |
| LCD RS, E, D4, D5, D6, D7 | 30, 31, 32, 33, 34, 35, respectivamente |
| ESP TX / Mega RX1 | ESP TX → 19 |
| Mega TX1 / ESP RX | 18 → conversão 5 V/3,3 V → ESP RX |

Os pinos 24, 20/21 e 40/41/43 não são usados nesta montagem. As antigas ligações do OLED, dos LEDs de sombra/ventilação e do ULN2003 não se aplicam.

## LCD 1602A — conferir o número e o nome de cada terminal

| Terminal do LCD | Conexão |
|---|---|
| 1 VSS | GND |
| 2 VDD | 5 V |
| 3 VO | Central de **outro potenciômetro de aproximadamente 10 kΩ**, para contraste |
| 4 RS | Mega 30 |
| 5 RW | GND |
| 6 E | Mega 31 |
| 7–10 D0–D3 | Sem conexão |
| 11 D4 | Mega 32 |
| 12 D5 | Mega 33 |
| 13 D6 | Mega 34 |
| 14 D7 | Mega 35 |
| 15 A / LED+ | 5 V por resistor de 220 Ω para o primeiro teste |
| 16 K / LED− | GND |

Extremos do potenciômetro de contraste em 5 V e GND. O potenciômetro que simula solo continua separado em A1. Se só tiver um, será necessário obter outro potenciômetro/trimpot para regular o contraste. Não conectar o LCD aos pinos SDA/SCL: este módulo não tem adaptador I2C.

## LDR

Para o LDR avulso da foto: **5 V → LDR → ponto A0 → resistor de 10 kΩ → GND**. Assim o valor ADC cresce com a luz, coerente com o limiar de sombreamento `> 90%`. É medida relativa; a resposta depende da iluminação e do resistor. O módulo LDR usado no diagrama Wokwi é uma aproximação e pode ter sentido inverso; para a montagem física, siga este divisor.

## Servo e relé

Usar um **servo posicional de 180°**, não um modelo de rotação contínua. Desligar a alimentação e remover o motor de passo e o ULN2003. Ligar o servo diretamente conforme a identificação dos fios no modelo:

| Fio do servo | Ligação |
|---|---|
| Sinal (geralmente amarelo, laranja ou branco) | Mega **42** |
| Positivo (geralmente vermelho) | Positivo de fonte externa regulada, na tensão especificada pelo servo |
| GND (geralmente marrom ou preto) | Negativo da fonte **e GND do Mega** |

Para um servo especificado para 5 V, usar fonte de 5 V com corrente suficiente para o modelo e a carga. Não alimentar pelo pino de sinal nem supor que a USB pode alimentar todas as cargas. O diagrama Wokwi usa o 5 V do Mega somente para simulação; na montagem física, seguir a fonte externa descrita aqui.

O servo representa a tela de sombreamento: ao iniciar, recebe o comando **0° (aberto/sem sombra)**. Quando a luz excede 90%, recebe **90° (tela fechada/sombreando)**; em 90% ou menos, retorna a 0°. Ajustar `SERVO_ANGULO_ABERTO` e `SERVO_ANGULO_SOMBRA` em `config.h` conforme a montagem; podem ser invertidos se o mecanismo trabalhar no sentido oposto. Testar primeiro com o braço desacoplado e ajustar os ângulos para não forçar batentes. A biblioteca Servo mantém os pulsos sem `delay()` no programa; o servo permanece conectado para manter a posição. O estado publicado indica o comando, não uma posição medida da tela.

O relé representa a ventilação do ingá acima de 25 °C. Primeiro testar **sem carga nos contatos**, observando LED e clique. Para um módulo ativo em LOW, configurar `RELE_ATIVO LOW`; para ativo em HIGH, usar `HIGH`. O estado inicial é desligado. A foto não informa a tensão/potência de um ventilador: os terminais COM/NO ficam sem carga neste primeiro teste.

### Teste opcional: LED no lugar do relé

O firmware está novamente com `RELE_ATIVO LOW` para o teste com relé. Para testar a saída de ventilação com um LED, alterar temporariamente para `RELE_ATIVO HIGH`. Com a alimentação desligada, desconectar o módulo relé e ligar **pino 9 → resistor de 220 Ω → ânodo do LED (perna longa); cátodo (perna curta/lado achatado) → GND do Mega**. Reenviar o sketch. O LED inicia apagado, acende acima de 25 °C e apaga em 25 °C ou menos, acompanhando `Ventilacao` no serial. A primeira leitura ocorre após cerca de 18 s; as seguintes, a cada 8 s. Ao reinstalar o relé, remover o LED de teste, ajustar `RELE_ATIVO` à polaridade do módulo e reenviar o sketch. O diagrama principal continua representando a montagem com relé.

## Sequência de teste sem rede

1. Manter `wifi_secrets.h` ausente ou SSID vazio e gravar o firmware no Mega.
2. Conferir LCD e ajustar contraste. Monitor Serial: 115200 baud.
3. Após cerca de 18 s, aparecem as primeiras leituras; ciclos seguintes a cada 8 s.
4. Girar o potenciômetro: abaixo de 30%, ambos os LEDs de irrigação acendem; de 30% até abaixo de 60%, apenas o do ingá; a partir de 60%, ambos apagam.
5. Conferir o servo em 0° ao iniciar. Variar iluminação e conferir o percentual no serial. Ao passar de 90%, deve ir a 90°; ao voltar a 90% ou menos, deve retornar a 0°. Conferir também durante uma tentativa de conexão Wi-Fi/MQTT.
6. Comparar temperatura com o relé: liga acima de 25 °C, desliga em 25 °C ou menos. Se aparecer ERRO, conferir OUT/+/−, contato e modelo do sensor.
7. O LCD alterna espécie a cada ciclo e páginas a cada 1,5 s: solo/luz, temperatura, atuadores e conexão. `I` = irrigação, `S` = sombreamento, `V` = ventilação, `W` = Wi-Fi. `ON/OFF` indicam ligado/desligado.
8. Configurar o Wi-Fi e seguir o teste MQTT do README. Durante publicação, a frase completa `>>> PUBLICANDO >>>` aparece repartida em duas linhas por cerca de 1,5 s após o último envio.

## Referências

- [Arduino: LCD paralelo e LiquidCrystal](https://docs.arduino.cc/learn/electronics/lcd-displays/)
- [Arduino: biblioteca Servo](https://docs.arduino.cc/libraries/servo/)
- [Wokwi: servo posicional e seus terminais](https://docs.wokwi.com/parts/wokwi-servo)
