// Quản lý dữ liệu Giỏ Hàng theo thời gian thực (Client-side)
window.socket = typeof io === 'function' ? io(window.location.origin) : null;

// Bổ sung hàm toggleFloatingCart để bấm vào icon giỏ hàng xanh ở góc dưới không bị lỗi ReferenceError
window.toggleFloatingCart = function() {
    if (typeof window.navigateTo === 'function') {
        window.navigateTo('/cart');
    } else {
        window.location.href = '/cart';
    }
};

// Khởi tạo trang Giỏ hàng (Router SPA gọi hàm này)
window.initCart = function() {
    const rawEditId = localStorage.getItem('hoasen_edit_order_id') || localStorage.getItem('editing_order_id');
    let editingOrderId = null;
    if (rawEditId && rawEditId !== 'null' && rawEditId !== 'undefined') {
        editingOrderId = String(rawEditId).replace('#', '').trim();
    }

    let editOrderData = null;
    const editDataStr = sessionStorage.getItem('hoasen_edit_order_data') || localStorage.getItem('hoasen_edit_order_data');
    if (editDataStr) {
        try { editOrderData = JSON.parse(editDataStr); } catch(e) {}
    }

    if (typeof window.updateOrderContextBanner === 'function') {
        window.updateOrderContextBanner();
    }

    if (editingOrderId && editOrderData) {
        const tableInput = document.getElementById('cartTableNumber');
        const nameInput = document.getElementById('cartCustomerName');
        const typeSelect = document.getElementById('cartOrderType');
        const noteInput = document.getElementById('cartNote');

        if (tableInput) {
            tableInput.value = editOrderData.Delivery_platform 
                ? `Đơn Giao - ${editOrderData.Delivery_platform}` 
                : (editOrderData.Table_number || editOrderData.Table_name || 'Bàn 01');
        }
        if (nameInput) {
            nameInput.value = editOrderData.Customer_name || 'Khách vãng lai';
        }
        if (typeSelect) {
            typeSelect.value = editOrderData.Order_type || (editOrderData.Delivery_platform ? 'DELIVERY' : 'DINE_IN');
        }
        if (noteInput && editOrderData.Note) {
            noteInput.value = editOrderData.Note;
        }

        const paymentMethod = editOrderData.Payment_method || 'CASH';
        const methodRadio = document.querySelector(`input[name="paymentMethod"][value="${paymentMethod}"]`);
        if (methodRadio) methodRadio.checked = true;

        const submitBtn = document.getElementById('cartSubmitOrderBtn');
        if (submitBtn) {
            submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk me-1"></i> LƯU THAY ĐỔI ĐƠN HÀNG #${editingOrderId}`;
            submitBtn.className = 'btn btn-warning fw-bold text-dark';
        }
    } else {
        // Đọc thông tin Đơn giao hàng nếu có
        const delStr = sessionStorage.getItem('hoasen_delivery_info');
        if (delStr) {
            try {
                const delInfo = JSON.parse(delStr);
                const tableInput = document.getElementById('cartTableNumber');
                const nameInput = document.getElementById('cartCustomerName');
                const typeSelect = document.getElementById('cartOrderType');
                const noteInput = document.getElementById('cartNote');

                if (tableInput) tableInput.value = `Đơn Giao - ${delInfo.platformName}`;
                if (nameInput && (!nameInput.value || nameInput.value === 'Khách vãng lai')) {
                    nameInput.value = delInfo.customerName;
                }
                if (typeSelect) typeSelect.value = delInfo.deliveryAddress ? 'DELIVERY' : 'TAKE_AWAY';
                if (noteInput && !noteInput.value && delInfo.note) noteInput.value = delInfo.note;

                if (delInfo.paymentType === 'TRANSFER') {
                    const transferRadio = document.querySelector('input[name="paymentMethod"][value="BANK_TRANSFER"]');
                    if (transferRadio) transferRadio.checked = true;
                } else {
                    const cashRadio = document.querySelector('input[name="paymentMethod"][value="CASH"]');
                    if (cashRadio) cashRadio.checked = true;
                }
            } catch (e) {}
        } else {
            // Tự động điền số bàn nếu được chọn từ Sơ đồ Phòng Bàn
            const selectedTable = sessionStorage.getItem('hoasen_selected_table');
            const tableInput = document.getElementById('cartTableNumber');
            if (selectedTable && tableInput && !tableInput.value) {
                tableInput.value = selectedTable;
            }
        }
    }

    // Nạp danh sách bàn động và thiết lập sự kiện chọn bàn / loại đơn
    if (typeof window.loadCartTablesList === 'function') {
        window.loadCartTablesList();
    }
    if (typeof window.populateCartDeliveryPlatforms === 'function') {
        window.populateCartDeliveryPlatforms();
    }
    if (typeof window.handleCartOrderTypeChange === 'function') {
        window.handleCartOrderTypeChange();
    }

    const tableInput = document.getElementById('cartTableNumber');
    if (tableInput && !tableInput.dataset.hasAddMoreListener) {
        tableInput.dataset.hasAddMoreListener = '1';
        tableInput.addEventListener('change', () => window.checkCartTableAddMoreStatus());
        tableInput.addEventListener('blur', () => window.checkCartTableAddMoreStatus());
    }

    const paidImmediateEl = document.getElementById('cartCashPaidImmediate');
    if (paidImmediateEl) paidImmediateEl.checked = false;

    // Khôi phục hội viên đã áp dụng nếu người dùng quay lại từ menu hoặc phòng bàn
    const savedMemberStr = sessionStorage.getItem('hoasen_applied_member');
    if (savedMemberStr && !window.cartAppliedMember) {
        try {
            window.cartAppliedMember = JSON.parse(savedMemberStr);
        } catch(e) {}
    }
    if (window.cartAppliedMember) {
        const nameInput = document.getElementById('cartCustomerName');
        if (nameInput && (!nameInput.value || nameInput.value === 'Khách vãng lai')) {
            nameInput.value = window.cartAppliedMember.Full_name;
        }
        window.renderCartMemberAppliedCard();
    }

    window.renderCart();
    window.updateFloatingCartBadge();
    window.togglePaymentInfo();
    window.checkCartTableAddMoreStatus();
};

// ==========================================
// 1.1. QUẢN LÝ CHỌN BÀN & LOẠI ĐƠN TRÊN GIỎ HÀNG
// ==========================================

window.loadCartTablesList = async function(preselectTableName = '') {
    const selectEl = document.getElementById('cartTableSelect');
    const tableInput = document.getElementById('cartTableNumber');
    if (!selectEl) return;

    try {
        const res = await fetch('/api/tables?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        const tables = data.tables || [];

        let currentVal = preselectTableName || tableInput?.value || sessionStorage.getItem('hoasen_selected_table') || '';

        let html = '<option value="">-- Chọn bàn phục vụ --</option>';
        tables.forEach(t => {
            const isServing = t.Status === 'SERVING';
            const icon = isServing ? '🔴' : '🟢';
            const statusDesc = isServing ? `(Đang có khách - #${t.Current_order_code || ''})` : `(Bàn trống - ${t.Seats || 4} chỗ)`;
            const isSelected = (currentVal && currentVal.toLowerCase() === t.Table_name.toLowerCase()) ? 'selected' : '';
            html += `<option value="${t.Table_name}" data-status="${t.Status}" data-code="${t.Current_order_code || ''}" data-amount="${t.Current_amount || 0}" ${isSelected}>${icon} ${t.Table_name} ${statusDesc}</option>`;
        });
        html += '<option value="__CUSTOM__">✍️ Nhập số bàn khác...</option>';
        selectEl.innerHTML = html;

        if (currentVal && currentVal !== 'Mang về' && !currentVal.startsWith('Đơn Giao')) {
            const match = tables.find(t => t.Table_name.toLowerCase() === currentVal.toLowerCase());
            if (match) {
                selectEl.value = match.Table_name;
                if (tableInput) {
                    tableInput.value = match.Table_name;
                    tableInput.style.display = 'none';
                }
            } else {
                selectEl.value = '__CUSTOM__';
                if (tableInput) {
                    tableInput.value = currentVal;
                    tableInput.style.display = 'inline-block';
                }
            }
        }
    } catch(e) {
        console.error('Lỗi loadCartTablesList:', e);
    }
};

window.handleCartOrderTypeChange = function() {
    const typeSelect = document.getElementById('cartOrderType');
    const tableGroup = document.getElementById('cartTableGroup');
    const delGroup = document.getElementById('cartDeliveryGroup');
    const tableInput = document.getElementById('cartTableNumber');
    if (!typeSelect) return;

    const orderType = typeSelect.value;
    if (orderType === 'DINE_IN') {
        if (tableGroup) tableGroup.style.display = 'block';
        if (delGroup) delGroup.style.display = 'none';
        const selectEl = document.getElementById('cartTableSelect');
        if (selectEl && selectEl.value && selectEl.value !== '__CUSTOM__') {
            if (tableInput) tableInput.value = selectEl.value;
        }
    } else if (orderType === 'TAKE_AWAY') {
        if (tableGroup) tableGroup.style.display = 'none';
        if (delGroup) delGroup.style.display = 'none';
        if (tableInput) tableInput.value = 'Mang về';
        const noticeEl = document.getElementById('cartAddMoreNoticeContainer');
        if (noticeEl) noticeEl.innerHTML = '';
        sessionStorage.removeItem('hoasen_selected_table');
        sessionStorage.removeItem('hoasen_table_active_order_code');
        sessionStorage.removeItem('hoasen_is_add_more');
    } else if (orderType === 'DELIVERY') {
        if (tableGroup) tableGroup.style.display = 'none';
        if (delGroup) delGroup.style.display = 'block';
        const platform = document.getElementById('cartDeliveryPlatformSelect')?.value || 'GRABFOOD';
        if (tableInput) tableInput.value = `Đơn Giao - ${platform}`;
        const noticeEl = document.getElementById('cartAddMoreNoticeContainer');
        if (noticeEl) noticeEl.innerHTML = '';
        sessionStorage.removeItem('hoasen_selected_table');
        sessionStorage.removeItem('hoasen_table_active_order_code');
        sessionStorage.removeItem('hoasen_is_add_more');
    }
    window.checkCartTableAddMoreStatus();
};

window.handleCartTableSelectChange = function() {
    const selectEl = document.getElementById('cartTableSelect');
    const tableInput = document.getElementById('cartTableNumber');
    if (!selectEl || !tableInput) return;

    const val = selectEl.value;
    if (val === '__CUSTOM__') {
        tableInput.style.display = 'inline-block';
        tableInput.value = '';
        tableInput.focus();
        sessionStorage.removeItem('hoasen_selected_table');
        sessionStorage.removeItem('hoasen_table_active_order_code');
        sessionStorage.removeItem('hoasen_is_add_more');
    } else if (val) {
        tableInput.style.display = 'none';
        tableInput.value = val;
        sessionStorage.setItem('hoasen_selected_table', val);

        const selectedOpt = selectEl.options[selectEl.selectedIndex];
        const status = selectedOpt?.dataset?.status;
        const orderCode = selectedOpt?.dataset?.code;
        const amount = selectedOpt?.dataset?.amount;

        if (status === 'SERVING' && orderCode) {
            sessionStorage.setItem('hoasen_table_active_order_code', orderCode);
            sessionStorage.setItem('hoasen_table_current_amount', amount || 0);
            sessionStorage.setItem('hoasen_is_add_more', '1');
        } else {
            sessionStorage.removeItem('hoasen_table_active_order_code');
            sessionStorage.removeItem('hoasen_table_current_amount');
            sessionStorage.removeItem('hoasen_is_add_more');
        }
    } else {
        tableInput.value = '';
        sessionStorage.removeItem('hoasen_selected_table');
        sessionStorage.removeItem('hoasen_table_active_order_code');
        sessionStorage.removeItem('hoasen_table_current_amount');
        sessionStorage.removeItem('hoasen_is_add_more');
    }
    window.checkCartTableAddMoreStatus();
};

window.handleCartDeliveryPlatformChange = function() {
    const selectEl = document.getElementById('cartDeliveryPlatformSelect');
    const tableInput = document.getElementById('cartTableNumber');
    if (selectEl && tableInput) {
        tableInput.value = `Đơn Giao - ${selectEl.value}`;
    }
};

// Nạp danh sách nền tảng giao hàng thực tế từ cơ sở dữ liệu
window.populateCartDeliveryPlatforms = async function() {
    const selectEl = document.getElementById('cartDeliveryPlatformSelect');
    if (!selectEl) return;

    try {
        const res = await fetch('/api/delivery-platforms?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        const platforms = data.platforms || [];
        if (platforms.length === 0) return;

        const currentVal = selectEl.value;
        selectEl.innerHTML = platforms.map(p => {
            return `<option value="${p.Platform_code}">${p.Platform_name}</option>`;
        }).join('');

        if (currentVal && platforms.some(p => p.Platform_code === currentVal)) {
            selectEl.value = currentVal;
        } else if (platforms.length > 0) {
            selectEl.value = platforms[0].Platform_code;
        }
    } catch (e) {
        console.error('Lỗi populateCartDeliveryPlatforms:', e);
    }
};

// Lắng nghe realtime cập nhật danh sách nền tảng giao hàng
if (typeof window !== 'undefined') {
    const bindCartPlatformsSocket = () => {
        if (window.socket && !window._cartPlatformsSocketBound) {
            window._cartPlatformsSocketBound = true;
            window.socket.on('delivery_platforms_updated', () => {
                if (typeof window.populateCartDeliveryPlatforms === 'function') {
                    window.populateCartDeliveryPlatforms();
                }
            });
        }
    };
    bindCartPlatformsSocket();
    document.addEventListener('DOMContentLoaded', bindCartPlatformsSocket);
}

// Kiểm tra bàn đang phục vụ để hiển thị trạng thái Gọi thêm món
window.checkCartTableAddMoreStatus = async function() {
    const tableInput = document.getElementById('cartTableNumber');
    const noticeEl = document.getElementById('cartAddMoreNoticeContainer');
    const submitBtn = document.getElementById('cartSubmitOrderBtn');
    if (!tableInput || !noticeEl) return;

    const tableName = tableInput.value?.trim();
    if (!tableName || tableName === 'Mang về' || tableName.startsWith('Đơn Giao')) {
        noticeEl.innerHTML = '';
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i> XÁC NHẬN ĐẶT HÀNG';
            submitBtn.classList.remove('btn-warning');
            submitBtn.classList.add('btn-primary');
        }
        return;
    }

    try {
        const res = await fetch('/api/tables?t=' + Date.now());
        const data = await res.json();
        const tables = data.tables || [];

        const cleanTable = tableName.replace(/^Bàn\s*/i, 'B').toLowerCase().trim();
        const found = tables.find(t => 
            t.Table_name.toLowerCase().trim() === tableName.toLowerCase().trim() ||
            t.Table_code.toLowerCase().trim() === tableName.toLowerCase().trim() ||
            t.Table_code.toLowerCase().trim() === cleanTable
        );

        if (found && found.Status === 'SERVING' && found.Current_order_code) {
            const orderCode = found.Current_order_code;
            const currentAmount = Number(found.Current_amount || 0);
            sessionStorage.setItem('hoasen_table_active_order_code', orderCode);
            sessionStorage.setItem('hoasen_table_current_amount', currentAmount);
            sessionStorage.setItem('hoasen_is_add_more', '1');

            noticeEl.innerHTML = `
                <div class="alert alert-warning py-2 px-3 mb-3 border-warning rounded-3 shadow-sm" style="background: #fffbeb; border-left: 5px solid #d97706 !important;">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <div class="fw-bold text-dark fs-6">
                                <i class="fa-solid fa-layer-group text-warning me-1"></i> Bàn Đang Có Khách: <span class="badge bg-warning text-dark fs-6">${found.Table_name}</span>
                            </div>
                            <div class="small text-secondary mt-1">
                                Mã đơn hiện tại: <b class="text-dark">#${orderCode}</b> | Đang phục vụ: <b class="text-danger fw-bold">${currentAmount.toLocaleString('vi-VN')} đ</b>
                            </div>
                        </div>
                        <span class="badge bg-warning text-dark border border-warning fw-bold px-3 py-2 rounded-pill shadow-sm">
                            <i class="fa-solid fa-plus-circle me-1"></i> Chế độ Gọi Thêm
                        </span>
                    </div>
                    <div class="small text-muted mt-1 pt-1 border-top" style="font-size: 11.5px;">
                        📌 Món bạn chọn sẽ được gửi trực tiếp xuống bếp làm món bổ sung cho bàn này.
                    </div>
                </div>
            `;
            if (submitBtn) {
                submitBtn.innerHTML = `<i class="fa-solid fa-plus-circle me-1"></i> BỔ SUNG MÓN CHO BÀN [${found.Table_name}]`;
                submitBtn.className = 'btn btn-warning fw-bold text-dark w-100 py-2 shadow-sm';
            }
        } else if (found) {
            sessionStorage.removeItem('hoasen_table_active_order_code');
            sessionStorage.removeItem('hoasen_table_current_amount');
            sessionStorage.removeItem('hoasen_is_add_more');
            noticeEl.innerHTML = `
                <div class="alert alert-success py-2 px-3 mb-3 border-success rounded-3 shadow-sm" style="background: #f0fdf4; border-left: 5px solid #2e7d32 !important;">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="fw-bold text-success">
                            <i class="fa-solid fa-circle-check me-1"></i> Bàn [${found.Table_name}] đang trống (${found.Seats || 4} chỗ).
                        </div>
                        <span class="badge bg-success text-white px-2 py-1">Tạo Đơn Mới</span>
                    </div>
                </div>
            `;
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i> XÁC NHẬN ĐẶT HÀNG';
                submitBtn.className = 'btn btn-success fw-bold text-white w-100 py-2 shadow-sm';
            }
        } else {
            noticeEl.innerHTML = '';
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i> XÁC NHẬN ĐẶT HÀNG';
                submitBtn.className = 'btn btn-success fw-bold text-white w-100 py-2 shadow-sm';
            }
        }
    } catch (err) {
        console.error('Lỗi kiểm tra bàn:', err);
    }
};

// Render danh sách món trong Giỏ hàng
window.renderCart = function() {
    const tbody = document.getElementById('cartTableBody') || document.getElementById('cartItemsContainer');
    if (!tbody) return;

    // Đọc đồng thời cả 2 key để chống lệch dữ liệu giữa các trang
    let cart = JSON.parse(localStorage.getItem('hoasen_cart') || '[]');
    if (cart.length === 0) {
        cart = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');
    }

    const editOrderId = localStorage.getItem('hoasen_edit_order_id');

    // Hiển thị thông báo nếu đang trong chế độ sửa đơn
    const editNotice = document.getElementById('editOrderNotice');
    if (editNotice) {
        if (editOrderId) {
            editNotice.innerHTML = `
                <div class="alert alert-warning py-2 mb-3 fw-bold d-flex justify-content-between align-items-center" style="border-radius: 8px;">
                    <span><i class="fa-solid fa-pen-to-square me-2"></i>Đang hiệu chỉnh Đơn hàng #${editOrderId}</span>
                    <button class="btn btn-sm btn-outline-dark py-0" onclick="window.cancelEditMode()">Hủy sửa</button>
                </div>`;
        } else {
            editNotice.innerHTML = '';
        }
    }

    if (!cart || cart.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4 text-muted">
                    Giỏ hàng đang trống. Hãy qua trang <a href="javascript:void(0)" onclick="navigateTo('/menu-cards')" class="fw-bold text-success">Menu Dạng Thẻ</a> để chọn món!
                </td>
            </tr>
        `;
        window.updateCartTotal(0);
        window.togglePaymentInfo();
        return;
    }

    let total = 0;
    tbody.innerHTML = cart.map((item, index) => {
        const price = Number(item.price || item.Unit_price || 35000);
        const qty = Number(item.quantity || item.Quantity || 1);
        const itemTotal = price * qty;
        total += itemTotal;

        const toppings = Array.isArray(item.toppings) ? item.toppings : [];
        const toppingsHtml = toppings.length > 0 ? `
            <div class="small text-muted mt-1" style="font-size: 11px;">
                <span class="text-success fw-bold"><i class="fa-solid fa-plus-circle me-1"></i>Topping:</span> 
                ${toppings.map(t => `${t.name} (+${Number(t.price).toLocaleString('vi-VN')}đ)`).join(', ')}
            </div>
        ` : '';

        const itemNote = item.note || item.Note || '';

        const isAddMoreMode = sessionStorage.getItem('hoasen_is_add_more') === '1';
        const isThisItemAddMore = (itemNote && itemNote.includes('[Gọi thêm]')) || isAddMoreMode;
        const addMoreBadge = isThisItemAddMore ? `<span class="badge bg-danger text-white me-1 px-2 py-1 shadow-sm" style="font-size: 11px;"><i class="fa-solid fa-plus me-1"></i>Gọi thêm</span>` : '';

        return `
            <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 10px 8px; font-size: 13px; vertical-align: top;">
                    <div class="fw-bold text-dark d-flex align-items-center flex-wrap gap-1">${addMoreBadge}<span>${item.name || item.Item_name}</span></div>
                    ${toppingsHtml}
                    <div class="mt-1">
                        <input type="text" class="form-control form-control-sm item-note-input" 
                               placeholder="Ghi chú món (vd: ít ngọt, không cay...)" 
                               value="${itemNote}" 
                               oninput="window.updateCartItemNote(${index}, this.value)" 
                               style="font-size: 11px; padding: 3px 6px; border-radius: 4px; border: 1px dashed #ced4da; background-color: #fafbfc;">
                    </div>
                </td>
                <td class="text-center" style="padding: 10px 4px; width: 105px; vertical-align: top;">
                    <div class="input-group input-group-sm">
                        <button class="btn btn-outline-secondary px-2" type="button" onclick="window.updateCartQty(${index}, -1)">-</button>
                        <input type="text" class="form-control text-center px-1 fw-bold" value="${qty}" readonly style="font-size: 12px;">
                        <button class="btn btn-outline-secondary px-2" type="button" onclick="window.updateCartQty(${index}, 1)">+</button>
                    </div>
                </td>
                <td class="text-end fw-bold text-success" style="padding: 10px 8px; font-size: 13px; vertical-align: top; white-space: nowrap;">
                    ${new Intl.NumberFormat('vi-VN').format(itemTotal)} đ
                </td>
                <td class="text-center" style="padding: 10px 4px; width: 36px; vertical-align: top;">
                    <button class="btn btn-sm text-danger p-0 border-0" onclick="window.removeCartItem(${index})" title="Xóa món">
                        <i class="fa-solid fa-xmark fs-5"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    window.updateCartTotal(total);
    window.togglePaymentInfo();
};

// Cập nhật ghi chú riêng cho từng dòng món ăn
window.updateCartItemNote = function(index, noteVal) {
    let cart = JSON.parse(localStorage.getItem('hoasen_cart') || '[]');
    if (cart.length === 0) cart = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');

    if (cart[index]) {
        cart[index].note = noteVal;
        localStorage.setItem('hoasen_cart', JSON.stringify(cart));
        localStorage.setItem('restaurant_cart', JSON.stringify(cart));
    }
};

// Cập nhật số lượng món
window.updateCartQty = function(index, delta) {
    let cart = JSON.parse(localStorage.getItem('hoasen_cart') || '[]');
    if (cart.length === 0) cart = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');

    if (cart[index]) {
        let currentQty = Number(cart[index].quantity || cart[index].Quantity || 1);
        currentQty += delta;
        
        if (currentQty <= 0) {
            cart.splice(index, 1);
        } else {
            cart[index].quantity = currentQty;
            cart[index].Quantity = currentQty;
        }
        
        localStorage.setItem('hoasen_cart', JSON.stringify(cart));
        localStorage.setItem('restaurant_cart', JSON.stringify(cart));
        window.renderCart();
        window.updateFloatingCartBadge();
    }
};

// Xóa 1 món
window.removeCartItem = function(index) {
    let cart = JSON.parse(localStorage.getItem('hoasen_cart') || '[]');
    if (cart.length === 0) cart = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');

    cart.splice(index, 1);
    localStorage.setItem('hoasen_cart', JSON.stringify(cart));
    localStorage.setItem('restaurant_cart', JSON.stringify(cart));
    window.renderCart();
    window.updateFloatingCartBadge();
};

// Xóa sạch giỏ
window.clearCart = function() {
    if (window.toast.confirm('Bạn có muốn xóa toàn bộ giỏ hàng không?')) {
        localStorage.removeItem('hoasen_cart');
        localStorage.removeItem('restaurant_cart');
        localStorage.removeItem('hoasen_edit_order_id');
        sessionStorage.removeItem('hoasen_applied_member');
        window.cartAppliedMember = null;
        window.renderCart();
        window.updateFloatingCartBadge();
    }
};

// Hủy chế độ sửa đơn
window.cancelEditMode = function() {
    localStorage.removeItem('hoasen_edit_order_id');
    localStorage.removeItem('editing_order_id');
    sessionStorage.removeItem('hoasen_edit_order_data');
    localStorage.removeItem('hoasen_edit_order_data');
    localStorage.removeItem('hoasen_cart');
    localStorage.removeItem('restaurant_cart');
    sessionStorage.removeItem('hoasen_delivery_info');
    sessionStorage.removeItem('hoasen_selected_table');
    sessionStorage.removeItem('hoasen_applied_member');
    window.cartAppliedMember = null;
    window.renderCart();
    if (typeof window.updateOrderContextBanner === 'function') window.updateOrderContextBanner();
    if (typeof window.updateFloatingCartBadge === 'function') window.updateFloatingCartBadge();
    if (window.toast) window.toast.info('Đã hủy chế độ sửa đơn hàng.');
    if (typeof window.navigateTo === 'function') {
        window.navigateTo('/orders');
    } else {
        window.location.href = '/orders';
    }
};

// ==========================================
// THẺ THÀNH VIÊN & TÍCH ĐIỂM TRONG GIỎ HÀNG
// ==========================================
window.cartAppliedMember = null;
window.cartAppliedVoucher = null;
window.cartPointsToUse = 0;
window.lastCalcDiscountPercent = 0;
window.lastCalcDiscountAmount = 0;
window.lastCalcVoucherDiscount = 0;
window.lastCalcPointsUsed = 0;
window.lastCalcPointsAmount = 0;
window.lastCalcPointsEarned = 0;
window.lastCalcPrepaidUsed = 0;
window.lastCalcFinalTotal = 0;

// Tra cứu thành viên khi nhập SĐT hoặc quét QR (hỗ trợ requireOtp)
window.cartLookupMember = async function(explicitPhone, requireOtp = false) {
    let phone = explicitPhone || document.getElementById('cartMemberPhoneInput')?.value?.trim();
    if (!phone) {
        const delStr = sessionStorage.getItem('hoasen_delivery_info');
        if (delStr) {
            try { phone = JSON.parse(delStr).customerPhone; } catch (e) {}
        }
    }

    if (!phone) {
        if (window.toast) window.toast.warning('Vui lòng nhập số điện thoại khách hàng!');
        return;
    }

    try {
        const res = await fetch(`/api/members/lookup?q=${encodeURIComponent(phone)}`);
        const data = await res.json();

        if (!data.success || !data.found) {
            const cleanDigits = String(phone).replace(/\D/g, '');
            const looksLikePhone = cleanDigits.length >= 9 && cleanDigits.length <= 11 && String(phone).length <= 13;
            if (looksLikePhone) {
                const confirmed = window.toast ? await window.toast.confirm(`Số điện thoại "${phone}" chưa có thẻ thành viên. Bạn có muốn đăng ký nhanh để tích điểm ngay không?`) : false;
                if (confirmed) window.cartOpenQuickRegisterModal(phone);
            } else if (window.toast) {
                const shortText = phone.length > 30 ? phone.substring(0, 30) + '...' : phone;
                window.toast.info(`Đã đọc mã: "${shortText}". Chưa có hội viên trùng khớp với mã này.`);
            }
            return;
        }

        // YÊU CẦU BẢO MẬT: Dù nhân viên quét mã QR hay nhập SĐT vào giỏ hàng,
        // đều bắt buộc khách hàng phải đăng nhập trên máy của mình để lấy mã 6 số đếm lùi 30 giây mới được áp dụng thẻ!
        if (typeof window.cartOpenOtpVerifyModal === 'function') {
            window.cartOpenOtpVerifyModal(data.member);
            return;
        }

        window.cartAppliedMember = data.member;
        try { sessionStorage.setItem('hoasen_applied_member', JSON.stringify(data.member)); } catch (e) {}
        const nameInput = document.getElementById('cartCustomerName');
        if (nameInput && (!nameInput.value || nameInput.value === 'Khách vãng lai')) {
            nameInput.value = data.member.Full_name;
        }

        window.renderCartMemberAppliedCard();
        window.renderCart();
        if (window.toast) window.toast.success(`Đã áp dụng thẻ: ${data.member.Full_name} (${data.member.tierInfo?.name || 'Mầm Sen'})`);
    } catch (err) {
        console.error('Lỗi cartLookupMember:', err);
        if (window.toast) window.toast.error('Lỗi tra cứu thẻ: ' + err.message);
    }
};

// Render card thành viên đã áp dụng vào giỏ hàng (Tối ưu chuẩn mobile dọc không bị vỡ giao diện)
window.renderCartMemberAppliedCard = function() {
    const area = document.getElementById('cartMemberAppliedArea');
    const inputGroup = document.getElementById('cartMemberInputGroup');
    if (!area) return;

    if (!window.cartAppliedMember) {
        area.style.display = 'none';
        area.innerHTML = '';
        if (inputGroup) inputGroup.style.display = 'flex';
        return;
    }

    if (inputGroup) inputGroup.style.display = 'none';
    area.style.display = 'block';

    const m = window.cartAppliedMember;
    const t = m.tierInfo || {};
    const b = m.birthdayInfo || {};
    const l = m.lunarInfo || {};

    let bdayBadge = '';
    if (b.isBirthdaySoon) {
        bdayBadge = `<div class="alert alert-danger py-1 px-2 mb-2 small text-center fw-bold rounded-2">🎂 Sinh nhật tuần này: ${t.birthdayReward || 'Ưu đãi đặc biệt'}</div>`;
    }

    let lunarBadge = '';
    if (l.isDoublePoints) {
        lunarBadge = `<div class="badge bg-danger text-white mb-2 py-1 px-2 d-inline-block shadow-sm">🌟 Hôm nay Ngày Chay: x2 Tích Điểm!</div>`;
    }

    let tierBadge = `<span class="badge bg-success fw-bold px-2 py-1"><i class="fa-solid fa-seedling me-1"></i>Mầm Sen (Tích 3%)</span>`;
    if (m.Current_tier === 'BUP_SEN') tierBadge = `<span class="badge bg-primary fw-bold px-2 py-1"><i class="fa-solid fa-spa me-1"></i>Búp Sen (Giảm 5% + Tích 3%)</span>`;
    else if (m.Current_tier === 'SEN_HONG') tierBadge = `<span class="badge bg-danger fw-bold px-2 py-1"><i class="fa-solid fa-heart me-1"></i>Sen Hồng (Giảm 10% + Tích 5%)</span>`;
    else if (m.Current_tier === 'SEN_KIM_CUONG') tierBadge = `<span class="badge fw-bold px-2 py-1 text-white shadow-sm" style="background: linear-gradient(135deg, #6a1b9a, #ffd700);"><i class="fa-solid fa-gem me-1"></i>Sen Kim Cương (Giảm 15% + Tích 5%)</span>`;

    area.innerHTML = `
        ${bdayBadge}
        <div class="p-2 p-sm-3 rounded-3 bg-white border mb-2 shadow-sm">
            <!-- Dòng 1: Tên khách hàng & Các nút thao tác -->
            <div class="d-flex justify-content-between align-items-center mb-1 pb-1 border-bottom gap-2">
                <div class="fw-bold text-dark fs-6 text-truncate d-flex align-items-center gap-1">
                    <i class="fa-solid fa-user-check text-success"></i>
                    <span class="text-truncate">${m.Full_name}</span>
                </div>
                <div class="d-flex align-items-center gap-1 flex-shrink-0">
                    <button type="button" class="btn btn-sm btn-outline-secondary py-1 px-2 border rounded-pill shadow-xs" onclick="window.cartChangeAppliedMember()" title="Đổi sang hội viên khác" style="font-size: 11px; white-space: nowrap;">
                        <i class="fa-solid fa-repeat me-1"></i> Đổi thẻ
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger py-1 px-2 border rounded-pill shadow-xs" onclick="window.cartRemoveAppliedMember()" title="Xóa thẻ hội viên khỏi giỏ hàng" style="font-size: 11px; white-space: nowrap;">
                        <i class="fa-solid fa-xmark me-1"></i> Xóa
                    </button>
                </div>
            </div>

            <!-- Dòng 2: Hạng thẻ & Ngày chay -->
            <div class="d-flex flex-wrap align-items-center gap-1 my-1">
                ${tierBadge}
                ${lunarBadge}
            </div>

            <!-- Dòng 3: Thông tin SĐT, Điểm, Ví dạng lưới / badge linh hoạt -->
            <div class="d-flex flex-wrap align-items-center gap-1 gap-sm-2 text-muted small mt-1">
                <span class="badge bg-light text-dark border font-monospace py-1 px-2">
                    <i class="fa-solid fa-phone me-1 text-secondary"></i>${m.Phone || '---'}
                </span>
                <span class="badge bg-warning-subtle text-dark border border-warning-subtle py-1 px-2">
                    <i class="fa-solid fa-coins text-warning me-1"></i>Điểm: <b>${Number(m.Reward_points || 0).toLocaleString()}</b>
                </span>
                <span class="badge bg-success-subtle text-success-emphasis border border-success-subtle py-1 px-2">
                    <i class="fa-solid fa-wallet text-success me-1"></i>Ví: <b>${Number(m.Prepaid_balance || 0).toLocaleString()} đ</b>
                </span>
            </div>
        </div>

        <!-- DÙNG ĐIỂM THƯỞNG -->
        ${m.Reward_points > 0 ? `
            <div class="p-2 bg-white rounded-3 border d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1 shadow-sm">
                <div class="small">
                    <span class="fw-bold text-dark"><i class="fa-solid fa-coins text-warning me-1"></i>Dùng điểm thưởng</span>
                    <small class="text-muted d-block" style="font-size: 11px;">(1 điểm = 1.000đ trừ trực tiếp)</small>
                </div>
                <div class="d-flex align-items-center gap-1 ms-auto">
                    <input type="number" id="cartUsePointsInput" class="form-control form-control-sm text-end fw-bold" style="width: 85px;" min="0" max="${m.Reward_points}" value="${window.cartPointsToUse || 0}" oninput="window.cartHandlePointsInputChange(this.value)">
                    <button type="button" class="btn btn-sm btn-outline-warning py-1 px-2 text-dark fw-bold rounded-2" style="font-size: 11px; white-space: nowrap;" onclick="window.cartUseMaxPoints()">Tối đa</button>
                </div>
            </div>
        ` : ''}
    `;
};

// Đổi sang thẻ thành viên khác
window.cartChangeAppliedMember = function() {
    window.cartRemoveAppliedMember();
    const input = document.getElementById('cartMemberPhoneInput');
    if (input) {
        input.value = '';
        input.focus();
    }
    if (window.toast) window.toast.info('Vui lòng nhập số điện thoại hoặc quét QR thẻ khác!');
};

// Bỏ áp dụng thẻ
window.cartRemoveAppliedMember = function() {
    window.cartAppliedMember = null;
    try { sessionStorage.removeItem('hoasen_applied_member'); } catch(e) {}
    window.cartPointsToUse = 0;
    window.lastCalcPrepaidUsed = 0;
    window.lastCalcDiscountAmount = 0;
    window.lastCalcPointsUsed = 0;
    const input = document.getElementById('cartMemberPhoneInput');
    if (input) input.value = '';

    const nameInput = document.getElementById('cartCustomerName');
    if (nameInput && nameInput.value) {
        nameInput.value = 'Khách vãng lai';
    }

    const discRow = document.getElementById('cartMemberDiscountRow');
    if (discRow) discRow.style.setProperty('display', 'none', 'important');
    const ptsRow = document.getElementById('cartPointsUsedRow');
    if (ptsRow) ptsRow.style.setProperty('display', 'none', 'important');
    const prepRow = document.getElementById('cartPrepaidUsedRow');
    if (prepRow) prepRow.style.setProperty('display', 'none', 'important');
    const earnNotice = document.getElementById('cartPointsEarnNotice');
    if (earnNotice) earnNotice.innerHTML = '';

    window.renderCartMemberAppliedCard();
    window.renderCart();
};

// Nhập điểm
window.cartHandlePointsInputChange = function(val) {
    const pts = parseInt(val, 10);
    window.cartPointsToUse = isNaN(pts) ? 0 : Math.max(0, pts);
    window.renderCart();
};

// Dùng tối đa điểm
window.cartUseMaxPoints = function() {
    if (!window.cartAppliedMember) return;
    const available = window.cartAppliedMember.Reward_points || 0;
    window.cartPointsToUse = available;
    const input = document.getElementById('cartUsePointsInput');
    if (input) input.value = available;
    window.renderCart();
};

// Mở modal đăng ký nhanh từ giỏ hàng
window.cartOpenQuickRegisterModal = function(prefillPhone) {
    const phoneInput = document.getElementById('cartQuickPhone');
    const nameInput = document.getElementById('cartQuickName');
    const currentPhone = prefillPhone || document.getElementById('cartMemberPhoneInput')?.value?.trim() || '';
    const currentName = document.getElementById('cartCustomerName')?.value?.trim();

    if (phoneInput) phoneInput.value = currentPhone;
    if (nameInput) nameInput.value = (currentName && currentName !== 'Khách vãng lai') ? currentName : '';

    if (typeof window.openMemberModalElement === 'function') {
        window.openMemberModalElement('cartQuickRegisterModal');
    } else {
        const modalEl = document.getElementById('cartQuickRegisterModal');
        if (modalEl) {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
            modalEl.setAttribute('aria-modal', 'true');
            document.body.classList.add('modal-open');
        }
    }
};

// Submit đăng ký nhanh
window.cartSubmitQuickRegister = async function(event) {
    event.preventDefault();
    const phone = document.getElementById('cartQuickPhone')?.value?.trim();
    const name = document.getElementById('cartQuickName')?.value?.trim();
    const birthdate = document.getElementById('cartQuickBirthdate')?.value;

    if (!phone || !name) {
        if (window.toast) window.toast.warning('Vui lòng nhập SĐT và Tên!');
        return;
    }

    try {
        const res = await fetch('/api/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Phone: phone, Full_name: name, Birthdate: birthdate })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Đăng ký thất bại');

        if (typeof window.closeMemberModalElement === 'function') {
            window.closeMemberModalElement('cartQuickRegisterModal');
        } else {
            const modalEl = document.getElementById('cartQuickRegisterModal');
            if (modalEl) {
                modalEl.classList.remove('show');
                modalEl.style.display = 'none';
                modalEl.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('modal-open');
                document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
            }
        }

        if (window.toast) window.toast.success(data.message || 'Đăng ký thành công!');

        await window.cartLookupMember(phone);
    } catch (e) {
        if (window.toast) window.toast.error(e.message);
    }
};

// ==========================================
// VOUCHER KHUYẾN MÃI & CHIẾN DỊCH MARKETING
// ==========================================
window.cartApplyVoucher = async function() {
    const input = document.getElementById('cartVoucherCodeInput');
    const msgEl = document.getElementById('cartVoucherMsg');
    const rmBtn = document.getElementById('cartRemoveVoucherBtn');
    const code = input ? input.value.trim().toUpperCase() : '';

    if (!code) {
        if (window.toast) window.toast.warning('Vui lòng nhập mã giảm giá/voucher!');
        return;
    }

    let cart = JSON.parse(localStorage.getItem('hoasen_cart') || '[]');
    if (cart.length === 0) cart = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');
    const totalCalc = cart.reduce((sum, item) => sum + (Number(item.price || item.Unit_price || 35000) * Number(item.quantity || item.Quantity || 1)), 0);
    const isAddMore = sessionStorage.getItem('hoasen_is_add_more') === '1';
    const oldAmount = isAddMore ? Number(sessionStorage.getItem('hoasen_table_current_amount') || 0) : 0;
    const currentSubtotal = oldAmount + totalCalc;

    try {
        if (msgEl) msgEl.innerHTML = '<span class="text-secondary"><i class="fa-solid fa-spinner fa-spin me-1"></i>Đang kiểm tra mã...</span>';

        const res = await fetch('/api/marketing/verify-voucher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code,
                memberId: window.cartAppliedMember ? window.cartAppliedMember.Member_id : null,
                billAmount: currentSubtotal
            })
        });

        const data = await res.json();
        if (!data.valid) {
            window.cartAppliedVoucher = null;
            if (msgEl) msgEl.innerHTML = `<span class="text-danger"><i class="fa-solid fa-circle-xmark me-1"></i>${data.reason || 'Mã không hợp lệ!'}</span>`;
            if (rmBtn) rmBtn.style.display = 'none';
            if (window.toast) window.toast.error(data.reason || 'Mã voucher không hợp lệ!');
            window.updateCartTotal();
            return;
        }

        window.cartAppliedVoucher = data.voucher;
        if (rmBtn) rmBtn.style.display = 'inline-block';
        if (msgEl) {
            msgEl.innerHTML = `<span class="text-success fw-bold"><i class="fa-solid fa-circle-check me-1"></i>${data.voucher.name}: ${data.voucher.discountType === 'PERCENT' ? `Giảm ${data.voucher.discountValue}%` : `Giảm ${Number(data.voucher.discountValue).toLocaleString('vi-VN')} đ`}</span>`;
        }
        if (window.toast) window.toast.success(`Đã áp dụng voucher: ${data.voucher.code}!`);
        window.updateCartTotal();
    } catch (err) {
        console.error('Lỗi verify voucher:', err);
        if (msgEl) msgEl.innerHTML = '<span class="text-danger">Không thể kết nối máy chủ!</span>';
    }
};

window.cartRemoveVoucher = function() {
    window.cartAppliedVoucher = null;
    const input = document.getElementById('cartVoucherCodeInput');
    const msgEl = document.getElementById('cartVoucherMsg');
    const rmBtn = document.getElementById('cartRemoveVoucherBtn');
    if (input) input.value = '';
    if (msgEl) msgEl.innerHTML = '';
    if (rmBtn) rmBtn.style.display = 'none';
    window.updateCartTotal();
    if (window.toast) window.toast.info('Đã hủy áp dụng voucher');
};

// ========================================================
// XÁC THỰC MÃ BẢO MẬT OTP 6 SỐ KHI QUÉT MÃ QR CỦA KHÁCH HÀNG
// ========================================================
window.pendingVerifiedMemberData = null;

window.cartOpenOtpVerifyModal = function(member) {
    window.pendingVerifiedMemberData = member;
    const nameEl = document.getElementById('cartOtpVerifyMemberName');
    const phoneEl = document.getElementById('cartOtpVerifyMemberPhone');
    const codeInput = document.getElementById('cartOtpVerifyCodeInput');
    const errEl = document.getElementById('cartOtpVerifyError');

    if (nameEl) nameEl.innerText = member.Full_name || 'Khách Hàng';
    if (phoneEl) phoneEl.innerText = `${member.Phone || ''} (${member.tierInfo?.name || 'Mầm Sen'})`;
    if (codeInput) {
        codeInput.value = '';
        setTimeout(() => codeInput.focus(), 300);
    }
    if (errEl) errEl.style.display = 'none';

    if (typeof window.openMemberModalElement === 'function') {
        window.openMemberModalElement('cartMemberOtpVerifyModal');
    } else {
        const modalEl = document.getElementById('cartMemberOtpVerifyModal');
        if (modalEl) {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
            modalEl.setAttribute('aria-modal', 'true');
            document.body.classList.add('modal-open');
        }
    }
};

window.cartSubmitOtpVerify = async function(event) {
    if (event) event.preventDefault();
    if (!window.pendingVerifiedMemberData) return;

    const codeInput = document.getElementById('cartOtpVerifyCodeInput');
    const code = codeInput ? codeInput.value.trim() : '';
    const errEl = document.getElementById('cartOtpVerifyError');
    const btn = document.getElementById('btnSubmitCartOtpVerify');

    if (code.length !== 6) {
        if (errEl) {
            errEl.style.display = 'block';
            errEl.innerText = 'Vui lòng nhập đúng 6 số ngẫu nhiên!';
        }
        return;
    }

    try {
        if (btn) btn.disabled = true;
        if (errEl) errEl.style.display = 'none';

        const res = await fetch('/api/marketing/verify-security-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                memberId: window.pendingVerifiedMemberData.Member_id,
                code: code
            })
        });

        const data = await res.json();
        if (!data.success) {
            if (errEl) {
                errEl.style.display = 'block';
                errEl.innerText = data.error || 'Mã bảo mật không đúng hoặc đã hết hạn (30 giây)!';
            }
            if (codeInput) {
                codeInput.select();
                codeInput.focus();
            }
            return;
        }

        // Xác thực thành công: Đóng modal và áp dụng thẻ
        if (typeof window.closeMemberModalElement === 'function') {
            window.closeMemberModalElement('cartMemberOtpVerifyModal');
        } else {
            const modalEl = document.getElementById('cartMemberOtpVerifyModal');
            if (modalEl) {
                modalEl.classList.remove('show');
                modalEl.style.display = 'none';
                modalEl.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('modal-open');
                document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
            }
        }

        const verifiedMember = window.pendingVerifiedMemberData;
        window.pendingVerifiedMemberData = null;
        window.cartApplyVerifiedMember(verifiedMember);
    } catch (e) {
        console.error('Lỗi xác thực mã:', e);
        if (errEl) {
            errEl.style.display = 'block';
            errEl.innerText = 'Lỗi kết nối máy chủ xác thực: ' + e.message;
        }
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.cartApplyVerifiedMember = function(member) {
    window.cartAppliedMember = member;
    try { sessionStorage.setItem('hoasen_applied_member', JSON.stringify(member)); } catch (e) {}

    const nameInput = document.getElementById('cartCustomerName');
    if (nameInput && (!nameInput.value || nameInput.value === 'Khách vãng lai')) {
        nameInput.value = member.Full_name;
    }

    window.renderCartMemberAppliedCard();
    window.renderCart();
    if (window.toast) window.toast.success(`🛡️ Đã xác thực bảo mật & áp dụng thẻ: ${member.Full_name}!`);
};

// ==========================================
// QUÉT MÃ QR THẺ THÀNH VIÊN QUA CAMERA
// ==========================================
window.html5QrScannerInstance = null;

// Mở modal Hướng dẫn cấp quyền Camera Chrome & Safari
window.openCameraPermissionGuideModal = function(preferTab) {
    if (!preferTab) {
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
        preferTab = isSafari ? 'safari' : 'chrome';
    }

    const chromeTabBtn = document.getElementById('tab-chrome-btn');
    const safariTabBtn = document.getElementById('tab-safari-btn');
    const chromePane = document.getElementById('tab-guide-chrome');
    const safariPane = document.getElementById('tab-guide-safari');

    if (preferTab === 'safari') {
        if (chromeTabBtn) chromeTabBtn.classList.remove('active');
        if (safariTabBtn) safariTabBtn.classList.add('active');
        if (chromePane) { chromePane.classList.remove('show', 'active'); }
        if (safariPane) { safariPane.classList.add('show', 'active'); }
    } else {
        if (safariTabBtn) safariTabBtn.classList.remove('active');
        if (chromeTabBtn) chromeTabBtn.classList.add('active');
        if (safariPane) { safariPane.classList.remove('show', 'active'); }
        if (chromePane) { chromePane.classList.add('show', 'active'); }
    }

    if (typeof window.openMemberModalElement === 'function') {
        window.openMemberModalElement('cameraPermissionGuideModal');
    } else {
        const modalEl = document.getElementById('cameraPermissionGuideModal');
        if (modalEl) {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
            modalEl.setAttribute('aria-modal', 'true');
            document.body.classList.add('modal-open');
        }
    }
};
// Phát âm thanh bíp xác nhận quét thành công (Sử dụng Web Audio API không cần tải file âm thanh ngoài)
window.playQrBeepSound = function() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // Âm C6 thanh vang, hiện đại
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
    } catch (e) {
        console.warn('Web Audio beep error:', e);
    }
};

// ========================================================
// BỘ GIẢI MÃ QR ĐA CHIẾN LƯỢC (giống cách Zalo quét):
// - Thu nhỏ ảnh + cắt vùng giữa (loại nhiễu moiré khi quét QR trên màn hình điện thoại)
// - Tăng tương phản, thử cả màu thường và đảo màu
// - Ưu tiên BarcodeDetector phần cứng nếu trình duyệt có
// ========================================================
window.hoasenQrDecoder = (function() {
    const work = document.createElement('canvas');
    const wctx = work.getContext('2d', { willReadFrequently: true });
    let nativeDetector = null;
    let nativeChecked = false;

    async function getNative() {
        if (nativeChecked) return nativeDetector;
        nativeChecked = true;
        if ('BarcodeDetector' in window) {
            try {
                let formats = null;
                if (typeof BarcodeDetector.getSupportedFormats === 'function') {
                    formats = await BarcodeDetector.getSupportedFormats();
                }
                if (!formats || formats.includes('qr_code')) {
                    nativeDetector = new BarcodeDetector({ formats: ['qr_code'] });
                }
            } catch (e) { nativeDetector = null; }
        }
        return nativeDetector;
    }

    function draw(src, sw, sh, crop, maxDim) {
        const cw = sw * crop, ch = sh * crop;
        const sx = (sw - cw) / 2, sy = (sh - ch) / 2;
        const scale = Math.min(1, maxDim / Math.max(cw, ch));
        const w = Math.max(1, Math.round(cw * scale));
        const h = Math.max(1, Math.round(ch * scale));
        work.width = w;
        work.height = h;
        wctx.imageSmoothingEnabled = true;
        try { wctx.imageSmoothingQuality = 'high'; } catch (e) {}
        wctx.drawImage(src, sx, sy, cw, ch, 0, 0, w, h);
        const imgData = wctx.getImageData(0, 0, w, h);
        imgData._map = { sx, sy, scale: w / cw };
        return imgData;
    }

    function enhance(imgData) {
        const d = imgData.data;
        let min = 255, max = 0;
        for (let i = 0; i < d.length; i += 4) {
            const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
            d[i] = g;
            if (g < min) min = g;
            if (g > max) max = g;
        }
        const range = Math.max(1, max - min);
        for (let i = 0; i < d.length; i += 4) {
            const v = (((d[i] - min) * 255) / range) | 0;
            d[i] = d[i + 1] = d[i + 2] = v;
        }
        return imgData;
    }

    // Trả về { text, points: [{x,y} x4] } theo toạ độ ảnh gốc (video)
    function tryJsQR(imgData, inversion) {
        if (typeof jsQR !== 'function') return null;
        try {
            const c = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: inversion });
            if (!c || !c.data) return null;
            const m = imgData._map || { sx: 0, sy: 0, scale: 1 };
            const L = c.location || {};
            const pts = [L.topLeftCorner, L.topRightCorner, L.bottomRightCorner, L.bottomLeftCorner]
                .filter(Boolean)
                .map(p => ({ x: m.sx + p.x / m.scale, y: m.sy + p.y / m.scale }));
            return { text: c.data, points: pts.length === 4 ? pts : null };
        } catch (e) { return null; }
    }

    async function tryNative(src) {
        const det = await getNative();
        if (!det) return null;
        try {
            const r = await det.detect(src);
            if (!r || !r.length || !r[0].rawValue) return null;
            const cp = r[0].cornerPoints;
            return { text: r[0].rawValue, points: cp && cp.length === 4 ? cp.map(p => ({ x: p.x, y: p.y })) : null };
        } catch (e) { return null; }
    }

    // Mỗi khung hình video thử 1 chiến lược nhẹ, xoay vòng để không giật
    const LIVE_STRATEGIES = [
        { crop: 0.65, max: 640, inv: 'dontInvert' },
        { crop: 1.0,  max: 800, inv: 'dontInvert' },
        { crop: 0.45, max: 480, inv: 'attemptBoth' },
        { crop: 0.8,  max: 520, inv: 'dontInvert', enh: true },
        { crop: 0.65, max: 400, inv: 'attemptBoth' }
    ];
    let liveIdx = 0;

    // Trả về { text, points } hoặc null
    async function decodeFrameDetailed(video) {
        const sw = video.videoWidth, sh = video.videoHeight;
        if (!sw || !sh) return null;
        const n = await tryNative(video);
        if (n) return n;
        const s = LIVE_STRATEGIES[liveIdx++ % LIVE_STRATEGIES.length];
        let img = draw(video, sw, sh, s.crop, s.max);
        if (s.enh) img = enhance(img);
        return tryJsQR(img, s.inv);
    }

    async function decodeFrame(video) {
        const r = await decodeFrameDetailed(video);
        return r ? r.text : null;
    }

    // Ảnh chụp/tải lên: thử nhiều kích thước + vùng cắt + tăng tương phản
    async function decodeImage(img) {
        const sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
        const n = await tryNative(img);
        if (n) return n.text;
        const crops = [1, 0.7, 0.5];
        const sizes = [1600, 1000, 700, 450];
        for (const enh of [false, true]) {
            for (const crop of crops) {
                for (const max of sizes) {
                    let d = draw(img, sw, sh, crop, max);
                    if (enh) d = enhance(d);
                    const t = tryJsQR(d, 'attemptBoth');
                    if (t) return t.text;
                    await new Promise(r => setTimeout(r, 0));
                }
            }
        }
        return null;
    }

    return {
        decodeFrame,
        decodeFrameDetailed,
        decodeImage,
        hasEngine: () => typeof jsQR === 'function' || ('BarcodeDetector' in window)
    };
})();

// ========================================================
// KHUNG VÀNG BÁM THEO MÃ QR (giống Zalo)
// ========================================================
window.hoasenQrOverlay = (function() {
    let animId = null;

    function getCanvas() {
        const c = document.getElementById('memberQrTrackCanvas');
        const video = document.getElementById('memberQrScannerVideo');
        if (!c || !video) return null;
        const w = video.clientWidth, h = video.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
            c.width = Math.round(w * dpr);
            c.height = Math.round(h * dpr);
            c.style.width = w + 'px';
            c.style.height = h + 'px';
        }
        const ctx = c.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { c, ctx, w, h, video };
    }

    // Chuyển toạ độ video -> toạ độ hiển thị (video dùng object-fit: cover)
    function mapPoints(points, video, w, h) {
        const vw = video.videoWidth, vh = video.videoHeight;
        if (!vw || !vh) return null;
        const s = Math.max(w / vw, h / vh);
        const ox = (w - vw * s) / 2, oy = (h - vh * s) / 2;
        return points.map(p => ({ x: p.x * s + ox, y: p.y * s + oy }));
    }

    function drawBrackets(ctx, pts, color, fill) {
        // pts: TL, TR, BR, BL
        const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        if (fill) {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 6;
        const k = 0.28;
        for (let i = 0; i < 4; i++) {
            const p = pts[i], prev = pts[(i + 3) % 4], next = pts[(i + 1) % 4];
            const a = lerp(p, prev, k), b = lerp(p, next, k);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(p.x, p.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
    }

    function clear() {
        if (animId) cancelAnimationFrame(animId);
        animId = null;
        const g = getCanvas();
        if (g) g.ctx.clearRect(0, 0, g.w, g.h);
    }

    // Hiệu ứng khung vàng thu nhỏ từ khung ngắm vào đúng mã QR, rồi gọi done()
    function lockOn(points, done) {
        const g = getCanvas();
        if (!g || !points) { done && done(); return; }
        const target = mapPoints(points, g.video, g.w, g.h);
        if (!target) { done && done(); return; }

        // Khung xuất phát: khung ngắm giữa màn hình
        const size = Math.min(g.w, g.h) * 0.7;
        const cx = g.w / 2, cy = g.h / 2, hs = size / 2;
        const start = [
            { x: cx - hs, y: cy - hs }, { x: cx + hs, y: cy - hs },
            { x: cx + hs, y: cy + hs }, { x: cx - hs, y: cy + hs }
        ];

        const guide = document.getElementById('memberQrGuideFrame');
        if (guide) guide.style.opacity = '0';

        const duration = 260, hold = 320;
        const t0 = performance.now();
        const ease = t => 1 - Math.pow(1 - t, 3);
        const step = (now) => {
            const t = Math.min(1, (now - t0) / duration);
            const e = ease(t);
            const pts = start.map((s, i) => ({ x: s.x + (target[i].x - s.x) * e, y: s.y + (target[i].y - s.y) * e }));
            g.ctx.clearRect(0, 0, g.w, g.h);
            drawBrackets(g.ctx, pts, '#ffd400', t >= 1 ? 'rgba(255, 212, 0, 0.18)' : null);
            if (t < 1) {
                animId = requestAnimationFrame(step);
            } else {
                animId = null;
                setTimeout(() => { done && done(); }, hold);
            }
        };
        animId = requestAnimationFrame(step);
    }

    function reset() {
        clear();
        const guide = document.getElementById('memberQrGuideFrame');
        if (guide) guide.style.opacity = '1';
    }

    return { lockOn, clear, reset };
})();

window.activeQrCameraStream = null;
window.isLiveQrScanning = false;
window.activeQrScanTargetInput = null;

window.cartOpenQrScannerModal = async function(targetInputId) {
    window.activeQrScanTargetInput = targetInputId || null;
    window.isMemberQrScanLocked = false;
    window.isLiveQrScanning = false;
    if (window.hoasenQrOverlay) window.hoasenQrOverlay.reset();
    const beamReset = document.getElementById('memberQrLaserBeam');
    if (beamReset) beamReset.style.display = '';

    if (typeof window.openMemberModalElement === 'function') {
        window.openMemberModalElement('memberQrScannerModal');
    } else {
        const modalEl = document.getElementById('memberQrScannerModal');
        if (modalEl) {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
            modalEl.setAttribute('aria-modal', 'true');
            document.body.classList.add('modal-open');
        }
    }

    const videoElem = document.getElementById('memberQrScannerVideo');
    const loadingEl = document.getElementById('memberQrCameraLoading');
    const laserEl = document.getElementById('memberQrLaserOverlay');
    const errorEl = document.getElementById('memberQrErrorOverlay');
    const statusEl = document.getElementById('memberQrScanStatus');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (laserEl) laserEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    if (statusEl) {
        statusEl.innerHTML = '<span class="text-secondary"><i class="fa-solid fa-spinner fa-spin me-1"></i>Đang mở Camera...</span>';
    }

    // Dừng camera cũ nếu đang chạy
    if (window.activeQrCameraStream) {
        try {
            window.activeQrCameraStream.getTracks().forEach(t => t.stop());
        } catch (e) {}
        window.activeQrCameraStream = null;
    }

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isHttpInsecure = window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

    // Đặc thù Safari iOS nếu chạy HTTP mạng LAN
    if (isSafari && isHttpInsecure && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (laserEl) laserEl.style.display = 'none';
        if (errorEl) {
            errorEl.style.display = 'flex';
            errorEl.innerHTML = `
                <div class="text-center text-white" style="max-width: 330px; margin: auto;">
                    <div class="mb-2 text-warning"><i class="fa-brands fa-safari fa-3x"></i></div>
                    <div class="fw-bold mb-1 fs-6">Chính Sách Bảo Mật Safari (iOS)</div>
                    <p class="small text-light mb-3" style="font-size: 12px; line-height: 1.4;">
                        Apple Safari giới hạn video live stream khi dùng địa chỉ IP mạng nội bộ (HTTP).<br>
                        <b>👉 Hãy bấm nút bên dưới:</b> iPhone sẽ tự mở Camera máy chụp 1 bức ảnh và quét ngay lập tức <b>100% thành công</b>!
                    </p>
                    <div class="d-grid gap-2">
                        <button type="button" class="btn btn-success btn-sm fw-bold rounded-pill shadow" onclick="document.getElementById('memberQrCameraCaptureInput').click()">
                            <i class="fa-solid fa-camera me-1"></i> Chụp ảnh quét ngay (Camera máy)
                        </button>
                        <button type="button" class="btn btn-outline-light btn-sm rounded-pill" onclick="window.openCameraPermissionGuideModal('safari')">
                            <i class="fa-solid fa-circle-question me-1"></i> Xem hướng dẫn chi tiết Safari
                        </button>
                    </div>
                </div>
            `;
        }
        if (statusEl) {
            statusEl.innerHTML = '<span class="text-warning fw-semibold"><i class="fa-solid fa-triangle-exclamation me-1"></i>Safari iOS yêu cầu chụp ảnh quét trực tiếp</span>';
        }
        return;
    }

    if (!videoElem) {
        console.error('Không tìm thấy phần tử video memberQrScannerVideo');
        return;
    }

    try {
        // Yêu cầu camera (ưu tiên rear camera environment)
        let stream = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "environment" },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
        } catch (camErr1) {
            console.warn('Thử facingMode environment thất bại, chuyển sang camera mặc định:', camErr1);
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        window.activeQrCameraStream = stream;
        videoElem.srcObject = stream;
        await videoElem.play();

        if (loadingEl) loadingEl.style.display = 'none';
        if (laserEl) laserEl.style.display = 'flex';
        if (statusEl) {
            statusEl.innerHTML = '<span class="text-success fw-semibold"><i class="fa-solid fa-qrcode me-1"></i>Đưa mã QR vào khung hình để tự động quét</span>';
        }

        // Bắt đầu vòng lặp quét khung hình liên tục (bộ giải mã đa chiến lược)
        window.isLiveQrScanning = true;
        if (!window.hoasenQrDecoder.hasEngine() && statusEl) {
            statusEl.innerHTML = '<span class="text-danger fw-semibold">Không tải được thư viện quét QR (js/jsQR.js). Hãy tải lại trang (Ctrl+F5).</span>';
        }

        const scanLoop = async () => {
            if (!window.isLiveQrScanning || window.isMemberQrScanLocked) return;

            if (videoElem.readyState >= videoElem.HAVE_CURRENT_DATA && videoElem.videoWidth > 0) {
                let result = null;
                try {
                    result = await window.hoasenQrDecoder.decodeFrameDetailed(videoElem);
                } catch (e) {
                    console.warn('Lỗi giải mã khung hình:', e);
                }

                if (result && result.text && !window.isMemberQrScanLocked) {
                    window.isMemberQrScanLocked = true;
                    window.isLiveQrScanning = false;
                    const detectedText = result.text;
                    console.log('Quét thành công QR:', detectedText);

                    // Dừng hình tại khung đang thấy QR (giống Zalo)
                    try { videoElem.pause(); } catch (e) {}
                    const laserBeam = document.getElementById('memberQrLaserBeam');
                    if (laserBeam) laserBeam.style.display = 'none';

                    // Phản hồi âm thanh bíp và rung
                    window.playQrBeepSound();
                    if (navigator.vibrate) {
                        try { navigator.vibrate(120); } catch (e) {}
                    }

                    if (statusEl) {
                        statusEl.innerHTML = '<span class="text-success fw-bold"><i class="fa-solid fa-circle-check me-1"></i>Đã nhận diện mã QR!</span>';
                    }

                    // Khung vàng chạy vào đúng vị trí mã QR rồi mới xử lý
                    window.hoasenQrOverlay.lockOn(result.points, () => {
                        window.handleMemberQrScanSuccess(detectedText);
                    });
                    return;
                }
            }

            if (window.isLiveQrScanning) {
                setTimeout(() => requestAnimationFrame(scanLoop), 80);
            }
        };

        requestAnimationFrame(scanLoop);

    } catch (err) {
        console.error('Lỗi khởi động Camera QR:', err);
        const errStr = String(err && (err.message || err.name || err));
        const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || errStr.includes('NotAllowedError') || errStr.includes('Permission denied') || errStr.includes('denied');
        const browserName = isSafari ? 'Safari' : (isChrome ? 'Chrome' : 'Trình duyệt');

        if (loadingEl) loadingEl.style.display = 'none';
        if (laserEl) laserEl.style.display = 'none';
        if (errorEl) {
            errorEl.style.display = 'flex';
            errorEl.innerHTML = `
                <div class="text-center text-white" style="max-width: 320px; margin: auto;">
                    <div class="mb-2 ${isDenied ? 'text-warning' : 'text-danger'}">
                        <i class="fa-solid ${isDenied ? 'fa-camera-slash' : 'fa-circle-exclamation'} fa-3x"></i>
                    </div>
                    <div class="fw-bold mb-1 fs-6">${isDenied ? 'Chưa Cho Phép Mở Camera' : 'Không Thể Mở Camera'}</div>
                    <p class="small text-light mb-3" style="font-size: 12px; line-height: 1.4;">
                        ${isDenied 
                            ? `Bạn đã chọn <b>"Không cho phép / Từ chối"</b> hoặc trình duyệt <b>${browserName}</b> đang chặn quyền truy cập Camera.` 
                            : `Lỗi: ${err.message || 'Không tìm thấy camera khả dụng trên thiết bị này.'}`}
                    </p>
                    <div class="d-grid gap-2">
                        <button type="button" class="btn btn-success btn-sm fw-bold rounded-pill shadow" onclick="document.getElementById('memberQrCameraCaptureInput').click()">
                            <i class="fa-solid fa-camera me-1"></i> Chụp ảnh quét ngay (Dùng Camera máy)
                        </button>
                        <button type="button" class="btn btn-outline-light btn-sm rounded-pill" onclick="window.openCameraPermissionGuideModal('${isSafari ? 'safari' : 'chrome'}')">
                            <i class="fa-solid fa-circle-question me-1"></i> Hướng dẫn bật quyền trên ${browserName}
                        </button>
                        <button type="button" class="btn btn-link text-white-50 btn-sm text-decoration-none" onclick="window.cartOpenQrScannerModal()">
                            <i class="fa-solid fa-arrow-rotate-right me-1"></i> Thử kết nối lại Camera
                        </button>
                    </div>
                </div>
            `;
        }

        if (statusEl) {
            statusEl.innerHTML = `
                <span class="text-danger fw-semibold">
                    <i class="fa-solid fa-triangle-exclamation me-1"></i>${isDenied ? 'Quyền camera bị từ chối.' : 'Không thể bật video trực tiếp.'} Hãy bấm nút <b>"Chụp ảnh quét ngay"</b>.
                </span>
            `;
        }
    }
};

window.cartCloseQrScannerModal = function() {
    window.isMemberQrScanLocked = true;
    window.isLiveQrScanning = false;

    if (window.activeQrCameraStream) {
        try {
            window.activeQrCameraStream.getTracks().forEach(t => t.stop());
        } catch (e) {}
        window.activeQrCameraStream = null;
    }

    const videoElem = document.getElementById('memberQrScannerVideo');
    if (videoElem) {
        try {
            videoElem.pause();
            videoElem.srcObject = null;
        } catch (e) {}
    }

    const laserEl = document.getElementById('memberQrLaserOverlay');
    if (laserEl) laserEl.style.display = 'none';

    if (typeof window.closeMemberModalElement === 'function') {
        window.closeMemberModalElement('memberQrScannerModal');
    } else {
        const modalEl = document.getElementById('memberQrScannerModal');
        if (modalEl) {
            modalEl.classList.remove('show');
            modalEl.style.display = 'none';
            modalEl.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
            document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
        }
    }
};

// ========================================================
// XỬ LÝ KHI QUÉT TRÚNG MÃ QR:
// LẤY TEXT QR -> NẠP VÀO Ô ĐỊNH DANH -> TỰ ĐỘNG TRA CỨU ĐỐI CHIẾU
// ========================================================
window.handleMemberQrScanSuccess = async function(decodedText) {
    if (!decodedText) return;
    const rawData = String(decodedText).trim();
    console.log('Nội dung text quét được từ QR:', rawData);
    window.cartCloseQrScannerModal();

    let displayQuery = rawData;
    let lookupQuery = rawData;

    // Phân tích mã QR Hoa Sen nếu có cấu trúc HOASEN-MEM:Phone:CardCode
    if (rawData.startsWith('HOASEN-MEM:')) {
        const parts = rawData.split(':');
        const phone = parts[1] || '';
        const cardCode = parts[2] || '';
        displayQuery = cardCode || phone || rawData;
        lookupQuery = rawData;
    } else if (rawData.startsWith('{')) {
        try {
            const parsed = JSON.parse(rawData);
            displayQuery = parsed.cardCode || parsed.Card_code || parsed.phone || parsed.Phone || rawData;
            lookupQuery = rawData;
        } catch (e) {}
    }

    // 1. NẠP CHUỖI VÀO Ô ĐỊNH DANH TRÊN MÀN HÌNH (SĐT / MÃ THẺ)
    if (window.activeQrScanTargetInput) {
        const targetInput = document.getElementById(window.activeQrScanTargetInput);
        if (targetInput) {
            targetInput.value = displayQuery;
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            targetInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    const cartInput = document.getElementById('cartMemberPhoneInput');
    if (cartInput) cartInput.value = displayQuery;

    const lookupInput = document.getElementById('lookupPhoneInput');
    if (lookupInput) lookupInput.value = displayQuery;

    const tablePayInput = document.getElementById('tablePayMemberPhone');
    if (tablePayInput) tablePayInput.value = displayQuery;

    // 2. SO SÁNH VỚI CƠ SỞ DỮ LIỆU ĐỂ TỰ ĐỘNG ÁP DỤNG NGAY LẬP TỨC
    const isCartTarget = window.activeQrScanTargetInput === 'cartMemberPhoneInput' 
                      || Boolean(document.getElementById('cartMemberAppliedArea'))
                      || Boolean(document.getElementById('cartMemberPhoneInput'));

    const tablePayModal = document.getElementById('tablePaymentModal');
    const isTablePayVisible = window.activeQrScanTargetInput === 'tablePayMemberPhone' 
                           || (tablePayModal && (tablePayModal.classList.contains('show') || tablePayModal.style.display === 'block'));

    const customerLookupModal = document.getElementById('customerLookupModal');
    const isCustomerLookupVisible = window.activeQrScanTargetInput === 'lookupPhoneInput' 
                                 || (customerLookupModal && (customerLookupModal.classList.contains('show') || customerLookupModal.style.display === 'block'));

    try {
        if (isCartTarget && typeof window.cartLookupMember === 'function') {
            await window.cartLookupMember(lookupQuery || displayQuery, true);
        } else if (isTablePayVisible && typeof window.tablePayLookupMember === 'function') {
            await window.tablePayLookupMember(lookupQuery || displayQuery);
        } else if (isCustomerLookupVisible && typeof window.doCustomerLookup === 'function') {
            await window.doCustomerLookup(lookupQuery || displayQuery);
        } else if (typeof window.cartLookupMember === 'function') {
            await window.cartLookupMember(lookupQuery || displayQuery, true);
        } else if (typeof window.doCustomerLookup === 'function') {
            await window.doCustomerLookup(lookupQuery || displayQuery);
        }
    } catch (lookupErr) {
        console.warn('Lỗi tra cứu sau quét:', lookupErr);
        if (window.toast) window.toast.info(`Đã nạp mã QR: "${displayQuery}"`);
    }
};

// ========================================================
// QUÉT MÃ QR TỪ ẢNH CHỤP HOẶC TẢI LÊN TỪ MÁY
// Tự động scale ảnh thông minh + quét đa engine (BarcodeDetector + jsQR)
// ========================================================
window.cartScanQrFromFile = function(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('memberQrScanStatus');
    if (statusEl) statusEl.innerHTML = '<span class="text-primary"><i class="fa-solid fa-spinner fa-spin me-1"></i>Đang đọc mã QR...</span>';

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = async function() {
            try {
                // Thử nhiều kích thước, vùng cắt và độ tương phản cho tới khi đọc được
                const qrText = await window.hoasenQrDecoder.decodeImage(img);

                if (qrText) {
                    window.playQrBeepSound();
                    if (navigator.vibrate) {
                        try { navigator.vibrate(120); } catch(err) {}
                    }
                    if (statusEl) {
                        statusEl.innerHTML = '<span class="text-success fw-bold"><i class="fa-solid fa-circle-check me-1"></i>Đã đọc được mã QR!</span>';
                    }
                    window.handleMemberQrScanSuccess(qrText);
                } else {
                    if (statusEl) {
                        statusEl.innerHTML = '<span class="text-danger"><i class="fa-solid fa-triangle-exclamation me-1"></i>Không tìm thấy mã QR trong ảnh. Vui lòng chụp gần và rõ hơn.</span>';
                    }
                    if (window.toast) window.toast.warning('Không tìm thấy mã QR trong ảnh. Quý khách vui lòng chụp gần mã hơn.');
                }
            } catch (err) {
                console.error('Lỗi giải mã ảnh QR:', err);
                if (window.toast) window.toast.error('Lỗi khi đọc file ảnh: ' + (err.message || err));
            }
        };
        img.onerror = function() {
            if (window.toast) window.toast.error('Không thể đọc file ảnh được chọn.');
        };
        img.src = e.target.result;
    };
    reader.onerror = function() {
        if (window.toast) window.toast.error('Không thể đọc dữ liệu file ảnh.');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
};

// Cập nhật tổng tiền hiển thị (Cộng cả tiền cũ và mới nếu đang gọi thêm + Giảm giá hội viên)
window.updateCartTotal = function(total) {
    if (total === undefined || total === null) {
        let cart = JSON.parse(localStorage.getItem('hoasen_cart') || '[]');
        if (cart.length === 0) cart = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');
        total = cart.reduce((sum, item) => {
            const price = Number(item.price || item.Unit_price || 35000);
            const qty = Number(item.quantity || item.Quantity || 1);
            return sum + (price * qty);
        }, 0);
    }
    window.currentCartItemsSubtotal = Number(total || 0);

    const isAddMore = sessionStorage.getItem('hoasen_is_add_more') === '1';
    const oldAmount = isAddMore ? Number(sessionStorage.getItem('hoasen_table_current_amount') || 0) : 0;
    const itemsSubtotal = window.currentCartItemsSubtotal;
    const subtotal = oldAmount + itemsSubtotal;

    let discountPercent = 0;
    let discountAmount = 0;
    let voucherDiscount = 0;
    let pointsUsed = 0;
    let pointsAmount = 0;
    let prepaidUsed = 0;
    let pointsEarned = 0;

    const subtotalEl = document.getElementById('cartSubtotalAmount');
    if (subtotalEl) subtotalEl.innerText = new Intl.NumberFormat('vi-VN').format(subtotal) + ' đ';

    const m = window.cartAppliedMember;
    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'CASH';

    let runningAmount = subtotal;

    if (m) {
        const t = m.tierInfo || {};
        discountPercent = Number(t.discountPercent || 0);
        discountAmount = Math.round(subtotal * (discountPercent / 100));
        runningAmount = Math.max(0, runningAmount - discountAmount);

        // Hiển thị dòng chiết khấu thành viên
        const discRow = document.getElementById('cartMemberDiscountRow');
        const discLbl = document.getElementById('cartMemberDiscountLabel');
        const discAmt = document.getElementById('cartMemberDiscountAmount');
        if (discRow) {
            if (discountAmount > 0) {
                discRow.style.setProperty('display', 'flex', 'important');
                if (discLbl) discLbl.innerText = `Giảm giá ${t.name || 'Hội viên'} (-${discountPercent}%):`;
                if (discAmt) discAmt.innerText = `-${new Intl.NumberFormat('vi-VN').format(discountAmount)} đ`;
            } else {
                discRow.style.setProperty('display', 'none', 'important');
            }
        }
    } else {
        const discRow = document.getElementById('cartMemberDiscountRow');
        if (discRow) discRow.style.setProperty('display', 'none', 'important');
    }

    // Voucher giảm giá
    const v = window.cartAppliedVoucher;
    if (v) {
        if (v.discountType === 'PERCENT' || v.Discount_type === 'PERCENT') {
            const pct = Number(v.discountValue || v.Discount_value || 0);
            voucherDiscount = Math.round(runningAmount * (pct / 100));
        } else {
            voucherDiscount = Number(v.discountValue || v.Discount_value || 0);
        }
        voucherDiscount = Math.min(runningAmount, Math.max(0, voucherDiscount));
        runningAmount = Math.max(0, runningAmount - voucherDiscount);

        const vRow = document.getElementById('cartVoucherDiscountRow');
        const vLbl = document.getElementById('cartVoucherDiscountLabel');
        const vAmt = document.getElementById('cartVoucherDiscountAmount');
        if (vRow) {
            vRow.style.setProperty('display', 'flex', 'important');
            if (vLbl) vLbl.innerText = `Voucher (${v.code || v.Code}):`;
            if (vAmt) vAmt.innerText = `-${new Intl.NumberFormat('vi-VN').format(voucherDiscount)} đ`;
        }
    } else {
        const vRow = document.getElementById('cartVoucherDiscountRow');
        if (vRow) vRow.style.setProperty('display', 'none', 'important');
    }

    if (m) {
        const t = m.tierInfo || {};
        // Điểm thưởng
        const maxPointsCanUse = Math.min(Number(m.Reward_points || 0), Math.floor(runningAmount / 1000));
        pointsUsed = Math.min(Number(window.cartPointsToUse || 0), maxPointsCanUse);
        pointsAmount = pointsUsed * 1000;
        runningAmount = Math.max(0, runningAmount - pointsAmount);

        // Ví trả trước: CHỈ KHI chọn phương thức PREPAID
        if (selectedMethod === 'PREPAID') {
            prepaidUsed = Math.min(Number(m.Prepaid_balance || 0), runningAmount);
            runningAmount = Math.max(0, runningAmount - prepaidUsed);
        } else {
            prepaidUsed = 0;
        }

        // Tích lũy điểm (3% hoặc 5%, nhân đôi nếu ngày rằm/mùng 1)
        const actualPointRate = Number(t.actualPointRate || t.pointRate || 0.03);
        const amountForPointCalc = Math.max(0, subtotal - discountAmount - voucherDiscount);
        pointsEarned = Math.floor((amountForPointCalc * actualPointRate) / 1000);

        // Hiển thị dòng điểm
        const ptsRow = document.getElementById('cartPointsUsedRow');
        const ptsAmt = document.getElementById('cartPointsUsedAmount');
        const ptsLbl = document.getElementById('cartPointsUsedLabel');
        if (ptsRow) {
            if (pointsAmount > 0) {
                ptsRow.style.setProperty('display', 'flex', 'important');
                if (ptsLbl) ptsLbl.innerText = `Trừ điểm thưởng (${pointsUsed} điểm):`;
                if (ptsAmt) ptsAmt.innerText = `-${new Intl.NumberFormat('vi-VN').format(pointsAmount)} đ`;
            } else {
                ptsRow.style.setProperty('display', 'none', 'important');
            }
        }

        // Hiển thị dòng ví trả trước
        const prepRow = document.getElementById('cartPrepaidUsedRow');
        const prepAmt = document.getElementById('cartPrepaidUsedAmount');
        if (prepRow) {
            if (selectedMethod === 'PREPAID' && prepaidUsed > 0) {
                prepRow.style.setProperty('display', 'flex', 'important');
                if (prepAmt) prepAmt.innerText = `-${new Intl.NumberFormat('vi-VN').format(prepaidUsed)} đ`;
            } else {
                prepRow.style.setProperty('display', 'none', 'important');
            }
        }

        // Thông báo tích lũy điểm
        const earnNotice = document.getElementById('cartPointsEarnNotice');
        if (earnNotice) {
            const doubleText = (t.isDoublePoints || m.lunarInfo?.isDoublePoints) ? ' <span class="badge bg-danger">x2 Ngày Chay</span>' : '';
            earnNotice.innerHTML = `✨ Đơn này được tích lũy: <b class="text-success">+${pointsEarned} điểm</b>${doubleText}`;
        }
    } else {
        const ptsRow = document.getElementById('cartPointsUsedRow');
        if (ptsRow) ptsRow.style.setProperty('display', 'none', 'important');
        const prepRow = document.getElementById('cartPrepaidUsedRow');
        if (prepRow) prepRow.style.setProperty('display', 'none', 'important');
        const earnNotice = document.getElementById('cartPointsEarnNotice');
        if (earnNotice) earnNotice.innerHTML = '';
    }

    // Cấu hình thuế VAT từ hệ thống
    let sysConfig = {};
    try {
        sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
    } catch (e) {}

    const vatEnabled = (sysConfig.vat_enabled === true || sysConfig.vat_enabled === '1' || sysConfig.vat_enabled === 'true');
    const vatRate = parseFloat(sysConfig.vat_rate || 8) || 8;
    const vatIncluded = (sysConfig.vat_included_in_price === true || sysConfig.vat_included_in_price === '1' || sysConfig.vat_included_in_price === 1 || sysConfig.vat_included_in_price === 'true');

    let vatAmount = 0;
    if (vatEnabled && runningAmount > 0) {
        if (vatIncluded) {
            // Giá món đã bao gồm VAT -> Tách thuế ra để hiển thị
            vatAmount = Math.round(runningAmount - (runningAmount / (1 + vatRate / 100)));
        } else {
            // Giá món chưa có VAT -> Cộng thêm VAT vào tổng hóa đơn
            vatAmount = Math.round(runningAmount * (vatRate / 100));
            runningAmount += vatAmount;
        }
    }

    // Hiển thị dòng Thuế VAT
    const vatRow = document.getElementById('cartVatRow');
    const vatLbl = document.getElementById('cartVatLabel');
    const vatAmt = document.getElementById('cartVatAmount');
    if (vatRow) {
        if (vatEnabled && (vatAmount > 0 || runningAmount > 0)) {
            vatRow.style.setProperty('display', 'flex', 'important');
            if (vatLbl) vatLbl.innerHTML = vatIncluded ? `<i class="fa-solid fa-receipt me-1 text-secondary"></i>Đã gồm VAT (${vatRate}%):` : `<i class="fa-solid fa-receipt me-1 text-secondary"></i>Thuế VAT (${vatRate}%):`;
            if (vatAmt) vatAmt.innerText = (vatIncluded ? '' : '+') + new Intl.NumberFormat('vi-VN').format(vatAmount) + ' đ';
        } else {
            vatRow.style.setProperty('display', 'none', 'important');
        }
    }

    window.lastCalcVatEnabled = vatEnabled;
    window.lastCalcVatRate = vatRate;
    window.lastCalcVatIncluded = vatIncluded;
    window.lastCalcVatAmount = vatAmount;

    window.lastCalcFinalTotal = runningAmount;
    window.lastCalcDiscountPercent = discountPercent;
    window.lastCalcDiscountAmount = discountAmount;
    window.lastCalcVoucherDiscount = voucherDiscount;
    window.lastCalcPointsUsed = pointsUsed;
    window.lastCalcPointsAmount = pointsAmount;
    window.lastCalcPointsEarned = pointsEarned;
    window.lastCalcPrepaidUsed = prepaidUsed;

    const totalEl = document.getElementById('cartTotalAmount');
    if (totalEl) {
        if (isAddMore && oldAmount > 0) {
            totalEl.innerHTML = `
                <div class="text-end">
                    <span style="font-size: 22px; font-weight: bold; color: var(--primary-color, #2e7d32);">${new Intl.NumberFormat('vi-VN').format(window.lastCalcFinalTotal)} đ</span>
                    <div class="text-muted fw-normal" style="font-size: 11px; margin-top: 2px;">
                        (Đơn cũ: <b class="text-dark">${new Intl.NumberFormat('vi-VN').format(oldAmount)} đ</b> + Gọi thêm: <b class="text-success">${new Intl.NumberFormat('vi-VN').format(itemsSubtotal)} đ</b>)
                    </div>
                </div>
            `;
        } else {
            totalEl.innerText = new Intl.NumberFormat('vi-VN').format(window.lastCalcFinalTotal) + ' đ';
        }
    }
};

// Hiển thị hướng dẫn Thanh toán & Tải mã QR từ CSDL
window.togglePaymentInfo = async function() {
    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'CASH';
    const infoArea = document.getElementById('paymentInfoArea');
    const cashImmediateOption = document.getElementById('cashImmediateOption');

    if (cashImmediateOption) {
        cashImmediateOption.style.display = (selectedMethod === 'CASH') ? 'flex' : 'none';
    }

    // Luôn fetch cấu hình mới nhất từ server CSDL hoặc cache
    let sysConfig = {};
    try {
        const res = await fetch('/api/system-config?t=' + Date.now());
        if (res.ok) {
            const data = await res.json();
            sysConfig = { ...data, ...(data.config || {}) };
            localStorage.setItem('hoasen_system_config', JSON.stringify(sysConfig));
        }
    } catch (e) {
        sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
    }

    let cart = JSON.parse(localStorage.getItem('hoasen_cart') || '[]');
    if (cart.length === 0) cart = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');
    const totalCalc = cart.reduce((sum, item) => {
        const price = Number(item.price || item.Unit_price || 35000);
        const qty = Number(item.quantity || item.Quantity || 1);
        return sum + (price * qty);
    }, 0);

    const isAddMore = sessionStorage.getItem('hoasen_is_add_more') === '1';
    const oldAmount = isAddMore ? Number(sessionStorage.getItem('hoasen_table_current_amount') || 0) : 0;
    const totalPay = isAddMore ? (oldAmount + totalCalc) : totalCalc;
    const tableNum = document.getElementById('cartTableNumber')?.value?.trim() || 'Bàn Khách';
    const formattedTotal = new Intl.NumberFormat('vi-VN').format(totalPay);

    if (!infoArea) {
        window.updateCartTotal(totalCalc);
        return;
    }

    if (selectedMethod === 'BANK_TRANSFER') {
        infoArea.style.display = 'block';

        const bankName = sysConfig.qrBank || '';
        const accountNo = sysConfig.qrAccountNo ? String(sysConfig.qrAccountNo).trim() : '';
        const accountName = sysConfig.qrAccountName ? String(sysConfig.qrAccountName).trim() : '';

        let qrSrc = '';
        if (sysConfig.qrMode === 'UPLOAD' && sysConfig.qrImageUrl) {
            qrSrc = sysConfig.qrImageUrl;
        } else if (accountNo) {
            qrSrc = `https://img.vietqr.io/image/${bankName || 'MBBANK'}-${accountNo}-compact2.png?amount=${totalPay}&addInfo=Ban%20${encodeURIComponent(tableNum)}&accountName=${encodeURIComponent(accountName)}`;
        } else if (sysConfig.qrImageUrl) {
            qrSrc = sysConfig.qrImageUrl;
        }

        let bankInfoHtml = '';
        if (accountNo) {
            bankInfoHtml = `
                <div class="small text-dark mb-1">
                    Ngân hàng: <b class="text-success">${bankName || 'Ngân hàng'}</b> | STK: <b class="text-primary font-monospace fs-6">${accountNo}</b>
                </div>
                ${accountName ? `<div class="small text-dark mb-1">Chủ TK: <b>${accountName}</b></div>` : ''}
            `;
        } else if (qrSrc) {
            bankInfoHtml = `
                <div class="small text-muted mb-1">
                    <i class="fa-solid fa-camera me-1"></i> Quét mã QR hiển thị để chuyển khoản đúng số tiền
                </div>
            `;
        } else {
            bankInfoHtml = `
                <div class="text-danger small mb-1">
                    <i class="fa-solid fa-circle-exclamation me-1"></i> Chưa lưu số tài khoản chuyển khoản trong CSDL Cài Đặt Hệ Thống.
                </div>
            `;
        }

        infoArea.innerHTML = `
            <div class="p-3 border rounded-3 bg-white shadow-sm text-center">
                <div class="fw-bold text-primary mb-2" style="font-size: 14px;">
                    <i class="fa-solid fa-qrcode me-1"></i> Quét Mã QR Thanh Toán (Chuyển Khoản)
                </div>
                ${qrSrc ? `
                    <div class="d-flex justify-content-center mb-2">
                        <img src="${qrSrc}" alt="QR Thanh toán" style="width: 170px; height: 170px; object-fit: contain; border-radius: 8px; border: 1px solid #dee2e6; padding: 4px; background: #fff;">
                    </div>
                ` : ''}
                ${bankInfoHtml}
                <div class="small fw-bold text-success mb-2">
                    Số tiền cần chuyển: <span class="fs-6">${formattedTotal} đ</span>
                </div>
                <div class="alert alert-warning py-1 px-2 m-0 small border-0 fw-semibold text-center" style="font-size: 11.5px; border-radius: 6px;">
                    <i class="fa-solid fa-circle-exclamation text-warning me-1"></i> Đơn sẽ gửi về Bếp, Thu ngân sẽ kiểm tra và bấm "Xác nhận tiền QR" tại màn hình Đơn hàng.
                </div>
            </div>
        `;
    } else if (selectedMethod === 'MOMO') {
        infoArea.style.display = 'block';

        const momoPhone = sysConfig.momoPhone || sysConfig.qrMomoPhone || '0901234567';
        const momoName = sysConfig.momoName || sysConfig.qrMomoName || 'NHÀ HÀNG CHAY HOA SEN';
        const momoCustomQr = sysConfig.momoQrUrl || sysConfig.qrMomoUrl || '';

        // Tạo link VietQR chuẩn MoMo và QuickChart dự phòng
        const momoVietQr = `https://img.vietqr.io/image/MOMO-${momoPhone}-compact2.png?amount=${totalPay}&addInfo=Ban%20${encodeURIComponent(tableNum)}&accountName=${encodeURIComponent(momoName)}`;
        const momoQuickChart = `https://quickchart.io/qr?text=${encodeURIComponent(`2|99|${momoPhone}|${momoName}||0|0|${totalPay}|Ban ${tableNum}`)}&size=200&margin=1`;
        const initialQrSrc = momoCustomQr || momoVietQr;

        infoArea.innerHTML = `
            <div class="p-3 border rounded-3 bg-white shadow-sm text-center" style="border-top: 4px solid #ae2070 !important;">
                <div class="fw-bold mb-2 d-flex align-items-center justify-content-center gap-2" style="color: #ae2070; font-size: 14px;">
                    <i class="fa-solid fa-mobile-screen-button fs-5"></i>
                    <span>Thanh Toán Qua Ví MoMo</span>
                    <span class="badge rounded-pill text-white" style="background-color: #ae2070; font-size: 10px;">QR Code Tự Động</span>
                </div>

                <!-- Hiển thị mã QR MoMo -->
                <div class="d-flex justify-content-center my-2">
                    <img id="cartMomoQrImage" src="${initialQrSrc}" 
                         onerror="if (this.src !== '${momoQuickChart}') this.src='${momoQuickChart}';" 
                         alt="Mã QR MoMo" 
                         style="width: 175px; height: 175px; object-fit: contain; border-radius: 10px; border: 2px solid #ae2070; padding: 4px; background: #fff; box-shadow: 0 4px 10px rgba(174,32,112,0.15);">
                </div>

                <!-- Ô chỉnh sửa / sao chép SĐT MoMo nhận tiền -->
                <div class="mb-2 p-2 bg-light rounded-3 border d-inline-block text-start w-100" style="max-width: 320px;">
                    <div class="d-flex align-items-center justify-content-between gap-2 mb-1">
                        <span class="small fw-bold text-secondary" style="font-size: 12px; white-space: nowrap;">
                            <i class="fa-solid fa-phone me-1 text-danger"></i> SĐT MoMo:
                        </span>
                        <div class="input-group input-group-sm" style="max-width: 190px;">
                            <input type="tel" id="cartMomoPhoneInput" class="form-control text-center fw-bold text-danger font-monospace" 
                                   value="${momoPhone}" placeholder="SĐT MoMo..." 
                                   oninput="window.updateCartMomoQrLive()">
                            <button class="btn btn-outline-secondary" type="button" onclick="window.copyCartMomoPhone()" title="Sao chép SĐT MoMo">
                                <i class="fa-regular fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    <div class="small text-dark d-flex justify-content-between" style="font-size: 12px;">
                        <span>Chủ ví:</span>
                        <b class="text-uppercase" style="color: #ae2070;">${momoName}</b>
                    </div>
                </div>

                <div class="small fw-bold mb-2" style="color: #ae2070;">
                    Số tiền cần thanh toán: <span class="fs-5">${formattedTotal} đ</span>
                </div>

                <div class="alert alert-warning py-1 px-2 m-0 small border-0 fw-semibold text-center" style="font-size: 11.5px; border-radius: 6px; background-color: #fce4ec; color: #880e4f;">
                    <i class="fa-solid fa-qrcode me-1"></i> Quét mã bằng App MoMo hoặc App Ngân Hàng. Thu ngân sẽ xác nhận tiền MoMo khi nhận đơn.
                </div>
            </div>
        `;
    } else if (selectedMethod === 'CARD') {
        infoArea.style.display = 'block';
        infoArea.innerHTML = `
            <div class="p-3 border rounded-3 bg-white shadow-sm text-center">
                <div class="fw-bold text-warning mb-1" style="font-size: 14px;">
                    <i class="fa-solid fa-credit-card me-1"></i> Quẹt Thẻ Visa / Mastercard
                </div>
                <p class="mb-0 small text-muted">Nhân viên sẽ mang máy POS lại bàn để quẹt thẻ cho Quý khách.</p>
            </div>
        `;
    } else if (selectedMethod === 'PREPAID') {
        infoArea.style.display = 'block';
        const m = window.cartAppliedMember;
        if (!m) {
            infoArea.innerHTML = `
                <div class="alert alert-warning py-2 px-3 small border-0 text-center mb-0">
                    <i class="fa-solid fa-circle-exclamation me-1"></i> Vui lòng tra cứu hoặc đăng ký Thẻ thành viên phía trên để trừ tiền từ Ví Trả Trước!
                </div>
            `;
        } else {
            const balance = Number(m.Prepaid_balance || 0);
            infoArea.innerHTML = `
                <div class="p-3 border rounded-3 bg-white shadow-sm text-center">
                    <div class="fw-bold text-success mb-1" style="font-size: 14px;">
                        <i class="fa-solid fa-wallet me-1"></i> Thanh Toán Ví Trả Trước (Hội Viên)
                    </div>
                    <div class="small text-dark mb-1">Chủ ví: <b>${m.Full_name}</b> (${m.Phone})</div>
                    <div class="small mb-1">Số dư khả dụng: <b class="text-success fs-6">${new Intl.NumberFormat('vi-VN').format(balance)} đ</b></div>
                    <div class="text-muted small" style="font-size: 11.5px;">Hệ thống sẽ tự động trừ số dư ví vào đơn hàng này khi thanh toán.</div>
                </div>
            `;
        }
    } else {
        infoArea.style.display = 'none';
    }
    window.updateCartTotal(totalCalc);
};

// Cập nhật mã QR MoMo trực tiếp khi sửa SĐT MoMo
window.updateCartMomoQrLive = function() {
    const input = document.getElementById('cartMomoPhoneInput');
    const qrImg = document.getElementById('cartMomoQrImage');
    if (!input || !qrImg) return;
    const phone = input.value.trim() || '0901234567';

    let cart = JSON.parse(localStorage.getItem('hoasen_cart') || '[]');
    if (cart.length === 0) cart = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');
    const totalCalc = cart.reduce((sum, item) => sum + (Number(item.price || item.Unit_price || 35000) * Number(item.quantity || item.Quantity || 1)), 0);
    const isAddMore = sessionStorage.getItem('hoasen_is_add_more') === '1';
    const oldAmount = isAddMore ? Number(sessionStorage.getItem('hoasen_table_current_amount') || 0) : 0;
    const totalPay = isAddMore ? (oldAmount + totalCalc) : totalCalc;
    const tableNum = document.getElementById('cartTableNumber')?.value?.trim() || 'Bàn Khách';

    const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
    const momoName = sysConfig.momoName || sysConfig.qrMomoName || 'NHÀ HÀNG CHAY HOA SEN';

    const newVietQr = `https://img.vietqr.io/image/MOMO-${phone}-compact2.png?amount=${totalPay}&addInfo=Ban%20${encodeURIComponent(tableNum)}&accountName=${encodeURIComponent(momoName)}`;
    const newQuickChart = `https://quickchart.io/qr?text=${encodeURIComponent(`2|99|${phone}|${momoName}||0|0|${totalPay}|Ban ${tableNum}`)}&size=200&margin=1`;

    qrImg.src = newVietQr;
    qrImg.onerror = function() {
        if (this.src !== newQuickChart) this.src = newQuickChart;
    };
};

// Sao chép số điện thoại MoMo
window.copyCartMomoPhone = function() {
    const input = document.getElementById('cartMomoPhoneInput');
    const val = input ? input.value.trim() : '0901234567';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).then(() => {
            if (window.toast) window.toast.success(`Đã sao chép SĐT MoMo: ${val}`);
        }).catch(() => {
            if (window.toast) window.toast.info(`SĐT MoMo: ${val}`);
        });
    } else {
        if (input) {
            input.select();
            document.execCommand('copy');
            if (window.toast) window.toast.success(`Đã sao chép SĐT MoMo: ${val}`);
        }
    }
};

// ==========================================
// IN PHIẾU TẠM TÍNH / IN BILL TRƯỚC KHI ĐẶT ĐƠN
// ==========================================
window.printCartBill = function() {
    let cart = JSON.parse(localStorage.getItem('hoasen_cart') || '[]');
    if (cart.length === 0) cart = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');

    if (!cart || cart.length === 0) {
        if (window.toast) window.toast.warning('Giỏ hàng đang trống, không thể in phiếu tạm tính!');
        return;
    }

    const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
    const resName = sysConfig.resName || 'NHÀ HÀNG CHAY HOA SEN';
    const resAddr = sysConfig.resAddr || '36 Phạm Văn Sáng, Hóc Môn, TP.HCM';
    const resPhone = sysConfig.resPhone || '0901 234 567';
    const resWifi = sysConfig.resWifi || 'Wifi: ChayHoaSen / Pass: 88888888';
    const billFooter = sysConfig.billFooter || 'Kính chúc Quý Khách An Lạc & An Nhiên!\nXin cảm ơn & Hẹn gặp lại Quý Khách!';
    const paperSize = sysConfig.paperSize || '80mm';
    const paperWidth = (paperSize === '58mm') ? '58mm' : '80mm';

    const tableNumber = document.getElementById('cartTableNumber')?.value?.trim() || 'Bàn 01';
    const customerName = document.getElementById('cartCustomerName')?.value?.trim() || 'Khách vãng lai';
    const orderType = document.getElementById('cartOrderType')?.value === 'TAKE_AWAY' ? 'Mang về' : 'Tại bàn';
    const cartNote = document.getElementById('cartNote')?.value?.trim() || '';

    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('hoasen_user') || localStorage.getItem('restaurant_user') || '{}');
    const staffName = currentUser.Full_name || currentUser.User_name || 'Nhân viên';
    const printTime = new Date().toLocaleString('vi-VN');

    let totalAmount = 0;
    const itemsRows = cart.map((item, idx) => {
        const price = Number(item.price || item.Unit_price || 0);
        const qty = Number(item.quantity || item.Quantity || 1);
        const itemTotal = price * qty;
        totalAmount += itemTotal;

        const toppings = Array.isArray(item.toppings) ? item.toppings : [];
        const toppingsLine = toppings.length > 0 ? `
            <div style="font-size: 11px; color: #555; padding-left: 10px;">
                + Topping: ${toppings.map(t => `${t.name} (+${Number(t.price).toLocaleString('vi-VN')}đ)`).join(', ')}
            </div>
        ` : '';

        const noteLine = item.note ? `
            <div style="font-size: 11px; font-style: italic; color: #333; padding-left: 10px;">
                - Ghi chú: ${item.note}
            </div>
        ` : '';

        return `
            <tr>
                <td style="padding: 4px 0; text-align: left; vertical-align: top;">
                    <div><b>${idx + 1}. ${item.name || item.Item_name}</b></div>
                    ${toppingsLine}
                    ${noteLine}
                </td>
                <td style="padding: 4px 0; text-align: center; vertical-align: top; font-weight: bold;">${qty}</td>
                <td style="padding: 4px 0; text-align: right; vertical-align: top;">${new Intl.NumberFormat('vi-VN').format(itemTotal)}</td>
            </tr>
        `;
    }).join('');

    const m = window.cartAppliedMember;
    let loyaltyBreakdownHtml = '';
    let finalPayable = totalAmount;

    if (m) {
        const discPercent = window.lastCalcDiscountPercent || 0;
        const discAmt = window.lastCalcDiscountAmount || 0;
        const ptsUsed = window.lastCalcPointsUsed || 0;
        const ptsAmt = window.lastCalcPointsAmount || 0;
        const prepUsed = window.lastCalcPrepaidUsed || 0;
        const ptsEarned = window.lastCalcPointsEarned || 0;
        finalPayable = (window.lastCalcFinalTotal !== undefined) ? window.lastCalcFinalTotal : Math.max(0, totalAmount - discAmt - ptsAmt - prepUsed);

        loyaltyBreakdownHtml = `
            <div style="font-size: 11.5px; margin-top: 4px; border-top: 1px dotted #666; padding-top: 4px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Hội viên:</span>
                    <span><b>${m.Full_name}</b> (${m.tierInfo?.name || 'Mầm Sen'})</span>
                </div>
                ${discAmt > 0 ? `
                <div style="display: flex; justify-content: space-between;">
                    <span>Chiết khấu (${discPercent}%):</span>
                    <span>-${new Intl.NumberFormat('vi-VN').format(discAmt)} đ</span>
                </div>` : ''}
                ${(window.lastCalcVoucherDiscount || 0) > 0 ? `
                <div style="display: flex; justify-content: space-between;">
                    <span>Voucher (${window.cartAppliedVoucher?.code || 'Ưu đãi'}):</span>
                    <span>-${new Intl.NumberFormat('vi-VN').format(window.lastCalcVoucherDiscount)} đ</span>
                </div>` : ''}
                ${ptsAmt > 0 ? `
                <div style="display: flex; justify-content: space-between;">
                    <span>Dùng điểm (${ptsUsed} điểm):</span>
                    <span>-${new Intl.NumberFormat('vi-VN').format(ptsAmt)} đ</span>
                </div>` : ''}
                ${prepUsed > 0 ? `
                <div style="display: flex; justify-content: space-between;">
                    <span>Ví Trả Trước:</span>
                    <span>-${new Intl.NumberFormat('vi-VN').format(prepUsed)} đ</span>
                </div>` : ''}
            </div>
            <div style="font-size: 11px; margin-top: 3px; font-style: italic;">
                + Điểm tích lũy đơn này: +${ptsEarned} điểm
            </div>
        `;
    } else if ((window.lastCalcVoucherDiscount || 0) > 0) {
        finalPayable = (window.lastCalcFinalTotal !== undefined) ? window.lastCalcFinalTotal : Math.max(0, totalAmount - (window.lastCalcVoucherDiscount || 0));
        loyaltyBreakdownHtml = `
            <div style="font-size: 11.5px; margin-top: 4px; border-top: 1px dotted #666; padding-top: 4px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Voucher (${window.cartAppliedVoucher?.code || 'Ưu đãi'}):</span>
                    <span>-${new Intl.NumberFormat('vi-VN').format(window.lastCalcVoucherDiscount)} đ</span>
                </div>
            </div>
        `;
    }

    // Cấu hình thuế VAT cho bản in tạm tính
    const vatEnabled = (sysConfig.vat_enabled === true || sysConfig.vat_enabled === '1' || sysConfig.vat_enabled === 'true');
    const vatRate = parseFloat(sysConfig.vat_rate || 8) || 8;
    const vatIncluded = (sysConfig.vat_included_in_price === true || sysConfig.vat_included_in_price === '1' || sysConfig.vat_included_in_price === 1 || sysConfig.vat_included_in_price === 'true');

    let vatRowHtml = '';
    if (vatEnabled) {
        if (vatIncluded) {
            const vatAmt = Math.round(finalPayable - (finalPayable / (1 + vatRate / 100)));
            vatRowHtml = `
                <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-top: 2px;">
                    <span>Đã gồm VAT (${vatRate}%):</span>
                    <span>${new Intl.NumberFormat('vi-VN').format(vatAmt)} đ</span>
                </div>
            `;
        } else {
            const vatAmt = Math.round(finalPayable * (vatRate / 100));
            finalPayable += vatAmt;
            vatRowHtml = `
                <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-top: 2px;">
                    <span>Thuế VAT (${vatRate}%):</span>
                    <span>+${new Intl.NumberFormat('vi-VN').format(vatAmt)} đ</span>
                </div>
            `;
        }
    }

    // QR Code
    let qrHtml = '';
    if (sysConfig.showQrCode !== false) {
        let qrSrc = sysConfig.qrImageUrl;
        const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'CASH';
        if (selectedMethod === 'MOMO') {
            const mPhone = document.getElementById('cartMomoPhoneInput')?.value?.trim() || sysConfig.momoPhone || '0901234567';
            const mName = sysConfig.momoName || 'NHÀ HÀNG CHAY HOA SEN';
            qrSrc = sysConfig.momoQrUrl || `https://img.vietqr.io/image/MOMO-${mPhone}-compact2.png?amount=${finalPayable}&addInfo=Ban%20${encodeURIComponent(tableNumber)}&accountName=${encodeURIComponent(mName)}`;
        } else if (!qrSrc && sysConfig.qrAccountNo) {
            qrSrc = `https://img.vietqr.io/image/${sysConfig.qrBank || 'MBBANK'}-${sysConfig.qrAccountNo}-compact2.png?accountName=${encodeURIComponent(sysConfig.qrAccountName || 'HOA SEN')}&amount=${finalPayable}`;
        }
        if (qrSrc) {
            qrHtml = `
                <div style="text-align: center; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #000;">
                    <img src="${qrSrc}" alt="QR" style="width: 120px; height: 120px; object-fit: contain; margin: 0 auto; display: block;">
                    <div style="font-size: 11px; font-weight: bold; margin-top: 4px;">Quét mã thanh toán ${selectedMethod === 'MOMO' ? '(Ví MoMo)' : ''}</div>
                </div>
            `;
        }
    }

    const win = window.open('', '_blank', 'width=450,height=650');
    if (!win) return;
    win.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <title>Phiếu Tạm Tính</title>
                <style>
                    @page { size: ${paperWidth} auto; margin: 0; }
                    body { 
                        font-family: 'Courier New', Courier, monospace; 
                        padding: 10px; 
                        margin: 0; 
                        font-size: 13px; 
                        line-height: 1.4;
                        color: #000;
                    }
                    table { width: 100%; border-collapse: collapse; margin: 6px 0; }
                    th { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; }
                </style>
            </head>
            <body>
                <div style="text-align: center; font-weight: bold; font-size: 16px;">${resName}</div>
                <div style="text-align: center; font-size: 12px;">${resAddr}</div>
                <div style="text-align: center; font-size: 12px;">ĐT: ${resPhone}</div>
                ${resWifi ? `<div style="text-align: center; font-size: 11px; font-style: italic;">${resWifi}</div>` : ''}
                
                <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; text-align: center; font-weight: bold; margin: 8px 0; padding: 4px 0; font-size: 14px;">
                    PHIẾU TẠM TÍNH
                </div>
                
                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                    <span>Bàn: <b>${tableNumber}</b> (${orderType})</span>
                    <span>Khách: ${customerName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                    <span>Ngày: ${printTime}</span>
                    <span>NV: ${staffName}</span>
                </div>
                ${cartNote ? `<div style="font-size: 12px; margin-top: 3px;"><i>Ghi chú: ${cartNote}</i></div>` : ''}

                <table>
                    <thead>
                        <tr>
                            <th style="text-align: left;">Món ăn & Topping</th>
                            <th style="text-align: center; width: 35px;">SL</th>
                            <th style="text-align: right; width: 80px;">Tiền (đ)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>

                <div style="border-top: 1px solid #000; padding-top: 6px; margin-top: 6px;">
                    <div style="display: flex; justify-content: space-between; font-size: 13px;">
                        <span>Tạm tính món:</span>
                        <span>${new Intl.NumberFormat('vi-VN').format(totalAmount)} đ</span>
                    </div>
                    ${loyaltyBreakdownHtml}
                    ${vatRowHtml}
                    <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; margin-top: 4px; border-top: 1px dashed #000; padding-top: 4px;">
                        <span>CẦN THANH TOÁN:</span>
                        <span>${new Intl.NumberFormat('vi-VN').format(finalPayable)} đ</span>
                    </div>
                </div>

                ${qrHtml}

                <div style="text-align: center; font-size: 11px; margin-top: 12px; white-space: pre-line;">
                    ${billFooter}
                </div>
            </body>
        </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
        win.print();
        win.close();
    }, 350);

    if (window.toast) window.toast.success('Đang mở bản in tạm tính...');
};

// ==========================================
// XÁC NHẬN ĐẶT HÀNG / LƯU ĐƠN SỬA
// ==========================================
window.submitCartOrder = async function() {
    let cart = JSON.parse(localStorage.getItem('hoasen_cart') || '[]');
    if (!cart || cart.length === 0) cart = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');

    if (cart.length === 0) {
        window.toast.error('Giỏ hàng đang trống!');
        return;
    }

    const orderType = document.getElementById('cartOrderType')?.value || 'DINE_IN';
    let tableNumber = document.getElementById('cartTableNumber')?.value?.trim() || '';
    if (!tableNumber && orderType === 'DINE_IN') {
        const selectEl = document.getElementById('cartTableSelect');
        if (selectEl && selectEl.value && selectEl.value !== '__CUSTOM__') {
            tableNumber = selectEl.value;
            const inputEl = document.getElementById('cartTableNumber');
            if (inputEl) inputEl.value = tableNumber;
        }
    }
    if (orderType === 'TAKE_AWAY' && (!tableNumber || tableNumber.startsWith('Bàn') || tableNumber.startsWith('Phòng'))) {
        tableNumber = 'Mang về';
    }
    if (orderType === 'DELIVERY' && (!tableNumber || tableNumber.startsWith('Bàn') || tableNumber.startsWith('Phòng'))) {
        const platform = document.getElementById('cartDeliveryPlatformSelect')?.value || 'GRABFOOD';
        tableNumber = `Đơn Giao - ${platform}`;
    }

    if (!tableNumber && orderType === 'DINE_IN') {
        if (window.toast) window.toast.warning('Vui lòng chọn bàn phục vụ trước khi gửi đơn!');
        document.getElementById('cartTableSelect')?.focus();
        return;
    }

    const customerName = document.getElementById('cartCustomerName')?.value?.trim() || 'Khách vãng lai';
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'CASH';
    const note = document.getElementById('cartNote')?.value?.trim() || '';

    // Kiểm tra có thu tiền mặt ngay không (Mặc định là không chọn)
    const isImmediateCash = (paymentMethod === 'CASH') && (document.getElementById('cartCashPaidImmediate')?.checked === true);

    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('hoasen_user') || localStorage.getItem('restaurant_user') || '{}');
    const staffUsername = currentUser.User_name || currentUser.username || 'nhanvien';
    const staffName = currentUser.Full_name || currentUser.Display_name || staffUsername;
    const staffRole = currentUser.Role || 'WAITER';

    let rawEditId = localStorage.getItem('hoasen_edit_order_id') || localStorage.getItem('editing_order_id');
    let editingOrderId = null;
    if (rawEditId && rawEditId !== 'null' && rawEditId !== 'undefined') {
        editingOrderId = String(rawEditId).replace('#', '').trim();
    }

    const totalCalc = cart.reduce((sum, item) => {
        const price = Number(item.price || item.Unit_price || 35000);
        const qty = Number(item.quantity || item.Quantity || 1);
        return sum + (price * qty);
    }, 0);

    const isAddMore = sessionStorage.getItem('hoasen_is_add_more') === '1';
    const activeOrderCode = sessionStorage.getItem('hoasen_table_active_order_code');
    const oldTableAmount = isAddMore ? Number(sessionStorage.getItem('hoasen_table_current_amount') || 0) : 0;
    const finalCombinedTotal = isAddMore ? (oldTableAmount + totalCalc) : totalCalc;

    // Đọc thông tin giao hàng nếu có
    let deliveryPlatform = null;
    let customerPhone = null;
    let deliveryAddress = null;
    let paymentType = (paymentMethod === 'CASH') ? 'COD' : 'TRANSFER';
    let isDeliveryOrder = false;

    const delStr = sessionStorage.getItem('hoasen_delivery_info');
    if (delStr) {
        try {
            const delInfo = JSON.parse(delStr);
            deliveryPlatform = delInfo.platformName;
            customerPhone = delInfo.customerPhone;
            deliveryAddress = delInfo.deliveryAddress;
            paymentType = delInfo.paymentType || paymentType;
            isDeliveryOrder = true;
        } catch (e) {}
    }

    const isPrepaid = (paymentMethod === 'PREPAID');
    const isPaid = isImmediateCash || isPrepaid;

    const payload = {
        Table_number: tableNumber,
        Order_type: isDeliveryOrder ? (deliveryAddress ? 'DELIVERY' : 'TAKE_AWAY') : orderType,
        Customer_name: window.cartAppliedMember ? window.cartAppliedMember.Full_name : customerName,
        Payment_method: paymentMethod,
        Payment_status: isPaid ? 'PAID' : 'UNPAID',
        Paid_by: isPaid ? staffUsername : null,
        Staff_name: staffName,
        Staff_role: staffRole,
        Note: note,
        totalAmount: (window.lastCalcFinalTotal !== undefined) ? window.lastCalcFinalTotal : finalCombinedTotal,
        newItemsTotal: totalCalc,
        oldAmount: oldTableAmount,
        editingOrderId: editingOrderId,
        isAddMore: isAddMore,
        targetOrderCode: activeOrderCode,
        Delivery_platform: deliveryPlatform,
        Customer_phone: window.cartAppliedMember ? window.cartAppliedMember.Phone : customerPhone,
        Delivery_address: deliveryAddress,
        Payment_type: paymentType,
        Member_id: window.cartAppliedMember ? window.cartAppliedMember.Member_id : null,
        Member_phone: window.cartAppliedMember ? window.cartAppliedMember.Phone : (customerPhone || ''),
        Member_name: window.cartAppliedMember ? window.cartAppliedMember.Full_name : customerName,
        Member_tier: window.cartAppliedMember ? window.cartAppliedMember.Current_tier : null,
        Discount_percent: window.lastCalcDiscountPercent || 0,
        Discount_amount: window.lastCalcDiscountAmount || 0,
        Points_used: window.lastCalcPointsUsed || 0,
        Points_amount: window.lastCalcPointsAmount || 0,
        Points_earned: window.lastCalcPointsEarned || 0,
        Prepaid_used: (paymentMethod === 'PREPAID') ? (window.lastCalcPrepaidUsed || 0) : 0,
        Voucher_code: window.cartAppliedVoucher ? (window.cartAppliedVoucher.code || window.cartAppliedVoucher.Code) : null,
        Voucher_discount: window.lastCalcVoucherDiscount || 0,
        items: cart.map(i => ({
            id: i.id || i.Item_id,
            name: i.name || i.Item_name,
            quantity: Number(i.quantity || i.Quantity || 1),
            price: Number(i.price || i.Unit_price || 35000),
            note: i.note || '',
            toppings: Array.isArray(i.toppings) ? i.toppings : []
        }))
    };

    try {
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        const displayCode = editingOrderId || data.Order_code || 'CHAY-NEW';

        // Máy chủ (routes/orders.js) đã tự động phát socket 'kitchen_new_order' và 'table_updated' chính xác cho toàn bộ thiết bị

        if (data.isAddMore) {
            window.toast.success(`Đã bổ sung ${cart.length} món vào bàn [${tableNumber}] thành công! (Mã đơn: #${displayCode})`);
        } else if (isPrepaid) {
            window.toast.success(`Đã trừ tiền Ví Trả Trước & gửi đơn #${displayCode} xuống bếp thành công!`);
        } else if (isImmediateCash) {
            window.toast.success(`Đã thu tiền mặt & gửi đơn #${displayCode} xuống bếp thành công!`);
        } else if (paymentMethod === 'BANK_TRANSFER') {
            window.toast.success(`Đã gửi đơn #${displayCode} xuống bếp! Chờ thu ngân xác nhận tiền QR.`);
        } else if (paymentMethod === 'MOMO') {
            window.toast.success(`Đã gửi đơn #${displayCode} xuống bếp! Chờ thu ngân xác nhận tiền MoMo.`);
        } else {
            window.toast.success(`${editingOrderId ? 'Đã cập nhật đơn hàng thành công!' : 'Đã xác nhận đặt hàng thành công!'} (Mã: #${displayCode})`);
        }

        // 🌟 BẢO MẬT & TRÁNH TRÙNG LẶP: Dọn dẹp giỏ hàng & XÓA NGAY LẬP TỨC thông tin thẻ khách hàng
        localStorage.removeItem('hoasen_cart');
        localStorage.removeItem('restaurant_cart');
        localStorage.removeItem('hoasen_edit_order_id');
        localStorage.removeItem('editing_order_id');
        sessionStorage.removeItem('hoasen_edit_order_data');
        localStorage.removeItem('hoasen_edit_order_data');
        sessionStorage.removeItem('hoasen_selected_table');
        sessionStorage.removeItem('hoasen_selected_table_id');
        sessionStorage.removeItem('hoasen_delivery_info');
        sessionStorage.removeItem('hoasen_table_active_order_code');
        sessionStorage.removeItem('hoasen_table_current_amount');
        sessionStorage.removeItem('hoasen_is_add_more');
        sessionStorage.removeItem('hoasen_applied_member');

        window.cartAppliedMember = null;
        window.cartAppliedVoucher = null;
        window.cartPointsToUse = 0;
        window.lastCalcDiscountPercent = 0;
        window.lastCalcDiscountAmount = 0;
        window.lastCalcVoucherDiscount = 0;
        window.lastCalcPointsUsed = 0;
        window.lastCalcPointsAmount = 0;
        window.lastCalcPointsEarned = 0;
        window.lastCalcPrepaidUsed = 0;
        window.lastCalcFinalTotal = 0;

        if (typeof window.renderCartMemberAppliedCard === 'function') window.renderCartMemberAppliedCard();
        if (typeof window.cartRemoveVoucher === 'function') window.cartRemoveVoucher();
        if (typeof window.updateFloatingCartBadge === 'function') window.updateFloatingCartBadge();
        if (typeof window.updateOrderContextBanner === 'function') window.updateOrderContextBanner();

        if (isDeliveryOrder) {
            if (typeof window.navigateTo === 'function') {
                await window.navigateTo('/ready-orders');
            } else {
                window.location.href = '/ready-orders';
            }
        } else {
            if (typeof window.navigateTo === 'function') {
                await window.navigateTo('/tables');
            } else {
                window.location.href = '/tables';
            }
        }

        if (typeof window.loadTables === 'function') {
            window.loadTables();
        }
    } catch (err) {
        console.error('Lỗi gửi đơn:', err);
        if (window.toast) {
            window.toast.error('Có lỗi xảy ra khi xác nhận đơn hàng!');
        }
    }
};

// Cập nhật Badge hiển thị trên nút Giỏ hàng nổi
window.updateFloatingCartBadge = function() {
    let items = JSON.parse(localStorage.getItem('hoasen_cart') || '[]');
    if (items.length === 0) items = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');

    const totalCount = items.reduce((sum, item) => sum + Number(item.quantity || item.Quantity || 1), 0);
    
    const badges = document.querySelectorAll('#floatingCartBadge, .cart-badge, #cartCount');
    badges.forEach(badge => {
        if (badge) {
            badge.innerText = totalCount;
            badge.style.display = totalCount > 0 ? 'inline-block' : 'none';
        }
    });
};

// Tự chạy khởi tạo
document.addEventListener('DOMContentLoaded', () => {
    window.initCart();
});