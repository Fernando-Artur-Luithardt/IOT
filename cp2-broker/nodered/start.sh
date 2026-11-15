#!/bin/sh
set -eu
if [ ! -f /data/checkpoint2-flows.json ]; then
  cp /opt/checkpoint2/flows.json /data/checkpoint2-flows.json
fi
exec node /usr/src/node-red/node_modules/node-red/red.js --userDir /data /data/checkpoint2-flows.json "$@"
