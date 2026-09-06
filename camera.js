// Caméra uniquement visuelle ; les coordonnées de simulation restent en pourcentage.
const camera = { zoom: 1, x: 0, y: 0, min: GAME_CONFIG.zoomMin, max: GAME_CONFIG.zoomMax, suppressClick: false };
const viewport = document.createElement("div");
viewport.id = "mapViewport";
map.parentNode.insertBefore(viewport, map);
viewport.appendChild(map);
for (const id of ["customerPanel", "message"]) viewport.appendChild(document.getElementById(id));
const cameraControls = document.createElement("div");
cameraControls.id = "cameraControls";
cameraControls.innerHTML = '<button data-zoom="1.2" aria-label="Zoom avant">+</button><button data-zoom="0.833333" aria-label="Zoom arrière">−</button><button id="centerPlayer">◎ Joueur</button>';
viewport.appendChild(cameraControls);

function applyCamera() {
    const width = viewport.clientWidth || 100, height = viewport.clientHeight || 100;
    camera.zoom = Math.max(camera.min, Math.min(camera.max, camera.zoom));
    const constrain = (offset, length) => camera.zoom < 1 ? length * (1 - camera.zoom) / 2 : Math.max(length * (1 - camera.zoom), Math.min(0, offset));
    camera.x = constrain(camera.x, width); camera.y = constrain(camera.y, height);
    map.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
}

function zoomCamera(factor, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2) {
    const next = Math.max(camera.min, Math.min(camera.max, camera.zoom * factor));
    camera.x = x - (x - camera.x) * next / camera.zoom;
    camera.y = y - (y - camera.y) * next / camera.zoom;
    camera.zoom = next; applyCamera();
}

function centerCamera(position) {
    camera.x = viewport.clientWidth / 2 - position.x / 100 * viewport.clientWidth * camera.zoom;
    camera.y = viewport.clientHeight / 2 - position.y / 100 * viewport.clientHeight * camera.zoom;
    applyCamera();
}

cameraControls.addEventListener("click", event => {
    if (event.target.dataset.zoom) zoomCamera(Number(event.target.dataset.zoom));
    else if (event.target.id === "centerPlayer") centerCamera({ x: game.playerX, y: game.playerY });
});
viewport.addEventListener("wheel", event => { if (event.target.closest("#customerPanel")) return; event.preventDefault(); const rect = viewport.getBoundingClientRect(); zoomCamera(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX - rect.left, event.clientY - rect.top); }, { passive: false });
const cameraPointers = new Map();
let pinchDistance = null;
viewport.addEventListener("pointerdown", event => {
    if (event.target.closest("button, #customerPanel, #mapPlacementControls")) return;
    cameraPointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
    if (cameraPointers.size === 1) camera.suppressClick = false;
    pinchDistance = null;
});
viewport.addEventListener("pointermove", event => {
    const previous = cameraPointers.get(event.pointerId); if (!previous) return;
    const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
    cameraPointers.set(event.pointerId, { ...previous, x: event.clientX, y: event.clientY });
    if (cameraPointers.size === 2) {
        const [a, b] = [...cameraPointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
        const rect = viewport.getBoundingClientRect();
        if (pinchDistance) zoomCamera(distance / pinchDistance, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
        pinchDistance = distance; camera.suppressClick = true;
    } else if (Math.hypot(event.clientX - previous.startX, event.clientY - previous.startY) > 6) {
        camera.x += dx; camera.y += dy; camera.suppressClick = true; applyCamera();
    }
});
for (const type of ["pointerup", "pointercancel"]) window.addEventListener(type, event => { cameraPointers.delete(event.pointerId); pinchDistance = null; });
viewport.addEventListener("click", event => {
    if (camera.suppressClick && !event.target.closest("button")) { event.preventDefault(); event.stopImmediatePropagation(); camera.suppressClick = false; }
}, true);
window.addEventListener("resize", applyCamera);
applyCamera();
