#!/bin/sh
set -e

# Sobe o proxy Node em background
node /srv/proxy.js &

# Nginx em foreground (mantém o container vivo)
exec nginx -g "daemon off;"
