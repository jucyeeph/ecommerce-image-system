#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$HOME/Desktop/pass/.env}"

APP_NAME="${APP_NAME:-ecommerce-image-system-test}"
REMOTE_DIR="${REMOTE_DIR:-/volume1/docker/ecommerce-image-system-test}"
REMOTE_RELEASE_TAR="/tmp/${APP_NAME}-release.tar.gz"
REMOTE_DEPLOY_SH="/tmp/${APP_NAME}-deploy.sh"
REMOTE_LOG="/tmp/${APP_NAME}-deploy.log"
APP_PORT="${APP_PORT:-18080}"
CONTAINER_PORT="${CONTAINER_PORT:-8080}"
APP_VOLUME="${APP_VOLUME:-ecommerce_image_system_test_data}"
BASE_IMAGE="${BASE_IMAGE:-purchase-system:latest}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${NAS_TEST_HOST:?NAS_TEST_HOST is required}"
: "${NAS_TEST_PORT:?NAS_TEST_PORT is required}"
: "${NAS_TEST_USER:?NAS_TEST_USER is required}"
: "${NAS_TEST_PASSWORD:?NAS_TEST_PASSWORD is required}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_cmd expect
need_cmd tar
need_cmd scp
need_cmd ssh

TMP_DIR="$(mktemp -d)"
PACKAGE="$TMP_DIR/${APP_NAME}.tar.gz"
REMOTE_SCRIPT="$TMP_DIR/remote-deploy.sh"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Packaging current repository..."
(
  cd "$ROOT_DIR"
  export COPYFILE_DISABLE=1
  tar \
    --no-xattrs \
    --exclude .git \
    --exclude data \
    --exclude '*.sqlite' \
    --exclude '*.db' \
    --exclude '__pycache__' \
    --exclude '.DS_Store' \
    -czf "$PACKAGE" .
)

cat > "$REMOTE_SCRIPT" <<'REMOTE_SCRIPT_EOF'
#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:?}"
APP_VOLUME="${APP_VOLUME:?}"
BASE_IMAGE="${BASE_IMAGE:?}"
REMOTE_DIR="${REMOTE_DIR:?}"
REMOTE_RELEASE_TAR="${REMOTE_RELEASE_TAR:?}"
APP_PORT="${APP_PORT:?}"
CONTAINER_PORT="${CONTAINER_PORT:?}"

if command -v docker >/dev/null 2>&1; then
  DOCKER_BIN="$(command -v docker)"
elif [[ -x /usr/local/bin/docker ]]; then
  DOCKER_BIN="/usr/local/bin/docker"
else
  echo "Docker command not found on NAS" >&2
  exit 1
fi

compose_cmd() {
  if "$DOCKER_BIN" compose version >/dev/null 2>&1; then
    "$DOCKER_BIN" compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  elif [[ -x /usr/local/bin/docker-compose ]]; then
    /usr/local/bin/docker-compose "$@"
  else
    echo "Docker Compose command not found on NAS" >&2
    exit 1
  fi
}

mkdir -p "$REMOTE_DIR"
cd "$REMOTE_DIR"

if [[ -d current ]]; then
  backup="backup_$(date +%Y%m%d_%H%M%S)"
  rm -rf "$backup"
  mv current "$backup"
fi

mkdir -p current
tar -xzf "$REMOTE_RELEASE_TAR" -C current
cd current

if ! "$DOCKER_BIN" image inspect "$BASE_IMAGE" >/dev/null 2>&1; then
  echo "Required NAS base image not found: $BASE_IMAGE" >&2
  echo "Set BASE_IMAGE to a Python image already cached on the NAS, or pre-load python:3.12-slim." >&2
  exit 1
fi

cat > Dockerfile.nas-test <<DOCKERFILE_EOF
FROM ${BASE_IMAGE}

ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    EIS_DATA_DIR=/data \\
    EIS_PORT=${CONTAINER_PORT}

WORKDIR /app

COPY app ./app
COPY prompts ./prompts
COPY specs ./specs
COPY docs ./docs

RUN mkdir -p /data

EXPOSE ${CONTAINER_PORT}

CMD ["python", "app/server.py"]
DOCKERFILE_EOF

cat > docker-compose.nas-test.yml <<COMPOSE_EOF
services:
  ecommerce-image-system:
    build:
      context: .
      dockerfile: Dockerfile.nas-test
    container_name: ${APP_NAME}
    ports:
      - "${APP_PORT}:${CONTAINER_PORT}"
    volumes:
      - ${APP_VOLUME}:/data
    environment:
      EIS_DATA_DIR: /data
      EIS_PORT: ${CONTAINER_PORT}
    restart: unless-stopped

volumes:
  ${APP_VOLUME}:
COMPOSE_EOF

compose_cmd -f docker-compose.nas-test.yml down --remove-orphans || true
compose_cmd -f docker-compose.nas-test.yml up -d --build

for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/tmp/${APP_NAME}-health.json; then
    cat /tmp/${APP_NAME}-health.json
    echo
    exit 0
  fi
  sleep 2
done

echo "Health check failed" >&2
compose_cmd -f docker-compose.nas-test.yml ps >&2 || true
compose_cmd -f docker-compose.nas-test.yml logs --tail=80 >&2 || true
exit 1
REMOTE_SCRIPT_EOF

chmod +x "$REMOTE_SCRIPT"

expect_upload() {
  local src="$1"
  local dest="$2"
SRC="$src" DEST="$dest" expect <<'EXPECT_EOF'
set timeout 180
log_user 0
set src $env(SRC)
set dest $env(DEST)
spawn scp -O -P $env(NAS_TEST_PORT) -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $src $env(NAS_TEST_USER)@$env(NAS_TEST_HOST):$dest
expect {
  -re {(?i).*assword:} {
    send "$env(NAS_TEST_PASSWORD)\r"
    exp_continue
  }
  eof {
    catch wait result
    exit [lindex $result 3]
  }
  timeout {
    exit 124
  }
}
EXPECT_EOF
}

expect_remote() {
  local command="$1"
REMOTE_COMMAND="$command" expect <<'EXPECT_EOF'
set timeout 900
log_user 0
spawn ssh -p $env(NAS_TEST_PORT) -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $env(NAS_TEST_USER)@$env(NAS_TEST_HOST) $env(REMOTE_COMMAND)
expect {
  -re {READY_FOR_SUDO_PASSWORD} {
    send "$env(NAS_TEST_PASSWORD)\r"
    exp_continue
  }
  -re {(?i).*assword:} {
    send "$env(NAS_TEST_PASSWORD)\r"
    exp_continue
  }
  eof {
    catch wait result
    exit [lindex $result 3]
  }
  timeout {
    exit 124
  }
}
EXPECT_EOF
}

echo "Uploading release package to NAS test target..."
expect_upload "$PACKAGE" "$REMOTE_RELEASE_TAR" >/dev/null

echo "Uploading remote deployment runner..."
expect_upload "$REMOTE_SCRIPT" "$REMOTE_DEPLOY_SH" >/dev/null

echo "Deploying on NAS test target..."
REMOTE_ENV="APP_NAME='$APP_NAME' APP_VOLUME='$APP_VOLUME' BASE_IMAGE='$BASE_IMAGE' REMOTE_DIR='$REMOTE_DIR' REMOTE_RELEASE_TAR='$REMOTE_RELEASE_TAR' APP_PORT='$APP_PORT' CONTAINER_PORT='$CONTAINER_PORT'"
set +e
expect_remote "rm -f '$REMOTE_LOG'; chmod +x '$REMOTE_DEPLOY_SH' && printf READY_FOR_SUDO_PASSWORD && IFS= read -r SUDO_PASS && printf '%s\n' \"\$SUDO_PASS\" | HOME=/tmp sudo -S -p '' env $REMOTE_ENV bash '$REMOTE_DEPLOY_SH' > '$REMOTE_LOG' 2>&1"
deploy_status=$?
set -e

if [[ "$deploy_status" -ne 0 ]]; then
  LOG_COPY="$TMP_DIR/remote-deploy.log"
  SRC_REMOTE="$REMOTE_LOG" DEST_LOCAL="$LOG_COPY" expect <<'EXPECT_EOF' >/dev/null 2>&1 || true
set timeout 120
log_user 0
spawn scp -O -P $env(NAS_TEST_PORT) -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $env(NAS_TEST_USER)@$env(NAS_TEST_HOST):$env(SRC_REMOTE) $env(DEST_LOCAL)
expect {
  -re {(?i).*assword:} {
    send "$env(NAS_TEST_PASSWORD)\r"
    exp_continue
  }
  eof {
    catch wait result
    exit [lindex $result 3]
  }
  timeout {
    exit 124
  }
}
EXPECT_EOF
  echo "Remote deployment failed. Remote log:"
  if [[ -f "$LOG_COPY" ]]; then
    sed -E 's/(password|Password):[^[:cntrl:]]*/\1: [REDACTED]/g' "$LOG_COPY"
  else
    echo "Could not retrieve remote log."
  fi
  exit "$deploy_status"
fi

echo "NAS test deployment finished."
echo "Open the app with the NAS host on port ${APP_PORT}."
