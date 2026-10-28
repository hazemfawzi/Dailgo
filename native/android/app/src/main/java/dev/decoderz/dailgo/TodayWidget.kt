package dev.decoderz.dailgo
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

class TodayWidget : AppWidgetProvider() {
 override fun onReceive(context: Context, intent: Intent) { if(intent.action == "dev.decoderz.dailgo.REFRESH") { onUpdate(context, AppWidgetManager.getInstance(context), AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, TodayWidget::class.java))); return }; super.onReceive(context, intent) }
 override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
  val pending = goAsync()
  Thread {
   try {
    val config = WidgetStore.load(context)
    val views = RemoteViews(context.packageName, R.layout.today_widget)
    var connected = false
    if(config == null) views.setTextViewText(R.id.widget_tasks, context.getString(R.string.configure))
    else try {
     val data = WidgetAPI.fetch(config); val tasks = data.getJSONArray("tasks"); val lines = (0 until minOf(tasks.length(), 5)).map { index -> "○ " + tasks.getJSONObject(index).getString("title") }
     views.setTextViewText(R.id.widget_tasks, if(lines.isEmpty()) context.getString(R.string.empty) else lines.joinToString("\n"))
     views.setTextViewText(R.id.widget_date, LocalDate.parse(data.getString("date")).format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(Locale.getDefault())))
     connected = true
    } catch (_: Exception) { views.setTextViewText(R.id.widget_tasks, context.getString(R.string.offline)); views.setTextViewText(R.id.widget_date, "") }
    val open = if(connected && config != null) Intent(Intent.ACTION_VIEW, Uri.parse(config.server + "/today")) else Intent(context, SetupActivity::class.java)
    views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    val refresh = Intent(context, TodayWidget::class.java).setAction("dev.decoderz.dailgo.REFRESH")
    views.setOnClickPendingIntent(R.id.widget_refresh, PendingIntent.getBroadcast(context, 1, refresh, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    ids.forEach { manager.updateAppWidget(it, views) }
   } finally { pending.finish() }
  }.start()
 }
}
