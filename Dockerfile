FROM node:22-alpine AS proxy-builder
# Sem npm install — zero dependências externas

FROM nginx:alpine

# Instala Node no container nginx (alpine, pequeno)
RUN apk add --no-cache nodejs

COPY src/nginx.conf /etc/nginx/conf.d/default.conf
COPY src/index.html /usr/share/nginx/html/
COPY src/app.js     /usr/share/nginx/html/
COPY src/proxy.js   /srv/proxy.js

# Script de entrypoint: sobe o proxy Node e depois o nginx em foreground
COPY src/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

CMD ["/entrypoint.sh"]
