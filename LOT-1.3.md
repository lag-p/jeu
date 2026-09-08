# Lot 1.3 — Flux clients, ruptures, affectations et bilan

Base : `e2d49e28f91ddaf2856b35a680efaa11d4833324`. Aucun commit ni push.

## Causes corrigées

- `createCustomer()` ciblait systématiquement une coordonnée autour de 50/50,
  indépendamment de son entrée : les recherches convergeaient donc au centre.
- Une rupture en tête de file ne déclenchait aucune décision avant la tentative
  de vente ; le client pouvait bloquer la file jusqu'à sa patience.
- Le recrutement plaçait un employé sans proposition centralisée de rattachement.
- Le bilan rendait toutes les lignes au même niveau de priorité.

## Architecture retenue

Les clients reçoivent des points de recherche praticables déterminés par les
zones les plus proches de leur entrée. Ils alternent entre ces points et sortent
par une entrée cohérente. Le graphe et `moveMapEntity()` existants restent seuls
responsables des trajets : aucune géométrie de carte ni seconde boucle n'est
ajoutée.

À la tête de file, `handleUnavailableCustomer()` applique une politique vendeur
`AUTO`, `WAIT_IF_POSSIBLE` ou `REFUSE_IMMEDIATELY` : stock, redirection unique
vers un vendeur proche, attente latérale seulement pour une mission réelle du
bon produit vers le bon vendeur, puis rupture/refus. `WAITING_FOR_RESTOCK`
libère la file, ralentit la patience, limite les places latérales et reprend les
clients selon l'ordre des files existant dès l'arrivée du stock. Les pertes sont
protégées par les marqueurs déjà idempotents.

Le joueur reçoit les actions tactiles possibles dans la fiche client. Les
vendeurs employés utilisent leur politique automatiquement.

`chooseAutomaticAssignment()` et `applyAutomaticAssignment()` proposent un
appartement, un gérant et une équipe selon rôle, distance et charge. Une
affectation manuelle est marquée et n'est jamais remplacée. Les sauvegardes
existantes conservent leurs affectations ; seuls les employés sans rattachement
peuvent recevoir une proposition prudente après normalisation.

Le bilan initial affiche résultat, trésorerie, clientèle, satisfaction et trois
enseignements. Les détails restent repliables. Les compteurs de ruptures et de
retards sont initialisés au démarrage de la journée et restent dans l'état
sauvegardé normal du jeu.

## Économie observée

La trésorerie/bénéfice de premier jour observé (environ 816 € dans la capture)
paraît rapide pour la progression visée. Aucun prix, stock de départ ou marge
n'est modifié ici : l'équilibrage est réservé au futur système de produits.

## Tests et limites

Les tests ajoutés couvrent les zones de recherche, l'absence de centre commun,
la redirection bornée, l'attente latérale avec mission réelle et le respect d'une
affectation manuelle. Exécutés : `node tests/regression.cjs` (succès, y compris
le scénario 1.3), `node --check` sur JS/CJS et `git diff --check` (succès).
La tentative Chromium reste soumise à la restriction de processus de cet
environnement ; elle ne constitue pas une validation Safari.

À vérifier sur Safari iPhone : HUD aux quatre tailles demandées, ouverture de
la fiche client, états tactiles de rupture, bouton jour suivant au clavier et
safe areas. Chromium reste une validation complémentaire, pas une validation
Safari.
