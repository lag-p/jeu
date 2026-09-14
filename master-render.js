// Lot 2.6C: presentation only. Ground coordinates and all intents remain business-owned.
function masterScene() {
    return typeof PhaserMapRenderer !== 'undefined' && mapData.mapId === 'REFERENCE_QUARTER_V1' && PhaserMapRenderer.scene?.masterActive ? PhaserMapRenderer.scene : null;
}
function masterBarycentric(p, a, b, c) {
    const det = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
    const u=((b[1]-c[1])*(p.x-c[0])+(c[0]-b[0])*(p.y-c[1]))/det;
    const v=((c[1]-a[1])*(p.x-c[0])+(a[0]-c[0])*(p.y-c[1]))/det;
    return [u,v,1-u-v];
}
// Compile once per loaded JSON object; pointer and entity transforms allocate no mesh arrays.
const masterMeshes = new WeakMap();
function masterTransform(point, config, inverse = false) {
    let mesh=masterMeshes.get(config);
    if(!mesh){
        mesh=[false,true].map(reverse=>config.triangles.map(ids=>{
            const source=reverse?'image':'world', target=reverse?'world':'image';
            const [a,b,c]=ids.map(i=>config.points[i][source]);
            const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
            return {a:(b[1]-c[1])/det,b:(c[0]-b[0])/det,c:(c[1]-a[1])/det,d:(a[0]-c[0])/det,x:c[0],y:c[1],target:ids.map(i=>config.points[i][target])};
        }));
        masterMeshes.set(config,mesh);
    }
    const x=inverse?point.x/config.sceneUnitsPerPixel:point.x,y=inverse?point.y/config.sceneUnitsPerPixel:point.y;
    let best,bu,bv,penalty=Infinity;
    for(const t of mesh[inverse?1:0]){
        const dx=x-t.x,dy=y-t.y,u=t.a*dx+t.b*dy,v=t.c*dx+t.d*dy;
        const outside=Math.max(0,-u)+Math.max(0,-v)+Math.max(0,u+v-1);
        if(outside<penalty){best=t;bu=u;bv=v;penalty=outside;}
        if(outside<1e-9)break;
    }
    const [a,b,c]=best.target,scale=inverse?1:config.sceneUnitsPerPixel;
    return {x:(a[0]*bu+b[0]*bv+c[0]*(1-bu-bv))*scale,y:(a[1]*bu+b[1]*bv+c[1]*(1-bu-bv))*scale};
}
function validMasterManifest(manifest) {
    return manifest?.version===1 && manifest.mapId==='REFERENCE_QUARTER_V1' && manifest.width===853 && manifest.height===1844 &&
        ['day','dusk','night'].every(m=>manifest.images?.[m]?.image===`assets/art-v2/masters/neighborhood-${m}-master-v1.png` && manifest.images[m].width===853 && manifest.images[m].height===1844);
}
function validMasterCalibration(c) {
    if(c?.version!==1 || c.width!==853 || c.height!==1844 || c.sceneUnitsPerPixel!==.5 || !Array.isArray(c.points) || !c.triangles?.length || !Array.isArray(c.occlusion))return false;
    const area=(a,b,d)=>(b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]);
    return c.points.every(p=>['world','image'].every(k=>p[k]?.length===2 && p[k].every(Number.isFinite))) && c.triangles.every(t=>t.length===3 && t.every(i=>Number.isInteger(i)&&c.points[i]) && area(...t.map(i=>c.points[i].world))*area(...t.map(i=>c.points[i].image))>0) && c.occlusion.every(z=>['polygon','ground'].every(k=>Array.isArray(z[k])&&z[k].length>=2&&z[k].every(p=>p.length===2&&p.every(Number.isFinite))));
}
function preloadMasters(scene, renderer) {
    scene.load.json('master-calibration','assets/art-v2/masters/calibration.json');
    scene.load.once('filecomplete-json-master-manifest',(_key,_type,m)=>{
        if(!validMasterManifest(m)){renderer.assetError('Manifeste maîtresses invalide');return;}
        for(const mood of ['day','dusk','night'])scene.load.image(`master-${mood}`,m.images[mood].image);
    });
    scene.load.json('master-manifest','assets/art-v2/masters/manifest.json');
}
function masterMood(minute) {
    const mood=neighborhoodMood(minute);
    const end=mood.next==='dusk'?1200:1320;
    const alpha=mood.base===mood.next?0:Math.max(0,Math.min(1,minute-(end-1)));
    // Gradual colour adaptation, followed by a one-business-minute crossfade.
    const progress=mood.alpha;
    const endColor=mood.base==='day'?[.48,.55,.70]:[.86,.86,.90];
    const rgb=endColor.map(v=>Math.round(255*(1+(v-1)*progress)));
    return {...mood,alpha,tint:(rgb[0]<<16)|(rgb[1]<<8)|rgb[2]};
}
function masterGroundY(zone,x) {
    const ys=[];
    for(let i=1;i<zone.ground.length;i++){
        const a=zone.ground[i-1],b=zone.ground[i];
        if(x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0]))ys.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]||1));
    }
    return ys.length?Math.max(...ys):Math.max(...zone.ground.map(p=>p[1]));
}
function drawMasters(scene,renderer) {
    scene.masterActive=false;scene.masterPairs=[];
    if(!isRasterMap() || renderer.housingMode!=='asset')return false;
    const manifest=scene.cache.json.get('master-manifest'), config=scene.cache.json.get('master-calibration');
    if(!validMasterManifest(manifest)||!validMasterCalibration(config)||!['day','dusk','night'].every(m=>{
        if(!scene.textures.exists(`master-${m}`))return false;
        const image=scene.textures.get(`master-${m}`).getSourceImage();return image.width===manifest.width&&image.height===manifest.height;
    })) {renderer.assetError('Maîtresse absente ou incompatible : repli procédural intégral');return false;}
    scene.masterActive=true;
    scene.masterConfig={...config,occlusion:[...mapData.buildings,...mapData.walls,...mapData.vegetation].filter(z=>z.silhouette).map(z=>({id:z.id,category:z.visualType,polygon:z.silhouette,ground:z.ground}))};
    scene.assetBuildingIds=mapData.buildings.map(b=>b.id);
    const scale=config.sceneUnitsPerPixel;
    for(const mood of ['day','dusk','night'])scene.textures.get(`master-${mood}`).setFilter(window.Phaser.Textures.FilterMode.LINEAR);
    function pair(x,y,frame,depth,mask=null){
        const base=scene.add.image(x,y,'master-day',frame).setOrigin(0,0).setScale(scale).setDepth(depth);
        const overlay=scene.add.image(x,y,'master-dusk',frame).setOrigin(0,0).setScale(scale).setDepth(depth+.01).setAlpha(0);
        if(mask){base.setMask(mask);overlay.setMask(mask);}
        scene.masterPairs.push({base,overlay,frame});scene.staticObjects.push(base,overlay);
    }
    // Adding occlusion frames changes Texture.firstFrame. Always name the full frame.
    pair(0,0,'__BASE',-100000);
    for(const zone of scene.masterConfig.occlusion){
        const maskGraphics=scene.make.graphics({x:0,y:0,add:false});
        maskGraphics.fillStyle(0xffffff).fillPoints(zone.polygon.map(p=>({x:p[0]*scale,y:p[1]*scale})),true);
        const mask=maskGraphics.createGeometryMask();scene.staticObjects.push(maskGraphics,{destroy:()=>mask.destroy()});
        const x0=Math.max(0,Math.floor(Math.min(...zone.polygon.map(p=>p[0])))), x1=Math.min(config.width,Math.ceil(Math.max(...zone.polygon.map(p=>p[0]))));
        const y0=Math.max(0,Math.floor(Math.min(...zone.polygon.map(p=>p[1])))), y1=Math.min(config.height,Math.ceil(Math.max(...zone.polygon.map(p=>p[1]))));
        for(let x=x0;x<x1;x+=8){
            const w=Math.min(8,x1-x),frame=`${zone.id}-${x}`;
            for(const mood of ['day','dusk','night']){const t=scene.textures.get(`master-${mood}`);if(!t.has(frame))t.add(frame,0,x,y0,w,y1-y0);}
            pair(x*scale,y0*scale,frame,masterGroundY(zone,x+w/2)*scale*100+5,mask);
        }
    }
    scene.bounds={x:0,y:0,width:config.width*scale,height:config.height*scale};
    scene.staticBuilt=true;drawMasterDebug(scene);syncMasters(scene);return true;
}
function drawMasterDebug(scene) {
    if(!scene.masterActive || !DEBUG || !scene.masterDebug)return;
    const g=scene.add.graphics().setDepth(1000000).setVisible(Boolean(DEBUG&&scene.masterDebug));scene.masterDebugGraphic=g;scene.staticObjects.push(g);
    const line=(points,color,closed=true)=>{g.lineStyle(.65,color,.9).strokePoints(points.map(p=>worldToIsometric(p)),closed);};
    for(const [key,color] of Object.entries({buildings:0xff6870,roads:0x6cebb8,walls:0xffc251,vegetation:0x38a858,obstacles:0xff8c42}))for(const q of mapData[key])line(q.polygon,color);
    for(const edge of mapData.navigation.connections)line([mapData.navigation.lookup.get(edge.from),mapData.navigation.lookup.get(edge.to)],0x5b88d0,false);
    for(const key of ['buildingEntries','entries','apartmentSites','salesPoints'])for(const p of mapData[key]){const q=worldToIsometric(p);g.fillStyle(key==='salesPoints'?0xffb700:0xfff7ca).fillCircle(q.x,q.y,2);}
    for(const p of mapData.navigation.nodes){const q=worldToIsometric(p);g.fillStyle(0x67a5ff).fillCircle(q.x,q.y,.5);}
    scene.masterPathGraphic=scene.add.graphics().setDepth(1000001);scene.staticObjects.push(scene.masterPathGraphic);
    scene.masterReasonText=scene.add.text(8,8,'',{fontSize:'11px',color:'#ffffff',backgroundColor:'#17242ddd',wordWrap:{width:300}}).setScrollFactor(0).setDepth(1000002);scene.staticObjects.push(scene.masterReasonText);
}
function masterOcclusionReasons(point,config) {
    const pixel=rasterPixel(point);
    return config.occlusion.filter(z=>pixel.y<masterGroundY(z,pixel.x)&&[0,7,14].some(h=>pointInPolygon({x:pixel.x,y:pixel.y-h},z.polygon.map(([x,y])=>({x,y}))))).map(z=>`${z.category}:${z.id}`);
}
function syncMasters(scene) {
    if(!scene.masterActive)return;
    const minute=TIME_CONFIG.openingMinute+(TIME_CONFIG.closingMinute-TIME_CONFIG.openingMinute)*Math.min(1,game.dayElapsed/game.dayDuration);
    const mood=masterMood(minute);
    // A masked copy is useful only where it can cover a dynamic sprite.
    // Else it draws exactly the same pixels as the full background underneath.
    const silhouettes=[];
    for(const visual of scene.visuals.values()){
        const sprite=visual.container;
        if(!sprite.visible)continue;
        silhouettes.push({left:sprite.x-Math.max(18*sprite.scaleX,4),right:sprite.x+Math.max(18*sprite.scaleX,4),top:sprite.y-24*sprite.scaleY,bottom:sprite.y+12*sprite.scaleY,depth:sprite.depth+2});
    }
    for(const pair of scene.masterPairs){
        if(pair.baseMood!==mood.base){pair.base.setTexture(`master-${mood.base}`,pair.frame);pair.baseMood=mood.base;}
        if(pair.nextMood!==mood.next){pair.overlay.setTexture(`master-${mood.next}`,pair.frame);pair.nextMood=mood.next;}
        pair.base.setTint(mood.tint);pair.overlay.setAlpha(mood.alpha);
        const visible=pair.frame==='__BASE' || silhouettes.some(s=>
            s.depth<pair.base.depth && s.right>=pair.base.x && s.left<=pair.base.x+pair.base.displayWidth &&
            s.bottom>=pair.base.y && s.top<=pair.base.y+pair.base.displayHeight);
        pair.base.setVisible(visible);pair.overlay.setVisible(visible);
    }
    scene.neighborhoodMood=mood;
    if(scene.masterPathGraphic){
        const visible=Boolean(DEBUG&&scene.masterDebug);scene.masterPathGraphic.setVisible(visible);scene.masterReasonText.setVisible(visible);
        if(visible){const g=scene.masterPathGraphic;g.clear();const reasons=[];
            for(const entity of createIsometricRenderState().entities){
                const source=entity.type==='player'?playerMapEntity:getIsometricEntityByKey(entity.key);
                const route=source?.navRoute||[];g.lineStyle(1,0xffdd66,.95).strokePoints([entity,...route].map(p=>worldToIsometric(p)),false);
                const why=masterOcclusionReasons(entity,scene.masterConfig);if(why.length)reasons.push(`${entity.key}: ${why.join(', ')}`);
            }
            scene.masterReasonText.setText(reasons.length?reasons.slice(0,6).join('\n'):'Occlusion : aucune entité masquée');
        }
    }
}
