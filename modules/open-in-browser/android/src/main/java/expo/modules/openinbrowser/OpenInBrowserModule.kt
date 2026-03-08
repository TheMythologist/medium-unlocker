package expo.modules.openinbrowser

import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.verify.domain.DomainVerificationManager
import android.content.pm.verify.domain.DomainVerificationUserState
import android.net.Uri
import android.os.Build
import android.provider.Settings
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

        AsyncFunction("openLinkSettings") {
            val activity = appContext.currentActivity
                ?: throw Exception("No activity available")

            val packageUri = Uri.fromParts("package", activity.packageName, null)

            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent(Settings.ACTION_APP_OPEN_BY_DEFAULT_SETTINGS, packageUri)
            } else {
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri)
            }
            activity.startActivity(intent)
        }

        AsyncFunction("isDefaultForLinks") {
            val activity = appContext.currentActivity
                ?: throw Exception("No activity available")

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val manager = activity.getSystemService(DomainVerificationManager::class.java)
                val userState = manager.getDomainVerificationUserState(activity.packageName)
                userState?.hostToStateMap?.any { (_, state) ->
                    state == DomainVerificationUserState.DOMAIN_STATE_VERIFIED ||
                        state == DomainVerificationUserState.DOMAIN_STATE_SELECTED
                } ?: false
            } else {
                val probe = Intent(Intent.ACTION_VIEW, Uri.parse("https://medium.com/test"))
                    .addCategory(Intent.CATEGORY_BROWSABLE)
                val resolved = activity.packageManager.resolveActivity(
                    probe,
                    PackageManager.MATCH_DEFAULT_ONLY
                )
                resolved?.activityInfo?.packageName == activity.packageName
            }
        }
    }
}
