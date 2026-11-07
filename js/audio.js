/*
 * Moteur audio de Piano Magique.
 *  - Synthé modulaire piloté par des presets (oscillateurs, unisson, FM, filtre, enveloppes,
 *    glissando mono, vibrato, saturation, chorus, écho, réverbération)
 *  - Kits de batterie synthétisés
 *  - Banques d'instruments réels General MIDI (optionnelles, téléchargées à la demande)
 * Tout est généré en direct : aucun fichier audio n'est nécessaire.
 */
(function () {
  "use strict";

  let ctx = null;
  let master, comp, dryBus, revSend, convolver, limiter;
  let volume = 0.85;
  let sustain = false;
  const voices = new Set();
  const MAX_VOICES = 48;

  let preset = null;         // preset effectif (preset + réglages)
  let fx = null;             // chaîne d'effets du preset courant
  let sampler = null;        // banque GM si preset "gm"
  let mono = { voice: null, stack: [] };

  const mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  const clampF = function (f) { return Math.max(20, Math.min(19000, f)); };

  // ================================================================ contexte
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC({ latencyHint: "interactive" });
      master = ctx.createGain(); master.gain.value = volume;
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 12; comp.ratio.value = 6;
      comp.attack.value = 0.002; comp.release.value = 0.15;
      limiter = ctx.createWaveShaper();
      limiter.curve = softClipCurve(0.9);
      dryBus = ctx.createGain();
      revSend = ctx.createGain(); revSend.gain.value = 1;
      convolver = ctx.createConvolver();
      convolver.buffer = makeImpulse(2.8, 2.4);
      const trim = gain(0.42); // marge : évite la saturation quand on joue des accords
      dryBus.connect(trim);
      revSend.connect(convolver); convolver.connect(trim);
      trim.connect(master);
      master.connect(comp); comp.connect(limiter); limiter.connect(ctx.destination);
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* rien */ }
      unlockIOS();
      if (preset) buildFx();
    }
    if (ctx.state !== "running") ctx.resume().catch(function () {});
    return ctx;
  }

  function unlockIOS() {
    try {
      const a = document.createElement("audio");
      a.setAttribute("playsinline", "");
      a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=";
      a.loop = true; a.volume = 0.01;
      a.play().catch(function () {});
    } catch (e) { /* rien */ }
  }

  function softClipCurve(k) {
    const c = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; c[i] = Math.tanh(x * (1 + k * 2)) / Math.tanh(1 + k * 2); }
    return c;
  }
  function driveCurve(amount, bits) {
    const n = 2048, c = new Float32Array(n), k = amount * 12;
    const steps = bits ? Math.pow(2, bits - 1) : 0;
    for (let i = 0; i < n; i++) {
      let x = i / (n / 2) - 1;
      if (k > 0) x = Math.tanh(x * (1 + k)) / Math.tanh(1 + k);
      if (steps) x = Math.round(x * steps) / steps;
      c[i] = x;
    }
    return c;
  }

  function makeImpulse(seconds, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * 0.6;
      }
    }
    return buf;
  }

  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    return s;
  }

  const waves = {};
  function pulseWave(duty) {
    if (waves[duty]) return waves[duty];
    const n = 64, re = new Float32Array(n), im = new Float32Array(n);
    for (let i = 1; i < n; i++) re[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
    waves[duty] = ctx.createPeriodicWave(re, im);
    return waves[duty];
  }
  function setWave(o, w) {
    if (w === "pulse25") o.setPeriodicWave(pulseWave(0.25));
    else if (w === "pulse12") o.setPeriodicWave(pulseWave(0.125));
    else o.type = w;
  }

  const gain = function (v) { const g = ctx.createGain(); g.gain.value = v; return g; };
  const biquad = function (type, f, q) {
    const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = clampF(f); if (q !== undefined) b.Q.value = q; return b;
  };

  // ================================================================ chaîne d'effets du preset
  function buildFx() {
    if (!ctx || !preset) return;
    const old = fx;
    const P = preset;
    const input = gain(1);
    let node = input;
    if ((P.drive || 0) > 0 || P.crush) {
      const pre = gain(1 + (P.drive || 0) * 1.5);
      const sh = ctx.createWaveShaper();
      sh.curve = driveCurve(P.drive || 0, P.crush || 0);
      sh.oversample = "2x";
      const post = gain(1 / (1 + (P.drive || 0) * 0.8));
      node.connect(pre); pre.connect(sh); sh.connect(post); node = post;
    }
    const outG = gain(1);
    node.connect(outG);
    const extra = [];
    if ((P.cho || 0) > 0) { // chorus stéréo
      [-0.7, 0.7].forEach(function (pan, i) {
        const d = ctx.createDelay(0.05); d.delayTime.value = 0.012 + i * 0.006;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.6 + i * 0.27;
        const lg = gain(0.0035); lfo.connect(lg); lg.connect(d.delayTime); lfo.start();
        const wet = gain(P.cho * 0.7);
        const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : gain(1);
        if (pn.pan) pn.pan.value = pan;
        node.connect(d); d.connect(wet); wet.connect(pn); pn.connect(outG);
        extra.push(lfo);
      });
    }
    if (P.dly && P.dly[2] > 0) { // écho [temps, retour, mélange]
      const d = ctx.createDelay(2); d.delayTime.value = P.dly[0];
      const fb = gain(P.dly[1]);
      const tone = biquad("lowpass", 4500, 0.5);
      const wet = gain(P.dly[2]);
      outG.connect(d); d.connect(tone); tone.connect(fb); fb.connect(d); tone.connect(wet);
      wet.connect(dryBus); wet.connect(revSendFor(P));
    }
    outG.connect(dryBus);
    outG.connect(revSendFor(P));
    fx = { input: input, extra: extra, out: outG };
    if (old) {
      setTimeout(function () {
        try { old.out.disconnect(); } catch (e) { /* rien */ }
        old.extra.forEach(function (o) { try { o.stop(); } catch (e) { /* rien */ } });
      }, 4000);
    }
  }
  function revSendFor(P) {
    const g = gain(P.rev === undefined ? 0.2 : P.rev);
    g.connect(revSend);
    return g;
  }

  // ================================================================ voix de synthé
  function synthVoice(P, midi, vel, t, dest) {
    const f0 = mtof(midi + 12 * (P.oct || 0));
    const A = P.a || [0.005, 0.5, 0.7, 0.3];
    let decay = A[1];
    if (P.kd) decay *= Math.pow(261.6 / f0, P.kd); // décroissance plus courte dans l'aigu
    const peak = (P.vol === undefined ? 0.5 : P.vol) * (0.3 + 0.7 * vel);
    const amp = gain(0);
    const stops = [], oscs = [];
    let target = amp;

    if (P.f) { // filtre
      const F = P.f;
      const filt = biquad(F.t || "lowpass", 1000, F.q === undefined ? 0.7 : F.q);
      const bright = Math.pow(2, P.bright || 0);
      const base = clampF((F.c || 2000) * Math.pow(f0 / 261.6, F.kt === undefined ? 0.5 : F.kt) * bright);
      const envAmt = (F.e || 0) * (0.5 + vel * 0.5);
      if (F.a) {
        filt.frequency.setValueAtTime(base, t);
        filt.frequency.linearRampToValueAtTime(clampF(base * Math.pow(2, envAmt)), t + F.a);
        filt.frequency.setTargetAtTime(clampF(base * Math.pow(2, envAmt * (F.s || 0))), t + F.a, (F.d || 0.3) / 3);
      } else if (envAmt) {
        filt.frequency.setValueAtTime(clampF(base * Math.pow(2, envAmt)), t);
        filt.frequency.setTargetAtTime(clampF(base * Math.pow(2, envAmt * (F.s || 0))), t, (F.d || 0.3) / 3);
      } else {
        filt.frequency.setValueAtTime(base, t);
      }
      if (F.lfo) { // [vitesse, octaves] : wobble
        const l = ctx.createOscillator(); l.frequency.value = F.lfo[0];
        const lg = gain(base * (Math.pow(2, F.lfo[1]) - 1));
        l.connect(lg); lg.connect(filt.frequency); stops.push(l);
      }
      filt.connect(amp); target = filt;
    }
    if (P.fmt) { // formants (voix, talkbox, sax) : [fréquence, gain, Q]
      const mix = gain(1);
      P.fmt.forEach(function (fm) {
        const bp = biquad("bandpass", fm[0], fm[2] || 8), g = gain(fm[1]);
        mix.connect(bp); bp.connect(g); g.connect(target);
      });
      target = mix;
    }

    (P.o || [{ w: "sawtooth" }]).forEach(function (o) {
      const u = o.u || 1;
      for (let k = 0; k < u; k++) {
        const cg = gain((o.g === undefined ? 1 : o.g) / Math.sqrt(u));
        if (o.dec) { // composante qui s'éteint vite (marteau, clic, attaque)
          cg.gain.setValueAtTime(cg.gain.value, t);
          cg.gain.setTargetAtTime(0.0001, t, o.dec);
        }
        if (o.w === "noise") {
          const n = noise();
          let nn = n;
          if (o.bp) { const b = biquad("bandpass", f0 * o.bp, o.q || 1.5); n.connect(b); nn = b; }
          if (o.hp) { const h = biquad("highpass", o.hp, 0.7); nn.connect(h); nn = h; }
          nn.connect(cg); cg.connect(target); stops.push(n);
          continue;
        }
        const osc = ctx.createOscillator();
        setWave(osc, o.w || "sawtooth");
        const ratio = (o.r || 1) * Math.pow(2, (o.s || 0) / 12);
        const fr = f0 * ratio;
        osc.frequency.setValueAtTime(fr, t);
        const det = (o.d || 0) + (u > 1 ? (o.sp || 18) * (2 * k / (u - 1) - 1) : 0);
        if (det) osc.detune.setValueAtTime(det, t);
        if (o.fm) { // [rapport, indice, décroissance, indice final]
          const mod = ctx.createOscillator();
          mod.frequency.setValueAtTime(fr * o.fm[0], t);
          const mg = gain(0);
          mg.gain.setValueAtTime(fr * o.fm[1] * (0.4 + vel * 0.6), t);
          if (o.fm[2]) mg.gain.setTargetAtTime(fr * o.fm[1] * (o.fm[3] || 0), t, o.fm[2]);
          mod.connect(mg); mg.connect(osc.frequency); stops.push(mod);
        }
        if (P.pe) { // enveloppe de hauteur [demi-tons, durée]
          osc.frequency.setValueAtTime(fr * Math.pow(2, P.pe[0] / 12), t);
          osc.frequency.exponentialRampToValueAtTime(fr, t + P.pe[1]);
        }
        osc.connect(cg); cg.connect(target);
        stops.push(osc); oscs.push({ osc: osc, ratio: ratio });
      }
    });
    if (P.sub) { // sous-oscillateur
      const s = ctx.createOscillator(); s.type = "sine";
      s.frequency.setValueAtTime(f0 / 2, t);
      if (P.pe) { s.frequency.setValueAtTime(f0 / 2 * Math.pow(2, P.pe[0] / 12), t); s.frequency.exponentialRampToValueAtTime(f0 / 2, t + P.pe[1]); }
      const sg = gain(P.sub); s.connect(sg); sg.connect(amp);
      stops.push(s); oscs.push({ osc: s, ratio: 0.5 });
    }
    if (P.vib) { // vibrato [vitesse, cents, délai]
      const l = ctx.createOscillator(); l.frequency.value = P.vib[0];
      const lg = gain(0);
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(P.vib[1], t + (P.vib[2] || 0.01) + 0.01);
      l.connect(lg);
      oscs.forEach(function (x) { lg.connect(x.osc.detune); });
      stops.push(l);
    }
    let outNode = amp;
    if (P.trem) { // trémolo / effet "pompe" [vitesse, profondeur]
      const tg = gain(1 - P.trem[1] / 2);
      const l = ctx.createOscillator(); l.frequency.value = P.trem[0];
      const lg = gain(P.trem[1] / 2); l.connect(lg); lg.connect(tg.gain);
      amp.connect(tg); outNode = tg; stops.push(l);
    }

    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(peak, t + Math.max(0.001, A[0]));
    let life = 60;
    if (A[2] > 0) amp.gain.setTargetAtTime(peak * A[2], t + A[0], Math.max(0.01, decay) / 3);
    else { amp.gain.setTargetAtTime(0.0001, t + A[0], Math.max(0.01, decay) / 3); life = A[0] + decay * 2.6 + 0.1; }
    outNode.connect(dest);
    return { stops: stops, amp: amp, rel: A[3], life: life, oscs: oscs };
  }

  // ================================================================ batterie
  function drumHit(type, p, t, vel, dest) {
    p = p || {};
    const out = gain((p.v === undefined ? 1 : p.v) * (0.4 + 0.6 * vel));
    out.connect(dest);
    const pitch = p.pitch || 1;
    const run = function (src, until) { src.start(t); src.stop(until); };
    if (type === "kick" || type === "kick808" || type === "boom" || type === "logdrum") {
      const long = type === "kick808" || type === "boom";
      const o = ctx.createOscillator(); o.type = "sine";
      const f1 = (p.f1 || (type === "logdrum" ? 260 : 170)) * pitch;
      const fEnd = (p.f0 || (long ? 42 : type === "logdrum" ? 110 : 48)) * pitch;
      o.frequency.setValueAtTime(f1, t);
      o.frequency.exponentialRampToValueAtTime(fEnd, t + (p.pt || (type === "logdrum" ? 0.03 : 0.07)));
      const a = gain(0), d = p.d || (long ? 1.4 : type === "logdrum" ? 0.45 : 0.42);
      a.gain.setValueAtTime(1, t);
      a.gain.setTargetAtTime(0.0001, t + 0.01, d / 3);
      let n = a;
      if (p.drive || long) {
        const sh = ctx.createWaveShaper(); sh.curve = driveCurve(p.drive || 0.35, 0);
        a.connect(sh); n = sh;
      }
      if (type === "logdrum") { const lp = biquad("lowpass", 900, 2); n.connect(lp); n = lp; }
      o.connect(a); n.connect(out); run(o, t + d * 3);
      if (p.click !== 0 && type !== "boom") {
        const c = noise(), cg = gain(0), hp = biquad("highpass", 2500, 0.7);
        cg.gain.setValueAtTime(p.click || 0.25, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
        c.connect(hp); hp.connect(cg); cg.connect(out); run(c, t + 0.02);
      }
    } else if (type === "snare" || type === "clap") {
      const n = noise();
      const isClap = type === "clap";
      const f = biquad(isClap ? "bandpass" : "highpass", (isClap ? (p.bp || 1300) : (p.hp || 1500)) * pitch, isClap ? 1.2 : 0.7);
      const a = gain(0), d = p.d || (isClap ? 0.2 : 0.17);
      if (isClap) {
        [0, 0.011, 0.023].forEach(function (x) { a.gain.setValueAtTime(0.9, t + x); a.gain.exponentialRampToValueAtTime(0.12, t + x + 0.01); });
        a.gain.setValueAtTime(0.75, t + 0.034); a.gain.setTargetAtTime(0.0001, t + 0.034, d / 3);
      } else {
        a.gain.setValueAtTime(p.noise || 0.75, t); a.gain.setTargetAtTime(0.0001, t, d / 3);
        const o = ctx.createOscillator(); o.type = "triangle";
        o.frequency.setValueAtTime((p.tone || 200) * 1.6 * pitch, t);
        o.frequency.exponentialRampToValueAtTime((p.tone || 200) * pitch, t + 0.03);
        const oa = gain(0); oa.gain.setValueAtTime(p.body === undefined ? 0.7 : p.body, t); oa.gain.setTargetAtTime(0.0001, t, 0.035);
        o.connect(oa); oa.connect(out); run(o, t + 0.2);
      }
      n.connect(f); f.connect(a); a.connect(out); run(n, t + d * 3 + 0.05);
    } else if (type === "hat" || type === "ohat" || type === "crash" || type === "shaker") {
      const n = noise();
      const d = p.d || ({ hat: 0.04, ohat: 0.32, crash: 1.4, shaker: 0.07 })[type];
      const f = biquad("highpass", (p.hp || (type === "crash" ? 5000 : type === "shaker" ? 5500 : 7800)) * pitch, 0.8);
      const a = gain(0);
      if (type === "shaker") { a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(0.35, t + 0.02); a.gain.setTargetAtTime(0.0001, t + 0.02, d / 3); }
      else { a.gain.setValueAtTime(type === "crash" ? 0.45 : 0.4, t); a.gain.setTargetAtTime(0.0001, t, d / 3); }
      if (type !== "shaker") { // métal : carrés désaccordés
        const ring = gain(0.1);
        [3.1, 4.7].forEach(function (r) {
          const o = ctx.createOscillator(); o.type = "square"; o.frequency.value = 1000 * r * pitch;
          o.connect(ring); run(o, t + d * 3);
        });
        ring.connect(f);
      }
      n.connect(f); f.connect(a); a.connect(out); run(n, t + d * 3 + 0.05);
    } else if (type === "rim" || type === "cowbell" || type === "perc") {
      const fr = (p.f || (type === "rim" ? 1700 : type === "cowbell" ? 560 : 900)) * pitch;
      const a = gain(0), d = p.d || (type === "rim" ? 0.035 : type === "cowbell" ? 0.25 : 0.12);
      const bp = biquad("bandpass", fr * (type === "cowbell" ? 1.4 : 1), type === "cowbell" ? 2.5 : 4);
      (type === "cowbell" ? [1, 1.4815] : [1]).forEach(function (r) {
        const o = ctx.createOscillator(); o.type = type === "perc" ? "sine" : "square"; o.frequency.value = fr * r;
        o.connect(bp); run(o, t + d * 3 + 0.02);
      });
      a.gain.setValueAtTime(type === "perc" ? 0.8 : 0.5, t); a.gain.setTargetAtTime(0.0001, t, d / 3);
      bp.connect(a); a.connect(out);
    } else if (type === "tom" || type === "conga") {
      const o = ctx.createOscillator(); o.type = "sine";
      const fr = (p.f || (type === "conga" ? 220 : 120)) * pitch;
      o.frequency.setValueAtTime(fr * 1.6, t); o.frequency.exponentialRampToValueAtTime(fr, t + 0.05);
      const a = gain(0), d = p.d || (type === "conga" ? 0.18 : 0.35);
      a.gain.setValueAtTime(0.9, t); a.gain.setTargetAtTime(0.0001, t, d / 3);
      o.connect(a); a.connect(out); run(o, t + d * 3);
    } else if (type === "snap") {
      const n = noise(), bp = biquad("bandpass", 2600 * pitch, 3), a = gain(0);
      a.gain.setValueAtTime(1, t); a.gain.setTargetAtTime(0.0001, t, 0.02);
      n.connect(bp); bp.connect(a); a.connect(out); run(n, t + 0.12);
    }
  }

  // ================================================================ banques GM (vrais instruments)
  const GM_NAMES = [
    "acoustic_grand_piano", "bright_acoustic_piano", "electric_grand_piano", "honkytonk_piano", "electric_piano_1",
    "electric_piano_2", "harpsichord", "clavinet", "celesta", "glockenspiel", "music_box", "vibraphone", "marimba",
    "xylophone", "tubular_bells", "dulcimer", "drawbar_organ", "percussive_organ", "rock_organ", "church_organ",
    "reed_organ", "accordion", "harmonica", "tango_accordion", "acoustic_guitar_nylon", "acoustic_guitar_steel",
    "electric_guitar_jazz", "electric_guitar_clean", "electric_guitar_muted", "overdriven_guitar", "distortion_guitar",
    "guitar_harmonics", "acoustic_bass", "electric_bass_finger", "electric_bass_pick", "fretless_bass", "slap_bass_1",
    "slap_bass_2", "synth_bass_1", "synth_bass_2", "violin", "viola", "cello", "contrabass", "tremolo_strings",
    "pizzicato_strings", "orchestral_harp", "timpani", "string_ensemble_1", "string_ensemble_2", "synth_strings_1",
    "synth_strings_2", "choir_aahs", "voice_oohs", "synth_choir", "orchestra_hit", "trumpet", "trombone", "tuba",
    "muted_trumpet", "french_horn", "brass_section", "synth_brass_1", "synth_brass_2", "soprano_sax", "alto_sax",
    "tenor_sax", "baritone_sax", "oboe", "english_horn", "bassoon", "clarinet", "piccolo", "flute", "recorder",
    "pan_flute", "blown_bottle", "shakuhachi", "whistle", "ocarina", "lead_1_square", "lead_2_sawtooth",
    "lead_3_calliope", "lead_4_chiff", "lead_5_charang", "lead_6_voice", "lead_7_fifths", "lead_8_bass__lead",
    "pad_1_new_age", "pad_2_warm", "pad_3_polysynth", "pad_4_choir", "pad_5_bowed", "pad_6_metallic", "pad_7_halo",
    "pad_8_sweep", "fx_1_rain", "fx_2_soundtrack", "fx_3_crystal", "fx_4_atmosphere", "fx_5_brightness",
    "fx_6_goblins", "fx_7_echoes", "fx_8_scifi", "sitar", "banjo", "shamisen", "koto", "kalimba", "bagpipe", "fiddle",
    "shanai", "tinkle_bell", "agogo", "steel_drums", "woodblock", "taiko_drum", "melodic_tom", "synth_drum",
    "reverse_cymbal", "guitar_fret_noise", "breath_noise", "seashore", "bird_tweet", "telephone_ring", "helicopter",
    "applause", "gunshot",
  ];
  const GM_FR = [
    "Piano à queue", "Piano brillant", "Piano électrique à queue", "Piano bastringue", "Piano électrique 1",
    "Piano électrique 2", "Clavecin", "Clavinet", "Célesta", "Glockenspiel", "Boîte à musique", "Vibraphone", "Marimba",
    "Xylophone", "Cloches tubulaires", "Tympanon", "Orgue Hammond", "Orgue percussif", "Orgue rock", "Orgue d'église",
    "Harmonium", "Accordéon", "Harmonica", "Accordéon tango", "Guitare classique (nylon)", "Guitare folk (acier)",
    "Guitare jazz", "Guitare électrique claire", "Guitare étouffée", "Guitare saturée", "Guitare distorsion",
    "Harmoniques de guitare", "Contrebasse jazz", "Basse électrique (doigts)", "Basse électrique (médiator)",
    "Basse fretless", "Basse slap 1", "Basse slap 2", "Basse synthé 1", "Basse synthé 2", "Violon", "Alto",
    "Violoncelle", "Contrebasse", "Cordes trémolo", "Cordes pizzicato", "Harpe", "Timbales",
    "Ensemble de cordes 1", "Ensemble de cordes 2", "Cordes synthé 1", "Cordes synthé 2", "Chœur « Aah »",
    "Voix « Ooh »", "Chœur synthé", "Coup d'orchestre", "Trompette", "Trombone", "Tuba", "Trompette bouchée",
    "Cor d'harmonie", "Section cuivres", "Cuivres synthé 1", "Cuivres synthé 2", "Saxophone soprano",
    "Saxophone alto", "Saxophone ténor", "Saxophone baryton", "Hautbois", "Cor anglais", "Basson", "Clarinette",
    "Piccolo", "Flûte traversière", "Flûte à bec", "Flûte de Pan", "Bouteille soufflée", "Shakuhachi", "Sifflement",
    "Ocarina", "Lead carré", "Lead dent de scie", "Lead calliope", "Lead chiff", "Lead charang", "Lead voix",
    "Lead quintes", "Lead basse", "Pad New Age", "Pad chaud", "Pad polysynth", "Pad chœur", "Pad archet",
    "Pad métallique", "Pad halo", "Pad balayage", "FX pluie", "FX bande-son", "FX cristal", "FX atmosphère",
    "FX brillance", "FX gobelins", "FX échos", "FX science-fiction", "Sitar", "Banjo", "Shamisen", "Koto", "Kalimba",
    "Cornemuse", "Violon folk", "Shehnai", "Clochettes", "Agogo", "Steel drums", "Wood-block", "Taiko",
    "Tom mélodique", "Batterie synthé", "Cymbale inversée", "Bruit de frettes", "Souffle", "Bord de mer",
    "Chant d'oiseau", "Sonnerie de téléphone", "Hélicoptère", "Applaudissements", "Coup de feu",
  ];
  const GM_FAMILIES = [
    "Pianos", "Percussions chromatiques", "Orgues", "Guitares", "Basses", "Cordes", "Ensembles", "Cuivres",
    "Anches", "Flûtes", "Leads synthé", "Pads synthé", "Effets synthé", "Ethnique", "Percussions", "Effets sonores",
  ];
  const BANKS = { FluidR3_GM: "Fluid", MusyngKite: "Musyng", FatBoy: "FatBoy" };
  const SF_BASE = "https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/";
  const samplerCache = {};
  const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function sfNameToMidi(name) {
    const m = /^([A-G])(b|#)?(-?\d)$/.exec(name);
    if (!m) return null;
    return NOTE_IDX[m[1]] + (m[2] === "b" ? -1 : m[2] === "#" ? 1 : 0) + (parseInt(m[3], 10) + 1) * 12;
  }
  function b64ToBuf(b64) {
    const bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  function decode(arrayBuf) {
    return new Promise(function (res, rej) {
      const p = ctx.decodeAudioData(arrayBuf, res, rej);
      if (p && p.then) p.then(res, rej);
    });
  }
  // Les banques sont des fichiers JS (format MIDI.js) : on les charge comme <script>
  function loadScriptFont(bank, name) {
    return new Promise(function (res, rej) {
      window.MIDI = window.MIDI || {};
      window.MIDI.Soundfont = window.MIDI.Soundfont || {};
      const el = document.createElement("script");
      el.src = SF_BASE + bank + "/" + name + "-mp3.js";
      el.async = true;
      el.onload = function () {
        const font = window.MIDI.Soundfont[name];
        delete window.MIDI.Soundfont[name];
        el.remove();
        if (font) res(font); else rej(new Error("Banque vide"));
      };
      el.onerror = function () { el.remove(); rej(new Error("Téléchargement impossible")); };
      document.head.appendChild(el);
    });
  }
  function loadSampler(bank, name, onProgress) {
    const key = bank + "/" + name;
    if (samplerCache[key]) return samplerCache[key];
    ensure();
    const s = { buffers: {}, keys: [] };
    const p = loadScriptFont(bank, name).then(function (font) {
      const raw = {};
      Object.keys(font).forEach(function (n) {
        const midi = sfNameToMidi(n), data = String(font[n]), i = data.indexOf("base64,");
        if (midi !== null && i >= 0) raw[midi] = data.slice(i + 7);
      });
      const keys = Object.keys(raw).map(Number);
      if (!keys.length) throw new Error("Banque vide");
      let done = 0;
      keys.sort(function (a, b) { return Math.abs(a - 64) - Math.abs(b - 64); });
      return Promise.all(keys.map(function (k) {
        return decode(b64ToBuf(raw[k])).then(function (buf) { s.buffers[k] = buf; })
          .catch(function () { /* note illisible */ }).then(function () { done++; if (onProgress) onProgress(done / keys.length); });
      }));
    }).then(function () {
      s.keys = Object.keys(s.buffers).map(Number).sort(function (a, b) { return a - b; });
      return s;
    });
    p.catch(function () { delete samplerCache[key]; });
    samplerCache[key] = p;
    return p;
  }
  function samplerVoice(smp, midi, vel, t, dest) {
    let best = null, bd = 1e9;
    smp.keys.forEach(function (k) { const d = Math.abs(k - midi); if (d < bd) { bd = d; best = k; } });
    if (best === null) return null;
    const src = ctx.createBufferSource();
    src.buffer = smp.buffers[best]; src.playbackRate.value = Math.pow(2, (midi - best) / 12);
    const amp = gain(0);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(0.9 * (0.3 + vel * 0.7), t + 0.004);
    src.connect(amp); amp.connect(dest);
    return { stops: [src], amp: amp, rel: 0.25, life: src.buffer.duration / src.playbackRate.value + 0.05, oscs: [] };
  }

  // ================================================================ gestion des voix
  function startVoice(midi, vel, when) {
    ensure();
    if (!preset) return null;
    if (!fx) buildFx();
    const t = Math.max(when || 0, ctx.currentTime);
    const P = preset;
    if (P.kit) {
      const slot = P.kit[((midi % 12) + 12) % 12];
      if (!slot) return null;
      const params = Object.assign({}, slot[1] || {});
      params.pitch = (params.pitch || 1) * Math.pow(2, (Math.floor(midi / 12) - 5) * 0.2);
      params.v = (params.v === undefined ? 1 : params.v) * (P.vol === undefined ? 1 : P.vol);
      drumHit(slot[0], params, t, vel, fx.input);
      return null;
    }
    let v = null;
    if (P.gm) {
      if (!sampler) return null;
      v = samplerVoice(sampler, midi, vel, t, fx.input);
    } else {
      v = synthVoice(P, midi, vel, t, fx.input);
    }
    if (!v) return null;
    v.stops.forEach(function (s) { s.start(t); try { s.stop(t + v.life); } catch (e) { /* rien */ } });
    v.midi = midi; v.t = t; v.ended = false;
    voices.add(v);
    if (v.stops[0]) v.stops[0].onended = function () { voices.delete(v); try { v.amp.disconnect(); } catch (e) { /* rien */ } };
    if (voices.size > MAX_VOICES) releaseVoice(voices.values().next().value, ctx.currentTime, 0.03);
    return v;
  }

  function releaseVoice(v, when, relOverride) {
    if (!v || v.ended) return;
    v.ended = true;
    const t = Math.max(when || 0, ctx.currentTime);
    let rel = relOverride || v.rel || 0.2;
    if (sustain && !relOverride) rel = Math.max(rel, 1.8);
    v.amp.gain.cancelScheduledValues(t);
    v.amp.gain.setTargetAtTime(0.0001, t, rel / 4);
    const end = t + rel * 1.6 + 0.05;
    v.stops.forEach(function (s) { try { s.stop(end); } catch (e) { /* rien */ } });
  }

  function glideTo(v, midi) {
    const now = ctx.currentTime;
    const f0 = mtof(midi + 12 * (preset.oct || 0));
    const tau = Math.max(0.004, (preset.glide || 0.03)) / 3;
    v.oscs.forEach(function (o) {
      const p = o.osc.frequency;
      const cur = p.value;
      p.cancelScheduledValues(now);
      p.setValueAtTime(cur, now);
      p.setTargetAtTime(f0 * o.ratio, now, tau);
    });
    v.midi = midi;
  }

  // ================================================================ API publique
  const Engine = {
    GM_NAMES: GM_NAMES, GM_FR: GM_FR, GM_FAMILIES: GM_FAMILIES, BANKS: BANKS,
    ensure: ensure,
    now: function () { return ctx ? ctx.currentTime : 0; },
    get ctx() { return ctx; },
    get preset() { return preset; },

    /** Change de preset. Renvoie une promesse (les banques HD se téléchargent). */
    setPreset: function (P, onProgress) {
      if (P.gm) {
        return loadSampler(P.gm[0], P.gm[1], onProgress).then(function (s) {
          Engine.allOff();
          sampler = s; preset = P; if (ctx) buildFx(); return P;
        });
      }
      Engine.allOff();
      sampler = null; preset = P;
      if (ctx) buildFx();
      return Promise.resolve(P);
    },
    /** Met à jour les réglages du preset courant sans couper le son */
    updatePreset: function (P, fxChanged) {
      preset = P;
      if (fxChanged && ctx) buildFx();
    },
    isLoaded: function (P) { return !P.gm || !!samplerCache[P.gm[0] + "/" + P.gm[1]]; },

    noteOn: function (midi, vel) {
      vel = vel === undefined ? 0.8 : vel;
      if (preset && preset.mono && !preset.kit && !preset.gm) {
        ensure();
        if (mono.voice && !mono.voice.ended && mono.stack.length) {
          glideTo(mono.voice, midi);
        } else {
          mono.voice = startVoice(midi, vel, 0);
          mono.stack = [];
        }
        mono.stack.push(midi);
        return { monoKey: midi };
      }
      return startVoice(midi, vel, 0);
    },
    noteOff: function (v) {
      if (!v) return;
      if (v.monoKey !== undefined) {
        const i = mono.stack.lastIndexOf(v.monoKey);
        if (i >= 0) mono.stack.splice(i, 1);
        if (!mono.voice) return;
        if (mono.stack.length) glideTo(mono.voice, mono.stack[mono.stack.length - 1]);
        else releaseVoice(mono.voice, 0);
        return;
      }
      releaseVoice(v, 0);
    },
    /** Note planifiée (leçons, lecture auto) — toujours polyphonique */
    play: function (midi, vel, when, dur) {
      const v = startVoice(midi, vel === undefined ? 0.8 : vel, when);
      if (v) releaseVoice(v, v.t + Math.max(0.05, dur || 0.3));
      return v;
    },
    cancel: function (v) { if (v && v.amp) releaseVoice(v, 0, 0.01); },
    allOff: function () {
      voices.forEach(function (v) { releaseVoice(v, 0, 0.05); });
      mono = { voice: null, stack: [] };
    },
    /** Coup de batterie (boîte à rythmes) */
    drum: function (type, when, vol, params) {
      ensure();
      drumHit(type, Object.assign({ v: vol === undefined ? 0.8 : vol }, params || {}), Math.max(when || 0, ctx.currentTime), 0.9, dryBus);
    },
    setVolume: function (x) { volume = x; if (master) master.gain.setTargetAtTime(x, ctx.currentTime, 0.02); },
    setSustain: function (b) { sustain = !!b; },
  };
  window.Engine = Engine;
})();
