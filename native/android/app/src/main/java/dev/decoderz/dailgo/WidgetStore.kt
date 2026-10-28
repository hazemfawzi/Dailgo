package dev.decoderz.dailgo

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class WidgetConfig(val server: String, val token: String)
object WidgetStore {
 private const val alias = "dailgo.widget.readonly"
 private fun key(create: Boolean): SecretKey? {
  val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
  (store.getKey(alias, null) as? SecretKey)?.let { return it }
  if (!create) return null
  return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply { init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build()) }.generateKey()
 }
 fun save(context: Context, config: WidgetConfig) {
  val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key(true)) }
  val encrypted = cipher.doFinal(config.token.toByteArray(Charsets.UTF_8))
  context.getSharedPreferences("widget", Context.MODE_PRIVATE).edit().putString("server", config.server).putString("token", Base64.encodeToString(encrypted, Base64.NO_WRAP)).putString("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP)).apply()
 }
 fun load(context: Context): WidgetConfig? { return try {
  val prefs = context.getSharedPreferences("widget", Context.MODE_PRIVATE)
  val server = prefs.getString("server", null) ?: return null
  val secret = key(false) ?: return null
  val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, secret, GCMParameterSpec(128, Base64.decode(prefs.getString("iv", ""), Base64.NO_WRAP))) }
  WidgetConfig(server, String(cipher.doFinal(Base64.decode(prefs.getString("token", ""), Base64.NO_WRAP)), Charsets.UTF_8))
 } catch (_: Exception) { null } }
}
