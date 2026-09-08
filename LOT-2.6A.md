# Lot 2.6A — quartier jouable versionné

Base : `e644e17c539e49d7af0ec48b8854ed3686843a5f`, branche `main`.
Audit initial : `git status --short` vide, `HEAD...origin/main` = `0 0`.
Aucun commit ni push.

## Sources et limites

La géométrie est une création locale originale issue du schéma fonctionnel de
la demande : trois barres autour d'une cour nord, une barre centrale, deux
barres au sud, deux cours, boucle routière, desserte et accès périphériques.
Aucune capture de référence n'était jointe à cette session.

La recherche web « La Poncette, Toulon, France » a été effectuée. La requête
Nominatim OpenStreetMap `search?q=La Poncette, Toulon, France&format=json&limit=1`
a répondu `[]` le 8 septembre 2026. Aucun contour OSM n'a été extrait ni utilisé.
Il n'y a donc pas d'attribution OSM à afficher pour cette géométrie. Si le lot
suivant utilise des données OSM, il devra documenter les objets et leur date,
la dérivation et l'attribution « © OpenStreetMap contributors », avec les
obligations de licence correspondantes.

Aucune tuile Google, image satellite, capture Google Earth, texture distante,
adresse ou véritable nom de rue n'est intégré. La recherche documentaire ne
constitue pas une validation géographique : dimensions, angles, orientations,
entrées et altitudes restent des approximations de gameplay.

## Audit et architecture

Avant ce lot, `map.js` contenait un seul `mapData`, huit rectangles
`MAP_BUILDINGS`, dix zones et six entrées. Le graphe était une grille de pas 2
sur 0–100, avec A* et contrôle des segments par échantillonnage. Les lieux
initiaux placés dans les bâtiments étaient projetés sur le graphe.

La simulation utilise toujours des coordonnées cartésiennes normalisées 0–100,
sans unité métrique réelle. `mapDistance` conserve la distance euclidienne et
les vitesses existantes. Le quartier occupe un périmètre convexe irrégulier,
allongé suivant Y, dans ce repère commun. Le nord correspond à Y décroissant.

`map-catalog.js` décrit `PONCETTE_INSPIRED_V1`, schéma 1. `map.js` conserve
`LEGACY_MAP_DATA` et `LEGACY_BUILDINGS`, encapsulés par `createLegacyMap()`.
`MAP_FACTORIES` permet de construire une définition ; un seul objet mutable
`mapData` est actif. `MAP_BUILDINGS` est uniquement une vue de compatibilité
des emprises actives. Aucune seconde simulation n'est créée.

Le schéma contient : dimensions, périmètre, bâtiments et hauteur indicative,
routes, cours, trottoirs, traversées, espaces ouverts, parkings, végétation,
murs, obstacles, transitions, entrées du quartier et d'immeubles, zones,
postes (`strategicSalesSites`), appartements, lieux logistiques, points
d'intérêt, repli, navigation piétonne et réservation du futur réseau véhicule.
Chaque élément possède un identifiant stable et un `visualType`. Le repère et
les données ne dépendent ni du DOM ni de Phaser.

La suppression future du legacy consiste à retirer sa factory, ses données et
ses branches de rendu, après décision concernant les sauvegardes encore legacy.

## Géométrie et lieux

| Éléments | Nombre |
| --- | ---: |
| Barres d'immeubles | 6 |
| Zones | 17 |
| Accès au quartier, communs clients/police | 6 |
| Entrées d'immeubles | 10 |
| Appartements disponibles | 8 |
| Postes proposés | 6 |
| Grandes cours | 2 |
| Parkings | 2 |
| Traversées piétonnes | 3 |
| Escalier / rampe | 1 / 1 |
| Nœuds piétons | 1 187 |
| Connexions non orientées | 2 154 |

Les bâtiments `BLOCK_NW`, `BLOCK_N`, `BLOCK_NE`, `BLOCK_C`, `BLOCK_SW`,
`BLOCK_SE` portent des rectangles explicites. Les hauteurs de 22 à 30 unités
visuelles servent uniquement aux volumes provisoires.

Zones : `NORTH_COURT`, `SOUTH_COURT`, `WEST_EDGE`, `EAST_EDGE`, `CENTRAL_AXIS`,
`NORTH_ACCESS`, `SOUTH_ACCESS`, `WEST_ACCESS`, `EAST_ACCESS`, `RESIDENTIAL_NW`,
`RESIDENTIAL_NE`, `RESIDENTIAL_C`, `RESIDENTIAL_SW`, `RESIDENTIAL_SE`,
`PARKING_N`, `PARKING_S`, `SECONDARY_PASSAGE`. Les champs `future` réservent les
extensions demandées sans ajouter de mécanique. Les valeurs de trafic et
visibilité déjà nécessaires aux règles existantes continuent de fonctionner.

Les appartements ont des `siteId` stables dérivés des identifiants d'entrée,
un `entryId`, un `buildingId` et un `mapId`. L'identifiant de l'appartement
acheté reste son identifiant métier sérialisé, sans dépendance à l'index du
tableau. La compatibilité de l'identifiant historique `0` est conservée.
Le repli provisoire de la nouvelle carte est `FALLBACK_W`, en (35,54).

## Navigation et états physiques

Le graphe est reconstruit à l'activation : nœuds praticables de pas 2 et
connexions cardinales de longueur réelle 2. Entrées, logements, repli et postes
exposent un `navNodeId`. Escalier et rampe ont des extrémités et deux références
de nœuds. Les connecteurs de départ et d'arrivée passent le même test de
segment que les arêtes.

Les bâtiments bloquent leur emprise avec une marge de 0,5 ; murs, clôture et
bosquets bloquent leur polygone. Les intersections sont calculées exactement,
y compris les contacts aux angles. Le périmètre de cette version est convexe :
un segment dont les extrémités sont dedans ne peut en sortir. Une future carte
concave devra compléter le contrôle du périmètre.

Les murs ouest laissent un passage de largeur 4 pour l'escalier ; les deux
murs est encadrent la rampe. Il n'existe pas de téléportation de transition.
Les altitudes 0/1 sont indicatives ; aucun étage superposé n'est simulé.
A* conserve son départage déterministe. Les chemins peuvent comporter un petit
détour jusqu'au premier nœud de grille ; un lissage pourra être évalué après
validation des proportions.

Clients et policiers lisent les entrées et zones actives via leurs fonctions
existantes. Les clients explorent les trois zones proches de leur entrée,
puis utilisent leurs règles actuelles de vendeur et de sortie. Aucun nouveau
point central obligatoire n'a été ajouté. Les employés conservent domicile,
poste, affectations, mission, fret, argent et machine opérationnelle du lot 2.
`updateSimulation()` et `gameLoop()` ne sont pas modifiés.

## Interaction et caméra

Cause du bug : les écouteurs Phaser d'objet/scène terminaient le geste puis
`bindNativeTapFallback()` interprétait à nouveau le `pointerup` du canvas.
Cette deuxième interprétation pouvait perdre la cible et ordonner un mouvement
derrière le client. Le calcul tactile dépendait aussi d'une projection caméra
qui ne tenait pas compte de son origine de zoom.

Une seule chaîne native de Pointer Events commande désormais la machine de
gestes. Au `pointerdown`, les cibles sont testées en espace écran, avec un rayon
tactile minimum de 22 px. La cible est conservée jusqu'à la fin. Un toucher
valide est marqué `consumed` avant l'action. L'entité sélectionnée consomme
aussi le geste si elle a disparu ou n'est plus inspectable. Aucun écouteur
d'objet/scène Phaser ne transmet une seconde intention. Les visuels conservent
une référence de lecture fraîche à l'entité à chaque synchronisation.

Glissement au-delà de 10 px, pincement, annulation, sortie, perte de capture,
blur et redimensionnement ne produisent pas de toucher. Le dernier doigt d'un
pincement reste annulé. Un `AbortController` retire les écouteurs lors de la
destruction du renderer. Aucun délai de suppression n'est utilisé.

Le zoom utilise une origine caméra (0,0), un ancrage conservé et des bornes de
0,2 à 1,8. Le petit bouton ◎ recadre toute la carte. Les boutons +/− sont masqués
en isométrique ; l'API reste disponible. ◈ ouvre le sélecteur discret de rendu.
Les fiches HTML restent au-dessus du canvas.

## Sauvegardes et changement debug

Sauvegarde v5 : `map.mapId` et `map.schemaVersion` accompagnent les données
métier. Les versions 1–4 sont explicitement rattachées à `LEGACY_TEST_MAP`.
Elles conservent argent, inventaires, appartements acquis, employés,
affectations, missions, progression, journée et paramètres sauvegardés.
Aucune migration géographique d'une ancienne partie n'est proposée dans ce lot.

À la restauration, la validation précède la mutation ; les zones et appartements
doivent appartenir à la carte annoncée. Le graphe, le DOM et les formes statiques
sont reconstruits. Les caches d'itinéraires restent exclus du JSON, comme avant,
et sont recalculés à partir des positions et destinations sauvegardées.
ACTIVITE et REPLI conservent les positions physiques. Il n'y a aucun dépôt
pendant la conversion. `WAITING_FOR_RESTOCK`, état déjà existant, est désormais
accepté par le validateur afin de conserver une attente de mission réelle.

Une nouvelle partie utilise toujours `PONCETTE_INSPIRED_V1`. Pour un test legacy,
la console permet `startDebugMap('LEGACY_TEST_MAP')`. Avec `DEBUG = true`, Gestion
propose aussi « Nouvelle partie test : autre carte » uniquement en PREPARATION
ou BILAN. Cette action demande confirmation car elle remplace la sauvegarde par
une nouvelle partie ; elle ne déplace pas les ressources entre cartes. Elle
est refusée en ACTIVITE/REPLI et pendant un placement.

## Rendu et assets

Classique : sols SVG locaux et emprises CSS, construits depuis la carte active.
Phaser : un Graphics de sol, six volumes et des marqueurs d'entrée/repli. Les
routes sont des surfaces pleines, jamais le graphe. Parkings, traversées,
escaliers et rampe ont des marques simples ; les bosquets sont indicatifs.
Le défaut historique `polygon.map(worldToIsometric)` a été corrigé : l'index
du tableau ne doit pas devenir le paramètre de configuration de projection.

`assets/art-v1/manifest.json` réserve sols, routes, cours, trottoirs, traversées,
murs, escaliers, rampes, arbres, parkings, véhicules stationnés, mobilier,
façades, toits, portes, fenêtres, éclairages et personnages. `replacement: null`
signifie qu'aucun bitmap final n'existe encore. Aucun fichier image artificiel
n'est ajouté. Les types et identifiants stables permettront la substitution 2.6B.

Phaser 3.90.0 est servi depuis `assets/vendor/phaser-3.90.0.min.js`, copie du
paquet local installé, avec sa licence MIT `PHASER-LICENSE.md`. Le chargement
reste différé, mais n'utilise plus le CDN. Aucun service distant au runtime.

## Performances et debug

Les formes statiques sont créées une fois par activation/restauration, puis
détruites avant reconstruction. `sync()` réutilise les objets dynamiques par
identifiant ; les entités disparues sont détruites. Une nouvelle carte conserve
24 objets statiques et 31 objets Phaser comptés avec le joueur seul. Le compteur
inclut les enfants de conteneurs. Pas de filtre coûteux, satellite, éclairage
global ou seconde boucle métier. La résolution demandée est plafonnée à 2.

`PhaserMapRenderer.getDebugInfo()` expose mapId, bâtiments, nœuds, arêtes,
objets Phaser et présence d'un chemin invalide. Gestion/Debug affiche ces
diagnostics ; le graphe reste invisible dans le rendu normal. La mesure d'un
budget FPS et de mémoire sur un véritable iPhone reste à faire.

## Validation

Commandes :

```sh
JEU_TEST_ONLY='carte et navigation 2.6A' node tests/regression.cjs
node tests/regression.cjs
LD_LIBRARY_PATH=/tmp/jeu-validation/libs/usr/lib/x86_64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/tmp/jeu-validation/browsers node tests/lot-2.6a-mobile.cjs
```

La suite historique conserve explicitement sa fixture legacy, car ses
coordonnées codées en dur décrivent cette carte. Le nouveau scénario appelle
la vraie fonction `newGame()` sans paramètre et vérifie le défaut PONCETTE.
Les scénarios couvrent unicité, emprises, périmètre, lieux reliés, chaque accès
vers chacune des 17 zones, appartements vers six postes, chaque arête,
bâtiments/murs/angles, transitions, déterminisme, découpage de déplacement,
pause/×2, joueur, quatre rôles, livraison, sorties clients, repli, bilan,
appartement 0, sauvegarde en trajet et en repli, conservation et legacy v4.

Le harnais Chromium couvre 390×844, 667×375, 320×568, 430×932 : cadrage entier,
absence d'overflow, commandes, sélection réelle client/employé/appartement,
compteur d'intentions, sol, glissement souris, pincement tactile CDP, recentrage,
bascules répétées, départ/retour employé, bilan, absence d'erreur JS et absence
de requête distante. Captures de validation dans `/tmp/jeu-2.6a-map-*.png`.
Résultats finaux : scénario ciblé PASS ; suite complète exécutée une seule fois,
16 scénarios PASS, dont trois journées avec conservation ; Chromium PASS aux
quatre dimensions ; tous les fichiers JS/CJS (Phaser embarqué inclus) passent
`node --check` ; `git diff --check` passe. Les premières tentatives ont permis
de corriger le cadrage et une mesure ambiguë de départ dans la fixture.

## Checklist Safari iPhone et suite 2.6B

- Ouvrir Nouvelle partie, organiser la carte, choisir ◈ → Isométrique.
- Contrôler les deux cours, les six barres, parkings, voies, murs et accès.
- Recentrer avec ◎ ; zoomer pour travailler, vérifier cadrage portrait/paysage.
- Toucher tête et corps d'un client puis d'un employé, y compris près d'un toit.
- Toucher un appartement puis une rue vide et une zone bloquée.
- Glisser depuis une entité ; pincer avec relâchement alterné des doigts ;
  interrompre un geste par rotation, changement d'application et changement de rendu.
- Faire partir vendeur, guetteur, gérant et ravitailleur ; acheter vers le premier
  appartement, fermer pendant un trajet et contrôler dépôt puis bilan.
- Recharger en trajet, en repli et au bilan ; ouvrir une sauvegarde legacy.
- Vérifier safe areas, température, fluidité et lisibilité sur appareil réel.

Le véritable multi-touch Safari n'est pas validé par Chromium/CDP. La fidélité
géographique, les proportions, les emplacements d'entrée et les dénivelés
doivent être affinés avec les références futures avant les graphismes 2.6B.
Pas de véhicule, intérieur d'immeuble, étage physique, texture finale ou IA
client/police nouvelle dans ce lot.
