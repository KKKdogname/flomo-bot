export class McpClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.requestId = 0;
    this.sessionId = null;
    this.initialized = false;
    this.serverInfo = null;
    this.capabilities = null;
  }

  get isReady() {
    return this.initialized;
  }

  async initialize() {
    const response = await this._request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      clientInfo: { name: "flomo-chat", version: "1.0.0" },
    });

    this.capabilities = response.capabilities;
    this.serverInfo = response.serverInfo;

    // Send initialized notification
    await this._sendNotification("notifications/initialized");

    this.initialized = true;
    return response;
  }

  async listTools() {
    this._ensureInitialized();
    const response = await this._request("tools/list");
    return response.tools || [];
  }

  async callTool(name, args = {}) {
    this._ensureInitialized();
    return await this._request("tools/call", {
      name,
      arguments: args,
    });
  }

  async _request(method, params) {
    const id = ++this.requestId;
    const payload = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    const result = await this._send(payload);
    if (result.error) {
      const err = new Error(
        `MCP error ${result.error.code}: ${result.error.message}`
      );
      err.code = result.error.code;
      err.data = result.error.data;
      throw err;
    }

    return result.result;
  }

  async _sendNotification(method, params = {}) {
    const id = ++this.requestId;
    const payload = {
      jsonrpc: "2.0",
      method,
      params,
    };

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${this.token}`,
    };
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const respSessionId = response.headers.get("Mcp-Session-Id");
      if (respSessionId) {
        this.sessionId = respSessionId;
      }

      // Notifications get 202 with empty body — no parsing needed
    } finally {
      clearTimeout(timeout);
    }
  }

  async _send(payload) {
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      Authorization: `Bearer ${this.token}`,
    };

    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      // Track session ID from response headers
      const respSessionId = response.headers.get("Mcp-Session-Id");
      if (respSessionId) {
        this.sessionId = respSessionId;
      }

      if (!response.ok) {
        if (response.status === 404 && this.initialized) {
          this.initialized = false;
          this.sessionId = null;
          await this.initialize();
          return this._send(payload);
        }
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
      }

      const text = await response.text();

      // Handle empty response (e.g., 202 Accepted for notifications)
      if (!text || !text.trim()) {
        return null;
      }

      return this._parseSSE(text);
    } finally {
      clearTimeout(timeout);
    }
  }

  _parseSSE(text) {
    // Parse Server-Sent Events format
    // Lines start with "event:" or "data:"
    const lines = text.split("\n");
    let eventType = null;
    let dataStr = null;

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.substring(7).trim();
      } else if (line.startsWith("data: ")) {
        dataStr = line.substring(6).trim();
      }
    }

    if (dataStr) {
      try {
        return JSON.parse(dataStr);
      } catch {
        throw new Error(`Failed to parse SSE data: ${dataStr.substring(0, 200)}`);
      }
    }

    // If no SSE format detected, try parsing as plain JSON
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Failed to parse MCP response: ${text.substring(0, 200)}`);
    }
  }

  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error("MCP client not initialized. Call initialize() first.");
    }
  }
}
