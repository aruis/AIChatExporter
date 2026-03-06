//
//  ViewController.swift
//  AIChatExporter
//
//  Created by 牧云踏歌 on 2026/3/1.
//

import Cocoa
import SafariServices
import WebKit

let extensionBundleIdentifier = "net.ximatai.aichatexporter.Extension"

class ViewController: NSViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    private let premiumManager = PremiumAccessManager.shared

    override func viewDidLoad() {
        super.viewDidLoad()

        premiumManager.start()

        webView.navigationDelegate = self
        webView.configuration.userContentController.add(self, name: "controller")
        webView.loadFileURL(
            Bundle.main.url(forResource: "Main", withExtension: "html")!,
            allowingReadAccessTo: Bundle.main.resourceURL!
        )
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { state, error in
            guard let state = state, error == nil else {
                return
            }

            DispatchQueue.main.async {
                if #available(macOS 13, *) {
                    webView.evaluateJavaScript("show(\(state.isEnabled), true)")
                } else {
                    webView.evaluateJavaScript("show(\(state.isEnabled), false)")
                }
            }
        }

        Task {
            let isPro = await premiumManager.refreshEntitlements()
            await MainActor.run {
                self.sendEventToWebView(name: "proStatus", payload: ["isPro": isPro])
            }

            do {
                let product = try await premiumManager.loadProductSummary()
                await MainActor.run {
                    self.sendEventToWebView(name: "productSummary", payload: [
                        "id": product.id,
                        "displayName": product.displayName,
                        "displayPrice": product.displayPrice
                    ])
                }
            } catch {
                await MainActor.run {
                    self.sendEventToWebView(name: "productSummary", payload: [
                        "error": error.localizedDescription
                    ])
                }
            }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if let action = message.body as? String, action == "open-preferences" {
            openPreferencesAndQuit()
            return
        }

        guard let request = message.body as? [String: Any] else {
            return
        }

        let requestID = request["id"].map { String(describing: $0) }
        let action = (request["action"] as? String) ?? ""
        let payload = request["payload"] as? [String: Any] ?? [:]

        Task {
            await handleBridgeAction(action, requestID: requestID, payload: payload)
        }
    }

    private func handleBridgeAction(_ action: String, requestID: String?, payload: [String: Any]) async {
        switch action {
        case "open-preferences":
            await MainActor.run {
                self.openPreferencesAndQuit()
            }

        case "get_pro_status":
            let forceRefresh = payload["forceRefresh"] as? Bool ?? false
            let isPro: Bool
            if forceRefresh {
                isPro = await premiumManager.refreshEntitlements()
            } else {
                isPro = await premiumManager.currentProStatus()
            }
            await MainActor.run {
                self.respondToWebView(requestID: requestID, payload: ["ok": true, "isPro": isPro])
            }

        case "refresh_pro_status":
            let isPro = await premiumManager.refreshEntitlements()
            await MainActor.run {
                self.respondToWebView(requestID: requestID, payload: ["ok": true, "isPro": isPro])
                self.sendEventToWebView(name: "proStatus", payload: ["isPro": isPro])
            }

        case "purchase_pro":
            do {
                let isPro = try await premiumManager.purchasePro()
                await MainActor.run {
                    self.respondToWebView(requestID: requestID, payload: ["ok": true, "isPro": isPro])
                    self.sendEventToWebView(name: "proStatus", payload: ["isPro": isPro])
                }
            } catch {
                await MainActor.run {
                    self.respondToWebView(requestID: requestID, payload: ["ok": false, "error": error.localizedDescription])
                }
            }

        case "restore_pro":
            do {
                let isPro = try await premiumManager.restorePurchases()
                await MainActor.run {
                    self.respondToWebView(requestID: requestID, payload: ["ok": true, "isPro": isPro])
                    self.sendEventToWebView(name: "proStatus", payload: ["isPro": isPro])
                }
            } catch {
                await MainActor.run {
                    self.respondToWebView(requestID: requestID, payload: ["ok": false, "error": error.localizedDescription])
                }
            }

        case "get_product_summary":
            do {
                let product = try await premiumManager.loadProductSummary()
                await MainActor.run {
                    self.respondToWebView(requestID: requestID, payload: [
                        "ok": true,
                        "id": product.id,
                        "displayName": product.displayName,
                        "displayPrice": product.displayPrice
                    ])
                }
            } catch {
                await MainActor.run {
                    self.respondToWebView(requestID: requestID, payload: ["ok": false, "error": error.localizedDescription])
                }
            }

        default:
            await MainActor.run {
                self.respondToWebView(requestID: requestID, payload: ["ok": false, "error": "Unsupported action: \(action)"])
            }
        }
    }

    private func openPreferencesAndQuit() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { _ in
            DispatchQueue.main.async {
                NSApplication.shared.terminate(nil)
            }
        }
    }

    private func respondToWebView(requestID: String?, payload: [String: Any]) {
        guard let requestID else { return }
        guard let requestIDJSON = jsonStringLiteral(for: requestID) else { return }
        guard let payloadJSON = jsonObjectString(for: payload) else { return }

        let script = "window.__onNativeResponse(\(requestIDJSON), \(payloadJSON));"
        webView.evaluateJavaScript(script)
    }

    private func sendEventToWebView(name: String, payload: [String: Any]) {
        guard let eventNameJSON = jsonStringLiteral(for: name) else { return }
        guard let payloadJSON = jsonObjectString(for: payload) else { return }

        let script = "window.__onNativeEvent(\(eventNameJSON), \(payloadJSON));"
        webView.evaluateJavaScript(script)
    }

    private func jsonStringLiteral(for value: String) -> String? {
        guard let data = try? JSONSerialization.data(withJSONObject: [value], options: []),
              let string = String(data: data, encoding: .utf8) else {
            return nil
        }

        // Convert ["value"] to "value"
        return String(string.dropFirst().dropLast())
    }

    private func jsonObjectString(for object: [String: Any]) -> String? {
        guard JSONSerialization.isValidJSONObject(object),
              let data = try? JSONSerialization.data(withJSONObject: object, options: []),
              let string = String(data: data, encoding: .utf8) else {
            return nil
        }
        return string
    }
}
