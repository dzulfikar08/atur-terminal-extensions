import { MAX_PROJECT_ID_LENGTH } from "./session-broker.js";

const PROJECT_BOARD_TAB_TYPE = "hermes-project-board";
const MAX_PROJECT_NAME = 256;

function boundedText(value, maximum) {
  const text = typeof value === "string" ? value.trim() : "";
  return text && text.length <= maximum ? text : null;
}

/**
 * Returns the sole active Atur Terminal project by its immutable Atur Terminal identity.  Names,
 * paths, worktrees, and workspaces are deliberately excluded from this value.
 */
export async function resolveActiveProject(atur = globalThis.window?.atur ?? globalThis.atur) {
  if (!atur?.projects || typeof atur.projects.list !== "function") {
    throw new Error("Atur Terminal project bridge is unavailable.");
  }
  const projects = await atur.projects.list();
  if (!Array.isArray(projects)) throw new Error("Atur Terminal did not return a project list.");
  const active = projects.filter((project) => project?.isActive === true);
  if (active.length !== 1) throw new Error("Atur Terminal must provide exactly one active project.");
  const id = boundedText(active[0].id, MAX_PROJECT_ID_LENGTH);
  const name = boundedText(active[0].name, MAX_PROJECT_NAME);
  if (!id || !name) throw new Error("Atur Terminal active project identity is unavailable.");
  return Object.freeze({ id, name });
}

export function projectBoardTabRequest(extensionID) {
  const id = String(extensionID ?? "").trim();
  if (!id) throw new Error("Atur Terminal extension ID is unavailable.");
  return {
    kind: "extensionWebView",
    extension: {
      id,
      tabType: PROJECT_BOARD_TAB_TYPE,
      singleton: true,
    },
  };
}

export async function openProjectBoardTab(atur) {
  if (!atur?.tabs || typeof atur.tabs.open !== "function") {
    throw new Error("Atur Terminal tab bridge is unavailable.");
  }
  return atur.tabs.open(projectBoardTabRequest(atur.extensionID));
}
