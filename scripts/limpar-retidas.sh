#!/bin/sh
set -eu
matriculas=${1:?Uso: sh scripts/limpar-retidas.sh matriculas [broker]}
broker=${2:-test.mosquitto.org}
case "$matriculas" in
  ''|*[!0-9_]*) echo 'Matrículas devem conter apenas números e underscore.' >&2; exit 1 ;;
esac
# Execute após desligar a placa e receber as últimas vontades offline.
for especie in aroeira-vermelha inga; do
  for sufixo in status atuador/irrigacao; do
    docker exec mosquitto mosquitto_pub -h "$broker" -p 1883 -t "unidavi/iot/t27/$matriculas/$especie/$sufixo" -r -n
  done
done
docker exec mosquitto mosquitto_pub -h "$broker" -p 1883 -t "unidavi/iot/t27/$matriculas/aroeira-vermelha/atuador/sombreamento" -r -n
docker exec mosquitto mosquitto_pub -h "$broker" -p 1883 -t "unidavi/iot/t27/$matriculas/inga/atuador/ventilacao" -r -n
