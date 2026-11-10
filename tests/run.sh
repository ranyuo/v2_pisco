#!/usr/bin/env bash
# Disposable databases and SMTP sink. No ports are exposed; no external email is sent.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 tests/vendor-audit.py
qa_root="$PWD"
qa_php="${PORTAL_TEST_PHP_VERSION:-8.3}"
case "$qa_php" in 8.1|8.3|8.4) ;; *) echo "Unsupported QA PHP version" >&2;exit 1;; esac
qa_id="pisco-qa-$$-$RANDOM"
qa_dir="$(mktemp -d)"
chmod 700 "$qa_dir"
d(){ env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
cleanup(){ d rm -f "$qa_id-db" "$qa_id-smtp" >/dev/null 2>&1 || true; d network rm "$qa_id" >/dev/null 2>&1 || true; rm -rf "$qa_dir"; }
trap cleanup EXIT
# PHP dependencies remain in this reusable image; all database state is temporary.
d build -f tests/Dockerfile --build-arg "PHP_VERSION=$qa_php" -t "pisco-qa-php:$qa_php" .
d network create "$qa_id" >/dev/null
d run -d --name "$qa_id-db" --network "$qa_id" --network-alias qa-db -e MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1 mariadb:10.11 >/dev/null
qa_ready=false
for attempt in {1..60}; do
 if d exec "$qa_id-db" healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1; then qa_ready=true;break;fi
 sleep 1
done
if [ "$qa_ready" != true ]; then echo 'The isolated QA database did not become ready.' >&2;exit 1;fi
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$qa_dir/ca.key" -out "$qa_dir/ca.pem" -days 1 -subj '/CN=Pisco QA CA' 2>/dev/null
openssl req -newkey rsa:2048 -nodes -keyout "$qa_dir/smtp.key" -out "$qa_dir/smtp.csr" -subj '/CN=qa-smtp' 2>/dev/null
printf 'subjectAltName=DNS:qa-smtp\nextendedKeyUsage=serverAuth\n' > "$qa_dir/smtp.ext"
openssl x509 -req -in "$qa_dir/smtp.csr" -CA "$qa_dir/ca.pem" -CAkey "$qa_dir/ca.key" -CAcreateserial -out "$qa_dir/smtp.pem" -days 1 -extfile "$qa_dir/smtp.ext" 2>/dev/null
chmod 600 "$qa_dir"/*.key
d run -d --name "$qa_id-smtp" --network "$qa_id" --network-alias qa-smtp -v "$qa_root/tests:/tests:ro" -v "$qa_dir:/tls:ro" python:3.12-slim python /tests/smtp-server.py --host 0.0.0.0 --cert /tls/smtp.pem --key /tls/smtp.key >/dev/null
# Explicit readiness check for the local SMTP listener.
d run --rm --network "$qa_id" python:3.12-slim python -c 'import socket,time
for attempt in range(30):
 try:
  with socket.create_connection(("qa-smtp",2525),timeout=1) as s: assert s.recv(100).startswith(b"220")
  break
 except OSError:
  if attempt==29:raise
  time.sleep(1)'
for suite in stability mail load; do
 qa_db="${suite}_test"
 d exec "$qa_id-db" mariadb -uroot -e "CREATE DATABASE $qa_db; CREATE DATABASE ${suite}_restore_test;"
 qa_key="$(openssl rand -hex 32)"
 cat > "$qa_dir/config.php" <<PHP
<?php return ['db_host'=>'qa-db','db_port'=>3306,'db_name'=>'$qa_db','db_user'=>'root','db_password'=>'','install_key'=>'$qa_key','secure_cookies'=>false,'timezone'=>'America/Lima','smtp'=>['enabled'=>false]];
PHP
 chmod 600 "$qa_dir/config.php"
 case "$suite" in stability) qa_test=stability.php;; mail) qa_test=mail-regressions.php;; load) qa_test=load-smoke.php;; esac
 d run --rm --network "$qa_id" -v "$qa_root:/app" -v "$qa_dir:/qa:ro" -e PORTAL_TEST_CONFIG_FILE=/qa/config.php -e PORTAL_SMTP_TEST_HOST=qa-smtp -e PORTAL_SMTP_TEST_CA=/qa/ca.pem "pisco-qa-php:$qa_php" php "tests/$qa_test"
done
