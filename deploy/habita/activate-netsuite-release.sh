#!/usr/bin/env bash
# Applies only the reviewed integration overlay to an immutable copy of the active release.
set -euo pipefail
umask 077
export PATH=/home/ubuntu/.nvm/versions/node/v22.23.2/bin:$PATH
root=/var/www/habita-crm
shared=$root/shared
exec 9>"$shared/deploy.lock"
flock -n 9 || { echo 'Otro despliegue esta en curso.' >&2; exit 1; }
id=${1:?Falta release}
digest=${2:?Falta SHA256}
expected=${3:?Falta baseline}
[[ $id =~ ^[0-9]{14}-netsuite$ && $digest =~ ^[a-f0-9]{64}$ ]] || exit 1
previous=$(readlink -f "$root/current")
test "$previous" = "$root/releases/$expected"
release=$root/releases/$id
test ! -e "$release"
archive=$shared/$id.tar.gz
printf '%s  %s\n' "$digest" "$archive" | sha256sum --check
cp -a -- "$previous" "$release"
mv -- "$release/apps/api/dist" "$release/apps/api/dist.before-netsuite"
tar -xzf "$archive" -C "$release"
python3 - "$release" <<'PY'
import hashlib,json,pathlib,sys
release=pathlib.Path(sys.argv[1]).resolve()
overlay=json.loads((release/'netsuite-overlay-manifest.json').read_text())
for name,digest in {**overlay['sourceFiles'],**overlay['artifactFiles']}.items():
    file=(release/name).resolve()
    if not file.is_relative_to(release) or hashlib.sha256(file.read_bytes()).hexdigest()!=digest:
        raise RuntimeError('Overlay integrity check failed: '+name)
manifest=json.loads((release/'deployment-manifest.json').read_text())
manifest['sourceFiles'].update(overlay['sourceFiles'])
manifest['artifactFiles']={name:digest for name,digest in manifest['artifactFiles'].items() if not name.startswith('apps/api/dist/')}
manifest['artifactFiles'].update(overlay['artifactFiles'])
manifest['integrationOverlay']=overlay['purpose']
for name,digest in {**manifest['sourceFiles'],**manifest['artifactFiles']}.items():
    file=(release/name).resolve()
    if not file.is_relative_to(release) or hashlib.sha256(file.read_bytes()).hexdigest()!=digest:
        raise RuntimeError('Release integrity check failed: '+name)
(release/'deployment-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'verifiedSourceFiles':len(manifest['sourceFiles']),'verifiedArtifacts':len(manifest['artifactFiles']),'overlaySources':len(overlay['sourceFiles'])}))
PY
candidate=$shared/api.env.$id
backup=$shared/api.env.before-$id
test ! -e "$candidate"
test ! -e "$backup"
secret=$shared/netsuite-production-secret.pending
test -f "$secret"
chmod 0600 "$secret"
python3 - "$shared/api.env" "$candidate" "$secret" <<'PY'
import pathlib,re,sys
source,candidate,secret=map(pathlib.Path,sys.argv[1:])
text=source.read_text()
token=secret.read_text().strip()
if not re.fullmatch('[a-f0-9]{64}',token):raise RuntimeError('Invalid dedicated token')
def values(text):return dict(line.split('=',1) for line in text.splitlines() if '=' in line and not line.startswith('#'))
before=values(text)
if before.get('NETSUITE_PRODUCTION_EVENTS_SECRET') not in (None,'',token):raise RuntimeError('Existing production token must not be replaced')
updates={'NETSUITE_ENVIRONMENT':'production','NETSUITE_PRODUCTION_RESTLET_URL':'https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=3739&deploy=1','NETSUITE_PRODUCTION_READ_MODE':'modules','NETSUITE_PRODUCTION_EVENTS_ENABLED':'true','NETSUITE_PRODUCTION_EVENTS_PERSIST':'true','NETSUITE_PRODUCTION_EVENTS_SECRET':token}
for key,value in updates.items():
    pattern='^'+re.escape(key)+'=.*$'
    text=re.sub(pattern,key+'='+value,text,flags=re.M) if re.search(pattern,text,re.M) else text.rstrip()+'\n'+key+'='+value+'\n'
after=values(text)
for key,value in before.items():
    if key not in updates and after.get(key)!=value:raise RuntimeError('Unrelated configuration changed')
candidate.write_text(text)
candidate.chmod(0o600)
PY
cd "$release/apps/api"
node --env-file="$candidate" --input-type=module -e 'const {validateEnv}=await import("./dist/config/env.validation.js");validateEnv(process.env);await import("argon2");console.log("Runtime y perfil NetSuite validados sin mostrar secretos.")'
cp -p -- "$shared/api.env" "$backup"
rollback() {
    trap - ERR
    cp -p -- "$backup" "$shared/api.env.rollback-$id"
    mv -f -- "$shared/api.env.rollback-$id" "$shared/api.env"
    ln -sfn "$previous" "$root/current.rollback-$id"
    mv -Tf -- "$root/current.rollback-$id" "$root/current"
    sudo -n systemctl reload habita-pm2 || true
    echo "Activacion fallida; restaurados release y configuracion: $previous" >&2
    exit 1
}
trap rollback ERR
mv -f -- "$candidate" "$shared/api.env"
ln -sfn "$release" "$root/current.next-$id"
mv -Tf -- "$root/current.next-$id" "$root/current"
sudo -n systemctl reload habita-pm2
healthy=false
for attempt in $(seq 1 45); do
    if curl --fail --silent --max-time 2 http://127.0.0.1:3100/health/ready >/dev/null; then healthy=true; break; fi
    sleep 1
done
test "$healthy" = true
curl --fail --silent --show-error --max-time 10 https://habita.roccacr.com/auth/login >/dev/null
curl --fail --silent --show-error --max-time 10 https://api-habita.rdghub.com/health/ready >/dev/null
node --env-file="$shared/api.env" --input-type=module <<'JS'
const endpoint='https://api-habita.rdghub.com/integrations/netsuite/production/order-events';
const unauthenticated=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
if(unauthenticated.status!==401)throw new Error('Production endpoint must reject missing authentication');
const invalid=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.NETSUITE_PRODUCTION_EVENTS_SECRET},body:'{}',signal:AbortSignal.timeout(10000)});
if(invalid.status!==400)throw new Error('Authenticated invalid event must be rejected before persistence');
console.log(JSON.stringify({unauthenticated:unauthenticated.status,authenticatedInvalidEvent:invalid.status,businessWritesTested:false}));
JS
trap - ERR
rm -f -- "$secret"
echo "Release NetSuite activo y verificado: $id. Frontend y datos conservados."
