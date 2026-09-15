const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('/tmp/jeu-validation/node_modules/jsdom');
const html=fs.readFileSync('index.html','utf8'),dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/'}),ctx=dom.getInternalVMContext();
dom.window.requestAnimationFrame=()=>1;dom.window.setTimeout=()=>1;dom.window.clearTimeout=()=>{};
ctx.assert=assert;
ctx.vehicleNetwork=JSON.parse(fs.readFileSync('assets/art-v2/masters/vehicle-road-network.json','utf8'));
try {
 for(const [,f] of html.matchAll(/<script src="([^"]+)"/g))vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
 const calibration=JSON.parse(fs.readFileSync('assets/art-v2/masters/calibration-expanded-v2.json','utf8'));
 assert.ok(ctx.validMasterCalibration(calibration),'accept exported calibration with floating point rounding');
 assert.equal(ctx.validMasterCalibration({...calibration,sceneUnitsPerPixel:calibration.sceneUnitsPerPixel+.001}),false,'reject incorrect scale');
 console.log('PASS exported calibration scale validation');
 vm.runInContext(`
 newGame();assert.equal(mapData.schemaVersion,2);
 assert.ok(validateVehicleNetwork(vehicleNetwork),'connected vehicle network with explicit ends, exits and no solid crossings');
 const disconnected=JSON.parse(JSON.stringify(vehicleNetwork));disconnected.connections=[];
 assert.equal(validateVehicleNetwork(disconnected),false);
 const throughBuilding=JSON.parse(JSON.stringify(vehicleNetwork));
 const solid=rasterPixel(mapData.buildings[0].polygon[0]);Object.assign(throughBuilding.nodes[0],solid);
 assert.equal(validateVehicleNetwork(throughBuilding),false);
 assert.equal(vehicleNetwork.exits.length,3);
 assert.ok(vehicleNetwork.connections.some(e=>e.type==='parking-access'));
 console.log('PASS vehicle graph, exits, parking connections and invalid geometry rejection');
 const snapshot=createSaveSnapshot();snapshot.version=6;snapshot.map.schemaVersion=1;
 const old=o=>{if(!o||typeof o!=='object')return;for(const [x,y] of [['x','y'],['playerX','playerY'],['targetX','targetY']])if(Number.isFinite(o[x])&&Number.isFinite(o[y])){const p=rasterPixel({x:o[x],y:o[y]});o[x]=(p.x/RASTER_ALIGNMENT.scale-120)/8.53;o[y]=(p.y/RASTER_ALIGNMENT.scale+2)/18.44;}for(const value of Object.values(o))old(value);};
 const p=rasterPoint(205,962);snapshot.game.playerX=p.x;snapshot.game.playerY=p.y;
 old(snapshot.game);old(snapshot.customers);old(snapshot.police);old(snapshot.map.zones);old(snapshot.map.salesPoints);
 const untouched=JSON.stringify(snapshot);const result=validateSaveSnapshot(serializeState(snapshot));
 assert.equal(JSON.stringify(snapshot),untouched);assert.equal(result.version,7);assert.equal(result.map.schemaVersion,2);
 assert.ok(rasterDistance({x:result.game.playerX,y:result.game.playerY},p)<1e-8);
 assert.deepEqual(validateSaveSnapshot(serializeState(result)),result);
 console.log('PASS v6 translated snapshot, input immutability and idempotence');
 const from=rasterPoint(205,962),to=rasterPoint(685,705),route=findMapPath(from,to);
 let at=from,weighted=0;for(const next of route){assert.ok(walkableSegment(at,next));weighted+=rasterTravelCost(at,next);at=next;}
 assert.ok(weighted<rasterTravelCost(from,to)*.8,'sidewalk preference');
 const e={...from},before={...e};moveMapEntity(e,rasterPoint(200,830),1,9);assert.equal(e.x,before.x);assert.equal(e.y,before.y);assert.ok(e.pathBlocked);
 const broken={...rasterPoint(200,830)};const beforeBroken={...broken};moveMapEntity(broken,to,1,9);assert.equal(broken.x,beforeBroken.x);assert.equal(broken.y,beforeBroken.y);
 console.log('PASS weighted sidewalk preference and no teleport on invalid position/destination');
 assert.deepEqual(findMapPath(from,to),findMapPath(from,to),'deterministic path');
 const roadOnly=rasterPoint(360,878),roadGoal=rasterPoint(365,875);
 assert.ok(walkableSegment(roadOnly,roadGoal));assert.ok(findMapPath(roadOnly,roadGoal).length,'short necessary road connection');
 const dynamic={...from};moveMapEntity(dynamic,to,.1,9);
 const initialPosition={x:dynamic.x,y:dynamic.y},blockedPoint=dynamic.navRoute.at(-1);
 const barrier=[{x:blockedPoint.x-.01,y:blockedPoint.y-.01},{x:blockedPoint.x+.01,y:blockedPoint.y-.01},{x:blockedPoint.x+.01,y:blockedPoint.y+.01},{x:blockedPoint.x-.01,y:blockedPoint.y+.01}];
 mapData.blockedPolygons.push(barrier);moveMapEntity(dynamic,to,1,9);
 assert.equal(dynamic.moving,false);assert.equal(dynamic.pathBlocked,true);assert.equal(dynamic.x,initialPosition.x);assert.equal(dynamic.y,initialPosition.y);
 mapData.blockedPolygons.pop();moveMapEntity(dynamic,to,.1,9);assert.equal(dynamic.pathBlocked,false);assert.ok(dynamic.moving);
 // A one-pixel obstacle cannot be skipped by a diagonal or a large frame.
 const middle={x:(roadOnly.x+roadGoal.x)/2,y:(roadOnly.y+roadGoal.y)/2};
 mapData.blockedPolygons.push([{x:middle.x-.01,y:middle.y-.01},{x:middle.x+.01,y:middle.y-.01},{x:middle.x+.01,y:middle.y+.01},{x:middle.x-.01,y:middle.y+.01}]);
 assert.equal(walkableSegment(roadOnly,roadGoal),false);mapData.blockedPolygons.pop();
 console.log('PASS short road use, deterministic routing, dynamic blocking, recovery and thin obstacle');
 const timings=[];
 for(const [a,b] of [[from,rasterPoint(360,878)],[from,to],[mapData.entries[0],mapData.entries[4]]]){
   const path=findMapPath(a,b);let distance=0,last=a;for(const n of path){distance+=rasterDistance(last,n);last=n;}
   const seconds=distance/(simulationWalkingSpeed(9)*WALKING_CONFIG.pixelsPerWorldUnit);
   const walk=dt=>{const e={...a};let t=0;while(t<seconds+dt){moveMapEntity(e,b,dt,9);t+=dt;if(!e.moving)return {e,t};}throw Error('unreached');};
   const one=walk(.1),two=walk(.25);assert.ok(rasterDistance(one.e,b)<1e-7);assert.ok(Math.abs(one.t-seconds)<=.10001);assert.ok(Math.abs(two.t-seconds)<=.25001);
   timings.push({distancePixels:distance,seconds,measuredAt10fps:one.t,measuredAt4fps:two.t});
 }
 for(let direction=0;direction<8;direction++){
   const angle=direction*Math.PI/4,entity={role:'PLAYER',walking:true,motion:{dx:Math.cos(angle),dy:Math.sin(angle),distance:0}};
   const poses=new Set();for(let i=0;i<6;i++){entity.motion.distance=i*3;const pose=characterPose(entity);assert.equal(pose.direction,direction);poses.add(pose.frame);}assert.equal(poses.size,6);
 }
 console.log('PASS distance-driven eight-direction animation and measured routes',JSON.stringify(timings));
 `,ctx);
}finally{dom.window.close();}
