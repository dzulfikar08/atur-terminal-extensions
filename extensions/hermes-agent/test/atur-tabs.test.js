import assert from "node:assert/strict";
import test from "node:test";

import { openProjectBoardTab, projectBoardTabRequest } from "../src/atur-tabs.js";

test("project board tab requests use Atur Terminal's extension-webview contract", () => {
  assert.deepEqual(projectBoardTabRequest("atur-hermes-extension"), {
    kind: "extensionWebView",
    extension: {
      id: "atur-hermes-extension",
      tabType: "hermes-project-board",
      singleton: true,
    },
  });
});

test("opening the project board delegates the validated request to Atur Terminal", async () => {
  const calls = [];
  const atur = {
    extensionID: "atur-hermes-extension",
    tabs: {
      async open(request) {
        calls.push(request);
        return "board-tab-id";
      },
    },
  };

  assert.equal(await openProjectBoardTab(atur), "board-tab-id");
  assert.deepEqual(calls, [projectBoardTabRequest("atur-hermes-extension")]);
});

test("opening the project board fails clearly when the Atur Terminal bridge is unavailable", async () => {
  await assert.rejects(() => openProjectBoardTab(null), /Atur Terminal tab bridge is unavailable/);
});
