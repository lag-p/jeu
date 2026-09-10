// Géométrie originale, schéma fonctionnel fourni pour le lot 2.6A.
// Unités cartésiennes de simulation ; aucune coordonnée DOM, Phaser ou GPS.
const DEFAULT_MAP_ID = "REFERENCE_QUARTER_V1";
const mapRect = (id, x, y, width, height, visualType, extra = {}) => ({
    id, x, y, width, height, visualType,
    polygon: [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }], ...extra
});
function createInspiredMap() {
    const buildings = [
        mapRect("BLOCK_NW", 26, 14, 6, 23, "facade", { visualHeight: 24 }),
        mapRect("BLOCK_N", 36, 9, 25, 6, "facade", { visualHeight: 22 }),
        mapRect("BLOCK_NE", 65, 17, 6, 20, "facade", { visualHeight: 26 }),
        mapRect("BLOCK_C", 59, 42, 7, 25, "facade", { visualHeight: 30 }),
        mapRect("BLOCK_SW", 26, 68, 6, 22, "facade", { visualHeight: 26 }),
        mapRect("BLOCK_SE", 49, 83, 23, 6, "facade", { visualHeight: 24 })
    ];
    const zones = [
        ["NORTH_COURT", 47, 27, "court"], ["SOUTH_COURT", 46, 75, "court"],
        ["WEST_EDGE", 22, 46, "alley"], ["EAST_EDGE", 77, 57, "alley"],
        ["CENTRAL_AXIS", 53, 52, "avenue"], ["NORTH_ACCESS", 30, 5, "entry"],
        ["SOUTH_ACCESS", 50, 95, "entry"], ["WEST_ACCESS", 21, 53, "entry"],
        ["EAST_ACCESS", 77, 22, "entry"], ["RESIDENTIAL_NW", 35, 21, "residential"],
        ["RESIDENTIAL_NE", 62, 26, "residential"], ["RESIDENTIAL_C", 56, 58, "residential"],
        ["RESIDENTIAL_SW", 35, 79, "residential"], ["RESIDENTIAL_SE", 61, 80, "residential"],
        ["PARKING_N", 57, 19, "parking"], ["PARKING_S", 65, 73, "parking"],
        ["SECONDARY_PASSAGE", 36, 60, "alley"]
    ].map(([id, x, y, type]) => ({ id, x, y, type, visualType: "ground", future: { footfall: null, visibility: null, policePressure: null, clientele: null, commercialCapacity: null, competition: null } }));
    const entries = [["ACCESS_N", 30, 3], ["ACCESS_NW", 22, 15], ["ACCESS_W", 19, 53], ["ACCESS_SW", 25, 92], ["ACCESS_S", 50, 97], ["ACCESS_E", 80, 22]]
        .map(([id, x, y]) => ({ id, x, y, visualType: "door", pedestrian: true, police: true }));
    const buildingEntries = [
        ["DOOR_NW_1", "BLOCK_NW", 33, 20], ["DOOR_NW_2", "BLOCK_NW", 33, 31],
        ["DOOR_N_1", "BLOCK_N", 41, 16], ["DOOR_N_2", "BLOCK_N", 55, 16],
        ["DOOR_NE_1", "BLOCK_NE", 64, 23], ["DOOR_NE_2", "BLOCK_NE", 64, 32],
        ["DOOR_C_1", "BLOCK_C", 58, 47], ["DOOR_C_2", "BLOCK_C", 58, 61],
        ["DOOR_SW_1", "BLOCK_SW", 33, 74], ["DOOR_SE_1", "BLOCK_SE", 60, 82]
    ].map(([id, buildingId, x, y]) => ({ id, buildingId, x, y, visualType: "door" }));
    const apartmentSites = buildingEntries.filter((_, i) => ![3, 5].includes(i)).map((entry, i) => ({
        id: `HOME_${entry.id}`, entryId: entry.id, buildingId: entry.buildingId, mapId: "PONCETTE_INSPIRED_V1",
        name: `Appartement ${i + 1}`, x: entry.x, y: entry.y, capacityBonus: i % 3 * 10, visualType: "door"
    }));
    const strategicSalesSites = ["NORTH_COURT", "SOUTH_COURT", "CENTRAL_AXIS", "WEST_EDGE", "PARKING_S", "EAST_ACCESS"].map((id, i) => {
        const zone = zones.find(zone => zone.id === id);
        return { id: `POST_${id}`, zoneId: id, x: zone.x, y: zone.y, traffic: i < 3 ? 1.2 : .8, visibility: i < 3 ? 1.1 : .6, accessibility: 1, capacity: i < 3 ? 4 : 3, importance: 1, visualType: "furniture" };
    });
    const roads = [
        mapRect("ROAD_N", 22, 4, 53, 4, "road"), mapRect("ROAD_W", 20, 8, 4, 84, "road"),
        mapRect("ROAD_E", 73, 8, 4, 84, "road"), mapRect("ROAD_CROSS_N", 24, 38, 49, 4, "road"),
        mapRect("ROAD_AXIS", 51, 42, 5, 41, "road"), mapRect("ROAD_S", 24, 91, 51, 4, "road"),
        mapRect("ROAD_SERVICE", 33, 68, 40, 4, "road")
    ];
    const walls = [mapRect("WALL_W1", 24, 59, 10, 1, "wall"), mapRect("WALL_W2", 38, 59, 10, 1, "wall"),
        mapRect("WALL_E1", 70, 43, 1, 3, "wall"), mapRect("WALL_E2", 70, 50, 1, 15, "wall")];
    const transitions = [
        mapRect("STAIR_W", 34, 57, 4, 5, "stairs", { from: { x: 36, y: 57 }, to: { x: 36, y: 62 }, altitudeFrom: 0, altitudeTo: 1 }),
        mapRect("RAMP_E", 68, 46, 5, 4, "ramp", { from: { x: 68, y: 48 }, to: { x: 73, y: 48 }, altitudeFrom: 0, altitudeTo: 1 })
    ];
    return {
        mapId: "PONCETTE_INSPIRED_V1", schemaVersion: 1, dimensions: { width: 100, height: 100, unit: "simulation" },
        perimeter: [[22, 2], [78, 2], [82, 16], [80, 92], [74, 98], [22, 98], [18, 92], [18, 8]].map(([x, y]) => ({ x, y })),
        buildings, roads, walls, transitions, entries, buildingEntries, apartmentSites, zones, strategicSalesSites,
        courts: [mapRect("COURT_N", 36, 22, 24, 13, "court"), mapRect("COURT_S", 36, 73, 14, 9, "court")],
        sidewalks: [mapRect("WALK_N", 33, 16, 31, 3, "sidewalk"), mapRect("WALK_AXIS", 56, 42, 2, 26, "sidewalk"), mapRect("WALK_SW", 33, 68, 2, 22, "sidewalk")],
        crossings: [mapRect("CROSS_N", 44, 38, 4, 4, "crossing"), mapRect("CROSS_S", 51, 75, 5, 3, "crossing"), mapRect("CROSS_W", 20, 51, 4, 4, "crossing")],
        openSpaces: [mapRect("OPEN_W", 28, 44, 20, 12, "ground")],
        parking: [mapRect("PARK_N", 52, 19, 10, 3, "parking"), mapRect("PARK_S", 59, 72, 12, 6, "parking")],
        vegetation: [mapRect("GROVE_N", 39, 29, 5, 4, "tree"), mapRect("GROVE_W", 27, 46, 3, 7, "tree"), mapRect("GROVE_S", 39, 76, 3, 4, "tree")],
        obstacles: [mapRect("FENCE_SW", 34, 86, 9, 1, "wall")],
        fallbackPoints: [{ id: "FALLBACK_W", x: 35, y: 54, visualType: "furniture" }],
        pointsOfInterest: [{ id: "MEETING_N", x: 46, y: 25, visualType: "furniture" }],
        logisticsPlaces: apartmentSites.map(site => ({ id: `STORE_${site.id}`, apartmentSiteId: site.id, x: site.x, y: site.y, visualType: "door" })),
        salesPoints: [], navigation: null, vehicleNavigation: { nodes: [], connections: [], implemented: false },
        render: { assetManifest: "assets/art-v1/manifest.json", style: "temporary-volumes", north: "negative-y" },
        altitude: { mode: "indicative", levels: [0, 1] }, sources: { geometry: "original-functional-brief", osmUsed: false }
    };
}

// Geometry and Blender share this checked-in source; no hidden historical map.
function createReferenceMap() {
    const spec = JSON.parse(JSON.stringify(NEIGHBORHOOD_SPEC));
    const apartmentSites = spec.buildingEntries.map((entry, i) => ({
        id: `HOME_${entry.id}`, entryId: entry.id, buildingId: entry.buildingId, mapId: spec.mapId,
        name: `Appartement ${i + 1}`, x: entry.x, y: entry.y, capacityBonus: i % 3 * 10, visualType: 'door'
    }));
    const strategicSalesSites = spec.zones.map((zone, i) => ({
        id: `POST_${zone.id}`, zoneId: zone.id, x: zone.x, y: zone.y, traffic: i < 3 ? 1.2 : .8,
        visibility: i < 3 ? 1.1 : .6, accessibility: 1, capacity: i < 3 ? 4 : 3, importance: 1, visualType: 'furniture'
    }));
    return { ...spec, apartmentSites, strategicSalesSites,
        logisticsPlaces: apartmentSites.map(site => ({ id: `STORE_${site.id}`, apartmentSiteId: site.id, x: site.x, y: site.y, visualType: 'door' })),
        salesPoints: [], navigation: null, vehicleNavigation: { nodes: [], connections: [], implemented: false },
        render: { assetManifest: 'assets/art-v2/manifest.json', style: 'blender-neighborhood', north: 'negative-y' },
        altitude: { mode: 'visual-2d-navigation', levels: [0, 1, 2, 3] },
        sources: { geometry: 'local-reference-reconstruction', osmUsed: false }
    };
}
