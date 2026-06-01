# 5G QoS Benchmark and Diagnostics Engine

An advanced, full-stack framework to measure real-time 5G network performance, specifically focused on throughput, unloaded latency, and **bufferbloat** (loaded latency). 

This project utilizes a local Open5GS core network, a Python-based diagnostic gateway, and a modern Next.js web application to provide industry-grade telemetry visualization.

## Features
- **Unloaded vs. Loaded Latency:** Differentiates between idle ping and ping during high-throughput downloads/uploads to accurately diagnose bufferbloat.
- **Real-Time Visualization:** Live graphs using `Chart.js` and `framer-motion` for smooth UI transitions.
- **3GPP QoS Categorization:** Translates raw metrics into standardized 5G QoS profiles (e.g., eMBB, URLLC).
- **Core Network Monitoring:** Active heartbeat monitoring of Open5GS local daemon services (AMF, SMF, UPF, UDM).

## Prerequisites (Ubuntu / WSL2)
1. **Node.js** (v18+) and **npm**
2. **Python** (3.8+)
3. **Open5GS** (configured and running locally via systemd)
4. **Git**

## How to Run Locally

This project is separated into a Python Backend (Gateway) and a Next.js Frontend (Web App).

### 1. Start the Open5GS Core (if not already running)
Ensure that your Open5GS core network services are active.
```bash
sudo systemctl start open5gs-amfd open5gs-smfd open5gs-upfd open5gs-udmd
```

### 2. Start the Python Diagnostics Gateway
The gateway performs the active network measurements and monitors the core status.

```bash
# Navigate to the gateway directory
cd 5g-qos-benchmark/2-gateway

# Install required python packages if needed (e.g. Flask, flask-cors, psutil)
pip install -r requirements.txt

# Run the gateway server
python3 gateway.py
```
*The gateway runs by default on `http://127.0.0.1:5000`.*

### 3. Start the Next.js Web Dashboard
The web app provides the real-time UI dashboard.

Open a **new terminal window** and run:
```bash
# Navigate to the webapp directory
cd 5g-qos-benchmark/6-webapp

# Install dependencies (only required the first time)
npm install

# Start the development server
npm run dev
```
*The dashboard will be available at `http://localhost:3000`.*

## Running the Benchmark
1. Navigate to `http://localhost:3000` in your web browser.
2. Click **Start Test**.
3. Watch the real-time graphs and load calculation panels populate as the gateway measures latency, download speed, and upload speed.
4. Review your 3GPP QoS Classification score based on the bufferbloat index.
