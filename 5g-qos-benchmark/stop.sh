#!/bin/bash
# Stop all 5G QoS Benchmarking services
echo "Stopping services..."
pkill -f "gateway.py" 2>/dev/null && echo "  Gateway stopped"
pkill -f "iperf3 -s"  2>/dev/null && echo "  iperf3 stopped"
for svc in $(systemctl list-unit-files 'open5gs-*' --no-legend | awk '{print $1}'); do
  sudo systemctl stop "$svc" 2>/dev/null
done
echo "  Open5GS stopped"
IFACE=$(ip route | grep default | awk '{print $5}' | head -1)
[ -n "$IFACE" ] && sudo tc qdisc del dev "$IFACE" root 2>/dev/null && echo "  tc-netem removed"
echo "Done."
