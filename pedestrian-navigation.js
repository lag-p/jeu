// Deterministic weighted A*. No simulation state changes during search.
// Crossing metadata is the future interface for a vehicle-aware admission rule.
const walkingMotion=new WeakMap();
function recordWalkingMotion(entity,a,b,distance) {
    if(distance<=1e-10)return;
    const old=walkingMotion.get(entity),p=rasterPixel(a),q=rasterPixel(b);
    walkingMotion.set(entity,{dx:q.x-p.x,dy:q.y-p.y,distance:(old?.distance||0)+distance*8.53});
}
function pedestrianCrossingContext(a,b) {
    if(!isRasterMap())return null;
    const terrain=rasterTerrain({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
    return terrain.category==='crossings'?{category:'crossings',requiresVehicleCheck:true}:null;
}
function findRasterPath(start,goal) {
    if(!isWalkable(start)||!isWalkable(goal))return [];
    if(rasterDistance(start,goal)<1e-8)return [{x:goal.x,y:goal.y}];
    const {nodes,lookup}=mapData.navigation;
    // Connect to nearby alternatives on both sides of a road. A single nearest
    // node can force a long asphalt detour even when a sidewalk is reachable.
    const connectors=p=>{
        const ranked=nodes.map(n=>({n,d:rasterDistance(p,n)})).sort((a,b)=>a.d-b.d||a.n.id.localeCompare(b.n.id));
        const result=[];
        for(const {n,d} of ranked){
            if(result.length&&(d>64||result.length>=12))break;
            if(walkableSegment(p,n))result.push(n);
        }
        return result;
    };
    const first=connectors(start),last=connectors(goal),goals=new Map(last.map(n=>[n.id,rasterTravelCost(n,goal)]));
    const open=new Set(),cost=new Map(),previous=new Map();
    for(const n of first){open.add(n.id);cost.set(n.id,rasterTravelCost(start,n));}
    let best=walkableSegment(start,goal)?rasterTravelCost(start,goal):Infinity,end=null;
    while(open.size){
        let id=null,score=Infinity;
        for(const key of open){const value=cost.get(key)+rasterDistance(lookup.get(key),goal);if(value<score||value===score&&(id===null||key.localeCompare(id)<0)){id=key;score=value;}}
        if(score>=best-1e-8)break;
        open.delete(id);
        if(goals.has(id)&&cost.get(id)+goals.get(id)<best){best=cost.get(id)+goals.get(id);end=id;}
        const node=lookup.get(id);
        for(const neighbor of node.edges){
            const next=lookup.get(neighbor);
            if(!walkableSegment(node,next))continue;
            const value=cost.get(id)+node.costs[neighbor];
            if(value<(cost.get(neighbor)??Infinity)){cost.set(neighbor,value);previous.set(neighbor,id);open.add(neighbor);}
        }
    }
    if(!Number.isFinite(best))return [];
    const route=[{x:goal.x,y:goal.y}];
    for(let cursor=end;cursor;cursor=previous.get(cursor)){const n=lookup.get(cursor);route.unshift({x:n.x,y:n.y});}
    return route;
}
