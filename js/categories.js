// Hàm hiển thị Toast thông báo an toàn
function notifyCategory(message, type = 'success') {
    if (window.toast && typeof window.toast[type] === 'function') {
        window.toast[type](message);
    } else if (typeof showToast === 'function') {
        showToast(message, type);
    } else if (window.Toast && typeof window.Toast[type] === 'function') {
        window.Toast[type](message);
    }
}

// 1. Tải danh sách danh mục từ API
async function loadCategories() {
    try {
        const res = await fetch('/api/categories');
        const categories = await res.json();

        window.allCategoriesCache = Array.isArray(categories) ? categories : [];
        renderCategoriesTable(window.allCategoriesCache);

    } catch (err) {
        console.error('Lỗi nạp danh mục:', err);
        notifyCategory('Không thể tải danh sách danh mục!', 'error');
    }
}

// 2. Render bảng danh mục ra HTML với Icon thao tác chuẩn
function renderCategoriesTable(categories) {
    const tbody = document.getElementById('categoriesTableBody');
    if (!tbody) return;

    if (categories.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4 text-muted">
                    <i class="fa-solid fa-folder-open fa-2x mb-2" style="color: #ccc;"></i>
                    <p class="m-0 small">Chưa có danh mục nào!</p>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = categories.map(cat => {
        const id = cat.Category_id ?? cat.id;
        const name = cat.Category_name ?? cat.name;
        const order = cat.Display_order ?? cat.display_order ?? 1;

        return `
            <tr>
                <td class="text-center fw-bold text-muted">${id}</td>
                <td class="fw-bold text-dark">${name}</td>
                <td class="text-center">
                    <span class="badge bg-light text-dark border font-monospace px-2 py-1">${order}</span>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary border-0 p-1 px-2 me-1" title="Sửa danh mục" onclick="editCategory(${id})">
                        <i class="fa-solid fa-pen-to-square"></i> Sửa
                    </button>
                    <button class="btn btn-sm btn-outline-danger border-0 p-1 px-2" title="Xóa danh mục" onclick="deleteCategory(${id})">
                        <i class="fa-solid fa-trash-can"></i> Xóa
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// 3. Xử lý Thêm / Cập nhật danh mục từ Form
document.addEventListener('DOMContentLoaded', () => {
    setupCategoryFormSubmit();
});

function setupCategoryFormSubmit() {
    const form = document.getElementById('categoryForm');
    if (!form) return;

    form.onsubmit = async function(e) {
        e.preventDefault();

        const catId = document.getElementById('categoryIdInput').value;
        const name = document.getElementById('categoryNameInput').value.trim();
        const order = document.getElementById('categoryOrderInput').value || 1;

        if (!name) {
            notifyCategory('Vui lòng nhập tên danh mục!', 'warning');
            return;
        }

        const isEdit = Boolean(catId);
        const url = isEdit ? `/api/categories/${catId}` : '/api/categories';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    Category_name: name,
                    Display_order: parseInt(order)
                })
            });

            const data = await res.json();

            if (data.error) {
                notifyCategory(data.error, 'error');
            } else {
                notifyCategory(isEdit ? 'Cập nhật danh mục thành công!' : 'Thêm danh mục mới thành công!', 'success');
                cancelCategoryEdit();
                loadCategories();
            }
        } catch (err) {
            console.error('Lỗi lưu danh mục:', err);
            notifyCategory('Lỗi kết nối máy chủ!', 'error');
        }
    };
}

// 4. Load dữ liệu lên form để Sửa
window.editCategory = function(id) {
    const cat = (window.allCategoriesCache || []).find(c => (c.Category_id ?? c.id) == id);
    if (!cat) return;

    document.getElementById('categoryIdInput').value = cat.Category_id ?? cat.id;
    document.getElementById('categoryNameInput').value = cat.Category_name ?? cat.name ?? '';
    document.getElementById('categoryOrderInput').value = cat.Display_order ?? cat.display_order ?? 1;

    // Đổi trạng thái nút bấm và tiêu đề Form
    document.getElementById('categoryFormTitle').innerHTML = '<i class="fa-solid fa-pen-to-square me-2"></i>Sửa Danh Mục';
    document.getElementById('btnSubmitCategory').innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Cập Nhật Danh Mục';
    document.getElementById('btnSubmitCategory').className = 'btn btn-primary w-100 fw-bold py-2 shadow-sm';
    document.getElementById('btnCancelCategoryEdit').classList.remove('d-none');

    notifyCategory(`Đang sửa danh mục: ${cat.Category_name ?? cat.name}`, 'info');
};

// 5. Hủy chế độ Sửa
window.cancelCategoryEdit = function() {
    const form = document.getElementById('categoryForm');
    if (form) form.reset();

    document.getElementById('categoryIdInput').value = '';
    document.getElementById('categoryFormTitle').innerHTML = '<i class="fa-solid fa-folder-plus me-2"></i>Thêm Danh Mục Mới';
    document.getElementById('btnSubmitCategory').innerHTML = '<i class="fa-solid fa-plus me-1"></i> Lưu Danh Mục';
    document.getElementById('btnSubmitCategory').className = 'btn btn-success w-100 fw-bold py-2 shadow-sm';
    document.getElementById('btnCancelCategoryEdit').classList.add('d-none');
};

// 6. Xóa danh mục
window.deleteCategory = async function(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa danh mục này? Việc xóa danh mục có thể ảnh hưởng đến các món ăn thuộc danh mục!')) return;

    try {
        const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.error) {
            notifyCategory(data.error, 'error');
        } else {
            notifyCategory('Đã xóa danh mục thành công!', 'success');
            loadCategories();
        }
    } catch (err) {
        console.error('Lỗi xóa danh mục:', err);
        notifyCategory('Lỗi xóa danh mục!', 'error');
    }
};

// Export hàm ra toàn cục
window.loadCategories = loadCategories;