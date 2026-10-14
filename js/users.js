let globalUsersData = [];
window._showAllUserPasswords = false;
window._revealedUserPasswords = new Set();
window._userHasTypedSearch = false;

function scrubBrowserAutofillOnUsersPage() {
    const searchEl = document.getElementById('searchUserKeyword');
    if (searchEl && !window._userHasTypedSearch && searchEl.value) {
        searchEl.value = '';
        renderUsersList();
    }
    const editId = document.getElementById('editUserId')?.value;
    if (!editId) {
        const uNameEl = document.getElementById('inputUserName');
        const uPwdEl = document.getElementById('inputUserPassword');
        if (uNameEl && document.activeElement !== uNameEl && uNameEl.value) uNameEl.value = '';
        if (uPwdEl && document.activeElement !== uPwdEl && uPwdEl.value) uPwdEl.value = '';
    }
}

window.clearUserSearchFilter = function() {
    window._userHasTypedSearch = false;
    const searchEl = document.getElementById('searchUserKeyword');
    if (searchEl) searchEl.value = '';
    if (document.getElementById('filterUserRoleGroup')) document.getElementById('filterUserRoleGroup').value = 'ALL';
    if (document.getElementById('filterUserStatus')) document.getElementById('filterUserStatus').value = 'ALL';
    if (document.getElementById('filterUserGender')) document.getElementById('filterUserGender').value = 'ALL';
    renderUsersList();
};

window.toggleUserFormPanel = function(forceOpen) {
    const bodyEl = document.getElementById('userFormCardBody');
    const btnEl = document.getElementById('btnToggleUserFormPanel');
    if (!bodyEl) return;

    const isCurrentlyHidden = bodyEl.style.display === 'none';
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : isCurrentlyHidden;

    bodyEl.style.display = shouldOpen ? 'block' : 'none';
    if (btnEl) {
        if (shouldOpen) {
            btnEl.innerHTML = '<i class="fa-solid fa-chevron-up me-1"></i> Thu Gọn Form';
            btnEl.className = 'btn btn-outline-secondary btn-sm fw-bold';
        } else {
            btnEl.innerHTML = '<i class="fa-solid fa-plus me-1"></i> Mở Form Thêm Nhân Sự Mới';
            btnEl.className = 'btn btn-success btn-sm fw-bold shadow-sm';
        }
    }
};

// 1. Tải danh sách người dùng từ API
async function loadUsers() {
    try {
        scrubBrowserAutofillOnUsersPage();
        const res = await fetch('/api/users?t=' + Date.now());
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server phản hồi mã lỗi ${res.status}`);
        }

        globalUsersData = await res.json();
        scrubBrowserAutofillOnUsersPage();
        updateUsersKpiCards();
        renderUsersList();

        setTimeout(scrubBrowserAutofillOnUsersPage, 250);
        setTimeout(scrubBrowserAutofillOnUsersPage, 700);
    } catch (err) {
        console.error('Lỗi tải danh sách người dùng:', err.message);
        const tableBody = document.getElementById('usersListTable');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Không thể tải danh sách tài khoản: ${err.message}</td></tr>`;
        }
    }
}

// 2. Cập nhật 4 thẻ KPI nhân sự & tài khoản
function updateUsersKpiCards() {
    const users = Array.isArray(globalUsersData) ? globalUsersData : [];
    const total = users.length;
    let staffCount = 0;
    let adminCount = 0;
    let cashierCount = 0;
    let waiterCount = 0;
    let kitchenCount = 0;
    let customerCount = 0;
    let activeCount = 0;
    let lockedCount = 0;

    users.forEach(u => {
        const role = String(u.Role || u.User_role || 'WAITER').toUpperCase();
        const status = String(u.Status || 'ACTIVE').toUpperCase();

        if (status === 'LOCKED') lockedCount++;
        else activeCount++;

        if (role === 'CUSTOMER') {
            customerCount++;
        } else {
            staffCount++;
            if (role === 'ADMIN') adminCount++;
            else if (role === 'CASHIER') cashierCount++;
            else if (role === 'WAITER') waiterCount++;
            else if (role === 'KITCHEN') kitchenCount++;
        }
    });

    const elTotal = document.getElementById('userKpiTotal');
    const elStaff = document.getElementById('userKpiStaff');
    const elStaffSub = document.getElementById('userKpiStaffSub');
    const elActive = document.getElementById('userKpiActive');
    const elLockedSub = document.getElementById('userKpiLockedSub');
    const elCustomers = document.getElementById('userKpiCustomers');

    if (elTotal) elTotal.innerText = total;
    if (elStaff) elStaff.innerText = staffCount;
    if (elStaffSub) elStaffSub.innerText = `QL: ${adminCount} • TN: ${cashierCount} • PV: ${waiterCount} • Bếp: ${kitchenCount}`;
    if (elActive) elActive.innerText = activeCount;
    if (elLockedSub) elLockedSub.innerText = `Đang khóa: ${lockedCount} tài khoản`;
    if (elCustomers) elCustomers.innerText = customerCount;
}

// Định dạng ngày sinh YYYY-MM-DD -> DD/MM/YYYY kèm tuổi
function formatBirthdayWithAge(bdayStr) {
    if (!bdayStr) return '<span class="text-muted fst-italic">Chưa cập nhật</span>';
    const clean = String(bdayStr).trim();
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        const year = parseInt(parts[0], 10);
        const age = new Date().getFullYear() - year;
        const ageText = (!isNaN(age) && age > 0 && age < 110) ? ` <span class="text-muted">(${age} tuổi)</span>` : '';
        return `<b>${parts[2]}/${parts[1]}/${parts[0]}</b>${ageText}`;
    }
    return `<b>${clean}</b>`;
}

// Định dạng ngày YYYY-MM-DD -> DD/MM/YYYY
function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const clean = String(dateStr).trim();
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4 && parts[2].length === 2) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return clean;
}

// 3. Render bảng danh sách hồ sơ người dùng
function renderUsersList() {
    const tableBody = document.getElementById('usersListTable') || document.getElementById('usersList');
    if (!tableBody) return;

    const searchInputEl = document.getElementById('searchUserKeyword');
    if (searchInputEl && !window._userHasTypedSearch && searchInputEl.value) {
        searchInputEl.value = '';
    }

    const roleFilter = document.getElementById('filterUserRoleGroup')?.value || 'ALL';
    const statusFilter = document.getElementById('filterUserStatus')?.value || 'ALL';
    const genderFilter = document.getElementById('filterUserGender')?.value || 'ALL';
    const keyword = window._userHasTypedSearch
        ? (searchInputEl?.value || '').trim().toLowerCase()
        : '';

    const filtered = (globalUsersData || []).filter(u => {
        const role = String(u.Role || u.User_role || 'WAITER').toUpperCase();
        const status = String(u.Status || 'ACTIVE').toUpperCase();
        const gender = String(u.Gender || 'Khác').trim();

        if (roleFilter === 'STAFF_ONLY' && role === 'CUSTOMER') return false;
        if (roleFilter !== 'ALL' && roleFilter !== 'STAFF_ONLY' && role !== roleFilter) return false;
        if (statusFilter !== 'ALL' && status !== statusFilter) return false;
        if (genderFilter !== 'ALL' && gender !== genderFilter) return false;

        if (keyword) {
            const haystack = [
                u.User_name,
                u.Full_name,
                u.Phone,
                u.Email,
                u.Address,
                u.Citizen_id,
                u.Emergency_contact,
                u.Position_note,
                u.Shift
            ].map(x => String(x || '').toLowerCase()).join(' ');
            if (!haystack.includes(keyword)) return false;
        }
        return true;
    });

    const countBadge = document.getElementById('usersFilteredCountBadge');
    if (countBadge) countBadge.innerText = `${filtered.length} hồ sơ`;

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">Không tìm thấy hồ sơ tài khoản nào phù hợp với bộ lọc</td></tr>`;
        return;
    }

    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
    const currentRoleUpper = String(currentUser.Role || '').toUpperCase();
    const isAdmin = ['ADMIN', 'QUẢN LÝ', 'MANAGER'].includes(currentRoleUpper) || ['admin', 'vu'].includes(String(currentUser.User_name || '').toLowerCase());

    tableBody.innerHTML = filtered.map(user => {
        const uid = user.User_id;
        const role = String(user.Role || user.User_role || 'WAITER').toUpperCase();
        const status = String(user.Status || 'ACTIVE').toUpperCase();
        const isLocked = (status === 'LOCKED');
        const fullName = user.Full_name || user.User_name || 'Chưa đặt tên';
        const gender = user.Gender || 'Khác';

        // Badge Giới tính
        let genderBadge = `<span class="badge bg-secondary-subtle text-secondary border">${gender}</span>`;
        if (gender === 'Nam') genderBadge = `<span class="badge bg-primary-subtle text-primary border border-primary-subtle"><i class="fa-solid fa-mars me-1"></i>Nam</span>`;
        else if (gender === 'Nữ') genderBadge = `<span class="badge bg-danger-subtle text-danger border border-danger-subtle"><i class="fa-solid fa-venus me-1"></i>Nữ</span>`;

        // Badge Vai trò
        const roleBadge = getRoleBadgeHtml(role);

        // Hiển thị mật khẩu (ẩn hoặc hiện)
        const isPwdShown = window._showAllUserPasswords || window._revealedUserPasswords.has(Number(uid));
        const rawPwd = String(user.User_password || '');
        const pwdDisplay = isPwdShown
            ? `<code class="fw-bold text-dark bg-warning-subtle px-2 py-1 rounded border">${rawPwd}</code>`
            : `<span class="text-muted font-monospace" style="letter-spacing: 2px;">••••••</span>`;

        // Hiển thị Trạng thái
        const statusBadge = isLocked
            ? `<span class="badge bg-danger px-2 py-1"><i class="fa-solid fa-lock me-1"></i>Tạm khóa</span>`
            : `<span class="badge bg-success px-2 py-1"><i class="fa-solid fa-circle-check me-1"></i>Hoạt động</span>`;

        const rowStyle = isLocked ? 'style="background-color: #fff5f5; opacity: 0.88;"' : '';

        return `
            <tr ${rowStyle}>
                <!-- 1. Họ Tên & Tài Khoản -->
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <div class="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white shadow-sm flex-shrink-0"
                             style="width: 36px; height: 36px; background: ${role === 'ADMIN' ? '#198754' : (role === 'CASHIER' ? '#0d6efd' : (role === 'KITCHEN' ? '#fd7e14' : (role === 'WAITER' ? '#20c997' : '#6c757d')))}; font-size: 14px;">
                            ${String(fullName).trim().charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="fw-bold text-dark" style="font-size: 13.5px;">${fullName}</div>
                            <div class="small text-success fw-semibold">
                                <i class="fa-solid fa-at" style="font-size: 10px;"></i>${user.User_name}
                                <span class="text-muted ms-1" style="font-size: 10.5px;">(#${uid})</span>
                            </div>
                            ${user.Citizen_id ? `<div class="text-muted" style="font-size: 11px;"><i class="fa-regular fa-id-card me-1"></i>CCCD: <b>${user.Citizen_id}</b></div>` : ''}
                        </div>
                    </div>
                </td>

                <!-- 2. Giới Tính & Ngày Sinh -->
                <td class="small">
                    <div class="mb-1">${genderBadge}</div>
                    <div style="font-size: 11.5px;">
                        <i class="fa-solid fa-cake-candles text-warning me-1"></i>${formatBirthdayWithAge(user.Birthday)}
                    </div>
                </td>

                <!-- 3. Liên Hệ & Địa Chỉ -->
                <td class="small" style="font-size: 11.5px; max-width: 240px;">
                    <div>
                        <i class="fa-solid fa-phone text-success me-1"></i>
                        ${user.Phone ? `<a href="tel:${user.Phone}" class="fw-bold text-dark text-decoration-none">${user.Phone}</a>` : '<span class="text-muted fst-italic">Chưa có SĐT</span>'}
                    </div>
                    ${user.Email ? `<div class="text-truncate" title="${user.Email}"><i class="fa-solid fa-envelope text-primary me-1"></i>${user.Email}</div>` : ''}
                    ${user.Address ? `<div class="text-muted mt-1" style="line-height: 1.3;"><i class="fa-solid fa-location-dot text-danger me-1"></i>${user.Address}</div>` : '<div class="text-muted fst-italic" style="font-size: 10.5px;">Chưa cập nhật địa chỉ</div>'}
                    ${user.Emergency_contact ? `<div class="text-danger-emphasis mt-1" style="font-size: 10.5px;"><i class="fa-solid fa-kit-medical me-1"></i>Khẩn cấp: ${user.Emergency_contact}</div>` : ''}
                </td>

                <!-- 4. Vai Trò & Ca Làm -->
                <td class="small">
                    <div>${roleBadge}</div>
                    <div class="mt-1 text-secondary" style="font-size: 11px;">
                        <i class="fa-regular fa-clock me-1"></i>Ca: <b>${user.Shift || 'Toàn thời gian'}</b>
                    </div>
                    ${user.Hire_date ? `<div class="text-muted" style="font-size: 10.5px;"><i class="fa-solid fa-calendar-check me-1"></i>Vào làm: ${formatDateShort(user.Hire_date)}</div>` : ''}
                    ${user.Position_note ? `<div class="text-primary fst-italic mt-1" style="font-size: 10.5px;">"${user.Position_note}"</div>` : ''}
                </td>

                <!-- 5. Mật Khẩu -->
                <td class="text-center align-middle">
                    <div class="d-flex align-items-center justify-content-center gap-1">
                        ${pwdDisplay}
                        <button type="button" class="btn btn-sm btn-light border py-0 px-1" onclick="window.toggleRowPassword(${uid})" title="Hiện/Ẩn mật khẩu">
                            <i class="fa-solid ${isPwdShown ? 'fa-eye-slash text-danger' : 'fa-eye text-secondary'}" style="font-size: 11px;"></i>
                        </button>
                    </div>
                    ${user.Password_changed_at ? `<div class="text-muted mt-1" style="font-size: 9.5px;" title="Lần đổi mật khẩu gần nhất"><i class="fa-solid fa-key me-1"></i>Đổi: ${String(user.Password_changed_at).substring(0, 16)}</div>` : ''}
                </td>

                <!-- 6. Trạng Thái -->
                <td class="text-center align-middle">
                    ${statusBadge}
                </td>

                <!-- 7. Ngày Tạo & Sửa Gần Nhất -->
                <td class="small" style="font-size: 11px;">
                    <div class="text-secondary" title="Ngày tạo tài khoản">
                        <i class="fa-regular fa-calendar-plus text-success me-1"></i>Tạo: <b>${user.Created_at ? String(user.Created_at).substring(0, 16) : '---'}</b>
                    </div>
                    <div class="text-primary mt-1" title="Ngày chỉnh sửa hồ sơ gần nhất">
                        <i class="fa-solid fa-pen-Nib me-1"></i>Sửa: <b>${user.Updated_at ? String(user.Updated_at).substring(0, 16) : '---'}</b>
                    </div>
                </td>

                <!-- 8. Thao Tác -->
                <td class="text-center align-middle">
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-primary fw-bold" onclick="editUser(${uid})" title="Chỉnh sửa đầy đủ hồ sơ cá nhân">
                            <i class="fa-solid fa-user-pen"></i> Sửa
                        </button>
                        <button type="button" class="btn btn-outline-warning text-dark fw-bold" onclick="window.openQuickPasswordModal(${uid}, '${user.User_name}', ${isAdmin})" title="Đổi mật khẩu tài khoản này">
                            <i class="fa-solid fa-key"></i> MK
                        </button>
                        <button type="button" class="btn ${isLocked ? 'btn-outline-success' : 'btn-outline-secondary'} fw-bold" onclick="window.toggleUserAccountStatus(${uid}, '${isLocked ? 'ACTIVE' : 'LOCKED'}', '${user.User_name}')" title="${isLocked ? 'Mở khóa tài khoản' : 'Tạm khóa tài khoản'}">
                            <i class="fa-solid ${isLocked ? 'fa-unlock' : 'fa-lock'}"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger fw-bold" onclick="deleteUser(${uid})" title="Xóa tài khoản">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Bật/tắt hiển thị mật khẩu của 1 dòng
window.toggleRowPassword = function(userId) {
    const idNum = Number(userId);
    if (window._revealedUserPasswords.has(idNum)) {
        window._revealedUserPasswords.delete(idNum);
    } else {
        window._revealedUserPasswords.add(idNum);
    }
    renderUsersList();
};

// Bật/tắt hiển thị toàn bộ mật khẩu trong bảng
window.toggleShowAllUserPasswords = function() {
    window._showAllUserPasswords = !window._showAllUserPasswords;
    const btn = document.getElementById('btnToggleAllPasswords');
    if (btn) {
        btn.innerHTML = window._showAllUserPasswords
            ? '<i class="fa-solid fa-eye-slash me-1 text-danger"></i> Ẩn tất cả mật khẩu'
            : '<i class="fa-solid fa-eye me-1"></i> Hiện tất cả mật khẩu';
    }
    renderUsersList();
};

// Ẩn/hiện mật khẩu trên Form thêm/sửa
window.toggleUserFormPassword = function() {
    const input = document.getElementById('inputUserPassword');
    const icon = document.getElementById('userFormPwdEye');
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
};

// Tạo mật khẩu ngẫu nhiên dễ nhớ cho nhân viên
window.generateRandomUserPassword = function() {
    const input = document.getElementById('inputUserPassword');
    const icon = document.getElementById('userFormPwdEye');
    if (!input) return;
    const rand = 'HS' + Math.floor(1000 + Math.random() * 9000);
    input.value = rand;
    input.type = 'text';
    if (icon) {
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    }
    if (window.toast) window.toast.info(`Đã tạo mật khẩu mẫu: ${rand}`);
};

// Tự động gợi ý ca làm khi chọn Role
window.onUserRoleSelectChange = function() {
    const role = document.getElementById('selectUserRole')?.value;
    const shiftSelect = document.getElementById('selectUserShift');
    if (!shiftSelect) return;
    if (role === 'CUSTOMER') {
        shiftSelect.value = 'Khách hàng';
    } else if (shiftSelect.value === 'Khách hàng') {
        shiftSelect.value = 'Toàn thời gian';
    }
};

// 4. Xử lý gửi Form (Tạo mới / Cập nhật đầy đủ hồ sơ cá nhân)
async function handleUserSubmit(event) {
    if (event) event.preventDefault();

    const userId = document.getElementById('editUserId')?.value;
    const userName = (document.getElementById('inputUserName')?.value || '').trim();
    const userPassword = (document.getElementById('inputUserPassword')?.value || '').trim();
    const userRole = document.getElementById('selectUserRole')?.value || 'WAITER';
    const userStatus = document.getElementById('selectUserStatus')?.value || 'ACTIVE';

    const fullName = (document.getElementById('inputUserFullName')?.value || '').trim();
    const gender = document.getElementById('selectUserGender')?.value || 'Khác';
    const birthday = document.getElementById('inputUserBirthday')?.value || '';
    const citizenId = (document.getElementById('inputUserCitizenId')?.value || '').trim();
    const phone = (document.getElementById('inputUserPhone')?.value || '').trim();
    const email = (document.getElementById('inputUserEmail')?.value || '').trim();
    const address = (document.getElementById('inputUserAddress')?.value || '').trim();

    const shift = document.getElementById('selectUserShift')?.value || 'Toàn thời gian';
    const hireDate = document.getElementById('inputUserHireDate')?.value || '';
    const emergencyContact = (document.getElementById('inputUserEmergencyContact')?.value || '').trim();
    const positionNote = (document.getElementById('inputUserPositionNote')?.value || '').trim();

    if (!userName || !userPassword) {
        if (window.toast) window.toast.error('Vui lòng điền đầy đủ Tên đăng nhập và Mật khẩu!');
        else alert('Vui lòng điền đầy đủ Tên đăng nhập và Mật khẩu!');
        return;
    }

    if (!fullName) {
        if (window.toast) window.toast.error('Vui lòng nhập Họ và tên người dùng!');
        else alert('Vui lòng nhập Họ và tên người dùng!');
        return;
    }

    const payload = {
        User_name: userName,
        User_password: userPassword,
        User_role: userRole,
        Role: userRole,
        Status: userStatus,
        Full_name: fullName,
        Gender: gender,
        Birthday: birthday,
        Citizen_id: citizenId,
        Phone: phone,
        Email: email,
        Address: address,
        Shift: shift,
        Hire_date: hireDate,
        Emergency_contact: emergencyContact,
        Position_note: positionNote
    };

    const isEdit = Boolean(userId);
    const url = isEdit ? `/api/users/${userId}` : '/api/users';
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.success) {
            if (window.toast) {
                window.toast.success(isEdit ? 'Đã cập nhật hồ sơ & tài khoản thành công!' : 'Đã tạo hồ sơ tài khoản mới thành công!');
            }

            // Nếu người dùng đang sửa chính tài khoản đang đăng nhập của mình -> đồng bộ lại localStorage
            const cur = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || 'null');
            if (cur && data.user && String(cur.User_id) === String(data.user.User_id)) {
                const merged = { ...cur, ...data.user };
                window.currentUser = merged;
                localStorage.setItem('restaurant_user', JSON.stringify(merged));
                if (typeof window.checkAuthStatus === 'function') window.checkAuthStatus();
            }

            resetUserForm();
            await loadUsers();
        } else {
            if (window.toast) window.toast.error(data.error || 'Thao tác thất bại!');
            else alert(data.error || 'Thao tác thất bại!');
        }
    } catch (err) {
        console.error('Lỗi gửi dữ liệu:', err);
        if (window.toast) window.toast.error('Không thể kết nối đến máy chủ!');
        else alert('Không thể kết nối đến máy chủ!');
    }
}

// 5. Đưa toàn bộ thông tin cá nhân lên Form khi bấm Sửa
function editUser(userId) {
    const user = globalUsersData.find(u => Number(u.User_id || u.user_id || u.id) === Number(userId));
    if (!user) return;

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    setVal('editUserId', user.User_id);
    setVal('inputUserName', user.User_name || '');
    setVal('inputUserPassword', user.User_password || '');
    setVal('selectUserRole', user.Role || user.User_role || 'WAITER');
    setVal('selectUserStatus', user.Status || 'ACTIVE');

    setVal('inputUserFullName', user.Full_name || user.User_name || '');
    setVal('selectUserGender', user.Gender || 'Khác');
    setVal('inputUserBirthday', user.Birthday || '');
    setVal('inputUserCitizenId', user.Citizen_id || '');
    setVal('inputUserPhone', user.Phone || '');
    setVal('inputUserEmail', user.Email || '');
    setVal('inputUserAddress', user.Address || '');

    setVal('selectUserShift', user.Shift || 'Toàn thời gian');
    setVal('inputUserHireDate', user.Hire_date || '');
    setVal('inputUserEmergencyContact', user.Emergency_contact || '');
    setVal('inputUserPositionNote', user.Position_note || '');

    // Hiển thị dòng thông tin Ngày tạo & Ngày sửa gần nhất
    const auditRow = document.getElementById('userAuditTimestampsRow');
    if (auditRow) auditRow.classList.remove('d-none');

    const createdEl = document.getElementById('displayUserCreatedAt');
    const updatedEl = document.getElementById('displayUserUpdatedAt');
    const pwdChangedEl = document.getElementById('displayUserPwdChangedAt');
    if (createdEl) createdEl.innerText = user.Created_at || 'Chưa ghi nhận';
    if (updatedEl) updatedEl.innerText = user.Updated_at || user.Created_at || 'Chưa ghi nhận';
    if (pwdChangedEl) pwdChangedEl.innerText = user.Password_changed_at || 'Chưa đổi lần nào';

    const titleEl = document.getElementById('userFormTitle');
    const btnSave = document.getElementById('btnSaveUser');
    const btnCancel = document.getElementById('btnCancelEditUser');

    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-user-pen me-2 text-primary"></i>Cập Nhật Hồ Sơ: <span class="text-primary">${user.Full_name || user.User_name}</span> <small class="text-muted">(@${user.User_name})</small>`;
    }
    if (btnSave) {
        btnSave.innerHTML = '<i class="fa-solid fa-check me-1"></i> Lưu Cập Nhật Hồ Sơ';
        btnSave.className = 'btn btn-primary fw-bold px-4 shadow-sm';
    }
    if (btnCancel) btnCancel.style.display = 'inline-block';

    // Mở khung Form nếu đang thu gọn và cuộn mượt lên khu vực Form
    if (typeof window.toggleUserFormPanel === 'function') {
        window.toggleUserFormPanel(true);
    }
    document.getElementById('userFormTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 6. Reset Form về trạng thái Thêm mới
function resetUserForm() {
    const form = document.getElementById('userForm');
    if (form) form.reset();

    if (document.getElementById('editUserId')) document.getElementById('editUserId').value = '';
    if (document.getElementById('selectUserRole')) document.getElementById('selectUserRole').value = 'WAITER';
    if (document.getElementById('selectUserStatus')) document.getElementById('selectUserStatus').value = 'ACTIVE';
    if (document.getElementById('selectUserGender')) document.getElementById('selectUserGender').value = 'Nam';
    if (document.getElementById('selectUserShift')) document.getElementById('selectUserShift').value = 'Toàn thời gian';

    const pwdInput = document.getElementById('inputUserPassword');
    const pwdEye = document.getElementById('userFormPwdEye');
    if (pwdInput) pwdInput.type = 'password';
    if (pwdEye) {
        pwdEye.classList.remove('fa-eye-slash');
        pwdEye.classList.add('fa-eye');
    }

    const auditRow = document.getElementById('userAuditTimestampsRow');
    if (auditRow) auditRow.classList.add('d-none');

    const titleEl = document.getElementById('userFormTitle');
    const btnSave = document.getElementById('btnSaveUser');
    const btnCancel = document.getElementById('btnCancelEditUser');

    if (titleEl) {
        titleEl.innerHTML = '<i class="fa-solid fa-user-plus me-2"></i>Thêm Hồ Sơ & Tài Khoản Người Dùng Mới';
    }
    if (btnSave) {
        btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Lưu Hồ Sơ & Tạo Tài Khoản';
        btnSave.className = 'btn btn-success fw-bold px-4 shadow-sm';
    }
    if (btnCancel) btnCancel.style.display = 'none';
}

// 7. Mở khóa / Tạm khóa nhanh tài khoản
window.toggleUserAccountStatus = async function(userId, nextStatus, username) {
    const actionLabel = nextStatus === 'LOCKED' ? 'TẠM KHÓA' : 'MỞ KHÓA';
    const confirmed = (window.toast && typeof window.toast.confirm === 'function')
        ? await window.toast.confirm(`Bạn có chắc chắn muốn ${actionLabel} tài khoản "@${username}" không?`, `${actionLabel} tài khoản`)
        : confirm(`Bạn có chắc chắn muốn ${actionLabel} tài khoản "@${username}" không?`);
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/users/${userId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Status: nextStatus })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            if (window.toast) window.toast.success(data.message || 'Đã cập nhật trạng thái!');
            await loadUsers();
        } else {
            if (window.toast) window.toast.error(data.error || 'Không thể đổi trạng thái tài khoản!');
        }
    } catch (err) {
        if (window.toast) window.toast.error('Lỗi kết nối máy chủ!');
    }
};

// 8. Mở Modal đổi mật khẩu nhanh cho 1 dòng trong bảng
window.openQuickPasswordModal = function(userId, username, isAdminOverride) {
    const idInput = document.getElementById('quickPwdUserId');
    const titleSpan = document.getElementById('quickPwdTargetUsername');
    const curGroup = document.getElementById('quickPwdCurrentGroup');
    const curInput = document.getElementById('quickPwdCurrentInput');
    const newInput = document.getElementById('quickPwdNewInput');
    const cfmInput = document.getElementById('quickPwdConfirmInput');

    if (idInput) idInput.value = userId;
    if (titleSpan) titleSpan.innerText = '@' + username;
    if (curInput) curInput.value = '';
    if (newInput) newInput.value = '';
    if (cfmInput) cfmInput.value = '';

    window._quickPwdAdminOverride = Boolean(isAdminOverride);
    if (curGroup) {
        curGroup.style.display = isAdminOverride ? 'none' : 'block';
    }

    const modalEl = document.getElementById('adminQuickChangePwdModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    }
};

window.submitQuickPasswordModal = async function() {
    const userId = document.getElementById('quickPwdUserId')?.value;
    const currentPassword = document.getElementById('quickPwdCurrentInput')?.value || '';
    const newPassword = (document.getElementById('quickPwdNewInput')?.value || '').trim();
    const confirmPassword = (document.getElementById('quickPwdConfirmInput')?.value || '').trim();

    if (!newPassword) {
        if (window.toast) window.toast.warning('Vui lòng nhập mật khẩu mới!');
        return;
    }
    if (newPassword !== confirmPassword) {
        if (window.toast) window.toast.error('Mật khẩu xác nhận không khớp!');
        return;
    }

    try {
        const res = await fetch('/api/users/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                User_id: userId,
                currentPassword: currentPassword,
                newPassword: newPassword,
                adminOverride: Boolean(window._quickPwdAdminOverride)
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            if (window.toast) window.toast.success('Đã đổi mật khẩu thành công!');
            const modalEl = document.getElementById('adminQuickChangePwdModal');
            if (modalEl && typeof bootstrap !== 'undefined') {
                bootstrap.Modal.getInstance(modalEl)?.hide();
            }
            await loadUsers();
        } else {
            if (window.toast) window.toast.error(data.error || 'Đổi mật khẩu thất bại!');
        }
    } catch (err) {
        if (window.toast) window.toast.error('Lỗi kết nối máy chủ!');
    }
};

// 9. Xóa tài khoản
async function deleteUser(userId) {
    const target = globalUsersData.find(u => Number(u.User_id) === Number(userId));
    const displayLabel = target ? `${target.Full_name || target.User_name} (@${target.User_name})` : `#${userId}`;

    const confirmed = await toast.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn hồ sơ tài khoản "${displayLabel}" khỏi hệ thống không?`, 'Xác nhận xóa tài khoản');
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
        const data = await res.json();

        if (res.ok) {
            toast.success('Đã xóa hồ sơ tài khoản thành công!');
            await loadUsers();
        } else {
            toast.error(data.error || 'Không thể xóa tài khoản này!');
        }
    } catch (err) {
        console.error('Lỗi xóa người dùng:', err);
        toast.error('Có lỗi xảy ra khi gửi yêu cầu xóa!');
    }
}

// Helper tạo Badge hiển thị Vai trò đẹp mắt
function getRoleBadgeHtml(role) {
    switch (String(role).toUpperCase()) {
        case 'ADMIN':
            return '<span class="badge bg-success px-2 py-1"><i class="fa-solid fa-shield-halved me-1"></i>Quản Trị (ADMIN)</span>';
        case 'CASHIER':
            return '<span class="badge bg-primary px-2 py-1"><i class="fa-solid fa-cash-register me-1"></i>Thu Ngân (CASHIER)</span>';
        case 'KITCHEN':
            return '<span class="badge bg-warning text-dark px-2 py-1"><i class="fa-solid fa-fire-burner me-1"></i>Bếp (KITCHEN)</span>';
        case 'WAITER':
            return '<span class="badge bg-info text-dark px-2 py-1"><i class="fa-solid fa-bell-concierge me-1"></i>Phục Vụ (WAITER)</span>';
        case 'CUSTOMER':
            return '<span class="badge bg-secondary px-2 py-1"><i class="fa-solid fa-id-card me-1"></i>Khách Hàng</span>';
        default:
            return `<span class="badge bg-light text-dark border">${role || 'Chưa phân quyền'}</span>`;
    }
}

function getRoleLabel(role) {
    switch (String(role).toUpperCase()) {
        case 'ADMIN': return 'Quản Trị Viên (ADMIN)';
        case 'CASHIER': return 'Thu Ngân (CASHIER)';
        case 'KITCHEN': return 'Bếp (KITCHEN)';
        case 'WAITER': return 'Phục Vụ (WAITER)';
        case 'CUSTOMER': return 'Khách Hàng (CUSTOMER)';
        default: return role || 'Chưa phân quyền';
    }
}

// Gắn hàm vào Scope Toàn cục (Window)
window.loadUsers = loadUsers;
window.renderUsersList = renderUsersList;
window.handleUserSubmit = handleUserSubmit;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.resetUserForm = resetUserForm;

// Tự động kiểm tra nạp dữ liệu nếu đang ở trang /users
if (window.location.pathname === '/users') {
    loadUsers();
}