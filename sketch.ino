#include <DHT.h>
#include "config.h"
#include "atuadores.h"

// =====================================================
// SENSORES
// =====================================================

#define PIN_LDR A0
#define PIN_SOLO A1
#define PIN_DHT 7

#define DHT_TYPE DHT22

DHT dht(PIN_DHT, DHT_TYPE);

// =====================================================
// ATUADORES: LEDS DE IRRIGAÇÃO, SERVO E RELÉ
// =====================================================

// Aroeira-vermelha
#define LED_AROEIRA_IRRIGACAO    22

// Ingá
#define LED_INGA_IRRIGACAO       26
#define RELE_INGA_VENTILACAO       9

// =====================================================
// LIMITES
// =====================================================

// Aroeira-vermelha
const int LIMITE_SOLO_AROEIRA = 30;
const int LIMITE_LUZ_AROEIRA  = 90;

// Ingá
const int LIMITE_SOLO_INGA = 60;
const float LIMITE_TEMP_INGA = 25.0;

// =====================================================
// INTERVALOS
// =====================================================

// Tempo inicial antes da primeira leitura
const unsigned long INTERVALO_INICIAL = 10000;

// Intervalo entre as leituras
const unsigned long INTERVALO_LEITURA = 8000;

// =====================================================
// CONTROLE DE TEMPO
// =====================================================

unsigned long tempoInicial = 0;
unsigned long ultimaLeitura = 0;

bool sistemaIniciado = false;

// =====================================================
// VARIÁVEIS DOS SENSORES
// =====================================================

int leituraSolo = 0;
int leituraLuz = 0;

int umidadeSolo = 0;
int luminosidade = 0;

float temperatura = 0;

// =====================================================
// SETUP
// =====================================================

#include "checkpoint2.h"

void setup() {

  Serial.begin(115200);

  dht.begin();

  // Configuração dos LEDs
  pinMode(LED_AROEIRA_IRRIGACAO, OUTPUT);

  pinMode(LED_INGA_IRRIGACAO, OUTPUT);
  digitalWrite(RELE_INGA_VENTILACAO, !RELE_ATIVO);
  pinMode(RELE_INGA_VENTILACAO, OUTPUT);
  sombreamentoInicio();

  // LEDs inicialmente desligados
  digitalWrite(LED_AROEIRA_IRRIGACAO, LOW);
  digitalWrite(LED_INGA_IRRIGACAO, LOW);
  digitalWrite(RELE_INGA_VENTILACAO, !RELE_ATIVO);

  Serial.println();
  Serial.println("==========================================");
  Serial.println("     SISTEMA DE MONITORAMENTO - ESTUFAS");
  Serial.println("==========================================");
  Serial.println("Potenciometro = Sensor de Umidade do Solo");
  Serial.println("Sistema iniciado!");
  Serial.println("Aguardando 10 segundos para iniciar...");
  Serial.println();

  // Guarda o momento em que o sistema iniciou
  cp2Inicio();
  tempoInicial = millis();
  cp2LocaisProntas = true;
}

// =====================================================
// LOOP
// =====================================================

void loop() {
  cp2TarefasLocais();
  cp2Loop();
}

// Arduino AVR chama yield() durante delay(); o adaptador Stream também o
// complementa quando WiFiEsp aguarda bytes. A guarda impede reentrada.
void yield() {
  cp2TarefasLocais();
}

void cp2TarefasLocais() {
  if (!cp2LocaisProntas || cp2EmTarefaLocal) return;
  cp2EmTarefaLocal = true;
  atualizarSensores();
  cp2Desenhar();
  cp2EmTarefaLocal = false;
}

void atualizarSensores() {
  unsigned long agora = millis();

  // ===================================================
  // AGUARDA 10 SEGUNDOS PARA INICIAR
  // ===================================================

  if (!sistemaIniciado) {

    if (agora - tempoInicial >= INTERVALO_INICIAL) {

      sistemaIniciado = true;
      ultimaLeitura = agora;

      Serial.println();
      Serial.println("==========================================");
      Serial.println("     MONITORAMENTO INICIADO");
      Serial.println("==========================================");
      Serial.println();
    }

    return;
  }

  // ===================================================
  // CONTROLA O INTERVALO ENTRE AS LEITURAS
  // ===================================================

  if (agora - ultimaLeitura < INTERVALO_LEITURA) {
    return;
  }

  ultimaLeitura = agora;

  // ===================================================
  // LEITURA DOS SENSORES
  // ===================================================

  // Potenciômetro simulando sensor de umidade do solo
  leituraSolo = analogRead(PIN_SOLO);

  // LDR simulando luminosidade
  leituraLuz = analogRead(PIN_LDR);

  // DHT22
  float novaTemperatura = dht.readTemperature();

  // Atualiza temperatura somente se a leitura for válida
  if (!isnan(novaTemperatura)) {
    temperatura = novaTemperatura;
  }

  // ===================================================
  // CONVERSÃO DOS VALORES
  // ===================================================

  // Converte ADC de 0-1023 para porcentagem
  umidadeSolo = map(leituraSolo, 0, 1023, 0, 100);

  luminosidade = map(leituraLuz, 0, 1023, 0, 100);

  // Garante valores entre 0 e 100
  umidadeSolo = constrain(umidadeSolo, 0, 100);
  luminosidade = constrain(luminosidade, 0, 100);

  // ===================================================
  // AROEIRA-VERMELHA
  // ===================================================

  bool irrigacaoAroeira =
    umidadeSolo < LIMITE_SOLO_AROEIRA;

  bool sombreamentoAroeira =
    luminosidade > LIMITE_LUZ_AROEIRA;

  digitalWrite(
    LED_AROEIRA_IRRIGACAO,
    irrigacaoAroeira ? HIGH : LOW
  );

  sombreamentoAplicar(sombreamentoAroeira);

  // ===================================================
  // INGÁ
  // ===================================================

  bool irrigacaoInga =
    umidadeSolo < LIMITE_SOLO_INGA;

  bool ventilacaoInga =
    temperatura > LIMITE_TEMP_INGA;

  digitalWrite(
    LED_INGA_IRRIGACAO,
    irrigacaoInga ? HIGH : LOW
  );

  digitalWrite(
    RELE_INGA_VENTILACAO,
    ventilacaoInga ? RELE_ATIVO : !RELE_ATIVO
  );

  cp2NovaLeitura(!isnan(novaTemperatura), irrigacaoAroeira,
                 sombreamentoAroeira, irrigacaoInga, ventilacaoInga);

  // ===================================================
  // MONITOR SERIAL
  // ===================================================

  Serial.println();
  Serial.println("==========================================");
  Serial.println("          LEITURA DOS SENSORES");
  Serial.println("==========================================");

  // ---------------------------------------------------
  // UMIDADE DO SOLO
  // ---------------------------------------------------

  Serial.print("Umidade do solo : ");
  Serial.print(umidadeSolo);
  Serial.print("%");

  Serial.print("  [ADC: ");
  Serial.print(leituraSolo);
  Serial.println("]");

  // ---------------------------------------------------
  // LUMINOSIDADE
  // ---------------------------------------------------

  Serial.print("Luminosidade    : ");
  Serial.print(luminosidade);
  Serial.print("%");

  Serial.print("  [ADC: ");
  Serial.print(leituraLuz);
  Serial.println("]");

  // ---------------------------------------------------
  // TEMPERATURA
  // ---------------------------------------------------

  Serial.print("Temperatura     : ");

  if (isnan(novaTemperatura)) {
    Serial.println("ERRO NA LEITURA");
  } else {
    Serial.print(temperatura, 1);
    Serial.println(" C");
  }

  // ===================================================
  // AROEIRA-VERMELHA
  // ===================================================

  Serial.println();
  Serial.println("--- AROEIRA-VERMELHA ---");

  Serial.print("Irrigacao       : ");

  if (irrigacaoAroeira) {
    Serial.println("LIGADA");
  } else {
    Serial.println("DESLIGADA");
  }

  Serial.print("Sombreamento    : ");

  if (sombreamentoAroeira) {
    Serial.println("LIGADO");
  } else {
    Serial.println("DESLIGADO");
  }

  // ===================================================
  // INGÁ
  // ===================================================

  Serial.println();
  Serial.println("--- INGA ---");

  Serial.print("Irrigacao       : ");

  if (irrigacaoInga) {
    Serial.println("LIGADA");
  } else {
    Serial.println("DESLIGADA");
  }

  Serial.print("Ventilacao      : ");

  if (ventilacaoInga) {
    Serial.println("LIGADA");
  } else {
    Serial.println("DESLIGADA");
  }

  // ===================================================
  // LIMITES
  // ===================================================

  Serial.println();
  Serial.println("--- LIMITES CONFIGURADOS ---");

  Serial.print("Aroeira - Solo  : ");
  Serial.print(LIMITE_SOLO_AROEIRA);
  Serial.println("%");

  Serial.print("Aroeira - Luz   : ");
  Serial.print(LIMITE_LUZ_AROEIRA);
  Serial.println("%");

  Serial.print("Inga - Solo     : ");
  Serial.print(LIMITE_SOLO_INGA);
  Serial.println("%");

  Serial.print("Inga - Temp.    : ");
  Serial.print(LIMITE_TEMP_INGA);
  Serial.println(" C");

  Serial.println("==========================================");
}
