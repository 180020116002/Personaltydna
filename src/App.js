import React, { useState, useEffect, useRef, useMemo } from 'react';
import './App.css';

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */

const QUESTIONS = [
  {
    key: 'name',
    question: "First, what's your name?",
    hint: "Don't lie. The algorithm will know.",
    placeholder: 'e.g. Alex',
  },
  {
    key: 'food',
    question: "What do you eat when everything's on fire?",
    hint: '2am. Straight from the container. We are not here to judge. Much.',
    placeholder: 'e.g. cereal from the box, cold pizza, my feelings',
  },
  {
    key: 'fear',
    question: "What's your most embarrassing irrational fear?",
    hint: "The one your therapist would charge extra for.",
    placeholder: 'e.g. someone reading my texts over my shoulder',
  },
  {
    key: 'coffee',
    question: 'How do you take your coffee?',
    hint: 'Or tea. Or emotional damage in a cup. We accept all forms.',
    placeholder: 'e.g. iced, triple shot, IV drip if it were legal',
  },
  {
    key: 'word',
    question: 'One word your friends use to describe you.',
    hint: "The group chat word. Not the birthday card word.",
    placeholder: 'e.g. chaotic, feral, somehow still employed',
  },
  {
    key: 'chaos',
    question: "What's your most unhinged recurring habit?",
    hint: "The thing your future biographer will linger on uncomfortably.",
    placeholder: "e.g. I reply 'on my way' and then get in the shower",
  },
];

const LOADING_MSGS = [
  'Analyzing your soul…',
  'Sequencing your chaos…',
  'Cross-referencing with known degenerates…',
  'Results are disturbing…',
  'Compiling your unhinged profile…',
];

const BLANK = { name: '', food: '', fear: '', coffee: '', word: '', chaos: '' };

const FALLBACK_TRAITS = [
  {"trait":"Chaos Cortex","emoji":"🌀","color":"#FF6B6B","description":"Thrives in disorder like it pays rent"},
  {"trait":"Midnight Hunger Protocol","emoji":"🍕","color":"#00FFD1","description":"Snacks at 2am without guilt or regret"},
  {"trait":"Selective Empathy Engine","emoji":"🧠","color":"#9B5DE5","description":"Feels deeply for dogs, less so for people"},
  {"trait":"Caffeine Dependency Matrix","emoji":"☕","color":"#FFD93D","description":"Cannot function before the sacred morning ritual"},
  {"trait":"Irrational Fear Processor","emoji":"😱","color":"#FF6B9D","description":"Scared of things that definitely cannot hurt you"},
  {"trait":"Social Battery Depleter","emoji":"🔋","color":"#4ECDC4","description":"Recharges alone and calls it self-care"},
  {"trait":"Overthinking Overdrive","emoji":"💭","color":"#45B7D1","description":"Replays every conversation from five years ago"},
  {"trait":"Chaotic Neutral Navigator","emoji":"🎲","color":"#F7DC6F","description":"Makes decisions via vibes and gut feelings only"},
];

const buildPrompt = (answers) => `You are a savage but loving personality analysis AI.

Given these 5 answers about a person:
- Comfort food when life falls apart: ${answers.food}
- Most embarrassing irrational fear: ${answers.fear}
- How they take their coffee: ${answers.coffee}
- Word their friends really use to describe them: ${answers.word}
- Most unhinged recurring habit: ${answers.chaos}

You must respond with ONLY a valid JSON array, no markdown, no explanation, no code blocks. Just the raw JSON array starting with [ and ending with ]. Example format:
[{"trait":"Name","emoji":"🔥","color":"#FF6B6B","description":"Short funny line"}]
Return exactly 8 traits.

Rules:
- trait: creative science-sounding name (e.g. "Chaos Cortex", "Midnight Hunger Protocol", "Selective Empathy Engine")
- emoji: one unique emoji per trait
- color: vivid neon hex, all 8 must be different, use exactly these: #FF6B6B #00FFD1 #9B5DE5 #FFD93D #FF6B9D #4ECDC4 #45B7D1 #F7DC6F
- description: 8-12 words, brutally honest and funny, do NOT use double quotes inside the description`;

/* ═══════════════════════════════════════════════════════════
   BACKGROUND ENGINE
   Each wizard step has a base hue. As the user types, the hue
   shifts slightly based on the characters entered. Results use
   the first trait's color. Falls back to transparent (dark bg)
   when nothing is typed yet.
═══════════════════════════════════════════════════════════ */

// Base hues per question: food→orange, fear→purple, coffee→cyan, word→yellow, chaos→pink
// name=violet, food=orange, fear=purple, coffee=cyan, word=yellow, chaos=pink
const STEP_HUES = [260, 28, 268, 172, 48, 318];

function getTintColor(screen, step, answers, traits) {
  // Results: use first trait color
  if (screen === 'results' && traits?.length) {
    return traits[0].color ?? '#9b5de5';
  }

  // Wizard: pick hue for current step, nudge it by what the user typed
  const key  = ['food', 'fear', 'coffee', 'word', 'chaos'][step] ?? 'food';
  const text = (answers[key] ?? '').trim();

  // No text yet → no tint (just the plain dark bg)
  if (!text) return null;

  const baseHue = STEP_HUES[step] ?? 270;
  const shift   = Array.from(text).reduce((s, c) => s + c.charCodeAt(0), 0) % 50 - 25;
  return `hsl(${baseHue + shift}, 70%, 20%)`;
}

/* ═══════════════════════════════════════════════════════════
   CANVAS DRAWING UTILITIES
═══════════════════════════════════════════════════════════ */

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

function leftBar(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = text.split(' ');
  let line = '', count = 0;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      if (count >= maxLines - 1) { ctx.fillText(line + '…', x, y); return; }
      ctx.fillText(line, x, y);
      y += lineH; line = word; count++;
    } else { line = test; }
  }
  if (line) ctx.fillText(line, x, y);
}


function drawBackground(ctx, W, H) {
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,255,209,0.04)';
  ctx.lineWidth = 1;
  const step = Math.round(W / 20);
  for (let x = 0; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

function drawTitleBlock(ctx, W, cx, baseY, size, title) {
  const grad = ctx.createLinearGradient(cx - 260, 0, cx + 260, 0);
  grad.addColorStop(0, '#9b5de5');
  grad.addColorStop(0.5, '#00ffd1');
  grad.addColorStop(1, '#ff6b9d');
  ctx.textAlign   = 'center';
  ctx.font        = `900 ${size}px 'Orbitron','Arial Black',sans-serif`;
  ctx.shadowColor = '#9b5de5';
  ctx.shadowBlur  = 40;
  ctx.fillStyle   = grad;
  ctx.fillText(title, cx, baseY);
  ctx.shadowBlur  = 0;
  ctx.font        = `${Math.round(size * 0.3)}px 'Share Tech Mono','Courier New',monospace`;
  ctx.fillStyle   = '#00ffd1';
  ctx.shadowColor = '#00ffd1';
  ctx.shadowBlur  = 12;
  ctx.fillText('🧬  SOUL ANALYSIS LAB', cx, baseY + Math.round(size * 0.55));
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';
}

function drawTraitCard(ctx, x, y, w, h, trait) {
  ctx.shadowColor = trait.color;
  ctx.shadowBlur  = 18;
  ctx.fillStyle   = '#0f0f28';
  rrect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = trait.color + '50';
  ctx.lineWidth   = 1.5;
  rrect(ctx, x, y, w, h, 12);
  ctx.stroke();
  ctx.fillStyle = trait.color;
  leftBar(ctx, x, y, 5, h, 12);
  ctx.fill();

  const pad     = 20;
  const ix      = x + pad;
  const textMaxW = w - pad * 2 - 5; // 5px for left colour bar
  const eSz     = Math.round(h * 0.22);
  const dSz     = Math.round(h * 0.10);

  // Emoji
  ctx.font      = `${eSz}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(trait.emoji, ix, y + Math.round(h * 0.38));

  // Trait name — shrink font until it fits, never truncate
  const nameText = trait.trait.toUpperCase();
  let nSz = 18;
  ctx.font = `bold ${nSz}px "Segoe UI","Arial",sans-serif`;
  if (ctx.measureText(nameText).width > textMaxW) {
    nSz = 15;
    ctx.font = `bold ${nSz}px "Segoe UI","Arial",sans-serif`;
  }
  if (ctx.measureText(nameText).width > textMaxW) {
    nSz = 13;
    ctx.font = `bold ${nSz}px "Segoe UI","Arial",sans-serif`;
  }
  ctx.fillStyle   = trait.color;
  ctx.shadowColor = trait.color;
  ctx.shadowBlur  = 8;
  ctx.fillText(nameText, ix, y + Math.round(h * 0.60));
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';

  // Description
  ctx.font      = `${dSz}px "Segoe UI","Arial",sans-serif`;
  ctx.fillStyle = '#ffffff';
  wrapText(ctx, trait.description, ix, y + Math.round(h * 0.76), textMaxW, Math.round(dSz * 1.35), 3);
}

function drawFooter(ctx, W, H) {
  ctx.textAlign = 'center';
  ctx.font      = '20px "Share Tech Mono","Courier New",monospace';
  ctx.fillStyle = '#444';
  ctx.fillText('soul-analysis-lab.ai', W / 2, H - 22);
  ctx.textAlign = 'right';
  ctx.font      = '18px "Share Tech Mono","Courier New",monospace';
  ctx.fillStyle = '#00ffd1';
  ctx.fillText('Developed by Payal', W - 28, H - 22);
}

function makeTitle(name) {
  if (!name || !name.trim()) return 'Your DNA';
  const n = name.trim();
  // possessive: "Alex's" but "James'" (ends in s)
  return n.endsWith('s') || n.endsWith('S') ? `${n}' DNA` : `${n}'s DNA`;
}

function buildShareCanvas(traits, name) {
  const W = 1080, H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  drawBackground(ctx, W, H);

  // Colored glow orbs matching trait palette
  const orbs = [traits[0], traits[3], traits[6]];
  orbs.forEach((t, i) => {
    if (!t) return;
    const positions = [[0.15, 0.18], [0.85, 0.82], [0.5, 0.5]];
    const rg = ctx.createRadialGradient(W * positions[i][0], H * positions[i][1], 0, W * positions[i][0], H * positions[i][1], W * 0.28);
    rg.addColorStop(0, t.color + '22');
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  });

  drawTitleBlock(ctx, W, W / 2, 106, 68, makeTitle(name));

  const padX = 48, startY = 218, gap = 16;
  const cardW = (W - padX * 2 - gap) / 2;
  const cardH = Math.max(180, (H - startY - 72 - gap * 3) / 4);

  traits.forEach((t, i) => {
    drawTraitCard(ctx,
      padX + (i % 2) * (cardW + gap),
      startY + Math.floor(i / 2) * (cardH + gap),
      cardW, cardH, t
    );
  });

  drawFooter(ctx, W, H);
  return canvas;
}

function downloadCanvas(canvas, filename) {
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}

/* ═══════════════════════════════════════════════════════════
   AURORA BACKGROUND
═══════════════════════════════════════════════════════════ */

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left:     `${5 + (i * 4.85) % 88}%`,
  delay:    `${(i * 0.42) % 9}s`,
  duration: `${7 + (i * 0.83) % 9}s`,
  size:     `${2 + (i % 3)}px`,
  color:    ['#00ffd1', '#9b5de5', '#ff6b9d'][i % 3],
}));

function AuroraBg() {
  return (
    <div className="aurora-bg" aria-hidden="true">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="orb orb-4" />
      {PARTICLES.map(p => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 6px ${p.color}, 0 0 14px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   APP COMPONENT
═══════════════════════════════════════════════════════════ */

export default function App() {
  const [screen,  setScreen]  = useState('wizard');
  const [step,    setStep]    = useState(0);
  const [anim,    setAnim]    = useState('enter-right');
  const [answers, setAnswers] = useState(BLANK);
  const [traits,  setTraits]  = useState(null);
  const [error,   setError]   = useState('');
  const [msgIdx,  setMsgIdx]  = useState(0);

  const inputRef = useRef(null);
  const busy     = useRef(false);

  // Tint color: a solid color that transitions smoothly as the user types.
  // Returns null when there's nothing typed → overlay is invisible → plain dark bg.
  const tintColor = useMemo(
    () => getTintColor(screen, step, answers, traits),
    [screen, step, answers, traits]
  );

  // Auto-focus input when wizard panel settles
  useEffect(() => {
    if (screen === 'wizard' && anim === '') inputRef.current?.focus();
  }, [step, anim, screen]);

  // Cycle loading messages
  useEffect(() => {
    if (screen !== 'loading') return;
    setMsgIdx(0);
    const t = setInterval(() => setMsgIdx(i => (i + 1) % LOADING_MSGS.length), 1900);
    return () => clearInterval(t);
  }, [screen]);

  /* ── Navigation ─────────────────────────────────── */
  const slideTo = (nextStep, direction) => {
    if (busy.current) return;
    busy.current = true;
    setAnim(direction === 'fwd' ? 'exit-left' : 'exit-right');
    setTimeout(() => {
      setStep(nextStep);
      setAnim(direction === 'fwd' ? 'enter-right' : 'enter-left');
      setTimeout(() => { setAnim(''); busy.current = false; }, 360);
    }, 270);
  };

  const goNext = () => {
    const key = QUESTIONS[step].key;
    if (!answers[key].trim()) {
      inputRef.current?.classList.add('shake');
      setTimeout(() => inputRef.current?.classList.remove('shake'), 500);
      return;
    }
    if (step < QUESTIONS.length - 1) {
      slideTo(step + 1, 'fwd');
    } else {
      setAnim('exit-left');
      setTimeout(() => { setScreen('loading'); callAPI(); }, 270);
    }
  };

  const goBack = () => { if (step > 0) slideTo(step - 1, 'back'); };

  /* ── API ────────────────────────────────────────── */
  const callAPI = async () => {
    try {
      const { name: _name, ...dnaAnswers } = answers;

      const apiKey = process.env.REACT_APP_GROQ_API_KEY;
      if (!apiKey) throw new Error('Groq API key not configured.');

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          messages: [{ role: 'user', content: buildPrompt(dnaAnswers) }],
          max_tokens: 1024,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Groq API error');

      let text = data.choices[0].message.content.trim();
      text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

      let traits;
      try {
        const match = text.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('No JSON array found');
        traits = JSON.parse(match[0]).slice(0, 8);
      } catch {
        traits = FALLBACK_TRAITS;
      }

      setTraits(traits);
      setScreen('results');
    } catch (err) {
      setError('Error: ' + err.message);
      setScreen('wizard'); setStep(0); setAnim('enter-right');
      busy.current = false;
    }
  };

  /* ── Share ──────────────────────────────────────── */
  const handleShare = () => {
    const name = answers.name?.trim() || '';
    const file = name ? `${name.toLowerCase()}-dna.png` : 'personality-dna.png';
    downloadCanvas(buildShareCanvas(traits, name), file);
  };

  const reset = () => {
    setTraits(null); setError(''); setAnswers(BLANK);
    setScreen('wizard'); setStep(0); setAnim('enter-right');
    busy.current = false;
  };

  /* ── LOADING ────────────────────────────────────── */
  if (screen === 'loading') {
    return (
      <div className="app loading-screen">
        <AuroraBg />
        <div className="bg-tint" style={tintColor ? { backgroundColor: tintColor } : {}} />
        <div className="loading-box">
          <div className="loading-icon">🧬</div>
          <h2 className="loading-title">SOUL ANALYSIS<br />IN PROGRESS</h2>
          <div className="loading-bar-track"><div className="loading-bar-fill" /></div>
          <p className="loading-msg" key={msgIdx}>{LOADING_MSGS[msgIdx]}</p>
          <p className="loading-sub">This might get personal.</p>
        </div>
        <footer className="site-footer">Developed by Payal ✨</footer>
      </div>
    );
  }

  /* ── RESULTS ────────────────────────────────────── */
  if (screen === 'results' && traits) {
    return (
      <div className="app results-screen">
        <AuroraBg />
        <div className="bg-tint" style={tintColor ? { backgroundColor: tintColor } : {}} />
        <header className="results-header">
          <p className="badge">⚗️ SOUL ANALYSIS LAB</p>
          <h1 className="site-title">Personality DNA</h1>
          <p className="site-sub">The lab has spoken. You cannot argue with science.</p>
        </header>

        <div className="capture-zone">
          <p className="capture-label">🧬 {makeTitle(answers.name).toUpperCase()} SEQUENCE</p>
          <div className="trait-grid">
            {traits.map((t, i) => (
              <div
                key={i}
                className="trait-card"
                style={{ '--c': t.color, animationDelay: `${i * 0.07}s` }}
              >
                <span className="card-emoji">{t.emoji}</span>
                <span className="card-name" style={{ color: t.color }}>{t.trait}</span>
                <p className="card-desc">{t.description}</p>
              </div>
            ))}
          </div>
          <p className="capture-footer">soul-analysis-lab.ai · Developed by Payal</p>
        </div>

        <div className="action-row">
          <button className="btn-share" onClick={handleShare}>📸 Share My DNA</button>
          <button className="btn-reset" onClick={reset}>↩ Start Over</button>
        </div>

        <footer className="site-footer">Developed by Payal ✨</footer>
      </div>
    );
  }

  /* ── WIZARD ─────────────────────────────────────── */
  const q        = QUESTIONS[step];
  const progress = ((step + 1) / QUESTIONS.length) * 100;

  return (
    <div className="app wizard-screen">
      <AuroraBg />
      <div className="bg-tint" style={tintColor ? { backgroundColor: tintColor } : {}} />
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <header className="wizard-header">
        <p className="badge">⚗️ SOUL ANALYSIS LAB</p>
        <h1 className="site-title">Personality DNA</h1>
      </header>
      {error && <p className="error-banner">{error}</p>}
      <div className="wizard-body">
        <div className={`step-panel ${anim}`}>
          <p className="step-count">
            <span className="step-num">{String(step + 1).padStart(2, '0')}</span>
            <span className="step-sep"> / </span>
            <span className="step-total">{String(QUESTIONS.length).padStart(2, '0')}</span>
          </p>
          <h2 className="step-q">{q.question}</h2>
          <p className="step-hint">{q.hint}</p>
          <input
            ref={inputRef}
            className="step-input"
            type="text"
            placeholder={q.placeholder}
            value={answers[q.key]}
            onChange={e => setAnswers(p => ({ ...p, [q.key]: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && goNext()}
            autoComplete="off"
          />
          <div className="step-buttons">
            {step > 0 && <button className="btn-back" onClick={goBack}>← Back</button>}
            <button className="btn-next" onClick={goNext}>
              {step === QUESTIONS.length - 1 ? '🧬 Generate DNA' : 'Next →'}
            </button>
          </div>
          <div className="step-dots">
            {QUESTIONS.map((_, i) => (
              <span key={i} className={`dot ${i === step ? 'dot-active' : i < step ? 'dot-done' : ''}`} />
            ))}
          </div>
        </div>
      </div>
      <footer className="site-footer">Developed by Payal ✨</footer>
    </div>
  );
}
