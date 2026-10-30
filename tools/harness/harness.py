#!/usr/bin/python3
"""Loads a built extension page in WebKitGTK the way Atur Terminal does, and
reports what happened.

The page is served from the `atur-ext://<owner>/` scheme, registered with the same
plain `webkit_web_context_register_uri_scheme` call the app makes (no "secure" or
"CORS-enabled" flags), so what works here works in the app's Linux webview. A mock
`window.atur` (mock-base.js plus an optional fixture) stands in for the host.

  harness.py --root ext/dist --owner files --entry panel/index.html \
             --fixture fixtures/files.js --out shot.png --wait "window.__ready === true"

Exit status is 0 when the page loaded and the wait condition became true.
"""
import argparse
import json
import mimetypes
import os
import sys
import urllib.parse

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")
from gi.repository import Gio, GLib, Gtk, WebKit2  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
MIME = {
    ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
    ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
    ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
    ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".txt": "text/plain",
    ".webmanifest": "application/manifest+json", ".map": "application/json",
}


def mime_of(path):
    ext = os.path.splitext(path)[1].lower()
    return MIME.get(ext) or mimetypes.guess_type(path)[0] or "application/octet-stream"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, help="the extension's build output (dist/)")
    ap.add_argument("--owner", required=True, help="extension name (the URL host)")
    ap.add_argument("--entry", default="index.html")
    ap.add_argument("--fixture", action="append", default=[], help="JS injected after mock-base.js")
    ap.add_argument("--assets", action="append", default=[],
                    help="name=path: serve path at atur-ext://<owner>/__fixtures__/name")
    ap.add_argument("--data", default="null", help="JSON for window.atur.data")
    ap.add_argument("--theme", default="dark", choices=["dark", "light"])
    ap.add_argument("--out", help="PNG screenshot path")
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=800)
    ap.add_argument("--wait", default="document.readyState === 'complete'",
                    help="JS expression; the shot is taken once it is truthy")
    ap.add_argument("--settle", type=int, default=800, help="ms to wait after the condition")
    ap.add_argument("--timeout", type=int, default=90)
    ap.add_argument("--report", help="write a JSON report here")
    ap.add_argument("--eval", action="append", default=[], help="JS evaluated after the wait; result printed")
    args = ap.parse_args()

    root = os.path.realpath(args.root)
    assets = {}
    for item in args.assets:
        name, _, path = item.partition("=")
        assets[name] = os.path.realpath(path)

    report = {"loaded": False, "waited": False, "errors": [], "log": [], "eval": [], "isSecureContext": None}

    def serve(request):
        uri = request.get_uri()
        parts = urllib.parse.urlsplit(uri)
        if parts.hostname != args.owner:
            request.finish_error(GLib.Error.new_literal(GLib.quark_from_string("atur"), "foreign host", 1))
            return
        rel = urllib.parse.unquote(parts.path).lstrip("/") or args.entry
        if rel.startswith("__fixtures__/"):
            path = assets.get(rel[len("__fixtures__/"):])
        else:
            path = os.path.realpath(os.path.join(root, rel))
            if path != root and not path.startswith(root + os.sep):
                path = None
        if not path or not os.path.isfile(path):
            report["errors"].append("404 " + uri)
            request.finish_error(GLib.Error.new_literal(GLib.quark_from_string("atur"), "not found", 2))
            return
        with open(path, "rb") as handle:
            data = handle.read()
        stream = Gio.MemoryInputStream.new_from_bytes(GLib.Bytes.new(data))
        request.finish(stream, len(data), mime_of(path))

    ctx = WebKit2.WebContext.new_ephemeral()
    ctx.register_uri_scheme("atur-ext", serve)

    ucm = WebKit2.UserContentManager()
    scripts = [os.path.join(HERE, "mock-base.js")] + args.fixture
    preamble = "window.__harness = %s;\n" % json.dumps(
        {"owner": args.owner, "theme": args.theme, "data": json.loads(args.data)}
    )
    source = preamble + "\n".join(open(p, encoding="utf-8").read() for p in scripts)
    ucm.add_script(WebKit2.UserScript.new(
        source, WebKit2.UserContentInjectedFrames.TOP_FRAME, WebKit2.UserScriptInjectionTime.START, None, None))

    view = WebKit2.WebView(web_context=ctx, user_content_manager=ucm)
    settings = view.get_settings()
    settings.set_enable_webgl(True)
    settings.set_enable_developer_extras(False)
    settings.set_allow_file_access_from_file_urls(False)

    win = Gtk.Window()
    win.set_default_size(args.width, args.height)
    win.add(view)
    win.show_all()

    state = {"deadline": GLib.get_monotonic_time() + args.timeout * 1_000_000, "settled": False}

    def finish(code):
        with_report()
        Gtk.main_quit()
        state["code"] = code

    def with_report():
        if args.report:
            with open(args.report, "w", encoding="utf-8") as handle:
                json.dump(report, handle, indent=2)
        for line in report["log"]:
            print("[page]", line)
        for err in report["errors"]:
            print("[error]", err)
        print("loaded=%s waited=%s secure=%s" % (report["loaded"], report["waited"], report["isSecureContext"]))

    def js(script, cb):
        view.evaluate_javascript(script, -1, None, None, None, cb, None)

    def collect(then):
        def on_log(source_obj, res, _):
            try:
                value = view.evaluate_javascript_finish(res)
                report["log"] = json.loads(value.to_string() or "[]")
            except Exception as exc:  # noqa: BLE001
                report["errors"].append("log read failed: %s" % exc)
            then()
        js("JSON.stringify((window.__log||[]).slice(-200))", on_log)

    def run_evals(then, remaining=None):
        remaining = list(args.eval) if remaining is None else remaining
        if not remaining:
            then()
            return
        script = remaining.pop(0)

        def on_eval(source_obj, res, _):
            try:
                value = view.evaluate_javascript_finish(res)
                report["eval"].append(value.to_string())
            except Exception as exc:  # noqa: BLE001
                report["eval"].append("ERROR: %s" % exc)
            run_evals(then, remaining)
        js("Promise.resolve((async()=>{return String(await (%s))})())" % script, on_eval)

    def shoot():
        def done():
            if not args.out:
                finish(0 if report["waited"] else 1)
                return

            def on_snapshot(source_obj, res, _):
                try:
                    surface = view.get_snapshot_finish(res)
                    surface.write_to_png(args.out)
                except Exception as exc:  # noqa: BLE001
                    report["errors"].append("snapshot failed: %s" % exc)
                    finish(1)
                    return
                finish(0 if report["waited"] else 1)
            view.get_snapshot(WebKit2.SnapshotRegion.VISIBLE, WebKit2.SnapshotOptions.NONE, None, on_snapshot, None)
        run_evals(lambda: collect(done))

    def poll():
        if state["settled"]:
            return False
        if GLib.get_monotonic_time() > state["deadline"]:
            state["settled"] = True
            collect(lambda: run_evals(lambda: finish(2)))
            return False

        def on_cond(source_obj, res, _):
            if state["settled"]:
                return
            try:
                value = view.evaluate_javascript_finish(res)
                ok = value.to_boolean()
            except Exception:  # noqa: BLE001
                ok = False
            if ok:
                state["settled"] = True
                report["waited"] = True
                GLib.timeout_add(args.settle, lambda: (shoot(), False)[1])
        js("(()=>{try{return !!(%s)}catch(e){return false}})()" % args.wait, on_cond)
        return True

    def on_load(_view, event):
        if event == WebKit2.LoadEvent.FINISHED:
            report["loaded"] = True
            def secure(source_obj, res, _):
                try:
                    report["isSecureContext"] = view.evaluate_javascript_finish(res).to_boolean()
                except Exception:  # noqa: BLE001
                    pass
            js("window.isSecureContext", secure)
            GLib.timeout_add(500, poll)

    def on_fail(_view, _event, uri, error):
        report["errors"].append("load failed %s: %s" % (uri, error.message))
        return False

    view.connect("load-changed", on_load)
    view.connect("load-failed", on_fail)
    view.load_uri("atur-ext://%s/%s" % (args.owner, args.entry))

    def hard_stop():
        if not state["settled"]:
            report["errors"].append("timed out before the page finished loading")
            finish(2)
        return False
    GLib.timeout_add_seconds(args.timeout + 20, hard_stop)
    Gtk.main()
    sys.exit(state.get("code", 1))


if __name__ == "__main__":
    main()
