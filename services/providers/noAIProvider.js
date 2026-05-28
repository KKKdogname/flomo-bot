import { parseCommand } from "../commandParser.js";

export class NoAIProvider {
  constructor(flomoService) {
    this.flomo = flomoService;
  }

  getName() {
    return "no-ai";
  }

  async generateResponse(history, userMessage) {
    const parsed = parseCommand(userMessage);

    if (parsed.intent === "help") {
      return { content: parsed.helpText, metadata: { intent: "help" } };
    }

    try {
      const result = await this.executeIntent(parsed);
      return { content: result, metadata: { intent: parsed.intent } };
    } catch (err) {
      return {
        content: `**Error**: ${err.message}\n\nPlease try again or type "help" to see what I can do.`,
        metadata: { intent: parsed.intent, error: err.message },
      };
    }
  }

  async executeIntent(parsed) {
    const { intent, toolName, toolArgs } = parsed;

    switch (toolName) {
      case "searchNotes": {
        const memos = await this.flomo.searchNotes(
          toolArgs.keywords,
          toolArgs.tag ? { tag: toolArgs.tag } : {}
        );
        return this.flomo.formatMemoList(memos, `Search: "${toolArgs.keywords}"`);
      }

      case "createNote": {
        await this.flomo.createNote(toolArgs.content);
        const preview =
          toolArgs.content.length > 100
            ? toolArgs.content.substring(0, 100) + "..."
            : toolArgs.content;
        return `**Note created!**\n\n${preview}`;
      }

      case "getDailyReview": {
        const memos = await this.flomo.getDailyReview();
        return this.flomo.formatDailyReview(memos);
      }

      case "getRecommendedNotes": {
        const result = await this.flomo.getRecommendedNotes(toolArgs.id);
        if (typeof result === "string") return result;
        return this.flomo.formatMemoList(
          result,
          `Related to "${toolArgs.id}"`
        );
      }

      case "getTagTree": {
        let tags = await this.flomo.getTagTree();
        // Handle { tags: [...] } object format
        if (tags && tags.tags) tags = tags.tags;
        if (Array.isArray(tags)) {
          if (tags.length === 0) return "**No tags found.**";
          const lines = ["**Your Tags:**", ""];
          for (const tag of tags) {
            if (typeof tag === "string") {
              lines.push(`- #${tag}`);
            } else if (tag.name) {
              lines.push(
                `- #${tag.name}${tag.count ? ` (${tag.count})` : ""}`
              );
            }
          }
          return lines.join("\n");
        }
        return typeof tags === "string" ? tags : JSON.stringify(tags, null, 2);
      }

      case "searchTags": {
        const tags = await this.flomo.searchTags(toolArgs.keywords);
        if (Array.isArray(tags)) {
          if (tags.length === 0)
            return `**No tags found** for "${toolArgs.keywords}".`;
          const lines = [
            `**Tag Search: "${toolArgs.keywords}"** (${tags.length} results):`,
            "",
          ];
          for (const tag of tags) {
            if (typeof tag === "string") {
              lines.push(`- #${tag}`);
            } else if (tag.name) {
              lines.push(
                `- #${tag.name}${tag.count ? ` (${tag.count})` : ""}`
              );
            }
          }
          return lines.join("\n");
        }
        return typeof tags === "string" ? tags : JSON.stringify(tags, null, 2);
      }

      case "renameTag": {
        const result = await this.flomo.renameTag(
          toolArgs.oldTag,
          toolArgs.newTag
        );
        return typeof result === "string"
          ? result
          : `**Tag renamed**: #${toolArgs.oldTag} → #${toolArgs.newTag}`;
      }

      case "getFormatGuide": {
        const guide = await this.flomo.getFormatGuide();
        return `**flomo Format Guide**\n\n${guide}`;
      }

      case "getTagGuide": {
        const guide = await this.flomo.getTagGuide();
        return `**flomo Tag Guide**\n\n${guide}`;
      }

      case "getUserProfile": {
        const profile = await this.flomo.getUserProfile();
        return `**Your flomo Profile**\n\n${profile}`;
      }

      default:
        return `Unknown command: ${intent}. Type "help" to see what I can do.`;
    }
  }
}
