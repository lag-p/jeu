const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('/tmp/jeu-validation/node_modules/jsdom');
const html=fs.readFileSync('index.html','utf8'),dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/'}),ctx=dom.getInternalVMContext();
dom.window.requestAnimationFrame=()=>1;dom.window.setTimeout=()=>1;dom.window.clearTimeout=()=>{};
let seed=42;dom.window.Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
try{
for(const [,f] of html.matchAll(/<script src="([^"]+)"/g))vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
ctx.assert=assert;
vm.runInContext(`
newGame();assert.equal(mapData.mapId,RASTER_MAP_ID);
const nodes=mapData.navigation.nodes,seen=new Set(),queue=[nodes[0].id];
while(queue.length){const id=queue.pop();if(seen.has(id))continue;seen.add(id);queue.push(...mapData.navigation.lookup.get(id).edges);}
assert.equal(seen.size,nodes.length,'connected raster graph');
for(const edge of mapData.navigation.connections)assert.ok(walkableSegment(mapData.navigation.lookup.get(edge.from),mapData.navigation.lookup.get(edge.to)));
for(const key of ['entries','buildingEntries','apartmentSites','strategicSalesSites','pointsOfInterest','logisticsPlaces'])for(const p of mapData[key]){
 assert.ok(isWalkable(p),p.id);let from=mapData.fallbackPoints[0];const route=findMapPath(from,p);assert.ok(route.length,p.id);
 for(const to of route){assert.ok(walkableSegment(from,to),p.id);from=to;}assert.ok(mapDistance(from,p)<1e-8);
}
for(const a of mapData.entries)for(const b of mapData.entries){let p=a;const route=findMapPath(a,b);assert.ok(route.length);for(const q of route){assert.ok(walkableSegment(p,q));p=q;}}
for(const p of nodes){assert.ok(isWalkable(p));assert.ok(mapDistance(p,isometricToWorld(worldToIsometric(p)))<1e-10);}
console.log('PASS raster: connected',nodes.length,'nodes; entries, homes, long routes, obstacles, affine touch');
// Same path and elapsed time, arbitrary frame splits, pixel-metric speed on both axes.
const from=mapData.entries[0],goal=mapData.entries[4];
function walk(parts){const e={x:from.x,y:from.y};for(const dt of parts)moveMapEntity(e,goal,dt,9);return e;}
const a=walk([1]),b=walk(Array(100).fill(.01));assert.ok(rasterDistance(a,b)<1e-8);
let e={...from},last={...e};for(let i=0;i<300;i++){moveMapEntity(e,goal,.05,9);assert.ok(rasterDistance(e,last)<=9*.25*8.53*.05+1e-7);last={...e};}
finishStartPointPlacement(from.x,from.y);clearWaitingCustomers();game.events=[];police.patrols=[];police.alerts=[];police.activeOperation=null;police.plannedOperation=null;
game.customerSpawnRemaining=999;game.playerDestination={x:goal.x,y:goal.y};game.clock.paused=true;
const paused=createSaveSnapshot();updateSimulation(1);assert.deepEqual(createSaveSnapshot(),paused);
const start=createSaveSnapshot();function simulated(speed,parts){restoreSaveSnapshot(start);game.clock.paused=false;game.clock.speed=speed;for(const t of parts)updateSimulation(t);return {x:game.playerX,y:game.playerY};}
const one=simulated(1,[2]),two=simulated(2,[1]),split=simulated(1,Array(200).fill(.01));assert.ok(rasterDistance(one,two)<1e-8);assert.ok(rasterDistance(one,split)<1e-8);
assert.equal(requestPlayerMovement(rasterPoint(200,830)),false);
console.log('PASS movement: pause, x1/x2, frame partitions, continuous node crossing, invalid target');
// Migration preserves resources, mission identities/stages, distinct positions; repeat is stable.
newGame('REFERENCE_QUARTER_V1');game.money=987;const home=createApartment('depot',23,17);home.inventory['Produit A']=31;
const seller=createEmployee('vendeur',34,35);game.employees.push(seller);seller.assignment.apartmentId=home.id;
const old=createSaveSnapshot();old.version=5;old.game.playerX=71;old.game.playerY=75;
const oldCopy=serializeState(old);restoreSaveSnapshot(old);
assert.deepEqual(old,oldCopy);assert.equal(mapData.mapId,RASTER_MAP_ID);assert.equal(game.money,987);assert.equal(game.apartments[0].inventory['Produit A'],31);
for(const p of [{x:game.playerX,y:game.playerY},...game.employees,...game.apartments])assert.ok(isWalkable(p));
assert.ok(mapDistance({x:game.playerX,y:game.playerY},game.apartments[0])>1);
const migrated=createSaveSnapshot();restoreSaveSnapshot(migrated);assert.deepEqual(createSaveSnapshot(),migrated);
for(const id of ['LEGACY_TEST_MAP','PONCETTE_INSPIRED_V1']){newGame(id);const s=createSaveSnapshot();s.version=5;restoreSaveSnapshot(s);assert.equal(mapData.mapId,id);}
console.log('PASS one-time v5 raster migration, distinct walkable positions, resources and historical maps');
`,ctx);
}finally{dom.window.close();}
