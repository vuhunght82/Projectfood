package com.hoasen.pos;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class WebAppInterface {
    private final MainActivity activity;
    private final WebView webView;
    private PowerManager.WakeLock wakeLock;

    public WebAppInterface(MainActivity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    /**
     * 🌟 ĐÁNH THỨC ĐIỆN THOẠI (BẬT SÁNG MÀN HÌNH NGAY CẢ KHI ĐANG KHÓA / TẮT MÀN HÌNH)
     * Thường dùng khi: Bếp nhận đơn mới, Bồi bàn nhận món xong từ bếp, Khách gọi phục vụ
     */
    @JavascriptInterface
    public void wakeUp(final int durationSeconds) {
        activity.runOnUiThread(() -> {
            try {
                // 1. Đánh thức màn hình và hiện ngay đè lên màn hình khóa
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                    activity.setShowWhenLocked(true);
                    activity.setTurnScreenOn(true);
                } else {
                    activity.getWindow().addFlags(
                        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                    );
                }

                // 2. Kích hoạt PowerManager WakeLock
                PowerManager pm = (PowerManager) activity.getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    if (wakeLock != null && wakeLock.isHeld()) {
                        try { wakeLock.release(); } catch (Exception ignored) {}
                    }
                    int flags = PowerManager.SCREEN_BRIGHT_WAKE_LOCK | 
                                PowerManager.ACQUIRE_CAUSES_WAKEUP | 
                                PowerManager.ON_AFTER_RELEASE;
                    wakeLock = pm.newWakeLock(flags, "HoaSenPOS:NotificationWakeLock");
                    long timeout = Math.max(3000, durationSeconds * 1000L);
                    wakeLock.acquire(timeout);
                }

                // 3. Rung chuông cảnh báo dồn dập (2 nhịp rung rõ ràng)
                vibrateAlert();

            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    /**
     * 🔆 GIỮ MÀN HÌNH LUÔN SÁNG LIÊN TỤC (Dành cho Màn hình Bếp KDS / Thu ngân / Smart TV)
     */
    @JavascriptInterface
    public void keepScreenOn(final boolean enable) {
        activity.runOnUiThread(() -> {
            try {
                if (enable) {
                    activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                } else {
                    activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    /**
     * 🖨️ IN HÓA ĐƠN / PHIẾU BẾP TỰ ĐỘNG BẰNG NATIVE ANDROID PRINT MANAGER
     * Hỗ trợ tất cả máy in: Máy in nhiệt Bluetooth, Wifi, LAN, Mopria hoặc xuất file PDF
     */
    @JavascriptInterface
    public void printHtml(final String htmlContent) {
        activity.runOnUiThread(() -> {
            try {
                WebView printWebView = new WebView(activity);
                printWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        PrintManager printManager = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                        if (printManager != null) {
                            String jobName = "HoaSen_Bill_" + System.currentTimeMillis();
                            PrintDocumentAdapter adapter = printWebView.createPrintDocumentAdapter(jobName);
                            PrintAttributes.Builder builder = new PrintAttributes.Builder();
                            builder.setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME);
                            // Khổ giấy hóa đơn chuẩn 80mm cuộn nhiệt
                            builder.setMediaSize(PrintAttributes.MediaSize.ISO_A6);
                            builder.setMinMargins(PrintAttributes.Margins.NO_MARGINS);
                            printManager.print(jobName, adapter, builder.build());
                        }
                    }
                });
                printWebView.loadDataWithBaseURL(null, htmlContent, "text/html", "utf-8", null);
            } catch (Exception e) {
                Toast.makeText(activity, "Lỗi in: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    /**
     * 🖨️ In nội dung đang hiển thị trực tiếp trên WebView
     */
    @JavascriptInterface
    public void printCurrentPage() {
        activity.runOnUiThread(() -> {
            try {
                PrintManager printManager = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                if (printManager != null) {
                    String jobName = "HoaSen_Print_" + System.currentTimeMillis();
                    PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(jobName);
                    PrintAttributes.Builder builder = new PrintAttributes.Builder();
                    builder.setMinMargins(PrintAttributes.Margins.NO_MARGINS);
                    printManager.print(jobName, adapter, builder.build());
                }
            } catch (Exception e) {
                Toast.makeText(activity, "Lỗi in trang: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    /**
     * 📳 Rung thiết bị
     */
    @JavascriptInterface
    public void vibrate(final long ms) {
        activity.runOnUiThread(() -> {
            try {
                Vibrator vibrator = getVibrator();
                if (vibrator != null && vibrator.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        vibrator.vibrate(ms);
                    }
                }
            } catch (Exception ignored) {}
        });
    }

    private void vibrateAlert() {
        try {
            Vibrator vibrator = getVibrator();
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 350, 150, 350};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
                } else {
                    vibrator.vibrate(pattern, -1);
                }
            }
        } catch (Exception ignored) {}
    }

    private Vibrator getVibrator() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = (VibratorManager) activity.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return vm != null ? vm.getDefaultVibrator() : null;
        } else {
            return (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
        }
    }

    /**
     * 📱 Báo cho Web biết đang chạy trong Ứng Dụng Native Android
     */
    @JavascriptInterface
    public boolean isNativeApp() {
        return true;
    }

    /**
     * ⚙️ Lấy IP Server hiện tại
     */
    @JavascriptInterface
    public String getServerUrl() {
        SharedPreferences sp = activity.getSharedPreferences("HoaSenPrefs", Context.MODE_PRIVATE);
        return sp.getString("server_url", activity.getString(R.string.default_server_url));
    }

    /**
     * ⚙️ Đổi IP Server trực tiếp từ giao diện Web
     */
    @JavascriptInterface
    public void setServerUrl(final String newUrl) {
        activity.runOnUiThread(() -> {
            SharedPreferences sp = activity.getSharedPreferences("HoaSenPrefs", Context.MODE_PRIVATE);
            sp.edit().putString("server_url", newUrl).apply();
            activity.loadServerUrl(newUrl);
        });
    }

    /**
     * ⚙️ Mở hộp thoại cài đặt IP máy chủ
     */
    @JavascriptInterface
    public void openServerSettings() {
        activity.runOnUiThread(activity::showServerSettingsDialog);
    }
}

