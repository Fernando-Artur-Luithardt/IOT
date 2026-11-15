#pragma once
#include <WiFiEspAT.h>
#include <PubSubClient.h>
#include <LiquidCrystal.h>
#include "config.h"

// WiFiEspAT aguarda respostas AT de modo síncrono. A serial cooperativa e
// yield() executam apenas tarefas locais durante essas esperas, nunca outra AT.
void cp2TarefasLocais();
class Cp2SerialCooperativa : public Stream {
 public:
  int available() override {
    if (!ESP_SERIAL.available()) cp2TarefasLocais();
    return ESP_SERIAL.available();
  }
  int read() override {
    // WiFiEspAT usa Stream::readBytes(), que consulta read(), não available().
    if (!ESP_SERIAL.available()) cp2TarefasLocais();
    return ESP_SERIAL.read();
  }
  int peek() override { return ESP_SERIAL.peek(); }
  void flush() override { ESP_SERIAL.flush(); }
  size_t write(uint8_t b) override { return ESP_SERIAL.write(b); }
  using Print::write;
};
Cp2SerialCooperativa cp2Serial;
WiFiClient cp2Transporte[2];
PubSubClient cp2Mqtt[2];
LiquidCrystal cp2Display(LCD_RS, LCD_E, LCD_D4, LCD_D5, LCD_D6, LCD_D7);
char cp2Linhas[2][17] = {{0}, {0}};
const char* cp2Especie[] = {"aroeira-vermelha", "inga"};
const char* cp2Nome[] = {"Aroeira-vermelha", "Inga"};
const char* cp2Atuador[2][2] = {{"irrigacao", "sombreamento"}, {"irrigacao", "ventilacao"}};
bool cp2Estados[2][2] = {{false, false}, {false, false}};
int8_t cp2Enviados[2][2] = {{-1, -1}, {-1, -1}};
uint8_t cp2Pendentes[2] = {0, 0};
bool cp2Online[2] = {false, false};
bool cp2Leitura = false, cp2TempValida = false;
bool cp2Publicando = false, cp2Configurado = false;
uint8_t cp2Tela = 1, cp2Vez = 0;
bool cp2LocaisProntas = false, cp2EmTarefaLocal = false;
bool cp2Wifi = false, cp2Modulo = false;
bool cp2MqttConectado[2] = {false, false};
unsigned long cp2TentativaWifi = 0, cp2ConsultaWifi = 0;
unsigned long cp2Ciclo = 0;
unsigned long cp2UltimoEnvio = 0, cp2UltimaTela = 0, cp2Tentativa = 0;

void cp2Topico(char* destino, size_t tamanho, uint8_t especie, const char* sufixo) {
  snprintf(destino, tamanho, "unidavi/iot/t27/%s/%s/%s", MATRICULAS, cp2Especie[especie], sufixo);
}

bool cp2Rede() {
  return cp2Wifi; // Cache: desenho do LCD nunca executa comandos AT.
}

bool cp2Enviar(uint8_t especie, const char* sufixo, const char* payload, bool retida) {
  char topico[144];
  cp2Topico(topico, sizeof(topico), especie, sufixo);
  if (!cp2Rede() || !cp2Mqtt[especie].connected()) return false;
  if (!cp2Mqtt[especie].publish(topico, payload, retida)) return false;
  cp2UltimoEnvio = millis();
  cp2Publicando = true;
  Serial.print(topico); Serial.print(F(" ")); Serial.println(payload);
  return true;
}

// Preenche os 16 caracteres para apagar sobras sem piscar com clear().
void cp2Linha(uint8_t linha, const char* texto) {
  char buffer[17];
  memset(buffer, ' ', 16);
  buffer[16] = 0;
  size_t tamanho = strlen(texto);
  memcpy(buffer, texto, tamanho > 16 ? 16 : tamanho);
  if (strcmp(cp2Linhas[linha], buffer) == 0) return;
  strcpy(cp2Linhas[linha], buffer);
  cp2Display.setCursor(0, linha);
  cp2Display.print(buffer);
}

void cp2Desenhar() {
  unsigned long agora = millis();
  if (cp2Publicando && agora - cp2UltimoEnvio >= 1500) cp2Publicando = false;
  if (agora - cp2UltimaTela < 100) return;
  cp2UltimaTela = agora;
  if (cp2Publicando) {
    // A mensagem exigida tem 17 caracteres: completa em duas linhas.
    cp2Linha(0, ">>> PUBLICANDO");
    cp2Linha(1, ">>>");
    return;
  }
  cp2Linha(0, cp2Nome[cp2Tela]);
  char linha[32];
  if (!cp2Leitura) {
    cp2Linha(1, "Aguard. leitura");
    return;
  }
  uint8_t pagina = ((agora - ultimaLeitura) / 1500UL) % 4;
  switch (pagina) {
    case 0:
      snprintf(linha, sizeof(linha), "Solo%d%% Luz%d%%", umidadeSolo, luminosidade);
      break;
    case 1: {
      char valor[16];
      dtostrf(temperatura, 1, 1, valor);
      if (cp2TempValida) snprintf(linha, sizeof(linha), "Temp:%s C", valor);
      else strcpy(linha, "Temp:ERRO");
      break;
    }
    case 2:
      snprintf(linha, sizeof(linha), "I:%s %s:%s", cp2Estados[cp2Tela][0] ? "ON" : "OFF",
               cp2Tela == 0 ? "S" : "V", cp2Estados[cp2Tela][1] ? "ON" : "OFF");
      break;
    default:
      snprintf(linha, sizeof(linha), "W:%s MQTT:%s", cp2Rede() ? "ON" : "OFF",
               cp2MqttConectado[cp2Tela] ? "ON" : "OFF");
      break;
  }
  cp2Linha(1, linha);
}

void cp2Inicio() {
  cp2Configurado = strcmp(MATRICULAS, "PREENCHER") != 0 && strlen(MATRICULAS) > 0 && strlen(MATRICULAS) <= 40;
  cp2Display.begin(16, 2);
  ESP_SERIAL.begin(ESP_BAUD);
  cp2TentativaWifi = millis() - WIFI_RETRY_MS;
  for (uint8_t i = 0; i < 2; i++) {
    cp2Mqtt[i].setClient(cp2Transporte[i]);
    cp2Mqtt[i].setServer(MQTT_HOST, MQTT_PORT);
    cp2Mqtt[i].setSocketTimeout(5);
    cp2Mqtt[i].setKeepAlive(15);
    cp2Mqtt[i].setBufferSize(256);
  }
  if (!cp2Configurado) Serial.println(F("Preencha MATRICULAS em config.h para habilitar MQTT."));
  cp2Tentativa = millis() - 5000UL;
}

void cp2NovaLeitura(bool tempValida, bool irrigacaoAroeira, bool sombra, bool irrigacaoInga, bool ventilacao) {
  cp2Ciclo++;
  cp2TempValida = tempValida;
  cp2Leitura = true;
  cp2Estados[0][0] = irrigacaoAroeira;
  cp2Estados[0][1] = sombra;
  cp2Estados[1][0] = irrigacaoInga;
  cp2Estados[1][1] = ventilacao;
  cp2Tela = 1 - cp2Tela;
  // Só publica temperatura quando a leitura atual é válida.
  cp2Pendentes[0] = cp2Pendentes[1] = tempValida ? 7 : 3;
}

void cp2PublicarPendente(uint8_t i) {
  if (!cp2Online[i]) {
    cp2Online[i] = cp2Enviar(i, "status", "online", true);
    return;
  }
  for (uint8_t a = 0; a < 2; a++) {
    if (cp2Enviados[i][a] == cp2Estados[i][a]) continue;
    char sufixo[40];
    snprintf(sufixo, sizeof(sufixo), "atuador/%s", cp2Atuador[i][a]);
    bool enviado = cp2Estados[i][a];
    if (cp2Enviar(i, sufixo, enviado ? "{\"estado\":\"ligado\"}" : "{\"estado\":\"desligado\"}", true))
      cp2Enviados[i][a] = enviado;
    return;
  }
  for (uint8_t s = 0; s < 3; s++) {
    if (!(cp2Pendentes[i] & (1 << s))) continue;
    const char* sufixos[] = {"sensor/umidade-solo", "sensor/luminosidade", "sensor/temperatura"};
    char payload[64], valor[16];
    if (s == 2) dtostrf(temperatura, 1, 1, valor);
    else snprintf(valor, sizeof(valor), "%d", s == 0 ? umidadeSolo : luminosidade);
    snprintf(payload, sizeof(payload), "{\"valor\":%s,\"unidade\":\"%s\"}", valor, s == 2 ? "°C" : "%");
    unsigned long cicloEnviado = cp2Ciclo;
    if (cp2Enviar(i, sufixos[s], payload, false) && cicloEnviado == cp2Ciclo)
      cp2Pendentes[i] &= ~(1 << s);
    return;
  }
}

void cp2Loop() {
  if (!cp2Configurado || !strlen(WIFI_SSID)) return;
  unsigned long agoraWifi = millis();
  if (cp2Modulo && agoraWifi - cp2ConsultaWifi >= 2000UL) {
    uint8_t statusWifi = WiFi.status();
    cp2Wifi = statusWifi == WL_CONNECTED;
    if (statusWifi == WL_NO_SHIELD) cp2Modulo = false;
    cp2ConsultaWifi = millis();
  }
  if (!cp2Wifi) {
    for (uint8_t i = 0; i < 2; i++) {
      if (cp2MqttConectado[i]) cp2Transporte[i].stop();
      cp2MqttConectado[i] = false;
    }
    if (cp2Publicando || millis() - cp2TentativaWifi < WIFI_RETRY_MS) return;
    if (!cp2Modulo) {
      Serial.println(F("[CP2] Inicializando ESP8266 com WiFiEspAT..."));
      cp2Modulo = WiFi.init(cp2Serial);
      if (cp2Modulo) {
        WiFi.setPersistent(false);
        WiFi.setAutoConnect(false);
        Serial.print(F("[CP2] Firmware AT: "));
        Serial.println(WiFi.firmwareVersion());
      } else Serial.println(F("[CP2] Falha ao inicializar ESP/recepcao passiva."));
    }
    if (cp2Modulo) {
      Serial.println(F("[CP2] Conectando ao WiFi..."));
      cp2Wifi = WiFi.begin(WIFI_SSID, WIFI_PASSWORD) == WL_CONNECTED;
      if (cp2Wifi) {
        Serial.print(F("[CP2] WiFi conectado. IP: "));
        Serial.println(WiFi.localIP());
      } else Serial.println(F("[CP2] WiFi desconectado; nova tentativa em 30 s."));
    }
    cp2TentativaWifi = millis();
    cp2ConsultaWifi = millis();
    return;
  }
  // Uma sessão por espécie: cada status tem sua própria última vontade.
  for (uint8_t i = 0; i < 2; i++) {
    cp2MqttConectado[i] = cp2Mqtt[i].connected();
    if (cp2MqttConectado[i]) cp2Mqtt[i].loop();
  }
  uint8_t i = cp2Vez;
  cp2Vez = 1 - cp2Vez;
  if (cp2Mqtt[i].connected()) {
    cp2PublicarPendente(i);
    return;
  }
  unsigned long agora = millis();
  // Sem laço de espera por rede. Evita reconectar durante o aviso e perto da leitura.
  if (cp2Publicando || agora - cp2Tentativa < 5000) return;
  if (sistemaIniciado && agora - ultimaLeitura >= INTERVALO_LEITURA - 3000UL) return;
  cp2Tentativa = agora;
  char cliente[100], status[144];
  snprintf(cliente, sizeof(cliente), "t27-%s-%s-%s", MATRICULAS, cp2Especie[i], DEVICE_ID);
  cp2Topico(status, sizeof(status), i, "status");
  Serial.print(F("[CP2] MQTT conectando: ")); Serial.println(cp2Especie[i]);
  if (cp2Mqtt[i].connect(cliente, status, 1, true, "offline")) {
    Serial.println(F("[CP2] MQTT conectado."));
    cp2MqttConectado[i] = true;
    cp2Online[i] = false;
    cp2Enviados[i][0] = cp2Enviados[i][1] = -1;
    // Não reenvia amostras antigas; sensores serão publicados na próxima leitura.
    cp2Pendentes[i] = 0;
  } else {
    Serial.print(F("[CP2] Falha MQTT, estado=")); Serial.print(cp2Mqtt[i].state());
    Serial.print(F("; erro AT=")); Serial.println((int)WiFi.getLastDriverError());
  }
}
