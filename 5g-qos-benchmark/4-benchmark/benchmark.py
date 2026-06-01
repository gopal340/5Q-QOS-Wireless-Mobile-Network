#!/usr/bin/env python3
"""
5G QoS Benchmark — High-Precision CLI Telemetry Suite
Performs 100% live network measurements and outputs results in perfect JSON format.
"""
import os
import sys
import time
import json
import re
import subprocess
import argparse
import threading
from datetime import datetime, timezone

# ─── Background Ping Thread for Loaded Latency (Stress) ────────
class LoadedPingThread(threading.Thread):
    def __init__(self, target, interval=0.3):
        super().__init__()
        self.target = target
        self.interval = interval
        self.active = True
        self.samples = []
        self.lost = 0
        self.total = 0

    def run(self):
        while self.active:
            self.total += 1
            try:
                # Perform a single ping with a 1-second timeout
                r = subprocess.run(
                    ["ping", "-c", "1", "-W", "1", self.target],
                    capture_output=True,
                    text=True,
                    timeout=2
                )
                if r.returncode == 0:
                    # Match time=XX.X ms or time=XX ms
                    m = re.search(r'time=([\d.]+)\s*ms', r.stdout)
                    if m:
                        self.samples.append(float(m.group(1)))
                    else:
                        self.lost += 1
                else:
                    self.lost += 1
            except Exception:
                self.lost += 1
            time.sleep(self.interval)

    def stop(self):
        self.active = False
        try:
            self.join(timeout=2)
        except Exception:
            pass

        avg = sum(self.samples) / len(self.samples) if self.samples else None
        jitter = 0.0
        if len(self.samples) > 1:
            diffs = [abs(self.samples[i] - self.samples[i-1]) for i in range(1, len(self.samples))]
            jitter = sum(diffs) / len(diffs)
        loss_pct = (self.lost / self.total) * 100 if self.total > 0 else 0.0

        return {
            "avg_ms": round(avg, 2) if avg is not None else None,
            "jitter_ms": round(jitter, 2),
            "packet_loss_pct": round(loss_pct, 1)
        }

# ─── Live Unloaded Ping (Idle State) ───────────────────────────
def run_unloaded_ping(target, count=5):
    samples = []
    lost = 0
    for _ in range(count):
        try:
            r = subprocess.run(
                ["ping", "-c", "1", "-W", "1", target],
                capture_output=True,
                text=True,
                timeout=2
            )
            if r.returncode == 0:
                m = re.search(r'time=([\d.]+)\s*ms', r.stdout)
                if m:
                    samples.append(float(m.group(1)))
                else:
                    lost += 1
            else:
                lost += 1
        except Exception:
            lost += 1
        time.sleep(0.15)

    avg = sum(samples) / len(samples) if samples else None
    jitter = 0.0
    if len(samples) > 1:
        diffs = [abs(samples[i] - samples[i-1]) for i in range(1, len(samples))]
        jitter = sum(diffs) / len(diffs)
    loss_pct = (lost / count) * 100

    return {
        "avg_ms": round(avg, 2) if avg is not None else None,
        "jitter_ms": round(jitter, 2),
        "packet_loss_pct": round(loss_pct, 1)
    }

# ─── Live Download test (Adaptive Chunking) ────────────────────
def run_download_test(target_url, duration=5.0):
    import urllib.request
    start_time = time.time()
    total_bytes = 0
    chunk_size = 1 * 1024 * 1024  # Start at 1MB
    idx = 0

    while time.time() - start_time < duration:
        chunk_start = time.time()
        try:
            url = f"{target_url}?bytes={chunk_size}" if "cloudflare" in target_url else f"{target_url}?size={chunk_size}"
            req = urllib.request.Request(
                url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Origin': 'https://speed.cloudflare.com',
                    'Referer': 'https://speed.cloudflare.com/'
                }
            )
            with urllib.request.urlopen(req, timeout=5) as res:
                data = res.read()
                chunk_bytes = len(data)
                total_bytes += chunk_bytes
            
            chunk_time = time.time() - chunk_start
            idx += 1

            # Adjust chunk size dynamically
            if chunk_time < 0.25 and chunk_size < 16 * 1024 * 1024:
                chunk_size *= 2
            elif chunk_time > 0.9 and chunk_size > 256 * 1024:
                chunk_size //= 2
        except Exception:
            time.sleep(0.1)
            chunk_size = max(256 * 1024, chunk_size // 2)

    elapsed = time.time() - start_time
    speed = (total_bytes * 8) / (elapsed * 1e6) if elapsed > 0 else 0.0
    return {
        "speed_mbps": round(speed, 2),
        "bytes_transferred": total_bytes,
        "duration_sec": round(elapsed, 2)
    }

# ─── Live Upload test (Adaptive Chunking) ──────────────────────
def run_upload_test(target_url, duration=5.0):
    import urllib.request
    start_time = time.time()
    total_bytes = 0
    chunk_size = 256 * 1024  # Start at 256KB
    idx = 0
    payload = os.urandom(chunk_size)

    while time.time() - start_time < duration:
        chunk_start = time.time()
        if len(payload) != chunk_size:
            payload = os.urandom(chunk_size)

        try:
            req = urllib.request.Request(
                target_url,
                data=payload,
                headers={
                    'Content-Type': 'application/octet-stream',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Origin': 'https://speed.cloudflare.com',
                    'Referer': 'https://speed.cloudflare.com/'
                },
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=5) as res:
                res.read()  # Consume response body
                total_bytes += chunk_size

            chunk_time = time.time() - chunk_start
            idx += 1

            # Adjust chunk size dynamically
            if chunk_time < 0.25 and chunk_size < 8 * 1024 * 1024:
                chunk_size *= 2
            elif chunk_time > 0.9 and chunk_size > 64 * 1024:
                chunk_size //= 2
        except Exception:
            time.sleep(0.1)
            chunk_size = max(64 * 1024, chunk_size // 2)

    elapsed = time.time() - start_time
    speed = (total_bytes * 8) / (elapsed * 1e6) if elapsed > 0 else 0.0
    return {
        "speed_mbps": round(speed, 2),
        "bytes_transferred": total_bytes,
        "duration_sec": round(elapsed, 2)
    }

# ─── Open5GS core check ────────────────────────────────────────
def check_open5gs():
    svcs = {}
    for s in ["open5gs-nrfd","open5gs-udmd","open5gs-ausfd","open5gs-udrd","open5gs-amfd","open5gs-smfd","open5gs-upfd"]:
        try:
            r = subprocess.run(["systemctl", "is-active", s], capture_output=True, text=True, timeout=2)
            svcs[s] = r.stdout.strip() == "active"
        except Exception:
            svcs[s] = False
    return svcs

# ─── Heuristic Local Network Name Detection ────────────────────
def detect_network(mode):
    if mode == "local5g":
        return "5G Standalone (SA) Mobile Network"
    
    try:
        r = subprocess.run(["ip", "route"], capture_output=True, text=True, timeout=2)
        if "default" in r.stdout:
            if "wlan" in r.stdout or "wifi" in r.stdout:
                return "Wi-Fi Network"
            if "eth" in r.stdout:
                return "Ethernet Connection"
    except Exception:
        pass
    return "Broadband Connection"

# ─── QoS Assesment ─────────────────────────────────────────────
def determine_qos(download, latency, stress, loss):
    if latency < 25 and loss < 0.2 and stress < 50 and download > 100:
        return "Excellent", "5G URLLC+eMBB Level"
    elif latency < 45 and loss < 1.0 and stress < 100 and download > 30:
        return "Good", "Standard 5G eMBB"
    elif latency < 85 and loss < 3.0 and stress < 200 and download > 10:
        return "Fair", "Standard Broadband"
    else:
        return "Impaired", "Congested/High Loss Link"

# ─── Main Execution ────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser(description="5G QoS High-Precision Live Benchmark")
    p.add_argument("--mode", choices=["internet", "local5g"], default="internet",
                   help="Target benchmark (internet uses Cloudflare CDN, local5g uses local Open5GS core)")
    p.add_argument("--target", default=None,
                   help="Ping latency target IP (defaults: 8.8.8.8 for internet, 10.45.0.1 for local5g)")
    p.add_argument("--gateway", default="http://127.0.0.1:5000",
                   help="Local private 5G gateway address")
    p.add_argument("--output", default=None,
                   help="Optional file path to output JSON results")
    a = p.parse_args()

    # Define targets
    ping_target = a.target if a.target else ('8.8.8.8' if a.mode == "internet" else '10.45.0.1')
    download_url = "https://speed.cloudflare.com/__down" if a.mode == "internet" else f"{a.gateway}/download"
    upload_url = "https://speed.cloudflare.com/__up" if a.mode == "internet" else f"{a.gateway}/upload"

    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": a.mode,
        "config": {
            "ping_target": ping_target,
            "download_url": download_url,
            "upload_url": upload_url
        },
        "network": {
            "connection_type": detect_network(a.mode),
            "open5gs_core": check_open5gs()
        }
    }

    # 1. Idle (Unloaded) Latency Test
    unloaded_latency = run_unloaded_ping(ping_target, count=5)
    results["latency_unloaded"] = unloaded_latency

    # 2. Download Throughput + Concurrent Loaded Latency
    dl_ping_thread = LoadedPingThread(ping_target)
    dl_ping_thread.start()
    
    download_result = run_download_test(download_url, duration=5.0)
    results["download"] = download_result
    
    dl_ping_thread.stop()
    loaded_latency_dl = dl_ping_thread.stop()
    results["latency_loaded_download"] = loaded_latency_dl

    # 3. Upload Throughput + Concurrent Loaded Latency
    ul_ping_thread = LoadedPingThread(ping_target)
    ul_ping_thread.start()
    
    upload_result = run_upload_test(upload_url, duration=5.0)
    results["upload"] = upload_result
    
    ul_ping_thread.stop()
    loaded_latency_ul = ul_ping_thread.stop()
    results["latency_loaded_upload"] = loaded_latency_ul

    # 4. Stress Index & QoS Calculations
    idle_ms = unloaded_latency.get("avg_ms")
    loaded_ms_dl = loaded_latency_dl.get("avg_ms")
    loaded_ms_ul = loaded_latency_ul.get("avg_ms")
    
    loaded_ms_avg = None
    if loaded_ms_dl is not None and loaded_ms_ul is not None:
        loaded_ms_avg = (loaded_ms_dl + loaded_ms_ul) / 2
    elif loaded_ms_dl is not None:
        loaded_ms_avg = loaded_ms_dl
    elif loaded_ms_ul is not None:
        loaded_ms_avg = loaded_ms_ul

    stress_pct = 0.0
    if idle_ms and loaded_ms_avg:
        stress_pct = max(0.0, ((loaded_ms_avg - idle_ms) / idle_ms) * 100)
    results["network_stress_index_pct"] = round(stress_pct, 1)

    dl_speed = download_result.get("speed_mbps", 0.0)
    loss = unloaded_latency.get("packet_loss_pct", 0.0)
    rating, qos_cls = determine_qos(dl_speed, idle_ms or 99.0, stress_pct, loss)
    
    results["qos"] = {
        "rating": rating,
        "class": qos_cls
    }

    # Print results to stdout in perfect, pretty-printed JSON
    json_str = json.dumps(results, indent=2)
    print(json_str)

    # Save to file if output path is specified
    if a.output:
        try:
            with open(a.output, "w") as f:
                f.write(json_str)
        except Exception as e:
            sys.stderr.write(f"Failed to save output to {a.output}: {str(e)}\n")

if __name__ == "__main__":
    main()
