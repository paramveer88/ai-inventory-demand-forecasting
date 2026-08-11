import React, { useEffect, useRef, useState, useCallback } from "react";
import { Zap } from "lucide-react";

interface LandingPageProps {
  onEnter?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  const scene1Ref = useRef<HTMLElement>(null);
  const scene2Ref = useRef<HTMLElement>(null);
  const sunRef = useRef<HTMLDivElement>(null);
  const dashRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState("Dashboard");
  const [activeSeg, setActiveSeg] = useState("All SKUs");
  const [key, setKey] = useState(0);

  const sparkVals = [
    30, 45, 25, 60, 38, 70, 50, 65, 42, 80, 55, 90, 60, 75, 48, 66, 35, 58,
  ];
  const dotPattern = [
    1, 1, 0.4, 1, 1, 0.4, 1, 1, 0.4, 1, 0.4, 1, 1, 0.4, 1, 1, 0.4, 1, 0.4, 1, 1,
    0.4, 1, 1, 0.4, 1, 1, 1, 1, 0.4, 1, 0.4, 1, 1, 1, 0.4, 0.4, 1, 1, 1, 0.4, 1,
    0.4, 1, 1,
  ];
  const barVals = [35, 55, 60, 42, 100, 30];

  const renderProgress = useCallback((p: number) => {
    function clamp(v: number, a: number, b: number) {
      return Math.max(a, Math.min(b, v));
    }
    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }
    function remap(v: number, inMin: number, inMax: number) {
      return clamp((v - inMin) / (inMax - inMin), 0, 1);
    }

    if (
      !scene1Ref.current ||
      !scene2Ref.current ||
      !sunRef.current ||
      !dashRef.current ||
      !copyRef.current
    ) {
      return;
    }

    // Stage A: blur/zoom out hero (0 - 0.32)
    const a = remap(p, 0, 0.32);
    scene1Ref.current.style.filter = `brightness(${lerp(1, 0.35, a)}) blur(${lerp(0, 10, a)}px)`;
    scene1Ref.current.style.transform = `scale(${lerp(1, 1.18, a)})`;
    scene1Ref.current.style.opacity = `${lerp(1, 0, remap(p, 0.28, 0.5))}`;

    // Sun growth (0.08 - 0.5)
    const s = remap(p, 0.08, 0.5);
    const scale = lerp(0, 34, s);
    sunRef.current.style.transform = `translate(-50%,50%) scale(${scale})`;
    sunRef.current.style.opacity = `${lerp(0, 1, remap(p, 0.08, 0.22))}`;

    // Scene 2 reveal (0.48 - 0.85)
    const b = remap(p, 0.48, 0.85);
    scene2Ref.current.style.opacity = `${b}`;
    scene2Ref.current.style.pointerEvents = b > 0.5 ? "auto" : "none";

    dashRef.current.style.transform = `translate(-50%, ${lerp(70, 0, remap(p, 0.58, 0.92))}px)`;
    dashRef.current.style.opacity = `${remap(p, 0.56, 0.86)}`;
    copyRef.current.style.transform = `translateY(${lerp(24, 0, remap(p, 0.52, 0.78))}px)`;
    copyRef.current.style.opacity = `${remap(p, 0.5, 0.76)}`;
  }, []);

  const replayAnimation = () => {
    setKey((prev) => prev + 1);
  };

  useEffect(() => {
    function clamp(v: number, a: number, b: number) {
      return Math.max(a, Math.min(b, v));
    }
    function easeInOutCubic(t: number) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    renderProgress(0);

    const LAUNCH_HOLD_MS = 2600;
    const TRANSITION_MS = 3200;
    let animFrameId: number;

    const timer = setTimeout(() => {
      const start = performance.now();
      function frame(now: number) {
        const t = clamp((now - start) / TRANSITION_MS, 0, 1);
        renderProgress(easeInOutCubic(t));
        if (t < 1) {
          animFrameId = requestAnimationFrame(frame);
        }
      }
      animFrameId = requestAnimationFrame(frame);
    }, LAUNCH_HOLD_MS);

    return () => {
      clearTimeout(timer);
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  }, [key, renderProgress]);

  return (
    <div className="apogee-landing-root" key={key}>
      <style>{`
        :root {
          --bg-void: #0d0f14;
          --ink: #f3ece6;
          --ink-dim: #9ca3af;
          --ink-faint: rgba(243,236,230,0.6);
          --ember: #7c5cfc;
          --ember-2: #c084fc;
          --amber: #f59e0b;
          --cyan: #38bdf8;
          --panel: rgba(20,23,32,0.65);
          --panel-border: rgba(124,92,252,0.18);
          --serif: 'Newsreader', Georgia, serif;
          --sans: 'Inter', -apple-system, sans-serif;
          --mono: 'IBM Plex Mono', monospace;
        }

        .apogee-landing-root {
          background: var(--bg-void);
          color: var(--ink);
          font-family: var(--sans);
          min-height: 100vh;
          width: 100%;
          position: relative;
          background-image: radial-gradient(ellipse 900px 500px at 50% 0%, rgba(124,92,252,0.25), transparent 70%), var(--bg-void);
          overflow: hidden;
        }

        .apogee-credit {
          position: fixed; top: 0; left: 0; right: 0; z-index: 50;
          display: flex; justify-content: space-between; align-items: center;
          padding: 26px 40px; font-size: 12.5px; letter-spacing: 0.06em;
          color: rgba(243,236,230,0.55); pointer-events: none; font-family: var(--sans);
        }
        .apogee-credit span { display: inline-flex; align-items: center; gap: 8px; }

        .stage-sticky {
          height: 100vh; width: 100%;
          display: flex; align-items: center; justify-content: center;
          padding: 40px clamp(16px,4vw,64px);
        }
        .frame {
          position: relative; width: 100%; max-width: 1440px; height: min(88vh,860px);
          border-radius: 28px; overflow: hidden;
          border: 1px solid rgba(124,92,252,0.2);
          box-shadow: 0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(124,92,252,0.1);
          background: #090b10;
        }

        .nav {
          position: absolute; top: 0; left: 0; right: 0; z-index: 40;
          display: flex; align-items: center; justify-content: space-between;
          padding: 22px 32px;
        }
        .brand {
          display: flex; align-items: center; gap: 10px;
          font-family: var(--serif); font-size: 20px; letter-spacing: 0.01em; color: var(--ink);
          cursor: pointer;
        }
        .brand-mark {
          width: 32px; height: 32px; border-radius: 10px; position: relative; flex: none;
          background: #f59e0b; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 14px rgba(245,158,11,0.4);
        }

        .nav-links {
          display: flex; align-items: center; gap: 28px;
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(124,92,252,0.15);
          padding: 10px 22px; border-radius: 100px;
          backdrop-filter: blur(10px);
        }
        .nav-links button {
          color: rgba(243,236,230,0.8); text-decoration: none; font-size: 13.5px; font-weight: 500;
          display: flex; align-items: center; gap: 4px; background: none; border: none; cursor: pointer;
        }
        .nav-links button:hover { color: var(--amber); }
        .nav-links .chev { font-size: 10px; opacity: 0.6; }

        .nav-actions { display: flex; align-items: center; gap: 18px; }
        .btn-ghost { color: rgba(243,236,230,0.85); font-size: 13.5px; font-weight: 500; background: none; border: none; cursor: pointer; }
        .btn-solid {
          background: linear-gradient(135deg, #7c5cfc, #6d4ef0); color: #ffffff; border: none; border-radius: 100px;
          padding: 11px 22px; font-size: 13.5px; font-weight: 600; cursor: pointer;
          font-family: var(--sans);
          box-shadow: 0 6px 20px rgba(124,92,252,0.35);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .btn-solid:hover { transform: scale(1.03); box-shadow: 0 8px 24px rgba(124,92,252,0.5); }

        .scene1 {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, #0d0f17 0%, #16192b 25%, #2a1e4a 50%, #4c1d95 72%, #7c5cfc 88%, #f59e0b 100%);
          transform-origin: 50% 42%;
          will-change: transform, opacity, filter;
          z-index: 1;
        }
        .scene1::before {
          content: ""; position: absolute; inset: 0;
          background-image:
            radial-gradient(circle at 18% 58%, rgba(255,255,255,0.16) 0%, transparent 32%),
            radial-gradient(circle at 82% 40%, rgba(255,255,255,0.14) 0%, transparent 30%),
            radial-gradient(circle at 30% 30%, rgba(255,255,255,0.10) 0%, transparent 26%),
            radial-gradient(circle at 68% 66%, rgba(0,0,0,0.12) 0%, transparent 30%);
          mix-blend-mode: overlay;
        }
        .mountains {
          position: absolute; left: 0; right: 0; bottom: 0; height: 34%;
          background: #0b0d14;
          clip-path: polygon(0% 100%, 0% 55%, 8% 62%, 16% 44%, 26% 58%, 36% 40%, 48% 60%, 58% 46%, 68% 64%, 80% 50%, 90% 66%, 100% 52%, 100% 100%);
          opacity: 0.92;
        }
        .grain {
          position: absolute; inset: 0; opacity: 0.05; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
        }

        .rocket-rig { position: absolute; left: 50%; bottom: 32%; transform: translateX(-50%); z-index: 5; }

        /* Exhaust beam */
        .beam {
          position: absolute; bottom: 0; left: 50%; width: 4px; height: 0;
          transform: translateX(-50%);
          background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(168,85,247,0.55) 45%, transparent 100%);
          box-shadow: 0 0 18px 5px rgba(124,92,252,0.35);
          animation: beamGrow 1.6s cubic-bezier(.2,.7,.2,1) 0.2s forwards;
          border-radius: 2px;
        }
        @keyframes beamGrow { from { height: 0; } to { height: 420px; } }

        /* Rocket wrapper */
        .rocket {
          position: absolute; bottom: 0; left: 50%;
          width: 28px; height: 80px;
          transform: translate(-50%, 0);
          opacity: 0;
          animation: rocketRise 2.2s cubic-bezier(.22,.7,.2,1) 0.15s forwards;
          filter: drop-shadow(0 0 5px rgba(124,92,252,0.3));
        }
        @keyframes rocketRise {
          0%  { opacity: 0; bottom: 0; }
          8%  { opacity: 1; }
          100%{ opacity: 1; bottom: 410px; }
        }

        /* Nose — elongated smooth tip */
        .rocket-nose {
          position: absolute; top: 0; left: 50%;
          transform: translateX(-50%);
          width: 12px; height: 26px;
          background: linear-gradient(180deg, #ede9fe 0%, #a78bfa 55%, #7c5cfc 100%);
          clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
        }

        /* Body */
        .rocket-body {
          position: absolute;
          top: 26px; left: 50%;
          transform: translateX(-50%);
          width: 12px; height: 38px;
          background: linear-gradient(90deg, #4b4d6b 0%, #8b85d4 30%, #e8e4ff 50%, #8b85d4 70%, #4b4d6b 100%);
          border-radius: 1px;
        }
        /* Single thin highlight */
        .rocket-body::before {
          content: '';
          position: absolute;
          top: 5px; left: 3px;
          width: 2px; height: 55%;
          background: rgba(255,255,255,0.38);
          border-radius: 1px;
        }

        /* Fins */
        .rocket-fin-left {
          position: absolute;
          bottom: 14px; left: 50%;
          transform: translateX(-50%) translateX(-9px);
          width: 0; height: 0;
          border-right: 7px solid rgba(124,92,252,0.8);
          border-top: 11px solid transparent;
        }
        .rocket-fin-right {
          position: absolute;
          bottom: 14px; left: 50%;
          transform: translateX(-50%) translateX(2px);
          width: 0; height: 0;
          border-left: 7px solid rgba(124,92,252,0.8);
          border-top: 11px solid transparent;
        }

        /* Flame */
        .rocket-flame {
          position: absolute;
          bottom: -12px; left: 50%;
          transform: translateX(-50%);
          width: 7px; height: 14px;
          background: linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(245,158,11,0.7) 55%, transparent 100%);
          border-radius: 0 0 50% 50%;
          animation: flamePulse 0.14s ease-in-out infinite alternate;
        }
        @keyframes flamePulse {
          from { transform: translateX(-50%) scaleY(1);    opacity: 0.85; }
          to   { transform: translateX(-50%) scaleY(1.18); opacity: 1; }
        }


        .pill {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(15,17,23,0.65); border: 1px solid rgba(124,92,252,0.25);
          padding: 8px 16px; border-radius: 100px; font-size: 12.5px; font-weight: 500;
          color: var(--ink-dim); backdrop-filter: blur(8px);
        }
        .pill .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--amber); box-shadow: 0 0 8px 2px var(--amber); }
        .pill b { color: var(--ink); font-weight: 600; }
        .yc-badge { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 16px; background: #7c5cfc; color: #fff; font-weight: 700; font-size: 9px; border-radius: 3px; }

        .hero-copy {
          position: absolute; left: 0; right: 0; top: 56%; transform: translateY(-50%);
          display: flex; flex-direction: column; align-items: center; text-align: center; gap: 22px;
          padding: 0 40px; z-index: 6;
        }
        .hero-copy .pill { opacity: 0; animation: fadeUp .8s ease .1s forwards; }
        .hero-title {
          font-family: var(--serif); font-weight: 400; font-size: clamp(30px,4.4vw,54px);
          line-height: 1.12; color: var(--ink); text-wrap: balance;
        }
        .hero-title span { display: block; opacity: 0; filter: blur(6px); transform: translateY(16px);
          animation: fadeUp .9s cubic-bezier(.2,.7,.2,1) forwards; }
        .hero-title span:nth-child(1) { animation-delay: .55s; }
        .hero-title span:nth-child(2) { animation-delay: .72s; }
        .hero-title span:nth-child(3) { animation-delay: .89s; }
        .hero-sub { font-size: 15px; color: var(--ink-faint); max-width: 480px; line-height: 1.55;
          opacity: 0; animation: fadeUp .8s ease 1.05s forwards; font-weight: 400; }
        @keyframes fadeUp { to { opacity: 1; filter: blur(0); transform: translateY(0); } }

        .sun {
          position: absolute; left: 50%; bottom: 32%; width: 60px; height: 60px; border-radius: 50%;
          transform: translate(-50%,50%) scale(0);
          background: radial-gradient(circle at 50% 42%, #fef08a 0%, #f59e0b 30%, #a855f7 65%, #4c1d95 100%);
          box-shadow: 0 0 160px 70px rgba(124,92,252,0.45);
          z-index: 2; will-change: transform;
        }

        .scene2 {
          position: absolute; inset: 0; opacity: 0; z-index: 3;
          background: radial-gradient(ellipse 900px 600px at 50% 120%, rgba(124,92,252,0.35), transparent 60%), #0d0f14;
        }
        .scene2-copy {
          position: absolute; left: 0; right: 0; top: 11%; display: flex; flex-direction: column;
          align-items: center; text-align: center; gap: 18px; padding: 0 40px; z-index: 6;
        }
        .scene2-title {
          font-family: var(--serif); font-weight: 400; font-size: clamp(24px,3.4vw,40px);
          line-height: 1.2; color: var(--ink);
        }

        .dash {
          position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
          width: min(88%,980px); height: 56%;
          border-radius: 14px 14px 0 0; overflow: hidden;
          background: rgba(20,23,32,0.65);
          border: 1px solid rgba(124,92,252,0.2); border-bottom: none;
          backdrop-filter: blur(16px);
          box-shadow: 0 -20px 80px rgba(124,92,252,0.25);
        }
        .dash-bar {
          display: flex; align-items: center; gap: 14px; padding: 10px 16px;
          background: rgba(13,15,20,0.75); border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .traffic { display: flex; gap: 6px; }
        .traffic i { width: 9px; height: 9px; border-radius: 50%; display: block; }
        .traffic i:nth-child(1) { background: #ff5f57; }
        .traffic i:nth-child(2) { background: #febc2e; }
        .traffic i:nth-child(3) { background: #28c840; }
        .dash-url {
          flex: 1; text-align: center; font-size: 11.5px; color: rgba(243,236,230,0.6);
          background: rgba(0,0,0,0.4); border-radius: 6px; padding: 5px 12px; max-width: 340px; margin: 0 auto;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .dash-icons { display: flex; gap: 10px; opacity: 0.4; font-size: 12px; }

        .dash-tabs {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 18px; border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .dash-tabs .left { display: flex; }
        .dtab { padding: 12px 14px; font-size: 12.5px; color: rgba(243,236,230,0.45); font-weight: 500; position: relative; cursor: pointer; user-select: none; }
        .dtab.active { color: var(--ink); }
        .dtab.active::after { content: ""; position: absolute; left: 14px; right: 14px; bottom: -1px; height: 2px; background: var(--ember); border-radius: 2px; }
        .avatar { display: flex; align-items: center; gap: 8px; font-size: 12px; color: rgba(243,236,230,0.6); }
        .avatar .dot { width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg,#7c5cfc,#f59e0b); }

        .dash-body { padding: 22px 22px 0; height: calc(100% - 85px); overflow-y: auto; }
        .segments { display: flex; gap: 22px; align-items: baseline; margin-bottom: 18px; }
        .seg { font-family: var(--serif); font-size: 24px; color: rgba(243,236,230,0.35); cursor: pointer; user-select: none; }
        .seg.active { color: var(--ink); font-weight: 500; }

        .cards-row { display: grid; grid-template-columns: 1.15fr 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        .card { background: var(--panel); border: 1px solid var(--panel-border); border-radius: 12px; padding: 16px; }
        .card h4 { font-size: 12px; font-weight: 500; color: rgba(243,236,230,0.75); margin-bottom: 12px; }
        .big-num { font-family: var(--serif); font-size: 24px; color: var(--ink); }
        .big-num small { color: rgba(243,236,230,0.4); font-size: 16px; }
        .chip { display: inline-block; margin-top: 8px; background: rgba(124,92,252,0.2); color: #c084fc; font-size: 10.5px; padding: 3px 8px; border-radius: 5px; }
        .chip-sub { font-size: 10.5px; color: rgba(243,236,230,0.45); margin-left: 6px; }

        .spark { display: flex; align-items: flex-end; gap: 2px; height: 44px; margin-top: 14px; }
        .spark i { flex: 1; background: linear-gradient(180deg,rgba(124,92,252,0.7),rgba(124,92,252,0.15)); border-radius: 1px; }

        .stat-pair { display: flex; gap: 22px; }
        .stat-pair div p { font-size: 9.5px; color: rgba(243,236,230,0.4); margin-bottom: 4px; text-transform: uppercase; letter-spacing: .04em; }
        .stat-pair div b { font-size: 14px; font-weight: 500; }

        .dots-grid { display: grid; grid-template-columns: repeat(9,1fr); gap: 6px; margin-top: 14px; }
        .dots-grid span { width: 5px; height: 5px; border-radius: 50%; background: #38bdf8; display: block; margin: 0 auto; }

        .bars { display: flex; align-items: flex-end; gap: 8px; height: 44px; margin-top: 14px; }
        .bars i { flex: 1; background: rgba(255,255,255,0.2); border-radius: 2px; }
        .bars i.hi { background: linear-gradient(180deg,#c084fc,#7c5cfc); }

        .panels-row { display: grid; grid-template-columns: 1.2fr 1fr; gap: 14px; }
        .log-line { font-family: var(--mono); font-size: 10.5px; color: rgba(243,236,230,0.6); margin-top: 8px; display: flex; gap: 8px; }
        .log-line b { color: #f59e0b; font-weight: 500; }
        .done-badge { float: right; font-size: 10px; color: #22c55e; background: rgba(34,197,94,0.15); padding: 2px 6px; border-radius: 4px; }
        .traj-row { display: flex; justify-content: space-between; margin-top: 10px; }
        .traj-row div p { font-size: 9.5px; color: rgba(243,236,230,0.4); margin-bottom: 4px; text-transform: uppercase; }
        .traj-row div b { font-size: 13px; }

        @media (max-width: 760px) {
          .apogee-credit { padding: 18px 20px; font-size: 11px; }
          .stage-sticky { padding: 16px; }
          .frame { border-radius: 20px; height: 92vh; }
          .nav { padding: 16px 18px; }
          .brand { font-size: 16px; }
          .nav-links { display: none; }
          .btn-ghost { display: none; }
          .btn-solid { padding: 9px 16px; font-size: 12.5px; }
          .hero-sub { font-size: 13px; max-width: 280px; }
          .scene2-title { font-size: 20px; }
          .dash { width: 94%; height: 64%; }
          .dash-tabs .dtab:not(.active) { display: none; }
          .cards-row { grid-template-columns: 1fr; }
          .panels-row { grid-template-columns: 1fr; }
          .dash-body { padding: 14px 14px 0; overflow-y: auto; }
          .segments { gap: 14px; }
          .seg { font-size: 18px; }
        }
      `}</style>

      <div className="apogee-credit">
        <span>◆ SmartERP AI — Intelligent Demand Forecasting</span>
        <button
          onClick={replayAnimation}
          style={{
            background: "none",
            border: "none",
            color: "rgba(243,236,230,0.55)",
            fontSize: "12px",
            cursor: "pointer",
            pointerEvents: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          ⟲ Replay Launch
        </button>
      </div>

      <div className="stage-sticky">
        <div className="frame" id="frame">
          <nav className="nav">
            <div className="brand" onClick={onEnter}>
              <div className="brand-mark">
                <Zap size={18} className="text-slate-950 fill-slate-950" />
              </div>
              SmartERP AI
            </div>
            <div className="nav-links">
              <button onClick={onEnter}>
                Forecasting Lab <span className="chev">⌄</span>
              </button>
              <button onClick={onEnter}>Demand Engine</button>
              <button onClick={onEnter}>Safety Stock</button>
              <button onClick={onEnter}>ML Models</button>
            </div>
            <div className="nav-actions">
              <button className="btn-ghost" onClick={onEnter}>
                Sign In
              </button>
              <button className="btn-solid" onClick={onEnter}>
                Launch Dashboard
              </button>
            </div>
          </nav>

          {/* SCENE 1 */}
          <section className="scene1" id="scene1" ref={scene1Ref}>
            <div className="grain"></div>
            <div className="mountains"></div>
            <div className="rocket-rig">
              <div className="beam"></div>
              <div className="rocket">
                <div className="rocket-nose"></div>
                <div className="rocket-body"></div>
                <div className="rocket-fin-left"></div>
                <div className="rocket-fin-right"></div>
                <div className="rocket-flame"></div>
              </div>
            </div>
            <div className="hero-copy">
              <span className="pill">
                <span className="yc-badge">AI</span> Powered by{" "}
                <b>FastAPI & Scikit-Learn</b>
              </span>
              <h1 className="hero-title">
                <span>Predict 30-day demand</span>
                <span>optimize stock levels to</span>
                <span>eliminate stockouts</span>
              </h1>
              <p className="hero-sub">
                Full-stack inventory intelligence engine with on-the-fly ML
                model training, dynamic reorder points, and automated safety
                stock buffers.
              </p>
            </div>
          </section>

          <div className="sun" id="sun" ref={sunRef}></div>

          {/* SCENE 2 */}
          <section className="scene2" id="scene2" ref={scene2Ref}>
            <div className="scene2-copy" ref={copyRef}>
              <span className="pill">
                <span className="dot"></span> Real-Time ML Inference Stream
              </span>
              <h2 className="scene2-title">
                Master supply chain demand
                <br />
                with dynamic multi-model
                <br />
                forecasting intelligence
              </h2>
            </div>

            <div className="dash" ref={dashRef}>
              <div className="dash-bar">
                <div className="traffic">
                  <i></i>
                  <i></i>
                  <i></i>
                </div>
                <div className="dash-icons">⟨ ⟩</div>
                <div className="dash-url">🔒 smarterp.ai/dashboard</div>
                <div className="dash-icons">⇩ ⇧ ＋ ⧉</div>
              </div>

              <div className="dash-tabs">
                <div className="left">
                  {[
                    "Dashboard",
                    "Inventory",
                    "Forecasting Lab",
                    "Orders",
                    "Vendors",
                  ].map((tab) => (
                    <div
                      key={tab}
                      className={`dtab ${activeTab === tab ? "active" : ""}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab === "Dashboard" && "▤ "}
                      {tab === "Inventory" && "▥ "}
                      {tab === "Forecasting Lab" && "⟲ "}
                      {tab === "Orders" && "📈 "}
                      {tab === "Vendors" && "⚙ "}
                      {tab}
                    </div>
                  ))}
                </div>
                <div className="avatar">
                  <span className="dot"></span> Store Manager
                </div>
              </div>

              <div className="dash-body">
                <div className="segments">
                  {["All SKUs", "Electronics", "Fast Movers"].map((seg) => (
                    <div
                      key={seg}
                      className={`seg ${activeSeg === seg ? "active" : ""}`}
                      onClick={() => setActiveSeg(seg)}
                    >
                      {seg}
                    </div>
                  ))}
                </div>

                <div className="cards-row">
                  <div className="card">
                    <h4>30-Day Demand Forecast</h4>
                    <div className="big-num">
                      142,058 <small>units</small>
                    </div>
                    <span className="chip">+18.4%</span>
                    <span className="chip-sub">
                      vs historical 60-day baseline
                    </span>
                    <div className="spark">
                      {sparkVals.map((v, idx) => (
                        <i key={idx} style={{ height: `${v}%` }} />
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <h4>Inventory Safety & AQI</h4>
                    <div className="stat-pair">
                      <div>
                        <p>Monitored SKUs</p>
                        <b>1,248</b>
                      </div>
                      <div>
                        <p>Stockout Prevention</p>
                        <b>99.4%</b>
                      </div>
                    </div>
                    <div className="dots-grid">
                      {dotPattern.map((o, idx) => (
                        <span key={idx} style={{ opacity: o }} />
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <h4>Reorder Point (ROP) & Accuracy</h4>
                    <div className="stat-pair">
                      <div>
                        <p>Avg Lead Time</p>
                        <b>4.2 Days</b>
                      </div>
                      <div>
                        <p>ML Accuracy (R²)</p>
                        <b>96.8%</b>
                      </div>
                    </div>
                    <div className="bars">
                      {barVals.map((v, idx) => (
                        <i
                          key={idx}
                          style={{ height: `${v}%` }}
                          className={v === 100 ? "hi" : ""}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="panels-row">
                  <div className="card">
                    <h4>
                      Real-Time ML Inference Log{" "}
                      <span className="done-badge">OPTIMIZED</span>
                    </h4>
                    <div className="log-line">
                      <b>[SYS]</b> Zero-filling continuous 60-day sales
                      history...
                    </div>
                    <div className="log-line">
                      <b>[ML]</b> Fitting XGBoost & Prophet on FastAPI. Latency:
                      0.08ms
                    </div>
                  </div>

                  <div className="card">
                    <h4>Supply Chain Metrics</h4>
                    <div className="traj-row">
                      <div>
                        <p>Stockout Risk</p>
                        <b>0.02%</b>
                      </div>
                      <div>
                        <p>Safety Stock Buffer</p>
                        <b>4,850 units</b>
                      </div>
                      <div>
                        <p>Confidence Score</p>
                        <b>99.2%</b>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
