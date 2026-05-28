// Settings modal management
const Settings = {
  modal: null,
  apiKeyStatus: null,
  modelGroup: null,

  init() {
    this.modal = document.getElementById("settings-modal");
    this.apiKeyStatus = document.getElementById("api-key-status");
    this.modelGroup = document.getElementById("model-group");

    document.getElementById("btn-settings").addEventListener("click", () => this.open());
    document.getElementById("btn-close-settings").addEventListener("click", () => this.close());
    document.getElementById("btn-save-settings").addEventListener("click", () => this.save());
    document.querySelector("#settings-modal .modal-backdrop").addEventListener("click", () => this.close());

    document.getElementById("setting-provider").addEventListener("change", (e) => {
      this.modelGroup.style.display = e.target.value ? "block" : "none";
    });
  },

  async open() {
    const config = await API.getConfig();
    document.getElementById("setting-provider").value = config.aiProvider || "";
    document.getElementById("setting-api-key").value = "";
    document.getElementById("setting-model").value = config.aiModel || "deepseek-chat";
    this.apiKeyStatus.textContent = config.hasApiKey ? "(已设置)" : "(未设置)";
    this.modelGroup.style.display = config.aiProvider ? "block" : "none";
    this.modal.classList.remove("hidden");
  },

  close() {
    this.modal.classList.add("hidden");
  },

  async save() {
    const provider = document.getElementById("setting-provider").value;
    const apiKey = document.getElementById("setting-api-key").value;
    const model = document.getElementById("setting-model").value;

    const config = { aiProvider: provider || null, aiModel: model };
    if (apiKey) config.aiApiKey = apiKey;

    await API.updateConfig(config);
    this.close();

    // Reload app state
    if (typeof App !== "undefined") {
      App.loadConfig();
    }
  },
};
