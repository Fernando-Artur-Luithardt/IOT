#include "fake_arduino.h"
#include <cassert>
void atualizarSensores();
#include "../../sketch.ino"

int main() {
  setup();
  assert(servoSombra.pin == SERVO_PIN);
  assert(servoSombra.angleAtAttach == SERVO_ANGULO_ABERTO);
  // Espera síncrona simulada: WiFiEspAT consulta read()/available(), sem passar por loop().
  for (int i = 0; i < 27; i++) {
    fakeNow += 1000;
    if (i % 2) cp2Serial.read();
    else cp2Serial.available();
  }
  assert(cp2Ciclo == 2);
  assert(servoSombra.read() == SERVO_ANGULO_ABERTO);
  assert(outputs[22] == HIGH && outputs[26] == HIGH && outputs[RELE_INGA_VENTILACAO] == RELE_ATIVO);
  // delay() da biblioteca chama yield(): continua leitura e atuação offline.
  fakeSolo = 1023; fakeLuz = 1023; fakeTemp = 20;
  fakeNow = 34000;
  yield();
  assert(cp2Ciclo == 3);
  assert(outputs[22] == LOW && outputs[26] == LOW && outputs[RELE_INGA_VENTILACAO] == !RELE_ATIVO);
  assert(servoSombra.read() == SERVO_ANGULO_SOMBRA);
  assert(cp2Estados[0][1]);
  // No limite exato (90%), abre a tela mesmo durante uma espera AT.
  fakeLuz = 921;
  fakeNow += INTERVALO_LEITURA;
  cp2Serial.available();
  assert(luminosidade == 90);
  assert(servoSombra.read() == SERVO_ANGULO_ABERTO);
  assert(!cp2Estados[0][1]);
  // Logo acima (91%), fecha; na leitura seguinte mantém o comando.
  fakeLuz = 931;
  fakeNow += INTERVALO_LEITURA;
  cp2Serial.read();
  assert(luminosidade == 91);
  assert(servoSombra.read() == SERVO_ANGULO_SOMBRA);
  assert(cp2Estados[0][1]);
  fakeNow += INTERVALO_LEITURA;
  yield();
  assert(servoSombra.read() == SERVO_ANGULO_SOMBRA);
  // O aviso termina pelo relógio; o texto completo ocupa duas linhas.
  cp2Publicando = true; cp2UltimoEnvio = fakeNow;
  fakeNow += 1600; yield();
  assert(!cp2Publicando);
  cp2Publicando = true; cp2UltimoEnvio = fakeNow;
  fakeNow += 100; cp2Desenhar();
  assert(std::string(cp2Linhas[0]).find(">>> PUBLICANDO") == 0);
  assert(std::string(cp2Linhas[1]).find(">>>") == 0);
  cp2Publicando = false;
  ultimaLeitura = fakeNow; umidadeSolo = luminosidade = 100;
  fakeNow += 100; cp2Desenhar();
  assert(std::string(cp2Linhas[1]) == "Solo100% Luz100%");
  // Leitura nova durante um envio não pode perder o estado pendente.
  cp2Wifi = true; cp2Online[0] = true;
  cp2Estados[0][0] = false; cp2Enviados[0][0] = -1;
  publishHook = [] { cp2Estados[0][0] = true; };
  cp2PublicarPendente(0);
  assert(lastPayload == "{\"estado\":\"desligado\"}");
  assert(cp2Enviados[0][0] == false && cp2Estados[0][0] == true);
  cp2Enviados[0][0] = true; cp2Enviados[0][1] = cp2Estados[0][1];
  cp2Pendentes[0] = 1;
  publishHook = [] { cp2Ciclo++; cp2Pendentes[0] = 7; };
  cp2PublicarPendente(0);
  assert(cp2Pendentes[0] == 7);
  std::puts("Firmware: tarefas locais durante esperas AT, regras e publicações concorrentes OK.");
}
