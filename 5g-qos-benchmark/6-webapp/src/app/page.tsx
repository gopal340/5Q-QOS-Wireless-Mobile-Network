'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip, Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// ─── Types ─────────────────────────────────────────────────────
interface SpeedSample { time: number; mbps: number; }
type TestPhase = 'idle' | 'latency' | 'download' | 'upload' | 'complete';

// ─── Helpers ───────────────────────────────────────────────────
function getQoSLabel(dl: number, lat: number, stress: number, loss: number) {
  if (lat < 25 && loss < 0.2 && stress < 50 && dl > 100)
    return { label: 'Excellent', color: '#059669', sub: 'URLLC+eMBB — Ultra-low latency, mission-critical ready' };
  if (lat < 45 && loss < 1 && stress < 100 && dl > 30)
    return { label: 'Good', color: '#0891b2', sub: 'eMBB — 4K streaming, cloud gaming, HD conferencing' };
  if (lat < 85 && loss < 3 && stress < 200 && dl > 10)
    return { label: 'Fair', color: '#d97706', sub: 'Moderate bufferbloat — standard browsing OK' };
  return { label: 'Poor', color: '#dc2626', sub: 'High stress or packet loss detected' };
}

function stressLabel(pct: number) {
  if (pct < 50) return { text: 'Low', color: '#059669' };
  if (pct < 150) return { text: 'Medium', color: '#d97706' };
  return { text: 'High', color: '#dc2626' };
}

// ═══════════════════════════════════════════════════════════════
export default function Home() {
  const [phase, setPhase] = useState<TestPhase>('idle');
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<'internet'|'local5g'>('internet');

  const [dlSpeed, setDlSpeed] = useState<number|null>(null);
  const [ulSpeed, setUlSpeed] = useState<number|null>(null);
  const [netDetails, setNetDetails] = useState<any>(null);

  const [uLat, setULat] = useState<number|null>(null);
  const [uJit, setUJit] = useState<number|null>(null);
  const [uLoss, setULoss] = useState<number|null>(null);

  const [dlLat, setDlLat] = useState<number|null>(null);
  const [dlJit, setDlJit] = useState<number|null>(null);
  const [dlLoss, setDlLoss] = useState<number|null>(null);

  const [ulLat, setUlLat] = useState<number|null>(null);
  const [ulJit, setUlJit] = useState<number|null>(null);
  const [ulLoss, setUlLoss] = useState<number|null>(null);

  const [dlSamples, setDlSamples] = useState<SpeedSample[]>([]);
  const [ulSamples, setUlSamples] = useState<SpeedSample[]>([]);
  const [latSamples, setLatSamples] = useState<number[]>([]);

  const [netType, setNetType] = useState('Detecting...');
  const [coreStatus, setCoreStatus] = useState<Record<string,boolean>>({});
  const [coreOnline, setCoreOnline] = useState(false);

  const [showLoad, setShowLoad] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [progress, setProgress] = useState(0);

  const abortRef = useRef(false);
  const hasAutoStarted = useRef(false);

  // ─── Network detection ───────────────────────────────────────
  const detectNetwork = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const d = await res.json();
        setNetDetails(d);
        if (d.core_services) {
          setCoreStatus(d.core_services);
          setCoreOnline(Object.values(d.core_services).filter(Boolean).length > 0);
        }
      }
    } catch {}
    if (target === 'local5g') { setNetType('5G SA Core'); return; }
    const c = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (c?.type === 'wifi') setNetType('Wi-Fi');
    else if (c?.type === 'cellular') setNetType(`Cellular ${(c.effectiveType||'').toUpperCase()}`);
    else if (c?.type === 'ethernet') setNetType('Ethernet');
    else setNetType('Wi-Fi');
  }, [target]);

  // ─── Auto-start on mount (like fast.com) ─────────────────────
  useEffect(() => {
    detectNetwork();
    if (!hasAutoStarted.current) {
      hasAutoStarted.current = true;
      setTimeout(() => startTest(), 400);
    }
    return () => { abortRef.current = true; };
  }, []);

  // ─── Background ping tracker ─────────────────────────────────
  const bgPing = (onUpdate: (l: number) => void) => {
    let active = true, lost = 0, total = 0;
    const s: number[] = [];
    const t = target === 'internet' ? '8.8.8.8' : '10.45.0.1';
    const loop = async () => {
      while (active && !abortRef.current) {
        try {
          total++;
          const r = await fetch(`/api/ping?target=${t}&count=1`);
          if (!r.ok) { lost++; await new Promise(r=>setTimeout(r,200)); continue; }
          const d = await r.json();
          const l = d.ping?.latency_avg_ms;
          if (l != null) { s.push(l); onUpdate(l); } else lost++;
        } catch { lost++; }
        await new Promise(r=>setTimeout(r,300));
      }
    };
    loop();
    return {
      stop: () => {
        active = false;
        const avg = s.length ? s.reduce((a,b)=>a+b,0)/s.length : null;
        const jit = s.length > 1 ? s.slice(1).reduce((sum,v,i)=>sum+Math.abs(v-s[i]),0)/(s.length-1) : 0;
        return { avg, jit, loss: total ? (lost/total)*100 : 0 };
      }
    };
  };

  // ─── Latency test ────────────────────────────────────────────
  const testLatency = async () => {
    setPhase('latency'); setProgress(5); setSpeed(0);
    const s: number[] = [], n = 5; let lost = 0;
    const t = target === 'internet' ? '8.8.8.8' : '10.45.0.1';
    for (let i = 0; i < n; i++) {
      if (abortRef.current) return;
      try {
        const r = await fetch(`/api/ping?target=${t}&count=1`);
        if (!r.ok) throw 0;
        const d = await r.json(), l = d.ping?.latency_avg_ms;
        if (l != null) { s.push(l); setLatSamples(p=>[...p,l]); setSpeed(Math.round(l)); }
        else lost++;
      } catch { lost++; }
      setProgress(5 + Math.round(((i+1)/n)*15));
      await new Promise(r=>setTimeout(r,120));
    }
    if (s.length) {
      const avg = s.reduce((a,b)=>a+b,0)/s.length;
      const jit = s.length > 1 ? s.slice(1).reduce((sum,v,i)=>sum+Math.abs(v-s[i]),0)/(s.length-1) : 0;
      setULat(Math.round(avg*10)/10);
      setUJit(Math.round(jit*10)/10);
      setULoss(Math.round((lost/n)*1000)/10);
    }
  };

  // ─── Download test ───────────────────────────────────────────
  const testDownload = async () => {
    setPhase('download'); setProgress(25); setSpeed(0);
    const ping = bgPing(l => setLatSamples(p=>[...p,l]));
    const t0 = performance.now(), dur = 5000;
    let total = 0, idx = 0;

    const worker = async () => {
      let sz = 512*1024;
      while (performance.now()-t0 < dur && !abortRef.current) {
        const cs = performance.now();
        const url = target === 'internet'
          ? `https://speed.cloudflare.com/__down?bytes=${sz}` : `/api/download?size=${sz}`;
        try {
          const r = await fetch(url);
          if (!r.ok) throw 0;
          const rd = r.body?.getReader();
          if (!rd) throw 0;
          while (true) {
            const {done,value} = await rd.read();
            if (done) break;
            if (value) {
              total += value.length;
              const el = (performance.now()-t0)/1000;
              if (el > 0) setSpeed(Math.round((total*8)/(el*1e6)*10)/10);
            }
          }
          const ct = (performance.now()-cs)/1000;
          if (ct < 0.25 && sz < 4*1024*1024) sz *= 2;
          else if (ct > 0.9 && sz > 256*1024) sz /= 2;
        } catch { await new Promise(r=>setTimeout(r,100)); sz = Math.max(256*1024,sz/2); }
      }
    };

    const ps = Array.from({length:4}, ()=>worker());
    const si = setInterval(() => {
      const el = (performance.now()-t0)/1000;
      if (el > 0) { idx++; setDlSamples(p=>[...p,{time:idx,mbps:Math.round((total*8)/(el*1e6)*10)/10}]); }
    }, 500);

    await Promise.all(ps); clearInterval(si);
    const pst = ping.stop();
    const el = (performance.now()-t0)/1000;
    const mbps = Math.round((total*8)/(el*1e6)*10)/10;
    setDlSpeed(mbps); setSpeed(mbps);
    setDlLat(pst.avg ? Math.round(pst.avg*10)/10 : null);
    setDlJit(pst.jit ? Math.round(pst.jit*10)/10 : null);
    setDlLoss(Math.round(pst.loss*10)/10);
    return mbps;
  };

  // ─── Upload test ─────────────────────────────────────────────
  const testUpload = async () => {
    setPhase('upload'); setProgress(60); setSpeed(0);
    const ping = bgPing(l => setLatSamples(p=>[...p,l]));
    const t0 = performance.now(), dur = 5000;
    let total = 0, idx = 0;

    const fill = (a: Uint8Array) => {
      const t = new Uint8Array(Math.min(a.length,65536));
      crypto.getRandomValues(t);
      for (let i = 0; i < a.length; i += t.length) a.set(t.subarray(0,Math.min(t.length,a.length-i)),i);
    };

    const worker = async () => {
      let sz = 256*1024, buf = new Uint8Array(sz); fill(buf);
      while (performance.now()-t0 < dur && !abortRef.current) {
        if (buf.length !== sz) { buf = new Uint8Array(sz); fill(buf); }
        try {
          const url = target === 'internet' ? 'https://speed.cloudflare.com/__up' : '/api/upload';
          const r = await fetch(url, { method:'POST', body: new Blob([buf],{type:'text/plain'}) });
          if (!r.ok) throw 0;
          await r.text();
          total += sz;
          const el = (performance.now()-t0)/1000;
          if (el > 0) setSpeed(Math.round((total*8)/(el*1e6)*10)/10);
          const ct = (performance.now()-performance.now()+((performance.now()-t0) > 0 ? 0 : 0));
        } catch { await new Promise(r=>setTimeout(r,100)); sz = Math.max(128*1024,sz/2); }
      }
    };

    const ps = Array.from({length:4}, ()=>worker());
    const si = setInterval(() => {
      const el = (performance.now()-t0)/1000;
      if (el > 0) { idx++; setUlSamples(p=>[...p,{time:idx,mbps:Math.round((total*8)/(el*1e6)*10)/10}]); }
    }, 500);

    await Promise.all(ps); clearInterval(si);
    const pst = ping.stop();
    const el = (performance.now()-t0)/1000;
    const mbps = Math.round((total*8)/(el*1e6)*10)/10;
    setUlSpeed(mbps); setSpeed(mbps);
    setUlLat(pst.avg ? Math.round(pst.avg*10)/10 : null);
    setUlJit(pst.jit ? Math.round(pst.jit*10)/10 : null);
    setUlLoss(Math.round(pst.loss*10)/10);
    return mbps;
  };

  // ─── Main driver ─────────────────────────────────────────────
  const startTest = async () => {
    abortRef.current = true;
    await new Promise(r=>setTimeout(r,150));
    abortRef.current = false;
    setError(''); setSpeed(0); setProgress(0);
    setDlSpeed(null); setUlSpeed(null);
    setULat(null); setUJit(null); setULoss(null);
    setDlLat(null); setDlJit(null); setDlLoss(null);
    setUlLat(null); setUlJit(null); setUlLoss(null);
    setDlSamples([]); setUlSamples([]); setLatSamples([]);
    try {
      await detectNetwork();
      await testLatency();
      const dl = await testDownload();
      await testUpload();
      setProgress(100); setSpeed(dl); setPhase('complete');
    } catch (e: any) {
      setError(e.message || 'Test failed'); setPhase('idle');
    }
  };

  // ─── Computed ────────────────────────────────────────────────
  const loadedLatAvg = dlLat && ulLat ? Math.round(((dlLat+ulLat)/2)*10)/10 : dlLat||ulLat||null;
  const stressPct = uLat && loadedLatAvg ? Math.max(0, Math.round(((loadedLatAvg-uLat)/uLat)*100)) : 0;
  const qos = getQoSLabel(dlSpeed||0, uLat||99, stressPct, uLoss||0);
  const sl = stressLabel(stressPct);
  const isRunning = phase !== 'idle' && phase !== 'complete';

  // ─── Chart config ────────────────────────────────────────────
  const chartOpts: any = {
    responsive: true, maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    scales: {
      x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#9ca3af', font: { size: 9 } } },
      y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#9ca3af', font: { size: 9 } }, beginAtZero: true },
    },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#d1d5db' } },
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER — fast.com style
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#ffffff', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {/* ─── Header ─── */}
      <header className="w-full px-6 py-5 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #059669, #0891b2)' }}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <div>
            <span className="text-gray-900 text-lg font-extrabold tracking-tight">FAST</span>
            <span className="text-lg font-extrabold" style={{ color: '#0891b2' }}>.5G</span>
          </div>
        </div>

        {/* Target toggle — compact */}
        <div className="flex items-center gap-1 p-1 rounded-full" style={{ background: '#f3f4f6' }}>
          {(['internet','local5g'] as const).map(t => (
            <button key={t} onClick={() => { if (!isRunning) setTarget(t); }}
              disabled={isRunning}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                target === t ? 'text-white' : 'text-gray-500 hover:text-gray-700 disabled:opacity-40'
              }`}
              style={target === t ? { background: 'linear-gradient(135deg, #059669, #0891b2)' } : {}}
            >
              {t === 'internet' ? '🌐 Internet' : '📡 5G Core'}
            </button>
          ))}
        </div>
      </header>

      {/* ═══ Hero — Giant Speed Display ═══ */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-8">
        
        {/* ═══ Real-time Controls ═══ */}
        <AnimatePresence>
          {phase !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-wrap justify-center gap-3 mb-10 z-20"
            >
              <button
                onClick={() => setShowCharts(!showCharts)}
                className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 text-white shadow-md shadow-cyan-500/20 ${showCharts ? 'bg-[#0891b2] scale-105' : 'bg-[#0891b2]/90 hover:bg-[#0891b2]'}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-90">
                  <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
                </svg>
                Real-time Graphs
              </button>
              <button
                onClick={() => setShowLoad(!showLoad)}
                className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 text-white shadow-md shadow-emerald-500/20 ${showLoad ? 'bg-[#059669] scale-105' : 'bg-[#059669]/90 hover:bg-[#059669]'}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-300 opacity-90">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"/>
                </svg>
                Load Calculation
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase label */}
        <div className="h-8 flex items-center justify-center mb-4">
          {isRunning && (
            <div className="flex items-center gap-2 animate-fade-up">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{
                backgroundColor: phase === 'latency' ? '#d97706' : phase === 'download' ? '#059669' : '#0891b2'
              }} />
              <span className="text-xs font-semibold tracking-[0.15em] uppercase" style={{
                color: phase === 'latency' ? '#d97706' : phase === 'download' ? '#059669' : '#0891b2'
              }}>
                {phase === 'latency' ? 'Measuring Latency' : phase === 'download' ? 'Testing Download' : 'Testing Upload'}
              </span>
            </div>
          )}
          {phase === 'complete' && (
            <span className="text-xs font-semibold tracking-[0.15em] uppercase text-gray-400 animate-fade-up">
              Your Internet Speed
            </span>
          )}
        </div>

        {/* The Giant Number */}
        <div className="relative flex flex-col items-center">
          {/* Subtle gauge ring behind the number */}
          {isRunning && (
            <svg className="absolute -inset-8 w-[calc(100%+64px)] h-[calc(100%+64px)] opacity-20" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="94" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
              <circle cx="100" cy="100" r="94" fill="none"
                stroke={phase === 'latency' ? '#d97706' : phase === 'download' ? '#059669' : '#0891b2'}
                strokeWidth="2.5" strokeLinecap="round"
                strokeDasharray={`${2*Math.PI*94}`}
                strokeDashoffset={`${2*Math.PI*94*(1-progress/100)}`}
                transform="rotate(-90 100 100)"
                style={{ transition: 'stroke-dashoffset 0.3s ease' }}
              />
            </svg>
          )}

          <span className="tabular-nums font-black leading-none select-none" style={{
            fontSize: phase === 'latency' ? '8rem' : '10rem',
            color: phase === 'idle' ? '#d1d5db' :
                   phase === 'latency' ? '#d97706' :
                   phase === 'complete' ? '#059669' : '#111827',
            transition: 'color 0.4s ease',
          }}>
            {phase === 'idle' ? '0' :
             phase === 'latency' ? (speed || '—') :
             speed > 0 ? Math.round(speed) : '—'}
          </span>

          {/* Unit */}
          <span className="text-lg font-bold tracking-[0.3em] uppercase mt-2" style={{
            color: phase === 'idle' ? '#d1d5db' :
                   phase === 'latency' ? '#d9770680' :
                   phase === 'complete' ? '#05966980' : '#6b728080',
            transition: 'color 0.4s ease',
          }}>
            {phase === 'latency' ? 'ms' : speed >= 1000 ? 'Gbps' : 'Mbps'}
          </span>
        </div>

        {/* Reset / Restart button */}
        <div className="mt-10 flex flex-col items-center gap-3 z-10">
          {(phase === 'complete' || phase === 'idle') && (
            <button
              onClick={startTest}
              className="group flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm"
              style={{
                background: phase === 'idle' ? 'linear-gradient(135deg, #059669, #0891b2)' : '#f3f4f6',
                color: phase === 'idle' ? '#ffffff' : '#6b7280',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={phase === 'idle'
                  ? "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
                  : "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644v-4.992"
                } />
              </svg>
              {phase === 'idle' ? 'Start Test' : 'Test Again'}
            </button>
          )}
          {error && (
            <p className="text-red-600 text-xs font-medium px-4 py-2 rounded-lg" style={{ background: '#fef2f2' }}>
              {error}
            </p>
          )}
        </div>

        <div className="w-full max-w-2xl mt-8 mb-12 flex flex-col gap-6">
          <AnimatePresence>
            {showCharts && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden"
              >
                {dlSamples.length > 0 && (
                  <div className="rounded-2xl overflow-hidden" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <div className="px-5 py-3 flex justify-between" style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Download</span>
                      <span className="text-[10px] font-mono" style={{ color: '#05966980' }}>{dlSamples.length} pts</span>
                    </div>
                    <div className="h-36 p-4">
                      <Line
                        data={{ labels: dlSamples.map(s=>`${s.time}s`), datasets: [{ data: dlSamples.map(s=>s.mbps), borderColor:'#059669', backgroundColor:'rgba(5,150,105,0.06)', fill:true, tension:0.4, pointRadius:0, borderWidth:2 }] }}
                        options={chartOpts}
                      />
                    </div>
                  </div>
                )}
                {ulSamples.length > 0 && (
                  <div className="rounded-2xl overflow-hidden" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <div className="px-5 py-3 flex justify-between" style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Upload</span>
                      <span className="text-[10px] font-mono" style={{ color: '#0891b280' }}>{ulSamples.length} pts</span>
                    </div>
                    <div className="h-36 p-4">
                      <Line
                        data={{ labels: ulSamples.map(s=>`${s.time}s`), datasets: [{ data: ulSamples.map(s=>s.mbps), borderColor:'#0891b2', backgroundColor:'rgba(8,145,178,0.06)', fill:true, tension:0.4, pointRadius:0, borderWidth:2 }] }}
                        options={chartOpts}
                      />
                    </div>
                  </div>
                )}
                {latSamples.length > 0 && (
                  <div className="rounded-2xl overflow-hidden" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <div className="px-5 py-3 flex justify-between" style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Latency Over Time</span>
                      <span className="text-[10px] font-mono" style={{ color: '#d9770680' }}>{latSamples.length} pings</span>
                    </div>
                    <div className="h-36 p-4">
                      <Line
                        data={{ labels: latSamples.map((_,i)=>`${i+1}`), datasets: [{ data: latSamples, borderColor:'#d97706', backgroundColor:'rgba(217,119,6,0.06)', fill:true, tension:0.3, pointRadius:0, borderWidth:2 }] }}
                        options={chartOpts}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showLoad && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-6 overflow-hidden"
              >
                {/* ─── Speed Summary Row ─── */}
                <div className="grid grid-cols-2 gap-px rounded-2xl overflow-hidden shadow-sm" style={{ background: '#e5e7eb' }}>
                  <div className="p-5" style={{ background: '#ffffff' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4" style={{ color: '#0891b2' }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>Upload</span>
                    </div>
                    <span className="text-3xl font-black tabular-nums text-gray-900">{ulSpeed !== null ? ulSpeed.toFixed(1) : '—'}</span>
                    <span className="text-xs font-semibold text-gray-400 ml-1.5">Mbps</span>
                  </div>

                  <div className="p-5" style={{ background: '#ffffff' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4" style={{ color: '#059669' }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>Download</span>
                    </div>
                    <span className="text-3xl font-black tabular-nums text-gray-900">{dlSpeed !== null ? dlSpeed.toFixed(1) : '—'}</span>
                    <span className="text-xs font-semibold text-gray-400 ml-1.5">Mbps</span>
                  </div>
                </div>

                {/* ─── Latency Matrix ─── */}
                <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Latency & Bufferbloat Load Calculation</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase" style={{ color: sl.color }}>Stress: {sl.text}</span>
                      <span className="text-xs font-black tabular-nums text-gray-900">+{stressPct}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-px" style={{ background: '#e5e7eb' }}>
                    <div className="p-4" style={{ background: '#ffffff' }}>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Unloaded</div>
                      <div className="space-y-2.5">
                        <div className="flex justify-between">
                          <span className="text-[11px] text-gray-500">Ping</span>
                          <span className="text-sm font-bold tabular-nums text-gray-900">{uLat ?? '—'} <span className="text-[10px] text-gray-400">ms</span></span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[11px] text-gray-500">Jitter</span>
                          <span className="text-sm font-bold tabular-nums text-gray-700">{uJit ?? '—'} <span className="text-[10px] text-gray-400">ms</span></span>
                        </div>
                        <div className="flex justify-between pt-2" style={{ borderTop: '1px solid #f3f4f6' }}>
                          <span className="text-[11px] text-gray-500">Loss</span>
                          <span className="text-sm font-bold tabular-nums text-gray-700">{uLoss !== null ? `${uLoss}%` : '—'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4" style={{ background: '#ffffff' }}>
                      <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#059669' }}>During Download</div>
                      <div className="space-y-2.5">
                        <div className="flex justify-between">
                          <span className="text-[11px]" style={{ color: '#05966980' }}>Ping</span>
                          <span className="text-sm font-bold tabular-nums" style={{ color: '#059669' }}>{dlLat ?? '—'} <span className="text-[10px] text-gray-400">ms</span></span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[11px]" style={{ color: '#05966980' }}>Jitter</span>
                          <span className="text-sm font-bold tabular-nums text-gray-700">{dlJit ?? '—'} <span className="text-[10px] text-gray-400">ms</span></span>
                        </div>
                        <div className="flex justify-between pt-2" style={{ borderTop: '1px solid #ecfdf5' }}>
                          <span className="text-[11px]" style={{ color: '#05966980' }}>Loss</span>
                          <span className="text-sm font-bold tabular-nums text-gray-700">{dlLoss !== null ? `${dlLoss}%` : '—'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4" style={{ background: '#ffffff' }}>
                      <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#0891b2' }}>During Upload</div>
                      <div className="space-y-2.5">
                        <div className="flex justify-between">
                          <span className="text-[11px]" style={{ color: '#0891b280' }}>Ping</span>
                          <span className="text-sm font-bold tabular-nums" style={{ color: '#0891b2' }}>{ulLat ?? '—'} <span className="text-[10px] text-gray-400">ms</span></span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[11px]" style={{ color: '#0891b280' }}>Jitter</span>
                          <span className="text-sm font-bold tabular-nums text-gray-700">{ulJit ?? '—'} <span className="text-[10px] text-gray-400">ms</span></span>
                        </div>
                        <div className="flex justify-between pt-2" style={{ borderTop: '1px solid #ecfeff' }}>
                          <span className="text-[11px]" style={{ color: '#0891b280' }}>Loss</span>
                          <span className="text-sm font-bold tabular-nums text-gray-700">{ulLoss !== null ? `${ulLoss}%` : '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl p-5 flex items-center justify-between shadow-sm" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">3GPP QoS Classification</div>
                    <div className="text-xl font-black" style={{ color: qos.color }}>{qos.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{qos.sub}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Connection</div>
                    <div className="text-sm font-bold text-gray-700">{netType}</div>
                    {netDetails?.network?.host_ip && (
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">{netDetails.network.host_ip}</div>
                    )}
                  </div>
                </div>

                {Object.keys(coreStatus).length > 0 && (
                  <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Open5GS Core Services</span>
                      <span className="text-[10px] font-bold text-gray-400">5G SA Environment</span>
                    </div>
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {Object.entries(coreStatus).map(([name, up]: [string, any]) => (
                        <div key={name} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: '#ffffff' }}>
                          <span className="text-[11px] font-semibold font-mono text-gray-600 uppercase">
                            {name.replace('open5gs-','').replace('d','')}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                              {up && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400" />}
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${up ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="w-full px-6 py-4 flex items-center justify-between relative z-10" style={{ borderTop: '1px solid #f3f4f6' }}>
        <span className="text-[10px] text-gray-400 font-medium">
          <span className="font-bold" style={{ color: '#0891b2' }}>FAST.5G</span> · QoS Diagnostics Engine v4.0
        </span>
        <div className="flex items-center gap-4 text-[10px] text-gray-400">
          <span className="hover:text-gray-600 transition-colors cursor-pointer">Docs</span>
          <span className="hover:text-gray-600 transition-colors cursor-pointer">Privacy</span>
          <span className="hover:text-gray-600 transition-colors cursor-pointer">GitHub</span>
        </div>
      </footer>
    </div>
  );
}
