# Lot 2.5B — Interactions isométriques fiables et lisibilité provisoire

Base : `251b9cd25f746012b6a004222911b769f2f22634`. Ce lot ne touche pas aux
règles de simulation, à l'économie, aux sauvegardes métier ni au rendu classique.
Aucun commit ni push ne fait partie de ce lot.

## Causes des régressions tactiles

1. Le prototype 2.5A ne transmettait un toucher vide qu'au placement : aucune
   intention de déplacement joueur ne remontait au système existant.
2. Les écouteurs d'objets et de scène interprétaient séparément le toucher,
   glissement et pincement ; le retrait d'un doigt pouvait donc se terminer
   comme un toucher.
3. Le pincement recalculait son point sous caméra après changement de zoom sans
   conserver le point monde initial, d'où une dérive visible vers le haut.

## Corrections et priorité des gestes

`requestPlayerMovement()` est la commande commune aux deux rendus. Elle refuse
les coordonnées bloquées et enregistre seulement une destination ;
`updateMapRealtime()` reste l'unique système qui calcule le trajet et avance le
joueur. Phaser convertit écran → scène → projection inverse → coordonnées
métier, puis appelle cette commande.

La scène possède une machine explicite : `IDLE`, `TAP_CANDIDATE`, `PAN`,
`PINCH`, `CANCELLED`. Le seuil centralisé est de 10 px. Une entité gagne sur le
toucher vide ; un second pointeur annule toute sélection ; panoramique,
pincement, `pointerupoutside`, `pointercancel`, perte de focus et changement de
taille ne peuvent pas produire de déplacement au relâchement.

## Zoom et caméra

Le pincement mémorise le milieu réel et le point monde sous ce milieu avant le
zoom. Après le changement de niveau, la caméra est décalée de la différence
entre ce point et le nouveau point sous les doigts, puis bornée. Les boutons
`+`, `−` et `◎` passent par la même façade de caméra ; `◎` centre le joueur ou
les bornes projetées. Le cadrage initial ajuste la zone projetée sans écraser
les mouvements manuels ultérieurs.

## Passe visuelle procédurale

Les données de `map.js` sont l'unique source pour sol, zones, entrées,
emprises de bâtiments, postes et repli. Les voies sont des bandes larges
superposées au sol plutôt que le graphe A*. Chaque bâtiment possède toit,
façades claire/intermédiaire/sombre et contour léger. Les personnages ont une
ombre, corps, tête, rôle géométrique et zone tactile plus large ; le joueur a
un anneau. Les marqueurs locaux signalent entrées, repli et points actifs sans
texte permanent. Ces formes et couleurs restent provisoires.

## Architecture et performances

Les géométries statiques sont créées une fois à l'activation ; seuls les
conteneurs d'entités sont synchronisés dans `Scene.update()`. Cet `update()` ne
met jamais à jour la simulation. Les profondeurs restent calculées depuis la
projection et n'affectent aucune position métier. Phaser 3.90.0 est toujours
chargé seulement à la demande et le rendu classique demeure le repli.

## Tests réalisés

- `JEU_TEST_ONLY='interactions et lisibilité isométriques 2.5B' node tests/regression.cjs`
  vérifie commande joueur, refus bloqué, absence de téléportation, conversion,
  bornes et adaptateur sans mutation.
- La suite complète, les contrôles syntaxiques et `git diff --check` sont à
  exécuter en vérification finale.

## Limites et checklist Safari iPhone

Le test automatisé ne reproduit pas le vrai multi-touch Safari. Vérifier sur
iPhone : activer Isométrique, toucher une rue, toucher un bâtiment, faire un
glissement, pincer au centre et au bord, utiliser `+`, `−`, `◎`, tourner
l'écran, puis revenir au classique sans modifier argent, stock ou positions.
Les volumes, silhouettes, pictogrammes et palettes sont une passe de lecture :
ni sprites, ni animations, ni assets définitifs ne sont introduits.
