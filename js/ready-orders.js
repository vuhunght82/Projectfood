/**
 * Logic Màn hình Nhận Món / Trả Đơn (Ready Orders)
 * Dành cho Bồi bàn, Thu ngân, Khách hàng theo dõi món đã xong
 */

var isReadySoundEnabled = true;
var readyAudioCtx = null;

// Phát âm thanh chuông báo theo cấu hình hệ thống (khi có món mới làm xong)
function playReadyNotificationSound() {
    if (!isReadySoundEnabled) return;

    try {
        const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        if (sysConfig.readySoundEnabled === false) return;

        if (window.SoundService && typeof window.SoundService.playAlertSound === 'function') {
            window.SoundService.playAlertSound({
                type: sysConfig.readySoundType || 'dingdong',
                customUrl: sysConfig.readyCustomSoundUrl || '',
                volume: sysConfig.readySoundVolume ?? 80,
                repeatCount: sysConfig.readyRepeatCount || 1,
                repeatInterval: sysConfig.readyRepeatInterval || 2
            });
            return;
        }
    } catch (e) {
        console.warn('Lỗi đọc cấu hình âm thanh nhận món:', e);
    }

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        if (!readyAudioCtx) readyAudioCtx = new AudioContext();
        if (readyAudioCtx.state === 'suspended') readyAudioCtx.resume();

        const osc = readyAudioCtx.createOscillator();
        const gain = readyAudioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, readyAudioCtx.currentTime); // Note D5
        osc.frequency.exponentialRampToValueAtTime(880, readyAudioCtx.currentTime + 0.15); // Note A5

        gain.gain.setValueAtTime(0.3, readyAudioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, readyAudioCtx.currentTime + 0.6);

        osc.connect(gain);
        gain.connect(readyAudioCtx.destination);

        osc.start();
        osc.stop(readyAudioCtx.currentTime + 0.6);
    } catch (e) {
        console.warn('AudioContext:', e);
    }
}

// Tiếng bíp nhẹ khi bồi bàn bấm nút trả món hoặc thu tiền (không reo chuông to)
function playReadyActionBeep(freq = 880, duration = 0.08) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        if (!readyAudioCtx) readyAudioCtx = new AudioContext();
        if (readyAudioCtx.state === 'suspended') readyAudioCtx.resume();

        const osc = readyAudioCtx.createOscillator();
        const gain = readyAudioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, readyAudioCtx.currentTime);
        gain.gain.setValueAtTime(0.12, readyAudioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, readyAudioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(readyAudioCtx.destination);
        osc.start();
        osc.stop(readyAudioCtx.currentTime + duration);
    } catch (e) {}
}

window.toggleReadySound = function() {
    isReadySoundEnabled = !isReadySoundEnabled;
    const icon = document.getElementById('readySoundIcon');
    const btn = icon ? icon.parentElement : null;
    if (isReadySoundEnabled) {
        if (icon) icon.className = 'fa-solid fa-volume-high';
        if (btn) btn.innerHTML = '<i class="fa-solid fa-volume-high" id="readySoundIcon"></i> Chuông Báo: Bật';
        playReadyNotificationSound();
    } else {
        if (icon) icon.className = 'fa-solid fa-volume-xmark';
        if (btn) btn.innerHTML = '<i class="fa-solid fa-volume-xmark" id="readySoundIcon"></i> Chuông Báo: Tắt';
    }
};

// 1. Tải danh sách đơn sẵn sàng từ Server
async function loadReadyOrdersData() {
    try {
        const res = await fetch('/api/kitchen/ready-orders');
        if (!res.ok) throw new Error('Không thể nạp dữ liệu');
        const orders = await res.json();
        window.readyOrdersCache = Array.isArray(orders) ? orders : [];
        renderReadyCards(window.readyOrdersCache);
    } catch (err) {
        console.error('Lỗi nạp đơn sẵn sàng:', err);
        renderReadyCards([]);
    }
}

// 2. Render thẻ đơn hàng có tiêu đề Xanh Lá
function renderReadyCards(safeOrders) {
    const grid = document.getElementById('readyCardsGrid');
    const countBadge = document.getElementById('readyOrdersCount');

    if (!grid) return;
    const safeCount = Array.isArray(safeOrders) ? safeOrders.length : 0;
    if (countBadge) countBadge.innerText = safeCount;

    // Thông báo số lượng đơn cho TV Screensaver
    if (window.readyTvScreensaver) {
        window.readyTvScreensaver.setOrderCount(safeCount);
        const gridCol = document.getElementById('readyOrdersGridCol');
        const pos = (window.readyTvScreensaver.config.tv_banner_position || 'TOP').toUpperCase();
        const hasSideBanner = (window.readyTvScreensaver.config.tv_banner_enabled === '1') && 
                              (pos === 'LEFT' || pos === 'RIGHT') && 
                              (window.readyTvScreensaver.banners.length > 0);
        if (gridCol) {
            gridCol.className = hasSideBanner ? 'col-lg-8 col-md-7' : 'col-12';
        }
    }

    if (!safeOrders || safeOrders.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fa-solid fa-champagne-glasses fa-4x text-success mb-3 opacity-50"></i>
                <h4 class="text-muted">Hiện tại không có đơn nào đang chờ nhận món!</h4>
                <p class="text-muted small">Khi bếp bấm "Làm xong", món sẽ lập tức xuất hiện tại đây.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = safeOrders.map(order => {
        const orderId = order.Order_id;
        const displayCode = order.Order_code || (`CHAY-` + orderId);
        const tableName = order.Table_number || order.Table_name || `Bàn #${orderId}`;
        
        // Phân biệt chính xác Bồi bàn và Khách hàng
        const waiterName = order.Staff_name || order.Created_by || order.Paid_by || 'Nhân viên';

        let customerDisplayName = 'Khách vãng lai';
        let isMember = false;
        if (order.Member_name && order.Member_name !== 'Khách vãng lai') {
            customerDisplayName = order.Member_name;
            isMember = true;
        } else if (order.Customer_name && order.Customer_name !== 'Khách vãng lai') {
            customerDisplayName = order.Customer_name;
            if (order.Member_id) isMember = true;
        } else if (order.Member_id) {
            customerDisplayName = `Hội viên #${order.Member_id}`;
            isMember = true;
        }

        const isPaid = (order.Payment_status === 'PAID');
        const paymentMethod = order.Payment_method || 'CASH';

        // Danh sách món ăn
        const itemsList = Array.isArray(order.Items) ? order.Items : [];
        const itemsHtml = itemsList.length > 0 ? itemsList.map(item => {
            const itemName = item.Item_name || item.name || 'Món chay';
            const itemQty = item.Quantity || item.quantity || 1;
            const itemNote = item.Note || item.note || '';
            const itemToppings = item.Toppings || item.toppings || '';
            let toppingsText = '';
            if (typeof itemToppings === 'string') {
                try {
                    const parsed = JSON.parse(itemToppings);
                    if (Array.isArray(parsed)) toppingsText = parsed.map(t => `${t.name} (+${Number(t.price).toLocaleString()}đ)`).join(', ');
                    else toppingsText = itemToppings;
                } catch(e) { toppingsText = itemToppings; }
            }

            return `
                <div class="ready-item-row d-flex justify-content-between align-items-center py-2 border-bottom">
                    <div class="me-2" style="flex: 1; min-width: 0;">
                        <span class="fw-bold text-dark d-block text-truncate">${itemName}</span>
                        ${toppingsText ? `<div class="text-primary fw-semibold small" style="font-size: 12px;"><i class="fa-solid fa-plus-circle me-1"></i>${toppingsText}</div>` : ''}
                        ${itemNote ? `<div class="badge bg-danger-subtle text-danger border border-danger-subtle fw-bold mt-1" style="font-size: 11px;"><i class="fa-solid fa-comment-dots me-1"></i>${itemNote}</div>` : ''}
                    </div>
                    <span class="ready-item-qty">x${itemQty}</span>
                </div>
            `;
        }).join('') : `<div class="text-muted text-center py-3 fs-6">Chưa có chi tiết món ăn</div>`;

        // Huy hiệu trạng thái thanh toán
        const paymentBadgeHtml = isPaid ? `
            <span class="badge bg-white text-success fw-bold px-3 py-2 rounded-pill shadow-sm" style="font-size: 11.5px; cursor: pointer;" onclick="toggleReadyPayment('${orderId}')" title="Nhấn để đổi trạng thái">
                <i class="fa-solid fa-circle-check text-success me-1"></i> ĐÃ THANH TOÁN (${paymentMethod})
            </span>
        ` : `
            <span class="badge bg-warning text-dark fw-bold px-3 py-2 rounded-pill shadow-sm" style="font-size: 11.5px; cursor: pointer;" onclick="toggleReadyPayment('${orderId}')" title="Nhấn để đổi trạng thái">
                <i class="fa-solid fa-clock text-dark me-1"></i> CHƯA THANH TOÁN (${paymentMethod})
            </span>
        `;

        return `
            <div class="col-lg-4 col-md-6 mb-3" id="ready-card-${orderId}">
                <div class="card ready-card shadow-sm border-0 h-100">
                    <!-- TIÊU ĐỀ THẺ XANH LÁ -->
                    <div class="card-header ready-header-green p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div>
                            <h4 class="m-0 fw-bold">${tableName} <small class="fs-6 opacity-75">(${displayCode})</small></h4>
                            <small class="opacity-75"><i class="fa-solid fa-clock me-1"></i>Giờ tạo: ${order.Created_at || 'Hôm nay'}</small>
                        </div>
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <span class="badge bg-white text-success fw-bold px-2 py-2 rounded-pill shadow-sm" style="font-size: 11.5px;">
                                <i class="fa-solid fa-bell-concierge me-1"></i> Bếp xong chờ giao
                            </span>
                            ${paymentBadgeHtml}
                        </div>
                    </div>

                    <!-- THÂN THẺ -->
                    <div class="card-body p-2 bg-light d-flex flex-column">
                        <!-- Thông tin Bồi bàn / Người tạo & Loại đơn -->
                        <div class="d-flex justify-content-between align-items-center text-muted small mb-2 px-1 border-bottom pb-1 flex-wrap gap-1">
                            <span class="badge bg-white text-dark border px-2 py-1">
                                <i class="fa-solid fa-user-tie text-primary me-1"></i> Bồi bàn: <b>${waiterName}</b>
                            </span>
                            <span class="badge ${isMember ? 'bg-warning-subtle text-dark border-warning' : 'bg-white text-dark border'} px-2 py-1">
                                <i class="fa-solid fa-user ${isMember ? 'text-warning' : 'text-secondary'} me-1"></i> Khách: 
                                <b class="${isMember ? 'text-success' : 'text-dark'}">${customerDisplayName}</b>
                                ${isMember ? `<span class="badge bg-warning text-dark px-1 ms-1" style="font-size: 9px;"><i class="fa-solid fa-id-card"></i> ${order.Member_tier || 'Hội viên'}</span>` : ''}
                            </span>
                            <span class="badge bg-white text-secondary border px-2 py-1">
                                <i class="fa-solid fa-layer-group me-1"></i> ${order.Order_type || 'DINE_IN'}
                            </span>
                        </div>

                        ${order.Delivery_platform ? `
                            <div class="p-2 mb-2 bg-primary-subtle text-primary border border-primary-subtle rounded-3 small">
                                <div class="fw-bold"><i class="fa-solid fa-motorcycle me-1"></i> Nền tảng: ${order.Delivery_platform} | ${order.Payment_type === 'COD' ? '💵 Thu COD' : '📱 CK QR'}</div>
                                ${order.Customer_phone ? `<div><i class="fa-solid fa-phone me-1"></i> SĐT: <b>${order.Customer_phone}</b></div>` : ''}
                                ${order.Delivery_address ? `<div><i class="fa-solid fa-location-dot me-1 text-danger"></i> Đ/c: ${order.Delivery_address}</div>` : ''}
                            </div>
                        ` : ''}

                        <!-- KHU VỰC DANH SÁCH MÓN ĂN -->
                        <div class="bg-white p-2 rounded border mb-2 flex-grow-1" style="min-height: 120px; max-height: 250px; overflow-y: auto;">
                            ${itemsHtml}
                        </div>

                        ${order.Note ? `
                            <div class="alert alert-warning py-1 px-2 mb-1 small text-dark m-0" style="font-size: 12px;">
                                <i class="fa-solid fa-note-sticky me-1 text-danger"></i> <b>Ghi chú:</b> ${order.Note}
                            </div>
                        ` : ''}
                    </div>

                    <!-- NÚT THAO TÁC -->
                    <div class="card-footer bg-light p-2 d-flex gap-2">
                        <button class="btn btn-outline-dark fw-bold px-3" onclick="window.printOrderBill ? window.printOrderBill('${displayCode}') : null" title="In Hóa Đơn">
                            <i class="fa-solid fa-print me-1"></i> In Bill
                        </button>
                        <button class="btn btn-success fw-bold flex-grow-1 fs-6" onclick="deliverReadyOrder('${orderId}', '${tableName}')">
                            <i class="fa-solid fa-check-double me-1"></i> ĐÃ TRẢ MÓN / HOÀN TẤT
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 3. Chức năng Xác nhận Đã Trả Món / Hoàn tất
window.deliverReadyOrder = async function(orderId, tableName) {
    playReadyActionBeep(1046.5, 0.08); // Bíp nhẹ xác nhận bấm nút (C6)

    // 1. NGAY LẬP TỨC làm mờ và ẩn thẻ khỏi màn hình Nhận món
    const cardEl = document.getElementById(`ready-card-${orderId}`);
    if (cardEl) {
        cardEl.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        cardEl.style.transform = 'scale(0.8)';
        cardEl.style.opacity = '0';
        setTimeout(() => {
            if (cardEl) cardEl.remove();
            const countBadge = document.getElementById('readyOrdersCount');
            if (countBadge) {
                const currentCount = parseInt(countBadge.innerText, 10) || 0;
                countBadge.innerText = Math.max(0, currentCount - 1);
            }
        }, 280);
    }

    try {
        const currentUser = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
        const res = await fetch(`/api/kitchen/deliver-order/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Delivered_by: currentUser.User_name || 'Bồi bàn',
                Staff_name: currentUser.Full_name || 'Nhân viên',
                Staff_role: currentUser.Role || 'WAITER'
            })
        });

        if (res.ok) {
            if (window.toast) {
                window.toast.success(`Đã hoàn tất trả món cho ${tableName || 'đơn hàng'}!`);
            }
            // Tải lại ngầm để đồng bộ CSDL
            setTimeout(() => loadReadyOrdersData(), 400);
        } else {
            loadReadyOrdersData();
        }
    } catch (err) {
        console.error('Lỗi trả món:', err);
        loadReadyOrdersData();
    }
};

// 4. Chuyển đổi nhanh trạng thái thanh toán kèm danh tính người thu
window.toggleReadyPayment = async function(orderId) {
    playReadyActionBeep(880, 0.08); // Bíp nhẹ xác nhận bấm nút

    try {
        const currentUser = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
        const res = await fetch(`/api/kitchen/toggle-payment/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Paid_by: currentUser.User_name || 'Thu Ngân',
                Staff_name: currentUser.Full_name || 'Nhân viên',
                Staff_role: currentUser.Role || 'CASHIER'
            })
        });
        if (res.ok) {
            const data = await res.json();
            if (window.toast) {
                if (data.Payment_status === 'PAID') {
                    window.toast.success(`Đã xác nhận thu tiền bởi ${data.Paid_by}!`);
                } else {
                    window.toast.warning('Đã cập nhật: CHƯA THANH TOÁN!');
                }
            }
            loadReadyOrdersData();
        }
    } catch (err) {
        console.error('Lỗi cập nhật thanh toán:', err);
    }
};

// 5. Khởi tạo & Lắng nghe Socket thời gian thực
window.initReadyOrders = async function() {
    try {
        const res = await fetch('/api/system-config?t=' + Date.now());
        if (res.ok) {
            const data = await res.json();
            const cfg = { ...data, ...(data.config || {}) };
            localStorage.setItem('hoasen_system_config', JSON.stringify(cfg));
            if (cfg.readySoundType === 'custom_file' && cfg.readyCustomSoundUrl && window.SoundService) {
                if (typeof window.SoundService.preloadAudio === 'function') {
                    window.SoundService.preloadAudio(cfg.readyCustomSoundUrl);
                }
            }
        }
    } catch (e) {
        console.warn('Lỗi nạp cấu hình hệ thống cho Nhận món:', e);
    }

    loadReadyOrdersData();

    if (window.readyTvScreensaver && typeof window.readyTvScreensaver.init === 'function') {
        window.readyTvScreensaver.init();
    }

    if (window.socket) {
        // Lắng nghe khi bếp bấm hoàn thành món
        window.socket.off('waiter_order_ready');
        window.socket.on('waiter_order_ready', (data) => {
            playReadyNotificationSound();
            if (window.toast) {
                window.toast.success(`🔔 Bếp vừa làm xong đơn #${data.Order_code || data.Order_id}! Mời bồi bàn nhận món.`);
            }
            loadReadyOrdersData();
        });

        // Lắng nghe cập nhật trạng thái chung
        window.socket.off('order_status_updated');
        window.socket.on('order_status_updated', () => {
            loadReadyOrdersData();
        });

        // Lắng nghe cập nhật cấu hình hệ thống realtime
        window.socket.off('system_config_updated');
        window.socket.on('system_config_updated', (newConfig) => {
            if (newConfig) {
                const cur = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
                const merged = { ...cur, ...newConfig };
                localStorage.setItem('hoasen_system_config', JSON.stringify(merged));
                if (merged.readySoundType === 'custom_file' && merged.readyCustomSoundUrl && window.SoundService) {
                    if (typeof window.SoundService.preloadAudio === 'function') {
                        window.SoundService.preloadAudio(merged.readyCustomSoundUrl);
                    }
                }
            }
        });
    }
};

window.loadReadyOrdersData = loadReadyOrdersData;

