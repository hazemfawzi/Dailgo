package dev.decoderz.dailgo
import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.text.method.PasswordTransformationMethod
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class SetupActivity : Activity() {
 override fun onCreate(state: Bundle?) {
  super.onCreate(state); window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
  val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(36, 48, 36, 36) }
  val heading = TextView(this).apply { setText(R.string.setup); textSize = 24f }; layout.addView(heading)
  layout.addView(TextView(this).apply { setText(R.string.privacy); textSize = 16f })
  val server = EditText(this).apply { setHint(R.string.server); inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI; setText(WidgetStore.load(this@SetupActivity)?.server ?: "https://dailgo.decoderz.dev") }; layout.addView(server)
  val token = EditText(this).apply { setHint(R.string.token); inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD; transformationMethod = PasswordTransformationMethod.getInstance(); isSaveEnabled = false }; layout.addView(token)
  val status = TextView(this); val save = Button(this).apply { setText(R.string.save) }; layout.addView(save); layout.addView(status)
  save.setOnClickListener { val address = server.text.toString(); val secret = token.text.toString().trim(); save.isEnabled = false; Thread { try { val config = WidgetConfig(WidgetAPI.server(address), secret); WidgetAPI.fetch(config); WidgetStore.save(this, config); runOnUiThread { token.text.clear(); status.setText(R.string.saved); save.isEnabled = true; val manager = AppWidgetManager.getInstance(this); sendBroadcast(Intent(this, TodayWidget::class.java).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, manager.getAppWidgetIds(ComponentName(this, TodayWidget::class.java)))) } } catch (_: Exception) { runOnUiThread { status.setText(R.string.failed); save.isEnabled = true } } }.start() }
  setContentView(ScrollView(this).apply { addView(layout) })
 }
}
