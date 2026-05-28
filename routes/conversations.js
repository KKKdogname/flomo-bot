import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  createConversation,
  getAllConversations,
  getConversation,
  updateConversationTitle,
  deleteConversation,
  getMessages,
} from "../store/database.js";

const router = Router();

// List all conversations
router.get("/", (_req, res) => {
  try {
    const conversations = getAllConversations();
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Create a new conversation
router.post("/", (req, res) => {
  try {
    const id = uuidv4();
    const title = req.body.title || "New Conversation";
    const conversation = createConversation(id, title);
    res.status(201).json(conversation);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Get a single conversation with messages
router.get("/:id", (req, res) => {
  try {
    const conversation = getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: true, message: "Conversation not found" });
    }
    const messages = getMessages(req.params.id);
    res.json({ ...conversation, messages });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Update conversation title
router.patch("/:id", (req, res) => {
  try {
    const conversation = getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: true, message: "Conversation not found" });
    }
    if (req.body.title) {
      updateConversationTitle(req.params.id, req.body.title);
    }
    res.json(getConversation(req.params.id));
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Delete a conversation
router.delete("/:id", (req, res) => {
  try {
    const conversation = getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: true, message: "Conversation not found" });
    }
    deleteConversation(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

export default router;
