productNewGame();
assert.equal(mapData.mapId, 'REFERENCE_QUARTER_V1');
assert.equal(DEFAULT_MAP_ID, mapData.mapId);
assert.equal(mapData.buildings.length, 7);
assert.equal(mapData.courts.length, 2);
assert.deepEqual(serializeState(mapData.buildings), serializeState(NEIGHBORHOOD_SPEC.buildings));
const nodes262 = mapData.navigation.nodes, visited262 = new Set(), queue262 = [nodes262[0].id];
while (queue262.length) {
    const id = queue262.pop(); if (visited262.has(id)) continue; visited262.add(id);
    queue262.push(...mapData.navigation.lookup.get(id).edges.filter(id => !visited262.has(id)));
}
assert.equal(visited262.size, nodes262.length, 'graphe entier connecté');
assert.ok(nodes262.length < 1800);
for (const node of nodes262) assert.ok(isWalkable(node));
for (const edge of mapData.navigation.connections) assert.ok(walkableSegment(mapData.navigation.lookup.get(edge.from), mapData.navigation.lookup.get(edge.to)));
const validateRoute262 = (from, to) => {
    const route = findMapPath(from, to); assert.ok(route.length, JSON.stringify([from,to]));
    for (const p of route) { assert.ok(walkableSegment(from,p)); from=p; }
    assert.ok(mapDistance(from,to)<1e-8);
};
for (const key of ['entries','buildingEntries','apartmentSites','zones','fallbackPoints','strategicSalesSites','logisticsPlaces','pointsOfInterest']) {
    for (const p of mapData[key]) { assert.ok(isWalkable(p),p.id); validateRoute262(mapData.fallbackPoints[0],p); }
}
for (const p of mapData.transitions) validateRoute262(p.from,p.to);
for (const b of [...mapData.buildings,...mapData.walls,...mapData.obstacles]) assert.equal(isWalkable({x:b.x+b.width/2,y:b.y+b.height/2}),false,b.id);
const initial262=createSaveSnapshot(); restoreSaveSnapshot(initial262);
assert.equal(mapData.mapId,'REFERENCE_QUARTER_V1');
for (const id of ['PONCETTE_INSPIRED_V1','LEGACY_TEST_MAP']) {
    productNewGame(id);game.money=765;game.playerInventory['Produit A']=23;
    const snapshot=createSaveSnapshot();restoreSaveSnapshot(snapshot);
    assert.equal(mapData.mapId,id);assert.equal(game.money,765);
    assert.deepEqual(serializeState(game.playerInventory),snapshot.game.playerInventory);
    assert.equal(game.playerX,snapshot.game.playerX);assert.equal(game.playerY,snapshot.game.playerY);
    assert.ok(mapData.apartmentSites.every(a=>a.mapId===id));
}
productNewGame();
const point262=mapData.zones[0];finishStartPointPlacement(point262.x,point262.y);clearWaitingCustomers();
game.events=[];police.patrols=[];police.alerts=[];police.activeOperation=null;police.plannedOperation=null;
const t262=game.dayElapsed;setSimulationSpeed(1);updateSimulation(.5);assert.ok(Math.abs(game.dayElapsed-t262-.5)<1e-8);
setSimulationSpeed(2);updateSimulation(.5);assert.ok(Math.abs(game.dayElapsed-t262-1.5)<1e-8);
game.clock.paused=true;const paused262=serializeState(game);updateSimulation(2);assert.deepEqual(serializeState(game),paused262);
const state262=createSaveSnapshot();restoreSaveSnapshot(state262);assert.equal(game.dayElapsed,state262.game.dayElapsed);
if (typeof neighborhoodMood==='function') {
    assert.equal(neighborhoodMood(720).next,'day');assert.equal(neighborhoodMood(1140).next,'dusk');
    assert.equal(neighborhoodMood(1380).next,'night');assert.equal(neighborhoodMood(1140).alpha,.5);
    const snapshot=serializeState(game);for(let i=0;i<200;i++)neighborhoodMood(720+i*4);createIsometricRenderState();assert.deepEqual(serializeState(game),snapshot);
}
console.log('MAP 2.6B.2',nodes262.length,'nodes; geometry, routes, historic saves, time and pause OK');
