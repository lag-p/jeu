// ===============================
// EMPLOYES
// ===============================

const employeeTypes = {

    vendeur: {

        name: "Vendeur",

        icon: "👤",

        cost: 100,

        description:
            "Sert automatiquement les clients proches.",

        speed: 4

    },


    guetteur: {

        name: "Guetteur",

        icon: "👁️",

        cost: 150,

        description:
            "Réduit le niveau d'alerte du quartier.",

        speed: 0

    }

};


let placementMode = null;


// ===============================
// PANNEAU EMPLOYES
// ===============================

const employeesPanel =
    document.getElementById(
        "employeesPanel"
    );

const closeEmployees =
    document.getElementById(
        "closeEmployees"
    );

const employeesList =
    document.getElementById(
        "employeesList"
    );


document
    .getElementById("employeesButton")
    .addEventListener(
        "click",
        () => {

            employeesPanel.classList.add(
                "visible"
            );

            updateEmployeesPanel();

        }
    );


closeEmployees.addEventListener(
    "click",
    () => {

        employeesPanel.classList.remove(
            "visible"
        );

    }
);


// ===============================
// AFFICHAGE
// ===============================

function updateEmployeesPanel() {

    employeesList.innerHTML = "";


    Object.entries(
        employeeTypes
    ).forEach(
        ([type, data]) => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "employeeCard";


            card.innerHTML = `

                <div class="employeeTitle">

                    <span>
                        ${data.icon}
                    </span>

                    <strong>
                        ${data.name}
                    </strong>

                </div>

                <p>
                    ${data.description}
                </p>

                <button
                    onclick="buyEmployee('${type}')"
                >
                    Recruter · ${data.cost} €
                </button>

            `;


            employeesList.appendChild(
                card
            );

        }
    );


    const count =
        document.createElement(
            "p"
        );


    count.className =
        "employeeCount";


    count.textContent =
        `Employés : ${game.employees.length}`;


    employeesList.appendChild(
        count
    );

}


// ===============================
// ACHETER
// ===============================

function buyEmployee(type) {

    const data =
        employeeTypes[type];


    if (game.money < data.cost) {

        showMessage(
            "Pas assez d'argent."
        );

        return;

    }


    game.money -=
        data.cost;


    game.dailyExpenses +=
        data.cost;


    placementMode =
        type;


    employeesPanel.classList.remove(
        "visible"
    );


    showMessage(
        `Place ton ${data.name.toLowerCase()} sur la carte.`
    );


    updateUI();

}

// ===============================
// PLACER
// ===============================

function placeEmployee(x, y) {

    if (!placementMode) {
        return false;
    }


    const type =
        placementMode;


    const data =
        employeeTypes[type];


    const employee = {

        id:
            Date.now() +
            Math.random(),

        type:
            type,

        name:
            data.name,

        icon:
            data.icon,

        x:
            x,

        y:
            y,

        speed:
            data.speed,

        cooldown:
            0,

        element:
            null

    };


    game.employees.push(
        employee
    );


    createEmployeeVisual(
        employee
    );


    placementMode =
        null;


    showMessage(
        `${data.name} placé.`
    );


    updateEmployeesPanel();

    updateUI();


    return true;

}


// ===============================
// VISUEL EMPLOYE
// ===============================

function createEmployeeVisual(
    employee
) {

    const element =
        document.createElement(
            "div"
        );


    element.className =
        "employee";


    element.textContent =
        employee.icon;


    element.style.left =
        employee.x + "%";


    element.style.top =
        employee.y + "%";


    element.dataset.employeeId =
        employee.id;


    element.addEventListener(
        "click",
        (event) => {

            event.stopPropagation();


            showMessage(
                `${employee.name} · Niveau 1`
            );

        }
    );


    map.appendChild(
        element
    );


    employee.element =
        element;

}


// ===============================
// IA VENDEURS
// ===============================

setInterval(
    () => {

        if (!game.employees) {
            return;
        }


        game.employees.forEach(
            employee => {

                if (
                    employee.type !==
                    "vendeur"
                ) {

                    return;

                }


                if (
                    employee.cooldown > 0
                ) {

                    employee.cooldown--;

                    return;

                }


                const target =
                    findNearestCustomer(
                        employee
                    );


                if (!target) {
                    return;
                }


                serveCustomerAutomatically(
                    employee,
                    target
                );


                employee.cooldown =
                    employee.speed;

            }
        );

    },
    1000
);


// ===============================
// CHERCHER CLIENT PROCHE
// ===============================

function findNearestCustomer(
    employee
) {

    if (!Array.isArray(customers)) {
    return null;
}


    let nearest =
        null;


    let nearestDistance =
        Infinity;


    customers.forEach(
        customer => {

            if (
                customer.state !==
                "waiting"
            ) {

                return;

            }


            const dx =
                customer.x -
                employee.x;


            const dy =
                customer.y -
                employee.y;


            const distance =
                Math.sqrt(
                    dx * dx +
                    dy * dy
                );


            if (
                distance <
                nearestDistance
            ) {

                nearestDistance =
                    distance;


                nearest =
                    customer;

            }

        }
    );


    // Rayon d'action du vendeur
    if (
        nearestDistance > 25
    ) {

        return null;

    }


    return nearest;

}


// ===============================
// VENTE AUTOMATIQUE
// ===============================

function serveCustomerAutomatically(
    employee,
    customer
) {

    if (
        customer.state !==
        "waiting"
    ) {

        return;

    }


    const sale =
        resolveSale(
            customer,
            {
                preserveSelectedCustomerOnSuccess: true
            }
        );


    if (!sale.success) {
        return;
    }


    updateUI();

}
