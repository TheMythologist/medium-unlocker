package expo.modules.openinbrowser

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OpenInBrowserModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("OpenInBrowser")

        AsyncFunction("openInBrowser") { url: String ->
            val activity = appContext.currentActivity
                ?: throw Exception("No activity available")

            val pm = activity.packageManager
            val ourPkg = activity.packageName

            // Probe with a minimal http URI to find default browser.
            // See: https://cs.android.com/android/platform/superproject/+/master:packages/modules/Permission/PermissionController/src/com/android/permissioncontroller/role/model/BrowserRoleBehavior.java
            val probe = Intent(Intent.ACTION_VIEW, Uri.fromParts("http", "", null))
                .addCategory(Intent.CATEGORY_BROWSABLE)

            val browser = pm.resolveActivity(probe, 0)
                ?.takeIf { it.activityInfo.packageName != ourPkg }
                ?: pm.queryIntentActivities(probe, 0)
                    .firstOrNull { it.activityInfo.packageName != ourPkg }
                ?: throw Exception("No browser found")

            // Explicit intent bypasses Android's "always open in app" domain verification
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                component = ComponentName(browser.activityInfo.packageName, browser.activityInfo.name)
            }
            activity.startActivity(intent)
        }
    }
}
