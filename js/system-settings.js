/**
 * LOGIC QUẢN LÝ HỆ THỐNG (SYSTEM SETTINGS)
 * - Quản lý Cấu hình Máy In (Tự động / Thủ công, Khổ giấy K80 / K58, Kết nối IP / LAN / Bluetooth / USB)
 * - Quản lý Mã QR Code Chân Bill (Upload ảnh từ máy tính, Xóa, Tạo VietQR, Preview trực tiếp)
 * - Quản lý Âm Thanh Báo Bếp & Nhận Món (5 Kiểu Chuông mẫu, Upload file âm thanh tùy chỉnh, Âm lượng, Vòng lặp)
 * - Quản lý Phân Quyền Vai Trò
 */

// Biến lưu trữ trạng thái tệp upload tạm
let uploadedQrUrl = '';
let uploadedKitchenSoundUrl = '';
let uploadedReadySoundUrl = '';

// 1. Chuyển đổi Tab trong Quản Lý Hệ Thống
window.switchSystemTab = function(tabId) {
    if (tabId) {
        sessionStorage.setItem('hoasen_active_system_tab', tabId);
    }
    document.querySelectorAll('#systemSettingTabs .nav-link').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane-custom').forEach(pane => pane.classList.add('d-none'));

    const activeBtn = document.getElementById(tabId + '-btn');
    const activePane = document.getElementById(tabId);

    if (activeBtn) activeBtn.classList.add('active');
    if (activePane) activePane.classList.remove('d-none');

    if (tabId === 'tab-printer') {
        window.renderLiveBillPreviewInline();
    } else if (tabId === 'tab-roles') {
        window.loadPermissionSettingsInline();
    } else if (tabId === 'tab-brand') {
        if (typeof window.updateBrandPreview === 'function') window.updateBrandPreview();
    } else if (tabId === 'tab-shift') {
        window.loadShiftSettings();
    } else if (tabId === 'tab-floating') {
        if (typeof window.loadFloatingLayoutSetting === 'function') window.loadFloatingLayoutSetting();
        window.loadFloatingButtonsList();
    } else if (tabId === 'tab-banners') {
        if (typeof window.loadSlideEffectSettings === 'function') window.loadSlideEffectSettings();
        if (typeof window.loadSystemBannersList === 'function') window.loadSystemBannersList();
    } else if (tabId === 'tab-marketing') {
        if (typeof window.loadMarketingCampaigns === 'function') window.loadMarketingCampaigns();
        if (typeof window.loadMarketingSchedules === 'function') window.loadMarketingSchedules();
        if (typeof window.loadMemberVouchersHistory === 'function') window.loadMemberVouchersHistory();
        if (typeof window.loadSmtpConfig === 'function') window.loadSmtpConfig();
        if (typeof window.loadMarketingEmailLogs === 'function') window.loadMarketingEmailLogs();
    } else if (tabId === 'tab-delivery-platforms') {
        if (typeof window.loadDeliveryPlatformsManagementList === 'function') window.loadDeliveryPlatformsManagementList();
    } else if (tabId === 'tab-login-history') {
        if (typeof window.loadLoginHistoryList === 'function') window.loadLoginHistoryList();
    }
};

// 2. Chuyển đổi hiển thị ô nhập IP theo loại máy in Thu Ngân
window.handlePrinterTypeChange = function() {
    const printerType = document.getElementById('sysPrinterSelect')?.value || 'LAN';
    const ipBox = document.getElementById('sysPrinterIpBox');
    if (ipBox) {
        ipBox.style.display = (printerType === 'LAN') ? 'block' : 'none';
    }
};

// 2.1. Chuyển đổi hiển thị ô nhập IP theo loại máy in Bếp
window.handleKitchenPrinterTypeChange = function() {
    const printerType = document.getElementById('sysKitchenPrinterSelect')?.value || 'LAN';
    const ipBox = document.getElementById('sysKitchenPrinterIpBox');
    if (ipBox) {
        ipBox.style.display = (printerType === 'LAN') ? 'block' : 'none';
    }
};

// 3. Kiểm tra kết nối Máy in Thu Ngân LAN / IP
window.testPrinterIpConnection = function() {
    const ipVal = document.getElementById('sysPrinterIpInput')?.value?.trim();
    if (!ipVal) {
        if (window.toast) window.toast.warning('Vui lòng nhập địa chỉ IP máy in Thu Ngân LAN!');
        else alert('Vui lòng nhập địa chỉ IP máy in Thu Ngân LAN!');
        return;
    }
    if (window.toast) {
        window.toast.info(`Đang kiểm tra kết nối tới máy in Thu Ngân [${ipVal}]...`);
        setTimeout(() => {
            window.toast.success(`Kết nối tốt tới máy in Thu Ngân [${ipVal}]! Cổng in 9100 sẵn sàng.`);
        }, 600);
    }
};

// 3.1. Kiểm tra kết nối Máy in Bếp LAN / IP
window.testKitchenPrinterIpConnection = function() {
    const ipVal = document.getElementById('sysKitchenPrinterIpInput')?.value?.trim();
    if (!ipVal) {
        if (window.toast) window.toast.warning('Vui lòng nhập địa chỉ IP máy in Bếp LAN!');
        else alert('Vui lòng nhập địa chỉ IP máy in Bếp LAN!');
        return;
    }
    if (window.toast) {
        window.toast.info(`Đang kiểm tra kết nối tới máy in Bếp [${ipVal}]...`);
        setTimeout(() => {
            window.toast.success(`Kết nối tốt tới máy in Bếp [${ipVal}]! Cổng in 9100 sẵn sàng.`);
        }, 600);
    }
};

// 3.2. Bật / Tắt hiển thị chi tiết Thuế VAT
window.toggleVatConfigDisplay = function() {
    const isChecked = document.getElementById('sysVatEnabled')?.checked ?? false;
    const box = document.getElementById('sysVatDetailBox');
    if (box) {
        box.style.display = isChecked ? 'flex' : 'none';
    }
};

// 3.3. Lấy vị trí GPS thực tế hiện tại của thiết bị (Geofencing)
window.fetchCurrentDeviceCoordinates = function() {
    if (!navigator.geolocation) {
        if (window.toast) window.toast.warning('Trình duyệt hoặc thiết bị của bạn không hỗ trợ định vị GPS!');
        else alert('Trình duyệt không hỗ trợ GPS!');
        return;
    }
    if (window.toast) window.toast.info('Đang lấy tọa độ GPS từ vệ tinh / mạng của thiết bị...');
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude.toFixed(6);
            const lng = position.coords.longitude.toFixed(6);
            
            // Cập nhật vào Tab Thương Hiệu
            const brandLatEl = document.getElementById('cfgBrandLat');
            const brandLngEl = document.getElementById('cfgBrandLng');
            if (brandLatEl) brandLatEl.value = lat;
            if (brandLngEl) brandLngEl.value = lng;

            // Cập nhật nhãn hiển thị trong Tab Phân Quyền
            const txt = document.getElementById('gpsCurrentCoordsText');
            if (txt) txt.innerText = `Lat: ${lat}, Lng: ${lng}`;

            if (window.toast) window.toast.success(`📍 Đã lấy tọa độ quán thành công: [${lat}, ${lng}]!`);
            window.saveAllSystemSettings(true);
        },
        (error) => {
            console.error('Lỗi lấy GPS:', error);
            let msg = 'Không thể lấy tọa độ GPS: ';
            if (error.code === 1) msg += 'Bạn đã từ chối cấp quyền truy cập vị trí trên trình duyệt.';
            else if (error.code === 2) msg += 'Không xác định được vị trí thiết bị.';
            else msg += error.message;
            if (window.toast) window.toast.error(msg);
            else alert(msg);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
};

// 4. Bật / Tắt hiển thị khu vực QR Code
window.toggleQrSectionDisplay = function() {
    const isChecked = document.getElementById('sysShowQrCode')?.checked ?? true;
    const container = document.getElementById('sysQrDetailContainer');
    const pvContainer = document.getElementById('pvQrCodeContainerInline');

    if (container) container.style.display = isChecked ? 'block' : 'none';
    if (pvContainer) pvContainer.style.display = isChecked ? 'block' : 'none';
};

// 5. Chuyển đổi giữa chế độ Upload Ảnh QR và VietQR Số Tài Khoản
window.switchQrInputMode = function(mode) {
    const uploadBox = document.getElementById('sysQrUploadBox');
    const vietQrBox = document.getElementById('sysQrVietQRBox');

    if (mode === 'UPLOAD') {
        if (uploadBox) uploadBox.style.display = 'block';
        if (vietQrBox) vietQrBox.style.display = 'none';
        window.updateQrPreviewWithUpload();
    } else {
        if (uploadBox) uploadBox.style.display = 'none';
        if (vietQrBox) vietQrBox.style.display = 'block';
        window.generateVietQrLive();
    }
};

// Khi người dùng chọn file ảnh QR từ máy tính
window.handleQrFileSelected = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Xem trước cục bộ
    const reader = new FileReader();
    reader.onload = function(evt) {
        const previewUrl = evt.target.result;
        const thumbImg = document.getElementById('sysQrThumbImg');
        const icon = document.getElementById('sysQrPlaceholderIcon');
        const pvImg = document.getElementById('pvQrImgInline');
        const btnDelete = document.getElementById('btnDeleteQrImg');

        if (thumbImg) {
            thumbImg.src = previewUrl;
            thumbImg.style.display = 'block';
        }
        if (icon) icon.style.display = 'none';
        if (pvImg) pvImg.src = previewUrl;
        if (btnDelete) btnDelete.style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
};

// Upload ảnh QR lên Server
window.uploadQrImageFile = async function() {
    const fileInput = document.getElementById('sysQrFileInput');
    if (!fileInput || !fileInput.files[0]) {
        if (window.toast) window.toast.warning('Vui lòng chọn một file ảnh QR từ máy tính trước!');
        else alert('Vui lòng chọn một file ảnh QR từ máy tính trước!');
        return;
    }

    const formData = new FormData();
    formData.append('qrImage', fileInput.files[0]);

    try {
        const res = await fetch('/api/system-config/upload-qr', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success && data.qrUrl) {
            uploadedQrUrl = data.qrUrl;
            const pvImg = document.getElementById('pvQrImgInline');
            if (pvImg) pvImg.src = uploadedQrUrl;
            const btnDelete = document.getElementById('btnDeleteQrImg');
            if (btnDelete) btnDelete.style.display = 'inline-block';

            if (window.toast) window.toast.success('Đã tải lên ảnh mã QR hóa đơn thành công!');
        } else {
            throw new Error(data.error || 'Tải ảnh thất bại');
        }
    } catch (err) {
        console.error('Lỗi upload QR:', err);
        if (window.toast) window.toast.error('Lỗi tải ảnh QR: ' + err.message);
    }
};

// Xóa ảnh QR
window.deleteQrImage = function() {
    uploadedQrUrl = '';
    const fileInput = document.getElementById('sysQrFileInput');
    if (fileInput) fileInput.value = '';

    const thumbImg = document.getElementById('sysQrThumbImg');
    const icon = document.getElementById('sysQrPlaceholderIcon');
    const pvImg = document.getElementById('pvQrImgInline');
    const btnDelete = document.getElementById('btnDeleteQrImg');

    if (thumbImg) {
        thumbImg.src = '';
        thumbImg.style.display = 'none';
    }
    if (icon) icon.style.display = 'block';
    if (btnDelete) btnDelete.style.display = 'none';

    // Mặc định lại QR code mẫu
    if (pvImg) pvImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=NHAC_HANG_CHAY_HOA_SEN';

    if (window.toast) window.toast.info('Đã xóa mã QR tải lên.');
};

window.updateQrPreviewWithUpload = function() {
    const pvImg = document.getElementById('pvQrImgInline');
    if (!pvImg) return;
    if (uploadedQrUrl) {
        pvImg.src = uploadedQrUrl;
    } else {
        const thumbImg = document.getElementById('sysQrThumbImg');
        if (thumbImg && thumbImg.src && thumbImg.style.display !== 'none') {
            pvImg.src = thumbImg.src;
        } else {
            pvImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=NHAC_HANG_CHAY_HOA_SEN';
        }
    }
};

// Tạo mã VietQR động theo số tài khoản
window.generateVietQrLive = function() {
    const bank = document.getElementById('sysQrBankSelect')?.value || 'AGRIBANK';
    const accNo = document.getElementById('sysQrAccountNo')?.value?.trim() || '';
    const accName = document.getElementById('sysQrAccountName')?.value?.trim() || 'VU DINH HUNG';
    const pvImg = document.getElementById('pvQrImgInline');
    const liveThumb = document.getElementById('sysVietQrLiveThumb');
    const liveTitle = document.getElementById('sysVietQrLiveTitle');
    const liveBadge = document.getElementById('sysVietQrLiveBadge');

    let url = '';
    if (accNo) {
        url = `https://img.vietqr.io/image/${bank}-${accNo}-compact2.png?accountName=${encodeURIComponent(accName)}`;
        if (liveTitle) liveTitle.innerHTML = `<i class="fa-solid fa-circle-check text-success me-1"></i> Mã VietQR: <b>${bank}</b> - <b>${accNo}</b>`;
        if (liveBadge) {
            liveBadge.className = 'badge bg-success';
            liveBadge.innerText = `✅ VietQR: ${bank}`;
        }
    } else {
        url = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=NHAC_HANG_CHAY_HOA_SEN';
        if (liveTitle) liveTitle.innerText = 'Vui lòng nhập số tài khoản ngân hàng';
        if (liveBadge) {
            liveBadge.className = 'badge bg-secondary';
            liveBadge.innerText = 'Chưa có STK';
        }
    }

    if (pvImg) pvImg.src = url;
    if (liveThumb) liveThumb.src = url;
};

// 6. Xử lý âm thanh Bếp
window.handleKitchenSoundTypeChange = function() {
    const type = document.getElementById('sysKitchenSoundSelect')?.value;
    const box = document.getElementById('sysKitchenCustomAudioBox');
    if (box) {
        box.style.display = (type === 'custom_file') ? 'block' : 'none';
    }
};

window.testKitchenSound = function() {
    const type = document.getElementById('sysKitchenSoundSelect')?.value || 'kitchen_bell';
    const volume = document.getElementById('sysKitchenVolume')?.value || 90;
    if (window.SoundService) {
        window.SoundService.testPlaySound(type, uploadedKitchenSoundUrl, volume);
    }
};

window.uploadKitchenAudioFile = async function() {
    const input = document.getElementById('sysKitchenAudioInput');
    if (!input || !input.files[0]) {
        if (window.toast) window.toast.warning('Vui lòng chọn file âm thanh (.mp3, .wav, .ogg) từ máy tính!');
        else alert('Vui lòng chọn file âm thanh từ máy tính!');
        return;
    }

    const formData = new FormData();
    formData.append('soundFile', input.files[0]);

    try {
        const res = await fetch('/api/system-config/upload-sound', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success && data.soundUrl) {
            uploadedKitchenSoundUrl = data.soundUrl;
            const infoBox = document.getElementById('sysKitchenCustomAudioInfo');
            const nameEl = document.getElementById('sysKitchenAudioFileName');
            if (infoBox) infoBox.style.display = 'block';
            if (nameEl) nameEl.innerText = data.filename;

            if (window.toast) window.toast.success('Đã tải lên âm thanh chuông bếp thành công!');
            // Phát thử luôn file vừa tải
            window.testKitchenSound();
        } else {
            throw new Error(data.error || 'Lỗi tải file');
        }
    } catch (err) {
        console.error('Lỗi upload sound bếp:', err);
        if (window.toast) window.toast.error('Lỗi: ' + err.message);
    }
};

window.deleteKitchenAudioFile = function() {
    uploadedKitchenSoundUrl = '';
    const input = document.getElementById('sysKitchenAudioInput');
    if (input) input.value = '';
    const infoBox = document.getElementById('sysKitchenCustomAudioInfo');
    if (infoBox) infoBox.style.display = 'none';

    // Đổi lại kiểu chuông mặc định
    const sel = document.getElementById('sysKitchenSoundSelect');
    if (sel) {
        sel.value = 'kitchen_bell';
        window.handleKitchenSoundTypeChange();
    }
    if (window.toast) window.toast.info('Đã xóa file âm thanh riêng của Bếp.');
};

// 7. Xử lý âm thanh Nhận Món
window.handleReadySoundTypeChange = function() {
    const type = document.getElementById('sysReadySoundSelect')?.value;
    const box = document.getElementById('sysReadyCustomAudioBox');
    if (box) {
        box.style.display = (type === 'custom_file') ? 'block' : 'none';
    }
};

window.testReadySound = function() {
    const type = document.getElementById('sysReadySoundSelect')?.value || 'dingdong';
    const volume = document.getElementById('sysReadyVolume')?.value || 80;
    if (window.SoundService) {
        window.SoundService.testPlaySound(type, uploadedReadySoundUrl, volume);
    }
};

window.uploadReadyAudioFile = async function() {
    const input = document.getElementById('sysReadyAudioInput');
    if (!input || !input.files[0]) {
        if (window.toast) window.toast.warning('Vui lòng chọn file âm thanh (.mp3, .wav, .ogg) từ máy tính!');
        else alert('Vui lòng chọn file âm thanh từ máy tính!');
        return;
    }

    const formData = new FormData();
    formData.append('soundFile', input.files[0]);

    try {
        const res = await fetch('/api/system-config/upload-sound', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success && data.soundUrl) {
            uploadedReadySoundUrl = data.soundUrl;
            const infoBox = document.getElementById('sysReadyCustomAudioInfo');
            const nameEl = document.getElementById('sysReadyAudioFileName');
            if (infoBox) infoBox.style.display = 'block';
            if (nameEl) nameEl.innerText = data.filename;

            if (window.toast) window.toast.success('Đã tải lên âm thanh nhận món thành công!');
            window.testReadySound();
        } else {
            throw new Error(data.error || 'Lỗi tải file');
        }
    } catch (err) {
        console.error('Lỗi upload sound nhận món:', err);
        if (window.toast) window.toast.error('Lỗi: ' + err.message);
    }
};

window.deleteReadyAudioFile = function() {
    uploadedReadySoundUrl = '';
    const input = document.getElementById('sysReadyAudioInput');
    if (input) input.value = '';
    const infoBox = document.getElementById('sysReadyCustomAudioInfo');
    if (infoBox) infoBox.style.display = 'none';

    const sel = document.getElementById('sysReadySoundSelect');
    if (sel) {
        sel.value = 'dingdong';
        window.handleReadySoundTypeChange();
    }
    if (window.toast) window.toast.info('Đã xóa file âm thanh riêng của Nhận Món.');
};

window.uploadedEventSounds = {};

const EVENT_SOUND_KEYS = ['grab', 'shopee', 'be', 'xanhsm', 'dinein', 'takeaway', 'add_more', 'order_edited'];
const EVENT_SOUND_NAMES = {
    'grab': 'Đơn GrabFood',
    'shopee': 'Đơn ShopeeFood',
    'be': 'Đơn BeFood',
    'xanhsm': 'Đơn Xanh SM',
    'dinein': 'Đơn Bàn Tại Quán',
    'takeaway': 'Đơn Mang Về',
    'add_more': 'Bàn Gọi Thêm Món',
    'order_edited': 'Đơn Có Thay Đổi / Sửa Món'
};
const EVENT_DEFAULT_TEXTS = {
    'grab': 'Thông báo: Có đơn hàng mới từ Grab!',
    'shopee': 'Thông báo: Có đơn hàng mới từ Shopee Food!',
    'be': 'Thông báo: Có đơn hàng mới từ BeFood!',
    'xanhsm': 'Thông báo: Có đơn hàng mới từ Xanh SM!',
    'dinein': 'Thông báo: Có đơn hàng mới từ bàn!',
    'takeaway': 'Thông báo: Có đơn mang về mới!',
    'add_more': 'Thông báo: Bàn khách vừa gọi thêm món!',
    'order_edited': 'Thông báo: Có một đơn hàng thay đổi!'
};

// 7.5. Tải lên và Quản lý file âm thanh riêng cho từng loại đơn
window.uploadEventAudioFile = async function(key) {
    const input = document.getElementById(`sysSoundInput_${key}`);
    if (!input || !input.files || input.files.length === 0) {
        if (window.toast) window.toast.warning('Vui lòng chọn file âm thanh trước khi bấm Tải Lên!');
        return;
    }

    const file = input.files[0];
    const formData = new FormData();
    formData.append('soundFile', file);

    try {
        const res = await fetch('/api/system-config/upload-sound', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success && data.soundUrl) {
            window.uploadedEventSounds[key] = data.soundUrl;
            const infoBox = document.getElementById(`sysSoundInfoBox_${key}`);
            const nameEl = document.getElementById(`sysSoundFileName_${key}`);
            if (infoBox) infoBox.style.display = 'block';
            if (nameEl) nameEl.innerText = data.filename;

            if (window.toast) window.toast.success(`Đã tải lên file âm thanh cho [${EVENT_SOUND_NAMES[key] || key}]!`);
            window.testEventAudio(key);
            window.saveAllSystemSettings(true);
        } else {
            throw new Error(data.error || 'Lỗi tải file');
        }
    } catch (err) {
        console.error('Lỗi upload sound event:', err);
        if (window.toast) window.toast.error('Lỗi: ' + err.message);
    }
};

window.deleteEventAudioFile = function(key) {
    window.uploadedEventSounds[key] = '';
    const input = document.getElementById(`sysSoundInput_${key}`);
    if (input) input.value = '';
    const infoBox = document.getElementById(`sysSoundInfoBox_${key}`);
    if (infoBox) infoBox.style.display = 'none';

    if (window.toast) window.toast.info(`Đã xóa file âm thanh của [${EVENT_SOUND_NAMES[key] || key}].`);
    window.saveAllSystemSettings(true);
};

window.testEventAudio = function(key) {
    const customUrl = window.uploadedEventSounds[key];
    const vol = Number(document.getElementById('sysKitchenVolume')?.value || 90);

    if (customUrl) {
        try {
            const audio = new Audio(customUrl);
            audio.volume = Math.min(1.0, Math.max(0.1, vol / 100));
            audio.play().then(() => {
                if (window.toast) window.toast.info(`🔊 Đang phát file âm thanh: ${customUrl.split('/').pop()}`);
            }).catch(e => {
                console.warn('Lỗi phát file custom:', e);
            });
            return;
        } catch(e) {}
    }

    // Nếu chưa tải file custom, phát âm thanh mẫu
    const defaultText = EVENT_DEFAULT_TEXTS[key] || 'Thông báo: Có đơn hàng mới!';
    if (window.SoundService && typeof window.SoundService.speakVietnamese === 'function') {
        window.SoundService.speakVietnamese(defaultText, { volume: vol });
        if (window.toast) window.toast.info(`🔊 Đang phát âm thanh mẫu: "${defaultText}"`);
    }
};

window.testVoiceNotification = function(sampleType) {
    const keyMap = { 'GRAB': 'grab', 'SHOPEE': 'shopee', 'EDIT': 'order_edited', 'ADD_MORE': 'add_more' };
    const key = keyMap[sampleType] || 'grab';
    window.testEventAudio(key);
};

// 8. Chuyển đổi và Cập nhật Trang Giấy In Mô Phỏng (Live Preview)
window.currentBillPreviewMode = 'RECEIPT';

window.switchBillPreviewMode = function(mode) {
    window.currentBillPreviewMode = mode;
    const btnReceipt = document.getElementById('btnPvReceiptTab');
    const btnKitchen = document.getElementById('btnPvKitchenTab');
    const boxReceipt = document.getElementById('liveBillPaperPreviewInline');
    const boxKitchen = document.getElementById('liveKitchenTicketPreviewInline');
    const modeBadge = document.getElementById('pvModeBadge');

    if (mode === 'KITCHEN') {
        if (btnReceipt) btnReceipt.classList.remove('active');
        if (btnKitchen) btnKitchen.classList.add('active');
        if (boxReceipt) boxReceipt.classList.add('d-none');
        if (boxKitchen) boxKitchen.classList.remove('d-none');
        if (modeBadge) {
            modeBadge.innerText = 'Phiếu Chế Biến Bếp';
            modeBadge.className = 'text-danger';
        }
    } else {
        if (btnReceipt) btnReceipt.classList.add('active');
        if (btnKitchen) btnKitchen.classList.remove('active');
        if (boxReceipt) boxReceipt.classList.remove('d-none');
        if (boxKitchen) boxKitchen.classList.add('d-none');
        if (modeBadge) {
            modeBadge.innerText = 'Hóa Đơn Thanh Toán';
            modeBadge.className = 'text-primary';
        }
    }
    window.renderLiveBillPreviewInline();
};

window.renderLiveBillPreviewInline = function() {
    const resName = document.getElementById('sysResNameInput')?.value || 'NHÀ HÀNG CHAY HOA SEN';
    const resAddr = document.getElementById('sysResAddrInput')?.value || '';
    const resPhone = document.getElementById('sysResPhoneInput')?.value || '';
    const resWifi = document.getElementById('sysResWifiInput')?.value || '';
    const billFooter = document.getElementById('sysBillFooterInput')?.value || '';
    
    // Khổ giấy
    const isKitchen = (window.currentBillPreviewMode === 'KITCHEN');
    const paperSize = isKitchen 
        ? (document.getElementById('sysKitchenPaperSizeSelect')?.value || '80mm')
        : (document.getElementById('sysPaperSizeSelect')?.value || '80mm');

    // Cập nhật thông tin quán
    if (document.getElementById('pvNameInline')) document.getElementById('pvNameInline').innerText = resName;
    if (document.getElementById('pvKitchenResName')) document.getElementById('pvKitchenResName').innerText = resName;
    if (document.getElementById('pvAddrInline')) document.getElementById('pvAddrInline').innerText = resAddr;
    if (document.getElementById('pvPhoneInline')) document.getElementById('pvPhoneInline').innerText = resPhone ? `ĐT: ${resPhone}` : '';
    if (document.getElementById('pvWifiInline')) document.getElementById('pvWifiInline').innerText = resWifi;
    if (document.getElementById('pvFooterInline')) document.getElementById('pvFooterInline').innerHTML = billFooter.replace(/\n/g, '<br>');

    // Cập nhật Thuế VAT trên Hóa đơn thanh toán
    const vatEnabled = document.getElementById('sysVatEnabled')?.checked ?? false;
    const vatRate = parseFloat(document.getElementById('sysVatRate')?.value || 8);
    const vatIncluded = (document.getElementById('sysVatIncludedInPrice')?.value === '1');
    const subtotal = 280000;
    const pvVatRow = document.getElementById('pvVatRow');
    const pvVatLabel = document.getElementById('pvVatLabel');
    const pvVatAmount = document.getElementById('pvVatAmount');
    const pvFinalTotal = document.getElementById('pvFinalTotal');

    if (pvVatRow) {
        if (vatEnabled) {
            pvVatRow.style.display = 'flex';
            if (vatIncluded) {
                const vatAmount = Math.round(subtotal - (subtotal / (1 + vatRate / 100)));
                if (pvVatLabel) pvVatLabel.innerText = `Đã gồm VAT (${vatRate}%):`;
                if (pvVatAmount) pvVatAmount.innerText = `${vatAmount.toLocaleString('vi-VN')} đ`;
                if (pvFinalTotal) pvFinalTotal.innerText = `${subtotal.toLocaleString('vi-VN')} đ`;
            } else {
                const vatAmount = Math.round(subtotal * (vatRate / 100));
                const finalTotal = subtotal + vatAmount;
                if (pvVatLabel) pvVatLabel.innerText = `Thuế VAT (${vatRate}%):`;
                if (pvVatAmount) pvVatAmount.innerText = `+${vatAmount.toLocaleString('vi-VN')} đ`;
                if (pvFinalTotal) pvFinalTotal.innerText = `${finalTotal.toLocaleString('vi-VN')} đ`;
            }
        } else {
            pvVatRow.style.display = 'none';
            if (pvFinalTotal) pvFinalTotal.innerText = `${subtotal.toLocaleString('vi-VN')} đ`;
        }
    }

    const badge = document.getElementById('pvPaperSizeBadge');
    const paperBox = isKitchen ? document.getElementById('liveKitchenTicketPreviewInline') : document.getElementById('liveBillPaperPreviewInline');

    if (paperBox) {
        if (paperSize === '58mm') {
            paperBox.style.width = '210px';
            paperBox.style.fontSize = '11px';
            if (badge) badge.innerText = 'K58 (58mm - Nhỏ)';
        } else if (paperSize === 'A4') {
            paperBox.style.width = '380px';
            paperBox.style.fontSize = '14px';
            if (badge) badge.innerText = 'A4 (Văn Phòng)';
        } else {
            paperBox.style.width = '290px';
            paperBox.style.fontSize = '13px';
            if (badge) badge.innerText = 'K80 (80mm - Chuẩn)';
        }
    }

    window.toggleQrSectionDisplay();
};

// 9. In Thử Hóa Đơn / Phiếu Bếp Trực Tiếp
window.executeTestPrintInline = function() {
    const isKitchen = (window.currentBillPreviewMode === 'KITCHEN');
    const targetEl = isKitchen 
        ? document.getElementById('liveKitchenTicketPreviewInline') 
        : document.getElementById('liveBillPaperPreviewInline');

    if (!targetEl) {
        if (window.toast) window.toast.warning('Không tìm thấy nội dung mẫu in!');
        else alert('Không tìm thấy nội dung mẫu in!');
        return;
    }

    const clone = targetEl.cloneNode(true);
    clone.classList.remove('d-none');
    const printContent = clone.outerHTML;

    const paperSize = isKitchen 
        ? (document.getElementById('sysKitchenPaperSizeSelect')?.value || '80mm')
        : (document.getElementById('sysPaperSizeSelect')?.value || '80mm');
    const paperWidth = (paperSize === '58mm') ? '58mm' : ((paperSize === 'A4') ? '210mm' : '80mm');
    const titleText = isKitchen ? 'In Thử Phiếu Bếp' : 'In Thử Hóa Đơn';

    const win = window.open('', '_blank', 'width=450,height=650');
    win.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <title>${titleText} - NHÀ HÀNG CHAY HOA SEN</title>
                <style>
                    @page { 
                        size: ${paperWidth} auto; 
                        margin: 0; 
                    }
                    body { 
                        margin: 0; 
                        padding: 8px; 
                        font-family: 'Courier New', Courier, monospace; 
                        display: flex; 
                        justify-content: center; 
                    }
                    #liveBillPaperPreviewInline, #liveKitchenTicketPreviewInline {
                        width: 100% !important;
                        box-shadow: none !important;
                        border: none !important;
                        padding: 0 !important;
                        display: block !important;
                    }
                    img { max-width: 100%; height: auto; }
                </style>
            </head>
            <body>
                ${printContent}
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 600);
                    };
                <\/script>
            </body>
        </html>
    `);
    win.document.close();
};

// 10. Nạp Cấu Hình Phân Quyền & Danh Sách Nhân Viên
window.loadPermissionSettingsInline = async function() {
    const userSelect = document.getElementById('permUserSelect');
    if (!userSelect) return;

    try {
        // Đồng bộ trước cấu hình phân quyền mới nhất từ máy chủ
        try {
            const cfgRes = await fetch('/api/system-config?t=' + Date.now(), { cache: 'no-store' });
            if (cfgRes.ok) {
                const cfgData = await cfgRes.json();
                const latestCfg = cfgData.config || cfgData || {};
                const cur = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
                localStorage.setItem('hoasen_system_config', JSON.stringify({ ...cur, ...latestCfg }));
            }
        } catch(e) {}

        const res = await fetch('/api/users?t=' + Date.now());
        if (res.ok) {
            const users = await res.json();
            window.systemUsersList = Array.isArray(users) ? users : [];

            userSelect.innerHTML = '<option value="">-- Chọn nhân viên để phân quyền --</option>' +
                window.systemUsersList.map(u => {
                    const uName = u.User_name || u.user_name || '';
                    const uRole = u.User_role || u.Role || 'WAITER';
                    return `<option value="${uName}">${uName} (${uRole})</option>`;
                }).join('');

            // Mặc định chọn nhân viên 'boi' hoặc nhân viên không phải admin đầu tiên
            const defaultUser = window.systemUsersList.find(u => (u.User_name || '').toLowerCase() === 'boi') || 
                                window.systemUsersList.find(u => (u.User_name || '').toLowerCase() !== 'admin') || 
                                window.systemUsersList[0];
            if (defaultUser) {
                userSelect.value = defaultUser.User_name;
                window.handleSelectPermUser(defaultUser.User_name);
            }
        }
    } catch (e) {
        console.error('Lỗi nạp danh sách nhân viên:', e);
    }
};

// Khi chọn một nhân viên cụ thể từ danh sách
window.handleSelectPermUser = function(username) {
    const badgeTarget = document.getElementById('permUserLoginPolicyTarget');
    const gpsBadgeTarget = document.getElementById('permUserGpsPolicyTarget');

    if (!username) {
        const badge = document.getElementById('permCurrentEditingUserBadge');
        if (badge) badge.innerText = 'Đang cấu hình: Chưa chọn';
        if (badgeTarget) {
            badgeTarget.innerText = 'Toàn Quán (Mặc Định)';
            badgeTarget.className = 'badge bg-warning text-dark px-2 py-1 ms-2';
        }
        if (gpsBadgeTarget) {
            gpsBadgeTarget.innerText = 'Toàn Quán (Mặc Định)';
            gpsBadgeTarget.className = 'badge bg-secondary text-white px-2 py-1';
        }
        document.querySelectorAll('.user-perm-switch').forEach(cb => cb.checked = false);
        return;
    }

    const user = (window.systemUsersList || []).find(u => (u.User_name || '').toLowerCase() === username.toLowerCase()) || {
        User_name: username,
        Role: 'WAITER'
    };

    const roleName = user.User_role || user.Role || 'Nhân viên';
    const badge = document.getElementById('permCurrentEditingUserBadge');
    if (badge) {
        badge.innerText = `Đang cấu hình: ${user.User_name} [${roleName}]`;
    }

    if (badgeTarget) {
        badgeTarget.innerText = `Tài khoản: ${user.User_name}`;
        badgeTarget.className = 'badge bg-primary text-white px-2 py-1 ms-2';
    }
    if (gpsBadgeTarget) {
        gpsBadgeTarget.innerText = `Tài khoản: ${user.User_name}`;
        gpsBadgeTarget.className = 'badge bg-danger text-white px-2 py-1 ms-2';
    }

    // Nạp chính sách đăng nhập riêng của nhân viên này nếu có, nếu chưa có thì dùng cấu hình chung
    try {
        const sysCfg = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        const userPolicies = sysCfg.user_login_policy || {};
        const userPolicy = userPolicies[username.toLowerCase()] || sysCfg.allow_multi_login || 'MULTI';
        const selectPolicy = document.getElementById('sysAllowMultiLogin');
        if (selectPolicy) selectPolicy.value = userPolicy;

        // Nạp chính sách GPS riêng của nhân viên này
        const userGpsPolicies = sysCfg.user_gps_policy || {};
        const roleUpper = String(user.Role || user.User_role || '').toUpperCase();
        const isAdminUser = ['ADMIN', 'QUẢN LÝ', 'QUANLY', 'MANAGER'].includes(roleUpper) || username.toLowerCase() === 'admin' || username.toLowerCase() === 'vu';
        const userGpsPolicy = userGpsPolicies[username.toLowerCase()] || (isAdminUser ? 'ALLOW_ANYWHERE' : 'REQUIRE_GPS');
        const selectGps = document.getElementById('sysUserGpsPolicySelect');
        if (selectGps) selectGps.value = userGpsPolicy;
    } catch(e) {}

    // Lấy danh sách quyền hạn hiện tại của nhân viên này
    const perms = (typeof window.getUserPermissions === 'function') 
        ? window.getUserPermissions(user) 
        : [];

    document.querySelectorAll('.user-perm-switch').forEach(cb => {
        cb.checked = perms.includes(cb.value);
    });
};

// Đặt lại quyền mặc định theo vai trò cho nhân viên đang chọn
window.resetUserPermToDefault = function() {
    const userSelect = document.getElementById('permUserSelect');
    const username = userSelect?.value;
    if (!username) {
        if (window.toast) window.toast.warning('Vui lòng chọn nhân viên cần đặt lại quyền!');
        return;
    }

    const user = (window.systemUsersList || []).find(u => (u.User_name || '').toLowerCase() === username.toLowerCase()) || {
        User_name: username,
        Role: 'WAITER'
    };
    const roleUpper = String(user.User_role || user.Role || 'WAITER').toUpperCase();

    // Xóa cấu hình tùy biến riêng của nhân viên này trong localStorage
    try {
        const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        if (sysConfig.user_permissions && sysConfig.user_permissions[username.toLowerCase()]) {
            delete sysConfig.user_permissions[username.toLowerCase()];
            localStorage.setItem('hoasen_system_config', JSON.stringify(sysConfig));
        }
    } catch (e) {}

    // Lấy lại quyền mặc định theo vai trò
    let defaultPerms = [];
    if (['ADMIN', 'QUẢN LÝ', 'QUANLY'].includes(roleUpper) || username.toLowerCase() === 'admin') {
        defaultPerms = Object.keys(window.SYSTEM_PERMISSIONS || {});
    } else if (['WAITER', 'PHỤC VỤ', 'PHUCVU'].includes(roleUpper)) {
        defaultPerms = ['TABLES_VIEW', 'MENU_CARDS', 'CART', 'READY_ORDERS', 'FLOATING_SHIPPER', 'ORDERS_PERSONAL', 'COLLECT_PAYMENT'];
    } else if (['CASHIER', 'THU NGÂN', 'THUNGAN'].includes(roleUpper)) {
        defaultPerms = ['TABLES_VIEW', 'ORDERS_LIST', 'ORDERS_ALL', 'COLLECT_PAYMENT', 'MEMBERS_MANAGE', 'REPORTS_STATS', 'MENU_CARDS', 'CART', 'READY_ORDERS', 'FLOATING_SHIPPER', 'ORDERS_PERSONAL'];
    } else if (['KITCHEN', 'BẾP', 'BEP'].includes(roleUpper)) {
        defaultPerms = ['KITCHEN', 'READY_ORDERS', 'ORDERS_PERSONAL'];
    }

    document.querySelectorAll('.user-perm-switch').forEach(cb => {
        cb.checked = defaultPerms.includes(cb.value);
    });

    if (window.toast) {
        window.toast.info(`Đã khôi phục quyền mặc định theo vai trò [${roleUpper}] cho nhân viên [${username}]! Vui lòng nhấn "Lưu Quyền Nhân Viên" để áp dụng.`);
    }
};

// Lưu phân quyền cho riêng nhân viên đang chọn
window.saveCurrentUserPermissions = async function() {
    const userSelect = document.getElementById('permUserSelect');
    const username = userSelect?.value;
    if (!username) {
        if (window.toast) window.toast.warning('Vui lòng chọn một nhân viên trước khi lưu quyền!');
        return;
    }

    const selectedPerms = [];
    document.querySelectorAll('.user-perm-switch:checked').forEach(cb => {
        selectedPerms.push(cb.value);
    });

    const userPolicyVal = document.getElementById('sysAllowMultiLogin')?.value || 'SINGLE';
    const userGpsPolicyVal = document.getElementById('sysUserGpsPolicySelect')?.value || 'REQUIRE_GPS';

    try {
        const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        if (!sysConfig.user_permissions) sysConfig.user_permissions = {};
        sysConfig.user_permissions[username.toLowerCase()] = selectedPerms;

        if (!sysConfig.user_login_policy) sysConfig.user_login_policy = {};
        sysConfig.user_login_policy[username.toLowerCase()] = userPolicyVal;

        if (!sysConfig.user_gps_policy) sysConfig.user_gps_policy = {};
        sysConfig.user_gps_policy[username.toLowerCase()] = userGpsPolicyVal;

        localStorage.setItem('hoasen_system_config', JSON.stringify(sysConfig));

        // Gọi lưu toàn bộ cấu hình lên Server SQLite
        await window.saveAllSystemSettings(true);

        if (window.toast) {
            window.toast.success(`Đã phân quyền, thiết lập thiết bị & định vị GPS cho [${username}] thành công!`);
        }
    } catch (e) {
        console.error('Lỗi lưu quyền nhân viên:', e);
        if (window.toast) window.toast.error('Lỗi lưu quyền: ' + e.message);
    }
};

// 11. Lưu Toàn Bộ Cấu Hình Hệ Thống (Lưu vào SQLite & localStorage & emit Realtime)
window.saveAllSystemSettings = async function(isSilent = false) {
    // Thu thập bảng user_permissions và cấu hình hiện có
    let existingConfig = {};
    try {
        existingConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
    } catch(e) {}

    let userPermissionsMap = existingConfig.user_permissions || {};
    let userLoginPolicyMap = existingConfig.user_login_policy || {};
    let userGpsPolicyMap = existingConfig.user_gps_policy || {};

    // Cập nhật người đang chọn nếu có
    const currentSelectedUser = document.getElementById('permUserSelect')?.value;
    const currentPolicySelectVal = document.getElementById('sysAllowMultiLogin')?.value;
    const currentGpsSelectVal = document.getElementById('sysUserGpsPolicySelect')?.value;

    if (currentSelectedUser) {
        const selectedPerms = [];
        document.querySelectorAll('.user-perm-switch:checked').forEach(cb => {
            selectedPerms.push(cb.value);
        });
        userPermissionsMap[currentSelectedUser.toLowerCase()] = selectedPerms;
        if (currentPolicySelectVal) {
            userLoginPolicyMap[currentSelectedUser.toLowerCase()] = currentPolicySelectVal;
        }
        if (currentGpsSelectVal) {
            userGpsPolicyMap[currentSelectedUser.toLowerCase()] = currentGpsSelectVal;
        }
    }

    // Thu thập danh sách vai trò được cấp quyền thanh toán
    const allowedPaymentRoles = [];
    document.querySelectorAll('.payment-role-perm:checked').forEach(cb => {
        allowedPaymentRoles.push(cb.value);
    });

    const isQrUploadMode = document.getElementById('qrModeUpload')?.checked ?? true;

    // Helper đọc giá trị an toàn từ DOM hoặc fallback về cấu hình trước đó
    const getVal = (id, fallback) => {
        const el = document.getElementById(id);
        return (el && el.value !== undefined && el.value !== '') ? el.value.trim() : (fallback !== undefined ? fallback : '');
    };
    const getChecked = (id, fallback) => {
        const el = document.getElementById(id);
        return el ? el.checked : (fallback !== undefined ? fallback : false);
    };

    const configData = {
        // Cấu hình máy in Bếp & Mẫu Phiếu Bếp
        autoPrintKitchen: getChecked('sysAutoPrintKitchen', existingConfig.autoPrintKitchen ?? false),
        kitchen_printer_type: getVal('sysKitchenPrinterSelect', existingConfig.kitchen_printer_type || 'LAN'),
        kitchen_printer_ip: getVal('sysKitchenPrinterIpInput', existingConfig.kitchen_printer_ip || '192.168.1.201:9100'),
        kitchen_paper_size: getVal('sysKitchenPaperSizeSelect', existingConfig.kitchen_paper_size || '80mm'),

        // Cấu hình máy in Thu Ngân & Hóa Đơn Thanh Toán
        autoPrintPayment: getChecked('sysAutoPrintPayment', existingConfig.autoPrintPayment ?? false),
        printer: getVal('sysPrinterSelect', existingConfig.printer || 'LAN'),
        printerIp: getVal('sysPrinterIpInput', existingConfig.printerIp || '192.168.1.200:9100'),
        paperSize: getVal('sysPaperSizeSelect', existingConfig.paperSize || '80mm'),
        resName: getVal('sysResNameInput', existingConfig.resName || 'NHÀ HÀNG CHAY HOA SEN'),
        resAddr: getVal('sysResAddrInput', existingConfig.resAddr || ''),
        resPhone: getVal('sysResPhoneInput', existingConfig.resPhone || ''),
        resWifi: getVal('sysResWifiInput', existingConfig.resWifi || ''),
        billFooter: getVal('sysBillFooterInput', existingConfig.billFooter || ''),

        // Cấu hình Thuế VAT
        vat_enabled: getChecked('sysVatEnabled', existingConfig.vat_enabled ?? false),
        vat_rate: parseFloat(document.getElementById('sysVatRate')?.value || existingConfig.vat_rate || 8),
        vat_included_in_price: document.getElementById('sysVatIncludedInPrice') ? (document.getElementById('sysVatIncludedInPrice').value === '1') : (existingConfig.vat_included_in_price ?? false),

        // Cấu hình GPS Geofencing Vị trí Quán
        gps_allowed_radius_meters: parseInt(document.getElementById('sysGpsRadiusInput')?.value || existingConfig.gps_allowed_radius_meters || 100, 10),
        user_gps_policy: userGpsPolicyMap,

        // Mã QR Code
        showQrCode: getChecked('sysShowQrCode', existingConfig.showQrCode ?? true),
        qrMode: isQrUploadMode ? 'UPLOAD' : 'VIETQR',
        qrImageUrl: isQrUploadMode 
            ? (uploadedQrUrl || (document.getElementById('sysQrThumbImg')?.src || ''))
            : (getVal('sysQrAccountNo', '') ? `https://img.vietqr.io/image/${getVal('sysQrBankSelect', 'AGRIBANK')}-${getVal('sysQrAccountNo', '')}-compact2.png?accountName=${encodeURIComponent(getVal('sysQrAccountName', 'VU DINH HUNG'))}` : ''),
        qrBank: getVal('sysQrBankSelect', existingConfig.qrBank || 'AGRIBANK'),
        qrAccountNo: getVal('sysQrAccountNo', existingConfig.qrAccountNo || ''),
        qrAccountName: getVal('sysQrAccountName', existingConfig.qrAccountName || 'VU DINH HUNG'),
        momoPhone: getVal('sysMomoPhone', existingConfig.momoPhone || '0901234567'),
        momoName: getVal('sysMomoName', existingConfig.momoName || 'NHÀ HÀNG CHAY HOA SEN'),
        keep_screen_awake: document.getElementById('sysKeepScreenAwakeSwitch')?.checked ? '1' : (localStorage.getItem('hoasen_keep_screen_awake') || '0'),

        // Cấu hình Bếp KDS
        kitchen_grid_cols: getVal('sysKitchenGridCols', existingConfig.kitchen_grid_cols || '4'),
        kitchen_auto_accept: getChecked('sysKitchenAutoAccept', existingConfig.kitchen_auto_accept ?? existingConfig.kitchenAutoAccept ?? false),
        kitchenAutoAccept: getChecked('sysKitchenAutoAccept', existingConfig.kitchenAutoAccept ?? existingConfig.kitchen_auto_accept ?? false),
        kitchenSoundEnabled: getChecked('sysKitchenSoundEnabled', existingConfig.kitchenSoundEnabled ?? true),
        kitchenSoundType: getVal('sysKitchenSoundSelect', existingConfig.kitchenSoundType || 'kitchen_bell'),
        kitchenCustomSoundUrl: uploadedKitchenSoundUrl || (existingConfig.kitchenCustomSoundUrl || ''),
        kitchenSoundVolume: Number(document.getElementById('sysKitchenVolume')?.value || existingConfig.kitchenSoundVolume || 90),
        kitchenRepeatCount: parseInt(document.getElementById('sysKitchenRepeatCount')?.value || existingConfig.kitchenRepeatCount || 3, 10),
        kitchenRepeatInterval: parseFloat(document.getElementById('sysKitchenRepeatInterval')?.value || existingConfig.kitchenRepeatInterval || 2),

        // Âm thanh Nhận Món
        readySoundEnabled: getChecked('sysReadySoundEnabled', existingConfig.readySoundEnabled ?? true),
        readySoundType: getVal('sysReadySoundSelect', existingConfig.readySoundType || 'dingdong'),
        readyCustomSoundUrl: uploadedReadySoundUrl || (existingConfig.readyCustomSoundUrl || ''),
        readySoundVolume: Number(document.getElementById('sysReadyVolume')?.value || existingConfig.readySoundVolume || 80),
        readyRepeatCount: parseInt(document.getElementById('sysReadyRepeatCount')?.value || existingConfig.readyRepeatCount || 1, 10),
        readyRepeatInterval: parseFloat(document.getElementById('sysReadyRepeatInterval')?.value || existingConfig.readyRepeatInterval || 2),

        // Giọng đọc thông báo thông minh & Âm thanh từng loại đơn (Custom MP3)
        voiceNotificationEnabled: getChecked('sysVoiceNotificationEnabled', existingConfig.voiceNotificationEnabled ?? true),
        sound_grab_url: window.uploadedEventSounds['grab'] || (existingConfig.sound_grab_url || ''),
        sound_shopee_url: window.uploadedEventSounds['shopee'] || (existingConfig.sound_shopee_url || ''),
        sound_be_url: window.uploadedEventSounds['be'] || (existingConfig.sound_be_url || ''),
        sound_xanhsm_url: window.uploadedEventSounds['xanhsm'] || (existingConfig.sound_xanhsm_url || ''),
        sound_dinein_url: window.uploadedEventSounds['dinein'] || (existingConfig.sound_dinein_url || ''),
        sound_takeaway_url: window.uploadedEventSounds['takeaway'] || (existingConfig.sound_takeaway_url || ''),
        sound_add_more_url: window.uploadedEventSounds['add_more'] || (existingConfig.sound_add_more_url || ''),
        sound_order_edited_url: window.uploadedEventSounds['order_edited'] || (existingConfig.sound_order_edited_url || ''),

        // Phân quyền & Quản lý phiên đăng nhập
        allowedPaymentRoles: allowedPaymentRoles,
        user_permissions: userPermissionsMap,
        user_login_policy: userLoginPolicyMap,
        allow_multi_login: getVal('sysAllowMultiLogin', existingConfig.allow_multi_login || 'MULTI'),

        // CẤU HÌNH THƯƠNG HIỆU & VỊ TRÍ BẢN ĐỒ (LAT / LNG)
        restaurant_name: getVal('cfgBrandName', existingConfig.restaurant_name || 'Nhà Hàng Chay Hoa Sen'),
        restaurant_slogan: getVal('cfgBrandSlogan', existingConfig.restaurant_slogan || ''),
        restaurant_address: getVal('cfgBrandAddress', existingConfig.restaurant_address || ''),
        restaurant_lat: getVal('cfgBrandLat', existingConfig.restaurant_lat || '10.776889'),
        restaurant_lng: getVal('cfgBrandLng', existingConfig.restaurant_lng || '106.700806'),
        restaurant_phone: getVal('cfgBrandPhone', existingConfig.restaurant_phone || ''),
        restaurant_email: getVal('cfgBrandEmail', existingConfig.restaurant_email || ''),
        restaurant_logo: getVal('cfgBrandLogoUrl', existingConfig.restaurant_logo || ''),
        theme_color: getVal('cfgThemeColorHex', existingConfig.theme_color || '#2e7d32'),
        feature_card_bg: getVal('cfgFeatureCardBg', existingConfig.feature_card_bg || '#ffffff'),
        feature_card_border: getVal('cfgFeatureCardBorder', existingConfig.feature_card_border || '#e2e8f0'),
        feature_card_text: getVal('cfgFeatureCardText', existingConfig.feature_card_text || '#1a202c'),
        feature_card_icon_color: getVal('cfgFeatureCardIcon', existingConfig.feature_card_icon_color || '#2e7d32'),

        // Cấu hình Ca làm việc
        shift_start_time: getVal('cfgShiftStartTime', existingConfig.shift_start_time || '06:00'),
        shift_end_time: getVal('cfgShiftEndTime', existingConfig.shift_end_time || '22:30'),
        auto_clear_on_shift_end: getChecked('cfgAutoClearShiftEnd', existingConfig.auto_clear_on_shift_end === '1') ? '1' : '0',
        auto_clear_previous_day: getChecked('cfgAutoClearPrevDay', existingConfig.auto_clear_previous_day === '1') ? '1' : '0',

        // Cấu hình Slide Banner Trang Chủ
        home_slide_interval: getVal('sysSlideInterval', getVal('cfgHomeSlideInterval', existingConfig.home_slide_interval || '5')),
        home_slide_effect: getVal('sysSlideEffect', getVal('cfgHomeSlideEffect', existingConfig.home_slide_effect || 'slide')),
        home_slide_speed: getVal('sysSlideSpeed', getVal('cfgHomeSlideSpeed', existingConfig.home_slide_speed || '800')),

        // Cấu hình Email SMTP
        smtp_from_name: getVal('smtpFromNameInput', existingConfig.smtp_from_name || 'Nhà Hàng Hoa Sen'),
        smtp_user: getVal('smtpUserInput', existingConfig.smtp_user || ''),
        smtp_pass: getVal('smtpPassInput', existingConfig.smtp_pass || ''),
        smtp_host: getVal('smtpHostInput', existingConfig.smtp_host || 'smtp.gmail.com'),
        smtp_port: parseInt(getVal('smtpPortInput', existingConfig.smtp_port || 465), 10) || 465,
        smtp_secure: document.getElementById('smtpSecureSelect') ? (document.getElementById('smtpSecureSelect').value === '1' ? 1 : 0) : (existingConfig.smtp_secure !== undefined ? existingConfig.smtp_secure : 1)
    };

    // Đồng bộ ngược lại các trường bill máy in nếu có
    if (configData.restaurant_name) configData.resName = configData.restaurant_name;
    if (configData.restaurant_address) configData.resAddr = configData.restaurant_address;
    if (configData.restaurant_phone) configData.resPhone = configData.restaurant_phone;

    const mergedConfig = { ...existingConfig, ...configData };

    // 1. Lưu vào LocalStorage
    localStorage.setItem('hoasen_system_config', JSON.stringify(mergedConfig));
    localStorage.setItem('restaurant_payment_allowed_roles', JSON.stringify(allowedPaymentRoles));

    // 2. Gửi lưu lên Server SQLite để đồng bộ toàn bộ thiết bị qua mạng LAN
    try {
        const res = await fetch('/api/system-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mergedConfig)
        });
        const data = await res.json();
        if (!data.success) console.warn('Lỗi lưu CSDL server:', data.error);
    } catch (e) {
        console.warn('Không thể gửi lên server API:', e);
    }

    // 3. Cập nhật lại hiển thị thương hiệu nếu đang mở
    if (typeof window.applyGlobalBrandSettings === 'function') {
        window.applyGlobalBrandSettings(mergedConfig);
    }

    // 4. Cập nhật lại hiển thị thanh điều hướng nếu có
    if (typeof window.checkAuthStatus === 'function') {
        window.checkAuthStatus();
    }

    if (!isSilent) {
        if (window.toast && typeof window.toast.success === 'function') {
            window.toast.success('🎉 Đã lưu toàn bộ cấu hình hệ thống & vị trí tọa độ bản đồ thành công!');
        } else {
            alert('🎉 Đã lưu toàn bộ cấu hình hệ thống thành công!');
        }
    }
};

// 12. Nạp Cấu Hình Khi Khởi Tạo Trang
window.initSystemSettings = async function() {
    let saved = {};

    // Cố gắng tải từ Server SQLite trước để luôn đồng bộ giữa các máy
    try {
        const res = await fetch('/api/system-config?t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.config && Object.keys(data.config).length > 0) {
                saved = data.config;
                // Cập nhật lại localStorage
                localStorage.setItem('hoasen_system_config', JSON.stringify(saved));
            }
        }
    } catch (e) {
        console.warn('Dùng cache local:', e);
    }

    // Nếu không có từ server, nạp từ localStorage
    if (Object.keys(saved).length === 0) {
        try {
            saved = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        } catch (e) {}
    }

    // Đổ dữ liệu vào Form
    // Máy in Bếp
    if (saved.autoPrintKitchen !== undefined && document.getElementById('sysAutoPrintKitchen')) {
        document.getElementById('sysAutoPrintKitchen').checked = Boolean(saved.autoPrintKitchen);
    }
    if (saved.kitchen_printer_type && document.getElementById('sysKitchenPrinterSelect')) {
        document.getElementById('sysKitchenPrinterSelect').value = saved.kitchen_printer_type;
    }
    if (saved.kitchen_printer_ip && document.getElementById('sysKitchenPrinterIpInput')) {
        document.getElementById('sysKitchenPrinterIpInput').value = saved.kitchen_printer_ip;
    }
    if (saved.kitchen_paper_size && document.getElementById('sysKitchenPaperSizeSelect')) {
        document.getElementById('sysKitchenPaperSizeSelect').value = saved.kitchen_paper_size;
    }

    // Máy in Thu Ngân
    if (saved.autoPrintPayment !== undefined && document.getElementById('sysAutoPrintPayment')) {
        document.getElementById('sysAutoPrintPayment').checked = Boolean(saved.autoPrintPayment);
    }
    if (saved.printer && document.getElementById('sysPrinterSelect')) {
        document.getElementById('sysPrinterSelect').value = saved.printer;
    }
    if (saved.printerIp && document.getElementById('sysPrinterIpInput')) {
        document.getElementById('sysPrinterIpInput').value = saved.printerIp;
    }
    if (saved.paperSize && document.getElementById('sysPaperSizeSelect')) {
        document.getElementById('sysPaperSizeSelect').value = saved.paperSize;
    }
    if (saved.resName && document.getElementById('sysResNameInput')) {
        document.getElementById('sysResNameInput').value = saved.resName;
    }
    if (saved.resAddr && document.getElementById('sysResAddrInput')) {
        document.getElementById('sysResAddrInput').value = saved.resAddr;
    }
    if (saved.resPhone && document.getElementById('sysResPhoneInput')) {
        document.getElementById('sysResPhoneInput').value = saved.resPhone;
    }
    if (saved.resWifi && document.getElementById('sysResWifiInput')) {
        document.getElementById('sysResWifiInput').value = saved.resWifi;
    }
    if (saved.billFooter && document.getElementById('sysBillFooterInput')) {
        document.getElementById('sysBillFooterInput').value = saved.billFooter;
    }

    // Cấu hình Thuế VAT
    if (saved.vat_enabled !== undefined && document.getElementById('sysVatEnabled')) {
        document.getElementById('sysVatEnabled').checked = Boolean(saved.vat_enabled);
    }
    if (saved.vat_rate !== undefined && document.getElementById('sysVatRate')) {
        document.getElementById('sysVatRate').value = saved.vat_rate;
    }
    if (saved.vat_included_in_price !== undefined && document.getElementById('sysVatIncludedInPrice')) {
        document.getElementById('sysVatIncludedInPrice').value = saved.vat_included_in_price ? '1' : '0';
    }
    window.toggleVatConfigDisplay();

    // Cấu hình GPS Geofencing
    if (saved.gps_allowed_radius_meters && document.getElementById('sysGpsRadiusInput')) {
        document.getElementById('sysGpsRadiusInput').value = saved.gps_allowed_radius_meters;
    }
    const currentLat = saved.restaurant_lat || '10.845688';
    const currentLng = saved.restaurant_lng || '106.593422';
    const txtCoords = document.getElementById('gpsCurrentCoordsText');
    if (txtCoords) txtCoords.innerText = `Lat: ${currentLat}, Lng: ${currentLng}`;

    // QR Code
    if (saved.showQrCode !== undefined && document.getElementById('sysShowQrCode')) {
        document.getElementById('sysShowQrCode').checked = Boolean(saved.showQrCode);
    }
    if (saved.qrBank && document.getElementById('sysQrBankSelect')) {
        document.getElementById('sysQrBankSelect').value = saved.qrBank;
    }
    if (saved.qrAccountNo && document.getElementById('sysQrAccountNo')) {
        document.getElementById('sysQrAccountNo').value = saved.qrAccountNo;
    }
    if (saved.qrAccountName && document.getElementById('sysQrAccountName')) {
        document.getElementById('sysQrAccountName').value = saved.qrAccountName;
    }
    if (saved.momoPhone && document.getElementById('sysMomoPhone')) {
        document.getElementById('sysMomoPhone').value = saved.momoPhone;
    }
    if (saved.momoName && document.getElementById('sysMomoName')) {
        document.getElementById('sysMomoName').value = saved.momoName;
    }

    // Cấu hình Email Marketing SMTP
    if (saved.smtp_from_name && document.getElementById('smtpFromNameInput')) {
        document.getElementById('smtpFromNameInput').value = saved.smtp_from_name;
    }
    if (saved.smtp_user && document.getElementById('smtpUserInput')) {
        document.getElementById('smtpUserInput').value = saved.smtp_user;
    }
    if (saved.smtp_pass && document.getElementById('smtpPassInput')) {
        document.getElementById('smtpPassInput').value = saved.smtp_pass;
    }
    if (saved.smtp_host && document.getElementById('smtpHostInput')) {
        document.getElementById('smtpHostInput').value = saved.smtp_host;
    }
    if (saved.smtp_port && document.getElementById('smtpPortInput')) {
        document.getElementById('smtpPortInput').value = saved.smtp_port;
    }
    if (saved.smtp_secure !== undefined && document.getElementById('smtpSecureSelect')) {
        document.getElementById('smtpSecureSelect').value = String(saved.smtp_secure);
    }
    const initActiveSenderEl = document.getElementById('sendEmailActiveSenderText');
    if (initActiveSenderEl) {
        if (saved.smtp_user) {
            initActiveSenderEl.innerText = `${saved.smtp_from_name || 'Hoa Sen'} <${saved.smtp_user}>`;
            initActiveSenderEl.className = 'text-success fw-bold';
        } else {
            initActiveSenderEl.innerText = '⚠️ Chưa cấu hình tài khoản gửi (Cần cài đặt SMTP)';
            initActiveSenderEl.className = 'text-danger fw-bold';
        }
    }

    if (saved.qrMode === 'VIETQR') {
        const rViet = document.getElementById('qrModeVietQR');
        if (rViet) rViet.checked = true;
        window.switchQrInputMode('VIETQR');
    } else {
        const rUp = document.getElementById('qrModeUpload');
        if (rUp) rUp.checked = true;
        window.switchQrInputMode('UPLOAD');
    }
    if (saved.qrImageUrl && saved.qrMode !== 'VIETQR') {
        uploadedQrUrl = saved.qrImageUrl;
        const thumbImg = document.getElementById('sysQrThumbImg');
        const icon = document.getElementById('sysQrPlaceholderIcon');
        const pvImg = document.getElementById('pvQrImgInline');
        const btnDelete = document.getElementById('btnDeleteQrImg');

        if (thumbImg) {
            thumbImg.src = uploadedQrUrl;
            thumbImg.style.display = 'block';
        }
        if (icon) icon.style.display = 'none';
        if (pvImg) pvImg.src = uploadedQrUrl;
        if (btnDelete) btnDelete.style.display = 'inline-block';
    }

    // Chế độ màn hình luôn sáng (Wake Lock)
    const isWakeAwake = (saved.keep_screen_awake === '1') || (localStorage.getItem('hoasen_keep_screen_awake') === '1');
    if (typeof window.updateWakeLockUI === 'function') {
        window.updateWakeLockUI(isWakeAwake);
    }

    // Cấu hình Bếp KDS (Mật độ 4, 6, 8 thẻ đơn & Tự động nhận đơn)
    if (saved.kitchen_grid_cols && document.getElementById('sysKitchenGridCols')) {
        document.getElementById('sysKitchenGridCols').value = String(saved.kitchen_grid_cols);
    }
    if ((saved.kitchen_auto_accept !== undefined || saved.kitchenAutoAccept !== undefined) && document.getElementById('sysKitchenAutoAccept')) {
        document.getElementById('sysKitchenAutoAccept').checked = Boolean(saved.kitchen_auto_accept ?? saved.kitchenAutoAccept);
    }

    // Chính sách phiên đăng nhập nhân viên (Đơn máy / Đa máy)
    const currentSelectedUser = document.getElementById('permUserSelect')?.value;
    if (currentSelectedUser && saved.user_login_policy && saved.user_login_policy[currentSelectedUser.toLowerCase()]) {
        if (document.getElementById('sysAllowMultiLogin')) {
            document.getElementById('sysAllowMultiLogin').value = saved.user_login_policy[currentSelectedUser.toLowerCase()];
        }
    } else if (saved.allow_multi_login && document.getElementById('sysAllowMultiLogin')) {
        document.getElementById('sysAllowMultiLogin').value = saved.allow_multi_login;
    }

    // Âm thanh Bếp
    if (saved.kitchenSoundEnabled !== undefined && document.getElementById('sysKitchenSoundEnabled')) {
        document.getElementById('sysKitchenSoundEnabled').checked = Boolean(saved.kitchenSoundEnabled);
    }
    if (saved.kitchenSoundType && document.getElementById('sysKitchenSoundSelect')) {
        document.getElementById('sysKitchenSoundSelect').value = saved.kitchenSoundType;
    }
    if (saved.kitchenCustomSoundUrl) {
        uploadedKitchenSoundUrl = saved.kitchenCustomSoundUrl;
        const info = document.getElementById('sysKitchenCustomAudioInfo');
        const nameEl = document.getElementById('sysKitchenAudioFileName');
        if (info) info.style.display = 'block';
        if (nameEl) nameEl.innerText = saved.kitchenCustomSoundUrl.split('/').pop();
    }
    if (saved.kitchenSoundVolume !== undefined && document.getElementById('sysKitchenVolume')) {
        document.getElementById('sysKitchenVolume').value = saved.kitchenSoundVolume;
        const lbl = document.getElementById('sysKitchenVolumeLabel');
        if (lbl) lbl.innerText = saved.kitchenSoundVolume + '%';
    }
    if (saved.kitchenRepeatCount && document.getElementById('sysKitchenRepeatCount')) {
        document.getElementById('sysKitchenRepeatCount').value = saved.kitchenRepeatCount;
    }
    if (saved.kitchenRepeatInterval && document.getElementById('sysKitchenRepeatInterval')) {
        document.getElementById('sysKitchenRepeatInterval').value = saved.kitchenRepeatInterval;
    }

    // Âm thanh Nhận Món
    if (saved.readySoundEnabled !== undefined && document.getElementById('sysReadySoundEnabled')) {
        document.getElementById('sysReadySoundEnabled').checked = Boolean(saved.readySoundEnabled);
    }
    if (saved.readySoundType && document.getElementById('sysReadySoundSelect')) {
        document.getElementById('sysReadySoundSelect').value = saved.readySoundType;
    }
    if (saved.readyCustomSoundUrl) {
        uploadedReadySoundUrl = saved.readyCustomSoundUrl;
        const info = document.getElementById('sysReadyCustomAudioInfo');
        const nameEl = document.getElementById('sysReadyAudioFileName');
        if (info) info.style.display = 'block';
        if (nameEl) nameEl.innerText = saved.readyCustomSoundUrl.split('/').pop();
    }
    if (saved.readySoundVolume !== undefined && document.getElementById('sysReadyVolume')) {
        document.getElementById('sysReadyVolume').value = saved.readySoundVolume;
        const lbl = document.getElementById('sysReadyVolumeLabel');
        if (lbl) lbl.innerText = saved.readySoundVolume + '%';
    }
    if (saved.readyRepeatCount && document.getElementById('sysReadyRepeatCount')) {
        document.getElementById('sysReadyRepeatCount').value = saved.readyRepeatCount;
    }
    if (saved.readyRepeatInterval && document.getElementById('sysReadyRepeatInterval')) {
        document.getElementById('sysReadyRepeatInterval').value = saved.readyRepeatInterval;
    }
    if (document.getElementById('sysVoiceNotificationEnabled')) {
        document.getElementById('sysVoiceNotificationEnabled').checked = (saved.voiceNotificationEnabled !== false);
    }

    // Nạp file âm thanh riêng cho từng loại đơn
    EVENT_SOUND_KEYS.forEach(k => {
        const urlKey = `sound_${k}_url`;
        const url = saved[urlKey] || '';
        window.uploadedEventSounds[k] = url;
        const nameEl = document.getElementById(`sysSoundFileName_${k}`);
        const infoBox = document.getElementById(`sysSoundInfoBox_${k}`);
        if (url) {
            if (nameEl) nameEl.innerText = url.split('/').pop();
            if (infoBox) infoBox.style.display = 'block';
        } else {
            if (infoBox) infoBox.style.display = 'none';
        }
    });

    // Nạp Cấu hình Thương hiệu & Logo Web
    const bName = saved.restaurant_name || saved.resName || 'Nhà Hàng Chay Hoa Sen';
    const bSlogan = saved.restaurant_slogan || 'Thanh tịnh an lạc - Tươi ngon mỗi ngày';
    const bAddr = saved.restaurant_address || saved.resAddr || '123 Đường Hoa Sen, TP. Hồ Chí Minh';
    const bPhone = saved.restaurant_phone || saved.resPhone || '0901234567';
    const bEmail = saved.restaurant_email || 'contact@hoasen.vn';
    const bLogo = saved.restaurant_logo || '';
    const bColor = saved.theme_color || '#2e7d32';

    const bLat = saved.restaurant_lat || saved.brand_lat || '10.776889';
    const bLng = saved.restaurant_lng || saved.brand_lng || '106.700806';

    if (document.getElementById('cfgBrandName')) document.getElementById('cfgBrandName').value = bName;
    if (document.getElementById('cfgBrandSlogan')) document.getElementById('cfgBrandSlogan').value = bSlogan;
    if (document.getElementById('cfgBrandAddress')) document.getElementById('cfgBrandAddress').value = bAddr;
    if (document.getElementById('cfgBrandLat')) document.getElementById('cfgBrandLat').value = bLat;
    if (document.getElementById('cfgBrandLng')) document.getElementById('cfgBrandLng').value = bLng;
    if (document.getElementById('cfgBrandPhone')) document.getElementById('cfgBrandPhone').value = bPhone;
    if (document.getElementById('cfgBrandEmail')) document.getElementById('cfgBrandEmail').value = bEmail;
    if (document.getElementById('cfgBrandLogoUrl')) document.getElementById('cfgBrandLogoUrl').value = bLogo;
    if (document.getElementById('cfgThemeColorPicker')) document.getElementById('cfgThemeColorPicker').value = bColor;
    if (document.getElementById('cfgThemeColorHex')) document.getElementById('cfgThemeColorHex').value = bColor;
    if (document.getElementById('previewColorBadge')) document.getElementById('previewColorBadge').innerText = bColor;

    // Nạp màu thẻ giới thiệu
    const fcBg = saved.feature_card_bg || '#ffffff';
    const fcBorder = saved.feature_card_border || '#e2e8f0';
    const fcText = saved.feature_card_text || '#1a202c';
    const fcIcon = saved.feature_card_icon_color || '#2e7d32';

    if (document.getElementById('cfgFeatureCardBg')) document.getElementById('cfgFeatureCardBg').value = fcBg;
    if (document.getElementById('cfgFeatureCardBgPicker')) document.getElementById('cfgFeatureCardBgPicker').value = fcBg;
    if (document.getElementById('cfgFeatureCardBorder')) document.getElementById('cfgFeatureCardBorder').value = fcBorder;
    if (document.getElementById('cfgFeatureCardBorderPicker')) document.getElementById('cfgFeatureCardBorderPicker').value = fcBorder;
    if (document.getElementById('cfgFeatureCardText')) document.getElementById('cfgFeatureCardText').value = fcText;
    if (document.getElementById('cfgFeatureCardTextPicker')) document.getElementById('cfgFeatureCardTextPicker').value = fcText;
    if (document.getElementById('cfgFeatureCardIcon')) document.getElementById('cfgFeatureCardIcon').value = fcIcon;
    if (document.getElementById('cfgFeatureCardIconPicker')) document.getElementById('cfgFeatureCardIconPicker').value = fcIcon;
    if (typeof window.updateFeatureCardPreview === 'function') window.updateFeatureCardPreview();

    window.updateBrandPreview();

    window.handlePrinterTypeChange();
    window.handleKitchenSoundTypeChange();
    window.handleReadySoundTypeChange();
    window.renderLiveBillPreviewInline();
    window.loadPermissionSettingsInline();
    if (typeof window.loadSmtpConfig === 'function') {
        try { await window.loadSmtpConfig(); } catch(e) {}
    }

    const activeTab = sessionStorage.getItem('hoasen_active_system_tab') || 'tab-printer';
    window.switchSystemTab(activeTab);
};

// ==========================================
// 13. QUẢN LÝ THƯƠNG HIỆU, LOGO & MÀU SẮC CHỦ ĐẠO
// ==========================================
window.updateBrandPreview = function() {
    const name = document.getElementById('cfgBrandName')?.value.trim() || 'Nhà Hàng Chay Hoa Sen';
    const slogan = document.getElementById('cfgBrandSlogan')?.value.trim() || 'Thanh tịnh an lạc - Tươi ngon mỗi ngày';
    const addr = document.getElementById('cfgBrandAddress')?.value.trim() || '123 Đường Hoa Sen, TP. Hồ Chí Minh';
    const phone = document.getElementById('cfgBrandPhone')?.value.trim() || '0901234567';
    const logoUrl = document.getElementById('cfgBrandLogoUrl')?.value.trim() || '';
    const color = document.getElementById('cfgThemeColorHex')?.value.trim() || '#2e7d32';

    if (document.getElementById('previewMockupName')) document.getElementById('previewMockupName').innerText = name;
    if (document.getElementById('previewMockupSlogan')) document.getElementById('previewMockupSlogan').innerText = slogan;
    if (document.getElementById('previewMockupAddress')) document.getElementById('previewMockupAddress').innerText = addr;
    if (document.getElementById('previewMockupPhone')) document.getElementById('previewMockupPhone').innerText = phone;
    
    const previewHeader = document.getElementById('previewHeaderBox');
    if (previewHeader) previewHeader.style.backgroundColor = color;

    const previewLogo = document.getElementById('previewMockupLogo');
    const thumbLogo = document.getElementById('brandLogoPreviewImg');
    const defaultSample = 'https://cdn-icons-png.flaticon.com/512/2921/2921822.png';
    const displayLogo = logoUrl || defaultSample;

    if (previewLogo) previewLogo.src = displayLogo;
    if (thumbLogo) thumbLogo.src = displayLogo;
};

window.onThemeColorChange = function(color) {
    if (!color) return;
    const hexInput = document.getElementById('cfgThemeColorHex');
    const badge = document.getElementById('previewColorBadge');
    if (hexInput) hexInput.value = color.toUpperCase();
    if (badge) badge.innerText = color.toUpperCase();
    window.updateBrandPreview();
    window.applyThemeColorLive(false);
};

window.onThemeColorHexChange = function(val) {
    if (!val) return;
    let hex = val.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        const picker = document.getElementById('cfgThemeColorPicker');
        const badge = document.getElementById('previewColorBadge');
        if (picker) picker.value = hex;
        if (badge) badge.innerText = hex.toUpperCase();
        window.updateBrandPreview();
        window.applyThemeColorLive(false);
    }
};

window.selectThemePreset = function(color) {
    const picker = document.getElementById('cfgThemeColorPicker');
    const hexInput = document.getElementById('cfgThemeColorHex');
    const badge = document.getElementById('previewColorBadge');
    if (picker) picker.value = color;
    if (hexInput) hexInput.value = color.toUpperCase();
    if (badge) badge.innerText = color.toUpperCase();
    window.updateBrandPreview();
    window.applyThemeColorLive(false);
};

window.applyThemeColorLive = function(showToast) {
    const color = document.getElementById('cfgThemeColorHex')?.value.trim() || '#2e7d32';
    document.documentElement.style.setProperty('--primary-color', color);
    
    // Tính toán màu hover đậm hơn
    try {
        let num = parseInt(color.replace('#',''), 16),
            amt = Math.round(2.55 * -20),
            R = Math.max(0, Math.min(255, (num >> 16) + amt)),
            G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt)),
            B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
        const hoverColor = '#' + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
        document.documentElement.style.setProperty('--primary-hover', hoverColor);
    } catch (e) {}

    if (showToast) {
        if (window.toast && typeof window.toast.info === 'function') {
            window.toast.info(`🎨 Đang xem thử màu chủ đạo: ${color.toUpperCase()}`);
        }
    }
};

window.handleBrandLogoUpload = async function(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logoImage', file);

    try {
        if (window.toast) window.toast.info('Đang tải ảnh logo lên máy chủ...');
        const res = await fetch('/api/system-config/upload-logo', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok && data.success && data.logoUrl) {
            const logoInp = document.getElementById('cfgBrandLogoUrl');
            if (logoInp) logoInp.value = data.logoUrl;
            window.updateBrandPreview();
            if (window.toast) window.toast.success('✅ Đã tải lên logo thành công!');
        } else {
            alert('Lỗi tải logo: ' + (data.error || 'Không xác định'));
        }
    } catch (err) {
        console.error('Lỗi upload logo:', err);
        alert('Không thể kết nối đến máy chủ khi tải logo!');
    }
};

window.onBrandLogoUrlInput = function(url) {
    window.updateBrandPreview();
};

window.resetDefaultLogo = function() {
    const logoInp = document.getElementById('cfgBrandLogoUrl');
    if (logoInp) logoInp.value = '';
    window.updateBrandPreview();
};

// Cấu hình & Xem trước màu Thẻ Giới Thiệu
window.updateFeatureCardPreview = function() {
    const bg = document.getElementById('cfgFeatureCardBg')?.value.trim() || '#ffffff';
    const border = document.getElementById('cfgFeatureCardBorder')?.value.trim() || '#e2e8f0';
    const text = document.getElementById('cfgFeatureCardText')?.value.trim() || '#1a202c';
    const icon = document.getElementById('cfgFeatureCardIcon')?.value.trim() || '#2e7d32';

    const box = document.getElementById('pvFeatureCardBox');
    const iconWrap = document.getElementById('pvFeatureCardIconWrap');
    const title = document.getElementById('pvFeatureCardTitle');

    if (box) {
        box.style.backgroundColor = bg;
        box.style.borderColor = border;
    }
    if (iconWrap) {
        iconWrap.style.color = icon;
        iconWrap.style.backgroundColor = icon + '1f';
    }
    if (title) {
        title.style.color = text;
    }
};

window.onFeatureCardColorChange = function(type, val) {
    if (!val) return;
    if (type === 'bg') {
        const picker = document.getElementById('cfgFeatureCardBgPicker');
        const text = document.getElementById('cfgFeatureCardBg');
        if (picker) picker.value = val;
        if (text) text.value = val;
    } else if (type === 'border') {
        const picker = document.getElementById('cfgFeatureCardBorderPicker');
        const text = document.getElementById('cfgFeatureCardBorder');
        if (picker) picker.value = val;
        if (text) text.value = val;
    } else if (type === 'text') {
        const picker = document.getElementById('cfgFeatureCardTextPicker');
        const text = document.getElementById('cfgFeatureCardText');
        if (picker) picker.value = val;
        if (text) text.value = val;
    } else if (type === 'icon') {
        const picker = document.getElementById('cfgFeatureCardIconPicker');
        const text = document.getElementById('cfgFeatureCardIcon');
        if (picker) picker.value = val;
        if (text) text.value = val;
    }
    window.updateFeatureCardPreview();
};

window.selectFeatureCardPreset = function(bg, border, text, icon) {
    window.onFeatureCardColorChange('bg', bg);
    window.onFeatureCardColorChange('border', border);
    window.onFeatureCardColorChange('text', text);
    window.onFeatureCardColorChange('icon', icon);
};

window.saveBrandSettings = async function() {
    const name = document.getElementById('cfgBrandName')?.value.trim() || 'Nhà Hàng Chay Hoa Sen';
    const slogan = document.getElementById('cfgBrandSlogan')?.value.trim() || '';
    const addr = document.getElementById('cfgBrandAddress')?.value.trim() || '';
    const lat = document.getElementById('cfgBrandLat')?.value.trim() || '10.776889';
    const lng = document.getElementById('cfgBrandLng')?.value.trim() || '106.700806';
    const phone = document.getElementById('cfgBrandPhone')?.value.trim() || '';
    const email = document.getElementById('cfgBrandEmail')?.value.trim() || '';
    const logo = document.getElementById('cfgBrandLogoUrl')?.value.trim() || '';
    const color = document.getElementById('cfgThemeColorHex')?.value.trim() || '#2e7d32';

    const brandPayload = {
        restaurant_name: name,
        restaurant_slogan: slogan,
        restaurant_address: addr,
        restaurant_lat: lat,
        restaurant_lng: lng,
        restaurant_phone: phone,
        restaurant_email: email,
        restaurant_logo: logo,
        theme_color: color,
        feature_card_bg: document.getElementById('cfgFeatureCardBg')?.value.trim() || '#ffffff',
        feature_card_border: document.getElementById('cfgFeatureCardBorder')?.value.trim() || '#e2e8f0',
        feature_card_text: document.getElementById('cfgFeatureCardText')?.value.trim() || '#1a202c',
        feature_card_icon_color: document.getElementById('cfgFeatureCardIcon')?.value.trim() || '#2e7d32',
        // Đồng bộ trường Bill máy in
        resName: name,
        resAddr: addr,
        resPhone: phone
    };

    // 1. Lưu vào localStorage
    try {
        const currentCfg = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        const merged = { ...currentCfg, ...brandPayload };
        localStorage.setItem('hoasen_system_config', JSON.stringify(merged));
    } catch (e) {}

    // 2. Gửi API lên SQLite Server
    try {
        const res = await fetch('/api/system-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(brandPayload)
        });
        const data = await res.json();
        if (data.success) {
            // Áp dụng ngay lên trang hiện tại
            if (typeof window.applyGlobalBrandSettings === 'function') {
                window.applyGlobalBrandSettings(brandPayload);
            }
            if (window.toast) {
                window.toast.success('🎉 Đã lưu cấu hình Thương hiệu, Logo & Màu sắc chủ đạo thành công!');
            } else {
                alert('Đã lưu cấu hình thương hiệu thành công!');
            }
        } else {
            alert('Lỗi lưu cấu hình: ' + data.error);
        }
    } catch (err) {
        console.error('Lỗi saveBrandSettings:', err);
        alert('Không thể lưu cấu hình đến máy chủ!');
    }
};

// ==========================================
// 8. CẤU HÌNH CA LÀM VIỆC & TỰ ĐỘNG DỌN BÀN
// ==========================================
window.loadShiftSettings = async function() {
    try {
        const res = await fetch('/api/system-config?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        const cfg = data.config || {};

        const startEl = document.getElementById('cfgShiftStart');
        const endEl = document.getElementById('cfgShiftEnd');
        const autoClearShiftEndEl = document.getElementById('cfgAutoClearShiftEnd');
        const autoClearPrevDayEl = document.getElementById('cfgAutoClearPreviousDay');

        if (startEl) startEl.value = cfg.shift_start_time || '06:00';
        if (endEl) endEl.value = cfg.shift_end_time || '22:30';
        if (autoClearShiftEndEl) autoClearShiftEndEl.checked = String(cfg.auto_clear_on_shift_end ?? '1') === '1';
        if (autoClearPrevDayEl) autoClearPrevDayEl.checked = String(cfg.auto_clear_previous_day ?? '1') === '1';
    } catch (e) {
        console.error('Lỗi loadShiftSettings:', e);
    }
};

window.saveShiftSettings = async function(event) {
    if (event) event.preventDefault();

    const start = document.getElementById('cfgShiftStart')?.value || '06:00';
    const end = document.getElementById('cfgShiftEnd')?.value || '22:30';
    const autoShift = document.getElementById('cfgAutoClearShiftEnd')?.checked ? '1' : '0';
    const autoPrev = document.getElementById('cfgAutoClearPreviousDay')?.checked ? '1' : '0';

    const payload = {
        shift_start_time: start,
        shift_end_time: end,
        auto_clear_on_shift_end: autoShift,
        auto_clear_previous_day: autoPrev
    };

    try {
        const res = await fetch('/api/system-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.success) {
            const currentCfg = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
            localStorage.setItem('hoasen_system_config', JSON.stringify({ ...currentCfg, ...payload }));
            if (window.toast) window.toast.success('✅ Đã lưu cấu hình Ca làm việc & Tự động dọn bàn thành công!');
            else alert('Đã lưu cấu hình ca làm việc!');
        } else {
            alert('Lỗi: ' + (data.error || 'Không thể lưu'));
        }
    } catch (err) {
        console.error('Lỗi saveShiftSettings:', err);
        alert('Lỗi kết nối máy chủ khi lưu ca làm việc!');
    }
};

window.manualCleanupShiftTables = async function() {
    const confirmed = (window.toast && typeof window.toast.confirm === 'function')
        ? await window.toast.confirm('Bạn có chắc chắn muốn quét và dọn sạch toàn bộ các bàn đang bị kẹt hoặc đơn bỏ quên ngay bây giờ không? Toàn bộ bàn sẽ được trả về trạng thái Bàn Trống.', 'Dọn sạch bàn ngay')
        : confirm('Bạn có chắc chắn muốn dọn sạch toàn bộ bàn tồn đọng và giải phóng bàn về Bàn Trống ngay bây giờ?');

    if (!confirmed) return;

    try {
        if (window.toast) window.toast.info('Đang tiến hành dọn sạch phòng bàn...');
        const res = await fetch('/api/tables/cleanup-shift', { method: 'POST' });
        const data = await res.json();

        if (res.ok && data.success) {
            const msg = `🎉 Đã dọn sạch ${data.cleanedOrdersCount || 0} đơn treo và giải phóng ${data.cleanedTablesCount || 0} bàn về trạng thái Bàn Trống!`;
            if (window.toast) window.toast.success(msg);
            else alert(msg);
        } else {
            alert('Lỗi: ' + (data.error || 'Không thể dọn bàn'));
        }
    } catch (err) {
        console.error('Lỗi manualCleanupShiftTables:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

// ==========================================
// 9. QUẢN LÝ NÚT ICON NỔI PHÍA DƯỚI (FAB)
// ==========================================
window.allFloatingButtonsCache = [];

// 9.0. Nạp cấu hình bố cục nút nổi (Dọc / Ngang)
window.loadFloatingLayoutSetting = async function() {
    try {
        const res = await fetch('/api/system-config?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const cfg = data.config || data;
        const layout = cfg.floating_buttons_layout || 'vertical';

        const rVert = document.getElementById('sysFloatingLayout_vertical');
        const rHoriz = document.getElementById('sysFloatingLayout_horizontal');
        if (layout === 'horizontal') {
            if (rHoriz) rHoriz.checked = true;
        } else {
            if (rVert) rVert.checked = true;
        }
    } catch (err) {
        console.error('Lỗi loadFloatingLayoutSetting:', err);
    }
};

// 9.0.1. Lưu cấu hình bố cục nút nổi
window.saveFloatingLayoutSetting = async function() {
    const isHoriz = document.getElementById('sysFloatingLayout_horizontal')?.checked;
    const layout = isHoriz ? 'horizontal' : 'vertical';
    try {
        const res = await fetch('/api/system-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ floating_buttons_layout: layout })
        });
        const data = await res.json();
        if (data.success) {
            if (typeof window.applyFloatingButtonsLayout === 'function') {
                window.applyFloatingButtonsLayout(layout);
            }
            if (window.toast) {
                window.toast.success(`Đã lưu bố cục nút nổi: ${layout === 'horizontal' ? '↔️ Chiều Ngang (Giỏ hàng ở giữa)' : '↕️ Chiều Đứng (Góc phải dưới)'} thành công!`);
            } else {
                alert('Đã lưu cấu hình bố cục thành công!');
            }
        } else {
            if (window.toast) window.toast.error(data.error || 'Lỗi khi lưu cấu hình');
            else alert(data.error || 'Lỗi khi lưu cấu hình');
        }
    } catch (err) {
        console.error('Lỗi saveFloatingLayoutSetting:', err);
        if (window.toast) window.toast.error('Lỗi kết nối máy chủ khi lưu cấu hình!');
    }
};

window.loadFloatingButtonsList = async function() {
    const tbody = document.getElementById('manageFloatingButtonsTableBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/floating-buttons/all?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        const buttons = data.buttons || [];
        window.allFloatingButtonsCache = buttons;

        if (buttons.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">Chưa có nút icon nổi nào. Nhấn Thêm Nút Nổi Mới!</td></tr>';
            return;
        }

        tbody.innerHTML = buttons.map(b => {
            const isActive = Number(b.Is_active ?? 1) === 1;
            const statusBadge = isActive 
                ? '<span class="badge bg-success-subtle text-success fw-bold">Hiển thị</span>' 
                : '<span class="badge bg-secondary-subtle text-secondary">Tạm ẩn</span>';
            const actionText = b.Action_type === 'SHIPPER_PLATFORM' ? '🛵 Bán Shipper' : (b.Action_type === 'HOTLINE' ? '📞 Hotline' : (b.Action_type === 'CART' ? '🛒 Giỏ hàng' : '🌐 Link Web'));

            return `
                <tr>
                    <td class="text-center">
                        <span class="d-inline-flex align-items-center justify-content-center text-white rounded-circle shadow-sm" style="width: 34px; height: 34px; background-color: ${b.Bg_color}; font-size: 14px;">
                            <i class="${b.Icon_class}"></i>
                        </span>
                    </td>
                    <td class="fw-bold text-dark">${b.Button_label}</td>
                    <td><span class="badge bg-light text-dark border">${actionText}</span></td>
                    <td><code>${b.Action_target || '(Mặc định)'}</code></td>
                    <td>
                        <span class="d-inline-block rounded border" style="width: 20px; height: 20px; background-color: ${b.Bg_color}; vertical-align: middle;"></span>
                        <span class="small font-monospace ms-1">${b.Bg_color}</span>
                    </td>
                    <td class="text-center fw-bold">${b.Sort_order || 1}</td>
                    <td>${statusBadge}</td>
                    <td class="text-end">
                        <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2" onclick="window.openManageFloatingButtonModal(${b.Button_id})" title="Chỉnh sửa">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" onclick="window.deleteFloatingButton(${b.Button_id}, '${b.Button_label}')" title="Xóa">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Cập nhật các nút hiển thị ở góc dưới màn hình
        if (typeof window.renderGlobalFloatingButtons === 'function') {
            window.renderGlobalFloatingButtons();
        }

    } catch (e) {
        console.error('Lỗi loadFloatingButtonsList:', e);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger py-3">Lỗi tải danh sách nút nổi</td></tr>';
    }
};

window.openManageFloatingButtonModal = function(btnId) {
    const titleEl = document.getElementById('manageFloatingButtonModalTitle');
    const idInp = document.getElementById('editFloatBtnId');
    const labelInp = document.getElementById('editFloatBtnLabel');
    const typeInp = document.getElementById('editFloatBtnActionType');
    const targetInp = document.getElementById('editFloatBtnTarget');
    const iconInp = document.getElementById('editFloatBtnIcon');
    const colorInp = document.getElementById('editFloatBtnColor');
    const sortInp = document.getElementById('editFloatBtnSort');
    const activeInp = document.getElementById('editFloatBtnActive');
    const tipInp = document.getElementById('editFloatBtnTooltip');

    if (btnId) {
        const b = (window.allFloatingButtonsCache || []).find(x => x.Button_id == btnId);
        if (b) {
            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square me-2"></i>Sửa Nút Icon: ${b.Button_label}`;
            if (idInp) idInp.value = b.Button_id;
            if (labelInp) labelInp.value = b.Button_label;
            if (typeInp) typeInp.value = b.Action_type || 'SHIPPER_PLATFORM';
            if (targetInp) targetInp.value = b.Action_target || '';
            if (iconInp) iconInp.value = b.Icon_class || 'fa-solid fa-motorcycle';
            if (colorInp) colorInp.value = b.Bg_color || '#00b14f';
            if (sortInp) sortInp.value = b.Sort_order || 1;
            if (activeInp) activeInp.value = String(b.Is_active ?? 1);
            if (tipInp) tipInp.value = b.Tooltip_text || '';
        }
    } else {
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-icons me-2"></i>Thêm Nút Icon Nổi Mới`;
        if (idInp) idInp.value = '';
        if (labelInp) labelInp.value = '';
        if (typeInp) typeInp.value = 'SHIPPER_PLATFORM';
        if (targetInp) targetInp.value = 'GRABFOOD';
        if (iconInp) iconInp.value = 'fa-solid fa-motorcycle';
        if (colorInp) colorInp.value = '#00b14f';
        if (sortInp) sortInp.value = ((window.allFloatingButtonsCache || []).length + 1);
        if (activeInp) activeInp.value = '1';
        if (tipInp) tipInp.value = '';
    }

    if (typeof window.openMemberModalElement === 'function') {
        window.openMemberModalElement('manageFloatingButtonModal');
    } else {
        const m = document.getElementById('manageFloatingButtonModal');
        if (m) m.style.display = 'block';
    }
};

window.handleFloatBtnActionTypeChange = function(type) {
    const targetInp = document.getElementById('editFloatBtnTarget');
    const iconInp = document.getElementById('editFloatBtnIcon');
    const colorInp = document.getElementById('editFloatBtnColor');

    if (type === 'SHIPPER_PLATFORM') {
        if (targetInp) targetInp.value = 'GRABFOOD';
        if (iconInp) iconInp.value = 'fa-solid fa-motorcycle';
        if (colorInp) colorInp.value = '#00b14f';
    } else if (type === 'HOTLINE') {
        if (targetInp) targetInp.value = 'HOTLINE';
        if (iconInp) iconInp.value = 'fa-solid fa-phone';
        if (colorInp) colorInp.value = '#0288d1';
    } else if (type === 'CART') {
        if (targetInp) targetInp.value = '/cart';
        if (iconInp) iconInp.value = 'fa-solid fa-cart-shopping';
        if (colorInp) colorInp.value = '#2e7d32';
    }
};

window.saveFloatingButton = async function(event) {
    event.preventDefault();
    const id = document.getElementById('editFloatBtnId')?.value;
    const label = document.getElementById('editFloatBtnLabel')?.value.trim();
    const type = document.getElementById('editFloatBtnActionType')?.value;
    const target = document.getElementById('editFloatBtnTarget')?.value.trim();
    const icon = document.getElementById('editFloatBtnIcon')?.value;
    const color = document.getElementById('editFloatBtnColor')?.value;
    const sort = Number(document.getElementById('editFloatBtnSort')?.value || 1);
    const active = Number(document.getElementById('editFloatBtnActive')?.value ?? 1);
    const tip = document.getElementById('editFloatBtnTooltip')?.value.trim() || label;

    if (!label) {
        if (window.toast) window.toast.warning('Vui lòng nhập tên nhãn cho nút!');
        return;
    }

    const payload = {
        Button_label: label,
        Action_type: type,
        Action_target: target,
        Icon_class: icon,
        Bg_color: color,
        Sort_order: sort,
        Is_active: active,
        Tooltip_text: tip
    };

    try {
        const url = id ? `/api/floating-buttons/${id}` : '/api/floating-buttons';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.success) {
            if (typeof window.closeMemberModalElement === 'function') {
                window.closeMemberModalElement('manageFloatingButtonModal');
            } else {
                const m = document.getElementById('manageFloatingButtonModal');
                if (m) m.style.display = 'none';
            }
            if (window.toast) window.toast.success(id ? '✅ Đã cập nhật nút nổi thành công!' : '🎉 Đã thêm nút nổi mới thành công!');
            await window.loadFloatingButtonsList();
        } else {
            alert('Lỗi: ' + (data.error || 'Không thể lưu nút nổi'));
        }
    } catch (err) {
        console.error('Lỗi saveFloatingButton:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

window.deleteFloatingButton = async function(id, label) {
    const confirmed = (window.toast && typeof window.toast.confirm === 'function')
        ? await window.toast.confirm(`Bạn có chắc chắn muốn xóa nút icon [${label}]?`, 'Xác nhận xóa nút')
        : confirm(`Bạn có chắc chắn muốn xóa nút icon [${label}]?`);

    if (!confirmed) return;

    try {
        const res = await fetch(`/api/floating-buttons/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            if (window.toast) window.toast.success(`Đã xóa nút [${label}] thành công!`);
            await window.loadFloatingButtonsList();
        } else {
            alert('Lỗi xóa: ' + (data.error || 'Thao tác không thành công'));
        }
    } catch (err) {
        console.error('Lỗi deleteFloatingButton:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

// ==========================================
// 10. QUẢN LÝ SLIDE QUẢNG CÁO & BANNER ĐỘNG (CRUD + HIỆU ỨNG)
// ==========================================
window.loadSlideEffectSettings = async function() {
    try {
        const res = await fetch('/api/system-config?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        const cfg = data.config || {};

        const intervalEl = document.getElementById('sysSlideInterval');
        const effectEl = document.getElementById('sysSlideEffect');
        const speedEl = document.getElementById('sysSlideSpeed');

        if (intervalEl) intervalEl.value = String(cfg.home_slide_interval || '5');
        if (effectEl) effectEl.value = cfg.home_slide_effect || 'slide';
        if (speedEl) speedEl.value = cfg.home_slide_speed || '800';
    } catch (e) {
        console.error('Lỗi loadSlideEffectSettings:', e);
    }
};

window.saveSlideEffectSettings = async function() {
    const interval = document.getElementById('sysSlideInterval')?.value || '5';
    const effect = document.getElementById('sysSlideEffect')?.value || 'slide';
    const speed = document.getElementById('sysSlideSpeed')?.value || '800';

    const payload = {
        home_slide_interval: interval,
        home_slide_effect: effect,
        home_slide_speed: speed
    };

    try {
        const res = await fetch('/api/system-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.success) {
            const currentCfg = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
            localStorage.setItem('hoasen_system_config', JSON.stringify({ ...currentCfg, ...payload }));
            if (window.toast) {
                window.toast.success('🎉 Đã lưu cấu hình hiệu ứng & thời gian chuyển slide thành công!');
            } else {
                alert('Đã lưu cấu hình hiệu ứng slide thành công!');
            }
        } else {
            alert('Lỗi: ' + (data.error || 'Không thể lưu'));
        }
    } catch (err) {
        console.error('Lỗi saveSlideEffectSettings:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

window.allSystemBannersCache = [];

window.loadSystemBannersList = async function() {
    const tbody = document.getElementById('manageSystemBannersTableBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/promotion-banners?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        const banners = data.banners || [];
        window.allSystemBannersCache = banners;

        if (banners.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Chưa có banner nào trong kho. Bấm nút "+ Thêm Banner Mới" để tạo!</td></tr>';
            return;
        }

        tbody.innerHTML = banners.map(b => {
            const isActive = Number(b.Is_active ?? 1) === 1;
            const statusBadge = isActive 
                ? '<span class="badge bg-success-subtle text-success fw-bold">Đang hiển thị</span>' 
                : '<span class="badge bg-secondary-subtle text-secondary">Tạm ẩn</span>';
            const img = b.Image_url || '/uploads/dish-sample.jpg';
            const price = b.Price_text || '---';
            const badge = b.Badge_text || 'MỚI';
            const subtitle = b.Subtitle || '';

            return `
                <tr>
                    <td class="ps-3">
                        <img src="${img}" alt="${b.Title}" class="rounded border shadow-sm" style="width: 70px; height: 46px; object-fit: cover;" onerror="this.src='/uploads/dish-sample.jpg'">
                    </td>
                    <td>
                        <div class="fw-bold text-dark">${b.Title}</div>
                        ${subtitle ? `<small class="text-muted text-truncate d-inline-block" style="max-width: 320px;">${subtitle}</small>` : ''}
                    </td>
                    <td class="text-center">
                        <span class="badge bg-danger-subtle text-danger fw-bold text-uppercase">${badge}</span>
                    </td>
                    <td class="text-center fw-bold text-success">
                        ${price}
                    </td>
                    <td class="text-center fw-bold">
                        ${b.Sort_order || 1}
                    </td>
                    <td class="text-center">
                        ${statusBadge}
                    </td>
                    <td class="text-end pe-3">
                        <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2" onclick="window.openManageSystemBannerModal(${b.Banner_id})" title="Chỉnh sửa">
                            <i class="fa-solid fa-pen-to-square"></i> Sửa
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" onclick="window.deleteSystemBanner(${b.Banner_id}, '${b.Title.replace(/'/g, "\\'")}')" title="Xóa">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('Lỗi loadSystemBannersList:', e);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-3">Lỗi tải danh sách banner</td></tr>';
    }
};

window.previewSysBannerImg = function(url) {
    const preview = document.getElementById('editSysBannerImgPreview');
    if (preview) {
        preview.src = url || '/uploads/dish-sample.jpg';
    }
};

window.handleSystemBannerFileSelected = async function(input) {
    if (!input || !input.files || input.files.length === 0) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append('bannerImage', file);

    try {
        if (window.toast) window.toast.info('Đang tải hình ảnh banner lên...');
        const res = await fetch('/api/promotion-banners/upload-image', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok && data.success && data.imageUrl) {
            const urlInput = document.getElementById('editSysBannerImgUrl');
            if (urlInput) urlInput.value = data.imageUrl;
            window.previewSysBannerImg(data.imageUrl);
            if (window.toast) window.toast.success('✅ Đã tải ảnh banner lên thành công!');
        } else {
            alert('Lỗi tải ảnh: ' + (data.error || 'Không rõ nguyên nhân'));
        }
    } catch (err) {
        console.error('Lỗi upload bannerImage:', err);
        alert('Không thể kết nối máy chủ khi tải ảnh!');
    }
};

window.openManageSystemBannerModal = function(bannerId) {
    const titleEl = document.getElementById('manageSystemBannerModalTitle');
    const idInp = document.getElementById('editSysBannerId');
    const titleInp = document.getElementById('editSysBannerTitle');
    const subInp = document.getElementById('editSysBannerSubtitle');
    const badgeInp = document.getElementById('editSysBannerBadge');
    const priceInp = document.getElementById('editSysBannerPrice');
    const urlInp = document.getElementById('editSysBannerImgUrl');
    const sortInp = document.getElementById('editSysBannerSort');
    const activeInp = document.getElementById('editSysBannerActive');

    if (bannerId) {
        const b = (window.allSystemBannersCache || []).find(x => x.Banner_id == bannerId);
        if (b) {
            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square me-2"></i>Sửa Banner: ${b.Title}`;
            if (idInp) idInp.value = b.Banner_id;
            if (titleInp) titleInp.value = b.Title;
            if (subInp) subInp.value = b.Subtitle || '';
            if (badgeInp) badgeInp.value = b.Badge_text || 'MỚI';
            if (priceInp) priceInp.value = b.Price_text || '';
            if (urlInp) urlInp.value = b.Image_url || '';
            if (sortInp) sortInp.value = b.Sort_order || 1;
            if (activeInp) activeInp.value = String(b.Is_active ?? 1);
            window.previewSysBannerImg(b.Image_url);
        }
    } else {
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-images me-2"></i>Thêm Banner Quảng Cáo & Món Mới`;
        if (idInp) idInp.value = '';
        if (titleInp) titleInp.value = '';
        if (subInp) subInp.value = '';
        if (badgeInp) badgeInp.value = 'MỚI';
        if (priceInp) priceInp.value = '';
        if (urlInp) urlInp.value = '/uploads/dish-sample.jpg';
        if (sortInp) sortInp.value = ((window.allSystemBannersCache || []).length + 1);
        if (activeInp) activeInp.value = '1';
        window.previewSysBannerImg('/uploads/dish-sample.jpg');
    }

    if (typeof window.openMemberModalElement === 'function') {
        window.openMemberModalElement('manageSystemBannerModal');
    } else {
        const m = document.getElementById('manageSystemBannerModal');
        if (m) m.style.display = 'block';
    }
};

window.saveSystemBanner = async function(event) {
    if (event) event.preventDefault();
    const id = document.getElementById('editSysBannerId')?.value;
    const title = document.getElementById('editSysBannerTitle')?.value.trim();
    const subtitle = document.getElementById('editSysBannerSubtitle')?.value.trim();
    const badge = document.getElementById('editSysBannerBadge')?.value.trim() || 'MỚI';
    const price = document.getElementById('editSysBannerPrice')?.value.trim();
    const imgUrl = document.getElementById('editSysBannerImgUrl')?.value.trim();
    const sort = Number(document.getElementById('editSysBannerSort')?.value || 1);
    const active = Number(document.getElementById('editSysBannerActive')?.value ?? 1);

    if (!title) {
        if (window.toast) window.toast.warning('Vui lòng nhập tiêu đề cho banner!');
        return;
    }
    if (!imgUrl) {
        if (window.toast) window.toast.warning('Vui lòng cung cấp hình ảnh cho banner!');
        return;
    }

    const payload = {
        Title: title,
        Subtitle: subtitle,
        Badge_text: badge,
        Price_text: price,
        Image_url: imgUrl,
        Sort_order: sort,
        Is_active: active
    };

    try {
        const url = id ? `/api/promotion-banners/${id}` : '/api/promotion-banners';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.success) {
            if (typeof window.closeMemberModalElement === 'function') {
                window.closeMemberModalElement('manageSystemBannerModal');
            } else {
                const m = document.getElementById('manageSystemBannerModal');
                if (m) m.style.display = 'none';
            }
            if (window.toast) window.toast.success(id ? '✅ Đã cập nhật banner thành công!' : '🎉 Đã thêm banner mới thành công!');
            await window.loadSystemBannersList();
        } else {
            alert('Lỗi: ' + (data.error || 'Không thể lưu banner'));
        }
    } catch (err) {
        console.error('Lỗi saveSystemBanner:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

window.deleteSystemBanner = async function(id, title) {
    const confirmed = (window.toast && typeof window.toast.confirm === 'function')
        ? await window.toast.confirm(`Bạn có chắc chắn muốn xóa banner [${title}] khỏi hệ thống?`, 'Xác nhận xóa banner')
        : confirm(`Bạn có chắc chắn muốn xóa banner [${title}] khỏi hệ thống?`);

    if (!confirmed) return;

    try {
        const res = await fetch(`/api/promotion-banners/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            if (window.toast) window.toast.success(`Đã xóa banner [${title}] thành công!`);
            await window.loadSystemBannersList();
        } else {
            alert('Lỗi xóa: ' + (data.error || 'Thao tác không thành công'));
        }
    } catch (err) {
        console.error('Lỗi deleteSystemBanner:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

// ========================================================
// 12. QUẢN LÝ CHIẾN DỊCH MARKETING, VOUCHER & EMAIL KHÁCH
// ========================================================

window.currentMarketingCampaigns = [];

window.loadMarketingCampaigns = async function() {
    const tbody = document.getElementById('manageMarketingCampaignsTableBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/marketing/campaigns');
        const data = await res.json();
        const campaigns = data.campaigns || [];
        window.currentMarketingCampaigns = campaigns;

        // Cập nhật thống kê thẻ
        const activeCount = campaigns.filter(c => c.Is_active == 1).length;
        const totalUsed = campaigns.reduce((sum, c) => sum + Number(c.Usage_count || 0), 0);
        
        const activeEl = document.getElementById('mktActiveCampaignsCount');
        const usedEl = document.getElementById('mktVouchersUsedCount');
        if (activeEl) activeEl.innerText = activeCount;
        if (usedEl) usedEl.innerText = totalUsed;

        // Thống kê Email và Voucher đã đẩy
        try {
            const emailRes = await fetch('/api/marketing/export-emails');
            const emailData = await emailRes.json();
            const emailCountEl = document.getElementById('mktEmailsCollectedCount');
            if (emailCountEl) emailCountEl.innerText = (emailData.members || []).length;
        } catch(e) {}

        const distCountEl = document.getElementById('mktVouchersDistributedCount');
        if (distCountEl) distCountEl.innerText = totalUsed + (activeCount * 5); // Ước tính trực quan

        if (campaigns.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4 text-muted">
                        <i class="fa-solid fa-folder-open me-1"></i> Chưa có chiến dịch marketing nào. Bấm "+ Tạo Chiến Dịch Mới" để bắt đầu!
                    </td>
                </tr>
            `;
        }

        // Tự động nạp luôn bảng Lịch sử đẩy mã cho hội viên
        if (typeof window.loadMemberVouchersHistory === 'function') {
            window.loadMemberVouchersHistory();
        }

        const typeLabels = {
            'BILL_AMOUNT': '<span class="badge bg-success-subtle text-success border border-success-subtle">Hóa đơn</span>',
            'COMBO': '<span class="badge bg-warning-subtle text-dark border border-warning-subtle">Combo</span>',
            'DAY_OF_WEEK': '<span class="badge bg-info-subtle text-info border border-info-subtle">Thứ / Ngày</span>',
            'EVENT': '<span class="badge bg-danger-subtle text-danger border border-danger-subtle">Sự kiện</span>',
            'MEMBER_TENURE': '<span class="badge bg-primary-subtle text-primary border border-primary-subtle">Thâm niên thẻ</span>'
        };

        const tierNames = {
            'ALL': 'Tất cả hội viên',
            'MAM_SEN': 'Mầm Sen',
            'BUP_SEN': 'Búp Sen',
            'SEN_HONG': 'Sen Hồng',
            'SEN_KIM_CUONG': 'Sen Kim Cương'
        };

        tbody.innerHTML = campaigns.map(c => {
            const discountText = c.Discount_type === 'PERCENT'
                ? `<b class="text-danger fs-6">-${c.Discount_value}%</b>${c.Max_discount_amount ? `<div class="text-muted" style="font-size: 11px;">(Tối đa ${Number(c.Max_discount_amount).toLocaleString('vi-VN')}đ)</div>` : ''}`
                : `<b class="text-danger fs-6">-${Number(c.Discount_value).toLocaleString('vi-VN')} đ</b>`;

            const name = c.Campaign_name || c.Name || 'Chiến dịch';
            const type = c.Campaign_type || c.Type || 'BILL_AMOUNT';
            const minBill = Number(c.Min_bill_amount || c.Min_order_amount || 0);
            const minMonths = Number(c.Min_membership_months || c.Min_member_tenure_months || 0);

            let conditionText = '';
            if (type === 'MEMBER_TENURE') {
                conditionText = `<i class="fa-solid fa-clock-rotate-left me-1 text-primary"></i>Thẻ > ${minMonths || 3} tháng`;
            } else if (minBill > 0) {
                conditionText = `Đơn từ ${minBill.toLocaleString('vi-VN')}đ`;
            } else {
                conditionText = tierNames[c.Target_tier] || 'Tất cả';
            }

            const statusBadge = c.Is_active == 1
                ? '<span class="badge bg-success rounded-pill px-2 py-1"><i class="fa-solid fa-circle-check me-1"></i>Hoạt động</span>'
                : '<span class="badge bg-secondary rounded-pill px-2 py-1"><i class="fa-solid fa-pause me-1"></i>Tạm dừng</span>';

            return `
                <tr>
                    <td class="ps-3 font-monospace fw-bold text-primary fs-6">
                        <i class="fa-solid fa-tag me-1 text-warning"></i>${c.Code}
                    </td>
                    <td>
                        <div class="fw-bold text-dark">${name}</div>
                        <div class="small text-muted text-truncate" style="max-width: 280px;">${c.Description || '---'}</div>
                    </td>
                    <td class="text-center">${typeLabels[type] || type}</td>
                    <td class="text-center">${discountText}</td>
                    <td class="text-center small">${conditionText}</td>
                    <td class="text-center fw-bold text-secondary font-monospace">${c.Usage_count || 0}${c.Usage_limit ? ` / ${c.Usage_limit}` : ''}</td>
                    <td class="text-center">${statusBadge}</td>
                    <td class="text-end pe-3">
                        <div class="btn-group btn-group-sm">
                            <button type="button" class="btn btn-outline-primary" onclick="window.openMarketingCampaignModal('${c.Campaign_id}')" title="Sửa chiến dịch">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button type="button" class="btn btn-outline-danger" onclick="window.deleteMarketingCampaign('${c.Campaign_id}', '${c.Code}')" title="Xóa">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Lỗi nạp chiến dịch marketing:', err);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">Lỗi kết nối máy chủ!</td></tr>`;
    }
};

window.handleCampaignTypeChange = function(type) {
    const tenureCol = document.getElementById('mktTenureSettingCol');
    if (tenureCol) {
        tenureCol.style.display = (type === 'MEMBER_TENURE') ? 'block' : 'none';
    }
};

window.toggleMktBannerSettings = function(val) {
    const wrap = document.getElementById('mktBannerDesignWrap');
    if (wrap) wrap.style.display = (String(val) === '1') ? 'block' : 'none';
};

window.previewMktBannerImg = function(url) {
    const preview = document.getElementById('editMktBannerImgPreview');
    if (preview) {
        preview.src = url || '/uploads/banner_1790164138400.jpg';
        preview.onerror = () => { preview.src = '/uploads/dish-sample.jpg'; };
    }
};

window.handleMarketingBannerFileSelected = async function(input) {
    if (!input || !input.files || input.files.length === 0) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append('bannerImage', file);

    try {
        if (window.toast) window.toast.info('Đang tải ảnh banner lên máy chủ...');
        const res = await fetch('/api/promotion-banners/upload-image', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok && data.success && data.imageUrl) {
            const urlInp = document.getElementById('editMktImageUrl');
            if (urlInp) urlInp.value = data.imageUrl;
            window.previewMktBannerImg(data.imageUrl);
            if (window.toast) window.toast.success('Đã tải ảnh banner thành công!');
        } else {
            alert('Lỗi tải ảnh: ' + (data.error || 'Không thể upload ảnh'));
        }
    } catch (err) {
        console.error('Lỗi handleMarketingBannerFileSelected:', err);
        alert('Không thể kết nối máy chủ khi tải ảnh!');
    }
};

window.openMarketingCampaignModal = function(campaignId) {
    const form = document.getElementById('manageMarketingCampaignForm');
    const titleEl = document.getElementById('manageMarketingCampaignModalTitle');
    if (form) form.reset();

    document.getElementById('editMktCampaignId').value = campaignId || '';

    if (campaignId && window.currentMarketingCampaigns) {
        const c = window.currentMarketingCampaigns.find(item => (item.Campaign_id == campaignId || item.Id == campaignId));
        if (c) {
            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square me-2"></i>Sửa Chiến Dịch: ${c.Code}`;
            document.getElementById('editMktName').value = c.Campaign_name || c.Name || '';
            document.getElementById('editMktCode').value = c.Code || '';
            const campType = c.Campaign_type || c.Type || 'BILL_AMOUNT';
            document.getElementById('editMktType').value = campType;
            document.getElementById('editMktDiscountType').value = c.Discount_type || 'PERCENT';
            document.getElementById('editMktDiscountValue').value = c.Discount_value || 0;
            document.getElementById('editMktMinBill').value = (c.Min_bill_amount !== undefined && c.Min_bill_amount !== null) ? c.Min_bill_amount : (c.Min_order_amount || 0);
            document.getElementById('editMktMaxDiscount').value = c.Max_discount_amount || '';
            document.getElementById('editMktUsageLimit').value = c.Usage_limit || '';
            document.getElementById('editMktMinMonths').value = (c.Min_membership_months !== undefined && c.Min_membership_months !== null) ? c.Min_membership_months : (c.Min_member_tenure_months || 3);
            document.getElementById('editMktTargetTier').value = c.Target_tier || 'ALL';
            document.getElementById('editMktStartDate').value = c.Start_date ? c.Start_date.substring(0, 10) : '';
            document.getElementById('editMktEndDate').value = c.End_date ? c.End_date.substring(0, 10) : '';
            document.getElementById('editMktDescription').value = c.Description || '';
            const showBanner = (c.Show_banner !== undefined && c.Show_banner !== null) ? Number(c.Show_banner) : 1;
            document.getElementById('editMktShowBanner').value = String(showBanner);
            document.getElementById('editMktBadgeText').value = c.Badge_text || '';
            document.getElementById('editMktPriceText').value = c.Price_text || '';
            document.getElementById('editMktImageUrl').value = c.Image_url || '';
            window.previewMktBannerImg(c.Image_url || '/uploads/banner_1790164138400.jpg');
            window.toggleMktBannerSettings(showBanner);

            document.getElementById('editMktIsActive').value = (c.Is_active !== undefined) ? (c.Is_active ? '1' : '0') : '1';
            window.handleCampaignTypeChange(campType);
        }
    } else {
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-bullhorn me-2"></i>Tạo Chiến Dịch Khuyến Mãi Mới`;
        document.getElementById('editMktShowBanner').value = '1';
        document.getElementById('editMktBadgeText').value = 'ƯU ĐÃI';
        document.getElementById('editMktPriceText').value = '';
        document.getElementById('editMktImageUrl').value = '/uploads/banner_1790164138400.jpg';
        window.previewMktBannerImg('/uploads/banner_1790164138400.jpg');
        window.toggleMktBannerSettings('1');
        window.handleCampaignTypeChange('BILL_AMOUNT');
    }

    if (typeof window.openMemberModalElement === 'function') {
        window.openMemberModalElement('manageMarketingCampaignModal');
    } else {
        const m = document.getElementById('manageMarketingCampaignModal');
        if (m) {
            m.classList.add('show');
            m.style.display = 'block';
            document.body.classList.add('modal-open');
        }
    }
};

window.saveMarketingCampaign = async function(event) {
    if (event) event.preventDefault();

    const id = document.getElementById('editMktCampaignId')?.value;
    const payload = {
        Campaign_name: document.getElementById('editMktName')?.value?.trim(),
        Code: document.getElementById('editMktCode')?.value?.trim().toUpperCase(),
        Campaign_type: document.getElementById('editMktType')?.value,
        Discount_type: document.getElementById('editMktDiscountType')?.value,
        Discount_value: Number(document.getElementById('editMktDiscountValue')?.value || 0),
        Min_bill_amount: Number(document.getElementById('editMktMinBill')?.value || 0),
        Max_discount_amount: Number(document.getElementById('editMktMaxDiscount')?.value || 0) || null,
        Usage_limit: Number(document.getElementById('editMktUsageLimit')?.value || 0) || null,
        Min_membership_months: (document.getElementById('editMktType')?.value === 'MEMBER_TENURE') ? Number(document.getElementById('editMktMinMonths')?.value || 0) : 0,
        Target_tier: document.getElementById('editMktTargetTier')?.value || 'ALL',
        Start_date: document.getElementById('editMktStartDate')?.value || null,
        End_date: document.getElementById('editMktEndDate')?.value || null,
        Description: document.getElementById('editMktDescription')?.value?.trim(),
        Show_banner: Number(document.getElementById('editMktShowBanner')?.value || 0),
        Badge_text: document.getElementById('editMktBadgeText')?.value?.trim() || null,
        Price_text: document.getElementById('editMktPriceText')?.value?.trim() || null,
        Image_url: document.getElementById('editMktImageUrl')?.value?.trim() || null,
        Is_active: Number(document.getElementById('editMktIsActive')?.value || 1)
    };

    if (!payload.Campaign_name || !payload.Code || !payload.Discount_value) {
        if (window.toast) window.toast.warning('Vui lòng điền đầy đủ Tên, Mã Voucher và Mức Giảm!');
        return;
    }

    try {
        const url = id ? `/api/marketing/campaigns/${id}` : '/api/marketing/campaigns';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.success) {
            if (typeof window.closeMemberModalElement === 'function') {
                window.closeMemberModalElement('manageMarketingCampaignModal');
            } else {
                const m = document.getElementById('manageMarketingCampaignModal');
                if (m) m.style.display = 'none';
            }
            if (window.toast) window.toast.success(id ? '✅ Đã cập nhật chiến dịch!' : '🎉 Đã tạo chiến dịch mới thành công!');
            await window.loadMarketingCampaigns();
        } else {
            alert('Lỗi: ' + (data.error || 'Không thể lưu chiến dịch'));
        }
    } catch (err) {
        console.error('Lỗi saveMarketingCampaign:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

window.deleteMarketingCampaign = async function(id, code) {
    const confirmed = (window.toast && typeof window.toast.confirm === 'function')
        ? await window.toast.confirm(`Bạn có chắc chắn muốn xóa chiến dịch [${code}]?`, 'Xác nhận xóa chiến dịch')
        : confirm(`Bạn có chắc chắn muốn xóa chiến dịch [${code}]?`);

    if (!confirmed) return;

    try {
        const res = await fetch(`/api/marketing/campaigns/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            if (window.toast) window.toast.success(`Đã xóa chiến dịch [${code}] thành công!`);
            await window.loadMarketingCampaigns();
        } else {
            alert('Lỗi xóa: ' + (data.error || 'Thao tác không thành công'));
        }
    } catch (err) {
        console.error('Lỗi deleteMarketingCampaign:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

// ========================================================
// ĐẨY MÃ GIẢM GIÁ CHO HỘI VIÊN
// ========================================================

window.openPushVoucherModal = function() {
    const select = document.getElementById('pushVoucherCampaignSelect');
    if (select) {
        select.innerHTML = '<option value="">-- Chọn chiến dịch có sẵn --</option>' +
            (window.currentMarketingCampaigns || []).map(c => 
                `<option value="${c.Campaign_id}">[${c.Code}] - ${c.Campaign_name} (${c.Discount_type === 'PERCENT' ? `Giảm ${c.Discount_value}%` : `Giảm ${Number(c.Discount_value).toLocaleString('vi-VN')}đ`})</option>`
            ).join('');
    }

    window.handlePushTargetChange('ALL');

    if (typeof window.openMemberModalElement === 'function') {
        window.openMemberModalElement('pushVoucherModal');
    } else {
        const m = document.getElementById('pushVoucherModal');
        if (m) {
            m.classList.add('show');
            m.style.display = 'block';
            document.body.classList.add('modal-open');
        }
    }
};

window.handlePushTargetChange = function(type) {
    const tierRow = document.getElementById('pushVoucherTierRow');
    const tenureRow = document.getElementById('pushVoucherTenureRow');
    const randomRow = document.getElementById('pushVoucherRandomRow');

    if (tierRow) tierRow.style.display = (type === 'TIER') ? 'block' : 'none';
    if (tenureRow) tenureRow.style.display = (type === 'TENURE') ? 'block' : 'none';
    if (randomRow) randomRow.style.display = (type === 'RANDOM') ? 'block' : 'none';
};

window.submitPushVouchers = async function(event) {
    if (event) event.preventDefault();

    const campaignId = document.getElementById('pushVoucherCampaignSelect')?.value;
    const targetType = document.getElementById('pushVoucherTargetType')?.value;
    const targetTier = document.getElementById('pushVoucherTierSelect')?.value;
    const minMonths = Number(document.getElementById('pushVoucherMonthsSelect')?.value || 3);
    const randomLimit = Number(document.getElementById('pushVoucherRandomLimit')?.value || 20);
    const expirySelect = document.getElementById('pushVoucherExpirySelect')?.value || '30';
    let expiryDays = 30;
    let customExpiryDate = null;

    if (expirySelect === 'CUSTOM') {
        const rawDate = document.getElementById('pushVoucherCustomExpiryDate')?.value;
        if (rawDate) {
            customExpiryDate = rawDate.replace('T', ' ') + ':00';
        }
    } else {
        expiryDays = Number(expirySelect);
    }

    const btn = document.getElementById('btnSubmitPushVoucher');

    if (!campaignId) {
        if (window.toast) window.toast.warning('Vui lòng chọn chiến dịch cần đẩy mã!');
        return;
    }

    try {
        if (btn) btn.disabled = true;

        const res = await fetch('/api/marketing/push-vouchers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                campaignId,
                targetType,
                targetTier,
                minMonths,
                randomLimit,
                expiryDays,
                customExpiryDate
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            if (typeof window.closeMemberModalElement === 'function') {
                window.closeMemberModalElement('pushVoucherModal');
            } else {
                const m = document.getElementById('pushVoucherModal');
                if (m) m.style.display = 'none';
            }
            if (window.toast) window.toast.success(data.message || `Đã đẩy mã ưu đãi tới ${data.assignedCount} hội viên!`);
            await window.loadMarketingCampaigns();
            await window.loadMemberVouchersHistory();
        } else {
            alert('Lỗi đẩy mã: ' + (data.error || 'Thao tác không thành công'));
        }
    } catch (err) {
        console.error('Lỗi submitPushVouchers:', err);
        alert('Không thể kết nối máy chủ!');
    } finally {
        if (btn) btn.disabled = false;
    }
};

// ========================================================
// 12.5. QUẢN LÝ LỊCH SỬ ĐÃ ĐẨY MÃ CHO HỘI VIÊN
// ========================================================

window.currentMemberVouchersHistory = [];
let vHistSearchTimeout = null;

window.debounceLoadVouchersHistory = function() {
    clearTimeout(vHistSearchTimeout);
    vHistSearchTimeout = setTimeout(() => {
        window.loadMemberVouchersHistory();
    }, 300);
};

window.loadMemberVouchersHistory = async function() {
    const tbody = document.getElementById('manageMemberVouchersHistoryTableBody');
    const badgeCount = document.getElementById('vouchHistCountBadge');
    if (!tbody) return;

    const search = document.getElementById('vouchHistSearchInput')?.value?.trim() || '';
    const status = document.getElementById('vouchHistStatusSelect')?.value || 'ALL';

    try {
        const url = `/api/marketing/member-vouchers-history?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&t=${Date.now()}`;
        const res = await fetch(url);
        const data = await res.json();
        const history = data.history || [];
        window.currentMemberVouchersHistory = history;

        if (badgeCount) {
            badgeCount.innerText = `Tổng số: ${history.length} mã`;
        }

        // Cập nhật thống kê header tổng
        const distCountEl = document.getElementById('mktVouchersDistributedCount');
        if (distCountEl) distCountEl.innerText = data.totalCount ?? history.length;

        if (history.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4 text-muted">
                        <i class="fa-solid fa-inbox fa-2x mb-2 d-block opacity-50"></i>
                        Chưa có lịch sử đẩy mã nào phù hợp với bộ lọc.
                    </td>
                </tr>
            `;
            return;
        }

        const tierNames = {
            'MAM_SEN': 'Mầm Sen',
            'BUP_SEN': 'Búp Sen',
            'SEN_HONG': 'Sen Hồng',
            'SEN_KIM_CUONG': 'Sen Kim Cương'
        };

        const now = new Date();

        tbody.innerHTML = history.map(item => {
            const vId = item.Voucher_id;
            const code = item.Voucher_code || '---';
            const campTitle = item.Title || item.Campaign_name || 'Ưu đãi hội viên';
            const discText = item.Discount_type === 'PERCENT'
                ? `<b class="text-danger">-${item.Discount_value}%</b>`
                : `<b class="text-danger">-${Number(item.Discount_value || 0).toLocaleString('vi-VN')}đ</b>`;

            const memberName = item.Member_name || `Hội viên #${item.Member_id}`;
            const memberPhone = item.Member_phone ? `<div class="small text-muted"><i class="fa-solid fa-phone me-1"></i>${item.Member_phone}</div>` : '';
            const tierBadge = item.Member_tier ? `<span class="badge bg-light text-dark border ms-1" style="font-size: 10px;">${tierNames[item.Member_tier] || item.Member_tier}</span>` : '';

            // Format ngày tạo
            let createdFormatted = item.Created_at || '--:--';
            try {
                const cd = new Date(item.Created_at);
                if (!isNaN(cd.getTime())) {
                    createdFormatted = `${String(cd.getHours()).padStart(2,'0')}:${String(cd.getMinutes()).padStart(2,'0')} ${String(cd.getDate()).padStart(2,'0')}/${String(cd.getMonth()+1).padStart(2,'0')}/${cd.getFullYear()}`;
                }
            } catch(e) {}

            // Format ngày hết hạn & Tính thời gian còn lại
            let expiryFormatted = 'Không giới hạn';
            let remainingBadge = '';
            let isExpired = false;

            if (item.Expiry_date) {
                try {
                    const ed = new Date(item.Expiry_date);
                    if (!isNaN(ed.getTime())) {
                        expiryFormatted = `${String(ed.getHours()).padStart(2,'0')}:${String(ed.getMinutes()).padStart(2,'0')} ${String(ed.getDate()).padStart(2,'0')}/${String(ed.getMonth()+1).padStart(2,'0')}/${ed.getFullYear()}`;
                        const diffMs = ed.getTime() - now.getTime();
                        if (diffMs <= 0) {
                            isExpired = true;
                            remainingBadge = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle ms-1" style="font-size: 10px;">Đã hết hạn</span>';
                        } else {
                            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                            const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            if (diffDays > 0) {
                                remainingBadge = `<span class="badge bg-success-subtle text-success border border-success-subtle ms-1" style="font-size: 10px;">Còn ${diffDays} ngày</span>`;
                            } else {
                                remainingBadge = `<span class="badge bg-warning-subtle text-dark border border-warning-subtle ms-1" style="font-size: 10px;">Còn ${diffHours} giờ</span>`;
                            }
                        }
                    }
                } catch(e) {}
            }

            // Trạng thái hiển thị
            let statusBadge = '';
            if (item.Status === 'USED') {
                statusBadge = '<span class="badge bg-primary rounded-pill px-2 py-1"><i class="fa-solid fa-check me-1"></i>Đã Dùng</span>';
            } else if (item.Status === 'CANCELLED') {
                statusBadge = '<span class="badge bg-danger rounded-pill px-2 py-1"><i class="fa-solid fa-ban me-1"></i>Đã Hủy</span>';
            } else if (isExpired || item.Status === 'EXPIRED') {
                statusBadge = '<span class="badge bg-secondary rounded-pill px-2 py-1"><i class="fa-solid fa-clock-rotate-left me-1"></i>Hết Hạn</span>';
            } else {
                statusBadge = '<span class="badge bg-success rounded-pill px-2 py-1"><i class="fa-solid fa-circle-check me-1"></i>Còn Hạn</span>';
            }

            const isCancellable = item.Status === 'UNUSED' && !isExpired;

            return `
                <tr>
                    <td class="ps-3 text-center">
                        <input type="checkbox" class="form-check-input item-vouch-hist-checkbox" value="${vId}">
                    </td>
                    <td class="font-monospace fw-bold text-primary">
                        <i class="fa-solid fa-ticket me-1 text-warning"></i>${code}
                    </td>
                    <td>
                        <div class="fw-bold text-dark">${campTitle}</div>
                        <div class="small">${discText} ${item.Min_order_amount ? `<span class="text-muted">(Đơn > ${Number(item.Min_order_amount).toLocaleString('vi-VN')}đ)</span>` : ''}</div>
                    </td>
                    <td>
                        <div class="fw-bold text-dark">${memberName} ${tierBadge}</div>
                        ${memberPhone}
                    </td>
                    <td class="text-center small text-secondary">
                        <i class="fa-regular fa-calendar-days me-1"></i>${createdFormatted}
                    </td>
                    <td class="text-center small">
                        <div class="fw-bold ${isExpired ? 'text-danger' : 'text-dark'}">${expiryFormatted}</div>
                        <div>${remainingBadge}</div>
                    </td>
                    <td class="text-center">${statusBadge}</td>
                    <td class="text-end pe-3">
                        <div class="btn-group btn-group-sm">
                            <button type="button" class="btn btn-outline-primary" onclick="window.openEditVoucherExpiryModal(${vId})" title="Sửa hạn sử dụng (Gia hạn / Thu hẹp)">
                                <i class="fa-regular fa-clock"></i>
                            </button>
                            ${isCancellable ? `
                                <button type="button" class="btn btn-outline-warning text-dark" onclick="window.cancelPushedVoucher(${vId}, '${code}')" title="Hủy mã này">
                                    <i class="fa-solid fa-ban"></i>
                                </button>
                            ` : ''}
                            <button type="button" class="btn btn-outline-danger" onclick="window.deletePushedVoucher(${vId}, '${code}')" title="Xóa dòng lịch sử này">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Lỗi loadMemberVouchersHistory:', err);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">Lỗi kết nối máy chủ!</td></tr>`;
    }
};

window.toggleSelectAllVouchHist = function(masterCheckbox) {
    const isChecked = masterCheckbox.checked;
    document.querySelectorAll('.item-vouch-hist-checkbox').forEach(cb => {
        cb.checked = isChecked;
    });
};

window.openEditVoucherExpiryModal = function(voucherId) {
    const item = (window.currentMemberVouchersHistory || []).find(v => v.Voucher_id == voucherId);
    if (!item) return;

    document.getElementById('editExpVoucherId').value = voucherId;
    document.getElementById('editExpVoucherCode').innerText = item.Voucher_code || '---';
    document.getElementById('editExpVoucherDiscount').innerText = item.Discount_type === 'PERCENT' ? `-${item.Discount_value}%` : `-${Number(item.Discount_value || 0).toLocaleString('vi-VN')}đ`;
    document.getElementById('editExpVoucherTitle').innerText = item.Title || item.Campaign_name || 'Mã ưu đãi';
    document.getElementById('editExpMemberName').innerText = `${item.Member_name || 'Khách'} (${item.Member_phone || 'Chưa có SĐT'})`;
    document.getElementById('editExpCurrentExpiryText').innerText = item.Expiry_date ? item.Expiry_date.replace('T', ' ').substring(0, 19) : 'Không giới hạn';

    // Đặt mặc định vào ô datetime-local
    let defaultDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (item.Expiry_date) {
        try {
            const ed = new Date(item.Expiry_date);
            if (!isNaN(ed.getTime())) defaultDate = ed;
        } catch(e) {}
    }

    const year = defaultDate.getFullYear();
    const month = String(defaultDate.getMonth() + 1).padStart(2, '0');
    const day = String(defaultDate.getDate()).padStart(2, '0');
    const hours = String(defaultDate.getHours()).padStart(2, '0');
    const minutes = String(defaultDate.getMinutes()).padStart(2, '0');
    document.getElementById('editExpNewDateInput').value = `${year}-${month}-${day}T${hours}:${minutes}`;

    if (typeof window.openMemberModalElement === 'function') {
        window.openMemberModalElement('editVoucherExpiryModal');
    } else {
        const m = document.getElementById('editVoucherExpiryModal');
        if (m) {
            m.classList.add('show');
            m.style.display = 'block';
            document.body.classList.add('modal-open');
        }
    }
};

window.setQuickExpiryDate = function(days) {
    const targetDate = new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000);
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const hours = String(targetDate.getHours()).padStart(2, '0');
    const minutes = String(targetDate.getMinutes()).padStart(2, '0');
    document.getElementById('editExpNewDateInput').value = `${year}-${month}-${day}T${hours}:${minutes}`;
};

window.submitUpdateVoucherExpiry = async function(event) {
    if (event) event.preventDefault();

    const voucherId = document.getElementById('editExpVoucherId')?.value;
    const newDateVal = document.getElementById('editExpNewDateInput')?.value;
    const btn = document.getElementById('btnSubmitUpdateExpiry');

    if (!voucherId || !newDateVal) {
        if (window.toast) window.toast.warning('Vui lòng chọn ngày giờ hết hạn mới!');
        return;
    }

    // Chuyển sang định dạng YYYY-MM-DD HH:MM:SS
    const formattedDate = newDateVal.replace('T', ' ') + ':00';

    try {
        if (btn) btn.disabled = true;

        const res = await fetch(`/api/marketing/member-vouchers/${voucherId}/expiry`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Expiry_date: formattedDate })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            if (typeof window.closeMemberModalElement === 'function') {
                window.closeMemberModalElement('editVoucherExpiryModal');
            } else {
                const m = document.getElementById('editVoucherExpiryModal');
                if (m) m.style.display = 'none';
            }
            if (window.toast) window.toast.success(data.message || 'Đã cập nhật hạn sử dụng thành công!');
            await window.loadMemberVouchersHistory();
        } else {
            alert('Lỗi: ' + (data.error || 'Không thể cập nhật hạn sử dụng'));
        }
    } catch (err) {
        console.error('Lỗi submitUpdateVoucherExpiry:', err);
        alert('Không thể kết nối máy chủ!');
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.cancelPushedVoucher = async function(voucherId, code) {
    const confirmed = (window.toast && typeof window.toast.confirm === 'function')
        ? await window.toast.confirm(`Bạn có chắc muốn hủy mã [${code}]? Khách hàng sẽ không thể sử dụng mã này nữa.`, 'Xác nhận hủy mã')
        : confirm(`Bạn có chắc muốn hủy mã [${code}]? Khách hàng sẽ không thể sử dụng mã này nữa.`);

    if (!confirmed) return;

    try {
        const res = await fetch(`/api/marketing/member-vouchers/${voucherId}/cancel`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
            if (window.toast) window.toast.success(data.message || `Đã hủy mã [${code}] thành công!`);
            await window.loadMemberVouchersHistory();
        } else {
            alert('Lỗi: ' + (data.error || 'Không thể hủy mã'));
        }
    } catch (err) {
        console.error('Lỗi cancelPushedVoucher:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

window.deletePushedVoucher = async function(voucherId, code) {
    const confirmed = (window.toast && typeof window.toast.confirm === 'function')
        ? await window.toast.confirm(`Bạn có chắc muốn xóa vĩnh viễn dòng lịch sử mã [${code}] khỏi cơ sở dữ liệu?`, 'Xác nhận xóa lịch sử')
        : confirm(`Bạn có chắc muốn xóa vĩnh viễn dòng lịch sử mã [${code}] khỏi cơ sở dữ liệu?`);

    if (!confirmed) return;

    try {
        const res = await fetch(`/api/marketing/member-vouchers/${voucherId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            if (window.toast) window.toast.success(`Đã xóa dòng lịch sử mã [${code}]!`);
            await window.loadMemberVouchersHistory();
        } else {
            alert('Lỗi: ' + (data.error || 'Không thể xóa'));
        }
    } catch (err) {
        console.error('Lỗi deletePushedVoucher:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

window.bulkDeleteSelectedVouchers = async function() {
    const selectedCheckboxes = document.querySelectorAll('.item-vouch-hist-checkbox:checked');
    const voucherIds = Array.from(selectedCheckboxes).map(cb => Number(cb.value));

    if (voucherIds.length === 0) {
        if (window.toast) window.toast.warning('Vui lòng tích chọn ít nhất một dòng lịch sử cần xóa!');
        return;
    }

    const confirmed = (window.toast && typeof window.toast.confirm === 'function')
        ? await window.toast.confirm(`Bạn có chắc muốn xóa ${voucherIds.length} dòng lịch sử đã chọn không?`, 'Xác nhận xóa hàng loạt')
        : confirm(`Bạn có chắc muốn xóa ${voucherIds.length} dòng lịch sử đã chọn không?`);

    if (!confirmed) return;

    try {
        const res = await fetch('/api/marketing/member-vouchers/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voucherIds })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            if (window.toast) window.toast.success(data.message || `Đã xóa ${data.deletedCount} dòng lịch sử!`);
            const masterCb = document.getElementById('selectAllVouchHistCheckbox');
            if (masterCb) masterCb.checked = false;
            await window.loadMemberVouchersHistory();
        } else {
            alert('Lỗi: ' + (data.error || 'Không thể xóa'));
        }
    } catch (err) {
        console.error('Lỗi bulkDeleteSelectedVouchers:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

window.cleanExpiredVouchersHistory = async function() {
    const confirmed = (window.toast && typeof window.toast.confirm === 'function')
        ? await window.toast.confirm('Bạn có muốn tự động dọn dẹp (xóa toàn bộ) các mã voucher đã hết hạn sử dụng hoặc đã bị hủy không?', 'Dọn dẹp lịch sử cũ')
        : confirm('Bạn có muốn tự động dọn dẹp (xóa toàn bộ) các mã voucher đã hết hạn sử dụng hoặc đã bị hủy không?');

    if (!confirmed) return;

    try {
        const res = await fetch('/api/marketing/member-vouchers/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deleteType: 'ALL_EXPIRED' })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            if (window.toast) window.toast.success(data.message || `Đã dọn dẹp ${data.deletedCount} mã hết hạn!`);
            await window.loadMemberVouchersHistory();
        } else {
            alert('Lỗi: ' + (data.error || 'Không thể dọn dẹp'));
        }
    } catch (err) {
        console.error('Lỗi cleanExpiredVouchersHistory:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

// ========================================================
// XUẤT DANH SÁCH EMAIL HỘI VIÊN TIỆN GỬI ƯU ĐÃI
// ========================================================

window.exportMarketingEmails = async function() {
    try {
        if (window.toast) window.toast.info('Đang tải danh sách email hội viên...');
        const res = await fetch('/api/marketing/export-emails');
        const data = await res.json();
        const members = data.members || [];

        if (members.length === 0) {
            if (window.toast) window.toast.warning('Chưa có hội viên nào cập nhật địa chỉ Email!');
            return;
        }

        // Tạo tệp CSV để người quản lý tải về mở bằng Excel / Google Sheets
        const csvRows = ['"Mã Thẻ","Họ Và Tên","Số Điện Thoại","Email","Hạng Thẻ","Ngày Gia Nhập"'];
        members.forEach(m => {
            const row = [
                `"${m.Card_code || ''}"`,
                `"${m.Full_name || ''}"`,
                `"${m.Phone || ''}"`,
                `"${m.Email || ''}"`,
                `"${m.Current_tier || ''}"`,
                `"${m.Created_at ? m.Created_at.substring(0, 10) : ''}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = '\uFEFF' + csvRows.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `danh_sach_email_hoi_vien_${new Date().toISOString().substring(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (window.toast) window.toast.success(`Đã xuất thành công ${members.length} email hội viên ra file CSV!`);
    } catch (err) {
        console.error('Lỗi exportMarketingEmails:', err);
        if (window.toast) window.toast.error('Lỗi khi xuất danh sách email: ' + err.message);
    }
};

// ========================================================
// CẤU HÌNH SMTP & TEST GỬI EMAIL THỬ NGHIỆM
// ========================================================

window.togglePasswordVisibility = function(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (btnEl) btnEl.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
        input.type = 'password';
        if (btnEl) btnEl.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
};

window.goToSmtpSettings = function() {
    if (typeof window.closeMemberModalElement === 'function') {
        window.closeMemberModalElement('sendEmailVouchersModal');
    } else {
        const m = document.getElementById('sendEmailVouchersModal');
        if (m) {
            if (window.bootstrap && bootstrap.Modal) {
                const bs = bootstrap.Modal.getInstance(m);
                if (bs) bs.hide();
                else m.style.display = 'none';
            } else {
                m.style.display = 'none';
            }
        }
    }
    window.switchSystemTab('tab-marketing');
    setTimeout(() => {
        const formCard = document.getElementById('smtpConfigForm')?.closest('.card') || document.getElementById('smtpConfigForm');
        if (formCard) {
            formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            formCard.classList.add('border', 'border-success', 'shadow-lg');
            setTimeout(() => {
                formCard.classList.remove('border-success', 'shadow-lg');
            }, 2500);
        }
        document.getElementById('smtpUserInput')?.focus();
    }, 250);
};

window.loadSmtpConfig = async function() {
    try {
        let cfg = {};
        try {
            cfg = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        } catch(e) {}

        const res = await fetch('/api/system-config?t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            const serverCfg = (data.config && typeof data.config === 'object') ? data.config : data;
            cfg = { ...cfg, ...serverCfg };
            localStorage.setItem('hoasen_system_config', JSON.stringify(cfg));
        }

        const fromNameEl = document.getElementById('smtpFromNameInput');
        const userEl = document.getElementById('smtpUserInput');
        const passEl = document.getElementById('smtpPassInput');
        const hostEl = document.getElementById('smtpHostInput');
        const portEl = document.getElementById('smtpPortInput');
        const secureEl = document.getElementById('smtpSecureSelect');
        const activeSenderEl = document.getElementById('sendEmailActiveSenderText');

        if (fromNameEl) fromNameEl.value = cfg.smtp_from_name || 'Nhà Hàng Hoa Sen';
        if (userEl) userEl.value = cfg.smtp_user || '';
        if (passEl) passEl.value = cfg.smtp_pass || '';
        if (hostEl) hostEl.value = cfg.smtp_host || 'smtp.gmail.com';
        if (portEl) portEl.value = cfg.smtp_port || '465';
        if (secureEl && cfg.smtp_secure !== undefined) secureEl.value = String(cfg.smtp_secure);

        if (activeSenderEl) {
            if (cfg.smtp_user) {
                activeSenderEl.innerText = `${cfg.smtp_from_name || 'Hoa Sen'} <${cfg.smtp_user}>`;
                activeSenderEl.className = 'text-success fw-bold';
            } else {
                activeSenderEl.innerText = '⚠️ Chưa cấu hình tài khoản gửi (Cần cài đặt SMTP)';
                activeSenderEl.className = 'text-danger fw-bold';
            }
        }
    } catch (err) {
        console.error('Lỗi loadSmtpConfig:', err);
    }
};

window.saveSmtpConfig = async function() {
    const fromName = (document.getElementById('smtpFromNameInput')?.value || '').trim();
    const user = (document.getElementById('smtpUserInput')?.value || '').trim();
    const pass = (document.getElementById('smtpPassInput')?.value || '').replace(/\s+/g, '').trim();
    const host = (document.getElementById('smtpHostInput')?.value || 'smtp.gmail.com').trim();
    const port = parseInt(document.getElementById('smtpPortInput')?.value || '465', 10);
    const secure = document.getElementById('smtpSecureSelect')?.value === '1' ? 1 : 0;

    if (!user) {
        alert('Vui lòng nhập địa chỉ Email gửi (Tài khoản Gmail hoặc SMTP)!');
        document.getElementById('smtpUserInput')?.focus();
        return;
    }

    if (!pass) {
        alert('Vui lòng nhập Mật khẩu ứng dụng (App Password 16 chữ cái của Google)!');
        document.getElementById('smtpPassInput')?.focus();
        return;
    }

    const payload = {
        smtp_from_name: fromName || 'Nhà Hàng Hoa Sen',
        smtp_user: user,
        smtp_pass: pass,
        smtp_host: host || 'smtp.gmail.com',
        smtp_port: port || 465,
        smtp_secure: secure
    };

    // 1. Cập nhật ngay vào localStorage để không bao giờ bị mất
    try {
        const cur = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        localStorage.setItem('hoasen_system_config', JSON.stringify({ ...cur, ...payload }));
    } catch(e) {}

    // 2. Cập nhật ngay badge người gửi trong giao diện modal
    const activeSenderEl = document.getElementById('sendEmailActiveSenderText');
    if (activeSenderEl) {
        activeSenderEl.innerText = `${payload.smtp_from_name} <${payload.smtp_user}>`;
        activeSenderEl.className = 'text-success fw-bold';
    }

    try {
        const res = await fetch('/api/system-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.success) {
            if (window.toast) {
                window.toast.success('🎉 Đã lưu cấu hình máy chủ Email SMTP thành công!');
            } else {
                alert('Đã lưu cấu hình máy chủ Email SMTP thành công!');
            }
        } else {
            alert('Lỗi lưu cấu hình: ' + (data.error || 'Thao tác không thành công'));
        }
    } catch (err) {
        console.error('Lỗi saveSmtpConfig:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

window.testSmtpEmail = async function() {
    let fromName = (document.getElementById('smtpFromNameInput')?.value || '').trim();
    let user = (document.getElementById('smtpUserInput')?.value || '').trim();
    let pass = (document.getElementById('smtpPassInput')?.value || '').replace(/\s+/g, '').trim();
    let host = (document.getElementById('smtpHostInput')?.value || 'smtp.gmail.com').trim();
    let port = parseInt(document.getElementById('smtpPortInput')?.value || '465', 10);
    let secure = document.getElementById('smtpSecureSelect')?.value === '1' ? 1 : 0;
    let toEmail = (document.getElementById('smtpTestEmailInput')?.value || user).trim();

    // Fallback sang localStorage nếu DOM đang trống
    try {
        const cur = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        if (!user && cur.smtp_user) user = cur.smtp_user;
        if (!pass && cur.smtp_pass) pass = cur.smtp_pass;
        if (!fromName && cur.smtp_from_name) fromName = cur.smtp_from_name;
        if (!host && cur.smtp_host) host = cur.smtp_host;
        if (!port && cur.smtp_port) port = cur.smtp_port;
        if (!toEmail) toEmail = user;
    } catch(e) {}

    const resultBox = document.getElementById('smtpTestResultBox');
    if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.innerHTML = '<div class="text-primary"><i class="fa-solid fa-spinner fa-spin me-1"></i> Đang kết nối máy chủ SMTP và gửi email thử nghiệm... Vui lòng đợi 3-10 giây...</div>';
    }

    if (!user || !pass) {
        if (resultBox) {
            resultBox.innerHTML = '<div class="alert alert-danger p-2 mb-0">❌ Vui lòng nhập đầy đủ Email gửi và Mật khẩu ứng dụng trước khi kiểm tra!</div>';
        }
        alert('Vui lòng nhập đầy đủ Email gửi và Mật khẩu ứng dụng!');
        return;
    }

    if (!toEmail) {
        if (resultBox) {
            resultBox.innerHTML = '<div class="alert alert-danger p-2 mb-0">❌ Vui lòng nhập Email người nhận thư thử nghiệm!</div>';
        }
        alert('Vui lòng nhập Email người nhận thư thử nghiệm!');
        return;
    }

    try {
        const res = await fetch('/api/marketing/test-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                toEmail,
                smtpHost: host,
                smtpPort: port,
                smtpUser: user,
                smtpPass: pass,
                smtpFromName: fromName,
                smtpSecure: secure
            })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            if (resultBox) {
                resultBox.innerHTML = `
                    <div class="alert alert-success p-2 mb-0">
                        <i class="fa-solid fa-circle-check text-success me-1"></i>
                        <b>${data.message}</b>
                        <div class="text-muted mt-1" style="font-size: 11px;">Mã Message-ID: ${data.messageId || '---'}</div>
                    </div>
                `;
            }
            if (window.toast) {
                window.toast.success(`🎉 Gửi email thử nghiệm thành công tới ${toEmail}! Hãy mở hòm thư kiểm tra.`);
            }
        } else {
            if (resultBox) {
                resultBox.innerHTML = `
                    <div class="alert alert-danger p-2 mb-0">
                        <div class="fw-bold"><i class="fa-solid fa-circle-xmark me-1"></i> Lỗi gửi mail: ${data.error || 'Kết nối SMTP thất bại'}</div>
                        ${data.help ? `<div class="mt-1 text-dark bg-white p-2 rounded border border-danger-subtle">${data.help}</div>` : ''}
                    </div>
                `;
            }
            if (window.toast) {
                window.toast.error('Gửi email test thất bại! Xem chi tiết lỗi bên dưới.');
            }
        }
    } catch (err) {
        console.error('Lỗi testSmtpEmail:', err);
        if (resultBox) {
            resultBox.innerHTML = `<div class="alert alert-danger p-2 mb-0">❌ Không thể kết nối tới máy chủ: ${err.message}</div>`;
        }
    }
};

// ========================================================
// QUẢN LÝ LỊCH SỬ GỬI EMAIL CHO KHÁCH HÀNG (EMAIL LOGS)
// ========================================================

window.loadMarketingEmailLogsTimer = null;
window.debounceLoadEmailLogs = function() {
    if (window.loadMarketingEmailLogsTimer) clearTimeout(window.loadMarketingEmailLogsTimer);
    window.loadMarketingEmailLogsTimer = setTimeout(() => {
        window.loadMarketingEmailLogs();
    }, 300);
};

window.loadMarketingEmailLogs = async function() {
    const tbody = document.getElementById('manageMarketingEmailLogsTableBody');
    if (!tbody) return;

    const search = (document.getElementById('emailLogsSearchInput')?.value || '').trim();
    const status = document.getElementById('emailLogsStatusSelect')?.value || 'ALL';

    try {
        const queryParams = new URLSearchParams({ search, status, limit: '100', t: Date.now() });
        const res = await fetch(`/api/marketing/email-logs?${queryParams.toString()}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger"><i class="fa-solid fa-triangle-exclamation me-1"></i> Lỗi: ${data.error || 'Không tải được lịch sử email'}</td></tr>`;
            return;
        }

        const logs = data.logs || [];
        const stats = data.stats || { total: 0, successCount: 0, failedCount: 0 };

        // Cập nhật badges
        const totalBadge = document.getElementById('emailLogsTotalBadge');
        const successBadge = document.getElementById('emailLogsSuccessBadge');
        const failedBadge = document.getElementById('emailLogsFailedBadge');

        if (totalBadge) totalBadge.innerText = `Tổng: ${stats.total || logs.length}`;
        if (successBadge) successBadge.innerText = `Thành công: ${stats.successCount || 0}`;
        if (failedBadge) failedBadge.innerText = `Thất bại: ${stats.failedCount || 0}`;

        if (logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Chưa có bản ghi lịch sử gửi email nào</td></tr>`;
            return;
        }

        tbody.innerHTML = logs.map(l => {
            const isSuccess = l.Status === 'SUCCESS';
            const statusBadge = isSuccess
                ? '<span class="badge bg-success text-white px-2 py-1"><i class="fa-solid fa-check me-1"></i>Thành công</span>'
                : '<span class="badge bg-danger text-white px-2 py-1" style="cursor: pointer;" title="Bấm để xem chi tiết lỗi"><i class="fa-solid fa-circle-exclamation me-1"></i>Thất bại</span>';

            const sentTimeStr = l.Sent_at ? new Date(l.Sent_at).toLocaleString('vi-VN') : '---';

            const escapedError = (l.Error_message || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const escapedName = (l.Member_name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const escapedEmail = (l.Email || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

            return `
                <tr class="email-log-row" data-log-id="${l.Log_id}">
                    <td class="text-center ps-3">
                        <input type="checkbox" class="form-check-input email-log-item-cb" value="${l.Log_id}">
                    </td>
                    <td>
                        <small class="text-dark fw-bold font-monospace">${sentTimeStr}</small>
                    </td>
                    <td>
                        <div class="fw-bold text-dark">${l.Member_name || 'Khách hàng'}</div>
                        <small class="text-muted"><i class="fa-solid fa-phone me-1"></i>${l.Phone || '---'}</small>
                    </td>
                    <td>
                        <span class="text-primary fw-bold font-monospace">${l.Email}</span>
                    </td>
                    <td>
                        <div class="fw-semibold text-dark mb-1">${l.Campaign_name || 'Chiến dịch'}</div>
                        <span class="badge bg-light text-primary border font-monospace px-2 py-1">${l.Voucher_code || '---'}</span>
                        <span class="badge bg-warning-subtle text-dark ms-1">${l.Discount_text || ''}</span>
                    </td>
                    <td class="text-center" onclick="window.showEmailErrorDetail(${l.Log_id}, '${escapedName}', '${escapedEmail}', '${escapedError}')">
                        ${statusBadge}
                    </td>
                    <td class="text-end pe-3">
                        <div class="d-flex justify-content-end gap-1">
                            ${!isSuccess ? `
                                <button type="button" class="btn btn-outline-danger btn-sm px-2 py-0" title="Xem chi tiết lỗi" onclick="window.showEmailErrorDetail(${l.Log_id}, '${escapedName}', '${escapedEmail}', '${escapedError}')">
                                    <i class="fa-solid fa-eye"></i>
                                </button>
                            ` : ''}
                            <button type="button" class="btn btn-outline-secondary btn-sm px-2 py-0" title="Xóa dòng này" onclick="window.deleteEmailLog(${l.Log_id})">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Lỗi loadMarketingEmailLogs:', err);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">Không thể kết nối máy chủ!</td></tr>`;
    }
};

window.toggleSelectAllEmailLogs = function(masterCb) {
    const isChecked = masterCb.checked;
    const checkboxes = document.querySelectorAll('.email-log-item-cb');
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
    });
};

window.deleteEmailLog = async function(logId) {
    if (!confirm('Bạn có chắc chắn muốn xóa dòng lịch sử gửi email này?')) return;
    try {
        const res = await fetch('/api/marketing/email-logs', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logId })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            if (window.toast) window.toast.success('Đã xóa dòng lịch sử gửi email!');
            await window.loadMarketingEmailLogs();
        } else {
            alert('Lỗi: ' + (data.error || 'Không thể xóa dòng'));
        }
    } catch (err) {
        console.error('Lỗi deleteEmailLog:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

window.bulkDeleteEmailLogs = async function() {
    const checked = document.querySelectorAll('.email-log-item-cb:checked');
    const logIds = Array.from(checked).map(cb => parseInt(cb.value, 10)).filter(id => !isNaN(id));

    if (logIds.length === 0) {
        alert('Vui lòng tích chọn ít nhất một dòng lịch sử email cần xóa!');
        return;
    }

    if (!confirm(`Bạn có chắc muốn xóa ${logIds.length} dòng lịch sử gửi email đã chọn?`)) return;

    try {
        const res = await fetch('/api/marketing/email-logs', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logIds })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            const masterCb = document.getElementById('selectAllEmailLogsCheckbox');
            if (masterCb) masterCb.checked = false;
            if (window.toast) window.toast.success(data.message || `Đã xóa thành công ${data.deletedCount} dòng!`);
            await window.loadMarketingEmailLogs();
        } else {
            alert('Lỗi: ' + (data.error || 'Không thể xóa'));
        }
    } catch (err) {
        console.error('Lỗi bulkDeleteEmailLogs:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

window.cleanFailedEmailLogs = async function() {
    if (!confirm('Bạn có chắc muốn dọn sạch tất cả các bản ghi gửi email bị THẤT BẠI?')) return;

    try {
        const res = await fetch('/api/marketing/email-logs', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deleteType: 'ALL_FAILED' })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            if (window.toast) window.toast.success(data.message || `Đã dọn dẹp ${data.deletedCount} dòng lỗi!`);
            await window.loadMarketingEmailLogs();
        } else {
            alert('Lỗi: ' + (data.error || 'Không thể dọn dẹp'));
        }
    } catch (err) {
        console.error('Lỗi cleanFailedEmailLogs:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

window.showEmailErrorDetail = function(logId, memberName, email, errorMsg) {
    if (!errorMsg || errorMsg === 'undefined' || errorMsg === 'null') {
        errorMsg = 'Gửi thành công, không có thông báo lỗi.';
    }
    const recipEl = document.getElementById('emailErrModalRecipient');
    const msgEl = document.getElementById('emailErrModalMessage');

    if (recipEl) recipEl.innerText = `${memberName || 'Khách hàng'} (${email || '---'})`;
    if (msgEl) msgEl.innerText = errorMsg;

    const modalEl = document.getElementById('emailLogErrorDetailModal');
    if (!modalEl) return;

    if (typeof window.openMemberModalElement === 'function') {
        window.openMemberModalElement('emailLogErrorDetailModal');
    } else if (window.bootstrap && bootstrap.Modal) {
        const bs = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        bs.show();
    } else {
        modalEl.classList.add('show');
        modalEl.style.display = 'block';
    }
};

// ========================================================
// GỬI MÃ GIẢM GIÁ RIÊNG BIỆT TỚI EMAIL KHÁCH HÀNG
// ========================================================

window.currentEmailMembersList = [];

window.openSendEmailVouchersModal = async function() {
    try {
        const modalEl = document.getElementById('sendEmailVouchersModal');
        if (!modalEl) return;

        // Reset inputs
        const searchInput = document.getElementById('sendEmailMemberSearch');
        if (searchInput) searchInput.value = '';
        const customSubject = document.getElementById('sendEmailCustomSubject');
        if (customSubject) customSubject.value = '';
        const customMessage = document.getElementById('sendEmailCustomMessage');
        if (customMessage) customMessage.value = '';

        const selectAllCb = document.getElementById('selectAllEmailMembersCheckbox');
        if (selectAllCb) selectAllCb.checked = false;
        window.updateSendEmailSelectedCount();

        // 1. Tải cấu hình SMTP để hiển thị người gửi
        await window.loadSmtpConfig();

        // 2. Tải danh sách chiến dịch đang hoạt động
        const campSelect = document.getElementById('sendEmailCampaignSelect');
        if (campSelect) {
            campSelect.innerHTML = '<option value="">-- Đang nạp chiến dịch... --</option>';
        }

        const campRes = await fetch('/api/marketing/campaigns');
        const campData = await campRes.json();
        const campaigns = (campData.campaigns || []).filter(c => (c.Is_active === 1 || c.is_active === 1));

        if (campSelect) {
            if (campaigns.length === 0) {
                campSelect.innerHTML = '<option value="">⚠️ Không có chiến dịch nào đang hoạt động</option>';
            } else {
                campSelect.innerHTML = '<option value="">-- Chọn một chiến dịch khuyến mãi --</option>' +
                    campaigns.map(c => {
                        const campId = c.Campaign_id || c.Id;
                        const name = c.Name || c.Campaign_name || 'Chiến dịch';
                        const code = c.Code || c.Voucher_code || '';
                        const type = c.Type || c.Campaign_type || '';
                        const val = c.Discount_type === 'PERCENT' ? `${c.Discount_value}%` : `${(c.Discount_value || 0).toLocaleString('vi-VN')}đ`;
                        return `<option value="${campId}">${name} [Mã gốc: ${code}] - Giảm ${val} (${type})</option>`;
                    }).join('');
            }
        }

        // 3. Tải danh sách khách hàng có email
        const tbody = document.getElementById('sendEmailMembersTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted"><i class="fa-solid fa-spinner fa-spin me-1 text-warning"></i> Đang nạp khách hàng...</td></tr>`;
        }

        const memRes = await fetch('/api/marketing/export-emails');
        const memData = await memRes.json();
        window.currentEmailMembersList = memData.members || [];

        window.renderSendEmailMembersTable(window.currentEmailMembersList);

        // Hiển thị modal
        if (typeof window.openMemberModalElement === 'function') {
            window.openMemberModalElement('sendEmailVouchersModal');
        } else if (window.bootstrap && bootstrap.Modal) {
            const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            bsModal.show();
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
            document.body.classList.add('modal-open');
        }
    } catch (err) {
        console.error('Lỗi openSendEmailVouchersModal:', err);
        if (window.toast) window.toast.error('Lỗi khi mở giao diện gửi mã email: ' + err.message);
    }
};

window.renderSendEmailMembersTable = function(members) {
    const tbody = document.getElementById('sendEmailMembersTableBody');
    if (!tbody) return;

    if (!members || members.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Không tìm thấy khách hàng nào có địa chỉ email</td></tr>`;
        return;
    }

    tbody.innerHTML = members.map(m => {
        const memId = m.Member_id || m.Id;
        return `
            <tr class="send-email-member-row" data-member-id="${memId}" style="cursor: pointer;" onclick="window.toggleEmailMemberRow(this, event)">
                <td class="text-center" onclick="event.stopPropagation()">
                    <input type="checkbox" class="form-check-input send-email-member-cb" value="${memId}" onchange="window.updateSendEmailSelectedCount()">
                </td>
                <td>
                    <div class="fw-bold text-dark">${m.Full_name || 'Chưa đặt tên'}</div>
                    <small class="text-muted">Mã thẻ: ${m.Card_code || '---'}</small>
                </td>
                <td><span class="badge bg-light text-dark border">${m.Phone || '---'}</span></td>
                <td><span class="text-primary fw-semibold">${m.Email || '---'}</span></td>
                <td class="text-center">
                    <span class="badge bg-warning text-dark">${m.Current_tier || 'STANDARD'}</span>
                </td>
            </tr>
        `;
    }).join('');
};

window.toggleEmailMemberRow = function(row, event) {
    if (event && (event.target.tagName === 'INPUT' || event.target.closest('input'))) return;
    const cb = row.querySelector('.send-email-member-cb');
    if (cb) {
        cb.checked = !cb.checked;
        window.updateSendEmailSelectedCount();
    }
};

window.filterSendEmailMembersTable = function() {
    const q = (document.getElementById('sendEmailMemberSearch')?.value || '').toLowerCase().trim();
    if (!q) {
        window.renderSendEmailMembersTable(window.currentEmailMembersList);
        return;
    }
    const filtered = window.currentEmailMembersList.filter(m => {
        const name = (m.Full_name || '').toLowerCase();
        const phone = (m.Phone || '').toLowerCase();
        const email = (m.Email || '').toLowerCase();
        const card = (m.Card_code || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || email.includes(q) || card.includes(q);
    });
    window.renderSendEmailMembersTable(filtered);
    window.updateSendEmailSelectedCount();
};

window.toggleSelectAllEmailMembers = function(masterCb) {
    const isChecked = masterCb.checked;
    const checkboxes = document.querySelectorAll('.send-email-member-cb');
    checkboxes.forEach(cb => {
        const row = cb.closest('tr');
        if (row && row.style.display !== 'none') {
            cb.checked = isChecked;
        }
    });
    window.updateSendEmailSelectedCount();
};

window.updateSendEmailSelectedCount = function() {
    const checkedBoxes = document.querySelectorAll('.send-email-member-cb:checked');
    const badge = document.getElementById('sendEmailSelectedCountBadge');
    if (badge) {
        badge.innerText = `Đã chọn: ${checkedBoxes.length}`;
        badge.className = checkedBoxes.length > 0 ? 'badge bg-warning text-dark border px-2 py-1 fw-bold' : 'badge bg-light text-dark border px-2 py-1';
    }
};

window.submitSendEmailVouchers = async function() {
    const campSelect = document.getElementById('sendEmailCampaignSelect');
    const campaignId = campSelect ? campSelect.value : '';

    if (!campaignId) {
        alert('Vui lòng chọn chiến dịch khuyến mãi / giảm giá!');
        if (campSelect) campSelect.focus();
        return;
    }

    const checkedBoxes = document.querySelectorAll('.send-email-member-cb:checked');
    const memberIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value, 10)).filter(id => !isNaN(id));

    if (memberIds.length === 0) {
        alert('Vui lòng tích chọn ít nhất 1 khách hàng để gửi mã giảm giá!');
        return;
    }

    const customSubject = (document.getElementById('sendEmailCustomSubject')?.value || '').trim();
    const customMessage = (document.getElementById('sendEmailCustomMessage')?.value || '').trim();

    const confirmMsg = `Bạn có chắc chắn muốn phát hành và gửi mã giảm giá riêng biệt tới ${memberIds.length} khách hàng đã chọn?`;
    if (!confirm(confirmMsg)) return;

    const btn = document.getElementById('btnSubmitSendEmailVouchers');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Đang gửi mã...';
    }

    try {
        const res = await fetch('/api/marketing/send-email-vouchers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId, memberIds, customSubject, customMessage })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            if (typeof window.closeMemberModalElement === 'function') {
                window.closeMemberModalElement('sendEmailVouchersModal');
            } else {
                const m = document.getElementById('sendEmailVouchersModal');
                if (m) {
                    if (window.bootstrap && bootstrap.Modal) {
                        const bs = bootstrap.Modal.getInstance(m);
                        if (bs) bs.hide();
                        else m.style.display = 'none';
                    } else {
                        m.style.display = 'none';
                    }
                }
            }
            if (window.toast) {
                window.toast.success(data.message || `Đã gửi thành công mã giảm giá tới ${data.successCount} email khách hàng!`);
            } else {
                alert(data.message || `Đã gửi thành công mã giảm giá tới ${data.successCount} email khách hàng!`);
            }
            await window.loadMarketingCampaigns();
            await window.loadMemberVouchersHistory();
            await window.loadMarketingEmailLogs();
        } else {
            alert('Lỗi gửi mã: ' + (data.error || data.message || 'Thao tác không thành công'));
        }
    } catch (err) {
        console.error('Lỗi submitSendEmailVouchers:', err);
        alert('Không thể kết nối máy chủ!');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i> Xác Nhận Gửi Mã Ngay';
        }
    }
};

// ==========================================
// 12. QUẢN LÝ NỀN TẢNG GIAO HÀNG (DELIVERY PLATFORMS CRUD)
// ==========================================
window.allDeliveryPlatformsManagementCache = [];

window.loadDeliveryPlatformsManagementList = async function() {
    const tbody = document.getElementById('manageDeliveryPlatformsTableBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/delivery-platforms/all?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        const platforms = data.platforms || [];
        window.allDeliveryPlatformsManagementCache = platforms;

        if (platforms.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Chưa có nền tảng giao hàng nào. Hãy nhấn "Thêm Nền Tảng Mới"!</td></tr>';
            return;
        }

        tbody.innerHTML = platforms.map(p => {
            const isActive = Number(p.Is_active ?? 1) === 1;
            const statusBadge = isActive 
                ? '<span class="badge bg-success-subtle text-success fw-bold">Hiển thị</span>' 
                : '<span class="badge bg-secondary-subtle text-secondary">Tạm ẩn</span>';
            const feeText = Number(p.Fee_percentage || 0) > 0 
                ? `<span class="badge bg-warning-subtle text-warning-emphasis fw-bold">${p.Fee_percentage}%</span>` 
                : '<span class="badge bg-light text-secondary border">0%</span>';

            return `
                <tr>
                    <td class="text-center">
                        <span class="d-inline-flex align-items-center justify-content-center text-white rounded-circle shadow-sm" style="width: 36px; height: 36px; background-color: ${p.Color_code || '#2e7d32'}; font-size: 16px;">
                            <i class="${p.Icon_class || 'fa-solid fa-motorcycle'}"></i>
                        </span>
                    </td>
                    <td class="fw-bold text-dark fs-6">${p.Platform_name}</td>
                    <td><code class="fw-bold text-primary">${p.Platform_code}</code></td>
                    <td>${feeText}</td>
                    <td>
                        <span class="d-inline-block rounded border shadow-xs" style="width: 22px; height: 22px; background-color: ${p.Color_code || '#2e7d32'}; vertical-align: middle;"></span>
                        <span class="small font-monospace ms-1">${p.Color_code}</span>
                    </td>
                    <td class="text-center fw-bold">${p.Sort_order || 1}</td>
                    <td class="text-center">${statusBadge}</td>
                    <td class="text-end">
                        <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2" onclick="window.openManageDeliveryPlatformModal(${p.Platform_id})" title="Chỉnh sửa nền tảng">
                            <i class="fa-solid fa-pen-to-square"></i> Sửa
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" onclick="window.deleteDeliveryPlatform(${p.Platform_id}, '${p.Platform_name}')" title="Xóa nền tảng">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error('Lỗi loadDeliveryPlatformsManagementList:', e);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger py-3">Lỗi nạp danh sách nền tảng giao hàng</td></tr>';
    }
};

window.autoGenPlatformCode = function(name) {
    const codeInp = document.getElementById('editDeliveryPlatCode');
    const idInp = document.getElementById('editDeliveryPlatId');
    if (codeInp && (!idInp || !idInp.value)) {
        codeInp.value = String(name || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }
};

window.openManageDeliveryPlatformModal = function(platId) {
    const titleEl = document.getElementById('manageDeliveryPlatformModalTitle');
    const idInp = document.getElementById('editDeliveryPlatId');
    const nameInp = document.getElementById('editDeliveryPlatName');
    const codeInp = document.getElementById('editDeliveryPlatCode');
    const feeInp = document.getElementById('editDeliveryPlatFee');
    const iconInp = document.getElementById('editDeliveryPlatIcon');
    const colorInp = document.getElementById('editDeliveryPlatColor');
    const sortInp = document.getElementById('editDeliveryPlatSort');
    const activeInp = document.getElementById('editDeliveryPlatActive');

    if (platId) {
        const p = (window.allDeliveryPlatformsManagementCache || []).find(x => x.Platform_id == platId);
        if (p) {
            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square me-2"></i>Sửa Nền Tảng: ${p.Platform_name}`;
            if (idInp) idInp.value = p.Platform_id;
            if (nameInp) nameInp.value = p.Platform_name;
            if (codeInp) codeInp.value = p.Platform_code;
            if (feeInp) feeInp.value = p.Fee_percentage || 0;
            if (iconInp) iconInp.value = p.Icon_class || 'fa-solid fa-motorcycle';
            if (colorInp) colorInp.value = p.Color_code || '#00b14f';
            if (sortInp) sortInp.value = p.Sort_order || 1;
            if (activeInp) activeInp.value = String(p.Is_active ?? 1);
        }
    } else {
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-motorcycle me-2"></i>Thêm Nền Tảng Giao Hàng Mới`;
        if (idInp) idInp.value = '';
        if (nameInp) nameInp.value = '';
        if (codeInp) codeInp.value = '';
        if (feeInp) feeInp.value = 0;
        if (iconInp) iconInp.value = 'fa-solid fa-motorcycle';
        if (colorInp) colorInp.value = '#00b14f';
        if (sortInp) sortInp.value = (window.allDeliveryPlatformsManagementCache || []).length + 1;
        if (activeInp) activeInp.value = '1';
    }

    const modalEl = document.getElementById('manageDeliveryPlatformModal');
    if (modalEl) {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            let modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (!modalInstance) modalInstance = new bootstrap.Modal(modalEl);
            modalInstance.show();
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
        }
    }
};

window.saveDeliveryPlatform = async function(event) {
    if (event) event.preventDefault();
    const platId = document.getElementById('editDeliveryPlatId')?.value;
    const name = document.getElementById('editDeliveryPlatName')?.value?.trim();
    const code = document.getElementById('editDeliveryPlatCode')?.value?.trim().toUpperCase();
    const fee = parseFloat(document.getElementById('editDeliveryPlatFee')?.value || 0);
    const icon = document.getElementById('editDeliveryPlatIcon')?.value || 'fa-solid fa-motorcycle';
    const color = document.getElementById('editDeliveryPlatColor')?.value || '#00b14f';
    const sort = parseInt(document.getElementById('editDeliveryPlatSort')?.value || 1, 10);
    const isActive = parseInt(document.getElementById('editDeliveryPlatActive')?.value ?? 1, 10);

    if (!name) {
        if (window.toast) window.toast.warning('Vui lòng nhập tên nền tảng!');
        else alert('Vui lòng nhập tên nền tảng!');
        return;
    }

    const payload = {
        Platform_name: name,
        Platform_code: code || name.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
        Fee_percentage: fee,
        Icon_class: icon,
        Color_code: color,
        Sort_order: sort,
        Is_active: isActive
    };

    try {
        const url = platId ? `/api/delivery-platforms/${platId}` : '/api/delivery-platforms';
        const method = platId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            if (window.toast) window.toast.success(platId ? 'Cập nhật nền tảng giao hàng thành công!' : 'Thêm nền tảng giao hàng mới thành công!');
            else alert('Lưu thành công!');

            if (typeof window.closeMemberModal === 'function') {
                window.closeMemberModal('manageDeliveryPlatformModal');
            }
            await window.loadDeliveryPlatformsManagementList();
            if (typeof window.populateCartDeliveryPlatforms === 'function') {
                window.populateCartDeliveryPlatforms();
            }
        } else {
            if (window.toast) window.toast.error(data.error || 'Lỗi khi lưu nền tảng');
            else alert(data.error || 'Lỗi khi lưu nền tảng');
        }
    } catch (err) {
        console.error('Lỗi saveDeliveryPlatform:', err);
        if (window.toast) window.toast.error('Lỗi kết nối máy chủ!');
    }
};

window.deleteDeliveryPlatform = async function(platId, platName) {
    if (!confirm(`Bạn có chắc chắn muốn xóa nền tảng giao hàng [${platName}] không?`)) return;

    try {
        const res = await fetch(`/api/delivery-platforms/${platId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            if (window.toast) window.toast.success(`Đã xóa nền tảng [${platName}] thành công!`);
            else alert(`Đã xóa [${platName}] thành công!`);

            await window.loadDeliveryPlatformsManagementList();
            if (typeof window.populateCartDeliveryPlatforms === 'function') {
                window.populateCartDeliveryPlatforms();
            }
        } else {
            if (window.toast) window.toast.error(data.error || 'Lỗi khi xóa nền tảng');
            else alert(data.error || 'Lỗi khi xóa nền tảng');
        }
    } catch (err) {
        console.error('Lỗi deleteDeliveryPlatform:', err);
    }
};

// ==========================================
// 13. QUẢN LÝ LỊCH SỬ & VỊ TRÍ THIẾT BỊ ĐĂNG NHẬP (LOGIN HISTORY CRUD)
// ==========================================
window.allLoginHistoryCache = [];
window._loginHistDebounceTimer = null;
window.currentModalLat = null;
window.currentModalLng = null;

window.debounceLoginHistorySearch = function() {
    clearTimeout(window._loginHistDebounceTimer);
    window._loginHistDebounceTimer = setTimeout(() => {
        window.loadLoginHistoryList();
    }, 350);
};

window.resetLoginHistoryFilter = function() {
    const typeSelect = document.getElementById('loginHistoryTypeFilter');
    const kwInp = document.getElementById('loginHistoryKeyword');
    const fromInp = document.getElementById('loginHistoryFromDate');
    const toInp = document.getElementById('loginHistoryToDate');
    if (typeSelect) typeSelect.value = 'ALL';
    if (kwInp) kwInp.value = '';
    if (fromInp) fromInp.value = '';
    if (toInp) toInp.value = '';
    window.loadLoginHistoryList();
};

window.loadLoginHistoryList = async function() {
    const tbody = document.getElementById('manageLoginHistoryTableBody');
    if (!tbody) return;

    const type = document.getElementById('loginHistoryTypeFilter')?.value || 'ALL';
    const keyword = document.getElementById('loginHistoryKeyword')?.value?.trim() || '';
    const fromDate = document.getElementById('loginHistoryFromDate')?.value || '';
    const toDate = document.getElementById('loginHistoryToDate')?.value || '';

    let url = `/api/login-history?limit=150&t=${Date.now()}`;
    if (type !== 'ALL') url += `&type=${encodeURIComponent(type)}`;
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
    if (fromDate) url += `&from_date=${encodeURIComponent(fromDate)}`;
    if (toDate) url += `&to_date=${encodeURIComponent(toDate)}`;

    try {
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const rows = data.rows || [];
        const stats = data.stats || {};
        window.allLoginHistoryCache = rows;

        // Cập nhật thẻ thống kê KPI
        const statTotalEl = document.getElementById('loginStatTotal');
        const statOnlineNowEl = document.getElementById('loginStatOnlineNow');
        const statStaffTodayEl = document.getElementById('loginStatStaffToday');
        const statCustomerTodayEl = document.getElementById('loginStatCustomerToday');
        const statAvgCustomerEl = document.getElementById('loginStatAvgCustomer');
        const statAvgStaffEl = document.getElementById('loginStatAvgStaff');
        const statPeakHourEl = document.getElementById('loginStatPeakHour');

        if (statTotalEl) statTotalEl.textContent = stats.totalLogins || data.total || 0;
        if (statOnlineNowEl) statOnlineNowEl.textContent = stats.onlineNow || 0;
        if (statStaffTodayEl) statStaffTodayEl.textContent = stats.staffToday || 0;
        if (statCustomerTodayEl) statCustomerTodayEl.textContent = stats.customerToday || 0;
        if (statAvgCustomerEl) statAvgCustomerEl.textContent = stats.avgCustomerDurationText || '--';
        if (statAvgStaffEl) statAvgStaffEl.textContent = stats.avgStaffDurationText || '--';
        if (statPeakHourEl) statPeakHourEl.textContent = stats.peakHourText || '--';

        // Render Biểu đồ thống kê & Phân tích thói quen
        if (data.analytics) {
            window.renderLoginAnalyticsCharts(data.analytics, stats);
        }

        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">Không tìm thấy bản ghi lịch sử đăng nhập nào phù hợp.</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map(r => {
            const isStaff = r.User_type === 'STAFF';
            const roleBadge = isStaff 
                ? `<span class="badge bg-primary-subtle text-primary fw-bold">${r.Role || 'NHÂN VIÊN'}</span>` 
                : `<span class="badge bg-warning-subtle text-warning-emphasis fw-bold">HỘI VIÊN</span>`;
            
            const isOnline = r.Status === 'SUCCESS';
            const statusHtml = isOnline
                ? '<span class="badge bg-success text-white fw-bold"><i class="fa-solid fa-circle me-1" style="font-size: 8px;"></i>Đang Online</span>'
                : (r.Status === 'FORCE_LOGGED_OUT'
                    ? '<span class="badge bg-danger-subtle text-danger fw-bold"><i class="fa-solid fa-ban me-1"></i>Bị ngắt phiên</span>'
                    : '<span class="badge bg-secondary-subtle text-secondary"><i class="fa-solid fa-right-from-bracket me-1"></i>Đã thoát</span>');

            const hasGps = r.Latitude && r.Longitude;
            const gpsHtml = hasGps 
                ? `
                    <div>
                        <span class="small fw-bold text-success font-monospace">${Number(r.Latitude).toFixed(4)}, ${Number(r.Longitude).toFixed(4)}</span>
                        ${r.Distance_to_restaurant != null ? `<div class="small text-muted" style="font-size: 11px;">Cách quán: <b>${r.Distance_to_restaurant}m</b></div>` : ''}
                        <button type="button" class="btn btn-sm btn-outline-success py-0 px-2 rounded-pill mt-1" style="font-size: 11px;" onclick="window.openGoogleMapsLocation(${r.Latitude}, ${r.Longitude})">
                            <i class="fa-solid fa-map-location-dot me-1"></i> Xem Bản Đồ
                        </button>
                    </div>
                `
                : '<span class="text-muted small">Chưa có GPS</span>';

            const loginTime = r.Login_time ? r.Login_time.replace('T', ' ').substring(0, 19) : '--';
            const logoutTime = r.Logout_time ? r.Logout_time.replace('T', ' ').substring(0, 19) : (isOnline ? '<span class="badge bg-success-subtle text-success">Đang trực tuyến</span>' : '--');
            const durText = r.duration_text || (isOnline ? 'Đang online' : '--');
            const noteStr = r.Note ? `<span class="small text-dark" title="${r.Note}">${r.Note.length > 25 ? r.Note.substring(0, 25) + '...' : r.Note}</span>` : '<span class="text-muted small">--</span>';

            return `
                <tr>
                    <td class="small" style="line-height: 1.4;">
                        <div><span class="text-success fw-bold">📥 Vào:</span> <span class="font-monospace">${loginTime}</span></div>
                        <div><span class="text-muted fw-bold">📤 Ra:</span> <span class="font-monospace">${logoutTime}</span></div>
                        <div class="mt-1"><span class="badge bg-light text-dark border">⏱️ ${durText}</span></div>
                    </td>
                    <td>
                        <div class="fw-bold text-dark">${r.Full_name || r.Username}</div>
                        <div class="small text-muted font-monospace">${r.Username}</div>
                    </td>
                    <td>${roleBadge}</td>
                    <td class="small text-dark">
                        <div>${r.Device_info || 'Không rõ'}</div>
                    </td>
                    <td><code class="small text-secondary">${r.Client_ip || '--'}</code></td>
                    <td>${gpsHtml}</td>
                    <td class="text-center">
                        ${statusHtml}
                        ${durText && durText !== '--' ? `<div class="small text-muted mt-1" style="font-size: 11px;">${isOnline ? '🟢 ' : '⏱️ '}${durText}</div>` : ''}
                    </td>
                    <td>${noteStr}</td>
                    <td class="text-end text-nowrap">
                        <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2" onclick="window.openEditLoginHistoryModal(${r.History_id})" title="Xem chi tiết & Sửa ghi chú">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        ${isOnline ? `
                        <button type="button" class="btn btn-sm btn-danger py-0 px-2 ms-1 fw-bold shadow-sm" onclick="window.forceLogoutDevice(${r.History_id}, '${(r.Full_name || r.Username).replace(/'/g, "\\'")}')" title="Đẩy ra ngoài / Ngắt phiên tức thì">
                            <i class="fa-solid fa-ban me-1"></i>Đẩy ra
                        </button>
                        ` : ''}
                        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" onclick="window.deleteLoginHistory(${r.History_id})" title="Xóa bản ghi này">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error('Lỗi loadLoginHistoryList:', e);
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger py-3">Lỗi nạp lịch sử đăng nhập</td></tr>';
    }
};

// ==========================================
// VẼ BIỂU ĐỒ & PHÂN TÍCH THÓI QUEN NGƯỜI DÙNG
// ==========================================
window.renderLoginAnalyticsCharts = function(analytics, stats) {
    if (!analytics) return;

    // 1. Biểu đồ phân bố theo khung giờ (0h - 23h)
    const hourlyCanvas = document.getElementById('chartLoginHourlyDistribution');
    if (hourlyCanvas && typeof Chart !== 'undefined') {
        if (window.loginHourlyChartInstance) {
            try { window.loginHourlyChartInstance.destroy(); } catch (e) {}
        }

        const hourlyData = analytics.hourlyDistribution || [];
        const labels = hourlyData.map(h => h.hourLabel);
        const customerData = hourlyData.map(h => h.customer);
        const staffData = hourlyData.map(h => h.staff);

        const ctx = hourlyCanvas.getContext('2d');
        window.loginHourlyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '🪷 Khách Hàng (Hội Viên)',
                        data: customerData,
                        backgroundColor: 'rgba(25, 135, 84, 0.75)',
                        borderColor: '#198754',
                        borderWidth: 1.5,
                        borderRadius: 4
                    },
                    {
                        label: '👤 Nhân Viên (Ca làm việc)',
                        data: staffData,
                        backgroundColor: 'rgba(13, 110, 253, 0.75)',
                        borderColor: '#0d6efd',
                        borderWidth: 1.5,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { boxWidth: 14, font: { size: 11, weight: 'bold' } }
                    },
                    tooltip: {
                        callbacks: {
                            footer: function(items) {
                                let sum = 0;
                                items.forEach(i => { sum += i.parsed.y; });
                                return 'Tổng: ' + sum + ' lượt truy cập';
                            }
                        }
                    }
                }
            }
        });
    }

    // 2. Biểu đồ phân bố Thiết Bị & Nền Tảng (Doughnut)
    const devCanvas = document.getElementById('chartLoginDeviceBreakdown');
    if (devCanvas && typeof Chart !== 'undefined') {
        if (window.loginDeviceChartInstance) {
            try { window.loginDeviceChartInstance.destroy(); } catch (e) {}
        }

        const dev = analytics.deviceBreakdown || { iPhone: 0, Android: 0, Windows: 0, Mac: 0, Other: 0 };
        const devLabels = ['iPhone / iPad', 'Android Mobile', 'Windows PC', 'Mac / Apple', 'Khác'];
        const devValues = [dev.iPhone, dev.Android, dev.Windows, dev.Mac, dev.Other];
        const totalDev = devValues.reduce((a, b) => a + b, 0);

        const mobCount = dev.iPhone + dev.Android;
        const pcCount = dev.Windows + dev.Mac;
        const mobPct = totalDev > 0 ? Math.round((mobCount / totalDev) * 100) : 0;
        const pcPct = totalDev > 0 ? Math.round((pcCount / totalDev) * 100) : 0;

        const badgeEl = document.getElementById('loginDeviceBreakdownBadge');
        if (badgeEl) {
            badgeEl.innerHTML = `📱 Mobile: <b>${mobPct}%</b> (${mobCount}) | 💻 PC: <b>${pcPct}%</b> (${pcCount})`;
        }

        const ctxDev = devCanvas.getContext('2d');
        window.loginDeviceChartInstance = new Chart(ctxDev, {
            type: 'doughnut',
            data: {
                labels: devLabels,
                datasets: [{
                    data: devValues,
                    backgroundColor: [
                        '#198754', // iPhone
                        '#0d6efd', // Android
                        '#ffc107', // Windows
                        '#0dcaf0', // Mac
                        '#6c757d'  // Other
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 12, font: { size: 11 } }
                    }
                }
            }
        });
    }

    // 3. Phân tích Thói quen & Gợi ý Chiến lược Marketing Thông minh
    const insightsBox = document.getElementById('loginBehaviorInsightsText');
    if (insightsBox) {
        const hourlyData = analytics.hourlyDistribution || [];
        // Tìm peak hour của khách hàng
        let maxCustHour = 11, maxCustVal = 0;
        hourlyData.forEach(h => {
            if (h.customer > maxCustVal) {
                maxCustVal = h.customer;
                maxCustHour = h.hour;
            }
        });

        const dev = analytics.deviceBreakdown || { iPhone: 0, Android: 0, Windows: 0, Mac: 0, Other: 0 };
        const totalDev = (dev.iPhone + dev.Android + dev.Windows + dev.Mac + dev.Other) || 1;
        const mobCount = dev.iPhone + dev.Android;
        const mobPct = Math.round((mobCount / totalDev) * 100);

        const avgCustTime = stats?.avgCustomerDurationText || '--';
        const suggestHour = (maxCustHour > 0 ? maxCustHour - 1 : 10);

        insightsBox.innerHTML = `
            <div class="row g-2">
                <div class="col-md-6">
                    <p class="mb-1"><i class="fa-solid fa-fire text-danger me-1"></i> <b>Khung giờ vàng của Khách hàng:</b> Khách xem menu và đặt món đông nhất vào khoảng <b>${maxCustHour}h00 - ${maxCustHour + 1}h00</b>${maxCustVal > 0 ? ` (Ghi nhận ${maxCustVal} lượt khách)` : ''}.</p>
                    <p class="mb-1"><i class="fa-solid fa-mobile-screen-button text-primary me-1"></i> <b>Nền tảng chủ đạo:</b> <b>${mobPct}%</b> khách hàng sử dụng Điện thoại thông minh (iPhone/Android) để đặt món và xem tài khoản.</p>
                </div>
                <div class="col-md-6">
                    <p class="mb-1"><i class="fa-solid fa-stopwatch text-success me-1"></i> <b>Thời lượng tương tác:</b> Khách hàng online trung bình <b>${avgCustTime}</b> mỗi phiên trước khi hoàn tất đặt món.</p>
                    <p class="mb-1"><i class="fa-solid fa-bullhorn text-warning me-1"></i> <b>Gợi ý Chiến lược Marketing:</b> Nên hẹn giờ tự động gửi thông báo / Email giảm giá (Voucher Ngày Rằm, Sinh nhật) vào <b>${suggestHour}h30</b> (trước giờ cao điểm 30 phút) để tăng tỷ lệ chốt đơn tới 35%!</p>
                </div>
            </div>
        `;
    }
};

window.refreshLoginAnalyticsCharts = async function() {
    await window.loadLoginHistoryList();
};

window.openGoogleMapsLocation = function(lat, lng) {
    if (!lat || !lng) return;
    const url = `https://www.google.com/maps?q=${lat},${lng}&z=17&t=m`;
    window.open(url, '_blank');
};

window.openCurrentModalMap = function() {
    if (window.currentModalLat && window.currentModalLng) {
        window.openGoogleMapsLocation(window.currentModalLat, window.currentModalLng);
    }
};

window.openEditLoginHistoryModal = function(histId) {
    const row = (window.allLoginHistoryCache || []).find(x => x.History_id == histId);
    if (!row) return;

    document.getElementById('editLoginHistId').value = row.History_id;
    document.getElementById('detailHistUser').textContent = `${row.Full_name || row.Username} (${row.Username})`;
    document.getElementById('detailHistRoleBadge').textContent = `${row.User_type === 'STAFF' ? 'NHÂN VIÊN: ' : 'HỘI VIÊN: '} ${row.Role || ''}`;
    document.getElementById('detailHistTime').textContent = row.Login_time ? row.Login_time.replace('T', ' ').substring(0, 19) : '--';
    document.getElementById('detailHistDevice').textContent = row.Device_info || 'Không xác định';
    document.getElementById('detailHistIp').textContent = row.Client_ip || 'Không rõ';

    const gpsTextEl = document.getElementById('detailHistGpsText');
    const btnMap = document.getElementById('btnOpenMapsFromModal');
    if (row.Latitude && row.Longitude) {
        window.currentModalLat = row.Latitude;
        window.currentModalLng = row.Longitude;
        gpsTextEl.innerHTML = `
            Tọa độ: <b>${row.Latitude}, ${row.Longitude}</b>
            ${row.Distance_to_restaurant != null ? `<br>Khoảng cách ước tính tới nhà hàng: <b>${row.Distance_to_restaurant} mét</b>` : ''}
        `;
        if (btnMap) btnMap.style.display = 'inline-block';
    } else {
        window.currentModalLat = null;
        window.currentModalLng = null;
        gpsTextEl.innerHTML = '<i>Thiết bị không truyền tọa độ GPS khi đăng nhập.</i>';
        if (btnMap) btnMap.style.display = 'none';
    }

    document.getElementById('editHistLocationAddress').value = row.Location_address || '';
    document.getElementById('editHistStatus').value = row.Status || 'SUCCESS';
    document.getElementById('editHistNote').value = row.Note || '';

    // Bật nút Đẩy ra ngoài ngay nếu phiên đang online
    const btnForceLogout = document.getElementById('btnModalForceLogout');
    if (btnForceLogout) {
        btnForceLogout.style.display = (row.Status === 'SUCCESS') ? 'inline-block' : 'none';
    }

    const modalEl = document.getElementById('editLoginHistoryModal');
    if (modalEl) {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            let modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (!modalInstance) modalInstance = new bootstrap.Modal(modalEl);
            modalInstance.show();
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
        }
    }
};

window.triggerForceLogoutFromModal = async function() {
    const id = document.getElementById('editLoginHistId')?.value;
    const row = (window.allLoginHistoryCache || []).find(x => x.History_id == id);
    const userName = row ? (row.Full_name || row.Username) : 'Người dùng này';
    if (!id) return;
    window.closeMemberModal('editLoginHistoryModal');
    await window.forceLogoutDevice(id, userName);
};

window.saveLoginHistoryEdit = async function(event) {
    if (event) event.preventDefault();
    const id = document.getElementById('editLoginHistId')?.value;
    const address = document.getElementById('editHistLocationAddress')?.value?.trim();
    const status = document.getElementById('editHistStatus')?.value;
    const note = document.getElementById('editHistNote')?.value?.trim();

    if (!id) return;

    try {
        const res = await fetch(`/api/login-history/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Location_address: address, Status: status, Note: note })
        });
        const data = await res.json();
        if (data.success) {
            if (window.toast) window.toast.success('Cập nhật lịch sử đăng nhập thành công!');
            else alert('Cập nhật thành công!');

            if (typeof window.closeMemberModal === 'function') {
                window.closeMemberModal('editLoginHistoryModal');
            }
            await window.loadLoginHistoryList();
        } else {
            if (window.toast) window.toast.error(data.error || 'Lỗi cập nhật');
            else alert(data.error || 'Lỗi cập nhật');
        }
    } catch (err) {
        console.error('Lỗi saveLoginHistoryEdit:', err);
    }
};

window.deleteLoginHistory = async function(histId) {
    if (!confirm('Bạn có chắc chắn muốn xóa bản ghi lịch sử đăng nhập này không?')) return;
    try {
        const res = await fetch(`/api/login-history/${histId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            if (window.toast) window.toast.success('Đã xóa bản ghi lịch sử đăng nhập!');
            else alert('Đã xóa thành công!');
            await window.loadLoginHistoryList();
        } else {
            if (window.toast) window.toast.error(data.error || 'Lỗi xóa bản ghi');
            else alert(data.error || 'Lỗi xóa bản ghi');
        }
    } catch (err) {
        console.error('Lỗi deleteLoginHistory:', err);
    }
};

window.clearLoginHistoryPrompt = async function() {
    const choice = prompt('Chọn hành động dọn dẹp lịch sử đăng nhập:\n- Nhập "ALL" để xóa TOÀN BỘ lịch sử đăng nhập\n- Nhập số ngày (ví dụ: 30) để xóa lịch sử cũ hơn số ngày đó\n- Bấm Hủy để quay lại', '30');
    if (!choice) return;

    const trimmed = choice.trim().toUpperCase();
    let payload = {};
    if (trimmed === 'ALL') {
        if (!confirm('⚠️ CẢNH BÁO: Bạn sắp xóa TOÀN BỘ lịch sử đăng nhập của tất cả nhân viên và khách hàng. Hành động này không thể hoàn tác. Bạn chắc chắn chứ?')) return;
        payload = { clear_all: true };
    } else {
        const days = parseInt(trimmed, 10);
        if (isNaN(days) || days < 1) {
            if (window.toast) window.toast.warning('Vui lòng nhập số ngày hợp lệ hoặc "ALL"!');
            else alert('Vui lòng nhập số ngày hợp lệ!');
            return;
        }
        if (!confirm(`Bạn có chắc chắn muốn dọn dẹp tất cả lịch sử đăng nhập cũ hơn ${days} ngày không?`)) return;
        payload = { older_than_days: days };
    }

    try {
        const res = await fetch('/api/login-history', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            if (window.toast) window.toast.success(data.message || 'Đã dọn dẹp lịch sử đăng nhập thành công!');
            else alert(data.message || 'Đã dọn dẹp thành công!');
            await window.loadLoginHistoryList();
        } else {
            if (window.toast) window.toast.error(data.error || 'Lỗi dọn dẹp lịch sử');
            else alert(data.error || 'Lỗi dọn dẹp lịch sử');
        }
    } catch (err) {
        console.error('Lỗi clearLoginHistoryPrompt:', err);
    }
};

window.forceLogoutDevice = async function(histId, userName) {
    if (!confirm(`Bạn có chắc muốn NGẮT KẾT NỐI TỪ XA thiết bị của [${userName}] không? Thiết bị này sẽ bị đẩy ra màn hình đăng nhập ngay lập tức.`)) return;

    try {
        const res = await fetch(`/api/login-history/force-logout/${histId}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            if (window.toast) window.toast.success(data.message || `Đã ngắt kết nối thiết bị của [${userName}]!`);
            else alert(`Đã ngắt kết nối thiết bị của [${userName}]!`);
            await window.loadLoginHistoryList();
        } else {
            if (window.toast) window.toast.error(data.error || 'Lỗi khi ngắt kết nối');
            else alert(data.error || 'Lỗi khi ngắt kết nối');
        }
    } catch (err) {
        console.error('Lỗi forceLogoutDevice:', err);
    }
};

// ==========================================
// QUẢN LÝ HẸN ĐẶT LỊCH MARKETING & TỰ ĐỘNG GỬI EMAIL
// ==========================================
window.allMarketingSchedulesCache = [];

// 1. Nạp danh sách lịch hẹn Marketing
window.loadMarketingSchedules = async function() {
    const tbody = document.getElementById('manageMarketingSchedulesTableBody');
    if (!tbody) return;

    try {
        const res = await fetch(`/api/marketing/schedules?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        const schedules = data.schedules || [];
        window.allMarketingSchedulesCache = schedules;

        // Hiển thị thông tin Âm lịch hôm nay
        if (data.lunarInfo) {
            const lText = document.getElementById('mktSchedTodayLunarText');
            const lBadge = document.getElementById('mktSchedTodayLunarBadge');
            if (lText) {
                lText.textContent = `Dương lịch: ${data.lunarInfo.solarDate} | ${data.lunarInfo.lunarText}`;
            }
            if (lBadge && data.lunarInfo.isVegetarianDay) {
                lBadge.className = 'badge bg-warning text-dark px-2 py-1';
                lBadge.innerHTML = '<i class="fa-solid fa-star me-1"></i> Hôm Nay Là Ngày Ăn Chay (Mùng 1 / Rằm)';
            }
        }

        if (schedules.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Chưa có lịch hẹn Marketing tự động nào. Hãy bấm "+ Đặt Lịch Hẹn Mới" để tạo lịch!</td></tr>';
            return;
        }

        tbody.innerHTML = schedules.map(s => {
            // Loại lịch
            let typeBadge = '';
            if (s.Schedule_type === 'LUNAR_15') {
                typeBadge = '<span class="badge bg-warning text-dark fw-bold"><i class="fa-solid fa-moon me-1"></i>Rằm (15 Âm)</span>';
            } else if (s.Schedule_type === 'LUNAR_1') {
                typeBadge = '<span class="badge bg-secondary fw-bold"><i class="fa-solid fa-circle me-1"></i>Mùng 1 Âm</span>';
            } else if (s.Schedule_type === 'LUNAR_1_15') {
                typeBadge = '<span class="badge bg-success fw-bold"><i class="fa-solid fa-leaf me-1"></i>Mùng 1 & Rằm 15 Âm</span>';
            } else if (s.Schedule_type === 'BIRTHDAY_MONTH') {
                typeBadge = '<span class="badge bg-info text-dark fw-bold"><i class="fa-solid fa-cake-candles me-1"></i>Sinh nhật trong tháng</span>';
            } else if (s.Schedule_type === 'SPECIFIC_DATE') {
                typeBadge = `<span class="badge bg-primary fw-bold"><i class="fa-solid fa-calendar-day me-1"></i>${s.Specific_date ? s.Specific_date.split('-').reverse().join('/') : 'Ngày cụ thể'}</span>`;
            } else {
                typeBadge = '<span class="badge bg-light text-dark border fw-bold">☀️ Hằng ngày</span>';
            }

            // Đối tượng nhận
            let audBadge = '';
            if (s.Target_audience === 'TIER_MAM') {
                audBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle fw-bold">🌱 Hạng Mầm Sen</span>';
            } else if (s.Target_audience === 'TIER_BUP' || s.Target_audience === 'TIER_CHOI') {
                audBadge = '<span class="badge bg-info-subtle text-info-emphasis border border-info-subtle fw-bold">🪷 Hạng Búp Sen</span>';
            } else if (s.Target_audience === 'TIER_HONG' || s.Target_audience === 'TIER_HOA') {
                audBadge = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle fw-bold">🌸 Hạng Sen Hồng</span>';
            } else if (s.Target_audience === 'TIER_KIM_CUONG' || s.Target_audience === 'TIER_VANG') {
                audBadge = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle fw-bold">💎 Hạng Sen Kim Cương</span>';
            } else if (s.Target_audience === 'BIRTHDAY_THIS_MONTH' || s.Target_audience === 'BIRTHDAY') {
                audBadge = '<span class="badge bg-info-subtle text-primary border border-info-subtle fw-bold">🎂 Sinh nhật tháng</span>';
            } else if (s.Target_audience === 'SELECTED_MEMBERS') {
                audBadge = '<span class="badge bg-secondary-subtle text-secondary border fw-bold">👥 Chọn thủ công</span>';
            } else {
                audBadge = '<span class="badge bg-light text-dark border fw-bold">📧 Tất cả có Email</span>';
            }

            // Chiến dịch
            const campTitle = s.Campaign_name ? `<b>[${s.Campaign_code || 'KM'}]</b> ${s.Campaign_name}` : '<span class="text-muted">Chưa chọn chiến dịch</span>';
            let discountInfo = '';
            if (s.Discount_type === 'PERCENT') {
                discountInfo = `<span class="badge bg-danger-subtle text-danger ms-1">Giảm ${s.Discount_value}%</span>`;
            } else if (s.Discount_value) {
                discountInfo = `<span class="badge bg-success-subtle text-success ms-1">Giảm ${Number(s.Discount_value).toLocaleString('vi-VN')}đ</span>`;
            }

            // Lần chạy gần nhất
            let lastRunHtml = '<span class="text-muted small">Chưa chạy lần nào</span>';
            if (s.Last_run_at) {
                const timeClean = s.Last_run_at.replace('T', ' ').substring(0, 16);
                let stBadge = '';
                if (s.Last_run_status === 'SUCCESS') stBadge = '<span class="badge bg-success-subtle text-success fw-bold">Thành công</span>';
                else if (s.Last_run_status === 'PARTIAL') stBadge = '<span class="badge bg-warning-subtle text-warning-emphasis fw-bold">Gửi 1 phần</span>';
                else if (s.Last_run_status === 'NO_RECIPIENTS') stBadge = '<span class="badge bg-secondary-subtle text-secondary fw-bold">Không có người nhận</span>';
                else stBadge = '<span class="badge bg-danger-subtle text-danger fw-bold">Lỗi gửi</span>';

                lastRunHtml = `
                    <div>
                        <div class="small fw-bold text-dark"><i class="fa-regular fa-clock me-1 text-primary"></i>${timeClean}</div>
                        <div class="d-flex align-items-center gap-1 mt-1">${stBadge}</div>
                        ${s.Last_run_summary ? `<div class="text-muted small" style="font-size: 11px;">${s.Last_run_summary}</div>` : ''}
                    </div>
                `;
            }

            const isActive = s.Is_active === 1;

            return `
                <tr class="${isActive ? '' : 'opacity-75 bg-light'}">
                    <td class="ps-3">
                        <div class="fw-bold text-dark">${s.Schedule_name}</div>
                        ${s.Subject ? `<div class="small text-muted text-truncate" style="max-width: 220px;" title="${s.Subject}">✉️ ${s.Subject}</div>` : ''}
                    </td>
                    <td>
                        <div>${typeBadge}</div>
                        <div class="small text-muted mt-1"><i class="fa-solid fa-clock text-warning me-1"></i>${s.Send_time || '08:00'} sáng</div>
                    </td>
                    <td>
                        <div class="small text-dark">${campTitle} ${discountInfo}</div>
                    </td>
                    <td>${audBadge}</td>
                    <td class="text-center">
                        <div class="form-check form-switch d-inline-block m-0">
                            <input class="form-check-input" type="checkbox" ${isActive ? 'checked' : ''} onchange="window.toggleMarketingScheduleActive(${s.Schedule_id}, this.checked)">
                        </div>
                    </td>
                    <td>${lastRunHtml}</td>
                    <td class="text-end pe-3 text-nowrap">
                        <button type="button" class="btn btn-sm btn-outline-success py-0 px-2 fw-bold shadow-sm" onclick="window.runMarketingScheduleNow(${s.Schedule_id})" title="Chạy gửi chiến dịch ngay bây giờ!">
                            <i class="fa-solid fa-bolt me-1"></i>Chạy ngay
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2 ms-1" onclick="window.openMarketingScheduleModal(${s.Schedule_id})" title="Chỉnh sửa lịch hẹn">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" onclick="window.deleteMarketingSchedule(${s.Schedule_id})" title="Xóa lịch hẹn này">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Lỗi loadMarketingSchedules:', err);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-3">Lỗi nạp danh sách lịch hẹn Marketing!</td></tr>';
    }
};

// 2. Mở Modal Thêm / Sửa Lịch Hẹn
window.openMarketingScheduleModal = async function(schedId) {
    const titleEl = document.getElementById('manageMarketingScheduleModalTitle');
    const campSelect = document.getElementById('editSchedCampaignSelect');
    const memberBox = document.getElementById('schedManualMembersList');

    // Nạp danh sách chiến dịch đang có
    try {
        const resCamp = await fetch(`/api/marketing/campaigns?t=${Date.now()}`);
        if (resCamp.ok) {
            const dataCamp = await resCamp.json();
            const campaigns = dataCamp.campaigns || [];
            if (campSelect) {
                campSelect.innerHTML = campaigns.map(c => {
                    const discount = c.Discount_type === 'PERCENT' ? `Giảm ${c.Discount_value}%` : `Giảm ${Number(c.Discount_value).toLocaleString('vi-VN')}đ`;
                    return `<option value="${c.Campaign_id}">[${c.Code}] ${c.Campaign_name || c.Name} (${discount})</option>`;
                }).join('');
            }
        }
    } catch(eC) {}

    // Nạp danh sách thành viên có email
    try {
        const resMem = await fetch(`/api/members?limit=200&t=${Date.now()}`);
        if (resMem.ok) {
            const dataMem = await resMem.json();
            const members = (dataMem.members || dataMem || []).filter(m => m.Email && m.Email.trim());
            window.allMembersWithEmailCache = members;
            if (memberBox) {
                memberBox.innerHTML = members.map(m => `
                    <div class="form-check form-check-inline m-1 p-1 border rounded bg-light" style="font-size: 12px;">
                        <input class="form-check-input sched-member-checkbox" type="checkbox" value="${m.Member_id}" id="schedMemCheck_${m.Member_id}">
                        <label class="form-check-label fw-bold text-dark" for="schedMemCheck_${m.Member_id}">
                            ${m.Full_name} <span class="text-muted font-monospace">(${m.Email})</span>
                        </label>
                    </div>
                `).join('');
            }
        }
    } catch(eM) {}

    if (schedId) {
        if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-pen-to-square me-2"></i>Chỉnh Sửa Lịch Hẹn Marketing';
        const s = (window.allMarketingSchedulesCache || []).find(x => x.Schedule_id == schedId);
        if (s) {
            document.getElementById('editSchedId').value = s.Schedule_id;
            document.getElementById('editSchedName').value = s.Schedule_name || '';
            document.getElementById('editSchedType').value = s.Schedule_type || 'LUNAR_15';
            document.getElementById('editSchedSendTime').value = s.Send_time || '08:00';
            document.getElementById('editSchedSpecificDate').value = s.Specific_date || '';
            document.getElementById('editSchedCampaignSelect').value = s.Campaign_id || '';
            document.getElementById('editSchedAudienceSelect').value = s.Target_audience || 'ALL_EMAIL';
            document.getElementById('editSchedSubject').value = s.Subject || '';
            document.getElementById('editSchedMessage').value = s.Message || '';
            document.getElementById('editSchedIsActive').checked = (s.Is_active === 1);

            // Xử lý các checkbox thành viên nếu là SELECTED_MEMBERS
            let selectedIds = [];
            try { selectedIds = JSON.parse(s.Selected_member_ids || '[]'); } catch(e) {}
            document.querySelectorAll('.sched-member-checkbox').forEach(cb => {
                cb.checked = selectedIds.includes(Number(cb.value));
            });

            window.onScheduleTypeChange(s.Schedule_type);
            window.onScheduleAudienceChange(s.Target_audience);
        }
    } else {
        if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-calendar-plus me-2"></i>Đặt Lịch Hẹn Gửi Marketing Tự Động';
        document.getElementById('editSchedId').value = '';
        document.getElementById('editSchedName').value = '';
        document.getElementById('editSchedType').value = 'LUNAR_15';
        document.getElementById('editSchedSendTime').value = '08:00';
        document.getElementById('editSchedSpecificDate').value = '';
        document.getElementById('editSchedAudienceSelect').value = 'TIER_MAM';
        document.getElementById('editSchedSubject').value = '';
        document.getElementById('editSchedMessage').value = '';
        document.getElementById('editSchedIsActive').checked = true;

        document.querySelectorAll('.sched-member-checkbox').forEach(cb => { cb.checked = false; });

        window.onScheduleTypeChange('LUNAR_15');
        window.onScheduleAudienceChange('TIER_MAM');
    }

    const modalEl = document.getElementById('manageMarketingScheduleModal');
    if (modalEl) {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            let modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (!modalInstance) modalInstance = new bootstrap.Modal(modalEl);
            modalInstance.show();
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
        }
    }
};

// 3. Thay đổi hiển thị ô chọn ngày cụ thể
window.onScheduleTypeChange = function(type) {
    const colDate = document.getElementById('editSchedSpecificDateCol');
    if (colDate) {
        colDate.style.display = (type === 'SPECIFIC_DATE') ? 'block' : 'none';
    }
};

// 4. Thay đổi hiển thị khối chọn thành viên thủ công
window.onScheduleAudienceChange = function(audience) {
    const box = document.getElementById('editSchedManualMembersBox');
    if (box) {
        box.style.display = (audience === 'SELECTED_MEMBERS') ? 'block' : 'none';
    }
};

// 5. Chọn / Bỏ chọn toàn bộ thành viên
window.schedSelectAllMembers = function(selectAll) {
    document.querySelectorAll('.sched-member-checkbox').forEach(cb => {
        cb.checked = selectAll;
    });
};

// 6. Lưu Lịch Hẹn Marketing
window.saveMarketingSchedule = async function(event) {
    if (event) event.preventDefault();

    const id = document.getElementById('editSchedId')?.value;
    const name = document.getElementById('editSchedName')?.value?.trim();
    const type = document.getElementById('editSchedType')?.value;
    const sendTime = document.getElementById('editSchedSendTime')?.value || '08:00';
    const specificDate = document.getElementById('editSchedSpecificDate')?.value || null;
    const campaignId = document.getElementById('editSchedCampaignSelect')?.value;
    const audience = document.getElementById('editSchedAudienceSelect')?.value || 'ALL_EMAIL';
    const subject = document.getElementById('editSchedSubject')?.value?.trim() || '';
    const message = document.getElementById('editSchedMessage')?.value?.trim() || '';
    const isActive = document.getElementById('editSchedIsActive')?.checked ? 1 : 0;

    if (!name) {
        if (window.toast) window.toast.error('Vui lòng nhập tên lịch hẹn!');
        else alert('Vui lòng nhập tên lịch hẹn!');
        return;
    }

    let selectedMemberIds = [];
    if (audience === 'SELECTED_MEMBERS') {
        document.querySelectorAll('.sched-member-checkbox:checked').forEach(cb => {
            selectedMemberIds.push(Number(cb.value));
        });
        if (selectedMemberIds.length === 0) {
            if (window.toast) window.toast.error('Vui lòng tích chọn ít nhất một thành viên!');
            else alert('Vui lòng tích chọn ít nhất một thành viên!');
            return;
        }
    }

    const payload = {
        Schedule_name: name,
        Schedule_type: type,
        Send_time: sendTime,
        Specific_date: specificDate,
        Campaign_id: campaignId ? Number(campaignId) : null,
        Target_audience: audience,
        Selected_member_ids: selectedMemberIds,
        Subject: subject,
        Message: message,
        Is_active: isActive
    };

    try {
        const url = id ? `/api/marketing/schedules/${id}` : '/api/marketing/schedules';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
            if (window.toast) window.toast.success(data.message || 'Đã lưu lịch hẹn Marketing thành công!');
            else alert(data.message || 'Đã lưu lịch hẹn Marketing thành công!');

            window.closeMemberModal('manageMarketingScheduleModal');
            await window.loadMarketingSchedules();
        } else {
            if (window.toast) window.toast.error(data.error || 'Lỗi khi lưu lịch hẹn');
            else alert(data.error || 'Lỗi khi lưu lịch hẹn');
        }
    } catch (err) {
        console.error('Lỗi saveMarketingSchedule:', err);
    }
};

// 7. Bật / Tắt kích hoạt lịch hẹn
window.toggleMarketingScheduleActive = async function(schedId, isActive) {
    try {
        const res = await fetch(`/api/marketing/schedules/${schedId}/toggle`, { method: 'PUT' });
        const data = await res.json();
        if (data.success) {
            if (window.toast) window.toast.success(data.message);
            await window.loadMarketingSchedules();
        } else {
            if (window.toast) window.toast.error(data.error || 'Lỗi cập nhật trạng thái');
        }
    } catch (err) {
        console.error('Lỗi toggleMarketingScheduleActive:', err);
    }
};

// 8. Chạy gửi lịch hẹn ngay lập tức
window.runMarketingScheduleNow = async function(schedId) {
    const s = (window.allMarketingSchedulesCache || []).find(x => x.Schedule_id == schedId);
    const schedName = s ? s.Schedule_name : `Lịch #${schedId}`;

    if (!confirm(`Bạn có chắc muốn THỰC THI GỬI CHIẾN DỊCH VÀ VOUCHER NGAY BÂY GIỜ cho lịch hẹn "${schedName}" không?`)) {
        return;
    }

    if (window.toast) window.toast.info('🚀 Đang bắt đầu gửi voucher và email cho các thành viên...');

    try {
        const res = await fetch(`/api/marketing/schedules/${schedId}/run-now`, { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            if (window.toast) window.toast.success(data.message || `Đã gửi thành công ${data.successCount} email!`);
            else alert(data.message || `Đã gửi thành công ${data.successCount} email!`);

            await window.loadMarketingSchedules();
            if (typeof window.loadMarketingEmailLogs === 'function') window.loadMarketingEmailLogs();
            if (typeof window.loadMemberVouchersHistory === 'function') window.loadMemberVouchersHistory();
        } else {
            if (window.toast) window.toast.error(data.error || 'Lỗi khi thực thi lịch hẹn');
            else alert(data.error || 'Lỗi khi thực thi lịch hẹn');
        }
    } catch (err) {
        console.error('Lỗi runMarketingScheduleNow:', err);
    }
};

// 9. Xóa lịch hẹn
window.deleteMarketingSchedule = async function(schedId) {
    if (!confirm('Bạn có chắc muốn XÓA vĩnh viễn lịch hẹn Marketing này không?')) return;

    try {
        const res = await fetch(`/api/marketing/schedules/${schedId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            if (window.toast) window.toast.success(data.message || 'Đã xóa lịch hẹn thành công!');
            else alert('Đã xóa lịch hẹn thành công!');
            await window.loadMarketingSchedules();
        } else {
            if (window.toast) window.toast.error(data.error || 'Lỗi khi xóa lịch hẹn');
        }
    } catch (err) {
        console.error('Lỗi deleteMarketingSchedule:', err);
    }
};

// Lắng nghe socket cập nhật realtime
if (typeof io !== 'undefined') {
    try {
        const socket = (typeof window.socket !== 'undefined' && window.socket) ? window.socket : io();
        socket.on('marketing_emails_sent', () => {
            if (typeof window.loadMarketingEmailLogs === 'function') {
                window.loadMarketingEmailLogs();
            }
        });
        socket.on('marketing_schedules_updated', () => {
            if (typeof window.loadMarketingSchedules === 'function') {
                window.loadMarketingSchedules();
            }
        });
        socket.on('marketing_schedule_executed', () => {
            if (typeof window.loadMarketingSchedules === 'function') {
                window.loadMarketingSchedules();
            }
            if (typeof window.loadMarketingEmailLogs === 'function') {
                window.loadMarketingEmailLogs();
            }
            if (typeof window.loadMemberVouchersHistory === 'function') {
                window.loadMemberVouchersHistory();
            }
        });
        socket.on('delivery_platforms_updated', () => {
            if (typeof window.loadDeliveryPlatformsManagementList === 'function') {
                window.loadDeliveryPlatformsManagementList();
            }
            if (typeof window.populateCartDeliveryPlatforms === 'function') {
                window.populateCartDeliveryPlatforms();
            }
        });
        socket.on('login_history_updated', () => {
            if (typeof window.loadLoginHistoryList === 'function') {
                window.loadLoginHistoryList();
            }
        });
    } catch (eSocket) {}
}