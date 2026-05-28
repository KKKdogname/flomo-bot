const Chat = {
  messageList: null,
  input: null,
  sendBtn: null,
  isLoading: false,

  init() {
    this.messageList = document.getElementById("message-list");
    this.input = document.getElementById("message-input");
    this.sendBtn = document.getElementById("btn-send");

    this.sendBtn.addEventListener("click", () => this.sendMessage());
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.input.addEventListener("input", () => {
      this.input.style.height = "auto";
      this.input.style.height = Math.min(this.input.scrollHeight, 150) + "px";
      this.sendBtn.disabled = !this.input.value.trim() || this.isLoading;
    });

    // Suggestion chips
    document.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        this.input.value = chip.dataset.text;
        this.input.style.height = "auto";
        this.input.style.height = Math.min(this.input.scrollHeight, 150) + "px";
        this.sendBtn.disabled = false;
        this.sendMessage();
      });
    });
  },

  async sendMessage() {
    const message = this.input.value.trim();
    if (!message || this.isLoading) return;

    if (!App.currentConversationId) {
      await Sidebar.createConversation();
    }

    if (!App.currentConversationId) return;

    this.setLoading(true);

    // Hide welcome message
    const welcome = this.messageList.querySelector(".welcome-message");
    if (welcome) welcome.remove();

    // Render user message immediately
    this.renderMessage("user", message);
    this.input.value = "";
    this.input.style.height = "auto";
    this.sendBtn.disabled = true;
    this.scrollToBottom();

    // Show typing indicator
    const typingEl = this.renderTypingIndicator();

    try {
      const response = await API.sendMessage(App.currentConversationId, message);
      // Remove typing indicator
      typingEl.remove();

      // Render assistant response
      this.renderMessage("assistant", response.reply, response.metadata);

      // Update sidebar title
      Sidebar.load();
    } catch (err) {
      typingEl.remove();
      this.renderMessage("error", `**Error**: ${err.message}`);
    } finally {
      this.setLoading(false);
      this.input.focus();
    }
  },

  renderMessage(role, content, metadata = {}) {
    const el = document.createElement("div");
    el.className = `message ${role}`;

    const avatarMap = { user: "U", assistant: "F", error: "!" };
    const avatar = avatarMap[role] || "?";

    el.innerHTML = `
      <div class="avatar">${avatar}</div>
      <div class="content">${renderMarkdown(content)}</div>
    `;

    if (metadata && Object.keys(metadata).length > 0 && role === "assistant") {
      const badge = document.createElement("span");
      badge.className = "meta-badge";
      badge.textContent = metadata.intent || "";
      el.querySelector(".content").appendChild(badge);
    }

    this.messageList.appendChild(el);
    this.scrollToBottom();
    return el;
  },

  renderTypingIndicator() {
    const el = document.createElement("div");
    el.className = "message assistant";
    el.innerHTML = `
      <div class="avatar">F</div>
      <div class="content">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    this.messageList.appendChild(el);
    this.scrollToBottom();
    return el;
  },

  renderMessages(messages) {
    this.clearMessages();
    for (const msg of messages) {
      let metadata = {};
      try {
        metadata = JSON.parse(msg.metadata || "{}");
      } catch (_) {}
      this.renderMessage(msg.role, msg.content, metadata);
    }
  },

  clearMessages() {
    this.messageList.innerHTML = "";
  },

  showWelcome() {
    this.clearMessages();
    this.messageList.innerHTML = `
      <div class="welcome-message">
        <h1>flomo Chat</h1>
        <p>用自然语言与你的 flomo 笔记对话。</p>
        <div class="suggestion-chips">
          <button class="chip" data-text="今天回顾">今天回顾</button>
          <button class="chip" data-text="搜索心理学">搜索心理学</button>
          <button class="chip" data-text="我的标签">我的标签</button>
          <button class="chip" data-text="创建笔记：今天学到了">创建笔记：今天学到了</button>
        </div>
        <p class="help-hint">输入 "帮助" 查看所有支持的操作</p>
      </div>
    `;
    // Rebind suggestion chip events
    document.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        this.input.value = chip.dataset.text;
        this.input.style.height = "auto";
        this.input.style.height = Math.min(this.input.scrollHeight, 150) + "px";
        this.sendBtn.disabled = false;
        this.sendMessage();
      });
    });
  },

  setLoading(loading) {
    this.isLoading = loading;
    this.sendBtn.disabled = loading || !this.input.value.trim();
    this.input.disabled = loading;
  },

  scrollToBottom() {
    this.messageList.scrollTop = this.messageList.scrollHeight;
  },
};
