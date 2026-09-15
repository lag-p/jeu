// Future vehicle topology, held by the renderer only. No traffic or save state.
function validateVehicleNetwork(network, definition = mapData) {
    if (network?.version !== 2 || network.mapId !== RASTER_MAP_ID ||
        network.coordinateSystem !== 'native-master-pixels' || !Array.isArray(network.nodes) ||
        !network.nodes.length || !Array.isArray(network.connections) || !Array.isArray(network.exits) ||
        !Array.isArray(network.terminals)) return false;
    const nodes = new Map(), adjacency = new Map(), edges = new Set();
    for (const n of network.nodes) {
        if (typeof n.id !== 'string' || nodes.has(n.id) || !Number.isFinite(n.x) || !Number.isFinite(n.y) ||
            n.x < 0 || n.x > RASTER_SIZE.width || n.y < 0 || n.y > RASTER_SIZE.height) return false;
        nodes.set(n.id, n); adjacency.set(n.id, new Set());
    }
    const solids = [...definition.buildings, ...definition.walls, ...definition.obstacles, ...definition.vegetation];
    for (const e of network.connections) {
        if (!nodes.has(e.fromNode) || !nodes.has(e.toNode) || e.fromNode === e.toNode ||
            !['street', 'parking-access'].includes(e.type) || !['both', 'forward'].includes(e.direction)) return false;
        const key = [e.fromNode, e.toNode].sort().join('|');
        if (edges.has(key)) return false;
        edges.add(key);
        const a = nodes.get(e.fromNode), b = nodes.get(e.toNode);
        const p = expandedPoint(a.x, a.y), q = expandedPoint(b.x, b.y);
        if (solids.some(s => pointInPolygon(p, s.polygon) || pointInPolygon(q, s.polygon) ||
            s.polygon.some((v, i) => segmentsIntersect(p, q, v, s.polygon[(i + 1) % s.polygon.length])))) return false;
        adjacency.get(e.fromNode).add(e.toNode); adjacency.get(e.toNode).add(e.fromNode);
    }
    const ends = new Set([...network.exits, ...network.terminals.map(t => t.node)]);
    if ([...ends].some(id => !nodes.has(id)) || network.terminals.some(t => !t.reason)) return false;
    if (network.exits.some(id => { const n = nodes.get(id); return n.x !== 0 && n.y !== 0 && n.x !== RASTER_SIZE.width && n.y !== RASTER_SIZE.height; })) return false;
    if ([...adjacency].some(([id, neighbors]) => !neighbors.size || neighbors.size === 1 && !ends.has(id))) return false;
    const visited = new Set(), queue = [network.nodes[0].id];
    while (queue.length) { const id = queue.pop(); if (visited.has(id)) continue; visited.add(id); queue.push(...adjacency.get(id)); }
    return visited.size === nodes.size;
}

function drawVehicleDebug(scene) {
    scene.vehicleDebugGraphic?.destroy(); scene.vehicleDebugGraphic = null;
    if (!DEBUG || !scene.masterActive || !scene.vehicleDebug) return;
    const network = scene.cache.json.get('vehicle-network');
    if (!validateVehicleNetwork(network)) return;
    const g = scene.add.graphics().setDepth(1000010), nodes = new Map(network.nodes.map(n => [n.id, n]));
    scene.vehicleDebugGraphic = g; scene.staticObjects.push(g);
    for (const e of network.connections) {
        g.lineStyle(1.5, e.type === 'parking-access' ? 0xffb84d : 0x00eaff, .95);
        const points = [nodes.get(e.fromNode), nodes.get(e.toNode)].map(n => worldToIsometric(expandedPoint(n.x, n.y)));
        g.strokePoints(points, false);
    }
    for (const n of network.nodes) {
        const p = worldToIsometric(expandedPoint(n.x, n.y));
        g.fillStyle(network.exits.includes(n.id) ? 0xffdd00 : 0xffffff).fillCircle(p.x, p.y, 1.8);
    }
}
