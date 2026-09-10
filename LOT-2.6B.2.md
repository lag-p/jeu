# Lot 2.6B.2 — reprise et reconstruction du quartier

Base Git : `ee3f49fdc9c05312836894b540010134a8d1063f`, `HEAD...origin/main = 0 0` à la reprise. Aucun commit ni push.

## Point de reprise vérifié

Reprise du 9 septembre au soir : `HEAD` est toujours `ee3f49fdc9c05312836894b540010134a8d1063f`, divergence locale `0 0`. Le worktree sale correspond au lot interrompu et est expressément conservé. La consigne actuelle de reprise remplace le contrôle de propreté demandé avant le démarrage initial.

Au nouvel arrêt, la construction définitive avait réussi et cinq exports existaient : les trois états du sol, puis `north_w-day-raw.png` et `north_w-dusk-raw.png`. La reprise recharge exclusivement `neighborhood.blend` et commence au PNG absent `north_w-night-raw.png`. Le journal précédent reste intact ; les nouvelles sorties sont dans `logs/export-resume.log`. `source/resume-inventory-20260909.json` complète le premier inventaire avec les empreintes des trois `.blend`, des caméras, des prévisualisations et des PNG présents lors du contrôle. Il inclut également le premier PNG terminé pendant cette reprise. Les tests vérifient leur conservation exacte.

La référence, le blockout et le premier export nocturne ont été ouverts et examinés directement. Pillow est disponible dans le paquet local déjà extrait : `PYTHONPATH=/tmp/jeu-art-python/usr/lib/python3/dist-packages`. Aucune installation supplémentaire n'a été nécessaire.

La session SSH précédente (`01a088c8-25ac-7a40-bc69-24347bbf53b7`) avait terminé les phases A et B : spécification, données générées, plan annoté, second blockout, caméra et `.blend`. Aucune production finale n'existait. Le premier blockout avait une duplication de maillage (11 250 808 triangles) ; le second l'avait corrigée (1 288 triangles). Les deux journaux sont conservés dans `assets/art-v2/logs/`.

`source/resume-inventory.json` conserve tailles et SHA-256 des fichiers récupérés. Le PNG du blockout, le plan, le `.blend` original et la caméra originale sont conservés sans réécriture. Les mesures historiques restent dans le journal append-only.

Le contrôle du checkpoint a détecté 63 coins de boîtes derrière la caméra : la distance de 150 m du pipeline d'un seul immeuble ne convenait pas au quartier. La caméra a été reculée de 400 m sur son axe optique, sans changer rotation, échelle ni projection XY. La correction est conservée séparément dans `blockout-validated.blend` et `camera-final.json`. Aucun nouveau rendu de blockout. L'enrichissement charge ce `.blend`, conserve les volumes et ajoute les détails.

## Reprise du 10 septembre

Le prompt initial a été retrouvé dans l'historique local. À cette reprise, 56 PNG sources étaient complets : dernier fichier `lamp_0-dusk-raw.png`. Les empreintes des deux inventaires précédents passent. `source/resume-inventory-20260910.json` conserve en plus tous les `.blend`, PNG et JSON présents à l'arrivée. Les journaux antérieurs restent intacts.

La reprise commence à `lamp_0-night-raw.png`, puis exporte le banc et le conteneur en trois ambiances. Une invocation retourne 143 après le lampadaire (origine du signal non établie) ; le PNG réussi est conservé. Les invocations suivantes sont bornées à un ou deux rendus et terminent proprement. Les 63 PNG sources et `export-metadata.json` sont désormais produits sans reconstruire de scène. Les prévisualisations complètes sont ensuite rendues séparément.

L'intégration jusque-là absente est branchée dans `phaser-renderer.js` et `index.html`. Les ressources historiques restent disponibles pour les changements de carte sans changement de simulation. Le renderer démarre par défaut en isométrique en l'absence de préférence. Le sélecteur est caché hors debug ; les deux contrôles debug ne se superposent plus. Les personnages de la nouvelle carte font environ 3,62 pixels de scène pour 1,75 m (14,47 pixels au zoom ×4), avec contour et anneau de sélection ; leurs coordonnées métier ne changent pas. Les anciennes cartes gardent leur échelle visuelle et leur limite de zoom.

## Référence et composition

Référence obligatoire : `references/neighborhood-target.jpeg`, examinée directement. Sept barres résidentielles principales, grande barre centrale, deux cours, voirie interne, parkings sud/avant-plan, murs interrompus par des escaliers, végétation périphérique. Les parties masquées, les façades arrière et les raccordements hors champ sont extrapolés. Aucun pixel de la référence n'est utilisé comme décor ou texture. La comparaison côte à côte est un document de contrôle uniquement.

La spécification commune est `tools/blender/neighborhood/scene-spec.json`. `prepare.py` produit `neighborhood-data.js` et conserve un plan déjà terminé. La petite correction de navigation `RAMP_E.from.y : 53 → 54` sort le point fonctionnel de la marge de collision de l'immeuble ; aucune géométrie Blender n'est modifiée par cette correction.

La scène conserve un cadrage de quartier complet plus large et moins dense que la référence portrait. Les villas périphériques ne sont pas modélisées. Le relief reste simplifié ; les plateformes et raccords des escaliers ne reproduisent pas précisément les niveaux de la référence. Certains revêtements coplanaires se superposent dans la cour sud. La fidélité artistique n'est pas parfaite et ces limites ne sont pas couvertes par un test logique.

## Pipeline et échelle

Extension du pipeline 2.6B.1, avec ses modules de maillage, matériaux, caméra orthographique et moteur Eevee. Blender 5.0.1, deux threads, aucun rendu parallèle, aucune texture externe. Les détails et la végétation sont déterministes. Les maillages sont regroupés par couche et matériau, avec copie de la maille active avant jointure pour ne pas multiplier les instances restantes.

- Une unité de simulation = 2 mètres ; coordonnées 0–100.
- Un étage = 3 m, personnage = 1,75 m, porte ≈ 2,2 m.
- Route principale ≈ 10 m, véhicule ≈ 4,4 × 2 × 1,5 m.
- Arbres : 7, 10 et 13 m ; trois variantes.
- Projection : `(x-y) × 3,6`, `(x+y) × 2,1` ; pente commune Blender/Phaser.
- Rendu source 2400 × 1434, caméra verrouillée ; réflexion horizontale et réduction par filtre Lanczos en alpha prémultiplié pour les PNG finaux. Les PNG sources restent conservés.

La scène comporte sept immeubles, cinq murs et 104 décors : 61 arbres, 20 voitures, 15 lampadaires, quatre bancs et quatre conteneurs. Les petites formes décoratives restent simplifiées. Les silhouettes décoratives, villas, arbustes distincts, garages et panneaux ne sont pas tous présents.

## Couches, temps et navigation

21 couches sources, chacune déclinée en jour/crépuscule/nuit : sol, sept immeubles, cinq murs et huit prototypes de décor réutilisés aux positions de la spécification. Le manifeste documente images, dimensions, échelle, pivot, ancre, emprise et stratégie de profondeur.

Les bâtiments et murs utilisent des bandes verticales avec profondeur calculée sur leur bord avant, suivant le mécanisme 2.6B.1. Les décors sont ancrés au sol. Les calques n'interceptent aucun geste. Les textures utilisent le filtrage linéaire.

Le temps visuel lit exclusivement `game.dayElapsed / game.dayDuration`. Jour avant 18 h, mélange vers le crépuscule entre 18 h et 20 h, crépuscule jusqu'à 21 h, mélange vers la nuit entre 21 h et 22 h, nuit ensuite. Deux sprites par bande/objet permettent une transition sans chargement ni reconstruction. La variation d'allumage par couche et les fenêtres éclairées sont déterministes. Pas de minuteur métier ni de changement de stock, argent, vente ou police dans le renderer.

`REFERENCE_QUARTER_V1` devient le défaut. Les obstacles correspondent à la spécification, avec marge de 0,5 unité autour des immeubles. Les troncs et véhicules bloquent la navigation. Le graphe conserve sa grille de deux unités et ses tests d'intersection exacts ; le tri des candidats de rattachement précède désormais le premier test de visibilité, conservant le résultat déterministe en évitant des tests inutiles.

Les sauvegardes v5 gardent leur `mapId` : `PONCETTE_INSPIRED_V1` et `LEGACY_TEST_MAP` restent disponibles. Les versions antérieures suivent toujours la migration historique vers `LEGACY_TEST_MAP`. Aucun changement de carte au milieu d'une journée. Aucune modification du format de sauvegarde nécessaire.

## Mesures, commandes et validations

Les commandes réellement exécutées sont consignées dans `assets/art-v2/logs/commands.txt`. Mesures par étape et fichier dans `assets/art-v2/source/measurements.jsonl`. La construction détaillée a pris 122,362 s, pic RSS 412 804 Kio, 371 objets, 83 535 faces, 103 632 triangles, zéro texture fichier.

État des validations finales : en cours. Les résultats définitifs et chemins des captures seront complétés à la fin de la reprise.

## Checklist Safari iPhone réel

Chromium/CDP ne valide pas Safari ni la mémoire GPU d'un iPhone.

- Ouvrir une nouvelle partie, puis une ancienne sauvegarde, vérifier carte, coordonnées et stocks.
- Toucher client, employé et appartement au milieu du décor ; le joueur ne doit pas partir.
- Déplacer sur sol, passer devant/derrière immeuble, arbre et mur ; vérifier la lisibilité des petites silhouettes.
- Panoramiquer, pincer avec deux doigts puis relever un seul doigt ; aucun déplacement parasite.
- Recadrer, tester les deux limites de zoom, tourner l'appareil portrait/paysage.
- Vérifier transitions vers 18 h, 20 h, 21 h et 22 h, pause, ×2 et reprise de sauvegarde.
- Ouvrir chaque panneau et atteindre son dernier bouton ; vérifier safe areas et barre inférieure.
- Passer en repli puis bilan, revenir au jour suivant ; surveiller chaleur, rechargement de page et mémoire sur plusieurs cycles.
