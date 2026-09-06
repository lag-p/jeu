# Évolution stratégique

Sans réécriture ni commit. Audit initial : le cycle, les files, les ventes via
`resolveSale`, les transferts physiques et les missions parallèles existent.
`events.js` et `save.js` étaient vides. Le rendu est CSS/DOM.

Validation reproductible : `node tests/regression.cjs` (jsdom installé dans
`/tmp/jeu-validation`), `node --check` sur les scripts, `git diff --check`.
Le test pilote un DOM isolé et une horloge contrôlée ; il ne remplace pas un
essai tactile sur un téléphone. Aucun résultat visuel réel n'est inféré de jsdom.

## Phase 1 — UX

Tableau de bord Gestion, problèmes structurés, actions vers les panneaux,
résumés des quatre rôles, configuration repliée et badges contextuels.
Fichiers : management.js, employees.js, game.js, index.html, styles.css.
Le bénéfice affiché est le CA moins les dépenses déjà enregistrées.

Audit à traiter dans les phases suivantes : stock caché lors d'un changement de
mode, partage involontaire d'employés entre équipes, service en temps réel,
alertes transmises trop largement et retour de repli incomplet.

Phase 1 : parcours historique réussi dans jsdom, syntaxe et diff vérifiés.

## Phase 2 — Employés

Quatre profils de recrutement, compétences communes et spécialisées, niveaux
1 à 5, expérience sur ventes/orientations/missions, capacité et service progressifs.
Supervision surchargée ralentie pour tous les vendeurs. Salaires prélevés une
fois au bilan (un solde négatif reste visible si les fonds manquent).
Fichiers : employees.js, customers.js, logistics.js, game.js, tests/phases.js.

Phase 2 : parcours historique, niveaux et prélèvement idempotent réussis ; syntaxe/diff OK.

## Phase 3 — Gérant

Prévision en secondes, priorité actualisée selon consommation/file/distance,
cibles plafonnées par produit, équipes exclusives, comparaison des cumuls.
Stock total incluant les deux contenants vendeurs ; changement de mode par
transfert conservatif. Affectations protégées pendant les missions.
Fichiers : logistics.js, employees.js, management.js, tests/phases.js.
Limite : les dépôts peuvent être volontairement accessibles à plusieurs équipes.

Phase 3 : tests de prévision, équipes exclusives, conservation et parcours historique OK ; syntaxe/diff OK.

## Phase 4 — Clientèle

Fidélité persistante limitée à 100 profils, retour chez un vendeur connu,
réputation issue du service et des abandons, traits simples, demande par
jour/heure, cadence d'arrivée selon réputation. Service en temps simulation,
consommation moyenne par produit corrigée (première vente et ventes rapprochées).
Fichiers : customers.js, employees.js, management.js, tests/phases.js.
Limite : réputation globale, profils anonymes et retour probabiliste.

Phase 4 : parcours historique et fidélité idempotente OK ; syntaxe/diff OK.

## Phase 5 — Événements

events.js chargé et piloté par la boucle unique. Onze événements temporaires
positifs/négatifs : demande, affluence, absence, disponibilité/prix fournisseur,
logistique, efficacité, police et grosse commande. Expiration sans dérive des
valeurs de base. Un événement aléatoire par journée.
Fichiers : events.js, game.js, index.html, customers.js, logistics.js, stock.js,
police.js, management.js et tests.

Phase 5 : parcours historique, effets temporaires et retour d'absence OK ; syntaxe/diff OK.

## Phase 6 — Police abstraite

Activité récente bornée, connaissance des points selon utilisation/visibilité,
patrouille/observation/enquête/opération, détection selon compétences/distance,
transmission limitée aux équipes concernées, protocoles et retour physique au
poste, indisponibilités et retour de mission interrompue. Argent des transports
fondé sur money uniquement. Aucun détail opérationnel réel.
Fichiers : police.js, logistics.js, employees.js, map.js, management.js et tests.
Limite : indisponibilité jusqu'au lendemain, risques probabilistes.

Phase 6 : parcours historique et transmission locale OK ; syntaxe/diff OK.

## Phase 7 — Carte/navigation

Graphe orthogonal préconstruit, A* et routes par entité, obstacles partagés avec
le rendu des bâtiments, placements accessibles et files sur espace praticable.
Joueur, clients, employés et police utilisent la même navigation. Aperçu des
emplacements, caractéristiques de zone et choix d'appartement (prix/capacité/loyer).
Fichiers : map.js, game.js, customers.js, employees.js, logistics.js, tests/phases.js.
Limite : navigation 2D sur espaces extérieurs, sans intérieur ni véhicules distincts.

Phase 7 : trajet avec obstacle, points accessibles et parcours historique OK ; syntaxe/diff OK.

## Phase 8 — Caméra

camera.js isole zoom/panoramique : boutons, molette, pincement à deux doigts,
glissement, recentrage et localisation d'employé. HUD/panneau client/commandes
de placement hors du plan transformé. Coordonnées de placement dérivées du
rectangle transformé. Limites zoom 0,75–2,5.
Fichiers : camera.js, index.html, styles.css, map.js, employees.js et tests.
Limite : gestes testés structurellement dans le DOM ; essai mobile réel à faire.

Phase 8 : zoom borné, structure HUD et parcours historique OK ; syntaxe/diff OK.

## Phase 9 — Économie/progression

Bilan détaillé, historique 30 jours, trois fournisseurs limités par jour,
améliorations plafonnées, objectifs et quatre étapes de progression.
Déblocages à 10/20/30 clients. Pertes de stock en unités pour ne pas déduire
deux fois des achats déjà comptabilisés.
Fichiers : economy.js, game.js, employees.js, customers.js, stock.js,
logistics.js, police.js, map.js, management.js et tests.
Limite : bilan en flux, sans valorisation comptable complète des inventaires.

Phase 9 : achats/limites fournisseur, amélioration et bilan idempotent OK ; parcours/syntaxe/diff OK.

## Phase 10 — Sauvegarde

save.js version 2, localStorage, CONTINUER/NOUVELLE PARTIE, état complet des
clients/missions/police/économie/progression/équipes, reconstruction du DOM,
validation avant mutation, version 1 compatible et versions futures refusées.
Autosave différée sur achats/recrutement, fin de journée, toutes les 30 secondes.
Pas de sauvegarde pendant un placement payé non confirmé. Erreurs de stockage
visibles ; sauvegarde incompatible conservée jusqu'au choix de nouvelle partie.
Fichiers : save.js, index.html, game.js, stock.js, employees.js, logistics.js,
economy.js, management.js et tests.
Limite : sauvegarde locale à cet appareil/navigateur, sans synchronisation.

Phase 10 : reprise avec transport chargé et client déjà servi, versions,
stocks/argent conservés, parcours historique et syntaxe/diff OK.

## Phase 11 — Configuration/debug

config.js centralise journée, départ, XP/niveaux/capacités, logistique, police,
caméra et autosave. PRODUCT_CONFIG et les profils/temps clients restent dans
economy.js. DEBUG=false : aucun contrôle visible ; mode actif avec vitesse,
événements et ressources test. Arrivées de clients désormais pilotées par le
temps de simulation de la boucle unique.
Fichiers : config.js, debug.js, index.html, game.js, customers.js, employees.js,
camera.js, management.js, save.js et tests.

Phase 11 : configurations branchées, debug absent, spawn simulation et parcours
historique OK ; syntaxe/diff OK.

## Phase 12 — Préparation du rendu

simulation.js expose l'ordre des mises à jour ; rendering.js fournit l'adaptateur
des entités et le point de rendu d'une frame. game.js reste l'hôte de l'unique
gameLoop. Le rendu CSS est conservé ; les panneaux et le décor urbain restent
DOM, à adapter lors d'un futur changement de moteur graphique.
Fichiers : rendering.js, simulation.js, game.js, map.js, employees.js,
customers.js, police.js, management.js, save.js, index.html.

Phase 12 : parcours complet, ventes et rechargement des visuels OK ; syntaxe/diff OK.

## Phase 13 — Audio futur

audio.js : catégories ambient/ui/events/police, registre d'assets, volumes
sauvegardés, activation après interaction, concurrence limitée et arrêt au
chargement. Événements et alertes raccordés. Aucun asset nécessaire et aucun
son joué par défaut.
Fichiers : audio.js, index.html, management.js, events.js, police.js, save.js et tests.

Phase 13 : absence d'assets silencieuse, catégories et volumes bornés OK ;
parcours historique, syntaxe et diff OK.

## Revue finale

Réservations de dépôt calculées depuis les missions non chargées (aucun stock
recopié), priorité manuelle du ravitailleur respectée, retour conservatif après
chargement impossible, compteurs de rupture par transition, effacement des
alertes expirées et résumé d'employé actualisé sans réinitialiser sa configuration.
Le test long simule trois journées avec deux équipes et rechargements réguliers,
en vérifiant à chaque pas les équations de conservation stock/argent, les
affectations de mission et les positions hors bâtiments.

## Architecture finale et réglages

| Module | Responsabilité |
| --- | --- |
| game.js | État partagé, cycle des journées, HUD, unique gameLoop |
| simulation.js | Ordre de mise à jour et temps de simulation |
| customers.js | Arrivées, files, ventes atomiques, départs, fidélité/réputation |
| employees.js | Recrutement, profils, XP, salaires, supervision |
| logistics.js | Contenants physiques, transferts, demandes, réservations, missions, équipes |
| stock.js / economy.js | Achats, fournisseurs, charges, bilans, objectifs, améliorations |
| map.js | Zones, points, obstacles et graphe A* |
| police.js / events.js | Risque abstrait et effets temporaires |
| management.js | Problèmes calculés, tableau de bord, comparaison d'équipes |
| camera.js / rendering.js | Caméra et adaptateur visuel des entités |
| save.js | Instantanés versionnés, validation, reprise, autosave |
| config.js / debug.js | Paramètres principaux et outils de test masqués |
| audio.js | Interface audio sans assets |

Réglages principaux : journée 180 s ; départ 100 € et 10 A/B/C ; achats A/B/C
5/10/20 €, ventes 12/24/48 € ; 14 clients simultanés ; niveau tous les 20 XP,
maximum 5 ; capacité vendeur initiale 18, ravitailleur 15/18/22/26/30 ;
supervision 3/5/7/9/11 ; anticipation 45 s ; collecte à 150 € ;
améliorations 80/160/240 € ; autosave 30 s ; zoom 0,75–2,5 ; DEBUG=false.

Progression : VENDEUR au départ ; ORGANISATEUR après recrutement ; GÉRANT DE
RÉSEAU avec une équipe ; PATRON avec deux équipes et 1 000 € de bénéfice cumulé.
Les compétences évoluent légèrement, sans arbre RPG. La réputation modifie
les arrivées ; le souvenir des clients est plafonné à 100 profils.

Les réservations logistiques sont calculées depuis les missions, jamais depuis
un second inventaire. money est la caisse de chaque porteur ; un transfert ne
crée pas de revenu. Seule resolveSale valide la transaction commerciale.

## Limites et suite

- Validation automatisée dans jsdom, pas de navigateur graphique ni téléphone
  réel disponible dans cet environnement ; vérifier pincement, glissement,
  lisibilité et performances sur les appareils ciblés.
- Équilibrage initial, à ajuster avec des parties humaines longues : revenus,
  salaires, affluence et pression policière sont configurables.
- Réputation globale, équipes comparées sur leurs cumuls, indisponibilité
  temporaire et navigation extérieure simple.
- Bilan économique en flux ; pas de comptabilité de valorisation des stocks.
- Rendu des entités isolé ; panneaux et décor encore DOM. Isométrie/3D et assets
  audio volontairement absents.
- Sauvegarde locale : pas de cloud ni transfert de fichier intégré.

Aucun commit Git effectué. Les tests n'écrivent aucune sauvegarde de navigateur
utilisateur ; leur localStorage est celui du DOM de test.
