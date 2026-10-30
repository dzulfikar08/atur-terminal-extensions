import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeHtml } from "../src/lib/sanitize.js";

test("formatting tags survive and attributes are dropped", () => {
  assert.equal(sanitizeHtml('<p class="x" onclick="evil()">Hi <strong style="color:red">you</strong></p>'), "<p>Hi <strong>you</strong></p>");
  assert.equal(sanitizeHtml("<ul><li>a</li><li>b</li></ul>"), "<ul><li>a</li><li>b</li></ul>");
  assert.equal(sanitizeHtml("a<br>b<br/>c"), "a<br>b<br>c");
});

test("script, style and friends vanish with their content", () => {
  assert.equal(sanitizeHtml("<p>a</p><script>alert(1)</script><p>b</p>"), "<p>a</p><p>b</p>");
  assert.equal(sanitizeHtml("<style>body{display:none}</style>ok"), "ok");
  assert.equal(sanitizeHtml('<iframe src="https://evil"></iframe>x'), "x");
  assert.equal(sanitizeHtml("<svg onload=alert(1)><circle/></svg>x"), "x");
  assert.equal(sanitizeHtml("<SCRIPT>alert(1)</SCRIPT>x"), "x");
});

test("unknown tags are unwrapped, their text kept and escaped", () => {
  assert.equal(sanitizeHtml("<img src=x onerror=alert(1)>text"), "text");
  assert.equal(sanitizeHtml("<custom-el>hi</custom-el>"), "hi");
  assert.equal(sanitizeHtml("1 < 2 and 3 > 2"), "1 &lt; 2 and 3 &gt; 2");
  assert.equal(sanitizeHtml("<p>a</p><"), "<p>a</p>&lt;");
});

test("only http(s) links keep a target, exposed as data-href", () => {
  assert.equal(sanitizeHtml('<a href="https://example.com/a?b=1&c=2" onclick="x()">go</a>'), '<a data-href="https://example.com/a?b=1&amp;c=2">go</a>');
  assert.equal(sanitizeHtml('<a href="javascript:alert(1)">x</a>'), "<a>x</a>");
  assert.equal(sanitizeHtml('<a href="JaVa\tScRiPt:alert(1)">x</a>'), "<a>x</a>");
  assert.equal(sanitizeHtml('<a href="&#106;avascript:alert(1)">x</a>'), "<a>x</a>");
  assert.equal(sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>'), "<a>x</a>");
  assert.equal(sanitizeHtml('<a href="//evil.example">x</a>'), "<a>x</a>");
});

test("quotes in attributes cannot break out", () => {
  assert.equal(sanitizeHtml('<a href="https://e.com/&quot; onmouseover=&quot;x">y</a>'), '<a data-href="https://e.com/&quot;onmouseover=&quot;x">y</a>');
  assert.equal(sanitizeHtml('<a title=">" href="https://e.com">y</a>'), '<a data-href="https://e.com">y</a>');
});

test("unbalanced markup is closed and stray closers are ignored", () => {
  assert.equal(sanitizeHtml("<p><strong>open"), "<p><strong>open</strong></p>");
  assert.equal(sanitizeHtml("</p>text</strong>"), "text");
  assert.equal(sanitizeHtml("<pre><code>a &lt; b</code></pre>"), "<pre><code>a &lt; b</code></pre>");
});

test("non-string input is tolerated", () => {
  assert.equal(sanitizeHtml(null), "");
  assert.equal(sanitizeHtml(undefined), "");
});
