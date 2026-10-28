import WidgetKit
import SwiftUI
struct TodayEntry: TimelineEntry { let date: Date; let payload: TodayPayload?; let server: String?; let problem: Bool }
struct Provider: TimelineProvider {
 func placeholder(in context: Context) -> TodayEntry { TodayEntry(date: Date(), payload: nil, server: nil, problem: false) }
 func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) { completion(placeholder(in: context)) }
 func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) { Task {
  guard let config = WidgetStore.load() else { completion(Timeline(entries: [TodayEntry(date: Date(), payload: nil, server: nil, problem: false)], policy: .after(Date().addingTimeInterval(1800)))); return }
  do { let payload = try await WidgetAPI.fetch(config); completion(Timeline(entries: [TodayEntry(date: Date(), payload: payload, server: config.server, problem: false)], policy: .after(Date().addingTimeInterval(900)))) } catch { completion(Timeline(entries: [TodayEntry(date: Date(), payload: nil, server: config.server, problem: true)], policy: .after(Date().addingTimeInterval(900)))) }
 } }
}
struct TodayView: View {
 var entry: TodayEntry
 @Environment(\.widgetFamily) private var family
 private var count: Int { family == .systemSmall ? 3 : 5 }
 var body: some View {
  VStack(alignment: .leading, spacing: 6) {
   Text("Dailgo").font(.headline).foregroundStyle(Color(red: 0.43, green: 0.32, blue: 0.65))
   if let payload = entry.payload {
    Text(payload.total.formatted() + " · " + L("Today", "اليوم")).font(.caption).foregroundStyle(.secondary)
    if payload.tasks.isEmpty { Text(L("No tasks need attention today.", "مفيش مهام محتاجة اهتمام النهارده.")).font(.caption) }
    ForEach(Array(payload.tasks.prefix(count))) { task in Text("○ " + task.title).font(.caption).lineLimit(2).privacySensitive() }
   } else { Text(entry.problem ? L("Could not refresh. Check your device token and connection.", "تعذر التحديث. راجع رمز الجهاز والاتصال.") : L("Open Dailgo to connect your Today widget.", "افتح دايلجو لربط Widget اليوم.")).font(.caption) }
   Spacer(minLength: 0)
  }.frame(maxWidth: .infinity, alignment: .leading).containerBackground(Color(red: 0.95, green: 0.93, blue: 0.98), for: .widget).widgetURL(entry.server.flatMap { URL(string: $0 + "/today") })
 }
}
@main struct DailgoToday: Widget {
 let kind = "DailgoToday"
 var body: some WidgetConfiguration { StaticConfiguration(kind: kind, provider: Provider()) { entry in TodayView(entry: entry) }.configurationDisplayName(L("Dailgo Today", "دايلجو اليوم")).description(L("Read-only glance at today’s tasks.", "نظرة للقراءة فقط على مهام اليوم.")).supportedFamilies([.systemSmall, .systemMedium]) }
}
