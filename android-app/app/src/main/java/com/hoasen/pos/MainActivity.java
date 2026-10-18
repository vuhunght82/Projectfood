package com.hoasen.pos;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private SwipeRefreshLayout swipeRefreshLayout;
    private ProgressBar progressBar;
    private LinearLayout errorLayout;
    private Button btnRetry, btnChangeIp;
    private String currentServerUrl;

    private static final int PERMISSION_REQ_CODE = 101;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        initViews();
        requestAppPermissions();
        setupWebView();

        // Nạp địa chỉ máy chủ được lưu trong cài đặt
        SharedPreferences sp = getSharedPreferences("HoaSenPrefs", Context.MODE_PRIVATE);
        currentServerUrl = sp.getString("server_url", getString(R.string.default_server_url));
        loadServerUrl(currentServerUrl);
    }

    private void initViews() {
        webView = findViewById(R.id.webView);
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout);
        progressBar = findViewById(R.id.progressBar);
        errorLayout = findViewById(R.id.errorLayout);
        btnRetry = findViewById(R.id.btnRetry);
        btnChangeIp = findViewById(R.id.btnChangeIp);

        swipeRefreshLayout.setColorSchemeColors(ContextCompat.getColor(this, R.color.primary));
        swipeRefreshLayout.setOnRefreshListener(() -> webView.reload());

        btnRetry.setOnClickListener(v -> loadServerUrl(currentServerUrl));
        btnChangeIp.setOnClickListener(v -> showServerSettingsDialog());
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);
        ws.setBuiltInZoomControls(false);
        ws.setDisplayZoomControls(false);

        // 🌟 BỎ QUA CHÍNH SÁCH AUTOPLAY CỦA TRÌNH DUYỆT (TỰ PHÁT CHUÔNG BẾP & GIỌNG ĐỌC KHÔNG CẦN BẤM VÀO MÀN HÌNH)
        ws.setMediaPlaybackRequiresUserGesture(false);

        // Cho phép kết nối hỗn hợp (HTTP & HTTPS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // Tối ưu hóa bộ nhớ cache
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);

        // 🌟 ĐĂNG KÝ JAVASCRIPT INTERFACE: window.Android
        webView.addJavascriptInterface(new WebAppInterface(this, webView), "Android");

        // 🌟 XỬ LÝ CHỨNG CHỈ HTTPS TỰ KÝ & LỖI MẠNG (TRÁNH TRẮNG MÀN HÌNH TRÊN IP NỘI BỘ 192.168.x.x)
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                // Cho phép chứng chỉ tự ký (Self-signed certificate) trong mạng LAN của nhà hàng
                handler.proceed();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                swipeRefreshLayout.setRefreshing(false);
                progressBar.setVisibility(View.GONE);
                errorLayout.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    swipeRefreshLayout.setRefreshing(false);
                    progressBar.setVisibility(View.GONE);
                    webView.setVisibility(View.GONE);
                    errorLayout.setVisibility(View.VISIBLE);
                }
            }
        });

        // 🌟 TỰ ĐỘNG CẤP QUYỀN CAMERA CHO GIAO DIỆN QUÉT MÃ QR TRÊN WEB
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    for (String res : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) {
                            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                            return;
                        }
                    }
                    request.grant(request.getResources());
                });
            }

            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }
        });
    }

    public void loadServerUrl(String url) {
        if (url == null || url.trim().isEmpty()) {
            url = getString(R.string.default_server_url);
        }
        url = url.trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
        }
        currentServerUrl = url;
        progressBar.setVisibility(View.VISIBLE);
        errorLayout.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        webView.loadUrl(currentServerUrl);
    }

    public void showServerSettingsDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("⚙️ Cài Đặt Địa Chỉ Máy Chủ");
        builder.setMessage("Nhập địa chỉ IP máy chủ của quán (Ví dụ: https://192.168.100.100:3443 hoặc http://192.168.1.12:3000):");

        final EditText input = new EditText(this);
        input.setText(currentServerUrl);
        input.setSelection(currentServerUrl.length());
        builder.setView(input);

        builder.setPositiveButton("Lưu & Kết Nối", (dialog, which) -> {
            String newUrl = input.getText().toString().trim();
            if (!newUrl.isEmpty()) {
                SharedPreferences sp = getSharedPreferences("HoaSenPrefs", Context.MODE_PRIVATE);
                sp.edit().putString("server_url", newUrl).apply();
                loadServerUrl(newUrl);
                Toast.makeText(MainActivity.this, "Đang kết nối: " + newUrl, Toast.LENGTH_SHORT).show();
            }
        });

        builder.setNegativeButton("Hủy", (dialog, which) -> dialog.cancel());
        builder.show();
    }

    private void requestAppPermissions() {
        String[] permissions;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions = new String[]{
                Manifest.permission.CAMERA,
                Manifest.permission.POST_NOTIFICATIONS,
                Manifest.permission.VIBRATE
            };
        } else {
            permissions = new String[]{
                Manifest.permission.CAMERA,
                Manifest.permission.VIBRATE
            };
        }

        boolean needRequest = false;
        for (String perm : permissions) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                needRequest = true;
                break;
            }
        }

        if (needRequest) {
            ActivityCompat.requestPermissions(this, permissions, PERMISSION_REQ_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQ_CODE) {
            // Quyền đã được xử lý
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}

