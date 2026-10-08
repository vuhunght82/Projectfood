/**
 * Thư viện Toast Notification & Mobile App Confirm Dialog
 * Dùng chung cho Hệ thống Nhà Hàng Chay Hoa Sen
 */
(function () {
    function getToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 999999; display: flex; flex-direction: column; gap: 10px; max-width: 380px; width: calc(100% - 40px); pointer-events: none;';
            document.body.appendChild(container);
        }
        return container;
    }

    function showToast(message, type = 'info', title = '', duration = 3000) {
        const container = getToastContainer();

        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type}`;
        
        let borderColor = '#0288d1';
        let bgColor = '#e1f5fe'; // Mặc định info (Xanh dương nhạt)
        let iconClass = 'fa-circle-info';
        let textColor = '#01579b';

        if (type === 'success') { 
            borderColor = '#2e7d32'; 
            bgColor = '#e8f5e9'; // Xanh lá nhạt
            iconClass = 'fa-circle-check'; 
            textColor = '#1b5e20';
        } else if (type === 'error') { 
            borderColor = '#d32f2f'; 
            bgColor = '#ffebee'; // Đỏ nhạt
            iconClass = 'fa-circle-xmark'; 
            textColor = '#b71c1c';
        } else if (type === 'warning') { 
            borderColor = '#f57c00'; 
            bgColor = '#fff3e0'; // Cam nhạt
            iconClass = 'fa-triangle-exclamation'; 
            textColor = '#e65100';
        }

        if (!title) {
            if (type === 'success') title = 'Thành công';
            if (type === 'error') title = 'Lỗi hệ thống';
            if (type === 'warning') title = 'Cảnh báo';
            if (type === 'info') title = 'Thông báo';
        }

        // 🌟 Bổ sung màu nền nhạt (bgColor) tương ứng cho từng loại thông báo
        toast.style.cssText = `pointer-events: auto; display: flex; align-items: center; background: ${bgColor}; padding: 14px 18px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); border-left: 6px solid ${borderColor}; transition: all 0.3s ease;`;

        toast.innerHTML = `
            <div style="font-size: 24px; margin-right: 14px; color: ${borderColor}; display: flex; align-items: center;">
                <i class="fa-solid ${iconClass}"></i>
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 14px; color: ${textColor}; margin-bottom: 2px;">${title}</div>
                <div style="font-size: 13px; color: #444; line-height: 1.4;">${message}</div>
            </div>
            <button style="background: none; border: none; font-size: 18px; color: #777; cursor: pointer; padding-left: 10px;" onclick="this.parentElement.remove()">&times;</button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // Popup Confirm NỔI TRỰC TIẾP GIỮA MÀN HÌNH (Dùng Inline Style 100%)
    function showConfirm(message, title = 'Xác nhận thao tác') {
        return new Promise((resolve) => {
            document.querySelectorAll('.custom-confirm-overlay').forEach(el => el.remove());

            const overlay = document.createElement('div');
            overlay.className = 'custom-confirm-overlay';
            overlay.style.cssText = `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                background-color: rgba(0, 0, 0, 0.55) !important;
                backdrop-filter: blur(3px) !important;
                z-index: 9999999 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 20px !important;
                box-sizing: border-box !important;
            `;

            overlay.innerHTML = `
                <div style="
                    background: #ffffff !important;
                    width: 100% !important;
                    max-width: 400px !important;
                    border-radius: 16px !important;
                    padding: 24px !important;
                    box-shadow: 0 12px 32px rgba(0,0,0,0.3) !important;
                    box-sizing: border-box !important;
                    font-family: inherit !important;
                ">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: #ffebee; display: flex; align-items: center; justify-content: center;">
                            <i class="fa-solid fa-triangle-exclamation" style="color: #d32f2f; font-size: 20px;"></i>
                        </div>
                        <h4 style="margin: 0; font-size: 17px; font-weight: 700; color: #222;">${title}</h4>
                    </div>
                    <div style="margin-bottom: 22px; padding-left: 52px;">
                        <p style="margin: 0; font-size: 14px; color: #555; line-height: 1.5;">${message}</p>
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                        <button class="btn-cancel" style="
                            padding: 9px 18px; 
                            border-radius: 8px; 
                            border: 1px solid #ccc; 
                            background: #fff; 
                            color: #333; 
                            font-size: 13px; 
                            font-weight: 600; 
                            cursor: pointer;
                        ">Hủy</button>
                        <button class="btn-accept" style="
                            padding: 9px 18px; 
                            border-radius: 8px; 
                            border: none; 
                            background: #d32f2f; 
                            color: #fff; 
                            font-size: 13px; 
                            font-weight: 600; 
                            cursor: pointer;
                        ">Đồng ý</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const btnCancel = overlay.querySelector('.btn-cancel');
            const btnAccept = overlay.querySelector('.btn-accept');

            btnCancel.onclick = () => {
                overlay.remove();
                resolve(false);
            };

            btnAccept.onclick = () => {
                overlay.remove();
                resolve(true);
            };
        });
    }

    // Export ra Scope Toàn cục (window.toast)
    window.toast = {
        success: (msg, title, duration) => showToast(msg, 'success', title, duration),
        error: (msg, title, duration) => showToast(msg, 'error', title, duration),
        warning: (msg, title, duration) => showToast(msg, 'warning', title, duration),
        info: (msg, title, duration) => showToast(msg, 'info', title, duration),
        confirm: (msg, title) => showConfirm(msg, title)
    };

    window.showToast = showToast;

    // Ghi đè alert mặc định của trình duyệt để đồng bộ giao diện Toast đẹp mắt
    window.alert = function (message) {
        if (!message) return;
        const msgStr = String(message);
        // Tự động phân loại icon/màu sắc dựa trên nội dung câu thông báo
        if (msgStr.toLowerCase().includes('lỗi') || msgStr.toLowerCase().includes('thất bại') || msgStr.toLowerCase().includes('sai')) {
            showToast(msgStr, 'error');
        } else if (msgStr.toLowerCase().includes('thành công') || msgStr.toLowerCase().includes('chúc') || msgStr.includes('🎉')) {
            showToast(msgStr, 'success');
        } else if (msgStr.toLowerCase().includes('vui lòng') || msgStr.toLowerCase().includes('chú ý') || msgStr.toLowerCase().includes('cảnh báo')) {
            showToast(msgStr, 'warning');
        } else {
            showToast(msgStr, 'info');
        }
    };
})();