let globalPaymentsData = [];

async function loadPayments() {
    try {
        const res = await fetch('/api/payments?t=' + Date.now());
        if (!res.ok) throw new Error('Không thể tải danh sách phương thức thanh toán');
        
        globalPaymentsData = await res.json();
        renderPaymentsList();
    } catch (err) {
        console.error('Lỗi loadPayments:', err);
        if (window.toast) toast.error(err.message);
    }
}

function renderPaymentsList() {
    const tableBody = document.getElementById('paymentsListTable');
    if (!tableBody) return;

    if (!globalPaymentsData || globalPaymentsData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; color: #777;">Chưa có phương thức thanh toán nào</td></tr>`;
        return;
    }

    let html = '';
    globalPaymentsData.forEach(item => {
        const isActive = Number(item.Is_active) === 1;
        
        html += `
            <tr>
                <td><strong>${item.Payment_code}</strong></td>
                <td>${item.Payment_name}</td>
                <td><small style="color:#666;">${item.Guide_info || 'Không có'}</small></td>
                <td class="text-center">
                    <span class="badge ${isActive ? 'badge-success' : 'badge-danger'}">
                        ${isActive ? 'Hoạt động' : 'Tạm ngưng'}
                    </span>
                </td>
                <td class="text-center">
                    <button type="button" class="btn btn-outline btn-sm" onclick="editPayment(${item.Payment_id})" style="margin-right: 5px;">
                        <i class="fa-solid fa-pen-to-square"></i> Sửa
                    </button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="deletePayment(${item.Payment_id})">
                        <i class="fa-solid fa-trash"></i> Xóa
                    </button>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
}

async function handlePaymentSubmit(event) {
    if (event) event.preventDefault();

    const id = document.getElementById('editPaymentId')?.value;
    const code = document.getElementById('inputPaymentCode')?.value.trim();
    const name = document.getElementById('inputPaymentName')?.value.trim();
    const status = document.getElementById('selectPaymentStatus')?.value;
    const guide = document.getElementById('inputPaymentGuide')?.value.trim();

    if (!code || !name) {
        toast.warning('Vui lòng nhập Mã và Tên phương thức!');
        return;
    }

    const payload = {
        Payment_code: code,
        Payment_name: name,
        Is_active: Number(status),
        Guide_info: guide
    };

    const isEdit = Boolean(id);
    const url = isEdit ? `/api/payments/${id}` : '/api/payments';
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok) {
            toast.success(isEdit ? 'Cập nhật phương thức thanh toán thành công!' : 'Thêm phương thức mới thành công!');
            resetPaymentForm();
            await loadPayments();
        } else {
            toast.error(data.error || 'Thao tác thất bại');
        }
    } catch (err) {
        console.error('Lỗi handlePaymentSubmit:', err);
        toast.error('Không thể kết nối máy chủ!');
    }
}

function editPayment(id) {
    const item = globalPaymentsData.find(p => p.Payment_id == id);
    if (!item) return;

    document.getElementById('editPaymentId').value = item.Payment_id;
    document.getElementById('inputPaymentCode').value = item.Payment_code;
    document.getElementById('inputPaymentName').value = item.Payment_name;
    document.getElementById('selectPaymentStatus').value = item.Is_active;
    document.getElementById('inputPaymentGuide').value = item.Guide_info || '';

    document.getElementById('paymentFormTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Cập Nhật Thanh Toán';
    document.getElementById('btnSavePayment').innerHTML = '<i class="fa-solid fa-check"></i> Lưu Cập Nhật';
    document.getElementById('btnCancelEditPayment').style.display = 'inline-block';
}

function resetPaymentForm() {
    const form = document.getElementById('paymentForm');
    if (form) form.reset();
    document.getElementById('editPaymentId').value = '';

    document.getElementById('paymentFormTitle').innerHTML = '<i class="fa-solid fa-wallet"></i> Thêm Phương Thức Thanh Toán';
    document.getElementById('btnSavePayment').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu Phương Thức';
    document.getElementById('btnCancelEditPayment').style.display = 'none';
}

async function deletePayment(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa phương thức này?')) return;

    try {
        const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
        if (res.ok) {
            toast.success('Đã xóa phương thức thanh toán!');
            await loadPayments();
        } else {
            toast.error('Không thể xóa phương thức thanh toán!');
        }
    } catch (err) {
        toast.error('Lỗi khi gửi yêu cầu xóa!');
    }
}

window.loadPayments = loadPayments;
window.handlePaymentSubmit = handlePaymentSubmit;
window.editPayment = editPayment;
window.resetPaymentForm = resetPaymentForm;
window.deletePayment = deletePayment;