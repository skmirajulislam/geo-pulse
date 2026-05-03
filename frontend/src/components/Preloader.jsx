import React, { useEffect, useRef, useState } from 'react';
import defaultVideo from './harry.mp4';
import { motion, AnimatePresence } from 'framer-motion';

/* ── HP icon SVG paths (brooms, hats, wands, stars, 9¾) ── */
const HP_ICONS = [
  // Witch hat
  { id: 'hat', path: 'M12 2L4 18h16L12 2zm0 4l5 10H7l5-10z', vb: '0 0 24 24' },
  // Broom
  { id: 'broom', path: 'M3 21l12-12M9 9l3-3 6 6-3 3M15 3l6 6', vb: '0 0 24 24', stroke: true },
  // Star / sparkle
  { id: 'star', path: 'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z', vb: '0 0 24 24' },
  // Lightning bolt
  { id: 'bolt', path: 'M13 2L4.5 13.5H11L9 22l10.5-13H13L13 2z', vb: '0 0 24 24' },
  // Potion/cauldron
  { id: 'pot', path: 'M6 8h12l-1 10H7L6 8zm3-4h6M9 4c0-1 1-2 3-2s3 1 3 2', vb: '0 0 24 24', stroke: true },
  // Wand
  { id: 'wand', path: 'M3 21l15-15M16 4l4 4-2 2-4-4 2-2zM6 14l4 4', vb: '0 0 24 24', stroke: true },
  // Snitch / winged ball
  { id: 'snitch', path: 'M12 10a2 2 0 100 4 2 2 0 000-4zM5 12c0-1.5 2-4 7-4M19 12c0-1.5-2-4-7-4M3 9l3 3M21 9l-3 3', vb: '0 0 24 24', stroke: true },
  // Feather / quill
  { id: 'quill', path: 'M20 4C12 4 5 12 4 20c4-2 8-6 8-6s-1 4-4 6c8-1 12-8 12-16z', vb: '0 0 24 24' },
];

/* deterministic positions so they don't jump on re-render */
const TILE_POSITIONS = Array.from({ length: 48 }, (_, i) => {
  const col = i % 8;
  const row = Math.floor(i / 8);
  return {
    x: col * 12.5 + (row % 2 === 0 ? 0 : 6.25),
    y: row * 16.66,
    icon: HP_ICONS[i % HP_ICONS.length],
    rotate: [-20, -10, 0, 10, 20, 30, -30, 15][i % 8],
    opacity: [0.06, 0.09, 0.07, 0.08, 0.05, 0.10, 0.06, 0.08][i % 8],
    scale: [0.8, 1, 0.9, 1.1, 0.85, 1.05, 0.95, 0.9][i % 8],
  };
});

/* floating particle sparkles */
const SPARKLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: `${5 + (i * 17.3) % 90}%`,
  y: `${5 + (i * 23.7) % 90}%`,
  size: 1 + (i % 3),
  delay: (i * 0.37) % 4,
  dur: 2.5 + (i % 3) * 0.8,
}));

/* loading messages that cycle */
const LOADING_MSGS = [
  'Consulting the Marauder\'s Map…',
  'Brewing the intelligence potion…',
  'Owling the data servers…',
  'Unlocking the Chamber of Feeds…',
  'Accio global intelligence…',
  'Casting Alohomora on the API…',
  'GeoPulse is awakening…',
  'Syncing global event streams…',
];

export default function Preloader({ videoSrc = defaultVideo }) {
  const videoRef  = useRef(null);
  const [msgIdx, setMsgIdx]     = useState(0);
  const [progress, setProgress] = useState(0);

  /* cycle loading messages */
  useEffect(() => {
    const id = setInterval(() => setMsgIdx(p => (p + 1) % LOADING_MSGS.length), 2200);
    return () => clearInterval(id);
  }, []);

  /* fake progress bar */
  useEffect(() => {
    let p = 0;
    const id = setInterval(() => {
      p += Math.random() * 4 + 0.5;
      if (p >= 99) { clearInterval(id); p = 99; }
      setProgress(Math.min(p, 99));
    }, 180);
    return () => clearInterval(id);
  }, []);

  /* autoplay video */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
  }, []);

  return (
    <div
      data-testid="loading-screen"
      style={{
        position: 'fixed', inset: 0, overflow: 'hidden',
        backgroundColor: '#F5EDDA',    /* parchment base */
        fontFamily: "'Georgia', 'Palatino Linotype', serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IM+Fell+English:ital@0;1&display=swap');

        @keyframes hp-float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes hp-spin   { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes hp-twinkle{ 0%,100%{opacity:0;transform:scale(0.5)} 50%{opacity:1;transform:scale(1)} }
        @keyframes hp-pulse  { 0%,100%{box-shadow:0 0 18px 4px rgba(139,90,43,0.25)} 50%{box-shadow:0 0 36px 12px rgba(139,90,43,0.5)} }
        @keyframes hp-vignette-in { from{opacity:0} to{opacity:1} }
        @keyframes hp-msg    { 0%{opacity:0;transform:translateY(6px)} 15%,85%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-6px)} }
        @keyframes hp-bar    { from{width:0} }
        @keyframes hp-orb-border { 0%,100%{border-color:rgba(139,90,43,0.6)} 50%{border-color:rgba(212,175,55,0.9)} }

        .hp-icon-tile { transition: opacity 0.3s; }
        .hp-icon-tile:hover { opacity: 0.2 !important; }
      `}</style>

      {/* ── PARCHMENT TEXTURE OVERLAY ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `
          radial-gradient(ellipse at 20% 30%, rgba(180,140,80,0.12) 0%, transparent 55%),
          radial-gradient(ellipse at 80% 70%, rgba(160,120,60,0.10) 0%, transparent 55%),
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")
        `,
        backgroundSize: 'cover, cover, 300px 300px',
      }} />

      {/* ── VIGNETTE ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'radial-gradient(ellipse at center, transparent 35%, rgba(80,50,20,0.55) 100%)',
        animation: 'hp-vignette-in 1.2s ease forwards',
      }} />

      {/* ── HP ICON TILED BACKGROUND ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, overflow: 'hidden' }}>
        {TILE_POSITIONS.map((t, i) => (
          <div
            key={i}
            className="hp-icon-tile"
            style={{
              position: 'absolute',
              left: `${t.x}%`,
              top:  `${t.y}%`,
              opacity: t.opacity,
              transform: `rotate(${t.rotate}deg) scale(${t.scale})`,
              width: 32, height: 32,
            }}
          >
            <svg viewBox={t.icon.vb} width="32" height="32" fill={t.icon.stroke ? 'none' : '#1a0e00'} stroke={t.icon.stroke ? '#1a0e00' : 'none'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={t.icon.path} />
            </svg>
          </div>
        ))}
      </div>

      {/* ── FLOATING SPARKLES ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
        {SPARKLES.map(s => (
          <div
            key={s.id}
            style={{
              position: 'absolute',
              left: s.x, top: s.y,
              width: s.size * 3, height: s.size * 3,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #D4AF37 0%, transparent 70%)',
              animation: `hp-twinkle ${s.dur}s ${s.delay}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      {/* ── CENTER CONTAINER ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 28,
      }}>

        {/* ── TITLE ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          style={{ textAlign: 'center' }}
        >
          <div style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 11, letterSpacing: '0.45em', textTransform: 'uppercase',
            color: '#6B4B1E', marginBottom: 6, opacity: 0.7,
          }}>
            GeoPulse
          </div>
          <div style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 28, fontWeight: 700, letterSpacing: '0.1em',
            color: '#1a0e00',
            textShadow: '0 2px 12px rgba(212,175,55,0.3)',
          }}>
            Global Intelligence
          </div>
          <div style={{
            fontFamily: "'IM Fell English', serif",
            fontStyle: 'italic', fontSize: 13,
            color: '#8B5E2A', marginTop: 4, letterSpacing: '0.05em',
          }}>
            — Intelligence beyond the Muggle world —
          </div>
        </motion.div>

        {/* ── VIDEO ORB ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          style={{
            position: 'relative',
            width: 280, height: 280,
          }}
        >
          {/* Outer glow rings */}
          <div style={{
            position: 'absolute', inset: -16,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)',
            animation: 'hp-float 3.5s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', inset: -8,
            borderRadius: '50%',
            border: '1px solid rgba(212,175,55,0.25)',
            animation: 'hp-spin 12s linear infinite',
          }} />
          <div style={{
            position: 'absolute', inset: -4,
            borderRadius: '50%',
            border: '1px dashed rgba(139,90,43,0.3)',
            animation: 'hp-spin 8s linear infinite reverse',
          }} />

          {/* Main orb frame */}
          <div style={{
            position: 'relative',
            width: '100%', height: '100%',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid rgba(139,90,43,0.7)',
            boxShadow: '0 0 0 1px rgba(212,175,55,0.4), inset 0 0 30px rgba(0,0,0,0.4), 0 8px 40px rgba(80,40,10,0.5)',
            animation: 'hp-pulse 3s ease-in-out infinite, hp-orb-border 4s ease-in-out infinite',
            background: '#0a0805',
          }}>
            {/* Video element */}
            <video
              ref={videoRef}
              src={videoSrc}
              loop
              muted
              playsInline
              autoPlay
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover',
                borderRadius: '50%',
              }}
            />

            {/* Orb sheen overlay */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)',
              pointerEvents: 'none',
            }} />
          </div>

          {/* Corner rune decorations */}
          {[0, 90, 180, 270].map(deg => (
            <div
              key={deg}
              style={{
                position: 'absolute', top: '50%', left: '50%',
                width: 12, height: 12,
                marginTop: -6, marginLeft: -6,
                transform: `rotate(${deg}deg) translateY(-155px)`,
                fontFamily: "'Cinzel', serif",
                fontSize: 10, color: 'rgba(139,90,43,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✦
            </div>
          ))}
        </motion.div>

        {/* ── LOADING MESSAGE ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ textAlign: 'center', width: 320 }}
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIdx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              style={{
                fontFamily: "'IM Fell English', serif",
                fontStyle: 'italic', fontSize: 14,
                color: '#6B4B1E', letterSpacing: '0.03em',
                height: 22,
              }}
            >
              {LOADING_MSGS[msgIdx]}
            </motion.p>
          </AnimatePresence>

          {/* Progress bar */}
          <div style={{
            marginTop: 14,
            width: 260, height: 3,
            background: 'rgba(139,90,43,0.18)',
            borderRadius: 2, margin: '14px auto 0',
            overflow: 'hidden',
            border: '1px solid rgba(139,90,43,0.2)',
          }}>
            <motion.div
              style={{
                height: '100%', borderRadius: 2,
                background: 'linear-gradient(90deg, #8B5E2A, #D4AF37, #8B5E2A)',
                backgroundSize: '200% 100%',
                animation: 'hp-spin 2s linear infinite',
              }}
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'easeOut', duration: 0.3 }}
            />
          </div>

          <div style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 9, letterSpacing: '0.3em',
            color: 'rgba(107,75,30,0.5)', marginTop: 8,
            textTransform: 'uppercase',
          }}>
            {Math.floor(progress)}%
          </div>
        </motion.div>

        {/* ── 9¾ BADGE ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 10, letterSpacing: '0.2em',
            color: 'rgba(107,75,30,0.4)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <span style={{ fontSize: 14, opacity: 0.5 }}>⚡</span>
          ⚡ GeoPulse · Real-Time Global Intelligence ⚡
          <span style={{ fontSize: 14, opacity: 0.5 }}>⚡</span>
        </motion.div>
      </div>

      {/* ── CORNER ORNAMENTS ── */}
      {[
        { top: 16, left: 20 }, { top: 16, right: 20 },
        { bottom: 16, left: 20 }, { bottom: 16, right: 20 },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', ...pos, zIndex: 5,
            fontFamily: "'Cinzel', serif", fontSize: 22,
            color: 'rgba(107,75,30,0.2)',
            transform: i === 1 ? 'scaleX(-1)' : i === 2 ? 'scaleY(-1)' : i === 3 ? 'scale(-1,-1)' : 'none',
          }}
        >
          ❧
        </div>
      ))}
    </div>
  );
}
