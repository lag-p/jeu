// ===============================
// CLIENTS
// ===============================

let customers = [];

let customerSpawnTimer = null;


// ===============================
// PRODUITS
// ===============================

const products = [

    {
        name: "Produit A",
        quantity: 1,
        price: 10,
        budgetMin: 8,
        budgetMax: 20
    },

    {
        name: "Produit B",
        quantity: 2,
        price: 20,
        budgetMin: 16,
        budgetMax: 40
    },

    {
        name: "Produit C",
        quantity: 3,
        price: 30,
        budgetMin: 24,
        budgetMax: 60
    }

];


// ===============================
// PANNEAU CLIENT
// ===============================

let selectedCustomer = null;


const customerPanel =
    document.getElementById(
        "customerPanel"
    );


const serveButton =
    document.getElementById(
        "serveButton"
    );


function randomInteger(min, max) {

    return Math.floor(
        Math.random() *
        (max - min + 1)
    ) + min;

}


function changeCustomerSatisfaction(
    customer,
    change
) {

    const currentSatisfaction =
        Number.isFinite(customer.satisfaction)
            ? customer.satisfaction
            : 75;


    customer.satisfaction =
        Math.max(
            0,
            Math.min(
                100,
                currentSatisfaction + change
            )
        );

}


function updateCustomerPanel(customer) {

    document.getElementById("customerName").textContent =
        "Client";

    document.getElementById("customerRequest").textContent =
        "Demande : " +
        customer.product +
        " × " +
        customer.quantity;

    document.getElementById("customerPrice").textContent =
        "Valeur : " +
        customer.price +
        " €";

    document.getElementById("customerBudget").textContent =
        "Budget : " +
        customer.budget +
        " €";

    document.getElementById("customerPatience").textContent =
        "Patience : " +
        Math.max(0, Math.ceil(customer.patience)) +
        " s";

    document.getElementById("customerSatisfaction").textContent =
        "Satisfaction : " +
        Math.round(customer.satisfaction) +
        "%";

}


// ===============================
// POINTS DU QUARTIER
// ===============================

function randomNeighborhoodPoint() {

    const points = [

        { x: 20, y: 25 },

        { x: 75, y: 25 },

        { x: 25, y: 70 },

        { x: 75, y: 70 },

        { x: 50, y: 35 },

        { x: 50, y: 65 },

        { x: 35, y: 50 },

        { x: 65, y: 50 }

    ];


    return points[
        Math.floor(
            Math.random() *
            points.length
        )
    ];

}


// ===============================
// POINT D'ENTREE
// ===============================

function randomEntryPoint() {

    if (
        typeof mapData !== "undefined" &&
        Array.isArray(mapData.entries) &&
        mapData.entries.length
    ) {

        const entry = mapData.entries[
            Math.floor(Math.random() * mapData.entries.length)
        ];

        return { x: entry.x, y: entry.y };

    }

    const side =
        Math.floor(
            Math.random() * 4
        );


    if (side === 0) {

        return {
            x: 3,
            y: Math.random() * 90 + 5
        };

    }


    if (side === 1) {

        return {
            x: 97,
            y: Math.random() * 90 + 5
        };

    }


    if (side === 2) {

        return {
            x: Math.random() * 90 + 5,
            y: 3
        };

    }


    return {
        x: Math.random() * 90 + 5,
        y: 97
    };

}


// ===============================
// CREATION CLIENT
// ===============================

function createCustomer() {

    if (!game.dayActive) {
        return;
    }


    const customer =
        document.createElement("div");


    customer.className =
        "customer";


    customer.textContent =
        "👤";


    const entry =
        randomEntryPoint();


    const target =
        randomNeighborhoodPoint();


    const product =
        products[
            Math.floor(
                Math.random() *
                products.length
            )
        ];

    const customerType = [
        "habitué",
        "occasionnel",
        "nouveau"
    ][Math.floor(Math.random() * 3)];


    const customerData = {

        entityType: ENTITY_TYPES.CUSTOMER,

        active: true,

        id:
            Date.now() +
            Math.random(),

        x: entry.x,

        y: entry.y,

        targetX: target.x,

        targetY: target.y,

        speed:
            5 +
            Math.random() * 3,

        state: "walking",

        movementState: "moving",

        waitTime: 0,

        maxPatience:
            randomInteger(18, 26),

        patience: null,

        budget:
            randomInteger(
                product.budgetMin,
                product.budgetMax
            ),

        satisfaction:
            randomInteger(80, 100),

        purchaseDecision: null,

        saleResolved: false,

        assignedSellerId: null,

        usesPlayerSale: false,

        customerType: customerType,

        knowsSeller: customerType === "habitué",

        maxTravelDistance: customerType === "habitué"
            ? 70
            : customerType === "occasionnel"
                ? 50
                : 35,

        travelDistance: 0,

        destination: null,

        route: [],

        moving: false,

        countedAtSalesPoint: false,

        searchTime: 0,

        quantity:
            product.quantity,

        price:
            product.price,

        product:
            product.name,

        element:
            customer

    };


    customerData.patience =
        customerData.maxPatience;


    const compatibleSeller =
        typeof findCompatibleSeller === "function"
            ? findCompatibleSeller(customerData.product)
            : null;

    const hasSellers =
        Array.isArray(game.employees) &&
        game.employees.some(
            employee =>
                employee.role === "vendeur" &&
                employee.active
        );

    if (
        compatibleSeller &&
        compatibleSeller.movedAt &&
        performance.now() - compatibleSeller.movedAt < 20000 &&
        Math.random() < 0.65
    ) {
        customerData.knowsSeller = false;
    }

    if (compatibleSeller && customerData.knowsSeller) {
        customerData.assignedSellerId = compatibleSeller.id;
        setCustomerDestination(customerData, compatibleSeller);
    } else if (!hasSellers) {
        customerData.usesPlayerSale = true;
        setCustomerDestination(customerData, { x: game.playerX, y: game.playerY });
    } else {
        setCustomerDestination(customerData, target);
    }


    customer.style.left =
        customerData.x + "%";


    customer.style.top =
        customerData.y + "%";


    customer.addEventListener(
        "click",
        function(event) {

            event.stopPropagation();


            if (
                customerData.state ===
                "served"
            ) {

                return;

            }


            selectedCustomer =
                customerData;


            updateCustomerPanel(customerData);


            customerPanel.style.display =
                "block";

        }
    );


    customers.push(
        customerData
    );


    map.appendChild(
        customer
    );

}


// ===============================
// DISTANCE JOUEUR
// ===============================

function distanceToPlayer(customer) {

    const dx =
        customer.x -
        game.playerX;


    const dy =
        customer.y -
        game.playerY;


    return Math.sqrt(
        dx * dx +
        dy * dy
    );

}


// ===============================
// CHANGER DE DESTINATION
// ===============================

function chooseNewTarget(customer) {

    const target =
        randomNeighborhoodPoint();


    setCustomerDestination(customer, target);

}


function setCustomerDestination(customer, destination) {

    if (!customer || !destination ||
        !Number.isFinite(destination.x) || !Number.isFinite(destination.y)) {
        return false;
    }

    customer.targetX = destination.x;
    customer.targetY = destination.y;
    customer.destination = { x: destination.x, y: destination.y, id: destination.id || null };
    customer.route = [customer.destination];
    customer.moving = true;
    customer.movementState = "moving";
    return true;

}


// ===============================
// DECISION D'ACHAT
// ===============================

function customerAcceptsPurchase(customer) {

    if (customer.purchaseDecision !== null) {

        return customer.purchaseDecision ===
            "accepted";

    }


    const priceIsValid =
        Number.isFinite(customer.price) &&
        customer.price >= 0;

    const budgetIsValid =
        Number.isFinite(customer.budget);


    if (
        !priceIsValid ||
        !budgetIsValid ||
        customer.budget < customer.price
    ) {

        customer.purchaseDecision =
            "refused";

        changeCustomerSatisfaction(customer, -10);

        return false;

    }


    const maxPatience =
        Number.isFinite(customer.maxPatience) &&
        customer.maxPatience > 0
            ? customer.maxPatience
            : 18;

    const patience =
        Number.isFinite(customer.patience)
            ? customer.patience
            : maxPatience;

    const patienceRatio =
        Math.max(
            0,
            Math.min(1, patience / maxPatience)
        );

    const budgetMargin =
        Math.min(
            1,
            (customer.budget - customer.price) /
            customer.price
        );

    const acceptanceChance =
        Math.min(
            0.97,
            0.86 +
            patienceRatio * 0.08 +
            budgetMargin * 0.04
        );


    customer.purchaseDecision =
        Math.random() < acceptanceChance
            ? "accepted"
            : "refused";


    if (
        customer.purchaseDecision ===
        "refused"
    ) {

        changeCustomerSatisfaction(customer, -10);

    }


    return customer.purchaseDecision ===
        "accepted";

}


function startCustomerLeaving(customer) {

    if (
        customer.state === "leaving" ||
        customer.state === "served"
    ) {
        return;
    }


    customer.state =
        "leaving";

    setCustomerDestination(customer, {
        x: customer.x < 50 ? -5 : 105,
        y: customer.y
    });
    customer.movementState = "leaving";

}


// ===============================
// CLIENTS EN TEMPS REEL
// ===============================

function updateCustomersRealtime(delta) {

    customers.forEach(customer => {

        if (customer.entityType !== ENTITY_TYPES.CUSTOMER) return;
        if (!Number.isFinite(customer.speed) || customer.speed <= 0) customer.speed = 6;

        if (customer.state === "walking" &&
            (!Number.isFinite(customer.targetX) || !Number.isFinite(customer.targetY))) {
            chooseNewTarget(customer);
        }

        // ---------------------------
        // CLIENT QUI SE DEPLACE
        // ---------------------------

        if (
            customer.state ===
            "walking"
        ) {

            const distanceBeforeMove = Math.hypot(
                customer.targetX - customer.x,
                customer.targetY - customer.y
            );

            const reachedTarget = moveMapEntity(
                customer,
                { x: customer.targetX, y: customer.targetY },
                delta,
                customer.speed
            );

            customer.movementState = reachedTarget ? "arrived" : "moving";

            customer.travelDistance += Math.min(
                distanceBeforeMove,
                customer.speed * delta
            );

            if (reachedTarget &&
                !customer.assignedSellerId &&
                !customer.usesPlayerSale
            ) {
                chooseNewTarget(customer);
            }

            if (customer.travelDistance > customer.maxTravelDistance) {
                startCustomerLeaving(customer);
            }


            if (
                !customer.assignedSellerId &&
                !customer.usesPlayerSale &&
                typeof orientCustomerWithWatchers === "function"
            ) {
                orientCustomerWithWatchers(customer);
            }

            if (
                !customer.assignedSellerId &&
                !customer.usesPlayerSale
            ) {
                customer.searchTime += delta;

                if (customer.searchTime >= 12) {
                    startCustomerLeaving(customer);
                }
            }

            const seller =
                customer.assignedSellerId &&
                typeof getEmployeeById === "function"
                    ? getEmployeeById(customer.assignedSellerId)
                    : null;

            const destinationReached =
                customer.usesPlayerSale
                    ? isMapEntityInRange(
                        customer,
                        { x: game.playerX, y: game.playerY },
                        PLAYER_SALE_RANGE
                    )
                    : seller &&
                    isMapEntityInRange(
                        customer,
                        (typeof getSalesPointForSeller === "function" &&
                            getSalesPointForSeller(seller.id)) || seller,
                        SELLER_SALE_RANGE
                    );

            if (destinationReached) {

                const destinationSalesPoint = seller &&
                    typeof getSalesPointForSeller === "function"
                    ? getSalesPointForSeller(seller.id)
                    : null;

                if (
                    destinationSalesPoint &&
                    (!destinationSalesPoint.active ||
                    destinationSalesPoint.currentVisitors >=
                    destinationSalesPoint.capacity)
                ) {

                    startCustomerLeaving(customer);
                    return;

                }

                customer.waitTime =
                    0;

                customer.targetX = customer.usesPlayerSale
                    ? game.playerX : seller.x;

                customer.targetY = customer.usesPlayerSale
                    ? game.playerY : seller.y;

                if (
                    customerAcceptsPurchase(
                        customer
                    )
                ) {

                    customer.state =
                        "waiting";

                    const salesPoint = seller &&
                        typeof getSalesPointForSeller === "function"
                        ? getSalesPointForSeller(seller.id)
                        : null;

                    if (salesPoint && !customer.countedAtSalesPoint) {
                        salesPoint.currentVisitors++;
                        customer.countedAtSalesPoint = true;
                    }

                } else {

                    startCustomerLeaving(customer);

                }

            }

        }


        // ---------------------------
        // CLIENT EN ATTENTE
        // ---------------------------

        if (
            customer.state ===
            "waiting"
        ) {

            customer.waitTime +=
                delta;


            customer.patience =
                Math.max(
                    0,
                    customer.patience - delta
                );

            changeCustomerSatisfaction(
                customer,
                -delta * 0.5
            );

            if (
                customer.patience <= 0
            ) {

                changeCustomerSatisfaction(customer, -10);

                startCustomerLeaving(customer);

            }

        }


        // ---------------------------
        // CLIENT QUI PART
        // ---------------------------

        if (
            customer.state ===
            "leaving"
        ) {

            if (moveMapEntity(
                customer,
                { x: customer.targetX, y: customer.targetY },
                delta,
                customer.speed
            )) {
                removeCustomer(customer);
            } else {
                customer.movementState = "leaving";
            }

        }


        // ---------------------------
        // POSITION VISUELLE
        // ---------------------------

        if (
            customer.element
        ) {

            customer.element.style.left =
                customer.x + "%";

            customer.element.style.top =
                customer.y + "%";

        }


        if (selectedCustomer === customer) {
            updateCustomerPanel(customer);
        }

    });

}


// ===============================
// SUPPRIMER CLIENT
// ===============================

function removeCustomer(customer) {

    customer.active = false;

    const salesPoint = customer.assignedSellerId &&
        typeof getSalesPointForSeller === "function"
        ? getSalesPointForSeller(customer.assignedSellerId)
        : null;

    if (salesPoint && customer.countedAtSalesPoint) {
        salesPoint.currentVisitors = Math.max(
            0,
            salesPoint.currentVisitors - 1
        );
    }

    if (salesPoint && !customer.saleResolved && !customer.lossRecorded) {
        salesPoint.stats.customersLost++;
        customer.lossRecorded = true;
    }

    if (
        customer.element
    ) {

        customer.element.remove();

    }


    const index =
        customers.indexOf(
            customer
        );


    if (index !== -1) {

        customers.splice(
            index,
            1
        );

    }


    if (
        selectedCustomer ===
        customer
    ) {

        selectedCustomer =
            null;

        customerPanel.style.display =
            "none";

    }

}


// ===============================
// RESOUDRE UNE VENTE
// ===============================

function resolveSale(
    customer,
    options = {}
) {

    const {
        insufficientStockSatisfactionChange = 0,
        removeOnInsufficientStock = false
    } = options;


    if (
        !customer ||
        customer.entityType !== ENTITY_TYPES.CUSTOMER ||
        customer.active === false ||
        customer.saleResolved ||
        customer.state !== "waiting" ||
        !customers.includes(customer) ||
        !Number.isFinite(customer.patience) ||
        customer.patience <= 0
    ) {

        return {
            success: false,
            reason: "customer-left"
        };

    }


    const requestedSeller = options.seller || null;
    const seller = requestedSeller;

    if (requestedSeller &&
        (requestedSeller.entityType !== ENTITY_TYPES.EMPLOYEE ||
        requestedSeller.id !== customer.assignedSellerId)) {
        return { success: false, reason: "seller-unavailable" };
    }

    // Une vente manuelle ne peut provenir que du point du joueur. Un client
    // affecté à un vendeur reste exclusivement dans son flux automatique.
    if (!seller && !customer.usesPlayerSale) {
        return { success: false, reason: "seller-unavailable" };
    }


    if (
        customer.assignedSellerId &&
        (!seller ||
        !seller.active ||
        seller.role !== "vendeur" ||
        !seller.allowedProducts.includes(customer.product))
    ) {

        return {
            success: false,
            reason: "seller-unavailable"
        };

    }

    const saleOrigin = seller
        ? (typeof getSalesPointForSeller === "function" &&
            getSalesPointForSeller(seller.id)) || seller
        : { x: game.playerX, y: game.playerY, entityType: game.playerEntityType };
    const saleRange = seller ? SELLER_SALE_RANGE : PLAYER_SALE_RANGE;

    if (!isMapEntityInRange(customer, saleOrigin, saleRange)) {
        return { success: false, reason: "out-of-range" };
    }


    const availableStock = seller
        ? getSellerProductStock(seller, customer.product)
        : getAvailableProductStock(customer.product);


    const requestedQuantity =
        Number.isFinite(customer.quantity)
            ? customer.quantity
            : null;


    if (!customerAcceptsPurchase(customer)) {

        startCustomerLeaving(customer);

        return {
            success: false,
            reason: "customer-refused"
        };

    }


    if (
        !Number.isSafeInteger(requestedQuantity) ||
        requestedQuantity <= 0 ||
        availableStock <
        requestedQuantity
    ) {

        const salesPoint = seller &&
            typeof getSalesPointForSeller === "function"
            ? getSalesPointForSeller(seller.id)
            : null;

        if (salesPoint) {
            salesPoint.stats.stockouts++;
        }

        if (
            insufficientStockSatisfactionChange !== 0
        ) {

            game.satisfaction =
                Math.max(
                    0,
                    game.satisfaction +
                    insufficientStockSatisfactionChange
                );

        }


        if (removeOnInsufficientStock) {

            removeCustomer(customer);

        }


        return {
            success: false,
            reason: "insufficient-stock"
        };

    }


    customer.saleResolved = true;


    customer.state =
        "served";


    if (seller) {

        getSellerStorageContainer(seller).inventory[customer.product] =
            availableStock - requestedQuantity;

        seller.money += customer.price;

    } else {

        game.stock[customer.product] =
            availableStock - requestedQuantity;

        game.money += customer.price;

    }


    game.customersServed++;


    game.dailyCustomers++;


    game.dailyRevenue +=
        customer.price;


    const salesPoint = seller &&
        typeof getSalesPointForSeller === "function"
        ? getSalesPointForSeller(seller.id)
        : null;

    if (salesPoint) {
        salesPoint.stats.customersServed++;
        salesPoint.stats.totalWaitTime += customer.waitTime;
        salesPoint.stats.revenue += customer.price;
    }

    if (seller && typeof showMapIndicator === "function") {
        showMapIndicator(seller, "+" + customer.price + "€");
    }


    game.satisfaction =
        Math.min(
            100,
            game.satisfaction + 1
        );


    changeCustomerSatisfaction(customer, 10);


    removeCustomer(customer);


    return {
        success: true,
        reason: "sold"
    };

}


// ===============================
// SERVIR MANUELLEMENT
// ===============================

serveButton.addEventListener(
    "click",
    function() {

        if (!selectedCustomer) {
            return;
        }


        const customer =
            selectedCustomer;


        const sale =
            resolveSale(
                customer,
                {
                    insufficientStockSatisfactionChange: -5,
                    removeOnInsufficientStock: true
                }
            );


        if (!sale.success) {

            if (
                sale.reason ===
                "insufficient-stock"
            ) {

                showMessage(
                    "Stock insuffisant"
                );

            } else if (
                sale.reason ===
                "customer-refused"
            ) {

                showMessage(
                    "Le client refuse l'achat."
                );

            } else if (sale.reason === "out-of-range") {

                showMessage("Client trop loin.");

            } else {

                showMessage(
                    "Le client est parti."
                );

            }

        } else {
            showMessage(
                "+" + customer.price + " €"
            );

        }

        selectedCustomer =
            null;


        customerPanel.style.display =
            "none";


        updateUI();

    }
);


// ===============================
// APPARITION DES CLIENTS
// ===============================

function startCustomerSpawning() {

    stopCustomerSpawning();


    createCustomer();


    customerSpawnTimer =
        setInterval(
            function() {

                if (
                    game.dayActive
                ) {

                    createCustomer();

                }

            },
            2200
        );

}


function stopCustomerSpawning() {

    if (
        customerSpawnTimer
    ) {

        clearInterval(
            customerSpawnTimer
        );

        customerSpawnTimer =
            null;

    }

}


// ===============================
// PREPARATION JOUR SUIVANT
// ===============================

function prepareCustomerSystem() {

    stopCustomerSpawning();


    customers.forEach(
        customer => {

            if (
                customer.element
            ) {

                customer.element.remove();

            }

        }
    );


    customers = [];


    setTimeout(
        function() {

            if (
                game.dayActive
            ) {

                startCustomerSpawning();

            }

        },
        300
    );

}


// ===============================
// NETTOYAGE FIN DE JOURNEE
// ===============================

function clearWaitingCustomers() {

    customers.forEach(
        customer => {

            if (
                customer.element
            ) {

                customer.element.remove();

            }

        }
    );


    customers = [];


    selectedCustomer =
        null;


    customerPanel.style.display =
        "none";

}


function disperseCustomersInZone(zone, radius) {

    let dispersed = 0;

    customers.slice().forEach(customer => {
        if (
            customer.state !== "leaving" &&
            Math.hypot(customer.x - zone.x, customer.y - zone.y) <= radius
        ) {
            startCustomerLeaving(customer);
            dispersed++;
        }
    });


    return dispersed;

}
