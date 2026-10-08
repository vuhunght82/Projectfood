// ==========================================
// DỊCH VỤ GIỮ MÀN HÌNH LUÔN SÁNG (SCREEN WAKE LOCK SERVICE)
// Giúp KDS Bếp, POS, Bồi bàn, Smart TV không bị tắt / sleep màn hình
// ==========================================

(function() {
    let wakeLockSentinel = null;
    let fallbackVideo = null;

    // Lấy trạng thái hiện tại từ bộ nhớ
    function isWakeLockEnabled() {
        return localStorage.getItem('hoasen_keep_screen_awake') === '1';
    }

    // Cập nhật giao diện trên toàn bộ các vị trí (Header & Quản lý hệ thống)
    window.updateWakeLockUI = function(isActive) {
        // 1. Nút trên Header
        const headerBtn = document.getElementById('btnHeaderWakeLock');
        const headerIcon = document.getElementById('headerWakeLockIcon');
        const headerText = document.getElementById('headerWakeLockText');
        if (headerBtn) {
            if (isActive) {
                headerBtn.className = 'btn btn-sm btn-warning rounded-pill px-2 py-1 me-2 shadow-sm text-dark fw-bold animate__animated animate__pulse';
                if (headerIcon) headerIcon.className = 'fa-solid fa-sun text-danger';
                if (headerText) headerText.innerText = 'Sáng liên tục: BẬT';
            } else {
                headerBtn.className = 'btn btn-sm btn-outline-light rounded-pill px-2 py-1 me-2 opacity-75';
                if (headerIcon) headerIcon.className = 'fa-regular fa-sun';
                if (headerText) headerText.innerText = 'Sáng liên tục: TẮT';
            }
        }

        // 2. Switch & Badge trong trang Quản lý hệ thống
        const switchEl = document.getElementById('sysKeepScreenAwakeSwitch');
        const labelEl = document.getElementById('sysKeepScreenAwakeLabel');
        const badgeEl = document.getElementById('wakeLockStatusBadge');

        if (switchEl) switchEl.checked = isActive;
        if (labelEl) {
            labelEl.innerText = isActive ? '🟢 Đang giữ màn hình sáng' : '⚪ Đã tắt chế độ giữ sáng';
            labelEl.className = isActive ? 'form-check-label fw-bold small text-success ms-2 pt-1' : 'form-check-label fw-bold small text-muted ms-2 pt-1';
        }
        if (badgeEl) {
            if (isActive) {
                badgeEl.className = 'badge bg-success';
                badgeEl.innerHTML = '<i class="fa-solid fa-sun me-1 text-warning"></i> Đang hoạt động';
            } else {
                badgeEl.className = 'badge bg-secondary';
                badgeEl.innerText = 'Chưa kích hoạt';
            }
        }
    };

    // Kích hoạt giữ màn hình sáng
    window.requestScreenWakeLock = async function() {
        // 1. Thử dùng Native Web Screen Wake Lock API
        if ('wakeLock' in navigator) {
            try {
                if (wakeLockSentinel !== null) {
                    try { await wakeLockSentinel.release(); } catch(e) {}
                    wakeLockSentinel = null;
                }
                wakeLockSentinel = await navigator.wakeLock.request('screen');
                wakeLockSentinel.addEventListener('release', () => {
                    wakeLockSentinel = null;
                    if (isWakeLockEnabled()) {
                        // Nếu vẫn bật mà bị release ngầm, thử request lại
                        setTimeout(() => {
                            if (isWakeLockEnabled() && !document.hidden) window.requestScreenWakeLock();
                        }, 1000);
                    } else {
                        window.updateWakeLockUI(false);
                    }
                });
                window.updateWakeLockUI(true);
                return true;
            } catch (err) {
                console.warn('⚠️ Lỗi native Wake Lock:', err.message);
            }
        }

        // 2. Fallback: Dùng canvas/video giả lập hoạt động để giữ màn hình sáng
        try {
            if (!fallbackVideo) {
                fallbackVideo = document.createElement('video');
                fallbackVideo.setAttribute('playsinline', '');
                fallbackVideo.setAttribute('muted', '');
                fallbackVideo.setAttribute('loop', '');
                fallbackVideo.muted = true;
                fallbackVideo.style.position = 'fixed';
                fallbackVideo.style.opacity = '0.001';
                fallbackVideo.style.pointerEvents = 'none';
                fallbackVideo.style.zIndex = '-9999';
                fallbackVideo.style.width = '1px';
                fallbackVideo.style.height = '1px';

                // Video data base64 siêu nhẹ 0.1s
                fallbackVideo.src = 'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAAAhmcmVlAAAAG21kYXRhAAAC/AYF//+43939/v7+/v7+/v4=';
                document.body.appendChild(fallbackVideo);
            }
            fallbackVideo.play().catch(() => {});
            window.updateWakeLockUI(true);
            return true;
        } catch(e) {}

        window.updateWakeLockUI(false);
        return false;
    };

    // Tắt giữ màn hình sáng
    window.releaseScreenWakeLock = async function() {
        if (wakeLockSentinel) {
            try {
                await wakeLockSentinel.release();
            } catch(e) {}
            wakeLockSentinel = null;
        }
        if (fallbackVideo) {
            try { fallbackVideo.pause(); } catch(e) {}
        }
        window.updateWakeLockUI(false);
    };

    // Đổi trạng thái Bật / Tắt
    window.setScreenWakeLockState = async function(enable, saveConfig = false) {
        if (enable) {
            localStorage.setItem('hoasen_keep_screen_awake', '1');
            await window.requestScreenWakeLock();
            if (window.toast) {
                window.toast.success('🔆 Đã BẬT chế độ giữ màn hình luôn sáng liên tục (Không tự tắt / sleep)!');
            }
        } else {
            localStorage.setItem('hoasen_keep_screen_awake', '0');
            await window.releaseScreenWakeLock();
            if (window.toast) {
                window.toast.info('🌙 Đã TẮT chế độ giữ màn hình sáng.');
            }
        }

        if (saveConfig) {
            try {
                const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
                sysConfig.keep_screen_awake = enable ? '1' : '0';
                localStorage.setItem('hoasen_system_config', JSON.stringify(sysConfig));
                
                // Đồng bộ lên server nếu có hàm save
                if (typeof window.saveAllSystemSettings === 'function') {
                    window.saveAllSystemSettings(true);
                }
            } catch(e) {}
        }
    };

    // Chuyển đổi nhanh 1 click (Header / Button)
    window.toggleScreenWakeLockQuick = function() {
        const nextState = !isWakeLockEnabled();
        window.setScreenWakeLockState(nextState, true);
    };

    // Switch trong trang Cấu hình hệ thống
    window.handleToggleWakeLock = function(checked) {
        window.setScreenWakeLockState(checked, true);
    };

    // Tự động kích hoạt lại khi người dùng mở khóa màn hình hoặc quay lại tab
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && isWakeLockEnabled()) {
            window.requestScreenWakeLock();
        }
    });

    // Khởi động khi tải trang
    document.addEventListener('DOMContentLoaded', () => {
        // Đồng bộ từ cấu hình hệ thống
        try {
            const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
            if (sysConfig.keep_screen_awake === '1' && localStorage.getItem('hoasen_keep_screen_awake') === null) {
                localStorage.setItem('hoasen_keep_screen_awake', '1');
            }
        } catch(e) {}

        const shouldWake = isWakeLockEnabled();
        window.updateWakeLockUI(shouldWake);

        if (shouldWake) {
            // Cho một tương tác đầu tiên hoặc gọi ngay nếu trình duyệt cho phép
            window.requestScreenWakeLock();
            const firstInteraction = () => {
                if (isWakeLockEnabled()) window.requestScreenWakeLock();
                document.removeEventListener('click', firstInteraction);
                document.removeEventListener('touchstart', firstInteraction);
            };
            document.addEventListener('click', firstInteraction, { once: true });
            document.addEventListener('touchstart', firstInteraction, { once: true });
        }
    });
})();
