#!/bin/bash
# tc-netem QoS impairment profiles
# Usage: ./profile.sh [baseline|moderate|severe|stop] [interface]
set -e
PROFILE="${1:-baseline}"
IFACE="${2:-$(ip route | grep default | awk '{print $5}' | head -1)}"
[ -z "$IFACE" ] && IFACE="eth0"

sudo tc qdisc del dev "$IFACE" root 2>/dev/null || true

case "$PROFILE" in
    baseline)   echo "BASELINE: 5ms / 0% loss / 1Gbps"
                sudo tc qdisc add dev "$IFACE" root netem delay 5ms 1ms loss 0% rate 1gbit ;;
    moderate)   echo "MODERATE: 30ms / 1% loss / 100Mbps"
                sudo tc qdisc add dev "$IFACE" root netem delay 30ms 10ms loss 1% rate 100mbit ;;
    severe)     echo "SEVERE: 100ms / 5% loss / 10Mbps"
                sudo tc qdisc add dev "$IFACE" root netem delay 100ms 30ms loss 5% rate 10mbit ;;
    stop|clean) echo "All impairments removed"
                sudo tc qdisc del dev "$IFACE" root 2>/dev/null || true ;;
    *)          echo "Usage: ./profile.sh [baseline|moderate|severe|stop]"; exit 1 ;;
esac
echo "Current qdisc:"; sudo tc qdisc show dev "$IFACE"
