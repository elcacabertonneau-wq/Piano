# Zik pour iPhone 🎧

Zik est ton lecteur de musique perso : tu importes tes playlists Spotify et la musique est lue via le
**lecteur YouTube officiel**. Gratuit, sans compte et sans pub ajoutée par l'appli (les pubs YouTube habituelles
peuvent apparaître).

- Code de l'appli : dossier [`zik/`](../zik). Elle marche aussi dans un navigateur.
- Enveloppe iOS native : dossier `ios-zik/`.
- Le fichier **`Zik.ipa`** est compilé automatiquement par GitHub Actions sur un Mac, à chaque modification.

## 1. Télécharger le .ipa

Sur GitHub, dans le dépôt : **Releases → « Zik pour iPhone » → `Zik.ipa`**.
Tu le trouves aussi dans **Actions → Zik iPhone (.ipa) → dernier build → Artifacts**.

## 2. L'installer sans l'App Store

Apple impose qu'une appli soit **signée** pour démarrer. Pas besoin de vérification ni de validation :
un **identifiant Apple gratuit** suffit. Les outils ci-dessous signent l'appli avec ton identifiant au moment
de l'installation.

### Option A : Sideloadly (le plus simple, avec un PC ou un Mac)
1. Installe **Sideloadly** sur ton ordinateur (sideloadly.io), et iTunes s'il s'agit d'un PC Windows.
2. Branche ton iPhone en USB et accepte « Faire confiance à cet ordinateur ».
3. Glisse `Zik.ipa` dans Sideloadly, entre ton identifiant Apple, puis clique sur **Start**.
4. Sur l'iPhone : **Réglages → Général → VPN et gestion de l'appareil**, touche ton identifiant Apple, puis **Faire confiance**.
5. Avec iOS 16 ou plus récent : **Réglages → Confidentialité et sécurité → Mode développeur → Activer**. L'iPhone redémarre.

### Option B : AltStore ou SideStore
Installe AltStore (altstore.io) ou SideStore (sidestore.io) en suivant leur guide. Ensuite, ouvre `Zik.ipa`
depuis l'app Fichiers avec AltStore/SideStore. SideStore permet de renouveler l'appli directement depuis le
téléphone, sans ordinateur.

### À savoir
- Avec un identifiant Apple **gratuit**, Apple limite la signature à **7 jours**. Il faut ensuite la renouveler en un clic
  (Sideloadly : « Refresh », AltStore/SideStore : « Refresh All »). **Tes playlists sont conservées.**
  Un compte développeur Apple (99 €/an) fait passer la durée à 1 an.
- Au maximum 3 applis installées de cette façon en même temps avec un compte gratuit.

## 3. Première utilisation

1. **Importer tes playlists Spotify** : va sur exportify.net, connecte ton compte Spotify et exporte tes playlists en CSV.
   Ensuite, dans Zik : **Bibliothèque → Importer → Choisir des fichiers CSV**. Tu peux aussi coller une liste « Artiste - Titre ».
2. **Clé YouTube gratuite** (recommandé) : la marche à suivre est dans **Réglages** (environ 3 minutes avec un compte Google,
   sans carte bancaire). Elle permet de trouver automatiquement la vidéo de chaque titre, environ 100 titres par jour.
   Chaque titre n'est cherché qu'une seule fois.
   Sans clé, tu peux coller un lien YouTube pour chaque titre.
3. Lance une playlist : lecture, aléatoire, répétition, file d'attente, titres likés, ajout aux playlists.

## Limites

- **La musique s'arrête quand l'écran se verrouille** ou quand tu changes d'appli : le lecteur YouTube officiel ne joue
  pas en arrière-plan. L'option « Garder l'écran allumé » (activée par défaut) évite la mise en veille pendant la lecture.
- Le son joue même quand l'iPhone est en mode silencieux.
- Tes données restent sur le téléphone : pense à faire **Réglages → Sauvegarder** de temps en temps.

## Compiler soi-même (sur un Mac)

```sh
brew install xcodegen
cd ios-zik && xcodegen generate && open Zik.xcodeproj
```
