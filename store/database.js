import initSqlJs from "sql.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const DB_PATH = join(DATA_DIR, "flomo-chat.db");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

let db = null;

// Prepared statement helpers
function stmtRun(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
}

function stmtAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function stmtOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Conversation',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id, created_at)
  `);

  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  writeFileSync(DB_PATH, buffer);
}

export function createConversation(id, title = "New Conversation") {
  stmtRun("INSERT INTO conversations (id, title) VALUES (?, ?)", [id, title]);
  saveDb();
  return getConversation(id);
}

export function getAllConversations() {
  return stmtAll(`
    SELECT c.*, COUNT(m.id) as message_count
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `);
}

export function getConversation(id) {
  return stmtOne("SELECT * FROM conversations WHERE id = ?", [id]);
}

export function updateConversationTitle(id, title) {
  stmtRun(
    "UPDATE conversations SET title = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
    [title, id]
  );
  saveDb();
}

export function deleteConversation(id) {
  stmtRun("DELETE FROM conversations WHERE id = ?", [id]);
  saveDb();
}

export function addMessage(conversationId, role, content, metadata = {}) {
  stmtRun(
    "INSERT INTO messages (conversation_id, role, content, metadata) VALUES (?, ?, ?, ?)",
    [conversationId, role, content, JSON.stringify(metadata)]
  );
  touchConversation(conversationId);
  saveDb();

  const row = stmtOne("SELECT last_insert_rowid() as id");
  return row ? row.id : null;
}

export function getMessages(conversationId, limit = 100) {
  return stmtAll(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?",
    [conversationId, limit]
  );
}

export function getRecentMessages(conversationId, limit = 20) {
  return stmtAll(
    `SELECT * FROM (
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    ) ORDER BY created_at ASC`,
    [conversationId, limit]
  );
}

export function touchConversation(id) {
  stmtRun(
    "UPDATE conversations SET updated_at = datetime('now', 'localtime') WHERE id = ?",
    [id]
  );
}

export function getConversationMessageCount(id) {
  const row = stmtOne(
    "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?",
    [id]
  );
  return row ? row.count : 0;
}

export { getDb };
