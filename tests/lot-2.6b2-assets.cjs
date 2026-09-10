const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync('phaser-adapter.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('neighborhood-render.js','utf8'),ctx);
const manifest=JSON.parse(fs.readFileSync('assets/art-v2/manifest.json'));
for(const entry of manifest.layers){
    ctx.entry=entry;
    assert.equal(vm.runInContext('validNeighborhoodLayer(entry,()=>({width:entry.width,height:entry.height}))',ctx),true);
    assert.equal(vm.runInContext('validNeighborhoodLayer(entry,()=>null)',ctx),false,entry.category);
    assert.equal(vm.runInContext('validNeighborhoodLayer({...entry,images:{...entry.images,night:"https://invalid.test/a.png"}})',ctx),false);
    assert.equal(vm.runInContext('validNeighborhoodLayer({...entry,pivot:[NaN,0]})',ctx),false);
    assert.equal(vm.runInContext('validNeighborhoodLayer({...entry,anchor:{x:101,y:50}})',ctx),false);
    assert.equal(vm.runInContext('validNeighborhoodLayer({...entry,projection:{...entry.projection,reflected:false}})',ctx),false);
}
for(const [minute,base,next,alpha] of [[720,'day','day',0],[1080,'day','dusk',0],[1140,'day','dusk',.5],[1200,'dusk','dusk',0],[1260,'dusk','night',0],[1290,'dusk','night',.5],[1320,'night','night',0],[1440,'night','night',0]]){
    assert.deepEqual(JSON.parse(vm.runInContext(`JSON.stringify(neighborhoodMood(${minute}))`,ctx)),{base,next,alpha});
}
console.log('PASS manifest validation, invalid asset fallback for all categories, visual schedule');
