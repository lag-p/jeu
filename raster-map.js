// Lot 2.6C.1. Surveyed directly in master pixels; no Blender topology is used.
const RASTER_MAP_ID = 'RASTER_QUARTER_V1';
const RASTER_SIZE = Object.freeze({width:909,height:1536,scale:1844/1536*.5});
const RASTER_ALIGNMENT = Object.freeze({scale:1536/1844,dx:120,dy:-2});
const expandedPoint = (x,y) => ({x:x/RASTER_SIZE.width*100,y:y/RASTER_SIZE.height*100});
// Survey coordinates remain in the old master, with one explicit translation.
const rasterPoint = (x,y) => expandedPoint((x+RASTER_ALIGNMENT.dx)*RASTER_ALIGNMENT.scale,(y+RASTER_ALIGNMENT.dy)*RASTER_ALIGNMENT.scale);
const rasterPixel = p => ({x:p.x*RASTER_SIZE.width/100,y:p.y*RASTER_SIZE.height/100});
const isRasterMap = () => mapData.mapId === RASTER_MAP_ID;
function rasterShape(id, pixels, visualType, extra={}) {
    const polygon=pixels.map(p=>rasterPoint(...p)),xs=polygon.map(p=>p.x),ys=polygon.map(p=>p.y);
    return {id,polygon,x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys),visualType,...extra};
}
function createRasterMap() {
    const buildings=[
        ['NORTH_W',[[450,390],[504,410],[152,580],[98,550]],[[450,274],[504,301],[504,410],[152,580],[98,550],[98,443]]],
        ['NORTH_E',[[675,425],[930,545],[878,577],[618,453]],[[675,305],[930,425],[930,545],[878,577],[618,453],[618,333]]],
        ['CENTRAL',[[658,620],[720,650],[204,920],[142,890]],[[658,500],[720,530],[720,650],[204,920],[142,890],[142,770]]],
        ['EAST_REAR',[[840,645],[930,695],[880,730],[786,685]],[[840,523],[930,573],[930,695],[880,730],[786,685],[786,563]]],
        ['SOUTH_W',[[110,1045],[306,1333],[251,1363],[57,1073]],[[110,925],[306,1213],[306,1333],[251,1363],[57,1073],[57,953]]],
        ['SOUTH_E',[[644,965],[986,1137],[934,1167],[592,995]],[[644,845],[986,1017],[986,1137],[934,1167],[592,995],[592,875]]],
        ['FRONT_E',[[1000,1260],[1052,1290],[714,1470],[661,1438]],[[1000,1140],[1052,1170],[1052,1290],[714,1470],[661,1438],[661,1318]]]
    ].map(([id,foot,silhouette])=>rasterShape(id,foot,'facade',{silhouette,ground:[foot[1],foot[2],foot[3]],label:'Résidence',visualHeight:20}));
    // Every junction is explicit. Narrow segments are stairs/doorways, never an
    // automatic straight shortcut across the image. Widths are clear pedestrian space.
    const lines=[
        ['north-road','roads',18,[[40,178],[105,255],[175,320],[300,260],[440,200]]],
        ['west-north','roads',18,[[175,320],[85,362],[25,400],[22,470],[20,535],[25,590],[10,620],[15,670],[85,750],[95,850],[130,940],[205,962]]],
        ['north-front','sidewalks',10,[[25,590],[160,599],[270,548],[380,492],[515,431],[570,455],[610,491],[760,568],[840,590]]],
        ['court-access','transitions',9,[[270,548],[287,566],[300,608]]],
        ['court-north','courts',12,[[300,608],[375,584],[460,540],[550,510],[610,491]]],
        ['court-west','courts',10,[[300,608],[244,639],[186,669],[125,629],[25,590]]],
        ['central-axis','roads',18,[[205,962],[360,878],[520,790],[685,705],[760,674],[840,620],[840,590]]],
        ['central-west','sidewalks',10,[[125,629],[135,721],[113,786],[112,877],[130,940]]],
        ['west-parking','parking',8,[[15,670],[52,690],[82,713],[85,750]]],
        ['main-south','roads',18,[[205,962],[180,1008],[258,1105],[365,1235],[505,1385],[640,1518]]],
        ['west-south','roads',16,[[130,940],[35,1000],[24,1090],[64,1200],[135,1310],[180,1350],[300,1420],[475,1512],[640,1580],[825,1468]]],
        ['front-link','roads',16,[[640,1518],[640,1580]]],
        ['south-court-entry','transitions',8,[[360,878],[367,951]]],
        ['south-court','courts',10,[[367,951],[437,976],[514,1014],[560,1048],[638,1087],[715,1128]]],
        ['south-court-west','sidewalks',9,[[367,951],[370,980],[330,1000],[300,1020],[355,1070],[430,1112],[491,1083],[560,1048]]],
        ['south-passage','transitions',9,[[258,1105],[355,1070]]],
        ['south-parking','parking',9,[[715,1128],[734,1170],[790,1210],[824,1250],[812,1320],[775,1370]]],
        ['parking-passage','sidewalks',8,[[715,1128],[663,1183],[610,1230],[554,1264],[505,1385]]],
        ['front-stairs','transitions',12,[[300,1420],[358,1490],[324,1552],[215,1510],[45,1444]]],
        ['outside-south','roads',16,[[324,1552],[465,1619],[610,1704],[798,1800]]]
    ];
    // Native-pixel survey of the visible outer sidewalk. Keep existing business
    // anchors, but remove the old interpolated path through the western gardens.
    const oldPixel = ([x,y]) => [x/RASTER_ALIGNMENT.scale-RASTER_ALIGNMENT.dx,y/RASTER_ALIGNMENT.scale-RASTER_ALIGNMENT.dy];
    const west = lines.find(l=>l[0]==='west-north');
    west[1]='sidewalks'; west[2]=8;
    west[3]=[[175,320],[85,362],[25,400],...[[91,365],[62,409],[44,444],[75,502]].map(oldPixel),[25,590],[10,620],[15,670],[85,750],[95,850],[130,940],[205,962]];
    lines.push(['north-extension','sidewalks',8,[[0,75],[65,112],[116,153]].map(oldPixel).concat([[40,178]])],
        ['west-extension','sidewalks',8,[[0,430],[25,439],[44,444]].map(oldPixel)]);
    // Surveyed sidewalk along the southern foot of CENTRAL and east of the
    // main downhill road. Junctions are explicit crossing points, not shortcuts.
    const axis=[[205,962],[360,878],[520,790],[685,705],[760,674],[840,620],[840,590]];
    const south=[[205,962],[180,1008],[258,1105],[365,1235],[505,1385],[640,1518]];
    const axisWalk=axis.map(([x,y],i)=>i===0||i===axis.length-1?[x,y]:[x,y-23]);
    const southWalk=south.map(([x,y],i)=>i===0||i===south.length-1?[x,y]:[x+24,y-12]);
    lines.push(['central-sidewalk','sidewalks',9,axisWalk],['south-sidewalk','sidewalks',9,southWalk]);
    for(const [name,road,walk] of [['axis',axis,axisWalk],['south',south,southWalk]])
        for(let i=1;i<road.length-1;i++)lines.push([`${name}-crossing-${i}`,'crossings',8,[road[i],walk[i]]]);
    const corridors=lines.map(([id,category,width,points])=>({id,category,width,points:points.map(p=>rasterPoint(...p))}));
    const geometry={roads:[],sidewalks:[],courts:[],transitions:[],parking:[],crossings:[]};
    for(const [id,category,width,points] of lines) for(let i=1;i<points.length;i++) {
        const a=points[i-1],b=points[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]),x=-(b[1]-a[1])/d*width/2,y=(b[0]-a[0])/d*width/2;
        geometry[category].push(rasterShape(`${id}-${i}`,[[a[0]+x,a[1]+y],[b[0]+x,b[1]+y],[b[0]-x,b[1]-y],[a[0]-x,a[1]-y]],category==='transitions'?'stairs':category,{from:rasterPoint(...a),to:rasterPoint(...b)}));
    }
    const walls=[
        rasterShape('COURT_N_WALL',[[305,558],[546,445],[546,453],[305,566]],'wall',{silhouette:[[305,528],[546,415],[546,453],[305,566]],ground:[[305,566],[546,453]]}),
        rasterShape('COURT_S_WALL_W',[[290,995],[350,965],[350,973],[290,1003]],'wall',{silhouette:[[290,954],[350,924],[350,973],[290,1003]],ground:[[290,1003],[350,973]]}),
        rasterShape('COURT_S_WALL_E',[[384,949],[584,846],[584,854],[384,957]],'wall',{silhouette:[[384,907],[584,804],[584,854],[384,957]],ground:[[384,957],[584,854]]}),
        rasterShape('FRONT_WALL_W',[[20,1390],[302,1505],[302,1513],[20,1398]],'wall',{silhouette:[[20,1320],[302,1435],[302,1513],[20,1398]],ground:[[20,1398],[302,1513]]}),
        rasterShape('FRONT_WALL_E',[[384,1540],[603,1650],[603,1658],[384,1548]],'wall',{silhouette:[[384,1485],[603,1595],[603,1658],[384,1548]],ground:[[384,1548],[603,1658]]})
    ];
    const vegetation=[
        rasterShape('TREE_COURT_N',[[489,588],[497,588],[497,596],[489,596]],'tree',{silhouette:[[445,480],[470,451],[505,464],[548,494],[557,526],[539,549],[504,557],[466,535]],ground:[[445,596],[557,596]]}),
        rasterShape('TREE_COURT_S',[[504,1080],[512,1080],[512,1088],[504,1088]],'tree',{silhouette:[[475,1002],[501,976],[538,991],[557,1025],[539,1055],[501,1061],[472,1040]],ground:[[472,1088],[557,1088]]}),
        rasterShape('TREE_FRONT',[[443,1435],[451,1435],[451,1443],[443,1443]],'tree',{silhouette:[[392,1315],[435,1281],[474,1298],[498,1345],[485,1380],[449,1398],[402,1367]],ground:[[392,1443],[498,1443]]})
    ];
    const obstacles=[['CAR_PARK_W',[[35,628],[58,641],[47,659],[25,647]]],['CAR_PARK_S',[[571,1151],[604,1169],[586,1197],[551,1179]]],['CAR_FRONT',[[311,1359],[344,1375],[330,1403],[294,1382]]]].map(([id,p])=>rasterShape(id,p,'parkedVehicle'));
    const entryPixels=[['ACCESS_N',40,178],['ACCESS_NE',440,200],['ACCESS_W',25,400],['ACCESS_E',840,590],['ACCESS_S',798,1800],['ACCESS_SW',45,1444]];
    const entries=entryPixels.map(([id,x,y])=>({id,...rasterPoint(x,y),pedestrian:true,police:true,visualType:'door'}));
    const doors=[['NORTH_W',270,548],['NORTH_E',760,568],['CENTRAL',360,878],['EAST_REAR',760,674],['SOUTH_W',300,1420],['SOUTH_E',715,1128],['FRONT_E',825,1468]];
    const buildingEntries=doors.map(([buildingId,x,y])=>({id:`DOOR_${buildingId}`,buildingId,...rasterPoint(x,y),visualType:'door'}));
    const apartmentSites=buildingEntries.map((p,i)=>({...p,id:`HOME_${p.id}`,entryId:p.id,mapId:RASTER_MAP_ID,name:`Appartement ${i+1}`,capacityBonus:i%3*10}));
    const zones=[['NORTH_COURT',375,584,'court'],['SOUTH_COURT',437,976,'court'],['CENTRAL_AXIS',520,790,'avenue'],['WEST_ACCESS',85,362,'entry'],['PARKING_N',52,690,'parking'],['PARKING_S',734,1170,'parking'],['SOUTH_ACCESS',640,1580,'entry']].map(([id,x,y,type])=>({id,...rasterPoint(x,y),type}));
    const strategicSalesSites=zones.map((z,i)=>({...z,id:`POST_${z.id}`,zoneId:z.id,traffic:i<3?1.2:.8,visibility:i<3?1.1:.6,accessibility:1,capacity:i<3?4:3,importance:1,visualType:'furniture'}));
    for(const shape of [...buildings,...walls,...vegetation])for(const key of ['silhouette','ground'])shape[key]=shape[key].map(([x,y])=>[(x+RASTER_ALIGNMENT.dx)*RASTER_ALIGNMENT.scale,(y+RASTER_ALIGNMENT.dy)*RASTER_ALIGNMENT.scale]);
    return {mapId:RASTER_MAP_ID,schemaVersion:2,dimensions:{width:100,height:100,unit:'normalized-master'},perimeter:[expandedPoint(0,0),expandedPoint(909,0),expandedPoint(909,1536),expandedPoint(0,1536)],
        buildings,...geometry,walls,vegetation,obstacles,corridors,entries,buildingEntries,apartmentSites,zones,strategicSalesSites,
        openSpaces:[],fallbackPoints:[{id:'FALLBACK_RASTER',...rasterPoint(205,962),visualType:'furniture'}],
        pointsOfInterest:zones.slice(0,2).map(z=>({...z,id:`SUPERVISION_${z.id}`,visualType:'furniture'})),
        logisticsPlaces:apartmentSites.map(s=>({...s,id:`STORE_${s.id}`,apartmentSiteId:s.id})),salesPoints:[],navigation:null,
        render:{style:'raster',assetManifest:'assets/art-v2/masters/manifest.json'},altitude:{mode:'explicit-passages',levels:[0,1]},sources:{geometry:'master-pixel-survey-v1',osmUsed:false},vehicleNavigation:{nodes:[],connections:[],implemented:false}};
}
function rasterDistance(a,b) { return Math.hypot((a.x-b.x)*RASTER_SIZE.width/100,(a.y-b.y)*RASTER_SIZE.height/100)/RASTER_ALIGNMENT.scale; }
function rasterSegmentDistance(p,a,b) {
    const q=rasterPixel(p),u=rasterPixel(a),v=rasterPixel(b),dx=v.x-u.x,dy=v.y-u.y;
    const t=Math.max(0,Math.min(1,((q.x-u.x)*dx+(q.y-u.y)*dy)/(dx*dx+dy*dy||1)));
    return Math.hypot(q.x-u.x-t*dx,q.y-u.y-t*dy)/RASTER_ALIGNMENT.scale;
}
function rasterOnCorridor(p,definition=mapData) {
    return definition.corridors.some(c=>c.points.some((a,i)=>i&&rasterSegmentDistance(p,c.points[i-1],a)<=c.width/2+1e-7));
}
const PEDESTRIAN_COSTS=Object.freeze({sidewalks:1,paths:1.05,courts:1.2,parking:1.3,transitions:1.1,crossings:1.15,grass:3,roads:12,solid:Infinity});
function rasterTerrain(p,definition=mapData) {
    let category='solid',cost=Infinity;
    for(const c of definition.corridors)if(PEDESTRIAN_COSTS[c.category]<cost&&c.points.some((a,i)=>i&&rasterSegmentDistance(p,c.points[i-1],a)<=c.width/2+1e-7)){
        category=c.category;cost=PEDESTRIAN_COSTS[category];
    }
    return {category,cost};
}
function rasterTravelCost(a,b) {
    const distance=rasterDistance(a,b),steps=Math.max(1,Math.ceil(distance/4));let cost=0;
    for(let i=0;i<steps;i++){const t=(i+.5)/steps;cost+=rasterTerrain({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}).cost;}
    return distance*cost/steps;
}
function buildRasterNavigation() {
    const nodes=[],lookup=new Map(),key=p=>`${p.x.toFixed(6)},${p.y.toFixed(6)}`;
    const add=p=>{const id=key(p);if(!lookup.has(id)){const n={id,x:p.x,y:p.y,edges:[]};nodes.push(n);lookup.set(id,n);}return lookup.get(id);};
    for(const c of mapData.corridors)for(let i=1;i<c.points.length;i++){
        const a=c.points[i-1],b=c.points[i],steps=Math.ceil(rasterDistance(a,b)/12);let prev=add(a);
        for(let j=1;j<=steps;j++){const n=add({x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps});
            if(!walkableSegment(prev,n))throw new Error(`Raster corridor blocked: ${c.id} ${i} ${j}`);
            if(!prev.edges.includes(n.id))prev.edges.push(n.id);if(!n.edges.includes(prev.id))n.edges.push(prev.id);prev=n;}
    }
    for(const node of nodes){node.terrain=rasterTerrain(node).category;node.costs={};for(const id of node.edges)node.costs[id]=rasterTravelCost(node,lookup.get(id));}
    return {nodes,lookup,connections:nodes.flatMap(n=>n.edges.filter(id=>n.id<id).map(id=>({from:n.id,to:id,distance:rasterDistance(n,lookup.get(id)),cost:n.costs[id]})))};
}
