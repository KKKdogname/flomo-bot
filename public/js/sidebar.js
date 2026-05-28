const Sidebar = {
  listEl: null,
  conversations: [],

  init() {
    this.listEl = document.getElementById("conversation-list");
    document.getElementById("btn-new-chat").addEventListener("click", () => this.createConversation());
    document.getElementById("btn-toggle-sidebar").addEventListener("click", () => this.toggle());
  },

  async load() {
    const conversations = await API.getConversations();
    this.conversations = conversations;
    this.render();
  },

  render() {
    this.listEl.innerHTML = "";

    if (this.conversations.length === 0) {
      this.listEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--sidebar-muted);font-size:13px;">暂无对话</div>';
      return;
    }

    for (const conv of this.conversations) {
      const el = document.createElement("div");
      el.className = "conversation-item";
      if (conv.id === App.currentConversationId) {
        el.classList.add("active");
      }

      el.innerHTML = `
        <span class="title">${this.escapeHtml(conv.title || "New Conversation")}</span>
        <button class="delete-btn" title="Delete">×</button>
      `;

      el.querySelector(".title").addEventListener("click", () => {
        App.switchConversation(conv.id);
      });

      el.querySelector(".delete-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteConversation(conv.id);
      });

      this.listEl.appendChild(el);
    }
  },

  async createConversation() {
    try {
      const conv = await API.createConversation();
      await this.load();
      await App.switchConversation(conv.id);
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  },

  async deleteConversation(id) {
    if (!confirm("确定要删除这个对话吗？")) return;

    try {
      await API.deleteConversation(id);
      if (App.currentConversationId === id) {
        App.currentConversationId = null;
        App.clearMessages();
        App.showWelcome();
      }
      await this.load();
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  },

  toggle() {
    document.getElementById("sidebar").classList.toggle("collapsed");
  },

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },
};
