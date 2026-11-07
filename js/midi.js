/*
 * Lecture de fichiers MIDI (.mid) et conversion en "preset" jouable.
 */
(function () {
  "use strict";

  function parse(arrayBuffer) {
    const d = new DataView(arrayBuffer);
    let p = 0;
    const str = function (n) { let s = ""; for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(p + i)); p += n; return s; };
    const u32 = function () { const v = d.getUint32(p); p += 4; return v; };
    const u16 = function () { const v = d.getUint16(p); p += 2; return v; };
    const u8 = function () { return d.getUint8(p++); };
    const vlq = function () { let v = 0, b; do { b = u8(); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };

    if (str(4) !== "MThd") throw new Error("Ce n'est pas un fichier MIDI valide.");
    const hlen = u32();
    u16(); // format
    const ntrks = u16();
    let division = u16();
    p += hlen - 6;
    if (division & 0x8000) division = 480; // SMPTE : approximation
    const ppq = division;

    const tracks = [];
    let tempo = 0; // µs par noire (premier rencontré)
    for (let ti = 0; ti < ntrks && p < d.byteLength - 8; ti++) {
      const id = str(4), len = u32(), end = p + len;
      if (id !== "MTrk") { p = end; continue; }
      const track = { name: "", notes: [], channels: {}, program: null };
      const open = {};
      let tick = 0, status = 0;
      while (p < end) {
        tick += vlq();
        let b = d.getUint8(p);
        if (b & 0x80) { status = b; p++; } else if (!status) { p++; continue; }
        const type = status & 0xf0, ch = status & 0x0f;
        if (status === 0xff) {
          const mt = u8(), ml = vlq();
          if (mt === 0x51 && ml === 3 && !tempo) {
            tempo = (d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2);
          } else if ((mt === 0x03 || mt === 0x04) && !track.name) {
            let s = ""; for (let i = 0; i < ml; i++) s += String.fromCharCode(d.getUint8(p + i));
            track.name = s.trim();
          }
          p += ml;
          status = 0;
        } else if (status === 0xf0 || status === 0xf7) {
          p += vlq(); status = 0;
        } else if (type === 0x90 || type === 0x80) {
          const note = u8(), vel = u8(), k = ch * 128 + note;
          if (type === 0x90 && vel > 0) {
            if (open[k]) { open[k].dur = tick - open[k].tick; }
            const n = { tick: tick, midi: note, vel: vel / 127, ch: ch, dur: 0 };
            open[k] = n; track.notes.push(n);
            track.channels[ch] = (track.channels[ch] || 0) + 1;
          } else if (open[k]) {
            open[k].dur = tick - open[k].tick; delete open[k];
          }
        } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
          p += 2;
        } else if (type === 0xc0) {
          const prog = u8(); if (track.program === null && ch !== 9) track.program = prog;
        } else if (type === 0xd0) {
          p += 1;
        } else {
          p++;
        }
      }
      Object.keys(open).forEach(function (k) { open[k].dur = Math.max(ppq / 2, tick - open[k].tick); });
      p = end;
      if (track.notes.length) {
        const drums = (track.channels[9] || 0) > track.notes.length / 2;
        const sum = track.notes.reduce(function (a, n) { return a + n.midi; }, 0);
        track.isDrums = drums;
        track.avgPitch = sum / track.notes.length;
        tracks.push(track);
      }
    }
    const bpm = tempo ? 60000000 / tempo : 120;
    return { ppq: ppq, bpm: bpm, tracks: tracks };
  }

  /**
   * Construit un preset à partir des pistes choisies.
   * - melodyIdx : piste qui "avance" à chaque tap
   * - accIdx    : pistes d'accompagnement, rattachées à la note de mélodie qui les précède
   * - maxChord  : nb max de notes de mélodie jouées par tap (0 = illimité)
   */
  function toSong(midi, melodyIdx, accIdx, opts) {
    opts = opts || {};
    const unit = midi.ppq / 4; // 1 unité = une double-croche
    const tol = midi.ppq / 24;
    const mel = midi.tracks[melodyIdx].notes.slice().sort(function (a, b) { return a.tick - b.tick || b.midi - a.midi; });
    const groups = [];
    mel.forEach(function (n) {
      const g = groups[groups.length - 1];
      if (g && n.tick - g.tick <= tol) g.notes.push(n);
      else groups.push({ tick: n.tick, notes: [n], extra: [] });
    });
    if (!groups.length) throw new Error("La piste mélodie est vide.");
    const maxChord = opts.maxChord || 0;
    groups.forEach(function (g) {
      g.notes.sort(function (a, b) { return b.midi - a.midi; });
      const seen = {};
      g.notes = g.notes.filter(function (n) { if (seen[n.midi]) return false; seen[n.midi] = 1; return true; });
      if (maxChord && g.notes.length > maxChord) g.notes = g.notes.slice(0, maxChord);
    });

    // accompagnement
    const acc = [];
    (accIdx || []).forEach(function (i) {
      if (i === melodyIdx || !midi.tracks[i] || midi.tracks[i].isDrums) return;
      midi.tracks[i].notes.forEach(function (n) { acc.push(n); });
    });
    acc.sort(function (a, b) { return a.tick - b.tick; });
    let gi = 0;
    acc.forEach(function (n) {
      while (gi + 1 < groups.length && groups[gi + 1].tick <= n.tick + tol) gi++;
      const g = groups[gi];
      const dt = Math.max(0, (n.tick - g.tick) / unit);
      g.extra.push([round(dt), [n.midi], round(Math.max(0.5, n.dur / unit))]);
    });

    const r = function (x) { return Math.max(0.25, round(x)); };
    const events = groups.map(function (g, i) {
      const next = groups[i + 1];
      const gap = next ? (next.tick - g.tick) / unit : Math.max(4, g.notes[0].dur / unit);
      const len = Math.max.apply(null, g.notes.map(function (n) { return n.dur; })) / unit;
      const ev = { n: g.notes.map(function (n) { return n.midi; }), d: r(gap), l: r(Math.min(len, 64)) };
      if (g.extra.length) ev.x = mergeExtras(g.extra);
      return ev;
    });

    // décalage initial (silence avant la 1re note de mélodie) : on l'ignore
    return {
      tempo: Math.round(midi.bpm * 4),
      q: 4,
      events: events,
    };
  }

  function mergeExtras(list) {
    const out = [];
    list.forEach(function (x) {
      const last = out[out.length - 1];
      if (last && last[0] === x[0] && last[2] === x[2]) last[1].push(x[1][0]);
      else out.push([x[0], x[1].slice(), x[2]]);
    });
    return out;
  }
  function round(x) { return Math.round(x * 4) / 4; }

  window.MidiImport = { parse: parse, toSong: toSong };
})();
