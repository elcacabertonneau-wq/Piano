/*
 * Moteur audio : synthés intégrés (fonctionnent hors-ligne), banques de sons
 * échantillonnés General MIDI (gratuites, chargées à la demande) et boîte à rythmes.
 */
(function () {
  "use strict";

  let ctx = null;
  let master, comp, dryBus, wetBus, convolver, out;
  let volume = 0.8, reverbAmount = 0.25, sustain = false;
  let current = { id: "synth:piano", kind: "synth", def: null, sampler: null };
  const voices = new Set();
  const MAX_VOICES = 64;

  const mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

  // ---------------------------------------------------------------- contexte
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC({ latencyHint: "interactive" });
      master = ctx.createGain();
      master.gain.value = volume;
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 20; comp.ratio.value = 4;
      comp.attack.value = 0.003; comp.release.value = 0.2;
      dryBus = ctx.createGain();
      wetBus = ctx.createGain();
      wetBus.gain.value = reverbAmount;
      convolver = ctx.createConvolver();
      convolver.buffer = makeImpulse(2.6, 2.2);
      out = ctx.createGain(); // entrée commune des voix
      out.connect(dryBus); out.connect(wetBus);
      dryBus.connect(master);
      wetBus.connect(convolver); convolver.connect(master);
      master.connect(comp); comp.connect(ctx.destination);
      // iOS : bascule la session audio en "lecture" (ignore le bouton silencieux)
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* rien */ }
      unlockIOS();
    }
    if (ctx.state !== "running") { ctx.resume().catch(function () {}); }
    return ctx;
  }

  function unlockIOS() {
    try {
      const a = document.createElement("audio");
      a.setAttribute("playsinline", "");
      a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=";
      a.loop = true;
      a.volume = 0.01;
      a.play().catch(function () {});
    } catch (e) { /* rien */ }
  }

  function makeImpulse(seconds, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
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

  // ---------------------------------------------------------------- helpers synthé
  function osc(type, freq, t, detune) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    return o;
  }
  function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function filter(type, f, q) {
    const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b;
  }
  // amplitude : attaque, puis soit tenue (sus), soit décroissance libre (decay = constante de temps)
  function ampEnv(g, t, peak, attack, decayTau, sus) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    if (sus === undefined) {
      g.gain.setTargetAtTime(0.0001, t + attack, decayTau);
    } else {
      g.gain.setTargetAtTime(peak * sus, t + attack, decayTau);
    }
  }
  const clampF = function (f) { return Math.max(30, Math.min(18000, f)); };

  /* Chaque synthé : fn(f, vel, t, dest) -> { stops: [sources], amp: GainNode, rel: secondes } */
  const SYNTHS = {
    piano: {
      name: "Piano", icon: "🎹",
      fn: function (f, v, t, dest) {
        const amp = gain(0), lp = filter("lowpass", clampF(f * 10), 0.7);
        const dec = Math.max(0.35, Math.min(2.4, 1.6 * Math.sqrt(220 / f)));
        lp.frequency.setValueAtTime(clampF(f * 14 * (0.5 + v)), t);
        lp.frequency.setTargetAtTime(clampF(f * 3), t, dec * 0.6);
        const parts = [[ "triangle", 1, 0.9 ], [ "sine", 2, 0.35 ], [ "sine", 3, 0.12 ], [ "sine", 4.01, 0.05 ]];
        const stops = parts.map(function (p) {
          const o = osc(p[0], f * p[1], t, (Math.random() - 0.5) * 4);
          const g = gain(p[2]); o.connect(g); g.connect(lp); return o;
        });
        // petit "marteau"
        const n = noise(), ng = gain(0), hp = filter("bandpass", clampF(f * 4), 1);
        ng.gain.setValueAtTime(0.18 * v, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
        n.connect(hp); hp.connect(ng); ng.connect(amp); n.start(t); n.stop(t + 0.06);
        lp.connect(amp); amp.connect(dest);
        ampEnv(amp, t, 0.5 * v, 0.004, dec);
        return { stops: stops, amp: amp, rel: 0.18, life: dec * 7 };
      },
    },
    epiano: {
      name: "Piano électrique", icon: "🎛️",
      fn: function (f, v, t, dest) {
        const amp = gain(0), car = osc("sine", f, t), mod = osc("sine", f, t), mg = gain(0);
        mg.gain.setValueAtTime(f * (1.2 + v * 2), t);
        mg.gain.setTargetAtTime(f * 0.25, t, 0.25);
        mod.connect(mg); mg.connect(car.frequency);
        const tine = osc("sine", f * 7, t), tg = gain(0);
        tg.gain.setValueAtTime(0.12 * v, t); tg.gain.setTargetAtTime(0.0001, t, 0.05);
        tine.connect(tg); tg.connect(amp);
        car.connect(amp); amp.connect(dest);
        ampEnv(amp, t, 0.45 * v, 0.003, Math.max(0.6, 2.2 * Math.sqrt(220 / f)));
        return { stops: [car, mod, tine], amp: amp, rel: 0.25, life: Math.max(0.6, 2.2 * Math.sqrt(220 / f)) * 7 };
      },
    },
    organ: {
      name: "Orgue", icon: "⛪",
      fn: function (f, v, t, dest) {
        const amp = gain(0);
        const bars = [[0.5, 0.45], [1, 1], [2, 0.6], [3, 0.35], [4, 0.3], [6, 0.15], [8, 0.12]];
        const stops = bars.map(function (b) {
          const o = osc("sine", f * b[0], t), g = gain(b[1] * 0.22); o.connect(g); g.connect(amp); return o;
        });
        const lfo = osc("sine", 6, t), lg = gain(0.04);
        const trem = gain(1); lfo.connect(lg); lg.connect(trem.gain);
        amp.connect(trem); trem.connect(dest); stops.push(lfo);
        ampEnv(amp, t, 0.5 * (0.6 + v * 0.4), 0.012, 0.05, 1);
        return { stops: stops, amp: amp, rel: 0.08 };
      },
    },
    strings: {
      name: "Cordes", icon: "🎻",
      fn: function (f, v, t, dest) {
        const amp = gain(0), lp = filter("lowpass", clampF(Math.min(f * 6, 5000)), 0.5);
        const vib = osc("sine", 5.2, t), vg = gain(6); vib.connect(vg);
        const stops = [-9, 0, 9].map(function (d) {
          const o = osc("sawtooth", f, t, d); vg.connect(o.detune); o.connect(lp); return o;
        });
        stops.push(vib);
        lp.connect(amp); amp.connect(dest);
        ampEnv(amp, t, 0.22 * (0.5 + v * 0.5), 0.18, 0.3, 0.85);
        return { stops: stops, amp: amp, rel: 0.6 };
      },
    },
    pad: {
      name: "Nappe (pad)", icon: "🌌",
      fn: function (f, v, t, dest) {
        const amp = gain(0), lp = filter("lowpass", 400, 3);
        lp.frequency.setValueAtTime(300, t);
        lp.frequency.linearRampToValueAtTime(clampF(Math.min(f * 5, 3500)), t + 1.2);
        const stops = [-14, 0, 14].map(function (d) { const o = osc("sawtooth", f, t, d); o.connect(lp); return o; });
        const sub = osc("sine", f / 2, t), sg = gain(0.5); sub.connect(sg); sg.connect(amp); stops.push(sub);
        lp.connect(amp); amp.connect(dest);
        ampEnv(amp, t, 0.18 * (0.5 + v * 0.5), 0.5, 0.4, 0.9);
        return { stops: stops, amp: amp, rel: 1.4 };
      },
    },
    supersaw: {
      name: "Supersaw (EDM)", icon: "⚡",
      fn: function (f, v, t, dest) {
        const amp = gain(0), lp = filter("lowpass", clampF(Math.min(f * 10, 9000)), 1);
        const stops = [-28, -14, -5, 0, 5, 14, 28].map(function (d) {
          const o = osc("sawtooth", f, t, d), g = gain(0.16); o.connect(g); g.connect(lp); return o;
        });
        lp.connect(amp); amp.connect(dest);
        ampEnv(amp, t, 0.3 * (0.5 + v * 0.5), 0.01, 0.4, 0.8);
        return { stops: stops, amp: amp, rel: 0.35 };
      },
    },
    lead: {
      name: "Lead synthé", icon: "🎸",
      fn: function (f, v, t, dest) {
        const amp = gain(0), lp = filter("lowpass", clampF(f * 6), 6);
        lp.frequency.setValueAtTime(clampF(f * 12), t);
        lp.frequency.setTargetAtTime(clampF(f * 4), t, 0.15);
        const a = osc("square", f, t), b = osc("sawtooth", f, t, 7), gb = gain(0.6);
        a.connect(lp); b.connect(gb); gb.connect(lp); lp.connect(amp); amp.connect(dest);
        ampEnv(amp, t, 0.2 * (0.5 + v * 0.5), 0.005, 0.2, 0.75);
        return { stops: [a, b], amp: amp, rel: 0.15 };
      },
    },
    chip: {
      name: "8-bit rétro", icon: "👾",
      fn: function (f, v, t, dest) {
        const amp = gain(0), a = osc("square", f, t);
        a.connect(amp); amp.connect(dest);
        ampEnv(amp, t, 0.14 * (0.6 + v * 0.4), 0.002, 0.3, 0.7);
        return { stops: [a], amp: amp, rel: 0.04 };
      },
    },
    bells: {
      name: "Cloches", icon: "🔔",
      fn: function (f, v, t, dest) {
        const amp = gain(0), car = osc("sine", f, t), mod = osc("sine", f * 3.5, t), mg = gain(0);
        mg.gain.setValueAtTime(f * 3 * (0.5 + v), t); mg.gain.setTargetAtTime(f * 0.3, t, 0.6);
        mod.connect(mg); mg.connect(car.frequency); car.connect(amp); amp.connect(dest);
        ampEnv(amp, t, 0.35 * v, 0.002, 1.4);
        return { stops: [car, mod], amp: amp, rel: 0.8, life: (1.4) * 7 };
      },
    },
    musicbox: {
      name: "Boîte à musique", icon: "🎁",
      fn: function (f, v, t, dest) {
        const amp = gain(0), a = osc("sine", f * 2, t), b = osc("sine", f * 8.2, t), gb = gain(0);
        gb.gain.setValueAtTime(0.25, t); gb.gain.setTargetAtTime(0.0001, t, 0.04);
        a.connect(amp); b.connect(gb); gb.connect(amp); amp.connect(dest);
        ampEnv(amp, t, 0.4 * v, 0.002, 0.55);
        return { stops: [a, b], amp: amp, rel: 0.3, life: (0.55) * 7 };
      },
    },
    marimba: {
      name: "Marimba", icon: "🪵",
      fn: function (f, v, t, dest) {
        const amp = gain(0), a = osc("sine", f, t), b = osc("sine", f * 4, t), gb = gain(0);
        gb.gain.setValueAtTime(0.35, t); gb.gain.setTargetAtTime(0.0001, t, 0.03);
        a.connect(amp); b.connect(gb); gb.connect(amp); amp.connect(dest);
        ampEnv(amp, t, 0.55 * v, 0.002, 0.28);
        return { stops: [a, b], amp: amp, rel: 0.12, life: (0.28) * 7 };
      },
    },
    pluck: {
      name: "Guitare (pincée)", icon: "🪕",
      fn: function (f, v, t, dest) {
        const amp = gain(0), lp = filter("lowpass", clampF(f * 12), 2);
        lp.frequency.setValueAtTime(clampF(f * 14 * (0.4 + v)), t);
        lp.frequency.setTargetAtTime(clampF(f * 1.6), t, 0.12);
        const a = osc("sawtooth", f, t), b = osc("square", f, t, 5), gb = gain(0.4);
        a.connect(lp); b.connect(gb); gb.connect(lp); lp.connect(amp); amp.connect(dest);
        ampEnv(amp, t, 0.38 * v, 0.002, 0.7);
        return { stops: [a, b], amp: amp, rel: 0.2, life: (0.7) * 7 };
      },
    },
    harpsichord: {
      name: "Clavecin", icon: "🏰",
      fn: function (f, v, t, dest) {
        const amp = gain(0), hp = filter("highpass", 180, 0.7);
        const a = osc("sawtooth", f, t), b = osc("square", f * 2, t), gb = gain(0.25);
        a.connect(hp); b.connect(gb); gb.connect(hp); hp.connect(amp); amp.connect(dest);
        ampEnv(amp, t, 0.22 * (0.6 + v * 0.4), 0.002, 0.6);
        return { stops: [a, b], amp: amp, rel: 0.12, life: (0.6) * 7 };
      },
    },
    brass: {
      name: "Cuivres", icon: "🎺",
      fn: function (f, v, t, dest) {
        const amp = gain(0), lp = filter("lowpass", clampF(f), 2);
        lp.frequency.setValueAtTime(clampF(f), t);
        lp.frequency.linearRampToValueAtTime(clampF(f * 7 * (0.5 + v)), t + 0.06);
        lp.frequency.setTargetAtTime(clampF(f * 3.5), t + 0.06, 0.2);
        const stops = [-6, 6].map(function (d) { const o = osc("sawtooth", f, t, d); o.connect(lp); return o; });
        lp.connect(amp); amp.connect(dest);
        ampEnv(amp, t, 0.26 * (0.5 + v * 0.5), 0.035, 0.2, 0.8);
        return { stops: stops, amp: amp, rel: 0.12 };
      },
    },
    flute: {
      name: "Flûte", icon: "🪈",
      fn: function (f, v, t, dest) {
        const amp = gain(0), a = osc("sine", f, t), b = osc("triangle", f * 2, t), gb = gain(0.08);
        const vib = osc("sine", 5, t), vg = gain(f * 0.006); vib.connect(vg); vg.connect(a.frequency);
        const n = noise(), bp = filter("bandpass", clampF(f * 2), 2), ng = gain(0.05);
        n.connect(bp); bp.connect(ng); ng.connect(amp);
        a.connect(amp); b.connect(gb); gb.connect(amp); amp.connect(dest);
        ampEnv(amp, t, 0.38 * (0.5 + v * 0.5), 0.06, 0.2, 0.85);
        return { stops: [a, b, vib, n], amp: amp, rel: 0.12 };
      },
    },
    choir: {
      name: "Chœur", icon: "🎤",
      fn: function (f, v, t, dest) {
        const amp = gain(0), mix = gain(1);
        const vib = osc("sine", 5.5, t), vg = gain(8); vib.connect(vg);
        const stops = [-10, 0, 10].map(function (d) {
          const o = osc("sawtooth", f, t, d); vg.connect(o.detune); o.connect(mix); return o;
        });
        stops.push(vib);
        [[800, 1, 8], [1150, 0.5, 9], [2900, 0.25, 10]].forEach(function (fm) {
          const bp = filter("bandpass", fm[0], fm[2]), g = gain(fm[1]); mix.connect(bp); bp.connect(g); g.connect(amp);
        });
        amp.connect(dest);
        ampEnv(amp, t, 0.9 * (0.5 + v * 0.5), 0.25, 0.3, 0.9);
        return { stops: stops, amp: amp, rel: 0.7 };
      },
    },
    bass808: {
      name: "Basse 808", icon: "🔊", transpose: -12,
      fn: function (f, v, t, dest) {
        const amp = gain(0), o = osc("sine", f * 2.5, t), sh = ctx.createWaveShaper();
        o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.5); }
        sh.curve = curve;
        o.connect(sh); sh.connect(amp); amp.connect(dest);
        ampEnv(amp, t, 0.5 * (0.5 + v * 0.5), 0.003, 0.9);
        return { stops: [o], amp: amp, rel: 0.15, life: (0.9) * 7 };
      },
    },
    steeldrum: {
      name: "Steel drum", icon: "🥁",
      fn: function (f, v, t, dest) {
        const amp = gain(0);
        const stops = [[1, 1], [2, 0.5], [3.01, 0.25], [4.2, 0.15]].map(function (p) {
          const o = osc("sine", f * p[0], t), g = gain(p[1] * 0.3); o.connect(g); g.connect(amp); return o;
        });
        amp.connect(dest);
        ampEnv(amp, t, 0.6 * v, 0.003, 0.45);
        return { stops: stops, amp: amp, rel: 0.2, life: (0.45) * 7 };
      },
    },
  };

  // ---------------------------------------------------------------- banques HD (General MIDI)
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
  const BANKS = {
    FluidR3_GM: "Fluid (HD)",
    MusyngKite: "Musyng (HD+)",
    FatBoy: "FatBoy",
  };
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

  function loadSampler(bank, name, onProgress) {
    const key = bank + "/" + name;
    if (samplerCache[key]) return samplerCache[key];
    ensure();
    const sampler = { buffers: {}, raw: {}, keys: [], ready: false };
    const p = loadScriptFont(bank, name)
      .then(function (font) {
        Object.keys(font).forEach(function (noteName) {
          const midi = sfNameToMidi(noteName);
          const data = String(font[noteName]);
          const i = data.indexOf("base64,");
          if (midi !== null && i >= 0) sampler.raw[midi] = data.slice(i + 7);
        });
        const keys = Object.keys(sampler.raw).map(Number).sort(function (a, b) { return a - b; });
        if (!keys.length) throw new Error("Banque vide");
        sampler.keys = keys;
        let done = 0;
        // décode d'abord le registre central (le plus utilisé)
        const order = keys.slice().sort(function (a, b) { return Math.abs(a - 64) - Math.abs(b - 64); });
        return Promise.all(order.map(function (k) {
          return decode(b64ToBuf(sampler.raw[k])).then(function (buf) {
            sampler.buffers[k] = buf;
          }).catch(function () { /* note illisible : ignorée */ }).then(function () {
            done++;
            if (onProgress) onProgress(done / keys.length);
          });
        }));
      })
      .then(function () {
        sampler.raw = null;
        sampler.keys = Object.keys(sampler.buffers).map(Number).sort(function (a, b) { return a - b; });
        sampler.ready = true;
        return sampler;
      });
    p.catch(function () { delete samplerCache[key]; });
    samplerCache[key] = p;
    return p;
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

  function nearestBuffer(sampler, midi) {
    if (sampler.buffers[midi]) return { buf: sampler.buffers[midi], rate: 1 };
    let best = null, bd = 1e9;
    for (let i = 0; i < sampler.keys.length; i++) {
      const k = sampler.keys[i], d = Math.abs(k - midi);
      if (d < bd) { bd = d; best = k; }
    }
    if (best === null) return null;
    return { buf: sampler.buffers[best], rate: Math.pow(2, (midi - best) / 12) };
  }

  function samplerVoice(sampler, midi, v, t, dest) {
    const nb = nearestBuffer(sampler, midi);
    if (!nb) return null;
    const src = ctx.createBufferSource();
    src.buffer = nb.buf; src.playbackRate.value = nb.rate;
    const amp = gain(0);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(0.9 * (0.3 + v * 0.7), t + 0.004);
    src.connect(amp); amp.connect(dest);
    return { stops: [src], amp: amp, rel: 0.25, srcDur: nb.buf.duration / nb.rate };
  }

  // ---------------------------------------------------------------- voix
  function startVoice(midi, vel, when) {
    ensure();
    const t = Math.max(when || 0, ctx.currentTime);
    let v = null;
    if (current.kind === "sampler" && current.sampler) {
      v = samplerVoice(current.sampler, midi, vel, t, out);
    } else {
      const def = current.def || SYNTHS.piano;
      v = def.fn(mtof(midi + (def.transpose || 0)), vel, t, out);
    }
    if (!v) return null;
    v.stops.forEach(function (s) { s.start(t); });
    v.midi = midi; v.t = t; v.ended = false;
    voices.add(v);
    const maxEnd = t + (v.srcDur ? v.srcDur + 0.05 : (v.life || 30));
    v.stops.forEach(function (s) { try { s.stop(maxEnd); } catch (e) { /* rien */ } });
    if (v.stops[0]) v.stops[0].onended = function () { voices.delete(v); try { v.amp.disconnect(); } catch (e) { /* rien */ } };
    if (voices.size > MAX_VOICES) {
      const oldest = voices.values().next().value;
      releaseVoice(oldest, ctx.currentTime, 0.03);
    }
    return v;
  }

  function releaseVoice(v, when, relOverride) {
    if (!v || v.ended) return;
    v.ended = true;
    const t = Math.max(when || 0, ctx.currentTime);
    let rel = relOverride || v.rel;
    if (sustain && !relOverride) rel = Math.max(rel, 1.6);
    v.amp.gain.cancelScheduledValues(t);
    v.amp.gain.setTargetAtTime(0.0001, t, rel / 4);
    const end = t + rel * 1.8 + 0.05;
    v.stops.forEach(function (s) { try { s.stop(end); } catch (e) { /* rien */ } });
  }

  // ---------------------------------------------------------------- boîte à rythmes
  function drum(type, when, vol) {
    ensure();
    const t = Math.max(when || 0, ctx.currentTime);
    const g = gain(vol === undefined ? 0.8 : vol);
    g.connect(dryBus);
    if (type === "kick") {
      const o = osc("sine", 160, t), a = gain(0);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      a.gain.setValueAtTime(1, t); a.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(a); a.connect(g); o.start(t); o.stop(t + 0.5);
    } else if (type === "snare" || type === "clap") {
      const n = noise(), f = filter(type === "clap" ? "bandpass" : "highpass", type === "clap" ? 1500 : 1200, type === "clap" ? 1.5 : 0.7), a = gain(0);
      if (type === "clap") {
        [0, 0.012, 0.024].forEach(function (d) {
          a.gain.setValueAtTime(0.9, t + d); a.gain.exponentialRampToValueAtTime(0.1, t + d + 0.011);
        });
        a.gain.setValueAtTime(0.7, t + 0.036); a.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      } else {
        a.gain.setValueAtTime(0.7, t); a.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        const o = osc("triangle", 190, t), oa = gain(0);
        oa.gain.setValueAtTime(0.6, t); oa.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(oa); oa.connect(g); o.start(t); o.stop(t + 0.12);
      }
      n.connect(f); f.connect(a); a.connect(g); n.start(t); n.stop(t + 0.25);
    } else if (type === "hat" || type === "ohat") {
      const n = noise(), f = filter("highpass", 7500, 0.8), a = gain(0), d = type === "ohat" ? 0.28 : 0.045;
      a.gain.setValueAtTime(0.35, t); a.gain.exponentialRampToValueAtTime(0.001, t + d);
      n.connect(f); f.connect(a); a.connect(g); n.start(t); n.stop(t + d + 0.02);
    } else if (type === "rim") {
      const o = osc("square", 1700, t), a = gain(0), bp = filter("bandpass", 1700, 4);
      a.gain.setValueAtTime(0.4, t); a.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      o.connect(bp); bp.connect(a); a.connect(g); o.start(t); o.stop(t + 0.05);
    }
  }

  // ---------------------------------------------------------------- API publique
  window.Engine = {
    SYNTHS: SYNTHS,
    GM_NAMES: GM_NAMES,
    GM_FR: GM_FR,
    GM_FAMILIES: GM_FAMILIES,
    BANKS: BANKS,
    ensure: ensure,
    now: function () { return ctx ? ctx.currentTime : 0; },
    get ctx() { return ctx; },
    get instrumentId() { return current.id; },

    /** id : "synth:piano" ou "gm:FluidR3_GM:acoustic_grand_piano" */
    setInstrument: function (id, onProgress) {
      const parts = id.split(":");
      if (parts[0] === "gm") {
        const bank = parts[1], name = parts[2];
        return loadSampler(bank, name, onProgress).then(function (s) {
          current = { id: id, kind: "sampler", sampler: s, def: null };
          return id;
        });
      }
      const def = SYNTHS[parts[1]] || SYNTHS.piano;
      current = { id: "synth:" + (SYNTHS[parts[1]] ? parts[1] : "piano"), kind: "synth", def: def, sampler: null };
      return Promise.resolve(current.id);
    },
    isLoaded: function (id) {
      const p = id.split(":");
      return p[0] !== "gm" || !!samplerCache[p[1] + "/" + p[2]];
    },
    noteOn: function (midi, vel) { return startVoice(midi, vel === undefined ? 0.8 : vel, 0); },
    noteOff: function (v) { releaseVoice(v, 0); },
    /** Joue une note planifiée (lecture auto) */
    play: function (midi, vel, when, dur) {
      const v = startVoice(midi, vel === undefined ? 0.8 : vel, when);
      if (v) releaseVoice(v, v.t + Math.max(0.05, dur || 0.3));
      return v;
    },
    allOff: function () {
      voices.forEach(function (v) { releaseVoice(v, 0, 0.05); });
    },
    drum: drum,
    setVolume: function (x) { volume = x; if (master) master.gain.setTargetAtTime(x, ctx.currentTime, 0.02); },
    setReverb: function (x) { reverbAmount = x; if (wetBus) wetBus.gain.setTargetAtTime(x, ctx.currentTime, 0.02); },
    setSustain: function (b) { sustain = !!b; },
    instrumentLabel: function (id) {
      const p = (id || "").split(":");
      if (p[0] === "gm") {
        const i = GM_NAMES.indexOf(p[2]);
        return (i >= 0 ? GM_FR[i] : p[2]) + " · " + (BANKS[p[1]] || p[1]);
      }
      const s = SYNTHS[p[1]];
      return s ? s.name : "Piano";
    },
  };
})();
