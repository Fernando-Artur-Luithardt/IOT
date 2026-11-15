FROM nodered/node-red:4.1.0
RUN npm install --omit=dev --no-audit --no-fund @flowfuse/node-red-dashboard@1.29.0
COPY flows.json /opt/checkpoint2/flows.json
COPY start.sh /opt/checkpoint2/start.sh
ENTRYPOINT ["sh", "/opt/checkpoint2/start.sh"]
CMD []
