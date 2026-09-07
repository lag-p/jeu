# Lot 1.2 — Refonte mobile

Base auditée : `768f386fcf3dd7d8c9d94a4c1eb69eeb7f1cb860`. Le dépôt était propre,
aucun `AGENTS.md` n'est présent, et aucun commit ni push n'est réalisé.

## Audit de l'ancienne interface

- Le HUD affichait chaque produit en permanence et prenait trop de place.
- Les couches CSS successives avaient laissé des cartes, boutons et panneaux
  sans système visuel unifié ; la navigation employait des emojis.
- Les panneaux étaient techniquement contenus par le lot 1.1, mais restaient
  denses et affichaient trop de formulaires simultanément.
- La fiche client ne rendait pas la patience visuelle et n'avait pas de
  fermeture textuelle explicite.

## Principes appliqués

Le thème `street nocturne` emploie des variables CSS : fond asphalté, surfaces
anthracite, bordures gris-bleu, vert froid pour l'activité, ambre pour les
avertissements et rouge pour les problèmes. Il utilise les polices système iOS,
une texture CSS discrète et aucun asset réseau.

Le HUD est compact : argent, stock résumé tactile, satisfaction, équipe et
police sur une ligne ; jour, heure, phase et vitesse dans une barre temporelle.
La carte reste le contenu flexible central. La navigation basse reçoit des SVG
locaux cohérents, des étiquettes visibles, des zones tactiles de 44 px et les
safe areas.

Le gestionnaire du lot 1.1 est conservé. Les panneaux reçoivent un en-tête
stable, du défilement interne et des composants communs. Les détails de stock,
le transfert, l'ajout d'appartement et les missions logistiques sont repliables.
La fiche client ajoute une jauge de patience, Fermer explicite et une fermeture
au toucher de la carte hors fiche.

## Fichiers modifiés

- `index.html` : SVG de navigation, stock tactile, fiche client.
- `styles.css` : tokens, responsive, composants, HUD, carte et accessibilité.
- `interface.js`, `customers.js`, `game.js` : interactions et classes de rendu.
- `stock.js`, `logistics.js` : sections repliables, sans changement d'action.

## Tests et limites

- Inspection de `index.html`, `styles.css`, `interface.js`, rendus de menus,
  caméra et interactions de navigation/formulaires.
- `node --check` sur JS/CJS et `git diff --check`.
- `node tests/regression.cjs` relancé : ventes, stock physique, équipes,
  missions, police, cycle et sauvegarde restent sur les règles existantes.
- Références disponibles aux formats 320×568, 390×844, 430×932 et 667×375.
  Chromium a été relancé, mais son processus est restreint dans cette session ;
  Safari réel reste nécessaire pour safe areas, clavier natif et gestes iPhone.

En portrait, le HUD reste court et les panneaux n'écrasent pas la navigation. À
320 px, le résumé stock se masque pour préserver la lisibilité mais reste
accessible via Stock. En paysage bas, HUD, temps et navigation se contractent,
tandis que panneaux et fiche défilent verticalement. Les futurs visuels de carte
et parcours logistiques restent hors de ce lot.
