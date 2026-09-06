// Sans assets : registre vide et appels silencieux. Aucune boucle audio parallèle.
const AudioSystem = {
    unlocked: false,
    assets: new Map(),
    playing: new Set(),
    categories: Object.freeze(["ambient", "ui", "events", "police"]),
    register(category, name, source) {
        if (!this.categories.includes(category) || typeof source !== "string") return false;
        this.assets.set(`${category}:${name}`, source); return true;
    },
    settings() {
        game.audioSettings = game.audioSettings || { enabled: false, ambient: .4, ui: .6, events: .6, police: .6 };
        return game.audioSettings;
    },
    setVolume(category, value) {
        if (!this.categories.includes(category) || !Number.isFinite(value)) return false;
        this.settings()[category] = Math.max(0, Math.min(1, value));
        for (const sound of this.playing) if (sound.category === category) sound.audio.volume = this.settings()[category];
        requestSave(); return true;
    },
    play(category, name) {
        const source = this.assets.get(`${category}:${name}`), settings = this.settings();
        if (!this.unlocked || !settings.enabled || !source || this.playing.size >= 6) return false;
        const audio = new Audio(source), sound = { category, audio };
        audio.volume = settings[category]; this.playing.add(sound);
        const done = () => this.playing.delete(sound);
        audio.addEventListener("ended", done, { once: true }); audio.addEventListener("error", done, { once: true });
        audio.play().catch(done); return true;
    },
    stopAll() { for (const sound of this.playing) sound.audio.pause(); this.playing.clear(); }
};
document.addEventListener("pointerdown", () => { AudioSystem.unlocked = true; }, { once: true });
function renderAudioSettings(target) {
    const settings = AudioSystem.settings(), details = document.createElement("details"); details.className = "employeeCard";
    details.innerHTML = `<summary>AUDIO</summary><p>Préparé pour de futurs sons ; aucun son n'est fourni actuellement.</p><label><input type="checkbox" id="audioEnabled" ${settings.enabled ? "checked" : ""}> Activer les sons</label>${AudioSystem.categories.map(category => `<label class="stockPurchaseLabel">${{ ambient: "Ambiance", ui: "Interface", events: "Événements", police: "Police" }[category]}<input type="range" data-audio="${category}" min="0" max="1" step=".05" value="${settings[category]}"></label>`).join("")}`;
    details.querySelector("#audioEnabled").addEventListener("change", event => { settings.enabled = event.target.checked; if (!settings.enabled) AudioSystem.stopAll(); requestSave(); });
    details.querySelectorAll("[data-audio]").forEach(input => input.addEventListener("input", () => AudioSystem.setVolume(input.dataset.audio, Number(input.value))));
    target.appendChild(details);
}
