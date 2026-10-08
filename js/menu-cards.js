window.initMenuCards = function() {
    loadMenuCardsData();
};

const DEFAULT_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'><rect width='100%' height='100%' fill='%23e8f5e9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='35'>🥗</text></svg>";
// Đăng ký trực tiếp hàm addToCart vào window toàn cục (Chống lỗi ReferenceError 100%)
window.addToCart = function(p1, p2, p3, p4) {
    try {
        let id, name, price, image, isAvailable = true;

        // Tự động phân biệt tham số là Đối tượng hay Tham số lẻ
        if (typeof p1 === 'object' && p1 !== null) {
            id = p1.id || p1.Item_id || Date.now();
            name = p1.name || p1.Item_name || 'Món ăn';
            price = parseFloat(p1.price || p1.Price || 0);
            image = p1.image || p1.Image_url || '';
            if (p1.Is_available !== undefined && Number(p1.Is_available) === 0) isAvailable = false;
        } else {
            id = p1 || Date.now();
            name = p2 || 'Món ăn';
            price = parseFloat(p3 || 0);
            image = p4 || '';
        }

        // Kiểm tra xem món có bị hết hàng không
        if (Array.isArray(window.allMenuItemsCache)) {
            const cached = window.allMenuItemsCache.find(m => String(m.Item_id ?? m.id) === String(id));
            if (cached && Number(cached.Is_available ?? 1) === 0) {
                isAvailable = false;
            }
        }

        if (!isAvailable) {
            if (window.toast) window.toast.warning(`Món "${name}" hiện đã hết hàng, vui lòng chọn món khác!`);
            return;
        }

        // Lấy giỏ hàng hiện tại
        let cart = JSON.parse(localStorage.getItem('hoasen_cart') || '[]');
        const isAddMore = sessionStorage.getItem('hoasen_is_add_more') === '1';
        const defaultNote = isAddMore ? '[Gọi thêm]' : '';

        // Tìm món theo ID hoặc Tên (nếu không có toppings và khớp note)
        const existingIndex = cart.findIndex(item => 
            (String(item.id) === String(id) || item.name === name) && 
            (item.note || '') === defaultNote && 
            (!item.toppings || item.toppings.length === 0)
        );

        if (existingIndex !== -1) {
            cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + 1;
        } else {
            cart.push({
                id: id,
                name: name,
                price: price,
                basePrice: price,
                image: image,
                quantity: 1,
                note: defaultNote,
                toppings: []
            });
        }

        // Lưu đồng thời 2 key để các trang đọc không bị lệch
        localStorage.setItem('hoasen_cart', JSON.stringify(cart));
        localStorage.setItem('restaurant_cart', JSON.stringify(cart));

        // Cập nhật số nhảy trên Icon giỏ hàng
        if (typeof window.updateFloatingCartBadge === 'function') {
            window.updateFloatingCartBadge();
        }

        if (window.toast) {
            window.toast.success(`Đã thêm "${name}" vào giỏ hàng!`);
        }
    } catch (err) {
        console.error('Lỗi addToCart:', err);
        if (window.toast) {
            window.toast.error('Không thể thêm món vào giỏ hàng!');
        }
    }
};

// Render giao diện Menu Dạng Thẻ
window.renderMenuCards = function(menuItems) {
    const container = document.getElementById('menuCardsContainer') || document.getElementById('menuContainer');
    if (!container) return;

    if (!menuItems || menuItems.length === 0) {
        container.innerHTML = `<div class="col-12 text-center py-5 text-muted">Không tìm thấy món ăn nào</div>`;
        return;
    }

    container.innerHTML = menuItems.map(item => {
        const id = item.id || item.Item_id || Date.now();
        const name = (item.name || item.Item_name || 'Món ăn').replace(/'/g, "\\'");
        const price = item.price || item.Price || 0;
        const image = item.image || item.Image_url || '/images/default-food.jpg';
        const description = item.description || item.Description || '';
        const isAvailable = Number(item.Is_available ?? item.is_available ?? 1) === 1;

        const actionBtn = isAvailable ? `
            <button type="button" class="btn btn-sm btn-success fw-bold px-3 rounded-pill" 
                    onclick="window.addToCart('${id}', '${name}', ${price}, '${image}')">
                <i class="fa-solid fa-plus me-1"></i> Thêm
            </button>
        ` : `
            <span class="badge bg-danger rounded-pill px-3 py-2 fw-bold text-white">
                <i class="fa-solid fa-ban me-1"></i> Hết món
            </span>
        `;

        const cardStyle = !isAvailable ? 'opacity: 0.55; filter: grayscale(75%); background: #fdfdfe;' : '';

        return `
            <div class="col-md-4 col-sm-6 mb-3">
                <div class="card h-100 shadow-sm border-0 rounded-3 overflow-hidden" style="${cardStyle}">
                    <img src="${image}" class="card-img-top" style="height: 160px; object-fit: cover;" alt="${name}" onerror="this.src='/images/default-food.jpg'">
                    <div class="card-body p-3 d-flex flex-column justify-content-between">
                        <div>
                            <h6 class="fw-bold mb-1">${item.name || item.Item_name}</h6>
                            <p class="text-muted small mb-2 text-truncate">${description}</p>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-2">
                            <span class="fw-bold text-success fs-6">${new Intl.NumberFormat('vi-VN').format(price)} đ</span>
                            ${actionBtn}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

// Hàm khởi tạo bắt buộc cho Router SPA
window.initMenuCards = async function() {
    if (typeof window.updateOrderContextBanner === 'function') {
        window.updateOrderContextBanner();
    }
    try {
        const res = await fetch('/api/menu');
        if (res.ok) {
            const menuData = await res.json();
            window.renderMenuCards(menuData);
        }
        loadMenuCardsData();
    } catch (e) {
        console.log('Chưa kết nối API menu, dùng dữ liệu sẵn');
    }
};

// Khởi chạy
document.addEventListener('DOMContentLoaded', () => {
    window.initMenuCards();
});

async function loadMenuCardsData() {
    try {
        const [resCat, resMenu] = await Promise.all([
            fetch('/api/categories'),
            fetch('/api/menu')
        ]);

        const categoriesData = await resCat.json();
        const menuData = await resMenu.json();

        window.allCategoriesCache = Array.isArray(categoriesData) ? categoriesData : [];
        window.allMenuItemsCache = Array.isArray(menuData) ? menuData : [];

        renderCategoryTabs(window.allCategoriesCache, window.allMenuItemsCache);
        renderMenuItemsCards(window.allMenuItemsCache);

    } catch (err) {
        console.error('Lỗi nạp dữ liệu Menu Dạng Thẻ:', err);
    }
}

// 1. Render Danh Mục Nút Đẹp
function renderCategoryTabs(categories, menuItems) {
    const tabContainer = document.getElementById('categoryTabs');
    if (!tabContainer) return;

    const safeMenuItems = Array.isArray(menuItems) ? menuItems : [];

    let html = `
        <button class="cat-btn active" onclick="filterMenuByCat('all', this)">
            <i class="fa-solid fa-border-all"></i> Tất Cả <span class="badge-count">${safeMenuItems.length}</span>
        </button>
    `;

    categories.forEach(cat => {
        const catId = cat.Category_id ?? cat.category_id ?? cat.id;
        const catName = cat.Category_name ?? cat.category_name ?? cat.name;

        const count = safeMenuItems.filter(item => {
            const itemCatId = item.Category_id ?? item.category_id;
            return String(itemCatId) === String(catId);
        }).length;

        html += `
            <button class="cat-btn" onclick="filterMenuByCat('${catId}', this)">
                ${catName} <span class="badge-count">${count}</span>
            </button>
        `;
    });

    tabContainer.innerHTML = html;
}

// 2. Render Thẻ Ngang
function renderMenuItemsCards(items) {
    const cardGrid = document.getElementById('menuCardsGrid') || document.getElementById('menuCardsContainer');
    
    // ÂM THẦM BỎ QUA NẾU ĐANG Ở TRANG KHÁC (NHƯ TRANG ĐƠN HÀNG/GIỎ HÀNG) -> KHÔNG VĂNG LỖI ĐỎ CONSOLE
    if (!cardGrid) {
        return;
    }

    const safeItems = Array.isArray(items) ? items : [];

    if (safeItems.length === 0) {
        cardGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 50px 0;">
                <i class="fa-solid fa-utensils fa-3x text-muted mb-3" style="color: #ccc;"></i>
                <p class="text-muted fs-6">Không tìm thấy món ăn nào phù hợp!</p>
            </div>
        `;
        return;
    }

    // SVG mặc định dự phòng nếu không tải được hình ảnh
    const defaultSvg = "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22200%22%20height%3D%22200%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23eee%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20fill%3D%22%23aaa%22%20dy%3D%22.3em%22%20text-anchor%3D%22middle%22%3EM%C3%B3n%20Chay%3C%2Ftext%3E%3C%2Fsvg%3E";

    cardGrid.innerHTML = safeItems.map(item => {
        const id = item.Item_id ?? item.item_id ?? item.id;
        const name = item.Item_name ?? item.item_name ?? item.name ?? 'Món chay';
        const price = item.Base_price ?? item.base_price ?? item.price ?? 0;
        const img = item.Image_url ?? item.image_url ?? item.image ?? '/uploads/dish-sample.jpg';
        const desc = item.Description ?? item.description ?? 'Món chay thanh tịnh, chế biến thơm ngon bổ dưỡng.';
        const isAvailable = Number(item.Is_available ?? item.is_available ?? 1) === 1;

        // Chuẩn hóa JSON tránh lỗi thoát chuỗi trong onclick
        const cartPayload = JSON.stringify({
            Item_id: id,
            Item_name: name,
            Unit_price: price,
            price: price,
            name: name,
            id: id,
            Is_available: isAvailable ? 1 : 0
        }).replace(/'/g, "&apos;");

        let toppingsList = [];
        try {
            toppingsList = typeof item.Toppings === 'string' ? JSON.parse(item.Toppings || '[]') : (item.Toppings || []);
        } catch (e) { toppingsList = []; }
        const hasToppings = Array.isArray(toppingsList) && toppingsList.length > 0;
        const toppingIndicator = hasToppings 
            ? `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill ms-1" style="font-size: 10px;">+${toppingsList.length} Topping</span>`
            : '';

        const cardClass = isAvailable ? "dish-card-horizontal" : "dish-card-horizontal out-of-stock";
        let actionButtonHtml = '';
        if (!isAvailable) {
            actionButtonHtml = `
                <span class="badge-out-of-stock">
                    <i class="fa-solid fa-ban me-1"></i> Tạm hết món
                </span>
            `;
        } else if (hasToppings) {
            actionButtonHtml = `
                <button class="btn-add-cart-shadow" onclick="window.openDishOptionsModal('${id}')" style="background: linear-gradient(135deg, #2e7d32, #1b5e20); color: #fff; padding: 6px 12px; font-size: 12px;">
                    <i class="fa-solid fa-layer-group me-1"></i> Chọn Topping
                </button>
            `;
        } else {
            actionButtonHtml = `
                <button class="btn-add-cart-shadow" onclick='addToCart(${cartPayload})'>
                    <i class="fa-solid fa-plus me-1"></i> Thêm
                </button>
            `;
        }

        const outOfStockBadge = !isAvailable ? `
            <div style="position: absolute; top: 6px; left: 6px; z-index: 2;">
                <span class="badge bg-danger shadow-sm fw-bold" style="font-size: 10px; padding: 3px 6px; border-radius: 4px;">HẾT MÓN</span>
            </div>
        ` : '';

        return `
            <div class="${cardClass}">
                <div class="dish-card-img-wrapper" style="position: relative;">
                    ${outOfStockBadge}
                    <img src="${img}" alt="${name}" onerror="this.onerror=null; this.src='${defaultSvg}';">
                </div>
                <div class="dish-card-content">
                    <div>
                        <h5 class="dish-card-title">${name} ${toppingIndicator}</h5>
                        <p class="dish-card-desc">${desc}</p>
                    </div>
                    <div class="dish-card-footer">
                        <span class="dish-card-price">${Number(price).toLocaleString('vi-VN')} đ</span>
                        ${actionButtonHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// MODAL TÙY CHỌN MÓN & CHỌN TOPPING
// ==========================================
window.currentModalItem = null;
window.currentModalQty = 1;

window.openDishOptionsModal = function(itemId) {
    const item = (window.allMenuItemsCache || []).find(i => String(i.Item_id ?? i.id) === String(itemId));
    if (!item) return;

    window.currentModalItem = item;
    window.currentModalQty = 1;

    let toppings = [];
    try {
        toppings = typeof item.Toppings === 'string' ? JSON.parse(item.Toppings || '[]') : (item.Toppings || []);
    } catch (e) { toppings = []; }

    const modal = document.getElementById('dishOptionsModal');
    const titleEl = document.getElementById('modalDishName');
    const basePriceEl = document.getElementById('modalDishBasePrice');
    const imgEl = document.getElementById('modalDishImg');
    const noteEl = document.getElementById('modalDishNote');
    const qtyEl = document.getElementById('modalDishQty');
    const listEl = document.getElementById('modalToppingList');

    if (titleEl) titleEl.innerText = item.Item_name ?? item.name ?? 'Món chay';
    if (basePriceEl) basePriceEl.innerText = Number(item.Base_price ?? item.price ?? 0).toLocaleString('vi-VN') + ' đ';
    if (imgEl) imgEl.src = item.Image_url ?? item.image ?? '/uploads/dish-sample.jpg';
    if (noteEl) noteEl.value = '';
    if (qtyEl) qtyEl.value = '1';

    if (listEl) {
        if (!Array.isArray(toppings) || toppings.length === 0) {
            listEl.innerHTML = `<div class="text-muted small fst-italic py-2">Món này không có topping thêm.</div>`;
        } else {
            listEl.innerHTML = toppings.map((t, idx) => `
                <label class="d-flex justify-content-between align-items-center p-2 border rounded-3 bg-light mb-1" style="cursor: pointer;">
                    <div class="d-flex align-items-center">
                        <input type="checkbox" class="form-check-input me-2 modal-topping-cb" id="topping_cb_${idx}" value="${t.name}" data-price="${t.price}" onchange="window.recalculateModalTotal()">
                        <span class="fw-semibold text-dark" style="font-size: 13px;">${t.name}</span>
                    </div>
                    <span class="text-success fw-bold" style="font-size: 13px;">+${Number(t.price).toLocaleString('vi-VN')} đ</span>
                </label>
            `).join('');
        }
    }

    window.recalculateModalTotal();
    if (modal) modal.style.display = 'flex';
};

window.closeDishOptionsModal = function() {
    const modal = document.getElementById('dishOptionsModal');
    if (modal) modal.style.display = 'none';
    window.currentModalItem = null;
};

window.changeModalQty = function(delta) {
    let q = (window.currentModalQty || 1) + delta;
    if (q < 1) q = 1;
    window.currentModalQty = q;
    const qtyEl = document.getElementById('modalDishQty');
    if (qtyEl) qtyEl.value = q;
    window.recalculateModalTotal();
};

window.recalculateModalTotal = function() {
    if (!window.currentModalItem) return;
    const basePrice = Number(window.currentModalItem.Base_price ?? window.currentModalItem.price ?? 0);
    const qty = window.currentModalQty || 1;

    let toppingsExtra = 0;
    const checkboxes = document.querySelectorAll('.modal-topping-cb:checked');
    checkboxes.forEach(cb => {
        toppingsExtra += parseFloat(cb.dataset.price || 0);
    });

    const singleUnitPrice = basePrice + toppingsExtra;
    const totalPrice = singleUnitPrice * qty;

    const totalEl = document.getElementById('modalDishTotalPrice');
    if (totalEl) {
        totalEl.innerText = Number(totalPrice).toLocaleString('vi-VN') + ' đ';
    }
};

window.confirmAddToCartWithOptions = function() {
    if (!window.currentModalItem) return;
    const item = window.currentModalItem;
    const qty = Number(window.currentModalQty || document.getElementById('modalDishQty')?.value || 1);
    const id = item.Item_id ?? item.id ?? Date.now();
    const name = item.Item_name ?? item.name ?? 'Món chay';
    const basePrice = Number(item.Base_price ?? item.price ?? 0);
    const isAddMore = sessionStorage.getItem('hoasen_is_add_more') === '1';
    let rawNote = document.getElementById('modalDishNote')?.value?.trim() || '';
    if (isAddMore && !rawNote.includes('[Gọi thêm]')) {
        rawNote = rawNote ? `[Gọi thêm] ${rawNote}` : '[Gọi thêm]';
    }
    const note = rawNote;

    const selectedToppings = [];
    let toppingsExtra = 0;
    document.querySelectorAll('.modal-topping-cb:checked').forEach(cb => {
        const tPrice = parseFloat(cb.dataset.price || 0);
        selectedToppings.push({ name: cb.value, price: tPrice });
        toppingsExtra += tPrice;
    });

    const finalUnitPrice = basePrice + toppingsExtra;

    let cart = JSON.parse(localStorage.getItem('hoasen_cart') || '[]');

    // Tạo key nhận diện duy nhất cho món (tính cả toppings & note)
    const toppingsKey = selectedToppings.map(t => t.name).sort().join('|');
    const existingIndex = cart.findIndex(c => 
        (String(c.id) === String(id) || c.name === name) &&
        (c.note || '') === note &&
        ((c.toppings || []).map(t => t.name).sort().join('|') === toppingsKey)
    );

    if (existingIndex !== -1) {
        cart[existingIndex].quantity = (Number(cart[existingIndex].quantity) || 1) + qty;
    } else {
        cart.push({
            id: id,
            name: name,
            price: finalUnitPrice,
            basePrice: basePrice,
            image: item.Image_url ?? item.image ?? '',
            quantity: qty,
            note: note,
            toppings: selectedToppings
        });
    }

    localStorage.setItem('hoasen_cart', JSON.stringify(cart));
    localStorage.setItem('restaurant_cart', JSON.stringify(cart));

    if (typeof window.updateFloatingCartBadge === 'function') window.updateFloatingCartBadge();

    window.closeDishOptionsModal();
    if (window.toast) window.toast.success(`Đã thêm ${qty}x "${name}" vào giỏ hàng!`);
};

window.filterMenuByCat = function(catId, btnElement) {
    window.currentSelectedCatId = catId;

    if (btnElement) {
        document.querySelectorAll('#categoryTabs .cat-btn').forEach(b => {
            b.classList.remove('active');
        });
        btnElement.classList.add('active');
    }

    applyFilters();
};

window.filterMenuCards = function() {
    applyFilters();
};

function applyFilters() {
    const searchInput = document.getElementById('cardSearchInput');
    const keyword = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const catId = window.currentSelectedCatId || 'all';

    let filtered = window.allMenuItemsCache || [];

    if (catId !== 'all') {
        filtered = filtered.filter(item => {
            const itemCatId = item.Category_id ?? item.category_id;
            return String(itemCatId) === String(catId);
        });
    }

    if (keyword !== '') {
        filtered = filtered.filter(item => {
            const name = (item.Item_name ?? item.item_name ?? '').toLowerCase();
            return name.includes(keyword);
        });
    }

    renderMenuItemsCards(filtered);
}

window.loadMenuCardsData = loadMenuCardsData;