/*
 * Piano Magique — logique de l'application.
 */
(function () {
  "use strict";

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  const clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };

  // ================================================================ stockage local
  const store = {
    get: function (k, d) {
      try { const v = localStorage.getItem("pm." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem("pm." + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ }
    },
  };

  const settings = Object.assign({
    volume: 0.85, keySize: 34, transpose: 0, sustain: false, labels: true,
    solfege: true, anyOctave: true, fall: true, preset: "goosebumps-bell", tweaks: {}, keyColor: "#f4b740",
    lessonMode: "magic", song: null, beat: "off", beatBpm: 96, beatVol: 0.7, beatSync: true, speed: 1,
  }, store.get("settings", {}));
  const saveSettings = function () { store.set("settings", settings); };

  let userSongs = store.get("songs", []);
  let favs = store.get("favs", []);

  // ================================================================ notes
  const EN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const FRN = ["Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
  const BLACK = [false, true, false, true, false, false, true, false, true, false, true, false];
  const isBlack = function (m) { return BLACK[((m % 12) + 12) % 12]; };
  function noteName(m, withOct) {
    const n = (settings.solfege ? FRN : EN)[((m % 12) + 12) % 12];
    return withOct ? n + (Math.floor(m / 12) - 1) : n;
  }

  const BASE_FR = { do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 };
  const BASE_EN = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function parseNote(s) {
    const t = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    let m = /^(do|re|mi|fa|sol|la|si)(#|b)?(-?\d)$/.exec(t);
    let base = m ? BASE_FR[m[1]] : undefined;
    if (!m) { m = /^([a-g])(#|b)?(-?\d)$/.exec(t); base = m ? BASE_EN[m[1]] : undefined; }
    if (!m) return null;
    const midi = base + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
    return midi >= 0 && midi <= 127 ? midi : null;
  }

  /** Texte -> événements { n: [midi], d: durée, l: longueur du son } */
  function parseSongText(text) {
    const events = [];
    let dur = 1;
    const tokens = String(text).replace(/\|/g, " ").split(/\s+/).filter(Boolean);
    tokens.forEach(function (tok) {
      const parts = tok.split(":");
      if (parts.length > 2) throw new Error("Durée mal écrite : « " + tok + " »");
      if (parts[1] !== undefined) {
        const d = parseFloat(parts[1].replace(",", "."));
        if (!(d > 0)) throw new Error("Durée invalide : « " + tok + " »");
        dur = d;
      }
      const head = parts[0];
      if (head === "-" || head === "_" || head === "") { events.push({ n: [], d: dur }); return; }
      const notes = head.split("+").map(function (x) {
        const m = parseNote(x);
        if (m === null) throw new Error("Note inconnue : « " + x + " » (dans « " + tok + " »)");
        return m;
      });
      events.push({ n: notes, d: dur });
    });
    if (!events.some(function (e) { return e.n.length; })) throw new Error("Aucune note trouvée.");
    return events;
  }

  function eventsToText(events) {
    let last = null;
    return events.map(function (e) {
      const head = e.n.length ? e.n.map(function (m) { return EN[m % 12] + (Math.floor(m / 12) - 1); }).join("+") : "-";
      const s = head + (e.d !== last ? ":" + e.d : "");
      last = e.d;
      return s;
    }).join(" ");
  }

  // ================================================================ morceaux
  const builtinCache = {};
  function allSongs() {
    return window.BUILTIN_SONGS.map(function (s) { return Object.assign({ builtin: true }, s); }).concat(userSongs);
  }
  function findSong(id) { return allSongs().find(function (s) { return s.id === id; }); }

  function prepare(song) {
    let events;
    if (song.events) events = song.events.map(function (e) { return Object.assign({}, e); });
    else {
      if (!builtinCache[song.id]) builtinCache[song.id] = parseSongText(song.notes);
      events = builtinCache[song.id].map(function (e) { return Object.assign({}, e); });
    }
    let t = 0, lo = 127, hi = 0;
    events.forEach(function (e) {
      e.t = t; t += e.d;
      if (!e.l) e.l = e.d;
      e.n.forEach(function (m) { lo = Math.min(lo, m); hi = Math.max(hi, m); });
    });
    const playable = events.filter(function (e) { return e.n.length; }).length;
    return {
      src: song, id: song.id, title: song.title, artist: song.artist || "", tempo: song.tempo || 240,
      q: song.q || 2, instrument: song.instrument, events: events, total: t, lo: lo, hi: hi, playable: playable,
    };
  }

  // ================================================================ état
  const S = {
    mode: "free",
    song: null,
    cur: 0,        // prochain événement (magique / apprendre)
    played: 0,     // événements joués (pour la progression)
    view: 0,       // position affichée (en unités)
    finished: false,
    pending: [],   // voix d'accompagnement planifiées
    timers: [],
    learnOk: 0, learnBad: 0,
  };
  const unitSec = function () { return S.song ? 60 / (S.song.tempo * settings.speed) : 0.25; };

  function nextPlayable(i) {
    const ev = S.song.events;
    while (i < ev.length && !ev[i].n.length) i++;
    return i;
  }

  // ================================================================ lumières des touches
  const light = { lit: {}, acc: {}, down: {}, next: {}, wrong: {} };
  function setLight(kind, midi, delta) {
    const map = light[kind];
    map[midi] = Math.max(0, (map[midi] || 0) + delta);
    const el = KB.els[midi];
    if (el) el.classList.toggle(kind, map[midi] > 0);
  }
  function clearLights(kind) {
    Object.keys(light[kind]).forEach(function (m) { light[kind][m] = 0; const el = KB.els[m]; if (el) el.classList.remove(kind); });
  }
  function later(fn, ms) {
    const id = setTimeout(function () { S.timers = S.timers.filter(function (x) { return x !== id; }); fn(); }, Math.max(0, ms));
    S.timers.push(id);
    return id;
  }
  function flash(kind, notes, delayMs, durMs) {
    later(function () {
      notes.forEach(function (m) { setLight(kind, m, 1); });
      later(function () { notes.forEach(function (m) { setLight(kind, m, -1); }); }, durMs);
    }, delayMs);
  }
  function clearTimers() {
    S.timers.forEach(clearTimeout); S.timers = [];
    ["lit", "acc", "next", "wrong"].forEach(clearLights);
  }

  // ================================================================ clavier
  const kbEl = $("#keyboard");
  const KB = { start: 48, nWhite: 15, keyW: 40, els: {}, geo: {}, whites: [], lo: 48, hi: 72, blackH: 0.62 };

  function whitesFrom(start, n) {
    const out = []; let m = start;
    while (out.length < n && m <= 108) { if (!isBlack(m)) out.push(m); m++; }
    return out;
  }
  function whiteCount(a, b) { let c = 0; for (let m = a; m <= b; m++) if (!isBlack(m)) c++; return c; }
  function whiteBelow(m) { while (isBlack(m)) m--; return m; }
  function shiftWhites(m, k) {
    let x = m;
    while (k > 0) { x++; if (!isBlack(x)) k--; }
    while (k < 0) { x--; if (!isBlack(x)) k++; }
    return x;
  }
  function clampStart(start) {
    start = clamp(whiteBelow(start), 21, 108);
    // dernière touche ≤ C8 (108)
    while (start > 21 && whitesFrom(start, KB.nWhite).length < KB.nWhite) start = shiftWhites(start, -1);
    return start;
  }

  function layoutKeyboard() {
    const w = kbEl.clientWidth, h = kbEl.clientHeight;
    if (!w) return;
    KB.nWhite = clamp(Math.round(w / settings.keySize), 7, 52);
    KB.start = clampStart(KB.start);
    KB.keyW = w / KB.nWhite;
    KB.whites = whitesFrom(KB.start, KB.nWhite);
    KB.lo = KB.whites[0]; KB.hi = KB.whites[KB.whites.length - 1];
    kbEl.innerHTML = "";
    KB.els = {}; KB.geo = {};
    const bw = KB.keyW * 0.62;
    const frag = document.createDocumentFragment();
    KB.whites.forEach(function (m, i) {
      const el = document.createElement("div");
      el.className = "key white";
      el.style.left = (i * KB.keyW) + "px";
      el.style.width = (KB.keyW + 0.5) + "px";
      const isC = m % 12 === 0;
      el.innerHTML = "<span>" + (isC || KB.keyW > 34 ? noteName(m, isC) : "") + "</span>";
      frag.appendChild(el);
      KB.els[m] = el; KB.geo[m] = { x: i * KB.keyW, w: KB.keyW, black: false };
      if (i < KB.whites.length - 1 && isBlack(m + 1)) {
        const b = document.createElement("div");
        b.className = "key black";
        const x = (i + 1) * KB.keyW - bw / 2;
        b.style.left = x + "px"; b.style.width = bw + "px";
        b.innerHTML = "<span>" + (KB.keyW > 44 ? noteName(m + 1, false) : "") + "</span>";
        frag.appendChild(b);
        KB.els[m + 1] = b; KB.geo[m + 1] = { x: x, w: bw, black: true };
      }
    });
    kbEl.appendChild(frag);
    KB.height = h;
    document.body.classList.toggle("hide-labels", !settings.labels);
    // ré-applique les lumières
    Object.keys(light).forEach(function (kind) {
      Object.keys(light[kind]).forEach(function (m) { if (light[kind][m] > 0 && KB.els[m]) KB.els[m].classList.add(kind); });
    });
    updateNextHint();
  }

  function keyAt(clientX, clientY) {
    const r = kbEl.getBoundingClientRect();
    const x = clientX - r.left, y = clientY - r.top;
    if (x < 0 || x > r.width) return null;
    if (y < r.height * KB.blackH) {
      for (const m in KB.geo) {
        const g = KB.geo[m];
        if (g.black && x >= g.x && x <= g.x + g.w) return +m;
      }
    }
    const i = clamp(Math.floor(x / KB.keyW), 0, KB.whites.length - 1);
    return KB.whites[i];
  }

  function fitKeyboardToSong() {
    if (!S.song || !KB.nWhite) return;
    const lo = S.song.lo, hi = S.song.hi;
    const span = whiteCount(whiteBelow(lo), hi);
    let start;
    if (span <= KB.nWhite) {
      start = shiftWhites(whiteBelow(lo), -Math.floor((KB.nWhite - span) / 2));
    } else {
      // trop large : on cadre sur la mélodie (notes les plus hautes)
      const tops = S.song.events.filter(function (e) { return e.n.length; }).map(function (e) { return Math.max.apply(null, e.n); }).sort(function (a, b) { return a - b; });
      const med = tops[Math.floor(tops.length / 2)] || 60;
      start = shiftWhites(whiteBelow(med), -Math.floor(KB.nWhite / 2));
    }
    KB.start = clampStart(start);
    layoutKeyboard();
  }

  function shiftOctave(dir) {
    KB.start = clampStart(KB.start + 12 * dir);
    layoutKeyboard();
  }

  // ================================================================ jouer
  const tr = function (m) { return clamp(m + settings.transpose, 0, 127); };

  function cancelPending() {
    const now = Engine.now();
    S.pending = S.pending.filter(function (p) {
      if (p.v && p.v.t > now + 0.01) { Engine.noteOff(p.v); return false; }
      return p.v && p.v.t + 30 > now;
    });
  }

  /** Joue l'événement i (notes + accompagnement). Renvoie les voix tenues. */
  function triggerEvent(i, vel) {
    const ev = S.song.events[i];
    cancelPending();
    const voices = ev.n.map(function (m) { return Engine.noteOn(tr(m), vel); });
    if (ev.x) {
      const now = Engine.now(), us = unitSec();
      ev.x.forEach(function (x) {
        const when = now + x[0] * us, dur = x[2] * us;
        x[1].forEach(function (m) {
          const v = Engine.play(tr(m), vel * 0.75, when, dur);
          if (v) S.pending.push({ v: v });
        });
        flash("acc", x[1], x[0] * us * 1000, Math.max(80, dur * 1000));
      });
    }
    return voices;
  }

  function advance(i) {
    S.played = i + 1;
    S.cur = nextPlayable(i + 1);
    if (S.cur >= S.song.events.length) {
      S.finished = true;
      if (S.mode === "learn") {
        const tot = S.learnOk + S.learnBad;
        toast("Bravo ! " + (tot ? Math.round(100 * S.learnOk / tot) + " % de bonnes notes. " : "") + "Rejoue quand tu veux.");
      } else {
        toast("Bravo ! Tape pour rejouer.");
      }
    }
    updateProgress();
    updateNextHint();
  }

  function restartSong() {
    stopAuto();
    clearTimers();
    cancelPending();
    S.cur = S.song ? nextPlayable(0) : 0;
    S.played = 0;
    S.finished = false;
    S.learnOk = 0; S.learnBad = 0;
    S.view = S.song && S.song.events[S.cur] ? S.song.events[S.cur].t : 0;
    updateProgress();
    updateNextHint();
  }

  /** Une touche (ou un tap) commence. Renvoie un "handle" pour la relâcher. */
  function press(midi, vel) {
    Engine.ensure();
    hideHint();
    const h = { voices: [], lights: [], down: midi };
    if (midi !== null && midi !== undefined) setLight("down", midi, 1);

    const songMode = S.song && (S.mode === "magic" || S.mode === "learn");
    if (songMode && S.finished) restartSong();

    if (S.song && S.mode === "magic") {
      const i = S.cur;
      if (i < S.song.events.length) {
        h.voices = triggerEvent(i, vel);
        h.lights = S.song.events[i].n.slice();
        h.lights.forEach(function (m) { setLight("lit", m, 1); });
        advance(i);
      }
    } else if (S.song && S.mode === "learn" && midi !== null && midi !== undefined) {
      const i = S.cur, ev = S.song.events[i];
      const target = Math.max.apply(null, ev.n);
      const ok = midi === target || (settings.anyOctave && (midi - target) % 12 === 0);
      if (ok) {
        S.learnOk++;
        h.voices = triggerEvent(i, vel);
        h.lights = ev.n.slice();
        h.lights.forEach(function (m) { setLight("lit", m, 1); });
        advance(i);
      } else {
        S.learnBad++;
        h.voices = [Engine.noteOn(tr(midi), vel * 0.7)];
        setLight("wrong", midi, 1);
        later(function () { setLight("wrong", midi, -1); }, 260);
      }
    } else if (midi !== null && midi !== undefined) {
      h.voices = [Engine.noteOn(tr(midi), vel)];
      h.lights = [midi];
      setLight("lit", midi, 1);
      freeTrail(midi, h);
      if (Rec.active) h.rec = Rec.noteOn(midi);
    }
    return h;
  }

  function release(h) {
    if (!h || h.released) return;
    h.released = true;
    h.voices.forEach(function (v) { if (v) Engine.noteOff(v); });
    h.lights.forEach(function (m) { setLight("lit", m, -1); });
    if (h.down !== null && h.down !== undefined) setLight("down", h.down, -1);
    if (h.trail) h.trail.end = performance.now();
    if (h.rec) Rec.noteOff(h.rec);
  }

  // ---------------------------------------------------------------- pointeurs
  const pointers = new Map();
  function velocityFromY(clientY) {
    const r = kbEl.getBoundingClientRect();
    return clamp(0.55 + 0.45 * (clientY - r.top) / r.height, 0.4, 1);
  }
  kbEl.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    try { kbEl.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
    const m = keyAt(e.clientX, e.clientY);
    if (m === null) return;
    pointers.set(e.pointerId, { midi: m, h: press(m, velocityFromY(e.clientY)) });
  });
  kbEl.addEventListener("pointermove", function (e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const m = keyAt(e.clientX, e.clientY);
    if (m === null || m === p.midi) return;
    release(p.h);
    p.midi = m; p.h = press(m, velocityFromY(e.clientY) * 0.9);
  });
  const endPointer = function (e) {
    const p = pointers.get(e.pointerId);
    if (p) { release(p.h); pointers.delete(e.pointerId); }
  };
  kbEl.addEventListener("pointerup", endPointer);
  kbEl.addEventListener("pointercancel", endPointer);
  kbEl.addEventListener("lostpointercapture", endPointer);
  kbEl.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  // La scène entière sert de "pad" en mode Magique
  const stage = $("#stage");
  const stagePointers = new Map();
  stage.addEventListener("pointerdown", function (e) {
    if (e.target.closest("button, input, label")) return;
    if (S.mode !== "magic" || !S.song) return;
    e.preventDefault();
    stagePointers.set(e.pointerId, press(null, 0.8));
  });
  const endStage = function (e) { const h = stagePointers.get(e.pointerId); if (h) { release(h); stagePointers.delete(e.pointerId); } };
  stage.addEventListener("pointerup", endStage);
  stage.addEventListener("pointercancel", endStage);
  stage.addEventListener("pointerleave", endStage);

  // ---------------------------------------------------------------- clavier d'ordinateur
  const KEYMAP = {
    KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11,
    KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17, BracketRight: 18, Backslash: 19,
  };
  const keysDown = {};
  function anyPanelOpen() { return !!document.querySelector(".panel:not([hidden])"); }
  window.addEventListener("keydown", function (e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || "";
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || anyPanelOpen()) {
      if (e.key === "Escape") closePanels();
      return;
    }
    if (e.code === "ArrowLeft") { shiftOctave(-1); e.preventDefault(); return; }
    if (e.code === "ArrowRight") { shiftOctave(1); e.preventDefault(); return; }
    if (e.code === "ArrowUp") { nextPreset(-1); e.preventDefault(); return; }
    if (e.code === "ArrowDown") { nextPreset(1); e.preventDefault(); return; }
    if (e.code === "Tab" || e.code === "Escape" || /^F\d+$/.test(e.code)) return;
    if (keysDown[e.code]) return;
    let midi = null;
    if (KEYMAP[e.code] !== undefined) {
      let c = KB.lo; while (c % 12 !== 0) c++;
      midi = c + KEYMAP[e.code];
      if (midi - 12 >= KB.lo && c - KB.lo >= 7) midi -= 12;
    }
    if (S.mode === "magic" && S.song) {
      if (e.code === "Space") e.preventDefault();
      keysDown[e.code] = press(midi, 0.8);
    } else if (S.mode === "auto" && e.code === "Space") {
      e.preventDefault(); toggleAuto();
    } else if (midi !== null) {
      keysDown[e.code] = press(midi, 0.8);
    }
  });
  window.addEventListener("keyup", function (e) {
    const h = keysDown[e.code];
    if (h) { release(h); delete keysDown[e.code]; }
  });
  window.addEventListener("blur", function () {
    Object.keys(keysDown).forEach(function (k) { release(keysDown[k]); delete keysDown[k]; });
  });

  // ================================================================ lecture auto
  const Auto = { playing: false, startCtx: 0, startUnit: 0, idx: 0, timer: null };

  function autoPos() {
    if (!Auto.playing) return S.view;
    return Auto.startUnit + (Engine.now() - Auto.startCtx) / unitSec();
  }

  function startAuto() {
    if (!S.song) return;
    Engine.ensure();
    hideHint();
    if (S.finished || S.cur >= S.song.events.length) restartSong();
    Auto.playing = true;
    Auto.startUnit = S.song.events[S.cur] ? S.song.events[S.cur].t : 0;
    Auto.startCtx = Engine.now() + 0.1;
    Auto.idx = S.cur;
    Auto.timer = setInterval(autoTick, 25);
    autoTick();
    $("#btnPlay").classList.add("playing");
    if (Beat.style !== "off") Beat.restart(Auto.startCtx);
  }
  function autoTick() {
    const ev = S.song.events, us = unitSec(), now = Engine.now();
    const horizon = now + 0.15;
    while (Auto.idx < ev.length) {
      const e = ev[Auto.idx];
      const when = Auto.startCtx + (e.t - Auto.startUnit) * us;
      if (when > horizon) break;
      const delay = (when - now) * 1000;
      e.n.forEach(function (m) { Engine.play(tr(m), 0.75, when, e.l * us); });
      if (e.n.length) flash("lit", e.n, delay, Math.max(90, Math.min(e.l, e.d) * us * 1000 - 20));
      if (e.x) {
        e.x.forEach(function (x) {
          x[1].forEach(function (m) { Engine.play(tr(m), 0.55, when + x[0] * us, x[2] * us); });
          flash("acc", x[1], delay + x[0] * us * 1000, Math.max(80, x[2] * us * 1000));
        });
      }
      const idx = Auto.idx;
      later(function () {
        S.played = idx + 1;
        S.cur = nextPlayable(idx + 1);
        updateProgress();
      }, delay);
      Auto.idx++;
    }
    if (Auto.idx >= ev.length) {
      const endAt = Auto.startCtx + (S.song.total - Auto.startUnit) * us + 0.6;
      if (now > endAt) {
        stopAuto();
        S.finished = true;
        S.cur = ev.length;
        toast("Fin du morceau");
      }
    }
  }
  function stopAuto() {
    if (!Auto.playing) return;
    S.view = autoPos();
    Auto.playing = false;
    clearInterval(Auto.timer);
    // reprend à l'événement suivant la position actuelle
    if (S.song) {
      let i = 0; const ev = S.song.events;
      while (i < ev.length && ev[i].t < S.view - 0.01) i++;
      S.cur = nextPlayable(i);
    }
    Engine.allOff();
    clearTimers();
    $("#btnPlay").classList.remove("playing");
    updateProgress();
  }
  function toggleAuto() { if (Auto.playing) stopAuto(); else startAuto(); }
  function reanchor() {
    if (!Auto.playing) return;
    const pos = autoPos();
    Auto.startUnit = pos; Auto.startCtx = Engine.now();
  }

  // ================================================================ boîte à rythmes
  const BEATS = {
    off: { name: "Off" },
    pop: { name: "Pop", k: "x.......x.x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
    hiphop: { name: "Hip-hop", k: "x......x..x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.xx" },
    trap: { name: "Trap", k: "x.........x..x..", c: "........x.......", h: "xxxxxxxxx.xxxxxx", o: "..............x." },
    house: { name: "House", k: "x...x...x...x...", c: "....x.......x...", o: "..x...x...x...x.", h: "x.x.x.x.x.x.x.x." },
    reggaeton: { name: "Reggaeton", k: "x...x...x...x...", s: "...x..x....x..x.", h: "x.x.x.x.x.x.x.x." },
    rock: { name: "Rock", k: "x.....x.x.......", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
    afro: { name: "Afro", k: "x..x..x...x..x..", r: "..x...x...x...x.", c: "....x.......x...", h: "x.x.xx.xx.x.xx.x" },
    funk: { name: "Funk", k: "x.x....x..x.....", s: "....x..x.x..x..x", h: "xxxxxxxxxxxxxxxx" },
    valse: { name: "Valse (3/4)", steps: 12, k: "x...........", s: "....x...x...", h: "x.x.x.x.x.x." },
    metro: { name: "Métronome", k: "x...", r: "..x." },
  };
  const DRUM_OF = { k: "kick", s: "snare", c: "clap", h: "hat", o: "ohat", r: "rim" };

  const Beat = {
    style: settings.beat, step: 0, nextTime: 0, timer: null,
    bpm: function () {
      if (settings.beatSync && S.song) return clamp(S.song.tempo / S.song.q * settings.speed, 40, 220);
      return settings.beatBpm;
    },
    steps: function () {
      const b = BEATS[this.style];
      return b.steps || (b.k ? b.k.length : 16);
    },
    start: function (at) {
      this.stop();
      if (this.style === "off") return;
      Engine.ensure();
      this.step = 0;
      this.nextTime = Math.max(at || 0, Engine.now() + 0.05);
      this.timer = setInterval(this.tick.bind(this), 25);
      this.tick();
    },
    restart: function (at) { this.start(at); },
    stop: function () { clearInterval(this.timer); this.timer = null; },
    tick: function () {
      const b = BEATS[this.style];
      if (!b || this.style === "off") return;
      const n = this.steps();
      const stepDur = 60 / this.bpm() / (this.style === "metro" ? 1 : 4);
      const now = Engine.now();
      while (this.nextTime < now + 0.12) {
        const st = this.step % n;
        Object.keys(DRUM_OF).forEach(function (k) {
          if (b[k] && b[k][st] === "x") Engine.drum(DRUM_OF[k], Beat.nextTime, settings.beatVol * (k === "h" && st % 2 ? 0.6 : 1));
        });
        const s = st;
        later(function () { highlightStep(s); }, (this.nextTime - now) * 1000);
        this.nextTime += stepDur;
        this.step++;
      }
    },
  };

  // ================================================================ enregistrement
  const Rec = {
    active: false, t0: 0, notes: [],
    start: function () {
      Engine.ensure();
      this.active = true; this.notes = []; this.t0 = performance.now();
      $("#btnRec").classList.add("recording");
      toast("Enregistrement… joue ton morceau puis appuie sur ■");
    },
    noteOn: function (midi) {
      const n = { midi: midi, s: performance.now() - this.t0, e: null };
      this.notes.push(n); return n;
    },
    noteOff: function (n) { n.e = performance.now() - this.t0; },
    stop: function () {
      this.active = false;
      $("#btnRec").classList.remove("recording");
      if (!this.notes.length) { toast("Rien n'a été enregistré."); return; }
      const unitMs = 125; // double-croche à 120 BPM
      const groups = [];
      this.notes.forEach(function (n) {
        const g = groups[groups.length - 1];
        if (g && n.s - g.s < 45) { if (g.n.indexOf(n.midi) < 0) g.n.push(n.midi); g.e = Math.max(g.e, n.e || n.s + 300); }
        else groups.push({ s: n.s, e: n.e || n.s + 300, n: [n.midi] });
      });
      const events = groups.map(function (g, i) {
        const next = groups[i + 1];
        const d = next ? Math.max(1, Math.round((next.s - g.s) / unitMs)) : Math.max(2, Math.round((g.e - g.s) / unitMs));
        return { n: g.n.sort(function (a, b) { return a - b; }), d: d };
      });
      Rec.pendingSong = {
        id: "u" + Date.now(), title: "", artist: "Moi", cat: "Mes morceaux", tempo: 480, q: 4,
        instrument: settings.preset, text: eventsToText(events), bpm: 120, unit: 4,
      };
      $("#saveInfo").textContent = groups.length + " notes enregistrées. Donne-lui un nom pour le retrouver dans « Mes morceaux ».";
      $("#saveName").value = "Mon enregistrement " + (userSongs.length + 1);
      openPanel("panelSave");
    },
  };

  // ================================================================ notes qui tombent (canvas)
  const canvas = $("#fall"), g2 = canvas.getContext("2d");
  let cw = 0, ch = 0, dpr = 1;
  const trails = [];
  function freeTrail(midi, h) {
    if (!settings.fall) return;
    const t = { midi: midi, start: performance.now(), end: null };
    trails.push(t); h.trail = t;
    if (trails.length > 80) trails.shift();
  }
  function resizeCanvas() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = stage.clientWidth; ch = stage.clientHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g2.beginPath();
    g2.moveTo(x + r, y); g2.lineTo(x + w - r, y); g2.quadraticCurveTo(x + w, y, x + w, y + r);
    g2.lineTo(x + w, y + h - r); g2.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g2.lineTo(x + r, y + h); g2.quadraticCurveTo(x, y + h, x, y + h - r);
    g2.lineTo(x, y + r); g2.quadraticCurveTo(x, y, x + r, y);
    g2.closePath();
  }
  const css = getComputedStyle(document.documentElement);
  const COL = {
    gold: css.getPropertyValue("--gold").trim() || "#f4b740",
    teal: css.getPropertyValue("--teal").trim() || "#47c2b1",
    felt: css.getPropertyValue("--felt").trim() || "#b4263f",
    ivory: css.getPropertyValue("--ivory").trim() || "#f1e9d8",
    line: css.getPropertyValue("--lacquer-3").trim() || "#282433",
  };

  let lastFrame = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    g2.clearRect(0, 0, cw, ch);
    const kbr = kbEl.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    const ox = kbr.left - sr.left;
    const hitY = ch;

    if (settings.fall && S.song && S.mode !== "free") {
      // position
      if (S.mode === "auto" && Auto.playing) {
        S.view = autoPos();
      } else if (S.mode !== "auto") {
        const target = S.finished ? S.song.total : (S.song.events[S.cur] ? S.song.events[S.cur].t : S.song.total);
        S.view += (target - S.view) * Math.min(1, dt * 14);
      }
      const ppu = Math.max(8, (ch * 0.85) / (S.song.q * 5));
      const ev = S.song.events;
      // barres de mesure (toutes les 4 noires)
      g2.strokeStyle = COL.line; g2.lineWidth = 1;
      const bar = S.song.q * 4;
      for (let b = Math.ceil(S.view / bar) * bar; ; b += bar) {
        const y = hitY - (b - S.view) * ppu;
        if (y < 0) break;
        g2.beginPath(); g2.moveTo(0, Math.round(y) + 0.5); g2.lineTo(cw, Math.round(y) + 0.5); g2.stroke();
      }
      let i = 0;
      while (i < ev.length && ev[i].t + ev[i].l + 8 < S.view) i++;
      for (; i < ev.length; i++) {
        const e = ev[i];
        if ((e.t - S.view) * ppu > ch + 20) break;
        const isNext = (S.mode === "magic" || S.mode === "learn") && i === S.cur && !S.finished;
        if (e.x) {
          e.x.forEach(function (x) {
            x[1].forEach(function (m) { drawBar(m, e.t + x[0], x[2], ppu, ox, hitY, COL.teal, 0.45, false); });
          });
        }
        e.n.forEach(function (m, k) {
          drawBar(m, e.t, Math.min(e.l, Math.max(e.d, 0.5)), ppu, ox, hitY, k === 0 ? COL.gold : COL.felt, isNext ? 1 : 0.85, isNext);
        });
      }
    } else if (settings.fall) {
      // mode libre : traînées qui montent
      const speed = 0.18; // px par ms
      for (let k = trails.length - 1; k >= 0; k--) {
        const t = trails[k], gg = KB.geo[t.midi];
        const top = hitY - (now - t.start) * speed;
        const bottom = t.end ? hitY - (now - t.end) * speed : hitY;
        if (bottom < -10) { trails.splice(k, 1); continue; }
        if (!gg) continue;
        g2.globalAlpha = 0.9;
        g2.fillStyle = gg.black ? COL.felt : COL.gold;
        roundRect(ox + gg.x + 2, Math.max(-10, top), gg.w - 4, Math.max(4, bottom - top), 5);
        g2.fill();
      }
      g2.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }
  function drawBar(m, t, len, ppu, ox, hitY, color, alpha, glow) {
    const gg = KB.geo[m];
    const bottom = hitY - (t - S.view) * ppu;
    const h = Math.max(6, len * ppu - 3);
    const top = bottom - h;
    if (bottom < -4 || top > hitY + 4) return;
    let x, w;
    if (gg) { x = ox + gg.x + 2; w = gg.w - 4; }
    else {
      // hors du clavier : petite pastille sur le bord
      w = 10; x = m < KB.lo ? 2 : cw - 12;
      alpha *= 0.5;
    }
    g2.globalAlpha = alpha;
    if (glow) { g2.shadowColor = color; g2.shadowBlur = 18; }
    g2.fillStyle = color;
    roundRect(x, top, w, Math.min(h, bottom - top), Math.min(6, w / 3));
    g2.fill();
    g2.shadowBlur = 0;
    if (gg && w >= 18 && h >= 16 && color !== COL.teal) {
      g2.globalAlpha = 1;
      g2.fillStyle = "#2a1c00";
      g2.font = "600 " + Math.min(12, w * 0.38) + "px Figtree, system-ui, sans-serif";
      g2.textAlign = "center"; g2.textBaseline = "bottom";
      g2.fillText(noteName(m, false), x + w / 2, bottom - 3);
    }
    g2.globalAlpha = 1;
  }

  // ================================================================ interface
  let toastTimer = null;
  function toast(msg, ms) {
    const el = $("#toast");
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, ms || 2600);
  }
  function hideHint() { $("#hint").classList.add("gone"); }
  function updateHint() {
    const h = $("#hint");
    const txt = {
      magic: ["Tape n'importe où", "Chaque tap joue la note suivante. Glisse sur les touches pour aller plus vite."],
      learn: ["Joue la touche dorée", "La bonne note fait avancer le morceau. L'accompagnement suit tout seul."],
      auto: ["Appuie sur lecture", "Le morceau se joue tout seul. Règle la vitesse et regarde les notes."],
      free: ["Joue !", "Touche le clavier pour essayer le son. Change de son avec ‹ ›, ou ouvre « Leçons » pour apprendre un morceau."],
    }[S.mode];
    h.querySelector("strong").textContent = txt[0];
    h.querySelector("span").textContent = txt[1];
    h.classList.remove("gone");
  }
  function updateProgress() {
    const total = S.song ? S.song.events.length : 0;
    const pct = total ? (100 * Math.min(S.played, total) / total) : 0;
    $("#progressBar").style.width = pct + "%";
    let count = 0;
    if (S.song) for (let i = 0; i < Math.min(S.played, total); i++) if (S.song.events[i].n.length) count++;
    $("#counter").textContent = S.song ? count + " / " + S.song.playable : "";
  }
  function updateNextHint() {
    clearLights("next");
    if (S.mode === "learn" && S.song && !S.finished && S.song.events[S.cur]) {
      const ev = S.song.events[S.cur];
      const target = Math.max.apply(null, ev.n);
      let m = target;
      if (!KB.els[m] && settings.anyOctave) {
        // propose la même note dans l'octave visible
        for (let k = KB.lo; k <= KB.hi; k++) if ((k - target) % 12 === 0) { m = k; break; }
      }
      setLight("next", m, 1);
    }
  }

  function setMode(mode) {
    if (!S.song) mode = "free";
    if (mode === "free" && S.song) mode = settings.lessonMode || "magic";
    stopAuto();
    S.mode = mode;
    if (mode !== "free") { settings.lessonMode = mode; saveSettings(); }
    $("#app").className = "mode-" + mode;
    $$(".modes button").forEach(function (b) { const on = b.dataset.mode === mode; b.classList.toggle("active", on); b.setAttribute("aria-selected", on); });
    if (Rec.active && mode !== "free") Rec.stop();
    clearTimers();
    if (S.song && S.finished) restartSong();
    $("#lessonBar").hidden = !S.song;
    $("#hud").hidden = !S.song;
    updateHint();
    updateNextHint();
  }

  /** Démarre une leçon (morceau) */
  function loadSong(id) {
    const song = findSong(id);
    if (!song) return;
    stopAuto();
    S.song = prepare(song);
    settings.song = song.id; saveSettings();
    $("#songTitle").textContent = S.song.title + (S.song.artist ? " · " + S.song.artist : "");
    restartSong();
    S.view = S.song.events[S.cur] ? S.song.events[S.cur].t - S.song.q * 2 : 0;
    fitKeyboardToSong();
    S.mode = "";
    setMode(settings.lessonMode || "magic");
    refreshBeatUi();
  }
  function quitLesson() {
    stopAuto();
    clearTimers();
    S.song = null; settings.song = null; saveSettings();
    setMode("free");
    updateProgress();
    refreshBeatUi();
  }

  // ---------------------------------------------------------------- panneaux
  let openId = null;
  function openPanel(id) {
    closePanels();
    openId = id;
    $("#scrim").hidden = false;
    const p = document.getElementById(id);
    p.hidden = false;
    const f = p.querySelector("input.search, input[type=text]");
    if (f && window.matchMedia("(pointer: fine)").matches) setTimeout(function () { f.focus(); }, 50);
  }
  function closePanels() {
    $$(".panel").forEach(function (p) { p.hidden = true; });
    $("#scrim").hidden = true;
    if (openId === "panelBeat") stepsEl = null;
    openId = null;
  }
  $("#scrim").addEventListener("click", closePanels);
  $$("[data-close]").forEach(function (b) { b.addEventListener("click", closePanels); });

  // ---------------------------------------------------------------- bibliothèque
  let libCat = "Tous";
  const norm = function (s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); };
  function renderLibrary() {
    const cats = ["Tous", "Favoris", "Mes morceaux"];
    window.BUILTIN_SONGS.forEach(function (s) { if (cats.indexOf(s.cat) < 0) cats.push(s.cat); });
    $("#libCats").innerHTML = "";
    cats.forEach(function (c) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip" + (c === libCat ? " active" : "");
      b.textContent = c === "Favoris" ? "★ Favoris" : c;
      b.addEventListener("click", function () { libCat = c; renderLibrary(); });
      $("#libCats").appendChild(b);
    });
    const q = norm($("#libSearch").value);
    const list = allSongs().filter(function (s) {
      if (libCat === "Favoris" && favs.indexOf(s.id) < 0) return false;
      if (libCat === "Mes morceaux" && s.builtin) return false;
      if (libCat !== "Tous" && libCat !== "Favoris" && libCat !== "Mes morceaux" && s.cat !== libCat) return false;
      return !q || norm(s.title + " " + s.artist + " " + s.cat).indexOf(q) >= 0;
    });
    const ul = $("#libList");
    ul.innerHTML = "";
    if (!list.length) {
      const li = document.createElement("li");
      li.innerHTML = '<span class="empty"></span>';
      li.firstChild.textContent = libCat === "Mes morceaux"
        ? "Aucun morceau perso. Importe un MIDI, écris un morceau ou enregistre-toi en mode Libre."
        : libCat === "Favoris" ? "Touche ☆ à côté d'un morceau pour l'ajouter ici." : "Aucun résultat.";
      ul.appendChild(li);
      return;
    }
    list.forEach(function (s) {
      const li = document.createElement("li");
      if (S.song && S.song.id === s.id) li.className = "current";
      const fav = favs.indexOf(s.id) >= 0;
      const star = document.createElement("button");
      star.type = "button"; star.className = "mini" + (fav ? " fav" : "");
      star.textContent = fav ? "★" : "☆";
      star.setAttribute("aria-label", fav ? "Retirer des favoris" : "Ajouter aux favoris");
      star.addEventListener("click", function () {
        if (favs.indexOf(s.id) >= 0) favs = favs.filter(function (x) { return x !== s.id; }); else favs.push(s.id);
        store.set("favs", favs); renderLibrary();
      });
      const pick = document.createElement("button");
      pick.type = "button"; pick.className = "pick";
      pick.innerHTML = '<span class="t"></span><span class="a"></span>';
      pick.querySelector(".t").textContent = s.title;
      pick.querySelector(".a").textContent = [s.artist, s.cat].filter(Boolean).join(" · ");
      pick.addEventListener("click", function () { loadSong(s.id); closePanels(); toast("♪ " + s.title); });
      li.appendChild(star); li.appendChild(pick);
      if (!s.builtin) {
        if (s.text) {
          const ed = document.createElement("button");
          ed.type = "button"; ed.className = "mini"; ed.textContent = "✎"; ed.setAttribute("aria-label", "Modifier");
          ed.addEventListener("click", function () { openEditor(s); });
          li.appendChild(ed);
        }
        const del = document.createElement("button");
        del.type = "button"; del.className = "mini"; del.textContent = "🗑"; del.setAttribute("aria-label", "Supprimer");
        del.addEventListener("click", function () { confirmDelete(s); });
        li.appendChild(del);
      }
      ul.appendChild(li);
    });
  }
  $("#btnLessons").addEventListener("click", function () { renderLibrary(); openPanel("panelLibrary"); });
  $("#libSearch").addEventListener("input", renderLibrary);

  function saveUserSongs() { store.set("songs", userSongs); }
  function upsertSong(song) {
    const i = userSongs.findIndex(function (s) { return s.id === song.id; });
    if (i >= 0) userSongs[i] = song; else userSongs.push(song);
    saveUserSongs();
  }
  function confirmDelete(s) {
    $("#confText").textContent = "« " + s.title + " » sera supprimé de cet appareil.";
    openPanel("panelConfirm");
    $("#confOk").onclick = function () {
      userSongs = userSongs.filter(function (x) { return x.id !== s.id; });
      saveUserSongs();
      if (S.song && S.song.id === s.id) loadSong(window.BUILTIN_SONGS[0].id);
      closePanels(); toast("Supprimé"); libCat = "Mes morceaux"; renderLibrary(); openPanel("panelLibrary");
    };
  }

  // ---------------------------------------------------------------- éditeur
  let editing = null;
  function openEditor(song) {
    editing = song || null;
    $("#edTitle").textContent = song ? "Modifier le morceau" : "Écrire un morceau";
    $("#edName").value = song ? song.title : "";
    $("#edArtist").value = song ? (song.artist || "") : "";
    $("#edBpm").value = song ? (song.bpm || Math.round(song.tempo / song.q)) : 100;
    $("#edUnit").value = String(song ? (song.unit || song.q) : 2);
    $("#edNotes").value = song ? song.text : "";
    $("#edError").textContent = "";
    openPanel("panelEditor");
  }
  function readEditor() {
    const title = $("#edName").value.trim();
    if (!title) throw new Error("Donne un titre à ton morceau.");
    const events = parseSongText($("#edNotes").value);
    const bpm = clamp(parseFloat($("#edBpm").value) || 100, 20, 300);
    const unit = parseInt($("#edUnit").value, 10) || 2;
    return {
      id: editing ? editing.id : "u" + Date.now(), title: title, artist: $("#edArtist").value.trim(),
      cat: "Mes morceaux", tempo: bpm * unit, q: unit, bpm: bpm, unit: unit,
      instrument: editing ? editing.instrument : settings.preset, text: $("#edNotes").value.trim(), events: events,
    };
  }
  $("#btnNewSong").addEventListener("click", function () { openEditor(null); });
  $("#edForm").addEventListener("submit", function (e) {
    e.preventDefault();
    try {
      const s = readEditor();
      upsertSong(s); closePanels(); loadSong(s.id); toast("Enregistré dans « Mes morceaux »");
    } catch (err) { $("#edError").textContent = err.message; }
  });
  let previewTimer = null;
  $("#edPreview").addEventListener("click", function () {
    try {
      const s = readEditor();
      Engine.ensure();
      Engine.allOff(); clearTimeout(previewTimer);
      const us = 60 / s.tempo; let t = Engine.now() + 0.1, total = 0;
      s.events.forEach(function (e) { e.n.forEach(function (m) { Engine.play(tr(m), 0.75, t, e.d * us); }); t += e.d * us; total += e.d * us; });
      $("#edError").textContent = "";
      toast("Aperçu : " + Math.round(total) + " s");
    } catch (err) { $("#edError").textContent = err.message; }
  });

  // ---------------------------------------------------------------- import MIDI
  let midiData = null, midiFileName = "";
  $("#btnImportMidi").addEventListener("click", function () { $("#fileMidi").value = ""; $("#fileMidi").click(); });
  $("#fileMidi").addEventListener("change", function () {
    const f = this.files && this.files[0];
    if (!f) return;
    midiFileName = f.name.replace(/\.(mid|midi)$/i, "").replace(/[_-]+/g, " ").trim();
    f.arrayBuffer().then(function (buf) {
      midiData = MidiImport.parse(buf);
      const tracks = midiData.tracks;
      if (!tracks.length) throw new Error("Aucune note dans ce fichier.");
      const melodic = tracks.map(function (t, i) { return { t: t, i: i }; }).filter(function (x) { return !x.t.isDrums; });
      if (!melodic.length) throw new Error("Ce fichier ne contient que de la batterie.");
      // mélodie probable : piste la plus aiguë avec assez de notes
      const best = melodic.slice().sort(function (a, b) {
        const sa = a.t.avgPitch + Math.min(20, a.t.notes.length / 10), sb = b.t.avgPitch + Math.min(20, b.t.notes.length / 10);
        return sb - sa;
      })[0];
      const label = function (x) { return (x.t.name || "Piste " + (x.i + 1)) + " — " + x.t.notes.length + " notes"; };
      const sel = $("#midiMelody"); sel.innerHTML = "";
      melodic.forEach(function (x) {
        const o = document.createElement("option"); o.value = x.i; o.textContent = label(x);
        if (x === best) o.selected = true; sel.appendChild(o);
      });
      const acc = $("#midiAcc"); acc.innerHTML = "";
      melodic.forEach(function (x) {
        const l = document.createElement("label"); l.className = "check";
        const c = document.createElement("input"); c.type = "checkbox"; c.value = x.i; c.checked = x !== best; c.id = "acc" + x.i;
        l.htmlFor = c.id;
        l.appendChild(c); l.appendChild(document.createTextNode(" " + label(x)));
        acc.appendChild(l);
      });
      $("#midiName").value = midiFileName;
      $("#midiError").textContent = "";
      openPanel("panelMidi");
    }).catch(function (err) { toast("Import impossible : " + err.message, 4000); });
  });
  $("#midiForm").addEventListener("submit", function (e) {
    e.preventDefault();
    try {
      const mel = parseInt($("#midiMelody").value, 10);
      const acc = $$("#midiAcc input:checked").map(function (c) { return parseInt(c.value, 10); });
      const conv = MidiImport.toSong(midiData, mel, acc, { maxChord: parseInt($("#midiChord").value, 10) });
      const song = {
        id: "u" + Date.now(), title: $("#midiName").value.trim() || midiFileName || "Import MIDI", artist: "Import MIDI",
        cat: "Mes morceaux", tempo: conv.tempo, q: conv.q, events: conv.events,
        instrument: settings.preset,
      };
      const json = JSON.stringify(song);
      if (json.length > 3500000) throw new Error("Morceau trop long pour être gardé sur l'appareil.");
      upsertSong(song);
      if (store.get("songs", []).length !== userSongs.length) toast("Attention : espace de stockage plein, le morceau ne sera pas gardé.", 4000);
      closePanels(); loadSong(song.id, { keepSound: true });
      toast("♪ " + song.title + " — " + conv.events.length + " taps");
    } catch (err) { $("#midiError").textContent = err.message; }
  });

  // ---------------------------------------------------------------- import / export JSON
  $("#btnExportJson").addEventListener("click", function () {
    if (!userSongs.length) { toast("Tu n'as pas encore de morceaux perso."); return; }
    const blob = new Blob([JSON.stringify({ app: "piano-magique", version: 1, songs: userSongs })], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "mes-morceaux-piano-magique.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
  $("#btnImportJson").addEventListener("click", function () { $("#fileJson").value = ""; $("#fileJson").click(); });
  $("#fileJson").addEventListener("change", function () {
    const f = this.files && this.files[0];
    if (!f) return;
    f.text().then(function (txt) {
      const data = JSON.parse(txt);
      const songs = Array.isArray(data) ? data : data.songs;
      if (!Array.isArray(songs)) throw new Error("format inconnu");
      let n = 0;
      songs.forEach(function (s) {
        if (!s || !s.title) return;
        if (!s.events && s.text) s.events = parseSongText(s.text);
        if (!s.events && s.notes) s.events = parseSongText(s.notes);
        if (!s.events) return;
        s.id = s.id && String(s.id).charAt(0) === "u" ? s.id : "u" + Date.now() + n;
        s.cat = "Mes morceaux"; delete s.builtin;
        upsertSong(s); n++;
      });
      toast(n + " morceau(x) importé(s)");
      libCat = "Mes morceaux"; renderLibrary();
    }).catch(function (err) { toast("Import impossible : " + err.message, 4000); });
  });

  // ---------------------------------------------------------------- enregistrement : sauvegarde
  $("#saveForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const s = Rec.pendingSong;
    if (!s) { closePanels(); return; }
    s.title = $("#saveName").value.trim() || "Mon enregistrement";
    s.events = parseSongText(s.text);
    upsertSong(s); Rec.pendingSong = null;
    closePanels(); loadSong(s.id, { keepSound: true });
    setMode("magic");
    toast("Enregistré ! Rejoue-le en mode Magique.");
  });
  $("#saveDiscard").addEventListener("click", function () { Rec.pendingSong = null; closePanels(); toast("Enregistrement supprimé"); });

  // ---------------------------------------------------------------- sons (presets)
  let userPresets = store.get("presets", []);
  let favPresets = store.get("favPresets", []);
  const HD_CAT = "Vrais instruments (HD)";
  const MY_CAT = "Mes sons";
  const PLAIN_CATS = ["Instruments", "FX DJ", HD_CAT, MY_CAT];
  let soundCat = "Tous", soundBank = "FluidR3_GM";
  let current = null;            // preset de base choisi
  let browseList = null;         // liste filtrée (boutons ‹ ›)

  function gmPresets(bank) {
    return Engine.GM_NAMES.map(function (n, i) {
      return {
        id: "gm:" + bank + ":" + n, name: Engine.GM_FR[i], ref: "Instrument réel · banque " + Engine.BANKS[bank],
        cat: HD_CAT, inst: Engine.GM_FAMILIES[Math.floor(i / 8)], gm: [bank, n], rev: 0.2,
      };
    });
  }
  function findPreset(id) {
    if (!id) return null;
    if (id.indexOf("gm:") === 0) {
      const p = id.split(":");
      if (!Engine.BANKS[p[1]]) return null;
      return gmPresets(p[1]).find(function (x) { return x.id === id; }) || null;
    }
    return window.PRESETS.find(function (x) { return x.id === id; }) ||
      userPresets.find(function (x) { return x.id === id; }) || null;
  }

  /** Preset effectif = preset choisi + réglages de l'utilisateur */
  function effective() {
    const P = JSON.parse(JSON.stringify(current));
    const t = settings.tweaks || {};
    const a = (P.a || [0.005, 0.5, 0.7, 0.3]).slice();
    if (t.A !== undefined) a[0] = t.A;
    if (t.D !== undefined) a[1] = t.D;
    if (t.S !== undefined) a[2] = t.S;
    if (t.R !== undefined) a[3] = t.R;
    P.a = a;
    if (t.bright !== undefined) P.bright = t.bright;
    if (t.q !== undefined && P.f) P.f.q = t.q;
    if (t.glide !== undefined) P.glide = t.glide;
    if (t.mono !== undefined) P.mono = t.mono;
    if (t.drive !== undefined) P.drive = t.drive;
    if (t.crush !== undefined) P.crush = t.crush ? Math.round(17 - t.crush) : 0;
    if (t.cho !== undefined) P.cho = t.cho;
    if (t.dly !== undefined) P.dly = [(P.dly && P.dly[0]) || 0.3, (P.dly && P.dly[1]) || 0.3, t.dly];
    if (t.rev !== undefined) P.rev = t.rev;
    if (t.vol !== undefined) P.vol = (P.vol === undefined ? 0.5 : P.vol) * t.vol;
    if (t.oct !== undefined) P.oct = (P.oct || 0) + t.oct;
    return P;
  }

  function showPreset(p) {
    $("#presetCat").textContent = p.cat + (p.inst ? " · " + p.inst : "");
    $("#presetName").textContent = p.name;
    $("#presetRef").textContent = p.ref ? (PLAIN_CATS.indexOf(p.cat) < 0 ? "Style : " + p.ref : p.ref) : "";
  }

  function previewPreset(p) {
    Engine.ensure();
    const t0 = Engine.now() + 0.05;
    if (p.kit) {
      [[60, 0], [66, 0.25], [62, 0.5], [66, 0.75], [60, 1], [60, 1.25], [62, 1.5], [70, 1.75]].forEach(function (x) {
        Engine.play(x[0], 0.85, t0 + x[1] * 0.55, 0.2);
      });
      return;
    }
    const low = p.inst === "808" || p.inst === "Basse";
    const base = low ? 48 : 60;
    const seq = p.cat === "FX DJ" ? [[base, 0, 0.6]] : [[base, 0, 0.35], [base + 4, 0.22, 0.35], [base + 7, 0.44, 0.35], [base + 12, 0.66, 0.7]];
    seq.forEach(function (x) { Engine.play(tr(x[0]), 0.8, t0 + x[1], x[2]); });
  }

  function selectPreset(id, opts) {
    opts = opts || {};
    const p = findPreset(id) || window.PRESETS[0];
    const loaded = Engine.isLoaded(p);
    if (!loaded) toast("Téléchargement : " + p.name + "…", 15000);
    const card = document.querySelector('.sound[data-id="' + p.id + '"] .bar');
    const prev = current, prevTweaks = settings.tweaks;
    if (!opts.keepTweaks) settings.tweaks = {};
    current = p;
    return Engine.setPreset(effective(), function (x) { if (card) card.style.width = Math.round(x * 100) + "%"; })
      .then(function () {
        settings.preset = p.id; saveSettings();
        showPreset(p);
        $$(".sound").forEach(function (b) { b.classList.toggle("active", b.dataset.id === p.id); });
        if (!loaded) toast("♪ " + p.name);
        if (opts.preview) previewPreset(p);
        if (openId === "panelTweak") renderTweaks();
      })
      .catch(function () {
        current = prev; settings.tweaks = prevTweaks;
        if (card) card.style.width = "0";
        toast("Ce son n'a pas pu être téléchargé. Vérifie ta connexion : tous les autres sons marchent hors-ligne.", 5000);
      });
  }

  function nextPreset(d) {
    const list = browseList && browseList.length ? browseList : window.PRESETS;
    let i = list.findIndex(function (x) { return current && x.id === current.id; });
    i = i < 0 ? 0 : (i + d + list.length) % list.length;
    selectPreset(list[i].id, { preview: true });
  }

  function filteredPresets() {
    const q = norm($("#soundSearch").value);
    let src;
    if (soundCat === HD_CAT) src = gmPresets(soundBank);
    else if (soundCat === MY_CAT) src = userPresets;
    else if (soundCat === "Favoris") src = window.PRESETS.concat(userPresets).filter(function (p) { return favPresets.indexOf(p.id) >= 0; });
    else if (soundCat === "Tous") src = window.PRESETS.concat(userPresets);
    else src = window.PRESETS.filter(function (p) { return p.cat === soundCat; });
    if (!q) return src;
    const words = q.split(/\s+/).filter(Boolean);
    return src.filter(function (p) {
      const hay = norm([p.name, p.ref, p.cat, p.inst].join(" "));
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    });
  }

  function renderSounds() {
    const cats = ["Tous", "Favoris", MY_CAT].concat(window.PRESET_CATS, [HD_CAT]);
    const cc = $("#soundCats"); cc.innerHTML = "";
    cats.forEach(function (c) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip" + (c === soundCat ? " active" : "");
      b.textContent = c === "Favoris" ? "★ Favoris" : c;
      b.addEventListener("click", function () { soundCat = c; renderSounds(); });
      cc.appendChild(b);
    });
    const bk = $("#soundBanks");
    bk.hidden = soundCat !== HD_CAT;
    bk.innerHTML = "";
    Object.keys(Engine.BANKS).forEach(function (k) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip" + (k === soundBank ? " active" : "");
      b.textContent = "Banque " + Engine.BANKS[k];
      b.addEventListener("click", function () { soundBank = k; renderSounds(); });
      bk.appendChild(b);
    });
    const count = window.PRESETS.length;
    $("#soundNote").textContent = soundCat === HD_CAT
      ? "128 vrais instruments enregistrés (banques General MIDI libres). Chaque son se télécharge une fois (1 à 4 Mo), puis reste disponible."
      : soundCat === MY_CAT ? "Tes sons modifiés. Pour en créer un : choisis un son, ouvre « Son · Réglages » et touche « Enregistrer »."
        : count + " sons recréés par synthèse, disponibles hors-ligne. Tape un nom d'artiste, de morceau ou d'instrument.";

    const list = filteredPresets();
    browseList = list;
    const grid = $("#soundList"); grid.innerHTML = "";
    let lastFam = null;
    list.forEach(function (p) {
      if (soundCat === HD_CAT && p.inst !== lastFam) {
        const h = document.createElement("h3"); h.textContent = p.inst; grid.appendChild(h); lastFam = p.inst;
      }
      const el = document.createElement("div");
      el.className = "sound" + (current && current.id === p.id ? " active" : "");
      el.dataset.id = p.id;
      const pick = document.createElement("button");
      pick.type = "button"; pick.className = "pick";
      pick.innerHTML = '<span class="tg"></span><span class="nm"></span><span class="rf"></span>';
      pick.querySelector(".tg").textContent = soundCat === HD_CAT ? "HD" : (soundCat === "Tous" || soundCat === "Favoris" ? p.cat + " · " : "") + (p.inst || "");
      pick.querySelector(".nm").textContent = p.name;
      pick.querySelector(".rf").textContent = soundCat === HD_CAT ? "" : p.ref || "";
      pick.addEventListener("click", function () { selectPreset(p.id, { preview: true }); });
      el.appendChild(pick);
      if (p.cat === MY_CAT) {
        const del = document.createElement("button");
        del.type = "button"; del.className = "star"; del.textContent = "🗑"; del.setAttribute("aria-label", "Supprimer " + p.name);
        del.addEventListener("click", function () { confirmDeletePreset(p); });
        el.appendChild(del);
      } else if (!p.gm) {
        const fav = favPresets.indexOf(p.id) >= 0;
        const st = document.createElement("button");
        st.type = "button"; st.className = "star" + (fav ? " on" : ""); st.textContent = fav ? "★" : "☆";
        st.setAttribute("aria-label", fav ? "Retirer des favoris" : "Ajouter aux favoris");
        st.addEventListener("click", function () {
          if (favPresets.indexOf(p.id) >= 0) favPresets = favPresets.filter(function (x) { return x !== p.id; });
          else favPresets.push(p.id);
          store.set("favPresets", favPresets); renderSounds();
        });
        el.appendChild(st);
      }
      const bar = document.createElement("span"); bar.className = "bar"; el.appendChild(bar);
      grid.appendChild(el);
    });
    if (!list.length) {
      const p = document.createElement("p"); p.className = "note";
      p.textContent = soundCat === "Favoris" ? "Touche ☆ sur un son pour le retrouver ici." : soundCat === MY_CAT ? "Aucun son perso pour l'instant." : "Aucun son ne correspond.";
      grid.appendChild(p);
    }
  }
  function confirmDeletePreset(p) {
    $("#confText").textContent = "Le son « " + p.name + " » sera supprimé de cet appareil.";
    openPanel("panelConfirm");
    $("#confOk").onclick = function () {
      userPresets = userPresets.filter(function (x) { return x.id !== p.id; });
      store.set("presets", userPresets);
      if (current && current.id === p.id) selectPreset(window.PRESETS[0].id);
      soundCat = MY_CAT; renderSounds(); openPanel("panelSound");
    };
  }
  $("#btnPreset").addEventListener("click", function () { renderSounds(); openPanel("panelSound"); });
  $("#soundSearch").addEventListener("input", function () {
    if ($("#soundSearch").value && soundCat !== "Tous" && soundCat !== HD_CAT) soundCat = "Tous";
    renderSounds();
  });
  $("#presetPrev").addEventListener("click", function () { nextPreset(-1); });
  $("#presetNext").addEventListener("click", function () { nextPreset(1); });

  // ---------------------------------------------------------------- réglages du son
  const secs = function (v) { return v < 1 ? Math.round(v * 1000) + " ms" : v.toFixed(2) + " s"; };
  const TW = [
    { k: "A", label: "Attaque", min: 0, max: 2, step: 0.005, get: function (P) { return P.a[0]; }, fmt: secs, synth: true },
    { k: "D", label: "Déclin", min: 0.02, max: 4, step: 0.01, get: function (P) { return P.a[1]; }, fmt: secs, synth: true },
    { k: "S", label: "Maintien", min: 0, max: 1, step: 0.01, get: function (P) { return P.a[2]; }, fmt: function (v) { return Math.round(v * 100) + " %"; }, synth: true },
    { k: "R", label: "Relâchement", min: 0.02, max: 4, step: 0.01, get: function (P) { return P.a[3]; }, fmt: secs, synth: true },
    { k: "bright", label: "Brillance", min: -2, max: 2, step: 0.1, get: function (P) { return P.bright || 0; }, fmt: function (v) { return (v > 0 ? "+" : "") + v.toFixed(1); }, filter: true },
    { k: "q", label: "Résonance", min: 0.1, max: 20, step: 0.1, get: function (P) { return P.f ? (P.f.q === undefined ? 0.7 : P.f.q) : 0; }, fmt: function (v) { return v.toFixed(1); }, filter: true },
    { k: "glide", label: "Glissando", min: 0, max: 0.5, step: 0.005, get: function (P) { return P.glide || 0; }, fmt: secs, synth: true },
    { k: "oct", label: "Octave", min: -2, max: 2, step: 1, get: function () { return (settings.tweaks || {}).oct || 0; }, fmt: function (v) { return (v > 0 ? "+" : "") + v; }, synth: true },
    { k: "drive", label: "Saturation", min: 0, max: 1, step: 0.01, get: function (P) { return P.drive || 0; }, fmt: pctf, fx: true },
    { k: "crush", label: "Lo-fi", min: 0, max: 12, step: 1, get: function (P) { return P.crush ? 17 - P.crush : 0; }, fmt: function (v) { return v ? (17 - v) + " bits" : "off"; }, fx: true },
    { k: "cho", label: "Chorus", min: 0, max: 1, step: 0.01, get: function (P) { return P.cho || 0; }, fmt: pctf, fx: true },
    { k: "dly", label: "Écho", min: 0, max: 0.7, step: 0.01, get: function (P) { return P.dly ? P.dly[2] : 0; }, fmt: pctf, fx: true },
    { k: "rev", label: "Réverb", min: 0, max: 1, step: 0.01, get: function (P) { return P.rev === undefined ? 0.2 : P.rev; }, fmt: pctf, fx: true },
    { k: "vol", label: "Volume du son", min: 0.2, max: 2, step: 0.05, get: function () { return (settings.tweaks || {}).vol || 1; }, fmt: function (v) { return Math.round(v * 100) + " %"; }, synth: true },
  ];
  function pctf(v) { return Math.round(v * 100) + " %"; }
  let fxTimer = null;
  function renderTweaks() {
    if (!current) return;
    const P = effective();
    const isSynth = !P.kit && !P.gm;
    $("#tweakFor").textContent = current.name + (current.ref ? " — " + current.ref : "");
    const box = $("#tweakSliders"); box.innerHTML = "";
    TW.forEach(function (d) {
      if (d.synth && !isSynth) return;
      if (d.filter && (!isSynth || !P.f)) return;
      const id = "tw-" + d.k;
      const lab = document.createElement("label"); lab.className = "field"; lab.htmlFor = id;
      lab.innerHTML = '<span></span><input type="range"><output></output>';
      lab.querySelector("span").textContent = d.label;
      const inp = lab.querySelector("input"), out = lab.querySelector("output");
      inp.id = id; inp.min = d.min; inp.max = d.max; inp.step = d.step;
      const v0 = d.get(P); inp.value = v0; out.textContent = d.fmt(+v0);
      inp.addEventListener("input", function () {
        settings.tweaks = settings.tweaks || {};
        settings.tweaks[d.k] = +inp.value;
        out.textContent = d.fmt(+inp.value);
        saveSettings();
        if (d.fx) {
          clearTimeout(fxTimer);
          fxTimer = setTimeout(function () { Engine.updatePreset(effective(), true); }, 120);
        } else {
          Engine.updatePreset(effective(), false);
        }
      });
      box.appendChild(lab);
    });
    $("#twMono").checked = !!P.mono;
    $("#twMono").closest("label").hidden = !isSynth;
    $("#twSaveRow").hidden = true;
  }
  $("#twMono").addEventListener("change", function () {
    settings.tweaks = settings.tweaks || {};
    settings.tweaks.mono = this.checked; saveSettings();
    Engine.setPreset(effective());
  });
  $("#twReset").addEventListener("click", function () {
    settings.tweaks = {}; saveSettings();
    Engine.setPreset(effective());
    renderTweaks(); toast("Son d'origine rétabli");
  });
  $("#twSave").addEventListener("click", function () {
    $("#twSaveRow").hidden = false;
    $("#twName").value = current.name.replace(/^Mon /, "") + " (perso)";
    $("#twName").focus();
  });
  $("#twSaveOk").addEventListener("click", function () {
    const P = effective();
    const name = $("#twName").value.trim() || "Mon son";
    const np = Object.assign({}, P, { id: "my" + Date.now(), name: name, ref: "Basé sur " + current.name, cat: MY_CAT, inst: current.inst });
    delete np.oct; np.oct = P.oct;
    userPresets.push(np);
    store.set("presets", userPresets);
    settings.tweaks = {};
    selectPreset(np.id);
    closePanels();
    toast("Ajouté à « Mes sons »");
  });
  $("#btnTweak").addEventListener("click", function () { renderTweaks(); openPanel("panelTweak"); });

  // ---------------------------------------------------------------- couleur des touches
  const KEY_COLORS = ["#f4b740", "#ff5fa2", "#4cc9f0", "#a78bfa", "#5eead4", "#ff7a45", "#ef4444", "#84cc16", "#f1e9d8"];
  function applyKeyColor(c) {
    document.documentElement.style.setProperty("--gold", c);
    COL.gold = c;
  }
  function renderKeyColors() {
    const box = $("#keyColors"); box.innerHTML = "";
    KEY_COLORS.forEach(function (c) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "swatch" + (c === settings.keyColor ? " active" : "");
      b.style.background = c; b.setAttribute("aria-label", "Couleur " + c);
      b.addEventListener("click", function () { settings.keyColor = c; saveSettings(); applyKeyColor(c); renderKeyColors(); });
      box.appendChild(b);
    });
  }

  // ---------------------------------------------------------------- clavier MIDI
  const midiHeld = {};
  function onMidi(e) {
    const d = e.data, st = d[0] & 0xf0, n = d[1], v = d[2];
    if (st === 0x90 && v > 0) {
      if (midiHeld[n]) release(midiHeld[n]);
      midiHeld[n] = press(n, v / 127);
    } else if (st === 0x80 || (st === 0x90 && v === 0)) {
      if (midiHeld[n]) { release(midiHeld[n]); delete midiHeld[n]; }
    } else if (st === 0xb0 && n === 64) {
      Engine.setSustain(v >= 64 || settings.sustain);
    }
  }
  function connectMidi() {
    if (!navigator.requestMIDIAccess) { toast("Ce navigateur ne gère pas les claviers MIDI (essaie Chrome ou Edge).", 4000); return; }
    navigator.requestMIDIAccess().then(function (acc) {
      const bind = function () { let n = 0; acc.inputs.forEach(function (inp) { inp.onmidimessage = onMidi; n++; }); return n; };
      const n = bind();
      toast(n ? "Clavier MIDI connecté" : "Aucun clavier MIDI détecté. Branche-le puis réessaie.", 3500);
      acc.onstatechange = function () { bind(); };
    }).catch(function () { toast("Accès MIDI refusé par le navigateur.", 3500); });
  }
  $("#btnMidi").addEventListener("click", connectMidi);

  // ---------------------------------------------------------------- beat
  let stepsEl = null;
  function refreshBeatUi() {
    $("#beatName").textContent = BEATS[Beat.style].name.replace(" (3/4)", "");
    $("#btnBeat").classList.toggle("on", Beat.style !== "off");
    $("#beatBpmOut").textContent = Math.round(Beat.bpm()) + " BPM" + (settings.beatSync && S.song ? " (morceau)" : "");
    $("#beatBpm").value = Math.round(Beat.bpm());
    $("#beatBpm").disabled = settings.beatSync && !!S.song;
  }
  function renderBeat() {
    const grid = $("#beatStyles"); grid.innerHTML = "";
    Object.keys(BEATS).forEach(function (k) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = BEATS[k].name; b.className = k === Beat.style ? "active" : "";
      b.addEventListener("click", function () {
        Beat.style = k; settings.beat = k; saveSettings();
        if (k === "off") Beat.stop(); else Beat.start(Auto.playing ? Engine.now() : 0);
        renderBeat(); refreshBeatUi();
      });
      grid.appendChild(b);
    });
    const st = $("#beatSteps"); st.innerHTML = "";
    const bt = BEATS[Beat.style];
    if (bt.k) {
      st.style.gridTemplateColumns = "repeat(" + Beat.steps() + ", 1fr)";
      for (let i = 0; i < Beat.steps(); i++) {
        const c = document.createElement("i");
        if (bt.k[i] === "x") c.className = "k";
        st.appendChild(c);
      }
    }
    stepsEl = st;
    refreshBeatUi();
  }
  function highlightStep(s) {
    if (!stepsEl) return;
    const cells = stepsEl.children;
    for (let i = 0; i < cells.length; i++) cells[i].classList.toggle("now", i === s);
  }
  $("#btnBeat").addEventListener("click", function () { renderBeat(); openPanel("panelBeat"); });
  $("#beatBpm").addEventListener("input", function () { settings.beatBpm = +this.value; saveSettings(); refreshBeatUi(); });
  $("#beatVol").addEventListener("input", function () { settings.beatVol = +this.value; saveSettings(); });
  $("#beatSync").addEventListener("change", function () { settings.beatSync = this.checked; saveSettings(); refreshBeatUi(); });

  // ---------------------------------------------------------------- réglages
  function bindRange(id, key, fn, fmt) {
    const el = $(id); el.value = settings[key];
    const out = $(id + "Out");
    const upd = function () { if (out) out.textContent = fmt ? fmt(settings[key]) : settings[key]; };
    upd();
    el.addEventListener("input", function () { settings[key] = +el.value; saveSettings(); upd(); if (fn) fn(settings[key]); });
  }
  function bindCheck(id, key, fn) {
    const el = $(id); el.checked = !!settings[key];
    el.addEventListener("change", function () { settings[key] = el.checked; saveSettings(); if (fn) fn(el.checked); });
  }
  bindRange("#setVolume", "volume", function (v) { Engine.setVolume(v); });
  bindRange("#setKeySize", "keySize", function () { layoutKeyboard(); fitKeyboardToSong(); });
  bindRange("#setTranspose", "transpose", null, function (v) { return (v > 0 ? "+" : "") + v + " demi-ton" + (Math.abs(v) > 1 ? "s" : ""); });
  bindCheck("#setSustain", "sustain", function (v) { Engine.setSustain(v); });
  bindCheck("#setLabels", "labels", layoutKeyboard);
  bindCheck("#setSolfege", "solfege", layoutKeyboard);
  bindCheck("#setAnyOctave", "anyOctave", updateNextHint);
  bindCheck("#setFall", "fall");
  $("#beatVol").value = settings.beatVol;
  $("#beatSync").checked = settings.beatSync;
  $("#btnSettings").addEventListener("click", function () { openPanel("panelSettings"); });

  // ---------------------------------------------------------------- transport
  $$(".modes button").forEach(function (b) { b.addEventListener("click", function () { setMode(b.dataset.mode); }); });
  $("#btnQuitLesson").addEventListener("click", function () { quitLesson(); toast("Retour au jeu libre"); });
  $("#btnPlay").addEventListener("click", toggleAuto);
  $("#btnRestart").addEventListener("click", function () {
    const wasPlaying = Auto.playing;
    restartSong();
    S.view = S.song && S.song.events[S.cur] ? S.song.events[S.cur].t - S.song.q * 2 : 0;
    if (wasPlaying) startAuto();
    toast("Depuis le début");
  });
  $("#speed").value = settings.speed;
  const speedOut = function () { $("#speedOut").textContent = Math.round(settings.speed * 100) + " %"; };
  speedOut();
  $("#speed").addEventListener("input", function () {
    reanchor();
    settings.speed = +this.value; saveSettings(); speedOut(); refreshBeatUi();
  });
  $("#btnRec").addEventListener("click", function () { if (Rec.active) Rec.stop(); else Rec.start(); });
  $("#octDown").addEventListener("click", function () { shiftOctave(-1); });
  $("#octUp").addEventListener("click", function () { shiftOctave(1); });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { stopAuto(); Beat.stop(); }
    else if (Beat.style !== "off" && Engine.ctx) Beat.start(0);
  });

  // garde l'écran allumé pendant qu'on joue (si possible)
  let wakeLock = null;
  document.addEventListener("pointerdown", function () {
    if (wakeLock || !navigator.wakeLock) return;
    navigator.wakeLock.request("screen").then(function (w) { wakeLock = w; w.addEventListener("release", function () { wakeLock = null; }); }).catch(function () {});
  });
  // démarre le beat au premier geste s'il était activé
  document.addEventListener("pointerdown", function once() {
    document.removeEventListener("pointerdown", once);
    Engine.ensure();
    if (Beat.style !== "off" && !Beat.timer) Beat.start(0);
  });

  // ================================================================ démarrage
  Engine.setVolume(settings.volume);
  Engine.setSustain(settings.sustain);

  resizeCanvas();
  layoutKeyboard();
  applyKeyColor(settings.keyColor);
  renderKeyColors();
  selectPreset(settings.preset, { keepTweaks: true });
  if (settings.song && findSong(settings.song)) loadSong(settings.song); else setMode("free");
  refreshBeatUi();
  updateHint();

  const ro = new ResizeObserver(function () { resizeCanvas(); layoutKeyboard(); });
  ro.observe(stage); ro.observe(kbEl);
  requestAnimationFrame(frame);

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* hors PWA : pas grave */ });
    });
  }

  // accès pour les tests
  window.PianoApp = { S: S, KB: KB, settings: settings, parseSongText: parseSongText, loadSong: loadSong, quitLesson: quitLesson, setMode: setMode, press: press, release: release, selectPreset: selectPreset, nextPreset: nextPreset, effective: effective };
})();
