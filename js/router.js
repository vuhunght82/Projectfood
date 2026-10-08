const routes = {
    '/': { 
        view: '/views/guest-home.html', 
        init: () => {
            if (typeof window.initGuestHome === 'function') window.initGuestHome();
        }
    },
    '/orders': { 
        view: '/views/orders.html', 
        init: () => typeof window.loadOrders === 'function' && window.loadOrders()
    },
    '/categories': { 
        view: '/views/categories.html', 
        init: () => typeof window.loadCategories === 'function' && window.loadCategories()
    },
    '/menu': { 
        view: '/views/menu.html', 
        init: () => typeof window.initMenu === 'function' && window.initMenu()
    },
    '/menu-cards': { 
        view: '/views/menu-cards.html', 
        init: () => typeof window.initMenuCards === 'function' && window.initMenuCards()
    },
    '/users': { 
        view: '/views/users.html', 
        init: () => typeof window.loadUsers === 'function' && window.loadUsers()
    },
    '/cart': { 
        view: '/views/cart.html', 
        init: () => typeof window.initCart === 'function' && window.initCart()
    },
    '/system-settings': { 
        view: '/views/system-settings.html', 
        init: () => {
            if (typeof window.initSystemSettings === 'function') {
                window.initSystemSettings();
            } else if (typeof window.switchSystemTab === 'function') {
                window.switchSystemTab('tab-printer');
            }
        } 
    },
    '/kitchen': { 
        view: '/views/kitchen.html', 
        init: () => typeof window.initKitchen === 'function' && window.initKitchen() 
    },
    '/ready-orders': { 
        view: '/views/ready-orders.html', 
        init: () => {
            if (!document.getElementById('ready-orders-js')) {
                const script = document.createElement('script');
                script.id = 'ready-orders-js';
                script.src = '/js/ready-orders.js';
                script.onload = () => {
                    if (typeof window.initReadyOrders === 'function') window.initReadyOrders();
                };
                document.body.appendChild(script);
            } else {
                if (typeof window.initReadyOrders === 'function') window.initReadyOrders();
            }
        } 
    },
    '/tables': { 
        view: '/views/tables.html', 
        init: () => {
            if (!document.getElementById('tables-js')) {
                const script = document.createElement('script');
                script.id = 'tables-js';
                script.src = '/js/tables.js';
                script.onload = () => {
                    if (typeof window.initTables === 'function') window.initTables();
                };
                document.body.appendChild(script);
            } else {
                if (typeof window.initTables === 'function') window.initTables();
            }
        } 
    },
    '/members': { 
        view: '/views/members.html', 
        init: () => typeof window.initMembers === 'function' && window.initMembers() 
    },
    '/membership': { 
        view: '/views/members.html', 
        init: () => typeof window.initMembers === 'function' && window.initMembers() 
    },
    '/tra-cuu-thanh-vien': { 
        view: '/views/members.html', 
        init: () => typeof window.initMembers === 'function' && window.initMembers() 
    }
};

// Hàm điều hướng chính (Chuyển trang không reload)
async function navigateTo(path) {
    if (path === '/payments') {
        path = '/orders';
    }
    if (!routes[path]) {
        path = '/menu-cards';
    }

    window.history.pushState({}, "", path);
    updateActiveTab(path);
    await renderView(path);
}

// Hàm nạp và hiển thị View HTML vào #app-content hoặc #app
async function renderView(path) {
    const route = routes[path];
    const appContent = document.getElementById('app-content') || document.getElementById('app');

    if (!appContent) {
        console.error('Không tìm thấy phần tử chứa nội dung (#app-content hoặc #app)');
        return;
    }

    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || 'null');

    // 1. Khi truy cập trang chủ '/'
    if (path === '/') {
        try {
            const res = await fetch('/views/guest-home.html?v=' + Date.now());
            if (res.ok) {
                const html = await res.text();
                appContent.innerHTML = html;
                if (typeof window.applyGlobalBrandSettings === 'function') {
                    window.applyGlobalBrandSettings();
                }
                if (typeof window.initGuestHome === 'function') {
                    window.initGuestHome();
                }
                return;
            }
        } catch (errGuest) {
            console.error('Lỗi nạp guest-home.html:', errGuest);
        }
    }

    // 2. Chặn người chưa đăng nhập truy cập vào các trang quản lý nội bộ
    const internalRoutes = [
        '/categories', '/menu', '/menu-cards', '/users', '/system-settings', 
        '/kitchen', '/ready-orders', '/orders', '/tables', '/members', 
        '/membership', '/tra-cuu-thanh-vien'
    ];
    if (!user && internalRoutes.includes(path)) {
        appContent.innerHTML = `
            <div class="container py-5 text-center" style="max-width: 520px;">
                <div class="card shadow-sm border-0 rounded-4 p-4 text-center bg-white">
                    <div class="mb-3 text-success">
                        <i class="fa-solid fa-leaf fa-3x"></i>
                    </div>
                    <h3 class="fw-bold text-success mb-2">Nhà Hàng Chay Hoa Sen</h3>
                    <p class="text-secondary small mb-4">Trang quản trị nội bộ dành cho nhân viên & quản lý. Vui lòng đăng nhập tài khoản để tiếp tục.</p>
                    <div class="d-flex flex-column gap-2">
                        <button class="btn btn-success fw-bold py-2 px-4 rounded-pill shadow-sm" onclick="openLoginModal()" style="background-color: var(--primary-color, #2e7d32); border-color: var(--primary-color, #2e7d32);">
                            <i class="fa-solid fa-right-to-bracket me-2"></i>Đăng Nhập Hệ Thống
                        </button>
                        <button class="btn btn-outline-secondary py-2 px-4 rounded-pill" onclick="navigateTo('/')">
                            <i class="fa-solid fa-house me-1"></i> Về Trang Chủ Khách Hàng
                        </button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // 3. Khách hàng (CUSTOMER) đã đăng nhập: Chỉ được xem '/' (Trang thẻ hội viên & lịch sử đơn của chính mình)
    // Tuyệt đối không cho phép xem menu, giỏ hàng hoặc các màn hình nội bộ
    if (user && String(user.Role || user.role).toUpperCase() === 'CUSTOMER') {
        const forbiddenForCustomer = [
            '/orders', '/tables', '/kitchen', '/ready-orders', '/users', 
            '/system-settings', '/categories', '/menu', '/members', 
            '/membership', '/tra-cuu-thanh-vien', '/menu-cards', '/cart'
        ];
        if (forbiddenForCustomer.includes(path)) {
            navigateTo('/');
            return;
        }
    }

    // 4. Bảo vệ các trang theo danh sách quyền hạn cụ thể của nhân viên
    if (user && String(user.Role || user.role).toUpperCase() !== 'CUSTOMER') {
        const perms = (typeof window.getUserPermissions === 'function') ? window.getUserPermissions(user) : [];
        
        // Bản đồ quyền yêu cầu cho từng đường dẫn
        const routePermMap = {
            '/tables': ['TABLES_VIEW'],
            '/orders': ['ORDERS_PERSONAL', 'ORDERS_LIST', 'ORDERS_ALL'],
            '/menu-cards': ['MENU_CARDS'],
            '/cart': ['CART'],
            '/ready-orders': ['READY_ORDERS'],
            '/kitchen': ['KITCHEN'],
            '/members': ['MEMBERS_MANAGE'],
            '/membership': ['MEMBERS_MANAGE'],
            '/tra-cuu-thanh-vien': ['MEMBERS_MANAGE'],
            '/menu': ['MENU_MANAGE'],
            '/categories': ['MENU_MANAGE'],
            '/users': ['USERS_MANAGE'],
            '/system-settings': ['SYSTEM_CONFIG']
        };

        const requiredPerms = routePermMap[path];
        if (requiredPerms) {
            const hasAccess = requiredPerms.some(p => perms.includes(p));
            if (!hasAccess) {
                // Tìm trang đầu tiên mà user có quyền truy cập
                const fallbackRoutes = [
                    { path: '/tables', perm: 'TABLES_VIEW' },
                    { path: '/orders', perms: ['ORDERS_PERSONAL', 'ORDERS_LIST', 'ORDERS_ALL'] },
                    { path: '/menu-cards', perm: 'MENU_CARDS' },
                    { path: '/cart', perm: 'CART' },
                    { path: '/ready-orders', perm: 'READY_ORDERS' },
                    { path: '/kitchen', perm: 'KITCHEN' },
                    { path: '/members', perm: 'MEMBERS_MANAGE' },
                    { path: '/users', perm: 'USERS_MANAGE' },
                    { path: '/system-settings', perm: 'SYSTEM_CONFIG' }
                ];

                const allowedFallback = fallbackRoutes.find(r => 
                    r.perm ? perms.includes(r.perm) : r.perms.some(p => perms.includes(p))
                );

                if (allowedFallback) {
                    if (window.toast) {
                        window.toast.warning('Tài khoản của bạn chưa được cấp quyền truy cập chức năng này!');
                    }
                    navigateTo(allowedFallback.path);
                    return;
                } else {
                    // Tài khoản chưa được cấp bất kỳ quyền nào trong hệ thống
                    appContent.innerHTML = `
                        <div class="container py-5 text-center" style="max-width: 550px;">
                            <div class="card shadow-sm border-0 rounded-4 p-4 text-center bg-white border-top border-4 border-warning">
                                <div class="mb-3 text-warning">
                                    <i class="fa-solid fa-user-lock fa-3x"></i>
                                </div>
                                <h4 class="fw-bold text-dark mb-2">Chưa Phân Quyền Truy Cập</h4>
                                <p class="text-secondary small mb-4">
                                    Tài khoản <b>${user.Full_name || user.User_name}</b> [${user.Role || 'Nhân viên'}] chưa được phân quyền sử dụng chức năng nào trong hệ thống. Vui lòng liên hệ Quản Lý (Admin) để được cấu hình quyền!
                                </p>
                                <div class="d-flex justify-content-center gap-2">
                                    <button class="btn btn-outline-danger fw-bold py-2 px-4 rounded-pill shadow-sm" onclick="handleLogout()">
                                        <i class="fa-solid fa-right-from-bracket me-2"></i> Đăng Xuất
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                    return;
                }
            }
        }
    }

    appContent.innerHTML = `
        <div class="text-center" style="padding: 40px; color: #777;">
            <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
            <p style="margin-top: 10px;">Đang tải giao diện...</p>
        </div>
    `;

    try {
        const response = await fetch(route.view);
        if (!response.ok) {
            throw new Error(`Không thể tải trang view: ${route.view}`);
        }
        const html = await response.text();
        appContent.innerHTML = html;

        // ÁP DỤNG CẤU HÌNH THƯƠNG HIỆU NGAY CHO VIEW MỚI
        if (typeof window.applyGlobalBrandSettings === 'function') {
            window.applyGlobalBrandSettings();
        }

        // TỰ ĐỘNG GỌI HÀM INIT SAU KHI HTML ĐÃ NẠP VÀO GIAO DIỆN
        if (typeof route.init === 'function') {
            route.init();
        }

        // TỰ ĐỘNG CẬP NHẬT TRẠNG THÁI NÚT NỔI SHIPPER & TABS THEO QUYỀN
        if (typeof window.checkAuthStatus === 'function') {
            window.checkAuthStatus();
        } else if (typeof window.renderGlobalFloatingButtons === 'function') {
            window.renderGlobalFloatingButtons();
        }
    } catch (err) {
        console.error('Lỗi điều hướng Router:', err);
        appContent.innerHTML = `
            <div class="text-center" style="padding: 40px; color: var(--danger-color, #d32f2f);">
                <i class="fa-solid fa-triangle-exclamation fa-2x"></i>
                <p style="margin-top: 10px;">Lỗi tải giao diện! Vui lòng thử lại.</p>
            </div>
        `;
    }
}

// Cập nhật trạng thái active cho tab thanh điều hướng
function updateActiveTab(currentPath) {
    const tabs = document.querySelectorAll('.nav-tabs .tab-btn, .navbar-nav .nav-link');
    tabs.forEach(tab => {
        const routeAttr = tab.getAttribute('data-route');
        if (routeAttr) {
            if (routeAttr === currentPath) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        } else {
            const onclickAttr = tab.getAttribute('onclick') || '';
            const match = onclickAttr.match(/navigateTo\(['"]([^'"]+)['"]\)/);
            if (match && match[1] === currentPath) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        }
    });
}

// Xuất hàm ra scope toàn cục để gọi từ HTML onclick="navigateTo('/route')"
window.navigateTo = navigateTo;

// Lắng nghe sự kiện Back / Forward trên trình duyệt
window.addEventListener('popstate', () => {
    const path = window.location.pathname;
    renderView(path);
    updateActiveTab(path);
});

// ==========================================
// ĐỒNG BỘ MÀU SẮC CHỦ ĐẠO, LOGO & THƯƠNG HIỆU TOÀN TRANG
// ==========================================
window.applyGlobalBrandSettings = function(cfg) {
    if (!cfg) {
        try {
            cfg = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        } catch (e) {
            cfg = {};
        }
    } else {
        // Đồng bộ và lưu trữ cục bộ trên mọi thiết bị (Mobile, Tablet, Desktop)
        try {
            const current = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
            localStorage.setItem('hoasen_system_config', JSON.stringify({ ...current, ...cfg }));
        } catch (e) {}
    }

    const themeColor = cfg.theme_color || '#2e7d32';
    document.documentElement.style.setProperty('--primary-color', themeColor);

    // Tính toán màu hover đậm hơn một chút
    try {
        let num = parseInt(themeColor.replace('#',''), 16),
            amt = Math.round(2.55 * -20),
            R = Math.max(0, Math.min(255, (num >> 16) + amt)),
            G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt)),
            B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
        const hoverColor = '#' + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
        document.documentElement.style.setProperty('--primary-hover', hoverColor);
    } catch (e) {}

    // Cập nhật màu sắc Thẻ Giới Thiệu (100% Thuần Khiết...)
    const fcBg = cfg.feature_card_bg || '#ffffff';
    const fcBorder = cfg.feature_card_border || '#e2e8f0';
    const fcText = cfg.feature_card_text || '#1a202c';
    const fcIcon = cfg.feature_card_icon_color || '#2e7d32';

    // Tự động nhận diện màu nền tối để điều chỉnh màu chữ mô tả và nền icon
    function isDarkColor(hex) {
        if (!hex || typeof hex !== 'string') return false;
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        if (hex.length !== 6) return false;
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return ((r * 299) + (g * 587) + (b * 114)) / 1000 < 130;
    }

    const isDark = isDarkColor(fcBg);
    const fcDesc = isDark ? 'rgba(255, 255, 255, 0.78)' : '#718096';
    const fcIconBg = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(46, 125, 50, 0.12)';

    document.documentElement.style.setProperty('--feature-card-bg', fcBg);
    document.documentElement.style.setProperty('--feature-card-border', fcBorder);
    document.documentElement.style.setProperty('--feature-card-text', fcText);
    document.documentElement.style.setProperty('--feature-card-icon', fcIcon);
    document.documentElement.style.setProperty('--feature-card-desc', fcDesc);
    document.documentElement.style.setProperty('--feature-card-icon-bg', fcIconBg);

    // Cập nhật tên cửa hàng trên header
    const brandName = cfg.restaurant_name || cfg.resName || 'Nhà Hàng Chay Hoa Sen';
    const nameEl = document.getElementById('headerBrandNameText');
    if (nameEl) nameEl.innerText = brandName;

    // Cập nhật Logo trên header
    const logoUrl = cfg.restaurant_logo || '';
    const logoImg = document.getElementById('headerBrandLogoImg');
    const leafIcon = document.getElementById('headerBrandLeafIcon');
    if (logoImg && leafIcon) {
        if (logoUrl) {
            logoImg.src = logoUrl;
            logoImg.style.display = 'inline-block';
            leafIcon.style.display = 'none';
        } else {
            logoImg.style.display = 'none';
            leafIcon.style.display = 'inline-block';
        }
    }

    // Cập nhật tiêu đề trang
    if (brandName) {
        document.title = brandName;
    }
};

// Tải cấu hình thương hiệu khi ứng dụng khởi động
async function loadBrandConfigGlobal() {
    if (typeof window.applyGlobalBrandSettings === 'function') {
        window.applyGlobalBrandSettings();
    }
    try {
        const res = await fetch('/api/system-config?t=' + Date.now());
        if (res.ok) {
            const data = await res.json();
            const cfg = (data && data.config) ? data.config : data;
            if (cfg) {
                try {
                    localStorage.setItem('hoasen_system_config', JSON.stringify(cfg));
                } catch (e) {}
                if (typeof window.applyGlobalBrandSettings === 'function') {
                    window.applyGlobalBrandSettings(cfg);
                }
            }
        }
    } catch (err) {}
}

// Khởi tạo Socket.IO nếu chưa có và đăng ký sự kiện đồng bộ cấu hình thời gian thực
if (typeof io === 'function') {
    if (!window.socket) {
        window.socket = io(window.location.origin);
    }
    window.socket.on('system_config_updated', (newCfg) => {
        try {
            const current = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
            localStorage.setItem('hoasen_system_config', JSON.stringify({ ...current, ...newCfg }));
        } catch (e) {}
        if (typeof window.applyGlobalBrandSettings === 'function') {
            window.applyGlobalBrandSettings(newCfg);
        }
    });
}

// Khởi chạy ứng dụng khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    loadBrandConfigGlobal();
    const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || 'null');
    let initialPath = window.location.pathname;
    if (!user) {
        if (initialPath === '/' || !routes[initialPath] || initialPath === '/menu-cards') {
            initialPath = '/';
        }
    } else {
        if (!routes[initialPath]) {
            initialPath = '/menu-cards';
        }
    }
    navigateTo(initialPath);
});