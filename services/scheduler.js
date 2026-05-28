import cron from "node-cron";
import notifier from "node-notifier";

let flomoService = null;
let getProviderFn = null;
let job = null;

// Today's date in YYYY-MM-DD format (local time)
function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function runCompliment() {
  console.log("[Scheduler] Running daily compliment...");

  try {
    const today = todayStr();

    // 1. Fetch today's notes
    const todaysNotes = await flomoService.searchNotes("", {
      start_date: today,
      end_date: today,
      limit: 50,
    });

    // If no notes today, use daily review
    let noteContext = "";
    if (todaysNotes.length > 0) {
      noteContext = todaysNotes
        .map(
          (m) =>
            `[${m.created_at}] ${m.content?.substring(0, 300) || ""} ${(m.tags || []).map((t) => `#${t}`).join(" ")}`
        )
        .join("\n---\n");
    } else {
      const dailyReviews = await flomoService.getDailyReview();
      if (dailyReviews.length > 0) {
        noteContext = dailyReviews
          .map(
            (m) =>
              `[${m.created_at}] ${m.content?.substring(0, 200) || ""}`
          )
          .join("\n---\n");
      }
    }

    // 2. Generate compliment using DeepSeek AI or fallback
    const provider = getProviderFn();
    let compliment = "";

    if (provider.getName() === "deepseek") {
      const context = noteContext
        ? `\n\n用户今天的笔记内容：\n${noteContext}`
        : "\n\n（用户今天还没有写笔记，可以用flomo每日回顾里的历史笔记作为参考，从中发现用户值得被夸赞的特质和成长轨迹。）";

      const prompt = `请根据以下信息，写一段温暖真诚的夸赞（200字以内），像朋友一样指出用户今天做得好的地方。语气亲切自然，可以引用笔记中的具体内容。${context}

要求：
- 语气温暖真诚，像知心朋友
- 具体引用笔记中的内容作为夸赞依据
- 如果没有今天笔记，就基于历史笔记夸赞用户的成长和坚持
- 200字以内
- 结尾留一句鼓励`;

      try {
        const response = await provider.generateResponse([], prompt);
        compliment =
          typeof response.content === "string"
            ? response.content
            : JSON.stringify(response.content);
      } catch {
        compliment = fallbackCompliment(todaysNotes);
      }
    } else {
      compliment = fallbackCompliment(todaysNotes);
    }

    // 3. Create flomo note
    const noteContent = `#010.日记/夸一夸\n\n${compliment}\n\n---\n每晚9点 · flomo Chat 自动生成`;
    await flomoService.createNote(noteContent);

    console.log("[Scheduler] Compliment note created!");

    // 4. Windows desktop notification
    notifier.notify({
      title: "🌟 今晚的夸一夸已送达",
      message: compliment.substring(0, 120) + (compliment.length > 120 ? "..." : ""),
      sound: true,
      wait: false,
    });

    console.log("[Scheduler] Notification sent.");
  } catch (err) {
    console.error("[Scheduler] Error:", err.message);
  }
}

function fallbackCompliment(notes) {
  if (notes.length > 0) {
    const tags = [
      ...new Set(notes.flatMap((n) => n.tags || [])),
    ].slice(0, 5);
    const totalWords = notes.reduce(
      (sum, n) => sum + (n.word_count || 0),
      0
    );

    return `今天你记录了 **${notes.length}** 条笔记，写下了约 **${totalWords}** 个字。${tags.length > 0 ? `涉及的话题有 ${tags.map((t) => `#${t}`).join("、")}。` : ""}

你在用文字认真对待每一天，这本身就是一件了不起的事。

继续保持这份记录的习惯吧，未来的你会感谢今天的自己 💪`;
  }

  return `今天是${todayStr()}，虽然还没有写笔记，但没关系，每一天都有它的节奏。

重要的不是你写了多少，而是你始终保持与自己对话的习惯。

明天又是新的一天，加油 🌟`;
}

export function initScheduler(flomoSvc, getProvider) {
  flomoService = flomoSvc;
  getProviderFn = getProvider;

  // Schedule at 9:00 PM daily (Asia/Shanghai)
  // node-cron uses server's local time
  job = cron.schedule("0 21 * * *", () => {
    runCompliment();
  });

  console.log("[Scheduler] Daily compliment scheduled at 21:00");
}

export function stopScheduler() {
  if (job) {
    job.stop();
    job = null;
  }
}

// Allow manual trigger for testing
export async function triggerNow() {
  return runCompliment();
}
