#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
task_container="smarterp-test-$$"
cleanup() { docker rm -f "$task_container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
# Only this freshly created container/database is mutated.
docker run -d --name "$task_container" -p 127.0.0.1::27017 mongo:7.0 --replSet rs0 --bind_ip_all >/dev/null
for attempt in $(seq 1 40); do
  if docker exec "$task_container" mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$task_container" mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})' >/dev/null
for attempt in $(seq 1 40); do
  if docker exec "$task_container" mongosh --quiet --eval 'if (!db.hello().isWritablePrimary) quit(1)' >/dev/null 2>&1; then break; fi
  sleep 1
done
task_port=$(docker port "$task_container" 27017/tcp | sed 's/127.0.0.1://')
export DATABASE_URL="mongodb://127.0.0.1:${task_port}/smarterp_test?directConnection=true&replicaSet=rs0"
export INTEGRATION_DATABASE_URL="$DATABASE_URL"
cd backend
./node_modules/.bin/prisma db push --skip-generate
npm run test:integration

if [ "${RUN_BROWSER_TESTS:-0}" = "1" ]; then
  cd ..
  node scripts/verify-browser.mjs
fi
