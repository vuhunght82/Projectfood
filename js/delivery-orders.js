/**
 * delivery-orders.js
 * Quản lý Bối cảnh đơn hàng (Phục vụ tại bàn vs Đơn giao / Mang về),
 * Modal Đơn Giao Hàng & CRUD Nền Tảng Giao Hàng (GrabFood, ShopeeFood, BeFood, Hotline,...)
 */

window.allDeliveryPlatformsCache = [];
window.pendingOrderActionCallback = null;
window.currentSelectedPlatform = null;
window.currentEditingPlatformId = null;

// ==========================================
// 1. KIỂM TRA BỐI CẢNH ĐƠN HÀNG (TABLE VS DELIVERY)
// ==========================================

window.hasOrderContext = function() {
    const editOrderId = localStorage.getItem('hoasen_edit_order_id') || localStorage.getItem('editing_order_id');
    if (editOrderId && editOrderId !== 'null' && editOrderId !== 'undefined' && String(editOrderId).trim() !== '') {
        return true;
    }
    const table = sessionStorage.getItem('hoasen_selected_table');
    const delivery = sessionStorage.getItem('hoasen_delivery_info');
    return Boolean((table && table.trim() !== '') || delivery);
};

window.getCurrentOrderContext = function() {
    const editOrderId = localStorage.getItem('hoasen_edit_order_id') || localStorage.getItem('editing_order_id');
    if (editOrderId && editOrderId !== 'null' && editOrderId !== 'undefined' && String(editOrderId).trim() !== '') {
        const cleanEditId = String(editOrderId).replace('#', '').trim();
        let editOrder = null;
        const editDataStr = sessionStorage.getItem('hoasen_edit_order_data') || localStorage.getItem('hoasen_edit_order_data');
        if (editDataStr) {
            try { editOrder = JSON.parse(editDataStr); } catch(e) {}
        }
        return {
            type: 'EDIT_ORDER',
            orderCode: cleanEditId,
            order: editOrder,
            tableName: editOrder?.Table_number || editOrder?.Table_name || '',
            deliveryPlatform: editOrder?.Delivery_platform || '',
            customerName: editOrder?.Customer_name || '',
            customerPhone: editOrder?.Customer_phone || '',
            deliveryAddress: editOrder?.Delivery_address || '',
            note: editOrder?.Note || ''
        };
    }

    const deliveryStr = sessionStorage.getItem('hoasen_delivery_info');
    if (deliveryStr) {
        try {
            const deliveryInfo = JSON.parse(deliveryStr);
            return { type: 'DELIVERY', data: deliveryInfo };
        } catch (e) {}
    }

    const table = sessionStorage.getItem('hoasen_selected_table');
    if (table && table.trim() !== '') {
        const isAddMore = sessionStorage.getItem('hoasen_is_add_more') === '1';
        const orderCode = sessionStorage.getItem('hoasen_table_active_order_code');
        const amount = Number(sessionStorage.getItem('hoasen_table_current_amount') || 0);
        return { 
            type: 'TABLE', 
            tableName: table, 
            isAddMore: isAddMore, 
            orderCode: orderCode, 
            amount: amount 
        };
    }

    return { type: 'NONE' };
};

window.clearOrderContext = function() {
    sessionStorage.removeItem('hoasen_selected_table');
    sessionStorage.removeItem('hoasen_selected_table_id');
    sessionStorage.removeItem('hoasen_delivery_info');
    sessionStorage.removeItem('hoasen_is_add_more');
    sessionStorage.removeItem('hoasen_table_active_order_code');
    sessionStorage.removeItem('hoasen_table_current_amount');
    sessionStorage.removeItem('hoasen_edit_order_data');
    localStorage.removeItem('hoasen_edit_order_data');
    localStorage.removeItem('hoasen_edit_order_id');
    localStorage.removeItem('editing_order_id');

    const cartTableInput = document.getElementById('cartTableNumber');
    if (cartTableInput) cartTableInput.value = '';

    window.updateOrderContextBanner();
    if (window.toast) window.toast.info('Đã hủy chọn bàn / đơn giao. Vui lòng chọn lại khi đặt món!');
};

// ==========================================
// 2. CẬP NHẬT BANNER BỐI CẢNH TRÊN GIAO DIỆN
// ==========================================

window.updateOrderContextBanner = function() {
    const bannerContainer = document.getElementById('orderContextBannerContainer');
    const cartBanner = document.getElementById('cartOrderContextBanner');
    const context = window.getCurrentOrderContext();

    let bannerHtml = '';

    if (context.type === 'EDIT_ORDER') {
        const platformBadge = context.deliveryPlatform 
            ? `<span class="badge bg-primary text-white fw-bold shadow-sm px-2 py-1"><i class="fa-solid fa-motorcycle me-1"></i> ${context.deliveryPlatform}</span>`
            : `<span class="badge bg-success text-white fw-bold shadow-sm px-2 py-1"><i class="fa-solid fa-chair me-1"></i> ${context.tableName || 'Bàn Khách'}</span>`;

        bannerHtml = `
            <div class="alert alert-warning py-2 px-3 mb-3 border-warning d-flex flex-wrap justify-content-between align-items-center rounded-3 shadow-sm" style="background: #fffbeb; border-left: 5px solid #d97706 !important;">
                <div class="d-flex align-items-center flex-wrap gap-2">
                    <span class="badge bg-warning text-dark px-3 py-2 fw-bold shadow-sm" style="font-size: 13px; border-radius: 6px;">
                        <i class="fa-solid fa-pen-to-square me-1"></i> ĐANG HIỆU CHỈNH: #${context.orderCode}
                    </span>
                    ${platformBadge}
                    <span class="fw-bold text-dark fs-6"><i class="fa-solid fa-user me-1 text-primary"></i> ${context.customerName || 'Khách hàng'}</span>
                    ${context.customerPhone ? `<span class="text-secondary small fw-bold"><i class="fa-solid fa-phone me-1"></i> ${context.customerPhone}</span>` : ''}
                    ${context.deliveryAddress ? `<span class="text-muted small text-truncate" style="max-width: 240px;" title="${context.deliveryAddress}"><i class="fa-solid fa-location-dot me-1 text-danger"></i> ${context.deliveryAddress}</span>` : ''}
                    <span class="badge bg-danger-subtle text-danger border border-danger-subtle small fw-bold">Chế độ sửa đơn</span>
                </div>
                <div class="d-flex gap-2 mt-2 mt-sm-0">
                    <button type="button" class="btn btn-sm btn-outline-danger fw-bold rounded-pill px-3 shadow-sm" onclick="window.cancelEditMode()" title="Hủy bỏ chế độ sửa đơn">
                        <i class="fa-solid fa-xmark me-1"></i> Hủy Sửa Đơn
                    </button>
                </div>
            </div>
        `;
    } else if (context.type === 'DELIVERY') {
        const del = context.data;
        const color = del.platformColor || '#00b14f';
        const icon = del.platformIcon || 'fa-solid fa-motorcycle';
        const payText = del.paymentType === 'COD' ? '💵 Tiền mặt khi nhận (COD)' : '📱 Chuyển khoản QR';

        bannerHtml = `
            <div class="alert alert-primary py-2 px-3 mb-3 border-primary d-flex flex-wrap justify-content-between align-items-center rounded-3 shadow-sm" style="background: #eef6ff; border-left: 5px solid ${color} !important;">
                <div class="d-flex align-items-center flex-wrap gap-2">
                    <span class="badge px-3 py-2 text-white fw-bold shadow-sm" style="background-color: ${color}; font-size: 13px; border-radius: 6px;">
                        <i class="${icon} me-1"></i> ${del.platformName || 'Đơn Giao'}
                    </span>
                    <span class="fw-bold text-dark fs-6"><i class="fa-solid fa-user me-1 text-primary"></i> ${del.customerName || 'Khách Giao Hàng'}</span>
                    <span class="text-secondary small fw-bold"><i class="fa-solid fa-phone me-1"></i> ${del.customerPhone || 'Chưa có SĐT'}</span>
                    ${del.deliveryAddress ? `<span class="text-muted small text-truncate" style="max-width: 260px;" title="${del.deliveryAddress}"><i class="fa-solid fa-location-dot me-1 text-danger"></i> ${del.deliveryAddress}</span>` : ''}
                    <span class="badge bg-light text-dark border small">${payText}</span>
                </div>
                <div class="d-flex gap-2 mt-2 mt-sm-0">
                    <button type="button" class="btn btn-sm btn-outline-primary fw-bold" onclick="window.openDeliveryOrderModal({ isEdit: true })">
                        <i class="fa-solid fa-pen-to-square me-1"></i> Sửa Đơn Giao
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.clearOrderContext()" title="Hủy chọn">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
        `;
    } else if (context.type === 'TABLE') {
        const isAddMore = context.isAddMore;
        const badgeAdd = isAddMore ? `
            <span class="badge bg-warning text-dark px-2 py-1 fw-bold shadow-sm">
                <i class="fa-solid fa-plus-circle me-1"></i> BỔ SUNG MÓN (Đơn #${context.orderCode})
            </span>
        ` : '';

        bannerHtml = `
            <div class="alert alert-success py-2 px-3 mb-3 border-success d-flex flex-wrap justify-content-between align-items-center rounded-3 shadow-sm" style="background: #f0fdf4; border-left: 5px solid #2e7d32 !important;">
                <div class="d-flex align-items-center flex-wrap gap-2">
                    <span class="badge bg-success px-3 py-2 text-white fw-bold shadow-sm" style="font-size: 13px; border-radius: 6px;">
                        <i class="fa-solid fa-utensils me-1"></i> ĂN TẠI QUÁN: ${context.tableName}
                    </span>
                    ${badgeAdd}
                    <span class="text-secondary small">Các món chọn sẽ được phục vụ cho bàn này</span>
                </div>
                <div class="d-flex gap-2 mt-2 mt-sm-0">
                    <button type="button" class="btn btn-sm btn-outline-success fw-bold" onclick="window.openChooseOrderContextModal()">
                        <i class="fa-solid fa-arrows-rotate me-1"></i> Đổi Bàn / Đơn Giao
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.clearOrderContext()" title="Hủy chọn">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
        `;
    } else {
        bannerHtml = `
            <div class="alert alert-warning py-2 px-3 mb-3 border-warning d-flex flex-wrap justify-content-between align-items-center rounded-3 shadow-sm" style="background: #fffbeb; border-left: 5px solid #f59e0b !important;">
                <div class="d-flex align-items-center gap-2">
                    <i class="fa-solid fa-circle-exclamation text-warning fs-5"></i>
                    <div>
                        <div class="fw-bold text-dark" style="font-size: 13.5px;">Chưa chọn Bàn ăn hoặc Đơn giao hàng!</div>
                        <div class="text-muted small">Cần xác định bàn ăn hoặc thông tin shipper/mang về trước khi thêm món.</div>
                    </div>
                </div>
                <button type="button" class="btn btn-sm btn-warning fw-bold px-3 py-1 mt-2 mt-sm-0 rounded-pill shadow-sm" onclick="window.openChooseOrderContextModal()">
                    <i class="fa-solid fa-hand-pointer me-1"></i> Chọn Bàn Hoặc Đơn Giao
                </button>
            </div>
        `;
    }
    if (bannerContainer) bannerContainer.innerHTML = bannerHtml;
    if (cartBanner) cartBanner.innerHTML = bannerHtml;
};

// ==========================================
// 3. MODAL HỎI CHỌN BÀN HOẶC ĐƠN GIAO HÀNG
// ==========================================

window.openChooseOrderContextModal = async function(callback) {
    if (typeof callback === 'function') {
        window.pendingOrderActionCallback = callback;
    }

    const modal = document.getElementById('chooseOrderContextModal');
    if (!modal) return;

    // Tải danh sách bàn nhanh vào dropdown
    const selectEl = document.getElementById('quickTableSelect');
    if (selectEl) {
        selectEl.innerHTML = '<option value="">-- Đang nạp danh sách bàn --</option>';
        try {
            const res = await fetch('/api/tables?t=' + Date.now());
            const data = await res.json();
            const tables = data.tables || [];

            if (tables.length === 0) {
                selectEl.innerHTML = '<option value="">Không có bàn nào trong CSDL</option>';
            } else {
                selectEl.innerHTML = '<option value="">-- Chọn bàn ăn tại quán --</option>' + tables.map(t => {
                    const statusText = t.Status === 'SERVING' ? `(Đang có khách - #${t.Current_order_code || ''})` : `(Bàn trống - ${t.Seats || 4} ghế)`;
                    return `<option value="${t.Table_name}" data-code="${t.Current_order_code || ''}" data-amount="${t.Current_amount || 0}" data-id="${t.Table_id}">${t.Table_name} ${statusText}</option>`;
                }).join('');
            }
        } catch (e) {
            selectEl.innerHTML = '<option value="">Lỗi tải bàn</option>';
        }
    }

    modal.style.display = 'flex';
};

window.closeChooseOrderContextModal = function() {
    const modal = document.getElementById('chooseOrderContextModal');
    if (modal) modal.style.display = 'none';
};

window.confirmTableContextFromModal = async function() {
    const selectEl = document.getElementById('quickTableSelect');
    const tableName = selectEl ? selectEl.value : '';

    if (!tableName) {
        if (window.toast) window.toast.warning('Vui lòng chọn 1 bàn ăn cụ thể trong danh sách!');
        return;
    }

    const selectedOpt = selectEl.options[selectEl.selectedIndex];
    const orderCode = selectedOpt.dataset.code;
    const amount = Number(selectedOpt.dataset.amount || 0);
    const tableId = selectedOpt.dataset.id;

    if (orderCode && orderCode !== 'null' && orderCode !== 'undefined' && orderCode !== '') {
        // Bàn này ĐANG CÓ KHÁCH! Yêu cầu xác nhận gọi thêm món, không cho phép tự ý tạo đơn mới
        const confirmMsg = `Bàn [${tableName}] hiện ĐANG CÓ KHÁCH (Mã đơn: #${orderCode}).\n\nBạn có muốn GỌI THÊM MÓN vào đơn đang phục vụ của bàn này không?`;
        let confirmed = false;
        if (window.toast && typeof window.toast.confirm === 'function') {
            confirmed = await window.toast.confirm(confirmMsg, 'Bàn Đang Có Khách');
        } else {
            confirmed = confirm(confirmMsg);
        }

        if (!confirmed) {
            if (window.toast) {
                window.toast.warning(`Không được tạo đơn mới cho bàn [${tableName}] đang có khách! Vui lòng chọn bàn trống khác.`);
            } else {
                alert(`Không được tạo đơn mới cho bàn [${tableName}] đang có khách! Vui lòng chọn bàn trống khác.`);
            }
            return;
        }

        sessionStorage.setItem('hoasen_selected_table', tableName);
        sessionStorage.removeItem('hoasen_delivery_info');
        sessionStorage.setItem('hoasen_table_active_order_code', orderCode);
        sessionStorage.setItem('hoasen_table_current_amount', amount);
        sessionStorage.setItem('hoasen_is_add_more', '1');
        if (tableId) sessionStorage.setItem('hoasen_selected_table_id', tableId);
        if (window.toast) window.toast.info(`Đã xác nhận: Gọi THÊM MÓN vào bàn [${tableName}] (Đơn #${orderCode}).`);
    } else {
        sessionStorage.setItem('hoasen_selected_table', tableName);
        sessionStorage.removeItem('hoasen_delivery_info');
        sessionStorage.removeItem('hoasen_table_active_order_code');
        sessionStorage.removeItem('hoasen_table_current_amount');
        sessionStorage.removeItem('hoasen_is_add_more');
        if (window.toast) window.toast.success(`Đã chọn bàn [${tableName}]. Bắt đầu chọn món!`);
    }

    const cartTableInput = document.getElementById('cartTableNumber');
    if (cartTableInput) cartTableInput.value = tableName;

    window.closeChooseOrderContextModal();
    window.updateOrderContextBanner();

    if (typeof window.pendingOrderActionCallback === 'function') {
        const cb = window.pendingOrderActionCallback;
        window.pendingOrderActionCallback = null;
        cb();
    }
};

window.goToTablesMapFromModal = function() {
    window.closeChooseOrderContextModal();
    if (typeof window.navigateTo === 'function') {
        window.navigateTo('/tables');
    } else {
        window.location.href = '/tables';
    }
};

window.openDeliveryFromContextModal = function() {
    window.closeChooseOrderContextModal();
    window.openDeliveryOrderModal();
};

// ==========================================
// 4. MODAL ĐƠN GIAO HÀNG (SHIPPER / MANG VỀ)
// ==========================================

window.openDeliveryOrderModal = async function(options = {}) {
    const modal = document.getElementById('deliveryOrderModal');
    if (!modal) return;

    await window.loadDeliveryPlatforms();

    const isEdit = options.isEdit || false;
    let existingData = null;
    const delStr = sessionStorage.getItem('hoasen_delivery_info');
    if (delStr) {
        try { existingData = JSON.parse(delStr); } catch (e) {}
    }

    const nameInput = document.getElementById('deliveryCustomerName');
    const phoneInput = document.getElementById('deliveryCustomerPhone');
    const addressInput = document.getElementById('deliveryAddress');
    const noteInput = document.getElementById('deliveryNote');

    if (isEdit && existingData) {
        if (nameInput) nameInput.value = existingData.customerName || '';
        if (phoneInput) phoneInput.value = existingData.customerPhone || '';
        if (addressInput) addressInput.value = existingData.deliveryAddress || '';
        if (noteInput) noteInput.value = existingData.note || '';

        // Chọn lại radio thanh toán
        const payRadio = document.querySelector(`input[name="deliveryPaymentType"][value="${existingData.paymentType || 'COD'}"]`);
        if (payRadio) payRadio.checked = true;

        // Chọn lại nền tảng
        window.selectDeliveryPlatform(existingData.platformCode, existingData.platformName, existingData.platformColor, existingData.platformIcon, existingData.platformId);
    } else {
        if (nameInput) nameInput.value = 'Khách đặt giao';
        if (phoneInput) phoneInput.value = '';
        if (addressInput) addressInput.value = '';
        if (noteInput) noteInput.value = '';
        const payRadio = document.querySelector(`input[name="deliveryPaymentType"][value="COD"]`);
        if (payRadio) payRadio.checked = true;

        // Mặc định chọn nền tảng đầu tiên
        if (window.allDeliveryPlatformsCache.length > 0) {
            const p = window.allDeliveryPlatformsCache[0];
            window.selectDeliveryPlatform(p.Platform_code, p.Platform_name, p.Color_code, p.Icon_class, p.Platform_id);
        }
    }

    modal.style.display = 'flex';
};

window.closeDeliveryOrderModal = function() {
    const modal = document.getElementById('deliveryOrderModal');
    if (modal) modal.style.display = 'none';
};

window.loadDeliveryPlatforms = async function() {
    const container = document.getElementById('deliveryPlatformChips');
    if (!container) return;

    try {
        const res = await fetch('/api/delivery-platforms?t=' + Date.now());
        const data = await res.json();
        const platforms = data.platforms || [];
        window.allDeliveryPlatformsCache = platforms;

        if (platforms.length === 0) {
            container.innerHTML = '<div class="text-muted small py-2">Chưa có nền tảng nào. Hãy nhấn Quản Lý Nền Tảng để thêm mới!</div>';
            return;
        }

        container.innerHTML = platforms.map((p, idx) => {
            const isActive = Number(p.Is_active ?? 1) === 1;
            if (!isActive) return '';
            const color = p.Color_code || '#2e7d32';
            const icon = p.Icon_class || 'fa-solid fa-motorcycle';

            return `
                <button type="button" class="btn platform-chip-btn text-start p-2 rounded-3 border d-flex align-items-center gap-2" 
                        id="plat_btn_${p.Platform_code}" 
                        onclick="window.selectDeliveryPlatform('${p.Platform_code}', '${p.Platform_name}', '${color}', '${icon}', ${p.Platform_id})"
                        style="cursor: pointer; transition: all 0.2s; background: #ffffff; border-color: #dee2e6;">
                    <span class="d-inline-flex align-items-center justify-content-center text-white rounded-circle" style="width: 32px; height: 32px; background-color: ${color}; font-size: 14px;">
                        <i class="${icon}"></i>
                    </span>
                    <div>
                        <div class="fw-bold text-dark" style="font-size: 13px;">${p.Platform_name}</div>
                        <small class="text-muted" style="font-size: 11px;">Mã: ${p.Platform_code}</small>
                    </div>
                </button>
            `;
        }).join('');

    } catch (e) {
        console.error('Lỗi nạp platforms:', e);
        container.innerHTML = '<div class="text-danger small">Lỗi nạp danh sách nền tảng</div>';
    }
};

window.selectDeliveryPlatform = function(code, name, color, icon, id) {
    window.currentSelectedPlatform = {
        platformCode: code,
        platformName: name,
        platformColor: color,
        platformIcon: icon,
        platformId: id
    };

    document.querySelectorAll('.platform-chip-btn').forEach(btn => {
        btn.style.borderColor = '#dee2e6';
        btn.style.backgroundColor = '#ffffff';
        btn.style.boxShadow = 'none';
    });

    const activeBtn = document.getElementById(`plat_btn_${code}`);
    if (activeBtn) {
        activeBtn.style.borderColor = color || '#2e7d32';
        activeBtn.style.backgroundColor = '#f0fdf4';
        activeBtn.style.boxShadow = `0 0 0 2px ${color || '#2e7d32'}40`;
    }
};

window.confirmDeliveryOrder = function() {
    if (!window.currentSelectedPlatform) {
        if (window.toast) window.toast.warning('Vui lòng chọn 1 nền tảng giao hàng!');
        return;
    }

    const name = document.getElementById('deliveryCustomerName')?.value?.trim();
    const phone = document.getElementById('deliveryCustomerPhone')?.value?.trim();
    const address = document.getElementById('deliveryAddress')?.value?.trim();
    const note = document.getElementById('deliveryNote')?.value?.trim();
    const payType = document.querySelector('input[name="deliveryPaymentType"]:checked')?.value || 'COD';

    if (!name) {
        if (window.toast) window.toast.warning('Vui lòng nhập Tên khách hàng hoặc Mã đơn Shipper!');
        return;
    }

    // Nếu là đơn giao Shipper (không phải khách lấy mang về), khuyến khích có SĐT
    if (window.currentSelectedPlatform.platformCode !== 'TAKEAWAY' && !phone) {
        if (window.toast) window.toast.warning('Vui lòng nhập Số điện thoại khách nhận hàng!');
        return;
    }

    const deliveryData = {
        platformId: window.currentSelectedPlatform.platformId,
        platformName: window.currentSelectedPlatform.platformName,
        platformCode: window.currentSelectedPlatform.platformCode,
        platformColor: window.currentSelectedPlatform.platformColor,
        platformIcon: window.currentSelectedPlatform.platformIcon,
        customerName: name,
        customerPhone: phone,
        deliveryAddress: address,
        note: note,
        paymentType: payType
    };

    sessionStorage.setItem('hoasen_delivery_info', JSON.stringify(deliveryData));
    sessionStorage.setItem('hoasen_selected_table', `Đơn Giao - ${deliveryData.platformName}`);
    sessionStorage.removeItem('hoasen_table_active_order_code');
    sessionStorage.removeItem('hoasen_table_current_amount');
    sessionStorage.removeItem('hoasen_is_add_more');

    const cartTableInput = document.getElementById('cartTableNumber');
    if (cartTableInput) cartTableInput.value = `Đơn Giao - ${deliveryData.platformName}`;

    const cartNameInput = document.getElementById('cartCustomerName');
    if (cartNameInput) cartNameInput.value = name;

    const cartTypeSelect = document.getElementById('cartOrderType');
    if (cartTypeSelect) cartTypeSelect.value = address ? 'DELIVERY' : 'TAKE_AWAY';

    window.closeDeliveryOrderModal();
    window.updateOrderContextBanner();

    if (window.toast) {
        window.toast.success(`Đã thiết lập Đơn Giao [${deliveryData.platformName} - ${name}]. Tiến hành chọn món!`);
    }

    if (typeof window.pendingOrderActionCallback === 'function') {
        const cb = window.pendingOrderActionCallback;
        window.pendingOrderActionCallback = null;
        cb();
    }
};

// ==========================================
// 5. MODAL QUẢN LÝ NỀN TẢNG (CRUD)
// ==========================================

window.openManagePlatformsModal = function() {
    const modal = document.getElementById('managePlatformsModal');
    if (!modal) return;
    modal.style.display = 'flex';
    window.renderManagePlatformsList();
    window.resetPlatformForm();
};

window.closeManagePlatformsModal = function() {
    const modal = document.getElementById('managePlatformsModal');
    if (modal) modal.style.display = 'none';
    window.loadDeliveryPlatforms();
};

window.renderManagePlatformsList = async function() {
    const tbody = document.getElementById('managePlatformsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>';

    try {
        const res = await fetch('/api/delivery-platforms?t=' + Date.now());
        const data = await res.json();
        const platforms = data.platforms || [];
        window.allDeliveryPlatformsCache = platforms;

        if (platforms.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3 text-muted">Chưa có nền tảng nào</td></tr>';
            return;
        }

        tbody.innerHTML = platforms.map(p => {
            const isActive = Number(p.Is_active ?? 1) === 1;
            const color = p.Color_code || '#2e7d32';
            const icon = p.Icon_class || 'fa-solid fa-motorcycle';

            return `
                <tr>
                    <td class="align-middle">
                        <div class="d-flex align-items-center gap-2">
                            <span class="d-inline-flex align-items-center justify-content-center text-white rounded-circle shadow-sm" style="width: 28px; height: 28px; background-color: ${color}; font-size: 12px;">
                                <i class="${icon}"></i>
                            </span>
                            <span class="fw-bold text-dark">${p.Platform_name}</span>
                        </div>
                    </td>
                    <td class="align-middle font-monospace small">${p.Platform_code}</td>
                    <td class="align-middle">
                        <span class="badge" style="background-color: ${color}; color: #fff;">${color}</span>
                    </td>
                    <td class="align-middle">
                        <span class="badge ${isActive ? 'bg-success' : 'bg-secondary'}">${isActive ? 'Hoạt động' : 'Tạm dừng'}</span>
                    </td>
                    <td class="align-middle text-end">
                        <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2 me-1" onclick="window.editDeliveryPlatform(${p.Platform_id})" title="Chỉnh sửa">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2" onclick="window.deleteDeliveryPlatform(${p.Platform_id}, '${p.Platform_name}')" title="Xóa">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-danger text-center py-3">Lỗi tải danh sách</td></tr>';
    }
};

window.resetPlatformForm = function() {
    window.currentEditingPlatformId = null;
    const nameEl = document.getElementById('managePlatName');
    const codeEl = document.getElementById('managePlatCode');
    const iconEl = document.getElementById('managePlatIcon');
    const colorEl = document.getElementById('managePlatColor');
    const activeEl = document.getElementById('managePlatActive');
    const titleEl = document.getElementById('managePlatformFormTitle');
    const submitBtn = document.getElementById('managePlatSubmitBtn');

    if (nameEl) nameEl.value = '';
    if (codeEl) codeEl.value = '';
    if (iconEl) iconEl.value = 'fa-solid fa-motorcycle';
    if (colorEl) colorEl.value = '#00b14f';
    if (activeEl) activeEl.value = '1';
    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-plus-circle me-1"></i> Thêm Nền Tảng Mới';
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-save me-1"></i> Thêm Nền Tảng';
};

window.editDeliveryPlatform = function(id) {
    const p = (window.allDeliveryPlatformsCache || []).find(item => item.Platform_id == id);
    if (!p) return;

    window.currentEditingPlatformId = id;
    const nameEl = document.getElementById('managePlatName');
    const codeEl = document.getElementById('managePlatCode');
    const iconEl = document.getElementById('managePlatIcon');
    const colorEl = document.getElementById('managePlatColor');
    const activeEl = document.getElementById('managePlatActive');
    const titleEl = document.getElementById('managePlatformFormTitle');
    const submitBtn = document.getElementById('managePlatSubmitBtn');

    if (nameEl) nameEl.value = p.Platform_name || '';
    if (codeEl) codeEl.value = p.Platform_code || '';
    if (iconEl) iconEl.value = p.Icon_class || 'fa-solid fa-motorcycle';
    if (colorEl) colorEl.value = p.Color_code || '#00b14f';
    if (activeEl) activeEl.value = String(p.Is_active ?? 1);
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square me-1"></i> Hiệu Chỉnh: ${p.Platform_name}`;
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-check me-1"></i> Cập Nhật Nền Tảng';
};

window.saveDeliveryPlatform = async function(event) {
    if (event) event.preventDefault();

    const name = document.getElementById('managePlatName')?.value?.trim();
    let code = document.getElementById('managePlatCode')?.value?.trim();
    const icon = document.getElementById('managePlatIcon')?.value?.trim() || 'fa-solid fa-motorcycle';
    const color = document.getElementById('managePlatColor')?.value?.trim() || '#00b14f';
    const isActive = Number(document.getElementById('managePlatActive')?.value || 1);

    if (!name) {
        if (window.toast) window.toast.warning('Vui lòng nhập tên nền tảng!');
        return;
    }

    if (!code) {
        code = name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    }

    const payload = {
        Platform_name: name,
        Platform_code: code,
        Icon_class: icon,
        Color_code: color,
        Is_active: isActive
    };

    try {
        let res;
        if (window.currentEditingPlatformId) {
            res = await fetch(`/api/delivery-platforms/${window.currentEditingPlatformId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch('/api/delivery-platforms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        const data = await res.json();
        if (data.success) {
            if (window.toast) window.toast.success(window.currentEditingPlatformId ? 'Đã cập nhật nền tảng thành công!' : 'Đã thêm nền tảng mới thành công!');
            window.resetPlatformForm();
            window.renderManagePlatformsList();
        } else {
            if (window.toast) window.toast.error(data.error || 'Không thể lưu nền tảng!');
        }
    } catch (err) {
        console.error('Lỗi lưu platform:', err);
        if (window.toast) window.toast.error('Lỗi kết nối máy chủ!');
    }
};

window.deleteDeliveryPlatform = async function(id, name) {
    if (!confirm(`Bạn có chắc chắn muốn xóa nền tảng "${name}" không?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/delivery-platforms/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            if (window.toast) window.toast.success(`Đã xóa nền tảng "${name}"!`);
            window.renderManagePlatformsList();
        } else {
            if (window.toast) window.toast.error(data.error || 'Không thể xóa nền tảng!');
        }
    } catch (err) {
        console.error('Lỗi xóa platform:', err);
        if (window.toast) window.toast.error('Lỗi kết nối máy chủ!');
    }
};

// ==========================================
// 6. NÚT ICON NỔI PHÍA DƯỚI (GRAB, SHOPEE, HOTLINE...)
window.activeFloatingButtonsCache = [];
window.systemFloatingButtonsLayout = 'vertical';
window.systemFloatingButtonsLayoutLoaded = false;

// Áp dụng hướng layout (vertical / horizontal) cho container nút nổi
window.applyFloatingButtonsLayout = function(layout) {
    window.systemFloatingButtonsLayout = (layout === 'horizontal') ? 'horizontal' : 'vertical';
    window.systemFloatingButtonsLayoutLoaded = true;

    const mainContainer = document.getElementById('floatingButtonsContainer');
    const leftContainer = document.getElementById('dynamicFloatingButtonsLeft');
    const rightContainer = document.getElementById('dynamicFloatingButtonsRight');

    if (mainContainer) {
        if (window.systemFloatingButtonsLayout === 'horizontal') {
            mainContainer.classList.add('layout-horizontal');
            mainContainer.classList.remove('layout-vertical');
            if (leftContainer) leftContainer.className = 'd-flex flex-row gap-2 align-items-center';
            if (rightContainer) rightContainer.className = 'd-flex flex-row gap-2 align-items-center';
        } else {
            mainContainer.classList.add('layout-vertical');
            mainContainer.classList.remove('layout-horizontal');
            if (leftContainer) leftContainer.className = 'd-flex flex-column gap-2 align-items-center';
            if (rightContainer) rightContainer.className = 'd-flex flex-column gap-2 align-items-center';
        }
    }

    if (typeof window.renderGlobalFloatingButtons === 'function') {
        window.renderGlobalFloatingButtons();
    }
};

window.renderGlobalFloatingButtons = async function() {
    const mainContainer = document.getElementById('floatingButtonsContainer');
    const leftContainer = document.getElementById('dynamicFloatingButtonsLeft');
    const rightContainer = document.getElementById('dynamicFloatingButtonsRight');
    const legacyContainer = document.getElementById('dynamicFloatingButtonsList');
    if (!mainContainer) return;

    let user = window.currentUser;
    if (!user) {
        try { user = JSON.parse(localStorage.getItem('restaurant_user')); } catch (e) {}
    }

    const clearAllContainers = () => {
        if (leftContainer) { leftContainer.innerHTML = ''; leftContainer.style.display = 'none'; }
        if (rightContainer) { rightContainer.innerHTML = ''; rightContainer.style.display = 'none'; }
        if (legacyContainer) { legacyContainer.innerHTML = ''; legacyContainer.style.display = 'none'; }
    };

    // Chưa đăng nhập hoặc là khách hàng vãng lai: không hiển thị nút shipper nổi
    if (!user || String(user.Role || user.role).toUpperCase() === 'CUSTOMER') {
        clearAllContainers();
        return;
    }

    const roleUpper = String(user.Role || user.role || '').toUpperCase().trim();
    const username = String(user.User_name || user.username || '').toLowerCase().trim();
    const isAdmin = ['ADMIN', 'QUẢN LÝ', 'QUANLY', 'MANAGER'].includes(roleUpper) || username === 'admin' || username === 'vu';

    // Kiểm tra quyền FLOATING_SHIPPER (nếu không phải Admin)
    if (!isAdmin && typeof window.hasPermission === 'function') {
        if (!window.hasPermission(user, 'FLOATING_SHIPPER')) {
            clearAllContainers();
            return;
        }
    }

    try {
        // Nạp cấu hình layout nếu chưa có
        if (!window.systemFloatingButtonsLayoutLoaded) {
            try {
                const sysRes = await fetch('/api/system-config?t=' + Date.now());
                if (sysRes.ok) {
                    const sysData = await sysRes.json();
                    const cfg = sysData.config || sysData;
                    if (cfg && cfg.floating_buttons_layout) {
                        window.systemFloatingButtonsLayout = cfg.floating_buttons_layout;
                    }
                    window.systemFloatingButtonsLayoutLoaded = true;
                }
            } catch (err) {}
        }

        const isHorizontal = window.systemFloatingButtonsLayout === 'horizontal';

        if (isHorizontal) {
            mainContainer.classList.add('layout-horizontal');
            mainContainer.classList.remove('layout-vertical');
            if (leftContainer) leftContainer.className = 'd-flex flex-row gap-2 align-items-center';
            if (rightContainer) rightContainer.className = 'd-flex flex-row gap-2 align-items-center';
        } else {
            mainContainer.classList.add('layout-vertical');
            mainContainer.classList.remove('layout-horizontal');
            if (leftContainer) leftContainer.className = 'd-flex flex-column gap-2 align-items-center';
            if (rightContainer) rightContainer.className = 'd-flex flex-column gap-2 align-items-center';
        }

        const res = await fetch('/api/floating-buttons?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        const buttons = data.buttons || [];
        window.activeFloatingButtonsCache = buttons;

        const renderBtn = (btn) => {
            const label = btn.Button_label || '';
            const icon = btn.Icon_class || 'fa-solid fa-circle';
            const bg = btn.Bg_color || '#2e7d32';
            const tooltip = btn.Tooltip_text || label;
            return `
                <button type="button" class="floating-action-btn" 
                        style="background-color: ${bg}; color: #ffffff;" 
                        onclick="window.handleFloatingButtonById(${btn.Button_id})" 
                        title="${tooltip}">
                    <i class="${icon}"></i>
                    <span class="fab-tooltip">${label}</span>
                </button>
            `;
        };

        if (buttons.length === 0) {
            clearAllContainers();
            return;
        }

        if (mainContainer) mainContainer.style.display = 'flex';

        if (isHorizontal) {
            // Chiều ngang: Nút Giỏ Hàng to ở chính giữa, chia đều các nút khác sang 2 bên
            // Nếu số lượng nút là số LẺ: ưu tiên xếp nhiều hơn ở BÊN TRÁI
            const count = buttons.length;
            const leftCount = Math.ceil(count / 2);
            const leftBtns = buttons.slice(0, leftCount);
            const rightBtns = buttons.slice(leftCount);

            if (leftContainer) {
                leftContainer.innerHTML = leftBtns.map(renderBtn).join('');
                leftContainer.style.display = leftBtns.length > 0 ? 'flex' : 'none';
            }
            if (rightContainer) {
                rightContainer.innerHTML = rightBtns.map(renderBtn).join('');
                rightContainer.style.display = rightBtns.length > 0 ? 'flex' : 'none';
            }
            if (legacyContainer) legacyContainer.style.display = 'none';
        } else {
            // Chiều đứng: Tất cả nút xếp dọc theo cột bên trên nút Giỏ hàng
            if (leftContainer) {
                leftContainer.innerHTML = buttons.map(renderBtn).join('');
                leftContainer.style.display = 'flex';
            }
            if (rightContainer) {
                rightContainer.innerHTML = '';
                rightContainer.style.display = 'none';
            }
            if (legacyContainer) legacyContainer.style.display = 'none';
        }

    } catch (e) {
        console.error('Lỗi nạp floating buttons:', e);
    }
};

// Đăng ký nhận sự kiện realtime thay đổi cấu hình hệ thống
if (typeof window !== 'undefined') {
    const bindSocketListener = () => {
        if (window.socket && !window._floatingSocketBound) {
            window._floatingSocketBound = true;
            window.socket.on('system_config_updated', (cfg) => {
                if (cfg && cfg.floating_buttons_layout !== undefined) {
                    window.applyFloatingButtonsLayout(cfg.floating_buttons_layout);
                }
            });
        }
    };
    bindSocketListener();
    document.addEventListener('DOMContentLoaded', bindSocketListener);
};

window.handleFloatingButtonById = function(btnId) {
    const list = window.activeFloatingButtonsCache || [];
    const btn = list.find(b => Number(b.Button_id) === Number(btnId));
    if (btn) {
        window.handleFloatingButtonClick(btn);
    }
};

window.handleFloatingButtonClick = function(btn) {
    if (!btn) return;
    const actionType = btn.Action_type;
    const target = btn.Action_target || '';
    const label = btn.Button_label || 'Shipper';

    if (actionType === 'SHIPPER_PLATFORM') {
        window.quickOrderForShipperPlatform(target, label);
    } else if (actionType === 'HOTLINE') {
        const phone = target && target !== 'HOTLINE' ? target : (document.getElementById('headerBrandNameText')?.getAttribute('data-phone') || '0901234567');
        window.location.href = `tel:${phone}`;
    } else if (actionType === 'CALL_PHONE') {
        window.location.href = `tel:${target || '0901234567'}`;
    } else if (actionType === 'OPEN_URL') {
        if (target) window.open(target, '_blank');
    } else if (actionType === 'GO_CART') {
        if (typeof navigateTo === 'function') navigateTo('/cart');
        else window.location.href = '/cart';
    } else {
        window.quickOrderForShipperPlatform(target, label);
    }
};

window.quickOrderForShipperPlatform = function(platformCode, platformLabel) {
    const pCode = (platformCode || 'GRABFOOD').toUpperCase();
    let name = platformLabel || (pCode.includes('GRAB') ? 'GrabFood' : (pCode.includes('SHOPEE') ? 'ShopeeFood' : pCode));
    let color = '#00b14f';
    let icon = 'fa-solid fa-motorcycle';

    if (pCode.includes('SHOPEE')) {
        color = '#ee4d2d';
        icon = 'fa-solid fa-bag-shopping';
    } else if (pCode.includes('GRAB')) {
        color = '#00b14f';
        icon = 'fa-solid fa-motorcycle';
    } else if (pCode.includes('BE')) {
        color = '#ffc107';
        icon = 'fa-solid fa-car';
    }

    const deliveryData = {
        platformId: null,
        platformName: name,
        platformCode: pCode,
        platformColor: color,
        platformIcon: icon,
        customerName: `Tài xế ${name}`,
        customerPhone: '',
        deliveryAddress: '',
        note: `Đơn bán qua Shipper ${name}`,
        paymentType: 'COD'
    };

    sessionStorage.setItem('hoasen_delivery_info', JSON.stringify(deliveryData));
    sessionStorage.setItem('hoasen_selected_table', `Đơn Shipper - ${name}`);
    sessionStorage.removeItem('hoasen_table_active_order_code');
    sessionStorage.removeItem('hoasen_table_current_amount');
    sessionStorage.removeItem('hoasen_is_add_more');

    const cartTableInput = document.getElementById('cartTableNumber');
    if (cartTableInput) cartTableInput.value = `Đơn Shipper - ${name}`;

    const cartNameInput = document.getElementById('cartCustomerName');
    if (cartNameInput) cartNameInput.value = `Tài xế ${name}`;

    const cartTypeSelect = document.getElementById('cartOrderType');
    if (cartTypeSelect) cartTypeSelect.value = 'TAKE_AWAY';

    if (typeof window.updateOrderContextBanner === 'function') {
        window.updateOrderContextBanner();
    }

    if (window.toast) {
        window.toast.success(`🛵 Đã chọn bán cho Shipper [${name}]! Vui lòng chọn món vào giỏ hàng.`);
    }

    if (typeof navigateTo === 'function') {
        navigateTo('/cart');
    } else {
        window.location.href = '/cart';
    }
};

// Tự động kiểm tra quyền và nạp floating buttons khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.checkAuthStatus === 'function') {
        window.checkAuthStatus();
    }
});


