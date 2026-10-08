// Kết nối Socket.IO linh hoạt theo IP máy chủ (Wifi LAN / Localhost)
window.socket = typeof io === 'function' ? io(window.location.origin) : null;

// Biến trạng thái toàn cục (Chỉ khai báo 1 lần duy nhất)
var isMuted = false;
var currentKitchenTab = 'PENDING';
var currentHistoryFilter = 'TODAY';
var audioContext = null;

// Cấu hình mật độ thẻ đơn trên màn hình Bếp (4, 6, 8 đơn / hàng)
window.currentKitchenCols = Number(localStorage.getItem('kitchen_grid_cols') || 4);

window.setKitchenGridLayout = function(cols) {
    window.currentKitchenCols = Number(cols) || 4;
    localStorage.setItem('kitchen_grid_cols', window.currentKitchenCols);

    const grid = document.getElementById('kitchenCardsGrid');
    if (grid) {
        grid.classList.remove('kitchen-grid-4', 'kitchen-grid-6', 'kitchen-grid-8');
        grid.classList.add(`kitchen-grid-${window.currentKitchenCols}`);
    }

    [4, 6, 8].forEach(c => {
        const btnHeader = document.getElementById(`kdsCol${c}Btn`);
        const btnFs = document.getElementById(`fsCol${c}Btn`);
        if (btnHeader) {
            if (c === window.currentKitchenCols) {
                btnHeader.classList.remove('btn-outline-light', 'text-white-50', 'border-0');
                btnHeader.classList.add('btn-warning', 'text-dark', 'active');
            } else {
                btnHeader.classList.remove('btn-warning', 'text-dark', 'active');
                btnHeader.classList.add('btn-outline-light', 'text-white-50', 'border-0');
            }
        }
        if (btnFs) {
            if (c === window.currentKitchenCols) {
                btnFs.classList.add('btn-warning', 'text-dark');
                btnFs.classList.remove('btn-dark', 'text-warning');
            } else {
                btnFs.classList.remove('btn-warning', 'text-dark');
                btnFs.classList.add('btn-dark', 'text-warning');
            }
        }
    });

    if (Array.isArray(window.kitchenOrdersCache) && window.kitchenOrdersCache.length > 0 && typeof renderKitchenCards === 'function') {
        renderKitchenCards(window.kitchenOrdersCache);
    }
};

// Khởi tạo giao diện Bếp KDS
window.initKitchen = async function() {
    try {
        const res = await fetch('/api/system-config?t=' + Date.now());
        if (res.ok) {
            const data = await res.json();
            const cfg = { ...data, ...(data.config || {}) };
            localStorage.setItem('hoasen_system_config', JSON.stringify(cfg));
            if (cfg.kitchen_grid_cols) {
                window.currentKitchenCols = Number(cfg.kitchen_grid_cols);
            }
            // Preload toàn bộ file âm thanh riêng cho từng loại đơn
            const soundKeys = ['sound_grab_url', 'sound_shopee_url', 'sound_be_url', 'sound_xanhsm_url', 'sound_dinein_url', 'sound_takeaway_url', 'sound_add_more_url', 'sound_order_edited_url', 'kitchenCustomSoundUrl'];
            soundKeys.forEach(k => {
                if (cfg[k] && window.SoundService && typeof window.SoundService.preloadAudio === 'function') {
                    window.SoundService.preloadAudio(cfg[k]);
                }
            });
        }
    } catch (e) {
        console.warn('Lỗi nạp cấu hình hệ thống cho Bếp:', e);
    }

    // Phân quyền Tab Lịch Sử Bếp: Chỉ Admin hoặc Quản lý mới được xem, Bếp chỉ xem Đơn Chờ & Nhật Ký Của Tôi
    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const role = String(user.Role || user.role || '').toUpperCase();
    const isManagerOrAdmin = ['ADMIN', 'MANAGER', 'CASHIER', 'QUẢN LÝ', 'QUANLY'].includes(role);
    const btnHistory = document.getElementById('btnTabHistory');
    if (btnHistory) {
        btnHistory.style.display = isManagerOrAdmin ? 'inline-flex' : 'none';
    }

    window.setKitchenGridLayout(window.currentKitchenCols);
    loadKitchenOrders();
    setupSocketListeners();
    if (typeof window.checkKitchenAudioStatus === 'function') {
        window.checkKitchenAudioStatus();
    }
};

// Chuyển đổi giữa 3 Tab: Đơn Chờ Chế Biến, Lịch Sử Đơn Bếp & Nhật Ký Của Tôi
window.switchKitchenTab = function(tab) {
    currentKitchenTab = tab;
    const btnPending = document.getElementById('btnTabPending');
    const btnHistory = document.getElementById('btnTabHistory');
    const btnMyLogs = document.getElementById('btnTabMyLogs');
    const secPending = document.getElementById('kitchenPendingSection');
    const secHistory = document.getElementById('kitchenHistorySection');
    const secMyLogs = document.getElementById('kitchenMyLogsSection');

    const updateBtn = (btn, isActive) => {
        if (!btn) return;
        if (isActive) {
            btn.classList.remove('btn-outline-light', 'text-white-50', 'border-0');
            btn.classList.add('btn-warning', 'text-dark', 'active');
        } else {
            btn.classList.remove('btn-warning', 'text-dark', 'active');
            btn.classList.add('btn-outline-light', 'text-white-50', 'border-0');
        }
    };

    updateBtn(btnPending, tab === 'PENDING');
    updateBtn(btnHistory, tab === 'HISTORY');
    updateBtn(btnMyLogs, tab === 'MY_LOGS');

    if (secPending) secPending.classList.toggle('d-none', tab !== 'PENDING');
    if (secHistory) secHistory.classList.toggle('d-none', tab !== 'HISTORY');
    if (secMyLogs) secMyLogs.classList.toggle('d-none', tab !== 'MY_LOGS');

    if (tab === 'PENDING') {
        loadKitchenOrders();
    } else if (tab === 'HISTORY') {
        loadKitchenHistory();
    } else if (tab === 'MY_LOGS') {
        window.loadMyKitchenLogs();
    }
};

window.refreshCurrentKitchenView = function() {
    if (currentKitchenTab === 'PENDING') loadKitchenOrders();
    else if (currentKitchenTab === 'HISTORY') loadKitchenHistory();
    else if (currentKitchenTab === 'MY_LOGS') window.loadMyKitchenLogs();
};

// 1.5. Tải nhật ký công việc của riêng nhân viên bếp đang đăng nhập
window.loadMyKitchenLogs = async function() {
    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const username = user.User_name || user.username || 'bep';
    const tbody = document.getElementById('kitchenMyLogsTableBody');
    const kpiOrdersEl = document.getElementById('chefKpiOrdersCount');
    const kpiDishesEl = document.getElementById('chefKpiDishesCount');

    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted"><i class="fa-solid fa-circle-notch fa-spin me-2 text-warning"></i>Đang tải dữ liệu nhật ký của bạn...</td></tr>`;
    }

    try {
        const res = await fetch(`/api/kitchen/my-logs?username=${encodeURIComponent(username)}&t=${Date.now()}`);
        if (!res.ok) throw new Error('Không thể tải nhật ký bếp');
        const data = await res.json();

        if (kpiOrdersEl) kpiOrdersEl.innerText = data.todayStats?.completedOrders || 0;
        if (kpiDishesEl) kpiDishesEl.innerText = data.todayStats?.completedItems || 0;

        if (!tbody) return;

        const logs = data.logs || [];
        if (logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted"><i class="fa-solid fa-clipboard-check me-2"></i>Chưa có lịch sử nấu xong nào được ghi nhận cho tài khoản <b>${username}</b>.</td></tr>`;
            return;
        }

        tbody.innerHTML = logs.map(log => {
            const timeStr = log.Created_at ? log.Created_at.replace('T', ' ').substring(0, 19) : '--:--';
            const tableStr = log.Table_number ? `Bàn #${log.Table_number}` : 'Đơn mang về';
            const codeStr = log.Order_code || (`#${log.Order_id}`);

            let itemsDetailHtml = '';
            if (Array.isArray(log.items) && log.items.length > 0) {
                itemsDetailHtml = log.items.map(it => {
                    const itemName = it.Item_name || 'Món chay';
                    const qty = it.Quantity || 1;
                    const note = it.Note ? ` <small class="text-danger fw-bold">(${it.Note})</small>` : '';
                    return `<span class="badge bg-light text-dark border me-1 mb-1 p-2"><b>${itemName}</b> <span class="badge bg-success ms-1">x${qty}</span>${note}</span>`;
                }).join('');
            } else {
                itemsDetailHtml = `<span class="text-muted small">Chi tiết đơn hoàn tất</span>`;
            }

            return `
                <tr>
                    <td class="small text-secondary"><i class="fa-regular fa-clock me-1"></i>${timeStr}</td>
                    <td>
                        <span class="badge bg-warning-subtle text-dark border border-warning fw-bold fs-6">${tableStr}</span>
                        <div class="small text-muted mt-1"><i class="fa-solid fa-receipt me-1"></i>${codeStr}</div>
                    </td>
                    <td>${itemsDetailHtml}</td>
                    <td class="text-center">
                        <span class="badge bg-success-subtle text-success border border-success fw-bold px-2 py-1">
                            <i class="fa-solid fa-circle-check me-1"></i>Đã Nấu Xong
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Lỗi nạp nhật ký bếp:', err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-danger">Lỗi nạp nhật ký: ${err.message}</td></tr>`;
        }
    }
};

// 1. Tải danh sách đơn chờ chế biến
async function loadKitchenOrders() {
    try {
        const res = await fetch('/api/kitchen/pending-orders');
        if (!res.ok) throw new Error('Lỗi tải dữ liệu');
        const orders = await res.json();
        window.kitchenOrdersCache = Array.isArray(orders) ? orders : [];
        renderKitchenCards(window.kitchenOrdersCache);
    } catch (err) {
        console.error('Lỗi nạp đơn bếp:', err);
        renderKitchenCards([]);
    }
}

// 2. Render thẻ đơn hàng dạng Card (Đã nâng cấp hiển thị Đã sửa, NV, Ghi chú, Thời gian)
function renderKitchenCards(safeOrders) {
    const grid = document.getElementById('kitchenCardsGrid');
    const countBadge = document.getElementById('kitchenPendingCount');
    
    if (!grid) return;
    if (countBadge) countBadge.innerText = safeOrders.length;

    // Đảm bảo class grid tương ứng với cấu hình cột 4, 6, 8
    grid.classList.remove('kitchen-grid-4', 'kitchen-grid-6', 'kitchen-grid-8');
    grid.classList.add(`kitchen-grid-${window.currentKitchenCols || 4}`);

    if (!safeOrders || safeOrders.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fa-solid fa-square-check fa-4x text-success mb-3 opacity-50"></i>
                <h4 class="text-muted">Tuyệt vời! Hiện chưa có đơn hàng nào chờ bếp.</h4>
            </div>
        `;
        return;
    }

    grid.innerHTML = safeOrders.map(order => {
        const orderId = order.Order_id;
        const displayCode = order.Order_code || (`CHAY-` + orderId);
        const tableName = order.Table_number || order.Table_name || `Bàn #${orderId}`;
        const timeAgo = typeof formatTimeAgo === 'function' ? formatTimeAgo(order.Created_at) : '';
        
        const isEdited = Number(order.Is_edited || 0) === 1;
        const isAddMore = Number(order.Is_edited || 0) === 2 || Boolean(order.Is_add_more);
        const currentStatus = String(order.Status || '').toUpperCase();
        const isAccepted = currentStatus === 'COOKING' || currentStatus === 'ACCEPTED';

        let headerClass = 'kds-header-pending text-white';
        if (isAddMore) {
            headerClass = 'bg-warning text-dark fw-bold';
        } else if (isEdited) {
            headerClass = 'kds-header-edited text-dark';
        } else if (isAccepted) {
            headerClass = 'kds-header-cooking text-white';
        }

        let editedBadge = '';
        if (isAddMore) {
            editedBadge = '<span class="badge bg-danger text-white ms-1 px-2 py-1 shadow-sm" style="font-size: 11px;"><i class="fa-solid fa-plus-circle me-1"></i>GỌI THÊM MÓN</span>';
        } else if (isEdited) {
            editedBadge = '<span class="badge bg-dark text-warning ms-1 px-2 py-1" style="font-size: 10px;">⚠️ ĐÃ SỬA ĐƠN</span>';
        } else if (!isAccepted) {
            editedBadge = '<span class="badge bg-white text-dark fw-bold px-2 py-1 rounded-pill" style="font-size: 11px;">MỚI TỚI</span>';
        }

        const acceptButtonHtml = !isAccepted ? `
            <button class="btn kds-btn-accept btn-sm rounded-pill px-3 py-1 shadow-sm d-flex align-items-center gap-1" 
                    onclick="acceptKitchenOrder('${displayCode}', event)" 
                    title="Chấp nhận đơn hàng này">
                <i class="fa-solid fa-circle-check text-success"></i> Chấp nhận đơn hàng
            </button>
        ` : `
            <span class="badge bg-white text-primary fw-bold px-3 py-2 rounded-pill shadow-sm d-flex align-items-center gap-1" style="font-size: 12px;">
                <i class="fa-solid fa-fire-burner text-warning"></i> ĐÃ CHẤP NHẬN
            </span>
        `;

        // 🌟 BÓC TÁCH MÓN THEO ĐÚNG FIELD TRONG CSDL (Item_name, Quantity, Note)
        const itemsList = Array.isArray(order.Items) ? order.Items : (Array.isArray(order.items) ? order.items : []);

        const itemsHtml = itemsList.length > 0 ? itemsList.map(item => {
            const itemName = item.Item_name || item.name || item.item_name || 'Món chay';
            const itemQty = item.Quantity || item.quantity || item.qty || 1;
            const itemNote = item.Note || item.note || '';
            const isItemAddMore = itemNote.includes('[Gọi thêm]');
            const cleanNote = itemNote.replace('[Gọi thêm]', '').trim();

            const itemToppings = item.Toppings || item.toppings || '';
            let toppingsText = '';
            if (typeof itemToppings === 'string') {
                try {
                    const parsed = JSON.parse(itemToppings);
                    if (Array.isArray(parsed)) toppingsText = parsed.map(t => `${t.name} (+${Number(t.price).toLocaleString()}đ)`).join(', ');
                    else toppingsText = itemToppings;
                } catch(e) { toppingsText = itemToppings; }
            }

            const rowBg = isItemAddMore ? 'bg-warning-subtle border border-warning rounded-2 px-2 my-1' : '';

            return `
                <div class="kds-item-row d-flex justify-content-between align-items-center py-2 border-bottom ${rowBg}">
                    <div class="me-2" style="flex: 1; min-width: 0;">
                        <span class="fw-bold text-dark fs-5 d-block text-truncate">
                            ${isItemAddMore ? '<span class="badge bg-danger text-white me-1 fs-6 px-2 py-1"><i class="fa-solid fa-plus me-1"></i>GỌI THÊM</span>' : ''}
                            ${itemName}
                        </span>
                        ${toppingsText ? `<div class="text-primary fw-semibold small" style="font-size: 12px;"><i class="fa-solid fa-plus-circle me-1"></i>${toppingsText}</div>` : ''}
                        ${cleanNote ? `<div class="badge bg-danger-subtle text-danger border border-danger-subtle fw-bold mt-1" style="font-size: 11px;"><i class="fa-solid fa-comment-dots me-1"></i>${cleanNote}</div>` : ''}
                    </div>
                    <span class="kds-item-qty ${isItemAddMore ? 'qty-add-more' : ''} fs-5 fw-bold" style="min-width: 52px; text-align: center;">x${itemQty}</span>
                </div>
            `;
        }).join('') : '<div class="text-muted small py-2 text-center">Không có món nào</div>';

        const cleanCode = String(displayCode).replace('#', '').trim();
        const currentCols = Number(window.currentKitchenCols || 4);
        let bsColClass = 'col-6'; // 4 thẻ: 2 cột (50%)
        if (currentCols === 6) bsColClass = 'col-4'; // 6 thẻ: 3 cột (33.333%)
        else if (currentCols === 8) bsColClass = 'col-3'; // 8 thẻ: 4 cột (25%)

        // Phân biệt chính xác Bồi bàn / Nhân viên phục vụ và Khách hàng
        const waiterName = order.Staff_name || order.Created_by || order.Paid_by || 'NV Phục Vụ';

        let customerDisplayName = 'Khách vãng lai';
        let isMember = false;
        if (order.Member_name && order.Member_name !== 'Khách vãng lai') {
            customerDisplayName = order.Member_name;
            isMember = true;
        } else if (order.Customer_name && order.Customer_name !== 'Khách vãng lai') {
            customerDisplayName = order.Customer_name;
            if (order.Member_id || order.Member_tier) isMember = true;
        } else if (order.Member_id) {
            customerDisplayName = `Hội viên #${order.Member_id}`;
            isMember = true;
        }

        let tierLabel = '';
        if (isMember) {
            const tier = order.Member_tier || '';
            if (tier === 'SEN_KIM_CUONG') tierLabel = '💎 Kim Cương';
            else if (tier === 'SEN_HONG') tierLabel = '🌸 Sen Hồng';
            else if (tier === 'BUP_SEN') tierLabel = '🪷 Búp Sen';
            else if (tier === 'MAM_SEN') tierLabel = '🌱 Mầm Sen';
            else tierLabel = tier || 'Hội viên';
        }

        return `
            <div class="kds-col ${bsColClass} mb-3" id="kitchen-card-${cleanCode}" data-order-code="${cleanCode}" data-order-id="${orderId}">
                <div class="card kds-card shadow-sm border-0 h-100">
                    <!-- TIÊU ĐỀ THẺ (MỤC TRÊN) -->
                    <div class="card-header ${headerClass} px-3 py-2 d-flex justify-content-between align-items-center flex-wrap gap-1">
                        <div>
                            <div class="m-0 fw-bold fs-5 text-truncate" style="line-height: 1.2;">
                                ${tableName} <small class="fs-6 opacity-75 fw-normal">(${displayCode})</small>
                            </div>
                            <small class="opacity-75" style="font-size: 11px;">
                                <i class="fa-solid fa-clock me-1"></i>${order.Created_at || 'Vừa xong'} ${timeAgo ? `(${timeAgo})` : ''}
                            </small>
                        </div>
                        <div class="d-flex align-items-center gap-1">
                            ${editedBadge}
                            ${acceptButtonHtml}
                        </div>
                    </div>

                    <!-- THÂN THẺ -->
                    <div class="card-body p-2 bg-light d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-center text-muted small mb-2 px-1 border-bottom pb-1 flex-wrap gap-1" style="font-size: 11px;">
                            <span class="badge bg-white text-dark border px-2 py-1">
                                <i class="fa-solid fa-user-tie text-primary me-1"></i> Bồi bàn: <b>${waiterName}</b>
                            </span>
                            <span class="badge ${isMember ? 'bg-warning-subtle text-dark border-warning' : 'bg-white text-dark border'} px-2 py-1">
                                <i class="fa-solid fa-user ${isMember ? 'text-warning' : 'text-secondary'} me-1"></i> Khách: 
                                <b class="${isMember ? 'text-success' : 'text-dark'}">${customerDisplayName}</b>
                                ${isMember ? `<span class="badge bg-warning text-dark px-1 ms-1" style="font-size: 9px;"><i class="fa-solid fa-id-card"></i> ${tierLabel}</span>` : ''}
                            </span>
                            <span class="badge bg-white text-secondary border px-2 py-1">
                                <i class="fa-solid fa-layer-group me-1"></i> ${order.Order_type || 'DINE_IN'}
                            </span>
                        </div>

                        ${order.Delivery_platform ? `
                            <div class="p-1 mb-2 bg-primary-subtle text-primary border border-primary-subtle rounded-2 small d-flex justify-content-between align-items-center">
                                <span><i class="fa-solid fa-motorcycle me-1"></i> <b>${order.Delivery_platform}</b>${order.Customer_phone ? `(${order.Customer_phone})` : ''}</span>
                                <span class="badge bg-primary text-white">${order.Payment_type === 'COD' ? '💵 COD' : '📱 CK QR'}</span>
                            </div>
                        ` : ''}

                        <!-- KHU VỰC DANH SÁCH MÓN ĂN -->
                        <div class="bg-white p-2 rounded border mb-2 flex-grow-1" style="min-height: 110px; max-height: 250px; overflow-y: auto;">
                            ${itemsHtml}
                        </div>

                        ${order.Note ? `
                            <div class="alert alert-warning py-1 px-2 mb-1 small text-dark m-0" style="font-size: 11.5px;">
                                <i class="fa-solid fa-note-sticky me-1 text-danger"></i> <b>Ghi chú:</b> ${order.Note}
                            </div>
                        ` : ''}
                    </div>

                    <!-- NÚT THAO TÁC -->
                    <div class="card-footer bg-light p-2 d-flex gap-2 align-items-center">
                        <button class="btn kds-btn-cancel btn-outline-danger flex-shrink-0" onclick="cancelKitchenOrder('${displayCode}')" title="Hủy đơn hàng này">
                            <i class="fa-solid fa-xmark me-1"></i> HỦY
                        </button>
                        <button class="btn kds-btn-done flex-grow-1" onclick="finishKitchenOrder('${displayCode}')" title="Báo bồi bàn mang món cho khách">
                            <i class="fa-solid fa-circle-check me-1"></i> XONG (BÁO BỒI)
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 2.5. Chức năng Bếp Chấp Nhận Đơn Hàng
window.acceptKitchenOrder = async function(orderIdentifier, event) {
    if (event) event.stopPropagation();
    try {
        const cleanCode = String(orderIdentifier).replace('#', '').trim();
        let res = await fetch(`/api/kitchen/accept-order/${cleanCode}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Status: 'COOKING' })
        });

        if (!res.ok) {
            res = await fetch(`/api/kitchen/update-status/${cleanCode}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Status: 'COOKING' })
            });
        }

        if (res.ok) {
            let matchedCode = cleanCode;
            if (Array.isArray(window.kitchenOrdersCache)) {
                const target = window.kitchenOrdersCache.find(o => String(o.Order_id) === cleanCode || String(o.Order_code) === cleanCode);
                if (target) {
                    target.Status = 'COOKING';
                    matchedCode = target.Order_code || cleanCode;
                }
            }
            if (typeof showToast === 'function') {
                showToast(`Đã chấp nhận đơn hàng ${matchedCode}! Bếp đang chế biến.`, 'success');
            } else if (window.toast && typeof window.toast.success === 'function') {
                window.toast.success(`Đã chấp nhận đơn hàng ${matchedCode}! Bếp đang chế biến.`);
            }
            loadKitchenOrders();
            if (window.socket) {
                window.socket.emit('order_status_updated', { Order_code: matchedCode, Status: 'COOKING' });
            }
        }
    } catch (err) {
        console.error('Lỗi chấp nhận đơn hàng:', err);
    }
};

// 3. Chức năng Bếp Hủy Đơn
window.cancelKitchenOrder = async function(orderIdentifier) {
    const cleanCode = String(orderIdentifier).replace('#', '').trim();
    const reason = prompt(`Nhập lý do hủy đơn ${cleanCode} (VD: Hết món, Thiếu nguyên liệu, Khách đổi món):`, "Hết nguyên liệu món này");
    if (reason === null) return;

    try {
        const res = await fetch(`/api/kitchen/cancel-order/${cleanCode}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Reason: reason })
        });

        if (res.ok) {
            if (typeof showToast === 'function') {
                showToast(`Đã hủy đơn ${cleanCode}!`, 'warning');
            } else if (window.toast && typeof window.toast.warning === 'function') {
                window.toast.warning(`Đã hủy đơn ${cleanCode}!`);
            }
            loadKitchenOrders();
        }
    } catch (err) {
        console.error('Lỗi hủy đơn:', err);
    }
};

// Tiếng bíp nhẹ xác nhận thao tác bấm nút (không làm ồn ào như chuông báo đơn mới)
function playKitchenActionBeep(freq = 880, duration = 0.08) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch(e) {}
}

// 4. Báo chế biến xong (Xong báo bồi) -> Tự động đẩy các thẻ sau dịch lên
window.finishKitchenOrder = async function(orderIdentifier) {
    try {
        const cleanCode = String(orderIdentifier).replace('#', '').trim();
        const currentUser = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
        
        // Tìm phần tử thẻ để kích hoạt hiệu ứng biến mất ngay khi nhấn
        const cardCol = document.getElementById(`kitchen-card-${cleanCode}`) || 
                        document.querySelector(`[data-order-code="${cleanCode}"]`) ||
                        document.getElementById(`kitchen-card-${orderIdentifier}`);
        
        if (cardCol) {
            cardCol.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
            cardCol.style.transform = 'scale(0.85) translateY(-20px)';
            cardCol.style.opacity = '0';
        }

        const res = await fetch(`/api/kitchen/update-status/${cleanCode}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                Status: 'READY',
                Staff_username: currentUser.User_name || 'bep',
                Staff_name: currentUser.Full_name || 'Bếp Hoa Sen',
                Staff_role: currentUser.Role || 'KITCHEN'
            })
        });

        if (res.ok) {
            setTimeout(() => {
                if (cardCol && cardCol.parentNode) {
                    cardCol.remove(); // Dồn các thẻ sau dịch lên ngay
                }
                loadKitchenOrders();
                if (currentKitchenTab === 'MY_LOGS') window.loadMyKitchenLogs();
            }, 300);

            if (typeof showToast === 'function') {
                showToast(`Đã báo hoàn thành đơn ${cleanCode}!`, 'success');
            } else if (window.toast && typeof window.toast.success === 'function') {
                window.toast.success(`Đã báo hoàn thành đơn ${cleanCode}!`);
            }
        } else {
            if (cardCol) {
                cardCol.style.transform = 'none';
                cardCol.style.opacity = '1';
            }
            const errData = await res.json().catch(() => ({}));
            if (window.toast) {
                window.toast.error(errData.error || 'Có lỗi khi cập nhật trạng thái đơn!');
            }
        }
    } catch (err) {
        console.error('Lỗi cập nhật đơn:', err);
    }
};

// 5. Tải & Lọc Lịch Sử Đơn Bếp
window.filterKitchenHistory = function(type) {
    currentHistoryFilter = type;
    document.querySelectorAll('#kitchenHistorySection .btn-group-sm button').forEach(b => b.classList.remove('active'));
    
    if (type === 'TODAY') document.getElementById('btnFilterToday')?.classList.add('active');
    if (type === 'WEEK') document.getElementById('btnFilterWeek')?.classList.add('active');
    if (type === 'MONTH') document.getElementById('btnFilterMonth')?.classList.add('active');

    loadKitchenHistory();
};

async function loadKitchenHistory() {
    try {
        let url = `/api/kitchen/history?filterType=${currentHistoryFilter}`;
        if (currentHistoryFilter === 'CUSTOM') {
            const start = document.getElementById('histStartDate')?.value;
            const end = document.getElementById('histEndDate')?.value;
            if (!start || !end) {
                if (window.toast) window.toast.warning('Vui lòng chọn đầy đủ Từ ngày và Đến ngày!');
                else alert('Vui lòng chọn đầy đủ Từ ngày và Đến ngày!');
                return;
            }
            url += `&startDate=${start}&endDate=${end}`;
        }

        const res = await fetch(url);
        const orders = await res.json();
        renderKitchenHistoryTable(Array.isArray(orders) ? orders : []);
    } catch (err) {
        console.error('Lỗi nạp lịch sử:', err);
    }
}

function renderKitchenHistoryTable(orders) {
    const tbody = document.getElementById('kitchenHistoryTableBody');
    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Không tìm thấy đơn hàng nào trong thời gian này</td></tr>`;
        return;
    }

    tbody.innerHTML = orders.map(o => {
        const isCancelled = o.Status === 'CANCELLED';
        const statusBadge = isCancelled 
            ? `<span class="badge bg-danger"><i class="fa-solid fa-xmark me-1"></i>Đã Hủy Bếp</span>`
            : `<span class="badge bg-success"><i class="fa-solid fa-check me-1"></i>Đã Xong</span>`;

        const itemsStr = (o.Items || []).map(i => `<span class="badge bg-light text-dark border me-1">${i.Item_name} x${i.Quantity}</span>`).join(' ');

        return `
            <tr>
                <td class="fw-bold">${o.Order_id || o.Order_code}</td>
                <td><span class="badge bg-info text-dark fw-bold">${o.Table_name || o.Table_id || 'Bàn Ăn'}</span></td>
                <td>${itemsStr}</td>
                <td><small class="text-muted">${o.Created_at || 'N/A'}</small></td>
                <td class="text-center">${statusBadge}</td>
            </tr>
        `;
    }).join('');
}

// 6. Lắng nghe Socket Realtime & Phát âm thanh
function setupSocketListeners() {
    if (!window.socket && typeof io === 'function') {
        window.socket = io(window.location.origin);
    }
    if (!window.socket) return;
    
    // 1. Khi có đơn mới tới hoặc có đơn được sửa -> Báo chuông & Nạp lại đơn & Đọc thông báo giọng nói
    window.socket.off('kitchen_new_order');
    window.socket.on('kitchen_new_order', (orderData) => {
        console.log('🔔 [Kitchen Socket] Đã nhận đơn hàng mới:', orderData);
        triggerKitchenNotification(orderData);
        if (currentKitchenTab === 'PENDING') loadKitchenOrders();

        if (orderData && (orderData.Is_add_more || orderData.Is_edited === 2)) {
            if (window.toast) window.toast.warning(`🔔 Bàn [${orderData.Table_name || orderData.Table_number || 'Khách'}] vừa GỌI THÊM MÓN!`);
        } else if (orderData && orderData.Is_edited === 1) {
            if (window.toast) window.toast.info(`📝 Đơn #${orderData.Order_code || orderData.Order_id} vừa được hiệu chỉnh.`);
        } else {
            const srcName = orderData?.Delivery_platform || orderData?.deliveryPlatform || orderData?.Table_name || orderData?.Table_number || 'Khách';
            if (window.toast) window.toast.success(`🔔 Có đơn mới từ [${srcName}]!`);
        }

        // Kiểm tra cấu hình: Tự động in bill bếp
        try {
            const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
            if (sysConfig.autoPrintKitchen) {
                setTimeout(() => {
                    if (typeof window.printKitchenTicket === 'function') {
                        window.printKitchenTicket(orderData);
                    }
                }, 500);
            }
        } catch (e) {}
    });

    // 2. Khi cập nhật trạng thái (Bếp bấm xong hoặc thu ngân thanh toán) -> Chỉ nạp lại danh sách, KHÔNG reo chuông bếp
    window.socket.off('order_status_updated');
    window.socket.on('order_status_updated', () => {
        if (currentKitchenTab === 'PENDING') loadKitchenOrders();
    });

    // Lắng nghe cập nhật cấu hình hệ thống realtime từ máy tính Admin
    window.socket.off('system_config_updated');
    window.socket.on('system_config_updated', (newConfig) => {
        if (newConfig) {
            const cur = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
            const merged = { ...cur, ...newConfig };
            localStorage.setItem('hoasen_system_config', JSON.stringify(merged));
            console.log('⚡ [Kitchen] Đã cập nhật cấu hình hệ thống mới từ máy chủ');
            if (merged.kitchen_grid_cols) {
                window.setKitchenGridLayout(merged.kitchen_grid_cols);
            }
            if (merged.kitchenSoundType === 'custom_file' && merged.kitchenCustomSoundUrl && window.SoundService) {
                if (typeof window.SoundService.preloadAudio === 'function') {
                    window.SoundService.preloadAudio(merged.kitchenCustomSoundUrl);
                }
            }
        }
    });

    window.socket.off('kitchen_order_accepted');
    window.socket.on('kitchen_order_accepted', () => {
        if (currentKitchenTab === 'PENDING') loadKitchenOrders();
    });

    // 2. KHI CÓ ĐƠN BỊ HỦY -> BIẾN MẤT TỨC THÌ TRÊN MÀN HÌNH KHÔNG CẦN F5
    window.socket.off('kitchen_order_cancelled');
    window.socket.on('kitchen_order_cancelled', (data) => {
        const orderId = data ? data.Order_id : null;
        const cardEl = orderId ? document.getElementById(`kitchen-card-${orderId}`) : null;
        if (cardEl) {
            cardEl.style.transition = 'all 0.3s ease';
            cardEl.style.transform = 'scale(0)';
            cardEl.style.opacity = '0';
            
            setTimeout(() => {
                cardEl.remove();
                if (Array.isArray(window.kitchenOrdersCache)) {
                    window.kitchenOrdersCache = window.kitchenOrdersCache.filter(o => o.Order_id !== orderId);
                    const countBadge = document.getElementById('kitchenPendingCount');
                    if (countBadge) countBadge.innerText = window.kitchenOrdersCache.length;
                }
                const grid = document.getElementById('kitchenCardsGrid');
                if (grid && grid.children.length === 0) {
                    renderKitchenCards([]);
                }
            }, 300);
        } else {
            if (currentKitchenTab === 'PENDING') loadKitchenOrders();
        }
    });
}

// Khởi tạo AudioContext toàn cục cho iOS & Trình duyệt
var iosAudioCtx = null;
var isAudioUnlocked = false;

window.checkKitchenAudioStatus = function() {
    const banner = document.getElementById('kitchenAudioUnlockBanner');
    if (!banner) return;
    const ctx = iosAudioCtx || audioContext;
    if (isAudioUnlocked || (ctx && ctx.state === 'running')) {
        banner.style.display = 'none';
    } else {
        banner.style.display = 'flex';
    }
};

window.unlockKitchenAudioFromBanner = function() {
    if (window.SoundService && typeof window.SoundService.unlockAudio === 'function') {
        window.SoundService.unlockAudio();
    }
    unlockIOSAudio();
    if (window.SoundService && typeof window.SoundService.playAlertSound === 'function') {
        window.SoundService.playAlertSound({
            type: 'kitchen_bell',
            volume: 90,
            repeatCount: 1,
            repeatInterval: 1
        });
    } else {
        playKitchenBell();
    }
    const banner = document.getElementById('kitchenAudioUnlockBanner');
    if (banner) banner.style.display = 'none';
    if (window.toast) window.toast.success('🔊 Đã kích hoạt âm thanh chuông báo Bếp thành công!');
};

var _audioUnlockElement = null;

function unlockIOSAudio() {
    if (!iosAudioCtx) {
        iosAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (iosAudioCtx && iosAudioCtx.state === 'suspended') {
        iosAudioCtx.resume();
    }
    try {
        const buffer = iosAudioCtx.createBuffer(1, 1, 22050);
        const source = iosAudioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(iosAudioCtx.destination);
        source.start(0);
    } catch(e) {}

    // Prime HTML5 Audio element to unlock mobile audio autoplay
    try {
        if (!_audioUnlockElement) {
            _audioUnlockElement = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        }
        _audioUnlockElement.play().then(() => {
            _audioUnlockElement.pause();
        }).catch(() => {});
    } catch(e) {}

    isAudioUnlocked = true;
    const banner = document.getElementById('kitchenAudioUnlockBanner');
    if (banner) banner.style.display = 'none';

    const btnUnlock = document.getElementById('btnUnlockAudioIOS');
    if (btnUnlock) {
        btnUnlock.className = 'btn btn-success btn-sm rounded-pill px-3';
        btnUnlock.innerHTML = '<i class="fa-solid fa-volume-high"></i> Âm Thanh: ĐÃ BẬT';
    }
}

document.addEventListener('touchstart', unlockIOSAudio, { capture: true, once: false });
document.addEventListener('click', unlockIOSAudio, { capture: true, once: false });
document.addEventListener('keydown', unlockIOSAudio, { capture: true, once: false });

var lastNotifiedOrderKey = null;
var lastNotifiedTimestamp = 0;

function formatSpokenPlatform(plat) {
    if (!plat) return '';
    const p = String(plat).toUpperCase();
    if (p.includes('GRAB')) return 'Grab Food';
    if (p.includes('SHOPEE')) return 'Shopee Food';
    if (p.includes('BE')) return 'Be Food';
    if (p.includes('XANH')) return 'Xanh SM';
    if (p.includes('HOTLINE')) return 'Hotline';
    if (p.includes('GOJEK')) return 'Go Jek';
    return plat;
}

function getKitchenCustomSoundForOrder(orderData, sysConfig) {
    if (!orderData || !sysConfig) return '';
    let platform = String(orderData.Delivery_platform || orderData.deliveryPlatform || '').toUpperCase();
    let tableName = String(orderData.Table_name || orderData.Table_number || '').toUpperCase();
    let orderType = String(orderData.Order_type || orderData.orderType || '').toUpperCase();

    const isGrab = platform.includes('GRAB') || tableName.includes('GRAB');
    const isShopee = platform.includes('SHOPEE') || tableName.includes('SHOPEE');
    const isBe = platform.includes('BE') || tableName.includes('BE');
    const isXanh = platform.includes('XANH') || tableName.includes('XANH');

    let platSound = '';
    if (isGrab && sysConfig.sound_grab_url) platSound = sysConfig.sound_grab_url;
    else if (isShopee && sysConfig.sound_shopee_url) platSound = sysConfig.sound_shopee_url;
    else if (isBe && sysConfig.sound_be_url) platSound = sysConfig.sound_be_url;
    else if (isXanh && sysConfig.sound_xanhsm_url) platSound = sysConfig.sound_xanhsm_url;

    // 1. Gọi thêm món
    if (orderData.Is_add_more || orderData.Is_edited === 2) {
        if (sysConfig.sound_add_more_url) return sysConfig.sound_add_more_url;
        if (platSound) return platSound;
    }

    // 2. Sửa đơn
    if (orderData.Is_edited === 1) {
        if (sysConfig.sound_order_edited_url) return sysConfig.sound_order_edited_url;
        if (platSound) return platSound;
    }

    // 3. Đơn nền tảng (Grab, Shopee, Be, Xanh SM)
    if (platSound) return platSound;

    // 4. Đơn mang về
    if (orderType === 'TAKE_AWAY' || tableName === 'MANG VỀ' || tableName.includes('MANG VỀ')) {
        if (sysConfig.sound_takeaway_url) return sysConfig.sound_takeaway_url;
    }

    // 5. Đơn tại bàn
    if (tableName && !tableName.startsWith('ĐƠN GIAO') && !tableName.startsWith('ĐƠN SHIPPER')) {
        if (sysConfig.sound_dinein_url) return sysConfig.sound_dinein_url;
    }

    // 6. Fallback: file âm thanh chung của Bếp nếu có
    if (sysConfig.kitchenSoundType === 'custom_file' && sysConfig.kitchenCustomSoundUrl) {
        return sysConfig.kitchenCustomSoundUrl;
    }

    return '';
}

// Phát âm thanh thông báo Bếp (Chuẩn hóa giống 100% như màn hình Nhận Món)
window.triggerKitchenNotification = function(orderData) {
    if (typeof isMuted !== 'undefined' && isMuted) return;

    try {
        const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        if (sysConfig.kitchenSoundEnabled === false) return;

        const customUrl = getKitchenCustomSoundForOrder(orderData, sysConfig);

        // 🌟 NẾU CÓ FILE ÂM THANH RIÊNG (Grab, Shopee, Be, Sửa đơn, Bàn, Mang về...)
        if (customUrl) {
            console.log('🔊 [Kitchen] Phát file âm thanh riêng cho đơn:', customUrl);
            if (window.SoundService && typeof window.SoundService.playAlertSound === 'function') {
                window.SoundService.playAlertSound({
                    type: 'custom_file',
                    customUrl: customUrl,
                    volume: sysConfig.kitchenSoundVolume ?? 90,
                    repeatCount: sysConfig.kitchenRepeatCount || 1,
                    repeatInterval: sysConfig.kitchenRepeatInterval || 2
                });
                return;
            }
        }

        // 🌟 NẾU CHƯA CÓ FILE RIÊNG: Phát chuông mặc định của Bếp (kèm giọng đọc nếu bật)
        if (window.SoundService && typeof window.SoundService.playAlertSound === 'function') {
            window.SoundService.playAlertSound({
                type: sysConfig.kitchenSoundType || 'kitchen_bell',
                customUrl: sysConfig.kitchenCustomSoundUrl || '',
                volume: sysConfig.kitchenSoundVolume ?? 90,
                repeatCount: sysConfig.kitchenRepeatCount || 1,
                repeatInterval: sysConfig.kitchenRepeatInterval || 2
            });

            if (sysConfig.voiceNotificationEnabled !== false) {
                setTimeout(() => {
                    announceKitchenOrderVoice(orderData);
                }, 600);
            }
            return;
        }
    } catch (e) {
        console.warn('Lỗi triggerKitchenNotification:', e);
    }

    playKitchenBell();
};

function playKitchenBell() {
    if (typeof isMuted !== 'undefined' && isMuted) return;
    unlockIOSAudio();

    try {
        const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        if (sysConfig.kitchenSoundEnabled === false) return;

        if (window.SoundService && typeof window.SoundService.playAlertSound === 'function') {
            window.SoundService.playAlertSound({
                type: sysConfig.kitchenSoundType || 'kitchen_bell',
                customUrl: sysConfig.kitchenCustomSoundUrl || '',
                volume: sysConfig.kitchenSoundVolume ?? 90,
                repeatCount: sysConfig.kitchenRepeatCount || 3,
                repeatInterval: sysConfig.kitchenRepeatInterval || 2
            });
            return;
        }
    } catch (e) {
        console.warn('Lỗi đọc cấu hình âm thanh:', e);
    }

    try {
        const ctx = iosAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(932, now);
        gain1.gain.setValueAtTime(0.5, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.4);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1244, now + 0.18);
        gain2.gain.setValueAtTime(0.6, now + 0.18);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.18);
        osc2.stop(now + 0.6);
    } catch (err) {
        console.error("Không thể phát chuông Bếp:", err);
    }
}

// 🌟 PHÁT GIỌNG ĐỌC THÔNG MINH CHO BẾP THEO NGUỒN ĐƠN HÀNG (GRAB / SHOPEE / BÀN / MANG VỀ / SỬA ĐƠN)
function announceKitchenOrderVoice(orderData) {
    if (!orderData) return;
    try {
        const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        if (sysConfig.voiceNotificationEnabled === false) return;

        let voiceText = '';
        let rawPlatform = orderData.Delivery_platform || orderData.deliveryPlatform || '';
        let platform = formatSpokenPlatform(rawPlatform);
        let tableName = orderData.Table_name || orderData.Table_number || '';
        const orderCode = orderData.Order_code || orderData.Order_id || '';
        
        // Chuẩn hóa đọc mã đơn số rõ ràng: CHAY-1122 -> "chay một một hai hai"
        let spokenCode = '';
        if (orderCode) {
            spokenCode = String(orderCode).replace(/^CHAY-?/i, 'chay ').replace(/-/g, ' ');
            spokenCode = spokenCode.replace(/(\d)/g, ' $1 ').trim();
        }

        if (orderData.Is_add_more || orderData.Is_edited === 2) {
            // 1. Trường hợp bàn gọi thêm món
            voiceText = `Thông báo: ${tableName ? tableName : 'Bàn khách'} vừa gọi thêm món!`;
        } else if (orderData.Is_edited === 1) {
            // 2. Trường hợp chỉnh sửa món trong đơn
            voiceText = `Thông báo: Có một đơn hàng thay đổi!`;
        } else if (platform) {
            // 3. Trường hợp đơn nền tảng giao hàng (Grab, Shopee Food, Be, Gojek,...)
            voiceText = `Thông báo: Có đơn hàng mới từ ${platform}!`;
        } else if (tableName && (tableName.toLowerCase().startsWith('đơn giao') || tableName.toLowerCase().startsWith('đơn shipper'))) {
            const rawP = tableName.replace(/^Đơn (Giao|Shipper)\s*-\s*/i, '').trim();
            const cleanP = formatSpokenPlatform(rawP) || 'Shipper';
            voiceText = `Thông báo: Có đơn hàng mới từ ${cleanP}!`;
        } else if (orderData.Order_type === 'TAKE_AWAY' || tableName === 'Mang về' || (tableName && tableName.toLowerCase().includes('mang về'))) {
            // 4. Trường hợp đơn mang về
            voiceText = `Thông báo: Có đơn mang về mới!`;
        } else if (tableName) {
            // 5. Trường hợp đơn tại bàn
            voiceText = `Thông báo: Có đơn hàng mới từ ${tableName}!`;
        } else {
            // 6. Trường hợp chung
            voiceText = `Thông báo: Có đơn hàng mới!`;
        }

        if (window.SoundService && typeof window.SoundService.speakVietnamese === 'function') {
            window.SoundService.speakVietnamese(voiceText, {
                volume: sysConfig.kitchenSoundVolume ?? 100,
                rate: 1.0
            });
        }
    } catch (err) {
        console.warn('Lỗi announceKitchenOrderVoice:', err);
    }
}

// Hàm in phiếu chế biến cho Bếp (Ticket Bếp)
window.printKitchenTicket = function(order) {
    if (!order) return;
    try {
        const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        const paperSize = sysConfig.kitchen_paper_size || sysConfig.paperSize || '80mm';
        const paperWidth = (paperSize === '58mm') ? '58mm' : '80mm';

        let targetOrder = order;
        if (Array.isArray(window.kitchenOrdersCache) && order.Order_id) {
            const found = window.kitchenOrdersCache.find(o => String(o.Order_id) === String(order.Order_id) || String(o.Order_code) === String(order.Order_id));
            if (found) targetOrder = found;
        }

        const orderCode = targetOrder.Order_code || ('CHAY-' + (targetOrder.Order_id || ''));
        const tableName = targetOrder.Table_number || targetOrder.Table_name || 'Bàn Khách';
        const items = Array.isArray(targetOrder.Items) ? targetOrder.Items : (Array.isArray(targetOrder.items) ? targetOrder.items : []);
        const timeStr = targetOrder.Created_at || new Date().toLocaleTimeString('vi-VN');
        const note = targetOrder.Note || '';

        const itemsHtml = items.map((it, idx) => {
            const name = it.Item_name || it.name || 'Món chay';
            const qty = it.Quantity || it.quantity || 1;
            const itNote = it.Note || it.note || '';
            return `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 6px 0; border-bottom: 1px dashed #000;">
                    <div style="flex: 1; padding-right: 8px;">
                        <div style="font-weight: bold; font-size: 15px;">${idx + 1}. ${name}</div>
                        ${itNote ? `<div style="font-size: 12px; color: #d32f2f; font-weight: bold;">>> ${itNote}</div>` : ''}
                    </div>
                    <div style="font-size: 17px; font-weight: 900; min-width: 45px; text-align: right;">x${qty}</div>
                </div>
            `;
        }).join('');

        const win = window.open('', '_blank', 'width=420,height=600');
        if (!win) return;
        win.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <title>PHIẾU BẾP - ${orderCode}</title>
                    <style>
                        @page { size: ${paperWidth} auto; margin: 0; }
                        body { font-family: 'Courier New', Courier, monospace; margin: 0; padding: 10px; color: #000; }
                    </style>
                </head>
                <body>
                    <div style="text-align: center; font-weight: bold; font-size: 16px;">*** PHIẾU BẾP CHẾ BIẾN ***</div>
                    <div style="text-align: center; font-size: 19px; font-weight: 900; margin: 4px 0;">${tableName}</div>
                    <div style="text-align: center; font-size: 12px;">Mã: #${orderCode} | Giờ: ${timeStr}</div>
                    <hr style="border: 1px solid #000; margin: 6px 0;">
                    <div>${itemsHtml}</div>
                    ${note ? `<div style="margin-top: 8px; padding: 6px; border: 1px solid #000; font-weight: bold; font-size: 12px;">GHI CHÚ: ${note}</div>` : ''}
                    <hr style="border: 1px solid #000; margin: 6px 0;">
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
    } catch (err) {
        console.error('Lỗi in phiếu bếp:', err);
    }
};

window.toggleMuteSound = function() {
    isMuted = !isMuted;
    const icon = document.getElementById('soundIcon');
    if (icon) icon.className = isMuted ? 'fa-solid fa-volume-xmark text-danger' : 'fa-solid fa-volume-high';
};

function formatTimeAgo(dateStr) {
    if (!dateStr) return 'Vừa xong';
    const diff = Math.floor((new Date() - new Date(dateStr)) / 60000);
    return diff <= 0 ? 'Vừa xong' : `${diff} phút trước`;
}

// 7. TÍNH NĂNG TOÀN MÀN HÌNH (FULLSCREEN) CHO MÀN HÌNH BẾP (HỖ TRỢ ĐIỆN THOẠI, IPHONE, IPAD, TABLET & PC)
window.toggleKitchenFullscreen = async function() {
    const fsBar = document.getElementById('kdsFullscreenDensityBar');
    const docEl = document.documentElement;
    const isCurrentlyFs = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement ||
        document.body.classList.contains('kitchen-mode')
    );

    if (!isCurrentlyFs) {
        // Kích hoạt giao diện toàn cảnh KDS
        document.body.classList.add('kitchen-mode');
        if (fsBar) fsBar.classList.remove('d-none');

        // Gọi API toàn màn hình của trình duyệt (với mọi tiền tố webkit/moz/ms)
        const reqFs = docEl.requestFullscreen ||
                      docEl.webkitRequestFullscreen ||
                      docEl.webkitRequestFullScreen ||
                      docEl.mozRequestFullScreen ||
                      docEl.msRequestFullscreen;

        if (typeof reqFs === 'function') {
            try {
                const res = reqFs.call(docEl);
                if (res && typeof res.catch === 'function') {
                    res.catch(() => {
                        // Trình duyệt không hỗ trợ hoặc bị chặn chính sách (VD: iPhone Safari)
                        // Giao diện đã được kích hoạt chế độ toàn cảnh CSS (kitchen-mode)
                    });
                }
            } catch (e) {
                // Fallback mượt mà trên iPhone / Safari
            }
        }
    } else {
        // Thoát chế độ toàn cảnh
        document.body.classList.remove('kitchen-mode');
        if (fsBar) fsBar.classList.add('d-none');

        const exitFs = document.exitFullscreen ||
                       document.webkitExitFullscreen ||
                       document.mozCancelFullScreen ||
                       document.msExitFullscreen;

        const isNativeFs = Boolean(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );

        if (typeof exitFs === 'function' && isNativeFs) {
            try {
                const res = exitFs.call(document);
                if (res && typeof res.catch === 'function') {
                    res.catch(() => {});
                }
            } catch (e) {}
        }
    }
};

['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evtName => {
    document.addEventListener(evtName, () => {
        const fsBar = document.getElementById('kdsFullscreenDensityBar');
        const isNativeFs = Boolean(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );
        if (isNativeFs) {
            document.body.classList.add('kitchen-mode');
            if (fsBar) fsBar.classList.remove('d-none');
        } else if (!document.body.classList.contains('kitchen-mode-manual')) {
            document.body.classList.remove('kitchen-mode');
            if (fsBar) fsBar.classList.add('d-none');
        }
    });
});

const PUBLIC_VAPID_KEY = 'BFmaDo_JpNOqR1MVH1gt_bSSnjure4CRP2OIZottClQfPuIJY7OVh1jI1fThGtPyflKA8exbgyKzdH0bJ44rMMI';

async function registerPushNotification() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            const register = await navigator.serviceWorker.register('/sw.js');
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;

            if (typeof PUBLIC_VAPID_KEY === 'undefined' || !PUBLIC_VAPID_KEY) return;

            const subscription = await register.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
            });

            await fetch('/api/subscribe-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            });
        } catch (err) {
            // Bỏ qua lỗi nền nếu chưa cấu hình VAPID
        }
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function requestIOSNotificationPermission() {
    if (typeof unlockIOSAudio === 'function') unlockIOSAudio();

    if (!('Notification' in window)) {
        if (window.toast) window.toast.warning('Trình duyệt của bạn chưa hỗ trợ Web Notification.');
        else alert('Trình duyệt của bạn chưa hỗ trợ Web Notification.');
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            if (window.toast) window.toast.success('Đã cấp quyền thông báo thành công!');
            else alert('✅ Đã cấp quyền thông báo thành công!');
            if (typeof registerPushNotification === 'function') registerPushNotification();
        } else {
            if (window.toast) window.toast.info('Quyền thông báo đã bị từ chối.');
            else alert('Quyền thông báo đã bị từ chối.');
        }
    } catch (err) {
        console.error('Lỗi xin quyền:', err);
    }
}

window.requestIOSNotificationPermission = requestIOSNotificationPermission;
document.addEventListener('DOMContentLoaded', registerPushNotification);