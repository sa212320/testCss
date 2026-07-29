package dev.csstest.bundled

import android.app.Activity
import android.os.Bundle
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoView

/**
 * 驗證矩陣「右欄」用的殼：不用系統 WebView，改用隨 APK 出貨的 Gecko 引擎，
 * 載入跟 Capacitor 殼完全相同的測試網址。
 *
 * 這一輪刻意只驗渲染，不接任何 Capacitor plugin。理由是決策順序：
 * 若換掉引擎之後 CSS 還是壞的，那 10 個 plugin 的重接成本根本不用估。
 *
 * 順帶一個 Capacitor 殼沒有的優勢：Gecko 自帶完整的 TLS 堆疊（NSS），
 * 不依賴系統憑證庫，所以 Android 7.1.1 以下不信任 Let's Encrypt ISRG Root X1
 * 的問題在這個殼上不存在。如果出現「系統版連不上、自帶版連得上」，
 * 那本身就是一個有價值的發現，不是測試失敗。
 */
class MainActivity : Activity() {

    private lateinit var session: GeckoSession

    /** 由 NavigationDelegate 持續更新；決定返回鍵是回上一頁還是離開 app。 */
    private var canGoBack = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val view = GeckoView(this)
        setContentView(view)

        session = GeckoSession()
        session.navigationDelegate = object : GeckoSession.NavigationDelegate {
            override fun onCanGoBack(session: GeckoSession, value: Boolean) {
                canGoBack = value
            }
        }
        session.open(GeckoRuntime.getDefault(this))
        view.setSession(session)

        // 跟 Capacitor 殼用同一套 cache-busting：每次開啟都帶新的 timestamp。
        // 兩個殼必須看到同一份測試頁，否則左右兩欄的對照就沒有意義。
        //
        // intent 帶 data 時優先用它，方便開發時直接跳到某一頁：
        //   adb shell am start -n dev.csstest.bundled/.MainActivity \
        //     -d "https://sa212320.github.io/testCss/06-modern.html"
        // 沒有這條路徑的話，只能靠 adb input tap 點連結導航，
        // 而 tap 很容易誤觸長按而跳出文字選取選單（實際踩過兩次）。
        // 這裡沒有註冊 intent-filter，所以不影響對方使用 —— 一般開啟仍走預設網址。
        val target = intent?.data?.toString()
            ?: (TEST_URL + "?t=" + System.currentTimeMillis())
        session.loadUri(target)
    }

    /**
     * 對方要在 6 個頁面之間來回導覽。沒有返回鍵的話每次都得重開 app，
     * 而重開會重新跳轉、回到第一頁 —— 一輪截圖會變成折磨。
     */
    @Deprecated("predictive back 已在 manifest 關閉，這裡仍是有效的返回入口")
    override fun onBackPressed() {
        if (canGoBack) session.goBack() else @Suppress("DEPRECATION") super.onBackPressed()
    }

    override fun onDestroy() {
        if (session.isOpen) session.close()
        super.onDestroy()
    }

    private companion object {
        const val TEST_URL = "https://sa212320.github.io/testCss/"
    }
}
