// Diagnóstico temporário no Mega 2560. Não altera o firmware do ESP8266.
// Mantém irrigação desligada, sinal do servo sem pulsos e relé ativo em LOW desativado.
// Desconecte a alimentação do servo durante este diagnóstico; ele não controla a posição.
unsigned long inicio;
bool consultouVersao = false;

void setup() {
  const uint8_t saidas[] = {22, 26, 42};
  for (uint8_t p : saidas) {
    digitalWrite(p, LOW);
    pinMode(p, OUTPUT);
  }
  digitalWrite(9, HIGH);
  pinMode(9, OUTPUT);
  Serial.begin(115200);
  Serial1.begin(115200);
  delay(1500);
  Serial.println(F("Diagnostico ESP8266: AT e AT+GMR (somente consulta)."));
  Serial.println(F("--- AT ---"));
  Serial1.println(F("AT"));
  inicio = millis();
}

void loop() {
  while (Serial1.available()) Serial.write(Serial1.read());
  if (!consultouVersao && millis() - inicio >= 2000UL) {
    consultouVersao = true;
    Serial.println(F("--- AT+GMR ---"));
    Serial1.println(F("AT+GMR"));
  }
}
