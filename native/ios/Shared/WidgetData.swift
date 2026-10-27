import Foundation
import Security

func L(_ english: String, _ arabic: String) -> String { Locale.preferredLanguages.first?.hasPrefix("ar") == true ? arabic : english }
struct WidgetConfig: Codable { let server: String; let token: String }
struct TodayTask: Codable, Identifiable { let id: String; let title: String; let plannedTime: String?; let dueDate: String? }
struct TodayPayload: Codable { let date: String; let timezone: String; let updatedAt: String; let expiresAt: String; let total: Int; let tasks: [TodayTask] }
enum WidgetFailure: Error { case invalid, unavailable }
enum WidgetAPI {
 static func origin(_ value: String) throws -> String { guard let url = URLComponents(string: value.trimmingCharacters(in: .whitespacesAndNewlines)), url.scheme == "https", let host = url.host, !host.isEmpty, url.user == nil, url.password == nil, url.query == nil, url.fragment == nil, url.path == "" || url.path == "/", let absolute = url.url?.absoluteString else { throw WidgetFailure.invalid }; return absolute.hasSuffix("/") ? String(absolute.dropLast()) : absolute }
 static func fetch(_ config: WidgetConfig) async throws -> TodayPayload {
  let origin = try origin(config.server)
  guard config.token.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil, let url = URL(string: origin + "/api/widgets/today") else { throw WidgetFailure.invalid }
  var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: 15)
  request.setValue("Bearer " + config.token, forHTTPHeaderField: "Authorization")
  let session = URLSession(configuration: .ephemeral, delegate: NoRedirects(), delegateQueue: nil)
  defer { session.finishTasksAndInvalidate() }
  let (data, response) = try await session.data(for: request)
  guard (response as? HTTPURLResponse)?.statusCode == 200, data.count < 100000 else { throw WidgetFailure.unavailable }
  return try JSONDecoder().decode(TodayPayload.self, from: data)
 }
 final class NoRedirects: NSObject, URLSessionTaskDelegate { func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) } }
}
enum WidgetStore {
 private static let service = "dev.decoderz.dailgo.widget"
 private static var query: [String: Any] { var value: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "readonly"]
  if let group = Bundle.main.object(forInfoDictionaryKey: "SharedKeychainGroup") as? String, !group.contains("$(") { value[kSecAttrAccessGroup as String] = group }
  return value
 }
 static func load() -> WidgetConfig? { var value = query; value[kSecReturnData as String] = true; value[kSecMatchLimit as String] = kSecMatchLimitOne; var result: CFTypeRef?; guard SecItemCopyMatching(value as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }; return try? JSONDecoder().decode(WidgetConfig.self, from: data) }
 static func save(_ config: WidgetConfig) throws { let data = try JSONEncoder().encode(config); let update = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary); if update == errSecItemNotFound { var value = query; value[kSecValueData as String] = data; value[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly; guard SecItemAdd(value as CFDictionary, nil) == errSecSuccess else { throw WidgetFailure.unavailable } } else if update != errSecSuccess { throw WidgetFailure.unavailable } }
}
