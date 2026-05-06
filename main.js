var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TrashManagerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var VIEW_TYPE_TRASH = "trash-manager-view";
var TRASH_FOLDER = ".trash";
var DEFAULT_SETTINGS = {
  confirmEmptyTrash: true,
  confirmRestore: false,
  showFileSize: true,
  groupByType: false
};
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function getFileIcon(item) {
  var _a, _b;
  if (item.isFolder) return "folder";
  const ext = (_b = (_a = item.extension) == null ? void 0 : _a.toLowerCase()) != null ? _b : "";
  if (ext === "md") return "file-text";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return "image";
  if (["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) return "music";
  if (["mp4", "mov", "webm", "avi"].includes(ext)) return "video";
  if (["pdf"].includes(ext)) return "file-text";
  if (["js", "ts", "py", "rb", "css", "html", "json"].includes(ext)) return "code";
  return "file";
}
var ConfirmModal = class extends import_obsidian.Modal {
  constructor(app, message, confirmText, onConfirm, isDanger = false) {
    super(app);
    this.message = message;
    this.confirmText = confirmText;
    this.onConfirm = onConfirm;
    this.isDanger = isDanger;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("tm-confirm-modal");
    const icon = contentEl.createDiv("tm-confirm-icon");
    (0, import_obsidian.setIcon)(icon, this.isDanger ? "trash-2" : "refresh-cw");
    contentEl.createEl("p", { text: this.message, cls: "tm-confirm-message" });
    const btnRow = contentEl.createDiv("tm-confirm-buttons");
    const cancelBtn = btnRow.createEl("button", {
      text: "Cancel",
      cls: "tm-btn tm-btn-cancel"
    });
    cancelBtn.addEventListener("click", () => this.close());
    const confirmBtn = btnRow.createEl("button", {
      text: this.confirmText,
      cls: `tm-btn ${this.isDanger ? "tm-btn-danger" : "tm-btn-primary"}`
    });
    confirmBtn.addEventListener("click", () => {
      this.onConfirm();
      this.close();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var TrashManagerView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.trashItems = [];
    this.selectedPaths = /* @__PURE__ */ new Set();
    this.searchQuery = "";
    this.isLoading = false;
    this.listEl = null;
    this.headerEl = null;
    this.statusEl = null;
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_TRASH;
  }
  getDisplayText() {
    return "Trash Manager";
  }
  getIcon() {
    return "trash-2";
  }
  async onOpen() {
    this.containerEl.addClass("tm-view");
    this.buildUI();
    await this.loadTrash();
  }
  onClose() {
    this.containerEl.empty();
    return Promise.resolve();
  }
  // ── UI Construction ──────────────────────────────────────────────────────
  buildUI() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass("tm-root");
    this.headerEl = root.createDiv("tm-header");
    this.buildHeader(this.headerEl);
    const searchWrap = root.createDiv("tm-search-wrap");
    const searchIcon = searchWrap.createDiv("tm-search-icon");
    (0, import_obsidian.setIcon)(searchIcon, "search");
    const searchInput = searchWrap.createEl("input", {
      type: "text",
      placeholder: "Search trash\u2026",
      cls: "tm-search-input"
    });
    searchInput.addEventListener("input", () => {
      this.searchQuery = searchInput.value.toLowerCase();
      this.renderList();
    });
    const toolbar = root.createDiv("tm-toolbar");
    this.buildToolbar(toolbar);
    this.statusEl = root.createDiv("tm-status");
    this.listEl = root.createDiv("tm-list");
  }
  buildHeader(el) {
    el.empty();
    const title = el.createDiv("tm-title");
    const iconEl = title.createDiv("tm-title-icon");
    (0, import_obsidian.setIcon)(iconEl, "trash-2");
    title.createEl("span", { text: "Trash Manager" });
    const refreshBtn = el.createEl("button", { cls: "tm-icon-btn", title: "Refresh" });
    (0, import_obsidian.setIcon)(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", () => this.loadTrash());
  }
  buildToolbar(el) {
    el.empty();
    const left = el.createDiv("tm-toolbar-left");
    const selectAllBtn = left.createEl("button", { cls: "tm-btn tm-btn-ghost tm-btn-sm", text: "All" });
    selectAllBtn.addEventListener("click", () => this.selectAll());
    const selectNoneBtn = left.createEl("button", { cls: "tm-btn tm-btn-ghost tm-btn-sm", text: "None" });
    selectNoneBtn.addEventListener("click", () => this.selectNone());
    const right = el.createDiv("tm-toolbar-right");
    const restoreBtn = right.createEl("button", {
      cls: "tm-btn tm-btn-primary tm-btn-sm",
      title: "Restore selected"
    });
    const restoreIcon = restoreBtn.createSpan("tm-btn-icon");
    (0, import_obsidian.setIcon)(restoreIcon, "corner-up-left");
    restoreBtn.createSpan({ text: "Restore" });
    restoreBtn.addEventListener("click", () => this.restoreSelected());
    const emptyBtn = right.createEl("button", {
      cls: "tm-btn tm-btn-danger tm-btn-sm",
      title: "Empty trash"
    });
    const emptyIcon = emptyBtn.createSpan("tm-btn-icon");
    (0, import_obsidian.setIcon)(emptyIcon, "trash-2");
    emptyBtn.createSpan({ text: "Empty" });
    emptyBtn.addEventListener("click", () => this.emptyTrash());
  }
  // ── Data Loading ─────────────────────────────────────────────────────────
  async loadTrash() {
    if (this.isLoading) return;
    this.isLoading = true;
    this.setStatus("Loading\u2026");
    try {
      this.trashItems = await this.readTrashFolder();
      this.selectedPaths.clear();
      this.renderList();
    } catch (e) {
      console.error("[TrashManager] loadTrash error:", e);
      this.setStatus("Error loading trash.");
    } finally {
      this.isLoading = false;
    }
  }
  async readTrashFolder() {
    var _a, _b;
    const adapter = this.app.vault.adapter;
    const items = [];
    let exists = false;
    try {
      const stat = await adapter.stat(TRASH_FOLDER);
      exists = stat !== null;
    } catch (e) {
      exists = false;
    }
    if (!exists) return items;
    const listed = await adapter.list(TRASH_FOLDER);
    for (const filePath of listed.files) {
      const name = (_a = filePath.split("/").pop()) != null ? _a : filePath;
      const ext = name.includes(".") ? name.split(".").pop() : "";
      let size;
      try {
        const stat = await adapter.stat(filePath);
        if (stat) size = stat.size;
      } catch (e) {
      }
      items.push({ name, path: filePath, isFolder: false, size, extension: ext });
    }
    for (const folderPath of listed.folders) {
      const name = (_b = folderPath.split("/").pop()) != null ? _b : folderPath;
      const children = await this.readFolderRecursive(folderPath);
      items.push({ name, path: folderPath, isFolder: true, children });
    }
    items.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return items;
  }
  async readFolderRecursive(folderPath) {
    var _a, _b;
    const adapter = this.app.vault.adapter;
    const items = [];
    try {
      const listed = await adapter.list(folderPath);
      for (const filePath of listed.files) {
        const name = (_a = filePath.split("/").pop()) != null ? _a : filePath;
        const ext = name.includes(".") ? name.split(".").pop() : "";
        let size;
        try {
          const stat = await adapter.stat(filePath);
          if (stat) size = stat.size;
        } catch (e) {
        }
        items.push({ name, path: filePath, isFolder: false, size, extension: ext });
      }
      for (const sub of listed.folders) {
        const name = (_b = sub.split("/").pop()) != null ? _b : sub;
        const children = await this.readFolderRecursive(sub);
        items.push({ name, path: sub, isFolder: true, children });
      }
    } catch (e) {
    }
    return items;
  }
  // ── Rendering ────────────────────────────────────────────────────────────
  renderList() {
    if (!this.listEl) return;
    this.listEl.empty();
    const filtered = this.filterItems(this.trashItems, this.searchQuery);
    if (filtered.length === 0) {
      const empty = this.listEl.createDiv("tm-empty");
      const emptyIcon = empty.createDiv("tm-empty-icon");
      (0, import_obsidian.setIcon)(emptyIcon, "package-open");
      empty.createEl("p", { text: this.searchQuery ? "No results found." : "Trash is empty." });
      empty.createEl("p", {
        text: this.searchQuery ? "Try a different search term." : "Deleted files will appear here.",
        cls: "tm-empty-sub"
      });
      this.updateStatus(0, 0);
      return;
    }
    for (const item of filtered) {
      this.renderItem(this.listEl, item, 0);
    }
    this.updateStatus(filtered.length, this.selectedPaths.size);
  }
  filterItems(items, query) {
    if (!query) return items;
    return items.filter((item) => {
      if (item.name.toLowerCase().includes(query)) return true;
      if (item.isFolder && item.children) {
        return this.filterItems(item.children, query).length > 0;
      }
      return false;
    });
  }
  renderItem(container, item, depth) {
    const row = container.createDiv("tm-item");
    row.style.setProperty("--depth", String(depth));
    if (this.selectedPaths.has(item.path)) row.addClass("tm-selected");
    const checkWrap = row.createDiv("tm-checkbox-wrap");
    const checkbox = checkWrap.createEl("input", { type: "checkbox", cls: "tm-checkbox" });
    checkbox.checked = this.selectedPaths.has(item.path);
    checkbox.addEventListener("change", (e) => {
      e.stopPropagation();
      this.toggleSelect(item, checkbox.checked);
      row.toggleClass("tm-selected", checkbox.checked);
    });
    const iconEl = row.createDiv("tm-item-icon");
    (0, import_obsidian.setIcon)(iconEl, getFileIcon(item));
    if (item.isFolder) iconEl.addClass("tm-folder-icon");
    const info = row.createDiv("tm-item-info");
    info.createEl("span", { text: item.name, cls: "tm-item-name" });
    if (this.plugin.settings.showFileSize && !item.isFolder && item.size !== void 0) {
      info.createEl("span", { text: formatFileSize(item.size), cls: "tm-item-size" });
    }
    if (item.isFolder && item.children) {
      const count = this.countDescendants(item);
      info.createEl("span", { text: `${count} item${count !== 1 ? "s" : ""}`, cls: "tm-item-size" });
    }
    const actions = row.createDiv("tm-item-actions");
    const restoreBtn = actions.createEl("button", { cls: "tm-icon-btn tm-restore-btn", title: "Restore" });
    (0, import_obsidian.setIcon)(restoreBtn, "corner-up-left");
    restoreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.restoreItems([item]);
    });
    row.addEventListener("click", () => {
      const nowSelected = !this.selectedPaths.has(item.path);
      this.toggleSelect(item, nowSelected);
      checkbox.checked = nowSelected;
      row.toggleClass("tm-selected", nowSelected);
      this.updateStatus(this.trashItems.length, this.selectedPaths.size);
    });
    if (item.isFolder && item.children && item.children.length > 0) {
      const childContainer = container.createDiv("tm-folder-children");
      const visibleChildren = this.searchQuery ? this.filterItems(item.children, this.searchQuery) : item.children;
      for (const child of visibleChildren) {
        this.renderItem(childContainer, child, depth + 1);
      }
    }
  }
  countDescendants(item) {
    if (!item.isFolder || !item.children) return 0;
    let count = 0;
    for (const child of item.children) {
      count++;
      if (child.isFolder) count += this.countDescendants(child);
    }
    return count;
  }
  // ── Selection ────────────────────────────────────────────────────────────
  toggleSelect(item, selected) {
    if (selected) {
      this.selectedPaths.add(item.path);
    } else {
      this.selectedPaths.delete(item.path);
    }
    this.updateStatus(this.trashItems.length, this.selectedPaths.size);
  }
  selectAll() {
    for (const item of this.trashItems) {
      this.selectedPaths.add(item.path);
    }
    this.renderList();
  }
  selectNone() {
    this.selectedPaths.clear();
    this.renderList();
  }
  // ── Actions ──────────────────────────────────────────────────────────────
  restoreSelected() {
    const toRestore = this.trashItems.filter((i) => this.selectedPaths.has(i.path));
    if (toRestore.length === 0) {
      new import_obsidian.Notice("No items selected to restore.");
      return;
    }
    const doRestore = () => this.restoreItems(toRestore);
    if (this.plugin.settings.confirmRestore) {
      new ConfirmModal(
        this.app,
        `Restore ${toRestore.length} item${toRestore.length !== 1 ? "s" : ""} from trash?`,
        "Restore",
        doRestore,
        false
      ).open();
    } else {
      doRestore();
    }
  }
  async restoreItems(items) {
    const adapter = this.app.vault.adapter;
    let restored = 0;
    let failed = 0;
    for (const item of items) {
      try {
        await this.restoreSingle(adapter, item);
        restored++;
      } catch (e) {
        console.error("[TrashManager] restore error:", e, item);
        failed++;
      }
    }
    if (restored > 0) {
      new import_obsidian.Notice(`\u2713 Restored ${restored} item${restored !== 1 ? "s" : ""}.`);
    }
    if (failed > 0) {
      new import_obsidian.Notice(`\u26A0 Failed to restore ${failed} item${failed !== 1 ? "s" : ""}.`, 5e3);
    }
    await this.loadTrash();
  }
  async restoreSingle(adapter, item) {
    const originalPath = item.path.replace(/^\.trash\//, "");
    if (item.isFolder) {
      await this.restoreFolderRecursive(adapter, item, originalPath);
    } else {
      const parts = originalPath.split("/");
      if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join("/");
        await this.ensureFolderExists(parentPath);
      }
      const destPath = await this.resolveConflict(adapter, originalPath);
      const content = await adapter.readBinary(item.path);
      await adapter.writeBinary(destPath, content);
      await adapter.remove(item.path);
    }
  }
  async restoreFolderRecursive(adapter, folderItem, destPath) {
    await this.ensureFolderExists(destPath);
    if (folderItem.children) {
      for (const child of folderItem.children) {
        const childDest = destPath + "/" + child.name;
        if (child.isFolder) {
          await this.restoreFolderRecursive(adapter, child, childDest);
        } else {
          const resolvedDest = await this.resolveConflict(adapter, childDest);
          const content = await adapter.readBinary(child.path);
          await adapter.writeBinary(resolvedDest, content);
          await adapter.remove(child.path);
        }
      }
    }
    try {
      await adapter.rmdir(folderItem.path, false);
    } catch (e) {
    }
  }
  async ensureFolderExists(folderPath) {
    const adapter = this.app.vault.adapter;
    const parts = folderPath.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? current + "/" + part : part;
      try {
        const stat = await adapter.stat(current);
        if (!stat) {
          await adapter.mkdir(current);
        }
      } catch (e) {
        await adapter.mkdir(current);
      }
    }
  }
  async resolveConflict(adapter, path) {
    try {
      const stat = await adapter.stat(path);
      if (!stat) return path;
    } catch (e) {
      return path;
    }
    const dotIndex = path.lastIndexOf(".");
    const slashIndex = path.lastIndexOf("/");
    let base;
    let ext;
    if (dotIndex > slashIndex) {
      base = path.slice(0, dotIndex);
      ext = path.slice(dotIndex);
    } else {
      base = path;
      ext = "";
    }
    for (let i = 1; i <= 99; i++) {
      const candidate = `${base} (${i})${ext}`;
      try {
        const s = await adapter.stat(candidate);
        if (!s) return candidate;
      } catch (e) {
        return candidate;
      }
    }
    return path + "_restored";
  }
  emptyTrash() {
    if (this.trashItems.length === 0) {
      new import_obsidian.Notice("Trash is already empty.");
      return;
    }
    const doEmpty = async () => {
      const adapter = this.app.vault.adapter;
      let deleted = 0;
      let failed = 0;
      for (const item of this.trashItems) {
        try {
          if (item.isFolder) {
            await adapter.rmdir(item.path, true);
          } else {
            await adapter.remove(item.path);
          }
          deleted++;
        } catch (e) {
          console.error("[TrashManager] emptyTrash error:", e, item);
          failed++;
        }
      }
      if (deleted > 0) new import_obsidian.Notice(`\u{1F5D1} Emptied trash (${deleted} item${deleted !== 1 ? "s" : ""} deleted).`);
      if (failed > 0) new import_obsidian.Notice(`\u26A0 Could not delete ${failed} item${failed !== 1 ? "s" : ""}.`, 5e3);
      await this.loadTrash();
    };
    if (this.plugin.settings.confirmEmptyTrash) {
      new ConfirmModal(
        this.app,
        `Permanently delete all ${this.trashItems.length} item${this.trashItems.length !== 1 ? "s" : ""} in trash? This cannot be undone.`,
        "Empty Trash",
        doEmpty,
        true
      ).open();
    } else {
      doEmpty();
    }
  }
  // ── Status ───────────────────────────────────────────────────────────────
  setStatus(msg) {
    if (this.statusEl) this.statusEl.setText(msg);
  }
  updateStatus(total, selected) {
    if (!this.statusEl) return;
    if (selected > 0) {
      this.statusEl.setText(`${selected} of ${total} selected`);
    } else {
      this.statusEl.setText(total === 0 ? "Trash is empty" : `${total} item${total !== 1 ? "s" : ""} in trash`);
    }
  }
};
var TrashManagerSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Trash Manager Settings" });
    new import_obsidian.Setting(containerEl).setName("Confirm before emptying trash").setDesc("Show a confirmation dialog before permanently deleting all trash items.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.confirmEmptyTrash).onChange(async (value) => {
        this.plugin.settings.confirmEmptyTrash = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Confirm before restoring").setDesc("Show a confirmation dialog before restoring selected items.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.confirmRestore).onChange(async (value) => {
        this.plugin.settings.confirmRestore = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Show file sizes").setDesc("Display file size next to each item in the trash list.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showFileSize).onChange(async (value) => {
        this.plugin.settings.showFileSize = value;
        await this.plugin.saveSettings();
      })
    );
  }
};
var TrashManagerPlugin = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE_TRASH, (leaf) => new TrashManagerView(leaf, this));
    this.addRibbonIcon("trash-2", "Open Trash Manager", () => {
      this.activateView();
    });
    this.addCommand({
      id: "open-trash-manager",
      name: "Open Trash Manager",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "empty-trash",
      name: "Empty Trash",
      callback: () => {
        var _a, _b;
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TRASH);
        if (leaves.length > 0) {
          (_b = (_a = leaves[0].view).emptyTrash) == null ? void 0 : _b.call(_a);
        } else {
          this.activateView().then(() => {
          });
        }
      }
    });
    this.addSettingTab(new TrashManagerSettingTab(this.app, this));
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_TRASH);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_TRASH)[0];
    if (!leaf) {
      leaf = workspace.getLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE_TRASH, active: true });
    }
    workspace.revealLeaf(leaf);
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gIEFwcCxcbiAgUGx1Z2luLFxuICBQbHVnaW5TZXR0aW5nVGFiLFxuICBTZXR0aW5nLFxuICBNb2RhbCxcbiAgTm90aWNlLFxuICBURmlsZSxcbiAgVEZvbGRlcixcbiAgVEFic3RyYWN0RmlsZSxcbiAgSXRlbVZpZXcsXG4gIFdvcmtzcGFjZUxlYWYsXG4gIHNldEljb24sXG4gIG5vcm1hbGl6ZVBhdGgsXG59IGZyb20gXCJvYnNpZGlhblwiO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgQ29uc3RhbnRzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jb25zdCBWSUVXX1RZUEVfVFJBU0ggPSBcInRyYXNoLW1hbmFnZXItdmlld1wiO1xuY29uc3QgVFJBU0hfRk9MREVSID0gXCIudHJhc2hcIjtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEludGVyZmFjZXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmludGVyZmFjZSBUcmFzaEl0ZW0ge1xuICBuYW1lOiBzdHJpbmc7XG4gIHBhdGg6IHN0cmluZzsgLy8gcGF0aCBpbnNpZGUgLnRyYXNoXG4gIGlzRm9sZGVyOiBib29sZWFuO1xuICBzaXplPzogbnVtYmVyO1xuICBjaGlsZHJlbj86IFRyYXNoSXRlbVtdO1xuICBleHRlbnNpb24/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBUcmFzaE1hbmFnZXJTZXR0aW5ncyB7XG4gIGNvbmZpcm1FbXB0eVRyYXNoOiBib29sZWFuO1xuICBjb25maXJtUmVzdG9yZTogYm9vbGVhbjtcbiAgc2hvd0ZpbGVTaXplOiBib29sZWFuO1xuICBncm91cEJ5VHlwZTogYm9vbGVhbjtcbn1cblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogVHJhc2hNYW5hZ2VyU2V0dGluZ3MgPSB7XG4gIGNvbmZpcm1FbXB0eVRyYXNoOiB0cnVlLFxuICBjb25maXJtUmVzdG9yZTogZmFsc2UsXG4gIHNob3dGaWxlU2l6ZTogdHJ1ZSxcbiAgZ3JvdXBCeVR5cGU6IGZhbHNlLFxufTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEhlbHBlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGZvcm1hdEZpbGVTaXplKGJ5dGVzOiBudW1iZXIpOiBzdHJpbmcge1xuICBpZiAoYnl0ZXMgPCAxMDI0KSByZXR1cm4gYCR7Ynl0ZXN9IEJgO1xuICBpZiAoYnl0ZXMgPCAxMDI0ICogMTAyNCkgcmV0dXJuIGAkeyhieXRlcyAvIDEwMjQpLnRvRml4ZWQoMSl9IEtCYDtcbiAgcmV0dXJuIGAkeyhieXRlcyAvICgxMDI0ICogMTAyNCkpLnRvRml4ZWQoMSl9IE1CYDtcbn1cblxuZnVuY3Rpb24gZ2V0RmlsZUljb24oaXRlbTogVHJhc2hJdGVtKTogc3RyaW5nIHtcbiAgaWYgKGl0ZW0uaXNGb2xkZXIpIHJldHVybiBcImZvbGRlclwiO1xuICBjb25zdCBleHQgPSBpdGVtLmV4dGVuc2lvbj8udG9Mb3dlckNhc2UoKSA/PyBcIlwiO1xuICBpZiAoZXh0ID09PSBcIm1kXCIpIHJldHVybiBcImZpbGUtdGV4dFwiO1xuICBpZiAoW1wicG5nXCIsIFwianBnXCIsIFwianBlZ1wiLCBcImdpZlwiLCBcInN2Z1wiLCBcIndlYnBcIl0uaW5jbHVkZXMoZXh0KSkgcmV0dXJuIFwiaW1hZ2VcIjtcbiAgaWYgKFtcIm1wM1wiLCBcIndhdlwiLCBcIm9nZ1wiLCBcIm00YVwiLCBcImZsYWNcIl0uaW5jbHVkZXMoZXh0KSkgcmV0dXJuIFwibXVzaWNcIjtcbiAgaWYgKFtcIm1wNFwiLCBcIm1vdlwiLCBcIndlYm1cIiwgXCJhdmlcIl0uaW5jbHVkZXMoZXh0KSkgcmV0dXJuIFwidmlkZW9cIjtcbiAgaWYgKFtcInBkZlwiXS5pbmNsdWRlcyhleHQpKSByZXR1cm4gXCJmaWxlLXRleHRcIjtcbiAgaWYgKFtcImpzXCIsIFwidHNcIiwgXCJweVwiLCBcInJiXCIsIFwiY3NzXCIsIFwiaHRtbFwiLCBcImpzb25cIl0uaW5jbHVkZXMoZXh0KSkgcmV0dXJuIFwiY29kZVwiO1xuICByZXR1cm4gXCJmaWxlXCI7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBDb25maXJtIE1vZGFsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBDb25maXJtTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIHByaXZhdGUgbWVzc2FnZTogc3RyaW5nO1xuICBwcml2YXRlIGNvbmZpcm1UZXh0OiBzdHJpbmc7XG4gIHByaXZhdGUgb25Db25maXJtOiAoKSA9PiB2b2lkO1xuICBwcml2YXRlIGlzRGFuZ2VyOiBib29sZWFuO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIG1lc3NhZ2U6IHN0cmluZyxcbiAgICBjb25maXJtVGV4dDogc3RyaW5nLFxuICAgIG9uQ29uZmlybTogKCkgPT4gdm9pZCxcbiAgICBpc0RhbmdlciA9IGZhbHNlXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgICB0aGlzLmNvbmZpcm1UZXh0ID0gY29uZmlybVRleHQ7XG4gICAgdGhpcy5vbkNvbmZpcm0gPSBvbkNvbmZpcm07XG4gICAgdGhpcy5pc0RhbmdlciA9IGlzRGFuZ2VyO1xuICB9XG5cbiAgb25PcGVuKCkge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5hZGRDbGFzcyhcInRtLWNvbmZpcm0tbW9kYWxcIik7XG5cbiAgICBjb25zdCBpY29uID0gY29udGVudEVsLmNyZWF0ZURpdihcInRtLWNvbmZpcm0taWNvblwiKTtcbiAgICBzZXRJY29uKGljb24sIHRoaXMuaXNEYW5nZXIgPyBcInRyYXNoLTJcIiA6IFwicmVmcmVzaC1jd1wiKTtcblxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbChcInBcIiwgeyB0ZXh0OiB0aGlzLm1lc3NhZ2UsIGNsczogXCJ0bS1jb25maXJtLW1lc3NhZ2VcIiB9KTtcblxuICAgIGNvbnN0IGJ0blJvdyA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoXCJ0bS1jb25maXJtLWJ1dHRvbnNcIik7XG5cbiAgICBjb25zdCBjYW5jZWxCdG4gPSBidG5Sb3cuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgdGV4dDogXCJDYW5jZWxcIixcbiAgICAgIGNsczogXCJ0bS1idG4gdG0tYnRuLWNhbmNlbFwiLFxuICAgIH0pO1xuICAgIGNhbmNlbEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5jbG9zZSgpKTtcblxuICAgIGNvbnN0IGNvbmZpcm1CdG4gPSBidG5Sb3cuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgdGV4dDogdGhpcy5jb25maXJtVGV4dCxcbiAgICAgIGNsczogYHRtLWJ0biAke3RoaXMuaXNEYW5nZXIgPyBcInRtLWJ0bi1kYW5nZXJcIiA6IFwidG0tYnRuLXByaW1hcnlcIn1gLFxuICAgIH0pO1xuICAgIGNvbmZpcm1CdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIHRoaXMub25Db25maXJtKCk7XG4gICAgICB0aGlzLmNsb3NlKCk7XG4gICAgfSk7XG4gIH1cblxuICBvbkNsb3NlKCkge1xuICAgIHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRyYXNoIE1hbmFnZXIgVmlldyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgVHJhc2hNYW5hZ2VyVmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcbiAgcHJpdmF0ZSBwbHVnaW46IFRyYXNoTWFuYWdlclBsdWdpbjtcbiAgcHJpdmF0ZSB0cmFzaEl0ZW1zOiBUcmFzaEl0ZW1bXSA9IFtdO1xuICBwcml2YXRlIHNlbGVjdGVkUGF0aHM6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpO1xuICBwcml2YXRlIHNlYXJjaFF1ZXJ5ID0gXCJcIjtcbiAgcHJpdmF0ZSBpc0xvYWRpbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSBsaXN0RWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgaGVhZGVyRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgc3RhdHVzRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZiwgcGx1Z2luOiBUcmFzaE1hbmFnZXJQbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCkge1xuICAgIHJldHVybiBWSUVXX1RZUEVfVFJBU0g7XG4gIH1cblxuICBnZXREaXNwbGF5VGV4dCgpIHtcbiAgICByZXR1cm4gXCJUcmFzaCBNYW5hZ2VyXCI7XG4gIH1cblxuICBnZXRJY29uKCkge1xuICAgIHJldHVybiBcInRyYXNoLTJcIjtcbiAgfVxuXG4gIGFzeW5jIG9uT3BlbigpIHtcbiAgICB0aGlzLmNvbnRhaW5lckVsLmFkZENsYXNzKFwidG0tdmlld1wiKTtcbiAgICB0aGlzLmJ1aWxkVUkoKTtcbiAgICBhd2FpdCB0aGlzLmxvYWRUcmFzaCgpO1xuICB9XG5cbiAgb25DbG9zZSgpIHtcbiAgICB0aGlzLmNvbnRhaW5lckVsLmVtcHR5KCk7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFVJIENvbnN0cnVjdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIGJ1aWxkVUkoKSB7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGFpbmVyRWwuY2hpbGRyZW5bMV0gYXMgSFRNTEVsZW1lbnQ7XG4gICAgcm9vdC5lbXB0eSgpO1xuICAgIHJvb3QuYWRkQ2xhc3MoXCJ0bS1yb290XCIpO1xuXG4gICAgLy8gXHUyNTAwXHUyNTAwIEhlYWRlciBcdTI1MDBcdTI1MDBcbiAgICB0aGlzLmhlYWRlckVsID0gcm9vdC5jcmVhdGVEaXYoXCJ0bS1oZWFkZXJcIik7XG4gICAgdGhpcy5idWlsZEhlYWRlcih0aGlzLmhlYWRlckVsKTtcblxuICAgIC8vIFx1MjUwMFx1MjUwMCBTZWFyY2ggXHUyNTAwXHUyNTAwXG4gICAgY29uc3Qgc2VhcmNoV3JhcCA9IHJvb3QuY3JlYXRlRGl2KFwidG0tc2VhcmNoLXdyYXBcIik7XG4gICAgY29uc3Qgc2VhcmNoSWNvbiA9IHNlYXJjaFdyYXAuY3JlYXRlRGl2KFwidG0tc2VhcmNoLWljb25cIik7XG4gICAgc2V0SWNvbihzZWFyY2hJY29uLCBcInNlYXJjaFwiKTtcbiAgICBjb25zdCBzZWFyY2hJbnB1dCA9IHNlYXJjaFdyYXAuY3JlYXRlRWwoXCJpbnB1dFwiLCB7XG4gICAgICB0eXBlOiBcInRleHRcIixcbiAgICAgIHBsYWNlaG9sZGVyOiBcIlNlYXJjaCB0cmFzaFx1MjAyNlwiLFxuICAgICAgY2xzOiBcInRtLXNlYXJjaC1pbnB1dFwiLFxuICAgIH0pO1xuICAgIHNlYXJjaElucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XG4gICAgICB0aGlzLnNlYXJjaFF1ZXJ5ID0gc2VhcmNoSW5wdXQudmFsdWUudG9Mb3dlckNhc2UoKTtcbiAgICAgIHRoaXMucmVuZGVyTGlzdCgpO1xuICAgIH0pO1xuXG4gICAgLy8gXHUyNTAwXHUyNTAwIFRvb2xiYXIgXHUyNTAwXHUyNTAwXG4gICAgY29uc3QgdG9vbGJhciA9IHJvb3QuY3JlYXRlRGl2KFwidG0tdG9vbGJhclwiKTtcbiAgICB0aGlzLmJ1aWxkVG9vbGJhcih0b29sYmFyKTtcblxuICAgIC8vIFx1MjUwMFx1MjUwMCBTdGF0dXMgYmFyIFx1MjUwMFx1MjUwMFxuICAgIHRoaXMuc3RhdHVzRWwgPSByb290LmNyZWF0ZURpdihcInRtLXN0YXR1c1wiKTtcblxuICAgIC8vIFx1MjUwMFx1MjUwMCBMaXN0IGNvbnRhaW5lciBcdTI1MDBcdTI1MDBcbiAgICB0aGlzLmxpc3RFbCA9IHJvb3QuY3JlYXRlRGl2KFwidG0tbGlzdFwiKTtcbiAgfVxuXG4gIHByaXZhdGUgYnVpbGRIZWFkZXIoZWw6IEhUTUxFbGVtZW50KSB7XG4gICAgZWwuZW1wdHkoKTtcbiAgICBjb25zdCB0aXRsZSA9IGVsLmNyZWF0ZURpdihcInRtLXRpdGxlXCIpO1xuICAgIGNvbnN0IGljb25FbCA9IHRpdGxlLmNyZWF0ZURpdihcInRtLXRpdGxlLWljb25cIik7XG4gICAgc2V0SWNvbihpY29uRWwsIFwidHJhc2gtMlwiKTtcbiAgICB0aXRsZS5jcmVhdGVFbChcInNwYW5cIiwgeyB0ZXh0OiBcIlRyYXNoIE1hbmFnZXJcIiB9KTtcblxuICAgIGNvbnN0IHJlZnJlc2hCdG4gPSBlbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJ0bS1pY29uLWJ0blwiLCB0aXRsZTogXCJSZWZyZXNoXCIgfSk7XG4gICAgc2V0SWNvbihyZWZyZXNoQnRuLCBcInJlZnJlc2gtY3dcIik7XG4gICAgcmVmcmVzaEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5sb2FkVHJhc2goKSk7XG4gIH1cblxuICBwcml2YXRlIGJ1aWxkVG9vbGJhcihlbDogSFRNTEVsZW1lbnQpIHtcbiAgICBlbC5lbXB0eSgpO1xuXG4gICAgLy8gTGVmdDogc2VsZWN0IGNvbnRyb2xzXG4gICAgY29uc3QgbGVmdCA9IGVsLmNyZWF0ZURpdihcInRtLXRvb2xiYXItbGVmdFwiKTtcblxuICAgIGNvbnN0IHNlbGVjdEFsbEJ0biA9IGxlZnQuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwidG0tYnRuIHRtLWJ0bi1naG9zdCB0bS1idG4tc21cIiwgdGV4dDogXCJBbGxcIiB9KTtcbiAgICBzZWxlY3RBbGxCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHRoaXMuc2VsZWN0QWxsKCkpO1xuXG4gICAgY29uc3Qgc2VsZWN0Tm9uZUJ0biA9IGxlZnQuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwidG0tYnRuIHRtLWJ0bi1naG9zdCB0bS1idG4tc21cIiwgdGV4dDogXCJOb25lXCIgfSk7XG4gICAgc2VsZWN0Tm9uZUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5zZWxlY3ROb25lKCkpO1xuXG4gICAgLy8gUmlnaHQ6IGFjdGlvbnNcbiAgICBjb25zdCByaWdodCA9IGVsLmNyZWF0ZURpdihcInRtLXRvb2xiYXItcmlnaHRcIik7XG5cbiAgICBjb25zdCByZXN0b3JlQnRuID0gcmlnaHQuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgY2xzOiBcInRtLWJ0biB0bS1idG4tcHJpbWFyeSB0bS1idG4tc21cIixcbiAgICAgIHRpdGxlOiBcIlJlc3RvcmUgc2VsZWN0ZWRcIixcbiAgICB9KTtcbiAgICBjb25zdCByZXN0b3JlSWNvbiA9IHJlc3RvcmVCdG4uY3JlYXRlU3BhbihcInRtLWJ0bi1pY29uXCIpO1xuICAgIHNldEljb24ocmVzdG9yZUljb24sIFwiY29ybmVyLXVwLWxlZnRcIik7XG4gICAgcmVzdG9yZUJ0bi5jcmVhdGVTcGFuKHsgdGV4dDogXCJSZXN0b3JlXCIgfSk7XG4gICAgcmVzdG9yZUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5yZXN0b3JlU2VsZWN0ZWQoKSk7XG5cbiAgICBjb25zdCBlbXB0eUJ0biA9IHJpZ2h0LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgIGNsczogXCJ0bS1idG4gdG0tYnRuLWRhbmdlciB0bS1idG4tc21cIixcbiAgICAgIHRpdGxlOiBcIkVtcHR5IHRyYXNoXCIsXG4gICAgfSk7XG4gICAgY29uc3QgZW1wdHlJY29uID0gZW1wdHlCdG4uY3JlYXRlU3BhbihcInRtLWJ0bi1pY29uXCIpO1xuICAgIHNldEljb24oZW1wdHlJY29uLCBcInRyYXNoLTJcIik7XG4gICAgZW1wdHlCdG4uY3JlYXRlU3Bhbih7IHRleHQ6IFwiRW1wdHlcIiB9KTtcbiAgICBlbXB0eUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5lbXB0eVRyYXNoKCkpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIERhdGEgTG9hZGluZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBhc3luYyBsb2FkVHJhc2goKSB7XG4gICAgaWYgKHRoaXMuaXNMb2FkaW5nKSByZXR1cm47XG4gICAgdGhpcy5pc0xvYWRpbmcgPSB0cnVlO1xuICAgIHRoaXMuc2V0U3RhdHVzKFwiTG9hZGluZ1x1MjAyNlwiKTtcblxuICAgIHRyeSB7XG4gICAgICB0aGlzLnRyYXNoSXRlbXMgPSBhd2FpdCB0aGlzLnJlYWRUcmFzaEZvbGRlcigpO1xuICAgICAgdGhpcy5zZWxlY3RlZFBhdGhzLmNsZWFyKCk7XG4gICAgICB0aGlzLnJlbmRlckxpc3QoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiW1RyYXNoTWFuYWdlcl0gbG9hZFRyYXNoIGVycm9yOlwiLCBlKTtcbiAgICAgIHRoaXMuc2V0U3RhdHVzKFwiRXJyb3IgbG9hZGluZyB0cmFzaC5cIik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuaXNMb2FkaW5nID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZWFkVHJhc2hGb2xkZXIoKTogUHJvbWlzZTxUcmFzaEl0ZW1bXT4ge1xuICAgIGNvbnN0IGFkYXB0ZXIgPSB0aGlzLmFwcC52YXVsdC5hZGFwdGVyO1xuICAgIGNvbnN0IGl0ZW1zOiBUcmFzaEl0ZW1bXSA9IFtdO1xuXG4gICAgbGV0IGV4aXN0cyA9IGZhbHNlO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzdGF0ID0gYXdhaXQgYWRhcHRlci5zdGF0KFRSQVNIX0ZPTERFUik7XG4gICAgICBleGlzdHMgPSBzdGF0ICE9PSBudWxsO1xuICAgIH0gY2F0Y2gge1xuICAgICAgZXhpc3RzID0gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKCFleGlzdHMpIHJldHVybiBpdGVtcztcblxuICAgIGNvbnN0IGxpc3RlZCA9IGF3YWl0IGFkYXB0ZXIubGlzdChUUkFTSF9GT0xERVIpO1xuXG4gICAgLy8gRmlsZXNcbiAgICBmb3IgKGNvbnN0IGZpbGVQYXRoIG9mIGxpc3RlZC5maWxlcykge1xuICAgICAgY29uc3QgbmFtZSA9IGZpbGVQYXRoLnNwbGl0KFwiL1wiKS5wb3AoKSA/PyBmaWxlUGF0aDtcbiAgICAgIGNvbnN0IGV4dCA9IG5hbWUuaW5jbHVkZXMoXCIuXCIpID8gbmFtZS5zcGxpdChcIi5cIikucG9wKCkgOiBcIlwiO1xuICAgICAgbGV0IHNpemU6IG51bWJlciB8IHVuZGVmaW5lZDtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHN0YXQgPSBhd2FpdCBhZGFwdGVyLnN0YXQoZmlsZVBhdGgpO1xuICAgICAgICBpZiAoc3RhdCkgc2l6ZSA9IHN0YXQuc2l6ZTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyBpZ25vcmVcbiAgICAgIH1cbiAgICAgIGl0ZW1zLnB1c2goeyBuYW1lLCBwYXRoOiBmaWxlUGF0aCwgaXNGb2xkZXI6IGZhbHNlLCBzaXplLCBleHRlbnNpb246IGV4dCB9KTtcbiAgICB9XG5cbiAgICAvLyBGb2xkZXJzXG4gICAgZm9yIChjb25zdCBmb2xkZXJQYXRoIG9mIGxpc3RlZC5mb2xkZXJzKSB7XG4gICAgICBjb25zdCBuYW1lID0gZm9sZGVyUGF0aC5zcGxpdChcIi9cIikucG9wKCkgPz8gZm9sZGVyUGF0aDtcbiAgICAgIGNvbnN0IGNoaWxkcmVuID0gYXdhaXQgdGhpcy5yZWFkRm9sZGVyUmVjdXJzaXZlKGZvbGRlclBhdGgpO1xuICAgICAgaXRlbXMucHVzaCh7IG5hbWUsIHBhdGg6IGZvbGRlclBhdGgsIGlzRm9sZGVyOiB0cnVlLCBjaGlsZHJlbiB9KTtcbiAgICB9XG5cbiAgICAvLyBTb3J0OiBmb2xkZXJzIGZpcnN0LCB0aGVuIGJ5IG5hbWVcbiAgICBpdGVtcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICBpZiAoYS5pc0ZvbGRlciAhPT0gYi5pc0ZvbGRlcikgcmV0dXJuIGEuaXNGb2xkZXIgPyAtMSA6IDE7XG4gICAgICByZXR1cm4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBpdGVtcztcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVhZEZvbGRlclJlY3Vyc2l2ZShmb2xkZXJQYXRoOiBzdHJpbmcpOiBQcm9taXNlPFRyYXNoSXRlbVtdPiB7XG4gICAgY29uc3QgYWRhcHRlciA9IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXI7XG4gICAgY29uc3QgaXRlbXM6IFRyYXNoSXRlbVtdID0gW107XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGxpc3RlZCA9IGF3YWl0IGFkYXB0ZXIubGlzdChmb2xkZXJQYXRoKTtcbiAgICAgIGZvciAoY29uc3QgZmlsZVBhdGggb2YgbGlzdGVkLmZpbGVzKSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBmaWxlUGF0aC5zcGxpdChcIi9cIikucG9wKCkgPz8gZmlsZVBhdGg7XG4gICAgICAgIGNvbnN0IGV4dCA9IG5hbWUuaW5jbHVkZXMoXCIuXCIpID8gbmFtZS5zcGxpdChcIi5cIikucG9wKCkgOiBcIlwiO1xuICAgICAgICBsZXQgc2l6ZTogbnVtYmVyIHwgdW5kZWZpbmVkO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHN0YXQgPSBhd2FpdCBhZGFwdGVyLnN0YXQoZmlsZVBhdGgpO1xuICAgICAgICAgIGlmIChzdGF0KSBzaXplID0gc3RhdC5zaXplO1xuICAgICAgICB9IGNhdGNoIHsgLyogaWdub3JlICovIH1cbiAgICAgICAgaXRlbXMucHVzaCh7IG5hbWUsIHBhdGg6IGZpbGVQYXRoLCBpc0ZvbGRlcjogZmFsc2UsIHNpemUsIGV4dGVuc2lvbjogZXh0IH0pO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBzdWIgb2YgbGlzdGVkLmZvbGRlcnMpIHtcbiAgICAgICAgY29uc3QgbmFtZSA9IHN1Yi5zcGxpdChcIi9cIikucG9wKCkgPz8gc3ViO1xuICAgICAgICBjb25zdCBjaGlsZHJlbiA9IGF3YWl0IHRoaXMucmVhZEZvbGRlclJlY3Vyc2l2ZShzdWIpO1xuICAgICAgICBpdGVtcy5wdXNoKHsgbmFtZSwgcGF0aDogc3ViLCBpc0ZvbGRlcjogdHJ1ZSwgY2hpbGRyZW4gfSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCB7IC8qIGlnbm9yZSAqLyB9XG4gICAgcmV0dXJuIGl0ZW1zO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFJlbmRlcmluZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIHJlbmRlckxpc3QoKSB7XG4gICAgaWYgKCF0aGlzLmxpc3RFbCkgcmV0dXJuO1xuICAgIHRoaXMubGlzdEVsLmVtcHR5KCk7XG5cbiAgICBjb25zdCBmaWx0ZXJlZCA9IHRoaXMuZmlsdGVySXRlbXModGhpcy50cmFzaEl0ZW1zLCB0aGlzLnNlYXJjaFF1ZXJ5KTtcblxuICAgIGlmIChmaWx0ZXJlZC5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnN0IGVtcHR5ID0gdGhpcy5saXN0RWwuY3JlYXRlRGl2KFwidG0tZW1wdHlcIik7XG4gICAgICBjb25zdCBlbXB0eUljb24gPSBlbXB0eS5jcmVhdGVEaXYoXCJ0bS1lbXB0eS1pY29uXCIpO1xuICAgICAgc2V0SWNvbihlbXB0eUljb24sIFwicGFja2FnZS1vcGVuXCIpO1xuICAgICAgZW1wdHkuY3JlYXRlRWwoXCJwXCIsIHsgdGV4dDogdGhpcy5zZWFyY2hRdWVyeSA/IFwiTm8gcmVzdWx0cyBmb3VuZC5cIiA6IFwiVHJhc2ggaXMgZW1wdHkuXCIgfSk7XG4gICAgICBlbXB0eS5jcmVhdGVFbChcInBcIiwge1xuICAgICAgICB0ZXh0OiB0aGlzLnNlYXJjaFF1ZXJ5ID8gXCJUcnkgYSBkaWZmZXJlbnQgc2VhcmNoIHRlcm0uXCIgOiBcIkRlbGV0ZWQgZmlsZXMgd2lsbCBhcHBlYXIgaGVyZS5cIixcbiAgICAgICAgY2xzOiBcInRtLWVtcHR5LXN1YlwiLFxuICAgICAgfSk7XG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cygwLCAwKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgZmlsdGVyZWQpIHtcbiAgICAgIHRoaXMucmVuZGVySXRlbSh0aGlzLmxpc3RFbCwgaXRlbSwgMCk7XG4gICAgfVxuXG4gICAgdGhpcy51cGRhdGVTdGF0dXMoZmlsdGVyZWQubGVuZ3RoLCB0aGlzLnNlbGVjdGVkUGF0aHMuc2l6ZSk7XG4gIH1cblxuICBwcml2YXRlIGZpbHRlckl0ZW1zKGl0ZW1zOiBUcmFzaEl0ZW1bXSwgcXVlcnk6IHN0cmluZyk6IFRyYXNoSXRlbVtdIHtcbiAgICBpZiAoIXF1ZXJ5KSByZXR1cm4gaXRlbXM7XG4gICAgcmV0dXJuIGl0ZW1zLmZpbHRlcigoaXRlbSkgPT4ge1xuICAgICAgaWYgKGl0ZW0ubmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHF1ZXJ5KSkgcmV0dXJuIHRydWU7XG4gICAgICBpZiAoaXRlbS5pc0ZvbGRlciAmJiBpdGVtLmNoaWxkcmVuKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZpbHRlckl0ZW1zKGl0ZW0uY2hpbGRyZW4sIHF1ZXJ5KS5sZW5ndGggPiAwO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJJdGVtKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGl0ZW06IFRyYXNoSXRlbSwgZGVwdGg6IG51bWJlcikge1xuICAgIGNvbnN0IHJvdyA9IGNvbnRhaW5lci5jcmVhdGVEaXYoXCJ0bS1pdGVtXCIpO1xuICAgIHJvdy5zdHlsZS5zZXRQcm9wZXJ0eShcIi0tZGVwdGhcIiwgU3RyaW5nKGRlcHRoKSk7XG4gICAgaWYgKHRoaXMuc2VsZWN0ZWRQYXRocy5oYXMoaXRlbS5wYXRoKSkgcm93LmFkZENsYXNzKFwidG0tc2VsZWN0ZWRcIik7XG5cbiAgICAvLyBDaGVja2JveFxuICAgIGNvbnN0IGNoZWNrV3JhcCA9IHJvdy5jcmVhdGVEaXYoXCJ0bS1jaGVja2JveC13cmFwXCIpO1xuICAgIGNvbnN0IGNoZWNrYm94ID0gY2hlY2tXcmFwLmNyZWF0ZUVsKFwiaW5wdXRcIiwgeyB0eXBlOiBcImNoZWNrYm94XCIsIGNsczogXCJ0bS1jaGVja2JveFwiIH0pO1xuICAgIGNoZWNrYm94LmNoZWNrZWQgPSB0aGlzLnNlbGVjdGVkUGF0aHMuaGFzKGl0ZW0ucGF0aCk7XG4gICAgY2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCAoZSkgPT4ge1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIHRoaXMudG9nZ2xlU2VsZWN0KGl0ZW0sIGNoZWNrYm94LmNoZWNrZWQpO1xuICAgICAgcm93LnRvZ2dsZUNsYXNzKFwidG0tc2VsZWN0ZWRcIiwgY2hlY2tib3guY2hlY2tlZCk7XG4gICAgfSk7XG5cbiAgICAvLyBJY29uXG4gICAgY29uc3QgaWNvbkVsID0gcm93LmNyZWF0ZURpdihcInRtLWl0ZW0taWNvblwiKTtcbiAgICBzZXRJY29uKGljb25FbCwgZ2V0RmlsZUljb24oaXRlbSkpO1xuICAgIGlmIChpdGVtLmlzRm9sZGVyKSBpY29uRWwuYWRkQ2xhc3MoXCJ0bS1mb2xkZXItaWNvblwiKTtcblxuICAgIC8vIEluZm9cbiAgICBjb25zdCBpbmZvID0gcm93LmNyZWF0ZURpdihcInRtLWl0ZW0taW5mb1wiKTtcbiAgICBpbmZvLmNyZWF0ZUVsKFwic3BhblwiLCB7IHRleHQ6IGl0ZW0ubmFtZSwgY2xzOiBcInRtLWl0ZW0tbmFtZVwiIH0pO1xuICAgIGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93RmlsZVNpemUgJiYgIWl0ZW0uaXNGb2xkZXIgJiYgaXRlbS5zaXplICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGluZm8uY3JlYXRlRWwoXCJzcGFuXCIsIHsgdGV4dDogZm9ybWF0RmlsZVNpemUoaXRlbS5zaXplKSwgY2xzOiBcInRtLWl0ZW0tc2l6ZVwiIH0pO1xuICAgIH1cbiAgICBpZiAoaXRlbS5pc0ZvbGRlciAmJiBpdGVtLmNoaWxkcmVuKSB7XG4gICAgICBjb25zdCBjb3VudCA9IHRoaXMuY291bnREZXNjZW5kYW50cyhpdGVtKTtcbiAgICAgIGluZm8uY3JlYXRlRWwoXCJzcGFuXCIsIHsgdGV4dDogYCR7Y291bnR9IGl0ZW0ke2NvdW50ICE9PSAxID8gXCJzXCIgOiBcIlwifWAsIGNsczogXCJ0bS1pdGVtLXNpemVcIiB9KTtcbiAgICB9XG5cbiAgICAvLyBSZXN0b3JlIGJ1dHRvbiAocGVyLXJvdyBxdWljayBhY3Rpb24pXG4gICAgY29uc3QgYWN0aW9ucyA9IHJvdy5jcmVhdGVEaXYoXCJ0bS1pdGVtLWFjdGlvbnNcIik7XG4gICAgY29uc3QgcmVzdG9yZUJ0biA9IGFjdGlvbnMuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwidG0taWNvbi1idG4gdG0tcmVzdG9yZS1idG5cIiwgdGl0bGU6IFwiUmVzdG9yZVwiIH0pO1xuICAgIHNldEljb24ocmVzdG9yZUJ0biwgXCJjb3JuZXItdXAtbGVmdFwiKTtcbiAgICByZXN0b3JlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIHRoaXMucmVzdG9yZUl0ZW1zKFtpdGVtXSk7XG4gICAgfSk7XG5cbiAgICAvLyBDbGljayByb3cgdG8gdG9nZ2xlIHNlbGVjdFxuICAgIHJvdy5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgY29uc3Qgbm93U2VsZWN0ZWQgPSAhdGhpcy5zZWxlY3RlZFBhdGhzLmhhcyhpdGVtLnBhdGgpO1xuICAgICAgdGhpcy50b2dnbGVTZWxlY3QoaXRlbSwgbm93U2VsZWN0ZWQpO1xuICAgICAgY2hlY2tib3guY2hlY2tlZCA9IG5vd1NlbGVjdGVkO1xuICAgICAgcm93LnRvZ2dsZUNsYXNzKFwidG0tc2VsZWN0ZWRcIiwgbm93U2VsZWN0ZWQpO1xuICAgICAgdGhpcy51cGRhdGVTdGF0dXModGhpcy50cmFzaEl0ZW1zLmxlbmd0aCwgdGhpcy5zZWxlY3RlZFBhdGhzLnNpemUpO1xuICAgIH0pO1xuXG4gICAgLy8gUmVuZGVyIGNoaWxkcmVuIGlmIGZvbGRlclxuICAgIGlmIChpdGVtLmlzRm9sZGVyICYmIGl0ZW0uY2hpbGRyZW4gJiYgaXRlbS5jaGlsZHJlbi5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBjaGlsZENvbnRhaW5lciA9IGNvbnRhaW5lci5jcmVhdGVEaXYoXCJ0bS1mb2xkZXItY2hpbGRyZW5cIik7XG4gICAgICBjb25zdCB2aXNpYmxlQ2hpbGRyZW4gPSB0aGlzLnNlYXJjaFF1ZXJ5XG4gICAgICAgID8gdGhpcy5maWx0ZXJJdGVtcyhpdGVtLmNoaWxkcmVuLCB0aGlzLnNlYXJjaFF1ZXJ5KVxuICAgICAgICA6IGl0ZW0uY2hpbGRyZW47XG4gICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIHZpc2libGVDaGlsZHJlbikge1xuICAgICAgICB0aGlzLnJlbmRlckl0ZW0oY2hpbGRDb250YWluZXIsIGNoaWxkLCBkZXB0aCArIDEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY291bnREZXNjZW5kYW50cyhpdGVtOiBUcmFzaEl0ZW0pOiBudW1iZXIge1xuICAgIGlmICghaXRlbS5pc0ZvbGRlciB8fCAhaXRlbS5jaGlsZHJlbikgcmV0dXJuIDA7XG4gICAgbGV0IGNvdW50ID0gMDtcbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGl0ZW0uY2hpbGRyZW4pIHtcbiAgICAgIGNvdW50Kys7XG4gICAgICBpZiAoY2hpbGQuaXNGb2xkZXIpIGNvdW50ICs9IHRoaXMuY291bnREZXNjZW5kYW50cyhjaGlsZCk7XG4gICAgfVxuICAgIHJldHVybiBjb3VudDtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBTZWxlY3Rpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgcHJpdmF0ZSB0b2dnbGVTZWxlY3QoaXRlbTogVHJhc2hJdGVtLCBzZWxlY3RlZDogYm9vbGVhbikge1xuICAgIGlmIChzZWxlY3RlZCkge1xuICAgICAgdGhpcy5zZWxlY3RlZFBhdGhzLmFkZChpdGVtLnBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNlbGVjdGVkUGF0aHMuZGVsZXRlKGl0ZW0ucGF0aCk7XG4gICAgfVxuICAgIHRoaXMudXBkYXRlU3RhdHVzKHRoaXMudHJhc2hJdGVtcy5sZW5ndGgsIHRoaXMuc2VsZWN0ZWRQYXRocy5zaXplKTtcbiAgfVxuXG4gIHByaXZhdGUgc2VsZWN0QWxsKCkge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLnRyYXNoSXRlbXMpIHtcbiAgICAgIHRoaXMuc2VsZWN0ZWRQYXRocy5hZGQoaXRlbS5wYXRoKTtcbiAgICB9XG4gICAgdGhpcy5yZW5kZXJMaXN0KCk7XG4gIH1cblxuICBwcml2YXRlIHNlbGVjdE5vbmUoKSB7XG4gICAgdGhpcy5zZWxlY3RlZFBhdGhzLmNsZWFyKCk7XG4gICAgdGhpcy5yZW5kZXJMaXN0KCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgQWN0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIHJlc3RvcmVTZWxlY3RlZCgpIHtcbiAgICBjb25zdCB0b1Jlc3RvcmUgPSB0aGlzLnRyYXNoSXRlbXMuZmlsdGVyKChpKSA9PiB0aGlzLnNlbGVjdGVkUGF0aHMuaGFzKGkucGF0aCkpO1xuICAgIGlmICh0b1Jlc3RvcmUubGVuZ3RoID09PSAwKSB7XG4gICAgICBuZXcgTm90aWNlKFwiTm8gaXRlbXMgc2VsZWN0ZWQgdG8gcmVzdG9yZS5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZG9SZXN0b3JlID0gKCkgPT4gdGhpcy5yZXN0b3JlSXRlbXModG9SZXN0b3JlKTtcblxuICAgIGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb25maXJtUmVzdG9yZSkge1xuICAgICAgbmV3IENvbmZpcm1Nb2RhbChcbiAgICAgICAgdGhpcy5hcHAsXG4gICAgICAgIGBSZXN0b3JlICR7dG9SZXN0b3JlLmxlbmd0aH0gaXRlbSR7dG9SZXN0b3JlLmxlbmd0aCAhPT0gMSA/IFwic1wiIDogXCJcIn0gZnJvbSB0cmFzaD9gLFxuICAgICAgICBcIlJlc3RvcmVcIixcbiAgICAgICAgZG9SZXN0b3JlLFxuICAgICAgICBmYWxzZVxuICAgICAgKS5vcGVuKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRvUmVzdG9yZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVzdG9yZUl0ZW1zKGl0ZW1zOiBUcmFzaEl0ZW1bXSkge1xuICAgIGNvbnN0IGFkYXB0ZXIgPSB0aGlzLmFwcC52YXVsdC5hZGFwdGVyO1xuICAgIGxldCByZXN0b3JlZCA9IDA7XG4gICAgbGV0IGZhaWxlZCA9IDA7XG5cbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHRoaXMucmVzdG9yZVNpbmdsZShhZGFwdGVyLCBpdGVtKTtcbiAgICAgICAgcmVzdG9yZWQrKztcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIltUcmFzaE1hbmFnZXJdIHJlc3RvcmUgZXJyb3I6XCIsIGUsIGl0ZW0pO1xuICAgICAgICBmYWlsZWQrKztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocmVzdG9yZWQgPiAwKSB7XG4gICAgICBuZXcgTm90aWNlKGBcdTI3MTMgUmVzdG9yZWQgJHtyZXN0b3JlZH0gaXRlbSR7cmVzdG9yZWQgIT09IDEgPyBcInNcIiA6IFwiXCJ9LmApO1xuICAgIH1cbiAgICBpZiAoZmFpbGVkID4gMCkge1xuICAgICAgbmV3IE5vdGljZShgXHUyNkEwIEZhaWxlZCB0byByZXN0b3JlICR7ZmFpbGVkfSBpdGVtJHtmYWlsZWQgIT09IDEgPyBcInNcIiA6IFwiXCJ9LmAsIDUwMDApO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMubG9hZFRyYXNoKCk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlc3RvcmVTaW5nbGUoYWRhcHRlcjogYW55LCBpdGVtOiBUcmFzaEl0ZW0pIHtcbiAgICAvLyBTdHJpcCB0aGUgXCIudHJhc2gvXCIgcHJlZml4IHRvIGdldCB0aGUgb3JpZ2luYWwgcGF0aFxuICAgIGNvbnN0IG9yaWdpbmFsUGF0aCA9IGl0ZW0ucGF0aC5yZXBsYWNlKC9eXFwudHJhc2hcXC8vLCBcIlwiKTtcblxuICAgIGlmIChpdGVtLmlzRm9sZGVyKSB7XG4gICAgICBhd2FpdCB0aGlzLnJlc3RvcmVGb2xkZXJSZWN1cnNpdmUoYWRhcHRlciwgaXRlbSwgb3JpZ2luYWxQYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRW5zdXJlIHBhcmVudCBkaXJlY3RvcnkgZXhpc3RzXG4gICAgICBjb25zdCBwYXJ0cyA9IG9yaWdpbmFsUGF0aC5zcGxpdChcIi9cIik7XG4gICAgICBpZiAocGFydHMubGVuZ3RoID4gMSkge1xuICAgICAgICBjb25zdCBwYXJlbnRQYXRoID0gcGFydHMuc2xpY2UoMCwgLTEpLmpvaW4oXCIvXCIpO1xuICAgICAgICBhd2FpdCB0aGlzLmVuc3VyZUZvbGRlckV4aXN0cyhwYXJlbnRQYXRoKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgZm9yIGNvbGxpc2lvblxuICAgICAgY29uc3QgZGVzdFBhdGggPSBhd2FpdCB0aGlzLnJlc29sdmVDb25mbGljdChhZGFwdGVyLCBvcmlnaW5hbFBhdGgpO1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGFkYXB0ZXIucmVhZEJpbmFyeShpdGVtLnBhdGgpO1xuICAgICAgYXdhaXQgYWRhcHRlci53cml0ZUJpbmFyeShkZXN0UGF0aCwgY29udGVudCk7XG4gICAgICBhd2FpdCBhZGFwdGVyLnJlbW92ZShpdGVtLnBhdGgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVzdG9yZUZvbGRlclJlY3Vyc2l2ZShhZGFwdGVyOiBhbnksIGZvbGRlckl0ZW06IFRyYXNoSXRlbSwgZGVzdFBhdGg6IHN0cmluZykge1xuICAgIGF3YWl0IHRoaXMuZW5zdXJlRm9sZGVyRXhpc3RzKGRlc3RQYXRoKTtcblxuICAgIGlmIChmb2xkZXJJdGVtLmNoaWxkcmVuKSB7XG4gICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGZvbGRlckl0ZW0uY2hpbGRyZW4pIHtcbiAgICAgICAgY29uc3QgY2hpbGREZXN0ID0gZGVzdFBhdGggKyBcIi9cIiArIGNoaWxkLm5hbWU7XG4gICAgICAgIGlmIChjaGlsZC5pc0ZvbGRlcikge1xuICAgICAgICAgIGF3YWl0IHRoaXMucmVzdG9yZUZvbGRlclJlY3Vyc2l2ZShhZGFwdGVyLCBjaGlsZCwgY2hpbGREZXN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCByZXNvbHZlZERlc3QgPSBhd2FpdCB0aGlzLnJlc29sdmVDb25mbGljdChhZGFwdGVyLCBjaGlsZERlc3QpO1xuICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBhZGFwdGVyLnJlYWRCaW5hcnkoY2hpbGQucGF0aCk7XG4gICAgICAgICAgYXdhaXQgYWRhcHRlci53cml0ZUJpbmFyeShyZXNvbHZlZERlc3QsIGNvbnRlbnQpO1xuICAgICAgICAgIGF3YWl0IGFkYXB0ZXIucmVtb3ZlKGNoaWxkLnBhdGgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gVHJ5IHRvIHJlbW92ZSB0aGUgbm93LWVtcHR5IHRyYXNoIGZvbGRlclxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBhZGFwdGVyLnJtZGlyKGZvbGRlckl0ZW0ucGF0aCwgZmFsc2UpO1xuICAgIH0gY2F0Y2ggeyAvKiBpZ25vcmUgaWYgbm90IGVtcHR5ICovIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZW5zdXJlRm9sZGVyRXhpc3RzKGZvbGRlclBhdGg6IHN0cmluZykge1xuICAgIGNvbnN0IGFkYXB0ZXIgPSB0aGlzLmFwcC52YXVsdC5hZGFwdGVyO1xuICAgIGNvbnN0IHBhcnRzID0gZm9sZGVyUGF0aC5zcGxpdChcIi9cIik7XG4gICAgbGV0IGN1cnJlbnQgPSBcIlwiO1xuICAgIGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xuICAgICAgY3VycmVudCA9IGN1cnJlbnQgPyBjdXJyZW50ICsgXCIvXCIgKyBwYXJ0IDogcGFydDtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHN0YXQgPSBhd2FpdCBhZGFwdGVyLnN0YXQoY3VycmVudCk7XG4gICAgICAgIGlmICghc3RhdCkge1xuICAgICAgICAgIGF3YWl0IGFkYXB0ZXIubWtkaXIoY3VycmVudCk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICBhd2FpdCBhZGFwdGVyLm1rZGlyKGN1cnJlbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVzb2x2ZUNvbmZsaWN0KGFkYXB0ZXI6IGFueSwgcGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc3RhdCA9IGF3YWl0IGFkYXB0ZXIuc3RhdChwYXRoKTtcbiAgICAgIGlmICghc3RhdCkgcmV0dXJuIHBhdGg7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gcGF0aDtcbiAgICB9XG5cbiAgICAvLyBGaWxlIGV4aXN0cyBcdTIwMTQgYXBwZW5kIGEgbnVtYmVyXG4gICAgY29uc3QgZG90SW5kZXggPSBwYXRoLmxhc3RJbmRleE9mKFwiLlwiKTtcbiAgICBjb25zdCBzbGFzaEluZGV4ID0gcGF0aC5sYXN0SW5kZXhPZihcIi9cIik7XG4gICAgbGV0IGJhc2U6IHN0cmluZztcbiAgICBsZXQgZXh0OiBzdHJpbmc7XG5cbiAgICBpZiAoZG90SW5kZXggPiBzbGFzaEluZGV4KSB7XG4gICAgICBiYXNlID0gcGF0aC5zbGljZSgwLCBkb3RJbmRleCk7XG4gICAgICBleHQgPSBwYXRoLnNsaWNlKGRvdEluZGV4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgYmFzZSA9IHBhdGg7XG4gICAgICBleHQgPSBcIlwiO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAxOyBpIDw9IDk5OyBpKyspIHtcbiAgICAgIGNvbnN0IGNhbmRpZGF0ZSA9IGAke2Jhc2V9ICgke2l9KSR7ZXh0fWA7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBzID0gYXdhaXQgYWRhcHRlci5zdGF0KGNhbmRpZGF0ZSk7XG4gICAgICAgIGlmICghcykgcmV0dXJuIGNhbmRpZGF0ZTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gY2FuZGlkYXRlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBwYXRoICsgXCJfcmVzdG9yZWRcIjtcbiAgfVxuXG4gIHByaXZhdGUgZW1wdHlUcmFzaCgpIHtcbiAgICBpZiAodGhpcy50cmFzaEl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgbmV3IE5vdGljZShcIlRyYXNoIGlzIGFscmVhZHkgZW1wdHkuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGRvRW1wdHkgPSBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBhZGFwdGVyID0gdGhpcy5hcHAudmF1bHQuYWRhcHRlcjtcbiAgICAgIGxldCBkZWxldGVkID0gMDtcbiAgICAgIGxldCBmYWlsZWQgPSAwO1xuXG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy50cmFzaEl0ZW1zKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgaWYgKGl0ZW0uaXNGb2xkZXIpIHtcbiAgICAgICAgICAgIGF3YWl0IGFkYXB0ZXIucm1kaXIoaXRlbS5wYXRoLCB0cnVlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXdhaXQgYWRhcHRlci5yZW1vdmUoaXRlbS5wYXRoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZGVsZXRlZCsrO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcIltUcmFzaE1hbmFnZXJdIGVtcHR5VHJhc2ggZXJyb3I6XCIsIGUsIGl0ZW0pO1xuICAgICAgICAgIGZhaWxlZCsrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChkZWxldGVkID4gMCkgbmV3IE5vdGljZShgXHVEODNEXHVEREQxIEVtcHRpZWQgdHJhc2ggKCR7ZGVsZXRlZH0gaXRlbSR7ZGVsZXRlZCAhPT0gMSA/IFwic1wiIDogXCJcIn0gZGVsZXRlZCkuYCk7XG4gICAgICBpZiAoZmFpbGVkID4gMCkgbmV3IE5vdGljZShgXHUyNkEwIENvdWxkIG5vdCBkZWxldGUgJHtmYWlsZWR9IGl0ZW0ke2ZhaWxlZCAhPT0gMSA/IFwic1wiIDogXCJcIn0uYCwgNTAwMCk7XG5cbiAgICAgIGF3YWl0IHRoaXMubG9hZFRyYXNoKCk7XG4gICAgfTtcblxuICAgIGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb25maXJtRW1wdHlUcmFzaCkge1xuICAgICAgbmV3IENvbmZpcm1Nb2RhbChcbiAgICAgICAgdGhpcy5hcHAsXG4gICAgICAgIGBQZXJtYW5lbnRseSBkZWxldGUgYWxsICR7dGhpcy50cmFzaEl0ZW1zLmxlbmd0aH0gaXRlbSR7dGhpcy50cmFzaEl0ZW1zLmxlbmd0aCAhPT0gMSA/IFwic1wiIDogXCJcIn0gaW4gdHJhc2g/IFRoaXMgY2Fubm90IGJlIHVuZG9uZS5gLFxuICAgICAgICBcIkVtcHR5IFRyYXNoXCIsXG4gICAgICAgIGRvRW1wdHksXG4gICAgICAgIHRydWVcbiAgICAgICkub3BlbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkb0VtcHR5KCk7XG4gICAgfVxuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFN0YXR1cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIHNldFN0YXR1cyhtc2c6IHN0cmluZykge1xuICAgIGlmICh0aGlzLnN0YXR1c0VsKSB0aGlzLnN0YXR1c0VsLnNldFRleHQobXNnKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlU3RhdHVzKHRvdGFsOiBudW1iZXIsIHNlbGVjdGVkOiBudW1iZXIpIHtcbiAgICBpZiAoIXRoaXMuc3RhdHVzRWwpIHJldHVybjtcbiAgICBpZiAoc2VsZWN0ZWQgPiAwKSB7XG4gICAgICB0aGlzLnN0YXR1c0VsLnNldFRleHQoYCR7c2VsZWN0ZWR9IG9mICR7dG90YWx9IHNlbGVjdGVkYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc3RhdHVzRWwuc2V0VGV4dCh0b3RhbCA9PT0gMCA/IFwiVHJhc2ggaXMgZW1wdHlcIiA6IGAke3RvdGFsfSBpdGVtJHt0b3RhbCAhPT0gMSA/IFwic1wiIDogXCJcIn0gaW4gdHJhc2hgKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFNldHRpbmdzIFRhYiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgVHJhc2hNYW5hZ2VyU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IFRyYXNoTWFuYWdlclBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBUcmFzaE1hbmFnZXJQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJUcmFzaCBNYW5hZ2VyIFNldHRpbmdzXCIgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiQ29uZmlybSBiZWZvcmUgZW1wdHlpbmcgdHJhc2hcIilcbiAgICAgIC5zZXREZXNjKFwiU2hvdyBhIGNvbmZpcm1hdGlvbiBkaWFsb2cgYmVmb3JlIHBlcm1hbmVudGx5IGRlbGV0aW5nIGFsbCB0cmFzaCBpdGVtcy5cIilcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbmZpcm1FbXB0eVRyYXNoKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbmZpcm1FbXB0eVRyYXNoID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJDb25maXJtIGJlZm9yZSByZXN0b3JpbmdcIilcbiAgICAgIC5zZXREZXNjKFwiU2hvdyBhIGNvbmZpcm1hdGlvbiBkaWFsb2cgYmVmb3JlIHJlc3RvcmluZyBzZWxlY3RlZCBpdGVtcy5cIilcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbmZpcm1SZXN0b3JlKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbmZpcm1SZXN0b3JlID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJTaG93IGZpbGUgc2l6ZXNcIilcbiAgICAgIC5zZXREZXNjKFwiRGlzcGxheSBmaWxlIHNpemUgbmV4dCB0byBlYWNoIGl0ZW0gaW4gdGhlIHRyYXNoIGxpc3QuXCIpXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93RmlsZVNpemUpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2hvd0ZpbGVTaXplID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgTWFpbiBQbHVnaW4gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRyYXNoTWFuYWdlclBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIHNldHRpbmdzITogVHJhc2hNYW5hZ2VyU2V0dGluZ3M7XG5cbiAgYXN5bmMgb25sb2FkKCkge1xuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhWSUVXX1RZUEVfVFJBU0gsIChsZWFmKSA9PiBuZXcgVHJhc2hNYW5hZ2VyVmlldyhsZWFmLCB0aGlzKSk7XG5cbiAgICB0aGlzLmFkZFJpYmJvbkljb24oXCJ0cmFzaC0yXCIsIFwiT3BlbiBUcmFzaCBNYW5hZ2VyXCIsICgpID0+IHtcbiAgICAgIHRoaXMuYWN0aXZhdGVWaWV3KCk7XG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwib3Blbi10cmFzaC1tYW5hZ2VyXCIsXG4gICAgICBuYW1lOiBcIk9wZW4gVHJhc2ggTWFuYWdlclwiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHRoaXMuYWN0aXZhdGVWaWV3KCksXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiZW1wdHktdHJhc2hcIixcbiAgICAgIG5hbWU6IFwiRW1wdHkgVHJhc2hcIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGxlYXZlcyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFX1RSQVNIKTtcbiAgICAgICAgaWYgKGxlYXZlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgKGxlYXZlc1swXS52aWV3IGFzIFRyYXNoTWFuYWdlclZpZXcpLmVtcHR5VHJhc2g/LigpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuYWN0aXZhdGVWaWV3KCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAvLyBMZXQgdGhlIHZpZXcgbG9hZCBmaXJzdFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBUcmFzaE1hbmFnZXJTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG4gIH1cblxuICBvbnVubG9hZCgpIHtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9UUkFTSCk7XG4gIH1cblxuICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XG4gIH1cblxuICBhc3luYyBzYXZlU2V0dGluZ3MoKSB7XG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcbiAgfVxuXG4gIGFzeW5jIGFjdGl2YXRlVmlldygpIHtcbiAgICBjb25zdCB7IHdvcmtzcGFjZSB9ID0gdGhpcy5hcHA7XG4gICAgbGV0IGxlYWYgPSB3b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9UUkFTSClbMF07XG5cbiAgICBpZiAoIWxlYWYpIHtcbiAgICAgIGxlYWYgPSB3b3Jrc3BhY2UuZ2V0TGVhZihmYWxzZSk7XG4gICAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7IHR5cGU6IFZJRVdfVFlQRV9UUkFTSCwgYWN0aXZlOiB0cnVlIH0pO1xuICAgIH1cblxuICAgIHdvcmtzcGFjZS5yZXZlYWxMZWFmKGxlYWYpO1xuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQWNPO0FBSVAsSUFBTSxrQkFBa0I7QUFDeEIsSUFBTSxlQUFlO0FBb0JyQixJQUFNLG1CQUF5QztBQUFBLEVBQzdDLG1C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
