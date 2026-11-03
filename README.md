# Abalone — L’art de l’équilibre

PWA française autonome, plateau en perspective douce, solo hors connexion et parties privées à deux appareils. Projet indépendant : `romaindetroyat/abalone-pwa`.

## Utilisation

- Touchez une bille ; touchez la dernière bille pour sélectionner une ligne de deux ou trois.
- Choisissez une des directions autorisées, puis confirmez le mouvement. La confirmation peut être désactivée dans les réglages.
- Le plateau reste orienté du côté de votre couleur. Vue du dessus, sons et animations réduites disponibles.
- Pour jouer à deux, créez une partie et partagez l’invitation. Chacun utilise son propre appareil/navigateur.
- Une place réseau est liée à une capacité aléatoire conservée dans le navigateur. Effacer les données du site efface cette capacité ; il n’y a pas encore de récupération par compte.
- Sur iPhone, ouvrez dans Safari puis Partager → Sur l’écran d’accueil. Après le premier chargement complet, le solo est disponible hors connexion.

## Développement

Node.js 22+ ; aucune dépendance applicative ni CDN.

```sh
npm test
npm run dev
npm run build
```

Le build produit `dist/`. Vercel lit `vercel.json` et lance ce build. `src/config.js` ne contient que l’URL Supabase et sa clé **publique** ; aucune clé de service ni mot de passe.

## Architecture

- `src/engine.js` : règles pures, sélection, génération des coups, application/annulation.
- `src/search.js` et `src/worker.js` : moteur local en Web Worker ; negamax/alpha-bêta, recherche à approfondissement progressif, table de transpositions avec double signature, classement des coups, réductions tardives avec revérification et recherche des captures à l’horizon.
- `src/board.js` : rendu Canvas 2D haute densité avec projection semi-3D, éclairage et animations procéduraux.
- `src/app.js` : interface, sauvegarde locale, reprise réseau et synchronisation par requêtes HTTP toutes les 1,8 s au premier plan. Un état réseau n’est jamais conservé uniquement dans une instance Vercel.
- `supabase/migrations/001_game.sql` : stockage dans le schéma privé `abalone`. L’API publique appelle un point d’entrée contrôlé par jeton de joueur. Les jetons sont hachés SHA-256 en base. Aucune lecture/écriture directe des tables n’est autorisée aux visiteurs.
- Chaque mouvement réseau est validé intégralement dans PostgreSQL, sous verrou de ligne, avec vérification du joueur et du numéro de version. Les conflits et doubles envois sont rejetés.
- PWA : manifeste, icônes locales et service worker. Le cache ne traite jamais les requêtes Supabase.

## Règles et conventions

14 billes par joueur, les noires commencent, victoire après 6 éjections. Déplacement de 1 à 3 billes alignées et contiguës ; poussées en ligne seulement et avec supériorité numérique (2/1, 3/1, 3/2).

Convention de cette application affichée dans l’aide : troisième répétition de position au même trait, ou 600 coups, = partie nulle. Les parties réseau expirent après 30 jours sans mouvement. Revenir en arrière est réservé au solo. En réseau, une revanche requiert l’accord des deux joueurs.

Référence des règles : https://www.zygomatic-games.com/wp-content/uploads/2019/08/abalone_fr_rules.pdf

## Force du moteur

Huit réglages, de Découverte à Recherche maximale. Budgets locaux de 120 ms à 30 s. Le niveau maximal n’est pas un classement Elo ni une force de champion certifiée. Les noms de niveaux sont des réglages de recherche ; l’évaluation contre des références externes et des joueurs expérimentés reste à effectuer.

Mesure indicative dans l’environnement de développement, sur **une seule position** de milieu de partie : 66 560 nœuds / profondeur 5 en 1,5 s ; 219 474 nœuds / profondeur 6 en 4,94 s ; 697 896 nœuds / profondeur 7 en 14,85 s. La profondeur compte les demi-coups et inclut une recherche sélective, pas une exploration exhaustive uniforme. Les performances d’un iPhone peuvent être inférieures.

## Vérification

- Tests Node des déplacements, poussées, éjections dans les six directions, sélections invalides, invariants sur des positions successives, annulation et capture gagnante immédiate.
- `tests/parity.sql` : 101 comparaisons entre moteur client et validateur PostgreSQL sur plusieurs positions.
- `tests/backend.sql` : création, entrée du second joueur, refus du troisième et des accès sans capacité, tours invalides, versions périmées, synchronisation, abandon, revanche mutuelle et isolation des tables. Les fixtures sont annulées par rollback.
- RLS est activé sans politique sur les tables privées : refus de tout accès direct intentionnel ; l’advisor Supabase signale ceci à titre informatif.

## Limites à valider sur matériel réel

Le navigateur de développement permet la vérification des interactions et de la mise en page à 390 pixels. L’installation, les gestes et la reprise après mise en veille doivent également être vérifiés sur un iPhone réel. Le mode expert serveur et une évaluation indépendante du niveau de jeu sont des évolutions, non des fonctionnalités présentes dans cette version.
