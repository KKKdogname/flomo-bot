export class DeepSeekProvider {
  constructor(flomoService, options = {}) {
    this.flomo = flomoService;
    this.apiKey = options.apiKey || "";
    this.model = options.model || "deepseek-chat";
    this.baseUrl = options.baseUrl || "https://api.deepseek.com/v1";
  }

  getName() {
    return "deepseek";
  }

  async generateResponse(history, userMessage) {
    const tools = this._getTools();

    const messages = [
      {
        role: "system",
        content: `You are a helpful assistant for flomo, a note-taking app. You help users manage their notes, find information, and organize their thinking.

Available operations:
- Search notes by keywords, tags, dates
- Create new notes with optional tags (tags are inline using #tag format, e.g. #想法 #读书/心理学)
- Update existing notes
- Get daily review (curated historical notes recommended by flomo)
- Get note recommendations based on a note ID
- Browse and search tags by keyword
- Rename tags
- View format and tag usage guides
- Access user profile and memory context

When creating notes, use flomo's supported formatting:
- **bold** for emphasis
- ==highlight== for important text
- - unordered lists
- 1. ordered lists
- #tag for tagging (support hierarchical: #领域/子领域)

Always confirm with the user before creating, updating, or renaming anything. Keep responses concise and helpful. Reply in Chinese if the user writes in Chinese.`,
      },
    ];

    // Add conversation history (last 10 messages to keep context manageable)
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current user message
    messages.push({ role: "user", content: userMessage });

    let iteration = 0;
    const maxIterations = 5;

    while (iteration < maxIterations) {
      iteration++;

      const response = await this._chatCompletion(messages, tools);

      const choice = response.choices?.[0];
      if (!choice) {
        return { content: "No response from AI.", metadata: {} };
      }

      const { message } = choice;

      // If the AI wants to call a tool
      if (message.tool_calls && message.tool_calls.length > 0) {
        // Add assistant message with tool calls
        messages.push({
          role: "assistant",
          content: message.content || "",
          tool_calls: message.tool_calls,
        });

        for (const toolCall of message.tool_calls) {
          const funcName = toolCall.function.name;
          const funcArgs = JSON.parse(toolCall.function.arguments || "{}");

          let toolResult;
          try {
            toolResult = await this._executeToolCall(funcName, funcArgs);
          } catch (err) {
            toolResult = `Error: ${err.message}`;
          }

          // Add tool result
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }
      } else {
        // Final text response
        return {
          content: message.content || "I processed your request.",
          metadata: { iterations: iteration },
        };
      }
    }

    return {
      content:
        "I ran into too many tool calls. Please try a simpler request.",
      metadata: { iterations: iteration },
    };
  }

  async _chatCompletion(messages, tools) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        tools,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DeepSeek API error ${response.status}: ${text}`);
    }

    return response.json();
  }

  async _executeToolCall(name, args) {
    switch (name) {
      case "search_notes": {
        const memos = await this.flomo.searchNotes(
          args.keywords,
          args.tag ? { tag: args.tag } : {}
        );
        return this._memosToText(memos);
      }
      case "create_note": {
        await this.flomo.createNote(args.content, args);
        return `Note created successfully.`;
      }
      case "update_note": {
        await this.flomo.updateNote(args.id, args.content);
        return `Note updated successfully.`;
      }
      case "get_daily_review": {
        const memos = await this.flomo.getDailyReview();
        return this._memosToText(memos);
      }
      case "get_recommended": {
        const result = await this.flomo.getRecommendedNotes(args.id, args.limit);
        if (typeof result === "string") return result;
        return this._memosToText(result);
      }
      case "search_tags": {
        const tags = await this.flomo.searchTags(args.keywords);
        return JSON.stringify(tags);
      }
      case "get_tag_tree": {
        const tags = await this.flomo.getTagTree(args.prefix, args.depth);
        return JSON.stringify(tags);
      }
      case "rename_tag": {
        await this.flomo.renameTag(args.old_tag, args.new_tag);
        return `Tag renamed successfully.`;
      }
      case "get_format_guide": {
        return await this.flomo.getFormatGuide();
      }
      case "get_tag_guide": {
        return await this.flomo.getTagGuide();
      }
      case "get_user_profile": {
        return await this.flomo.getUserProfile();
      }
      case "get_memory_context": {
        return await this.flomo.getMemoryContext();
      }
      default:
        return `Unknown tool: ${name}`;
    }
  }

  _memosToText(memos) {
    if (!memos || memos.length === 0) return "No notes found.";
    return memos
      .map(
        (m, i) =>
          `[${i + 1}] ID:${m.id} | ${m.created_at || "?"} | Tags: ${(m.tags || []).join(", ")} | ${m.content?.substring(0, 200) || ""}`
      )
      .join("\n---\n");
  }

  _getTools() {
    return [
      {
        type: "function",
        function: {
          name: "search_notes",
          description: "Search flomo notes by keywords and optional tag filter",
          parameters: {
            type: "object",
            properties: {
              keywords: {
                type: "string",
                description: "Search keywords",
              },
              tag: {
                type: "string",
                description: "Optional tag to filter by (without #)",
              },
              limit: {
                type: "integer",
                description: "Max results, default 10",
              },
            },
            required: ["keywords"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_note",
          description: "Create a new flomo note. Tags should be inline in content using #tag format",
          parameters: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "Note content with inline #tags",
              },
              created_at: {
                type: "string",
                description: "Optional creation time",
              },
            },
            required: ["content"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "update_note",
          description: "Update an existing note's content",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string", description: "Note ID" },
              content: { type: "string", description: "New content" },
            },
            required: ["id", "content"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_daily_review",
          description: "Get today's flomo daily review — curated historical notes recommended by flomo",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "get_recommended",
          description: "Get notes related to a given note ID",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string", description: "Note ID" },
              limit: { type: "integer", description: "Max results" },
            },
            required: ["id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "search_tags",
          description: "Search tags by keyword",
          parameters: {
            type: "object",
            properties: {
              keywords: { type: "string", description: "Search keyword" },
            },
            required: ["keywords"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_tag_tree",
          description: "Get the full tag tree, optionally filtered by prefix",
          parameters: {
            type: "object",
            properties: {
              prefix: { type: "string", description: "Tag prefix filter" },
              depth: { type: "integer", description: "Max depth" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "rename_tag",
          description: "Rename a tag across all notes",
          parameters: {
            type: "object",
            properties: {
              old_tag: { type: "string", description: "Current tag name" },
              new_tag: { type: "string", description: "New tag name" },
            },
            required: ["old_tag", "new_tag"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_format_guide",
          description: "Get flomo's formatting guide",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "get_tag_guide",
          description: "Get flomo's tag usage guide",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "get_user_profile",
          description: "Get the user's flomo profile",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "get_memory_context",
          description: "Get the user's memory context document",
          parameters: { type: "object", properties: {} },
        },
      },
    ];
  }
}
