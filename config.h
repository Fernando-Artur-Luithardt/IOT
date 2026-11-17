#pragma once

// Fernando: 1038854. Carlos: 1028775.
#define MATRICULAS "1038854_1028775"
// CP3: a placa usa o broker LOCAL; o Node-RED faz a ponte TLS autorizada.
// Atualize o IP abaixo para o computador que executa o Mosquitto.
#define MQTT_HOST "10.5.61.57"
#define MQTT_PORT 1883
#define MQTT_TURMA "t28"
#define DEVICE_ID "mega01"

// Mega 2560 + ESP8266 WiFi Shield V1.0, com firmware AT.
// Serial1: RX1=19, TX1=18. Deve coincidir com o baud do firmware AT.
#define ESP_SERIAL Serial1
#define ESP_BAUD 115200
#define WIFI_RETRY_MS 30000UL
// Crie wifi_secrets.h a partir do exemplo para habilitar a conexão.
#if __has_include("wifi_secrets.h")
#include "wifi_secrets.h"
#else
#define WIFI_SSID ""
#define WIFI_PASSWORD ""
#endif
// LCD 1602A versão 5.5 em modo paralelo de 4 bits; RW ligado ao GND.
#define LCD_RS 30
#define LCD_E 31
#define LCD_D4 32
#define LCD_D5 33
#define LCD_D6 34
#define LCD_D7 35
// Relé no pino 9, ativo em LOW conforme ajuste solicitado na montagem. Testar inicialmente sem carga nos contatos.
#define RELE_ATIVO LOW
// 28BYJ-48 5 V via ULN2003: entradas IN1, IN2, IN3, IN4.
#define PASSO_IN1 40
#define PASSO_IN2 41
#define PASSO_IN3 42
#define PASSO_IN4 43
// Meios passos relativos à posição aberta definida manualmente no início.
#define PASSO_POSICAO_SOMBRA 1024L
#define PASSO_INTERVALO_MS 4UL
