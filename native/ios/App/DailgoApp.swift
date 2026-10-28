import SwiftUI
import WidgetKit

@main struct DailgoApp: App { var body: some Scene { WindowGroup { SetupView() } } }
struct SetupView: View {
 @State private var server = WidgetStore.load()?.server ?? "https://dailgo.decoderz.dev"
 @State private var token = ""
 @State private var busy = false
 @State private var notice = ""
 var body: some View {
  NavigationStack { Form {
   Section { Text(L("Create a read-only device token in Dailgo → Life tools → Home screen. Paste it here on your own phone only. The widget cannot change tasks. Refresh timing is controlled by iOS.", "أنشئ رمز جهاز للقراءة فقط من Dailgo ← أدوات حياتك ← الشاشة الرئيسية. الصقه هنا على هاتفك فقط. Widget لا يعدّل المهام، وiOS بيتحكم في مواعيد التحديث.")) }
   Section { TextField(L("HTTPS server address", "عنوان السيرفر HTTPS"), text: $server).textContentType(.URL).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled(); SecureField(L("Read-only widget token", "رمز Widget للقراءة فقط"), text: $token).textInputAutocapitalization(.never).autocorrectionDisabled(); Button(L("Connect widget", "ربط Widget")) { busy = true; let value = WidgetConfig(server: server, token: token.trimmingCharacters(in: .whitespacesAndNewlines)); Task { do { _ = try await WidgetAPI.fetch(value); try WidgetStore.save(value); token = ""; WidgetCenter.shared.reloadAllTimelines(); notice = L("Connected. Add Dailgo from the home screen widget gallery.", "تم الربط. أضف Widget دايلجو من معرض الشاشة الرئيسية.") } catch { notice = L("Could not connect. Check HTTPS, token expiry and the connection.", "تعذر الربط. راجع HTTPS وصلاحية الرمز والاتصال.") }; busy = false } }.disabled(busy || token.isEmpty) }
   if !notice.isEmpty { Section { Text(notice).accessibilityAddTraits(.updatesFrequently) } }
  }.navigationTitle(L("Dailgo Today", "دايلجو اليوم")) }
 }
}
