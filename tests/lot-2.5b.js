// Lot 2.5B : intentions de déplacement et données visuelles sans mutation.
newGame();
game.dayActive = true; game.phase = DAY_PHASE.ACTIVITE; game.clock.paused = false;
assert.equal(requestPlayerMovement(mapData.navigation.nodes[0]), false, 'aucun avatar à commander');
assert.equal('playerX' in game, false);
assert.equal('playerDestination' in game, false);
assert.equal(ISO_GESTURE.tapSlop, 10, 'seuil de geste centralisé');
const cameraStub25b = { getWorldPoint: (x, y) => ({ x: x + 3, y: y + 4 }) };
assert.deepEqual(isoSceneToWorld({ x: 20, y: 30 }, cameraStub25b), isometricToWorld({ x: 23, y: 34 }), 'conversion écran, scène puis métier');
const bounds25b = getIsometricMapBounds();
assert.ok(bounds25b.width > 0 && bounds25b.height > 0, 'bornes visuelles projetées');
const beforeRender25b = serializeState(game);
const state25b = createIsometricRenderState();
assert.ok(state25b.buildings.length === MAP_BUILDINGS.length && !state25b.entities.some(item => item.type === 'player'));
assert.deepEqual(serializeState(game), beforeRender25b, 'adaptateur visuel sans mutation');
