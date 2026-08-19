#!/bin/bash
# Starts (or restarts) the frontend (port 3000) and backend (port 8787).
# Both are launched detached via nohup+disown, so they keep running after
# this window is closed. Re-run this file any time to restart both.

cd "$(dirname "$0")" || exit 1

LOG_DIR="$(pwd)/.logs"
mkdir -p "$LOG_DIR"

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti "tcp:$port")"
  if [ -n "$pids" ]; then
    echo "Stopping existing process on port $port ($pids)..."
    kill -9 $pids
  fi
}

echo "== Vehicle Matcher: starting frontend (3000) + backend (8787) =="

kill_port 3000
kill_port 8787

echo "Starting backend on http://localhost:8787 ..."
nohup npm run server > "$LOG_DIR/backend.log" 2>&1 &
disown

echo "Starting frontend on http://localhost:3000 ..."
nohup npm run serve > "$LOG_DIR/frontend.log" 2>&1 &
disown

sleep 1

echo ""
echo "Both servers are starting in the background."
echo "Logs: $LOG_DIR/backend.log and $LOG_DIR/frontend.log"
echo "You can close this window now — the servers will stay up until you"
echo "kill them (re-run this file, or: kill \$(lsof -ti tcp:3000 tcp:8787))."
echo ""
echo "This window will close in 5 seconds..."
sleep 5
