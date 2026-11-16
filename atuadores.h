#pragma once
#include "config.h"

// Sequência de meio passo em ordem IN1..IN4. Não usa delay nem laço de movimento.
const uint8_t sombraPinos[4] = {PASSO_IN1, PASSO_IN2, PASSO_IN3, PASSO_IN4};
const uint8_t sombraFases[8] = {0x1, 0x3, 0x2, 0x6, 0x4, 0xC, 0x8, 0x9};
long sombraPosicao = 0, sombraDestino = 0;
uint8_t sombraFase = 0;
unsigned long sombraUltimoPasso = 0;
bool sombraEnergizada = false;
static_assert(PASSO_INTERVALO_MS > 0, "Intervalo deve ser positivo");

void sombreamentoBobinas() {
  for (uint8_t i = 0; i < 4; i++)
    digitalWrite(sombraPinos[i], (sombraFases[sombraFase] & (1 << i)) ? HIGH : LOW);
}

void sombreamentoInicio() {
  // Sem fim de curso: iniciar com a tela fisicamente aberta, eixo desacoplado
  // durante a calibração. Este zero é assumido, não medido.
  sombraPosicao = sombraDestino = 0;
  sombraFase = 0;
  sombraEnergizada = false;
  sombraUltimoPasso = millis();
  for (uint8_t i = 0; i < 4; i++) {
    digitalWrite(sombraPinos[i], LOW);
    pinMode(sombraPinos[i], OUTPUT);
  }
}

void sombreamentoAplicar(bool ligado) {
  sombraDestino = ligado ? PASSO_POSICAO_SOMBRA : 0;
}

void sombreamentoAtualizar() {
  if (sombraPosicao == sombraDestino) return;
  unsigned long agora = millis();
  if (agora - sombraUltimoPasso < PASSO_INTERVALO_MS) return;
  sombraUltimoPasso = agora;
  if (!sombraEnergizada) {
    sombraEnergizada = true;
  } else {
    bool avancar = sombraDestino > sombraPosicao;
    sombraFase = (sombraFase + (avancar ? 1 : 7)) % 8;
    sombraPosicao += avancar ? 1 : -1;
  }
  sombreamentoBobinas();
  // Mantém a última fase para segurar a tela. A posição é estimada por passos.
  // Atrasos de rede só alongam o movimento: não emite rajadas para compensar.
}
