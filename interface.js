// Navigation visuelle uniquement. Les formulaires gardent leur DOM pendant l'édition.
const interfaceState = { activePanel: null, panels: new Map(), history: [] };
function rememberMainPanel() {
    const panel = document.getElementById(interfaceState.activePanel);
    if (!panel) return;
    interfaceState.panels.set(panel.id, { scrollTop: panel.lastElementChild.scrollTop });
}
function closeMainPanel(id = interfaceState.activePanel) {
    if (!id) return;
    if (interfaceState.activePanel === id) {
        rememberMainPanel();
        interfaceState.activePanel = null;
    }
    document.getElementById(id)?.classList.remove("visible");
}
function openMainPanel(id, { back = false } = {}) {
    fitMainPanels();
    if (typeof closeCustomerPanel === "function") closeCustomerPanel();
    if (interfaceState.activePanel !== id) {
        const previous = interfaceState.activePanel;
        closeMainPanel();
        if (back && previous) interfaceState.history.push(previous);
        else if (!back) interfaceState.history = [];
    }
    document.querySelectorAll(".sidePanel.visible").forEach(panel => {
        if (panel.id !== id) panel.classList.remove("visible");
    });
    const panel = document.getElementById(id);
    interfaceState.activePanel = id;
    panel.classList.add("visible");
    panel.lastElementChild.scrollTop = interfaceState.panels.get(id)?.scrollTop || 0;
}
function backMainPanel() {
    if (!interfaceState.activePanel) return;
    if (interfaceState.activePanel === "employeesPanel") {
        const section = document.querySelector("[data-employee-detail] details[open]");
        if (section) { section.open = false; employeesList.scrollTop = 0; return; }
        if (selectedEmployeeId) { selectedEmployeeId = null; updateEmployeesPanel(); return; }
    }
    const previous = interfaceState.history.pop();
    closeMainPanel();
    if (previous) openMainPanel(previous, { back: true });
}
function fitMainPanels() {
    const top = document.getElementById("dayUI")?.getBoundingClientRect().bottom || 0;
    const bottom = document.getElementById("bottomMenu").getBoundingClientRect().top;
    document.documentElement.style.setProperty("--panel-top", `${Math.ceil(top)}px`);
    document.documentElement.style.setProperty("--panel-bottom", `${Math.ceil(innerHeight - bottom)}px`);
}
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".sidePanel").forEach(panel => {
        const header = panel.querySelector(".panelHeader");
        header.querySelector("button").setAttribute("aria-label", "Fermer la fenêtre");
        const back = document.createElement("button");
        back.type = "button"; back.textContent = "‹"; back.setAttribute("aria-label", "Retour");
        back.addEventListener("click", backMainPanel); header.prepend(back);
    });
    document.getElementById("mapButton").addEventListener("click", () => {
        closeMainPanel(); closeCustomerPanel();
    });
    document.getElementById("stockSummaryButton")?.addEventListener("click", () => {
        document.getElementById("stockButton")?.click();
    });
    document.getElementById("mapViewport")?.addEventListener("click", event => {
        if (event.target.closest("#customerPanel, button, input, select, label")) return;
        if (typeof closeCustomerPanel === "function") closeCustomerPanel();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") { closeCustomerPanel(); backMainPanel(); }
    });
    if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(fitMainPanels);
        observer.observe(document.getElementById("game"));
        for (const id of ["topbar", "dayUI", "bottomMenu"]) observer.observe(document.getElementById(id), { box: "border-box" });
    }
    fitMainPanels();
});
window.addEventListener("resize", fitMainPanels);
