export class FlomoService {
  constructor(mcpClient) {
    this.mcp = mcpClient;
  }

  async searchNotes(keywords, options = {}) {
    const args = { keywords };
    if (options.tag) args.tag = options.tag;
    if (options.start_date) args.start_date = options.start_date;
    if (options.end_date) args.end_date = options.end_date;
    if (options.limit) args.limit = options.limit;

    const result = await this.mcp.callTool("memo_search", args);
    const memos = result?.content?.[0]?.text;
    if (memos) {
      const parsed = JSON.parse(memos);
      if (parsed.memos) return parsed.memos;
    }
    return [];
  }

  async createNote(content, options = {}) {
    const args = { content };
    if (options.created_at) args.created_at = options.created_at;

    const result = await this.mcp.callTool("memo_create", args);
    return result?.content?.[0]?.text || "Note created.";
  }

  async updateNote(id, content) {
    const result = await this.mcp.callTool("memo_update", { id, content });
    return result?.content?.[0]?.text || "Note updated.";
  }

  async getNotes(ids) {
    const args = Array.isArray(ids) ? { ids } : { id: ids };
    const result = await this.mcp.callTool("memo_batch_get", args);
    const text = result?.content?.[0]?.text;
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed.memos) return parsed.memos;
    }
    return [];
  }

  async getRecommendedNotes(id, limit) {
    const args = { id };
    if (limit) args.limit = limit;

    const result = await this.mcp.callTool("memo_recommended", args);
    return result?.content?.[0]?.text || "No recommendations found.";
  }

  async getDailyReview() {
    const result = await this.mcp.callTool("get_daily_review");
    const text = result?.content?.[0]?.text;
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed.memos) return parsed.memos;
    }
    return [];
  }

  async getFormatGuide() {
    const result = await this.mcp.callTool("get_format_guide");
    return result?.content?.[0]?.text || "No format guide available.";
  }

  async getTagGuide() {
    const result = await this.mcp.callTool("get_tag_guide");
    return result?.content?.[0]?.text || "No tag guide available.";
  }

  async searchTags(keywords) {
    const result = await this.mcp.callTool("tag_search", { keywords });
    const text = result?.content?.[0]?.text;
    if (text) {
      try {
        const parsed = JSON.parse(text);
        return parsed;
      } catch {
        return text;
      }
    }
    return [];
  }

  async getTagTree(prefix, depth) {
    const args = {};
    if (prefix) args.prefix = prefix;
    if (depth) args.depth = depth;

    const result = await this.mcp.callTool("tag_tree", args);
    const text = result?.content?.[0]?.text;
    if (text) {
      try {
        const parsed = JSON.parse(text);
        return parsed;
      } catch {
        return text;
      }
    }
    return [];
  }

  async renameTag(oldTag, newTag) {
    const result = await this.mcp.callTool("tag_rename", {
      old_tag: oldTag,
      new_tag: newTag,
    });
    return result?.content?.[0]?.text || "Tag renamed.";
  }

  async getMemoryContext() {
    const result = await this.mcp.callTool("memory_context");
    return result?.content?.[0]?.text || "No memory context available.";
  }

  async getUserProfile() {
    const result = await this.mcp.callTool("memory_user");
    return result?.content?.[0]?.text || "No user profile available.";
  }

  formatMemoList(memos, title = "Search Results") {
    if (!memos || memos.length === 0) {
      return `**No notes found.**`;
    }

    const lines = [`**${title}** (${memos.length} notes):`, ""];

    for (let i = 0; i < memos.length; i++) {
      const m = memos[i];
      const date = m.created_at
        ? new Date(m.created_at).toLocaleDateString("zh-CN")
        : "?";
      const tags = m.tags?.length ? m.tags.map((t) => `#${t}`).join(" ") : "";
      const preview =
        m.content?.replace(/\n/g, " ").substring(0, 120) + "...";

      lines.push(
        `**${i + 1}.** [${date}] ${preview} (${m.word_count || "?"} words)`
      );
      if (tags) lines.push(`  Tags: ${tags}`);
      lines.push("");
    }

    return lines.join("\n");
  }

  formatDailyReview(memos) {
    if (!memos || memos.length === 0) {
      return "**No daily review notes for today.**";
    }

    const lines = [
      `**Today's Daily Review** (${memos.length} notes):`,
      "",
    ];

    for (let i = 0; i < memos.length; i++) {
      const m = memos[i];
      const date = m.created_at
        ? new Date(m.created_at).toLocaleDateString("zh-CN")
        : "?";
      const tags = m.tags?.length ? m.tags.map((t) => `#${t}`).join(" ") : "";
      const preview =
        m.content?.replace(/\n/g, " ").substring(0, 150) + "...";

      lines.push(`**${i + 1}.** [${date}] ${preview}`);
      if (tags) lines.push(`  ${tags}`);
      lines.push("");
    }

    return lines.join("\n");
  }
}
