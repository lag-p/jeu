# Lot 2.6C.1 — carte raster, navigation et personnages

## Reprise du 14 septembre 2026

Départ : `67f641a12e560da8d0221968c0e4ebc3b5d8306f`, `HEAD...origin/main = 0 0`
par rapport à la référence distante locale. Aucun fetch, commit ou push.
Le worktree sale correspondait à l'implémentation interrompue autorisée.
Le prompt initial a été retrouvé dans la session du 13 septembre.

État à la reprise :

| Étape | Preuve retrouvée | Suite donnée |
| --- | --- | --- |
| Audit et reproduction jour/nuit | Quatre captures originales dans `/tmp/2.6c1-before-*` | Conservées et copiées dans `captures-2.6c1/before/` |
| Nouvelle géométrie, caméra, navigation, vitesse, migration | Modules écrits ; test `lot-2.6c1.cjs` terminé avec trois PASS | Checkpoint conservé, sans relancer ce test |
| Atlas | PNG, JSON, générateur ; 200 frames produites | Aucune régénération |
| Intégration personnages/debug | Code présent, pas de validation finale | Inspection et contrôles complémentaires |
| Mobile | Une capture `minimum-day-390x844.png`, aucun rapport de réussite | Capture conservée ; reprise des scénarios incomplets |
| Régression et documentation 2.6C.1 | Absentes | Finalisation pendant cette reprise |

Inventaire initial en lecture seule : 305 fichiers hors Git, tous les JSON parsables,
155 PNG avec CRC, décompression zlib et terminaison IEND valides. Aucun fichier vide
dans les assets. Les trois masters correspondent aux SHA-256 de leur manifeste.
Les quatre `.blend` existants se décompressent sans erreur et possèdent leur bloc
final ENDB ; aucune ouverture ni génération Blender n'a été lancée. Les 63 images
référencées par `source/export-metadata.json` sont présentes et incluses dans le
contrôle PNG. Les anciens journaux d'exports interrompus sont conservés ; les
métadonnées finalisées et les sorties présentes les complètent. Aucun processus
Blender, export ou ancien test navigateur actif dans l'inventaire de l'hôte.

Aucune suppression, extraction, recalibration ni réécriture des masters ou de
l'atlas. Le checkpoint barycentrique historique reste inchangé.

## Causes et corrections

- **Ancien décor visible** : le renderer dessinait volontairement un fond
  procédural sous le master pour couvrir l'ancien monde débordant de l'image.
  Le dézoom conservait un minimum générique de 0,2 et le pan autorisait une
  demi-largeur de viewport au-delà des limites. Le raster constitue désormais
  tout le décor quand ses assets sont disponibles. Le fallback est intégral.
- **Traversées et vitesse disproportionnée** : le graphe cartésien Blender
  restait la navigation métier ; une déformation barycentrique inversible le
  projetait sur une topologie différente. Son étirement local variait selon les
  triangles et les directions. Les vitesses métier étaient trop élevées à
  l'échelle du raster. Aucun double facteur ×2 ni extrapolation de rendu trouvé.
- **Marqueurs** : les personnages utilisaient les primitives rectangle/cercle du
  prototype. Un atlas partagé local les remplace, avec silhouette articulée de
  secours lorsque l'image ou une frame manque.
- **Correction de reprise** : le bornage historique 5–95 du placement initial
  déplaçait les accès raster proches du bord hors de leur route. Le raster garde
  désormais la position praticable calculée, testée sur ses six accès.

## Géométrie et navigation

`RASTER_QUARTER_V1`, schéma 1, est la carte par défaut. Le repère métier est
normalisé de 0 à 100 sur chaque axe du master 853 × 1844 :
`pixel = (x × 8,53, y × 18,44)`, puis 0,5 unité de scène par pixel.
La conversion inverse utilise exactement ces facteurs. Le zoom n'y intervient pas.
Le maillage ancien reste disponible pour les outils historiques, sans déformer
les déplacements raster.

`raster-map.js` décrit sept empreintes et entrées d'immeubles, six accès extérieurs,
sept appartements, deux cours, les routes et trottoirs, parkings piétons, passages
et escaliers, postes de vente, supervision et stockage. Les murs, trois arbres et
véhicules explicitement relevés sont bloquants. Le reste de l'image est inaccessible
si aucun couloir praticable ne le couvre : un parking entier n'est pas libre.

Le graphe déterministe contient 772 nœuds, reliés uniquement le long de couloirs
explicites. Chaque segment est contrôlé contre les polygones bloquants et la largeur
praticable. Le chemin rejoint un nœud visible depuis la position de départ, puis
contourne les obstacles. Une destination sur un bâtiment est refusée ; aucune
projection automatique du toucher sur une route éloignée.

Le bouton **Géométrie**, disponible avec `DEBUG = true`, superpose voies, graphe,
empreintes, murs, arbres, véhicules et trajets actifs. Le texte indique les entités
occluses et la catégorie/l'identifiant de l'obstacle. Les éléments de debug et les
masques décoratifs n'ont pas d'interactivité Phaser.

## Caméra, toucher et marche

Le minimum raster vaut `max(viewportWidth/426,5, viewportHeight/922)` : couverture
complète du viewport. Le pan reste dans l'image ; le recadrage revient à ce zoom
couvrant. Rotation et redimensionnement recalculent ce cadrage. Le maximum est 2,4,
sauf si un viewport très large nécessite un minimum supérieur pour rester couvert.
Le filtrage est linéaire et `setRoundPixels(false)` évite les joints de bandes.

Le geste est consommé par la sélection d'une entité avant toute requête de
mouvement. Pan et pincement annulent le candidat au toucher. La conversion du
sol et celle des personnages utilisent le même repère normalisé.

La simulation applique une seule fois ×1/×2 au temps. `simulationWalkingSpeed`
conserve les ratios des rôles/améliorations et applique un facteur raster 0,25.
Les distances de marche sont mesurées en pixels du master : le joueur parcourt
19,1925 pixels/s à ×1, 38,385 à ×2. Un trajet de 300 pixels dure environ 15,6 s à
×1. Le budget de distance restant traverse les nœuds continûment. Les positions
rendues sont exactement les positions simulées ; aucune RAF de gameplay ajoutée.
L'animation suit l'horloge simulée et reste figée pendant la pause.

## Personnages et occlusions

`assets/characters/people.png` : RGBA transparent 1280 × 960, atlas de 200 frames
64 × 96. Dix apparences : joueur, quatre civils, vendeur, guetteur, gérant,
ravitailleur et policier. Quatre directions, une pose immobile et quatre poses de
marche. Générateur déterministe Canvas : `tools/masters/characters.cjs`, déjà
exécuté avant interruption, à ne pas relancer pour reprendre ce lot.

Le corps possède tête, torse, bras, jambes, contour et ombre intégrée. Les civils
varient par identifiant stable ; le policier a une tenue bleu sombre et une
casquette, le ravitailleur un sac. La hauteur du cadre affiché est 10,56 unités de
scène (corps opaque plus petit), cohérente avec les étages. La sélection utilise
une ellipse séparée ; les hitboxes tactiles restent élargies.

Quinze silhouettes raster : sept façades, cinq murs et trois cimes. Des copies
masquées du master, découpées par bandes de huit pixels source, passent devant
les sprites selon leur pied projeté. Seules les bandes recouvrant une entité
sont activées. Les masques utilisent exclusivement la géométrie raster. Les
captures complémentaires montrent devant/derrière CENTRAL, EAST_REAR, SOUTH_W,
COURT_N_WALL et TREE_COURT_N sur des points réellement praticables.

## Sauvegardes

Version 6. Une sauvegarde v5 `REFERENCE_QUARTER_V1` est migrée une seule fois
vers le raster sur une copie détachée validée. Les correspondances d'immeubles
servent uniquement à cette migration ; chaque position rejoint le nœud de
couloir correspondant le plus proche. Les appartements connus retrouvent leur
entrée, les zones et connaissances policières sont remappées, les caches de
route sont reconstruits. Argent, stocks, journée, employés, identifiants et étapes
de missions sont conservés. Une restauration répétée du snapshot v6 est stable.
Les cartes `LEGACY_TEST_MAP` et `PONCETTE_INSPIRED_V1` restent inchangées.

## Validation et captures

- Checkpoint pré-interruption réutilisé : `node tests/lot-2.6c1.cjs`, trois PASS
  (connectivité et accès, pause/×1/×2/découpages, migration distincte et idempotente).
- `tests/lot-2.6c1-extra.cjs` : placements aux six accès ; métadonnées et poses ;
  raisons d'occlusion devant/derrière trois façades, deux murs et deux arbres ;
  migration d'une mission en cours, conservation et livraison terminée. PASS.
- `tests/lot-2.6c1-mobile.cjs` : 320×568, 390×844, 430×932, 667×375. Quatre PASS,
  zéro erreur JS, zéro requête distante, zéro débordement horizontal. Caméra,
  rotation, sélection client, toucher route, pan/pinch, ×1/×2 et absence de mutation.
- `tests/lot-2.6c1-browser-extra.cjs` : transparence pixel réelle, quatre variantes
  simultanées et animation avec déplacement, bandes masquées sur voies praticables,
  trois longs trajets dans plusieurs directions, trois bascules de décor sans
  accumulation d'objets ; atlas absent et master nuit absent. PASS.
- Régression complète : **17 scénarios PASS**, chacun terminé une seule fois.
  Le premier processus a reçu SIGTERM (143) après onze réussites ; reprise hors
  sandbox à « trois journées et conservation », puis six scénarios terminés,
  code de sortie 0. Journaux `regression-final.log` et `regression-resume.log`.
  Aucun scénario déjà réussi n'a été relancé.
- Syntaxe JS/CJS, AST Python et `git diff --check` : PASS. Aucun script Python
  du projet exécuté. Les captures et rapports finaux sont complets et parsables.

Les rapports et captures sont dans `assets/art-v2/masters/captures-2.6c1/` :

| Fichiers | Contenu |
| --- | --- |
| `mobile-<largeur>x<hauteur>.json` | Assertions des quatre formats |
| `minimum-day-*`, `minimum-night-*` | Dézoom couvrant jour/nuit |
| `normal-skins-*` | Personnages à zoom normal |
| `route-around-central-*` | Tracé contournant CENTRAL |
| `facade-front-*`, `facade-behind-*` | Premières vues de contexte, sans preuve seule d'occlusion |
| `extra/*-front.png`, `extra/*-behind.png` | Couples devant/derrière contrôlés sur voies praticables |
| `extra/long-route-*.png` | Trajets accès nord/sud, ouest/est, sud-ouest/nord-est |
| `extra/fallback-*.png`, `extra/results.json` | Replis et contrôles complémentaires |
| `before/` | Reproductions originales conservées |

Le test mobile préserve les captures existantes. `JEU_RESUME=1` permet explicitement
de réutiliser les rapports réussis, uniquement sur un code inchangé ; une validation
future de changements doit utiliser de nouveaux chemins de captures. Le sélecteur
`JEU_EXTRA_REMAINING=1` reprend seulement les contrôles complémentaires après les
placements et l'atlas. La régression accepte `JEU_TEST_FROM` pour reprendre à un
scénario nommé sans rejouer les précédents.

## Limites et checklist Safari iPhone

La géométrie et les silhouettes sont des relevés manuels d'un décor aplati, pas
une reconstruction 3D exhaustive. Les cimes non relevées et les personnes peintes
dans l'image restent décoratives ; les occlusions sont approximées par bandes.
Le roster possède quatre directions, pas huit. À zoom minimal les personnages
restent petits ; les cibles tactiles sont plus grandes que leurs corps.
Le fallback sans atlas est une silhouette statique simplifiée.

Chromium automatisé ne valide pas Safari/iPhone réel, **non testé** :

- Portrait/paysage, dézoom et pan aux quatre limites, rotation en cours de geste.
- Recadrage après déplacement, pinch sans ordre parasite.
- Sélection des petits personnages et d'un client ; toucher d'une route et d'un toit.
- Marche lisible à ×1, exactement doublée à ×2, pause effective.
- Façades/murs/arbres devant et derrière ; jour, crépuscule et nuit.
- Restauration d'une ancienne partie et mission en cours, absence de débordement.

## Fichiers livrés et état Git

Modifications et ajouts du lot, laissés sans indexation, commit ni push :

```text
 M game.js
 M index.html
 M map-catalog.js
 M map.js
 M master-render.js
 M phaser-adapter.js
 M phaser-renderer.js
 M save.js
 M simulation.js
 M tests/lot-2.6a.js
 M tests/lot-2.6b2.js
 M tests/regression.cjs
?? LOT-2.6C.1.md
?? assets/art-v2/masters/captures-2.6c1/
?? assets/characters/
?? character-render.js
?? raster-map.js
?? raster-migration.js
?? tests/lot-2.6c1-browser-extra.cjs
?? tests/lot-2.6c1-extra.cjs
?? tests/lot-2.6c1-mobile.cjs
?? tests/lot-2.6c1.cjs
?? tools/masters/characters.cjs
```
