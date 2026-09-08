# Lot 2 — Organisation physique des équipes

Base auditée : `b0191f2865873776cbf3f18c5ce729e00378495b` (`HEAD` et
`origin/main`). Le hash demandé `b019f1cbcccf50dcc74e2ad0c645566db507fa85`
ne correspond pas à ce dépôt. Aucun commit ni push ne fait partie de ce lot.

## Architecture

`employee-physical.js` est le propriétaire de l'état physique des employés.
Il ne manipule pas le DOM : position, destination, `navRoute`, rattachement,
mission, fret et argent appartiennent à l'état de simulation sérialisé. Le
rendu DOM se contente de lire ces données ; un renderer Phaser pourra faire de
même sans déplacer la logique dans `Phaser.Scene.update()`.

La carte conserve un graphe de nœuds praticables indépendant du rendu. Les
itinéraires sont calculés par A* sur les voies hors bâtiments. Les égalités sont
résolues par identifiant de nœud, ce qui garde le chemin déterministe. Le temps
de déplacement passe uniquement par `updateSimulation()` et ses pas bornés :
pause, ×1, ×2 et découpage de frame conservent donc le même état métier.

## Machine à états

`RESTING` (Au repli), `PREPARING`, `OUTBOUND` (En trajet), `AT_POST` (En
poste), `MISSION`, `RETREAT_ORDERED`, `RETURNING`, `DEPOSITING`, `DONE` et
`BLOCKED` (Attention requise) sont centralisés dans `EMPLOYEE_OPERATION`.
`employee.state` demeure un adaptateur de compatibilité pour les anciens flux
(vente, files et logistique), et non la source de vérité physique.

Un rattachement est d'abord l'appartement affecté. À défaut, le repli personnel
provisoire est disponible aux premiers vendeurs et guetteurs ; il a une faible
capacité et ne permet ni gérant ni logistique complexe. Un gérant ou
ravitailleur sans appartement reste détectable, avec la cause affichée.

## Départs, rôles et retours

- En préparation, les affectations différées sont appliquées et les employés
  sont normalisés au rattachement. Les vendeurs chargent seulement les produits
  autorisés, selon le stock réellement présent et leur capacité.
- À l'ouverture, vendeur, guetteur et gérant partent visiblement vers leur
  poste ; les effets de vente, guidage et supervision ne démarrent qu'à
  `AT_POST`. Le ravitailleur est disponible depuis son rattachement.
- Les missions logistiques portent toujours le fret et l'argent. Au repli,
  elles n'en commencent plus, reviennent vers le rattachement du ravitailleur,
  déposent, puis le ravitailleur rejoint le repli si nécessaire.
- À la fermeture, les clients et nouvelles missions sont bloqués, chaque
  employé reçoit un ordre de retour, dépose à l'arrivée, puis seulement les
  caisses locales (y compris le repli personnel) rejoignent la trésorerie avant
  les salaires et le bilan. Les bloqueurs de repli attendent aussi les employés.
- Un gérant proche d'un membre de son équipe en poste fournit un bonus de
  cadence plafonné à 12 %, configurable dans `EMPLOYEE_PHYSICAL_CONFIG` ; il
  disparaît dès qu'il s'éloigne ou quitte son poste.

Un itinéraire invalide est signalé dans l'état de l'employé. Après diagnostic
persistant, une récupération sûre documentée replace au rattachement et dépose
les ressources restantes ; ce mécanisme n'est jamais utilisé comme déplacement
normal.

## Affectations et sauvegardes

Les modifications d'appartement ou gérant pendant activité/repli sont stockées
dans `assignment.pending`, visibles dans Équipe et appliquées une fois le
retour compatible atteint. Les affectations manuelles ne sont jamais reprises
par l'automatisation. Les configurations d'équipe réalisées en activité/repli
sont différées au prochain état de préparation.

La sauvegarde est passée en v4. Les versions v1, v2 et v3 restent acceptées :
elles reçoivent un repli personnel, un état physique et des routes vides sans
dépôt, transfert ni effacement de fret pendant migration. Une sauvegarde en
activité ou repli garde les coordonnées et ne replace donc pas l'employé à
distance ; hors activité la normalisation prudente le place au rattachement.

## HUD et interface

Le HUD stock affiche désormais les trois produits en continu par pictogrammes
CSS locaux distincts (losange, cercle, triangle), plus quantité et libellé
accessible. La couleur d'alerte reste locale au produit. Le toucher du résumé
ouvre toujours Stock. La fiche Équipe affiche état simple, rattachement,
gérant, destination, mission, fret/argent, attente d'affectation et avertissement.

## Tests exécutés

`JEU_TEST_ONLY='organisation physique lot 2' node tests/regression.cjs` couvre
départ au rattachement, chargement, pause, chemin sans bâtiment, invariance du
découpage temporel, arrivée avant disponibilité, affectation en attente,
protection manuelle, retour/dépôt et migration v3. La suite existante de
régression est également lancée pour les scénarios historiques ; les contrôles
syntaxiques et de diff sont à exécuter dans la vérification finale.

## Limites et checklist iPhone

Le repli personnel est intentionnellement limité : il ne remplace pas les
futurs logements/équipes avancés. Les zones de supervision sont des moyennes
des points d'équipe, sans spécialisation produit. Les clients conservent leur
IA actuelle, mais empruntent déjà le graphe praticable.

À vérifier sur Safari iPhone : 320×568, 390×844, 430×932 et 667×375 ; trois
icônes stock visibles et touchables, absence de défilement horizontal,
ouverture de Stock, commandes finales après repli, safe areas et absence
d'erreur JavaScript.
