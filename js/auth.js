function checkAdminPermission() {
    const userJson = localStorage.getItem('currentUser');
    if (!userJson) return;

    try {
        const user = JSON.parse(userJson);
        const adminTab = document.getElementById('adminSystemTab');
        if (adminTab) {
            // Nếu là admin hoặc quản lý thì hiển thị Tab
            if (user.Role === 'admin' || user.User_name === 'vu') {
                adminTab.classList.remove('d-none');
            } else {
                adminTab.classList.add('d-none');
            }
        }
    } catch (e) {
        console.error('Lỗi đọc thông tin User:', e);
    }
}

// Gọi kiểm tra khi nạp ứng dụng
document.addEventListener('DOMContentLoaded', checkAdminPermission);