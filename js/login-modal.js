// Variable lưu trữ thông tin user đang đăng nhập
let currentUser = JSON.parse(localStorage.getItem('restaurant_user')) || null;
window.currentUser = currentUser;

// Biến lưu thông tin phiên đăng nhập cần giải quyết conflict
window._pendingConflictLogin = null;

// DANH SÁCH CHỨC NĂNG HỆ THỐNG ĐỂ PHÂN QUYỀN
window.SYSTEM_PERMISSIONS = {
    // Nhóm 1: Phòng Bàn & Bán Hàng
    'TABLES_VIEW': 'Sơ Đồ Phòng Bàn (Xem bàn, đổi bàn, thêm bớt khách)',
    'TABLES_MANAGE': 'Quản Lý Cấu Hình Bàn (Thêm, sửa, xóa bàn ghế)',
    'MENU_CARDS': 'Menu Dạng Thẻ (Chọn món tại bàn)',
    'CART': 'Giỏ Hàng & Đặt Món',
    'READY_ORDERS': 'Nhận Món (Bếp Xong)',
    'FLOATING_SHIPPER': 'Nút Nổi Đơn Shipper (Grab, Shopee, Be,...)',

    // Nhóm 2: Đơn Hàng & Thu Tiền
    'ORDERS_PERSONAL': 'Đơn Hàng & Nhật Ký Cá Nhân',
    'ORDERS_LIST': 'Xem Danh Sách Đơn Hàng',
    'ORDERS_ALL': 'Xem Toàn Bộ Đơn Hàng Quán (Như Thu Ngân)',
    'ORDERS_EDIT': 'Sửa Đơn Hàng (Thêm, bớt, đổi món)',
    'ORDERS_CANCEL': 'Hủy Đơn Hàng',
    'ORDERS_DELETE': 'Xóa Vĩnh Viễn Đơn Hàng',
    'COLLECT_PAYMENT': 'Thu Tiền & Xác Nhận Thanh Toán (Tiền mặt / QR)',
    'MEMBERS_MANAGE': 'Quản Lý Thẻ Thành Viên & Tích Điểm',

    // Nhóm 3: Báo Cáo & Thống Kê Doanh Thu (Bảo mật)
    'REPORTS_STATS': 'Thống Kê Báo Cáo Doanh Thu (Biểu đồ phân tích)',
    'STAFF_KPI_ALL': 'Nhật Ký & KPI Toàn Quán (Năng suất toàn bộ nhân viên)',

    // Nhóm 4: Chế Biến & Quản Trị Hệ Thống
    'KITCHEN': 'Màn Hình Bếp KDS',
    'MENU_MANAGE': 'Quản Lý Thực Đơn & Danh Mục',
    'USERS_MANAGE': 'Quản Lý Người Dùng & Nhân Viên',
    'SYSTEM_CONFIG': 'Cấu Hình Hệ Thống'
};

// Hàm lấy quyền hạn của user: Ưu tiên quyền riêng của từng nhân viên -> nếu chưa có lấy theo vai trò mặc định
function getUserPermissions(user) {
    if (!user) return [];
    const username = String(user.User_name || user.username || '').toLowerCase().trim();
    const roleUpper = String(user.Role || user.role || 'GUEST').toUpperCase().trim();

    // 1. Quản trị viên / Quản lý luôn có toàn bộ quyền hệ thống
    if (['ADMIN', 'QUẢN LÝ', 'QUANLY', 'MANAGER'].includes(roleUpper) || username === 'admin' || username === 'vu') {
        return Object.keys(window.SYSTEM_PERMISSIONS || {});
    }

    // 2. Kiểm tra cấu hình phân quyền theo từng nhân viên trong hệ thống
    try {
        const sysConfig = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
        const userPermsMap = sysConfig.user_permissions || {};
        if (username in userPermsMap && Array.isArray(userPermsMap[username])) {
            return userPermsMap[username];
        }
    } catch (e) {}

    // 3. Quyền mặc định theo từng vai trò (Role default) nếu chưa từng được phân quyền riêng
    if (['WAITER', 'PHỤC VỤ', 'PHUCVU'].includes(roleUpper)) {
        return ['TABLES_VIEW', 'MENU_CARDS', 'CART', 'READY_ORDERS', 'FLOATING_SHIPPER', 'ORDERS_PERSONAL', 'COLLECT_PAYMENT'];
    }
    if (['CASHIER', 'THU NGÂN', 'THUNGAN'].includes(roleUpper)) {
        return ['TABLES_VIEW', 'ORDERS_LIST', 'ORDERS_ALL', 'COLLECT_PAYMENT', 'MEMBERS_MANAGE', 'REPORTS_STATS', 'MENU_CARDS', 'CART', 'READY_ORDERS', 'FLOATING_SHIPPER', 'ORDERS_PERSONAL', 'ORDERS_EDIT'];
    }
    if (['KITCHEN', 'BẾP', 'BEP'].includes(roleUpper)) {
        return ['KITCHEN', 'READY_ORDERS', 'ORDERS_PERSONAL'];
    }

    return [];
}
window.getUserPermissions = getUserPermissions;

// Helper kiểm tra quyền cụ thể
function hasPermission(user, permKey) {
    if (!user) return false;
    const username = String(user.User_name || user.username || '').toLowerCase().trim();
    const roleUpper = String(user.Role || user.role || 'GUEST').toUpperCase().trim();
    if (['ADMIN', 'QUẢN LÝ', 'QUANLY', 'MANAGER'].includes(roleUpper) || username === 'admin' || username === 'vu') {
        return true;
    }
    const perms = getUserPermissions(user);
    return perms.includes(permKey);
}
window.hasPermission = hasPermission;

document.addEventListener('DOMContentLoaded', async () => {
    // Tự động đồng bộ cấu hình hệ thống & phân quyền từ Server
    try {
        const res = await fetch('/api/system-config?t=' + Date.now());
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.config) {
                const current = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
                localStorage.setItem('hoasen_system_config', JSON.stringify({ ...current, ...data.config }));
            }
        }
    } catch(e) {}

    // Lắng nghe cập nhật cấu hình & phân quyền realtime từ máy chủ
    if (typeof io === 'function') {
        const socket = window.socket || io(window.location.origin);
        window.socket = socket;

        // Đăng ký phiên nếu đã có user đăng nhập
        const registerSocketSession = () => {
            const u = currentUser || window.currentUser;
            if (u && u.User_id) {
                socket.emit('register_user_session', { 
                    userId: u.User_id, 
                    username: u.User_name,
                    sessionToken: u.sessionToken || ''
                });
            }
        };

        registerSocketSession();
        socket.on('connect', () => {
            registerSocketSession();
            if (typeof window.checkActiveSession === 'function') {
                window.checkActiveSession();
            }
        });

        socket.on('system_config_updated', (newConfig) => {
            if (newConfig) {
                try {
                    const current = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
                    const merged = { ...current, ...newConfig };
                    localStorage.setItem('hoasen_system_config', JSON.stringify(merged));
                    if (typeof checkAuthStatus === 'function') checkAuthStatus();
                } catch(e) {}
            }
        });

        // Lắng nghe lệnh đẩy phiên (force logout) khi đăng nhập ở máy khác
        socket.on('force_logout_user', (data) => {
            const u = currentUser || window.currentUser;
            if (u && (
                (data.userId && String(u.User_id) === String(data.userId)) || 
                (data.username && String(u.User_name || '').toLowerCase() === String(data.username).toLowerCase())
            )) {
                currentUser = null;
                window.currentUser = null;
                localStorage.removeItem('restaurant_user');
                if (typeof checkAuthStatus === 'function') checkAuthStatus();
                alert('⚠️ PHIÊN ĐĂNG NHẬP ĐÃ KẾT THÚC!\n\nTài khoản của bạn vừa được đăng nhập trên một thiết bị/máy khác. Phiên làm việc trên thiết bị này đã được tự động kết thúc để bảo đảm an toàn chính sách 1 máy!');
                navigateTo('/');
                if (typeof openLoginModal === 'function') openLoginModal();
            }
        });
    }

    // Tự động kiểm tra trạng thái đăng nhập khi tải trang
    checkAuthStatus();
    if (typeof window.checkActiveSession === 'function') {
        window.checkActiveSession();
    }
});

// Kiểm tra trạng thái hiệu lực của phiên làm việc với Server (cho chế độ Đơn máy)
window.checkActiveSession = async function() {
    const u = currentUser || window.currentUser;
    if (!u || !u.User_id) return;
    const roleUpper = String(u.Role || '').toUpperCase();
    if (['CUSTOMER', 'KHÁCH HÀNG', 'KHACHHANG'].includes(roleUpper)) return;

    try {
        const params = new URLSearchParams({
            userId: u.User_id,
            username: u.User_name || '',
            sessionToken: u.sessionToken || ''
        });
        const res = await fetch(`/api/verify-session?${params.toString()}&_t=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.valid === false) {
                console.warn('⚠️ Phiên đăng nhập đã bị thay thế hoặc kết thúc trên máy khác!');
                currentUser = null;
                window.currentUser = null;
                localStorage.removeItem('restaurant_user');
                if (typeof checkAuthStatus === 'function') checkAuthStatus();
                alert('⚠️ PHIÊN ĐĂNG NHẬP ĐÃ KẾT THÚC!\n\nTài khoản [' + (u.Full_name || u.User_name) + '] vừa được đăng nhập trên một thiết bị khác. Phiên làm việc trên máy này đã kết thúc!');
                if (typeof navigateTo === 'function') navigateTo('/');
                if (typeof openLoginModal === 'function') openLoginModal();
            }
        }
    } catch (e) {}
};

// Định kỳ kiểm tra phiên và kiểm tra ngay khi mở lại tab/mở khóa màn hình
if (typeof window !== 'undefined') {
    window.addEventListener('focus', () => { if (typeof window.checkActiveSession === 'function') window.checkActiveSession(); });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && typeof window.checkActiveSession === 'function') window.checkActiveSession();
    });
    setInterval(() => {
        if (typeof window.checkActiveSession === 'function') window.checkActiveSession();
    }, 6000);
}

// 1. Mở Modal Đăng Nhập
function openLoginModal(prefillUsername = '') {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'flex';

        const usernameInput = document.getElementById('loginUsername');
        const pwdInput = document.getElementById('loginPassword');
        const rememberCb = document.getElementById('loginRememberMe');

        // Kiểm tra xem có lưu thông tin đăng nhập từ trước không
        try {
            const remembered = JSON.parse(localStorage.getItem('hoasen_remember_login') || 'null');
            if (remembered && remembered.username) {
                if (usernameInput) usernameInput.value = remembered.username;
                if (pwdInput) pwdInput.value = remembered.password || '';
                if (rememberCb) rememberCb.checked = true;
            } else if (rememberCb) {
                rememberCb.checked = false;
            }
        } catch(e) {}

        if (prefillUsername && usernameInput) {
            usernameInput.value = prefillUsername;
            if (pwdInput) {
                pwdInput.value = '';
                setTimeout(() => pwdInput.focus(), 150);
            }
        }
    }
}
window.openLoginModal = openLoginModal;

// 2. Đóng Modal Đăng Nhập
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// 2.1. Toggle ẩn/hiện mật khẩu đăng nhập
window.toggleLoginPasswordVisibility = function() {
    const pwdInput = document.getElementById('loginPassword');
    const eyeIcon = document.getElementById('loginPwEyeIcon');
    if (!pwdInput) return;
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        if (eyeIcon) {
            eyeIcon.classList.remove('fa-eye');
            eyeIcon.classList.add('fa-eye-slash');
        }
    } else {
        pwdInput.type = 'password';
        if (eyeIcon) {
            eyeIcon.classList.remove('fa-eye-slash');
            eyeIcon.classList.add('fa-eye');
        }
    }
};

// 3. Xử lý sự kiện Submit Form Đăng Nhập (Gửi đến API SQLite)
async function handleLogin(event, isForced = false) {
    if (event) event.preventDefault();

    let User_name = '';
    let User_password = '';

    if (isForced && window._pendingConflictLogin) {
        User_name = window._pendingConflictLogin.username;
        User_password = window._pendingConflictLogin.password;
    } else {
        const usernameInput = document.getElementById('loginUsername');
        const passwordInput = document.getElementById('loginPassword');
        const rememberCb = document.getElementById('loginRememberMe');

        if (!usernameInput || !passwordInput) return;

        User_name = usernameInput.value.trim();
        User_password = passwordInput.value.trim();

        if (!User_name || !User_password) {
            if (window.toast) window.toast.warning('Vui lòng nhập đầy đủ tên tài khoản và mật khẩu!');
            else alert('Vui lòng nhập đầy đủ tên tài khoản và mật khẩu!');
            return;
        }

        // Lưu / Xóa thông tin đăng nhập nếu chọn "Nhớ mật khẩu & tên đăng nhập"
        if (rememberCb && rememberCb.checked) {
            localStorage.setItem('hoasen_remember_login', JSON.stringify({ username: User_name, password: User_password }));
        } else {
            localStorage.removeItem('hoasen_remember_login');
        }
    }

    // Lấy tọa độ GPS nếu thiết bị hỗ trợ (cho nhân viên có yêu cầu GPS)
    let latitude = null;
    let longitude = null;
    if (navigator.geolocation) {
        try {
            const pos = await new Promise((resolve) => {
                navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 3500, enableHighAccuracy: true });
            });
            if (pos && pos.coords) {
                latitude = pos.coords.latitude;
                longitude = pos.coords.longitude;
            }
        } catch(eGeo) {}
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ User_name, User_password, forceLogout: isForced, latitude, longitude })
        });

        // Parse dữ liệu trả về từ Server
        let data = {};
        try {
            data = await response.json();
        } catch (e) {
            data = { error: 'Lỗi định dạng phản hồi từ máy chủ!' };
        }

        // Trường hợp xung đột phiên đăng nhập (Đơn máy / Single-device)
        if (data.conflict) {
            window._pendingConflictLogin = { username: User_name, password: User_password };
            const conflictModal = document.getElementById('sessionConflictModal');
            const conflictDesc = document.getElementById('sessionConflictDesc');
            if (conflictDesc) {
                const nameDisplay = data.user?.Full_name || data.user?.User_name || User_name;
                conflictDesc.innerHTML = `Tài khoản <b>${nameDisplay}</b> hiện đang được đăng nhập trên một thiết bị/máy khác.`;
            }
            if (conflictModal) conflictModal.style.display = 'flex';
            return;
        }

        if (response.ok && data.success) {
            currentUser = data.user;
            window.currentUser = currentUser;
            localStorage.setItem('restaurant_user', JSON.stringify(currentUser));
            window._pendingConflictLogin = null;

            // Đóng modal cảnh báo xung đột nếu đang mở
            const conflictModal = document.getElementById('sessionConflictModal');
            if (conflictModal) conflictModal.style.display = 'none';

            // Đăng ký với Realtime socket session
            if (typeof io === 'function') {
                const socket = window.socket || io(window.location.origin);
                socket.emit('register_user_session', { 
                    userId: currentUser.User_id,
                    username: currentUser.User_name,
                    sessionToken: currentUser.sessionToken || ''
                });
            }

            const welcomeMsg = `Xin chào ${currentUser.Full_name || currentUser.User_name}!`;
            if (window.toast) {
                window.toast.success(welcomeMsg);
            } else if (typeof showToast === 'function') {
                showToast(welcomeMsg, 'success');
            }

            // Đóng Modal Đăng nhập an toàn
            const modalEl = document.getElementById('loginModal');
            if (modalEl) {
                if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                    if (modal) modal.hide();
                } else {
                    modalEl.classList.remove('show');
                    modalEl.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) backdrop.remove();
                }
            }

            // Reset form nếu không chọn lưu mật khẩu
            const rememberCb = document.getElementById('loginRememberMe');
            if (!rememberCb || !rememberCb.checked) {
                document.getElementById('loginForm')?.reset();
            }

            // Đồng bộ ngay cấu hình và phân quyền mới nhất từ máy chủ SQLite
            try {
                const resCfg = await fetch('/api/system-config?t=' + Date.now());
                if (resCfg.ok) {
                    const dataCfg = await resCfg.json();
                    if (dataCfg.success && dataCfg.config) {
                        const cur = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
                        localStorage.setItem('hoasen_system_config', JSON.stringify({ ...cur, ...dataCfg.config }));
                    }
                }
            } catch(e) {}

            // Cập nhật giao diện & Điều hướng trang theo Role và Quyền hạn
            if (typeof checkAuthStatus === 'function') checkAuthStatus();
            if (typeof redirectUserByRole === 'function') redirectUserByRole(currentUser.Role);

            // NẾU LÀ KHÁCH HÀNG: Nổi ngay Modal chứa QRCode của khách kèm nút đóng nhỏ
            const roleUpper = String(currentUser.Role || '').toUpperCase();
            if (['CUSTOMER', 'KHÁCH HÀNG', 'KHACHHANG'].includes(roleUpper)) {
                try {
                    const resCard = await fetch(`/api/members/my-card?username=${encodeURIComponent(currentUser.User_name)}&userId=${encodeURIComponent(currentUser.User_id)}&t=${Date.now()}`);
                    if (resCard.ok) {
                        const cardData = await resCard.json();
                        if (cardData.success && cardData.member) {
                            window.openCustomerQrWelcomeModal(cardData.member);
                        }
                    }
                } catch(errCard) {
                    console.warn('Lỗi nạp mã QR chào mừng khách hàng:', errCard);
                }
            }

        } else {
            // Hiển thị chính xác thông báo lỗi do Server trả về
            const errMsg = data.error || data.message || 'Tên đăng nhập hoặc mật khẩu không chính xác!';
            if (window.toast) window.toast.error(errMsg);
            else alert(errMsg);
        }

    } catch (error) {
        console.error('Lỗi kết nối API đăng nhập:', error);
        if (window.toast) window.toast.error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại đường truyền mạng!');
        else alert('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại đường truyền mạng!');
    }
}

// Xử lý xác nhận đẩy phiên (Force logout máy cũ)
window.confirmForceLogoutSession = function() {
    const conflictModal = document.getElementById('sessionConflictModal');
    if (conflictModal) conflictModal.style.display = 'none';
    handleLogin(null, true);
};

// Hủy bỏ cảnh báo phiên trùng
window.cancelSessionConflict = function() {
    window._pendingConflictLogin = null;
    const conflictModal = document.getElementById('sessionConflictModal');
    if (conflictModal) conflictModal.style.display = 'none';
};

// Mở Modal Mã QR Chào Mừng Khách Hàng
window.openCustomerQrWelcomeModal = function(cardData) {
    const modal = document.getElementById('customerQrWelcomeModal');
    if (!modal) return;

    if (cardData) {
        const nameEl = document.getElementById('custWelcomeMemberName');
        const phoneEl = document.getElementById('custWelcomeMemberPhone');
        const tierEl = document.getElementById('custWelcomeCardTier');
        const pointsEl = document.getElementById('custWelcomePoints');
        const prepaidEl = document.getElementById('custWelcomePrepaid');
        const codeEl = document.getElementById('custWelcomeCardCode');
        const codeBottomEl = document.getElementById('custWelcomeCardCodeBottom');
        const cardBgEl = document.getElementById('custWelcomeCardBg');
        const qrImg = document.getElementById('custWelcomeQrImg');

        const tierName = cardData.tierInfo?.name || cardData.Current_tier || 'Mầm Sen';
        const code = cardData.Card_code || ('HS-' + String(cardData.Member_id || 0).padStart(6, '0'));

        if (nameEl) nameEl.innerText = cardData.Full_name || 'Khách Hàng';
        if (phoneEl) phoneEl.innerText = cardData.Phone ? cardData.Phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') : '---';
        if (tierEl) tierEl.innerText = tierName.toUpperCase();
        if (pointsEl) pointsEl.innerText = Number(cardData.Reward_points || 0).toLocaleString('vi-VN') + ' điểm';
        if (prepaidEl) prepaidEl.innerText = Number(cardData.Prepaid_balance || 0).toLocaleString('vi-VN') + ' đ';
        if (codeEl) codeEl.innerText = code;
        if (codeBottomEl) codeBottomEl.innerText = code;

        if (cardData.tierInfo?.cardBg && cardBgEl) {
            cardBgEl.style.background = cardData.tierInfo.cardBg;
        }

        if (qrImg) {
            const qrData = encodeURIComponent(`HOASEN-MEM:${cardData.Phone || ''}:${code}`);
            qrImg.src = `https://quickchart.io/qr?text=${qrData}&size=200&margin=1`;
            qrImg.onerror = function() {
                this.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`;
            };
        }

        // Lưu dữ liệu khách hàng hiện tại để refresh OTP
        window._currentCustomerModalData = cardData;

        // Tự động sinh mã 6 số OTP bảo mật 30 giây ngay khi mở modal
        window.refreshCustomerQrOtp();
    }

    modal.style.display = 'flex';
};

// Đóng Modal Mã QR Chào Mừng Khách Hàng
window.closeCustomerQrWelcomeModal = function() {
    const modal = document.getElementById('customerQrWelcomeModal');
    if (modal) modal.style.display = 'none';
    if (window._custOtpTimerInterval) {
        clearInterval(window._custOtpTimerInterval);
        window._custOtpTimerInterval = null;
    }
};

// Hàm làm mới mã xác thực OTP 6 số và khởi động đếm lùi 30 giây
window.refreshCustomerQrOtp = async function() {
    const cardData = window._currentCustomerModalData || window.currentUser;
    if (!cardData) return;

    const codeEl = document.getElementById('custWelcomeOtpCode');
    const timerEl = document.getElementById('custWelcomeOtpTimer');
    const iconEl = document.getElementById('custWelcomeOtpRefreshIcon');

    if (iconEl) iconEl.classList.add('fa-spin');
    if (codeEl) codeEl.innerText = '••••••';

    try {
        const memberId = cardData.Member_id || cardData.memberId || 0;
        const phone = cardData.Phone || cardData.phone || cardData.User_name || '';

        const res = await fetch('/api/marketing/security-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Member_id: memberId, Phone: phone })
        });

        const data = await res.json();
        if (iconEl) iconEl.classList.remove('fa-spin');

        if (data.success && data.code) {
            if (codeEl) codeEl.innerText = data.code;

            // Xóa bộ đếm cũ nếu đang chạy
            if (window._custOtpTimerInterval) {
                clearInterval(window._custOtpTimerInterval);
                window._custOtpTimerInterval = null;
            }

            let remainSeconds = Number(data.ttlSeconds || 30);
            const updateTimerDisplay = () => {
                if (timerEl) {
                    timerEl.innerHTML = `<i class="fa-solid fa-clock-rotate-left me-1"></i>${remainSeconds}s`;
                    if (remainSeconds <= 5) {
                        timerEl.className = 'badge rounded-pill bg-danger text-white fw-bold font-monospace animate__animated animate__pulse animate__infinite';
                    } else if (remainSeconds <= 10) {
                        timerEl.className = 'badge rounded-pill bg-warning-subtle text-danger fw-bold border border-warning font-monospace';
                    } else {
                        timerEl.className = 'badge rounded-pill bg-success-subtle text-success fw-bold border border-success font-monospace';
                    }
                }
            };
            updateTimerDisplay();

            window._custOtpTimerInterval = setInterval(() => {
                remainSeconds--;
                if (remainSeconds <= 0) {
                    clearInterval(window._custOtpTimerInterval);
                    window._custOtpTimerInterval = null;
                    if (timerEl) {
                        timerEl.className = 'badge rounded-pill bg-danger text-white fw-bold font-monospace';
                        timerEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i>Hết hạn';
                    }
                    if (codeEl) {
                        codeEl.classList.add('text-muted');
                        codeEl.innerText = '------';
                    }
                    // Tự động làm mới mã sau khi hết hạn 1 giây
                    setTimeout(() => {
                        const modal = document.getElementById('customerQrWelcomeModal');
                        if (modal && modal.style.display !== 'none') {
                            window.refreshCustomerQrOtp();
                        }
                    }, 1000);
                } else {
                    updateTimerDisplay();
                }
            }, 1000);
        } else {
            if (codeEl) codeEl.innerText = 'LỖI';
            if (window.toast) window.toast.error(data.error || 'Không thể tạo mã OTP');
        }
    } catch (err) {
        if (iconEl) iconEl.classList.remove('fa-spin');
        if (codeEl) codeEl.innerText = 'LỖI';
        console.error('Lỗi refreshCustomerQrOtp:', err);
    }
};

// Lắng nghe socket: Khi nhân viên tại quầy/giỏ hàng xác thực mã OTP thành công, tự động tắt Modal QR
if (typeof window !== 'undefined') {
    const attachSecurityVerifiedListener = () => {
        if (window.socket && !window._hasAttachedSecVerifiedListener) {
            window._hasAttachedSecVerifiedListener = true;
            window.socket.on('customer_security_code_verified', (data) => {
                const currentData = window._currentCustomerModalData || window.currentUser;
                const modal = document.getElementById('customerQrWelcomeModal');
                
                // Kiểm tra xem sự kiện có đúng là của khách này không (hoặc nếu modal đang mở)
                const currentMemId = currentData ? (currentData.Member_id || currentData.memberId || currentData.id) : null;
                const currentPhone = currentData ? (currentData.Phone || currentData.phone || currentData.User_name) : null;
                
                const isMatch = !currentData || 
                    (data.memberId && currentMemId && String(data.memberId) === String(currentMemId)) ||
                    (data.phone && currentPhone && String(data.phone) === String(currentPhone));

                if (modal && modal.style.display !== 'none' && isMatch) {
                    window.closeCustomerQrWelcomeModal();
                    if (window.toast) {
                        window.toast.success(`🎉 Nhân viên đã xác thực mã và áp dụng thẻ thành công!`);
                    } else {
                        alert('🎉 Nhân viên đã xác thực mã và áp dụng thẻ thành công!');
                    }
                }
            });
        }
    };

    if (window.socket) {
        attachSecurityVerifiedListener();
    } else {
        window.addEventListener('DOMContentLoaded', attachSecurityVerifiedListener);
        setTimeout(attachSecurityVerifiedListener, 1500);
    }
}

// 4. Đăng Xuất Hệ Thống
async function handleLogout() {
    const confirmed = (window.toast && typeof window.toast.confirm === 'function')
        ? await window.toast.confirm('Bạn có chắc chắn muốn đăng xuất?', 'Xác nhận đăng xuất')
        : confirm('Bạn có chắc chắn muốn đăng xuất?');

    if (confirmed) {
        const oldUserId = currentUser?.User_id;
        const oldUsername = currentUser?.User_name;
        currentUser = null;
        window.currentUser = null;
        localStorage.removeItem('restaurant_user');

        // Báo cho server giải phóng session
        if (oldUserId || oldUsername) {
            fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: oldUserId, username: oldUsername })
            }).catch(() => {});
        }

        checkAuthStatus();
        if (window.toast) window.toast.success('Đã đăng xuất thành công!');
        navigateTo('/');
        setTimeout(() => openLoginModal(), 300);
    }
}

// Kiểm tra quyền hạn truy cập module Thu tiền & Thanh toán
function hasPaymentPermission(user) {
    if (!user) return false;
    const perms = getUserPermissions(user);
    return perms.includes('COLLECT_PAYMENT') || perms.includes('ORDERS_ALL');
}
window.hasPaymentPermission = hasPaymentPermission;

// Kiểm tra quyền xem toàn bộ đơn hàng của cửa hàng
function canViewAllOrders(user) {
    if (!user) return false;
    const perms = getUserPermissions(user);
    return perms.includes('ORDERS_ALL');
}
window.canViewAllOrders = canViewAllOrders;

// 5. Kiểm tra trạng thái đăng nhập & Phân quyền ẩn/hiện các Tab Navigation
function checkAuthStatus() {
    const user = currentUser || window.currentUser;
    const authContainer = document.getElementById('authNavArea');

    if (authContainer) {
        if (user) {
            authContainer.innerHTML = `
                <button id="btnHeaderWakeLock" class="btn btn-sm btn-outline-light rounded-pill px-2 py-1 me-2" onclick="window.toggleScreenWakeLockQuick()" title="Bật/Tắt giữ màn hình luôn sáng liên tục (không tự tắt/khóa máy)">
                    <i class="fa-regular fa-sun" id="headerWakeLockIcon"></i> <span class="d-none d-md-inline" id="headerWakeLockText">Sáng liên tục: TẮT</span>
                </button>
                <span style="color: white; font-weight: 600; margin-right: 10px;">
                    <i class="fa-solid fa-circle-user"></i> ${user.Full_name || user.User_name} (${getRoleTitle(user.Role)})
                </span>
                <button class="btn btn-outline-light" style="padding: 4px 10px; font-size: 12px;" onclick="handleLogout()">
                    <i class="fa-solid fa-right-from-bracket"></i> Đăng xuất
                </button>
            `;
            if (typeof window.updateWakeLockUI === 'function') {
                window.updateWakeLockUI(localStorage.getItem('hoasen_keep_screen_awake') === '1');
            }
        } else {
            authContainer.innerHTML = `
                <button class="btn btn-outline-light" style="padding: 6px 12px; font-size: 13px;" onclick="openLoginModal()">
                    <i class="fa-solid fa-right-to-bracket"></i> Đăng Nhập
                </button>
            `;
        }
    }

    const tabGuestHome = document.getElementById('guestHomeTab') || document.querySelector('button[data-route="/"]');
    const tabTables = document.querySelector('button[data-route="/tables"]') || document.getElementById('tablesTab');
    const tabOrders = document.querySelector('button[data-route="/orders"]');
    const tabCategories = document.querySelector('button[data-route="/categories"]');
    const tabMenu = document.querySelector('button[data-route="/menu"]');
    const tabMenuCards = document.querySelector('button[data-route="/menu-cards"]');
    const tabCart = document.querySelector('button[data-route="/cart"]');
    const tabMembers = document.querySelector('button[data-route="/members"]') || document.getElementById('membersTab');
    const tabUsers = document.querySelector('button[data-route="/users"]');
    const tabAdminSystem = document.getElementById('adminSystemTab');
    const tabKitchen = document.getElementById('kitchenTab');
    const tabReadyOrders = document.getElementById('readyOrdersTab') || document.querySelector('button[data-route="/ready-orders"]');
    const floatingCartBtn = document.getElementById('floatingCartBtn');
    const floatingButtonsContainer = document.getElementById('floatingButtonsContainer');
    const navTabsBar = document.querySelector('.nav-tabs');

    // 1. Reset ẩn toàn bộ các tab mặc định
    if (tabGuestHome) tabGuestHome.style.display = 'none';
    if (tabTables) tabTables.style.display = 'none';
    if (tabOrders) tabOrders.style.display = 'none';
    if (tabCategories) tabCategories.style.display = 'none';
    if (tabMenu) tabMenu.style.display = 'none';
    if (tabMenuCards) tabMenuCards.style.display = 'none';
    if (tabCart) tabCart.style.display = 'none';
    if (tabMembers) tabMembers.style.display = 'none';
    if (tabReadyOrders) {
        tabReadyOrders.classList.add('d-none');
        tabReadyOrders.style.display = 'none';
    }
    if (tabUsers) tabUsers.style.display = 'none';
    if (tabAdminSystem) tabAdminSystem.classList.add('d-none');
    if (tabKitchen) tabKitchen.classList.add('d-none');
    if (floatingCartBtn) floatingCartBtn.style.display = 'none';

    // Nếu chưa đăng nhập: Ẩn thanh tab bar và toàn bộ các nút nổi (Giỏ hàng, Shipper...)
    if (!user) {
        if (navTabsBar) navTabsBar.classList.add('d-none');
        if (floatingButtonsContainer) floatingButtonsContainer.style.display = 'none';
        return;
    }

    // 🌟 PHÂN BIỆT KHÁCH HÀNG (CUSTOMER) VÀ NHÂN VIÊN
    const isCustomer = String(user.Role || user.role).toUpperCase() === 'CUSTOMER';
    if (isCustomer) {
        // Khách hàng: Tuyệt đối KHÔNG hiển thị các tab nhân viên VÀ KHÔNG hiển thị giỏ hàng, menu món ăn
        if (navTabsBar) navTabsBar.classList.remove('d-none');
        if (tabGuestHome) {
            tabGuestHome.style.display = 'inline-flex';
            tabGuestHome.innerHTML = '<i class="fa-solid fa-id-card me-1"></i> Thẻ & Đơn Hàng Của Tôi';
        }
        if (tabMenuCards) tabMenuCards.style.display = 'none';
        if (tabCart) tabCart.style.display = 'none';
        if (floatingCartBtn) floatingCartBtn.style.display = 'none';
        if (floatingButtonsContainer) floatingButtonsContainer.style.display = 'none';
        return;
    }

    // Khi đã đăng nhập là nhân viên:
    // 2. Lấy danh sách quyền hạn cụ thể của nhân viên
    const perms = getUserPermissions(user);

    if (perms.length > 0) {
        if (navTabsBar) navTabsBar.classList.remove('d-none');
    } else {
        // Tài khoản không có bất kỳ quyền nào
        if (navTabsBar) navTabsBar.classList.add('d-none');
    }

    // 🌟 PHÂN QUYỀN CỤM NÚT NỔI SHIPPER & GIỎ HÀNG
    const hasCartPerm = perms.includes('CART');
    const hasShipperPerm = perms.includes('FLOATING_SHIPPER');
    const dynamicFloatingList = document.getElementById('dynamicFloatingButtonsList');
    const dynamicFloatingLeft = document.getElementById('dynamicFloatingButtonsLeft');
    const dynamicFloatingRight = document.getElementById('dynamicFloatingButtonsRight');

    if (hasShipperPerm) {
        if (typeof window.renderGlobalFloatingButtons === 'function') {
            window.renderGlobalFloatingButtons();
        }
    } else {
        if (dynamicFloatingList) {
            dynamicFloatingList.style.display = 'none';
            dynamicFloatingList.innerHTML = '';
        }
        if (dynamicFloatingLeft) {
            dynamicFloatingLeft.style.display = 'none';
            dynamicFloatingLeft.innerHTML = '';
        }
        if (dynamicFloatingRight) {
            dynamicFloatingRight.style.display = 'none';
            dynamicFloatingRight.innerHTML = '';
        }
    }

    // Tab Giỏ Hàng & Icon Giỏ Hàng Nổi
    if (hasCartPerm) {
        if (tabCart) tabCart.style.display = 'inline-flex';
        if (floatingCartBtn) floatingCartBtn.style.display = 'flex';
    } else {
        if (tabCart) tabCart.style.display = 'none';
        if (floatingCartBtn) floatingCartBtn.style.display = 'none';
    }

    // Khung chứa nút nổi toàn cục (Chỉ hiện nếu có ít nhất 1 trong 2 quyền: Giỏ hàng hoặc Nút Shipper)
    if (floatingButtonsContainer) {
        if (hasCartPerm || hasShipperPerm) {
            floatingButtonsContainer.style.display = 'flex';
        } else {
            floatingButtonsContainer.style.display = 'none';
        }
    }

    // Tab Phòng Bàn
    if (perms.includes('TABLES_VIEW') && tabTables) {
        tabTables.style.display = 'inline-flex';
    }

    // Tab Đơn Hàng
    if (perms.includes('ORDERS_PERSONAL') || perms.includes('ORDERS_LIST') || perms.includes('ORDERS_ALL')) {
        if (tabOrders) {
            tabOrders.style.display = 'inline-flex';
            if (perms.includes('ORDERS_ALL')) {
                tabOrders.innerHTML = '<i class="fa-solid fa-receipt me-1"></i> Đơn Hàng & Đặt Món';
            } else {
                tabOrders.innerHTML = '<i class="fa-solid fa-clipboard-user me-1 text-warning"></i> Đơn Hàng & Nhật Ký Cá Nhân';
            }
        }
    }

    // Tab Menu Dạng Thẻ
    if (perms.includes('MENU_CARDS') && tabMenuCards) {
        tabMenuCards.style.display = 'inline-flex';
    }

    // Tab Hội Viên & Thẻ Thành Viên (Nội bộ nhân viên quản lý)
    if (perms.includes('MEMBERS_MANAGE') && tabMembers) {
        tabMembers.style.display = 'inline-flex';
    }

    // Tab Nhận Món (Bếp Xong)
    if (perms.includes('READY_ORDERS') && tabReadyOrders) {
        tabReadyOrders.classList.remove('d-none');
        tabReadyOrders.style.display = 'inline-flex';
    }

    // Tab Màn Hình Bếp KDS
    if (perms.includes('KITCHEN') && tabKitchen) {
        tabKitchen.classList.remove('d-none');
        tabKitchen.style.display = 'inline-flex';
    }

    // Tab Quản Lý Thực Đơn & Danh Mục
    if (perms.includes('MENU_MANAGE')) {
        if (tabCategories) tabCategories.style.display = 'inline-flex';
        if (tabMenu) tabMenu.style.display = 'inline-flex';
    }

    // Tab Người Dùng
    if (perms.includes('USERS_MANAGE') && tabUsers) {
        tabUsers.style.display = 'inline-flex';
    }

    // Tab Quản Lý Hệ Thống
    if (perms.includes('SYSTEM_CONFIG') && tabAdminSystem) {
        tabAdminSystem.classList.remove('d-none');
    }
}
window.checkAuthStatus = checkAuthStatus;

// Cập nhật hàm điều hướng tự động khi đăng nhập
function redirectUserByRole(role) {
    const user = currentUser || window.currentUser;
    const perms = getUserPermissions(user);
    const roleUpper = String(role).toUpperCase();

    if (['CUSTOMER', 'KHÁCH HÀNG', 'KHACHHANG'].includes(roleUpper)) {
        navigateTo('/');
        return;
    }

    // Điều hướng theo quyền hạn cao nhất được cấp
    if (['ADMIN', 'QUẢN LÝ', 'QUANLY'].includes(roleUpper) && perms.includes('SYSTEM_CONFIG')) {
        navigateTo('/system-settings');
    } else if (['KITCHEN', 'BẾP', 'BEP'].includes(roleUpper) && perms.includes('KITCHEN')) {
        navigateTo('/kitchen');
    } else if (perms.includes('TABLES_VIEW')) {
        navigateTo('/tables');
    } else if (perms.includes('ORDERS_PERSONAL') || perms.includes('ORDERS_LIST') || perms.includes('ORDERS_ALL')) {
        navigateTo('/orders');
    } else if (perms.includes('MENU_CARDS')) {
        navigateTo('/menu-cards');
    } else if (perms.includes('CART')) {
        navigateTo('/cart');
    } else if (perms.includes('READY_ORDERS')) {
        navigateTo('/ready-orders');
    } else if (perms.includes('MEMBERS_MANAGE')) {
        navigateTo('/members');
    } else if (perms.includes('USERS_MANAGE')) {
        navigateTo('/users');
    } else if (perms.includes('SYSTEM_CONFIG')) {
        navigateTo('/system-settings');
    } else {
        navigateTo('/orders');
    }
}

// Helper: Đổi Mã Role SQLite sang Tên hiển thị Tiếng Việt
function getRoleTitle(role) {
    const rolesMap = {
        'ADMIN': 'Quản Lý',
        'CASHIER': 'Thu Ngân',
        'KITCHEN': 'Bếp',
        'WAITER': 'Phục Vụ',
        'CUSTOMER': 'Khách Hàng'
    };
    return rolesMap[role] || role || 'Khách';
}
