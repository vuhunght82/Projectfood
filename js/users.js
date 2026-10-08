

// 1. Tải danh sách người dùng từ API

async function loadUsers() {
    console.log('-> Bắt đầu nạp danh sách tài khoản...');
    try {
        const res = await fetch('/api/users?t=' + Date.now());
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server phản hồi mã lỗi ${res.status}`);
        }
        
        globalUsersData = await res.json();
        console.log('-> Đã tải thành công:', globalUsersData);
        renderUsersList();
    } catch (err) {
        console.error('Lỗi tải danh sách người dùng:', err.message);
    }
}

function renderUsersList() {
    const tableBody = document.getElementById('usersListTable') || document.getElementById('usersList');
    if (!tableBody) return;

    if (!globalUsersData || globalUsersData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center" style="padding: 20px; color: #777;">Chưa có tài khoản nào trong hệ thống</td></tr>`;
        return;
    }

    let html = '';
    globalUsersData.forEach(user => {
        const roleLabel = getRoleLabel(user.User_role);

        html += `
            <tr>
                <td><strong>${user.User_name}</strong></td>
                <td>${user.User_password}</td>
                <td class="text-center">
                    <span class="badge badge-success">${roleLabel}</span>
                </td>
                <td class="text-center">
                    <button type="button" class="btn btn-outline btn-sm" onclick="editUser(${user.User_id})" style="margin-right: 5px;">
                        <i class="fa-solid fa-pen-to-square"></i> Sửa
                    </button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="deleteUser(${user.User_id})">
                        <i class="fa-solid fa-trash"></i> Xóa
                    </button>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
}

window.loadUsers = loadUsers;let globalUsersData = [];

async function loadUsers() {
    console.log('-> Bắt đầu nạp danh sách tài khoản...');
    try {
        const res = await fetch('/api/users?t=' + Date.now());
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server phản hồi mã lỗi ${res.status}`);
        }
        
        globalUsersData = await res.json();
        console.log('-> Đã tải thành công:', globalUsersData);
        renderUsersList();
    } catch (err) {
        console.error('Lỗi tải danh sách người dùng:', err.message);
    }
}

function renderUsersList() {
    const tableBody = document.getElementById('usersListTable') || document.getElementById('usersList');
    if (!tableBody) return;

    if (!globalUsersData || globalUsersData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center" style="padding: 20px; color: #777;">Chưa có tài khoản nào trong hệ thống</td></tr>`;
        return;
    }

    let html = '';
    globalUsersData.forEach(user => {
        const roleLabel = getRoleLabel(user.User_role);

        html += `
            <tr>
                <td><strong>${user.User_name}</strong></td>
                <td>${user.User_password}</td>
                <td class="text-center">
                    <span class="badge badge-success">${roleLabel}</span>
                </td>
                <td class="text-center">
                    <button type="button" class="btn btn-outline btn-sm" onclick="editUser(${user.User_id})" style="margin-right: 5px;">
                        <i class="fa-solid fa-pen-to-square"></i> Sửa
                    </button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="deleteUser(${user.User_id})">
                        <i class="fa-solid fa-trash"></i> Xóa
                    </button>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
}

window.loadUsers = loadUsers;

// 3. Xử lý gửi Form (Tạo mới / Cập nhật)
async function handleUserSubmit(event) {
    if (event) event.preventDefault();

    const userId = document.getElementById('editUserId')?.value;
    const userName = (document.getElementById('inputUserName')?.value || document.getElementById('userName')?.value || '').trim();
    const userPassword = (document.getElementById('inputUserPassword')?.value || document.getElementById('userPassword')?.value || '').trim();
    const userRole = document.getElementById('selectUserRole')?.value || document.getElementById('userRole')?.value || 'WAITER';

    if (!userName || !userPassword) {
        toast.error('Vui lòng điền Tên đăng nhập và Mật khẩu!');
        return;
    }

    const payload = { 
        User_name: userName, 
        User_password: userPassword, 
        User_role: userRole 
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
        if (res.ok) {
            toast.success(isEdit ? 'Cập nhật tài khoản thành công!' : 'Tạo tài khoản thành công!');
            resetUserForm();
            await loadUsers();
        } else {
            if (window.toast) window.toast.error('Lỗi từ Server: ' + (data.error || 'Thao tác thất bại'));
            else alert('Lỗi từ Server: ' + (data.error || 'Thao tác thất bại'));
        }
    } catch (err) {
        console.error('Lỗi gửi dữ liệu:', err);
        if (window.toast) window.toast.error('Không thể kết nối đến máy chủ!');
        else alert('Không thể kết nối đến máy chủ!');
    }
}

// 4. Đưa thông tin lên Form khi bấm Sửa
function editUser(userId) {
    const user = globalUsersData.find(u => (u.User_id || u.user_id || u.id) == userId);
    if (!user) return;

    if (document.getElementById('editUserId')) document.getElementById('editUserId').value = userId;
    
    const nameInput = document.getElementById('inputUserName') || document.getElementById('userName');
    const passInput = document.getElementById('inputUserPassword') || document.getElementById('userPassword');
    const roleSelect = document.getElementById('selectUserRole') || document.getElementById('userRole');

    if (nameInput) nameInput.value = user.User_name || user.username || '';
    if (passInput) passInput.value = user.User_password || '';
    if (roleSelect) roleSelect.value = user.User_role || user.Role || 'WAITER';

    const titleEl = document.getElementById('userFormTitle');
    const btnSave = document.getElementById('btnSaveUser');
    const btnCancel = document.getElementById('btnCancelEditUser');

    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Cập Nhật Tài Khoản';
    if (btnSave) btnSave.innerHTML = '<i class="fa-solid fa-check"></i> Lưu Cập Nhật';
    if (btnCancel) btnCancel.style.display = 'inline-block';
}

// 5. Reset Form
function resetUserForm() {
    const form = document.getElementById('userForm') || document.getElementById('addUserForm');
    if (form) form.reset();
    if (document.getElementById('editUserId')) document.getElementById('editUserId').value = '';

    const titleEl = document.getElementById('userFormTitle');
    const btnSave = document.getElementById('btnSaveUser');
    const btnCancel = document.getElementById('btnCancelEditUser');

    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-user-plus"></i> Thêm Tài Khoản Mới';
    if (btnSave) btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Tạo Tài Khoản';
    if (btnCancel) btnCancel.style.display = 'none';
}

// 6. Xóa tài khoản
async function deleteUser(userId) {
    // Goi Confirm Popup dep mat tu toast.js
    const confirmed = await toast.confirm('Bạn có chắc chắn muốn xóa tài khoản này khỏi hệ thống không?', 'Xác nhận xóa tài khoản');
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
        const data = await res.json();

        if (res.ok) {
            toast.success('Đã xóa tài khoản thành công!');
            await loadUsers();
        } else {
            toast.error(data.error || 'Không thể xóa tài khoản này!');
        }
    } catch (err) {
        console.error('Lỗi xóa người dùng:', err);
        toast.error('Có lỗi xảy ra khi gửi yêu cầu xóa!');
    }
}

window.deleteUser = deleteUser;

// Helper nhãn hiển thị
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
window.handleUserSubmit = handleUserSubmit;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.resetUserForm = resetUserForm;

// Tự động kiểm tra nạp dữ liệu nếu đang ở trang /users
if (window.location.pathname === '/users') {
    loadUsers();
}