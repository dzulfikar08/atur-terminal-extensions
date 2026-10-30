// macOS twin of harness.py: loads a built extension page in WKWebView behind a custom
// `atur-ext://<owner>/` URL scheme handler (the way Atur Terminal's macOS webview serves
// extension pages), with the same mock host, and writes a screenshot and a JSON report.
//
//   swiftc -O harness-mac.swift -o harness-mac
//   ./harness-mac --root ext/dist --owner files --entry index.html --fixture a.js \
//                 --out shot.png --wait "window.__ready === true"
import AppKit
import WebKit

struct Options {
    var root = ""
    var owner = ""
    var entry = "index.html"
    var fixtures: [String] = []
    var assets: [String: String] = [:]
    var data = "null"
    var theme = "dark"
    var out: String?
    var report: String?
    var width = 1280
    var height = 800
    var wait = "document.readyState === 'complete'"
    var settle = 800
    var timeout = 90
    var evals: [String] = []
}

func parse() -> Options {
    var o = Options()
    var args = Array(CommandLine.arguments.dropFirst())
    func next() -> String { args.isEmpty ? "" : args.removeFirst() }
    while !args.isEmpty {
        let flag = args.removeFirst()
        switch flag {
        case "--root": o.root = next()
        case "--owner": o.owner = next()
        case "--entry": o.entry = next()
        case "--fixture": o.fixtures.append(next())
        case "--assets":
            let pair = next()
            if let eq = pair.firstIndex(of: "=") {
                o.assets[String(pair[..<eq])] = String(pair[pair.index(after: eq)...])
            }
        case "--data": o.data = next()
        case "--theme": o.theme = next()
        case "--out": o.out = next()
        case "--report": o.report = next()
        case "--width": o.width = Int(next()) ?? o.width
        case "--height": o.height = Int(next()) ?? o.height
        case "--wait": o.wait = next()
        case "--settle": o.settle = Int(next()) ?? o.settle
        case "--timeout": o.timeout = Int(next()) ?? o.timeout
        case "--eval": o.evals.append(next())
        default: break
        }
    }
    return o
}

let mimeTypes: [String: String] = [
    "html": "text/html", "js": "text/javascript", "mjs": "text/javascript", "css": "text/css",
    "json": "application/json", "wasm": "application/wasm", "svg": "image/svg+xml", "png": "image/png",
    "jpg": "image/jpeg", "webp": "image/webp", "woff2": "font/woff2", "woff": "font/woff",
    "ttf": "font/ttf", "txt": "text/plain", "webmanifest": "application/manifest+json", "map": "application/json",
]

final class SchemeHandler: NSObject, WKURLSchemeHandler {
    let root: String
    let owner: String
    let assets: [String: String]
    var errors: [String] = []

    init(root: String, owner: String, assets: [String: String]) {
        self.root = (root as NSString).resolvingSymlinksInPath
        self.owner = owner
        self.assets = assets
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url, url.host == owner else {
            task.didFailWithError(NSError(domain: "atur", code: 1))
            return
        }
        var rel = url.path.removingPercentEncoding ?? url.path
        while rel.hasPrefix("/") { rel.removeFirst() }
        var path: String?
        if rel.hasPrefix("__fixtures__/") {
            path = assets[String(rel.dropFirst("__fixtures__/".count))]
        } else {
            let full = ((root as NSString).appendingPathComponent(rel) as NSString).resolvingSymlinksInPath
            if full == root || full.hasPrefix(root + "/") { path = full }
        }
        var isDir: ObjCBool = false
        guard let p = path, FileManager.default.fileExists(atPath: p, isDirectory: &isDir), !isDir.boolValue,
              let data = FileManager.default.contents(atPath: p) else {
            errors.append("404 \(url.absoluteString)")
            task.didFailWithError(NSError(domain: "atur", code: 2))
            return
        }
        let ext = (p as NSString).pathExtension.lowercased()
        let mime = mimeTypes[ext] ?? "application/octet-stream"
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                       headerFields: ["Content-Type": mime, "Content-Length": String(data.count)])!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

let options = parse()
let app = NSApplication.shared
app.setActivationPolicy(.accessory)

func read(_ path: String) -> String { (try? String(contentsOfFile: path, encoding: .utf8)) ?? "" }
let here = (CommandLine.arguments[0] as NSString).deletingLastPathComponent
let sourceDir = ProcessInfo.processInfo.environment["HARNESS_DIR"] ?? here
let ownerJSON = String(data: try! JSONSerialization.data(withJSONObject: [options.owner], options: []), encoding: .utf8)!
let ownerLiteral = String(ownerJSON.dropFirst().dropLast())
let preamble = "window.__harness = {owner: \(ownerLiteral), theme: \"\(options.theme)\", data: \(options.data)};\n"
let script = preamble + ([sourceDir + "/mock-base.js"] + options.fixtures).map(read).joined(separator: "\n")

let handler = SchemeHandler(root: options.root, owner: options.owner, assets: options.assets)
let config = WKWebViewConfiguration()
config.setURLSchemeHandler(handler, forURLScheme: "atur-ext")
config.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
let frame = NSRect(x: 0, y: 0, width: options.width, height: options.height)
let webView = WKWebView(frame: frame, configuration: config)
let window = NSWindow(contentRect: frame, styleMask: [.titled], backing: .buffered, defer: false)
window.contentView = webView
window.makeKeyAndOrderFront(nil)

var report: [String: Any] = ["loaded": false, "waited": false, "errors": [String](), "log": [String](), "eval": [String](), "isSecureContext": NSNull()]
var exitCode: Int32 = 1

func finish(_ code: Int32) {
    report["errors"] = (report["errors"] as! [String]) + handler.errors
    if let path = options.report, let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted]) {
        try? data.write(to: URL(fileURLWithPath: path))
    }
    for line in (report["log"] as! [String]) { print("[page]", line) }
    for line in (report["errors"] as! [String]) { print("[error]", line) }
    print("loaded=\(report["loaded"]!) waited=\(report["waited"]!) secure=\(report["isSecureContext"]!)")
    exit(code)
}

func js(_ code: String, _ done: @escaping (Any?) -> Void) {
    webView.evaluateJavaScript(code) { value, error in
        if let error = error { done("ERROR: \(error.localizedDescription)") } else { done(value) }
    }
}

func collect(_ then: @escaping () -> Void) {
    js("JSON.stringify((window.__log||[]).slice(-200))") { value in
        if let text = value as? String, let data = text.data(using: .utf8),
           let arr = try? JSONSerialization.jsonObject(with: data) as? [String] {
            report["log"] = arr
        }
        then()
    }
}

func runEvals(_ remaining: [String], _ then: @escaping () -> Void) {
    guard let first = remaining.first else { then(); return }
    // callAsyncJavaScript awaits promises; evaluateJavaScript does not.
    webView.callAsyncJavaScript("return String(await (\(first)))", arguments: [:], in: nil, in: .page) { result in
        var list = report["eval"] as! [String]
        switch result {
        case .success(let value): list.append(String(describing: value ?? "null"))
        case .failure(let error): list.append("ERROR: \(error.localizedDescription)")
        }
        report["eval"] = list
        runEvals(Array(remaining.dropFirst()), then)
    }
}

func shoot() {
    runEvals(options.evals) {
        collect {
            let code: Int32 = (report["waited"] as? Bool == true) ? 0 : 1
            guard let out = options.out else { finish(code); return }
            let cfg = WKSnapshotConfiguration()
            webView.takeSnapshot(with: cfg) { image, error in
                guard let image = image, let tiff = image.tiffRepresentation,
                      let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) else {
                    var errs = report["errors"] as! [String]
                    errs.append("snapshot failed: \(error?.localizedDescription ?? "unknown")")
                    report["errors"] = errs
                    finish(1)
                    return
                }
                try? png.write(to: URL(fileURLWithPath: out))
                finish(code)
            }
        }
    }
}

let deadline = Date().addingTimeInterval(TimeInterval(options.timeout))
var settled = false

func poll() {
    if settled { return }
    if Date() > deadline {
        settled = true
        collect { runEvals(options.evals) { finish(2) } }
        return
    }
    js("(()=>{try{return !!(\(options.wait))}catch(e){return false}})()") { value in
        if settled { return }
        if (value as? Bool) == true || (value as? NSNumber)?.boolValue == true {
            settled = true
            report["waited"] = true
            DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(options.settle)) { shoot() }
        } else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { poll() }
        }
    }
}

final class Nav: NSObject, WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        report["loaded"] = true
        js("window.isSecureContext") { report["isSecureContext"] = $0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { poll() }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        var errs = report["errors"] as! [String]
        errs.append("load failed: \(error.localizedDescription)")
        report["errors"] = errs
    }
}
let nav = Nav()
webView.navigationDelegate = nav
webView.load(URLRequest(url: URL(string: "atur-ext://\(options.owner)/\(options.entry)")!))
DispatchQueue.main.asyncAfter(deadline: .now() + .seconds(options.timeout + 20)) {
    if !settled { var errs = report["errors"] as! [String]; errs.append("timed out before the page finished loading"); report["errors"] = errs; finish(2) }
}
app.run()
