import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Bot, Mail, Loader2, Lock } from 'lucide-react';

// ── CSS-Animated Solar System Background (no WebGL, no z-index issues) ──
function SpaceBackground() {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Generate static stars once
    const stars = Array.from({ length: 300 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.5 + 0.3,
      alpha: Math.random(),
      pulse: Math.random() * Math.PI * 2,
    }));

    // Planets config: orbit radius, speed, size, color, has ring
    const planets = [
      { orbit: 120, speed: 0.8,  size: 8,  color: '#a78bfa', ring: false, phase: 0 },       // purple small
      { orbit: 200, speed: 0.45, size: 14, color: '#60a5fa', ring: false, phase: 1.2 },      // blue medium
      { orbit: 290, speed: 0.25, size: 10, color: '#f97316', ring: false, phase: 2.5 },      // orange
      { orbit: 370, speed: 0.15, size: 20, color: '#fde68a', ring: true,  phase: 0.8 },      // yellow giant with ring
      { orbit: 460, speed: 0.09, size: 12, color: '#34d399', ring: false, phase: 3.1 },      // teal
      { orbit: 540, speed: 0.05, size: 9,  color: '#fb7185', ring: false, phase: 1.7 },      // red/pink
    ];

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      t += 0.008;

      // Deep space background
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, W, H);

      // Nebula glow (subtle)
      const neb = ctx.createRadialGradient(W * 0.65, H * 0.3, 0, W * 0.65, H * 0.3, 350);
      neb.addColorStop(0, 'rgba(88, 28, 135, 0.15)');
      neb.addColorStop(1, 'transparent');
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, W, H);

      const neb2 = ctx.createRadialGradient(W * 0.2, H * 0.7, 0, W * 0.2, H * 0.7, 250);
      neb2.addColorStop(0, 'rgba(6, 78, 135, 0.18)');
      neb2.addColorStop(1, 'transparent');
      ctx.fillStyle = neb2;
      ctx.fillRect(0, 0, W, H);

      // Stars
      stars.forEach(s => {
        const tw = Math.sin(t * 2 + s.pulse) * 0.4 + 0.6;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha * tw})`;
        ctx.fill();
      });

      // Center of solar system (offset so it peeks from left side)
      const cx = W * 0.18;
      const cy = H * 0.5;

      // Sun glow
      const sunGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80);
      sunGlow.addColorStop(0, 'rgba(255, 200, 50, 0.9)');
      sunGlow.addColorStop(0.2, 'rgba(255, 140, 0, 0.6)');
      sunGlow.addColorStop(0.5, 'rgba(255, 100, 0, 0.2)');
      sunGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, 80, 0, Math.PI * 2);
      ctx.fill();

      // Sun core
      const sunCore = ctx.createRadialGradient(cx - 6, cy - 6, 0, cx, cy, 30);
      sunCore.addColorStop(0, '#fff9c4');
      sunCore.addColorStop(0.5, '#fbbf24');
      sunCore.addColorStop(1, '#f97316');
      ctx.fillStyle = sunCore;
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.fill();

      // Orbit paths
      planets.forEach(p => {
        ctx.beginPath();
        ctx.ellipse(cx, cy, p.orbit, p.orbit * 0.35, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Draw planets
      planets.forEach(p => {
        const angle = t * p.speed + p.phase;
        const px = cx + Math.cos(angle) * p.orbit;
        const py = cy + Math.sin(angle) * p.orbit * 0.35;

        // Planet glow
        const glow = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2.5);
        glow.addColorStop(0, p.color + '55');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, p.size * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Ring (for gas giant)
        if (p.ring) {
          ctx.save();
          ctx.translate(px, py);
          ctx.scale(1, 0.3);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 2.2, p.size * 2.2, 0, 0, Math.PI * 2);
          ctx.strokeStyle = p.color + '90';
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.restore();
        }

        // Planet body
        const grad = ctx.createRadialGradient(px - p.size * 0.3, py - p.size * 0.3, 0, px, py, p.size);
        grad.addColorStop(0, '#ffffff44');
        grad.addColorStop(0.4, p.color);
        grad.addColorStop(1, p.color + '88');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Moon for the blue planet
        if (p.orbit === 200) {
          const ma = angle * 4;
          const mx = px + Math.cos(ma) * 25;
          const my = py + Math.sin(ma) * 8;
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.arc(mx, my, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100vh',
        zIndex: 0, display: 'block',
        pointerEvents: 'none',
      }}
    />
  );
}

export default function Login({ setSession }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setSession(session);
        try {
          await fetch('http://localhost:3001/api/users/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: session.user.email })
          });
        } catch (e) {
          console.error('Failed to sync user', e);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [setSession]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    let { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error && error.message.includes('Invalid login')) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      error = signUpError;
    }
    
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Authentication successful!', 'success');
    }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#020617' }}>
      {/* Animated Space Canvas */}
      <SpaceBackground />

      {toast && (
        <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <div style={{
            padding: '10px 24px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600,
            background: toast.type === 'error' ? 'rgba(127,29,29,0.95)' : 'rgba(6,78,59,0.95)',
            border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#22c55e'}`,
            color: toast.type === 'error' ? '#fca5a5' : '#86efac',
            backdropFilter: 'blur(8px)',
          }}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* Glassmorphism Login Card */}
      <div
        style={{
          position: 'relative', zIndex: 10,
          width: '100%', maxWidth: 420,
          padding: '40px 36px',
          borderRadius: 24,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          boxShadow: '0 8px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Logo / Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, boxShadow: '0 0 24px rgba(59, 130, 246, 0.4)',
          }}>
            <Bot size={26} color="#fff" />
          </div>
          <h1 style={{
            color: '#f1f5f9', fontSize: '1.6rem', fontWeight: 800,
            letterSpacing: '-0.02em', margin: 0,
            textShadow: '0 0 20px rgba(59,130,246,0.5)',
          }}>
            OriginHMI Enterprise
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 6, textAlign: 'center' }}>
            Secure access to your warehouse control center
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Email */}
          <div style={{ position: 'relative' }}>
            <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="operator@originhmi.com"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(71,85,105,0.5)',
                color: '#f1f5f9', borderRadius: 10, padding: '12px 14px 12px 40px',
                fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.2s',
                fontFamily: 'inherit',
              }}
              onFocus={e => e.target.style.borderColor = '#3b82f6'}
              onBlur={e => e.target.style.borderColor = 'rgba(71,85,105,0.5)'}
            />
          </div>

          {/* Password */}
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Secure Password"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(71,85,105,0.5)',
                color: '#f1f5f9', borderRadius: 10, padding: '12px 14px 12px 40px',
                fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.2s',
                fontFamily: 'inherit',
              }}
              onFocus={e => e.target.style.borderColor = '#3b82f6'}
              onBlur={e => e.target.style.borderColor = 'rgba(71,85,105,0.5)'}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6, width: '100%', padding: '13px',
              borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #3b82f6, #7c3aed)',
              color: '#fff', fontWeight: 700, fontSize: '0.95rem',
              boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => !loading && (e.currentTarget.style.boxShadow = '0 6px 28px rgba(59,130,246,0.55)')}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,130,246,0.35)'}
          >
            {loading ? (
              <>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                Authenticating...
              </>
            ) : (
              '🚀 Secure Login'
            )}
          </button>
        </form>

        <p style={{ color: '#334155', fontSize: '0.72rem', textAlign: 'center', marginTop: 24 }}>
          OriginHMI Enterprise Security Architecture
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}