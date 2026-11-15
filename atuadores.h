#pragma once
#include <Servo.h>

// Servo posicional: a biblioteca mantém os pulsos em segundo plano.
// Os ângulos representam comandos; não há medição da posição da tela.
static_assert(SERVO_ANGULO_ABERTO >= 0 && SERVO_ANGULO_ABERTO <= 180,
              "Angulo aberto deve estar entre 0 e 180 graus");
static_assert(SERVO_ANGULO_SOMBRA >= 0 && SERVO_ANGULO_SOMBRA <= 180,
              "Angulo de sombra deve estar entre 0 e 180 graus");

Servo servoSombra;

void sombreamentoInicio() {
  // Define a posição antes de habilitar os pulsos, evitando partir de 90°.
  servoSombra.write(SERVO_ANGULO_ABERTO);
  servoSombra.attach(SERVO_PIN);
}

void sombreamentoAplicar(bool ligado) {
  servoSombra.write(ligado ? SERVO_ANGULO_SOMBRA : SERVO_ANGULO_ABERTO);
}
