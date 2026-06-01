#!/bin/bash
# ================================================================
#  setup.sh — 5G QoS Benchmarking — ONE COMMAND SETUP
# ================================================================
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }
step()  { echo -e "\n${CYAN}═══ $1 ═══${NC}"; }

echo ""
echo "  5G QoS Benchmarking — Setup"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── 1. Install packages ──────────────────────────────────────────
step "1/5 — Installing packages"
sudo apt-get update -qq
sudo apt-get install -y open5gs python3-pip iperf3 iproute2 curl 2>/dev/null || true

# ── 2. Start MongoDB ─────────────────────────────────────────────
step "2/5 — Starting MongoDB"
sudo systemctl enable mongod 2>/dev/null || true
sudo systemctl start mongod  2>/dev/null || true
sleep 2

# ── 3. Start ALL Open5GS services (DEFAULT configs!) ─────────────
step "3/5 — Starting Open5GS"
sudo systemctl reset-failed 2>/dev/null || true
for svc in $(systemctl list-unit-files 'open5gs-*' --no-legend | awk '{print $1}'); do
  sudo systemctl enable "$svc"  2>/dev/null || true
  sudo systemctl restart "$svc" 2>/dev/null || true
done
sleep 3
RUNNING=0; TOTAL=0
for svc in $(systemctl list-unit-files 'open5gs-*' --no-legend | awk '{print $1}'); do
  TOTAL=$((TOTAL+1))
  systemctl is-active --quiet "$svc" 2>/dev/null && RUNNING=$((RUNNING+1))
done
info "Open5GS: $RUNNING/$TOTAL services running"

# ── 4. Flask Gateway + iperf3 ────────────────────────────────────
step "4/5 — Starting Gateway & iperf3"
pip3 install flask --break-system-packages 2>/dev/null || pip3 install flask
pkill -f "iperf3 -s" 2>/dev/null || true
iperf3 -s -D 2>/dev/null || true
pkill -f "gateway.py" 2>/dev/null || true
nohup python3 "$SCRIPT_DIR/2-gateway/gateway.py" > /tmp/gateway.log 2>&1 &
sleep 2

# ── 5. Web Dashboard ────────────────────────────────────────────
step "5/5 — Web Dashboard"
if command -v node &>/dev/null; then
  info "Node.js found — setting up web dashboard..."
  cd "$SCRIPT_DIR/6-webapp"
  if [ -f "package.json" ]; then
    npm install --silent 2>/dev/null || true
    info "Web dashboard ready. Run: cd 6-webapp && npm run dev"
  fi
  cd "$SCRIPT_DIR"
else
  info "Node.js not found — skip web dashboard. Install: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
fi

# ── Summary ──────────────────────────────────────────────────────
HOST_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7}' | head -1)
[ -z "$HOST_IP" ] && HOST_IP="YOUR_SERVER_IP"

if curl -s http://127.0.0.1:5000/status > /dev/null 2>&1; then
  info "Gateway UP at http://$HOST_IP:5000"
else
  info "Gateway starting... check: cat /tmp/gateway.log"
fi

echo ""
echo "  ═══ SETUP COMPLETE ═══"
echo ""
echo "  Gateway API:  http://$HOST_IP:5000"
echo "  Endpoints:    /ping  /benchmark  /status  /download  /upload"
echo ""
echo "  Python benchmark:"
echo "    cd 4-benchmark && python3 benchmark.py"
echo ""
echo "  Web Dashboard:"
echo "    cd 6-webapp && npm run dev"
echo "    Then open http://$HOST_IP:3000"
echo ""
echo "  Stress profiles:"
echo "    cd 3-stress && ./profile.sh baseline"
echo "    cd 3-stress && ./profile.sh severe"
echo "    cd 3-stress && ./profile.sh stop"
echo ""
