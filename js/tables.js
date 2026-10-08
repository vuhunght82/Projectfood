/**
 * LOGIC QUẢN LÝ PHÒNG BÀN & SƠ ĐỒ BÀN THỜI GIAN THỰC (TABLE MANAGEMENT)
 * - Sơ đồ bàn ngang / dọc
 * - Cập nhật trạng thái phục vụ, đơn hàng, số tiền tạm tính, trạng thái thanh toán
 * - Thêm / bớt khách trực tiếp trên bàn (Guest counter stepper)
 * - Chuyển bàn / Đổi bàn
 * - Dọn bàn / Trả bàn trống
 * - Thống kê lượng khách theo thời gian & tỷ lệ lấp đầy ghế (Chart.js)
 * - Thêm, sửa, xóa cấu hình bàn ghế (CRUD)
 */

window.allTablesData = [];
window.currentTableLayout = localStorage.getItem('hoasen_table_layout') || 'HORIZONTAL';
window.currentAreaFilter = 'ALL';
window.guestStatsChartInstance = null;
window.currentGuestTimeFilter = 'TODAY';

// 1. Khởi tạo Phân Hệ Phòng Bàn
window.initTables = function() {
    setupTableSocketListeners();
    checkTablePermissions();
    window.loadTables();
};

// Kiểm tra quyền hạn hiển thị các tính năng nâng cao (Mặc định nhân viên phục vụ/bồi bàn KHÔNG có quyền thêm/quản lý bàn)
function checkTablePermissions() {
    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const roleUpper = String(user.Role || '').toUpperCase();
    const isAdmin = roleUpper === 'ADMIN' || roleUpper === 'QUẢN LÝ' || roleUpper === 'MANAGER';
    const canManage = isAdmin || ((typeof window.hasPermission === 'function') ? window.hasPermission(user, 'TABLES_MANAGE') : false);
    const canStats = isAdmin || ((typeof window.hasPermission === 'function') ? window.hasPermission(user, 'REPORTS_STATS') : false);

    const btnAddTop = document.getElementById('btnAddTableTopBtn');
    const tabManageItem = document.getElementById('tab-manage-item');
    const tabManageBtn = document.getElementById('tab-manage-btn');
    const tabGuestStatsItem = document.getElementById('tab-guest-stats-item');

    if (btnAddTop) {
        if (canManage) btnAddTop.classList.remove('d-none');
        else btnAddTop.classList.add('d-none');
    }
    if (tabManageItem) {
        if (canManage) tabManageItem.classList.remove('d-none');
        else tabManageItem.classList.add('d-none');
    }
    if (tabManageBtn) {
        if (canManage) tabManageBtn.classList.remove('d-none');
        else tabManageBtn.classList.add('d-none');
    }
    if (tabGuestStatsItem) {
        if (canStats) tabGuestStatsItem.classList.remove('d-none');
        else tabGuestStatsItem.classList.add('d-none');
    }
}

// Lắng nghe Realtime Socket.IO
function setupTableSocketListeners() {
    const socket = window.socket || (typeof io === 'function' ? io(window.location.origin) : null);
    if (!socket || socket.hasTableListeners) return;

    socket.hasTableListeners = true;

    socket.on('table_updated', (data) => {
        // Cập nhật nhanh số khách / trạng thái của bàn cụ thể nếu đang hiển thị
        if (Array.isArray(window.allTablesData)) {
            const t = window.allTablesData.find(x => String(x.Table_id) === String(data.Table_id));
            if (t) {
                if (data.Current_guests !== undefined) t.Current_guests = data.Current_guests;
                if (data.Status !== undefined) t.Status = data.Status;
                renderTablesMap();
                updateTablesKpiCards();
            } else {
                window.loadTables();
            }
        }
    });

    socket.on('table_transferred', () => {
        window.loadTables();
    });

    socket.on('tables_list_changed', () => {
        window.loadTables();
    });

    socket.on('order_status_updated', () => {
        window.loadTables();
    });

    socket.on('kitchen_finish_order', () => {
        window.loadTables();
    });

    socket.on('kitchen_new_order', () => {
        window.loadTables();
    });
}

// 2. Chuyển đổi giữa 3 Tab con: Sơ Đồ Bàn, Thống Kê Khách, Quản Lý Bàn
window.switchTablesSubTab = function(tabId) {
    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const roleUpper = String(user.Role || '').toUpperCase();
    const isAdmin = roleUpper === 'ADMIN' || roleUpper === 'QUẢN LÝ' || roleUpper === 'MANAGER';
    const canManage = isAdmin || ((typeof window.hasPermission === 'function') ? window.hasPermission(user, 'TABLES_MANAGE') : false);
    const canStats = isAdmin || ((typeof window.hasPermission === 'function') ? window.hasPermission(user, 'REPORTS_STATS') : false);

    if (tabId === 'tab-manage' && !canManage) {
        if (window.toast) window.toast.warning('Tài khoản phục vụ của bạn chưa được cấp quyền Quản lý bàn!');
        return;
    }
    if (tabId === 'tab-guest-stats' && !canStats) {
        if (window.toast) window.toast.warning('Tài khoản của bạn chưa được cấp quyền xem Thống kê!');
        return;
    }

    document.querySelectorAll('#tablesMainTabs .nav-link').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('#tablesTabsContent .tab-pane-tables').forEach(pane => pane.classList.add('d-none'));

    const activeBtn = document.getElementById(tabId + '-btn');
    const activePane = document.getElementById(tabId);

    if (activeBtn) activeBtn.classList.add('active');
    if (activePane) activePane.classList.remove('d-none');

    const areaFilterContainer = document.getElementById('tableAreaFilterContainer');
    if (areaFilterContainer) {
        areaFilterContainer.style.display = (tabId === 'tab-map') ? 'flex' : 'none';
    }

    if (tabId === 'tab-guest-stats') {
        window.loadGuestStats(window.currentGuestTimeFilter);
    } else if (tabId === 'tab-manage') {
        renderTablesManageTable();
    }
};

// 3. Chuyển đổi Bố Cục Sơ Đồ Ngang / Dọc
window.switchTableLayout = function(layout) {
    window.currentTableLayout = layout;
    localStorage.setItem('hoasen_table_layout', layout);

    const btnH = document.getElementById('btnLayoutHorizontal');
    const btnV = document.getElementById('btnLayoutVertical');

    if (btnH && btnV) {
        if (layout === 'HORIZONTAL') {
            btnH.className = 'btn btn-sm btn-dark rounded-pill fw-bold px-3 shadow-none';
            btnV.className = 'btn btn-sm btn-light text-secondary rounded-pill fw-bold px-3 border-0 shadow-none';
        } else {
            btnH.className = 'btn btn-sm btn-light text-secondary rounded-pill fw-bold px-3 border-0 shadow-none';
            btnV.className = 'btn btn-sm btn-dark rounded-pill fw-bold px-3 shadow-none';
        }
    }

    renderTablesMap();
};

// 4. Lọc Bàn Theo Khu Vực / Tầng
window.filterTablesByArea = function(area) {
    window.currentAreaFilter = area;
    document.querySelectorAll('.area-filter-btn').forEach(btn => {
        if (btn.getAttribute('data-area') === area) {
            btn.className = 'btn btn-sm btn-success rounded-pill px-3 active fw-bold area-filter-btn';
        } else {
            btn.className = 'btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold area-filter-btn';
        }
    });
    renderTablesMap();
};

// 5. Tải danh sách phòng bàn từ Server
window.loadTables = async function() {
    try {
        const res = await fetch('/api/tables?t=' + Date.now());
        if (!res.ok) throw new Error('Không thể tải danh sách bàn');
        const data = await res.json();
        window.allTablesData = Array.isArray(data.tables) ? data.tables : [];

        updateTablesKpiCards();
        renderTablesMap();

        const activeSubTab = document.querySelector('#tablesMainTabs .nav-link.active')?.id;
        if (activeSubTab === 'tab-manage-btn') {
            renderTablesManageTable();
        }
    } catch (err) {
        console.error('Lỗi tải phòng bàn:', err);
        const container = document.getElementById('tablesContainer');
        if (container) {
            container.innerHTML = `<div class="col-12 text-center py-4 text-danger"><i class="fa-solid fa-triangle-exclamation me-1"></i>Lỗi kết nối máy chủ: ${err.message}</div>`;
        }
    }
};

// 6. Cập nhật 4 thẻ KPI tổng quan
function updateTablesKpiCards() {
    const tables = window.allTablesData || [];
    let emptyCount = 0;
    let occupiedCount = 0;
    let currentGuests = 0;
    let totalCapacity = 0;

    tables.forEach(t => {
        const cap = Number(t.Capacity || 0);
        const guests = Number(t.Current_guests || 0);
        totalCapacity += cap;

        if (t.Status === 'SERVING' || guests > 0 || t.Current_order_id) {
            occupiedCount++;
            currentGuests += (guests > 0 ? guests : 1);
        } else {
            emptyCount++;
        }
    });

    const occupancyRate = totalCapacity > 0 ? Math.round((currentGuests / totalCapacity) * 100) : 0;

    const emptyEl = document.getElementById('kpiEmptyTablesCount');
    const occEl = document.getElementById('kpiOccupiedTablesCount');
    const guestEl = document.getElementById('kpiCurrentGuestsCount');
    const rateEl = document.getElementById('kpiOccupancyRate');
    const capSub = document.getElementById('kpiCapacitySubtext');

    if (emptyEl) emptyEl.innerText = emptyCount;
    if (occEl) occEl.innerText = occupiedCount;
    if (guestEl) guestEl.innerText = currentGuests;
    if (rateEl) rateEl.innerText = occupancyRate + '%';
    if (capSub) capSub.innerText = `Trên tổng số ${totalCapacity} ghế`;
}

// 6.5. VẼ SƠ ĐỒ MẶT BẰNG BÀN GHẾ TRỰC QUAN (SVG ARCHITECTURAL FLOORPLAN)
// Quy tắc phân bổ ghế theo yêu cầu:
// - Bàn 2 chỗ: Bàn vuông ở giữa, 2 cạnh đối nhau có ghế (trên 1, dưới 1)
// - Bàn 4 chỗ: 2 cạnh dài có ghế (trên 2, dưới 2), 2 cạnh ngắn không có ghế
// - Bàn 6 chỗ: 2 cạnh dài 4 (trên 2, dưới 2), mỗi cạnh ngắn 1 (trái 1, phải 1) -> Tổng 6 ghế
// - Bàn N chỗ (N >= 6): Cạnh ngắn mỗi bên 1 ghế, (N-2) ghế còn lại chia đều cho 2 cạnh dài
function renderTableDiagramSVG(capacity, guests = 0, isOccupied = false, tableName = '', isMini = false, tableId = null) {
    const cap = Math.max(1, parseInt(capacity) || 4);
    const guestCount = Math.max(0, parseInt(guests) || 0);

    let top = 0, bottom = 0, left = 0, right = 0, isSquare = false;
    if (cap === 1) {
        top = 1; isSquare = true;
    } else if (cap === 2) {
        // Bàn 2 chỗ: Bàn vuông ở giữa, 2 cạnh đối nhau có ghế
        top = 1; bottom = 1; isSquare = true;
    } else if (cap === 3) {
        top = 1; bottom = 1; left = 1; isSquare = true;
    } else if (cap === 4) {
        // Bàn 4 chỗ: 2 cạnh dài có 4 ghế (2 trên, 2 dưới), 2 cạnh ngắn không có
        top = 2; bottom = 2; isSquare = false;
    } else if (cap === 5) {
        top = 2; bottom = 2; left = 1; isSquare = false;
    } else {
        // Bàn 6 chỗ trở lên: Mỗi cạnh ngắn 1 ghế, 2 cạnh dài chia đều phần còn lại
        left = 1; right = 1;
        const remaining = cap - 2;
        top = Math.ceil(remaining / 2);
        bottom = Math.floor(remaining / 2);
        isSquare = false;
    }

    const chairW_TB = isMini ? 16 : 22;
    const chairH_TB = isMini ? 9 : 12;
    const chairW_LR = isMini ? 9 : 12;
    const chairH_LR = isMini ? 16 : 22;
    const chairGap = isMini ? 3 : 4;

    let tableW, tableH;
    if (isSquare) {
        tableW = isMini ? 38 : 54;
        tableH = isMini ? 38 : 54;
    } else if (cap === 4) {
        tableW = isMini ? 64 : 88;
        tableH = isMini ? 36 : 48;
    } else {
        const maxChairsSide = Math.max(top, bottom);
        tableW = isMini ? Math.max(64, maxChairsSide * 20 + 10) : Math.max(88, maxChairsSide * 28 + 14);
        tableH = isMini ? 36 : 50;
    }

    const marginX = (left > 0 || right > 0) ? (isMini ? 18 : 26) : (isMini ? 10 : 14);
    const marginY = isMini ? 15 : 22;

    const svgW = tableW + marginX * 2;
    const svgH = tableH + marginY * 2;
    const tableX = marginX;
    const tableY = marginY;

    // Màu sắc theo trạng thái
    const tableBg = isOccupied ? '#fffbeb' : '#f0fdf4';
    const tableBorder = isOccupied ? '#f59e0b' : '#10b981';
    const tableTextColor = isOccupied ? '#92400e' : '#065f46';
    const chairOccupiedFill = '#f59e0b';
    const chairOccupiedStroke = '#b45309';
    const chairEmptyFill = isOccupied ? '#f8fafc' : '#ecfdf5';
    const chairEmptyStroke = isOccupied ? '#94a3b8' : '#10b981';

    let chairCounter = 0;
    let chairsSvg = '';

    function drawChair(cx, cy, orient) {
        chairCounter++;
        const currentSeatNum = chairCounter;
        const isSeatOccupied = isOccupied && (currentSeatNum <= guestCount);

        const fill = isSeatOccupied ? chairOccupiedFill : chairEmptyFill;
        const stroke = isSeatOccupied ? chairOccupiedStroke : chairEmptyStroke;
        const strokeWidth = isSeatOccupied ? '1.5' : '1.2';
        const dashArray = (!isSeatOccupied && isOccupied) ? 'stroke-dasharray="2,2"' : '';
        const titleText = isSeatOccupied 
            ? `Ghế #${currentSeatNum}: Đang có khách ngồi` 
            : (isOccupied ? `Ghế #${currentSeatNum}: Trống (Bấm để chọn ${currentSeatNum} khách)` : `Ghế #${currentSeatNum}: Sẵn sàng`);
        const clickAttr = (tableId && isOccupied) ? `onclick="window.setTableGuests(${tableId}, ${currentSeatNum}, event)" style="cursor:pointer;"` : '';

        if (orient === 'TOP') {
            const x = cx - chairW_TB / 2;
            const y = cy - chairH_TB;
            return `
                <g class="chair-item" ${clickAttr}>
                    <title>${titleText}</title>
                    <rect x="${x}" y="${y}" width="${chairW_TB}" height="${isMini ? 3 : 4}" rx="2" fill="${stroke}" />
                    <rect x="${x + 1}" y="${y + (isMini ? 2 : 3)}" width="${chairW_TB - 2}" height="${chairH_TB - (isMini ? 2 : 3)}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashArray} />
                    ${isSeatOccupied ? `<circle cx="${cx}" cy="${y + (isMini ? 5 : 7)}" r="${isMini ? 1.8 : 2.5}" fill="#ffffff" />` : ''}
                </g>
            `;
        } else if (orient === 'BOTTOM') {
            const x = cx - chairW_TB / 2;
            const y = cy;
            return `
                <g class="chair-item" ${clickAttr}>
                    <title>${titleText}</title>
                    <rect x="${x + 1}" y="${y}" width="${chairW_TB - 2}" height="${chairH_TB - (isMini ? 2 : 3)}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashArray} />
                    <rect x="${x}" y="${y + chairH_TB - (isMini ? 3 : 4)}" width="${chairW_TB}" height="${isMini ? 3 : 4}" rx="2" fill="${stroke}" />
                    ${isSeatOccupied ? `<circle cx="${cx}" cy="${y + (isMini ? 3 : 4)}" r="${isMini ? 1.8 : 2.5}" fill="#ffffff" />` : ''}
                </g>
            `;
        } else if (orient === 'LEFT') {
            const x = cx - chairW_LR;
            const y = cy - chairH_LR / 2;
            return `
                <g class="chair-item" ${clickAttr}>
                    <title>${titleText}</title>
                    <rect x="${x}" y="${y}" width="${isMini ? 3 : 4}" height="${chairH_LR}" rx="2" fill="${stroke}" />
                    <rect x="${x + (isMini ? 2 : 3)}" y="${y + 1}" width="${chairW_LR - (isMini ? 2 : 3)}" height="${chairH_LR - 2}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashArray} />
                    ${isSeatOccupied ? `<circle cx="${x + (isMini ? 5 : 7)}" cy="${cy}" r="${isMini ? 1.8 : 2.5}" fill="#ffffff" />` : ''}
                </g>
            `;
        } else if (orient === 'RIGHT') {
            const x = cx;
            const y = cy - chairH_LR / 2;
            return `
                <g class="chair-item" ${clickAttr}>
                    <title>${titleText}</title>
                    <rect x="${x}" y="${y + 1}" width="${chairW_LR - (isMini ? 2 : 3)}" height="${chairH_LR - 2}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashArray} />
                    <rect x="${x + chairW_LR - (isMini ? 3 : 4)}" y="${y}" width="${isMini ? 3 : 4}" height="${chairH_LR}" rx="2" fill="${stroke}" />
                    ${isSeatOccupied ? `<circle cx="${x + (isMini ? 3 : 4)}" cy="${cy}" r="${isMini ? 1.8 : 2.5}" fill="#ffffff" />` : ''}
                </g>
            `;
        }
        return '';
    }

    // 1. Phân bổ ghế TRÊN (TOP)
    if (top > 0) {
        const step = tableW / (top + 1);
        for (let i = 1; i <= top; i++) chairsSvg += drawChair(tableX + step * i, tableY - chairGap, 'TOP');
    }
    // 2. Phân bổ ghế PHẢI (RIGHT)
    if (right > 0) {
        const step = tableH / (right + 1);
        for (let i = 1; i <= right; i++) chairsSvg += drawChair(tableX + tableW + chairGap, tableY + step * i, 'RIGHT');
    }
    // 3. Phân bổ ghế DƯỚI (BOTTOM)
    if (bottom > 0) {
        const step = tableW / (bottom + 1);
        for (let i = 1; i <= bottom; i++) chairsSvg += drawChair(tableX + step * i, tableY + tableH + chairGap, 'BOTTOM');
    }
    // 4. Phân bổ ghế TRÁI (LEFT)
    if (left > 0) {
        const step = tableH / (left + 1);
        for (let i = 1; i <= left; i++) chairsSvg += drawChair(tableX - chairGap, tableY + step * i, 'LEFT');
    }

    // Mặt bàn
    const tableSvg = `
        <rect x="${tableX}" y="${tableY}" width="${tableW}" height="${tableH}" rx="8" 
              fill="${tableBg}" stroke="${tableBorder}" stroke-width="${isMini ? 1.5 : 2}" 
              filter="drop-shadow(0px 2px 3px rgba(0,0,0,0.06))" />
        
        <line x1="${tableX + 6}" y1="${tableY + 5}" x2="${tableX + tableW - 6}" y2="${tableY + 5}" 
              stroke="${tableBorder}" stroke-width="0.8" stroke-dasharray="2,2" opacity="0.45"/>
        <line x1="${tableX + 6}" y1="${tableY + tableH - 5}" x2="${tableX + tableW - 6}" y2="${tableY + tableH - 5}" 
              stroke="${tableBorder}" stroke-width="0.8" stroke-dasharray="2,2" opacity="0.45"/>

        <text x="${tableX + tableW / 2}" y="${tableY + tableH / 2 - (isMini ? 1 : 2)}" 
              text-anchor="middle" dominant-baseline="middle" 
              font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" 
              font-size="${isMini ? 8.5 : 10.5}" font-weight="700" fill="${tableTextColor}">
            ${tableName || ('Bàn ' + cap + ' Ghế')}
        </text>
        <text x="${tableX + tableW / 2}" y="${tableY + tableH / 2 + (isMini ? 8 : 11)}" 
              text-anchor="middle" dominant-baseline="middle" 
              font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" 
              font-size="${isMini ? 7 : 8.5}" font-weight="600" fill="${tableTextColor}" opacity="0.85">
            ${isOccupied ? `${guestCount}/${cap} khách` : `${cap} ghế`}
        </text>
    `;

    return `
        <svg viewBox="0 0 ${svgW} ${svgH}" class="table-svg-diagram" 
             style="width: 100%; max-height: ${isMini ? '55px' : '95px'}; display: block; margin: 0 auto;" 
             preserveAspectRatio="xMidYMid meet">
            ${chairsSvg}
            ${tableSvg}
        </svg>
    `;
}

// 7. Render Sơ Đồ Bàn (Hỗ trợ 2 chế độ Sơ Đồ Ngang Lưới & Sơ Đồ Dọc)
function renderTablesMap() {
    const container = document.getElementById('tablesContainer');
    if (!container) return;

    const tables = window.allTablesData || [];
    const areaFilter = window.currentAreaFilter;
    const isHorizontal = window.currentTableLayout === 'HORIZONTAL';

    // Lọc theo khu vực
    const filtered = areaFilter === 'ALL' 
        ? tables 
        : tables.filter(t => (t.Area || 'Tầng 1') === areaFilter);

    if (filtered.length === 0) {
        container.className = 'row g-3';
        container.innerHTML = `
            <div class="col-12 text-center py-5 text-muted">
                <i class="fa-solid fa-chair fa-3x mb-3 text-secondary opacity-50"></i>
                <h5>Không tìm thấy bàn nào thuộc khu vực "${areaFilter}"</h5>
            </div>
        `;
        return;
    }

    // Thiết lập class container theo chế độ layout
    if (isHorizontal) {
        container.className = 'row g-3 row-cols-xl-4 row-cols-lg-3 row-cols-md-2 row-cols-1';
    } else {
        container.className = 'd-flex flex-column gap-2';
    }

    container.innerHTML = filtered.map(table => {
        const tableId = table.Table_id;
        const tableName = table.Table_name || `Bàn #${tableId}`;
        const areaName = table.Area || 'Tầng 1';
        const capacity = Number(table.Capacity || 4);
        const guests = Number(table.Current_guests || 0);
        const isOccupied = (table.Status === 'SERVING' || guests > 0 || Boolean(table.Current_order_id));
        const amount = Number(table.Current_amount || 0);
        const paymentStatus = String(table.Payment_status || 'UNPAID').toUpperCase();
        const isPaid = (paymentStatus === 'PAID');
        const orderCode = table.Current_order_code || (table.Current_order_id ? `#CHAY-${table.Current_order_id}` : '');

        // Màu sắc và kiểu dáng thẻ bàn
        let cardBorderClass = isOccupied ? 'border-warning border-3 shadow-sm' : 'border-success-subtle shadow-sm';
        let headerBgClass = isOccupied ? 'bg-warning bg-opacity-10 text-dark border-bottom border-warning' : 'bg-light text-dark border-bottom';
        let statusBadge = isOccupied 
            ? `<span class="badge bg-danger text-white px-2 py-1"><i class="fa-solid fa-utensils me-1"></i>Đang Phục Vụ</span>`
            : `<span class="badge bg-success-subtle text-success border border-success px-2 py-1"><i class="fa-solid fa-circle-check me-1"></i>Trống</span>`;

        let paymentBadge = '';
        if (isOccupied) {
            paymentBadge = isPaid
                ? `<span class="badge bg-success text-white px-2 py-1"><i class="fa-solid fa-circle-check me-1"></i>ĐÃ THU</span>`
                : `<span class="badge bg-danger text-white px-2 py-1"><i class="fa-solid fa-clock me-1"></i>CHƯA THU</span>`;
        }

        // BỐ CỤC DỌC (VERTICAL LIST CARD)
        if (!isHorizontal) {
            return `
                <div class="card ${cardBorderClass} rounded-3 p-3 bg-white" id="table-card-${tableId}">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div class="d-flex align-items-center gap-3">
                            <!-- Sơ đồ thu nhỏ trong danh sách dọc -->
                            <div class="table-floorplan-mini p-1 d-flex align-items-center justify-content-center" style="width: 105px; height: 65px; flex-shrink: 0;">
                                ${renderTableDiagramSVG(capacity, guests, isOccupied, tableName, true, tableId)}
                            </div>
                            <div>
                                <h5 class="fw-bold m-0 text-dark">${tableName} <small class="badge bg-light text-secondary border ms-1">${areaName}</small></h5>
                                <div class="small text-muted mt-1">
                                    Sức chứa: <b>${capacity} ghế</b> | Đang ngồi: <b class="${guests > 0 ? 'text-primary' : 'text-secondary'}">${guests} khách</b>
                                </div>
                            </div>
                        </div>

                        <!-- Thông tin đơn hàng & Số tiền -->
                        <div class="text-md-end">
                            ${isOccupied ? `
                                <div class="fw-bold fs-5 text-success">${amount.toLocaleString('vi-VN')} đ</div>
                                <div class="d-flex align-items-center gap-1 justify-content-md-end mt-1">
                                    ${paymentBadge}
                                    <span class="badge bg-light text-muted border">${orderCode}</span>
                                </div>
                            ` : `
                                <span class="badge bg-success-subtle text-success border border-success px-3 py-2">Bàn Trống Sẵn Sàng</span>
                            `}
                        </div>

                        <!-- Bộ nút thao tác -->
                        <div class="d-flex align-items-center gap-2">
                            ${isOccupied ? `
                                <!-- Tăng giảm khách trực tiếp -->
                                <div class="input-group input-group-sm" style="width: 120px;">
                                    <button class="btn btn-outline-secondary" type="button" onclick="window.stepTableGuests(${tableId}, -1, event)" title="Giảm 1 khách">
                                        <i class="fa-solid fa-minus"></i>
                                    </button>
                                    <span class="input-group-text bg-white fw-bold flex-grow-1 justify-content-center text-primary" style="font-size: 13px;">${guests}</span>
                                    <button class="btn btn-outline-secondary" type="button" onclick="window.stepTableGuests(${tableId}, 1, event)" title="Thêm 1 khách">
                                        <i class="fa-solid fa-plus"></i>
                                    </button>
                                </div>

                                ${paymentStatus === 'PAID' ? `
                                    <button class="btn btn-sm btn-outline-success fw-bold rounded-pill px-3" onclick="window.printTableBill(${tableId}, '${tableName}', '${orderCode}')" title="Đã thu tiền - In hóa đơn">
                                        <i class="fa-solid fa-print me-1"></i> Đã Thu
                                    </button>
                                ` : `
                                    <button class="btn btn-sm btn-danger fw-bold rounded-pill px-3 shadow-sm" onclick="window.payTableBill(${tableId}, '${tableName}', ${amount}, '${orderCode}')" title="Thanh toán bàn này">
                                        <i class="fa-solid fa-credit-card me-1"></i> Thanh Toán
                                    </button>
                                `}

                                <button class="btn btn-sm btn-outline-info text-dark fw-bold rounded-pill px-3" onclick="window.showTablePreBill(${tableId}, '${tableName}', '${orderCode}')" title="Xem danh sách món & in tạm tính">
                                    <i class="fa-solid fa-receipt text-info me-1"></i> Tạm Tính
                                </button>

                                <button class="btn btn-sm btn-outline-warning fw-bold rounded-pill px-3" onclick="window.openTransferTableModal(${tableId}, '${tableName}')" title="Đổi sang bàn khác">
                                    <i class="fa-solid fa-shuffle me-1"></i> Đổi Bàn
                                </button>
                                <button class="btn btn-sm btn-primary fw-bold rounded-pill px-3" onclick="window.goToMenuForTable('${tableName}', '${orderCode}', ${amount}, ${tableId})" title="Gọi thêm món">
                                    <i class="fa-solid fa-plus me-1"></i> Thêm Món
                                </button>
                                <button class="btn btn-sm btn-outline-secondary rounded-pill px-2" onclick="window.clearTable(${tableId}, '${tableName}')" title="Dọn bàn / Trả bàn trống">
                                    <i class="fa-solid fa-broom"></i>
                                </button>
                            ` : `
                                <button class="btn btn-sm btn-success fw-bold rounded-pill px-4 shadow-sm" onclick="window.openTableToOrder(${tableId}, '${tableName}', ${capacity})">
                                    <i class="fa-solid fa-utensils me-1"></i> Mở Bàn / Đặt Món
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }

        // BỐ CỤC NGANG (HORIZONTAL GRID CARD)
        return `
            <div class="col" id="table-card-${tableId}">
                <div class="card ${cardBorderClass} rounded-3 h-100 bg-white d-flex flex-column">
                    <!-- HEADER THẺ BÀN -->
                    <div class="card-header ${headerBgClass} p-3 d-flex justify-content-between align-items-center">
                        <div>
                            <h5 class="fw-bold m-0 text-dark">${tableName}</h5>
                            <small class="badge bg-white text-secondary border mt-1">${areaName}</small>
                        </div>
                        <div class="text-end">
                            ${statusBadge}
                        </div>
                    </div>

                    <!-- THÂN THẺ BÀN -->
                    <div class="card-body p-3 d-flex flex-column justify-content-between">
                        ${isOccupied ? `
                            <!-- SƠ ĐỒ MẶT BẰNG BÀN GHẾ TRỰC QUAN -->
                            <div class="table-floorplan-box text-center mb-3">
                                ${renderTableDiagramSVG(capacity, guests, true, tableName, false, tableId)}
                            </div>

                            <!-- Thông tin Đơn hàng & Số tiền -->
                            <div class="mb-3">
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                    <small class="text-secondary fw-bold">Tổng tiền tạm tính:</small>
                                    <span class="fs-4 fw-bold text-success">${amount.toLocaleString('vi-VN')} đ</span>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <small class="text-muted"><i class="fa-solid fa-receipt me-1"></i>${orderCode}</small>
                                    ${paymentBadge}
                                </div>
                            </div>

                            <!-- Stepper Thêm Bớt Số Khách Ngay Trên Bàn -->
                            <div class="p-2 bg-light rounded-3 border mb-3">
                                <div class="d-flex justify-content-between align-items-center">
                                    <small class="fw-bold text-secondary">
                                        <i class="fa-solid fa-users me-1 text-primary"></i>Số khách ngồi:
                                    </small>
                                    <div class="input-group input-group-sm" style="width: 110px;">
                                        <button class="btn btn-outline-secondary" type="button" onclick="window.stepTableGuests(${tableId}, -1, event)" title="Bớt 1 khách">
                                            <i class="fa-solid fa-minus"></i>
                                        </button>
                                        <span class="input-group-text bg-white fw-bold flex-grow-1 justify-content-center text-primary">${guests}</span>
                                        <button class="btn btn-outline-secondary" type="button" onclick="window.stepTableGuests(${tableId}, 1, event)" title="Thêm 1 khách">
                                            <i class="fa-solid fa-plus"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="text-muted text-end small mt-1" style="font-size: 10.5px;">Sức chứa: ${capacity} ghế</div>
                            </div>
                        ` : `
                            <!-- BÀN TRỐNG CÓ SƠ ĐỒ MẶT BẰNG BÀN GHẾ TRỰC QUAN -->
                            <div class="text-center py-2 my-auto">
                                <div class="table-floorplan-box text-center mb-3">
                                    ${renderTableDiagramSVG(capacity, 0, false, tableName, false, tableId)}
                                </div>
                                <div class="fw-bold text-success fs-6 mt-1">
                                    <i class="fa-solid fa-circle-check me-1"></i>Sức Chứa: ${capacity} Ghế
                                </div>
                                <small class="text-muted d-block mb-3">Chưa có khách ngồi</small>
                            </div>
                        `}

                        <!-- CÁC NÚT THAO TÁC -->
                        <div class="pt-2 border-top">
                            ${isOccupied ? `
                                <div class="row g-2">
                                    <div class="col-12 mb-1">
                                        ${paymentStatus === 'PAID' ? `
                                            <button type="button" class="btn btn-sm btn-outline-success w-100 fw-bold rounded-pill py-2" onclick="window.printTableBill(${tableId}, '${tableName}', '${orderCode}')">
                                                <i class="fa-solid fa-print me-1"></i> Đã Thu (In Hóa Đơn)
                                            </button>
                                        ` : `
                                            <button type="button" class="btn btn-sm btn-danger w-100 fw-bold rounded-pill py-2 shadow-sm" onclick="window.payTableBill(${tableId}, '${tableName}', ${amount}, '${orderCode}')">
                                                <i class="fa-solid fa-credit-card me-1"></i> Thanh Toán (${amount.toLocaleString('vi-VN')} đ)
                                            </button>
                                        `}
                                    </div>
                                    <div class="col-12 mb-1">
                                        <button type="button" class="btn btn-sm btn-outline-info text-dark w-100 fw-bold rounded-pill py-2 shadow-sm" onclick="window.showTablePreBill(${tableId}, '${tableName}', '${orderCode}')">
                                            <i class="fa-solid fa-receipt text-info me-1"></i> Tạm Tính (Xem Món)
                                        </button>
                                    </div>
                                    <div class="col-6">
                                        <button type="button" class="btn btn-sm btn-outline-warning w-100 fw-bold rounded-pill" onclick="window.openTransferTableModal(${tableId}, '${tableName}')">
                                            <i class="fa-solid fa-shuffle me-1"></i> Đổi Bàn
                                        </button>
                                    </div>
                                    <div class="col-6">
                                        <button type="button" class="btn btn-sm btn-success w-100 fw-bold rounded-pill" onclick="window.goToMenuForTable('${tableName}', '${orderCode}', ${amount}, ${tableId})">
                                            <i class="fa-solid fa-plus me-1"></i> Gọi Món
                                        </button>
                                    </div>
                                    <div class="col-12">
                                        <button type="button" class="btn btn-sm btn-outline-secondary w-100 fw-bold rounded-pill" onclick="window.clearTable(${tableId}, '${tableName}')">
                                            <i class="fa-solid fa-broom me-1"></i> Dọn Bàn (Trả Bàn Trống)
                                        </button>
                                    </div>
                                </div>
                            ` : `
                                <button type="button" class="btn btn-success w-100 fw-bold rounded-pill py-2 shadow-sm" onclick="window.openTableToOrder(${tableId}, '${tableName}', ${capacity})">
                                    <i class="fa-solid fa-utensils me-1"></i> Mở Bàn / Đặt Món
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 8. Tăng / Giảm số lượng khách ngồi trên bàn trực tiếp
window.stepTableGuests = async function(tableId, delta, event) {
    if (event) event.stopPropagation();
    try {
        const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
        const res = await fetch(`/api/tables/${tableId}/guests`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                delta: delta,
                Staff_username: user.User_name || 'nhanvien'
            })
        });

        const data = await res.json();
        if (data.success) {
            // Cập nhật bộ nhớ cục bộ
            const t = window.allTablesData.find(x => x.Table_id === tableId);
            if (t) {
                t.Current_guests = data.Current_guests;
                t.Status = data.Status;
            }
            renderTablesMap();
            updateTablesKpiCards();

            if (window.toast) {
                window.toast.info(`Bàn đã cập nhật số khách: ${data.Current_guests} người`);
            }
        }
    } catch (e) {
        console.error('Lỗi cập nhật số khách:', e);
    }
};

// 8.5. Đặt chính xác số khách khi bấm vào từng ghế trên sơ đồ
window.setTableGuests = async function(tableId, targetGuests, event) {
    if (event) event.stopPropagation();
    try {
        const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
        const res = await fetch(`/api/tables/${tableId}/guests`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guests: targetGuests,
                Staff_username: user.User_name || 'nhanvien'
            })
        });

        const data = await res.json();
        if (data.success) {
            const t = (window.allTablesData || []).find(x => x.Table_id == tableId);
            if (t) {
                t.Current_guests = data.Current_guests;
                t.Status = data.Status;
            }
            renderTablesMap();
            updateTablesKpiCards();

            if (window.toast) {
                window.toast.info(`Đã chọn ${data.Current_guests} khách ngồi tại bàn`);
            }
        }
    } catch (e) {
        console.error('Lỗi chọn ghế:', e);
    }
};

// ==========================================
// QUẢN LÝ MODAL AN TOÀN & CHỐNG TREO BACKDROP
// ==========================================
window.openTableModalElement = function(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const inst = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        inst.show();
    } else {
        modalEl.classList.add('show');
        modalEl.style.display = 'block';
        document.body.classList.add('modal-open');
    }
};

window.closeTableModal = function(modalId) {
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const inst = bootstrap.Modal.getInstance(modalEl);
            if (inst) {
                try { inst.hide(); } catch (e) {}
            }
        }
        modalEl.classList.remove('show');
        modalEl.style.display = 'none';
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.removeAttribute('aria-modal');
    }
    // Dọn dẹp triệt để backdrop và class overflow của body
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
};

// 9. Mở Bàn Mới / Đặt Món
window.currentOpeningTable = null;
window.openTableToOrder = function(tableId, tableName, capacity) {
    window.currentOpeningTable = { tableId, tableName, capacity };
    const nameEl = document.getElementById('openModalTableName');
    const dispEl = document.getElementById('openModalGuestDisplay');
    const idEl = document.getElementById('openModalTableId');

    if (nameEl) nameEl.innerText = tableName;
    if (dispEl) dispEl.innerText = '2'; // Mặc định 2 khách
    if (idEl) idEl.value = tableId;

    window.openTableModalElement('openTableModal');
};

window.stepOpenGuest = function(delta) {
    const dispEl = document.getElementById('openModalGuestDisplay');
    if (!dispEl) return;
    let val = parseInt(dispEl.innerText, 10) || 2;
    val = Math.max(1, Math.min(50, val + delta));
    dispEl.innerText = val;
};

window.confirmOpenTableAndOrder = async function() {
    const dispEl = document.getElementById('openModalGuestDisplay');
    const guests = parseInt(dispEl?.innerText, 10) || 2;

    if (!window.currentOpeningTable) return;
    const { tableId, tableName } = window.currentOpeningTable;

    // Cập nhật số khách lên server
    try {
        const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
        await fetch(`/api/tables/${tableId}/guests`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guests: guests,
                Staff_username: user.User_name || 'nhanvien'
            })
        });
    } catch (e) {}

    // Đóng Modal an toàn
    window.closeTableModal('openTableModal');

    // Gắn thông tin bàn vào giỏ hàng và điều hướng sang Menu Dạng Thẻ
    window.goToMenuForTable(tableName);
};

// Điều hướng sang Menu Dạng Thẻ và gắn sẵn số bàn (hỗ trợ gọi thêm món cho bàn đang ăn)
window.goToMenuForTable = function(tableName, orderCode, currentAmount, tableId) {
    sessionStorage.setItem('hoasen_selected_table', tableName);
    sessionStorage.removeItem('hoasen_delivery_info');
    if (typeof window.updateOrderContextBanner === 'function') {
        window.updateOrderContextBanner();
    }
    
    if (orderCode && orderCode !== 'null' && orderCode !== 'undefined') {
        sessionStorage.setItem('hoasen_table_active_order_code', orderCode);
        sessionStorage.setItem('hoasen_table_current_amount', currentAmount || 0);
        sessionStorage.setItem('hoasen_is_add_more', '1');
        if (tableId) sessionStorage.setItem('hoasen_selected_table_id', tableId);
        
        if (window.toast) {
            window.toast.info(`Bàn [${tableName}] đang có đơn #${orderCode}. Món chọn sẽ được BỔ SUNG vào đơn này!`);
        }
    } else {
        sessionStorage.removeItem('hoasen_table_active_order_code');
        sessionStorage.removeItem('hoasen_table_current_amount');
        sessionStorage.removeItem('hoasen_is_add_more');
        if (window.toast) {
            window.toast.success(`Đang mở thực đơn cho [${tableName}]. Vui lòng chọn món!`);
        }
    }

    const cartTableInput = document.getElementById('cartTableNumber');
    if (cartTableInput) cartTableInput.value = tableName;

    navigateTo('/menu-cards');
};

// Gọi thêm món trực tiếp từ Modal Phiếu Tạm Tính
window.goToMenuFromPreBill = function() {
    if (!window.currentPreBillData) return;
    const { tableId, tableName, orderCode } = window.currentPreBillData;
    window.closeTableModal('tablePreBillModal');
    window.goToMenuForTable(tableName, orderCode, 0, tableId);
};

// 10. Chuyển Bàn / Đổi Bàn
window.openTransferTableModal = function(fromTableId, fromTableName) {
    const idInput = document.getElementById('transferFromTableId');
    const nameInput = document.getElementById('transferFromTableName');
    const select = document.getElementById('transferToTableSelect');

    if (idInput) idInput.value = fromTableId;
    if (nameInput) nameInput.value = fromTableName;

    // Đổ danh sách các bàn đang trống vào select
    if (select) {
        const emptyTables = (window.allTablesData || []).filter(t => 
            t.Table_id !== fromTableId && 
            t.Status !== 'SERVING' && 
            Number(t.Current_guests || 0) === 0 && 
            !t.Current_order_id
        );

        if (emptyTables.length === 0) {
            select.innerHTML = '<option value="">⚠️ Hiện không có bàn trống nào khác!</option>';
        } else {
            select.innerHTML = '<option value="">-- Chọn bàn trống chuyển đến --</option>' +
                emptyTables.map(t => `<option value="${t.Table_id}">${t.Table_name} (${t.Area} - ${t.Capacity} ghế)</option>`).join('');
        }
    }

    window.openTableModalElement('transferTableModal');
};

window.confirmTransferTable = async function() {
    const fromTableId = document.getElementById('transferFromTableId')?.value;
    const toTableId = document.getElementById('transferToTableSelect')?.value;

    if (!toTableId) {
        if (window.toast) window.toast.warning('Vui lòng chọn bàn trống chuyển đến!');
        return;
    }

    try {
        const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
        const res = await fetch('/api/tables/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromTableId: Number(fromTableId),
                toTableId: Number(toTableId),
                Staff_username: user.User_name || 'nhanvien'
            })
        });

        const data = await res.json();
        if (data.success) {
            window.closeTableModal('transferTableModal');

            if (window.toast) window.toast.success(data.message);
            window.loadTables();
        } else {
            throw new Error(data.error || 'Chuyển bàn thất bại');
        }
    } catch (err) {
        console.error('Lỗi chuyển bàn:', err);
        if (window.toast) window.toast.error('Lỗi chuyển bàn: ' + err.message);
    }
};

// 11. Dọn Bàn / Trả Bàn Trống
window.clearTable = async function(tableId, tableName) {
    const confirmed = (window.toast && typeof window.toast.confirm === 'function')
        ? await window.toast.confirm(`Bạn có chắc muốn dọn dẹp và trả bàn [${tableName}] về trạng thái trống?`, 'Xác nhận dọn bàn')
        : confirm(`Bạn có chắc muốn dọn dẹp và trả bàn [${tableName}] về trạng thái trống?`);

    if (!confirmed) return;

    try {
        const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
        const res = await fetch(`/api/tables/${tableId}/clear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Staff_username: user.User_name || 'nhanvien' })
        });
        const data = await res.json();
        if (data.success) {
            if (window.toast) window.toast.success(data.message);
            window.loadTables();
        }
    } catch (e) {
        console.error('Lỗi dọn bàn:', e);
    }
};

// ==========================================
// 11.5. THANH TOÁN & IN HÓA ĐƠN TRỰC TIẾP TẠI BÀN
// ==========================================
window.tablePayAppliedMember = null;
window.tablePayPointsToUse = 0;
window.tablePaySubtotal = 0;
window.tablePayDiscountPercent = 0;
window.tablePayDiscountAmount = 0;
window.tablePayPointsUsed = 0;
window.tablePayPointsAmount = 0;
window.tablePayPrepaidUsed = 0;
window.tablePayPointsEarned = 0;
window.tablePayFinalTotal = 0;

window.tablePayLookupMember = async function(phoneArg) {
    const phone = phoneArg || document.getElementById('tablePayMemberPhone')?.value?.trim();
    if (!phone) {
        if (window.toast) window.toast.warning('Vui lòng nhập số điện thoại hoặc quét mã QR thẻ thành viên!');
        return;
    }
    try {
        const res = await fetch(`/api/members/lookup?q=${encodeURIComponent(phone)}`);
        const data = await res.json();
        if (!data.success || !data.found) {
            const shortText = phone.length > 30 ? phone.substring(0, 30) + '...' : phone;
            if (window.toast) window.toast.info(`Đã đọc mã: "${shortText}". Chưa có hội viên trùng khớp.`);
            return;
        }
        window.tablePayAppliedMember = data.member;
        window.renderTablePayMemberCard();
        window.updateTablePayBreakdown();
        if (window.toast) window.toast.success(`Đã áp dụng: ${data.member.Full_name} (${data.member.tierInfo?.name || 'Mầm Sen'})`);
    } catch (e) {
        if (window.toast) window.toast.error('Lỗi tra cứu: ' + e.message);
    }
};

window.renderTablePayMemberCard = function() {
    const area = document.getElementById('tablePayMemberAppliedArea');
    const inputGroup = document.getElementById('tablePayMemberInputGroup');
    if (!area) return;

    if (!window.tablePayAppliedMember) {
        area.style.display = 'none';
        area.innerHTML = '';
        if (inputGroup) inputGroup.style.display = 'flex';
        return;
    }

    if (inputGroup) inputGroup.style.display = 'none';
    area.style.display = 'block';

    const m = window.tablePayAppliedMember;
    const t = m.tierInfo || {};
    const b = m.birthdayInfo || {};
    const l = m.lunarInfo || {};

    let bdayBadge = '';
    if (b.isBirthdaySoon) {
        bdayBadge = `<div class="alert alert-danger py-1 px-2 mb-2 small text-center fw-bold rounded-2">🎂 Sinh nhật: ${t.birthdayReward || 'Ưu đãi đặc biệt'}</div>`;
    }

    let lunarBadge = '';
    if (l.isDoublePoints) {
        lunarBadge = `<span class="badge bg-danger text-white py-1 px-2 me-1">🌟 Ngày Chay x2 Điểm</span>`;
    }

    let tierBadge = `<span class="badge bg-success fw-bold px-2 py-1">🌱 Mầm Sen (Tích 3%)</span>`;
    if (m.Current_tier === 'BUP_SEN') tierBadge = `<span class="badge bg-primary fw-bold px-2 py-1">🪷 Búp Sen (Giảm 5% + Tích 3%)</span>`;
    else if (m.Current_tier === 'SEN_HONG') tierBadge = `<span class="badge bg-danger fw-bold px-2 py-1">🌸 Sen Hồng (Giảm 10% + Tích 5%)</span>`;
    else if (m.Current_tier === 'SEN_KIM_CUONG') tierBadge = `<span class="badge fw-bold px-2 py-1 text-white shadow-sm" style="background: linear-gradient(135deg, #6a1b9a, #ffd700);">💎 Sen Kim Cương (Giảm 15% + Tích 5%)</span>`;

    area.innerHTML = `
        ${bdayBadge}
        <div class="p-2 px-3 rounded-3 bg-white border d-flex justify-content-between align-items-center mb-2 shadow-sm">
            <div>
                <div class="fw-bold text-dark d-flex align-items-center gap-1 flex-wrap">
                    <span>${m.Full_name}</span>
                    ${tierBadge}
                    ${lunarBadge}
                </div>
                <div class="small text-muted mt-1">
                    <span class="font-monospace">${m.Phone}</span> | Điểm: <b class="text-dark">${Number(m.Reward_points || 0).toLocaleString()} đ</b> | Ví: <b class="text-success">${Number(m.Prepaid_balance || 0).toLocaleString()} đ</b>
                </div>
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger py-1 px-2 border-0" onclick="window.tablePayRemoveMember()" title="Bỏ áp dụng thẻ">
                <i class="fa-solid fa-xmark fs-5"></i>
            </button>
        </div>

        ${m.Reward_points > 0 ? `
            <div class="p-2 bg-white rounded-3 border d-flex justify-content-between align-items-center mb-1">
                <div class="small">
                    <span class="fw-bold text-dark"><i class="fa-solid fa-coins text-warning me-1"></i>Dùng điểm thưởng</span>
                    <small class="text-muted d-block">(1 điểm = 1.000đ)</small>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <input type="number" id="tablePayPointsInput" class="form-control form-control-sm text-end fw-bold" style="width: 85px;" min="0" max="${m.Reward_points}" value="${window.tablePayPointsToUse || 0}" oninput="window.tablePayHandlePointsChange(this.value)">
                    <button type="button" class="btn btn-sm btn-outline-warning py-1 px-2 text-dark fw-bold" style="font-size: 11px;" onclick="window.tablePayUseMaxPoints()">Tối đa</button>
                </div>
            </div>
        ` : ''}
    `;
};

window.tablePayRemoveMember = function() {
    window.tablePayAppliedMember = null;
    window.tablePayPointsToUse = 0;
    const phoneInput = document.getElementById('tablePayMemberPhone');
    if (phoneInput) phoneInput.value = '';
    window.renderTablePayMemberCard();
    window.updateTablePayBreakdown();
};

window.tablePayHandlePointsChange = function(val) {
    const m = window.tablePayAppliedMember;
    let pts = parseInt(val, 10) || 0;
    if (pts < 0) pts = 0;
    if (m && pts > Number(m.Reward_points || 0)) pts = Number(m.Reward_points || 0);
    window.tablePayPointsToUse = pts;
    window.updateTablePayBreakdown();
};

window.tablePayUseMaxPoints = function() {
    const m = window.tablePayAppliedMember;
    if (!m) return;
    const subtotal = window.tablePaySubtotal || 0;
    const discAmt = Math.round(subtotal * (Number(m.tierInfo?.discountPercent || 0) / 100));
    const payable = Math.max(0, subtotal - discAmt);
    const maxCanUse = Math.min(Number(m.Reward_points || 0), Math.floor(payable / 1000));
    window.tablePayPointsToUse = maxCanUse;
    const inp = document.getElementById('tablePayPointsInput');
    if (inp) inp.value = maxCanUse;
    window.updateTablePayBreakdown();
};

window.updateTablePayBreakdown = function() {
    const subtotal = window.tablePaySubtotal || 0;
    const subtotalEl = document.getElementById('paySubtotalDisplay');
    if (subtotalEl) subtotalEl.innerText = subtotal.toLocaleString('vi-VN') + ' đ';

    const m = window.tablePayAppliedMember;
    const selectedMethod = document.querySelector('input[name="tablePayMethod"]:checked')?.value || 'CASH';

    let discountPercent = 0;
    let discountAmount = 0;
    let pointsUsed = 0;
    let pointsAmount = 0;
    let prepaidUsed = 0;
    let pointsEarned = 0;

    if (m) {
        const t = m.tierInfo || {};
        discountPercent = Number(t.discountPercent || 0);
        discountAmount = Math.round(subtotal * (discountPercent / 100));
        const amountAfterDiscount = Math.max(0, subtotal - discountAmount);

        const maxPointsCanUse = Math.min(Number(m.Reward_points || 0), Math.floor(amountAfterDiscount / 1000));
        pointsUsed = Math.min(Number(window.tablePayPointsToUse || 0), maxPointsCanUse);
        pointsAmount = pointsUsed * 1000;
        let amountAfterPoints = Math.max(0, amountAfterDiscount - pointsAmount);

        if (selectedMethod === 'PREPAID') {
            prepaidUsed = Math.min(Number(m.Prepaid_balance || 0), amountAfterPoints);
            amountAfterPoints = Math.max(0, amountAfterPoints - prepaidUsed);
        }

        const actualPointRate = Number(t.actualPointRate || t.pointRate || 0.03);
        pointsEarned = Math.floor((amountAfterDiscount * actualPointRate) / 1000);

        // Row discount
        const discRow = document.getElementById('tablePayDiscountRow');
        const discLbl = document.getElementById('tablePayDiscountLabel');
        const discAmt = document.getElementById('tablePayDiscountAmount');
        if (discRow) {
            if (discountAmount > 0) {
                discRow.style.display = 'flex';
                if (discLbl) discLbl.innerText = `Giảm giá ${t.name || 'Hội viên'} (-${discountPercent}%):`;
                if (discAmt) discAmt.innerText = `-${discountAmount.toLocaleString('vi-VN')} đ`;
            } else {
                discRow.style.display = 'none';
            }
        }

        // Row points
        const ptsRow = document.getElementById('tablePayPointsRow');
        const ptsLbl = document.getElementById('tablePayPointsLabel');
        const ptsAmt = document.getElementById('tablePayPointsAmount');
        if (ptsRow) {
            if (pointsAmount > 0) {
                ptsRow.style.display = 'flex';
                if (ptsLbl) ptsLbl.innerText = `Trừ điểm thưởng (${pointsUsed} điểm):`;
                if (ptsAmt) ptsAmt.innerText = `-${pointsAmount.toLocaleString('vi-VN')} đ`;
            } else {
                ptsRow.style.display = 'none';
            }
        }

        // Row prepaid
        const prepRow = document.getElementById('tablePayPrepaidRow');
        const prepAmt = document.getElementById('tablePayPrepaidAmount');
        if (prepRow) {
            if (prepaidUsed > 0) {
                prepRow.style.display = 'flex';
                if (prepAmt) prepAmt.innerText = `-${prepaidUsed.toLocaleString('vi-VN')} đ`;
            } else {
                prepRow.style.display = 'none';
            }
        }

        // Notice earn
        const earnNotice = document.getElementById('tablePayPointsEarnNotice');
        if (earnNotice) {
            const doubleText = (t.isDoublePoints || m.lunarInfo?.isDoublePoints) ? ' <span class="badge bg-danger">x2 Ngày Chay</span>' : '';
            earnNotice.innerHTML = `✨ Tích lũy khi thanh toán: <b>+${pointsEarned} điểm</b>${doubleText}`;
        }

        window.tablePayFinalTotal = amountAfterPoints;
    } else {
        const discRow = document.getElementById('tablePayDiscountRow');
        if (discRow) discRow.style.display = 'none';
        const ptsRow = document.getElementById('tablePayPointsRow');
        if (ptsRow) ptsRow.style.display = 'none';
        const prepRow = document.getElementById('tablePayPrepaidRow');
        if (prepRow) prepRow.style.display = 'none';
        const earnNotice = document.getElementById('tablePayPointsEarnNotice');
        if (earnNotice) earnNotice.innerHTML = '';
        window.tablePayFinalTotal = subtotal;
    }

    window.tablePayDiscountPercent = discountPercent;
    window.tablePayDiscountAmount = discountAmount;
    window.tablePayPointsUsed = pointsUsed;
    window.tablePayPointsAmount = pointsAmount;
    window.tablePayPointsEarned = pointsEarned;
    window.tablePayPrepaidUsed = prepaidUsed;

    const amountEl = document.getElementById('payAmountDisplay');
    if (amountEl) {
        amountEl.innerText = `${(window.tablePayFinalTotal || 0).toLocaleString('vi-VN')} đ`;
    }
};

window.payTableBill = async function(tableId, tableName, amount, orderCode) {
    const table = (window.allTablesData || []).find(t => t.Table_id == tableId);
    const finalAmount = (amount !== undefined && amount !== null && amount !== '') ? Number(amount) : (table ? Number(table.Current_amount || 0) : 0);
    const finalCode = orderCode || table?.Current_order_code || (table?.Current_order_id ? `#${table.Current_order_id}` : '');

    const idInput = document.getElementById('payTableId');
    const orderInput = document.getElementById('payOrderIdentifier');
    const nameEl = document.getElementById('payTableName');
    const codeEl = document.getElementById('payOrderCodeDisplay');
    const staffEl = document.getElementById('tablePayStaffName');
    const cashRadio = document.getElementById('tablePayMethodCash');
    const qrArea = document.getElementById('tablePayQrArea');

    if (idInput) idInput.value = tableId;
    if (orderInput) orderInput.value = finalCode;
    if (nameEl) nameEl.innerText = tableName;
    if (codeEl) codeEl.innerText = finalCode ? `Mã đơn: ${finalCode}` : 'Chưa có mã đơn';

    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    if (staffEl) staffEl.innerText = user.Full_name || user.User_name || 'Nhân viên';

    if (cashRadio) cashRadio.checked = true;
    if (qrArea) qrArea.style.display = 'none';

    window.tablePayAppliedMember = null;
    window.tablePayPointsToUse = 0;
    window.tablePaySubtotal = finalAmount;
    window.renderTablePayMemberCard();
    window.updateTablePayBreakdown();

    // Nếu đơn hàng đã có số điện thoại khách hàng, tự động tra cứu thành viên
    if (finalCode) {
        try {
            const cleanCode = String(finalCode).replace('#', '').trim();
            const res = await fetch(`/api/orders`);
            if (res.ok) {
                const orders = await res.json();
                const matched = (orders || []).find(o => o.Order_code === cleanCode || String(o.Order_id) === cleanCode);
                if (matched && (matched.Member_phone || matched.Customer_phone)) {
                    await window.tablePayLookupMember(matched.Member_phone || matched.Customer_phone);
                }
            }
        } catch(e) {}
    }

    window.openTableModalElement('tablePaymentModal');
};

window.handleTablePayMethodChange = async function(method) {
    const qrArea = document.getElementById('tablePayQrArea');
    window.updateTablePayBreakdown();
    if (!qrArea) return;

    if (method === 'BANK_TRANSFER') {
        qrArea.style.display = 'block';

        let sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        if (!sysConfig.qrAccountNo && !sysConfig.qrImageUrl) {
            try {
                const res = await fetch('/api/system-config');
                if (res.ok) {
                    const data = await res.json();
                    sysConfig = { ...sysConfig, ...data };
                    localStorage.setItem('hoasen_system_config', JSON.stringify(sysConfig));
                }
            } catch (e) {}
        }

        const tableId = document.getElementById('payTableId')?.value;
        const table = (window.allTablesData || []).find(t => t.Table_id == tableId);
        const amount = (window.tablePayFinalTotal !== undefined) ? window.tablePayFinalTotal : (table ? Number(table.Current_amount || 0) : 0);
        const tableName = document.getElementById('payTableName')?.innerText || 'Bàn Khách';

        const bankName = sysConfig.qrBank || 'MBBANK';
        const accountNo = sysConfig.qrAccountNo || '123456789';
        const accountName = sysConfig.qrAccountName || 'NHA HANG CHAY HOA SEN';

        let qrSrc = sysConfig.qrImageUrl;
        if (!qrSrc && sysConfig.qrAccountNo) {
            qrSrc = `https://img.vietqr.io/image/${bankName}-${accountNo}-compact2.png?amount=${amount}&addInfo=Ban%20${encodeURIComponent(tableName)}&accountName=${encodeURIComponent(accountName)}`;
        } else if (!qrSrc) {
            qrSrc = `https://img.vietqr.io/image/970422-123456789-compact2.png?amount=${amount}&addInfo=Ban%20${encodeURIComponent(tableName)}`;
        }

        const qrImg = document.getElementById('tablePayQrImage');
        if (qrImg) qrImg.src = qrSrc;

        const infoEl = document.getElementById('tablePayBankInfo');
        if (infoEl) {
            infoEl.innerHTML = `Ngân hàng: <b>${bankName}</b> | STK: <b class="text-primary font-monospace">${accountNo}</b><br>Chủ TK: <b>${accountName}</b>`;
        }
    } else {
        qrArea.style.display = 'none';
    }
};

window.confirmTablePayment = async function() {
    const tableId = document.getElementById('payTableId')?.value;
    const orderIdentifier = document.getElementById('payOrderIdentifier')?.value;
    const method = document.querySelector('input[name="tablePayMethod"]:checked')?.value || 'CASH';
    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');

    if (!tableId) return;

    if (method === 'PREPAID' && !window.tablePayAppliedMember) {
        if (window.toast) window.toast.warning('Vui lòng áp dụng Thẻ thành viên để thanh toán bằng Ví Trả Trước!');
        return;
    }

    try {
        let success = false;
        let message = '';

        const m = window.tablePayAppliedMember;
        const payload = {
            Staff_username: user.User_name || 'nhanvien',
            Staff_name: user.Full_name || user.User_name || 'Nhân viên',
            Staff_role: user.Role || 'WAITER',
            Payment_method: method,
            Member_id: m ? m.Member_id : null,
            Member_phone: m ? m.Phone : null,
            Member_name: m ? m.Full_name : null,
            Member_tier: m ? m.Current_tier : null,
            Discount_percent: window.tablePayDiscountPercent || 0,
            Discount_amount: window.tablePayDiscountAmount || 0,
            Points_used: window.tablePayPointsUsed || 0,
            Points_amount: window.tablePayPointsAmount || 0,
            Prepaid_used: window.tablePayPrepaidUsed || 0,
            Final_amount: (window.tablePayFinalTotal !== undefined) ? window.tablePayFinalTotal : null
        };

        // 1. Gọi API thanh toán bàn chuyên dụng
        const res = await fetch(`/api/tables/${tableId}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
            success = true;
            message = data.message;
        } else if (orderIdentifier) {
            // Dự phòng gọi endpoint confirm-payment của orders
            const res2 = await fetch(`/api/orders/${encodeURIComponent(orderIdentifier)}/confirm-payment`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data2 = await res2.json();
            if (data2.success) {
                success = true;
                message = data2.message;
            }
        }

        if (success) {
            window.closeTableModal('tablePaymentModal');

            // Cập nhật bộ nhớ cục bộ
            const t = (window.allTablesData || []).find(x => x.Table_id == tableId);
            if (t) {
                t.Payment_status = 'PAID';
            }
            renderTablesMap();
            updateTablesKpiCards();

            if (window.toast) {
                window.toast.success(message || 'Đã xác nhận thanh toán thành công!');
            }
        } else {
            throw new Error(data.error || 'Thanh toán không thành công');
        }
    } catch (err) {
        console.error('Lỗi xác nhận thanh toán:', err);
        if (window.toast) window.toast.error('Lỗi thanh toán: ' + err.message);
    }
};

window.printTableBill = async function(tableId, tableName, orderCode) {
    let finalCode = orderCode;
    if (!finalCode && tableId) {
        const table = (window.allTablesData || []).find(t => t.Table_id == tableId);
        finalCode = table?.Current_order_code || (table?.Current_order_id ? `#CHAY-${table.Current_order_id}` : '');
    }

    if (!finalCode && tableName) {
        try {
            const resAll = await fetch('/api/orders');
            const allOrders = await resAll.json();
            if (Array.isArray(allOrders)) {
                const matched = allOrders.find(o => {
                    const oTable = String(o.Table_number || o.Table_name || '').toLowerCase().trim();
                    const tName = String(tableName || '').toLowerCase().trim();
                    const isNotCanceled = !['CANCELLED', 'CANCELED'].includes(String(o.Status).toUpperCase());
                    return isNotCanceled && (oTable === tName || oTable.includes(tName) || tName.includes(oTable));
                });
                if (matched) finalCode = matched.Order_code || matched.Order_id;
            }
        } catch(e) {}
    }

    if (finalCode && typeof window.printOrderBill === 'function') {
        await window.printOrderBill(finalCode);
        return;
    }

    try {
        const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        const resName = sysConfig.resName || 'NHÀ HÀNG CHAY HOA SEN';
        const resAddr = sysConfig.resAddr || '36 Phạm Văn Sáng, Hóc Môn, TP.HCM';
        const resPhone = sysConfig.resPhone || '0901 234 567';
        const billFooter = sysConfig.billFooter || 'Kính chúc Quý Khách An Lạc & An Nhiên!\nXin cảm ơn & Hẹn gặp lại Quý Khách!';

        const table = (window.allTablesData || []).find(t => t.Table_id == tableId);
        const amount = table ? Number(table.Current_amount || 0) : 0;
        const now = new Date().toLocaleString('vi-VN');

        const printWin = window.open('', '_blank', 'width=380,height=600');
        if (!printWin) {
            if (window.toast) window.toast.warning('Trình duyệt đang chặn cửa sổ in (popup). Vui lòng cho phép mở popup!');
            return;
        }

        printWin.document.write(`
            <html>
            <head>
                <title>Hóa Đơn - ${tableName}</title>
                <style>
                    body { font-family: 'Courier New', monospace; font-size: 13px; margin: 0; padding: 15px; color: #000; width: 300px; }
                    .center { text-align: center; }
                    .line { border-bottom: 1px dashed #000; margin: 8px 0; }
                    .row { display: flex; justify-content: space-between; margin: 4px 0; }
                    .bold { font-weight: bold; }
                    .total { font-size: 16px; font-weight: bold; }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                <div class="center bold" style="font-size: 15px;">${resName}</div>
                <div class="center" style="font-size: 11px;">${resAddr}</div>
                <div class="center" style="font-size: 11px;">Hotline: ${resPhone}</div>
                <div class="line"></div>
                <div class="center bold" style="font-size: 14px;">PHIẾU THANH TOÁN</div>
                <div class="row"><span>Bàn:</span><span class="bold">${tableName}</span></div>
                ${orderCode ? `<div class="row"><span>Mã đơn:</span><span>#${orderCode}</span></div>` : ''}
                <div class="row"><span>Thời gian:</span><span>${now}</span></div>
                <div class="row"><span>Trạng thái:</span><span class="bold">ĐÃ THANH TOÁN</span></div>
                <div class="line"></div>
                <div class="row total"><span>TỔNG TIỀN:</span><span>${amount.toLocaleString('vi-VN')} đ</span></div>
                <div class="line"></div>
                <div class="center" style="font-size: 11px; white-space: pre-line; margin-top: 10px;">${billFooter}</div>
            </body>
            </html>
        `);
        printWin.document.close();
    } catch (e) {
        console.error('Lỗi in hóa đơn:', e);
    }
};

// ==========================================
// 11.6. XEM PHIẾU TẠM TÍNH (DANH SÁCH MÓN TẠI BÀN)
// ==========================================
window.currentPreBillData = null;

window.showTablePreBill = async function(tableId, tableName, orderCode) {
    const table = (window.allTablesData || []).find(t => t.Table_id == tableId);
    const amount = Number(table?.Current_amount || 0);
    const finalCode = orderCode || table?.Current_order_code || (table?.Current_order_id ? `#CHAY-${table.Current_order_id}` : '');
    const isPaid = (String(table?.Payment_status || '').toUpperCase() === 'PAID');

    // Cập nhật thông tin tiêu đề
    const nameEl = document.getElementById('preBillTableName');
    const areaEl = document.getElementById('preBillAreaCapacity');
    const codeEl = document.getElementById('preBillOrderCode');
    const timeEl = document.getElementById('preBillTime');
    const tbody = document.getElementById('preBillItemsTbody');
    const totalEl = document.getElementById('preBillTotalAmount');
    const statusBadge = document.getElementById('preBillPayStatusBadge');
    const payBtn = document.getElementById('preBillPayBtn');

    if (nameEl) nameEl.innerText = tableName;
    if (areaEl) areaEl.innerText = `Khu vực: ${table?.Area || 'Tầng 1'} | Sức chứa: ${table?.Capacity || 4} ghế | Đang ngồi: ${table?.Current_guests || 0} khách`;
    if (codeEl) codeEl.innerText = finalCode ? (finalCode.startsWith('#') ? finalCode : `#${finalCode}`) : 'Chưa có mã đơn';
    if (totalEl) totalEl.innerText = `${amount.toLocaleString('vi-VN')} đ`;
    
    if (statusBadge) {
        statusBadge.className = isPaid ? 'badge bg-success fs-6' : 'badge bg-danger fs-6';
        statusBadge.innerText = isPaid ? 'ĐÃ THU TIỀN' : 'CHƯA THANH TOÁN';
    }

    if (payBtn) {
        payBtn.style.display = isPaid ? 'none' : 'inline-block';
    }

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4 text-muted">
                    <i class="fa-solid fa-spinner fa-spin fa-2x text-info mb-2"></i>
                    <div>Đang tải danh sách món ăn từ đơn hàng...</div>
                </td>
            </tr>
        `;
    }

    window.openTableModalElement('tablePreBillModal');

    // Tải chi tiết đơn hàng
    let orderDetail = null;
    const cleanCode = finalCode.replace('#', '').trim();

    try {
        if (cleanCode) {
            const res = await fetch(`/api/orders/${encodeURIComponent(cleanCode)}`);
            const data = await res.json();
            if (data.success && data.order) {
                orderDetail = data.order;
            }
        }

        if (!orderDetail) {
            // Thử tìm theo danh sách tất cả đơn
            const resAll = await fetch('/api/orders');
            const allOrders = await resAll.json();
            if (Array.isArray(allOrders)) {
                orderDetail = allOrders.find(o => {
                    const oTable = String(o.Table_number || o.Table_name || '').toLowerCase().trim();
                    const tName = String(tableName).toLowerCase().trim();
                    const isNotCompleted = !['COMPLETED', 'SERVED', 'CANCELLED', 'CANCELED'].includes(String(o.Status).toUpperCase());
                    return isNotCompleted && (oTable === tName || oTable.includes(tName) || tName.includes(oTable));
                });
            }
        }
    } catch (err) {
        console.error('Lỗi nạp đơn hàng tạm tính:', err);
    }

    window.currentPreBillData = {
        tableId,
        tableName,
        orderCode: finalCode,
        amount,
        isPaid,
        order: orderDetail
    };

    if (timeEl && orderDetail?.Created_at) {
        timeEl.innerText = `Giờ gọi món: ${orderDetail.Created_at}`;
    }

    if (!tbody) return;

    const items = Array.isArray(orderDetail?.items) ? orderDetail.items : (Array.isArray(orderDetail?.Items) ? orderDetail.Items : []);
    
    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4 text-muted">
                    <i class="fa-solid fa-utensils fa-2x mb-2 text-secondary"></i>
                    <div class="fw-bold">Chưa có chi tiết danh sách món cho bàn này.</div>
                    <small class="text-muted">Tổng tiền tạm tính trên hệ thống: <b>${amount.toLocaleString('vi-VN')} đ</b></small>
                </td>
            </tr>
        `;
        return;
    }

    let calculatedTotal = 0;
    tbody.innerHTML = items.map((item, idx) => {
        const name = item.Item_name || item.name || 'Món chay';
        const qty = Number(item.Quantity || item.quantity || 1);
        const price = Number(item.Unit_price || item.price || 0);
        const lineTotal = Number(item.Total_price || (qty * price));
        calculatedTotal += lineTotal;
        const note = item.Note || item.note || '';
        const toppings = item.Toppings || item.toppings || '';

        return `
            <tr>
                <td class="text-center fw-bold text-secondary">${idx + 1}</td>
                <td>
                    <div class="fw-bold text-dark">${name}</div>
                    ${toppings ? `<div class="small text-success"><i class="fa-solid fa-circle-plus me-1"></i>Topping: ${toppings}</div>` : ''}
                    ${note ? `<div class="small text-danger fw-semibold"><i class="fa-solid fa-note-sticky me-1"></i>Ghi chú: ${note}</div>` : ''}
                </td>
                <td class="text-center">
                    <span class="badge bg-primary fs-6 px-2 py-1">x${qty}</span>
                </td>
                <td class="text-end text-muted">${price.toLocaleString('vi-VN')} đ</td>
                <td class="text-end fw-bold text-success">${lineTotal.toLocaleString('vi-VN')} đ</td>
            </tr>
        `;
    }).join('');

    const finalSum = calculatedTotal > 0 ? calculatedTotal : amount;
    if (totalEl) totalEl.innerText = `${finalSum.toLocaleString('vi-VN')} đ`;
    if (window.currentPreBillData) window.currentPreBillData.amount = finalSum;
};

// Chuyển từ Modal Tạm Tính sang Thanh Toán
window.payFromPreBillModal = function() {
    if (!window.currentPreBillData) return;
    const { tableId, tableName, amount, orderCode } = window.currentPreBillData;
    window.closeTableModal('tablePreBillModal');
    setTimeout(() => {
        window.payTableBill(tableId, tableName, amount, orderCode);
    }, 200);
};

// In Phiếu Tạm Tính
window.printPreBillFromModal = function() {
    if (!window.currentPreBillData) return;
    const { tableName, orderCode, amount, order } = window.currentPreBillData;
    const items = Array.isArray(order?.items) ? order.items : [];

    const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
    const resName = sysConfig.resName || 'NHÀ HÀNG CHAY HOA SEN';
    const resAddr = sysConfig.resAddr || '36 Phạm Văn Sáng, Hóc Môn, TP.HCM';
    const resPhone = sysConfig.resPhone || '0901 234 567';
    const billFooter = sysConfig.billFooter || 'Kính chúc Quý Khách An Lạc & An Nhiên!\nXin cảm ơn & Hẹn gặp lại Quý Khách!';
    const now = new Date().toLocaleString('vi-VN');

    let itemsRows = '';
    if (items.length > 0) {
        itemsRows = items.map((it, idx) => {
            const name = it.Item_name || it.name || 'Món chay';
            const qty = it.Quantity || it.quantity || 1;
            const price = Number(it.Unit_price || it.price || 0);
            const total = Number(it.Total_price || (qty * price));
            const note = it.Note || it.note || '';
            const toppings = it.Toppings || it.toppings || '';
            const toppingsLine = toppings ? `<div style="font-size: 11px; color: #555; padding-left: 8px;">+ ${toppings}</div>` : '';
            const noteLine = note ? `<div style="font-size: 11px; font-style: italic; color: #333; padding-left: 8px;">- Ghi chú: ${note}</div>` : '';

            return `
                <tr>
                    <td style="padding: 4px 0; text-align: left; vertical-align: top;">
                        <div><b>${idx + 1}. ${name}</b></div>
                        ${toppingsLine}
                        ${noteLine}
                    </td>
                    <td style="padding: 4px 0; text-align: center; vertical-align: top; font-weight: bold;">${qty}</td>
                    <td style="padding: 4px 0; text-align: right; vertical-align: top;">${price.toLocaleString('vi-VN')}</td>
                    <td style="padding: 4px 0; text-align: right; vertical-align: top; font-weight: bold;">${total.toLocaleString('vi-VN')}</td>
                </tr>
            `;
        }).join('');
    } else {
        itemsRows = `<tr><td colspan="4" style="text-align: center; padding: 10px;">Tổng tiền tạm tính: ${amount.toLocaleString('vi-VN')} đ</td></tr>`;
    }

    const printWin = window.open('', '_blank', 'width=380,height=600');
    if (!printWin) {
        if (window.toast) window.toast.warning('Trình duyệt chặn mở popup in. Vui lòng cho phép mở popup!');
        return;
    }

    printWin.document.write(`
        <html>
        <head>
            <title>Phiếu Tạm Tính - ${tableName}</title>
            <style>
                body { font-family: 'Courier New', monospace; font-size: 13px; margin: 0; padding: 12px; color: #000; width: 300px; }
                .center { text-align: center; }
                .line { border-bottom: 1px dashed #000; margin: 8px 0; }
                .row { display: flex; justify-content: space-between; margin: 3px 0; }
                .bold { font-weight: bold; }
                table { width: 100%; border-collapse: collapse; margin: 6px 0; }
                th { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; font-size: 12px; }
                .total { font-size: 16px; font-weight: bold; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <div class="center bold" style="font-size: 15px;">${resName}</div>
            <div class="center" style="font-size: 11px;">${resAddr}</div>
            <div class="center" style="font-size: 11px;">Hotline: ${resPhone}</div>
            <div class="line"></div>
            <div class="center bold" style="font-size: 15px;">PHIẾU TẠM TÍNH</div>
            <div class="row"><span>Bàn:</span><span class="bold">${tableName}</span></div>
            ${orderCode ? `<div class="row"><span>Mã đơn:</span><span>#${orderCode}</span></div>` : ''}
            <div class="row"><span>Thời gian in:</span><span>${now}</span></div>
            <div class="line"></div>
            <table>
                <thead>
                    <tr>
                        <th style="text-align: left;">Món</th>
                        <th style="text-align: center; width: 30px;">SL</th>
                        <th style="text-align: right; width: 65px;">Đơn giá</th>
                        <th style="text-align: right; width: 75px;">T.Tiền</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows}
                </tbody>
            </table>
            <div class="line"></div>
            <div class="row total"><span>TỔNG TIỀN:</span><span>${amount.toLocaleString('vi-VN')} đ</span></div>
            <div class="line"></div>
            <div class="center" style="font-size: 11px; white-space: pre-line; margin-top: 8px;">${billFooter}</div>
            <div class="center" style="font-size: 10px; font-style: italic; margin-top: 4px;">(Phiếu này chưa phải là hóa đơn thanh toán)</div>
        </body>
        </html>
    `);
    printWin.document.close();
};

// 12. Thống Kê Lượng Khách Theo Thời Gian (Guest Analytics & Chart.js)
window.filterGuestStats = function(timeRange) {
    window.currentGuestTimeFilter = timeRange;
    document.querySelectorAll('#tab-guest-stats .btn-group-sm button').forEach(b => b.classList.remove('active'));

    if (timeRange === 'TODAY') document.getElementById('btnGuestToday')?.classList.add('active');
    if (timeRange === 'WEEK') document.getElementById('btnGuestWeek')?.classList.add('active');
    if (timeRange === 'MONTH') document.getElementById('btnGuestMonth')?.classList.add('active');

    window.loadGuestStats(timeRange);
};

window.loadGuestStats = async function(timeRange = 'TODAY') {
    try {
        const res = await fetch(`/api/tables/guest-stats?timeRange=${timeRange}&t=${Date.now()}`);
        if (!res.ok) throw new Error('Không thể tải thống kê');
        const data = await res.json();

        if (data.success && data.summary) {
            const s = data.summary;
            const totalGuestsEl = document.getElementById('statTotalGuests');
            const peakHourEl = document.getElementById('statPeakHour');
            const avgSpendEl = document.getElementById('statAvgSpend');
            const totalOrdersEl = document.getElementById('statTotalOrders');

            if (totalGuestsEl) totalGuestsEl.innerText = s.totalGuestsInPeriod || 0;
            if (peakHourEl) peakHourEl.innerText = s.peakHour || '--:--';
            if (avgSpendEl) avgSpendEl.innerText = (s.avgSpendPerGuest || 0).toLocaleString('vi-VN') + ' đ';
            if (totalOrdersEl) totalOrdersEl.innerText = s.totalOrdersInPeriod || 0;

            renderGuestHourlyChart(data.hourlyDistribution || []);
        }
    } catch (err) {
        console.error('Lỗi tải thống kê lượng khách:', err);
    }
};

function renderGuestHourlyChart(hourlyData) {
    const canvas = document.getElementById('guestHourlyChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (window.guestStatsChartInstance) {
        window.guestStatsChartInstance.destroy();
    }

    const labels = Array.from({ length: 24 }, (_, i) => `${i}h`);

    window.guestStatsChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Lượng Khách (Người)',
                data: hourlyData,
                backgroundColor: 'rgba(25, 135, 84, 0.75)',
                borderColor: '#198754',
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` Khách đón: ${context.parsed.y} người`;
                        }
                    }
                }
            }
        }
    });
}

// 13. Quản Lý Danh Sách Bàn (CRUD)
function renderTablesManageTable() {
    const tbody = document.getElementById('tablesManageTableBody');
    if (!tbody) return;

    const tables = window.allTablesData || [];
    if (tables.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Chưa có bàn nào trong hệ thống</td></tr>`;
        return;
    }

    tbody.innerHTML = tables.map(t => {
        return `
            <tr>
                <td class="fw-bold">${t.Table_code}</td>
                <td><span class="fw-bold text-success">${t.Table_name}</span></td>
                <td><span class="badge bg-light text-secondary border">${t.Area}</span></td>
                <td class="text-center fw-bold fs-6 text-primary">${t.Capacity} ghế</td>
                <td class="text-center text-muted">${t.Sort_order || 0}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="window.openEditTableModal(${t.Table_id})" title="Sửa thông tin bàn">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="window.deleteTable(${t.Table_id}, '${t.Table_name}')" title="Xóa bàn">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Mở Modal Thêm Bàn
window.openAddTableModal = function() {
    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const roleUpper = String(user.Role || '').toUpperCase();
    const isAdmin = roleUpper === 'ADMIN' || roleUpper === 'QUẢN LÝ' || roleUpper === 'MANAGER';
    const canManage = isAdmin || ((typeof window.hasPermission === 'function') ? window.hasPermission(user, 'TABLES_MANAGE') : false);
    if (!canManage) {
        if (window.toast) window.toast.warning('Tài khoản phục vụ của bạn chưa được cấp quyền Thêm / Quản lý bàn!');
        return;
    }

    document.getElementById('tableEditModalTitle').innerHTML = '<i class="fa-solid fa-chair me-2"></i>Thêm Bàn Mới';
    document.getElementById('editTableId').value = '';
    document.getElementById('editTableCode').value = '';
    document.getElementById('editTableName').value = '';
    document.getElementById('editTableArea').value = 'Tầng 1';
    document.getElementById('editTableCapacity').value = '4';
    document.getElementById('editTableSortOrder').value = (window.allTablesData?.length || 0) + 1;

    window.openTableModalElement('tableEditModal');
};

// Mở Modal Sửa Bàn
window.openEditTableModal = function(tableId) {
    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const roleUpper = String(user.Role || '').toUpperCase();
    const isAdmin = roleUpper === 'ADMIN' || roleUpper === 'QUẢN LÝ' || roleUpper === 'MANAGER';
    const canManage = isAdmin || ((typeof window.hasPermission === 'function') ? window.hasPermission(user, 'TABLES_MANAGE') : false);
    if (!canManage) {
        if (window.toast) window.toast.warning('Tài khoản phục vụ của bạn chưa được cấp quyền Sửa thông tin bàn!');
        return;
    }

    const table = (window.allTablesData || []).find(t => t.Table_id === tableId);
    if (!table) return;

    document.getElementById('tableEditModalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square me-2"></i>Sửa Bàn: ${table.Table_name}`;
    document.getElementById('editTableId').value = table.Table_id;
    document.getElementById('editTableCode').value = table.Table_code;
    document.getElementById('editTableName').value = table.Table_name;
    document.getElementById('editTableArea').value = table.Area || 'Tầng 1';
    document.getElementById('editTableCapacity').value = table.Capacity || 4;
    document.getElementById('editTableSortOrder').value = table.Sort_order || 1;

    window.openTableModalElement('tableEditModal');
};

// Lưu Thông Tin Bàn (Thêm / Sửa)
window.saveTableInfo = async function() {
    const tableId = document.getElementById('editTableId')?.value;
    const Table_code = document.getElementById('editTableCode')?.value?.trim();
    const Table_name = document.getElementById('editTableName')?.value?.trim();
    const Area = document.getElementById('editTableArea')?.value;
    const Capacity = parseInt(document.getElementById('editTableCapacity')?.value || 4, 10);
    const Sort_order = parseInt(document.getElementById('editTableSortOrder')?.value || 1, 10);

    if (!Table_name) {
        if (window.toast) window.toast.warning('Tên bàn không được để trống!');
        return;
    }

    try {
        let res;
        if (tableId) {
            // Sửa bàn
            res = await fetch(`/api/tables/${tableId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Table_code, Table_name, Area, Capacity, Sort_order })
            });
        } else {
            // Thêm bàn mới
            res = await fetch('/api/tables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Table_code, Table_name, Area, Capacity, Sort_order })
            });
        }

        const data = await res.json();
        if (data.success) {
            window.closeTableModal('tableEditModal');

            if (window.toast) window.toast.success(data.message);
            window.loadTables();
        } else {
            throw new Error(data.error || 'Lỗi lưu thông tin bàn');
        }
    } catch (err) {
        console.error('Lỗi lưu bàn:', err);
        if (window.toast) window.toast.error('Lỗi: ' + err.message);
    }
};

// Xóa Bàn
window.deleteTable = async function(tableId, tableName) {
    const confirmed = (window.toast && typeof window.toast.confirm === 'function')
        ? await window.toast.confirm(`Bạn có chắc chắn muốn xóa bàn [${tableName}]?`, 'Xác nhận xóa bàn')
        : confirm(`Bạn có chắc chắn muốn xóa bàn [${tableName}]?`);

    if (!confirmed) return;

    try {
        const res = await fetch(`/api/tables/${tableId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            if (window.toast) window.toast.success(data.message);
            window.loadTables();
        } else {
            throw new Error(data.error || 'Xóa bàn thất bại');
        }
    } catch (err) {
        console.error('Lỗi xóa bàn:', err);
        if (window.toast) window.toast.error('Lỗi xóa bàn: ' + err.message);
    }
};

