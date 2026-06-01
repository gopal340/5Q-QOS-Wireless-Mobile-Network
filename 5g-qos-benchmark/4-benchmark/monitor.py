#!/usr/bin/env python3
"""
5G QoS Monitor — Continuous monitoring
Usage: python3 monitor.py [--interval 30] [--target 8.8.8.8]
"""
import argparse, json, time, sys
from datetime import datetime
from benchmark import ping_benchmark, http_benchmark, qos_rating

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--interval",type=int,default=30); p.add_argument("--target",default="8.8.8.8")
    p.add_argument("--gateway",default="http://127.0.0.1:5000"); p.add_argument("--log",default="/tmp/qos-monitor.jsonl")
    a=p.parse_args()
    print(f"5G QoS Monitor — every {a.interval}s, target {a.target}")
    print("Ctrl+C to stop\n")
    n=0
    while True:
        n+=1; ts=datetime.utcnow().isoformat()
        ps=ping_benchmark(a.target,10); hs=http_benchmark(a.gateway,5); r,c=qos_rating(ps)
        entry={"iteration":n,"timestamp":ts,"ping":ps,"http":hs,"rating":r,"class":c}
        if r in ("Poor","Fair"): print(f"  *** QoS DEGRADED: {r} ***")
        with open(a.log,"a") as f: f.write(json.dumps(entry)+"\n")
        print(f"  [{ts}] #{n} {r} | {ps.get('latency_avg_ms','?')}ms | {hs.get('throughput_mbps','?')}Mbps\n")
        time.sleep(a.interval)

if __name__=="__main__":
    try: main()
    except KeyboardInterrupt: print("\nStopped.")
