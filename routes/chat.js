import { Router } from "express";
import {
  getConversation,
  getMessages,
  addMessage,
  updateConversationTitle,
  getConversationMessageCount,
} from "../store/database.js";

const router = Router();

// Dependency injection — set by server.js
let flomoService = null;
let getProvider = null;

export function initChatRouter(flomoSvc, providerFn) {
  flomoService = flomoSvc;
  getProvider = providerFn;
  return router;
}

// Send a message
router.post("/", async (req, res) => {
  try {
    const { conversationId, message } = req.body;

    if (!conversationId || !message || !message.trim()) {
      return res.status(400).json({
        error: true,
        message: "conversationId and message are required",
      });
    }

    const conversation = getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({
        error: true,
        message: "Conversation not found",
      });
    }

    const trimmedMessage = message.trim();

    // Save user message
    addMessage(conversationId, "user", trimmedMessage);

    // Auto-title: use first message as title
    const msgCount = getConversationMessageCount(conversationId);
    if (msgCount === 1) {
      const title =
        trimmedMessage.length > 40
          ? trimmedMessage.substring(0, 40) + "..."
          : trimmedMessage;
      updateConversationTitle(conversationId, title);
    }

    // Get recent history for context
    const messages = getMessages(conversationId);
    const history = messages
      .slice(0, -1) // exclude the one we just added
      .map((m) => ({ role: m.role, content: m.content }));

    // Get the active provider and generate response
    const provider = getProvider();
    const { content, metadata = {} } = await provider.generateResponse(
      history,
      trimmedMessage
    );

    // Save assistant response
    addMessage(conversationId, "assistant", content, metadata);

    res.json({ conversationId, reply: content, metadata });
  } catch (err) {
    console.error("Chat error:", err);
    // Save error as assistant message so user sees it
    try {
      addMessage(req.body.conversationId, "assistant", `**Error**: ${err.message}`, {
        error: true,
      });
    } catch (_) {
      // ignore save error
    }
    res.status(500).json({
      error: true,
      message: err.message,
      conversationId: req.body.conversationId,
    });
  }
});

export default router;
