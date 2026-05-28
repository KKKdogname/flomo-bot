// Daily Praise Script — runs on GitHub Actions, no local server needed
// Connects to flomo MCP, reads today's notes, generates praise via DeepSeek

import { McpClient } from "./mcp/client.js";
import { FlomoService } from "./services/flomoService.js";

// Try loading .env for local testing; in GitHub Actions env vars are set directly
try {
  await import("dotenv/config");
} catch (_) {
  // dotenv not installed — fine, use process.env directly
}

const MCP_URL = process.env.FLOMO_MCP_URL || "https://flomoapp.com/mcp";
const MCP_TOKEN = process.env.FLOMO_MCP_TOKEN;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!MCP_TOKEN) {
  console.error("FLOMO_MCP_TOKEN is required");
  process.exit(1);
}
if (!DEEPSEEK_API_KEY) {
  console.error("DEEPSEEK_API_KEY is required");
  process.exit(1);
}

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function deepseekChat(messages) {
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function main() {
  console.log("[Daily Praise] Starting...");

  // Connect to flomo MCP
  const mcpClient = new McpClient(MCP_URL, MCP_TOKEN);
  await mcpClient.initialize();
  const flomo = new FlomoService(mcpClient);

  const today = todayStr();
  console.log(`[Daily Praise] Date: ${today}`);

  // Search today's notes
  const todaysNotes = await flomo.searchNotes("", {
    start_date: today,
    end_date: today,
    limit: 50,
  });

  // If no notes today, create reminder and exit
  if (!todaysNotes || todaysNotes.length === 0) {
    await flomo.createNote(
      "今天还没有记录笔记，明天加油。\n\n#010.日记/夸奖",
      { created_at: today }
    );
    console.log("[Daily Praise] No notes today. Created reminder note.");
    return;
  }

  console.log(`[Daily Praise] Found ${todaysNotes.length} notes.`);

  // Format notes for AI
  const notesText = todaysNotes
    .map(
      (m, i) =>
        `[笔记${i + 1}] ${m.content || ""}\n标签: ${(m.tags || []).map((t) => `#${t}`).join(" ")}`
    )
    .join("\n\n---\n\n");

  // Generate praise with DeepSeek
  const systemPrompt = `你是一个温暖的朋友，擅长从用户的日常笔记中发现值得夸奖的具体事情。

从用户今天的笔记中，提取 2-5 件值得夸奖的具体事情。原则：
- 必须具体，引用笔记中的实际行为或想法，不能空洞
- 关注：自我觉察的时刻、采取的行动（哪怕很小）、克制的瞬间、诚实的面对、对别人的善意、照顾自己的行为
- 语气温暖、像是在对一个好朋友说话
- 每条 1-3 句话`;

  const userPrompt = `以下是我今天的笔记，请从中提取2-5件值得夸奖的具体事情：

${notesText}

请严格按照以下格式输出（flomo仅支持加粗和有序列表）：

**今天值得夸奖的事** 🐨

1. 第一条夸奖内容
2. 第二条夸奖内容
...

#010.日记/夸奖

注意：最后一行必须是 #010.日记/夸奖 标签，不要加其他内容。`;

  console.log("[Daily Praise] Calling DeepSeek...");
  const praise = await deepseekChat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  // Create the praise note
  await flomo.createNote(praise, { created_at: today });
  console.log("[Daily Praise] Praise note created successfully!");
  console.log(praise.substring(0, 200) + "...");
}

main().catch((err) => {
  console.error("[Daily Praise] Error:", err.message);
  process.exit(1);
});
