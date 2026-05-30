// Morning Suggestion Script — runs at 7:30 AM Beijing time
// Reviews current month's notes and suggests what to do today

import { McpClient } from "./mcp/client.js";
import { FlomoService } from "./services/flomoService.js";

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

// GitHub Actions cron runs on UTC. We compute Beijing time (UTC+8) arithmetically
// instead of relying on toLocaleString + timeZone, which requires full ICU data and
// may silently fall back to UTC on some Node.js builds.
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad(n) {
  return String(n).padStart(2, "0");
}

function beijingNow() {
  const beijing = new Date(Date.now() + BEIJING_OFFSET_MS);
  return {
    year: beijing.getUTCFullYear(),
    month: beijing.getUTCMonth() + 1,
    day: beijing.getUTCDate(),
    hour: beijing.getUTCHours(),
    minute: beijing.getUTCMinutes(),
    second: beijing.getUTCSeconds(),
  };
}

function todayStr() {
  const bj = beijingNow();
  return `${bj.year}-${pad(bj.month)}-${pad(bj.day)}`;
}

function monthStartStr() {
  const bj = beijingNow();
  return `${bj.year}-${pad(bj.month)}-01`;
}

function nowStr() {
  const bj = beijingNow();
  return `${bj.year}-${pad(bj.month)}-${pad(bj.day)} ${pad(bj.hour)}:${pad(bj.minute)}:${pad(bj.second)}`;
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
  console.log("[Morning Suggestion] Starting...");
  console.log(`[Morning Suggestion] System UTC: ${new Date().toISOString()}, Beijing: ${nowStr()}`);

  const mcpClient = new McpClient(MCP_URL, MCP_TOKEN);
  await mcpClient.initialize();
  const flomo = new FlomoService(mcpClient);

  const today = todayStr();
  const monthStart = monthStartStr();
  console.log(`[Morning Suggestion] Fetching notes from ${monthStart} to ${today}`);

  // Get all notes from this month
  const monthNotes = await flomo.searchNotes("", {
    start_date: monthStart,
    end_date: today,
    limit: 200,
  });

  if (!monthNotes || monthNotes.length === 0) {
    await flomo.createNote(
      "本月还没有记录笔记，从今天开始写下第一条吧。\n\n#AskAi/push",
      { created_at: nowStr() }
    );
    console.log("[Morning Suggestion] No notes this month. Created reminder note.");
    return;
  }

  console.log(`[Morning Suggestion] Found ${monthNotes.length} notes this month.`);

  // Format notes for AI
  const notesText = monthNotes
    .map(
      (m, i) =>
        `[笔记${i + 1}] ${m.created_at || "?"}\n${m.content || ""}\n标签: ${(m.tags || []).map((t) => `#${t}`).join(" ")}`
    )
    .join("\n\n---\n\n");

  const bjNow = beijingNow();
  const weekdayNames = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const beijingDate = new Date(Date.now() + BEIJING_OFFSET_MS);
  const weekday = weekdayNames[beijingDate.getUTCDay()];
  const todayDate = `${bjNow.year}年${bjNow.month}月${bjNow.day}日 ${weekday}`;

  const systemPrompt = `你是一个贴心的私人助手，擅长从用户的笔记中发现线索，给出实用且温暖的建议。

从用户本月的笔记中，分析用户的关注点、正在推进的事情、情绪状态，然后给出今天可以做什么的具体建议。

原则：
- 建议必须基于笔记中的实际内容，不能凭空编造
- 关注：未完成的事项、需要推进的项目、值得深入的想法、需要放松的信号
- 建议应该具体、可执行，不是泛泛而谈的心灵鸡汤
- 语气温暖但不啰嗦`;

  const userPrompt = `以下是我本月（截止今天 ${todayDate}）的所有笔记：

${notesText}

请基于以上笔记，给我今天可以做什么的建议。

请严格按照以下格式输出（flomo仅支持加粗和有序列表）：

**今日建议** 🌅

1. 第一条具体建议
2. 第二条具体建议
3. 第三条具体建议
...

#AskAi/push

注意：最后一行必须是 #AskAi/push 标签，不要加其他内容。`;

  console.log("[Morning Suggestion] Calling DeepSeek...");
  const suggestion = await deepseekChat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  await flomo.createNote(suggestion, { created_at: nowStr() });
  console.log("[Morning Suggestion] Suggestion note created successfully!");
  console.log(suggestion.substring(0, 200) + "...");
}

main().catch((err) => {
  console.error("[Morning Suggestion] Error:", err.message);
  process.exit(1);
});
