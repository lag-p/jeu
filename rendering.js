// Adaptateur de carte CSS. Les règles métier manipulent des entités ; cet
// objet concentre la création, la position et la suppression de leurs visuels.
const MapRenderer = {
    create(entity, className, symbol, onSelect = null) {
        const element = document.createElement("div");
        element.className = className; element.textContent = symbol; entity.element = element;
        if (onSelect) element.addEventListener("click", event => { event.stopPropagation(); onSelect(entity); });
        map.appendChild(element); this.position(entity); return element;
    },
    position(entity) {
        const element = entity.element;
        if (!element) return;
        const left = `${entity.x}%`, top = `${entity.y}%`;
        if (element.style.left !== left) element.style.left = left;
        if (element.style.top !== top) element.style.top = top;
    },
    remove(entity) { entity?.element?.remove(); },
    frame() {
        this.position({ x: game.playerX, y: game.playerY, element: player });
        [...game.employees, ...customers, ...police.patrols].forEach(entity => this.position(entity));
    }
};

function selectCustomer(customer) {
    selectedCustomer = customer; updateCustomerPanel(customer); customerPanel.style.display = "block";
}
function selectEmployee(employee) {
    selectedEmployeeId = employee.id; showWatcherRadius(employee);
    employeesPanel.classList.add("visible"); updateEmployeesPanel();
}
function renderGameFrame(delta) {
    MapRenderer.frame();
    updateDayUI();
    updateManagementRealtime(delta);
}
