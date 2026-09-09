# Lot 2.6B.1 — premier bâtiment Blender dans Phaser

Départ vérifié : `00746177121ae75ce891330da1cb4af71ee67fcc`, `HEAD...origin/main`
= `0 0`, statut vide. Blender 5.0.1. Aucun commit ni push.
VPS : RAM 2,8 Gio, disponible 2,3 Gio, swap 1 Gio libre au départ ; 952 Gio disque
disponibles. Mesures prises pendant cette session, le 9 septembre 2026.

## Audit avant modification

Lecture de LOT-2.6A.md, du catalogue, du manifeste, des renderers, de l'adaptateur,
de map.js, de la projection, du chargement et des tests 2.5B/2.6A et de régression.
Le manifeste réservait uniquement des types avec `replacement: null` ; Phaser
chargeait son moteur local mais aucune image de bâtiment. Les erreurs du moteur
provoquaient le repli classique ; il fallait ajouter le repli d'un asset seul.

| Bâtiment | Origine | Emprise | Axe long | Hauteur procédurale |
| --- | --- | --- | --- | --- |
| BLOCK_NW | 26,14 | 6 × 23 | Y | 24 |
| BLOCK_N | 36,9 | 25 × 6 | X | 22 |
| BLOCK_NE | 65,17 | 6 × 20 | Y | 26 |
| BLOCK_C | 59,42 | 7 × 25 | Y | 30 |
| BLOCK_SW | 26,68 | 6 × 22 | Y | 26 |
| BLOCK_SE | 49,83 | 23 × 6 | X | 24 |

`BLOCK_N` permet d'observer une grande façade et deux entrées côté cour, aux
coordonnées existantes (41,16) et (55,16). Les portes du modèle sont en X local
10 et 38 mètres, soit X monde 41 et 55. Le seuil du modèle reste sur Y=15,
l'accès navigable reste à Y=16.

Aucun changement dans map-catalog.js, map.js, phaser-adapter.js, rendering.js,
la simulation, les appartements, les collisions, le graphe ou les sauvegardes.
Les cinq autres barres gardent leur rendu procédural.

## Fabrication et direction artistique

Architecture et commande reproductible : [tools/blender/README.md](tools/blender/README.md).
Un script Python orchestre les modules matériaux, caméra et export. Les fichiers
source et produit sont séparés. Le script n'importe aucune donnée du jeu.

Barre originale de 50 × 12 m, cinq niveaux au total (RDC + quatre étages), toit
plat à 15 m, parapet et couvertines, deux locaux techniques, quatre ventilations,
deux cages bleu foncé, soubassement bleu-gris, deux portes vitrées et auvents,
grilles techniques, descentes d'eau et colliers. Fenêtres encadrées avec appuis,
meneaux, volets à lames et quelques rideaux. Pas de texte, adresse, marque ou
image de référence intégrée. Les photos évoquées dans la demande n'étaient pas
jointes : fidélité à La Poncette non certifiée.

Onze matériaux de nœuds simples : béton clair patiné, béton bleu-gris, panneaux
bleus, toit, métal peint, verre sombre, verre ambre émissif, porte, zinc, volet,
patine. Bruit à deux niveaux, rampe de couleur limitée, bump de distance 0,025
et force 0,12 ; surfaces mates. Aucun fichier texture ni intérieur complet.

Trois lumières AREA larges, monde bleu froid, exposition +0,6, transformation
AgX. Les fenêtres ambre utilisent l'émission, sans lumières individuelles.
Eevee, 32 échantillons, ray tracing désactivé ; aucun éclairage ajouté dans Phaser.
L'ambiance reste volontairement assez claire pour la lecture mobile.

## Projection et métadonnées

Phaser : `screenX = 380 + 3.6*(x-y)`, `screenY = 42 + 2.1*(x+y)`.
La pente n'est pas 2:1 ; caméra orthographique d'élévation 35,6853347°, azimut
45°. La réflexion horizontale `phaserFlipX` convertit le sens horizontal de
Blender en celui de Phaser, pivot inclus. Aucun étirement non uniforme.

PNG RGBA8 transparent 1024 × 895, compression PNG maximale sans perte.
Échelle Phaser 0,111923995 ; dimensions affichées à zoom 1 : environ 114,61 ×
100,17 pixels de scène. Emprise seule : 111,6 × 65,1. Toit à environ 31 pixels
au-dessus du sol, accessoires à environ 34. La hauteur provisoire de 22 pixels
est remplacée visuellement, sans toucher à `visualHeight` dans le catalogue.

Pivot brut `(0.201597169, 0.985893782)` ; affiché après réflexion
`(0.798402831, 0.985893782)`. Contact local `(25,6,0)`, monde `(61,15)`, écran
`(545.6,201.6)`. Les marges de cadrage sont calculées depuis les bornes du modèle.

Le JSON inclut identifiant/version, version de génération, graine, version
Blender, dimensions pixel/monde/modèle, pivot, contact, orientation, réflexion,
projection, échelle, cible, comptes géométriques et hash de distribution des
fenêtres. Aucune date variable : la version de génération identifie cette sortie.
La réflexion a été explicitée dans le JSON et le générateur après inspection
du premier PNG ; elle ne nécessite aucun nouveau rendu.

## Intégration et profondeur

Le manifeste conserve ses réservations et ajoute une entrée de bâtiment pour
`PONCETTE_INSPIRED_V1/BLOCK_N`. `preload()` charge le manifeste local, puis le
PNG et son JSON par le Loader Phaser. IDs et cibles uniques, chemins locaux,
dimensions, pivot, échelle, projection et orientation sont contrôlés. Une image
ou des métadonnées absentes/incompatibles conservent le volume procédural.
Les erreurs sont disponibles dans `getDebugInfo().assetErrors` et affichées en debug.

Une texture est divisée en 64 frames verticales sans duplication du bitmap.
Chaque bande reçoit la profondeur du bord avant de l'emprise à sa colonne,
avec `getIsoDepth(...,5)` ; les personnages gardent `getIsoDepth(...,60)`.
Cela permet de longer les deux façades visibles en passant devant, tout en
restant masqué derrière. Les bandes sont créées uniquement lors du rendu statique,
réutilisent leurs frames et sont détruites à la reconstruction. Filtrage linéaire
pour cet asset. Aucun graphe supplémentaire ou timer métier.

Le premier contrôle Chromium a montré des jointures verticales dues à
l'arrondi indépendant des coordonnées des bandes. `setRoundPixels(false)`
sur cette caméra conserve leur continuité ; les nouvelles captures ont été
inspectées. Le test legacy a aussi révélé que `save.js` appelait déjà
`window.PhaserMapRenderer?.refreshMap()` sans que cette propriété soit exposée.
Le renderer expose désormais son objet existant sur `window`, ce qui permet
la reconstruction après restauration/changement de carte. Aucun changement
du code de sauvegarde ni de son format.

Avec `DEBUG = true`, le petit menu ◈ ajoute « Bâtiment test » : Procédural /
Asset Blender. Le changement reconstruit les visuels statiques et conserve la
caméra, les positions, le temps et la sauvegarde. Il n'est pas persisté. Avec
DEBUG false, le contrôle n'existe pas et l'API de comparaison refuse la bascule.
Pas de modification du HUD, du glissement, du pincement ni du recentrage ◎.

## Performances et validation réelle

Une seule construction du modèle et un seul rendu du PNG du jeu. Commande
initiale réellement exécutée (sortie dans `/tmp/jeu-2.6b1-blender.log`) :

```sh
/usr/bin/time -v -o /tmp/jeu-2.6b1-blender-time.txt \
  env OMP_NUM_THREADS=2 LP_NUM_THREADS=2 \
  blender --background --factory-startup --threads 2 --python-exit-code 1 \
  --python tools/blender/create_housing_block.py -- --output assets/art-v1
```

Le log Blender atteint l'export du PNG à **267,218 s (4 min 27 s)**. Le processus
initial a ensuite été interrompu, code 143, pendant la prévisualisation. La cause
exacte du signal n'est pas établie. Le fichier `/usr/bin/time` initial est resté
vide : durée totale et pic RSS de cette première tentative indisponibles.
Ne pas présenter cette exécution comme une chaîne complète terminée d'un trait.

La prévisualisation seule a été reprise depuis la source sauvegardée, avec la
commande documentée dans le README, `MESA_SHADER_CACHE_DIR=/tmp/jeu-mesa-cache`,
`PYTHONUNBUFFERED=1` et `--preview-only`. Aucun deuxième export du PNG du jeu.
Cette reprise se termine avec **code 0 / Blender quit** : **418,62 s** de rendu,
**442,18 s (7 min 22 s)** de processus complet, **1 952 492 Kio de RSS maximal**
(environ **1,86 Gio**, mesure de la reprise uniquement). La durée totale d'une
génération ininterrompue n'est donc pas mesurée. La somme des phases ayant
produit les deux PNG est d'environ 11 min 26 s, hors tentative de preview interrompue.
La swap du VPS a été sollicitée ; aucun rendu en parallèle ni Chromium pendant Blender.

Avertissements observés : contexte EGL `EGL_BAD_MATCH`, sélection ZINK/Mesa
impossible puis rendu logiciel fonctionnel ; cache Mesa initial inaccessible
dans le sandbox, désactivé. La reprise place le cache dans `/tmp`. Les sorties
finales ont été ouvertes et inspectées, et le .blend relu par Blender pendant
la reprise. Ces avertissements ne doivent pas être confondus avec un rendu GPU validé.

| Sortie / mesure | Valeur |
| --- | --- |
| PNG du jeu | 1024 × 895 RGBA8, 652 495 octets (637,20 Kio) |
| Prévisualisation | 1024 × 895, 907 484 octets |
| Source .blend | 145 454 octets, compression Zstandard Blender |
| Instances bâtiment | 568 objets, 11 maillages partagés |
| Faces placées | 3 408 quads, 6 816 triangles |
| Objets scène source | 572, caméra et 3 lumières incluses |
| Fenêtres | 75 : 44 sombres, 11 éclairées, 20 volets fermés |
| Alpha PNG | 444 511 pixels transparents, 465 645 opaques, 6 324 intermédiaires |

`node tests/lot-2.6b1.cjs` passe : fichiers, alpha réel décodé, dimensions,
manifeste et unicité, pivot, échelle, projection, cible, refus de métadonnées
invalides, contact des façades, plan géométrique et fenêtres déterministes.
Le sous-processus Python a nécessité une exécution hors sandbox après `EPERM`.
Pas de comparaison des pixels entre deux rendus.

`node tests/regression.cjs` exécuté **une seule fois**, **16 scénarios PASS**,
y compris 2.5B, trois journées/conservation et 2.6A (6 bâtiments, 17 zones,
8 appartements, 1 187 nœuds, 2 154 arêtes). Aucun second lancement de la suite.

`tests/lot-2.6b1-mobile.cjs` passe sous Chromium réel à **390 × 844**, avec
cinq contextes successifs : asset, PNG absent (404), manifeste absent (404),
métadonnées invalides, jeu normal sans contrôle debug. Chargement local, cinq
autres bâtiments procéduraux, pivot/contact, profondeur devant/derrière sur
les deux façades, comparaison sans mutation de la sauvegarde/collisions/graphe/
appartements, conservation de caméra, redémarrage Phaser, changement legacy,
absence d'erreur JavaScript et de débordement horizontal : PASS.
Le mode normal refuse la bascule debug. Les erreurs réseau intentionnelles
restent visibles dans le diagnostic ; Phaser termine son chargement et affiche
six volumes procéduraux dans les cas de repli.

Captures inspectées :

- [Prévisualisation Blender](assets/art-v1/previews/housing-block-long-v1-preview.png).
- [Jeu zoomé, personnage devant](assets/art-v1/previews/phaser-390x844.png).
- [Personnage derrière](assets/art-v1/previews/phaser-behind-390x844.png).
- [Vue d'ensemble](assets/art-v1/previews/phaser-overview-390x844.png).

Ces trois captures Phaser sont des preuves locales, jamais chargées par le jeu.
94 objets Phaser sont comptés dans la scène de test avec l'asset et le joueur.
Chromium a nécessité une exécution hors sandbox après un refus
`sandbox_host_linux / Operation not permitted`. Le premier passage réel a permis
de corriger les jointures et le rafraîchissement legacy ; les cinq scénarios
ont ensuite passé sur le renderer corrigé. La suite métier complète n'a pas
été relancée après ces deux corrections visuelles ; le harnais Chromium couvre
leur comportement final.

Le harnais historique `tests/lot-2.6a-mobile.cjs` a ensuite passé sur le renderer
final aux **quatre formats 390 × 844, 667 × 375, 320 × 568, 430 × 932** : cadrage,
absence d'overflow/erreur JS/requête distante, sélections uniques, sol, pan,
pinch tactile CDP, recentrage, bascules classic/Phaser, déplacements employés et
repli. Il confirme que le changement de caméra et l'exposition du renderer ne
réintroduisent pas les problèmes d'interaction du lot précédent. Il ne remplace
pas une validation Safari sur appareil physique.

`node --check` passe sur les trois JS/CJS ajoutés ou modifiés ; `py_compile`
passe sur les quatre scripts Python. `git diff --check` passe. Le HEAD reste
celui du départ, divergence `0 0`, aucun fichier indexé, aucun commit ni push.

Fichiers modifiés : `phaser-renderer.js`, `assets/art-v1/manifest.json`.
Ajouts : ce rapport ; `tools/blender/{README.md,.gitignore,create_housing_block.py}`
et `common/{materials.py,isometric_camera.py,render_utils.py}` ; PNG et JSON
dans `assets/art-v1/buildings/` ; source dans `assets/art-v1/source/` ; preview
Blender et trois captures Phaser dans `assets/art-v1/previews/` ;
`tests/lot-2.6b1.cjs` et `tests/lot-2.6b1-mobile.cjs`.

## Limites et validation iPhone

Premier asset uniquement. Le quartier conserve ses sols et cinq barres
procédurales ; palette, végétation, mobilier, personnages et HUD restent à
harmoniser. Le bâtiment conserve une répétition modulaire assez régulière et
une patine discrète. Les détails demandent de zoomer ; les personnages actuels
ont une échelle symbolique plus grande que la silhouette de 1,75 m du rendu.
Pas d'ombre projetée sur les cours depuis le PNG transparent ; seules les
ombres du bâtiment sur lui-même sont précalculées. Pas d'intérieur, de rotation
caméra ou de traitement des étages. La profondeur par bandes approxime les
petits auvents ; les cinq autres bâtiments conservent leur ancien tri global.

Safari iPhone n'a pas été validé. Pour le vérifier sur la version de travail :

1. Servir les fichiers de cette copie via HTTP(S), accessible depuis l'iPhone.
   Ce lot n'est pas publié : le site distant ne reçoit pas ces changements.
2. Ouvrir une partie déjà sur PONCETTE, ou une nouvelle partie de test ; les
   anciennes sauvegardes legacy gardent leur carte. Choisir ◈ → Isométrique.
3. L'asset est actif par défaut sur la barre nord. Pincer pour zoomer, glisser,
   utiliser ◎ ; vérifier la façade, le seuil, le toit et la cour dégagée.
4. Faire marcher le joueur devant la façade sud, derrière au nord puis côté
   est. Vérifier les sélections près du toit, les appartements et les entrées.
5. Tourner l'appareil, reprendre après changement d'application, contrôler
   l'absence de débordement, la fluidité, la température et les gestes tactiles.
6. Sur une copie de test avec DEBUG true, comparer dans ◈ les deux rendus.
   Retirer temporairement le PNG servi pour vérifier le repli, puis le restaurer.
