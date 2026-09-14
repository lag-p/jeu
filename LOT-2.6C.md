# Lot 2.6C — cartes maîtresses pré-rendues

## Reprise et périmètre

HEAD de départ et de reprise : `e298666d917b29e8443b5589be3a9bb16738f8fa`.
Au début de cette reprise, `HEAD...origin/main` vaut `0 0` (référence locale).
Le worktree contient déjà le lot interrompu ; son état sale et la suppression du ZIP
sont attendus dans cette reprise explicitement autorisée.
Aucun commit, push, rendu Blender, extraction ni recalage n'a été relancé.

`tools/masters/calibrate.py` a été lu et parsé intégralement par AST, sans exécution.
Le checkpoint JSON est valide : 32 points, 58 triangles, aucune inversion,
couverture monde totale de 10 000 unités carrées. Les trois PNG ont été décodés
et leurs CRC, dimensions, tailles et SHA-256 vérifiés en lecture seule.
Le script et le checkpoint n'ont pas été réécrits.

## Direction artistique et assets

Le décor raster validé remplace la représentation Blender en maquette dans
`REFERENCE_QUARTER_V1`. Simulation, géométrie, collisions, navigation, économie,
police et format des sauvegardes restent ceux du jeu existant.

Assets locaux dans `assets/art-v2/masters/` :

| Variante | Dimensions intégrées | Octets | SHA-256 |
| --- | --- | ---: | --- |
| `neighborhood-day-master-v1.png` | 853 × 1844 | 3440501 | `b6ba1a2c68c7ab86db711219efe7f91305d1d91ec1914765681b637754f38285` |
| `neighborhood-dusk-master-v1.png` | 853 × 1844 | 3119222 | `a27947178084b3b4d00dc36ec67021da69ea488bf4663745de354d783e54b8ae` |
| `neighborhood-night-master-v1.png` | 853 × 1844 | 4289282 | `c6b3b369689a434ecb094f8854af6094af53901edd144af4a81ade6db4a0bc98` |

Total PNG : 10 849 005 octets. La nuit source faisait 1843 pixels de haut : la
normalisation déjà effectuée duplique uniquement la dernière ligne, sans étirement.
Le manifeste conserve aussi son hash source. Le ZIP a déjà été supprimé du worktree,
et demeure récupérable dans Git. Aucun service distant n'est nécessaire. Les trois images sources ont été inspectées
visuellement pendant la reprise : aucune interface incorporée.

## Alignement et transformation

`alignment.json` conserve les mesures indépendantes de huit patches d'arêtes :
quatre toits, croisement, escalier, mur et route. Recherche de corrélation dans
une fenêtre de ±6 pixels ; décalages observés de 0 à 3 pixels horizontalement et
0 à 2 verticalement, corrélations de 0,576 à 0,981. Ces mesures locales ne prouvent
pas une identité géométrique de chaque pixel, notamment pour la végétation.

Le maillage barycentrique de `calibration.json` convertit les coordonnées métier
0–100 vers les pixels puis les unités de scène (0,5 unité/pixel). L'inverse utilise
le même maillage pour les gestes. La caméra est indépendante du fichier raster.
Le maillage compilé est mis en cache ; aucune position de simulation n'est corrigée
par le renderer. 40 401 points ont un aller-retour d'erreur maximale
`3.074277920629802e-13` unité monde.

Les pieds des sept bâtiments contraignent le maillage ; les quatre points de bord
assurent une extension cohérente hors du raster. Les repères complémentaires réservés
dans le script ne participent pas au recalage : ne pas confondre l'inversibilité
mathématique avec une validation exhaustive de tous les chemins sur la photographie.
Un fond procédural local couvre les parties métier hors image, surtout à l'est.

## Profondeur et lisibilité

Quatorze zones explicites : sept bâtiments, quatre murs et trois cimes.
Chaque silhouette est masquée et découpée en bandes de huit pixels source dont
la profondeur suit la ligne de pied. Les bandes partagent les trois textures
originales ; les sprites sont triés à partir de leur projection au sol.
Les positions métier, routes et files ne sont jamais déplacées pour l'affichage.

C'est une première approximation depuis des images aplaties : silhouettes manuelles,
profondeur quantifiée par bandes, végétation partiellement couverte, personnages
peints dans les masters non interactifs. La séparation de tous les objets et les
petites différences entre variantes ne peuvent pas être parfaites.

Les marqueurs permanents sont masqués en mode normal ; un anneau signale aussi
l’appartement actif pendant l’ouverture du panneau logistique. Les entités conservent leurs
zones tactiles indépendantes de leur taille visuelle. Le debug permet d'afficher
bâtiments, routes, murs, accès, appartements, points de vente et graphe de navigation.
Les commandes de comparaison restent réservées à `DEBUG`.

## Caméra, horloge et ressources

Cadrage initial de type couverture, sans déformation, recentré au redimensionnement.
Pan, pincement et sélection prioritaire continuent de passer par l'inverse monde/image.
Zoom manuel borné entre 0,2 et 2,4 ; filtrage linéaire, antialiasing et
`setRoundPixels(false)`. Au maximum, un pixel source occupe 1,2 pixel CSS : aucune
résolution supplémentaire n'est inventée. Un fort dézoom ou un pan au-delà du raster
peut montrer l'extension procédurale.

12 h–17 h 59 : jour ; 18 h–19 h 59 : coloration progressive du jour ;
20 h–20 h 59 : crépuscule ; 21 h–21 h 59 : coloration progressive du crépuscule ;
22 h–minuit : nuit. Le remplacement d'image utilise un fondu d'une minute métier
à la fin de chaque transition pour limiter le dédoublement. Tout est calculé depuis
`game.dayElapsed` : pause et vitesses métier s'appliquent sans minuterie propre.

Trois textures maîtresses, plus l'unique asset historique art-v1 préchargé pour
permettre les restaurations de cartes dans la même scène. Aucun chargement des
couches `quarter-*`. Les variantes occupent environ 18 MiB en RGBA décodé à elles
seules ; cela n'est pas une mesure de la mémoire GPU totale. Les 448 bandes représentent 898 objets image (base et surimpression comprises)
et utilisent des frames partagées, sans recréer des textures à chaque mise à jour.
Les copies masquées ne sont rendues que si leur rectangle recoupe une entité
située derrière leur profondeur : les autres pixels sont déjà dans le fond complet.
La reprise ajoute cette élimination du travail inutile et ses tests devant/derrière,
hors bande et pendant la nuit. Le nombre d’objets alloués et le coût résiduel des
masques stencil restent un point de vigilance mobile.

La reprise fixe explicitement la frame complète `__BASE` du fond : les frames
ajoutées pour les occlusions changent sinon la frame implicite choisie par Phaser.
Elle corrige aussi le préchargement des deux familles de cartes et la référence
debug périmée lors de la reconstruction du décor. Les changements de rendu
libèrent l'ancien gestionnaire de textures ; les bascules debug réutilisent les
textures déjà chargées.

## Validation

- `python3 tests/lot-2.6c-assets.py` : réussi, lecture seule, PNG/normalisation/hash,
  AST complet et topologie du checkpoint.
- `node tests/lot-2.6c.cjs` : réussi, manifestes, rejet d'un maillage inversé,
  40 401 conversions aller-retour, horaires métier et activation sélective des
  occlusions devant/derrière/hors bande/nuit, sans mutation de l’horloge.
- Fallback : résultats présents et réutilisés pour manifeste absent, image absente
  et manifeste invalide ; scénario `debug-history` terminé avec succès pendant la
  reprise (comparaison procédurale, classique, destruction textures, restauration
  REFERENCE/PONCETTE/LEGACY, argent et stock conservés).
- Chromium mobile : quatre viewports réussis, résultats et captures existants
  réutilisés sans relance. La trace d'exécution du 13 septembre 2026 à 05:40 UTC
  confirme la fin de la commande avec succès, après les dernières modifications
  du renderer et du test.
- `node --check` : réussi sur les six JS/CJS du lot ; `git diff --check` : réussi.
- `node tests/regression.cjs` : unique exécution finale réussie, code de sortie 0,
  17 groupes de scénarios validés, dont trois journées et conservation, réservations,
  cycle quotidien, interface et cartes historiques. Sortie complète conservée dans
  `assets/art-v2/masters/captures/regression-final.log`.

| Viewport Chromium | Initialisation | Budget indicatif < 30 s |
| --- | ---: | --- |
| 320 × 568 | 12 221 ms | respecté |
| 390 × 844 | 17 672 ms | respecté |
| 430 × 932 | 13 211 ms | respecté |
| 667 × 375 | 12 454 ms | respecté |

Chaque résultat confirme les assertions de sélection unique, déplacement au sol,
pan, pincement CDP, pause, vitesses, cadrage, zoom, bascules, repli et accès aux
panneaux, sans erreur JavaScript ni requête distante. Les 120 synchronisations
de présentation conservent la sauvegarde, le nombre d'objets et les textures.
Quatre textures sont recensées, dont les trois masters ; le tas JavaScript utilisé
mesuré en fin de scénario varie de 12 981 920 à 17 961 364 octets. Ce relevé ne
mesure ni un pic mémoire de transition ni la mémoire GPU.

Les captures existantes ont été examinées à cette reprise : cadrage rempli aux
quatre dimensions, variantes jour/crépuscule/nuit distinctes, joueur visible devant
la façade et masqué derrière dans les deux vues de profondeur. Ces vues fixes
ne prouvent pas l'alignement visuel de chaque itinéraire ; la vérification exhaustive
des chemins sur l'image reste une limite de cette première calibration.

Captures conservées dans `assets/art-v2/masters/captures/` :

- `phaser-320x568.png`, `phaser-390x844.png`, `phaser-430x932.png`,
  `phaser-667x375.png` ;
- `master-day-390x844.png`, `master-dusk-390x844.png`,
  `master-night-390x844.png` ;
- `depth-front-390x844.png`, `depth-behind-390x844.png`,
  `rotation-667x375.png`.

À cette dernière reprise, seule la validation des assets a été réexécutée en lecture
seule pour répondre au contrôle d'intégrité demandé. Les résultats ciblés Node,
Chromium et fallback déjà réussis ont été vérifiés et conservés. Aucun changement
du code de rendu, du script de calibration, du checkpoint ou des PNG n'a été nécessaire.

Le premier lancement Chromium confiné échoue avant assertions avec
`content/browser/sandbox_host_linux.cc:41`, `Operation not permitted (1)`.
Les essais suivants utilisent l'autorisation hors sandbox. Une initialisation a
pris 44 559 ms et dépassé le budget indicatif de 30 secondes ; ce budget est désormais
rapporté séparément des assertions fonctionnelles, sans masquer la mesure.
Plusieurs tentatives ont perdu leur contexte avant la réduction des occlusions,
dont une avec deux navigateurs simultanés ; les suites
suivantes sont séquentielles. Le test a aussi été corrigé pour restaurer position
et heure après ses captures, avant son scénario de repli, avec aléas déterministes.
Ces mesures Linux/SwiftShader ne valident pas les
performances d'un iPhone.

## Checklist Safari sur iPhone réel — non exécutée ici

- [ ] Chargement à froid, pause, ×1/×2, transitions et retour depuis l'arrière-plan.
- [ ] Portrait/paysage, safe areas et absence de débordement horizontal.
- [ ] Pan et pincement simultanés, sélection unique client/employé/appartement.
- [ ] Déplacement sur les voies visibles, files, accès et missions logistiques.
- [ ] Occlusion devant/derrière les bâtiments, murs et cimes à différents zooms.
- [ ] Lisibilité des entités, panneaux défilables et contrôles accessibles.
- [ ] Sauvegarde/restauration en activité et pendant le repli, anciennes cartes.
- [ ] Mémoire GPU, fluidité, échauffement, changements répétés de rendu.

## Fichiers du lot

- Modifiés : `index.html`, `phaser-adapter.js`, `phaser-renderer.js`.
- Ajoutés : `master-render.js`, `LOT-2.6C.md`, `tools/masters/{extract,calibrate,alignment}.py`,
  `tests/lot-2.6c-assets.py`, `tests/lot-2.6c.cjs`, `tests/lot-2.6c-mobile.cjs`,
  `tests/lot-2.6c-fallback.cjs`.
- Assets et métadonnées : les trois PNG et `manifest.json`, `calibration.json`,
  `alignment.json` dans `assets/art-v2/masters/`.
- Preuves navigateur : captures PNG et résultats JSON dans
  `assets/art-v2/masters/captures/`.
- Supprimé avant cette reprise : `neighborhood-masters-v1.zip`.

## État Git final

HEAD inchangé : `e298666d917b29e8443b5589be3a9bb16738f8fa` ; divergence
`HEAD...origin/main` : `0 0` par rapport à la référence locale, sans fetch.
Index vide, aucun commit ni push. Seuls ce rapport et le journal de régression
ont été ajoutés ou complétés lors de la dernière reprise.

```text
 M index.html
 D neighborhood-masters-v1.zip
 M phaser-adapter.js
 M phaser-renderer.js
?? LOT-2.6C.md
?? assets/art-v2/masters/
?? master-render.js
?? tests/lot-2.6c-assets.py
?? tests/lot-2.6c-fallback.cjs
?? tests/lot-2.6c-mobile.cjs
?? tests/lot-2.6c.cjs
?? tools/masters/
```
