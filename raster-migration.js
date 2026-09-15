// One-time v5 REFERENCE -> v6 RASTER migration, on the validated detached snapshot.
// Landmark correspondence is used only here. Normal movement never uses it.
function migrateRasterSnapshot(snapshot) {
    const old=createReferenceMap(),next=createRasterMap();
    const anchors=old.buildings.map(b=>{
        const target=next.buildings.find(n=>n.id===b.id);
        return {from:{x:b.x+b.width/2,y:b.y+b.height/2},to:{x:target.polygon.reduce((v,p)=>v+p.x,0)/4,y:target.polygon.reduce((v,p)=>v+p.y,0)/4}};
    });
    const candidates=[];
    for(const c of next.corridors)for(let i=1;i<c.points.length;i++){
        const a=c.points[i-1],b=c.points[i],n=Math.ceil(rasterDistance(a,b)/12);
        for(let j=0;j<=n;j++)candidates.push({x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n});
    }
    const project=p=>{
        const ranked=anchors.map(a=>({...a,d:Math.hypot(a.from.x-p.x,a.from.y-p.y)})).sort((a,b)=>a.d-b.d).slice(0,3);
        let x=0,y=0,w=0;
        for(const a of ranked){const v=1/(a.d*a.d+1);x+=(a.to.x+p.x-a.from.x)*v;y+=(a.to.y+p.y-a.from.y)*v;w+=v;}
        const guess={x:x/w,y:y/w};
        return candidates.reduce((a,b)=>rasterDistance(guess,b)<rasterDistance(guess,a)?b:a);
    };
    const visit=o=>{
        if(!o||typeof o!=='object')return;
        for(const [x,y] of [['x','y'],['playerX','playerY'],['targetX','targetY']])if(Number.isFinite(o[x])&&Number.isFinite(o[y])){const p=project({x:o[x],y:o[y]});o[x]=p.x;o[y]=p.y;}
        for(const [key,value] of Object.entries(o))if(!['navRoute','navKey','route'].includes(key))visit(value);
        delete o.navRoute;delete o.navKey;delete o.route;
    };
    const zoneIds=new Map(old.zones.map((z,i)=>[z.id,next.zones.find(n=>n.id===z.id)?.id||next.zones[i%next.zones.length].id]));
    visit(snapshot.game);visit(snapshot.customers);visit(snapshot.police);visit(snapshot.map.salesPoints);
    for(const apartment of snapshot.game.apartments){
        const previous=old.apartmentSites.find(s=>s.id===apartment.siteId);
        const site=next.apartmentSites.find(s=>s.buildingId===previous?.buildingId);
        apartment.mapId=RASTER_MAP_ID;
        if(site){apartment.siteId=site.id;apartment.x=site.x;apartment.y=site.y;}else apartment.siteId=null;
    }
    if(snapshot.game.personalFallback)snapshot.game.personalFallback.mapId=RASTER_MAP_ID;
    // Keep zone pressure instead of resetting it at migration. IDs are remapped
    // for patrol history/operations; resources and mission stages are untouched.
    for(const z of snapshot.map.zones){const target=next.zones.find(n=>n.id===zoneIds.get(z.id));if(target)for(const k of ['suspicion','policeAttention'])if(Number.isFinite(z[k]))target[k]=Math.max(target[k]||0,z[k]);}
    const remap=o=>{if(!o||typeof o!=='object')return;for(const [k,v] of Object.entries(o)){if(['targetZoneIds','zonesTraversed'].includes(k)&&Array.isArray(v))o[k]=[...new Set(v.map(id=>zoneIds.get(id)||id))];else if(k==='zoneId'&&zoneIds.has(v))o[k]=zoneIds.get(v);else remap(v);}};
    remap(snapshot.game);remap(snapshot.customers);remap(snapshot.police);
    const knowledge={};for(const [id,value] of Object.entries(snapshot.police.zoneKnowledge||{})){const key=zoneIds.get(id)||id;knowledge[key]=Math.max(knowledge[key]||0,value);}snapshot.police.zoneKnowledge=knowledge;
    snapshot.map={...snapshot.map,mapId:RASTER_MAP_ID,schemaVersion:2,zones:next.zones,migratedFrom:'REFERENCE_QUARTER_V1/v5'};
}

// v6 raster saves used the cropped 853x1844 master. Translate on a detached
// snapshot, once, before validating against the expanded map's fixed places.
function migrateExpandedRasterSnapshot(snapshot) {
    if(snapshot.map?.mapId!==RASTER_MAP_ID || snapshot.map.schemaVersion!==1)return;
    const visit=o=>{
        if(!o||typeof o!=='object')return;
        for(const [x,y] of [['x','y'],['playerX','playerY'],['targetX','targetY']]){
            if(Number.isFinite(o[x])&&Number.isFinite(o[y])){
                const p=rasterPoint(o[x]*8.53,o[y]*18.44);o[x]=p.x;o[y]=p.y;
            }
        }
        for(const [key,value] of Object.entries(o))if(!['navRoute','navKey','route'].includes(key))visit(value);
        delete o.navRoute;delete o.navKey;delete o.route;
    };
    visit(snapshot.game);visit(snapshot.customers);visit(snapshot.police);visit(snapshot.map.salesPoints);visit(snapshot.map.zones);
    // Canonical fixed coordinates avoid rejecting a valid zone for a final-bit
    // floating-point difference after multiply/divide. Larger changes still fail.
    const definition=createRasterMap();
    for(const zone of snapshot.map.zones||[]){const site=definition.zones.find(p=>p.id===zone.id);
        if(site&&Math.abs(site.x-zone.x)<1e-10&&Math.abs(site.y-zone.y)<1e-10){zone.x=site.x;zone.y=site.y;}}
    snapshot.map.schemaVersion=2;
    snapshot.map.migratedFrom='RASTER_QUARTER_V1/v6';
}
