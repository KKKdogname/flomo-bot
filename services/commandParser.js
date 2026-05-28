// Intent detection and parameter extraction for No-AI mode

const INTENTS = {
  search_notes: {
    keywords: ["search", "find", "look for", "查询", "搜索", "查找", "找"],
    patterns: [
      /(?:search|find|look\s+for|查询|搜索|查找|找)\s+(?:notes?\s+)?(?:for\s+)?["""]?(.+?)["""]?(?:\s+in\s+#(\S+))?$/i,
      /(?:show|get|find)\s+(?:me\s+)?(?:notes?\s+)?(?:about|related\s+to|containing|with)\s+(.+)/i,
      /(?:帮我|帮我找|帮我搜|有没有|查一下)\s*(?:关于)?(.+?)(?:的笔记)?$/,
    ],
  },
  create_note: {
    keywords: [
      "create", "add", "write", "record", "记", "创建", "新建", "添加",
      "记录", "写",
    ],
    patterns: [
      /(?:create|add|write|record|记|创建|新建|添加|记录)\s+(?:a\s+)?(?:note|memo|笔记)?\s*[:：]?\s*(.+)/is,
      /(?:remember|note\s+down|jot\s+down)\s*[:：]?\s*(.+)/is,
      /(?:帮我记|帮我记录|帮我写|帮我创建)(?:一下|一个笔记)?[:：]?\s*(.+)/is,
    ],
  },
  daily_review: {
    keywords: [
      "daily review", "daily", "review today", "今天回顾", "每日回顾",
      "回顾", "今天有什么", "今日回顾",
    ],
    patterns: [
      /(?:daily\s*review|today.*review|review.*today)/i,
      /(?:今天|每日|今日).*(?:回顾|推荐|回顾推荐)/,
      /(?:回顾|回顾一下)(?:今天|今日)?/,
    ],
  },
  recommended: {
    keywords: ["recommend", "related", "similar", "推荐", "相关", "关联"],
    patterns: [
      /(?:recommend|related|similar|推荐|相关)\s+(?:notes?\s+)?(?:for|to)\s+#?(\S+)/i,
      /(?:与|和).+相关的笔记/,
    ],
  },
  list_tags: {
    keywords: [
      "list tags", "show tags", "all tags", "标签列表", "所有标签",
      "查看标签", "我的标签", "tags",
    ],
    patterns: [
      /(?:list|show|all|查看|我的)\s*tags?/i,
      /(?:标签列表|所有标签|查看标签|我的标签)/,
      /^(?:tags?|标签)$/i,
    ],
  },
  search_tags: {
    keywords: ["find tag", "search tag", "标签搜索", "查找标签"],
    patterns: [
      /(?:find|search)\s+(?:for\s+)?tag(?:s)?\s+(.+)/i,
      /(?:搜索|查找|找).*(?:标签).(.+)/,
    ],
  },
  rename_tag: {
    keywords: ["rename tag", "重命名标签", "改名标签"],
    patterns: [
      /(?:rename|重命名)\s+(?:tag\s+)?#?(\S+)\s+(?:to|as|=>|为|改成)\s+#?(\S+)/i,
    ],
  },
  format_guide: {
    keywords: [
      "format guide", "formatting", "how to format", "格式", "格式指南",
    ],
    patterns: [
      /(?:format|格式).*(?:guide|指南|说明)/i,
      /(?:how|怎么|如何).*(?:format|格式)/i,
      /^(?:格式|format)$/i,
    ],
  },
  tag_guide: {
    keywords: [
      "tag guide", "how to tag", "tag convention", "标签指南", "标签规范",
    ],
    patterns: [
      /(?:tag|标签).*(?:guide|指南|规范|怎么用|如何使用)/i,
      /(?:怎么|如何).*(?:tag|标签)/i,
    ],
  },
  user_profile: {
    keywords: [
      "profile", "about me", "who am i", "memory", "画像", "记忆", "关于我",
      "我的信息",
    ],
    patterns: [
      /(?:profile|about\s*me|who\s*am\s*i)/i,
      /(?:画像|记忆|关于我|我的信息)/,
    ],
  },
  help: {
    keywords: [
      "help", "what can you do", "commands", "帮助", "功能", "你能做什么",
      "怎么用", "使用说明", "hi", "hello", "你好",
    ],
    patterns: [
      /^(?:help|帮助|功能|怎么用|使用说明|hi|hello|你好)[!！。.]?$/i,
      /what\s+can\s+you\s+do/i,
    ],
  },
};

const HELP_MESSAGE = `I can help you manage your flomo notes. Here's what I support:

**Search Notes**: "search cognitive biases" / "搜索心理学"
**Create Note**: "create note: Today I learned about #AI"
**Daily Review**: "daily review" / "今天回顾"
**Recommended**: "recommend notes related to X"
**Tags**: "list tags" / "search tag 心理学" / "我的标签"
**Format Guide**: "format guide" / "格式说明"
**Tag Guide**: "tag guide" / "标签怎么用"
**Profile**: "about me" / "我的画像"

What would you like to do?`;

export function parseCommand(message) {
  if (!message || !message.trim()) {
    return { intent: "help", toolName: null, toolArgs: null, helpText: HELP_MESSAGE };
  }

  const input = message.trim();
  const inputLower = input.toLowerCase();

  // Layer 1: Keyword scoring
  const scores = [];
  for (const [intent, config] of Object.entries(INTENTS)) {
    let score = 0;
    for (const kw of config.keywords) {
      if (inputLower.includes(kw.toLowerCase())) {
        score += kw.length; // longer keyword = stronger signal
      }
    }
    if (score > 0) scores.push({ intent, score, config });
  }

  scores.sort((a, b) => b.score - a.score);

  // Layer 2: Try regex patterns for top-scored intents
  for (const { intent, config } of scores) {
    for (const pattern of config.patterns) {
      const match = input.match(pattern);
      if (match) {
        return extractParams(intent, match, input);
      }
    }
  }

  // Layer 3: If keyword scored but no regex matched, try generic extraction
  if (scores.length > 0) {
    const top = scores[0];
    return genericExtract(top.intent, input);
  }

  // Fallback: help
  return { intent: "help", toolName: null, toolArgs: null, helpText: HELP_MESSAGE };
}

function extractParams(intent, match, input) {
  switch (intent) {
    case "search_notes": {
      const args = { keywords: match[1]?.trim() || input };
      if (match[2]) args.tag = match[2];
      return {
        intent,
        toolName: "searchNotes",
        toolArgs: args,
        userMessage: `Searching notes for "${args.keywords}"...`,
      };
    }
    case "create_note": {
      const content = match[1]?.trim() || input;
      return {
        intent,
        toolName: "createNote",
        toolArgs: { content },
        userMessage: "Creating note...",
      };
    }
    case "daily_review":
      return {
        intent,
        toolName: "getDailyReview",
        toolArgs: {},
        userMessage: "Fetching today's daily review...",
      };
    case "recommended": {
      const id = match[1]?.trim();
      return {
        intent,
        toolName: "getRecommendedNotes",
        toolArgs: { id },
        userMessage: `Finding notes related to "${id}"...`,
      };
    }
    case "list_tags":
      return {
        intent,
        toolName: "getTagTree",
        toolArgs: {},
        userMessage: "Fetching all tags...",
      };
    case "search_tags": {
      const keywords = match[1]?.trim();
      return {
        intent,
        toolName: "searchTags",
        toolArgs: { keywords },
        userMessage: `Searching tags for "${keywords}"...`,
      };
    }
    case "rename_tag": {
      const oldTag = match[1];
      const newTag = match[2];
      return {
        intent,
        toolName: "renameTag",
        toolArgs: { oldTag, newTag },
        userMessage: `Renaming tag #${oldTag} to #${newTag}...`,
      };
    }
    case "format_guide":
      return {
        intent,
        toolName: "getFormatGuide",
        toolArgs: {},
        userMessage: "Getting format guide...",
      };
    case "tag_guide":
      return {
        intent,
        toolName: "getTagGuide",
        toolArgs: {},
        userMessage: "Getting tag guide...",
      };
    case "user_profile":
      return {
        intent,
        toolName: "getUserProfile",
        toolArgs: {},
        userMessage: "Getting user profile...",
      };
    case "help":
      return {
        intent: "help",
        toolName: null,
        toolArgs: null,
        helpText: HELP_MESSAGE,
      };
    default:
      return { intent: "help", toolName: null, toolArgs: null, helpText: HELP_MESSAGE };
  }
}

function genericExtract(intent, input) {
  switch (intent) {
    case "search_notes":
      return {
        intent,
        toolName: "searchNotes",
        toolArgs: { keywords: input },
        userMessage: `Searching notes for "${input}"...`,
      };
    case "create_note":
      return {
        intent,
        toolName: "createNote",
        toolArgs: { content: input },
        userMessage: "Creating note...",
      };
    case "daily_review":
      return {
        intent,
        toolName: "getDailyReview",
        toolArgs: {},
        userMessage: "Fetching today's daily review...",
      };
    case "list_tags":
      return {
        intent,
        toolName: "getTagTree",
        toolArgs: {},
        userMessage: "Fetching all tags...",
      };
    case "format_guide":
      return {
        intent,
        toolName: "getFormatGuide",
        toolArgs: {},
        userMessage: "Getting format guide...",
      };
    case "tag_guide":
      return {
        intent,
        toolName: "getTagGuide",
        toolArgs: {},
        userMessage: "Getting tag guide...",
      };
    case "user_profile":
      return {
        intent,
        toolName: "getUserProfile",
        toolArgs: {},
        userMessage: "Getting user profile...",
      };
    default:
      return { intent: "help", toolName: null, toolArgs: null, helpText: HELP_MESSAGE };
  }
}
