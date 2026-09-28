import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import Matter from 'matter-js';
import { countries, Country, getFlagUrl } from '@/data/countries_complete';
import { SimpleWinnerCelebration } from './SimpleWinnerCelebration';
import { playCollisionSound, playEliminationSound, playVictorySound, initAudio } from '@/lib/audio/sounds';

interface FlagBody extends Matter.Body {
  country?: Country;
  isEliminated?: boolean;
}

interface EscapingFlag {
  country: Country;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  scale: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
}

export const FlagEliminationBattleGame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const animationFrameRef = useRef<number>();
  const arenaAngleRef = useRef(0);
  const wallsRef = useRef<{ body: Matter.Body; baseAngle: number; baseDist: number }[]>([]);
  const flagBodiesRef = useRef<FlagBody[]>([]);
  const escapingFlagsRef = useRef<EscapingFlag[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const lastSoundTimeRef = useRef<number>(0);
  const imagesMapRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Game state
  const [totalFlags, setTotalFlags] = useState<number>(100);
  const [activeFlags, setActiveFlags] = useState<Country[]>([]);
  const [eliminatedFlags, setEliminatedFlags] = useState<Country[]>([]);
  const [winner, setWinner] = useState<Country | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [rotationSpeedMultiplier, setRotationSpeedMultiplier] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [lastEliminated, setLastEliminated] = useState<{ country: Country; rank: number } | null>(null);

  const [gamePhase, setGamePhase] = useState<'setup' | 'countdown' | 'playing' | 'ended'>('setup');
  const [countdown, setCountdown] = useState<number>(3);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [gameInfo, setGameInfo] = useState<string>('');
  const selectedCountryRef = useRef(selectedCountry);
  useEffect(() => { selectedCountryRef.current = selectedCountry; }, [selectedCountry]);

  const [prediction2, setPrediction2] = useState<string>('');
  const [prediction3, setPrediction3] = useState<string>('');
  const [championEliminatedRank, setChampionEliminatedRank] = useState<number | null>(null);
  const [boosts, setBoosts] = useState<number>(3);
  const [battleHistory, setBattleHistory] = useState<{winner: string, date: string}[]>([]);

  // Synchronized refs for game loop
  const isPausedRef = useRef(false);
  const isRunningRef = useRef(false);
  const simSpeedRef = useRef(1);
  const rotationSpeedRef = useRef(0.007);
  const isMutedRef = useRef(false);

  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { simSpeedRef.current = simSpeed; }, [simSpeed]);
  useEffect(() => { rotationSpeedRef.current = 0.007 * rotationSpeedMultiplier; }, [rotationSpeedMultiplier]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  const GAP_SIZE = Math.PI * 0.22; // ~40 degrees gap opening
  const BASE_GAP_ANGLE = -Math.PI / 2; // Gap starts at top

  // Preload flag images
  useEffect(() => {
    countries.forEach(c => {
      if (!imagesMapRef.current.has(c.code)) {
        const img = new Image();
        img.src = getFlagUrl(c.code);
        imagesMapRef.current.set(c.code, img);
      }
    });
  }, []);

  // Initialize audio on user interaction
  useEffect(() => {
    const handleInit = () => initAudio();
    window.addEventListener('click', handleInit, { once: true });
    window.addEventListener('touchstart', handleInit, { once: true });
    return () => {
      window.removeEventListener('click', handleInit);
      window.removeEventListener('touchstart', handleInit);
    };
  }, []);

  // Auto-replenish boosts & load history
  useEffect(() => {
    if (gamePhase === 'setup') {
      try {
        const hist = JSON.parse(localStorage.getItem('flag_royale_history') || '[]');
        setBattleHistory(hist);
      } catch (e) {}
    }
    if (gamePhase !== 'playing') return;
    const interval = setInterval(() => setBoosts(b => Math.min(3, b + 1)), 5000);
    return () => clearInterval(interval);
  }, [gamePhase]);

  const getArenaDimensions = useCallback(() => {
    if (!containerRef.current) return null;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    const cx = w / 2;
    // Leave room for top and bottom HUD
    const cy = h / 2 - 10;
    // Radius fits comfortably on mobile and desktop
    const r = Math.min(w * 0.44, h * 0.38, 290);
    return { w, h, cx, cy, r };
  }, []);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    if (engineRef.current) {
      Matter.Composite.clear(engineRef.current.world, false);
      Matter.Engine.clear(engineRef.current);
      engineRef.current = null;
    }
    wallsRef.current = [];
    flagBodiesRef.current = [];
    escapingFlagsRef.current = [];
    sparksRef.current = [];
  }, []);

  const initGame = useCallback((flagCount: number = totalFlags) => {
    cleanup();

    const dims = getArenaDimensions();
    if (!dims) return;
    const { w, h, cx, cy, r } = dims;

    // Create zero-gravity Matter.js physics engine
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
      enableSleeping: false,
    });
    engineRef.current = engine;

    // Build arena boundary wall segments (circular ring with opening gap)
    const segCount = 44;
    const totalArc = (2 * Math.PI) - GAP_SIZE;
    const segArc = totalArc / segCount;
    const startAngle = BASE_GAP_ANGLE + GAP_SIZE / 2;
    const wallThickness = 12;
    const walls: typeof wallsRef.current = [];

    for (let i = 0; i < segCount; i++) {
      const a1 = startAngle + i * segArc;
      const a2 = startAngle + (i + 1) * segArc;
      const mid = (a1 + a2) / 2;
      const len = 2 * r * Math.sin(segArc / 2) + 3;

      const seg = Matter.Bodies.rectangle(
        cx + r * Math.cos(mid),
        cy + r * Math.sin(mid),
        len,
        wallThickness,
        {
          isStatic: true,
          angle: mid,
          friction: 0,
          restitution: 0.95,
          label: 'wall',
          collisionFilter: { category: 0x0002, mask: 0x0001 }
        }
      );
      walls.push({ body: seg, baseAngle: mid, baseDist: r });
      Matter.Composite.add(engine.world, seg);
    }
    wallsRef.current = walls;

    // Select random countries
    const selected = [...countries].sort(() => Math.random() - 0.5).slice(0, flagCount);
    // Flag radius scaled nicely
    const flagRadius = Math.max(10, Math.min(13.5, r / 19));
    const flagBodies: FlagBody[] = [];

    selected.forEach((country, idx) => {
      // Golden spiral distribution inside arena
      const phi = idx * 2.399963; // Golden angle
      const dist = Math.sqrt((idx + 0.5) / flagCount) * (r * 0.76);
      const x = cx + dist * Math.cos(phi);
      const y = cy + dist * Math.sin(phi);

      const body = Matter.Bodies.circle(x, y, flagRadius, {
        friction: 0,
        frictionAir: 0.0006,
        restitution: 0.92,
        density: 0.001,
        inertia: Infinity,
        label: 'flag',
        collisionFilter: { category: 0x0001, mask: 0x0003 }
      }) as FlagBody;

      body.country = country;
      body.isEliminated = false;

      // Random dynamic initial velocity
      const speed = 2.2 + Math.random() * 2.8;
      const angle = Math.random() * Math.PI * 2;
      Matter.Body.setVelocity(body, {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed
      });

      flagBodies.push(body);
    });

    flagBodiesRef.current = flagBodies;
    Matter.Composite.add(engine.world, flagBodies as Matter.Body[]);

    // Collision sound & bounce physics
    Matter.Events.on(engine, 'collisionStart', (event) => {
      const now = performance.now();
      if (!isMutedRef.current && now - lastSoundTimeRef.current > 70) {
        let maxV = 0;
        event.pairs.forEach(pair => {
          const { bodyA, bodyB } = pair;
          const v = Matter.Vector.magnitude(Matter.Vector.sub(bodyA.velocity, bodyB.velocity));
          if (v > maxV) maxV = v;
        });
        if (maxV > 1.8) {
          lastSoundTimeRef.current = now;
          playCollisionSound(Math.min(1, maxV / 7));
        }
      }
    });

    // Speed limiter and energy maintainer
    Matter.Events.on(engine, 'beforeUpdate', () => {
      const flags = flagBodiesRef.current;
      flags.forEach(f => {
        if (f.isEliminated) return;
        const v = f.velocity;
        const speed = Math.hypot(v.x, v.y);

        // Keep maximum speed bounded to avoid tunneling
        const maxSpeed = 7.5;
        if (speed > maxSpeed) {
          Matter.Body.setVelocity(f, {
            x: (v.x / speed) * maxSpeed,
            y: (v.y / speed) * maxSpeed,
          });
        }
        // Keep minimum energy so balls never stop moving
        if (speed < 1.4) {
          const boost = 0.0004;
          const a = Math.random() * Math.PI * 2;
          Matter.Body.applyForce(f, f.position, {
            x: Math.cos(a) * boost,
            y: Math.sin(a) * boost,
          });
        }
      });
    });

    // Reset state
    setActiveFlags(selected);
    setEliminatedFlags([]);
    setWinner(null);
    setLastEliminated(null);
    setBoosts(3);
    arenaAngleRef.current = 0;

    // Start high-performance rendering & simulation loop
    startLoop(cx, cy, r, flagRadius);
  }, [cleanup, getArenaDimensions, totalFlags]);

  // Main Simulation & Canvas 2D Render Loop
  const startLoop = useCallback((cx: number, cy: number, r: number, flagRadius: number) => {
    let lastTime = performance.now();

    const loop = (now: number) => {
      if (!engineRef.current || !canvasRef.current) return;

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!isPausedRef.current && isRunningRef.current) {
        // Step physics based on simSpeed
        const subSteps = simSpeedRef.current <= 1 ? 1 : simSpeedRef.current <= 2 ? 2 : 3;
        const stepDelta = (1000 / 60) * (simSpeedRef.current / subSteps);

        for (let s = 0; s < subSteps; s++) {
          Matter.Engine.update(engineRef.current, stepDelta);

          // Dynamic Events (Chaos Mode - Phase 3)
          // Every ~15s, a 1s gravity storm pulls everything to the center
          const isGravityStorm = (now % 15000) < 1000;
          if (isGravityStorm) {
            const aliveCount = flagBodiesRef.current.filter(f => !f.isEliminated).length;
            if (aliveCount > 5) setGameInfo("🌪️ GRAVITY STORM 🌪️");
            flagBodiesRef.current.forEach(f => {
              if (f.isEliminated) return;
              const dirX = cx - f.position.x;
              const dirY = cy - f.position.y;
              const dist = Math.hypot(dirX, dirY) || 1;
              Matter.Body.applyForce(f, f.position, { x: (dirX / dist) * 0.0005, y: (dirY / dist) * 0.0005 });
            });
          } else if (now % 15000 >= 1000 && now % 15000 < 1500) {
            setGameInfo("");
          }

          // Rotate arena walls
          arenaAngleRef.current += (rotationSpeedRef.current * (simSpeedRef.current / subSteps));
          const curArenaAngle = arenaAngleRef.current;

          wallsRef.current.forEach(({ body, baseAngle, baseDist }) => {
            const ang = baseAngle + curArenaAngle;
            const nx = cx + baseDist * Math.cos(ang);
            const ny = cy + baseDist * Math.sin(ang);
            Matter.Body.setPosition(body, { x: nx, y: ny });
            Matter.Body.setAngle(body, ang);
          });

          // Check for gap escapes
          const currentGapAngle = BASE_GAP_ANGLE + curArenaAngle;
          const currentEliminated: Country[] = [];

          flagBodiesRef.current.forEach(flag => {
            if (flag.isEliminated || !flag.country) return;

            const dx = flag.position.x - cx;
            const dy = flag.position.y - cy;
            const dist = Math.hypot(dx, dy);

            // Flag reached outer wall boundary
            if (dist >= r - flagRadius * 0.95) {
              const flagAngle = Math.atan2(dy, dx);
              let angleDiff = flagAngle - currentGapAngle;
              // Normalize angle difference to [-PI, PI]
              angleDiff = ((angleDiff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

              // Check if inside the gap opening
              if (Math.abs(angleDiff) < (GAP_SIZE / 2) + 0.08) {
                // Moving outward through gap
                const radialVel = (dx * flag.velocity.x + dy * flag.velocity.y) / dist;
                if (radialVel > 0.3 || dist >= r + 5) {
                  flag.isEliminated = true;
                  // Remove from physics world immediately so it can't bounce back
                  Matter.Composite.remove(engineRef.current!.world, flag as Matter.Body);

                  // Trigger escape visual animation
                  const outDirX = dx / dist;
                  const outDirY = dy / dist;
                  escapingFlagsRef.current.push({
                    country: flag.country,
                    x: flag.position.x,
                    y: flag.position.y,
                    vx: outDirX * 5.5 + (Math.random() - 0.5) * 1.5,
                    vy: outDirY * 5.5 + (Math.random() - 0.5) * 1.5,
                    radius: flagRadius,
                    alpha: 1,
                    scale: 1,
                  });

                  // Add spark explosion at the gap
                  for (let i = 0; i < 14; i++) {
                    const sparkAngle = Math.random() * Math.PI * 2;
                    const sparkSpeed = 1.5 + Math.random() * 4;
                    sparksRef.current.push({
                      x: flag.position.x,
                      y: flag.position.y,
                      vx: Math.cos(sparkAngle) * sparkSpeed,
                      vy: Math.sin(sparkAngle) * sparkSpeed,
                      color: i % 2 === 0 ? '#ff3b30' : '#ff9500',
                      size: 2 + Math.random() * 3,
                      alpha: 1,
                      life: 1,
                    });
                  }

                  currentEliminated.push(flag.country);

                  if (!isMutedRef.current) {
                    playEliminationSound();
                  }
                }
              }
            }
          });

          if (currentEliminated.length > 0) {
            currentEliminated.forEach(c => {
              setActiveFlags(prev => {
                const next = prev.filter(item => item.code !== c.code);
                const rank = next.length + 1;
                setLastEliminated({ country: c, rank });
                if (c.code === selectedCountryRef.current && rank > 1) {
                  setChampionEliminatedRank(rank);
                }
                return next;
              });
              setEliminatedFlags(prev => [c, ...prev]);
            });
          }

          // Winner check
          const remaining = flagBodiesRef.current.filter(f => !f.isEliminated);
          if (remaining.length === 1 && remaining[0].country) {
            const champion = remaining[0].country;
            setWinner(champion);
            setIsRunning(false);
            setGamePhase('ended');
            
            // Save history
            try {
              const hist = JSON.parse(localStorage.getItem('flag_royale_history') || '[]');
              const newHist = [{ winner: champion.emoji + ' ' + champion.name, date: new Date().toLocaleTimeString() }, ...hist].slice(0, 5);
              localStorage.setItem('flag_royale_history', JSON.stringify(newHist));
            } catch (e) {}
            
            if (!isMutedRef.current) {
              playVictorySound();
            }
            return;
          }
        }
      }

      // Update escaping flags animation
      for (let i = escapingFlagsRef.current.length - 1; i >= 0; i--) {
        const ef = escapingFlagsRef.current[i];
        ef.x += ef.vx;
        ef.y += ef.vy;
        ef.alpha -= 0.025;
        ef.scale += 0.02;
        if (ef.alpha <= 0) {
          escapingFlagsRef.current.splice(i, 1);
        }
      }

      // Update sparks
      for (let i = sparksRef.current.length - 1; i >= 0; i--) {
        const sp = sparksRef.current[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.life -= 0.035;
        sp.alpha = Math.max(0, sp.life);
        if (sp.life <= 0) {
          sparksRef.current.splice(i, 1);
        }
      }

      // DRAW CANVAS FRAME
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Center arena background glow
        const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 1.35);
        glowGrad.addColorStop(0, 'rgba(30, 48, 88, 0.45)');
        glowGrad.addColorStop(0.7, 'rgba(15, 23, 42, 0.3)');
        glowGrad.addColorStop(1, 'rgba(10, 10, 26, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
        ctx.fill();

        // Arena floor circle
        ctx.beginPath();
        ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(14, 20, 36, 0.7)';
        ctx.fill();

        // Arena subtle concentric guide rings
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
        ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2);
        ctx.stroke();

        const currentGapAngle = BASE_GAP_ANGLE + arenaAngleRef.current;
        const gapStart = currentGapAngle - GAP_SIZE / 2;
        const gapEnd = currentGapAngle + GAP_SIZE / 2;

        // Draw Arena Circular Walls (with Neon Blue Glow)
        ctx.save();
        ctx.shadowColor = '#00b4d8';
        ctx.shadowBlur = 14;
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#38bdf8';

        ctx.beginPath();
        // Draw the circular wall arc from gapEnd to gapStart
        ctx.arc(cx, cy, r, gapEnd, gapStart, false);
        ctx.stroke();

        // Outer sleek neon accent ring
        ctx.shadowBlur = 24;
        ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.arc(cx, cy, r, gapEnd, gapStart, false);
        ctx.stroke();
        ctx.restore();

        // Draw the Danger Gap Opening with Pulsing Neon Hazard Glow
        ctx.save();
        const pulse = Math.sin(now * 0.008) * 0.3 + 0.7; // 0.4 to 1.0 pulse
        ctx.shadowColor = '#ff3366';
        ctx.shadowBlur = 18 * pulse;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(255, 45, 85, ${0.85 * pulse})`;

        ctx.beginPath();
        ctx.arc(cx, cy, r, gapStart, gapEnd, false);
        ctx.stroke();

        // Gap center danger beacon marker
        const gapMidX = cx + r * Math.cos(currentGapAngle);
        const gapMidY = cy + r * Math.sin(currentGapAngle);

        const beaconGrad = ctx.createRadialGradient(gapMidX, gapMidY, 2, gapMidX, gapMidY, 22);
        beaconGrad.addColorStop(0, `rgba(255, 70, 70, ${0.9 * pulse})`);
        beaconGrad.addColorStop(0.5, `rgba(255, 50, 50, ${0.4 * pulse})`);
        beaconGrad.addColorStop(1, 'rgba(255, 50, 50, 0)');
        ctx.fillStyle = beaconGrad;
        ctx.beginPath();
        ctx.arc(gapMidX, gapMidY, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

          // Draw Active Flags
          const flags = flagBodiesRef.current;
          
          // Phase 3B: Comeback Mechanics / Final Showdown text
          if (flags.filter(f => !f.isEliminated).length <= 5 && flags.filter(f => !f.isEliminated).length > 1) {
             ctx.save();
             ctx.font = '900 48px Inter';
             ctx.textAlign = 'center';
             ctx.fillStyle = 'rgba(255, 45, 85, 0.2)';
             ctx.fillText('FINAL ' + flags.filter(f => !f.isEliminated).length, cx, cy);
             ctx.restore();
          }

          for (let i = 0; i < flags.length; i++) {
            const f = flags[i];
            if (f.isEliminated || !f.country) continue;
            
            const isMyCountry = f.country.code === selectedCountry;

            const fx = f.position.x;
            const fy = f.position.y;

          ctx.save();
          ctx.translate(fx, fy);

          // Flag Ball Shadow
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 2;

          ctx.beginPath();
          ctx.arc(0, 0, flagRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#1e293b';
          ctx.fill();

          // Reset shadow for inner drawing
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;

          // Clip to circle for country flag
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, flagRadius, 0, Math.PI * 2);
          ctx.clip();

          const img = imagesMapRef.current.get(f.country.code);
          if (img && img.complete && img.naturalWidth > 0) {
            // Draw flag image covering circle
            const aspect = img.naturalWidth / img.naturalHeight || 1.5;
            const drawH = flagRadius * 2.1;
            const drawW = drawH * aspect;
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
          } else {
            // Fallback emoji or code
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-flagRadius, -flagRadius, flagRadius * 2, flagRadius * 2);
            ctx.font = `${flagRadius * 1.1}px 'Segoe UI Emoji', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(f.country.emoji || f.country.code, 0, 1);
          }

          // Glossy 3D top shine
          const shineGrad = ctx.createLinearGradient(0, -flagRadius, 0, flagRadius * 0.2);
          shineGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
          shineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = shineGrad;
          ctx.beginPath();
          ctx.arc(0, 0, flagRadius, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Smooth Crisp Border Ring
          ctx.beginPath();
          ctx.arc(0, 0, flagRadius, 0, Math.PI * 2);
          ctx.lineWidth = isMyCountry ? 3 : 1.6;
          ctx.strokeStyle = isMyCountry ? '#fbbf24' : 'rgba(255, 255, 255, 0.75)'; // Golden border for selected
          ctx.stroke();

          ctx.restore();
        }

        // Draw Escaping Flags (Animation effect as they shoot out)
        escapingFlagsRef.current.forEach(ef => {
          ctx.save();
          ctx.translate(ef.x, ef.y);
          ctx.globalAlpha = ef.alpha;

          // Red danger aura around escaping flag
          ctx.shadowColor = '#ff3366';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(0, 0, ef.radius * ef.scale, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 45, 85, 0.3)';
          ctx.fill();

          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, ef.radius * ef.scale, 0, Math.PI * 2);
          ctx.clip();

          const img = imagesMapRef.current.get(ef.country.code);
          if (img && img.complete && img.naturalWidth > 0) {
            const aspect = img.naturalWidth / img.naturalHeight || 1.5;
            const drawH = ef.radius * 2.1 * ef.scale;
            const drawW = drawH * aspect;
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
          } else {
            ctx.font = `${ef.radius * 1.1 * ef.scale}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(ef.country.emoji, 0, 1);
          }
          ctx.restore();

          ctx.beginPath();
          ctx.arc(0, 0, ef.radius * ef.scale, 0, Math.PI * 2);
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#ff3366';
          ctx.stroke();

          ctx.restore();
        });

        // Draw Sparks
        sparksRef.current.forEach(sp => {
          ctx.save();
          ctx.globalAlpha = sp.alpha;
          ctx.fillStyle = sp.color;
          ctx.shadowColor = sp.color;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  }, [GAP_SIZE]);

  // Handle window resizing & Canvas resolution
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const dims = getArenaDimensions();
      if (!dims) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      canvas.width = Math.floor(dims.w * dpr);
      canvas.height = Math.floor(dims.h * dpr);
      canvas.style.width = `${dims.w}px`;
      canvas.style.height = `${dims.h}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getArenaDimensions]);

  // Auto-start game on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      initGame(totalFlags);
      setIsRunning(true);
      setIsPaused(true); // Start paused in setup phase
    }, 200);
    return () => {
      clearTimeout(timer);
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  const handleRestart = useCallback(() => {
    setGamePhase('setup');
    initGame(totalFlags);
    setIsRunning(true);
    setIsPaused(true);
  }, [initGame, totalFlags]);

  const handleStartGame = () => {
    setGamePhase('countdown');
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timer);
          setGamePhase('playing');
          setIsPaused(false);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gamePhase !== 'playing' || boosts <= 0 || !canvasRef.current || !engineRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    
    // Map click to internal canvas coordinates
    const scaleX = (canvasRef.current.width / dpr) / rect.width;
    const scaleY = (canvasRef.current.height / dpr) / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Find clicked flag and apply boost
    for (const flag of flagBodiesRef.current) {
      if (flag.isEliminated) continue;
      const dx = flag.position.x - x;
      const dy = flag.position.y - y;
      
      if (Math.hypot(dx, dy) < 40) { // Generous hit radius
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const dirX = cx - flag.position.x;
        const dirY = cy - flag.position.y;
        const dist = Math.hypot(dirX, dirY) || 1;
        
        Matter.Body.applyForce(flag, flag.position, {
          x: (dirX / dist) * 0.08,
          y: (dirY / dist) * 0.08
        });
        
        // Add sparks for visual feedback
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          sparksRef.current.push({
            x: flag.position.x,
            y: flag.position.y,
            vx: Math.cos(angle) * 4,
            vy: Math.sin(angle) * 4,
            color: '#10b981', // Emerald green boost spark
            size: 3 + Math.random() * 2,
            alpha: 1,
            life: 1,
          });
        }
        setBoosts(b => b - 1);
        break;
      }
    }
  }, [gamePhase, boosts]);

  const handleFlagCountChange = (count: number) => {
    setTotalFlags(count);
    initGame(count);
  };

  // Recent eliminated countries list (latest on top)
  const recentEliminated = useMemo(() => eliminatedFlags.slice(0, 40), [eliminatedFlags]);

  // Dynamic background shift
  const aliveRatio = activeFlags.length / Math.max(1, activeFlags.length + eliminatedFlags.length);
  const bgColor = aliveRatio > 0.6 ? '#070814' : aliveRatio > 0.2 ? '#140807' : '#240404';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none flex flex-col justify-between transition-colors duration-1000"
      style={{ backgroundColor: bgColor, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Dynamic Ambient Background Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] rounded-full blur-[140px] opacity-35 transition-all duration-1000"
          style={{ 
            background: `radial-gradient(circle, ${
              aliveRatio > 0.6 ? '#1d4ed8 0%, #0369a1 40%' : 
              aliveRatio > 0.2 ? '#c2410c 0%, #9a3412 40%' : 
              '#be123c 0%, #881337 40%'
            }, transparent 70%)` 
          }}
        />
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[120px] opacity-20 transition-colors duration-1000"
          style={{ background: aliveRatio > 0.6 ? '#7c3aed' : '#ea580c' }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-[120px] opacity-20 transition-colors duration-1000"
          style={{ background: aliveRatio > 0.2 ? '#e11d48' : '#7f1d1d' }}
        />
      </div>

      {/* Main 2D Render Canvas */}
      <canvas ref={canvasRef} onClick={handleCanvasClick} className="absolute inset-0 z-0 block cursor-crosshair" />

      {/* TOP HUD BAR */}
      <header className="relative z-10 p-3 sm:p-4 pointer-events-none">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          {/* Left: Alive & Out Badges */}
          <div className="flex flex-col gap-2 pointer-events-auto w-48 sm:w-64">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <div className="flex-1 flex justify-center items-center gap-2 bg-[#121629]/85 backdrop-blur-md border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] rounded-full px-2 sm:px-3 py-1.5 sm:py-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-white font-extrabold text-base sm:text-lg tracking-tight">{activeFlags.length}</span>
              </div>

              <div className="flex-1 flex justify-center items-center gap-2 bg-[#121629]/85 backdrop-blur-md border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.15)] rounded-full px-2 sm:px-3 py-1.5 sm:py-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-white font-extrabold text-base sm:text-lg tracking-tight">{eliminatedFlags.length}</span>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="bg-[#121629]/80 backdrop-blur-md border border-white/10 rounded-full h-2 w-full overflow-hidden shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 transition-all duration-500 ease-out"
                style={{ width: `${(activeFlags.length / Math.max(1, activeFlags.length + eliminatedFlags.length)) * 100}%` }}
              />
            </div>
          </div>

          {/* Center: Title / Viral Logo */}
          <div className="hidden lg:flex items-center gap-2 bg-[#121629]/60 backdrop-blur-md border border-white/10 rounded-full px-5 py-2">
            <span className="text-lg">🏳️</span>
            <span className="text-white font-black text-sm tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">
              Flag Royale Arena
            </span>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
            {/* Boost Meter */}
            <div className="flex items-center gap-1 bg-[#121629]/85 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 mr-2">
              <span className="text-[10px] text-white/50 uppercase font-bold mr-1">Boosts</span>
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < boosts ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-white/10'}`} />
              ))}
            </div>

            {/* Speed Multiplier Pill */}
            <div className="flex items-center bg-[#121629]/85 backdrop-blur-md border border-white/10 rounded-full p-1 text-xs font-semibold">
              {[1, 2, 4].map(s => (
                <button
                  key={s}
                  onClick={() => setSimSpeed(s)}
                  className={`px-2.5 py-1 rounded-full transition-all ${simSpeed === s ? 'bg-blue-600 text-white shadow-sm' : 'text-white/50 hover:text-white'}`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Mute Button */}
            <button
              onClick={() => setIsMuted(prev => !prev)}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="w-9 h-9 flex items-center justify-center bg-[#121629]/85 backdrop-blur-md border border-white/10 hover:border-white/30 rounded-full text-white/80 hover:text-white transition-all text-sm"
            >
              {isMuted ? '🔇' : '🔊'}
            </button>

            {/* Pause / Play Button */}
            <button
              onClick={handlePause}
              className="bg-[#121629]/85 backdrop-blur-md border border-white/10 hover:border-white/30 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-all hover:bg-white/10"
            >
              {isPaused ? '▶ Play' : '⏸ Pause'}
            </button>

            {/* Restart Button */}
            <button
              onClick={handleRestart}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all transform active:scale-95"
            >
              ↻ New
            </button>
          </div>
        </div>
      </header>

      {/* Kill Feed */}
      {gamePhase === 'playing' && (
        <div className="absolute top-24 right-4 z-20 flex flex-col gap-1 w-48 pointer-events-none">
          {eliminatedFlags.slice(0, 5).map((flag, idx) => (
            <div key={`${flag.code}-${idx}`} className="bg-black/60 backdrop-blur-md border border-red-500/30 rounded-lg p-1.5 px-3 flex items-center gap-2 animate-in slide-in-from-right fade-in text-xs shadow-lg">
              <span className="text-red-400 font-bold uppercase w-8">OUT</span>
              <span className="text-xl">{flag.emoji}</span>
              <span className="text-white/80 font-semibold truncate">{flag.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Champion Eliminated Splash */}
      {championEliminatedRank && gamePhase === 'playing' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none animate-[ping_1s_ease-out_forwards] opacity-0">
          <div className="text-center">
            <h2 className="text-6xl md:text-8xl font-black text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]">CHAMPION ELIMINATED</h2>
            <p className="text-2xl text-white mt-4 font-bold">Placed #{championEliminatedRank}</p>
          </div>
        </div>
      )}

      {/* Gravity Storm / Game Info Indicator */}
      {gameInfo && gamePhase === 'playing' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none animate-pulse">
          <h2 className="text-4xl md:text-6xl font-black text-purple-400 drop-shadow-[0_0_30px_rgba(168,85,247,0.8)] uppercase tracking-widest">{gameInfo}</h2>
        </div>
      )}

      {/* SETUP PHASE OVERLAY */}
      {gamePhase === 'setup' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
          <div className="bg-[#121629] p-8 rounded-3xl border border-white/20 shadow-2xl max-w-md w-full text-center">
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-6">FLAG ROYALE</h1>
            
            <div className="mb-6 space-y-3">
              <label className="block text-white/70 font-medium text-sm text-left">Top 3 Predictions</label>
              <select 
                className="w-full bg-white/10 text-white border border-white/20 rounded-xl p-2.5 outline-none focus:border-blue-500"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
              >
                <option className="bg-slate-800 text-white" value="">#1 Pick (Your Champion)...</option>
                {countries.map(c => <option className="bg-slate-800 text-white" key={c.code} value={c.code}>{c.emoji} {c.name}</option>)}
              </select>
              <select 
                className="w-full bg-white/10 text-white border border-white/20 rounded-xl p-2.5 outline-none focus:border-blue-500"
                value={prediction2}
                onChange={(e) => setPrediction2(e.target.value)}
              >
                <option className="bg-slate-800 text-white" value="">#2 Pick...</option>
                {countries.map(c => <option className="bg-slate-800 text-white" key={c.code} value={c.code}>{c.emoji} {c.name}</option>)}
              </select>
              <select 
                className="w-full bg-white/10 text-white border border-white/20 rounded-xl p-2.5 outline-none focus:border-blue-500"
                value={prediction3}
                onChange={(e) => setPrediction3(e.target.value)}
              >
                <option className="bg-slate-800 text-white" value="">#3 Pick...</option>
                {countries.map(c => <option className="bg-slate-800 text-white" key={c.code} value={c.code}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
            
            <button 
              onClick={handleStartGame}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all mb-4"
            >
              START BATTLE
            </button>
            
            {battleHistory.length > 0 && (
              <div className="text-left bg-black/30 rounded-lg p-3 text-xs text-white/50">
                <div className="font-bold mb-1 uppercase tracking-wider text-white/70">Recent Winners</div>
                {battleHistory.map((h, i) => <div key={i}>{h.winner} <span className="float-right">{h.date}</span></div>)}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* COUNTDOWN OVERLAY */}
      {gamePhase === 'countdown' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="text-9xl font-black text-white animate-ping drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">
            {countdown}
          </div>
        </div>
      )}

      {/* ELIMINATION POPUP / LIVE TOAST */}
      {lastEliminated && (
        <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div
            className="flex items-center gap-2.5 bg-rose-950/85 backdrop-blur-md border border-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.4)] rounded-full px-5 py-2"
            style={{ animation: 'elimToast 1.4s ease-out forwards' }}
          >
            <span className="text-2xl">{lastEliminated.country.emoji}</span>
            <span className="text-white font-extrabold text-sm sm:text-base">{lastEliminated.country.name}</span>
            <span className="text-rose-400 font-bold text-xs uppercase bg-rose-900/60 px-2 py-0.5 rounded-full">
              #{lastEliminated.rank} OUT
            </span>
          </div>
        </div>
      )}

      {/* BOTTOM CONTROLS & ELIMINATED TRAY */}
      <footer className="relative z-10 pb-3 sm:pb-4 px-3 pointer-events-none">
        <div className="max-w-4xl mx-auto space-y-2 pointer-events-auto">
          {/* Eliminated countries horizontal scroll list */}
          {recentEliminated.length > 0 && (
            <div className="bg-[#0f1322]/80 backdrop-blur-md border border-white/10 rounded-2xl p-2.5 shadow-xl">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-white/40 text-[11px] font-bold uppercase tracking-wider">
                  Elimination Order ({eliminatedFlags.length} Fallen)
                </span>
                <span className="text-rose-400/80 text-[10px] font-semibold">Latest →</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                {recentEliminated.map((c, idx) => (
                  <div
                    key={`${c.code}-${idx}`}
                    className="flex-shrink-0 flex items-center gap-1 bg-white/5 border border-white/5 rounded-full px-2.5 py-1 text-xs"
                    title={`${c.name} - Eliminated #${totalFlags - idx}`}
                  >
                    <span className="text-base">{c.emoji}</span>
                    <span className="text-white/80 font-medium text-[11px] max-w-[80px] truncate">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Settings Bar: Arena Spin Speed + Flag Count */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#121629]/90 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2 text-xs">
            {/* Flag count selector */}
            <div className="flex items-center gap-2">
              <span className="text-white/50 font-medium">Flags:</span>
              {[30, 60, 100].map(cnt => (
                <button
                  key={cnt}
                  onClick={() => handleFlagCountChange(cnt)}
                  className={`px-2.5 py-0.5 rounded-lg font-bold transition-all ${totalFlags === cnt ? 'bg-indigo-600 text-white' : 'text-white/40 hover:text-white'}`}
                >
                  {cnt}
                </button>
              ))}
            </div>

            {/* Arena Spin Speed */}
            <div className="flex items-center gap-2">
              <span className="text-white/50 font-medium">Arena Spin:</span>
              {[
                { label: 'Slow', val: 0.5 },
                { label: 'Normal', val: 1.0 },
                { label: 'Fast', val: 2.0 },
              ].map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setRotationSpeedMultiplier(opt.val)}
                  className={`px-2.5 py-0.5 rounded-lg font-bold transition-all ${rotationSpeedMultiplier === opt.val ? 'bg-sky-600 text-white' : 'text-white/40 hover:text-white'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* WINNER CELEBRATION MODAL */}
      {winner && (
        <SimpleWinnerCelebration
          winner={winner}
          onRestart={handleRestart}
          eliminatedCount={eliminatedFlags.length}
          predictions={[selectedCountry, prediction2, prediction3]}
          eliminatedFlags={eliminatedFlags}
        />
      )}

      {/* Global CSS animations */}
      <style>{`
        @keyframes elimToast {
          0% { opacity: 0; transform: translateY(-12px) scale(0.9); }
          15% { opacity: 1; transform: translateY(0) scale(1); }
          85% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-8px) scale(0.95); }
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};