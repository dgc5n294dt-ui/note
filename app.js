(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NoteApp = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "shiyue-notes-v1";

  function createNote(overrides = {}) {
    const now = overrides.updatedAt || new Date().toISOString();
    return {
      id: overrides.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title: overrides.title ?? "无标题笔记",
      content: overrides.content ?? "",
      pinned: Boolean(overrides.pinned),
      createdAt: overrides.createdAt || now,
      updatedAt: now,
    };
  }

  function sortNotes(notes) {
    return [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }

  function filterNotes(notes, query) {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return sortNotes(notes);
    return sortNotes(notes).filter((note) =>
      `${note.title} ${note.content}`.toLocaleLowerCase().includes(normalized),
    );
  }

  function countCharacters(text) {
    return text.replace(/\s/g, "").length;
  }

  function previewText(content) {
    return content.replace(/\s+/g, " ").trim() || "暂无内容";
  }

  function formatDate(value, includeYear = false) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("zh-CN", {
      ...(includeYear ? { year: "numeric" } : {}),
      month: "long",
      day: "numeric",
    }).format(date);
  }

  function loadNotes(storage) {
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY));
      return Array.isArray(parsed) ? parsed.map((note) => createNote(note)) : [];
    } catch (_) {
      return [];
    }
  }

  function saveNotes(storage, notes) {
    storage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  function initApp(doc, storage) {
    const elements = {
      list: doc.getElementById("note-list"),
      count: doc.getElementById("note-count"),
      search: doc.getElementById("search"),
      title: doc.getElementById("note-title"),
      content: doc.getElementById("note-content"),
      date: doc.getElementById("note-date"),
      wordCount: doc.getElementById("word-count"),
      saveState: doc.getElementById("save-state"),
      pin: doc.getElementById("pin-note"),
      remove: doc.getElementById("delete-note"),
      dialog: doc.getElementById("delete-dialog"),
      paper: doc.getElementById("paper"),
      empty: doc.getElementById("empty-editor"),
      sidebar: doc.getElementById("sidebar"),
      backdrop: doc.getElementById("mobile-backdrop"),
      toast: doc.getElementById("toast"),
    };

    let notes = loadNotes(storage);
    if (!notes.length && storage.getItem(STORAGE_KEY) === null) {
      notes = [
        createNote({
          id: "welcome",
          title: "欢迎来到拾页",
          content: "这里是属于你的安静角落。\n\n点击左上角的 + 新建一篇笔记；输入时，内容会自动保存在当前设备中。你也可以搜索、置顶或删除笔记。\n\n愿每一个值得记住的念头，都在这里被妥善收藏。",
          pinned: true,
        }),
      ];
      saveNotes(storage, notes);
    }

    let selectedId = sortNotes(notes)[0]?.id || null;
    let saveTimer;
    let toastTimer;

    function selectedNote() {
      return notes.find((note) => note.id === selectedId);
    }

    function showToast(message) {
      elements.toast.textContent = message;
      elements.toast.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 1800);
    }

    function closeSidebar() {
      elements.sidebar.classList.remove("open");
      elements.backdrop.classList.remove("show");
    }

    function renderList() {
      const visible = filterNotes(notes, elements.search.value);
      elements.count.textContent = `${notes.length} 篇`;
      elements.list.replaceChildren();

      if (!visible.length) {
        const message = doc.createElement("div");
        message.className = "no-results";
        message.innerHTML = "<strong>没有找到笔记</strong><span>试试其他关键词</span>";
        elements.list.append(message);
        return;
      }

      visible.forEach((note) => {
        const button = doc.createElement("button");
        button.type = "button";
        button.className = `note-card${note.id === selectedId ? " active" : ""}`;
        button.dataset.id = note.id;
        button.setAttribute("aria-label", `打开笔记：${note.title || "无标题笔记"}`);

        const title = doc.createElement("p");
        title.className = "note-card-title";
        if (note.pinned) {
          const dot = doc.createElement("span");
          dot.className = "pin-dot";
          dot.title = "已置顶";
          title.append(dot);
        }
        title.append(doc.createTextNode(note.title.trim() || "无标题笔记"));

        const preview = doc.createElement("p");
        preview.className = "note-card-preview";
        preview.textContent = previewText(note.content);

        const meta = doc.createElement("div");
        meta.className = "note-card-meta";
        const date = doc.createElement("span");
        date.textContent = formatDate(note.updatedAt);
        const chars = doc.createElement("span");
        chars.textContent = `${countCharacters(note.content)} 字`;
        meta.append(date, chars);

        button.append(title, preview, meta);
        button.addEventListener("click", () => {
          selectedId = note.id;
          render();
          closeSidebar();
        });
        elements.list.append(button);
      });
    }

    function renderEditor() {
      const note = selectedNote();
      const hasNote = Boolean(note);
      elements.paper.hidden = !hasNote;
      elements.empty.hidden = hasNote;
      elements.remove.disabled = !hasNote;
      elements.pin.disabled = !hasNote;
      if (!note) return;

      elements.title.value = note.title;
      elements.content.value = note.content;
      elements.date.textContent = formatDate(note.updatedAt, true);
      elements.wordCount.textContent = `${countCharacters(note.content)} 字`;
      elements.pin.classList.toggle("active", note.pinned);
      elements.pin.querySelector("span").textContent = note.pinned ? "取消置顶" : "置顶";
    }

    function render() {
      renderList();
      renderEditor();
    }

    function persistSoon() {
      elements.saveState.classList.add("saving");
      elements.saveState.lastChild.textContent = " 保存中…";
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveNotes(storage, notes);
        elements.saveState.classList.remove("saving");
        elements.saveState.lastChild.textContent = " 已保存";
      }, 280);
    }

    function updateSelected(changes) {
      const note = selectedNote();
      if (!note) return;
      Object.assign(note, changes, { updatedAt: new Date().toISOString() });
      elements.wordCount.textContent = `${countCharacters(note.content)} 字`;
      elements.date.textContent = formatDate(note.updatedAt, true);
      renderList();
      persistSoon();
    }

    function addNote() {
      const note = createNote({ title: "", content: "" });
      notes.push(note);
      selectedId = note.id;
      elements.search.value = "";
      saveNotes(storage, notes);
      render();
      closeSidebar();
      elements.title.focus();
      showToast("已新建笔记");
    }

    doc.getElementById("new-note").addEventListener("click", addNote);
    doc.getElementById("empty-new-note").addEventListener("click", addNote);
    elements.search.addEventListener("input", renderList);
    elements.title.addEventListener("input", (event) => updateSelected({ title: event.target.value }));
    elements.content.addEventListener("input", (event) => updateSelected({ content: event.target.value }));
    elements.pin.addEventListener("click", () => {
      const note = selectedNote();
      if (!note) return;
      note.pinned = !note.pinned;
      note.updatedAt = new Date().toISOString();
      saveNotes(storage, notes);
      render();
      showToast(note.pinned ? "笔记已置顶" : "已取消置顶");
    });
    elements.remove.addEventListener("click", () => elements.dialog.showModal());
    elements.dialog.addEventListener("close", () => {
      if (elements.dialog.returnValue !== "confirm") return;
      notes = notes.filter((note) => note.id !== selectedId);
      selectedId = sortNotes(notes)[0]?.id || null;
      saveNotes(storage, notes);
      render();
      showToast("笔记已删除");
    });
    doc.getElementById("mobile-menu").addEventListener("click", () => {
      elements.sidebar.classList.add("open");
      elements.backdrop.classList.add("show");
    });
    elements.backdrop.addEventListener("click", closeSidebar);
    doc.addEventListener("keydown", (event) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "n") {
        event.preventDefault();
        addNote();
      }
      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        elements.search.focus();
      }
    });

    render();
    return {
      getNotes: () => [...notes],
      addNote,
      select: (id) => { selectedId = id; render(); },
    };
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => initApp(document, localStorage));
  }

  return { STORAGE_KEY, createNote, sortNotes, filterNotes, countCharacters, previewText, formatDate, loadNotes, saveNotes, initApp };
});
