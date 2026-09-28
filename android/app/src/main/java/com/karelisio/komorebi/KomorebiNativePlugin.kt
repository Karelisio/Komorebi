package com.karelisio.komorebi

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Plugin natif Komorebi : couleurs dynamiques Material You, et téléchargement /
 * installation de l'APK de mise à jour (in-app updater, cf. src/update).
 */
@CapacitorPlugin(name = "KomorebiNative")
class KomorebiNativePlugin : Plugin() {

    private val downloadExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val cancelRequested = AtomicBoolean(false)

    @Volatile
    private var activeConnection: HttpURLConnection? = null

    // -------------------------------------------------------------------
    // Couleurs dynamiques (Material You, Android 12 / API 31+)
    // -------------------------------------------------------------------

    /** Les 13 tons publiés par le système pour chaque groupe de couleur dynamique. */
    private val tones = intArrayOf(0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000)

    @PluginMethod
    fun getDynamicColors(call: PluginCall) {
        val ret = JSObject()
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            ret.put("available", false)
            call.resolve(ret)
            return
        }
        try {
            val palette = JSObject()
            palette.put("accent1", tonalPalette("accent1"))
            palette.put("accent2", tonalPalette("accent2"))
            palette.put("accent3", tonalPalette("accent3"))
            palette.put("neutral1", tonalPalette("neutral1"))
            palette.put("neutral2", tonalPalette("neutral2"))
            ret.put("available", true)
            ret.put("palette", palette)
        } catch (e: Exception) {
            // Palette système indisponible ou inattendue : on retombe côté JS
            // sur la palette calculée localement.
            ret.put("available", false)
        }
        call.resolve(ret)
    }

    /** Lit `android.R.color.system_<name>_<ton>` pour chaque ton connu (résolution par nom). */
    private fun tonalPalette(colorGroup: String): JSObject {
        val obj = JSObject()
        val resources = context.resources
        for (tone in tones) {
            val resName = "system_${colorGroup}_$tone"
            val resId = resources.getIdentifier(resName, "color", "android")
            if (resId != 0) {
                try {
                    val color = context.getColor(resId)
                    obj.put(tone.toString(), toHexColor(color))
                } catch (_: Exception) {
                    // Ressource déclarée mais absente sur ce build système : on l'omet.
                }
            }
        }
        return obj
    }

    private fun toHexColor(color: Int): String = String.format("#%06X", 0xFFFFFF and color)

    // -------------------------------------------------------------------
    // Installation d'APK
    // -------------------------------------------------------------------

    @PluginMethod
    fun canInstallPackages(call: PluginCall) {
        val ret = JSObject()
        ret.put("allowed", canRequestInstallPackages())
        call.resolve(ret)
    }

    private fun canRequestInstallPackages(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.packageManager.canRequestPackageInstalls()
        } else {
            true
        }

    @PluginMethod
    fun openInstallSettings(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
            intent.data = Uri.parse("package:" + context.packageName)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(intent)
        }
        call.resolve()
    }

    @PluginMethod
    fun installApk(call: PluginCall) {
        val path = call.getString("path")
        if (path.isNullOrEmpty()) {
            call.reject("path manquant")
            return
        }
        val file = File(path)
        if (!file.exists()) {
            call.reject("fichier introuvable : $path")
            return
        }

        if (!canRequestInstallPackages()) {
            val ret = JSObject()
            ret.put("started", false)
            ret.put("needsPermission", true)
            call.resolve(ret)
            return
        }

        try {
            val uri: Uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", file)
            val intent = Intent(Intent.ACTION_VIEW)
            intent.setDataAndType(uri, "application/vnd.android.package-archive")
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(intent)
            val ret = JSObject()
            ret.put("started", true)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("échec du lancement de l'installation : ${e.message}", e)
        }
    }

    // -------------------------------------------------------------------
    // Téléchargement avec reprise (mise à jour in-app)
    // -------------------------------------------------------------------

    @PluginMethod
    fun download(call: PluginCall) {
        val url = call.getString("url")
        val relPath = call.getString("path")
        val expectedSha256 = call.getString("sha256")
        if (url.isNullOrEmpty() || relPath.isNullOrEmpty()) {
            call.reject("url et path sont requis")
            return
        }

        cancelRequested.set(false)
        downloadExecutor.execute { runDownload(call, url, relPath, expectedSha256) }
    }

    @PluginMethod
    fun cancelDownload(call: PluginCall) {
        cancelRequested.set(true)
        // Interrompt la lecture bloquante en cours en fermant la connexion :
        // c'est le seul moyen fiable d'annuler un HttpURLConnection depuis un
        // autre thread.
        activeConnection?.disconnect()
        call.resolve()
    }

    private fun runDownload(call: PluginCall, urlStr: String, relPath: String, expectedSha256: String?) {
        var connection: HttpURLConnection? = null
        try {
            val updatesDir = File(context.cacheDir, "updates")
            if (!updatesDir.exists()) updatesDir.mkdirs()

            val outFile = File(updatesDir, relPath)
            outFile.parentFile?.let { if (!it.exists()) it.mkdirs() }

            var startAt = if (outFile.exists()) outFile.length() else 0L

            val url = URL(urlStr)
            connection = url.openConnection() as HttpURLConnection
            activeConnection = connection
            connection.connectTimeout = 30_000
            connection.readTimeout = 30_000
            connection.instanceFollowRedirects = true
            if (startAt > 0) {
                connection.setRequestProperty("Range", "bytes=$startAt-")
            }
            connection.connect()

            if (cancelRequested.get()) {
                rejectCancelled(call)
                return
            }

            val status = connection.responseCode
            val append: Boolean
            val total: Long

            when {
                status == HttpURLConnection.HTTP_PARTIAL && startAt > 0 -> {
                    // Le serveur honore la reprise : on complète le fichier existant.
                    append = true
                    val remaining = connection.contentLengthLong
                    total = if (remaining >= 0) startAt + remaining else -1L
                }
                status == HttpURLConnection.HTTP_OK -> {
                    // Pas de reprise possible (serveur sans support Range, ou premier
                    // téléchargement) : on repart de zéro.
                    append = false
                    startAt = 0L
                    total = connection.contentLengthLong
                }
                else -> {
                    call.reject("téléchargement échoué : HTTP $status")
                    return
                }
            }

            var received = startAt
            var lastEmit = 0L

            FileOutputStream(outFile, append).use { fos ->
                connection.inputStream.use { input ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        if (cancelRequested.get()) {
                            rejectCancelled(call)
                            return
                        }
                        val n = input.read(buffer)
                        if (n < 0) break
                        fos.write(buffer, 0, n)
                        received += n
                        val now = System.currentTimeMillis()
                        if (now - lastEmit >= 200) {
                            lastEmit = now
                            emitProgress(received, total)
                        }
                    }
                }
            }

            emitProgress(received, if (total >= 0) total else received)

            val digest = sha256Of(outFile)
            if (!expectedSha256.isNullOrBlank() && !digest.equals(expectedSha256, ignoreCase = true)) {
                outFile.delete()
                call.reject("checksum")
                return
            }

            val ret = JSObject()
            ret.put("path", outFile.absolutePath)
            ret.put("sha256", digest)
            ret.put("size", outFile.length())
            call.resolve(ret)
        } catch (e: Exception) {
            if (cancelRequested.get()) {
                rejectCancelled(call)
            } else {
                call.reject("téléchargement échoué : ${e.message}", e)
            }
        } finally {
            connection?.disconnect()
            activeConnection = null
            cancelRequested.set(false)
        }
    }

    private fun rejectCancelled(call: PluginCall) {
        call.reject("téléchargement annulé", "cancelled")
    }

    private fun emitProgress(received: Long, total: Long) {
        val progress = JSObject()
        progress.put("received", received)
        progress.put("total", total)
        notifyListeners("downloadProgress", progress)
    }

    private fun sha256Of(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val n = input.read(buffer)
                if (n < 0) break
                digest.update(buffer, 0, n)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    override fun handleOnDestroy() {
        cancelRequested.set(true)
        activeConnection?.disconnect()
        downloadExecutor.shutdownNow()
    }
}
