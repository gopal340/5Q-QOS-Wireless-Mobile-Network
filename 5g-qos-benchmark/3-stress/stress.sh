#!/bin/bash
# Stress test with iperf3
# Usage: ./stress.sh [target] [duration]
set -e
TARGET="${1:-127.0.0.1}"; DURATION="${2:-30}"
echo "iperf3 stress test → $TARGET for ${DURATION}s"
echo ""
echo "[1/2] TCP..."
iperf3 -c "$TARGET" -t "$DURATION" -P 4 || true
echo ""
echo "[2/2] UDP 50Mbps..."
iperf3 -c "$TARGET" -t "$DURATION" -u -b 50M || true
echo ""
echo "Done."
