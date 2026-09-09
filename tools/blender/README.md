# Barre d'habitation — lot 2.6B.1

Blender **5.0.1**, Python intégré uniquement. Aucun téléchargement, texture
externe, interface graphique, Cycles, subdivision ou lecture de la simulation.

Depuis la racine du dépôt :

```sh
env OMP_NUM_THREADS=2 LP_NUM_THREADS=2 MESA_SHADER_CACHE_DIR=/tmp/jeu-mesa-cache \
  blender --background --factory-startup --threads 2 --python-exit-code 1 \
  --python tools/blender/create_housing_block.py -- --output assets/art-v1
```

Les variables limitent les workers CPU/Mesa du VPS et placent le cache de
shaders dans un répertoire accessible. Eevee utilise 32 échantillons et deux
threads Blender. Les deux images sont rendues **successivement** dans le même
processus ; Blender quitte naturellement quand le script est terminé.

Sorties écrasées de façon reproductible, sans sauvegarde `.blend1` :

- `buildings/housing-block-long-v1.png` : seul bitmap chargé par le jeu.
- `buildings/housing-block-long-v1.json` : contrat de projection, pivot brut,
  réflexion horizontale, échelle, cible, graine, version et comptes géométriques.
- `source/housing-block-long-v1.blend` : scène transparente prête au rendu.
- `previews/housing-block-long-v1-preview.png` : contrôle qualité sur un sol
  nocturne avec un personnage de 1,75 m ; jamais dans le manifeste du jeu.

`create_housing_block.py` assemble les modules et exporte les fichiers.
`common/materials.py` construit 11 matériaux mats, avec bruit/ramp/bump léger
pour les bétons. `common/isometric_camera.py` calcule le cadrage depuis les
bornes réelles. `common/render_utils.py` configure Eevee, les trois lumières
surfaciques, le monde bleu et le PNG RGBA 8 bits AgX.

La graine 261 produit 75 fenêtres : 44 sombres, 11 éclairées, 20 fermées.
568 instances partagent 11 maillages de cube : 3 408 quads / 6 816 triangles
placés, sans modificateur. Avec caméra et lumières, la source a 572 objets.
Pas d'intérieur ; seuls les deux côtés visibles reçoivent les détails fins.

La simulation n'a pas d'unité métrique. Pour cet asset seulement, 2 m de modèle
correspondent à une unité de carte : 50 × 12 m deviennent 25 × 6, avec un toit
à 15 m. La pente projetée vaut 4,2 / 7,2. L'élévation caméra est donc
`asin(4.2 / 7.2) = 35.6853347°`, azimut 45°, vue orthographique depuis +X,+Y.
La caméra Blender voit son axe horizontal dans le sens -X,+Y ; Phaser utilise
+X,-Y. **`phaserFlipX: true`** applique cette réflexion au bitmap et à son pivot,
sans rééchantillonner le PNG. Les entrées restent côté +Y dans le monde.

Le pivot JSON est le point brut normalisé dans l'image, origine en haut à
gauche. Le pivot affiché vaut `(1 - pivot.x, pivot.y)`. Le point au sol est
l'angle local `(25,6,0)`, soit `(61,15)` pour `BLOCK_N`. Ne pas traiter le bas
du PNG comme une ligne de sol : l'emprise est un losange.

En cas d'interruption **après** l'export de l'asset, reprendre uniquement la
prévisualisation depuis la source, sans reconstruire le bâtiment :

```sh
env OMP_NUM_THREADS=2 LP_NUM_THREADS=2 MESA_SHADER_CACHE_DIR=/tmp/jeu-mesa-cache \
  blender --background --factory-startup --threads 2 --python-exit-code 1 \
  --python tools/blender/create_housing_block.py -- --output assets/art-v1 --preview-only
```

Tests sans nouveau rendu : `node tests/lot-2.6b1.cjs` et
`PLAYWRIGHT_BROWSERS_PATH=/tmp/jeu-validation/browsers node tests/lot-2.6b1-mobile.cjs`.
Le premier exécute deux fois le vrai plan de construction via son AST Python,
avec des récepteurs de géométrie sans Blender, puis compare les instances et
le hash des fenêtres au JSON exporté. Il décode aussi le canal alpha réel.
La reproductibilité géométrique est vérifiée ; l'identité des pixels entre
pilotes graphiques n'est pas exigée.

Références techniques : [caméras Blender 5.0](https://docs.blender.org/manual/en/5.0/render/cameras.html),
[film Eevee](https://docs.blender.org/manual/en/5.0/render/eevee/render_settings/film.html).
