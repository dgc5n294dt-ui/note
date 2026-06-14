const test = require("node:test");
const assert = require("node:assert/strict");
const {
  STORAGE_KEY,
  createNote,
  sortNotes,
  filterNotes,
  countCharacters,
  previewText,
  loadNotes,
  saveNotes,
} = require("../app.js");

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
  };
}

test("createNote builds a complete note and respects overrides", () => {
  const note = createNote({ id: "n1", title: "测试", content: "正文", pinned: true, updatedAt: "2026-06-14T00:00:00.000Z" });
  assert.equal(note.id, "n1");
  assert.equal(note.title, "测试");
  assert.equal(note.pinned, true);
  assert.equal(note.createdAt, note.updatedAt);
});

test("sortNotes puts pinned notes first, then newest notes", () => {
  const notes = [
    createNote({ id: "old", updatedAt: "2026-01-01T00:00:00Z" }),
    createNote({ id: "pinned", pinned: true, updatedAt: "2025-01-01T00:00:00Z" }),
    createNote({ id: "new", updatedAt: "2026-06-01T00:00:00Z" }),
  ];
  assert.deepEqual(sortNotes(notes).map((note) => note.id), ["pinned", "new", "old"]);
});

test("filterNotes searches title and body case-insensitively", () => {
  const notes = [
    createNote({ id: "a", title: "旅行计划", content: "去杭州" }),
    createNote({ id: "b", title: "Work", content: "Release NOTES" }),
  ];
  assert.deepEqual(filterNotes(notes, "杭州").map((note) => note.id), ["a"]);
  assert.deepEqual(filterNotes(notes, "notes").map((note) => note.id), ["b"]);
  assert.equal(filterNotes(notes, "不存在").length, 0);
});

test("text helpers count non-whitespace characters and produce previews", () => {
  assert.equal(countCharacters("你好 world\n  !"), 8);
  assert.equal(previewText("  第一行\n 第二行  "), "第一行 第二行");
  assert.equal(previewText("  \n "), "暂无内容");
});

test("notes round-trip through storage and malformed data is tolerated", () => {
  const storage = memoryStorage();
  const notes = [createNote({ id: "saved", title: "已保存" })];
  saveNotes(storage, notes);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY))[0].id, "saved");
  assert.equal(loadNotes(storage)[0].title, "已保存");

  storage.setItem(STORAGE_KEY, "not json");
  assert.deepEqual(loadNotes(storage), []);
});
