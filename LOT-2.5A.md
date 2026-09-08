# Lot 2.5A — Prototype Phaser isométrique réversible

Base de travail : `192412d1487004bd3133122eb0eda1f3495c5f2b` sur `main`,
synchronisée avec `origin/main`. Ce lot ne modifie ni les règles de simulation,
ni les stocks physiques, ni les ventes, ni les missions, ni la sauvegarde
métier. Aucun commit ni push ne fait partie du lot.

## Correctif du premier appartement

La destination d'achat était résolue avec des tests de vérité :
`apartmentId ? getApartmentById(apartmentId) : null`, et l'événement du
formulaire utilisait `value || null`. Ainsi un identifiant valide numérique
`0` (premier appartement dans une représentation historique) était confondu
avec l'absence de destination. Les valeurs des `select` sont aussi des chaînes
(`"0"`), ce qui pouvait ne pas correspondre à un identifiant numérique strict.

`hasApartmentDestination()` ne considère maintenant absents que `null`,
`undefined` et la chaîne vide. `getApartmentById()` compare explicitement les
formes numérique et chaîne. À la restauration, les identifiants d'appartement
numériques non négatifs et toutes leurs références (actif, affectations,
équipes, demandes et missions) sont canonisés en chaînes avant validation. La
conversion ne déplace, ne crée et ne détruit ni stock ni argent.

Le test ciblé couvre l'apparition immédiate de l'appartement `0`, sa sélection
après réouverture, les achats A/B/C, le débit exact, la capacité, le deuxième
appartement, le stock personnel, puis une sauvegarde/recharge sans double
dépense.

## Phaser et repli

Le prototype charge dynamiquement **Phaser 3.90.0**, version explicitement
figée, depuis :

`https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js`

Il n'y a ni framework supplémentaire ni étape de compilation. Le chargement
est volontairement différé jusqu'au choix « Isométrique », afin que le rendu
classique démarre même hors ligne. En l'absence de réseau, en cas de CSP ou
d'erreur de script, une erreur explicite est envoyée à la console, un message
est présenté, et le sélecteur revient à « Classique » sans interrompre la
partie. Lors d'un emballage iOS/Android, le fichier exact devra être embarqué
localement (ou fourni par le bundle Capacitor) à la même version : aucune
sauvegarde ne dépend alors de Phaser.

## Architecture

`simulation.js` reste la seule entrée temporelle appelée par l'unique RAF de
`game.js`. Elle conserve les phases, déplacements, ventes, missions, stocks,
argent et sauvegardes. `employee-physical.js` reste propriétaire des états
physiques et de leurs itinéraires.

`phaser-adapter.js` est une frontière de lecture : il produit des données
visuelles pour joueur, appartements, employés, clients et patrouilles, ainsi
que bâtiments, zones, entrées et points statiques. Il ne reçoit aucune commande
économique et ne mute pas `game`.

`phaser-renderer.js` crée des formes Phaser réutilisées par clé métier,
synchronise seulement leur position/apparence et les détruit quand l'entité
disparaît. `Scene.update()` n'appelle jamais la simulation. La sélection
transmet les intentions aux actions existantes : `selectEmployee`,
`selectCustomer` et `openApartmentDetails`. Les menus et HUD HTML/CSS restent
au-dessus du canvas. Une préférence locale `quartier.mapRendererMode` est
séparée de la sauvegarde de partie.

## Projection et profondeur

Les coordonnées métier restent cartésiennes dans l'intervalle 0–100.
`worldToIsometric()` applique la projection dans le rendu ;
`isometricToWorld()` est son inverse testable. Aucune position projetée n'est
enregistrée dans le jeu. La profondeur est dérivée de la coordonnée verticale
projetée (`getIsoDepth`), donc les entités basses passent devant les hautes sans
modifier leur état. Les rôles combinent des formes distinctes (carré, triangle,
losange, capsule, cercle) et des couleurs provisoires ; aucun libellé permanent
n'encombre la carte.

## Commandes tactiles

- Glisser un doigt sur une zone vide déplace la caméra Phaser ; un seuil de
  10 px sépare le glissement du toucher court.
- Deux pointeurs règlent le zoom, borné entre 0,65 et 1,8. Les bornes caméra
  empêchent de perdre entièrement la carte.
- Un toucher court sur employé, client ou appartement ouvre la fiche HTML
  existante appropriée.
- Les boutons de zoom et « Joueur » restent des contrôles HTML et sont
  redirigés vers la caméra Phaser quand le prototype est actif.
- Le placement est volontairement refusé au moment de l'activation du
  prototype ; un placement déjà actif n'est donc pas masqué. Pendant le mode
  prototype, un toucher de placement est retransmis aux commandes existantes.

Le statut sous les contrôles de caméra affiche le mode, le nombre d'objets
Phaser actifs et l'état de repli ; le panneau Debug le reprend lorsque `DEBUG`
est activé.

## Tests exécutés

- `JEU_TEST_ONLY='prototype isométrique et premier appartement 2.5A' node tests/regression.cjs`
- `tests/lot-2.5a-mobile.cjs` dans Chromium, avec Phaser 3.90.0 servi
  localement seulement par le harnais ; 390×844, 667×375 et 320×568.
- Validation dans ce test : canvas, bascule, largeur, toucher court, glissement,
  zoom borné, HUD HTML, pause, ×2, préservation des ressources et repli après
  échec simulé du chargement.

Les vérifications finales listées dans la demande complètent ces résultats.

## Limites du prototype

Les bâtiments, passages et rôles sont volontairement des formes simples. Il
n'existe pas encore de tuiles, sprites définitifs, éclairage, animation métier,
police avancée ou migration de menus. Le rendu affiche les états physiques du
lot 2, dont départ, mission, retour et dépôt, mais ne les recalcule pas. La
qualité visuelle et la fluidité sur un véritable Safari iPhone restent la
décision produit à prendre avant tout rendu définitif.

## Checklist Safari iPhone

1. Ouvrir le mode Classique puis choisir « Isométrique » dans les contrôles de
   caméra ; confirmer qu'un réseau indisponible revient clairement au classique.
2. Tester 390×844 portrait et 667×375 paysage : HUD, menus et panneau de fiche
   doivent rester au-dessus du canvas, sans défilement horizontal.
3. Faire un court toucher sur un vendeur, un client et un appartement ; faire
   ensuite un glissement sur une zone vide sans ouvrir de fiche.
4. Pincer dans les deux sens et vérifier les limites ; toucher ×1, ×2 et Pause.
5. Lancer une journée avec vendeur, guetteur, gérant et ravitailleur : vérifier
   départ du rattachement, arrivée au poste, mission, ordre de repli, retour,
   dépôt puis bilan après le dernier retour.
6. Revenir au classique en pleine journée et vérifier que temps, argent, stock,
   clients et itinéraires sont inchangés.

## Décision Phaser isométrique ou vraie 3D

Conserver Phaser si Safari iPhone maintient une caméra tactile confortable,
des rôles lisibles, une fluidité acceptable avec la population cible et une
profondeur suffisante pour les interactions stratégiques. Étudier la 3D
seulement si les essais révèlent qu'une hauteur/occlusion réelle, une rotation
de caméra ou la lecture des bâtiments ne peuvent pas être obtenues sans
complexité disproportionnée dans ce renderer 2D.
