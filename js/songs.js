/*
 * Bibliothèque de morceaux intégrés (domaine public uniquement).
 *
 * Format texte d'un morceau (voir README) :
 *   "E5:1 D#5 E5 C4+E4+G4:4 -:2"
 *   - une note = Lettre + (# ou b) + octave        ex. C4, F#5, Bb3
 *   - plusieurs notes jouées ensemble : reliées par +   ex. C4+E4+G4
 *   - ":n" = durée en unités (l'unité dépend du morceau, voir `q`)
 *     la durée est "collante" : sans ":n", on reprend la durée précédente
 *   - "-" = silence
 *   - "|" = barre de mesure (ignorée, juste pour la lisibilité)
 *
 * tempo = nombre d'unités par minute
 * q     = nombre d'unités dans une noire (sert au tempo du beat)
 */
(function () {
  "use strict";

  // Prélude en Do (BWV 846) : 5 notes par mesure, motif n1 n2 n3 n4 n5 n3 n4 n5 joué 2 fois
  function bachPrelude() {
    const bars = [
      "C4 E4 G4 C5 E5", "C4 D4 A4 D5 F5", "B3 D4 G4 D5 F5", "C4 E4 G4 C5 E5",
      "C4 E4 A4 E5 A5", "C4 D4 F#4 A4 D5", "B3 D4 G4 D5 G5", "B3 C4 E4 G4 C5",
      "A3 C4 E4 G4 C5", "D3 A3 D4 F#4 C5", "G3 B3 D4 G4 B4", "G3 Bb3 E4 G4 C#5",
      "F3 A3 D4 A4 D5", "F3 Ab3 D4 F4 B4", "E3 G3 C4 G4 C5", "E3 F3 A3 C4 F4",
      "D3 F3 A3 C4 F4", "G2 D3 G3 B3 F4", "C3 E3 G3 C4 E4",
    ];
    const out = [];
    bars.forEach(function (b) {
      const n = b.split(" ");
      for (let r = 0; r < 2; r++) {
        out.push(n[0], n[1], n[2], n[3], n[4], n[2], n[3], n[4]);
      }
    });
    return out.map(function (x, i) { return i === 0 ? x + ":1" : x; }).join(" ") + " C2+C3+G3+E4+C5:8";
  }

  // Sonate "Clair de lune" (1er mvt) : triolets sur une basse en octaves
  function moonlight() {
    const parts = [];
    function bar(bass, triplets) {
      triplets.forEach(function (t, i) {
        const notes = t.split(" ");
        notes.forEach(function (n, j) {
          parts.push((i === 0 && j === 0 && bass ? bass + "+" : "") + n);
        });
      });
    }
    const cm = "G#3 C#4 E4";
    bar("C#2+C#3", [cm, cm, cm, cm]);
    bar("B1+B2", [cm, cm, cm, cm]);
    bar("A1+A2", [cm.replace("G#3", "A3"), "A3 C#4 E4"]);
    bar("F#1+F#2", ["A3 D4 F#4", "A3 D4 F#4"]);
    bar("G#1+G#2", ["G#3 C4 F#4", "G#3 C#4 E4", "G#3 C#4 D#4", "F#3 C4 D#4"]);
    bar("C#2+C#3", ["G#3 C#4 E4", "G#3 C#4 E4", "G#3 C#4 E4"]);
    parts.push("G#3+G#4", "C#4", "E4");
    bar("C#2+C#3", ["G#3+G#4 C#4 E4", "G#3 C#4 E4", "G#3 C#4 E4", "G#3 C#4 E4"]);
    parts[0] += ":1";
    return parts.join(" ") + " C#2+C#3+G#3+C#4+E4+G#4:12";
  }

  const SONGS = [
    {
      id: "fur-elise", title: "Lettre à Élise", artist: "Beethoven", cat: "Classique",
      tempo: 300, q: 4, instrument: "synth:piano",
      notes: "E5:1 D#5 E5 D#5 E5 B4 D5 C5 | A4+A2 E3 A3 C4 E4 A4 | B4+E2 E3 G#3 E4 G#4 B4 | " +
        "C5+A2 E3 A3 E4 E5 D#5 | E5 D#5 E5 B4 D5 C5 | A4+A2 E3 A3 C4 E4 A4 | B4+E2 E3 G#3 E4 C5 B4 | " +
        "A4+A2 E3 A3 E4 E5 D#5 | E5 D#5 E5 B4 D5 C5 | A4+A2 E3 A3 C4 E4 A4 | B4+E2 E3 G#3 E4 G#4 B4 | " +
        "C5+A2 E3 A3 E4 E5 D#5 | E5 D#5 E5 B4 D5 C5 | A4+A2 E3 A3 C4 E4 A4 | B4+E2 E3 G#3 E4 C5 B4 | A4+A2+A3:6",
    },
    {
      id: "ode-joie", title: "Hymne à la joie", artist: "Beethoven", cat: "Classique",
      tempo: 240, q: 2, instrument: "synth:piano",
      notes: "E4+C3:2 E4 F4 G4 | G4+G2 F4 E4 D4 | C4+C3 C4 D4 E4 | E4+G2:3 D4:1 D4:4 | " +
        "E4+C3:2 E4 F4 G4 | G4+G2 F4 E4 D4 | C4+C3 C4 D4 E4 | D4+G2:3 C4:1 C4+C3:4 | " +
        "D4+G2:2 D4 E4 C4+C3 | D4+G2 E4:1 F4 E4:2 C4+C3 | D4+G2 E4:1 F4 E4:2 D4 | C4+C3 D4 G3+G2:4 | " +
        "E4+C3:2 E4 F4 G4 | G4+G2 F4 E4 D4 | C4+C3 C4 D4 E4 | D4+G2:3 C4:1 C4+C3+G3:4",
    },
    {
      id: "canon", title: "Canon en Ré", artist: "Pachelbel", cat: "Classique",
      tempo: 120, q: 2, instrument: "synth:strings",
      notes: "F#5+D3:4 E5+A2 D5+B2 C#5+F#2 B4+G2 A4+D2 B4+G2 C#5+A2 | " +
        "D5+D3 C#5+A2 B4+B2 A4+F#2 G4+G2 F#4+D2 G4+G2 E4+A2 | " +
        "D4+D3:2 F#4 A4+A2 G4 F#4+B2 D4 F#4+F#2 E4 D4+G2 B3 D4+D2 A4 G4+G2 B4 A4+A2 G4 | " +
        "F#4+D3:2 D4 E4+A2 C#5 D5+B2 F#5 A5+F#2 A4 B4+G2 G4 A4+D2 F#4 D4+G2 D5 C#5+A2 E5 | F#5+A4+D4+D3:8",
    },
    {
      id: "turque", title: "Marche turque", artist: "Mozart", cat: "Classique",
      tempo: 480, q: 4, instrument: "synth:piano",
      notes: "B4:1 A4 G#4 A4 | C5+A3:2 -:2 | D5:1 C5 B4 C5 | E5+A3:2 -:2 | F5:1 E5 D#5 E5 B5 A5 G#5 A5 | " +
        "B5 A5 G#5 A5 C6+A3+A2:4 | A5:2 C6 | B5+E3 A5 G#5 A5 | E5+A3 F5 D5 C5 | B4+E3:4 A4+A2:4 | " +
        "B4:1 A4 G#4 A4 | C5+A3:2 -:2 | D5:1 C5 B4 C5 | E5+A3:2 -:2 | F5:1 E5 D#5 E5 B5 A5 G#5 A5 | " +
        "B5 A5 G#5 A5 C6+A3+A2:4 | A5:2 C6 | B5+E3 A5 G#5 A5 | E5+A3 F5 D5 C5 | B4+E3:2 A4:2 A4+A3+A2:4",
    },
    {
      id: "gymnopedie", title: "Gymnopédie n°1", artist: "Satie", cat: "Classique",
      tempo: 66, q: 1, instrument: "synth:piano",
      notes: "G2:1 B3+D4+F#4:2 | D2:1 A3+C#4+F#4:2 | G2:1 B3+D4+F#4:2 | D2:1 A3+C#4+F#4:2 | " +
        "G2:1 B3+D4+F#4+F#5 A5 | D2+G5 A3+C#4+F#4+F#5 C#5 | G2+B4 B3+D4+F#4+C#5 D5 | D2+A4 A3+C#4+F#4:2 | " +
        "G2+F#4:1 B3+D4:2 | D2:1 A3+C#4+F#4:2 | G2:1 B3+D4+F#4+F#5:1 A5 | D2+G5 A3+C#4+F#4+F#5 C#5 | " +
        "G2+B4 B3+D4+F#4+C#5 D5 | D2+A4 A3+C#4+F#4:2 | G2+B3+D4+F#4+F#4:6",
    },
    {
      id: "toccata", title: "Toccata et fugue en ré mineur", artist: "Bach", cat: "Classique",
      tempo: 240, q: 4, instrument: "synth:organ",
      notes: "A5+A4:1 G5+G4 A5+A4:6 G5+G4:1 F5+F4 E5+E4 D5+D4 C#5+C#4:2 D5+D4:6 | " +
        "A4+A3:1 G4+G3 A4+A3:6 E4+E3:2 F4+F3 C#4+C#3 D4+D3:8 | " +
        "A3+A2:1 G3+G2 A3+A2:6 G3+G2:1 F3+F2 E3+E2 D3+D2 C#3+C#2:2 D3+D2:6 | " +
        "D2+A2+D3+F3+A3+C#4+E4:12 D2+A2+D3+F3+A3+D4:12",
    },
    {
      id: "moonlight", title: "Sonate au clair de lune", artist: "Beethoven", cat: "Classique",
      tempo: 162, q: 3, instrument: "synth:piano",
      notes: moonlight(),
    },
    {
      id: "prelude-c", title: "Prélude en Do majeur", artist: "Bach", cat: "Classique",
      tempo: 280, q: 4, instrument: "synth:harpsichord",
      notes: bachPrelude(),
    },
    {
      id: "menuet", title: "Menuet en Sol", artist: "Petzold / Bach", cat: "Classique",
      tempo: 240, q: 2, instrument: "synth:harpsichord",
      notes: "D5+G3+B3:2 G4:1 A4 B4 C5 | D5+B3:2 G4 G4 | E5+C4:2 C5:1 D5 E5 F#5 | G5+B3:2 G4 G4 | " +
        "C5+A3:2 D5:1 C5 B4 A4 | B4+G3:2 C5:1 B4 A4 G4 | F#4+D4:2 G4:1 A4 B4 G4 | A4+D3+F#3:6 | " +
        "D5+G3+B3:2 G4:1 A4 B4 C5 | D5+B3:2 G4 G4 | E5+C4:2 C5:1 D5 E5 F#5 | G5+B3:2 G4 G4 | " +
        "C5+A3:2 D5:1 C5 B4 A4 | B4+G3:2 C5:1 B4 A4 G4 | A4+D3:2 B4:1 A4 G4 F#4 | G4+G2+G3:6",
    },
    {
      id: "jesus-joie", title: "Jésus, que ma joie demeure", artist: "Bach", cat: "Classique",
      tempo: 210, q: 3, instrument: "synth:organ",
      notes: "G4+G2:1 A4 B4 D5+G3 C5 C5 E5+C3 D5 D5 G5+B2 F#5 G5 | D5+G2 B4 G4 A4+D3 B4 C5 D5+B2 E5 D5 C5+A2 B4 A4 | " +
        "B4+G2 G4 F#4 G4+B2 A4 D4 F#4+D3 A4 C5 B4+G2 A4 B4 | G4+G2 A4 B4 D5+G3 C5 C5 E5+C3 D5 D5 G5+B2 F#5 G5 | " +
        "D5+G2 B4 G4 A4+D3 B4 C5 D5+B2 E5 D5 C5+A2 B4 A4 | B4+D3 G4 F#4 G4+G2 A4 D4 E4+C3 F#4 A4 G4+G2+D3:6",
    },
    {
      id: "petite-musique", title: "Une petite musique de nuit", artist: "Mozart", cat: "Classique",
      tempo: 280, q: 2, instrument: "synth:strings",
      notes: "G4+G3:2 -:1 D4:1 G4+G3:2 -:1 D4:1 | G4+G3:1 D4 G4 B4 D5+G3:2 -:2 | " +
        "C5+F#3:2 -:1 A4:1 C5+F#3:2 -:1 A4:1 | C5+D3:1 A4 F#4 A4 D4+D3:2 -:2 | " +
        "G4+G3:2 -:1 D4:1 G4+G3:2 -:1 D4:1 | G4+G3:1 D4 G4 B4 D5+G3:2 -:2 | " +
        "C5+F#3:2 -:1 A4:1 C5+F#3:2 -:1 A4:1 | C5+D3:1 A4 F#4 A4 G4+G3+G2:4",
    },
    {
      id: "roi-montagne", title: "Dans l'antre du roi de la montagne", artist: "Grieg", cat: "Classique",
      tempo: 300, q: 2, instrument: "synth:strings",
      notes: "B3+B2:1 C#4 D4 E4 F#4+F#2 D4 F#4:2 | F4+C#3:1 C#4 F4:2 E4+C3:1 C4 E4:2 | " +
        "B3+B2:1 C#4 D4 E4 F#4+F#2 D4 F#4 B4 | A4+F#2 F#4 D4 F#4 A4+B2:4 | " +
        "B4+B3:1 C#5 D5 E5 F#5+F#3 D5 F#5:2 | F5+C#4:1 C#5 F5:2 E5+C4:1 C5 E5:2 | " +
        "B4+B3:1 C#5 D5 E5 F#5+F#3 D5 F#5 B5 | A5+F#3 F#5 D5 F#5 B5+B4+B2:4",
    },
    {
      id: "guillaume-tell", title: "Guillaume Tell (ouverture)", artist: "Rossini", cat: "Classique",
      tempo: 420, q: 3, instrument: "synth:brass",
      notes: "G4+C3:1 G4 G4:2 G4+C3:1 G4 G4:2 G4+C3:1 G4 C5:2 D5 E5 | " +
        "G4+G2:1 G4 G4:2 G4+G2:1 G4 G4:2 C5+G2:1 E5 D5:2 B4 G4 | " +
        "G4+C3:1 G4 G4:2 G4+C3:1 G4 G4:2 G4+C3:1 G4 C5:2 D5 E5 | " +
        "C5+F2:1 E5 G5:4 F5+G2:1 E5 D5 C5 E5 C5+C3+G3:6",
    },
    {
      id: "cancan", title: "French Cancan (Galop infernal)", artist: "Offenbach", cat: "Classique",
      tempo: 320, q: 2, instrument: "synth:brass",
      notes: "C5+C3:2 D5:1 F5 E5 D5 | G5+G2:2 G5:2 G5:1 A5 E5 F5 | D5+G2:2 D5:2 D5:1 F5 E5 D5 | " +
        "C5+C3:1 C6 B5 A5 G5 F5 E5 D5 | C5+C3:2 D5:1 F5 E5 D5 | G5+G2:2 G5:2 G5:1 A5 E5 F5 | " +
        "D5+G2:2 D5:2 D5:1 G5 E5 D5 | C5+C3:1 G5 D5 E5 C5+C4+C3:4",
    },
    {
      id: "beau-danube", title: "Le Beau Danube bleu", artist: "Strauss", cat: "Classique",
      tempo: 170, q: 1, instrument: "synth:strings",
      notes: "D4+D3:1 D4 F#4 A4+D3:3 -:1 A5+D4+F#4 A5+D4+F#4 -:1 F#5+D4+F#4 F#5+D4+F#4 | " +
        "D4+D3:1 D4 F#4 A4+D3:3 -:1 A5+D4+F#4 A5+D4+F#4 -:1 G5+C#4+E4 G5+C#4+E4 | " +
        "C#4+A2:1 C#4 E4 B4+A2:3 -:1 B5+C#4+G4 B5+C#4+G4 -:1 G5+C#4+E4 G5+C#4+E4 | " +
        "C#4+A2:1 C#4 E4 B4+A2:3 -:1 B5+C#4+G4 B5+C#4+G4 -:1 F#5+D4+A4 F#5+D4+A4 | D4+F#4+A4+D5+D3:3",
    },
    {
      id: "printemps", title: "Le Printemps (Les Quatre Saisons)", artist: "Vivaldi", cat: "Classique",
      tempo: 400, q: 4, instrument: "synth:strings",
      notes: "E5+E3:2 G#5+E3:2 G#5 G#5 F#5:1 E5 B5+E3:6 B5:1 A5 | G#5+E3:2 G#5 G#5 F#5:1 E5 B5+E3:6 B5:1 A5 | " +
        "G#5+E3:2 A5 B5 A5 G#5+B2:4 F#5:4 | E5+E3:2 G#5+E3:2 G#5 G#5 F#5:1 E5 B5+E3:6 B5:1 A5 | " +
        "G#5+E3:2 G#5 G#5 F#5:1 E5 B5+E3:6 B5:1 A5 | G#5+E3:2 A5 B5 A5 G#5+B2:4 F#5+B2:4 E5+E3+B3+E4:8",
    },
    {
      id: "berceuse", title: "Berceuse", artist: "Brahms", cat: "Classique",
      tempo: 200, q: 2, instrument: "synth:musicbox",
      notes: "E4:1 E4 G4+C3:4 E4:1 E4 G4+C3:4 E4:1 G4 C5+C3:2 B4+G2:3 A4:1 A4:2 G4+C3:2 | " +
        "D4:1 E4 F4+G2:2 D4:2 D4:1 E4 F4+G2:4 D4:1 F4 B4:1 A4 G4+G2:2 B4:2 C5+C3:4 | " +
        "C4:1 C4 C5+F2:4 A4:1 F4 G4+C3:4 E4:1 C4 F4+F2:2 G4:2 A4:2 G4+C3:4 | " +
        "C4:1 C4 C5+F2:4 A4:1 F4 G4+C3:4 E4:1 C4 F4+G2:2 E4:1 D4 C4+C3+G3:6",
    },
    {
      id: "marche-nuptiale", title: "Marche nuptiale (Chœur des fiançailles)", artist: "Wagner", cat: "Classique",
      tempo: 160, q: 2, instrument: "synth:organ",
      notes: "C4:2 F4+F3+A3:3 F4:1 F4:4 C4:2 G4+E3+Bb3:3 E4:1 F4+F3+A3:4 | " +
        "C4:2 F4+F3+A3:3 Bb4:1 Bb4+Bb2+D3:4 A4+F3:3 G4:1 F4+C3:3 E4:1 F4:3 G4:1 F4+F2+F3+A3:6",
    },

    // ---- Comptines & chansons populaires
    {
      id: "twinkle", title: "Ah ! vous dirai-je, maman", artist: "Traditionnel / Mozart", cat: "Comptines",
      tempo: 200, q: 1, instrument: "synth:musicbox",
      notes: "C4+C3:1 C4 G4+E3 G4 A4+F3 A4 G4+E3:2 F4+D3:1 F4 E4+C3 E4 D4+G2 D4 C4+C3:2 | " +
        "G4+E3:1 G4 F4+D3 F4 E4+C3 E4 D4+G2:2 G4+E3:1 G4 F4+D3 F4 E4+C3 E4 D4+G2:2 | " +
        "C4+C3:1 C4 G4+E3 G4 A4+F3 A4 G4+E3:2 F4+D3:1 F4 E4+C3 E4 D4+G2 D4 C4+C3+E3+G3:2",
    },
    {
      id: "frere-jacques", title: "Frère Jacques", artist: "Traditionnel", cat: "Comptines",
      tempo: 220, q: 1, instrument: "synth:marimba",
      notes: "C4+C3:1 D4 E4 C4 C4+C3 D4 E4 C4 | E4+C3 F4 G4:2 E4+C3:1 F4 G4:2 | " +
        "G4+C3:0.5 A4 G4 F4 E4:1 C4 G4+C3:0.5 A4 G4 F4 E4:1 C4 | C4+C3 G3 C4:2 C4+C3:1 G3 C4+C3:2",
    },
    {
      id: "clair-lune", title: "Au clair de la lune", artist: "Traditionnel", cat: "Comptines",
      tempo: 160, q: 1, instrument: "synth:musicbox",
      notes: "C5+C4:1 C5 C5 D5 E5+C4:2 D5+G3:2 C5+C4:1 E5 D5+G3 D5 C5+C4:4 | " +
        "C5+C4:1 C5 C5 D5 E5+C4:2 D5+G3:2 C5+C4:1 E5 D5+G3 D5 C5+C4:4 | " +
        "D5+G3:1 D5 D5 D5 A4+D4:2 A4:2 D5+G3:1 C5 B4 A4 G4+G3:4 | " +
        "C5+C4:1 C5 C5 D5 E5+C4:2 D5+G3:2 C5+C4:1 E5 D5+G3 D5 C5+C4+E4+G4:4",
    },
    {
      id: "anniversaire", title: "Joyeux anniversaire", artist: "Hill (domaine public)", cat: "Fêtes",
      tempo: 400, q: 4, instrument: "synth:piano",
      notes: "G4:3 G4:1 A4+C3:4 G4 C5 B4+G2:8 G4:3 G4:1 A4+G2:4 G4 D5 C5+C3:8 | " +
        "G4:3 G4:1 G5+C3:4 E5 C5 B4+F2 A4 F5:3 F5:1 E5+C3:4 C5 D5+G2 C5+C3+C4+E4:8",
    },
    {
      id: "vive-le-vent", title: "Vive le vent (Jingle Bells)", artist: "Pierpont", cat: "Fêtes",
      tempo: 320, q: 2, instrument: "synth:bells",
      notes: "E4+C3:2 E4 E4:4 E4+C3:2 E4 E4:4 E4+C3:2 G4 C4:3 D4:1 E4+C3:8 | " +
        "F4+F2:2 F4 F4:3 F4:1 F4+C3:2 E4 E4 E4:1 E4 E4+D3:2 D4 D4 E4 D4+G2:4 G4:4 | " +
        "E4+C3:2 E4 E4:4 E4+C3:2 E4 E4:4 E4+C3:2 G4 C4:3 D4:1 E4+C3:8 | " +
        "F4+F2:2 F4 F4:3 F4:1 F4+C3:2 E4 E4 E4:1 E4 G4+G2:2 G4 F4 D4 C4+C3+E3+G3:8",
    },
    {
      id: "douce-nuit", title: "Douce nuit", artist: "Gruber", cat: "Fêtes",
      tempo: 180, q: 2, instrument: "synth:choir",
      notes: "G4+C3:3 A4:1 G4:2 E4+C3:6 G4+C3:3 A4:1 G4:2 E4+C3:6 | D5+G2:4 D5:2 B4+G2:6 C5+C3:4 C5:2 G4+C3:6 | " +
        "A4+F2:4 A4:2 C5:3 B4:1 A4:2 G4+C3:3 A4:1 G4:2 E4+C3:6 | A4+F2:4 A4:2 C5:3 B4:1 A4:2 G4+C3:3 A4:1 G4:2 E4+C3:6 | " +
        "D5+G2:4 D5:2 F5:3 D5:1 B4:2 C5+C3:6 E5+C3:6 | C5+C3:3 G4:1 E4:2 G4+G2:3 F4:1 D4:2 C4+C3+E3+G3:12",
    },
    {
      id: "merry-christmas", title: "We Wish You a Merry Christmas", artist: "Traditionnel", cat: "Fêtes",
      tempo: 320, q: 2, instrument: "synth:bells",
      notes: "D4:2 G4+G2:2 G4:1 A4 G4 F#4 E4+C3:2 E4:2 E4:2 A4+A2:2 A4:1 B4 A4 G4 F#4+D3:2 D4:2 | " +
        "D4:2 B4+B2:2 B4:1 C5 B4 A4 G4+C3:2 E4:2 D4:1 D4 E4+C3:2 A4+D3:2 F#4:2 G4+G2+B3+D4:4",
    },
    {
      id: "saints", title: "When the Saints Go Marching In", artist: "Traditionnel", cat: "Folklore",
      tempo: 280, q: 2, instrument: "synth:brass",
      notes: "C4:2 E4 F4 G4+C3:8 C4:2 E4 F4 G4+C3:8 C4:2 E4 F4 G4+C3:4 E4+C3:4 C4+C3:4 E4+C3:4 D4+G2:8 | " +
        "E4:2 E4 D4 C4+C3:6 C4:2 E4+C3:4 G4:4 G4+F2:2 F4:6 E4:2 F4 G4+C3:4 E4:4 C4+G2:4 D4:4 C4+C3+E3+G3:8",
    },
    {
      id: "amazing-grace", title: "Amazing Grace", artist: "Traditionnel", cat: "Folklore",
      tempo: 180, q: 2, instrument: "synth:organ",
      notes: "D4:2 G4+G2:4 B4:1 G4 B4+G2:4 A4:2 G4+C3:4 E4:2 D4+G2:4 D4:2 G4+G2:4 B4:1 G4 B4+G2:4 A4:2 D5+D3:10 | " +
        "B4:2 D5+G2:3 B4:1 D5 B4 G4+G2:4 D4:2 E4+C3:3 G4:1 G4 E4 D4+G2:4 D4:2 G4+G2:4 B4:1 G4 B4+D3:4 A4:2 G4+G2+B3+D4:10",
    },
    {
      id: "greensleeves", title: "Greensleeves", artist: "Traditionnel", cat: "Folklore",
      tempo: 180, q: 2, instrument: "synth:pluck",
      notes: "A4:2 C5+A2:4 D5:2 E5+C3:3 F5:1 E5:2 D5+G2:4 B4:2 G4+E2:3 A4:1 B4:2 C5+A2:4 A4:2 A4+E2:3 G#4:1 A4:2 B4+E2:4 G#4:2 E4+E2:4 | " +
        "A4:2 C5+A2:4 D5:2 E5+C3:3 F5:1 E5:2 D5+G2:4 B4:2 G4+E2:3 A4:1 B4:2 C5+A2:3 B4:1 A4:2 G#4+E2:3 F#4:1 G#4:2 A4+A2:6 | " +
        "G5+C3:6 G5+C3:3 F#5:1 E5:2 D5+G2:4 B4:2 G4+E2:3 A4:1 B4:2 C5+A2:4 A4:2 A4+E2:3 G#4:1 A4:2 B4+E2:4 G#4:2 E4+E2:6 | " +
        "G5+C3:6 G5+C3:3 F#5:1 E5:2 D5+G2:4 B4:2 G4+E2:3 A4:1 B4:2 C5+A2:3 B4:1 A4:2 G#4+E2:3 F#4:1 G#4:2 A4+A2+E3:6",
    },
    {
      id: "korobeiniki", title: "Korobeïniki (chanson russe)", artist: "Traditionnel", cat: "Folklore",
      tempo: 300, q: 2, instrument: "synth:chip",
      notes: "E5+E3:2 B4:1 C5 D5:2 C5:1 B4 | A4+A2:2 A4:1 C5 E5:2 D5:1 C5 | B4+E2:3 C5:1 D5:2 E5:2 | C5+A2:2 A4:2 A4:4 | " +
        "D5+D3:3 F5:1 A5:2 G5:1 F5 | E5+C3:3 C5:1 E5:2 D5:1 C5 | B4+E3:2 B4:1 C5 D5:2 E5:2 | C5+A2:2 A4:2 A4:4 | " +
        "E5+E3:2 B4:1 C5 D5:2 C5:1 B4 | A4+A2:2 A4:1 C5 E5:2 D5:1 C5 | B4+E2:3 C5:1 D5:2 E5:2 | C5+A2:2 A4:2 A4+A3+A2:4",
    },
    {
      id: "cucaracha", title: "La Cucaracha", artist: "Traditionnel", cat: "Folklore",
      tempo: 360, q: 2, instrument: "synth:pluck",
      notes: "C4:1 C4 C4 F4+F2:3 A4:2 C4:1 C4 C4 F4+F2:3 A4:4 | F4+C3:2 F4:1 E4 E4 D4 D4 C4+C3:6 | " +
        "C4:1 C4 C4 E4+C3:3 G4:2 C4:1 C4 C4 E4+C3:3 G4:4 | C5+C3:2 D5:1 C5 Bb4 A4 G4 F4+F2+A3:6",
    },
  ];

  window.BUILTIN_SONGS = SONGS;
})();
