const API = {
  async getConversations() {
    const res = await fetch("/api/conversations");
    if (!res.ok) throw new Error("Failed to load conversations");
    return res.json();
  },

  async createConversation(title) {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error("Failed to create conversation");
    return res.json();
  },

  async getConversation(id) {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) throw new Error("Failed to load conversation");
    return res.json();
  },

  async deleteConversation(id) {
    const res = await fetch(`/api/conversations/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete conversation");
    return res.json();
  },

  async sendMessage(conversationId, message) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, message }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to send message");
    }
    return res.json();
  },

  async getConfig() {
    const res = await fetch("/api/config");
    if (!res.ok) throw new Error("Failed to load config");
    return res.json();
  },

  async updateConfig(config) {
    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error("Failed to save config");
    return res.json();
  },
};
