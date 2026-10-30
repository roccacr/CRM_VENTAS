#!/bin/sh
set -eu

# This webroot certificate needs Apache to reload after renewal.
if [ "${RENEWED_LINEAGE:-}" = /etc/letsencrypt/live/habita-crm ]; then
    /usr/sbin/apache2ctl configtest
    /bin/systemctl reload apache2
fi
