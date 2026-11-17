FROM node:22-alpine
WORKDIR /opt/cp3
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY . .
RUN mkdir -p /data && chown -R node:node /data /opt/cp3
USER node
ENV PORT=1880 NODE_RED_BIND=0.0.0.0
EXPOSE 1880
CMD ["sh", "start.sh"]
