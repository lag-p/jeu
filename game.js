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

    satisfaction: 100,

    playerX: 50,

    playerY: 50,

    playerEntityType: "PLAYER",

    playerPlaced: false,

    startPointPlacementActive: false,

    employees: [],

    apartments: [],

    logisticsMissions: [],

    logisticsRequests: [],

    activeApartmentId: null,

    day: 1,

    dayActive: false,

    dayDuration: 180,

    dayElapsed: 0,

    dailyRevenue: 0,

    dailyExpenses: 0,

    pendingDailyExpenses: 0,

    pendingDayStartMoney: null,

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


    return Number.isSafeInteger(quantity) &&
        quantity >= 0
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

    document.getElementById("satisfaction").textContent =
        game.satisfaction + "%";

    const activeEmployees =
        game.employees.filter(employee => employee.active).length;

    document.getElementById("activeEmployees").textContent =
        activeEmployees;

    updateDayUI();
}


function recordExpense(amount) {

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        return false;
    }


    if (game.dayActive) {

        game.dailyExpenses += amount;

        return true;

    }


    if (
        game.pendingDailyExpenses === 0 ||
        !Number.isFinite(game.pendingDayStartMoney)
    ) {

        game.pendingDayStartMoney =
            game.money;

    }


    game.pendingDailyExpenses += amount;


    return true;

}


function reverseExpense(amount) {

    if (!Number.isFinite(amount) || amount <= 0) return;
    if (game.dayActive) {
        game.dailyExpenses = Math.max(0, game.dailyExpenses - amount);
        return;
    }
    game.pendingDailyExpenses = Math.max(0, game.pendingDailyExpenses - amount);
    if (game.pendingDailyExpenses === 0) game.pendingDayStartMoney = null;
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

function closePanelsForStartPointPlacement() {

    document.querySelectorAll(".sidePanel.visible").forEach(
        panel => panel.classList.remove("visible")
    );

}


function beginStartPointPlacement() {

    if (game.startPointPlacementActive) {
        return;
    }

    game.startPointPlacementActive = true;

    document
        .getElementById("startDayOverlay")
        .classList.add("hidden");

    closePanelsForStartPointPlacement();
    document.body.classList.add("startPointPlacementActive");
    map.classList.add("startPointPlacementActive");

    showMessage(
        "Choisis ton point de départ sur la carte."
    );

}


function finishStartPointPlacement(x, y) {

    game.playerX = Math.max(5, Math.min(95, x));
    game.playerY = Math.max(5, Math.min(95, y));
    game.playerPlaced = true;
    game.startPointPlacementActive = false;

    document.body.classList.remove("startPointPlacementActive");
    map.classList.remove("startPointPlacementActive");

    updatePlayer();
    showMessage("Point de départ choisi.");
    startDay();

}

map.addEventListener(
    "click",
    function(event) {

        // Les boutons et personnages
        // ne doivent pas déplacer le joueur.

        if (
            event.target.classList.contains("customer") ||
            event.target.classList.contains("employee") ||
            event.target.classList.contains("policePatrol") ||
            event.target.closest("#customerPanel")
        ) {

            return;

        }


        if (
            typeof handleMapPlacement ===
            "function" &&
            handleMapPlacement(event)
        ) {

            return;

        }


        if (
            typeof handleMapStrategicPlacement ===
            "function" &&
            handleMapStrategicPlacement(event)
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


        if (!game.startPointPlacementActive) return;


        const rect =
            map.getBoundingClientRect();


        finishStartPointPlacement(
            ((event.clientX - rect.left) / rect.width) * 100,
            ((event.clientY - rect.top) / rect.height) * 100
        );

    }
);


// ===============================
// COMMENCER LA JOURNEE
// ===============================

function startDay() {

    if (!game.playerPlaced) {
        beginStartPointPlacement();
        return;

    }

    if (game.startPointPlacementActive || game.dayActive) return;

    game.dayActive = true;

    game.dayElapsed = 0;

    game.dailyRevenue = 0;

    game.dailyExpenses =
        game.pendingDailyExpenses;

    game.dailyCustomers = 0;

    game.dailyStartMoney =
        Number.isFinite(game.pendingDayStartMoney)
            ? game.pendingDayStartMoney
            : game.money;

    game.pendingDailyExpenses = 0;

    game.pendingDayStartMoney = null;


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


    if (typeof startPoliceDay === "function") {
        startPoliceDay();
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


    if (typeof endPoliceDay === "function") {
        endPoliceDay();
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

function updateDayTimer(delta) {

    if (!Number.isFinite(delta) || delta <= 0) {
        return;
    }

    game.dayElapsed = Math.min(
        game.dayDuration,
        game.dayElapsed + delta
    );

}


function gameLoop(now) {

    // La frame suivante est toujours demandée avant les mises à jour : une
    // exception métier ne doit jamais tuer la boucle globale.
    requestAnimationFrame(gameLoop);

    const delta =
        Math.min(
            100,
            now - lastFrame
        ) / 1000;


    lastFrame = now;
    if (game.dayActive) {
        updateDayTimer(delta);


        if (
            typeof updateCustomersRealtime ===
            "function"
        ) {

            updateCustomersRealtime(delta);

        }


        if (
            typeof updateLogisticsRealtime ===
            "function"
        ) {

            updateLogisticsRealtime(delta);

        }


        if (
            typeof updateEmployeesRealtime ===
            "function"
        ) {

            updateEmployeesRealtime(delta);

        }


        if (
            typeof updateMapRealtime ===
            "function"
        ) {

            updateMapRealtime(delta);

        }


        if (
            typeof updatePoliceRealtime ===
            "function"
        ) {

            updatePoliceRealtime(delta);

        }


        if (
            game.dayElapsed >=
            game.dayDuration
        ) {

            endDay();

        }

    }
    updateDayUI();

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
