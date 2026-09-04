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
        price: 10
    },

    {
        name: "Produit B",
        quantity: 2,
        price: 20
    },

    {
        name: "Produit C",
        quantity: 3,
        price: 30
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

        quantity:
            product.quantity,

        price:
            product.price,

        product:
            product.name,

        element:
            customer

    };


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


            document.getElementById(
                "customerName"
            ).textContent =
                "Client";


            document.getElementById(
                "customerRequest"
            ).textContent =
                "Demande : " +
                customerData.product +
                " × " +
                customerData.quantity;


            document.getElementById(
                "customerPrice"
            ).textContent =
                "Valeur : " +
                customerData.price +
                " €";


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

                customer.state =
                    "waiting";

                customer.waitTime =
                    0;

                customer.targetX =
                    game.playerX;

                customer.targetY =
                    game.playerY;

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


            // Après un certain temps,
            // le client repart.

            if (
                customer.waitTime >
                18
            ) {

                customer.state =
                    "leaving";


                customer.targetX =
                    customer.x < 50
                        ? -5
                        : 105;

                customer.targetY =
                    customer.y;

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

    });

}


// ===============================
// SUPPRIMER CLIENT
// ===============================

function removeCustomer(customer) {

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


        const quantity =
            customer.quantity;


        const price =
            customer.price;


        if (
            game.stock <
            quantity
        ) {

            game.satisfaction =
                Math.max(
                    0,
                    game.satisfaction - 5
                );


            showMessage(
                "Stock insuffisant"
            );

        } else {

            game.stock -=
                quantity;


            game.money +=
                price;


            game.customersServed++;


            game.dailyCustomers++;


            game.dailyMoney +=
                price;


            game.satisfaction =
                Math.min(
                    100,
                    game.satisfaction + 1
                );


            customer.state =
                "served";


            showMessage(
                "+" + price + " €"
            );

        }


        removeCustomer(
            customer
        );


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


