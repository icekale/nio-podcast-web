package top.k4le.nio.twa;

import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.widget.ImageView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;
import com.google.androidbrowserhelper.trusted.QualityEnforcer;
import com.google.androidbrowserhelper.trusted.TwaLauncher;
import com.google.androidbrowserhelper.trusted.splashscreens.PwaWrapperSplashScreenStrategy;

/** 有 Custom Tabs 走 TWA；没有则退回 WebView。只加载线上站点。 */
public class SplashActivity extends AppCompatActivity {
    private static final String TAG = "NioRadioTWA";
    private static final Uri LAUNCHER_URI = Uri.parse("https://nio.k4le.top/");

    private TwaLauncher twaLauncher;
    private PwaWrapperSplashScreenStrategy splashScreenStrategy;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM);
        super.onCreate(savedInstanceState);
        if (hasCustomTabsProvider()) {
            Log.i(TAG, "custom tabs provider found, launching TWA");
            twaLauncher = new TwaLauncher(this);
            boolean night = (getResources().getConfiguration().uiMode
                    & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
            int splashBackground = night ? 0xFF000000 : 0xFFFFFFFF;
            CustomTabColorSchemeParams lightColors = new CustomTabColorSchemeParams.Builder()
                    .setToolbarColor(0xFFE7F7F7)
                    .setNavigationBarColor(0xFFE7F7F7)
                    .build();
            CustomTabColorSchemeParams darkColors = new CustomTabColorSchemeParams.Builder()
                    .setToolbarColor(0xFF133239)
                    .setNavigationBarColor(0xFF133239)
                    .build();
            TrustedWebActivityIntentBuilder builder = new TrustedWebActivityIntentBuilder(LAUNCHER_URI)
                    .setDefaultColorSchemeParams(lightColors)
                    .setColorScheme(CustomTabsIntent.COLOR_SCHEME_SYSTEM)
                    .setColorSchemeParams(CustomTabsIntent.COLOR_SCHEME_DARK, darkColors);
            splashScreenStrategy = new PwaWrapperSplashScreenStrategy(
                    this,
                    night ? R.drawable.splash_logo_dark : R.drawable.splash_logo_light,
                    splashBackground,
                    ImageView.ScaleType.CENTER,
                    null,
                    300,
                    getPackageName() + ".fileprovider",
                    true);
            twaLauncher.launch(builder, new QualityEnforcer(), splashScreenStrategy, null);
        } else {
            Log.i(TAG, "no custom tabs provider, falling back to WebView");
            startActivity(new Intent(this, WebViewActivity.class));
            finish();
        }
    }

    @Override
    public void onEnterAnimationComplete() {
        super.onEnterAnimationComplete();
        if (splashScreenStrategy != null) {
            splashScreenStrategy.onActivityEnterAnimationComplete();
        }
    }

    @Override
    protected void onDestroy() {
        if (splashScreenStrategy != null) {
            splashScreenStrategy.destroy();
        }
        if (twaLauncher != null) {
            twaLauncher.destroy();
        }
        super.onDestroy();
    }

    private boolean hasCustomTabsProvider() {
        Intent service = new Intent("android.support.customtabs.action.CustomTabsService");
        return !getPackageManager().queryIntentServices(service, 0).isEmpty();
    }
}
