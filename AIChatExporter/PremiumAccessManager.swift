import Foundation
import StoreKit

actor PremiumAccessManager {
    static let shared = PremiumAccessManager()

    enum PremiumError: LocalizedError {
        case productNotFound
        case verificationFailed

        var errorDescription: String? {
            switch self {
            case .productNotFound:
                return "未找到可购买的 Pro 商品，请稍后重试。"
            case .verificationFailed:
                return "交易校验失败，请稍后重试。"
            }
        }
    }

    struct ProductSummary {
        let id: String
        let displayPrice: String
        let displayName: String
    }

    private enum Config {
        static let productID = "net.ximatai.aichatexporter.pro"
        static let appGroupSuite = "group.net.ximatai.aichatexporter"
        static let unlockedKeys = ["pro_unlocked", "isProUnlocked", "premium_unlocked"]
    }

    private var updatesTask: Task<Void, Never>?

    private init() {}

    deinit {
        updatesTask?.cancel()
    }

    func start() {
        guard updatesTask == nil else { return }

        updatesTask = Task {
            await observeTransactionUpdates()
        }

        Task {
            _ = await refreshEntitlements()
        }
    }

    func currentProStatus() -> Bool {
        return readStoredStatus()
    }

    func loadProductSummary() async throws -> ProductSummary {
        let product = try await loadProduct()
        return ProductSummary(id: product.id, displayPrice: product.displayPrice, displayName: product.displayName)
    }

    func purchasePro() async throws -> Bool {
        let product = try await loadProduct()
        let result = try await product.purchase()

        switch result {
        case .success(let verification):
            let transaction = try checkVerified(verification)
            await transaction.finish()
            return await refreshEntitlements()
        case .pending, .userCancelled:
            return await refreshEntitlements()
        @unknown default:
            return await refreshEntitlements()
        }
    }

    func restorePurchases() async throws -> Bool {
        try await AppStore.sync()
        return await refreshEntitlements()
    }

    func refreshEntitlements() async -> Bool {
        var unlocked = false

        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }
            guard transaction.productID == Config.productID else { continue }
            guard transaction.revocationDate == nil else { continue }
            guard !transaction.isUpgraded else { continue }
            unlocked = true
            break
        }

        persist(status: unlocked)
        return unlocked
    }

    private func observeTransactionUpdates() async {
        for await update in Transaction.updates {
            guard case .verified(let transaction) = update else { continue }

            if transaction.productID == Config.productID {
                _ = await refreshEntitlements()
            }

            await transaction.finish()
        }
    }

    private func loadProduct() async throws -> Product {
        let products = try await Product.products(for: [Config.productID])
        guard let product = products.first else {
            throw PremiumError.productNotFound
        }
        return product
    }

    private func checkVerified<T>(_ verificationResult: VerificationResult<T>) throws -> T {
        switch verificationResult {
        case .verified(let signed):
            return signed
        case .unverified:
            throw PremiumError.verificationFailed
        }
    }

    private func readStoredStatus() -> Bool {
        if let sharedDefaults = UserDefaults(suiteName: Config.appGroupSuite) {
            for key in Config.unlockedKeys where sharedDefaults.bool(forKey: key) {
                return true
            }
        }

        let defaults = UserDefaults.standard
        for key in Config.unlockedKeys where defaults.bool(forKey: key) {
            return true
        }
        return false
    }

    private func persist(status: Bool) {
        if let sharedDefaults = UserDefaults(suiteName: Config.appGroupSuite) {
            for key in Config.unlockedKeys {
                sharedDefaults.set(status, forKey: key)
            }
        }

        let defaults = UserDefaults.standard
        for key in Config.unlockedKeys {
            defaults.set(status, forKey: key)
        }
    }
}
