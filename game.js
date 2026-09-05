// ===============================
// ETAT DU JEU
// ===============================

const game = {

    money: 100,

    stock: {
        "Produit A": 10,
        "Produit B": 10,
        "Produit C": 10
    },

    customersServed: 0,

    satisfaction: 100,

    playerX: 50,

    playerY: 50,

    playerPlaced: false,

    employees: [],

    day: 1,

    dayActive: false,

    dayDuration: 180,

    dayElapsed: 0,

    dailyRevenue: 0,

    dailyExpenses: 0,

    dailyCustomers: 0,

    dailyStartMoney: 100,

    alert: 0

};


// ===============================
// ELEMENTS
// ===============================

const player =
    document.getElementById("player");

const map =
    document.getElementById("map");


// ===============================
// INTERFACE
// ===============================

function getAvailableProductStock(product) {

    if (
        !game.stock ||
        typeof game.stock !== "object"
    ) {
        return 0;
    }


    const quantity =
        game.stock[product];


    return Number.isFinite(quantity)
        ? quantity
        : 0;

}


function getStockEntries() {

    if (
        !game.stock ||
        typeof game.stock !== "object"
    ) {
        return [];
    }


    return Object.keys(game.stock).map(
        product => ({
            product,
            quantity:
                getAvailableProductStock(product)
        })
    );

}


function formatStock() {

    return getStockEntries()
        .map(
            entry =>
                entry.product +
                " : " +
                entry.quantity
        )
        .join(" · ");

}


function updateStockUI() {

    const stockElement =
        document.getElementById("stock");


    stockElement.replaceChildren();


    getStockEntries().forEach(
        entry => {

            const stockItem =
                document.createElement("span");


            stockItem.className =
                "stockItem";


            stockItem.textContent =
                entry.product +
                " : " +
                entry.quantity;


            stockElement.appendChild(stockItem);

        }
    );

}


function updateUI() {

    document.getElementById("money").textContent =
        Math.floor(game.money) + " €";

    updateStockUI();

    document.getElementById("customersServed").textContent =
        game.customersServed;

    document.getElementById("satisfaction").textContent =
        game.satisfaction + "%";

    updateDayUI();
}


// ===============================
// POSITION DU JOUEUR
// ===============================

function updatePlayer() {

    player.style.left =
        game.playerX + "%";

    player.style.top =
        game.playerY + "%";
}


// ===============================
// MESSAGE
// ===============================

function showMessage(text) {

    const message =
        document.getElementById("message");

    message.textContent = text;

    message.classList.add("show");

    clearTimeout(message.timeout);

    message.timeout = setTimeout(() => {

        message.classList.remove("show");

    }, 1300);
}


// ===============================
// INTERFACE JOUR
// ===============================

function createDayInterface() {

    const dayUI =
        document.createElement("div");

    dayUI.id = "dayUI";

    dayUI.innerHTML = `

        <div id="dayNumber">
            JOUR 1
        </div>

        <div id="dayClock">
            03:00
        </div>

        <div id="dayStatus">
            Journée terminée
        </div>

    `;

    document.body.appendChild(dayUI);


    const startOverlay =
        document.createElement("div");

    startOverlay.id = "startDayOverlay";

    startOverlay.innerHTML = `

        <div class="dayBox">

            <div class="dayEmoji">
                🌅
            </div>

            <h1 id="startDayTitle">
                JOUR 1
            </h1>

            <p>
                Le quartier se réveille.
            </p>

            <p id="placementText">
                Choisis ton point de départ
                directement sur la carte.
            </p>

            <button id="startDayButton">
                COMMENCER LA JOURNÉE
            </button>

        </div>

    `;

    document.body.appendChild(startOverlay);


    const endOverlay =
        document.createElement("div");

    endOverlay.id = "endDayOverlay";

    endOverlay.classList.add("hidden");

    endOverlay.innerHTML = `

        <div class="dayBox">

            <div class="dayEmoji">
                🌙
            </div>

            <h1>
                FIN DE JOURNÉE
            </h1>

            <div id="dailySummary"></div>

            <button id="nextDayButton">
                JOUR SUIVANT
            </button>

        </div>

    `;

    document.body.appendChild(endOverlay);


    document
        .getElementById("startDayButton")
        .addEventListener(
            "click",
            startDay
        );


    document
        .getElementById("nextDayButton")
        .addEventListener(
            "click",
            nextDay
        );


    updateDayUI();

}

// ===============================
// HORLOGE
// ===============================

function updateDayUI() {

    const dayNumber =
        document.getElementById("dayNumber");

    const dayClock =
        document.getElementById("dayClock");

    const dayStatus =
        document.getElementById("dayStatus");


    if (!dayNumber) {
        return;
    }


    dayNumber.textContent =
        "JOUR " + game.day;


    const remaining =
        Math.max(
            0,
            game.dayDuration -
            game.dayElapsed
        );


    const minutes =
        Math.floor(remaining / 60);

    const seconds =
        Math.floor(remaining % 60);


    dayClock.textContent =
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0");


    dayStatus.textContent =
        game.dayActive
            ? "Quartier actif"
            : "Journée terminée";
}


// ===============================
// PLACEMENT DU JOUEUR
// ===============================

map.addEventListener(
    "click",
    function(event) {

        // Les boutons et personnages
        // ne doivent pas déplacer le joueur.

        if (
            event.target.classList.contains("customer") ||
            event.target.classList.contains("employee") ||
            event.target.closest("#customerPanel")
        ) {

            return;

        }


        // Placement d'un employé

        if (placementMode) {

            const rect =
                map.getBoundingClientRect();

            const x =
                ((event.clientX - rect.left) /
                rect.width) * 100;

            const y =
                ((event.clientY - rect.top) /
                rect.height) * 100;

            placeEmployee(x, y);

            return;
        }


        // Le joueur ne peut être placé
        // qu'une seule fois.

        if (
            game.dayActive ||
            game.playerPlaced
        ) {

            return;

        }


        const rect =
            map.getBoundingClientRect();


        game.playerX =
            ((event.clientX - rect.left) /
            rect.width) * 100;


        game.playerY =
            ((event.clientY - rect.top) /
            rect.height) * 100;


        game.playerX =
            Math.max(
                5,
                Math.min(95, game.playerX)
            );


        game.playerY =
            Math.max(
                5,
                Math.min(95, game.playerY)
            );


        game.playerPlaced = true;


        updatePlayer();


        const placementText =
            document.getElementById(
                "placementText"
            );


        placementText.textContent =
            "Point de départ choisi.";


        showMessage(
            "Point de départ choisi."
        );

    }
);


// ===============================
// COMMENCER LA JOURNEE
// ===============================

function startDay() {

    game.dayActive = true;

    game.dayElapsed = 0;

    game.dailyRevenue = 0;

    game.dailyExpenses = 0;

    game.dailyCustomers = 0;

    game.dailyStartMoney =
        game.money;


    document
        .getElementById("startDayOverlay")
        .classList.add("hidden");


    showMessage(
        "La journée commence."
    );


    updateDayUI();


    if (
        typeof startCustomerSpawning ===
        "function"
    ) {

        startCustomerSpawning();

    }

}

// ===============================
// FIN DE JOURNEE
// ===============================

function endDay() {

    if (!game.dayActive) {
        return;
    }


    game.dayActive = false;


    // On arrête les nouveaux clients.

    if (
        typeof stopCustomerSpawning ===
        "function"
    ) {

        stopCustomerSpawning();

    }


    // Les clients encore présents
    // quittent progressivement la carte.

    if (
        typeof clearWaitingCustomers ===
        "function"
    ) {

        clearWaitingCustomers();

    }


    const summary =
        document.getElementById(
            "dailySummary"
        );


    const profit =
        game.dailyRevenue -
        game.dailyExpenses;


    const formattedProfit =
        profit >= 0
            ? "+" + Math.floor(profit)
            : Math.floor(profit);


    summary.innerHTML = `

        <div class="summaryLine">
            <span>💼 Solde de départ</span>
            <strong>${Math.floor(game.dailyStartMoney)} €</strong>
        </div>

        <div class="summaryLine">
            <span>💰 Chiffre d'affaires</span>
            <strong>+${Math.floor(game.dailyRevenue)} €</strong>
        </div>

        <div class="summaryLine">
            <span>💸 Dépenses</span>
            <strong>-${Math.floor(game.dailyExpenses)} €</strong>
        </div>

        <div class="summaryLine">
            <span>📈 Bénéfice</span>
            <strong>${formattedProfit} €</strong>
        </div>

        <div class="summaryLine">
            <span>💰 Solde actuel</span>
            <strong>${Math.floor(game.money)} €</strong>
        </div>

        <div class="summaryLine">
            <span>👥 Clients servis</span>
            <strong>${game.dailyCustomers}</strong>
        </div>

        <div class="summaryLine">
            <span>📦 Stock restant</span>
            <strong>${formatStock()}</strong>
        </div>

        <div class="summaryLine">
            <span>⭐ Satisfaction</span>
            <strong>${game.satisfaction}%</strong>
        </div>

    `;


    document
        .getElementById("endDayOverlay")
        .classList.remove("hidden");


    updateDayUI();

}


// ===============================
// JOUR SUIVANT
// ===============================

function nextDay() {

    game.day++;

    game.dayActive = false;

    game.dayElapsed = 0;

    game.customersServed = 0;

    game.dailyRevenue = 0;

    game.dailyExpenses = 0;

    game.dailyCustomers = 0;


    document
        .getElementById("endDayOverlay")
        .classList.add("hidden");


    document
        .getElementById("startDayTitle")
        .textContent =
        "JOUR " + game.day;


    document
        .getElementById("placementText")
        .textContent =
        "Ton point est conservé.";


    // Le joueur reste exactement
    // au même endroit.

    updatePlayer();


    updateUI();


    setTimeout(() => {

        document
            .getElementById("startDayOverlay")
            .classList.remove("hidden");

    }, 200);


    if (
        typeof prepareCustomerSystem ===
        "function"
    ) {

        prepareCustomerSystem();

    }

}


// ===============================
// BOUCLE PRINCIPALE
// ===============================

let lastFrame =
    performance.now();


function gameLoop(now) {

    const delta =
        Math.min(
            100,
            now - lastFrame
        ) / 1000;


    lastFrame = now;


    if (game.dayActive) {

        game.dayElapsed += delta;


        if (
            typeof updateCustomersRealtime ===
            "function"
        ) {

            updateCustomersRealtime(delta);

        }


        if (
            game.dayElapsed >=
            game.dayDuration
        ) {

            endDay();

        }

    }


    updateDayUI();


    requestAnimationFrame(
        gameLoop
    );

}


// ===============================
// INITIALISATION
// ===============================

createDayInterface();

updatePlayer();

updateUI();

requestAnimationFrame(
    gameLoop
);
