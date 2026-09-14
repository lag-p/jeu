const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c=JSON.parse(fs.readFileSync('assets/art-v2/masters/calibration.json'));
const m=JSON.parse(fs.readFileSync('assets/art-v2/masters/manifest.json'));
const ctx=vm.createContext({});
for(const f of ['neighborhood-render.js','master-render.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
assert.equal(ctx.validMasterManifest(m),true);assert.equal(ctx.validMasterCalibration(c),true);
assert.equal(ctx.validMasterManifest({...m,version:2}),false);
const folded=structuredClone(c);folded.points[0].image=[-9999,9999];assert.equal(ctx.validMasterCalibration(folded),false);
let error=0;
for(let x=0;x<=100;x+=.5)for(let y=0;y<=100;y+=.5){
 const p={x,y},q=ctx.masterTransform(ctx.masterTransform(p,c),c,true);
 error=Math.max(error,Math.hypot(q.x-x,q.y-y));
}
assert.ok(error<1e-7,`mesh roundtrip ${error}`);
for(const [minute,base] of [[720,'day'],[1079,'day'],[1080,'day'],[1199,'day'],[1200,'dusk'],[1259,'dusk'],[1260,'dusk'],[1319,'dusk'],[1320,'night'],[1440,'night']])assert.equal(ctx.masterMood(minute).base,base);
assert.equal(ctx.masterMood(1198).alpha,0);assert.equal(ctx.masterMood(1199.5).alpha,.5);
assert.equal(ctx.masterMood(1319.5).alpha,.5);
console.log('PASS manifests, inverted mesh rejection, 40401 roundtrips; maximum error',error,'; business time transitions');

// Occlusion copies must follow a moving sprite, including pause and mood changes.
ctx.TIME_CONFIG={openingMinute:720,closingMinute:1440};
ctx.game={dayElapsed:0,dayDuration:720};
const image=(x,y,depth)=>({x,y,depth,displayWidth:4,displayHeight:60,
 setTexture(){return this;},setTint(){return this;},setAlpha(){return this;},
 setVisible(value){this.visible=value;return this;}});
const background={frame:'__BASE',base:image(0,0,-100000),overlay:image(0,0,-99999)};
const strip={frame:'building-strip',base:image(40,40,10005),overlay:image(40,40,10005.01)};
const person={x:42,y:98,depth:9800,scaleX:.34,scaleY:.34,visible:true};
const scene={masterActive:true,masterPairs:[background,strip],visuals:new Map([['player',{container:person}]])};
ctx.syncMasters(scene);
assert.equal(background.base.visible,true);assert.equal(strip.base.visible,true,'behind building');
person.y=104;person.depth=10400;ctx.syncMasters(scene);
assert.equal(strip.base.visible,false,'front needs no covering layer');
person.y=98;person.depth=9800;person.x=100;ctx.syncMasters(scene);
assert.equal(strip.base.visible,false,'unrelated band stays hidden');
person.x=42;ctx.game.dayElapsed=600;ctx.syncMasters(scene);
assert.equal(strip.base.visible,true);assert.equal(strip.baseMood,'night');
const clock=JSON.stringify(ctx.game);ctx.syncMasters(scene);assert.equal(JSON.stringify(ctx.game),clock);
scene.visuals.clear();ctx.syncMasters(scene);
assert.equal(background.base.visible,true);assert.equal(strip.base.visible,false);
console.log('PASS selective occlusion: behind, front, outside, night and no clock mutation');
