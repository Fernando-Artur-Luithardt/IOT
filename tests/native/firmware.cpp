#include "fake_arduino.h"
#include <cassert>
void atualizarSensores();
#include "../../sketch.ino"

int main() {
  setup();
  assert(sombraPosicao == 0 && sombraDestino == 0);
  for (auto pin : sombraPinos) assert(outputs[pin] == LOW);
  // Espera síncrona simulada: WiFiEspAT consulta read()/available(), sem passar por loop().
  for (int i = 0; i < 27; i++) {
    fakeNow += 1000;
    if (i % 2) cp2Serial.read();
    else cp2Serial.available();
  }
  assert(cp2Ciclo == 2);
  assert(sombraDestino == 0);
  assert(outputs[22] == HIGH && outputs[26] == HIGH && outputs[RELE_INGA_VENTILACAO] == RELE_ATIVO);
  // delay() da biblioteca chama yield(): continua leitura e atuação offline.
  fakeSolo = 1023; fakeLuz = 1023; fakeTemp = 20;
  fakeNow = 34000;
  yield();
  assert(cp2Ciclo == 3);
  assert(outputs[22] == LOW && outputs[26] == LOW && outputs[RELE_INGA_VENTILACAO] == !RELE_ATIVO);
  assert(sombraDestino == PASSO_POSICAO_SOMBRA);
  assert(cp2Estados[0][1]);
  // No limite exato (90%), abre a tela mesmo durante uma espera AT.
  fakeLuz = 921;
  fakeNow += INTERVALO_LEITURA;
  cp2Serial.available();
  assert(luminosidade == 90);
  assert(sombraDestino == 0);
  assert(!cp2Estados[0][1]);
  // Logo acima (91%), fecha; na leitura seguinte mantém o comando.
  fakeLuz = 931;
  fakeNow += INTERVALO_LEITURA;
  cp2Serial.read();
  assert(luminosidade == 91);
  assert(sombraDestino == PASSO_POSICAO_SOMBRA);
  assert(cp2Estados[0][1]);
  fakeNow += INTERVALO_LEITURA;
  yield();
  assert(sombraDestino == PASSO_POSICAO_SOMBRA);
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
  // As páginas cabem no LCD e continuam mudando sem rede.
  assert(!cp2Enviar(0, "status", "online", true));
  assert(!cp2Publicando);
  cp2TempValida = false;
  fakeNow = ultimaLeitura + 1500; cp2Desenhar();
  assert(std::string(cp2Linhas[1]).find("Temp:ERRO") == 0);
  cp2Estados[cp2Tela][0] = true; cp2Estados[cp2Tela][1] = false;
  fakeNow = ultimaLeitura + 3000; cp2Desenhar();
  assert(std::string(cp2Linhas[1]).find(cp2Tela == 0 ? "I:ON S:OFF" : "I:ON V:OFF") == 0);
  fakeNow = ultimaLeitura + 4500; cp2Desenhar();
  assert(std::string(cp2Linhas[1]).find("W:OFF MQTT:OFF") == 0);
  uint8_t especieAnterior = cp2Tela;
  cp2NovaLeitura(true, false, false, false, false);
  fakeNow += 100; cp2Desenhar();
  assert(cp2Tela != especieAnterior);
  assert(std::string(cp2Linhas[0]).find(cp2Nome[cp2Tela]) == 0);
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
  // Percurso completo sem bloquear; repetição não acumula voltas.
  sombreamentoInicio();
  sombreamentoAplicar(true);
  for (int i = 0; i < PASSO_POSICAO_SOMBRA + 1; i++) {
    fakeNow += PASSO_INTERVALO_MS;
    sombreamentoAtualizar();
    uint8_t mask = 0;
    for (int j = 0; j < 4; j++) if (outputs[sombraPinos[j]]) mask |= 1 << j;
    const uint8_t esperado[] = {1, 3, 2, 6, 4, 12, 8, 9};
    assert(mask == esperado[i % 8]);
    long pos = sombraPosicao;
    sombreamentoAtualizar(); // Mesmo instante: não avança.
    assert(sombraPosicao == pos);
  }
  assert(sombraPosicao == PASSO_POSICAO_SOMBRA);
  sombreamentoAplicar(true);
  fakeNow += 10000; sombreamentoAtualizar();
  assert(sombraPosicao == PASSO_POSICAO_SOMBRA);
  sombreamentoAplicar(false);
  fakeNow += PASSO_INTERVALO_MS; sombreamentoAtualizar();
  assert(sombraPosicao == PASSO_POSICAO_SOMBRA - 1);
  sombreamentoAplicar(true); // Inversão durante o movimento.
  fakeNow += PASSO_INTERVALO_MS; sombreamentoAtualizar();
  assert(sombraPosicao == PASSO_POSICAO_SOMBRA);
  sombreamentoAplicar(false);
  for (int i = 0; i < PASSO_POSICAO_SOMBRA; i++) {
    fakeNow += PASSO_INTERVALO_MS; sombreamentoAtualizar();
  }
  assert(sombraPosicao == 0);
  // CP3 exige t28 e ventilacao estritamente acima de 30 graus.
  char topico[144];
  cp2Topico(topico, sizeof(topico), 1, "sensor/temperatura");
  assert(std::string(topico) == "unidavi/iot/t28/1038854_1028775/inga/sensor/temperatura");
  fakeTemp = 30.0;
  fakeNow += INTERVALO_LEITURA; atualizarSensores();
  assert(outputs[RELE_INGA_VENTILACAO] == !RELE_ATIVO);
  fakeTemp = 30.1;
  fakeNow += INTERVALO_LEITURA; atualizarSensores();
  assert(outputs[RELE_INGA_VENTILACAO] == RELE_ATIVO);
  std::puts("Firmware: tarefas locais durante esperas AT, regras e publicações concorrentes OK.");
}
