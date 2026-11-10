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
branch=${3:?Falta rama o modo artifact}
web_origin=${4:-https://habita.roccacr.com}
api_origin=${5:-https://api-habita.rdghub.com}
for origin in "$web_origin" "$api_origin"; do
    [[ $origin =~ ^https://[a-zA-Z0-9.-]+(:[0-9]+)?$ ]] || exit 1
done
[[ $id =~ ^[0-9]{14}-[a-f0-9]{7}-(local|ci-[0-9]+-[0-9]+)$ && $digest =~ ^[a-f0-9]{64}$ && $branch =~ ^[a-zA-Z0-9._/-]+$ ]] || exit 1
archive=$shared/$id.tar.gz
release=$root/releases/$id
test -f "$shared/api.env"
printf '%s  %s\n' "$digest" "$archive" | sha256sum --check
if [[ $branch == artifact ]]; then
    target=${6:?Falta entorno de despliegue}
    [[ $target == habita-qa || $target == production ]]
    [[ $(cat "$shared/deploy-environment") == "$target" ]]
    mkdir "$release"
    tar -xzf "$archive" -C "$release"
    python3 "$release/deploy/habita/verify-release.py" "$release" --artifact
else
    git clone --single-branch --branch "$branch" https://github.com/roccacr/CRM_VENTAS.git "$release"
    tar -xzf "$archive" -C "$release"
    python3 "$release/deploy/habita/verify-release.py" "$release"
fi
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
test -f "$previous/apps/frontend/dist/index.html"
switch_current() {
    local destination=$1
    ln -s "$destination" "$root/.current-$id"
    mv -Tf "$root/.current-$id" "$root/current"
}
rollback() {
    trap - ERR
    switch_current "$previous"
    if sudo -n systemctl reload habita-pm2 && verify_release "$previous"; then
        echo "Activacion fallida; release anterior restaurado y verificado: $previous" >&2
    else
        echo "Activacion fallida; no se pudo verificar la recuperacion de $previous." >&2
    fi
    exit 1
}
verify_release() {
    local expected=$1 attempt
    for attempt in $(seq 1 45); do
        if curl --fail --silent --max-time 2 http://127.0.0.1:3100/health/ready >/dev/null; then
            curl --fail --silent --show-error --max-time 10 "$api_origin/health/ready" >/dev/null || return 1
            # Comprueba el HTML servido para detectar una activacion o cache incorrecta.
            curl --fail --silent --show-error --max-time 10 "$web_origin/auth/login" | cmp -s - "$expected/apps/frontend/dist/index.html" || return 1
            return 0
        fi
        sleep 1
    done
    return 1
}
trap rollback ERR
switch_current "$release"
sudo -n systemctl reload habita-pm2
verify_release "$release"
trap - ERR
echo "Release activo: $id. API reiniciado con PM2; frontend compilado y publicado."
