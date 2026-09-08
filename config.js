// Paramètres de simulation ; mettre DEBUG à true uniquement pour les essais.
const DEBUG = false;
const GAME_CONFIG = Object.freeze({ startingMoney: 100, startingProductStock: 10, dayDuration: 720, maxFrameSeconds: .1, autosaveSeconds: 30, zoomMin: .75, zoomMax: 2.5 });
const EMPLOYEE_CONFIG = Object.freeze({ xpPerLevel: 20, maxLevel: 5, courierCapacity: Object.freeze([15, 18, 22, 26, 30]), sellerCapacity: 18, salaryLevelBonus: .12, managerBaseCapacity: 3, managerLevelCapacity: 2 });
const LOGISTICS_CONFIG = Object.freeze({ lowStock: 5, maxSellerCash: 150, forecastSeconds: 45, slowTarget: 18, mediumTarget: 24, fastTarget: 30, creationSeconds: .5, loadingSeconds: .8, deliverySeconds: .7, collectionSeconds: .5, depositSeconds: .4 });
const POLICE_CONFIG = Object.freeze({ knowledgeThresholds: Object.freeze([15, 35, 55, 75]), alertSeconds: 12, transmissionSeconds: 1.5, patrolLifetime: 55, preparingSeconds: 7, activeSeconds: 13, endingSeconds: 4, operationSuspicion: 45 });
const CUSTOMER_CONFIG = Object.freeze({ reputationStart: 65, loyaltyLimit: 100, returnChance: .3, minimumSpawnMs: 1000, serviceVisualSeconds: .35 });

const DAY_PHASE = Object.freeze({ PREPARATION: "PREPARATION", ACTIVITE: "ACTIVITE", REPLI: "REPLI", BILAN: "BILAN" });
const TIME_CONFIG = Object.freeze({ openingMinute: 12 * 60, closingMinute: 24 * 60, speeds: Object.freeze([1, 2]), stepSeconds: .1 });
// Etat métier indépendant du DOM. Le rendu actuel et un futur renderer Phaser
// lisent les mêmes coordonnées et états sans faire avancer la simulation.
const EMPLOYEE_OPERATION = Object.freeze({
    RESTING: "RESTING", PREPARING: "PREPARING", OUTBOUND: "OUTBOUND", AT_POST: "AT_POST",
    MISSION: "MISSION", RETREAT_ORDERED: "RETREAT_ORDERED", RETURNING: "RETURNING",
    DEPOSITING: "DEPOSITING", DONE: "DONE", BLOCKED: "BLOCKED"
});
const EMPLOYEE_PHYSICAL_CONFIG = Object.freeze({ fallbackCapacity: 24, fallbackInventoryCapacity: 24, fallbackMaxComplexRoles: 2, depositSeconds: .35, stuckSeconds: 12, recoverySeconds: 30, managerBonus: .12, managerRadius: 18 });
