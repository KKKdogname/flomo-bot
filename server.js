import "dotenv/config";
import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { getDb } from "./store/database.js";
import { McpClient } from "./mcp/client.js";
import { FlomoService } from "./services/flomoService.js";
import { NoAIProvider } from "./services/providers/noAIProvider.js";
import { DeepSeekProvider } from "./services/providers/deepseekProvider.js";
import { initChatRouter } from "./routes/chat.js";
import conversationsRouter from "./routes/conversations.js";
import configRouter, { readSettings } from "./routes/config.js";
import { initScheduler, triggerNow } from "./services/scheduler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MCP_URL = process.env.FLOMO_MCP_URL || "https://flomoapp.com/mcp";
const MCP_TOKEN = process.env.FLOMO_MCP_TOKEN;

if (!MCP_TOKEN) {
  console.error("FLOMO_MCP_TOKEN is required in .env");
  process.exit(1);
}

// Initialize MCP client and Flomo service
const mcpClient = new McpClient(MCP_URL, MCP_TOKEN);
const flomoService = new FlomoService(mcpClient);

// Provider management
function createProvider() {
  const settings = readSettings();

  if (settings.aiProvider === "deepseek" && settings.aiApiKey) {
    console.log("Using DeepSeek AI provider");
    return new DeepSeekProvider(flomoService, {
      apiKey: settings.aiApiKey,
      model: settings.aiModel || "deepseek-chat",
    });
  }

  console.log("Using No-AI (command parser) provider");
  return new NoAIProvider(flomoService);
}

function getProvider() {
  // Always create fresh provider to pick up config changes
  return createProvider();
}

// Create Express app
const app = express();
app.use(express.json());

// API routes
app.use("/api/conversations", conversationsRouter);
app.use("/api/chat", initChatRouter(flomoService, getProvider));
app.use("/api/config", configRouter);

// Manual trigger for daily compliment (testing)
app.post("/api/compliment", async (_req, res) => {
  try {
    await triggerNow();
    res.json({ success: true, message: "Compliment generated and saved to flomo." });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Serve static frontend
app.use(express.static(join(__dirname, "public")));

// SPA fallback — serve index.html for any non-API, non-static request
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  // Static files are handled by express.static above; if we get here it's a SPA route
  res.sendFile(join(__dirname, "public", "index.html"));
});

// Start server
async function start() {
  // Initialize database (sql.js async init)
  console.log("Initializing database...");
  await getDb();
  console.log("Database ready.");

  try {
    console.log("Connecting to flomo MCP server...");
    const serverInfo = await mcpClient.initialize();
    console.log(
      `Connected! Server: ${serverInfo.serverInfo?.name || "flomo"} v${serverInfo.protocolVersion || "?"}`
    );

    // Start daily compliment scheduler
    initScheduler(flomoService, getProvider);

    app.listen(PORT, () => {
      console.log(`flomo Chat running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to initialize MCP client:", err.message);
    console.log("Starting server without flomo connection (some features may not work)");

    app.listen(PORT, () => {
      console.log(`flomo Chat running at http://localhost:${PORT} (offline mode)`);
    });
  }
}

start();
