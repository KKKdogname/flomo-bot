import { Router } from "express";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = join(__dirname, "..", "data", "settings.json");

const DEFAULT_SETTINGS = {
  aiProvider: null, // null = no AI, "deepseek" = DeepSeek
  aiApiKey: "",
  aiModel: "deepseek-chat",
};

function readSettings() {
  try {
    if (existsSync(SETTINGS_PATH)) {
      return JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    }
  } catch (_) {
    // corrupted file, use defaults
  }
  return { ...DEFAULT_SETTINGS };
}

function writeSettings(settings) {
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

const router = Router();

// Get config (mask API key)
router.get("/", (_req, res) => {
  const settings = readSettings();
  res.json({
    aiProvider: settings.aiProvider,
    aiModel: settings.aiModel,
    hasApiKey: !!settings.aiApiKey,
  });
});

// Update config
router.put("/", (req, res) => {
  try {
    const settings = readSettings();

    if (req.body.aiProvider !== undefined) {
      settings.aiProvider = req.body.aiProvider;
    }
    if (req.body.aiModel !== undefined) {
      settings.aiModel = req.body.aiModel;
    }
    if (req.body.aiApiKey !== undefined && req.body.aiApiKey !== "") {
      settings.aiApiKey = req.body.aiApiKey;
    }

    writeSettings(settings);

    res.json({
      aiProvider: settings.aiProvider,
      aiModel: settings.aiModel,
      hasApiKey: !!settings.aiApiKey,
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

export { readSettings, writeSettings };
export default router;
