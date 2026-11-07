/*
 * Bibliothèque de presets : des sonorités inspirées de morceaux et d'artistes célèbres,
 * recréées par synthèse (aucun échantillon copié). Les noms d'artistes et de titres servent
 * uniquement à décrire le style du son.
 *
 * Paramètres d'un preset (tous optionnels) :
 *  o     : oscillateurs [{ w: forme, r: rapport, s: demi-tons, d: cents, g: gain, u: unisson, sp: écart,
 *          fm: [rapport, indice, décroissance, indice final], dec: décroissance propre, bp/hp/q: filtre du bruit }]
 *          formes : sine, triangle, sawtooth, square, pulse25, pulse12, noise
 *  f     : filtre { t: type, c: fréquence à Do4, kt: suivi de clavier, q, e: enveloppe (octaves), a, d, s, lfo: [Hz, octaves] }
 *  fmt   : formants [[Hz, gain, Q]...]      a : [attaque, déclin, maintien, relâchement]
 *  kd    : déclin plus court dans l'aigu     pe : enveloppe de hauteur [demi-tons, durée]
 *  vib   : vibrato [Hz, cents, délai]       trem : trémolo [Hz, profondeur]
 *  sub   : sous-oscillateur                 oct : octave    mono/glide : glissando
 *  drive : saturation   crush : bits        cho : chorus    dly : écho [s, retour, mix]   rev : réverbération
 *  vol   : volume       kit : kit de batterie (12 sons, de Do à Si)
 */
(function () {
  "use strict";

  function X(base, over) {
    const r = Object.assign({}, base, over);
    if (base.f && over && over.f) r.f = Object.assign({}, base.f, over.f);
    return r;
  }

  // ------------------------------------------------------------ modèles de base
  const PIANO = {
    o: [{ w: "triangle" }, { w: "sine", r: 2, g: 0.35 }, { w: "sine", r: 3, g: 0.12 }, { w: "sine", r: 4.01, g: 0.05 },
      { w: "noise", bp: 4, g: 0.25, dec: 0.012 }],
    f: { c: 3200, kt: 0.6, e: 1.5, d: 1.2, s: 0 }, a: [0.003, 1.9, 0, 0.35], kd: 0.5, rev: 0.22, vol: 0.55,
  };
  const EP = {
    o: [{ w: "sine", fm: [1, 1.3, 0.35, 0.15] }, { w: "sine", r: 7, g: 0.12, dec: 0.04 }],
    a: [0.003, 2.4, 0, 0.35], kd: 0.4, vol: 0.5, cho: 0.25, rev: 0.2,
  };
  const ORGAN = {
    o: [{ w: "sine", r: 0.5, g: 0.5 }, { w: "sine" }, { w: "sine", r: 2, g: 0.6 }, { w: "sine", r: 3, g: 0.35 },
      { w: "sine", r: 4, g: 0.25 }, { w: "noise", hp: 2000, g: 0.08, dec: 0.008 }],
    a: [0.008, 0.1, 1, 0.08], vib: [6.5, 10, 0], vol: 0.3, rev: 0.2,
  };
  const BELL = {
    o: [{ w: "sine", fm: [3.5, 2.5, 0.6, 0.2] }, { w: "sine", r: 2, g: 0.2, dec: 0.3 }],
    a: [0.002, 2.2, 0, 0.7], kd: 0.3, vol: 0.4, rev: 0.45,
  };
  const MALLET = {
    o: [{ w: "sine" }, { w: "sine", r: 4, g: 0.35, dec: 0.03 }, { w: "sine", r: 10, g: 0.1, dec: 0.01 }],
    a: [0.001, 0.5, 0, 0.15], kd: 0.4, vol: 0.55, rev: 0.25,
  };
  const PLUCK = {
    o: [{ w: "sawtooth", u: 3, sp: 12 }], f: { c: 600, kt: 0.8, e: 3.5, d: 0.25, s: 0, q: 2 },
    a: [0.002, 0.55, 0, 0.25], vol: 0.45, rev: 0.25,
  };
  const GUITAR = {
    o: [{ w: "sawtooth" }, { w: "triangle", r: 2, g: 0.3 }, { w: "noise", bp: 3, g: 0.2, dec: 0.01 }],
    f: { c: 900, kt: 0.7, e: 2.5, d: 0.35, s: 0.15, q: 1 }, a: [0.002, 1.3, 0, 0.3], kd: 0.4, vol: 0.45, rev: 0.25,
  };
  const LEAD = {
    o: [{ w: "sawtooth", u: 3, sp: 10 }], f: { c: 2500, kt: 0.4, e: 1, d: 0.3, s: 0.5, q: 1 },
    a: [0.005, 0.3, 0.8, 0.15], vol: 0.38, rev: 0.25,
  };
  const SUPERSAW = {
    o: [{ w: "sawtooth", u: 7, sp: 28 }, { w: "sawtooth", r: 0.5, g: 0.3 }], f: { c: 5200, kt: 0.2, q: 0.7 },
    a: [0.01, 0.4, 0.85, 0.4], vol: 0.4, cho: 0.3, rev: 0.35,
  };
  const PAD = {
    o: [{ w: "sawtooth", u: 3, sp: 14 }, { w: "triangle", r: 0.5, g: 0.4 }],
    f: { c: 900, kt: 0.3, e: 1.5, a: 1.5, d: 2, s: 0.6, q: 1.5 }, a: [0.6, 1, 0.85, 1.6], vol: 0.3, cho: 0.4, rev: 0.55,
  };
  const STRINGS = {
    o: [{ w: "sawtooth", u: 3, sp: 12 }], f: { c: 3000, kt: 0.4, q: 0.5 },
    a: [0.25, 0.5, 0.85, 0.6], vib: [5.2, 7, 0.3], vol: 0.3, cho: 0.3, rev: 0.45,
  };
  const BRASS = {
    o: [{ w: "sawtooth", u: 2, sp: 8 }], f: { c: 600, kt: 0.6, e: 2.5, a: 0.06, d: 0.4, s: 0.6, q: 1.5 },
    a: [0.03, 0.3, 0.85, 0.15], vol: 0.38, cho: 0.2, rev: 0.25,
  };
  const FLUTE = {
    o: [{ w: "sine" }, { w: "triangle", r: 2, g: 0.08 }, { w: "noise", bp: 2, q: 2, g: 0.12 }],
    a: [0.06, 0.3, 0.85, 0.15], vib: [5, 15, 0.25], vol: 0.45, rev: 0.3,
  };
  const B808 = {
    o: [{ w: "sine" }, { w: "triangle", g: 0.12 }], pe: [12, 0.05], a: [0.002, 2.6, 0, 0.25],
    drive: 0.45, mono: true, glide: 0.07, oct: -1, vol: 0.6, rev: 0,
  };
  const COWBELL = {
    o: [{ w: "square" }, { w: "square", r: 1.4815 }], f: { t: "bandpass", c: 700, kt: 1, q: 2.5 },
    a: [0.001, 0.4, 0, 0.12], vol: 0.6, drive: 0.3, rev: 0.15, oct: 1,
  };
  const CHOIR = {
    o: [{ w: "sawtooth", u: 3, sp: 12 }], fmt: [[730, 1, 7], [1090, 0.5, 8], [2440, 0.25, 9]],
    a: [0.25, 0.4, 0.9, 0.7], vib: [5.5, 12, 0.3], vol: 0.95, rev: 0.55, cho: 0.3,
  };
  const TALKBOX = {
    o: [{ w: "sawtooth" }, { w: "square", g: 0.5 }], fmt: [[700, 1, 6], [1220, 0.7, 7], [2600, 0.35, 8]],
    a: [0.01, 0.2, 0.9, 0.12], mono: true, glide: 0.06, vib: [5, 10, 0.2], vol: 1.1, drive: 0.2, rev: 0.2,
  };
  const BASS = {
    o: [{ w: "sawtooth" }, { w: "square", r: 0.5, g: 0.4 }], f: { c: 300, kt: 0.5, e: 2.5, d: 0.25, s: 0.2, q: 4 },
    a: [0.003, 0.4, 0.6, 0.1], oct: -1, vol: 0.5, rev: 0.05,
  };
  const CHIP = { o: [{ w: "pulse25" }], a: [0.001, 0.2, 0.7, 0.04], vol: 0.28, rev: 0.1 };

  // ------------------------------------------------------------ kits (Do Do# Ré Ré# Mi Fa Fa# Sol Sol# La La# Si)
  const KITS = {
    trap: [["kick808", { d: 1.6, f0: 43, drive: 0.5 }], ["rim"], ["snare", { tone: 210, hp: 1800, d: 0.14 }], ["clap", { d: 0.18 }],
      ["snare", { tone: 180, d: 0.22, hp: 1200 }], ["tom", { f: 90 }], ["hat", { d: 0.035 }], ["tom", { f: 120 }],
      ["hat", { d: 0.02, v: 0.7 }], ["tom", { f: 160 }], ["ohat", { d: 0.28 }], ["crash"]],
    drill: [["kick808", { d: 2.2, f0: 40, drive: 0.6 }], ["rim", { f: 1500 }], ["snare", { tone: 230, hp: 2000, d: 0.12, body: 0.4 }],
      ["clap", { d: 0.14, bp: 1800 }], ["snare", { tone: 190, d: 0.2 }], ["perc", { f: 600 }], ["hat", { d: 0.03 }],
      ["perc", { f: 800 }], ["hat", { d: 0.018, v: 0.6 }], ["conga", { f: 300 }], ["ohat", { d: 0.2 }], ["crash", { d: 1 }]],
    phonk: [["kick", { d: 0.5, drive: 0.8, f1: 200, f0: 50 }], ["rim"], ["snare", { tone: 180, noise: 0.9, d: 0.2, hp: 900 }],
      ["clap", { d: 0.25 }], ["cowbell", { f: 540 }], ["tom", { f: 100 }], ["hat", { d: 0.04 }], ["cowbell", { f: 720 }],
      ["hat", { d: 0.025, v: 0.7 }], ["cowbell", { f: 880 }], ["ohat", { d: 0.25 }], ["crash"]],
    boombap: [["kick", { d: 0.35, f1: 140, click: 0.4 }], ["rim", { f: 1400 }], ["snare", { tone: 180, d: 0.2, noise: 0.9, hp: 1000 }],
      ["snap"], ["snare", { tone: 220, d: 0.12 }], ["tom", { f: 85 }], ["hat", { d: 0.05, hp: 6500 }], ["tom", { f: 115 }],
      ["shaker"], ["tom", { f: 150 }], ["ohat", { d: 0.35, hp: 6500 }], ["crash", { d: 1.6 }]],
    house: [["kick", { d: 0.5, f1: 200, f0: 50, click: 0.3 }], ["rim"], ["snare", { tone: 220, d: 0.15 }], ["clap", { d: 0.25 }],
      ["clap", { d: 0.12, bp: 1800 }], ["tom", { f: 100 }], ["hat", { d: 0.03 }], ["tom", { f: 140 }], ["shaker"],
      ["tom", { f: 190 }], ["ohat", { d: 0.18 }], ["crash", { d: 1.8 }]],
    amapiano: [["kick", { d: 0.4, f1: 150 }], ["rim", { f: 1900 }], ["snare", { tone: 230, d: 0.12 }], ["clap", { d: 0.2 }],
      ["logdrum", { f1: 200, f0: 82 }], ["logdrum", { f1: 230, f0: 98 }], ["shaker"], ["logdrum", { f1: 260, f0: 110 }],
      ["hat", { d: 0.03 }], ["logdrum", { f1: 300, f0: 131 }], ["conga", { f: 260 }], ["perc", { f: 1200, d: 0.08 }]],
    reggaeton: [["kick", { d: 0.35, f1: 160 }], ["rim", { f: 1600 }], ["snare", { tone: 240, d: 0.1, hp: 2200 }], ["clap", { d: 0.15 }],
      ["snare", { tone: 200, d: 0.16 }], ["conga", { f: 200 }], ["hat", { d: 0.03 }], ["conga", { f: 260 }], ["shaker"],
      ["conga", { f: 330 }], ["ohat", { d: 0.2 }], ["perc", { f: 1000 }]],
    jersey: [["kick", { d: 0.55, f1: 180, f0: 45, drive: 0.6 }], ["rim"], ["clap", { d: 0.16 }], ["clap", { d: 0.3, bp: 1100 }],
      ["snare", { tone: 230, d: 0.12 }], ["kick", { d: 0.3, f1: 220, f0: 70 }], ["hat", { d: 0.03 }], ["tom", { f: 140 }],
      ["hat", { d: 0.02 }], ["tom", { f: 200 }], ["ohat", { d: 0.2 }], ["crash"]],
  };

  // ------------------------------------------------------------ catalogue
  const L = [];
  function add(id, name, ref, cat, inst, def) { L.push(Object.assign({ id: id, name: name, ref: ref, cat: cat, inst: inst }, def)); }

  // ---- Phonk
  add("tiki-cowbell", "Cowbell « Tiki Tiki »", "QMIIR – Tiki Tiki", "Phonk", "Cloche", X(COWBELL, { drive: 0.45, a: [0.001, 0.35, 0, 0.1] }));
  add("murder-cowbell", "Cowbell « Murder In My Mind »", "Kordhell – Murder In My Mind", "Phonk", "Cloche", X(COWBELL, { drive: 0.75, a: [0.001, 0.55, 0, 0.12], rev: 0.2 }));
  add("close-eyes-cowbell", "Cowbell « Close Eyes »", "DVRST – Close Eyes", "Phonk", "Cloche", X(COWBELL, { drive: 0.25, dly: [0.18, 0.3, 0.25], rev: 0.3 }));
  add("funk-cowbell", "Cowbell funk brésilien", "Funk brésilien / montagem", "Phonk", "Cloche", X(COWBELL, { oct: 2, a: [0.001, 0.2, 0, 0.06], drive: 0.6 }));
  add("phonk-808", "808 phonk saturée", "Drift phonk", "Phonk", "808", X(B808, { drive: 0.85, a: [0.002, 1.8, 0, 0.2] }));
  add("memphis-bell", "Cloches Memphis", "Three 6 Mafia – sons de Memphis", "Phonk", "Cloche", X(BELL, { o: [{ w: "sine", fm: [1.41, 2, 0.5, 0.3] }], f: { c: 2500, kt: 0.3 }, crush: 8, rev: 0.35 }));
  add("memphis-lead", "Lead Memphis rétro", "Phonk de Memphis (cassette)", "Phonk", "Lead", X(CHIP, { o: [{ w: "square" }], crush: 6, f: { c: 2200, kt: 0.2 }, vib: [5, 8, 0.2], vol: 0.3 }));
  add("phonk-choir", "Chœur sombre phonk", "Phonk (chœurs saturés)", "Phonk", "Voix", X(CHOIR, { drive: 0.4, crush: 10, oct: -1 }));
  add("kit-phonk", "Kit phonk (cowbells)", "Kordhell / Memphis", "Phonk", "Batterie", { kit: KITS.phonk, vol: 0.9, rev: 0.12, drive: 0.25 });

  // ---- Trap
  add("goosebumps-bell", "Cloche « Goosebumps »", "Travis Scott – Goosebumps", "Trap", "Cloche", X(BELL, { o: [{ w: "sine", fm: [3, 1.6, 0.4, 0.15] }, { w: "triangle", r: 2, g: 0.15, dec: 0.2 }], dly: [0.3, 0.3, 0.2], rev: 0.5 }));
  add("xo-bell", "Bell « XO Tour Llif3 »", "Lil Uzi Vert – XO Tour Llif3", "Trap", "Cloche", { o: [{ w: "triangle" }, { w: "sine", r: 2, g: 0.4, dec: 0.15 }, { w: "sine", r: 4, g: 0.15, dec: 0.05 }], a: [0.002, 0.9, 0, 0.4], kd: 0.3, cho: 0.35, dly: [0.25, 0.25, 0.2], rev: 0.5, vol: 0.5 });
  add("mask-off-flute", "Flûte « Mask Off »", "Future – Mask Off", "Trap", "Flûte", X(FLUTE, { vib: [5.2, 20, 0.2], rev: 0.35 }));
  add("metro-808", "808 « Metro Boomin »", "Metro Boomin", "Trap", "808", B808);
  add("travis-808", "808 distordue « Travis »", "Travis Scott (808 saturée)", "Trap", "808", X(B808, { drive: 0.8, sub: 0.3 }));
  add("lucid-guitar", "Guitare « Lucid Dreams »", "Juice WRLD – Lucid Dreams", "Trap", "Guitare", X(GUITAR, { o: [{ w: "triangle" }, { w: "sawtooth", g: 0.25 }, { w: "noise", bp: 3, g: 0.15, dec: 0.01 }], cho: 0.25, rev: 0.3 }));
  add("trap-pizz", "Cordes pizzicato trap", "Trap orchestrale (Metro Boomin, 21 Savage)", "Trap", "Cordes", X(PLUCK, { o: [{ w: "sawtooth", u: 2, sp: 8 }], f: { c: 900, e: 2, d: 0.12 }, a: [0.002, 0.35, 0, 0.15], rev: 0.4 }));
  add("trap-dark-pad", "Nappe sombre trap", "Trap mélodique", "Trap", "Pad", X(PAD, { f: { c: 600 }, rev: 0.6 }));
  add("savage-choir", "Chœur « Savage Mode »", "21 Savage & Metro Boomin", "Trap", "Voix", X(CHOIR, { fmt: [[500, 1, 7], [900, 0.4, 8], [2400, 0.2, 9]], rev: 0.65 }));
  add("trap-piano", "Piano sombre trap", "Trap (piano mineur)", "Trap", "Piano", X(PIANO, { f: { c: 1800 }, dly: [0.35, 0.25, 0.15], rev: 0.4 }));
  add("trap-lead", "Lead plaintif trap", "Trap mélodique (Lil Uzi, Playboi Carti)", "Trap", "Lead", X(LEAD, { o: [{ w: "square" }, { w: "sawtooth", g: 0.5, d: 7 }], f: { c: 1800, q: 3 }, vib: [5.5, 15, 0.3], glide: 0.05, mono: true, rev: 0.4 }));
  add("kit-trap", "Kit trap 808", "Metro Boomin / Southside", "Trap", "Batterie", { kit: KITS.trap, vol: 0.9, rev: 0.08 });

  // ---- Drill
  add("dior-808", "808 glissante « Dior »", "Pop Smoke – Dior", "Drill", "808", X(B808, { glide: 0.12, drive: 0.35, a: [0.002, 3, 0, 0.3] }));
  add("party-808", "808 « Welcome to the Party »", "Pop Smoke – Welcome to the Party", "Drill", "808", X(B808, { glide: 0.16, drive: 0.55, sub: 0.2 }));
  add("drill-strings", "Cordes drill UK", "Drill UK (cordes sombres)", "Drill", "Cordes", X(STRINGS, { a: [0.08, 0.5, 0.8, 0.5], f: { c: 2200 } }));
  add("drill-flute", "Flûte drill", "Drill FR (flûtes mélodiques)", "Drill", "Flûte", X(FLUTE, { dly: [0.25, 0.3, 0.2], rev: 0.4 }));
  add("drill-choir", "Chœur épique drill", "Drill (chœurs)", "Drill", "Voix", X(CHOIR, { oct: 0, rev: 0.6 }));
  add("drill-piano", "Piano drill", "Drill UK (piano mélancolique)", "Drill", "Piano", X(PIANO, { f: { c: 2200 }, rev: 0.45 }));
  add("drill-bell", "Bell drill", "Drill NY", "Drill", "Cloche", X(MALLET, { o: [{ w: "sine" }, { w: "sine", r: 3, g: 0.3, dec: 0.08 }], a: [0.001, 0.8, 0, 0.3], dly: [0.2, 0.3, 0.2], rev: 0.4 }));
  add("kit-drill", "Kit drill", "Pop Smoke / Drill UK", "Drill", "Batterie", { kit: KITS.drill, vol: 0.9, rev: 0.1 });

  // ---- Rap FR
  add("cloud-pad", "Nappe cloud", "Rap FR planant (style PNL)", "Rap FR", "Pad", X(PAD, { o: [{ w: "triangle", u: 3, sp: 10 }, { w: "sine", r: 2, g: 0.2 }], f: { c: 1400 }, dly: [0.4, 0.35, 0.2], rev: 0.7 }));
  add("frmelo-guitar", "Guitare rap mélodique", "Rap FR mélodique", "Rap FR", "Guitare", X(GUITAR, { cho: 0.3, dly: [0.3, 0.25, 0.15] }));
  add("afrotrap-pluck", "Pluck afro-trap", "MHD – afro trap", "Rap FR", "Pluck", X(PLUCK, { o: [{ w: "square" }, { w: "triangle", r: 2, g: 0.3 }], f: { c: 1100, e: 2.5, d: 0.15 }, a: [0.002, 0.3, 0, 0.12], rev: 0.2 }));
  add("frdrill-piano", "Piano drill FR", "Drill FR", "Rap FR", "Piano", X(PIANO, { f: { c: 2000 }, dly: [0.3, 0.2, 0.15], rev: 0.4 }));
  add("frpop-marimba", "Marimba afro-pop", "Afro-pop FR", "Rap FR", "Percussion", X(MALLET, { rev: 0.2 }));
  add("autotune-lead", "Lead « voix auto-tune »", "Rap FR (topline auto-tunée)", "Rap FR", "Voix", X(TALKBOX, { fmt: [[600, 1, 5], [1000, 0.6, 6], [2700, 0.3, 8]], glide: 0.03, vib: [6, 6, 0.1], rev: 0.35 }));

  // ---- Hip-hop US
  add("dre-piano", "Piano « Still D.R.E. »", "Dr. Dre – Still D.R.E.", "Hip-hop US", "Piano", X(PIANO, { o: [{ w: "triangle" }, { w: "triangle", r: 2, g: 0.5 }, { w: "sine", r: 3, g: 0.15 }, { w: "noise", bp: 4, g: 0.3, dec: 0.01 }], f: { c: 4200 }, a: [0.002, 0.7, 0, 0.12], rev: 0.15 }));
  add("gfunk-whistle", "Sifflet G-Funk", "Dr. Dre – Nuthin' but a « G » Thang", "Hip-hop US", "Lead", { o: [{ w: "sine" }, { w: "triangle", g: 0.15 }], a: [0.03, 0.2, 0.9, 0.25], mono: true, glide: 0.12, vib: [5.5, 22, 0.25], vol: 0.45, oct: 1, rev: 0.25, dly: [0.32, 0.25, 0.15] });
  add("regulate-lead", "Lead « Regulate »", "Warren G – Regulate", "Hip-hop US", "Lead", { o: [{ w: "square" }, { w: "sine", g: 0.6 }], f: { c: 1200, kt: 0.8, q: 2 }, a: [0.02, 0.2, 0.9, 0.2], mono: true, glide: 0.1, vib: [5, 18, 0.3], oct: 1, vol: 0.35, rev: 0.3 });
  add("california-talkbox", "Talkbox « California Love »", "2Pac – California Love", "Hip-hop US", "Voix", TALKBOX);
  add("gangsta-strings", "Cordes « Gangsta's Paradise »", "Coolio – Gangsta's Paradise", "Hip-hop US", "Cordes", X(STRINGS, { a: [0.3, 0.5, 0.9, 0.8], f: { c: 2600 }, rev: 0.5 }));
  add("runaway-piano", "Piano « Runaway »", "Kanye West – Runaway", "Hip-hop US", "Piano", X(PIANO, { f: { c: 2600 }, rev: 0.5, a: [0.003, 2.6, 0, 0.6] }));
  add("humble-piano", "Piano « HUMBLE. »", "Kendrick Lamar – HUMBLE.", "Hip-hop US", "Piano", X(PIANO, { o: [{ w: "triangle" }, { w: "triangle", r: 0.5, g: 0.6 }, { w: "sine", r: 2, g: 0.3 }, { w: "noise", bp: 4, g: 0.25, dec: 0.012 }], f: { c: 2000 }, drive: 0.25, rev: 0.12 }));
  add("mockingbird-piano", "Piano « Mockingbird »", "Eminem – Mockingbird", "Hip-hop US", "Piano", X(PIANO, { f: { c: 2200 }, rev: 0.35 }));
  add("changes-piano", "Piano « Changes »", "2Pac – Changes", "Hip-hop US", "Piano", X(PIANO, { cho: 0.25, rev: 0.25 }));
  add("hotline-organ", "Orgue « Hotline Bling »", "Drake – Hotline Bling", "Hip-hop US", "Orgue", X(ORGAN, { vib: [6.8, 18, 0], cho: 0.3, rev: 0.25 }));
  add("oldtown-banjo", "Banjo « Old Town Road »", "Lil Nas X – Old Town Road", "Hip-hop US", "Guitare", { o: [{ w: "square" }, { w: "sawtooth", r: 2, g: 0.3 }, { w: "noise", bp: 5, g: 0.3, dec: 0.006 }], f: { t: "highpass", c: 250, kt: 0.5 }, a: [0.001, 0.45, 0, 0.12], kd: 0.3, vol: 0.32, rev: 0.2 });
  add("stronger-vocoder", "Robot « Harder, Better, Faster »", "Daft Punk / Kanye West – Stronger", "Hip-hop US", "Voix", X(TALKBOX, { o: [{ w: "sawtooth", u: 2, sp: 6 }], fmt: [[500, 1, 5], [1500, 0.8, 6], [2500, 0.5, 8]], mono: false, vib: null, rev: 0.15 }));
  add("kit-boombap", "Kit boom bap 90s", "Hip-hop 90s (Dr. Dre, Nas)", "Hip-hop US", "Batterie", { kit: KITS.boombap, vol: 0.9, rev: 0.12, crush: 12 });

  // ---- Pop & R&B
  add("blinding-synth", "Synthé « Blinding Lights »", "The Weeknd – Blinding Lights", "Pop & R&B", "Lead", X(BRASS, { o: [{ w: "sawtooth", u: 3, sp: 12 }, { w: "square", g: 0.3 }], f: { c: 1500, e: 1.5, a: 0.02 }, cho: 0.45, dly: [0.28, 0.3, 0.2], rev: 0.4 }));
  add("badguy-bass", "Basse « bad guy »", "Billie Eilish – bad guy", "Pop & R&B", "Basse", { o: [{ w: "sine" }, { w: "sawtooth", g: 0.25 }], f: { c: 500, kt: 0.5, q: 1 }, a: [0.003, 0.5, 0.7, 0.08], drive: 0.55, mono: true, glide: 0.02, oct: -1, vol: 0.55, rev: 0 });
  add("asitwas-lead", "Lead « As It Was »", "Harry Styles – As It Was", "Pop & R&B", "Lead", X(LEAD, { o: [{ w: "square" }, { w: "sawtooth", g: 0.4, d: 6 }], f: { c: 3200, e: 0.5 }, cho: 0.4, rev: 0.3 }));
  add("heatwaves-pad", "Nappe « Heat Waves »", "Glass Animals – Heat Waves", "Pop & R&B", "Pad", X(PAD, { f: { c: 1300 }, cho: 0.5 }));
  add("levitating-bass", "Basse disco « Levitating »", "Dua Lipa – Levitating", "Pop & R&B", "Basse", X(BASS, { f: { c: 450, e: 2.5, d: 0.18, s: 0.3, q: 6 }, a: [0.002, 0.3, 0.5, 0.08] }));
  add("billiejean-bass", "Basse « Billie Jean »", "Michael Jackson – Billie Jean", "Pop & R&B", "Basse", X(BASS, { o: [{ w: "sawtooth" }, { w: "sawtooth", d: 8 }], f: { c: 380, e: 1.5, q: 2 }, a: [0.003, 0.25, 0.4, 0.08] }));
  add("clint-melodica", "Mélodica « Clint Eastwood »", "Gorillaz – Clint Eastwood", "Pop & R&B", "Lead", { o: [{ w: "pulse25" }, { w: "sawtooth", g: 0.3 }, { w: "noise", bp: 2, g: 0.08 }], f: { t: "bandpass", c: 1400, kt: 0.5, q: 1.2 }, a: [0.03, 0.2, 0.9, 0.1], vib: [4.5, 8, 0.3], vol: 0.7, rev: 0.3 });
  add("careless-sax", "Sax « Careless Whisper »", "George Michael – Careless Whisper", "Pop & R&B", "Cuivres", { o: [{ w: "sawtooth" }, { w: "noise", bp: 3, g: 0.12 }], fmt: [[650, 1, 4], [1300, 0.6, 5], [2800, 0.3, 6]], f: { c: 900, kt: 0.6, e: 1.5, a: 0.05, d: 0.3, s: 0.6 }, a: [0.03, 0.3, 0.9, 0.15], vib: [5.5, 20, 0.35], vol: 1.1, rev: 0.4, mono: true, glide: 0.04 });
  add("sevennation-guitar", "Guitare « Seven Nation Army »", "The White Stripes – Seven Nation Army", "Pop & R&B", "Guitare", { o: [{ w: "sawtooth" }, { w: "square", r: 0.5, g: 0.7 }], f: { c: 1400, kt: 0.3, q: 1 }, a: [0.003, 0.5, 0.8, 0.1], drive: 0.8, oct: -1, vol: 0.35, rev: 0.15 });
  add("titanic-whistle", "Flûtiau « My Heart Will Go On »", "Céline Dion – My Heart Will Go On", "Pop & R&B", "Flûte", X(FLUTE, { o: [{ w: "sine" }, { w: "sine", r: 2, g: 0.05 }, { w: "noise", bp: 1.5, q: 3, g: 0.15 }], oct: 1, vib: [5.5, 25, 0.3], rev: 0.5 }));
  add("blue-pluck", "Synthé « Blue (Da Ba Dee) »", "Eiffel 65 – Blue (Da Ba Dee)", "Pop & R&B", "Piano", X(PLUCK, { o: [{ w: "square", u: 2, sp: 8 }, { w: "sawtooth", r: 2, g: 0.3 }], f: { c: 1400, e: 2, d: 0.3, s: 0.2 }, a: [0.002, 0.6, 0.2, 0.15], cho: 0.4, rev: 0.25 }));
  add("gotye-xylo", "Xylophone « Somebody That I Used to Know »", "Gotye", "Pop & R&B", "Percussion", X(MALLET, { o: [{ w: "sine" }, { w: "sine", r: 3, g: 0.4, dec: 0.02 }], a: [0.001, 0.35, 0, 0.1], oct: 1 }));
  add("clocks-piano", "Piano « Clocks »", "Coldplay – Clocks", "Pop & R&B", "Piano", X(PIANO, { f: { c: 4200 }, dly: [0.33, 0.2, 0.12], rev: 0.3 }));
  add("rnb-ep", "Piano électrique R&B", "R&B (Frank Ocean, SZA)", "Pop & R&B", "Clavier", X(EP, { cho: 0.35, rev: 0.3 }));

  // ---- EDM
  add("levels-lead", "Lead « Levels »", "Avicii – Levels", "EDM", "Lead", X(SUPERSAW, { f: { c: 1800, e: 2, d: 0.25, s: 0.3, q: 2 }, a: [0.003, 0.3, 0.6, 0.2] }));
  add("sandstorm-lead", "Lead « Sandstorm »", "Darude – Sandstorm", "EDM", "Lead", X(LEAD, { o: [{ w: "sawtooth", u: 3, sp: 14 }], f: { c: 1500, e: 2.5, d: 0.12, s: 0.2, q: 3 }, a: [0.002, 0.15, 0.4, 0.08], dly: [0.17, 0.3, 0.25] }));
  add("animals-drop", "Drop « Animals »", "Martin Garrix – Animals", "EDM", "Lead", { o: [{ w: "square", u: 2, sp: 10 }, { w: "sawtooth", r: 0.5, g: 0.6 }], f: { c: 1200, kt: 0.4, e: 2, d: 0.15, s: 0.4, q: 4 }, a: [0.002, 0.2, 0.6, 0.06], drive: 0.7, vol: 0.32, rev: 0.15 });
  add("faded-pluck", "Pluck « Faded »", "Alan Walker – Faded", "EDM", "Pluck", X(PLUCK, { dly: [0.3, 0.35, 0.25], rev: 0.45 }));
  add("dywc-saw", "Supersaw « Don't You Worry Child »", "Swedish House Mafia", "EDM", "Lead", SUPERSAW);
  add("titanium-pluck", "Pluck « Titanium »", "David Guetta – Titanium", "EDM", "Pluck", X(PLUCK, { o: [{ w: "sawtooth", u: 5, sp: 18 }], f: { c: 800, e: 3, d: 0.35 }, a: [0.002, 0.7, 0, 0.3], cho: 0.3, rev: 0.4 }));
  add("dubstep-wobble", "Wobble dubstep", "Skrillex – Scary Monsters and Nice Sprites", "EDM", "Basse", { o: [{ w: "sawtooth" }, { w: "square", r: 0.5, g: 0.6 }], f: { c: 250, kt: 0.3, q: 9, lfo: [3, 4] }, a: [0.005, 0.2, 0.9, 0.1], drive: 0.75, mono: true, glide: 0.03, oct: -1, vol: 0.3, rev: 0.05 });
  add("leanon-chop", "Lead « Lean On »", "Major Lazer & DJ Snake – Lean On", "EDM", "Voix", { o: [{ w: "sawtooth" }, { w: "square", g: 0.4 }], fmt: [[800, 1, 5], [1250, 0.8, 6], [2700, 0.4, 7]], pe: [-2, 0.06], a: [0.005, 0.25, 0.7, 0.12], vol: 1, rev: 0.3, dly: [0.24, 0.25, 0.15] });
  add("letmelove-pluck", "Pluck vocal « Let Me Love You »", "DJ Snake – Let Me Love You", "EDM", "Pluck", { o: [{ w: "sawtooth", u: 2, sp: 8 }], fmt: [[700, 1, 5], [1150, 0.7, 6], [2600, 0.4, 7]], a: [0.003, 0.35, 0.1, 0.15], vol: 1, rev: 0.4, dly: [0.25, 0.3, 0.2] });
  add("pursuit-lead", "Lead « Pursuit of Happiness »", "Kid Cudi – Pursuit of Happiness (remix)", "EDM", "Lead", X(LEAD, { f: { c: 2200, e: 1.5, d: 0.4 }, cho: 0.3, dly: [0.3, 0.35, 0.25], rev: 0.4 }));
  add("future-chords", "Accords future bass", "Future bass (Flume, Illenium)", "EDM", "Pad", X(SUPERSAW, { trem: [4, 0.8], f: { c: 3500, e: 1, a: 0.2, d: 0.5, s: 0.7 }, rev: 0.4 }));
  add("m1-organ", "Orgue house M1", "Robin S – Show Me Love", "EDM", "Orgue", { o: [{ w: "sine" }, { w: "sine", r: 2, g: 0.7 }, { w: "sine", r: 3, g: 0.4 }, { w: "sine", r: 4, g: 0.4 }, { w: "sine", r: 6, g: 0.2 }, { w: "noise", hp: 3000, g: 0.15, dec: 0.006 }], a: [0.002, 0.35, 0.3, 0.1], vol: 0.3, rev: 0.15 });
  add("rave-stab", "Stab rave 90s", "Rave / eurodance 90s", "EDM", "Lead", X(SUPERSAW, { o: [{ w: "sawtooth", u: 5, sp: 25 }, { w: "sawtooth", s: 7, u: 3, sp: 20, g: 0.6 }, { w: "sawtooth", s: 12, g: 0.4 }], f: { c: 2500, e: 1.5, d: 0.2, s: 0.2 }, a: [0.002, 0.25, 0, 0.15] }));
  add("tropical-flute", "Flûte de Pan tropical house", "Kygo – tropical house", "EDM", "Flûte", X(FLUTE, { o: [{ w: "sine" }, { w: "triangle", r: 2, g: 0.1 }, { w: "noise", bp: 1.5, q: 2, g: 0.3, dec: 0.04 }], a: [0.02, 0.4, 0.3, 0.2], dly: [0.3, 0.3, 0.2], rev: 0.4 }));
  add("kit-house", "Kit house 909", "House / techno", "EDM", "Batterie", { kit: KITS.house, vol: 0.9, rev: 0.1 });
  add("kit-jersey", "Kit jersey club", "Jersey club", "EDM", "Batterie", { kit: KITS.jersey, vol: 0.9, rev: 0.1 });

  // ---- Années 80
  add("takeonme-lead", "Lead « Take On Me »", "a-ha – Take On Me", "Années 80", "Lead", { o: [{ w: "square" }, { w: "sawtooth", r: 2, g: 0.3 }, { w: "pulse25", d: 8, g: 0.5 }], f: { c: 3500, kt: 0.3, q: 1 }, a: [0.003, 0.2, 0.75, 0.12], cho: 0.45, vol: 0.3, rev: 0.3 });
  add("sweetdreams-bass", "Basse « Sweet Dreams »", "Eurythmics – Sweet Dreams", "Années 80", "Basse", X(BASS, { o: [{ w: "sawtooth" }, { w: "sawtooth", d: 10 }], f: { c: 500, e: 2, d: 0.2, s: 0.3, q: 3 }, oct: 0, dly: [0.25, 0.25, 0.15], rev: 0.2 }));
  add("jump-brass", "Cuivres synthé « Jump »", "Van Halen – Jump", "Années 80", "Cuivres", X(BRASS, { o: [{ w: "sawtooth", u: 3, sp: 10 }], cho: 0.5, rev: 0.3 }));
  add("countdown-brass", "Cuivres « The Final Countdown »", "Europe – The Final Countdown", "Années 80", "Cuivres", X(BRASS, { o: [{ w: "sawtooth", u: 3, sp: 14 }, { w: "sawtooth", r: 2, g: 0.3 }], f: { c: 900, e: 2 }, rev: 0.45 }));
  add("axelf-lead", "Lead « Axel F »", "Harold Faltermeyer – Axel F", "Années 80", "Lead", { o: [{ w: "square" }, { w: "square", d: 10, g: 0.6 }], f: { c: 2800, kt: 0.3, e: 1, d: 0.1, s: 0.6 }, a: [0.002, 0.15, 0.6, 0.05], vol: 0.3, rev: 0.15 });
  add("dx-epiano", "Piano électrique FM", "Ballades des années 80", "Années 80", "Clavier", X(EP, { o: [{ w: "sine", fm: [1, 3, 0.25, 0.2] }, { w: "sine", fm: [14, 0.6, 0.02, 0], g: 0.25, dec: 0.05 }], cho: 0.4 }));
  add("synthwave-pad", "Nappe synthwave", "Synthwave (Drive, Kavinsky)", "Années 80", "Pad", X(PAD, { cho: 0.6, rev: 0.6 }));
  add("superstition-clav", "Clavinet « Superstition »", "Stevie Wonder – Superstition", "Années 80", "Clavier", { o: [{ w: "pulse12" }, { w: "sawtooth", r: 2, g: 0.2 }], f: { c: 1500, kt: 0.6, e: 1.5, d: 0.15, s: 0.4, q: 4 }, a: [0.001, 0.4, 0.3, 0.06], vol: 0.35, rev: 0.1 });
  add("lightmyfire-organ", "Orgue rock « Light My Fire »", "The Doors – Light My Fire", "Années 80", "Orgue", X(ORGAN, { o: [{ w: "square", g: 0.3 }, { w: "sine" }, { w: "sine", r: 2, g: 0.5 }, { w: "sine", r: 4, g: 0.3 }], f: { c: 3000, kt: 0.3 }, vib: [6, 6, 0] }));
  add("strawberry-mellotron", "Flûtes mellotron", "The Beatles – Strawberry Fields Forever", "Années 80", "Flûte", X(FLUTE, { vib: [0.8, 12, 0], crush: 12, f: { c: 2500, kt: 0.3 }, rev: 0.35 }));

  // ---- Afro & Latino
  add("amapiano-log", "Log drum amapiano", "Amapiano (Kabza De Small)", "Afro & Latino", "Basse", { o: [{ w: "sine" }, { w: "triangle", g: 0.2 }], pe: [7, 0.03], f: { c: 700, kt: 0.5, q: 3 }, a: [0.001, 0.5, 0, 0.12], drive: 0.4, oct: -1, vol: 0.65, rev: 0.1 });
  add("afrobeats-guitar", "Guitare afrobeats", "Afrobeats (Wizkid, Burna Boy)", "Afro & Latino", "Guitare", X(GUITAR, { o: [{ w: "triangle" }, { w: "square", r: 2, g: 0.15 }, { w: "noise", bp: 4, g: 0.2, dec: 0.006 }], a: [0.001, 0.5, 0, 0.12], cho: 0.3, dly: [0.22, 0.25, 0.15] }));
  add("afro-marimba", "Marimba afro", "Afro / amapiano", "Afro & Latino", "Percussion", MALLET);
  add("despacito-cuatro", "Cuatro « Despacito »", "Luis Fonsi – Despacito", "Afro & Latino", "Guitare", X(GUITAR, { o: [{ w: "sawtooth" }, { w: "sawtooth", r: 2, d: 6, g: 0.6 }, { w: "noise", bp: 4, g: 0.2, dec: 0.008 }], f: { c: 1200, e: 2, d: 0.25 }, a: [0.001, 0.8, 0, 0.2], vol: 0.35 }));
  add("reggaeton-pluck", "Pluck reggaeton", "Reggaeton (Bad Bunny)", "Afro & Latino", "Pluck", X(PLUCK, { o: [{ w: "square", u: 2, sp: 10 }], f: { c: 900, e: 2.5, d: 0.2 }, rev: 0.3 }));
  add("steel-drum", "Steel drum", "Caraïbes", "Afro & Latino", "Percussion", { o: [{ w: "sine" }, { w: "sine", r: 2, g: 0.5 }, { w: "sine", r: 3.01, g: 0.25 }, { w: "sine", r: 4.2, g: 0.15, dec: 0.1 }], a: [0.003, 0.7, 0, 0.2], kd: 0.3, vol: 0.4, rev: 0.25 });
  add("kalimba", "Kalimba", "Afro / chill", "Afro & Latino", "Percussion", { o: [{ w: "sine" }, { w: "sine", r: 5.4, g: 0.2, dec: 0.02 }, { w: "sine", r: 2, g: 0.1, dec: 0.1 }], a: [0.001, 1, 0, 0.2], kd: 0.3, vol: 0.55, rev: 0.3 });
  add("kit-amapiano", "Kit amapiano (log drums)", "Amapiano", "Afro & Latino", "Batterie", { kit: KITS.amapiano, vol: 0.9, rev: 0.15 });
  add("kit-reggaeton", "Kit reggaeton (dembow)", "Reggaeton / dembow", "Afro & Latino", "Batterie", { kit: KITS.reggaeton, vol: 0.9, rev: 0.1 });

  // ---- Films & jeux
  add("interstellar-organ", "Orgue « Interstellar »", "Hans Zimmer – Interstellar", "Films & jeux", "Orgue", { o: [{ w: "sine", r: 0.5, g: 0.6 }, { w: "triangle" }, { w: "sine", r: 2, g: 0.5 }, { w: "sine", r: 4, g: 0.25 }, { w: "noise", bp: 2, g: 0.04 }], a: [0.12, 0.5, 0.95, 0.9], vol: 0.3, rev: 0.75 });
  add("hedwig-celesta", "Célesta « Hedwig »", "Harry Potter – Hedwig's Theme", "Films & jeux", "Cloche", { o: [{ w: "sine" }, { w: "sine", r: 4, g: 0.3, dec: 0.08 }, { w: "sine", r: 2, g: 0.15 }], a: [0.001, 1.2, 0, 0.4], kd: 0.4, oct: 1, vol: 0.5, rev: 0.5 });
  add("strangerthings-arp", "Synthé « Stranger Things »", "Stranger Things (générique)", "Films & jeux", "Lead", { o: [{ w: "sawtooth", u: 2, sp: 8 }], f: { c: 500, kt: 0.5, e: 2.5, d: 0.25, s: 0.2, q: 8 }, a: [0.003, 0.3, 0.3, 0.2], vol: 0.35, dly: [0.33, 0.3, 0.2], rev: 0.45 });
  add("halloween-piano", "Piano « Halloween »", "John Carpenter – Halloween", "Films & jeux", "Piano", X(PIANO, { f: { c: 2800 }, rev: 0.55 }));
  add("got-cello", "Violoncelle épique", "Game of Thrones (générique)", "Films & jeux", "Cordes", X(STRINGS, { o: [{ w: "sawtooth" }, { w: "sawtooth", d: 5, g: 0.6 }], f: { c: 1400, kt: 0.5, q: 1 }, a: [0.06, 0.4, 0.9, 0.4], vib: [5.5, 14, 0.25], oct: -1, rev: 0.5 }));
  add("epic-strings", "Cordes épiques", "Musiques de films", "Films & jeux", "Cordes", X(STRINGS, { o: [{ w: "sawtooth", u: 5, sp: 16 }], rev: 0.6 }));
  add("heroic-horns", "Cors héroïques", "Musiques de films (cuivres)", "Films & jeux", "Cuivres", X(BRASS, { o: [{ w: "sawtooth", u: 2, sp: 6 }, { w: "triangle", r: 0.5, g: 0.4 }], f: { c: 450, e: 1.8, a: 0.12 }, a: [0.08, 0.4, 0.9, 0.4], rev: 0.55 }));
  add("nes-chip", "Chiptune 8-bit", "Jeux vidéo NES", "Films & jeux", "Lead", CHIP);
  add("gameboy-chip", "Chiptune Game Boy", "Jeux vidéo Game Boy", "Films & jeux", "Lead", X(CHIP, { o: [{ w: "pulse12" }], vib: [6, 10, 0.3] }));
  add("chip-bass", "Basse 8-bit", "Jeux vidéo (triangle)", "Films & jeux", "Basse", { o: [{ w: "triangle" }], a: [0.001, 0.2, 0.9, 0.03], crush: 5, oct: -1, vol: 0.5, rev: 0 });
  add("musicbox", "Boîte à musique", "Berceuses", "Films & jeux", "Cloche", { o: [{ w: "sine", r: 2 }, { w: "sine", r: 8.2, g: 0.25, dec: 0.04 }], a: [0.002, 0.8, 0, 0.3], kd: 0.3, vol: 0.4, rev: 0.4 });

  // ---- Lo-fi & chill
  add("lofi-keys", "Rhodes lo-fi", "Lo-fi hip-hop", "Lo-fi & chill", "Clavier", X(EP, { vib: [0.6, 14, 0], crush: 10, f: { c: 2200, kt: 0.2 }, rev: 0.35 }));
  add("lofi-piano", "Piano cassette", "Lo-fi (piano usé)", "Lo-fi & chill", "Piano", X(PIANO, { vib: [0.5, 12, 0], crush: 10, f: { c: 1800 }, rev: 0.35 }));
  add("chill-guitar", "Guitare chill", "Lo-fi / chillhop", "Lo-fi & chill", "Guitare", X(GUITAR, { f: { c: 700, e: 2 }, cho: 0.4, rev: 0.4 }));
  add("vibraphone", "Vibraphone jazz", "Jazz", "Lo-fi & chill", "Percussion", { o: [{ w: "sine" }, { w: "sine", r: 4, g: 0.25, dec: 0.15 }], a: [0.002, 2.5, 0, 0.6], trem: [5, 0.35], kd: 0.3, vol: 0.45, rev: 0.4 });
  add("ambient-pad", "Nappe ambient", "Ambient / méditation", "Lo-fi & chill", "Pad", X(PAD, { o: [{ w: "triangle", u: 3, sp: 9 }, { w: "sine", r: 2, g: 0.2 }], a: [1.2, 1, 0.9, 2.5], rev: 0.8 }));

  // ---- FX DJ
  add("airhorn", "Klaxon (air horn)", "Klaxon de DJ", "FX DJ", "FX", { o: [{ w: "sawtooth", u: 3, sp: 12 }, { w: "square", r: 1.5, u: 2, sp: 10, g: 0.6 }], f: { t: "bandpass", c: 1500, kt: 0.3, q: 1 }, pe: [-1, 0.08], vib: [6, 20, 0.1], a: [0.01, 0.3, 0.9, 0.1], drive: 0.4, vol: 0.6, rev: 0.25, dly: [0.25, 0.35, 0.25] });
  add("dub-siren", "Sirène dub", "Sound system reggae", "FX DJ", "FX", { o: [{ w: "square" }], f: { c: 2500, kt: 0.3 }, vib: [3, 700, 0], a: [0.01, 0.2, 0.9, 0.2], vol: 0.25, dly: [0.38, 0.55, 0.35], rev: 0.3 });
  add("laser", "Laser", "Effet laser", "FX DJ", "FX", { o: [{ w: "sawtooth" }, { w: "sine", g: 0.5 }], pe: [24, 0.18], a: [0.001, 0.25, 0, 0.05], vol: 0.35, dly: [0.15, 0.4, 0.25], rev: 0.2 });
  add("riser", "Montée (riser)", "Montée EDM", "FX DJ", "FX", { o: [{ w: "noise", g: 0.6 }, { w: "sawtooth", u: 3, sp: 20, g: 0.3 }], f: { c: 300, kt: 0.2, e: 5, a: 4, d: 1, s: 1, q: 3 }, a: [3.5, 1, 1, 0.4], vol: 0.35, rev: 0.4 });
  add("boom", "Impact (boom)", "Impact de drop", "FX DJ", "FX", { o: [{ w: "sine" }, { w: "noise", g: 0.4, dec: 0.08 }], pe: [24, 0.25], a: [0.001, 2.5, 0, 0.3], drive: 0.4, oct: -2, vol: 0.7, rev: 0.6 });
  add("vinyl-scratch", "Scratch", "Platines de DJ", "FX DJ", "FX", { o: [{ w: "noise", bp: 3, q: 2 }, { w: "sawtooth", g: 0.3 }], pe: [12, 0.08], f: { t: "bandpass", c: 1200, kt: 0.8, q: 2 }, a: [0.002, 0.15, 0, 0.05], vol: 0.6, rev: 0.05 });

  // ---- Instruments
  add("grand-piano", "Piano de concert", "Piano acoustique", "Instruments", "Piano", PIANO);
  add("bright-piano", "Piano brillant pop", "Piano pop", "Instruments", "Piano", X(PIANO, { f: { c: 5000 }, cho: 0.15 }));
  add("epiano", "Piano électrique", "Rhodes", "Instruments", "Clavier", EP);
  add("organ", "Orgue Hammond", "Orgue à tirettes", "Instruments", "Orgue", ORGAN);
  add("strings", "Ensemble de cordes", "Orchestre", "Instruments", "Cordes", STRINGS);
  add("choir", "Chœur", "Voix « Aah »", "Instruments", "Voix", CHOIR);
  add("nylon-guitar", "Guitare classique", "Guitare nylon", "Instruments", "Guitare", GUITAR);
  add("harp", "Harpe", "Harpe", "Instruments", "Cordes", { o: [{ w: "triangle" }, { w: "sine", r: 2, g: 0.3, dec: 0.3 }], a: [0.001, 1.8, 0, 0.6], kd: 0.4, vol: 0.5, rev: 0.45 });
  add("flute", "Flûte traversière", "Flûte", "Instruments", "Flûte", FLUTE);
  add("trumpet", "Trompette", "Cuivres", "Instruments", "Cuivres", { o: [{ w: "sawtooth" }], f: { c: 900, kt: 0.7, e: 2, a: 0.04, d: 0.3, s: 0.5, q: 1 }, a: [0.03, 0.2, 0.85, 0.1], vib: [5.5, 12, 0.3], vol: 0.38, rev: 0.3 });
  add("accordion", "Accordéon", "Musette", "Instruments", "Clavier", { o: [{ w: "sawtooth" }, { w: "sawtooth", d: 14, g: 0.8 }, { w: "square", r: 0.5, g: 0.3 }], f: { c: 2200, kt: 0.4 }, a: [0.03, 0.2, 0.9, 0.1], vol: 0.3, rev: 0.2 });
  add("harmonica", "Harmonica", "Blues", "Instruments", "Lead", { o: [{ w: "square" }, { w: "sawtooth", g: 0.5 }], f: { t: "bandpass", c: 1300, kt: 0.5, q: 1.5 }, a: [0.02, 0.2, 0.85, 0.1], vib: [5, 14, 0.2], vol: 0.8, rev: 0.25 });
  add("e-bass", "Basse électrique", "Basse aux doigts", "Instruments", "Basse", X(BASS, { o: [{ w: "triangle" }, { w: "sawtooth", g: 0.3 }], f: { c: 700, e: 1, q: 1 }, a: [0.002, 1.2, 0, 0.1] }));
  add("synth-bass", "Basse synthé", "Basse analogique", "Instruments", "Basse", BASS);


  // Niveaux mesurés pour que tous les sons aient un volume comparable
  const LEVELS = {"riser": 2.2, "ambient-pad": 2.0, "gameboy-chip": 2.2, "drill-choir": 2.2, "superstition-clav": 2.2, "choir": 2.2, "nes-chip": 2.2, "clint-melodica": 2.2, "letmelove-pluck": 2.2, "gangsta-strings": 2.2, "vinyl-scratch": 2.2, "strings": 2.2, "despacito-cuatro": 2.08, "epic-strings": 2.04, "drill-strings": 2.0, "careless-sax": 2.0, "trumpet": 1.86, "trap-dark-pad": 1.77, "synthwave-pad": 1.75, "nylon-guitar": 1.75, "heatwaves-pad": 1.72, "laser": 1.62, "strangerthings-arp": 1.59, "frmelo-guitar": 1.55, "heroic-horns": 1.53, "chill-guitar": 1.53, "dub-siren": 1.53, "sandstorm-lead": 1.49, "harmonica": 1.45, "memphis-lead": 1.43, "accordion": 1.43, "leanon-chop": 1.41, "trap-pizz": 1.39, "got-cello": 1.38, "m1-organ": 1.34, "musicbox": 1.33, "afrobeats-guitar": 1.29, "oldtown-banjo": 1.28, "countdown-brass": 1.28, "chip-bass": 1.56, "synth-bass": 1.54, "levitating-bass": 1.51, "takeonme-lead": 1.17, "faded-pluck": 1.16, "tropical-flute": 1.15, "organ": 1.15, "memphis-bell": 1.13, "gotye-xylo": 1.13, "steel-drum": 1.12, "harp": 1.12, "savage-choir": 1.11, "afrotrap-pluck": 1.11, "rave-stab": 1.11, "jump-brass": 1.11, "interstellar-organ": 1.11, "goosebumps-bell": 1.1, "e-bass": 1.32, "kalimba": 0.92, "runaway-piano": 0.87, "blinding-synth": 0.86, "levels-lead": 0.86, "titanium-pluck": 0.85, "dx-epiano": 0.83, "trap-lead": 0.83, "reggaeton-pluck": 0.76, "cloud-pad": 0.74, "regulate-lead": 0.74, "sweetdreams-bass": 0.92, "phonk-choir": 0.66, "blue-pluck": 0.65, "kit-reggaeton": 0.91, "autotune-lead": 0.62, "close-eyes-cowbell": 0.61, "california-talkbox": 0.61, "kit-amapiano": 0.88, "kit-boombap": 0.87, "kit-house": 0.85, "funk-cowbell": 0.57, "murder-cowbell": 0.55, "sevennation-guitar": 0.55, "tiki-cowbell": 0.54, "airhorn": 0.54, "dubstep-wobble": 0.68, "phonk-808": 0.67, "travis-808": 0.66, "animals-drop": 0.48, "stronger-vocoder": 0.48, "badguy-bass": 0.59, "party-808": 0.58, "metro-808": 0.56, "amapiano-log": 0.55, "humble-piano": 0.42, "kit-jersey": 0.56, "boom": 0.4, "kit-phonk": 0.54, "dior-808": 0.4, "kit-drill": 0.43, "kit-trap": 0.4};
  L.forEach(function (p) {
    const f = LEVELS[p.id];
    if (f) p.vol = (p.vol === undefined ? (p.kit ? 1 : 0.5) : p.vol) * f;
  });

  window.PRESETS = L;
  window.PRESET_KITS = KITS;
  window.PRESET_CATS = ["Phonk", "Trap", "Drill", "Rap FR", "Hip-hop US", "Pop & R&B", "EDM", "Années 80", "Afro & Latino", "Films & jeux", "Lo-fi & chill", "FX DJ", "Instruments"];
})();
