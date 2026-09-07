# Lot 1 — Cycle quotidien

La journée va de 12:00 à 24:00 en 720 secondes réelles à ×1, 360 à ×2,
hors pauses et repli. `GAME_CONFIG.dayDuration`, `TIME_CONFIG` et `DAY_PHASE`
centralisent les paramètres.

## Architecture

- `game.clock` conserve pause, vitesse et secondes de simulation cumulées.
- L'unique `requestAnimationFrame` appelle `updateSimulation(realDelta)`.
  Ce dernier applique la vitesse une seule fois et distribue de petits pas
  identiques aux clients, missions, employés, déplacements et police.
- Le rendu, la navigation dans les panneaux et l'autosave utilisent le temps
  réel sans faire progresser le gameplay. Les seuls `setTimeout` restants
  effacent des messages/indicateurs visuels. Les identifiants peuvent utiliser
  `Date.now`, mais les horodatages métier utilisent l'horloge de simulation.
- `daily-cycle.js` porte les transitions et les services séparés :
  `beginRetreat`, `getRetreatBlockers`, `finishRetreat`,
  `recoverLocalReceipts`, `payDailySalaries` (dans employees.js),
  `calculateDailyReport` et `prepareNextDay`.
- `dayActive` reste vrai en ACTIVITE et REPLI pour que les dépenses tardives
  restent imputées au jour commercial. `isTrading` et `canMakeSale` séparent
  explicitement activité commerciale et simulation encore en cours.

## Comportements

PREPARATION arrête la simulation et permet l'accès aux réglages existants,
aux stocks et au placement. Le joueur ouvre manuellement la journée.

ACTIVITE propose pause/reprise, ×1, ×2 et fermeture manuelle. Une opération
policière en préparation, active ou en conclusion, ou une alerte de danger 3,
impose ×1 et explique le verrou. La pause demeure disponible ; changer de
vitesse ne l'annule pas.

REPLI bloque ventes et arrivées. Les clients rejoignent une sortie ; les
ravitailleurs en mission reviennent dans leur dépôt réel avec ce qu'ils portent.
Les demandes non attribuées sont retirées, les livraisons interrompues ne
consomment pas le stock réservé. Les déplacements existants du joueur et des
vendeurs finissent, ainsi que les opérations, alertes et événements temporisés.
Les patrouilles quittent physiquement la carte. Aucun nouvel événement policier
n'est planifié après la fermeture. Les modificateurs valables pour une journée
cessent à sa fermeture ; un événement à durée indépendante reste un bloqueur.

BILAN attend tous les bloqueurs, récupère les caisses des appartements, paie
les salaires selon la règle existante (employés actifs), puis règle les loyers
et calcule le bilan. Les transferts de caisse ne doublent jamais le chiffre
d'affaires déjà enregistré à la vente. La récupération manuelle d'une caisse
locale est indisponible pendant ACTIVITE et REPLI, pour conserver son exposition.
Le joueur passe manuellement en préparation du jour suivant. Ressources,
affectations, positions, employés, réputation et progression sont conservés.

La sauvegarde v3 conserve phase, pause, vitesse et repli. Les versions 1/2
restent acceptées ; une ancienne journée de 180 secondes conserve sa fraction
d'avancement lors du passage à 720 secondes. La validation précède la mutation.

## Validation reproductible

Dépendances de test externes au dépôt :

```sh
npm install --prefix /tmp/jeu-validation jsdom playwright
PLAYWRIGHT_BROWSERS_PATH=/tmp/jeu-validation/browsers /tmp/jeu-validation/node_modules/.bin/playwright install chromium
node tests/regression.cjs
PLAYWRIGHT_BROWSERS_PATH=/tmp/jeu-validation/browsers node tests/mobile.cjs
```

`JEU_JSDOM` et `JEU_PLAYWRIGHT` permettent de fournir d'autres installations.
Le navigateur nécessite ses bibliothèques système. La suite mobile sert les
fichiers par interception Playwright, utilise un stockage isolé et écrit les
captures dans `/tmp/jeu-mobile-*.png` et `/tmp/jeu-bilan-*.png`.

La régression couvre ventes acceptées/refusées, stocks physiques, logistique,
police, sauvegarde, trois journées complètes et conservation à chaque pas.
Les nouveaux scénarios couvrent pause en activité/repli, ×1/×2, verrou policier,
frontière de minuit, dépôt tardif, récupération avant salaires, bilan unique,
conservation interjournalière, migrations et refus de sauvegarde corrompue.
La suite mobile couvre 320×568, 390×844, 430×932 et 667×375, les actions tactiles,
la vraie boucle animée en pause et l'absence d'erreurs JavaScript.

## Limites et suite

Pas de documents de conception demandés ni d'AGENTS.md dans ce checkout lors
de l'audit ; les règles de ce lot suivent la demande utilisateur.

Les employés sans trajet de retour implémenté restent à leur position. On ne
crée ni domicile ni trajet artificiel ; les caisses restant sur ces employés
restent portées et ne sont pas récupérées à distance. Un futur système de
retour peut compléter `getRetreatBlockers` et déposer avant `finishRetreat`.
Le CA reste un CA de ventes, distinct des recettes locales effectivement
récupérées. Le bénéfice garde la comptabilité en flux existante.

La fermeture programmée, les affectations de retour et la préparation des stocks
initiaux sont des extensions ultérieures. Prochain lot recommandé : préciser
les locaux de rattachement et les vrais trajets aller/retour des employés,
puis les intégrer aux bloqueurs de repli. Aucun autre lot de roadmap n'est inclus.

## Résultats de cette livraison

- `node tests/regression.cjs` : tous les parcours passent, dont trois journées
  complètes de 720 secondes avec conservation du stock et de l'argent.
- Le scénario ciblé `cycle quotidien` a aussi été relancé après la correction
  de l'initialisation du navigateur : succès.
- Chromium : succès sur les quatre dimensions, aucune erreur JavaScript,
  commandes touchées réellement par Playwright, pause vérifiée avec la boucle
  animée, bilan défilable et jour suivant accessibles. Captures inspectées.
- `node --check` sur tous les scripts JS/CJS et `git diff --check` : succès.
- Le test navigateur a révélé une frame avant le chargement de la gestion :
  la boucle attend désormais `DOMContentLoaded`. Un arrêt du navigateur de
  test a été résolu en isolant chaque dimension dans un nouveau navigateur.
- Bibliothèques Chromium extraites dans `/tmp/jeu-validation/libs` ; sur cet
  environnement, préfixer la commande mobile avec
  `LD_LIBRARY_PATH=/tmp/jeu-validation/libs/usr/lib/x86_64-linux-gnu`.
  Aucune installation système ni dépendance ajoutée au dépôt.
- L'émulation Chromium ne remplace pas un essai Safari sur iPhone réel,
  notamment pour les encoches et gestes natifs. Les glyphes emoji dépendent
  des polices de la plateforme.

Fichiers ajoutés : `daily-cycle.js`, `tests/daily-cycle.js`, `tests/mobile.cjs`,
`LOT-1.md`. Fichiers adaptés : `config.js`, `game.js`, `simulation.js`,
`customers.js`, `employees.js`, `logistics.js`, `map.js`, `police.js`,
`events.js`, `debug.js`, `save.js`, `index.html`, `styles.css`,
`tests/regression.cjs`, `tests/phases.js`, `tests/stress.js`,
`tests/edge-cases.js`.
