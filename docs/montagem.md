# Montagem do protótipo disponível

Montagem atual: Mega 2560 com ESP8266 WiFi Shield V1.0, LCD **1602A versão 5.5 paralelo** (sem I2C), **motor de passo 28BYJ-48 de 5 V com driver ULN2003** para sombreamento, relé de um canal, LEDs, LDR e potenciômetro. O motor de passo substitui o servo. O sensor branco parece DHT22; o firmware mantém `DHT_TYPE DHT22`. Confirmar a identificação na frente do sensor antes do teste.

## Mapa do Mega

| Componente | Ligação de sinal |
|---|---|
| Potenciômetro de solo | Central → A1; extremos → 5 V e GND |
| LDR | A0 no ponto central do divisor descrito abaixo |
| Módulo de temperatura | OUT → 7; `+` → 5 V; `−` → GND, seguindo a serigrafia |
| LED de irrigação da aroeira | 22 → resistor 220 Ω → ânodo; cátodo → GND |
| LED de irrigação do ingá | 26 → resistor 220 Ω → ânodo; cátodo → GND |
| Relé de ventilação | IN → 9; alimentação conforme VCC/GND do módulo |
| Driver do motor de passo | IN1 → 40; IN2 → 41; IN3 → 42; IN4 → 43 |
| LCD RS, E, D4, D5, D6, D7 | 30, 31, 32, 33, 34, 35, respectivamente |
| ESP TX / Mega RX1 | ESP TX → 19 |
| Mega TX1 / ESP RX | 18 → conversão 5 V/3,3 V → ESP RX |

Os pinos 24 e 20/21 não são usados nesta montagem. Remover a antiga ligação do servo no pino 42 antes de conectar o driver.

## LCD 1602A versão 5.5 — conferir o número e o nome de cada terminal

Esta configuração usa a interface paralela de 16 terminais, sem adaptador I2C. A inscrição de versão sozinha não identifica a presença de um adaptador: se houver uma placa traseira com apenas GND/VCC/SDA/SCL, a ligação e a biblioteca precisam ser adaptadas para I2C. O LCD é uma alternativa aceita ao OLED no requisito do projeto; as páginas abaixo permitem exibir todo o conteúdo em 16×2.

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

## Motor de passo e relé

Motor confirmado: **28BYJ-48, 5 V DC**. As ligações abaixo pressupõem o driver **ULN2003** com conector de cinco vias para o motor; conferir a identificação na placa.

| Terminal do driver | Ligação |
|---|---|
| IN1 | Mega 40 |
| IN2 | Mega 41 |
| IN3 | Mega 42 |
| IN4 | Mega 43 |
| + / VCC da alimentação do motor | +5 V de fonte externa regulada |
| − / GND | Negativo da fonte e GND do Mega |
| Conector de cinco vias | Plugue do motor 28BYJ-48 |

Não ligar as bobinas diretamente ao Mega. Alimentar o motor pelo driver, usando fonte externa de 5 V com capacidade para a carga. O Mega pode continuar alimentado por USB; unir os GNDs, sem unir o positivo da fonte externa ao 5 V da USB. Fazer as ligações com as fontes desligadas.

**Jumper:** sua função depende da placa. A identificação do motor não identifica o jumper do driver. Não alterar nem fazer pontes sem conferir a serigrafia/manual ou uma foto da placa.

O firmware usa uma sequência de oito meios passos, com intervalo mínimo de 4 ms entre atualizações. Luz acima de 90% solicita sombra; em 90% ou menos, solicita abertura. `PASSO_POSICAO_SOMBRA = 1024` corresponde nominalmente a cerca de ¼ de volta do eixo de saída; calibrar o percurso real sem carga antes de acoplar à tela. Um valor negativo inverte o sentido do fechamento. Não há biblioteca extra de motor.

**Antes de cada inicialização, deixar a tela aberta:** o software assume essa posição como zero. Para posicionar, desacoplar o mecanismo; não forçar o eixo com redução. Sem fim de curso ou encoder, ele não detecta batentes, perda de passos nem posição após reiniciar. Para referência automática, adicionar fim de curso e rotina de busca. O estado MQTT indica o comando solicitado, não chegada ao destino.

O movimento avança um meio passo por atendimento, sem `delay()` ou laço de espera. Leituras e display continuam durante o movimento. Esperas de rede podem alongar o percurso. Ao chegar ao destino, mantém a última fase energizada para segurar a tela.

O relé representa a ventilação do ingá acima de 25 °C. Primeiro testar **sem carga nos contatos**, observando LED e clique. Para um módulo ativo em LOW, configurar `RELE_ATIVO LOW`; para ativo em HIGH, usar `HIGH`. O estado inicial é desligado. A foto não informa a tensão/potência de um ventilador: os terminais COM/NO ficam sem carga neste primeiro teste.

### Teste opcional: LED no lugar do relé

O firmware está com `RELE_ATIVO LOW`, conforme a inversão solicitada para a montagem. Validar LED e clique do módulo acima e abaixo de 25 °C após reenviar o sketch. Para testar a saída de ventilação com um LED, alterar temporariamente para `RELE_ATIVO HIGH`. Com a alimentação desligada, desconectar o módulo relé e ligar **pino 9 → resistor de 220 Ω → ânodo do LED (perna longa); cátodo (perna curta/lado achatado) → GND do Mega**. Reenviar o sketch. O LED inicia apagado, acende acima de 25 °C e apaga em 25 °C ou menos, acompanhando `Ventilacao` no serial. A primeira leitura ocorre após cerca de 18 s; as seguintes, a cada 8 s. Ao reinstalar o relé, remover o LED de teste, ajustar `RELE_ATIVO` à polaridade do módulo e reenviar o sketch. O diagrama principal continua representando a montagem com relé.

## Sequência de teste sem rede

1. Manter `wifi_secrets.h` ausente ou SSID vazio e gravar o firmware no Mega.
2. Conferir LCD e ajustar contraste. Monitor Serial: 115200 baud.
3. Após cerca de 18 s, aparecem as primeiras leituras; ciclos seguintes a cada 8 s.
4. Girar o potenciômetro: abaixo de 30%, ambos os LEDs de irrigação acendem; de 30% até abaixo de 60%, apenas o do ingá; a partir de 60%, ambos apagam.
5. Iniciar com a tela aberta e testar primeiro desacoplado. Ao passar de 90% de luz, o motor deve percorrer 1024 meios passos; ao voltar a 90% ou menos, deve retornar ao zero. Repetir a leitura não deve acumular voltas. Conferir também durante tentativas Wi-Fi/MQTT.
6. Comparar temperatura com o relé: liga acima de 25 °C, desliga em 25 °C ou menos. Se aparecer ERRO, conferir OUT/+/−, contato e modelo do sensor.
7. O LCD alterna espécie a cada ciclo e páginas a cada 1,5 s: solo/luz, temperatura, atuadores e conexão. `I` = irrigação, `S` = sombreamento, `V` = ventilação, `W` = Wi-Fi. `ON/OFF` indicam ligado/desligado.
8. Configurar o Wi-Fi e seguir o teste MQTT do README. Durante publicação, a frase completa `>>> PUBLICANDO >>>` aparece repartida em duas linhas por cerca de 1,5 s após o último envio.

## Referências

- [Arduino: LCD paralelo e LiquidCrystal](https://docs.arduino.cc/learn/electronics/lcd-displays/)
- [28BYJ-48: ficha técnica e modos de passo](https://www.gentiam.com/wp-content/uploads/2022/09/GentiamElectronics-28BYJ-48-Stepper-Motor-Datasheet-Rev20220925-final.pdf)
