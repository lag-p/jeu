// Remaining checks after the interrupted navigation/speed/migration checkpoint.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('/tmp/jeu-validation/node_modules/jsdom');
const html=fs.readFileSync('index.html','utf8'),dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/'}),ctx=dom.getInternalVMContext();
dom.window.requestAnimationFrame=()=>1;dom.window.setTimeout=()=>1;dom.window.clearTimeout=()=>{};
ctx.remainingOnly=Boolean(process.env.JEU_EXTRA_REMAINING);ctx.assert=assert;ctx.atlas=JSON.parse(fs.readFileSync('assets/characters/people.json'));
try {
for(const [,f] of html.matchAll(/<script src="([^"]+)"/g))vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
vm.runInContext(`
newGame();
if(!remainingOnly){
// Starting at every outer access must keep the projected walkable position.
for(const entry of mapData.entries){newGame();finishStartPointPlacement(entry.x,entry.y);assert.ok(isWalkable({x:game.playerX,y:game.playerY}),entry.id);assert.equal(game.playerX,entry.x);assert.equal(game.playerY,entry.y);}
console.log('PASS all six edge placements remain on their road');
const roles=['PLAYER','vendeur','guetteur','gerant','ravitailleur','police'];
for(const role of roles){const e={role,type:role==='PLAYER'?'player':'employee',x:0,y:0};assert.ok(atlas.frames[characterPose(e).name],role);}
const variants=new Set();for(let id=0;id<20;id++)variants.add(characterAppearance({type:'customer',businessId:id}));assert.equal(variants.size,4);
for(const [i,p] of [[0,[1,1]],[1,[-1,1]],[2,[-1,-1]],[3,[1,-1]]]){
 const e={role:'PLAYER',x:0,y:0,nextPoint:{x:p[0],y:p[1]},walking:true};
 const frames=new Set();for(let t=0;t<4;t++){game.clock.elapsed=t/8;const pose=characterPose(e);assert.equal(pose.direction,i);frames.add(pose.name);assert.ok(atlas.frames[pose.name]);}assert.equal(frames.size,4);
 e.walking=false;e.nextPoint=null;assert.equal(characterPose(e,i).direction,i);assert.equal(characterPose(e,i).frame,0);
}
assert.equal(Object.keys(atlas.frames).length,200);for(const {frame:f} of Object.values(atlas.frames))assert.ok(f.x>=0&&f.y>=0&&f.x+f.w<=1280&&f.y+f.h<=960);
console.log('PASS atlas metadata, all roles, four civilian variants, directions, idle and timed walk poses');
}
// Independent occlusion points, in source pixels, at several facade/wall/tree silhouettes.
const config={occlusion:[...mapData.buildings,...mapData.walls,...mapData.vegetation].map(z=>({id:z.id,category:z.visualType,polygon:z.silhouette,ground:z.ground}))};
for(const [id,back,front] of [
 ['NORTH_W',[300,450],[300,525]],['CENTRAL',[450,710],[450,810]],['SOUTH_E',[720,980],[720,1100]],
 ['COURT_N_WALL',[400,500],[400,540]],['COURT_S_WALL_W',[320,970],[320,1010]],
 ['TREE_COURT_N',[500,510],[500,620]],['TREE_COURT_S',[510,1020],[510,1110]]]){
 assert.ok(masterOcclusionReasons(rasterPoint(...back),config).some(r=>r.endsWith(':'+id)),id+' behind');
 assert.ok(!masterOcclusionReasons(rasterPoint(...front),config).some(r=>r.endsWith(':'+id)),id+' front');
}
const concealed={};for(const n of mapData.navigation.nodes)for(const reason of masterOcclusionReasons(n,config))concealed[reason]??=rasterPixel(n);
console.log('PASS facade/wall/tree reasons; walkable concealed examples',JSON.stringify(concealed));
// A real in-flight supply mission survives migration, then can finish.
newGame('REFERENCE_QUARTER_V1');const home=createApartment('depot',23,17);home.inventory['Produit A']=31;
const seller=createEmployee('vendeur',34,35),courier=createEmployee('ravitailleur',23,17);
for(const e of [seller,courier]){e.assignment.apartmentId=home.id;e.assignment.manual=true;game.employees.push(e);}
finishStartPointPlacement(71,75);clearWaitingCustomers();
for(const e of [seller,courier]){setEmployeeOperation(e,EMPLOYEE_OPERATION.AT_POST);e.state='en poste';}
assert.equal(createManualLogisticsMission(courier.id,home.id,seller.id,'Produit A',2).success,true);
const snapshot=createSaveSnapshot();snapshot.version=5;const mission=serializeState(snapshot.game.logisticsMissions[0]);const stock=getNetworkStock().total;
const resources=e=>[e.id,e.money,e.inventory,e.localReserve];const before=snapshot.game.employees.map(resources);
restoreSaveSnapshot(snapshot);assert.equal(getNetworkStock().total,stock);assert.deepEqual(game.employees.map(resources),before);
for(const key of ['id','stage','courierId','sellerId','apartmentId','quantity','cargo','elapsed'])assert.deepEqual(game.logisticsMissions[0][key],mission[key],key);
for(const e of [game.personalFallback,...game.employees,...game.apartments])if(e)assert.ok(isWalkable(e));
const stable=createSaveSnapshot();restoreSaveSnapshot(stable);assert.deepEqual(createSaveSnapshot(),stable);
for(let i=0;i<5000&&game.logisticsMissions.length;i++)updateLogisticsRealtime(.1);
assert.equal(game.logisticsMissions.length,0);assert.equal(getNetworkStock().total,stock);
console.log('PASS in-flight mission migration, resources, idempotence and completed delivery');
`,ctx);
} finally {dom.window.close();}
