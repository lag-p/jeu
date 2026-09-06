// Configuration économique unique. Les achats, ventes et commandes y puisent
// leurs valeurs afin d'éviter les prix divergents entre systèmes.
const PRODUCT_CONFIG = Object.freeze({
    "Produit A": Object.freeze({ purchasePrice: 5, salePrice: 12, demandWeight: 50 }),
    "Produit B": Object.freeze({ purchasePrice: 10, salePrice: 24, demandWeight: 30 }),
    "Produit C": Object.freeze({ purchasePrice: 20, salePrice: 48, demandWeight: 20 })
});

const CUSTOMER_PROFILES = Object.freeze({
    "nouveau": Object.freeze({ weight: 45, quantityWeights: [40, 35, 18, 6, 1], budgetFactor: [0.88, 1.15], patience: [10, 18], knowsSeller: 0.05 }),
    "occasionnel": Object.freeze({ weight: 35, quantityWeights: [20, 35, 27, 13, 5], budgetFactor: [0.95, 1.25], patience: [16, 26], knowsSeller: 0.28 }),
    "habitué": Object.freeze({ weight: 20, quantityWeights: [10, 25, 30, 22, 13], budgetFactor: [1.02, 1.4], patience: [22, 34], knowsSeller: 0.78 })
});

const CUSTOMER_FLOW = Object.freeze({
    MAX_ACTIVE_CUSTOMERS: 14,
    SERVICE_TIME: Object.freeze({ sacoche: 1.2, cachette: 2.4, perUnit: 0.18 }),
    QUEUE_SPACING: 3.2,
    SPAWN_BASE_MS: 2600
});
