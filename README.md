# Piano Magique 🎹

Joue des morceaux célèbres au piano **en tapant n'importe quelle touche** : chaque tap joue la note suivante
du morceau, tu as l'impression de le jouer pour de vrai. **100 % gratuit, sans pub, sans compte, sans achat intégré.**

C'est une application web (PWA) : elle s'installe sur iPhone, Android, Mac ou PC depuis le navigateur
et fonctionne ensuite hors-ligne.

## Ce qu'il y a dedans

- **4 modes**
  - **Magique** : tape n'importe où (ou glisse sur les touches) → le morceau avance note par note.
  - **Apprendre** : la touche à jouer s'allume en or, l'accompagnement suit tout seul.
  - **Écouter** : le morceau se joue tout seul, vitesse réglable (40 % à 160 %).
  - **Libre** : piano normal + bouton ● pour **enregistrer** tes propres morceaux.
- **30 morceaux intégrés** (domaine public) : Lettre à Élise, Hymne à la joie, Canon de Pachelbel,
  Marche turque, Gymnopédie, Toccata de Bach, Clair de lune, Prélude en Do, Petite musique de nuit,
  Roi de la montagne, Guillaume Tell, French Cancan, Beau Danube bleu, Printemps de Vivaldi, Berceuse de Brahms,
  Joyeux anniversaire, Vive le vent, Douce nuit, Korobeïniki, Greensleeves, La Cucaracha…
- **Plus de 400 sons**
  - 18 synthés intégrés, instantanés et hors-ligne : piano, piano électrique, orgue, cordes, pad, supersaw EDM,
    lead, 8-bit, cloches, boîte à musique, marimba, guitare, clavecin, cuivres, flûte, chœur, basse 808, steel drum.
  - 3 banques de 128 instruments réels General MIDI (Fluid, Musyng, FatBoy) : violon, sax, guitares, basses,
    trompette, harpe, kalimba, sitar… téléchargés une fois puis gardés en cache.
- **Beat** : 10 rythmes (Pop, Hip-hop, Trap, House, Reggaeton, Rock, Afro, Funk, Valse, Métronome),
  calés automatiquement sur le tempo du morceau.
- **Ajoute n'importe quel morceau**
  - **Import MIDI** : choisis un fichier `.mid` (il en existe des milliers gratuits : bitmidi.com, freemidi.org,
    musescore.com…). Tu choisis la piste « mélodie » que tu joues en tapant ; les autres pistes deviennent
    l'accompagnement joué automatiquement entre tes taps.
  - **Éditeur de notes** : écris `Do4:2 Ré4 Mi4 Do4+Mi4+Sol4:4` (ou `C4 D4 E4`).
  - **Enregistrement** en mode Libre.
  - Export / import de tes morceaux en `.json` pour les partager.
- Notes qui tombent sur le clavier, Do Ré Mi ou C D E, transposition, sustain, réverbération,
  taille des touches, clavier d'ordinateur (A S D F… / Q S D F… en AZERTY).

> Les morceaux intégrés sont tous dans le domaine public. Les tubes récents sont protégés par le droit d'auteur,
> donc ils ne sont pas inclus : importe leur fichier MIDI depuis ton téléphone, il reste sur ton appareil.

## L'installer gratuitement sur ton téléphone

1. Sur GitHub : **Settings → Pages → Build and deployment → Source : « Deploy from a branch »**,
   choisis la branche et le dossier `/ (root)`, puis **Save**.
2. Au bout d'une minute, l'appli est en ligne sur `https://<ton-pseudo>.github.io/Piano/`.
3. **iPhone** : ouvre ce lien dans Safari → bouton Partager → **« Sur l'écran d'accueil »**.
   **Android** : Chrome → menu ⋮ → **« Installer l'application »**.

Pour la tester sur ton ordinateur sans rien installer : `python3 -m http.server` dans ce dossier,
puis ouvre http://localhost:8000.

## Format d'un morceau (éditeur)

| Écriture | Signification |
|---|---|
| `C4`, `Do4`, `F#5`, `Fa#5`, `Bb3`, `Sib3` | une note (nom + octave, Do4 = do du milieu) |
| `C4+E4+G4` | plusieurs notes ensemble (accord) |
| `:2` | durée ; elle reste valable pour les notes suivantes |
| `-` | silence |
| `\|` | barre de mesure (ignorée) |

## Structure du code

```
index.html            interface
style.css             styles
js/songs.js           morceaux intégrés
js/audio.js           moteur audio (synthés, banques HD, batterie)
js/midi.js            lecture des fichiers MIDI
js/app.js             modes, clavier, notes qui tombent, beat, éditeur…
sw.js                 hors-ligne
manifest.webmanifest  installation sur l'écran d'accueil
```

Aucune dépendance, aucune étape de compilation.
