# Piano Magique 🎹

Un piano tactile avec **plus de 130 sons inspirés de tubes** : la cowbell de « Tiki Tiki », la cloche de
« Goosebumps », la flûte de « Mask Off », la 808 glissante de « Dior », le sifflet G-Funk de Dr. Dre,
le synthé de « Blinding Lights », le lead de « Levels »… Choisis un son et joue-le sur le clavier.
**100 % gratuit : pas de pub, pas de compte, pas d'achat intégré.**

C'est une application web (PWA). Elle s'installe sur iPhone, Android, Mac ou PC depuis le navigateur
et marche ensuite sans connexion.

## Ce qu'il y a dedans

- **133 sons recréés par synthèse**, rangés par style :
  Phonk, Trap, Drill, Rap FR, Hip-hop US, Pop & R&B, EDM, Années 80, Afro & Latino, Films & jeux, Lo-fi, FX DJ, Instruments.
  - Recherche par **artiste, morceau ou instrument** (« travis », « 808 », « cowbell », « flûte »…).
  - Boutons ‹ › pour passer d'un son à l'autre, avec un aperçu joué automatiquement.
  - Favoris ★.
- **8 kits de batterie** jouables sur le clavier : trap 808, drill, phonk (cowbells), boom bap, house 909,
  amapiano (log drums), reggaeton, jersey club.
- **384 vrais instruments en bonus** : 3 banques General MIDI libres de 128 instruments (violon, sax, guitares, harpe…),
  téléchargés à la demande puis gardés en cache.
- **Réglages de chaque son** : attaque, déclin, maintien, relâchement (ADSR), brillance, résonance, glissando,
  mono, octave, saturation, lo-fi, chorus, écho, réverbération. Enregistre ton réglage dans « Mes sons ».
- **Beat** : 10 rythmes (Trap, Hip-hop, House, Reggaeton, Afro, Funk…).
- **Clavier MIDI** USB ou Bluetooth (Chrome, Edge, Android), clavier d'ordinateur, multi-touch et glissando au doigt.
- **9 couleurs** pour les touches allumées.
- **Enregistrement** : le bouton ● enregistre ce que tu joues.
- **Leçons** (en plus) : 30 morceaux du domaine public et import de fichiers MIDI. Les notes tombent sur le clavier,
  et en mode Magique chaque tap joue la note suivante.

> Les sons sont **recréés de zéro par synthèse**, sans aucun extrait des morceaux. Les noms d'artistes et de
> titres servent seulement à décrire le style de chaque son.

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
js/presets.js         les 133 sons (paramètres de synthèse) et les kits
js/songs.js           morceaux des leçons
js/audio.js           moteur de synthèse, effets, batterie, banques HD
js/midi.js            lecture des fichiers MIDI
js/app.js             interface : sons, réglages, clavier, leçons, beat, MIDI…
sw.js                 hors-ligne
manifest.webmanifest  installation sur l'écran d'accueil
```

Aucune dépendance, aucune étape de compilation.
