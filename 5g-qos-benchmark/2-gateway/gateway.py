#!/usr/bin/env python3
"""
5G QoS Benchmarking — Telemetry Gateway v3.0
Binds to 0.0.0.0:5000 — no uesimtun0 needed
Supports multi-chunk download/upload for accurate speed testing
"""
import os, time, json, subprocess, threading, re
from datetime import datetime, timezone
from flask import Flask, request, jsonify, Response

app = Flask(__name__)

IPERF_RESULT = None
IPERF_LOCK = threading.Lock()

def get_host_ip():
    try:
        r = subprocess.run(["ip","route","get","1.1.1.1"], capture_output=True, text=True, timeout=5)
        for p in r.stdout.split():
            try:
                import ipaddress; ipaddress.ip_address(p)
                if not p.startswith("127."): return p
            except: pass
    except: pass
    return "127.0.0.1"

def ping_target(target, count=10):
    try:
        r = subprocess.run(["ping","-c",str(count),"-i","0.2",target], capture_output=True, text=True, timeout=30)
        out = r.stdout + r.stderr
        s = {"target": target, "packets_sent": count}
        m = re.search(r'rtt min/avg/max/mdev = ([\d.]+)/([\d.]+)/([\d.]+)/([\d.]+)', out)
        if m:
            s["latency_min_ms"] = round(float(m.group(1)),3)
            s["latency_avg_ms"] = round(float(m.group(2)),3)
            s["latency_max_ms"] = round(float(m.group(3)),3)
            s["jitter_ms"]      = round(float(m.group(4)),3)
        m = re.search(r'(\d+)% packet loss', out)
        if m: s["packet_loss_pct"] = float(m.group(1))
        return s
    except Exception as e:
        return {"target": target, "error": str(e)}

def check_service(name):
    try:
        r = subprocess.run(["systemctl","is-active",name], capture_output=True, text=True, timeout=5)
        return r.stdout.strip() == "active"
    except: return False

# ─── API Endpoints ───────────────────────────────────────────────

@app.route("/ping")
def ping():
    target = request.args.get("target", "8.8.8.8")
    count = int(request.args.get("count", "10"))
    return jsonify({"status":"ok","timestamp":datetime.now(timezone.utc).isoformat(),"ping":ping_target(target,count)})

@app.route("/download")
def download():
    """Download throughput test — supports chunked mode for accurate measurement."""
    size = min(int(request.args.get("size","10485760")), 200*1024*1024)
    return Response(os.urandom(size), mimetype="application/octet-stream",
                    headers={"X-Download-Size":str(size),"Access-Control-Allow-Origin":"*"})

@app.route("/upload", methods=["POST","OPTIONS"])
def upload():
    if request.method == "OPTIONS":
        return jsonify({"status":"ok"}), 200
    d = request.get_data()
    return jsonify({"status":"ok","bytes_received":len(d),"timestamp":datetime.now(timezone.utc).isoformat()})

@app.route("/benchmark")
def benchmark():
    target = request.args.get("target", "8.8.8.8")
    count  = int(request.args.get("count", "20"))
    ps = ping_target(target, count)
    # HTTP throughput test
    dl_size = 5*1024*1024; start = time.time()
    try:
        import urllib.request
        with urllib.request.urlopen(f"http://{get_host_ip()}:5000/download?size={dl_size}", timeout=30) as r: r.read()
        dt = time.time()-start; tp = (dl_size*8)/(dt*1e6) if dt>0 else 0
    except: dt=0; tp=0
    avg = ps.get("latency_avg_ms",999); loss = ps.get("packet_loss_pct",100); jit = ps.get("jitter_ms",999)
    if avg<20 and loss<0.5 and jit<5: rating="Excellent"; cls="eMBB+URLLC"
    elif avg<50 and loss<2 and jit<15: rating="Good"; cls="eMBB"
    elif avg<100 and loss<5 and jit<30: rating="Fair"; cls="mMTC"
    else: rating="Poor"; cls="Best Effort"
    return jsonify({"status":"ok","timestamp":datetime.now(timezone.utc).isoformat(),"target":target,
        "ping":ps,"throughput_mbps":round(tp,2),"download_time_sec":round(dt,3),
        "qos_rating":rating,"qos_class":cls})

@app.route("/status")
def status():
    svcs = {}
    for s in ["open5gs-nrfd","open5gs-udmd","open5gs-ausfd","open5gs-udrd","open5gs-amfd","open5gs-smfd","open5gs-upfd"]:
        svcs[s] = check_service(s)
    net = {"host_ip": get_host_ip()}
    try:
        r = subprocess.run(["ip","addr","show","ogstun"], capture_output=True, text=True, timeout=5)
        net["ogstun"] = r.stdout.strip() if r.returncode==0 else "not found"
    except: net["ogstun"] = "error"
    return jsonify({"status":"ok" if all(svcs.values()) else "degraded",
        "timestamp":datetime.now(timezone.utc).isoformat(),"core_services":svcs,"network":net,
        "5g_connected":all(svcs.values()),"gateway_version":"3.0.0"})

@app.route("/iperf-result")
def iperf_result():
    with IPERF_LOCK:
        return jsonify(IPERF_RESULT or {"status":"no_result","message":"No iperf3 test run yet"})

@app.route("/start-iperf", methods=["POST"])
def start_iperf():
    global IPERF_RESULT
    data = request.json or {}
    target = data.get("target","127.0.0.1")
    port = data.get("port",5201)
    dur = data.get("duration",10)
    def run():
        global IPERF_RESULT
        try:
            r = subprocess.run(["iperf3","-c",target,"-p",str(port),"-t",str(dur),"-J"], capture_output=True, text=True, timeout=dur+30)
            if r.returncode==0:
                d = json.loads(r.stdout)
                with IPERF_LOCK:
                    IPERF_RESULT = {"status":"ok","timestamp":datetime.now(timezone.utc).isoformat(),
                        "throughput_mbps":d.get("end",{}).get("sum_sent",{}).get("bits_per_second",0)/1e6,
                        "retransmits":d.get("end",{}).get("sum_sent",{}).get("retransmits",0), "raw":d}
            else:
                with IPERF_LOCK: IPERF_RESULT = {"status":"error","error":r.stderr[:300]}
        except Exception as e:
            with IPERF_LOCK: IPERF_RESULT = {"status":"error","error":str(e)}
    threading.Thread(target=run, daemon=True).start()
    return jsonify({"status":"started","message":f"iperf3 to {target}:{port} for {dur}s"})

# ─── CORS headers for web app ────────────────────────────────────
@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

if __name__ == "__main__":
    print(f"5G QoS Gateway v3.0 on http://0.0.0.0:5000 (host: {get_host_ip()})")
    app.run(host="0.0.0.0", port=5000, debug=False)
