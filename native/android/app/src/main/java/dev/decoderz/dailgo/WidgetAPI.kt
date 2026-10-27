package dev.decoderz.dailgo
import java.net.URL
import javax.net.ssl.HttpsURLConnection
import org.json.JSONObject
object WidgetAPI {
 fun server(value: String): String { val url = URL(value.trim()); require(url.protocol == "https" && url.host.isNotEmpty() && url.userInfo == null && (url.path.isEmpty() || url.path == "/") && url.query == null && url.ref == null); return url.toString().trimEnd('/') }
 fun fetch(config: WidgetConfig): JSONObject {
  val address = server(config.server)
  require(config.token.matches(Regex("[A-Za-z0-9_-]{43}")))
  val connection = URL("$address/api/widgets/today").openConnection() as HttpsURLConnection
  try { connection.instanceFollowRedirects = false; connection.connectTimeout = 4000; connection.readTimeout = 4000; connection.setRequestProperty("Authorization", "Bearer ${config.token}"); require(connection.responseCode == 200); val text = connection.inputStream.bufferedReader().use { it.readText() }; require(text.length <= 100000); return JSONObject(text) } finally { connection.disconnect() }
 }
}
