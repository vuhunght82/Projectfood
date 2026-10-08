window.initMenu = async function() {
    // Nạp danh mục xong hoàn toàn mới nạp bảng món ăn
    await loadCategoriesToSelect();
    await loadMenuItemsTable();
    setupMenuFormSubmit();
};

// Hàm hiển thị thông báo Toast / Alert an toàn
function notify(message, type = 'success') {
    if (window.toast && typeof window.toast[type] === 'function') {
        window.toast[type](message);
    } else if (typeof showToast === 'function') {
        showToast(message, type);
    } else if (window.Toast && typeof window.Toast[type] === 'function') {
        window.Toast[type](message);
    }
}

// 1. Nạp danh mục vào CẢ 2 Combobox (Select ở Form & Select Lọc)
async function loadCategoriesToSelect() {
    try {
        const res = await fetch('/api/categories');
        if (!res.ok) throw new Error('Không thể lấy danh mục từ server');
        const categories = await res.json();
        
        const formSelect = document.getElementById('itemCategorySelect');
        const filterSelect = document.getElementById('filterCategorySelect');

        let optionsHtml = '<option value="">-- Chọn danh mục --</option>';
        let filterHtml = '<option value="all">Tất cả danh mục</option>';

        if (Array.isArray(categories)) {
            categories.forEach(cat => {
                const id = cat.Category_id ?? cat.id;
                const name = cat.Category_name ?? cat.name;
                optionsHtml += `<option value="${id}">${name}</option>`;
                filterHtml += `<option value="${id}">${name}</option>`;
            });
        }

        if (formSelect) formSelect.innerHTML = optionsHtml;
        if (filterSelect) filterSelect.innerHTML = filterHtml;
        
        return categories;
    } catch (err) {
        console.error('Lỗi nạp danh mục:', err);
        const formSelect = document.getElementById('itemCategorySelect');
        if (formSelect) formSelect.innerHTML = '<option value="">-- Lỗi tải danh mục --</option>';
    }
}

// 2. Nạp dữ liệu món ăn từ API
async function loadMenuItemsTable() {
    try {
        const res = await fetch('/api/menu');
        if (!res.ok) throw new Error('Không thể lấy danh sách món ăn');
        const items = await res.json();
        
        window.allMenuItemsCache = Array.isArray(items) ? items : [];
        renderMenuTableData(window.allMenuItemsCache);

    } catch (err) {
        console.error('Lỗi nạp danh sách món ăn:', err);
        notify('Lỗi nạp dữ liệu thực đơn!', 'error');
    }
}

// Hàm vẽ dữ liệu ra bảng
function renderMenuTableData(safeItems) {
    const tbody = document.getElementById('menuTableBody');
    if (!tbody) return;

    const DEFAULT_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='42' height='42' viewBox='0 0 50 50'><rect width='100%' height='100%' fill='%23e8f5e9'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' font-size='20'>🥗</text></svg>";

    if (safeItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-muted">
                    <i class="fa-solid fa-box-open fa-2x mb-2" style="color: #ccc;"></i>
                    <p class="m-0 small">Không tìm thấy món ăn nào!</p>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = safeItems.map(item => {
        const id = item.Item_id ?? item.id;
        const code = item.Item_code ?? '';
        const name = item.Item_name ?? item.name;
        const price = item.Base_price ?? item.price ?? 0;
        const cost = item.Cost_price ?? 0;
        const desc = item.Description ?? '';
        const img = item.Image_url ?? '/uploads/dish-sample.jpg';
        const available = (item.Is_available === 0 || item.is_available === 0) 
            ? '<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill">Hết món</span>' 
            : '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill">Còn món</span>';

        let toppingsList = [];
        try {
            toppingsList = typeof item.Toppings === 'string' ? JSON.parse(item.Toppings || '[]') : (item.Toppings || []);
        } catch (e) { toppingsList = []; }
        const toppingBadge = (Array.isArray(toppingsList) && toppingsList.length > 0)
            ? `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill ms-1" style="font-size: 10px;" title="${toppingsList.map(t => t.name).join(', ')}">+${toppingsList.length} Topping</span>`
            : '';

        return `
            <tr>
                <td class="text-center p-1">
                    <img src="${img}" alt="${name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px; border: 1px solid #eee;" onerror="this.onerror=null; this.src='${DEFAULT_SVG}';">
                </td>
                <td><span class="badge bg-light text-dark font-monospace border">${code}</span></td>
                <td class="fw-bold text-dark">${name} ${toppingBadge}</td>
                <td class="text-end fw-bold text-success">${Number(price).toLocaleString()} đ</td>
                <td class="text-end text-muted small">${Number(cost).toLocaleString()} đ</td>
                <td><small class="text-muted" style="max-width: 130px; display: inline-block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${desc}">${desc}</small></td>
                <td class="text-center">${available}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary border-0 p-1 me-1" title="Sửa món" onclick="editMenuItem(${id})">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger border-0 p-1" title="Xóa món" onclick="deleteMenuItem(${id})">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// 3. Hàm Lọc Realtime theo danh mục và từ khóa
window.filterTableMenu = function() {
    const keyword = (document.getElementById('filterSearchInput')?.value || '').toLowerCase().trim();
    const catId = document.getElementById('filterCategorySelect')?.value || 'all';

    let filtered = window.allMenuItemsCache || [];

    if (catId !== 'all') {
        filtered = filtered.filter(item => {
            const itemCatId = item.Category_id ?? item.category_id;
            return String(itemCatId) === String(catId);
        });
    }

    if (keyword !== '') {
        filtered = filtered.filter(item => {
            const name = (item.Item_name ?? item.name ?? '').toLowerCase();
            const code = (item.Item_code ?? '').toLowerCase();
            return name.includes(keyword) || code.includes(keyword);
        });
    }

    renderMenuTableData(filtered);
};

// Quản lý Topping động
window.addToppingRow = function(name = '', price = '') {
    const container = document.getElementById('toppingListContainer');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'd-flex align-items-center gap-1 topping-item-row mb-1';
    row.innerHTML = `
        <input type="text" class="form-control form-control-sm topping-name-input" placeholder="Tên topping (vd: Trân châu trắng)" value="${name || ''}" style="flex: 2; font-size: 12px;" required>
        <input type="number" class="form-control form-control-sm topping-price-input" placeholder="Giá (đ)" value="${price !== '' ? price : 5000}" style="flex: 1.2; font-size: 12px;" min="0" step="1000">
        <button type="button" class="btn btn-sm btn-outline-danger p-1 border-0" onclick="window.removeToppingRow(this)" title="Xóa topping">
            <i class="fa-solid fa-xmark fs-6"></i>
        </button>
    `;
    container.appendChild(row);
};

window.removeToppingRow = function(btn) {
    const row = btn.closest('.topping-item-row');
    if (row) row.remove();
};

window.collectToppingsData = function() {
    const rows = document.querySelectorAll('#toppingListContainer .topping-item-row');
    const toppings = [];
    rows.forEach(r => {
        const name = r.querySelector('.topping-name-input')?.value?.trim();
        const price = parseFloat(r.querySelector('.topping-price-input')?.value || 0);
        if (name) {
            toppings.push({ name, price });
        }
    });
    return toppings;
};

window.renderToppingsToForm = function(toppingsData) {
    const container = document.getElementById('toppingListContainer');
    if (!container) return;
    container.innerHTML = '';
    let arr = [];
    if (typeof toppingsData === 'string') {
        try { arr = JSON.parse(toppingsData || '[]'); } catch (e) { arr = []; }
    } else if (Array.isArray(toppingsData)) {
        arr = toppingsData;
    }
    if (Array.isArray(arr) && arr.length > 0) {
        arr.forEach(t => window.addToppingRow(t.name, t.price));
    }
};

// 4. Xử lý gửi Form Thêm / Sửa
function setupMenuFormSubmit() {
    const form = document.getElementById('addMenuForm');
    if (!form) return;

    form.onsubmit = async function(e) {
        e.preventDefault();
        const formData = new FormData(form);
        const itemId = document.getElementById('itemIdInput')?.value;

        // Bổ sung dữ liệu Topping vào FormData
        const toppingsList = window.collectToppingsData();
        formData.set('Toppings', JSON.stringify(toppingsList));

        const isEdit = Boolean(itemId);
        const url = isEdit ? `/api/menu/${itemId}` : '/api/menu';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method: method,
                body: formData
            });
            const data = await res.json();

            if (!res.ok || data.error) {
                notify(data.error || 'Không thể lưu dữ liệu!', 'error');
            } else {
                notify(isEdit ? 'Cập nhật món thành công!' : 'Thêm món mới thành công!', 'success');
                cancelEditMode();
                loadMenuItemsTable();
            }
        } catch (err) {
            console.error('Lỗi gửi form:', err);
            notify('Lỗi kết nối máy chủ!', 'error');
        }
    };
}

// 5. Hàm Sửa Món Ăn (Đồng bộ chuẩn xác Combobox)
window.editMenuItem = async function(id) {
    const item = (window.allMenuItemsCache || []).find(i => (i.Item_id ?? i.id) == id);
    if (!item) return;

    const select = document.getElementById('itemCategorySelect');
    // Nếu combobox chưa nạp xong thì await cho nạp xong
    if (select && select.options.length <= 1) {
        await loadCategoriesToSelect();
    }

    // Điền dữ liệu món lên Form
    const itemIdInput = document.getElementById('itemIdInput');
    if (itemIdInput) itemIdInput.value = item.Item_id ?? item.id;
    if (select) select.value = item.Category_id ?? item.category_id ?? '';
    
    document.getElementById('itemCodeInput').value = item.Item_code ?? '';
    document.getElementById('itemNameInput').value = item.Item_name ?? item.name ?? '';
    document.getElementById('itemPriceInput').value = item.Base_price ?? item.price ?? 0;
    document.getElementById('itemCostInput').value = item.Cost_price ?? 0;
    document.getElementById('itemAvailableSelect').value = item.Is_available ?? 1;
    document.getElementById('itemPrinterSelect').value = item.Printer_target ?? 'KITCHEN_MAIN';
    document.getElementById('itemImgUrlInput').value = item.Image_url ?? '';
    document.getElementById('itemDescInput').value = item.Description ?? '';

    // Nạp lại danh sách Topping của món
    window.renderToppingsToForm(item.Toppings);

    // Đổi giao diện form sang Chế độ Sửa
    const titleEl = document.getElementById('formTitle');
    const btnSubmit = document.getElementById('btnSubmitForm');
    const btnCancel = document.getElementById('btnCancelEdit');

    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-pen-to-square me-2"></i>Sửa Món Ăn';
    if (btnSubmit) {
        btnSubmit.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Cập Nhật Món';
        btnSubmit.className = 'btn btn-primary w-100 fw-bold py-2 shadow-sm';
    }
    if (btnCancel) btnCancel.classList.remove('d-none');

    notify(`Đang chỉnh sửa món: ${item.Item_name ?? item.name}`, 'info');
};

// Hàm Hủy chế độ Sửa
window.cancelEditMode = function() {
    const form = document.getElementById('addMenuForm');
    if (form) form.reset();

    const itemIdInput = document.getElementById('itemIdInput');
    if (itemIdInput) itemIdInput.value = '';

    // Xóa sạch danh sách Topping trên form
    window.renderToppingsToForm([]);

    const titleEl = document.getElementById('formTitle');
    const btnSubmit = document.getElementById('btnSubmitForm');
    const btnCancel = document.getElementById('btnCancelEdit');

    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-utensils me-2"></i>Thêm Món Ăn Mới';
    if (btnSubmit) {
        btnSubmit.innerHTML = '<i class="fa-solid fa-plus me-1"></i> Lưu Món Ăn';
        btnSubmit.className = 'btn btn-success w-100 fw-bold py-2 shadow-sm';
    }
    if (btnCancel) btnCancel.classList.add('d-none');
};

// 6. Xóa món ăn
window.deleteMenuItem = async function(id) {
    if (!window.toast.confirm('Bạn có chắc chắn muốn xóa món ăn này không?')) return;

    try {
        const res = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.error) {
            notify(data.error, 'error');
        } else {
            window.toast.warning('Đã xóa món ăn thành công!', 'success');
            loadMenuItemsTable();
        }
    } catch (err) {
        console.error('Lỗi xóa món:', err);
        notify('Lỗi xóa món ăn!', 'error');
    }
};

window.loadCategoriesToSelect = loadCategoriesToSelect;
window.loadMenuItemsTable = loadMenuItemsTable;