#!/bin/sh
set -eu
node /opt/cp3/prepare.cjs /data
exec node /opt/cp3/node_modules/node-red/red.js --userDir /data --settings /opt/cp3/settings.cjs /data/flows.json
