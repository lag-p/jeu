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


    const customerData = {

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


    customer.targetX =
        target.x;


    customer.targetY =
        target.y;

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

    customer.targetX =
        customer.x < 50
            ? -5
            : 105;

    customer.targetY =
        customer.y;

}


// ===============================
// CLIENTS EN TEMPS REEL
// ===============================

function updateCustomersRealtime(delta) {

    customers.forEach(customer => {

        // ---------------------------
        // CLIENT QUI SE DEPLACE
        // ---------------------------

        if (
            customer.state ===
            "walking"
        ) {

            const dx =
                customer.targetX -
                customer.x;


            const dy =
                customer.targetY -
                customer.y;


            const distance =
                Math.sqrt(
                    dx * dx +
                    dy * dy
                );


            if (distance < 1) {

                chooseNewTarget(
                    customer
                );

            } else {

                customer.x +=
                    (dx / distance) *
                    customer.speed *
                    delta;


                customer.y +=
                    (dy / distance) *
                    customer.speed *
                    delta;

            }


            // Le client arrive dans
            // la zone du joueur.

            if (
                distanceToPlayer(
                    customer
                ) < 10
            ) {

                customer.waitTime =
                    0;

                customer.targetX =
                    game.playerX;

                customer.targetY =
                    game.playerY;

                if (
                    customerAcceptsPurchase(
                        customer
                    )
                ) {

                    customer.state =
                        "waiting";

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

            const dx =
                customer.targetX -
                customer.x;


            const dy =
                customer.targetY -
                customer.y;


            const distance =
                Math.sqrt(
                    dx * dx +
                    dy * dy
                );


            if (distance < 1) {

                removeCustomer(
                    customer
                );

            } else {

                customer.x +=
                    (dx / distance) *
                    customer.speed *
                    delta;


                customer.y +=
                    (dy / distance) *
                    customer.speed *
                    delta;

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

function removeCustomer(
    customer,
    options = {}
) {

    const {
        preserveSelectedCustomer = false
    } = options;

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
        !preserveSelectedCustomer &&
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
        removeOnInsufficientStock = false,
        preserveSelectedCustomerOnSuccess = false
    } = options;


    const availableStock =
        getAvailableProductStock(
            customer.product
        );


    const requestedQuantity =
        Number.isFinite(customer.quantity)
            ? customer.quantity
            : null;


    if (
        customer.state === "leaving" ||
        customer.patience <= 0
    ) {

        return {
            success: false,
            reason: "customer-left"
        };

    }


    if (!customerAcceptsPurchase(customer)) {

        startCustomerLeaving(customer);

        return {
            success: false,
            reason: "customer-refused"
        };

    }


    if (
        requestedQuantity === null ||
        availableStock <
        requestedQuantity
    ) {

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


    game.stock[customer.product] =
        availableStock -
        requestedQuantity;


    game.money +=
        customer.price;


    game.customersServed++;


    game.dailyCustomers++;


    game.dailyRevenue +=
        customer.price;


    game.satisfaction =
        Math.min(
            100,
            game.satisfaction + 1
        );


    changeCustomerSatisfaction(customer, 10);


    customer.state =
        "served";


    removeCustomer(
        customer,
        {
            preserveSelectedCustomer:
                preserveSelectedCustomerOnSuccess
        }
    );


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
