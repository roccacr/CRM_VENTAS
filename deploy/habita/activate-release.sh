#!/usr/bin/env bash
set -euo pipefail
umask 077
export PATH=/home/ubuntu/.nvm/versions/node/v22.23.2/bin:$PATH
root=/var/www/habita-crm
shared=$root/shared
exec 9>"$shared/deploy.lock"
flock -n 9 || { echo 'Ya existe otro despliegue en curso.' >&2; exit 1; }
id=${1:?Falta release}
digest=${2:?Falta SHA256}
branch=${3:?Falta rama}
[[ $id =~ ^[0-9]{14}-[a-f0-9]{7}-local$ && $digest =~ ^[a-f0-9]{64}$ && $branch =~ ^[a-zA-Z0-9._/-]+$ ]] || exit 1
archive=$shared/$id.tar.gz
release=$root/releases/$id
test -f "$shared/api.env"
printf '%s  %s\n' "$digest" "$archive" | sha256sum --check
git clone --single-branch --branch "$branch" https://github.com/roccacr/CRM_VENTAS.git "$release"
tar -xzf "$archive" -C "$release"
python3 "$release/deploy/habita/verify-release.py" "$release"
ln -s "$shared/api.env" "$release/apps/api/.env"
cd "$release/apps/api"
corepack pnpm@10.28.2 install --prod --frozen-lockfile --ignore-scripts --network-concurrency=4 --child-concurrency=1
node --env-file="$shared/api.env" --input-type=module -e 'const {validateEnv}=await import("./dist/config/env.validation.js");validateEnv(process.env);await import("argon2");console.log("Entorno y runtime validados sin mostrar secretos.")'
# Apache solo necesita recorrer el camino publico y leer el build del frontend.
# El API, las fuentes y shared/api.env conservan sus permisos privados.
chmod 0755 "$release" "$release/apps" "$release/apps/frontend"
find "$release/apps/frontend/dist" -type d -exec chmod 0755 {} +
find "$release/apps/frontend/dist" -type f -exec chmod 0644 {} +
previous=$(readlink -f "$root/current")
rollback() {
    trap - ERR
    ln -sfn "$previous" "$root/current"
    sudo -n systemctl reload habita-pm2 || true
    echo "Activacion fallida; restaurado $previous. Verificar salud antes de reintentar." >&2
    exit 1
}
trap rollback ERR
ln -sfn "$release" "$root/current"
sudo -n systemctl reload habita-pm2
healthy=false
for attempt in $(seq 1 45); do
    if curl --fail --silent --max-time 2 http://127.0.0.1:3100/health/ready >/dev/null; then healthy=true; break; fi
    sleep 1
done
test "$healthy" = true
curl --fail --silent --show-error --max-time 10 https://habita.roccacr.com/auth/login >/dev/null
curl --fail --silent --show-error --max-time 10 https://api-habita.rdghub.com/health/ready >/dev/null
trap - ERR
echo "Release activo: $id. API reiniciado con PM2; frontend compilado y publicado."
