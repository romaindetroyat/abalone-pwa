# Abalone — L’art de l’équilibre

PWA française autonome, plateau en perspective douce, solo hors connexion et parties privées à deux appareils. Projet indépendant : `romaindetroyat/abalone-pwa`.

## Utilisation

- Cliquez sur une bille, ou glissez de la première à la dernière bille pour sélectionner une ligne de deux ou trois, à la souris ou au doigt. Les clics successifs sur les extrémités restent possibles.
- Cliquez sur une flèche autorisée, sur le plateau ou dans le panneau : le déplacement est immédiat, sans bouton de confirmation. Relâcher un glissement ne joue jamais de coup.
- Pendant la réflexion de l’ordinateur, « Jouer maintenant » utilise le meilleur coup issu de sa dernière profondeur de recherche terminée.
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
- `src/input.js` : gestes pointeur avec capture, séparation glissement/clic, annulation et protection contre les contacts multiples.
- `src/board.js` : rendu Canvas 2D haute densité avec projection semi-3D, éclairage et animations procéduraux.
- `src/app.js` : interface, sauvegarde locale, reprise réseau et synchronisation par requêtes HTTP toutes les 1,8 s au premier plan. Un état réseau n’est jamais conservé uniquement dans une instance Vercel.
- `supabase/migrations/001_game.sql` : stockage dans le schéma privé `abalone`. L’API publique appelle un point d’entrée contrôlé par jeton de joueur. Les jetons sont hachés SHA-256 en base. Aucune lecture/écriture directe des tables n’est autorisée aux visiteurs.
- Chaque mouvement réseau est validé intégralement dans PostgreSQL, sous verrou de ligne, avec vérification du joueur et du numéro de version. Les conflits et doubles envois sont rejetés.
- PWA : manifeste, icônes locales et service worker. Le cache ne traite jamais les requêtes Supabase. Le build versionne les URL CSS, des modules et du worker pour éviter de mélanger une nouvelle page avec des scripts anciens. Incrémenter `package.json` et le nom du cache dans `sw.js` à chaque livraison.

## Règles et conventions

14 billes par joueur, les noires commencent, victoire après 6 éjections. Déplacement de 1 à 3 billes alignées et contiguës ; poussées en ligne seulement et avec supériorité numérique (2/1, 3/1, 3/2).

Convention de cette application affichée dans l’aide : troisième répétition de position au même trait, ou 600 coups, = partie nulle. Les parties réseau expirent après 30 jours sans mouvement. Revenir en arrière est réservé au solo. En réseau, une revanche requiert l’accord des deux joueurs.

Référence des règles : https://www.zygomatic-games.com/wp-content/uploads/2019/08/abalone_fr_rules.pdf

## Force du moteur

Huit réglages, de Découverte à Recherche maximale. Budgets locaux de 120 ms à 10 s : Avancé 2,5 s, Expert 4 s, Expert + 6 s et Recherche maximale 10 s. La recherche des captures aux feuilles parcourt uniquement les rayons de sortie possibles ; les autres coups sont omis à cet horizon comme dans la recherche de captures précédente. Le moteur fonctionne entièrement sur le processeur local : aucune API de modèle génératif, aucun token consommé. Le niveau maximal n’est pas un classement Elo ni une force de champion certifiée. Les noms de niveaux sont des réglages de recherche ; l’évaluation contre des références externes et des joueurs expérimentés reste à effectuer.

Mesures indicatives du 5 novembre 2026 dans l’environnement de développement : position initiale, même profondeur 5, mêmes 32 404 nœuds et même coup, environ 754 ms avant optimisation et 350 ms après. Sur une position de milieu de partie construite par 28 coups déterministes, le budget de 1,5 s permet désormais de terminer la profondeur 5 au lieu de 4. Ces deux positions ne mesurent pas une force de jeu générale. La profondeur compte les demi-coups et inclut une recherche sélective. Les performances dépendent de l’appareil ; le temps réduit peut modifier le coup retenu.

## Vérification

- 18 tests Node, dont gestes souris/tactile, capture et annulation du pointeur, absence de déplacement au relâchement d’un glissement, et comparaison du générateur de captures avec tous les coups légaux sur 250 positions pour les deux couleurs.
- Tests Node des déplacements, poussées, éjections dans les six directions, sélections invalides, invariants sur des positions successives, annulation et capture gagnante immédiate.
- `tests/parity.sql` : 101 comparaisons entre moteur client et validateur PostgreSQL sur plusieurs positions.
- `tests/backend.sql` : création, entrée du second joueur, refus du troisième et des accès sans capacité, tours invalides, versions périmées, synchronisation, abandon, revanche mutuelle et isolation des tables. Les fixtures sont annulées par rollback.
- Parcours navigateur sur la version publiée : création, entrée de deux sessions indépendantes, mouvement dans les deux sens et reprise après rechargement validés.
- RLS est activé sans politique sur les tables privées : refus de tout accès direct intentionnel ; l’advisor Supabase signale ceci à titre informatif.

## Limites à valider sur matériel réel

Le navigateur de développement permet la vérification des interactions et de la mise en page à 390 pixels. L’installation, les gestes et la reprise après mise en veille doivent également être vérifiés sur un iPhone réel. Le mode expert serveur et une évaluation indépendante du niveau de jeu sont des évolutions, non des fonctionnalités présentes dans cette version.
