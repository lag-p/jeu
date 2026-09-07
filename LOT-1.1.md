# Lot 1.1 — Correctifs d'interface mobile

Base vérifiée : `492dd6d8571cf284d94cd81b63191f93887c0d58`, dépôt propre avant
modification. Aucun AGENTS.md applicable trouvé. Aucun commit ni push.
Le cycle quotidien du lot 1 est conservé ; aucun travail du lot 2 ni refonte artistique.

## Reproduction avant correction

- Fiche client : aucun bouton de fermeture. Après `startCustomerLeaving`,
  `display` restait `block` et `selectedCustomer` conservait le client.
  Seul `removeCustomer`, à la sortie physique de la carte, nettoyait la sélection.
  Le bouton Servir était réactivé par `updateDayUI` sur la seule autorisation
  globale de vente (phase/pause), sans vérifier le client sélectionné.
- Employés : chaque `change` appelait `updateEmployeesPanel`, qui exécutait
  `replaceChildren`. Le nouvel élément `details` CONFIGURER était fermé.
  La valeur métier et l'identifiant de l'employé étaient conservés, mais la
  disparition du formulaire donnait l'impression d'un retour à la liste.
  Reproduction : `details.open === false`, ancien champ déconnecté après changement.
- Chromium 320 × 568 : panneau Stock de 293 px, contenu de 511 px.
  Le titre, la fermeture et le sélecteur fournisseur dépassaient la largeur disponible.

## Corrections

Le bouton × de la fiche client désélectionne sans toucher au client, à sa file
ou à sa patience. Les états servi/départ/sortie ferment immédiatement la fiche.
Le rendu vérifie aussi les références invalides, même en pause. `resolveSale`
refuse explicitement un objet absent de la collection. Le gestionnaire du bouton
capture le client avant la vente, puisque la vente peut effacer la sélection.
Le toucher extérieur n'est pas ajouté : les gestes existants de carte restent disponibles.

Les changements d'affectation, de gérant, de mode, de seuil, de cible, d'automatisation,
de protocole et de produits actualisent les textes et valeurs de la fiche en place.
Les éléments de formulaire, le focus, la section ouverte et le défilement restent
conservés, y compris lorsqu'une règle métier refuse une modification.
Les formulaires de mission manuelle et d'équipe ne sont pas reconstruits à ces changements.
Le fournisseur actualise ses prix sans effacer les quantités et destinations saisies.
Les rafraîchissements de Gestion conservent la section audio et le défilement.

`interface.js` centralise les ouvertures/fermetures et l'historique léger des
fenêtres principales. Le contexte de l'employé utilise l'identifiant existant
`selectedEmployeeId` et le DOM conservé, sans ajouter une seconde sélection métier.
Le retour remonte de CONFIGURER à la fiche, puis à la liste, puis au panneau
appelant ou à la carte. Les liens internes de Gestion gardent leur origine.
Les placements et chargements de sauvegarde ferment aussi via ce gestionnaire.

Les fenêtres utilisent un en-tête fixe et un contenu défilant séparé. Leurs limites
suivent les dimensions réelles des commandes du jour et de la navigation, avec
safe areas, largeur bornée, retour à la ligne, champs natifs de largeur 100 % et
commandes tactiles de 44 px minimum. La navigation réserve sa hauteur en plus de
la safe area inférieure. La fiche client est limitée à 340 px et à la hauteur
utile de la carte. Les messages ne capturent aucun toucher et restent sous la fiche.

## Fichiers

- Ajouts : `interface.js`, `tests/interface.js`, `tests/interface-mobile.cjs`, `LOT-1.1.md`.
- Clients : `customers.js`, `rendering.js`, `game.js`, `index.html`.
- Formulaires et ouvertures : `employees.js`, `stock.js`, `management.js`,
  `logistics.js`, `police.js`, `save.js`.
- Responsive : `styles.css`.
- Intégration des tests : `tests/regression.cjs`, `tests/mobile.cjs`.

## Validation reproductible

```sh
node tests/regression.cjs
LD_LIBRARY_PATH=/tmp/jeu-validation/libs/usr/lib/x86_64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/tmp/jeu-validation/browsers node tests/mobile.cjs
for file in *.js tests/*.js tests/*.cjs; do node --check "$file" || exit 1; done
git diff --check
```

Les nouveaux scénarios couvrent fermeture/réouverture de plusieurs clients en
activité et en pause, départ par patience, suppression, référence disparue,
vente avec fermeture, formulaires des quatre métiers et refus d'affectation.
Ils vérifient l'identité DOM, le focus, l'employé sélectionné, les sections,
les valeurs enregistrées, le fournisseur et le retour depuis Gestion.

Le navigateur couvre 320 × 568, 390 × 844, 430 × 932, 667 × 375 : changements
d'appartement/gérant/mode, défilement conservé, noms longs, exclusivité des
fenêtres, absence de débordement, dernier contrôle non recouvert, fermeture
tactile, marges de sécurité simulées, pause, repli, bilan et jour suivant.
Les captures sont écrites dans `/tmp/jeu-interface-*.png` et `/tmp/jeu-mobile-*.png`.

- Suite jsdom complète : succès, dont trois journées complètes avec conservation,
  scénarios du cycle quotidien et nouveaux scénarios d'interface.
- Contrôles syntaxiques JS/CJS et `git diff --check` : succès.
- Dernière passe Chromium : succès sur les quatre formats, marges simulées
  incluses, aucun contrôle final recouvert et aucune erreur JavaScript.
  Captures Stock à 320 px et Employés en paysage inspectées.

Les essais ont aussi permis de corriger le décalage du défilement lorsque les
textes changent de hauteur et l'observation des safe areas (mesure de la boîte
extérieure des barres). Deux mesures du harnais ont été ajustées : ignorer les
champs de sections repliées et défiler jusqu'au dernier bouton lorsqu'il est
suivi de texte. Une interruption de processus a nécessité une relance séparée
du navigateur et de la suite longue.

## Limites et prochaine refonte

Chromium avec viewport mobile ne remplace pas Safari sur un iPhone réel ;
le sélecteur et le clavier natifs, les gestes de défilement et les encoches
restent à confirmer sur l'appareil. Les marges simulées vérifient la géométrie,
pas le comportement système iOS.

La densité des informations, la hiérarchie des formulaires, les intitulés longs,
la cohérence des couleurs/typographies/icônes et la présentation des retours
utilisateur restent des sujets pour la vraie refonte graphique. En paysage,
le contenu défile dans une hauteur réduite afin de garder les commandes du jour
et la navigation accessibles. Les nouveaux locaux et trajets restent au lot 2.
