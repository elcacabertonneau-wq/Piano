import UIKit
import WebKit

/// Affiche l'appli web Zik (dossier `zik/` embarqué dans l'appli) dans une WKWebView.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {

    /// Adresse "d'origine" de la page. Le lecteur YouTube exige une page web avec une vraie origine https
    /// (une page file:// est refusée avec l'erreur 153). Le contenu vient quand même de l'appli, pas d'internet.
    static let baseURL = URL(string: "https://elcacabertonneau-wq.github.io/Piano/zik/")!

    private var webView: WKWebView!
    private let background = UIColor(red: 0x10 / 255, green: 0x0d / 255, blue: 0x16 / 255, alpha: 1)

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default()
        config.userContentController.add(WeakMessageHandler(self), name: "zik")

        webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = background
        webView.scrollView.backgroundColor = background
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        loadApp()
    }

    private func loadApp() {
        guard let dir = Bundle.main.url(forResource: "zik", withExtension: nil) else { return }
        func read(_ name: String) -> String {
            (try? String(contentsOf: dir.appendingPathComponent(name), encoding: .utf8)) ?? ""
        }
        var html = read("index.html")
        html = html.replacingOccurrences(of: "<link rel=\"stylesheet\" href=\"style.css\">",
                                         with: "<style>\n\(read("style.css"))\n</style>")
        html = html.replacingOccurrences(of: "<script src=\"app.js\"></script>",
                                         with: "<script>\n\(read("app.js"))\n</script>")
        webView.loadHTMLString(html, baseURL: Self.baseURL)
    }

    // MARK: - Navigation : les liens externes s'ouvrent dans Safari

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { return decisionHandler(.allow) }
        let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? false
        let isWeb = url.scheme == "http" || url.scheme == "https"
        if isMainFrame && isWeb && (navigationAction.navigationType == .linkActivated || url.host != Self.baseURL.host) {
            UIApplication.shared.open(url)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { UIApplication.shared.open(url) }
        return nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loadApp()
    }

    // MARK: - alert / confirm / prompt

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Annuler", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { field in
            field.text = defaultText
            field.clearButtonMode = .whileEditing
        }
        alert.addAction(UIAlertAction(title: "Annuler", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(alert.textFields?.first?.text) })
        present(alert, animated: true)
    }

    // MARK: - Messages venant de la page (window.webkit.messageHandlers.zik)

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "keepAwake":
            UIApplication.shared.isIdleTimerDisabled = (body["on"] as? Bool) ?? false
        case "share":
            let name = (body["filename"] as? String) ?? "zik-sauvegarde.json"
            let content = (body["content"] as? String) ?? ""
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
            do { try content.write(to: url, atomically: true, encoding: .utf8) } catch { return }
            let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            share.popoverPresentationController?.sourceView = view
            share.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            present(share, animated: true)
        default:
            break
        }
    }
}

/// Évite que la WKWebView garde le contrôleur en mémoire indéfiniment.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}
