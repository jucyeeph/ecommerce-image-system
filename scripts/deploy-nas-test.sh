#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${NAS_ENV_FILE:-$HOME/Desktop/pass/.env}"
APP_NAME="${APP_NAME:-ecommerce-image-workbench-test}"
REMOTE_ROOT="${REMOTE_ROOT:-/volume1/docker/ecommerce-image-workbench-test}"
APP_PORT="${APP_PORT:-18088}"
IMAGE_NAME="${IMAGE_NAME:-ecommerce-image-workbench-test:latest}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing NAS env file: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

: "${NAS_TEST_HOST:?Missing NAS_TEST_HOST in env file}"
: "${NAS_TEST_PORT:?Missing NAS_TEST_PORT in env file}"
: "${NAS_TEST_USER:?Missing NAS_TEST_USER in env file}"
: "${NAS_TEST_PASSWORD:?Missing NAS_TEST_PASSWORD in env file}"

for bin in expect tar scp ssh npm; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "Missing required command: $bin" >&2
    exit 1
  fi
done

cd "$ROOT_DIR"

echo "Running local verification..."
npm test
npm run build

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

BUNDLE="$TMP_DIR/app.tar.gz"
REMOTE_RUNNER="$TMP_DIR/remote-deploy.sh"
REMOTE_COMPOSE="$TMP_DIR/docker-compose.nas-test.yml"
REMOTE_DOCKERFILE="$TMP_DIR/Dockerfile.nas-test"

cat > "$REMOTE_DOCKERFILE" <<'DOCKERFILE'
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS client-build
WORKDIR /app
COPY client/package*.json ./client/
RUN npm --prefix client ci
COPY client ./client
RUN npm --prefix client run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV APP_INTERNAL_PORT=3088
ENV DATA_DIR=/app/data
ENV DATABASE_PATH=/app/data/database/workbench.sqlite
ENV PROJECTS_DIR=/app/data/projects
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY server ./server
COPY --from=client-build /app/client/dist ./client/dist
COPY data ./data
EXPOSE 3088
CMD ["npm", "start"]
DOCKERFILE

cat > "$REMOTE_COMPOSE" <<'COMPOSE'
services:
  ecommerce-image-workbench-test:
    image: ecommerce-image-workbench-test:latest
    container_name: ecommerce-image-workbench-test
    restart: unless-stopped
    ports:
      - "${APP_PORT:-18088}:3088"
    environment:
      HOST: 0.0.0.0
      APP_INTERNAL_PORT: 3088
      DATA_DIR: /app/data
      DATABASE_PATH: /app/data/database/workbench.sqlite
      PROJECTS_DIR: /app/data/projects
    volumes:
      - ./data:/app/data
COMPOSE

cat > "$REMOTE_RUNNER" <<'REMOTE'
#!/usr/bin/env sh
set -eu

REMOTE_ROOT="$1"
APP_PORT="$2"
IMAGE_NAME="$3"

DOCKER_BIN=""
for candidate in /usr/local/bin/docker docker; do
  if command -v "$candidate" >/dev/null 2>&1; then
    DOCKER_BIN="$candidate"
    break
  fi
done

if [ -z "$DOCKER_BIN" ]; then
  echo "Docker command not found on NAS" >&2
  exit 1
fi

cd "$REMOTE_ROOT"
mkdir -p data/database data/projects data/brand_library data/prompt_library

cp deploy/docker-compose.nas-test.yml docker-compose.yml
cp deploy/app.tar.gz app.tar.gz

rm -rf app
mkdir -p app
tar -xzf app.tar.gz -C app
cp deploy/Dockerfile.nas-test app/Dockerfile.nas-test

cd app
"$DOCKER_BIN" build -f Dockerfile.nas-test -t "$IMAGE_NAME" .

cd "$REMOTE_ROOT"
APP_PORT="$APP_PORT" "$DOCKER_BIN" compose -f docker-compose.yml up -d --remove-orphans

for i in $(seq 1 30); do
  if "$DOCKER_BIN" exec ecommerce-image-workbench-test node -e "fetch('http://127.0.0.1:3088/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    echo "health_ok"
    exit 0
  fi
  sleep 2
done

echo "health_check_failed" >&2
"$DOCKER_BIN" logs --tail 80 ecommerce-image-workbench-test >&2 || true
exit 1
REMOTE

chmod +x "$REMOTE_RUNNER"

echo "Packaging application..."
COPYFILE_DISABLE=1 tar \
  --no-xattrs \
  --exclude='./.git' \
  --exclude='./node_modules' \
  --exclude='./client/node_modules' \
  --exclude='./client/dist' \
  --exclude='./data/database/*.sqlite' \
  --exclude='./data/database/*.sqlite-*' \
  --exclude='./data/projects/*' \
  --exclude='./.env' \
  -czf "$BUNDLE" .

echo "Uploading bundle to test NAS..."
expect <<EOF
set timeout 180
log_user 0
spawn ssh -tt -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p "$NAS_TEST_PORT" "$NAS_TEST_USER@$NAS_TEST_HOST" "HOME=/tmp sudo -S mkdir -p '$REMOTE_ROOT/deploy'"
expect {
  -re ".*assword:" { send "$NAS_TEST_PASSWORD\r"; exp_continue }
  eof
}
catch wait result
set status [lindex \$result 3]
if {\$status != 0} { exit \$status }

spawn scp -O -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P "$NAS_TEST_PORT" "$BUNDLE" "$REMOTE_DOCKERFILE" "$REMOTE_COMPOSE" "$REMOTE_RUNNER" "$NAS_TEST_USER@$NAS_TEST_HOST:$REMOTE_ROOT/deploy/"
expect {
  -re ".*assword:" { send "$NAS_TEST_PASSWORD\r"; exp_continue }
  eof
}
catch wait result
set status [lindex \$result 3]
if {\$status != 0} { exit \$status }
EOF

echo "Deploying on test NAS..."
expect <<EOF
set timeout 900
log_user 0
spawn ssh -tt -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p "$NAS_TEST_PORT" "$NAS_TEST_USER@$NAS_TEST_HOST" "HOME=/tmp sudo -S sh '$REMOTE_ROOT/deploy/remote-deploy.sh' '$REMOTE_ROOT' '$APP_PORT' '$IMAGE_NAME'"
set output ""
expect {
  -re ".*assword:" { send "$NAS_TEST_PASSWORD\r"; exp_continue }
  -re {([^\r\n]+)\r\n} {
    set line \$expect_out(1,string)
    if {[string first "Could not chdir" \$line] < 0} {
      append output \$line "\n"
      send_user "\$line\n"
    }
    exp_continue
  }
  -re {health_ok} { append output "health_ok\n"; exp_continue }
  -re {health_check_failed} { append output "health_check_failed\n"; exp_continue }
  eof
}
catch wait result
set status [lindex \$result 3]
if {\$status != 0} { exit \$status }
EOF

echo "Verifying external HTTP health..."
HTTP_CODE="$(curl -sS -o /tmp/ecommerce-image-workbench-health.txt -w "%{http_code}" "http://${NAS_TEST_HOST}:${APP_PORT}/api/health" || true)"
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "External health check failed with HTTP $HTTP_CODE" >&2
  exit 1
fi

echo "Deployment succeeded."
echo "Test URL: http://<NAS_TEST_HOST>:${APP_PORT}"
