// ==========================================
// FILE JS/ORDERS.JS - QUẢN LÝ ĐƠN HÀNG VÀ THỐNG KÊ
// ==========================================

// Biến dữ liệu toàn cục
window.allOrdersData = [];
window.chartInstances = {};

// Lắng nghe Socket.IO Realtime
if (window.socket) {
    window.socket.off('order_status_updated');
    window.socket.on('order_status_updated', function(data) {
        console.log('⚡ Realtime cập nhật đơn hàng:', data);
        if (Array.isArray(window.allOrdersData)) {
            const targetIndex = window.allOrdersData.findIndex(o => 
                String(o.Order_id) === String(data.Order_id) || 
                String(o.Order_code) === String(data.Order_code || data.Order_id) ||
                String(o.Order_code) === ('CHAY-' + data.Order_id)
            );
            if (targetIndex !== -1) {
                if (data.Status) window.allOrdersData[targetIndex].Status = data.Status;
                if (data.Cancel_role) window.allOrdersData[targetIndex].Cancel_role = data.Cancel_role;
                if (data.Cancel_reason) window.allOrdersData[targetIndex].Cancel_reason = data.Cancel_reason;
                if (data.Is_edited !== undefined) window.allOrdersData[targetIndex].Is_edited = data.Is_edited;
                if (data.Payment_status !== undefined) window.allOrdersData[targetIndex].Payment_status = data.Payment_status;
                if (data.Paid_by !== undefined) window.allOrdersData[targetIndex].Paid_by = data.Paid_by;
                if (data.Paid_at !== undefined) window.allOrdersData[targetIndex].Paid_at = data.Paid_at;
            } else {
                window.loadOrders();
                return;
            }
        }
        window.applyOrderFilters();
    });

    window.socket.off('kitchen_new_order');
    window.socket.on('kitchen_new_order', function() {
        if (typeof window.loadOrders === 'function') window.loadOrders();
    });

    window.socket.off('tables_list_changed');
    window.socket.on('tables_list_changed', function() {
        if (typeof window.loadOrders === 'function') window.loadOrders();
    });
}

// 1. PHÂN QUYỀN 3 TAB ĐƠN HÀNG, BÁO CÁO & KPI TOÀN QUÁN
window.applyOrderTabPermissions = function() {
    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const canReports = (typeof window.hasPermission === 'function') ? window.hasPermission(user, 'REPORTS_STATS') : false;
    const canStaffKPI = (typeof window.hasPermission === 'function') ? window.hasPermission(user, 'STAFF_KPI_ALL') : false;
    const canList = (typeof window.hasPermission === 'function') 
        ? (window.hasPermission(user, 'ORDERS_LIST') || window.hasPermission(user, 'ORDERS_ALL') || window.hasPermission(user, 'ORDERS_PERSONAL')) 
        : true;

    // 1. Nút Thống Kê Báo Cáo
    const statsTabItem = document.getElementById('tab-orders-stats-item');
    if (statsTabItem) statsTabItem.style.display = canReports ? '' : 'none';

    // 2. Nút Bật/Tắt Biểu Đồ
    const chartToggleBtn = document.getElementById('quickChartToggleBtn');
    if (chartToggleBtn) chartToggleBtn.style.display = canReports ? '' : 'none';
    const quickChartsSection = document.getElementById('quickChartsSection');
    if (!canReports && quickChartsSection) quickChartsSection.classList.add('d-none');

    // 3. Nút Nhật Ký & KPI Toàn Quán
    const staffTabItem = document.getElementById('tab-orders-staff-item');
    if (staffTabItem) staffTabItem.style.display = canStaffKPI ? '' : 'none';

    // 4. Nút Danh Sách Đơn Hàng
    const listTabItem = document.getElementById('tab-orders-list-item');
    if (listTabItem) listTabItem.style.display = canList ? '' : 'none';
};

// 1.1. CHUYỂN TAB ĐƠN HÀNG & THỐNG KÊ & KPI
window.switchOrderTab = function(tabId) {
    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const canReports = (typeof window.hasPermission === 'function') ? window.hasPermission(user, 'REPORTS_STATS') : false;
    const canStaffKPI = (typeof window.hasPermission === 'function') ? window.hasPermission(user, 'STAFF_KPI_ALL') : false;

    if (tabId === 'tab-orders-stats' && !canReports) {
        if (window.toast) window.toast.warning('Tài khoản của bạn chưa được cấp quyền xem Thống Kê Báo Cáo!');
        return;
    }
    if (tabId === 'tab-orders-staff' && !canStaffKPI) {
        if (window.toast) window.toast.warning('Tài khoản của bạn chưa được cấp quyền xem Nhật Ký & KPI Toàn Quán!');
        return;
    }

    document.querySelectorAll('#ordersMainTabs .nav-link').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('#ordersTabsContent .tab-pane-order').forEach(pane => pane.classList.add('d-none'));

    const activeBtn = document.getElementById(tabId + '-btn');
    const activePane = document.getElementById(tabId);

    if (activeBtn) activeBtn.classList.add('active');
    if (activePane) activePane.classList.remove('d-none');

    if (tabId === 'tab-orders-stats') {
        window.renderOrderStatistics();
    } else if (tabId === 'tab-orders-staff') {
        window.loadStaffKPIData();
    }
};

// Biến quản lý phạm vi đơn hàng (Mặc định đơn của tôi cho Bồi bàn)
window.ordersScope = 'MY_ORDERS';
window.quickChartRevenueInstance = null;
window.quickChartStatusInstance = null;

// CẬP NHẬT BANNER NHÂN VIÊN VÀ PHẠM VI XEM
window.updateStaffOrdersBanner = function() {
    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const roleUpper = String(user.Role || user.role || 'GUEST').toUpperCase();
    const username = user.User_name || user.username || 'nhanvien';
    const fullName = user.Full_name || user.Fullname || username;

    const bannerTitle = document.getElementById('staffOrdersUserBanner');
    const bannerSubtext = document.getElementById('staffOrdersUserSubtext');
    const scopeBtnGroup = document.getElementById('ordersScopeBtnGroup');
    const myOrdersRadio = document.getElementById('scopeMyOrders');
    const allOrdersRadio = document.getElementById('scopeAllOrders');

    // Chuyển đổi tên vai trò
    const roleMap = {
        'WAITER': 'Bồi Bàn (Phục Vụ)',
        'CASHIER': 'Thu Ngân',
        'KITCHEN': 'Đầu Bếp',
        'ADMIN': 'Quản Lý Nhà Hàng'
    };
    const roleTitle = roleMap[roleUpper] || roleUpper;

    // Kiểm tra xem user này có quyền xem toàn bộ đơn quán hay không
    const canSeeAll = (typeof window.canViewAllOrders === 'function') 
        ? window.canViewAllOrders(user) 
        : ['ADMIN', 'CASHIER'].includes(roleUpper);

    if (bannerTitle) {
        const extraBadge = canSeeAll && ['WAITER', 'PHỤC VỤ', 'PHUCVU'].includes(roleUpper)
            ? `<span class="badge bg-primary text-white ms-1"><i class="fa-solid fa-crown me-1"></i>Bồi Bàn Trưởng (Xem Đơn Toàn Quán)</span>`
            : `<small class="badge bg-success-subtle text-success border border-success ms-1">${roleTitle}</small>`;
        bannerTitle.innerHTML = `<i class="fa-solid fa-clipboard-user me-2"></i>Đơn Hàng & Nhật Ký: <span class="text-dark">${fullName}</span> ${extraBadge}`;
    }

    // Điều khiển nút "Toàn Bộ Quán"
    if (allOrdersRadio) {
        allOrdersRadio.disabled = !canSeeAll;
        if (!canSeeAll) {
            allOrdersRadio.title = 'Tài khoản chưa được cấp quyền xem toàn bộ đơn của quán';
        } else {
            allOrdersRadio.removeAttribute('title');
        }
    }

    if (canSeeAll && ['ADMIN', 'CASHIER'].includes(roleUpper)) {
        // Quản lý hoặc Thu ngân: Mặc định xem "Toàn bộ quán"
        window.ordersScope = 'ALL_ORDERS';
        if (allOrdersRadio) allOrdersRadio.checked = true;
        if (bannerSubtext) {
            bannerSubtext.innerText = 'Toàn bộ đơn hàng trong nhà hàng và báo cáo hoạt động ca trực.';
        }
    } else {
        // Bồi bàn (dù có hay không có quyền xem toàn quán) mặc định vào xem "Đơn của tôi", nhưng nếu có quyền thì có thể tự do bấm sang "Toàn bộ quán"
        window.ordersScope = 'MY_ORDERS';
        if (myOrdersRadio) myOrdersRadio.checked = true;
        if (bannerSubtext) {
            bannerSubtext.innerText = canSeeAll 
                ? 'Danh sách đơn bạn đang phục vụ. Bạn đã được cấp quyền chuyển sang xem Toàn Bộ Quán như thu ngân.'
                : 'Danh sách đơn hàng bạn đang phục vụ và lịch sử các đơn đã xử lý.';
        }
    }
};

// ĐỔI PHẠM VI ĐƠN HÀNG: ĐƠN CỦA TÔI VS TOÀN BỘ QUÁN
window.setOrdersScope = function(scope) {
    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const canSeeAll = (typeof window.canViewAllOrders === 'function') 
        ? window.canViewAllOrders(user) 
        : true;

    if (scope === 'ALL_ORDERS' && !canSeeAll) {
        if (window.toast) window.toast.warning('Tài khoản của bạn chưa được cấp quyền xem đơn toàn bộ quán!');
        const myOrdersRadio = document.getElementById('scopeMyOrders');
        if (myOrdersRadio) myOrdersRadio.checked = true;
        window.ordersScope = 'MY_ORDERS';
        return;
    }

    window.ordersScope = scope;
    window.applyOrderFilters();
};

// XỬ LÝ KHI CHỌN MỐC THỜI GIAN
window.handleTimeRangeChange = function() {
    const timeRange = document.getElementById('filterTimeRange')?.value || 'TODAY';
    const dateFromInput = document.getElementById('filterDateFrom');
    const dateToInput = document.getElementById('filterDateTo');

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (timeRange === 'TODAY') {
        if (dateFromInput) dateFromInput.value = todayStr;
        if (dateToInput) dateToInput.value = todayStr;
    } else if (timeRange === 'WEEK') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (dateFromInput) dateFromInput.value = weekAgo.toISOString().split('T')[0];
        if (dateToInput) dateToInput.value = todayStr;
    } else if (timeRange === 'MONTH') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        if (dateFromInput) dateFromInput.value = monthStart.toISOString().split('T')[0];
        if (dateToInput) dateToInput.value = todayStr;
    } else if (timeRange === 'YEAR') {
        const yearStart = new Date(now.getFullYear(), 0, 1);
        if (dateFromInput) dateFromInput.value = yearStart.toISOString().split('T')[0];
        if (dateToInput) dateToInput.value = todayStr;
    } else if (timeRange === 'ALL') {
        if (dateFromInput) dateFromInput.value = '';
        if (dateToInput) dateToInput.value = '';
    }

    window.applyOrderFilters();
};

// 2. LOAD DANH SÁCH ĐƠN HÀNG TỪ SERVER
window.loadOrders = async function() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    window.updateStaffOrdersBanner();
    window.applyOrderTabPermissions();

    // Mặc định điền ngày hôm nay nếu chưa có
    const dateFromInput = document.getElementById('filterDateFrom');
    const dateToInput = document.getElementById('filterDateTo');
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateFromInput && !dateFromInput.value) dateFromInput.value = todayStr;
    if (dateToInput && !dateToInput.value) dateToInput.value = todayStr;

    try {
        const response = await fetch('/api/orders?t=' + Date.now());
        if (response.ok) {
            window.allOrdersData = await response.json();
        } else {
            window.allOrdersData = window.getMockOrdersData();
        }
    } catch (err) {
        window.allOrdersData = window.getMockOrdersData();
    }
    window.applyOrderFilters();
};
window.initOrders = window.loadOrders;

// 3. BỘ LỌC ĐA NĂNG & TÍNH TOÁN 4 THẺ CHỈ SỐ KPI
window.applyOrderFilters = function() {
    const timeRange = document.getElementById('filterTimeRange')?.value || 'TODAY';
    const dateFrom = document.getElementById('filterDateFrom')?.value || '';
    const dateTo = document.getElementById('filterDateTo')?.value || '';
    const processStatus = document.getElementById('filterProcessStatus')?.value || 'ALL';
    const orderType = document.getElementById('filterOrderType')?.value || 'ALL';
    const keyword = document.getElementById('filterSearchInput')?.value.toLowerCase().trim() || '';

    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const myUsername = String(user.User_name || user.username || '').toLowerCase();
    const myFullName = String(user.Full_name || user.fullname || '').toLowerCase();

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let filtered = (window.allOrdersData || []).filter(order => {
        // 1. Lọc theo Phạm vi (Đơn của tôi vs Toàn bộ quán)
        if (window.ordersScope === 'MY_ORDERS' && myUsername) {
            const staffName = String(order.Staff_name || '').toLowerCase();
            const createdBy = String(order.Created_by || '').toLowerCase();
            const paidBy = String(order.Paid_by || '').toLowerCase();
            const cookedBy = String(order.Cooked_by || '').toLowerCase();
            const note = String(order.Note || '').toLowerCase();

            const isMine = (
                staffName.includes(myUsername) || 
                (myFullName && staffName.includes(myFullName)) ||
                createdBy.includes(myUsername) ||
                paidBy.includes(myUsername) ||
                cookedBy.includes(myUsername) ||
                (myFullName && cookedBy.includes(myFullName)) ||
                note.includes(myUsername)
            );
            if (!isMine) return false;
        }

        // 2. Lọc theo Thời Gian (Ưu tiên khoảng ngày dateFrom / dateTo)
        const orderDateStr = order.Created_at || order.createdAt || todayStr;
        const orderDayOnly = orderDateStr.substring(0, 10);

        if (dateFrom && orderDayOnly < dateFrom) return false;
        if (dateTo && orderDayOnly > dateTo) return false;

        if (!dateFrom && !dateTo && timeRange !== 'ALL') {
            const orderDate = new Date(orderDateStr);
            if (timeRange === 'TODAY') {
                if (orderDayOnly !== todayStr) return false;
            } else if (timeRange === 'WEEK') {
                const diffDays = (now - orderDate) / (1000 * 3600 * 24);
                if (diffDays > 7) return false;
            } else if (timeRange === 'MONTH') {
                if (orderDate.getMonth() !== now.getMonth() || orderDate.getFullYear() !== now.getFullYear()) return false;
            } else if (timeRange === 'YEAR') {
                if (orderDate.getFullYear() !== now.getFullYear()) return false;
            }
        }

        // 3. Lọc theo Trạng Thái Xử Lý
        const statusRaw = String(order.Status || order.status || '').toUpperCase();
        const isPaid = (String(order.Payment_status || '').toUpperCase() === 'PAID');
        const isCanceled = (
            statusRaw === 'CANCELED' || 
            statusRaw === 'CANCELLED' || 
            Boolean(order.Cancel_role) || 
            String(order.Cancel_reason || '').toLowerCase().includes('hủy')
        );

        if (processStatus === 'SERVING') {
            // Đang phục vụ: Đang làm, chờ giao, bàn đang ăn (chưa hủy, chưa giao xong)
            if (isCanceled || statusRaw === 'COMPLETED' || statusRaw === 'SERVED' || statusRaw === 'DONE') return false;
        } else if (processStatus === 'UNPAID') {
            // Chờ thanh toán: Chưa trả tiền và chưa hủy
            if (isPaid || isCanceled) return false;
        } else if (processStatus === 'PAID_COMPLETED') {
            // Đã hoàn thành hoặc đã thanh toán
            if (isCanceled || (!isPaid && statusRaw !== 'COMPLETED' && statusRaw !== 'SERVED')) return false;
        } else if (processStatus === 'CANCELED') {
            if (!isCanceled) return false;
        }

        // 4. Lọc Loại Đơn
        const type = order.Order_type || order.orderType || 'DINE_IN';
        if (orderType !== 'ALL') {
            if (orderType === 'DINE_IN' && type !== 'DINE_IN') return false;
            if (orderType === 'TAKE_AWAY_SELF' && type !== 'TAKE_AWAY_SELF' && type !== 'TAKE_AWAY') return false;
        }

        // 5. Tìm Kiếm (Mã đơn, Bàn, Khách hàng, Tên món, Nền tảng, SĐT)
        if (keyword) {
            const idMatch = String(order.Order_code || order.Order_id || '').toLowerCase().includes(keyword);
            const tableMatch = String(order.Table_number || order.Table_name || '').toLowerCase().includes(keyword);
            const customerMatch = String(order.Customer_name || '').toLowerCase().includes(keyword);
            const platformMatch = String(order.Delivery_platform || '').toLowerCase().includes(keyword);
            const phoneMatch = String(order.Customer_phone || '').toLowerCase().includes(keyword);
            
            let itemMatch = false;
            if (Array.isArray(order.items)) {
                itemMatch = order.items.some(i => String(i.Item_name || i.name || '').toLowerCase().includes(keyword));
            }
            if (!idMatch && !tableMatch && !customerMatch && !itemMatch && !platformMatch && !phoneMatch) return false;
        }

        return true;
    });

    // TÍNH TOÁN 4 THẺ CHỈ SỐ KPI TỔNG QUAN
    let servingCount = 0;
    let unpaidServingCount = 0;
    let completedCount = 0;
    let canceledCount = 0;
    let totalRevenue = 0;

    filtered.forEach(o => {
        const statusRaw = String(o.Status || o.status || '').toUpperCase();
        const isPaid = (String(o.Payment_status || '').toUpperCase() === 'PAID');
        const isCanceled = (
            statusRaw === 'CANCELED' || 
            statusRaw === 'CANCELLED' || 
            Boolean(o.Cancel_role) || 
            String(o.Cancel_reason || '').toLowerCase().includes('hủy')
        );
        const amount = Number(o.Final_amount || o.Total_amount || 0);

        if (isCanceled) {
            canceledCount++;
        } else if (statusRaw === 'COMPLETED' || statusRaw === 'SERVED' || statusRaw === 'DONE') {
            completedCount++;
            if (amount > 0) totalRevenue += amount;
        } else {
            // Đang phục vụ / đang xử lý
            servingCount++;
            if (!isPaid) unpaidServingCount++;
            // Nếu đã thu tiền trước (tiền mặt ngay lúc đặt đơn) thì cộng vào doanh thu đã xử lý
            if (isPaid && amount > 0) totalRevenue += amount;
        }
    });

    // Cập nhật lên 4 thẻ KPI trên giao diện
    const kpiServingEl = document.getElementById('kpiServingOrders');
    if (kpiServingEl) kpiServingEl.innerText = servingCount;

    const kpiUnpaidSub = document.getElementById('kpiUnpaidSubtext');
    if (kpiUnpaidSub) {
        kpiUnpaidSub.innerHTML = `Trong đó: <b class="text-danger">${unpaidServingCount}</b> bàn chưa thu tiền`;
    }

    const kpiCompletedEl = document.getElementById('kpiCompletedOrders');
    if (kpiCompletedEl) kpiCompletedEl.innerText = completedCount;

    const kpiCanceledEl = document.getElementById('kpiCanceledOrders');
    if (kpiCanceledEl) kpiCanceledEl.innerText = canceledCount;

    const kpiRevEl = document.getElementById('kpiTotalRevenue');
    if (kpiRevEl) {
        kpiRevEl.innerText = new Intl.NumberFormat('vi-VN').format(totalRevenue) + ' đ';
    }

    // Cập nhật số lượng và text tóm tắt
    const countEl = document.getElementById('totalOrdersCount');
    if (countEl) countEl.innerText = filtered.length + ' đơn';

    const summaryTextEl = document.getElementById('filterSummaryText');
    if (summaryTextEl) {
        const scopeText = (window.ordersScope === 'MY_ORDERS') ? 'Đơn của bạn' : 'Toàn bộ quán';
        const dateText = (dateFrom && dateTo) ? `${dateFrom} đến ${dateTo}` : (timeRange === 'TODAY' ? 'Hôm nay' : timeRange);
        summaryTextEl.innerText = `${scopeText} • ${dateText} (${filtered.length} đơn)`;
    }

    window.renderOrdersTable(filtered);

    // Cập nhật biểu đồ nếu đang mở
    const quickSection = document.getElementById('quickChartsSection');
    if (quickSection && !quickSection.classList.contains('d-none')) {
        window.renderQuickCharts(filtered);
    }

    if (!document.getElementById('tab-orders-stats')?.classList.contains('d-none')) {
        window.renderOrderStatistics();
    }
};

// 4. RENDER BẢNG ĐƠN HÀNG (SẠCH CODE - ĐÁNH DẤU VÀNG/ĐỎ RÕ RÀNG)
window.renderOrdersTable = function(orders) {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-muted">Chưa có đơn hàng nào phù hợp</td></tr>`;
        return;
    }

    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const roleUpper = String(currentUser.Role || '').toUpperCase();
    const isAdmin = roleUpper === 'ADMIN' || roleUpper === 'QUẢN LÝ' || roleUpper === 'MANAGER';
    const isCashier = roleUpper === 'CASHIER' || roleUpper === 'THU NGÂN' || roleUpper === 'THUNGAN';

    // Bồi bàn và Bếp phải được cấp quyền mới được Sửa, Hủy, Xóa đơn
    const canEdit = isAdmin || isCashier || ((typeof window.hasPermission === 'function') && window.hasPermission(currentUser, 'ORDERS_EDIT'));
    const canCancel = isAdmin || isCashier || ((typeof window.hasPermission === 'function') && window.hasPermission(currentUser, 'ORDERS_CANCEL'));
    const canDelete = isAdmin || ((typeof window.hasPermission === 'function') && window.hasPermission(currentUser, 'ORDERS_DELETE'));

    tbody.innerHTML = orders.map(order => {
        const orderId = order.Order_id || order.id || '0';
        const orderCode = order.Order_code || orderId;
        const tableNumber = order.Table_number || order.Table_name || 'N/A';
        const customerName = order.Customer_name || 'Khách vãng lai';
        const paymentMethod = order.Payment_method || 'CASH';
        const statusRaw = String(order.Status || order.status || '').toUpperCase();
        const createdAt = order.Created_at || '';

        const cancelRole = order.Cancel_role || order.cancelRole || '';
        const cancelReason = order.Cancel_reason || order.cancelReason || order.Note || order.note || 'Không có';

        // 🚨 NHẬN BIẾT CỜ IS_EDITED LINH HOẠT (Số 1, Chuỗi "1", hoăc Boolean true)
        const isEdited = Boolean(Number(order.Is_edited || order.is_edited || order.isEdited || 0) > 0);

        // Trạng thái Hủy
        const isCanceled = (
            statusRaw === 'CANCELED' || 
            statusRaw === 'CANCELLED' || 
            Boolean(cancelRole) || 
            cancelReason.toLowerCase().includes('lý do:') ||
            cancelReason.toLowerCase().includes('hủy')
        );

        // Tóm tắt món ăn
        let itemsSummary = '';
        let calcTotal = 0;

        if (Array.isArray(order.items) && order.items.length > 0) {
            itemsSummary = order.items.map(i => {
                const name = i.Item_name || i.name;
                const qty = Number(i.Quantity || i.quantity || 1);
                const price = Number(i.Unit_price || i.price || 0);
                calcTotal += (i.Total_price ? Number(i.Total_price) : price * qty);
                const note = i.Note || i.note || '';
                const toppings = i.Toppings || i.toppings || '';
                let extraHtml = '';
                if (toppings) extraHtml += `<div class="small text-success" style="font-size: 11px;">+ ${toppings}</div>`;
                if (note) extraHtml += `<div class="small text-danger fw-semibold" style="font-size: 11px;"><i class="fa-solid fa-comment-dots me-1"></i>${note}</div>`;
                return `<div class="mb-1">• <b>${name}</b> x${qty} ${extraHtml}</div>`;
            }).join('');
        } else if (order.items_summary) {
            itemsSummary = order.items_summary;
            calcTotal = Number(order.Final_amount || order.Total_amount || 0);
        } else {
            itemsSummary = 'Chi tiết đơn hàng';
            calcTotal = Number(order.Final_amount || order.Total_amount || 0);
        }

        const finalTotal = calcTotal > 0 ? calcTotal : Number(order.Final_amount || 0);
        const totalFormatted = new Intl.NumberFormat('vi-VN').format(finalTotal);

        // 🎨 ĐẶT MÀU NỀN TRỰC TIẾP CHO TỪNG Ô Ô TD ĐỂ CHỐNG GHI ĐÈ CSS
        let tdBgStyle = '';
        let statusBadge = '';
        let totalStyle = 'text-success fw-bold';

        if (isCanceled) {
            tdBgStyle = 'style="background-color: #f8d7da !important; color: #842029 !important;"'; // Đỏ nhạt
            totalStyle = 'text-decoration-line-through text-danger fw-bold';
            statusBadge = `
                <span class="badge bg-danger shadow-sm px-2 py-1 fs-6"><i class="fa-solid fa-xmark me-1"></i>HỦY</span>
                <div class="mt-1"><small class="text-danger fw-bold">Do: ${cancelRole || 'Bếp'}</small></div>
            `;
        } else if (statusRaw === 'READY') {
            // 🌟 TRẠNG THÁI: BẾP XONG CHỜ GIAO
            statusBadge = `
                <span class="badge shadow-sm px-2 py-1 fs-6 fw-bold text-white" style="background: linear-gradient(135deg, #198754, #20c997) !important;">
                    <i class="fa-solid fa-bell-concierge me-1"></i>Bếp xong chờ giao
                </span>
                ${isEdited ? `<div class="mt-1"><span class="badge bg-warning text-dark border border-dark fw-bold"><i class="fa-solid fa-pen-to-square me-1"></i>Đã sửa</span></div>` : ''}
            `;
        } else if (statusRaw === 'COMPLETED' || statusRaw === 'DONE' || statusRaw === 'FINISHED') {
            statusBadge = `
                <span class="badge bg-success shadow-sm px-2 py-1 fs-6"><i class="fa-solid fa-check-double me-1"></i>ĐÃ GIAO XONG</span>
                ${isEdited ? `<div class="mt-1"><span class="badge bg-warning text-dark border border-dark fw-bold"><i class="fa-solid fa-pen-to-square me-1"></i>Đã sửa</span></div>` : ''}
            `;
        } else if (isEdited) {
            // 🌟 ÉP MÀU NỀN VÀNG RỰC RỠ TRỰC TIẾP VÀO CÁC CỘT TD
            tdBgStyle = 'style="background-color: #fff3cd !important; color: #664d03 !important;"'; 
            statusBadge = `
                <span class="badge bg-primary shadow-sm px-2 py-1 fs-6"><i class="fa-solid fa-fire-burner me-1"></i>ĐANG LÀM</span>
                <div class="mt-1"><span class="badge bg-warning text-dark border border-dark fw-bold"><i class="fa-solid fa-pen-to-square me-1"></i>Đã sửa</span></div>
            `;
        } else {
            statusBadge = `<span class="badge bg-primary shadow-sm px-2 py-1 fs-6"><i class="fa-solid fa-fire-burner me-1"></i>ĐANG LÀM</span>`;
        }

        let noteDisplay = isCanceled ? `<small class="text-danger fw-bold fst-italic"><i class="fa-solid fa-triangle-exclamation me-1"></i>${cancelReason}</small>` : `<small class="text-muted">${cancelReason}</small>`;

        // 🟣 NÚT LỊCH SỬ TÍM SÁNG - BẬT CLICK KHI CÓ CỜ IS_EDITED
        let historyBtn = isEdited ? `
            <button type="button" class="btn btn-purple fw-bold text-white px-2 shadow-sm" style="background-color: #6f42c1 !important;" title="Xem Lịch Sử Chỉnh Sửa" onclick="window.viewOrderHistory('${orderCode}')">
                <i class="fa-solid fa-clock-rotate-left"></i> Sử
            </button>
        ` : `
            <button type="button" class="btn btn-outline-secondary fw-bold px-2 opacity-50" title="Đơn này chưa từng qua chỉnh sửa" disabled>
                <i class="fa-solid fa-clock-rotate-left"></i> Sử
            </button>
        `;

        const isPaid = (String(order.Payment_status || '').toUpperCase() === 'PAID');
        const paidBy = order.Paid_by || '';
        const paidAt = order.Paid_at ? `<small class="text-muted d-block" style="font-size: 10px;">${String(order.Paid_at).substring(11, 16)}</small>` : '';

        let paymentCellHtml = '';
        if (isCanceled) {
            paymentCellHtml = `<span class="badge bg-secondary">HỦY (${paymentMethod})</span>`;
        } else if (isPaid) {
            paymentCellHtml = `
                <span class="badge bg-success px-2 py-1 shadow-sm" style="font-size: 11px;">
                    <i class="fa-solid fa-circle-check me-1"></i>ĐÃ THU
                </span>
                <div class="mt-1">
                    <small class="text-success fw-bold d-block" style="font-size: 11px;">
                        <i class="fa-solid fa-user-check me-1"></i>${paidBy || 'Thu Ngân'}
                    </small>
                    <small class="text-muted" style="font-size: 10px;">${paymentMethod} ${paidAt}</small>
                </div>
            `;
        } else {
            const isTransfer = (paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'QR' || paymentMethod === 'CHUYEN_KHOAN');
            const isMomo = (paymentMethod === 'MOMO');
            const btnColor = isMomo ? 'btn-danger text-white' : (isTransfer ? 'btn-warning text-dark' : 'btn-outline-warning text-dark');
            const btnIcon = isMomo ? 'fa-mobile-screen' : (isTransfer ? 'fa-qrcode' : 'fa-credit-card');
            const btnText = isMomo ? 'Xác nhận MoMo' : (isTransfer ? 'Xác nhận QR' : 'Thu tiền bàn');

            paymentCellHtml = `
                <button type="button" class="btn btn-sm ${btnColor} fw-bold px-2 py-1 rounded-pill shadow-sm" 
                        style="font-size: 11px; white-space: nowrap; ${isMomo ? 'background-color: #ae2070 !important; border-color: #ae2070 !important;' : ''}" 
                        onclick="window.openQuickPaymentModal('${orderCode}')" 
                        title="Bấm để xác nhận thu tiền cho bàn này">
                    <i class="fa-solid ${btnIcon} me-1"></i>${btnText}
                </button>
                <div class="mt-1"><span class="badge bg-warning-subtle text-dark border border-warning" style="font-size: 10px;">Chờ ${paymentMethod}</span></div>
            `;
        }

        let memberBadge = '';
        if (order.Member_tier || order.Member_id || order.Member_phone) {
            let tierName = '🌱 Mầm Sen';
            let tierBg = 'bg-success';
            if (order.Member_tier === 'BUP_SEN') { tierName = '🪷 Búp Sen'; tierBg = 'bg-primary'; }
            else if (order.Member_tier === 'SEN_HONG') { tierName = '🌸 Sen Hồng'; tierBg = 'bg-danger'; }
            else if (order.Member_tier === 'SEN_KIM_CUONG') { tierName = '💎 Kim Cương'; tierBg = 'bg-dark'; }

            memberBadge = `<div class="mt-1 d-flex flex-wrap gap-1 align-items-center">
                <span class="badge ${tierBg} text-white" style="font-size: 10px;">${tierName}</span>`;
            if (Number(order.Discount_percent) > 0) {
                memberBadge += `<span class="badge bg-warning text-dark" style="font-size: 9.5px;">-${order.Discount_percent}%</span>`;
            }
            if (Number(order.Points_earned) > 0) {
                memberBadge += `<span class="badge bg-success-subtle text-success border border-success" style="font-size: 9.5px;">+${order.Points_earned}đ</span>`;
            }
            memberBadge += `</div>`;
        }

        let discountSubtext = '';
        if (Number(order.Discount_amount || 0) > 0 || Number(order.Points_amount || 0) > 0 || Number(order.Prepaid_used || 0) > 0) {
            discountSubtext = `<div class="text-muted fw-normal" style="font-size: 10px;">`;
            if (order.Discount_amount) discountSubtext += `Giảm: -${Number(order.Discount_amount).toLocaleString()}đ<br>`;
            if (order.Points_amount) discountSubtext += `Điểm: -${Number(order.Points_amount).toLocaleString()}đ<br>`;
            if (order.Prepaid_used) discountSubtext += `Ví: -${Number(order.Prepaid_used).toLocaleString()}đ`;
            discountSubtext += `</div>`;
        }

        return `
            <tr>
                <td ${tdBgStyle} class="fw-bold small ${isCanceled ? 'text-danger' : ''}">
                    #${orderCode}
                    ${isEdited ? '<span class="badge bg-warning text-dark d-block mt-1 border border-dark" style="font-size: 10px;">ĐÃ SỬA</span>' : ''}
                </td>
                <td ${tdBgStyle}>
                    ${order.Delivery_platform ? `
                        <span class="badge bg-primary text-white shadow-sm" style="font-size: 11px;">
                            <i class="fa-solid fa-motorcycle me-1"></i>${order.Delivery_platform}
                        </span>
                        <br><small class="text-primary fw-bold" style="font-size: 10px;">${order.Payment_type === 'COD' ? '💵 COD' : '📱 CK QR'}</small>
                        ${order.Customer_phone ? `<br><small class="text-muted" style="font-size: 10px;"><i class="fa-solid fa-phone me-1"></i>${order.Customer_phone}</small>` : ''}
                    ` : `
                        <span class="badge ${isCanceled ? 'bg-danger-subtle text-danger border border-danger' : 'bg-light text-dark border'}">${order.Order_type || 'DINE_IN'}</span>
                        <br><small class="${isCanceled ? 'text-danger' : 'text-muted'}">Bàn: ${tableNumber}</small>
                    `}
                </td>
                <td ${tdBgStyle} class="${isCanceled ? 'text-danger fw-semibold' : ''}">
                    ${customerName}
                    ${memberBadge}
                    ${order.Delivery_address ? `<br><small class="text-muted d-inline-block text-truncate" style="max-width: 150px; font-size: 10px;" title="${order.Delivery_address}"><i class="fa-solid fa-location-dot me-1 text-danger"></i>${order.Delivery_address}</small>` : ''}
                </td>
                <!-- CỘT: NHÂN VIÊN ĐÃ XỬ LÝ ĐƠN HÀNG -->
                <td ${tdBgStyle}>
                    ${order.Staff_name || order.Created_by ? `
                        <div class="fw-bold text-dark d-flex align-items-center gap-1" style="font-size: 12.5px;">
                            <i class="fa-solid fa-user-tie text-success"></i> <span>Phục vụ: ${order.Staff_name || order.Created_by}</span>
                        </div>
                    ` : ''}
                    ${order.Cooked_by ? `
                        <small class="text-warning-emphasis fw-bold d-block mt-1" style="font-size: 11px;">
                            <i class="fa-solid fa-fire-burner text-warning me-1"></i>Bếp: <b>${order.Cooked_by}</b>
                        </small>
                    ` : ''}
                    ${paidBy && paidBy !== (order.Staff_name || order.Created_by) ? `
                        <small class="text-primary fw-semibold d-block mt-1" style="font-size: 10.5px;" title="Người thu tiền">
                            <i class="fa-solid fa-hand-holding-dollar me-1"></i>Thu: ${paidBy}
                        </small>
                    ` : ''}
                    ${!order.Staff_name && !order.Created_by && !order.Cooked_by && !paidBy ? `
                        <span class="badge bg-light text-muted border">Chưa gán NV</span>
                    ` : ''}
                </td>
                <td ${tdBgStyle} class="small ${isCanceled ? 'text-danger' : ''}">${itemsSummary}</td>
                <td ${tdBgStyle} class="text-center align-middle">${paymentCellHtml}</td>
                <td ${tdBgStyle} class="text-center align-middle">${statusBadge}</td>
                <td ${tdBgStyle} class="small">${noteDisplay}</td>
                <td ${tdBgStyle} class="text-end ${totalStyle}">
                    <div>${totalFormatted} VNĐ</div>
                    ${discountSubtext}
                </td>
                <td ${tdBgStyle} class="text-center small ${isCanceled ? 'text-danger' : 'text-muted'}">${createdAt}</td>
                <td ${tdBgStyle} class="text-center">
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-dark fw-bold px-2" title="In Bill" onclick="window.printOrderBill('${orderCode}')"><i class="fa-solid fa-print"></i> Bill</button>
                        ${!isPaid && !isCanceled ? `
                            <button type="button" class="btn btn-warning text-dark fw-bold px-2" title="Thu tiền cho bàn này" onclick="window.openQuickPaymentModal('${orderCode}')">
                                <i class="fa-solid fa-coins"></i> Thu tiền
                            </button>
                        ` : ''}
                        ${canEdit ? `<button type="button" class="btn btn-primary fw-bold px-2" title="Sửa Đơn" onclick="window.editOrder('${orderCode}')"><i class="fa-solid fa-pen"></i> Sửa</button>` : ''}
                        ${historyBtn}
                        <button type="button" class="btn btn-success fw-bold px-2" title="Hoàn Thành" onclick="window.markOrderCompleted('${orderCode}')"><i class="fa-solid fa-check"></i> Xong</button>
                        ${(() => {
                            if (!canCancel) return '';
                            const isKitchenAccepted = ['COOKING', 'ACCEPTED', 'READY'].includes(statusRaw);
                            if (isKitchenAccepted && !isAdmin) {
                                return `<button type="button" class="btn btn-outline-secondary fw-bold px-2 opacity-50" title="Bếp đã nhận đơn / đang nấu. Chỉ Quản lý mới có quyền hủy đơn!" disabled><i class="fa-solid fa-lock me-1"></i> Đang nấu</button>`;
                            }
                            return `<button type="button" class="btn btn-warning fw-bold px-2" title="Hủy Đơn" onclick="window.openCancelModal('${orderCode}')"><i class="fa-solid fa-ban"></i> Hủy</button>`;
                        })()}
                        ${canDelete ? `<button type="button" class="btn btn-danger fw-bold px-2" title="Xóa Đơn" onclick="window.deleteOrderPermanently('${orderCode}')"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

// 5. XEM LỊCH SỬ SỬA ĐƠN HÀNG
window.viewOrderHistory = async function(orderCode) {
    // 🚨 THÊM DÒNG NÀY ĐỂ BẮT LOG KHI BẤM NÚT SỬ
    console.log('👉 ĐÃ CLICK NÚT SỬ CHO MÃ ĐƠN:', orderCode);

    if (!orderCode) return;

    const cleanCode = String(orderCode).replace('#', '').trim();
    const modalTitle = document.getElementById('historyOrderCodeTitle');
    const tbody = document.getElementById('orderHistoryTableBody');

    if (modalTitle) modalTitle.innerText = '#' + cleanCode;
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted"><i class="fa-solid fa-spinner fa-spin me-2"></i>Đang tải dữ liệu...</td></tr>`;

    // Mở Modal
    const modalEl = document.getElementById('orderHistoryModal');
    if (modalEl) {
        if (typeof bootstrap !== 'undefined') {
            const modalObj = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            modalObj.show();
        } else {
            // Dự phòng nếu không có Bootstrap JS
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
        }
    } else {
        if (window.toast) window.toast.warning('Thiếu thẻ HTML Modal có id="orderHistoryModal" trong file HTML/View!');
        else alert('❌ Thiếu thẻ HTML Modal có id="orderHistoryModal" trong file HTML/View!');
        return;
    }

    try {
        const res = await fetch(`/api/orders/${encodeURIComponent(cleanCode)}/history`);
        const logsData = await res.json();
        const logs = Array.isArray(logsData) ? logsData : [];

        if (logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">Chưa tìm thấy nhật ký ghi nhận chỉnh sửa cho đơn này.</td></tr>`;
            return;
        }

        if (tbody) {
            tbody.innerHTML = logs.map(log => `
                <tr>
                    <td class="text-center fw-bold text-secondary align-middle" style="font-size: 11px;">${log.Modified_at || ''}</td>
                    <td class="fw-bold text-primary text-center align-middle" style="font-size: 12px;">${log.Modified_by || 'Quản Lý'}</td>
                    <td class="align-middle p-1">${window.formatLogContentAsTable(log.Old_content)}</td>
                    <td class="align-middle p-1">${window.formatLogContentAsTable(log.New_content)}</td>
                </tr>
            `).join('');
        }

    } catch (err) {
        console.error('Lỗi tải lịch sử:', err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">Không thể tải nhật ký lịch sử.</td></tr>`;
    }
    // Hàm đóng Modal Lịch Sử (cho cả nút [X] và nút [Đóng])

};
window.closeOrderHistoryModal = function() {
    const modalEl = document.getElementById('orderHistoryModal');
    if (!modalEl) return;

    if (typeof bootstrap !== 'undefined') {
        const modalObj = bootstrap.Modal.getInstance(modalEl);
        if (modalObj) modalObj.hide();
    }
    
    // Dự phòng ẩn modal trực tiếp bằng CSS
    modalEl.classList.remove('show');
    modalEl.style.display = 'none';
    
    // Xóa lớp phủ đen mờ nếu có
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) backdrop.remove();
    document.body.classList.remove('modal-open');
};

// 6. TỰ ĐỘNG LẤY TÊN BỘ PHẬN ĐANG ĐĂNG NHẬP
window.getCurrentUserRole = function() {
    const currentUser = JSON.parse(localStorage.getItem('hoasen_user') || localStorage.getItem('user') || '{}');
    if (currentUser.role) {
        const roleLower = String(currentUser.role).toLowerCase();
        if (roleLower.includes('kitchen') || roleLower.includes('bep')) return 'Bếp';
        if (roleLower.includes('cashier') || roleLower.includes('thungan')) return 'Thu ngân';
        if (roleLower.includes('waiter') || roleLower.includes('boiban')) return 'Bồi bàn';
        if (roleLower.includes('admin') || roleLower.includes('quanly')) return 'Quản Lý';
    }

    const headerUserText = document.querySelector('.navbar, header')?.innerText || '';
    if (headerUserText.includes('Bếp')) return 'Bếp';
    if (headerUserText.includes('Thu Ngân') || headerUserText.includes('Thu ngân')) return 'Thu ngân';
    if (headerUserText.includes('Bồi bàn')) return 'Bồi bàn';
    if (headerUserText.includes('Quản Lý') || headerUserText.includes('Quản lý')) return 'Quản Lý';

    return 'Bếp';
};

// 7. HỦY ĐƠN VÀ LƯU VÀO CSDL
window.openCancelModal = function(orderIdentifier) {
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const roleUpper = String(currentUser.Role || '').toUpperCase();
    const isAdmin = roleUpper === 'ADMIN' || roleUpper === 'QUẢN LÝ' || roleUpper === 'MANAGER';
    const isCashier = roleUpper === 'CASHIER' || roleUpper === 'THU NGÂN' || roleUpper === 'THUNGAN';
    const canCancel = isAdmin || isCashier || ((typeof window.hasPermission === 'function') && window.hasPermission(currentUser, 'ORDERS_CANCEL'));
    if (!canCancel) {
        if (window.toast) window.toast.warning('Tài khoản của bạn chưa được cấp quyền Hủy đơn hàng!');
        return;
    }

    const order = window.allOrdersData.find(o => 
        String(o.Order_id) === String(orderIdentifier) || 
        String(o.Order_code) === String(orderIdentifier) ||
        String(o.id) === String(orderIdentifier)
    );

    if (order) {
        const statusUpper = String(order.Status || order.status || '').toUpperCase();
        const isKitchenAccepted = ['COOKING', 'ACCEPTED', 'READY'].includes(statusUpper);
        if (isKitchenAccepted && !isAdmin) {
            if (window.toast) window.toast.warning('Bếp đã nhận đơn / đang nấu món này. Chỉ Quản lý mới có quyền hủy đơn!');
            else alert('Bếp đã nhận đơn / đang nấu món này. Chỉ Quản lý mới có quyền hủy đơn!');
            return;
        }
    }

    const displayCode = order ? (order.Order_code || order.Order_id) : orderIdentifier;
    const currentRole = window.getCurrentUserRole();

    const modalIdInput = document.getElementById('modalCancelOrderId');
    if (modalIdInput) modalIdInput.value = displayCode;

    const modalRoleInput = document.getElementById('modalCancelRoleDisplay');
    if (modalRoleInput) modalRoleInput.value = currentRole;

    const reasonSelect = document.getElementById('modalCancelReasonSelect');
    const noteInput = document.getElementById('modalCancelNoteInput');
    if (reasonSelect) {
        reasonSelect.selectedIndex = 0;
        if (noteInput) noteInput.value = reasonSelect.value;
    }

    const modalEl = document.getElementById('cancelOrderModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    } else {
        const defaultNote = prompt(`Xác nhận hủy đơn ${displayCode} (Bộ phận: ${currentRole}). Nhập lý do hủy:`, 'Hết nguyên liệu món này');
        if (defaultNote !== null) {
            window.saveCancelReason(displayCode, currentRole, defaultNote);
        }
    }
};

window.onCancelReasonSelectChange = function(selectEl) {
    const noteInput = document.getElementById('modalCancelNoteInput');
    if (!noteInput) return;

    if (selectEl.value === 'Lý do khác...') {
        noteInput.value = '';
        noteInput.focus();
    } else {
        noteInput.value = selectEl.value;
    }
};

window.confirmCancelOrderWithReason = function() {
    const orderCode = document.getElementById('modalCancelOrderId')?.value;
    const cancelRole = document.getElementById('modalCancelRoleDisplay')?.value || window.getCurrentUserRole();
    const cancelNote = document.getElementById('modalCancelNoteInput')?.value.trim() || 'Hủy đơn hàng';

    if (!orderCode) return;

    window.saveCancelReason(orderCode, cancelRole, cancelNote);

    const modalEl = document.getElementById('cancelOrderModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
};

window.saveCancelReason = async function(orderCode, cancelRole, cancelNote) {
    const target = window.allOrdersData.find(o => 
        String(o.Order_id) === String(orderCode) || 
        String(o.Order_code) === String(orderCode) ||
        String(o.id) === String(orderCode)
    );

    if (target) {
        target.Status = 'CANCELED';
        target.status = 'CANCELED';
        target.Cancel_role = cancelRole;
        target.Cancel_reason = cancelNote;
    }

    window.applyOrderFilters();

    try {
        const cleanId = encodeURIComponent(orderCode);
        await fetch(`/api/orders/${cleanId}/cancel`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cancelRole: cancelRole, cancelNote: cancelNote })
        });
    } catch (err) {
        console.error('Lỗi kết nối Server khi hủy đơn:', err);
    }
};

// 8. ĐÁNH DẤU HOÀN THÀNH ĐƠN (NÚT XONG)
window.markOrderCompleted = async function(orderId) {
    const target = window.allOrdersData.find(o => 
        String(o.Order_id) === String(orderId) || 
        String(o.Order_code) === String(orderId) ||
        String(o.id) === String(orderId)
    );

    if (target) {
        target.Status = 'COMPLETED';
        target.status = 'COMPLETED';
        target.Cancel_role = null;
        target.Cancel_reason = null;
    }
    
    window.applyOrderFilters();

    try {
        const cleanId = encodeURIComponent(orderId);
        await fetch(`/api/orders/${cleanId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'COMPLETED' })
        });
    } catch (err) {
        console.error('Lỗi kết nối API status:', err);
    }
};

// 9. XÓA VĨNH VIỄN ĐƠN HÀNG
window.deleteOrderPermanently = async function(orderIdentifier) {
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const roleUpper = String(currentUser.Role || '').toUpperCase();
    const isAdmin = roleUpper === 'ADMIN' || roleUpper === 'QUẢN LÝ' || roleUpper === 'MANAGER';
    const canDelete = isAdmin || ((typeof window.hasPermission === 'function') && window.hasPermission(currentUser, 'ORDERS_DELETE'));
    if (!canDelete) {
        if (window.toast) window.toast.warning('Tài khoản của bạn chưa được cấp quyền Xóa đơn hàng!');
        return;
    }

    const order = window.allOrdersData.find(o => 
        String(o.Order_id) === String(orderIdentifier) || 
        String(o.Order_code) === String(orderIdentifier) ||
        String(o.id) === String(orderIdentifier)
    );

    const displayCode = order ? (order.Order_code || order.Order_id) : orderIdentifier;

    if (!window.toast.confirm(`⚠️ Bạn có chắc chắn muốn XÓA VĨNH VIỄN Đơn hàng ${displayCode} không?`)) return;

    window.allOrdersData = window.allOrdersData.filter(o => 
        String(o.Order_id) !== String(orderIdentifier) && 
        String(o.Order_code) !== String(orderIdentifier) &&
        String(o.id) !== String(orderIdentifier)
    );

    window.applyOrderFilters();

    try {
        const cleanId = encodeURIComponent(displayCode);
        await fetch(`/api/orders/${cleanId}`, { method: 'DELETE' });
    } catch (e) {
        console.error('Lỗi kết nối khi xóa đơn:', e);
    }
};

// 10. SỬA ĐƠN HÀNG (NẠP ĐẦY ĐỦ THÔNG TIN VÀO GIỎ HÀNG)
window.editOrder = function(orderCode) {
    if (!orderCode) return;

    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const roleUpper = String(currentUser.Role || '').toUpperCase();
    const isAdmin = roleUpper === 'ADMIN' || roleUpper === 'QUẢN LÝ' || roleUpper === 'MANAGER';
    const isCashier = roleUpper === 'CASHIER' || roleUpper === 'THU NGÂN' || roleUpper === 'THUNGAN';
    const canEdit = isAdmin || isCashier || ((typeof window.hasPermission === 'function') && window.hasPermission(currentUser, 'ORDERS_EDIT'));
    if (!canEdit) {
        if (window.toast) window.toast.warning('Tài khoản của bạn chưa được cấp quyền Sửa đơn hàng!');
        return;
    }

    // Chuẩn hóa mã đơn (xóa sạch khoảng trắng và dấu #)
    const cleanCode = String(orderCode).replace('#', '').trim();
    localStorage.setItem('hoasen_edit_order_id', cleanCode);
    localStorage.setItem('editing_order_id', cleanCode);

    // Lấy thông tin đơn hàng
    const order = (window.allOrdersData || []).find(o => 
        String(o.Order_code || '').trim() === cleanCode || 
        String(o.Order_id || '').trim() === cleanCode ||
        String(o.Order_code || '').trim() === ('CHAY-' + cleanCode) ||
        String(o.Order_code || '').replace('#', '').trim() === cleanCode
    );

    if (order) {
        sessionStorage.setItem('hoasen_edit_order_data', JSON.stringify(order));
        localStorage.setItem('hoasen_edit_order_data', JSON.stringify(order));

        if (Array.isArray(order.items) && order.items.length > 0) {
            const cartItems = order.items.map(i => ({
                id: i.Item_id || i.Detail_id || i.id,
                name: i.Item_name || i.name,
                price: Number(i.Unit_price || i.price || 35000),
                quantity: Number(i.Quantity || i.quantity || 1),
                note: i.Note || i.note || '',
                toppings: Array.isArray(i.toppings) ? i.toppings : (i.Toppings ? [{ name: i.Toppings, price: 0 }] : [])
            }));
            localStorage.setItem('hoasen_cart', JSON.stringify(cartItems));
            localStorage.setItem('restaurant_cart', JSON.stringify(cartItems));
        }

        // Thiết lập bối cảnh đơn hàng: Đơn Giao / Mang về vs Tại Bàn
        if (order.Delivery_platform || order.Order_type === 'DELIVERY' || order.Delivery_address) {
            const deliveryInfo = {
                platformName: order.Delivery_platform || 'Đơn Giao',
                customerName: order.Customer_name || 'Khách Giao Hàng',
                customerPhone: order.Customer_phone || '',
                deliveryAddress: order.Delivery_address || '',
                note: order.Note || '',
                paymentType: order.Payment_type || (order.Payment_method === 'CASH' ? 'COD' : 'TRANSFER')
            };
            sessionStorage.setItem('hoasen_delivery_info', JSON.stringify(deliveryInfo));
            sessionStorage.removeItem('hoasen_selected_table');
        } else {
            sessionStorage.setItem('hoasen_selected_table', order.Table_number || order.Table_name || 'Bàn 01');
            sessionStorage.removeItem('hoasen_delivery_info');
        }

        // Khôi phục hội viên nếu có
        if (order.Member_id || order.Member_phone) {
            const appliedMember = {
                Member_id: order.Member_id,
                Phone: order.Member_phone,
                Full_name: order.Member_name || order.Customer_name,
                Current_tier: order.Member_tier || 'MAM_SEN'
            };
            sessionStorage.setItem('hoasen_applied_member', JSON.stringify(appliedMember));
        }
    }

    console.log('📝 Đã bật chế độ sửa cho đơn:', cleanCode);

    // Chuyển sang trang Giỏ Hàng
    if (typeof window.navigateTo === 'function') {
        window.navigateTo('/cart');
    } else {
        window.location.href = '/cart';
    }
};

// 11. THỐNG KÊ & BIỂU ĐỒ CHART.JS
window.renderOrderStatistics = function() {
    const timeRange = document.getElementById('statFilterTimeRange')?.value || 'ALL';
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const filteredOrders = window.allOrdersData.filter(order => {
        if (timeRange === 'ALL') return true;

        const orderDateStr = order.Created_at || order.createdAt || todayStr;
        const orderDate = new Date(orderDateStr);

        if (timeRange === 'TODAY') {
            return orderDate.toDateString() === now.toDateString() || orderDateStr.includes(todayStr);
        } else if (timeRange === 'WEEK') {
            const diffDays = (now - orderDate) / (1000 * 3600 * 24);
            return diffDays <= 7;
        } else if (timeRange === 'MONTH') {
            return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
        } else if (timeRange === 'YEAR') {
            return orderDate.getFullYear() === now.getFullYear();
        }
        return true;
    });

    const rangeLabelMap = {
        'TODAY': 'Thống kê: Hôm nay',
        'WEEK': 'Thống kê: Tuần này',
        'MONTH': 'Thống kê: Tháng này',
        'YEAR': 'Thống kê: Năm nay',
        'ALL': 'Thống kê: Tất cả thời gian'
    };
    if (document.getElementById('statRangeLabel')) {
        document.getElementById('statRangeLabel').innerText = rangeLabelMap[timeRange] || 'Thống kê';
    }

    let totalRevenueFiltered = 0;
    let totalOrders = filteredOrders.length;
    let canceledCount = 0;
    let dineInCount = 0;
    let takeAwayCount = 0;

    const cancelReasonsMap = { 'Bếp': 0, 'Khách hàng': 0, 'Thu ngân': 0, 'Bồi bàn': 0 };
    const staffMap = {};

    filteredOrders.forEach(o => {
        const statusRaw = String(o.Status || o.status || '').toUpperCase();
        const cancelRole = o.Cancel_role || o.cancelRole || '';
        const cancelReason = String(o.Cancel_reason || o.Note || '').toLowerCase();

        const isCanceled = (
            statusRaw === 'CANCELED' || 
            statusRaw === 'CANCELLED' || 
            Boolean(cancelRole) || 
            cancelReason.includes('lý do:') || 
            cancelReason.includes('hủy')
        );

        if (isCanceled) {
            canceledCount++;
            let role = cancelRole || 'Bếp';
            if (!cancelRole && cancelReason.includes('khách')) role = 'Khách hàng';
            if (!cancelRole && cancelReason.includes('thu ngân')) role = 'Thu ngân';
            if (!cancelRole && cancelReason.includes('bồi')) role = 'Bồi bàn';
            cancelReasonsMap[role] = (cancelReasonsMap[role] || 0) + 1;
        } else {
            let calcTotal = 0;
            if (Array.isArray(o.items) && o.items.length > 0) {
                calcTotal = o.items.reduce((s, i) => s + (Number(i.Total_price) || (Number(i.Unit_price || i.price || 0) * Number(i.Quantity || i.quantity || 1))), 0);
            } else {
                calcTotal = Number(o.Final_amount || o.Total_amount || 0);
            }
            totalRevenueFiltered += calcTotal;
        }

        const type = o.Order_type || o.orderType || 'DINE_IN';
        if (type === 'DINE_IN') dineInCount++;
        else takeAwayCount++;

        const staff = o.Staff_name || o.Created_by || 'Thu ngân Vũ';
        staffMap[staff] = (staffMap[staff] || 0) + 1;
    });

    if (document.getElementById('statTotalRevenue')) {
        document.getElementById('statTotalRevenue').innerText = new Intl.NumberFormat('vi-VN').format(totalRevenueFiltered) + ' đ';
    }
    if (document.getElementById('statTotalOrders')) {
        document.getElementById('statTotalOrders').innerText = totalOrders;
    }
    if (document.getElementById('statCanceledOrders')) {
        document.getElementById('statCanceledOrders').innerText = canceledCount;
    }
    if (document.getElementById('statDineVsTakeaway')) {
        document.getElementById('statDineVsTakeaway').innerText = `${dineInCount} / ${takeAwayCount}`;
    }

    let revenueToday = 0;
    let revenueWeek = 0;
    let revenueMonth = 0;

    window.allOrdersData.forEach(o => {
        const statusRaw = String(o.Status || o.status || '').toUpperCase();
        const cancelRole = o.Cancel_role || o.cancelRole || '';
        const cancelReason = String(o.Cancel_reason || o.Note || '').toLowerCase();

        const isCanceled = (statusRaw === 'CANCELED' || statusRaw === 'CANCELLED' || Boolean(cancelRole) || cancelReason.includes('lý do:') || cancelReason.includes('hủy'));
        if (isCanceled) return;

        const orderDateStr = o.Created_at || o.createdAt || todayStr;
        const orderDate = new Date(orderDateStr);

        let orderMoney = 0;
        if (Array.isArray(o.items) && o.items.length > 0) {
            orderMoney = o.items.reduce((s, i) => s + (Number(i.Total_price) || (Number(i.Unit_price || i.price || 0) * Number(i.Quantity || i.quantity || 1))), 0);
        } else {
            orderMoney = Number(o.Final_amount || o.Total_amount || 0);
        }

        if (orderDate.toDateString() === now.toDateString() || orderDateStr.includes(todayStr)) {
            revenueToday += orderMoney;
        }

        const diffDays = (now - orderDate) / (1000 * 3600 * 24);
        if (diffDays <= 7) {
            revenueWeek += orderMoney;
        }

        if (orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear()) {
            revenueMonth += orderMoney;
        }
    });

    window.createChart('chartRevenueTimeline', 'bar', ['Hôm nay', 'Tuần này', 'Tháng này'], [revenueToday, revenueWeek, revenueMonth], 'Doanh thu (VNĐ)', '#2e7d32');
    window.createChart('chartOrderTypeRatio', 'doughnut', ['Ăn tại quán', 'Mang về'], [dineInCount, takeAwayCount], 'Tỷ lệ', ['#2e7d32', '#f57c00']);
    window.createChart('chartCancelReasons', 'bar', Object.keys(cancelReasonsMap), Object.values(cancelReasonsMap), 'Số đơn hủy', '#d32f2f');
    window.createChart('chartStaffPerformance', 'pie', Object.keys(staffMap), Object.values(staffMap), 'Đơn xử lý', ['#1976d2', '#388e3c', '#fbc02d', '#7b1fa2']);
};

window.createChart = function(canvasId, type, labels, data, labelName, bgColors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (window.chartInstances[canvasId]) {
        window.chartInstances[canvasId].destroy();
    }

    if (typeof Chart === 'undefined') return;

    window.chartInstances[canvasId] = new Chart(canvas, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: labelName,
                data: data,
                backgroundColor: bgColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: type !== 'bar' } }
        }
    });
};

// 12. IN BILL CHUYÊN NGHIỆP THEO CẤU HÌNH HỆ THỐNG
window.printOrderBill = async function(orderId) {
    let sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
    if (!sysConfig.resName || !sysConfig.qrAccountNo) {
        try {
            const cfgRes = await fetch('/api/system-config');
            if (cfgRes.ok) {
                const cfgData = await cfgRes.json();
                sysConfig = { ...cfgData, ...sysConfig };
            }
        } catch(e) {}
    }

    const resName = sysConfig.resName || 'NHÀ HÀNG CHAY HOA SEN';
    const resAddr = sysConfig.resAddr || '36 Phạm Văn Sáng, Hóc Môn, TP.HCM';
    const resPhone = sysConfig.resPhone || '0901 234 567';
    const resWifi = sysConfig.resWifi || 'Wifi: ChayHoaSen / Pass: 88888888';
    const billFooter = sysConfig.billFooter || 'Kính chúc Quý Khách An Lạc & An Nhiên!\nXin cảm ơn & Hẹn gặp lại Quý Khách!';
    const paperSize = sysConfig.paperSize || '80mm';
    const paperWidth = (paperSize === '58mm') ? '58mm' : '80mm';

    const cleanId = String(orderId || '').replace('#', '').trim();
    if (!cleanId) return;

    // 1. Tìm trong bộ nhớ client trước (nếu có)
    let order = null;
    if (Array.isArray(window.allOrdersData)) {
        order = window.allOrdersData.find(o => 
            String(o.Order_id) === cleanId || 
            String(o.Order_code) === cleanId || 
            String(o.Order_code) === ('CHAY-' + cleanId)
        );
    }
    if (!order && Array.isArray(window.ordersCache)) {
        order = window.ordersCache.find(o => 
            String(o.Order_id) === cleanId || 
            String(o.Order_code) === cleanId || 
            String(o.Order_code) === ('CHAY-' + cleanId)
        );
    }

    // 2. Nếu chưa có hoặc chưa có items chi tiết -> BẮT BUỘC FETCH TRỰC TIẾP TỪ SERVER
    let items = Array.isArray(order?.items) ? order.items : (Array.isArray(order?.Items) ? order.Items : []);
    if (!order || items.length === 0) {
        try {
            const res = await fetch(`/api/orders/${encodeURIComponent(cleanId)}`);
            const data = await res.json();
            if (data && data.success && data.order) {
                order = data.order;
                items = Array.isArray(order.items) ? order.items : (Array.isArray(order.Items) ? order.Items : []);
            } else if (data && data.Order_id) {
                order = data;
                items = Array.isArray(order.items) ? order.items : (Array.isArray(order.Items) ? order.Items : []);
            }
        } catch (fetchErr) {
            console.error('Lỗi nạp chi tiết đơn để in bill:', fetchErr);
        }
    }

    // 3. Fallback: Nếu vẫn chưa tìm thấy theo mã đơn, thử tìm trong danh sách tất cả đơn
    if ((!order || items.length === 0) && cleanId) {
        try {
            const resAll = await fetch('/api/orders');
            const allOrders = await resAll.json();
            if (Array.isArray(allOrders)) {
                const found = allOrders.find(o => 
                    String(o.Order_id) === cleanId || 
                    String(o.Order_code) === cleanId || 
                    String(o.Order_code) === ('CHAY-' + cleanId) ||
                    String(o.Table_number || o.Table_name || '').toLowerCase() === cleanId.toLowerCase()
                );
                if (found) {
                    order = found;
                    items = Array.isArray(order.items) ? order.items : (Array.isArray(order.Items) ? order.Items : []);
                }
            }
        } catch (e2) {}
    }

    const orderCode = order?.Order_code || (cleanId.startsWith('CHAY-') ? cleanId : ('CHAY-' + cleanId));
    const tableName = order?.Table_number || order?.Table_name || 'Bàn Khách';
    const staffName = order?.Staff_name || order?.Paid_by || order?.Created_by || 'Thu Ngân';
    const createdDate = order?.Created_at || new Date().toLocaleString('vi-VN');
    let totalAmount = Number(order?.Final_amount || order?.Total_amount || 0);

    // Tính lại tổng tiền nếu totalAmount = 0 mà có items
    if (items.length > 0) {
        const sumItems = items.reduce((sum, it) => {
            const price = Number(it.Unit_price || it.price || 0);
            const qty = Number(it.Quantity || it.quantity || 1);
            return sum + Number(it.Total_price || (price * qty));
        }, 0);
        if (totalAmount <= 0 || (sumItems > 0 && totalAmount < sumItems)) {
            totalAmount = sumItems;
        }
    }

    let itemsRows = '';
    if (items.length > 0) {
        itemsRows = items.map((it, idx) => {
            const name = it.Item_name || it.name || 'Món chay';
            const qty = Number(it.Quantity || it.quantity || 1);
            const price = Number(it.Unit_price || it.price || 0);
            const total = Number(it.Total_price || (qty * price));
            const note = it.Note || it.note || '';
            const toppings = it.Toppings || it.toppings || '';
            const toppingsLine = toppings ? `<div style="font-size: 11px; color: #555; padding-left: 8px;">+ ${toppings}</div>` : '';
            const noteLine = note ? `<div style="font-size: 11px; font-style: italic; color: #333; padding-left: 8px;">- ${note}</div>` : '';

            return `
                <tr>
                    <td style="padding: 4px 0; text-align: left; vertical-align: top;">
                        <div><b>${idx + 1}. ${name}</b></div>
                        ${toppingsLine}
                        ${noteLine}
                    </td>
                    <td style="padding: 4px 0; text-align: center; vertical-align: top; font-weight: bold;">${qty}</td>
                    <td style="padding: 4px 0; text-align: right; vertical-align: top;">${new Intl.NumberFormat('vi-VN').format(total)}</td>
                </tr>
            `;
        }).join('');
    } else {
        itemsRows = `<tr><td colspan="3" style="text-align: center; padding: 6px 0;">Tổng cộng: ${new Intl.NumberFormat('vi-VN').format(totalAmount)} đ</td></tr>`;
    }

    let loyaltyBreakdown = '';
    if (order.Member_tier || order.Discount_amount || order.Points_amount || order.Prepaid_used) {
        let tName = '🌱 Mầm Sen';
        if (order.Member_tier === 'BUP_SEN') tName = '🪷 Búp Sen';
        else if (order.Member_tier === 'SEN_HONG') tName = '🌸 Sen Hồng';
        else if (order.Member_tier === 'SEN_KIM_CUONG') tName = '💎 Sen Kim Cương';

        loyaltyBreakdown = `
            <div style="font-size: 11px; margin-top: 4px; border-top: 1px dotted #888; padding-top: 4px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Hội viên:</span>
                    <span><b>${order.Member_name || customerName}</b> (${tName})</span>
                </div>
                ${Number(order.Discount_amount || 0) > 0 ? `
                <div style="display: flex; justify-content: space-between;">
                    <span>Chiết khấu (-${order.Discount_percent}%):</span>
                    <span>-${new Intl.NumberFormat('vi-VN').format(order.Discount_amount)} đ</span>
                </div>` : ''}
                ${Number(order.Points_amount || 0) > 0 ? `
                <div style="display: flex; justify-content: space-between;">
                    <span>Dùng điểm (${order.Points_used} điểm):</span>
                    <span>-${new Intl.NumberFormat('vi-VN').format(order.Points_amount)} đ</span>
                </div>` : ''}
                ${Number(order.Prepaid_used || 0) > 0 ? `
                <div style="display: flex; justify-content: space-between;">
                    <span>Ví Trả Trước:</span>
                    <span>-${new Intl.NumberFormat('vi-VN').format(order.Prepaid_used)} đ</span>
                </div>` : ''}
            </div>
            ${Number(order.Points_earned || 0) > 0 ? `
            <div style="font-size: 11px; margin-top: 3px; font-style: italic;">
                + Điểm tích lũy đơn này: +${order.Points_earned} điểm
            </div>` : ''}
        `;
    }

    // Cấu hình thuế VAT
    const vatEnabled = (sysConfig.vat_enabled === true || sysConfig.vat_enabled === '1' || sysConfig.vat_enabled === 'true');
    const vatRate = parseFloat(sysConfig.vat_rate || 8) || 8;
    const vatIncluded = (sysConfig.vat_included_in_price === true || sysConfig.vat_included_in_price === '1' || sysConfig.vat_included_in_price === 1 || sysConfig.vat_included_in_price === 'true');

    let vatRowHtml = '';
    let finalPayable = totalAmount;
    if (vatEnabled) {
        if (vatIncluded) {
            const vatAmt = Math.round(totalAmount - (totalAmount / (1 + vatRate / 100)));
            vatRowHtml = `
                <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-top: 2px;">
                    <span>Đã gồm VAT (${vatRate}%):</span>
                    <span>${new Intl.NumberFormat('vi-VN').format(vatAmt)} đ</span>
                </div>
            `;
        } else {
            const vatAmt = Math.round(totalAmount * (vatRate / 100));
            finalPayable = totalAmount + vatAmt;
            vatRowHtml = `
                <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-top: 2px;">
                    <span>Thuế VAT (${vatRate}%):</span>
                    <span>+${new Intl.NumberFormat('vi-VN').format(vatAmt)} đ</span>
                </div>
            `;
        }
    }

    // Xử lý mã QR Code
    let qrHtml = '';
    if (sysConfig.showQrCode !== false) {
        let qrSrc = sysConfig.qrImageUrl;
        if (!qrSrc && sysConfig.qrAccountNo) {
            qrSrc = `https://img.vietqr.io/image/${sysConfig.qrBank || 'MBBANK'}-${sysConfig.qrAccountNo}-compact2.png?accountName=${encodeURIComponent(sysConfig.qrAccountName || 'HOA SEN')}&amount=${finalPayable}&addInfo=${encodeURIComponent('HD ' + orderCode)}`;
        }
        if (!qrSrc) {
            qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=NHAC_HANG_CHAY_HOA_SEN_HD_${orderCode}`;
        }
        qrHtml = `
            <div style="text-align: center; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #000;">
                <img src="${qrSrc}" alt="QR" style="width: 110px; height: 110px; object-fit: contain; margin: 0 auto; display: block;">
                <div style="font-size: 11px; font-weight: bold; margin-top: 4px;">Quét mã thanh toán</div>
            </div>
        `;
    }

    const win = window.open('', '_blank', 'width=450,height=650');
    if (!win) {
        if (window.toast) window.toast.warning('Trình duyệt đang chặn mở cửa sổ in. Vui lòng cho phép popup để in hóa đơn!');
        else alert('Trình duyệt đang chặn mở cửa sổ in. Vui lòng cho phép popup để in hóa đơn!');
        return;
    }
    win.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <title>Hóa Đơn #${orderCode}</title>
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
                    HÓA ĐƠN THANH TOÁN
                </div>
                
                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                    <span>HĐ: #${orderCode}</span>
                    <span><b>${tableName}</b></span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                    <span>Ngày: ${createdDate}</span>
                    <span>NV: ${staffName}</span>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="text-align: left;">Món ăn</th>
                            <th style="text-align: center; width: 35px;">SL</th>
                            <th style="text-align: right; width: 75px;">Tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>

                <div style="border-top: 1px solid #000; padding-top: 6px;">
                    ${loyaltyBreakdown}
                    ${vatRowHtml}
                    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; margin-top: 4px; border-top: 1px dashed #000; padding-top: 4px;">
                        <span>CẦN THANH TOÁN:</span>
                        <span>${new Intl.NumberFormat('vi-VN').format(finalPayable)} đ</span>
                    </div>
                </div>

                <div style="border-top: 1px solid #000; margin-top: 8px; padding-top: 6px; text-align: center; font-size: 12px;">
                    ${billFooter.replace(/\n/g, '<br>')}
                </div>

                ${qrHtml}

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

// 13. DỮ LIỆU DỰ PHÒNG
window.getMockOrdersData = function() {
    return [];
};

// 14. KHỞI TẠO DÙNG CHO ROUTER
window.initOrders = function() {
    window.loadOrders();
};

document.addEventListener('DOMContentLoaded', () => {
    window.initOrders();
});
// 1. THÊM HÀM NÀY VÀO FILE js/orders.js (ĐẶT Ở PHẠM VI TOÀN CỤC HOẶC GẦN HÀM XEM LỊCH SỬ)
window.formatLogContentAsTable = function(rawContent) {
    if (!rawContent) return '<span class="text-muted fst-italic small">Trống</span>';

    let items = [];
    try {
        items = JSON.parse(rawContent);
    } catch (e) {
        return `<div class="p-2 text-secondary bg-light rounded" style="font-size: 11px;">${rawContent}</div>`;
    }

    if (!Array.isArray(items) || items.length === 0) {
        return '<span class="text-muted fst-italic small">Không có món</span>';
    }

    let grandTotal = 0;
    let rows = items.map((item, index) => {
        const qty = Number(item.Quantity || item.quantity || 1);
        const price = Number(item.Unit_price || item.price || 35000);
        const total = Number(item.Total_price || (qty * price));
        grandTotal += total;

        return `
            <tr>
                <td class="text-center text-muted py-1" style="font-size: 10.5px;">${index + 1}</td>
                <td class="py-1 fw-medium text-dark text-start" style="font-size: 11px; line-height: 1.2;">${item.Item_name || item.name || 'Món'}</td>
                <td class="text-center py-1 fw-bold text-primary" style="font-size: 11px;">${qty}</td>
                <td class="text-end py-1 text-secondary" style="font-size: 10.5px;">${new Intl.NumberFormat('vi-VN').format(price)}</td>
                <td class="text-end py-1 fw-semibold text-dark" style="font-size: 11px;">${new Intl.NumberFormat('vi-VN').format(total)}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="table-responsive border rounded bg-white shadow-sm my-1">
    <table class="table table-sm table-bordered table-striped mb-0 align-middle">
        <thead class="table-light text-center text-uppercase text-secondary" style="font-size: 9px;">
            <tr>
                <th style="width: 25px;" class="py-1">#</th>
                <th class="py-1 text-start">Tên món</th>
                <th style="width: 28px;" class="py-1">SL</th>
                <th style="width: 65px;" class="py-1">Đơn giá</th>
                <th style="width: 75px;" class="py-1">Thành tiền</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
        <tfoot class="table-light border-top">
            <tr>
                <td colspan="4" class="text-end fw-bold py-1 text-secondary" style="font-size: 10px;">Tổng cộng:</td>
                <td class="text-end fw-bold text-danger py-1" style="font-size: 10.5px;">${new Intl.NumberFormat('vi-VN').format(grandTotal)}đ</td>
            </tr>
        </tfoot>
    </table>
</div>
    `;
};

// ==========================================
// 15. XÁC NHẬN THU TIỀN VÀ GHI NHẬN NGƯỜI THU (AUDIT TRAIL & KPI)
// ==========================================
window.confirmOrderPayment = async function(orderCode, amount) {
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('hoasen_user') || localStorage.getItem('restaurant_user') || '{}');
    const staffUser = currentUser.User_name || 'Thu Ngân';
    const staffName = currentUser.Full_name || staffUser;

    const formattedAmount = Number(amount || 0).toLocaleString('vi-VN');
    const confirmed = (window.toast && typeof window.toast.confirm === 'function')
        ? await window.toast.confirm(`Xác nhận đã thu ${formattedAmount} đ từ đơn #${orderCode}?\nNhân viên thu tiền: ${staffName} (@${staffUser})`, 'Xác nhận thu tiền')
        : confirm(`Xác nhận đã thu ${formattedAmount} đ từ đơn #${orderCode}?\nNhân viên thu tiền: ${staffName} (@${staffUser})`);

    if (!confirmed) return;

    try {
        const cleanCode = encodeURIComponent(orderCode);
        const res = await fetch(`/api/orders/${cleanCode}/confirm-payment`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Paid_by: staffUser,
                Staff_name: staffName,
                Staff_role: currentUser.Role || 'CASHIER'
            })
        });

        if (res.ok) {
            if (window.toast) {
                window.toast.success(`Đã ghi nhận thu tiền đơn #${orderCode} bởi @${staffUser}!`);
            }
            window.loadOrders();
        }
    } catch (err) {
        console.error('Lỗi confirmOrderPayment:', err);
    }
};

// ==========================================
// 16. NẠP VÀ HIỂN THỊ DỮ LIỆU NHẬT KÝ & KPI NHÂN VIÊN
// ==========================================
window.loadStaffKPIData = async function() {
    const timeRange = document.getElementById('kpiFilterTimeRange')?.value || 'TODAY';
    const summaryTbody = document.getElementById('kpiSummaryTableBody');
    const logsTbody = document.getElementById('kpiLogsTableBody');

    try {
        const res = await fetch(`/api/orders/kpi/stats?timeRange=${timeRange}`);
        if (!res.ok) throw new Error('Không thể nạp dữ liệu KPI');
        const data = await res.json();
        const summary = Array.isArray(data.summary) ? data.summary : [];
        const logs = Array.isArray(data.logs) ? data.logs : [];

        // 1. Render Bảng Tổng Hợp KPI Từng Nhân Viên
        if (summaryTbody) {
            if (summary.length === 0) {
                summaryTbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Chưa có dữ liệu KPI trong khoảng thời gian này</td></tr>`;
            } else {
                summaryTbody.innerHTML = summary.map(s => {
                    let roleBadge = '<span class="badge bg-secondary">Nhân viên</span>';
                    const roleUpper = String(s.Staff_role || '').toUpperCase();
                    if (roleUpper === 'KITCHEN' || roleUpper.includes('BẾP')) {
                        roleBadge = '<span class="badge bg-warning text-dark"><i class="fa-solid fa-fire-burner me-1"></i>Bếp</span>';
                    } else if (roleUpper === 'WAITER' || roleUpper.includes('BỒI')) {
                        roleBadge = '<span class="badge bg-info text-dark"><i class="fa-solid fa-user-tie me-1"></i>Bồi Bàn</span>';
                    } else if (roleUpper === 'CASHIER' || roleUpper.includes('THU')) {
                        roleBadge = '<span class="badge bg-success"><i class="fa-solid fa-cash-register me-1"></i>Thu Ngân</span>';
                    } else if (roleUpper === 'ADMIN') {
                        roleBadge = '<span class="badge bg-dark"><i class="fa-solid fa-shield-halved me-1"></i>Quản Lý</span>';
                    }

                    return `
                        <tr>
                            <td class="fw-bold">
                                <i class="fa-solid fa-circle-user text-success me-1"></i>${s.Staff_name || s.Staff_username}
                                <small class="text-muted d-block" style="font-size: 11px;">@${s.Staff_username}</small>
                            </td>
                            <td>${roleBadge}</td>
                            <td class="text-center"><span class="badge bg-light text-dark fs-6 border px-3">${s.cook_count || 0}</span></td>
                            <td class="text-center"><span class="badge bg-light text-dark fs-6 border px-3">${s.served_count || 0}</span></td>
                            <td class="text-center"><span class="badge bg-light text-dark fs-6 border px-3">${s.created_count || 0}</span></td>
                            <td class="text-center"><span class="badge bg-success-subtle text-success fs-6 border border-success px-3">${s.payment_count || 0}</span></td>
                            <td class="text-end fw-bold text-success fs-6">${Number(s.total_revenue_collected || 0).toLocaleString('vi-VN')} đ</td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // 2. Render Nhật Ký Thao Tác Chi Tiết
        if (logsTbody) {
            if (logs.length === 0) {
                logsTbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Chưa có nhật ký hoạt động nào</td></tr>`;
            } else {
                logsTbody.innerHTML = logs.map(l => {
                    let actionBadge = '';
                    if (l.Action_type === 'COOK_FINISH') {
                        actionBadge = '<span class="badge bg-warning text-dark"><i class="fa-solid fa-check me-1"></i>Bếp Xong Món</span>';
                    } else if (l.Action_type === 'ORDER_SERVED') {
                        actionBadge = '<span class="badge bg-success"><i class="fa-solid fa-bell-concierge me-1"></i>Đã Trả Món</span>';
                    } else if (l.Action_type === 'PAYMENT_COLLECTED') {
                        actionBadge = '<span class="badge bg-primary"><i class="fa-solid fa-hand-holding-dollar me-1"></i>Thu Tiền</span>';
                    } else if (l.Action_type === 'ORDER_CREATED') {
                        actionBadge = '<span class="badge bg-secondary"><i class="fa-solid fa-plus me-1"></i>Tạo Đơn</span>';
                    } else {
                        actionBadge = `<span class="badge bg-light text-dark">${l.Action_type}</span>`;
                    }

                    return `
                        <tr>
                            <td class="small text-muted">${l.Created_at || ''}</td>
                            <td class="fw-bold">${l.Staff_name || l.Staff_username} <small class="text-muted" style="font-size: 11px;">(@${l.Staff_username})</small></td>
                            <td><span class="badge bg-light text-secondary border">${l.Staff_role || 'Nhân viên'}</span></td>
                            <td>${actionBadge}</td>
                            <td><b>#${l.Order_code || l.Order_id}</b> <small class="text-muted d-block">${l.Table_number || ''}</small></td>
                            <td class="small">${l.Note || ''}</td>
                        </tr>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.error('Lỗi loadStaffKPIData:', err);
    }
};

// ==========================================
// 8. HỘP THOẠI THANH TOÁN THU TIỀN TẠI BÀN (CHO BỒI BÀN & THU NGÂN)
// ==========================================
window.openQuickPaymentModal = async function(orderCode) {
    if (!orderCode) return;
    const cleanCode = String(orderCode).replace('#', '').trim();
    let order = (window.allOrdersData || []).find(o => {
        const c1 = String(o.Order_code || '').replace('#', '').trim().toLowerCase();
        const c2 = String(o.Order_id || '').trim().toLowerCase();
        const target = cleanCode.toLowerCase();
        return c1 === target || c2 === target || c1.replace('chay-', '') === target.replace('chay-', '');
    });

    if (!order) {
        try {
            const res = await fetch(`/api/orders/${encodeURIComponent(cleanCode)}`);
            const data = await res.json();
            if (data.success && data.order) {
                order = data.order;
            }
        } catch(e) {}
    }

    if (!order) {
        if (window.toast) window.toast.error('Không tìm thấy thông tin đơn hàng #' + cleanCode);
        return;
    }

    const finalTotal = Number(order.Final_amount || order.Total_amount || 0);
    const tableNumber = order.Table_number || order.Table_name || 'Bàn';

    const codeInput = document.getElementById('quickPayOrderCode');
    const totalInput = document.getElementById('quickPayTotalAmount');
    if (codeInput) codeInput.value = order.Order_code || cleanCode;
    if (totalInput) totalInput.value = finalTotal;

    const tableEl = document.getElementById('quickPayTableNumber');
    if (tableEl) tableEl.innerText = tableNumber.startsWith('Bàn') ? tableNumber : `Bàn: ${tableNumber}`;

    const codeDisplayEl = document.getElementById('quickPayOrderCodeDisplay');
    if (codeDisplayEl) codeDisplayEl.innerText = `Mã đơn: #${order.Order_code || cleanCode}`;

    const totalDisplayEl = document.getElementById('quickPayTotalDisplay');
    if (totalDisplayEl) totalDisplayEl.innerText = new Intl.NumberFormat('vi-VN').format(finalTotal) + ' đ';

    // Render danh sách món ăn
    const itemsContainer = document.getElementById('quickPayItemsList');
    if (itemsContainer) {
        if (Array.isArray(order.items) && order.items.length > 0) {
            itemsContainer.innerHTML = order.items.map(i => {
                const name = i.Item_name || i.name;
                const qty = Number(i.Quantity || i.quantity || 1);
                const price = Number(i.Unit_price || i.price || 0);
                const note = i.Note || i.note || '';
                const toppings = i.Toppings || i.toppings || '';
                return `
                    <div class="d-flex justify-content-between align-items-center border-bottom py-1" style="font-size: 12px;">
                        <div>
                            <b>${name}</b> <span class="badge bg-light text-dark border">x${qty}</span>
                            ${toppings ? `<div class="text-success" style="font-size: 11px;">+ ${toppings}</div>` : ''}
                            ${note ? `<div class="text-danger fw-semibold" style="font-size: 11px;">📝 ${note}</div>` : ''}
                        </div>
                        <div class="fw-bold text-success">${new Intl.NumberFormat('vi-VN').format(price * qty)} đ</div>
                    </div>
                `;
            }).join('');
        } else {
            itemsContainer.innerHTML = `<div class="text-muted small py-2">Chi tiết đơn hàng: ${new Intl.NumberFormat('vi-VN').format(finalTotal)} đ</div>`;
        }
    }

    // Đặt tên nhân viên ghi nhận thu tiền
    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const staffName = user.Full_name || user.User_name || 'Nhân viên';
    const collectorEl = document.getElementById('quickPayCollectorName');
    if (collectorEl) {
        collectorEl.innerText = `${staffName} (${user.User_name || 'user'})`;
    }

    // Nếu đơn hàng có Payment_method là MOMO thì chọn MoMo, nếu BANK_TRANSFER thì chọn QR, ngược lại chọn Tiền mặt
    const curMethod = String(order.Payment_method || '').toUpperCase();
    const isMomo = (curMethod === 'MOMO');
    const isQr = (curMethod === 'BANK_TRANSFER' || curMethod === 'QR' || curMethod === 'CHUYEN_KHOAN');
    const momoRadio = document.getElementById('quickPayMethodMomo');
    const qrRadio = document.getElementById('quickPayMethodQR');
    const cashRadio = document.getElementById('quickPayMethodCash');

    if (isMomo && momoRadio) {
        momoRadio.checked = true;
        window.handleQuickPayMethodChange('MOMO');
    } else if (isQr && qrRadio) {
        qrRadio.checked = true;
        window.handleQuickPayMethodChange('BANK_TRANSFER');
    } else {
        if (cashRadio) cashRadio.checked = true;
        window.handleQuickPayMethodChange('CASH');
    }

    // Mở Modal an toàn
    const modalEl = document.getElementById('quickPaymentModal');
    if (modalEl) {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modalObj = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            modalObj.show();
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
            document.body.classList.add('modal-open');
        }
    }
};

window.closeQuickPaymentModal = function() {
    const modalEl = document.getElementById('quickPaymentModal');
    if (modalEl) {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modalObj = bootstrap.Modal.getInstance(modalEl);
            if (modalObj) {
                try { modalObj.hide(); } catch(e){}
            }
        }
        modalEl.classList.remove('show');
        modalEl.style.display = 'none';
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.removeAttribute('aria-modal');
    }
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
};

// ĐỔI PHƯƠNG THỨC THU TIỀN TRONG MODAL
window.handleQuickPayMethodChange = function(method) {
    const qrArea = document.getElementById('quickPayQrArea');
    if (!qrArea) return;

    if (method === 'BANK_TRANSFER') {
        qrArea.classList.remove('d-none');
        const orderCode = document.getElementById('quickPayOrderCode')?.value || '';
        const total = Number(document.getElementById('quickPayTotalAmount')?.value || 0);
        const table = document.getElementById('quickPayTableNumber')?.innerText || '';

        const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        const qrUrl = sysConfig.qrImageUrl;
        const bankCode = sysConfig.qrBank || sysConfig.bankCode || 'MBBANK';
        const bankAccount = sysConfig.qrAccountNo || sysConfig.bankAccount || '123456789';
        const accountHolder = sysConfig.qrAccountName || sysConfig.bankAccountHolder || 'NHA HANG CHAY HOA SEN';

        const container = document.getElementById('quickPayQrImageContainer');
        if (container) {
            if (qrUrl) {
                container.innerHTML = `<img src="${qrUrl}" alt="Mã QR" style="max-width: 170px; max-height: 170px; border-radius: 8px; border: 1px solid #ddd;">`;
            } else {
                const memo = encodeURIComponent(`${orderCode} ${table}`.trim());
                const vietQrUrl = `https://img.vietqr.io/image/${bankCode}-${bankAccount}-compact2.png?amount=${total}&addInfo=${memo}&accountName=${encodeURIComponent(accountHolder)}`;
                container.innerHTML = `<img src="${vietQrUrl}" alt="VietQR" style="max-width: 190px; max-height: 190px; border-radius: 8px; border: 1px solid #ddd;">`;
            }
        }
        const bankInfoText = document.getElementById('quickPayBankInfoText');
        if (bankInfoText) {
            bankInfoText.innerHTML = `Ngân hàng: <b>${bankCode}</b> | STK: <b>${bankAccount}</b><br>Chủ TK: <b>${accountHolder}</b>`;
        }
    } else if (method === 'MOMO') {
        qrArea.classList.remove('d-none');
        const orderCode = document.getElementById('quickPayOrderCode')?.value || '';
        const total = Number(document.getElementById('quickPayTotalAmount')?.value || 0);
        const table = document.getElementById('quickPayTableNumber')?.innerText || '';

        const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        const momoPhone = sysConfig.momoPhone || sysConfig.qrMomoPhone || '0901234567';
        const momoName = sysConfig.momoName || sysConfig.qrMomoName || 'NHÀ HÀNG CHAY HOA SEN';
        const memo = encodeURIComponent(`${orderCode} ${table}`.trim());
        const momoVietQrUrl = `https://img.vietqr.io/image/MOMO-${momoPhone}-compact2.png?amount=${total}&addInfo=${memo}&accountName=${encodeURIComponent(momoName)}`;
        const momoQuickChartUrl = `https://quickchart.io/qr?text=${encodeURIComponent(`2|99|${momoPhone}|${momoName}||0|0|${total}|${orderCode} ${table}`)}&size=200&margin=1`;

        const container = document.getElementById('quickPayQrImageContainer');
        if (container) {
            container.innerHTML = `<img src="${momoVietQrUrl}" onerror="if (this.src !== '${momoQuickChartUrl}') this.src='${momoQuickChartUrl}';" alt="QR MoMo" style="max-width: 175px; max-height: 175px; border-radius: 8px; border: 2px solid #ae2070; padding: 2px;">`;
        }
        const bankInfoText = document.getElementById('quickPayBankInfoText');
        if (bankInfoText) {
            bankInfoText.innerHTML = `Ví: <b style="color: #ae2070;">MoMo</b> | SĐT: <b class="text-danger font-monospace fs-6">${momoPhone}</b><br>Chủ ví: <b>${momoName}</b>`;
        }
    } else {
        qrArea.classList.add('d-none');
    }
};

// GỬI XÁC NHẬN THU TIỀN CHO BÀN
window.submitQuickPayment = async function() {
    const orderCode = document.getElementById('quickPayOrderCode')?.value;
    if (!orderCode) return;

    const method = document.querySelector('input[name="quickPayMethod"]:checked')?.value || 'CASH';
    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const staffUser = user.User_name || user.username || 'boi';
    const staffName = user.Full_name || user.Display_name || staffUser;
    const staffRole = user.Role || 'WAITER';

    const btn = document.getElementById('btnConfirmQuickPay');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Đang ghi nhận...';
    }

    try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/confirm-payment`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Paid_by: staffUser,
                Staff_name: staffName,
                Staff_role: staffRole,
                Payment_method: method
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            if (window.toast) {
                window.toast.success(`Đã thu tiền thành công cho đơn #${orderCode}!`);
            }

            // Đóng Modal an toàn
            window.closeQuickPaymentModal();

            // Tải lại dữ liệu đơn hàng
            await window.loadOrders();
        } else {
            if (window.toast) window.toast.error(data.error || 'Lỗi khi xác nhận thanh toán!');
        }
    } catch (err) {
        console.error('Lỗi thanh toán nhanh:', err);
        if (window.toast) window.toast.error('Lỗi kết nối máy chủ!');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check me-1"></i> Xác Nhận Đã Thu Tiền';
        }
    }
};

// IN PHIẾU TẠM TÍNH TỪ MODAL THU TIỀN
window.printBillFromQuickPay = function() {
    const orderCode = document.getElementById('quickPayOrderCode')?.value;
    if (orderCode && typeof window.printOrderBill === 'function') {
        window.printOrderBill(orderCode);
    }
};

// ==========================================
// 9. BIỂU ĐỒ THỐNG KÊ DOANH THU & TRẠNG THÁI (CHART.JS)
// ==========================================
window.toggleChartsArea = function() {
    const section = document.getElementById('quickChartsSection');
    const btnText = document.getElementById('toggleChartBtnText');
    if (!section) return;

    if (section.classList.contains('d-none')) {
        section.classList.remove('d-none');
        if (btnText) btnText.innerText = 'Ẩn Biểu Đồ';
        window.renderQuickCharts();
    } else {
        section.classList.add('d-none');
        if (btnText) btnText.innerText = 'Xem Biểu Đồ Phân Tích';
    }
};

window.renderQuickCharts = function(filteredOrders) {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js chưa sẵn sàng');
        return;
    }

    const orders = filteredOrders || window.allOrdersData || [];

    // 1. Biểu đồ Doanh Thu Theo Mốc Thời Gian (Gom theo ngày/giờ)
    const revCanvas = document.getElementById('quickChartRevenueTimeline');
    if (revCanvas) {
        if (window.quickChartRevenueInstance) {
            window.quickChartRevenueInstance.destroy();
            window.quickChartRevenueInstance = null;
        }

        // Gom nhóm doanh thu theo ngày
        const revMap = {};
        orders.forEach(o => {
            const isPaid = (String(o.Payment_status || '').toUpperCase() === 'PAID');
            const statusRaw = String(o.Status || '').toUpperCase();
            const isCompleted = (statusRaw === 'COMPLETED' || statusRaw === 'SERVED' || statusRaw === 'DONE');
            const isCanceled = (statusRaw === 'CANCELED' || statusRaw === 'CANCELLED' || Boolean(o.Cancel_role));

            if (!isCanceled && (isPaid || isCompleted)) {
                const dateKey = String(o.Created_at || o.createdAt || '').substring(0, 10) || 'Hôm nay';
                const amount = Number(o.Final_amount || o.Total_amount || 0);
                revMap[dateKey] = (revMap[dateKey] || 0) + amount;
            }
        });

        let labels = Object.keys(revMap).sort();
        let values = labels.map(k => revMap[k]);

        if (labels.length === 0) {
            labels = ['Chưa có doanh thu'];
            values = [0];
        }

        const ctxRev = revCanvas.getContext('2d');
        window.quickChartRevenueInstance = new Chart(ctxRev, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Doanh thu (VNĐ)',
                    data: values,
                    backgroundColor: '#198754',
                    borderRadius: 6,
                    maxBarThickness: 45
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(item) {
                                return 'Doanh thu: ' + Number(item.raw).toLocaleString('vi-VN') + ' đ';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(v) {
                                return (v >= 1000000 ? (v / 1000000) + 'Tr' : (v / 1000) + 'k');
                            }
                        }
                    }
                }
            }
        });
    }

    // 2. Biểu đồ Cơ Cấu Trạng Thái Đơn Hàng (Đang phục vụ / Hoàn thành / Hủy)
    const statusCanvas = document.getElementById('quickChartOrderStatus');
    if (statusCanvas) {
        if (window.quickChartStatusInstance) {
            window.quickChartStatusInstance.destroy();
            window.quickChartStatusInstance = null;
        }

        let serving = 0;
        let completed = 0;
        let canceled = 0;

        orders.forEach(o => {
            const statusRaw = String(o.Status || '').toUpperCase();
            const isCanceled = (statusRaw === 'CANCELED' || statusRaw === 'CANCELLED' || Boolean(o.Cancel_role) || String(o.Cancel_reason || '').toLowerCase().includes('hủy'));
            if (isCanceled) {
                canceled++;
            } else if (statusRaw === 'COMPLETED' || statusRaw === 'SERVED' || statusRaw === 'DONE') {
                completed++;
            } else {
                serving++;
            }
        });

        const ctxStatus = statusCanvas.getContext('2d');
        window.quickChartStatusInstance = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: ['Đang Phục Vụ', 'Hoàn Thành', 'Đã Hủy'],
                datasets: [{
                    data: [serving, completed, canceled],
                    backgroundColor: ['#ffc107', '#198754', '#dc3545'],
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 10,
                            font: { size: 11, weight: 'bold' }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }
};