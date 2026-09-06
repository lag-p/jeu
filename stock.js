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


function buyStock(product, quantity) {

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

    const apartment = getActiveApartment();

    const currentStock = apartment
        ? getInventoryQuantity(apartment, product)
        : getAvailableProductStock(product);


    if (
        !game.stock ||
        typeof game.stock !== "object" ||
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

        game.stock[product] =
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
            getPurchaseQuantity(input)
        );

    }
);
