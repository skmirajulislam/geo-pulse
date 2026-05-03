#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"

BACKEND_PORT="${BACKEND_PORT:-5000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

BACKEND_PID=""
FRONTEND_PID=""

info() { echo "[activation] $*"; }
err() { echo "[activation][error] $*" >&2; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { err "Required command not found: $1"; exit 1; }
}

check_env_files() {
  local missing=0
  if [[ ! -f "${BACKEND_DIR}/.env" ]]; then
    err "Missing backend/.env"
    missing=1
  fi
  if [[ ! -f "${FRONTEND_DIR}/.env" ]]; then
    err "Missing frontend/.env"
    missing=1
  fi
  [[ "${missing}" -eq 0 ]] || { err "Environment files are required. Aborting."; exit 1; }
}

has_internet() {
  curl -s --connect-timeout 3 https://registry.npmjs.org/-/ping >/dev/null 2>&1
}

install_if_needed() {
  local dir="$1"
  local name="$2"
  if [[ -d "${dir}/node_modules" ]]; then
    info "${name}: node_modules already present"
    return
  fi

  info "${name}: node_modules missing"
  if ! has_internet; then
    err "${name}: no internet connectivity; cannot install dependencies"
    exit 1
  fi

  info "${name}: installing dependencies..."
  (cd "${dir}" && npm install)
}

kill_by_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"${port}" 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    info "Releasing port ${port} (PID: ${pids//$'\n'/, })"
    while IFS= read -r pid; do
      [[ -n "${pid}" ]] && kill "${pid}" 2>/dev/null || true
    done <<< "${pids}"
  fi
}

cleanup() {
  info "Stopping services..."
  [[ -n "${FRONTEND_PID}" ]] && kill "${FRONTEND_PID}" 2>/dev/null || true
  [[ -n "${BACKEND_PID}" ]] && kill "${BACKEND_PID}" 2>/dev/null || true
  kill_by_port "${FRONTEND_PORT}"
  kill_by_port "${BACKEND_PORT}"
  info "Ports released and processes stopped."
}

start_services() {
  info "Starting backend on port ${BACKEND_PORT}"
  (
    cd "${BACKEND_DIR}"
    PORT="${BACKEND_PORT}" npm start
  ) &
  BACKEND_PID=$!

  info "Starting frontend on port ${FRONTEND_PORT}"
  (
    cd "${FRONTEND_DIR}"
    PORT="${FRONTEND_PORT}" BROWSER=none npm start
  ) &
  FRONTEND_PID=$!
}

main() {
  require_cmd npm
  require_cmd curl
  require_cmd lsof
  check_env_files

  install_if_needed "${BACKEND_DIR}" "backend"
  install_if_needed "${FRONTEND_DIR}" "frontend"

  kill_by_port "${BACKEND_PORT}"
  kill_by_port "${FRONTEND_PORT}"

  trap cleanup EXIT INT TERM
  start_services

  info "Backend PID=${BACKEND_PID}, Frontend PID=${FRONTEND_PID}"
  info "Press Ctrl+C to stop both services."
  wait
}

main "$@"
