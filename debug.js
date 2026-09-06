// Aucun contrôle n'est créé lorsque DEBUG est false.
function renderDebugPanel() {
    if (!DEBUG) return;
    const target = document.getElementById("managementContent"), card = document.createElement("div");
    card.id = "debugPanel"; card.className = "employeeCard";
    card.innerHTML = `<strong>DEBUG</strong><p>${customers.length} clients · ${mapData.navigation.nodes.length} nœuds · ${game.logisticsMissions.length} missions</p><label>Vitesse<select id="debugSpeed">${[.5, 1, 2, 4].map(speed => `<option value="${speed}" ${speed === (game.simulationSpeed || 1) ? "selected" : ""}>×${speed}</option>`).join("")}</select></label><select id="debugEvent">${Object.keys(EVENT_CONFIG).map(type => `<option>${type}</option>`).join("")}</select><button id="debugTrigger">Générer événement</button><button id="debugMoney">+1 000 € test</button><button id="debugStock">+10 de chaque produit test</button>`;
    target.appendChild(card);
    card.querySelector("#debugSpeed").addEventListener("change", event => { game.simulationSpeed = Number(event.target.value); });
    card.querySelector("#debugTrigger").addEventListener("click", () => { activateEvent(card.querySelector("#debugEvent").value, 30); renderManagementPanel(); });
    card.querySelector("#debugMoney").addEventListener("click", () => { game.money += 1000; updateUI(); renderManagementPanel(); });
    card.querySelector("#debugStock").addEventListener("click", () => { Object.keys(PRODUCT_CONFIG).forEach(p => { game.playerInventory[p] += 10; }); updateUI(); });
}
