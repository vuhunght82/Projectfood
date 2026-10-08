// Hàm chuyển Tab bằng JavaScript thuần (Đảm bảo click nút là nhảy tab 100%)
function switchTab(tabId) {
    // 1. Khôi phục tất cả nút tab về trạng thái thường
    document.querySelectorAll('#systemSettingTabs .nav-link').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });

    // 2. Ẩn tất cả nội dung tab
    document.querySelectorAll('#systemSettingTabsContent .tab-pane').forEach(pane => {
        pane.classList.remove('show', 'active');
    });

    // 3. Bật nút và nội dung của tab vừa bấm
    const targetBtn = document.getElementById(tabId + '-btn');
    const targetPane = document.getElementById(tabId);

    if (targetBtn) {
        targetBtn.classList.add('active');
        targetBtn.setAttribute('aria-selected', 'true');
    }

    if (targetPane) {
        targetPane.classList.add('show', 'active');
    }

    // Nếu chuyển sang tab máy in, tự render lại trang giấy bill
    if (tabId === 'tab-printer') {
        renderLiveBillPreview();
    }
}

// Render trang giấy bill xem trước
function renderLiveBillPreview() {
    const resName = document.getElementById('sysResNameInput')?.value || 'NHÀ HÀNG CHAY HOA SEN';
    const resAddr = document.getElementById('sysResAddrInput')?.value || '';
    const resPhone = document.getElementById('sysResPhoneInput')?.value || '';
    const resWifi = document.getElementById('sysResWifiInput')?.value || '';
    const billFooter = document.getElementById('sysBillFooterInput')?.value || '';
    const paperSize = document.getElementById('sysPaperSizeSelect')?.value || '80mm';

    if (document.getElementById('pvName')) document.getElementById('pvName').innerText = resName;
    if (document.getElementById('pvAddr')) document.getElementById('pvAddr').innerText = resAddr;
    if (document.getElementById('pvPhone')) document.getElementById('pvPhone').innerText = resPhone ? `ĐT: ${resPhone}` : '';
    if (document.getElementById('pvWifi')) document.getElementById('pvWifi').innerText = resWifi;
    if (document.getElementById('pvFooter')) document.getElementById('pvFooter').innerHTML = billFooter.replace(/\n/g, '<br>');

    // Tùy chỉnh kích thước giấy bill
    const paperBox = document.getElementById('liveBillPaperPreview');
    if (paperBox) {
        if (paperSize === '58mm') {
            paperBox.style.width = '210px';
            paperBox.style.fontSize = '11px';
        } else {
            paperBox.style.width = '290px';
            paperBox.style.fontSize = '13px';
        }
    }
}

// In thử hóa đơn
function executeTestPrint() {
    const printContent = document.getElementById('liveBillPaperPreview')?.outerHTML;
    if (!printContent) return;

    const win = window.open('', '_blank', 'width=400,height=600');
    win.document.write(`
        <html>
            <head>
                <title>In Thử Hóa Đơn</title>
                <style>
                    body { margin: 0; padding: 10px; font-family: monospace; }
                    @page { margin: 0; }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                ${printContent}
            </body>
        </html>
    `);
    win.document.close();
}

// Lưu cấu hình
function saveSystemSettings() {
    const configData = {
        resName: document.getElementById('sysResNameInput')?.value,
        resAddr: document.getElementById('sysResAddrInput')?.value,
        resPhone: document.getElementById('sysResPhoneInput')?.value,
        resWifi: document.getElementById('sysResWifiInput')?.value,
        billFooter: document.getElementById('sysBillFooterInput')?.value,
        printer: document.getElementById('sysPrinterSelect')?.value,
        paperSize: document.getElementById('sysPaperSizeSelect')?.value
    };

    localStorage.setItem('hoasen_system_config', JSON.stringify(configData));
    if (window.toast) window.toast.success('Đã lưu toàn bộ cấu hình Máy in & Mẫu Bill thành công!');
    else alert('🎉 Đã lưu toàn bộ cấu hình Máy in & Mẫu Bill thành công!');
}

// Tự nạp dữ liệu khi trang vừa mở
document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('hoasen_system_config');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.resName) document.getElementById('sysResNameInput').value = data.resName;
            if (data.resAddr) document.getElementById('sysResAddrInput').value = data.resAddr;
            if (data.resPhone) document.getElementById('sysResPhoneInput').value = data.resPhone;
            if (data.resWifi) document.getElementById('sysResWifiInput').value = data.resWifi;
            if (data.billFooter) document.getElementById('sysBillFooterInput').value = data.billFooter;
            if (data.printer) document.getElementById('sysPrinterSelect').value = data.printer;
            if (data.paperSize) document.getElementById('sysPaperSizeSelect').value = data.paperSize;
        } catch (e) {}
    }
    renderLiveBillPreview();
});