# LOT 2.6C.3 — Personnages et chef d’orchestre

État au 21 septembre 2026 : implémentation et atlas intégrés, validations décrites ci-dessous. Publication autorisée par l’utilisateur après validation visuelle sur iPhone réel, résultat accepté. Ce compte rendu remplace les conclusions intermédiaires devenues obsolètes.

## Reprise et périmètre

- HEAD : `562cbdee8940f4ff5bbf5cac1cae096d5ce7048a`. Les changements non commités du lot ont été conservés ; divergence avec la référence locale `origin/main` : `0 0` (pas de fetch lors de cette reprise).
- Les neuf planches Blender et la régression complète avaient terminé après le dernier message du 17 septembre. Les journaux finaux ont été retrouvés et copiés dans les preuves ; aucun rendu Blender réussi n’a été relancé.
- Les trois masters, le recalage et le graphe routier ne sont pas modifiés. Le renderer lit les positions de simulation ; la boucle RAF reste unique.

## Comportement livré

- Le joueur n’a plus de coordonnées, destination ni sprite. La migration v8 supprime les anciens champs joueur et conserve les ressources et employés.
- La vente manuelle utilise un accueil fixe au repli, raccordé au stock stratégique, sans corps joueur. File et résolution des ventes restent utilisables.
- En préparation, la fiche vendeur permet d’attribuer ou restituer le stock, choisir un emplacement accessible, puis confirmer le déploiement. Les quantités, la capacité et le stock disponible sont contrôlés avant transfert.
- Choisir un emplacement ne déplace personne. Après confirmation, le vendeur suit le graphe piéton ; son poste devient actif à l’arrivée. Aucun départ sans confirmation après chargement explicite.
- Les trajets de préparation utilisent la simulation, sans avancer l’heure commerciale ni créer de clients. Pause et sauvegarde/reprise conservent le trajet.
- En activité, les ordres refusent missions, repli, contraintes police et affectations en attente. Le ravitailleur reste limité à son rattachement, le guetteur à son rayon d’observation et le gérant à son périmètre. Un vendeur déplacé libère sa file et réactive son poste après arrivée.
- Facteur de vitesse `1.7` commun aux employés et clients ; base employé `10 → 17`. L’accélération temporelle ×1/×2 est appliquée une seule fois en activité.
- Le capital initial présent dans ce lot est de 1000, contre 100 auparavant.

## Atlas v3

- Neuf apparences, huit directions, quatre poses de repos et six de marche : 720 cases de 64 × 96, atlas 2048 × 2208.
- Les poses sont issues de `tools/blender/create_people_v3.py`, puis assemblées par `tools/masters/pack_people_v3.py`. La marche v2 n’est plus recopiée.
- Checkpoints : `assets/characters/v3/source/people.blend`, neuf `*-sheet.png` et `geometry-audit.json`.
- SHA-256 de `people.png` : `3f236723a5499cbba0e91865c59c55bd908d0cb1cea07d7d1ef5661a15bc2e66`.
- Audit pixel : 72 groupes, chacun avec 4 repos distincts, 6 marches distinctes et une limite basse identique entre les repos. Audit géométrique : 80 poses avec au moins une semelle au sol et aucune semelle sous le sol.
- Taille monde fixe, environ 24 px CSS au cadrage initial ; la silhouette grandit avec le zoom. La cadence raster suit la distance parcourue ; `walkFps: 10` est une métadonnée, pas une cadence fixe imposée à tous.

## Validation et preuves

Dossier : `assets/art-v2/masters/captures-2.6c3/`.

- Régression complète du 18 septembre : **17 PASS, 0 ignoré**, événement `COMPLETE` dans `regression-verified.jsonl`. Pas de relance des scénarios réussis lors de la reprise : seules l’intégration de l’atlas et la documentation ont ensuite changé.
- `node tests/lot-2.6c3.cjs` : **PASS le 21 septembre** — chargement/déploiement, conservation, ventes automatiques et manuelles, pause/reprise, restrictions, migration v8 idempotente et équivalence ×1/×2.
- `tests/lot-2.6c3-atlas-audit.cjs` : **PASS le 21 septembre**, avec inspection de la planche `atlas-vendeur-8-directions-10-poses.png` et rapport `atlas-pixel-audit.json`.
- `tests/lot-2.6c3-deployment-mobile.cjs` : **PASS le 21 septembre** en 320 × 568, 390 × 844, 430 × 932 et 667 × 375 ; hauteur opaque initiale mesurée : 23,636 px. Le test mesure les pixels opaques au cadrage initial, utilise des taps tactiles et un pinch CDP, vérifie la consommation de la sélection, le recentrage et le repli classic/isometric. Le pan utilise une souris simulée.
- Le format 390 vérifie aussi l’ordre de profondeur aux façades, murs et arbres et produit les captures `occlusion-*-v3.png`, inspectées lors de cette reprise. L’exemple arbre masque le personnage ; les exemples façade/mur ne prouvent pas à eux seuls une découpe correcte sur tous les contours.
- Syntaxe : **27 fichiers JS/CJS et 2 scripts Python PASS**. `git diff --check` : PASS.
- Environnement réparé : le paquet temporaire jsdom était incomplet ; la même version 30.0.1 a été restaurée. Chromium nécessite un lancement hors du bac à sable. Une exécution multi-format s’est fermée pendant la bascule de renderer ; reprise des formats restants dans des processus séparés.

## Validation finale avant publication

- Validation visuelle sur iPhone réel effectuée et acceptée par l’utilisateur.
- Périmètre contrôlé contre la liste du lot ; aucun fichier extérieur inclus.
- Vérifications rapides : syntaxe JS/CJS et Python, `git diff --check` et contrôle du diff indexé. Aucune régénération d’asset ni relance de la régression complète.

## Limites

- Chromium automatisé ne valide pas Safari/iPhone réel, les performances GPU sur téléphone ni le naturel de l’animation en observation humaine à ×1/×2.
- L’appui géométrique et la différence des images ne constituent pas une validation exhaustive du glissement visuel des pieds.
- Les anciennes captures `320x568-*`, `390x844-*`, etc. sont historiques : leur suffixe `initial` employait `zoomTo(1)`. Les nouvelles captures `deployment-*-initial.png` utilisent `fitInitialCamera()`.
- Le test d’occlusion contrôle la profondeur et des exemples capturés ; il ne couvre pas tous les contours du quartier. Les personnages deviennent grands au zoom maximal, selon l’échelle monde fixe.
- L’ancien journal `regression.jsonl` conserve l’échec intermédiaire ; le résultat final est dans `regression-verified.jsonl`.

## Fichiers du lot

- Runtime : `camera.js`, `character-render.js`, `config.js`, `customers.js`, `daily-cycle.js`, `debug.js`, `employee-physical.js`, `employees.js`, `game.js`, `index.html`, `logistics.js`, `management.js`, `map.js`, `master-render.js`, `phaser-adapter.js`, `phaser-renderer.js`, `rendering.js`, `save.js`, `simulation.js`, `seller-deployment.js`.
- Tests adaptés : `tests/daily-cycle.js`, `tests/lot-2.5b.js`, `tests/lot-2.6a.js`, `tests/phases.js`.
- Tests du lot : `tests/lot-2.6c3.cjs`, `tests/lot-2.6c3-mobile.cjs`, `tests/lot-2.6c3-deployment-mobile.cjs`, `tests/lot-2.6c3-atlas-audit.cjs`.
- Assets et reproducteurs : `assets/characters/v3/`, `tools/blender/create_people_v3.py`, `tools/masters/pack_people_v3.py`.
- Compte rendu et preuves : `LOT-2.6C.3.md`, `assets/art-v2/masters/captures-2.6c3/`.

## Inventaire exact de publication

86 fichiers :

```text
LOT-2.6C.3.md
assets/art-v2/masters/captures-2.6c3/320x568-initial.png
assets/art-v2/masters/captures-2.6c3/320x568-max.png
assets/art-v2/masters/captures-2.6c3/320x568-min.png
assets/art-v2/masters/captures-2.6c3/320x568.json
assets/art-v2/masters/captures-2.6c3/390x844-initial.png
assets/art-v2/masters/captures-2.6c3/390x844-max.png
assets/art-v2/masters/captures-2.6c3/390x844-min.png
assets/art-v2/masters/captures-2.6c3/390x844.json
assets/art-v2/masters/captures-2.6c3/430x932-initial.png
assets/art-v2/masters/captures-2.6c3/430x932-max.png
assets/art-v2/masters/captures-2.6c3/430x932-min.png
assets/art-v2/masters/captures-2.6c3/430x932.json
assets/art-v2/masters/captures-2.6c3/667x375-initial.png
assets/art-v2/masters/captures-2.6c3/667x375-max.png
assets/art-v2/masters/captures-2.6c3/667x375-min.png
assets/art-v2/masters/captures-2.6c3/667x375.json
assets/art-v2/masters/captures-2.6c3/atlas-pixel-audit.json
assets/art-v2/masters/captures-2.6c3/atlas-vendeur-8-directions-10-poses.png
assets/art-v2/masters/captures-2.6c3/blender-resume.log
assets/art-v2/masters/captures-2.6c3/deployment-320x568-initial.png
assets/art-v2/masters/captures-2.6c3/deployment-320x568-night.png
assets/art-v2/masters/captures-2.6c3/deployment-320x568-seller.png
assets/art-v2/masters/captures-2.6c3/deployment-320x568.json
assets/art-v2/masters/captures-2.6c3/deployment-390x844-initial.png
assets/art-v2/masters/captures-2.6c3/deployment-390x844-night.png
assets/art-v2/masters/captures-2.6c3/deployment-390x844-seller.png
assets/art-v2/masters/captures-2.6c3/deployment-390x844.json
assets/art-v2/masters/captures-2.6c3/deployment-430x932-initial.png
assets/art-v2/masters/captures-2.6c3/deployment-430x932-night.png
assets/art-v2/masters/captures-2.6c3/deployment-430x932-seller.png
assets/art-v2/masters/captures-2.6c3/deployment-430x932.json
assets/art-v2/masters/captures-2.6c3/deployment-667x375-initial.png
assets/art-v2/masters/captures-2.6c3/deployment-667x375-night.png
assets/art-v2/masters/captures-2.6c3/deployment-667x375-seller.png
assets/art-v2/masters/captures-2.6c3/deployment-667x375.json
assets/art-v2/masters/captures-2.6c3/occlusion-facade-v3.png
assets/art-v2/masters/captures-2.6c3/occlusion-tree-v3.png
assets/art-v2/masters/captures-2.6c3/occlusion-wall-v3.png
assets/art-v2/masters/captures-2.6c3/regression-verified.jsonl
assets/art-v2/masters/captures-2.6c3/regression.jsonl
assets/art-v2/masters/captures-2.6c3/resume-validation-20260921.json
assets/art-v2/masters/captures-2.6c3/strategic-arrival.log
assets/characters/v3/people.json
assets/characters/v3/people.png
assets/characters/v3/source/customer0-sheet.png
assets/characters/v3/source/customer1-sheet.png
assets/characters/v3/source/customer2-sheet.png
assets/characters/v3/source/customer3-sheet.png
assets/characters/v3/source/geometry-audit.json
assets/characters/v3/source/gerant-sheet.png
assets/characters/v3/source/guetteur-sheet.png
assets/characters/v3/source/people.blend
assets/characters/v3/source/police-sheet.png
assets/characters/v3/source/ravitailleur-sheet.png
assets/characters/v3/source/vendeur-sheet.png
camera.js
character-render.js
config.js
customers.js
daily-cycle.js
debug.js
employee-physical.js
employees.js
game.js
index.html
logistics.js
management.js
map.js
master-render.js
phaser-adapter.js
phaser-renderer.js
rendering.js
save.js
seller-deployment.js
simulation.js
tests/daily-cycle.js
tests/lot-2.5b.js
tests/lot-2.6a.js
tests/lot-2.6c3-atlas-audit.cjs
tests/lot-2.6c3-deployment-mobile.cjs
tests/lot-2.6c3-mobile.cjs
tests/lot-2.6c3.cjs
tests/phases.js
tools/blender/create_people_v3.py
tools/masters/pack_people_v3.py
```
