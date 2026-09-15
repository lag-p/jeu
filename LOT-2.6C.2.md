# Lot 2.6C.2 — point d'étape, NON LIVRÉ

## Base et autorisation

HEAD initial autorisé : `6ea8f273ebc7c8e9f7f41df200a1d8b03a70cccb`.
Le HEAD initialement demandé, `eee5fc11df9ad62f4701a83f56177d27603b03e2`, a été
remplacé explicitement par l'utilisateur : le nouveau commit ajoute l'archive.
Branche `main`, worktree initial propre, divergence initiale `0 0` avec la référence
locale `origin/main`, sans fetch. Aucun commit, push ou ajout à l'index.

## Entrées

Extraction sans écrasement dans `references/lot-2.6c2/`, par
`python3 tools/masters/extract_2_6c2.py` (`unzip` absent).
Les deux images ont été inspectées visuellement avant l'intégration.

| Entrée | SHA-256 |
| --- | --- |
| Archive | `ae408b3bbc2efd4433b7d3d52ac564f9c03eace923e189ae3c385fcca83e21ba` |
| PNG jour fourni | `4514294d1c9c692e3671b46314be55c8af77ff11c4243ac6464f42d347fdac29` |
| Guide JPEG | `b7f178fc331c4d53ffc1251b71e57a71a0f4839c93d9432b3f1cf5206e693a74` |
| README fourni | `56b75c0987cd3efb12f309e8ec71dad709d0d37356e84d177918cfd2a95d7bf6` |

## Audit et causes

Lecture des rapports 2.6C/2.6C.1, modules raster, renderer, adaptateur,
personnages, catalogue, navigation (`map.js`), simulation, sauvegarde et migrations,
manifestes et tests ciblés existants ; lecture du lanceur de régression.

- Les trois masters historiques sont 853 × 1844. Jour/crépuscule n'ont pas été
  normalisés ; la nuit 853 × 1843 a reçu une copie de sa dernière ligne.
- Le maillage historique comporte 32 points et 58 triangles sans inversion.
  Il reste disponible ; la carte raster active utilise une conversion affine,
  et non ce maillage, depuis le lot 2.6C.1.
- Le repère précédent valait `(x × 8,53, y × 18,44)` pixels ; 0,5 unité de scène
  par pixel. Plusieurs constantes étaient dupliquées dans le renderer/caméra.
- La caméra précédente bornait explicitement à 426,5 × 922 unités de scène.
  Les nouvelles bornes doivent provenir du master effectivement chargé.
- La recherche de chemin utilisait une distance non pondérée et autorisait un
  raccourci direct avant de comparer les itinéraires. Aucune préférence de trottoir.
- `moveMapEntity` replaçait une entité non praticable sur `nearestWalkable` :
  téléportation possible. Le raster s'arrête désormais avec `pathBlocked`.
- Ancien atlas : 1280 × 960 RGBA, 200 frames de 64 × 96, dix apparences,
  quatre directions, quatre poses de marche et une idle, environ 4,69 MiB.
  Son affichage à 0,11 produisait un cadre de 10,56 unités de scène.
- Les occlusions sont des copies masquées du décor par bandes de 8 pixels,
  triées sur la ligne de pied : sept bâtiments, cinq murs, trois arbres.
- Sauvegarde v6 : positions, destinations, affectations, états physiques et
  zones ; `navRoute`, `navKey`, `route`, DOM exclus de la sérialisation.

## Carte et ambiances

Les nouveaux assets restent en **909 × 1536**, sans rééchantillonnage. Une échelle
uniforme de `1844/1536 × 0,5` fournit un master de 545,63671875 × 922 unités
de scène, soit l'équivalent de 1091,2734375 × 1844 pixels anciens.
Les anciens PNG/calibration/manifeste sont conservés.

Recalage mesuré de quatre patches, dans le repère ancien : translations optimales
`(119,-1)`, `(119,-2)`, `(120,-3)`, `(118,-3)`. Translation commune retenue
`(+120,-2)` ; pas de déformation locale. Les écarts résiduels et les anciens
relevés de voies restent à vérifier visuellement. Les silhouettes et points métier
subissent cette même transformation. Aucun HLM ni site commercial ajouté.

`tools/masters/expanded.py` applique des LUT RGB monotones au seul jour fourni.
Les gains sont mesurés sur les moyennes des références historiques :

| Ambiance | Gains RGB | SHA-256 du PNG exporté |
| --- | --- | --- |
| Jour | 1 / 1 / 1 | `486730a4b825997b9cacd8c2bc07f5f95c80f20bb26c2a2b4d6bcc58f6950b77` |
| Crépuscule | 0,590887 / 0,573048 / 0,767808 | `6d34396847b5dc388bbc4afc38b036762947d39f419b2650e24868eaa3e0998a` |
| Nuit | 0,651369 / 0,563782 / 0,635042 | `d09351e434ed6206fba530ecaf04d8d0f566e6712dd92db30977599bb965d9be` |

Trois textures RGBA : 16 754 688 octets décodés. Alpha entièrement opaque.
Identité géométrique vérifiée pixel par pixel contre la transformation attendue.
Pas de masque lumineux ajouté à ce stade. Fondu continu selon `neighborhoodMood`
et l'horloge métier, sans changement de la simulation du temps.

## Graphe automobile — brouillon, non intégré

`tools/masters/road-survey.json` et `road_network.py` produisent un premier
`vehicle-road-network.json` avec 50 nœuds, 51 connexions, identifiants stables,
types et champs futurs de sens/vitesse/stationnement. Le guide est recadré
conceptuellement à `[0,226,945,1822]`, puis rapporté au master natif.

**Ce graphe n'est pas validé et n'est pas chargé par le jeu.** La capture
`captures-2.6c2/road-review.png` révèle plusieurs contrôles sur des bords de voie,
de la végétation et un raccord sud incorrect. Il ne faut pas utiliser ces données
pour des véhicules. Aucun overlay automobile de production ni véhicule ajouté.

Le guide rouge lui-même comporte un raccord vertical extérieur gauche qui traverse
des arbres/maisons sur le visuel propre. Le raccord sud ne présente pas de jonction
carrossable visible à travers le mur : les escaliers ne suffisent pas à une voiture.
Clarification demandée à l'utilisateur : routes visibles uniquement ou intention
différente pour le raccord extérieur. Aucun passage automobile à travers un solide
ne sera validé pour satisfaire artificiellement la connectivité.

## Navigation et vitesse — implémentation partielle

`pedestrian-navigation.js` fournit un A* déterministe en distance raster pondérée.
Le raccourci direct est comparé au coût de l'itinéraire. Les segments sont testés
contre les solides et les corridors, y compris en déplacement ; pas de diagonale
à travers un angle. Une destination inaccessible bloque le mouvement sans déplacer
l'entité. Les chemins sont reconstruits si leur prochain segment devient bloqué.

Coûts centralisés `PEDESTRIAN_COSTS` : trottoir 1 ; chemin 1,05 ; transition 1,1 ;
passage piéton 1,15 ; cour 1,2 ; parking 1,3 ; pelouse 3 ; chaussée 12 ; solide ∞.
La pelouse et les chemins ont une catégorie prête, mais aucun nouveau relevé
exhaustif de leurs surfaces n'est livré. Deux trottoirs parallèles aux axes central
et sud et leurs raccords ont été ajoutés. Le réseau testé comporte 911 nœuds.
Les bandes extérieures et tous les alignements de voies restent à terminer.
`pedestrianCrossingContext` prépare la qualification d'une traversée, sans trafic.

Vitesse conservée et explicitée : 2,25 unités monde/s pour le joueur, 8,53 anciens
pixels par unité, soit 19,1925 pixels/s à ×1. L'équivalence 1,4 m/s est une estimation
de l'échelle du décor, pas une mesure topographique. Les ratios de rôle sont conservés.

| Distance de chemin (anciens pixels) | Théorie ×1 | Mesure pas 0,1 s | Mesure pas 0,25 s |
| --- | ---: | ---: | ---: |
| 211,345 | 11,012 s | 11,1 s | 11,25 s |
| 579,556 | 30,197 s | 30,2 s | 30,25 s |
| 2909,856 | 151,614 s | 151,7 s | 151,75 s |

## Personnages Blender

`tools/blender/create_people.py` : scène réutilisable Eevee, Blender 5.0.1,
deux threads, 16 échantillons, aucun asset externe. Tête, cheveux, oreilles,
visage, veste/hoodie/manteau, pantalon, bras articulés, chaussures et accessoires.
Dix apparences : joueur, quatre clients, quatre métiers, police.
Huit directions × (six frames de marche + idle) = 560 frames 64 × 96.
`pack_people.py` assemble les planches sans les rééchantillonner en un atlas
2048 × 2048 RGBA, 16 MiB décodés. L'ancien atlas est conservé et préchargé en repli.
Total décodé des deux atlas : environ 20,69 MiB, hors mémoire GPU supplémentaire.

La direction et la phase d'animation utilisent les déplacements réellement intégrés,
stockés dans un WeakMap non sérialisé. Ancre aux pieds `(0,5 ; 82/96)` ; profondeur
calculée à partir de la position au sol. Les rectangles de sélection d'occlusion
prennent désormais en compte la taille affichée. Taille cible du corps : 36 pixels
au zoom initial, plafond 64 au zoom fort. Cette cible dépasse une hausse de 70 %
par rapport au minuscule personnage précédent. Idle statique ; six frames mais
certaines poses symétriques sont proches : validation visuelle du cycle à compléter.

Commande initiale :

```sh
env OMP_NUM_THREADS=2 LP_NUM_THREADS=2 MESA_SHADER_CACHE_DIR=/tmp/jeu-mesa-cache /usr/bin/time -v -o assets/art-v2/masters/captures-2.6c2/blender-time.txt blender --background --factory-startup --threads 2 --python-exit-code 1 --python tools/blender/create_people.py > assets/art-v2/masters/captures-2.6c2/blender.log 2>&1
```

Interruption SIGTERM (143) après la planche joueur ; source `.blend` et planche
conservées. Même commande reprise hors confinement, avec sorties
`blender-resume-time.txt` et `blender-resume.log`. La reprise ouvre le `.blend`
et saute toutes les planches déjà terminées. Aucun rendu validé rejoué.

## Sauvegardes

Version 7 ; schéma raster 2. La migration v6 translate sur copie les positions
et destinations, conserve identifiants/affectations/états et ressources, puis valide.
Les zones fixes sont canonisées uniquement pour des écarts d'arrondi < 1e-10.
La migration v5 REFERENCE produit directement le repère élargi. Les cartes
historiques restent au schéma 1. Aucun changement de format pour la seule caméra.
Les positions anciennes hors couloir ne sont pas téléportées par le déplacement :
elles bloquent ; une politique de réparation de ces anciennes erreurs reste à définir.

## Validations du point d'étape

- `node tests/lot-2.6c1.cjs` : PASS après translation, puis PASS après ajout des
  trottoirs (911 nœuds, accès, vitesse, v5). Ce sont des tests ciblés.
- `node tests/lot-2.6c2.cjs` : premier échec sur l'arrondi des zones v6 ; corrigé.
  Reprise PASS : copie/idempotence v6, préférence trottoir, blocages sans
  téléportation, temps de parcours, huit directions et six indices de frame.
- `tests/lot-2.6c2-assets.py` : PASS dimensions, hashes, alpha, LUT/identité
  géométrique et 58 triangles sans inversion ; atlas contrôlé après assemblage.
- Régression complète : **non lancée**. Elle reste réservée à la fin du lot.
- Validation Chromium du point d'étape : voir complément ci-dessous.
- Safari/iPhone réel : non exécuté.

## Restant avant livraison

Relever et valider le réseau automobile après clarification, implémenter son overlay,
vérifier chaque chemin piéton et les nouvelles bandes, compléter les cas de replanning
et migration invalides, vérifier les cycles/occlusions sur des captures dédiées,
valider pinch/sélection/trajets et fallback master aux quatre formats, puis exécuter
une seule régression complète avec reprise par groupe si nécessaire.
Les fichiers de logique économique, vente, logistique et police n'ont pas été édités.
Le guide local de validation par phases a guidé la séparation des tests ciblés et de
la régression finale. Ce rapport décrit un travail en cours, pas une livraison validée.

## Reprise — diagnostic du chargement et validation Chromium

HEAD de reprise : `6ea8f273ebc7c8e9f7f41df200a1d8b03a70cccb`, divergence
`0 0` avec la référence locale `origin/main` (sans fetch). Les changements du
lot en cours ont été conservés. Aucun export Blender ni master régénéré.

La cause du timeout Chromium était un rejet de la calibration : l'export JSON
contient `0.6002604166666667`, tandis que le calcul JavaScript produit
`0.6002604166666666`. La comparaison stricte déclenchait le repli procédural.
`validMasterCalibration` accepte désormais une tolérance absolue de `1e-12`
pour l'échelle v2. Le test ciblé charge le vrai JSON exporté et vérifie aussi
qu'une échelle incorrecte de 0,001 reste rejetée.

`tests/lot-2.6c2-mobile.cjs` enregistre désormais l'état du renderer, les erreurs
JavaScript et les requêtes en cas d'échec de chargement. Le diagnostic initial
est conservé dans `captures-2.6c2/390x844-failure.json` ; il précède la correction.

Validations exécutées lors de cette reprise, toutes terminées avec code 0 :

- `env PYTHONPATH=/tmp/jeu-art-python/usr/lib/python3/dist-packages python3 tests/lot-2.6c2-assets.py` :
  trois masters, hashes, alpha, identité géométrique, calibration et atlas PASS.
- `node tests/lot-2.6c2.cjs` : calibration exportée, migration, navigation,
  absence de téléportation, orientation et temps de parcours PASS.
- `env LD_LIBRARY_PATH=/tmp/jeu-validation/libs/usr/lib/x86_64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/tmp/jeu-validation/browsers node tests/lot-2.6c2-mobile.cjs` :
  exécuté hors confinement après refus du sandbox au lancement Chromium ; PASS
  pour 390 × 844, 667 × 375, 320 × 568, 430 × 932 et 390 × 844 sans nouvel atlas.
  Huit combinaisons zoom/pan extrêmes par scénario, rotation, absence de débordement,
  sauvegarde inchangée et zéro erreur JavaScript. Hauteur estimée du corps : 36 px.
  Le test confirme `people-v2`, puis `people` lorsque le PNG v2 manque.
- Syntaxe de tous les JS/CJS modifiés et nouveaux, AST des dix scripts Python
  concernés et `git diff --check` : PASS.

Preuves Chromium : cinq fichiers `<format>.json` (dont `390x844-fallback.json`)
et quinze captures `<format>-day/dusk/night.png` dans `captures-2.6c2/`.
La capture jour 390 × 844 a été inspectée ; cette vue générale ne constitue pas
une validation dédiée de la visibilité du personnage derrière les bâtiments.
La hauteur reste une estimation du sprite, pas une mesure de ses pixels visibles.
Le test n'atteste pas encore les gestes pinch/sélection, les trajets en navigateur,
les occlusions, l'overlay automobile ni le fallback des masters élargis.
Safari/iPhone réel et régression complète toujours non exécutés.

Le journal Blender existant indique pour la reprise terminée : 9 min 24,95 s,
RSS maximum 1 856 724 Kio, code 0. Il ne mesure pas le coût total incluant le rendu
initial interrompu.

Fichiers de code/rapport modifiés pendant cette reprise : `master-render.js`,
`tests/lot-2.6c2.cjs`, `tests/lot-2.6c2-mobile.cjs`, `LOT-2.6C.2.md`.
Le réseau automobile attend toujours la clarification des raccords décrits plus
haut. Les autres travaux restants sont inchangés. Aucun commit, push ou ajout à
l'index ; lot toujours NON LIVRÉ.

## Décision sur le guide routier et reprise du graphe

La consigne a été précisée : seuls les axes de chaussée réellement visibles sont
retenus. Les traits du guide qui traversent végétation, bâtiments, murs, clôtures,
escaliers ou jardins sont exclus ; aucune liaison artificielle ne les remplace.
Le relevé conserve donc trois sorties effectivement visibles, un réseau principal
connecté et deux accès de stationnement dont l'un se termine à la limite visible
du parking. Les raccords sud à travers le mur et les prolongements extérieurs sans
chaussée continue restent explicitement exclus dans `tools/masters/road-survey.json`.

`tools/masters/road_network.py` a été réaligné sur le schéma actuel du relevé
(terminaux `{point, reason}`) et produit désormais le statut
`validated-visible-carriageways`. Le fichier généré contient 58 nœuds et 59
connexions ; il reste `implemented: false`, donc aucune voiture ni trafic n'est
activé. Les connexions sont bidirectionnelles, avec catégories `street` ou
`parking-access`, sorties et terminaux stables. Le validateur vérifie la connexion
globale, les extrémités, les sorties de bord, les accès parking et l'absence de
traversée de solides.

Après régénération, `node tests/lot-2.6c2.cjs` passe intégralement : graphe routier,
rejet des géométries invalides, migration, préférence trottoir, blocage sans
téléportation et vitesse indépendante du framerate. Aucun fichier économique,
policier, commercial ou de gestion n'a été modifié pour cette reprise.

La régression complète a été lancée une seule fois après cette décision. Les
groupes jusqu'à 2.5B ont affiché PASS (économie, stock, logistique, police,
cycles, lots 1.x, lot 2 et interactions isométriques). Elle est ensuite restée
silencieuse pendant plus d'une minute dans un scénario long ; elle a été
interrompue pour éviter un processus bloqué. Aucun échec fonctionnel n'a été
rapporté, mais la régression complète reste donc non terminée et ne peut pas
être déclarée PASS global.

## Régression terminée par reprise — 15 septembre 2026 UTC

Cette section remplace le statut de régression inachevée des points d'étape
précédents. Le lot conserve les réserves visuelles décrites plus haut : terminer
la régression ne valide pas à lui seul tous les contrôles Chromium du lot.

### Diagnostic du silence

Le premier scénario sans PASS était **« trois journées et conservation »**,
dans `tests/stress.js`, immédiatement après « interactions et lisibilité
isométriques 2.5B ». Le harnais précédent n'affichait que le PASS final ; aucune
limite de temps ni mesure intermédiaire n'était définie autour de `vm.runInContext`.
L'ancien silence ne permettait donc pas de conclure à un blocage. Aucun ancien
processus de régression n'était présent lors du contrôle hors confinement.

Le scénario simule trois journées avec un pas de 0,1 seconde, vérifie les
conservations de stock et d'argent à chaque pas, rend le DOM tous les dix pas,
puis sauvegarde et recharge tous les 300 pas. La reprise a terminé normalement
en **149,568 secondes**, sans échec ni timeout : **test long, blocage non reproduit**.
Les journées ont nécessité 7 304, 7 279 et 7 287 pas, soit 21 870 pas au total,
avec 72 couples sauvegarde/rechargement terminés. Les assertions de conservation,
de praticabilité, d'unicité des missions et des clients sont restées actives.
L'exécution ancienne n'ayant pas de mesures internes, son état exact au moment
de l'interruption annoncée ne peut pas être reconstitué rétrospectivement.

### Harnais et commande de reprise

Seuls `tests/regression.cjs`, `tests/stress.js` et ce rapport ont été modifiés
pendant cette reprise, avec un nouveau journal de validation. Aucune correction
de gameplay n'a été nécessaire ; aucun asset n'a été régénéré.

- `JEU_TEST_TIMEOUT_MS` impose une limite réelle à chaque scénario synchrone
  via l'option `timeout` de la VM Node ; défaut et valeur utilisée : 600 000 ms.
- Journaux `START`, `PROGRESS`, `PASS`, `FAIL`, `TIMEOUT` et `COMPLETE`, horodatés,
  avec durée réelle. Les événements sont ajoutés immédiatement au fichier
  `JEU_TEST_LOG`, sans effacer les résultats antérieurs.
- Le stress journalise les débuts/fins de journées et de sauvegardes/rechargements,
  plus l'avancement de la boucle au moins toutes les dix secondes tant qu'elle
  avance. Si une opération reste bloquée, le délai VM borne le scénario.
- Un échec ou timeout arrête la suite avec une erreur ; un filtre ne sélectionnant
  aucun scénario ne peut plus se terminer silencieusement avec succès.

```sh
env JEU_TEST_FROM='trois journées et conservation' \
  JEU_TEST_TIMEOUT_MS=600000 \
  JEU_TEST_LOG=assets/art-v2/masters/captures-2.6c2/regression-resume-progress.jsonl \
  node tests/regression.cjs
```

La commande reprend par le filtre existant `JEU_TEST_FROM` : les onze groupes
précédemment déclarés PASS ont été ignorés, sans nouvelle exécution complète.
Comme prévu par ce harnais, la reprise initialise un nouveau DOM et la graine
aléatoire 42 ; le stress recrée lui-même sa partie sur `LEGACY_TEST_MAP`.
Il ne s'agit pas d'une restauration de l'état mémoire exact du processus ancien.

### Résultats exacts

| Scénario repris | Résultat | Durée réelle |
| --- | --- | ---: |
| trois journées et conservation | PASS | 149,568 s |
| réservations, interruption et opérations | PASS | 0,575 s |
| cycle quotidien | PASS | 3,829 s |
| interface lot 1.1 | PASS | 1,736 s |
| carte et navigation 2.6A | PASS | 6,871 s |
| quartier reconstruit 2.6B.2 | PASS | 17,477 s |

Sortie finale : `COMPLETE régression {"passed":6,"skipped":11}`, **code 0**.
Les 17 groupes du harnais sont donc couverts par les onze PASS antérieurs et
les six PASS de cette reprise. Contrairement au résumé précédent, le groupe
spécifique « cycle quotidien » se trouve après le stress : son PASS est acquis
pendant cette reprise, pas avant l'interruption.

Preuve persistante :
`assets/art-v2/masters/captures-2.6c2/regression-resume-progress.jsonl`.

Le coupe-circuit a été testé dans un sous-processus en remplaçant uniquement le
corps du scénario par une boucle infinie synthétique : limite 25 ms, événement
TIMEOUT et code de sortie 1 confirmés, aucun scénario métier rejoué. Le premier
lancement de ce contrôle a été refusé par le sandbox (`spawnSync EPERM`) ; sa
reprise hors confinement a passé. Ce contrôle ne figure pas parmi les six PASS
métier du journal ci-dessus.

`node --check tests/regression.cjs`, `node --check tests/stress.js` et
`git diff --check` : PASS. HEAD final inchangé :
`6ea8f273ebc7c8e9f7f41df200a1d8b03a70cccb`, divergence `0 0` avec la référence
locale `origin/main` (sans fetch). Aucun commit, push ni ajout à l'index.
