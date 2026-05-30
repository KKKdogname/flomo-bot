// Monthly Summary Script — runs on the last day of each month at ~22:05 Beijing time
// Reads all notes from the current month and generates a monthly review

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

// Check if today is the last day of the month (in Beijing time)
function isLastDayOfMonth(year, month, day) {
  // Create a date for tomorrow, see if month changes
  // Use UTC to avoid any timezone edge cases
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  return tomorrow.getUTCMonth() + 1 !== month;
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
      max_tokens: 4096,
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
  console.log("[Monthly Summary] Starting...");
  console.log(`[Monthly Summary] System UTC: ${new Date().toISOString()}, Beijing: ${nowStr()}`);

  const bj = beijingNow();

  // Check if today is the last day of the month
  if (!isLastDayOfMonth(bj.year, bj.month, bj.day)) {
    console.log(`[Monthly Summary] ${bj.month}/${bj.day} is not the last day of the month. Skipping.`);
    return;
  }

  console.log(`[Monthly Summary] ${bj.year}-${bj.month}-${bj.day} is the last day! Generating summary...`);

  const mcpClient = new McpClient(MCP_URL, MCP_TOKEN);
  await mcpClient.initialize();
  const flomo = new FlomoService(mcpClient);

  const monthStart = monthStartStr();
  const today = todayStr();

  console.log(`[Monthly Summary] Fetching notes from ${monthStart} to ${today}`);

  // Get all notes from this month
  const monthNotes = await flomo.searchNotes("", {
    start_date: monthStart,
    end_date: today,
    limit: 500,
  });

  if (!monthNotes || monthNotes.length === 0) {
    console.log("[Monthly Summary] No notes this month. Skipping.");
    return;
  }

  console.log(`[Monthly Summary] Found ${monthNotes.length} notes this month.`);

  // Format notes for AI
  const notesText = monthNotes
    .map(
      (m, i) =>
        `[笔记${i + 1}] ${m.created_at || "?"}\n${m.content || ""}\n标签: ${(m.tags || []).map((t) => `#${t}`).join(" ")}`
    )
    .join("\n\n---\n\n");

  const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  const monthName = monthNames[bj.month - 1];

  const systemPrompt = `你是一个善于反思和总结的朋友，擅长从用户的笔记中发现成长轨迹和隐藏的主题。

从用户本月的所有笔记中，写一份温暖而真实的月度回顾。

原则：
- 必须基于笔记中的实际内容，引用具体的笔记作为例证
- 关注：这个月的成长和变化、反复出现的主题、重要的领悟、情绪的变化曲线、值得记住的时刻
- 不要只罗列事件，要找出背后的脉络和联系
- 语气温暖、像是在回顾自己的一个月，可以有适度的自我调侃
- 如果有未完成的事项或需要跟进的想法，也可以提及`;

  const userPrompt = `以下是我${bj.year}年${monthName}的所有笔记（共${monthNotes.length}条）：

${notesText}

请基于以上笔记，写一份${bj.year}年${monthName}的月度回顾。

请严格按照以下格式输出（flomo仅支持加粗和有序/无序列表）：

**${bj.year}年${monthName}回顾** 📝

先写一段简短的开场白（2-3句话概括这个月的感觉），然后按以下结构展开：

**本月主题**
- 用无序列表列出这个月反复出现的2-4个主题

**值得记住的时刻**
- 用无序列表列出3-5个具体的、值得回味的瞬间或感悟

**成长与变化**
- 用无序列表描述这个月的变化和进步

**下个月想做的事**
- 用无序列表列出可以带到下个月的事情或新的方向

#010.日记/月度回顾 #AskAi/push

注意：最后一行必须是 #010.日记/月度回顾 #AskAi/push 标签，不要加其他内容。`;

  console.log("[Monthly Summary] Calling DeepSeek...");
  const summary = await deepseekChat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  await flomo.createNote(summary, { created_at: nowStr() });
  console.log("[Monthly Summary] Monthly summary created successfully!");
  console.log(summary.substring(0, 200) + "...");
}

main().catch((err) => {
  console.error("[Monthly Summary] Error:", err.message);
  process.exit(1);
});
