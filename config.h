#pragma once

// Fernando: 1038854. Carlos: 1028775.
#define MATRICULAS "1038854_1028775"
#define MQTT_HOST "10.5.61.57"
#define MQTT_PORT 1883
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
// LCD 1602A em modo paralelo de 4 bits; RW ligado ao GND.
#define LCD_RS 30
#define LCD_E 31
#define LCD_D4 32
#define LCD_D5 33
#define LCD_D6 34
#define LCD_D7 35
// Relé no pino 9, ativo em LOW. Testar inicialmente sem carga nos contatos.
#define RELE_ATIVO LOW
// Servo posicional de sombreamento; ajustar ângulos ao mecanismo sem forçar batentes.
#define SERVO_PIN 42
#define SERVO_ANGULO_ABERTO 0
#define SERVO_ANGULO_SOMBRA 90
