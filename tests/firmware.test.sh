#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
build_dir=$(mktemp -d "${TMPDIR:-/tmp}/iot-firmware-test.XXXXXX")
trap 'rm -rf "$build_dir"' EXIT
for header in DHT.h WiFiEspAT.h PubSubClient.h LiquidCrystal.h Servo.h; do
  printf '#include "fake_arduino.h"\n' > "$build_dir/$header"
done
c++ -std=c++17 -Wall -Wextra -I tests/native -I "$build_dir" tests/native/firmware.cpp -o "$build_dir/firmware-test"
"$build_dir/firmware-test"
