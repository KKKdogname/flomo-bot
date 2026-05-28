const App = {
  currentConversationId: null,

  async init() {
    Sidebar.init();
    Chat.init();
    Settings.init();

    await this.loadConfig();

    // Load conversations and auto-open the most recent one
    try {
      const conversations = await API.getConversations();
      if (conversations.length > 0) {
        await Sidebar.load();
        await this.switchConversation(conversations[0].id);
      } else {
        Sidebar.render();
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
      Sidebar.render();
    }
  },

  async loadConfig() {
    try {
      const config = await API.getConfig();
      const badge = document.getElementById("provider-badge");
      if (config.aiProvider) {
        badge.textContent = config.aiProvider === "deepseek" ? "DeepSeek AI" : config.aiProvider;
        badge.className = "";
      } else {
        badge.textContent = "命令模式";
        badge.className = "no-ai";
      }
    } catch (err) {
      console.error("Failed to load config:", err);
    }
  },

  async switchConversation(id) {
    this.currentConversationId = id;

    try {
      const conv = await API.getConversation(id);
      document.getElementById("conversation-title").textContent =
        conv.title || "New Conversation";

      if (conv.messages && conv.messages.length > 0) {
        Chat.renderMessages(conv.messages);
      } else {
        Chat.showWelcome();
      }
    } catch (err) {
      console.error("Failed to switch conversation:", err);
      Chat.showWelcome();
    }

    Sidebar.render();
    Chat.input.focus();
  },

  clearMessages() {
    Chat.clearMessages();
  },

  showWelcome() {
    Chat.showWelcome();
    document.getElementById("conversation-title").textContent = "flomo Chat";
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
