//
//  SafariWebExtensionHandler.swift
//  exportAIChat Extension
//
//  Created by 牧云踏歌 on 2026/3/1.
//

import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    private enum PremiumConfig {
        static let appGroupSuite = "group.net.ximatai.aichatexporter"
        static let unlockedKeys = ["pro_unlocked", "isProUnlocked", "premium_unlocked"]
    }

    private func readProStatus() -> Bool {
        if let sharedDefaults = UserDefaults(suiteName: PremiumConfig.appGroupSuite) {
            for key in PremiumConfig.unlockedKeys where sharedDefaults.bool(forKey: key) {
                return true
            }
        }

        let defaults = UserDefaults.standard
        for key in PremiumConfig.unlockedKeys where defaults.bool(forKey: key) {
            return true
        }
        return false
    }

    private func parseAction(from message: Any?) -> String? {
        guard let dict = message as? [String: Any] else {
            return nil
        }
        return dict["action"] as? String
    }

    private func buildResponseMessage(for message: Any?) -> [String: Any] {
        guard let action = parseAction(from: message) else {
            return ["echo": message as Any]
        }

        switch action {
        case "get_pro_status":
            return [
                "ok": true,
                "isPro": readProStatus()
            ]
        default:
            return ["echo": message as Any]
        }
    }

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@ (profile: %@)", String(describing: message), profile?.uuidString ?? "none")

        let responseMessage = buildResponseMessage(for: message)
        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [ SFExtensionMessageKey: responseMessage ]
        } else {
            response.userInfo = [ "message": responseMessage ]
        }

        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }

}
