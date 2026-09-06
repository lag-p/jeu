// ===============================
// REAPPROVISIONNEMENT
// ===============================

const purchasePrices = Object.freeze(Object.fromEntries(
    Object.entries(PRODUCT_CONFIG).map(([product, config]) => [product, config.purchasePrice])
));


const stockPanel =
    document.getElementById("stockPanel");

const stockPurchaseList =
    document.getElementById("stockPurchaseList");


function getPurchaseQuantity(input) {

    const quantity =
        Number(input.value);


    return Number.isSafeInteger(quantity) &&
        quantity > 0
            ? quantity
            : null;

}


function updatePurchaseCost(card) {

    const product =
        card.dataset.product;

    const unitPrice =
        purchasePrices[product];

    const input =
        card.querySelector(".stockQuantity");

    const costElement =
        card.querySelector(".stockPurchaseCost");

    const quantity =
        getPurchaseQuantity(input);


    if (
        !Number.isSafeInteger(unitPrice) ||
        quantity === null ||
        !Number.isSafeInteger(unitPrice * quantity)
    ) {

        costElement.textContent =
            "Coût : -";

        return;

    }


    costElement.textContent =
        "Coût : " +
        (unitPrice * quantity) +
        " €";

}


function updateStockPurchasePanel() {

    stockPurchaseList.innerHTML = "";

    const network = typeof getNetworkStock === "function" ? getNetworkStock() : null;
    if (network) {
        const overview = document.createElement("div"); overview.className = "employeeCard";
        const distribution = getNetworkStockDistribution();
        overview.innerHTML = `<strong>STOCK TOTAL · ${network.total} unités</strong>${Object.entries(network.byProduct).map(([product, quantity]) => `<p><strong>${product}</strong> : ${quantity}</p>`).join("")}<strong>RÉPARTITION</strong>${distribution.map(place => `<p>${place.name}<br>${Object.entries(place.inventory).map(([product, quantity]) => `${product} ${quantity}`).join(" · ")}</p>`).join("")}</div>`;
        stockPurchaseList.appendChild(overview);
        const apartments = document.createElement("div"); apartments.className = "employeeCard";
        apartments.innerHTML = `<strong>APPARTEMENTS</strong>${game.apartments.map(apartment => `<p>${apartment.name}<br>${Object.entries(apartment.inventory).map(([product, quantity]) => `${product} ${quantity}`).join(" · ")}</p>`).join("") || "<p>Aucun appartement : le stock reste personnel.</p>"}`;
        stockPurchaseList.appendChild(apartments);
    }

    const delivery = document.createElement("div"); delivery.className = "employeeCard";
    delivery.innerHTML = `<strong>LIVRER À</strong><label class="stockPurchaseLabel"><select id="stockDeliveryApartment"><option value="">Stock personnel</option>${game.apartments.filter(apartment => apartment.active).map(apartment => `<option value="${apartment.id}" ${apartment.id === game.activeApartmentId ? "selected" : ""}>${apartment.name}</option>`).join("")}</select></label>`;
    stockPurchaseList.appendChild(delivery);

    const transfer = document.createElement("div"); transfer.className = "employeeCard";
    transfer.innerHTML = `<strong>TRANSFÉRER STOCK</strong><label class="stockPurchaseLabel">Source<select id="stockTransferSource"><option value="player">Joueur</option>${game.apartments.filter(a => a.active).map(a => `<option value="${a.id}">${a.name}</option>`).join("")}</select></label><label class="stockPurchaseLabel">Destination<select id="stockTransferDestination"><option value="player">Joueur</option>${game.apartments.filter(a => a.active).map(a => `<option value="${a.id}">${a.name}</option>`).join("")}</select></label><label class="stockPurchaseLabel">Produit<select id="stockTransferProduct">${Object.keys(PRODUCT_CONFIG).map(product => `<option value="${product}">${product}</option>`).join("")}</select></label><label class="stockPurchaseLabel">Quantité<input id="stockTransferQuantity" type="number" min="1" value="1"></label><button type="button" id="transferStockButton">TRANSFÉRER STOCK</button>`;
    stockPurchaseList.appendChild(transfer);


    Object.entries(purchasePrices).forEach(
        ([product, unitPrice]) => {

            const card =
                document.createElement("div");


            card.className =
                "employeeCard stockPurchaseCard";

            card.dataset.product =
                product;


            card.innerHTML = `

                <div class="employeeTitle">
                    <strong>${product}</strong>
                </div>

                <p>Stock actuel : ${getActiveApartment() ? getInventoryQuantity(getActiveApartment(), product) : getAvailableProductStock(product)}</p>
                <p>Prix d'achat : ${unitPrice} € / unité</p>

                <label class="stockPurchaseLabel">
                    Quantité à acheter
                    <input
                        class="stockQuantity"
                        type="number"
                        min="1"
                        step="1"
                        value="1"
                    >
                </label>

                <p class="stockPurchaseCost">
                    Coût : ${unitPrice} €
                </p>

                <button
                    class="buyStockButton"
                    type="button"
                >
                    Acheter
                </button>

            `;


            stockPurchaseList.appendChild(card);

        }
    );

}


function buyStock(product, quantity, apartmentId = game.activeApartmentId) {

    const unitPrice =
        purchasePrices[product];


    if (
        !Number.isSafeInteger(unitPrice) ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0
    ) {

        showMessage("Quantité invalide.");

        return false;

    }


    const cost =
        unitPrice * quantity;

    const apartment = apartmentId ? getApartmentById(apartmentId) : null;

    const currentStock = apartment
        ? getInventoryQuantity(apartment, product)
        : getAvailableProductStock(product);


    if (
        !game.playerInventory || typeof game.playerInventory !== "object" ||
        !Number.isSafeInteger(cost) ||
        !Number.isSafeInteger(currentStock) ||
        !Number.isSafeInteger(currentStock + quantity) ||
        (apartment &&
        getInventoryTotal(apartment) + quantity > apartment.capacity)
    ) {

        showMessage("Quantité invalide.");

        return false;

    }


    if (
        !Number.isFinite(game.money) ||
        game.money < cost
    ) {

        showMessage("Argent insuffisant.");

        return false;

    }


    recordExpense(cost);


    game.money -= cost;

    if (apartment) {

        apartment.inventory[product] =
            currentStock + quantity;

    } else {

        game.playerInventory[product] =
            currentStock + quantity;

    }


    updateUI();

    updateStockPurchasePanel();


    showMessage(
        product +
        " réapprovisionné (+" +
        quantity +
        ")."
    );


    return true;

}


document
    .getElementById("stockButton")
    .addEventListener(
        "click",
        () => {

            updateStockPurchasePanel();

            stockPanel.classList.add("visible");

        }
    );


document
    .getElementById("closeStock")
    .addEventListener(
        "click",
        () => {

            stockPanel.classList.remove("visible");

        }
    );


stockPurchaseList.addEventListener(
    "input",
    event => {
        if (
            !event.target.classList.contains(
                "stockQuantity"
            )
        ) {
            return;
        }


        updatePurchaseCost(
            event.target.closest(
                ".stockPurchaseCard"
            )
        );

    }
);


stockPurchaseList.addEventListener(
    "click",
    event => {

        if (event.target.id === "transferStockButton") {
            const resolve = id => id === "player" ? { inventory: game.playerInventory, capacity: Infinity } : getApartmentById(id);
            const source = resolve(stockPurchaseList.querySelector("#stockTransferSource")?.value);
            const target = resolve(stockPurchaseList.querySelector("#stockTransferDestination")?.value);
            const product = stockPurchaseList.querySelector("#stockTransferProduct")?.value;
            const quantity = Number(stockPurchaseList.querySelector("#stockTransferQuantity")?.value);
            if (!source || !target || source === target || !transferInventory(source, target, product, quantity)) showMessage("Transfert impossible : stock ou capacité insuffisante.");
            else { showMessage(`${product} × ${quantity} transféré.`); updateStockPurchasePanel(); }
            return;
        }

        if (
            !event.target.classList.contains(
                "buyStockButton"
            )
        ) {
            return;
        }


        const card =
            event.target.closest(
                ".stockPurchaseCard"
            );

        const input =
            card.querySelector(".stockQuantity");


        buyStock(
            card.dataset.product,
            getPurchaseQuantity(input),
            stockPurchaseList.querySelector("#stockDeliveryApartment")?.value || null
        );

    }
);
