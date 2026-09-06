// Paramètres de simulation ; mettre DEBUG à true uniquement pour les essais.
const DEBUG = false;
const GAME_CONFIG = Object.freeze({ startingMoney: 100, startingProductStock: 10, dayDuration: 180, maxFrameSeconds: .1, autosaveSeconds: 30, zoomMin: .75, zoomMax: 2.5 });
const EMPLOYEE_CONFIG = Object.freeze({ xpPerLevel: 20, maxLevel: 5, courierCapacity: Object.freeze([15, 18, 22, 26, 30]), sellerCapacity: 18, salaryLevelBonus: .12, managerBaseCapacity: 3, managerLevelCapacity: 2 });
const LOGISTICS_CONFIG = Object.freeze({ lowStock: 5, maxSellerCash: 150, forecastSeconds: 45, slowTarget: 18, mediumTarget: 24, fastTarget: 30, creationSeconds: .5, loadingSeconds: .8, deliverySeconds: .7, collectionSeconds: .5, depositSeconds: .4 });
const POLICE_CONFIG = Object.freeze({ knowledgeThresholds: Object.freeze([15, 35, 55, 75]), alertSeconds: 12, transmissionSeconds: 1.5, patrolLifetime: 55, preparingSeconds: 7, activeSeconds: 13, endingSeconds: 4, operationSuspicion: 45 });
const CUSTOMER_CONFIG = Object.freeze({ reputationStart: 65, loyaltyLimit: 100, returnChance: .3, minimumSpawnMs: 1000, serviceVisualSeconds: .35 });
