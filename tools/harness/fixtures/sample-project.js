// A small in-memory project served through atur.files, shared by fixtures.
(() => {
  const h = window.__harness;
  const tree = {
    "": ["src", "docs", "scripts", ".env", "package.json", "README.md"],
    src: ["components", "utils", "main.js", "styles.css"],
    "src/components": ["Button.vue", "Card.vue"],
    "src/utils": ["format.js"],
    docs: ["architecture.md"],
    scripts: ["build.js"],
  };
  const dirs = new Set(Object.keys(tree));
  const files = new Map([
    ["README.md", "# Sample project\n\nA small project used to preview this extension.\n"],
    ["package.json", '{\n  "name": "sample-project",\n  "version": "1.0.0"\n}\n'],
    ["src/main.js", 'import { format } from "./utils/format.js";\n\nconsole.log(format("hello"));\n'],
  ]);
  const join = (dir, name) => (dir ? dir + "/" + name : name);
  h.project = { tree, dirs, files, join };
  h.set("projects.list", async () => [{ id: "p1", name: "sample-project", path: "/home/dev/sample-project", isActive: true }]);
  h.set("worktrees.list", async () => [{ id: "w1", name: "main", path: "/home/dev/sample-project", isActive: true }]);
  h.set("files.list", async (path) => {
    const dir = String(path || "").replace(/^\/+|\/+$/g, "");
    return (tree[dir] || []).map((name) => ({
      name,
      path: join(dir, name),
      isDirectory: dirs.has(join(dir, name)),
      isIgnored: name === ".env",
    }));
  });
  h.set("files.read", async (path) => {
    const content = files.get(path);
    if (content === undefined) throw new Error("No such file: " + path);
    return { path, content, size: content.length };
  });
  h.set("files.stat", async (path) => {
    const isDirectory = dirs.has(path);
    const content = files.get(path);
    if (!isDirectory && content === undefined) throw new Error("No such file: " + path);
    return { path, name: path.split("/").pop(), isDirectory, size: content ? content.length : 0 };
  });
  h.set("files.write", async (path, contents) => { files.set(path, contents); });
})();
