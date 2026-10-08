// ========================================================
// JAVASCRIPT QUẢN LÝ HỘI VIÊN & THẺ THÀNH VIÊN CHAY HOA SEN
// ========================================================

window.currentMemberPage = 1;
window.currentMemberLimit = 20;
window.currentMemberTierFilter = 'ALL';
window.currentMemberSearchTerm = '';
window.cachedTiersConfig = null;
window.activeViewingMember = null;

// 1. Khởi tạo màn hình Quản Lý Hội Viên
window.initMembers = async function() {
    await window.loadMemberTierConfig();
    await window.loadTiersList();
    await window.loadPrepaidPackages();
    await window.loadMemberLunarInfo();
    await window.loadMemberStatsOverview();
    await window.loadMembersList();
    await window.loadMemberLogs();
    window.setupMemberSocketListeners();
};

// 2. Chuyển đổi tab con (Danh sách / Ví trả trước / Chính sách & Sinh nhật / Nhật ký)
window.switchMemberSubTab = function(tabId) {
    document.querySelectorAll('.member-sub-tab').forEach(el => el.classList.add('d-none'));
    const target = document.getElementById(tabId);
    if (target) target.classList.remove('d-none');

    // Update active style on pills
    const navLinks = document.querySelectorAll('#memberTabsNav .nav-link');
    navLinks.forEach(btn => {
        btn.classList.remove('active', 'text-white');
        btn.classList.add('text-secondary');
    });

    if (tabId === 'tab-members-list') {
        const btn = document.getElementById('tabBtnMembersList');
        btn?.classList.add('active');
        btn?.classList.remove('text-secondary');
    } else if (tabId === 'tab-prepaid-physical') {
        const btn = document.getElementById('tabBtnPrepaidPhysical');
        btn?.classList.add('active');
        btn?.classList.remove('text-secondary');
        window.loadPrepaidPackages();
    } else if (tabId === 'tab-policy-birthdays') {
        const btn = document.getElementById('tabBtnPolicyBirthdays');
        btn?.classList.add('active');
        btn?.classList.remove('text-secondary');
        window.loadTiersList();
    } else if (tabId === 'tab-member-logs') {
        const btn = document.getElementById('tabBtnMemberLogs');
        btn?.classList.add('active');
        btn?.classList.remove('text-secondary');
        window.loadMemberLogs();
    }
};

// 3. Tải cấu hình các hạng thẻ Hoa Sen
window.loadMemberTierConfig = async function() {
    try {
        const res = await fetch('/api/members/tier-config');
        if (res.ok) {
            const data = await res.json();
            window.cachedTiersConfig = data.tiers;
        }
    } catch (e) {
        console.warn('Lỗi nạp tier-config:', e);
    }
};

// Helper tạo badge hạng thẻ linh hoạt
window.getTierBadgeHtml = function(tierCode, tierInfo) {
    const t = (tierInfo && tierInfo.name) ? tierInfo : (window.cachedTiersConfig ? window.cachedTiersConfig[tierCode] : null);
    if (!t) {
        return `<span class="badge bg-secondary fw-bold px-2 py-1">${tierCode || 'HỘI VIÊN'}</span>`;
    }
    const icon = t.icon || '🪷';
    const name = t.name || t.Tier_name || tierCode;
    const discount = t.discountPercent || t.Discount_percent || 0;
    const discLabel = discount > 0 ? ` (-${discount}%)` : '';
    const color = t.color || '#2e7d32';
    return `<span class="badge fw-bold px-2 py-1 text-white shadow-sm" style="background-color: ${color};">${icon} ${name}${discLabel}</span>`;
};

// 4. Tải thông tin Âm lịch & cờ x2 Điểm hôm nay
window.loadMemberLunarInfo = async function() {
    try {
        const res = await fetch('/api/members/lunar/today?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();

        const txtEl = document.getElementById('memberLunarText');
        const badgeEl = document.getElementById('memberLunarX2Badge');
        const switchEl = document.getElementById('switchFestivalOverride');

        if (txtEl) txtEl.innerText = data.lunarText || 'Ngày Chay Âm Lịch';
        if (badgeEl) badgeEl.style.display = data.isDoublePoints ? 'inline-block' : 'none';
        if (switchEl) switchEl.checked = Boolean(data.festivalOverride);
    } catch (e) {
        console.warn('Lỗi nạp lunar info:', e);
    }
};

// 5. Tải thống kê tổng quan
window.loadMemberStatsOverview = async function() {
    try {
        const res = await fetch('/api/members/stats/overview?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();

        const totalEl = document.getElementById('statTotalMembers');
        const spentEl = document.getElementById('statTotalSpentAll');
        const ptsEl = document.getElementById('statTotalPointsAll');
        const ptsVndEl = document.getElementById('statTotalPointsVnd');
        const prepEl = document.getElementById('statTotalPrepaidAll');

        if (totalEl) totalEl.innerText = Number(data.totalMembers || 0).toLocaleString('vi-VN');
        if (spentEl) spentEl.innerText = Number(data.totalSpentAll || 0).toLocaleString('vi-VN') + ' đ';
        if (ptsEl) ptsEl.innerText = Number(data.totalPointsAll || 0).toLocaleString('vi-VN') + ' điểm';
        if (ptsVndEl) ptsVndEl.innerText = (Number(data.totalPointsAll || 0) * 1000).toLocaleString('vi-VN') + ' đ';
        if (prepEl) prepEl.innerText = Number(data.totalPrepaidAll || 0).toLocaleString('vi-VN') + ' đ';

        // Đếm theo từng hạng
        const tc = data.tierCounts || {};
        if (document.getElementById('countTierAll')) document.getElementById('countTierAll').innerText = data.totalMembers || 0;
        if (document.getElementById('countTierMam')) document.getElementById('countTierMam').innerText = tc.MAM_SEN || 0;
        if (document.getElementById('countTierBup')) document.getElementById('countTierBup').innerText = tc.BUP_SEN || 0;
        if (document.getElementById('countTierHong')) document.getElementById('countTierHong').innerText = tc.SEN_HONG || 0;
        if (document.getElementById('countTierKC')) document.getElementById('countTierKC').innerText = tc.SEN_KIM_CUONG || 0;

        // Render danh sách sinh nhật tuần này
        window.renderUpcomingBirthdays(data.upcomingBirthdays || []);
    } catch (e) {
        console.warn('Lỗi nạp stats overview:', e);
    }
};

// 6. Tải danh sách hội viên (phân trang & bộ lọc)
window.loadMembersList = async function() {
    const tbody = document.getElementById('membersTableTbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="9" class="text-center py-5 text-muted">
                <i class="fa-solid fa-circle-notch fa-spin fa-2x text-success mb-2"></i>
                <div>Đang nạp danh sách hội viên...</div>
            </td>
        </tr>
    `;

    try {
        let url = `/api/members?page=${window.currentMemberPage}&limit=${window.currentMemberLimit}`;
        if (window.currentMemberTierFilter && window.currentMemberTierFilter !== 'ALL') {
            url += `&tier=${window.currentMemberTierFilter}`;
        }
        if (window.currentMemberSearchTerm) {
            url += `&search=${encodeURIComponent(window.currentMemberSearchTerm)}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error('Không thể tải danh sách');
        const data = await res.json();

        const members = data.members || [];
        const total = data.total || 0;

        const infoEl = document.getElementById('memberPaginationInfo');
        if (infoEl) infoEl.innerText = `Hiển thị ${members.length} / ${total} hội viên`;

        if (members.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-5 text-muted">
                        <i class="fa-solid fa-address-book fa-2x mb-2 text-secondary"></i>
                        <p class="m-0">Chưa tìm thấy hội viên nào phù hợp.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = members.map(m => {
            const tierBadge = window.getTierBadgeHtml(m.Current_tier, m.tierInfo);

            const birthdayBadge = (m.birthdayInfo && m.birthdayInfo.isBirthdaySoon)
                ? `<span class="badge bg-danger-subtle text-danger border border-danger ms-1" title="Sinh nhật sắp tới!"><i class="fa-solid fa-cake-candles me-1"></i>Sinh nhật</span>`
                : '';

            const birthText = m.Birthdate ? m.Birthdate.split('-').reverse().join('/') : '<span class="text-muted">Chưa có</span>';

            return `
                <tr>
                    <td>
                        <span class="badge bg-light text-dark font-monospace border fw-bold">${m.Card_code || 'HS-000'}</span>
                    </td>
                    <td>
                        <div class="fw-bold text-dark d-flex align-items-center">
                            ${m.Full_name}
                            ${birthdayBadge}
                        </div>
                        <small class="text-muted d-block text-truncate" style="max-width: 180px;">${m.Notes || 'Hội viên thân thiết'}</small>
                    </td>
                    <td>
                        <span class="font-monospace fw-bold text-secondary">${m.Phone}</span>
                        ${m.Email ? `<div class="small text-muted text-truncate" style="max-width: 150px; font-size: 11px;" title="${m.Email}"><i class="fa-regular fa-envelope me-1 text-primary"></i>${m.Email}</div>` : ''}
                    </td>
                    <td>
                        <div class="d-flex align-items-center gap-1 font-monospace">
                            <span id="mem-pwd-${m.Member_id}" class="text-secondary fw-bold" style="font-size: 13px;">••••••</span>
                            <button class="btn btn-sm btn-link text-muted p-0 ms-1" type="button" onclick="window.toggleMemberPwd(${m.Member_id}, '${(m.Password || '123456').replace(/'/g, "\\'")}')" title="Xem/Ẩn mật khẩu">
                                <i class="fa-solid fa-eye" id="mem-pwd-icon-${m.Member_id}"></i>
                            </button>
                        </div>
                    </td>
                    <td>${tierBadge}</td>
                    <td class="text-end fw-bold text-dark">
                        ${Number(m.Total_spent || 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td class="text-center">
                        <span class="badge bg-warning text-dark fw-bold px-2 py-1">
                            ${Number(m.Reward_points || 0).toLocaleString('vi-VN')} đ
                        </span>
                    </td>
                    <td class="text-end fw-bold text-success">
                        ${Number(m.Prepaid_balance || 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td class="small">${birthText}</td>
                    <td class="text-center">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-success" onclick="window.openDigitalCardModal(${m.Member_id})" title="Xem thẻ điện tử & QR">
                                <i class="fa-solid fa-id-card"></i>
                            </button>
                            <button class="btn btn-outline-primary" onclick="window.openTopupPrepaidModal(${m.Member_id})" title="Nạp ví trả trước">
                                <i class="fa-solid fa-wallet"></i>
                            </button>
                            <button class="btn btn-outline-warning text-dark" onclick="window.openChangeTierModal(${m.Member_id}, '${m.Full_name.replace(/'/g, "\\'")}', '${m.Current_tier}')" title="⭐ Thăng / Đổi Hạng Trực Tiếp">
                                <i class="fa-solid fa-star"></i>
                            </button>
                            <button class="btn btn-outline-info text-dark" onclick="window.openAdjustSpentModal(${m.Member_id}, '${m.Full_name.replace(/'/g, "\\'")}', ${m.Total_spent || 0})" title="💰 Điều Chỉnh Chi Tiêu (+/-)">
                                <i class="fa-solid fa-money-bill-transfer"></i>
                            </button>
                            <button class="btn btn-outline-secondary" onclick="window.openAdjustPointsModal(${m.Member_id}, '${m.Full_name.replace(/'/g, "\\'")}')" title="🎯 Điều chỉnh điểm">
                                <i class="fa-solid fa-sliders"></i>
                            </button>
                            <button class="btn btn-outline-dark" onclick="window.openEditMemberModal(${m.Member_id})" title="Sửa thông tin">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="window.deleteMember(${m.Member_id}, '${m.Full_name.replace(/'/g, "\\'")}')" title="Xóa hội viên">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('Lỗi tải danh sách hội viên:', e);
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4">Lỗi: ${e.message}</td></tr>`;
    }
};

// 7. Lọc theo hạng thẻ
window.filterMembersByTier = function(tier) {
    window.currentMemberTierFilter = tier;
    window.currentMemberPage = 1;

    document.querySelectorAll('.member-tier-filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tier') === tier) {
            btn.classList.add('active');
        }
    });

    window.loadMembersList();
};

// 8. Tìm kiếm hội viên
window.handleMemberSearch = function(e) {
    if (e.key === 'Enter' || e.target.value.length === 0) {
        window.currentMemberSearchTerm = e.target.value.trim();
        window.currentMemberPage = 1;
        window.loadMembersList();
    }
};

// 9. Render danh sách sinh nhật tuần này
window.renderUpcomingBirthdays = function(list) {
    const container = document.getElementById('upcomingBirthdaysContainer');
    const badge = document.getElementById('countUpcomingBirthdays');
    if (badge) badge.innerText = list.length;
    if (!container) return;

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="fa-solid fa-champagne-glasses fa-2x text-secondary mb-2"></i>
                <div class="small">Tuần này không có sinh nhật hội viên nào.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(m => {
        const b = m.birthdayInfo || {};
        const bdayLabel = b.isBirthdayToday ? '<b class="text-danger">HÔM NAY!</b>' : `Còn ${b.daysUntil} ngày`;
        return `
            <div class="p-2 px-3 bg-white rounded-3 border d-flex justify-content-between align-items-center shadow-sm">
                <div>
                    <div class="fw-bold text-dark">${m.Full_name}</div>
                    <small class="text-muted"><i class="fa-solid fa-phone me-1"></i>${m.Phone} | Sinh: ${m.Birthdate}</small>
                </div>
                <div class="text-end">
                    <span class="badge bg-danger text-white mb-1 d-block">${bdayLabel}</span>
                    <button class="btn btn-sm btn-outline-danger py-0 px-2 fw-semibold" style="font-size: 11px;" onclick="window.sendBirthdayGift(${m.Member_id}, '${m.Full_name}')">
                        <i class="fa-solid fa-gift me-1"></i> Tặng Quà
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

// ==========================================
// QUẢN LÝ MODAL HỘI VIÊN AN TOÀN (CHỐNG TREO BACKDROP & CHẠY TỐT KỂ CẢ KHI OFFLINE)
// ==========================================
window.openMemberModalElement = function(modalId) {
    const modalEl = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
    if (!modalEl) return;
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        try {
            const inst = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            inst.show();
            return;
        } catch (e) {}
    }
    modalEl.classList.add('show');
    modalEl.style.display = 'block';
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.removeAttribute('aria-hidden');
    document.body.classList.add('modal-open');

    let backdrop = document.getElementById('globalModalBackdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'globalModalBackdrop';
        backdrop.className = 'modal-backdrop fade show';
        document.body.appendChild(backdrop);
    }
};

window.closeMemberModalElement = function(modalId) {
    const modalEl = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
    if (modalEl) {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            try {
                const inst = bootstrap.Modal.getInstance(modalEl);
                if (inst) inst.hide();
            } catch (e) {}
        }
        modalEl.classList.remove('show');
        modalEl.style.display = 'none';
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.removeAttribute('aria-modal');
    }
    const anyOpen = document.querySelectorAll('.modal.show');
    if (anyOpen.length === 0) {
        document.body.classList.remove('modal-open');
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        const bd = document.getElementById('globalModalBackdrop');
        if (bd) bd.remove();
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
    }
};
window.closeMemberModal = window.closeMemberModalElement;

// Helper toggle ẩn/hiện mật khẩu trong danh sách hội viên cho Quản Lý
window.toggleMemberPwd = function(memberId, actualPwd) {
    const textEl = document.getElementById(`mem-pwd-${memberId}`);
    const iconEl = document.getElementById(`mem-pwd-icon-${memberId}`);
    if (!textEl || !iconEl) return;
    if (textEl.innerText === '••••••') {
        textEl.innerText = actualPwd || '123456';
        textEl.classList.remove('text-secondary');
        textEl.classList.add('text-primary');
        iconEl.classList.remove('fa-eye');
        iconEl.classList.add('fa-eye-slash');
    } else {
        textEl.innerText = '••••••';
        textEl.classList.remove('text-primary');
        textEl.classList.add('text-secondary');
        iconEl.classList.remove('fa-eye-slash');
        iconEl.classList.add('fa-eye');
    }
};

// Helper tạo mật khẩu ngẫu nhiên cho hội viên mới
window.generateRandomMemberPassword = function() {
    let pwd = '';
    for (let i = 0; i < 6; i++) {
        pwd += Math.floor(Math.random() * 10);
    }
    const pwdEl = document.getElementById('formMemberPassword');
    if (pwdEl) pwdEl.value = pwd;
};

// 10. Mở Modal Đăng Ký Hội Viên Mới
window.openNewMemberModal = function() {
    const idEl = document.getElementById('formMemberId');
    const phoneEl = document.getElementById('formMemberPhone');
    const nameEl = document.getElementById('formMemberName');
    const emailEl = document.getElementById('formMemberEmail');
    const bdateEl = document.getElementById('formMemberBirthdate');
    const genderEl = document.getElementById('formMemberGender');
    const notesEl = document.getElementById('formMemberNotes');
    const pwdEl = document.getElementById('formMemberPassword');
    const titleEl = document.getElementById('memberFormModalTitle');

    if (idEl) idEl.value = '';
    if (phoneEl) phoneEl.value = '';
    if (nameEl) nameEl.value = '';
    if (emailEl) emailEl.value = '';
    if (bdateEl) bdateEl.value = '';
    if (genderEl) genderEl.value = 'FEMALE';
    if (notesEl) notesEl.value = '';
    if (pwdEl) pwdEl.value = '123456';
    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-user-plus me-2"></i>Đăng Ký Hội Viên Mầm Sen';

    window.openMemberModalElement('memberFormModal');
};

// 11. Mở Modal Sửa Thông Tin Hội Viên
window.openEditMemberModal = async function(id) {
    try {
        const res = await fetch(`/api/members/${id}`);
        if (!res.ok) throw new Error('Không thể tải thông tin');
        const data = await res.json();
        const m = data.member;

        const idEl = document.getElementById('formMemberId');
        const phoneEl = document.getElementById('formMemberPhone');
        const nameEl = document.getElementById('formMemberName');
        const emailEl = document.getElementById('formMemberEmail');
        const bdateEl = document.getElementById('formMemberBirthdate');
        const genderEl = document.getElementById('formMemberGender');
        const notesEl = document.getElementById('formMemberNotes');
        const pwdEl = document.getElementById('formMemberPassword');
        const titleEl = document.getElementById('memberFormModalTitle');

        if (idEl) idEl.value = m.Member_id;
        if (phoneEl) phoneEl.value = m.Phone;
        if (nameEl) nameEl.value = m.Full_name;
        if (emailEl) emailEl.value = m.Email || '';
        if (bdateEl) bdateEl.value = m.Birthdate || '';
        if (genderEl) genderEl.value = m.Gender || 'FEMALE';
        if (notesEl) notesEl.value = m.Notes || '';
        if (pwdEl) pwdEl.value = m.Password || '123456';
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-user-pen me-2"></i>Chỉnh Sửa Hội Viên: ${m.Full_name}`;

        window.openMemberModalElement('memberFormModal');
    } catch (e) {
        if (window.toast) window.toast.error(e.message);
    }
};

// 12. Submit form Thêm / Sửa Hội Viên
window.submitMemberForm = async function(event) {
    event.preventDefault();

    const id = document.getElementById('formMemberId').value;
    const phone = document.getElementById('formMemberPhone').value.trim();
    const name = document.getElementById('formMemberName').value.trim();
    const email = document.getElementById('formMemberEmail') ? document.getElementById('formMemberEmail').value.trim() : '';
    const birthdate = document.getElementById('formMemberBirthdate').value;
    const gender = document.getElementById('formMemberGender').value;
    const notes = document.getElementById('formMemberNotes').value.trim();
    const password = document.getElementById('formMemberPassword') ? document.getElementById('formMemberPassword').value.trim() : '123456';

    if (!phone || !name) {
        if (window.toast) window.toast.warning('Vui lòng nhập Số điện thoại và Họ tên!');
        return;
    }

    const payload = {
        Phone: phone,
        Full_name: name,
        Email: email,
        Birthdate: birthdate,
        Gender: gender,
        Notes: notes,
        Password: password || '123456'
    };

    try {
        const url = id ? `/api/members/${id}` : '/api/members';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Thất bại');

        if (window.toast) window.toast.success(data.message || 'Lưu thành công!');

        // Đóng modal an toàn
        window.closeMemberModalElement('memberFormModal');

        await window.loadMemberStatsOverview();
        await window.loadMembersList();
    } catch (err) {
        if (window.toast) window.toast.error(err.message);
    }
};

// 13. Mở Modal Thẻ Điện Tử Digital Membership Card & Mã QR
window.openDigitalCardModal = async function(id) {
    try {
        const res = await fetch(`/api/members/${id}`);
        if (!res.ok) throw new Error('Không thể tải thông tin');
        const data = await res.json();
        const m = data.member;
        const txs = data.transactions || [];
        window.activeViewingMember = m;

        // Render card
        const cardView = document.getElementById('digitalCardView');
        const iconEl = document.getElementById('cardIcon');
        const tierBadge = document.getElementById('cardTierBadge');
        const nameEl = document.getElementById('cardMemberName');
        const phoneEl = document.getElementById('cardMemberPhone');
        const pointsEl = document.getElementById('cardPoints');
        const prepaidEl = document.getElementById('cardPrepaid');
        const codeEl = document.getElementById('cardCodeText');

        if (nameEl) nameEl.innerText = m.Full_name;
        if (phoneEl) phoneEl.innerText = m.Phone;
        if (pointsEl) pointsEl.innerText = Number(m.Reward_points || 0).toLocaleString('vi-VN');
        if (prepaidEl) prepaidEl.innerText = Number(m.Prepaid_balance || 0).toLocaleString('vi-VN') + ' đ';
        if (codeEl) codeEl.innerText = m.Card_code || 'HS-000000';

        const t = m.tierInfo || {};
        if (iconEl) iconEl.innerText = t.icon || '🪷';
        if (tierBadge) {
            tierBadge.innerText = (t.name || 'MẦM SEN').toUpperCase();
            tierBadge.style.background = 'rgba(255,255,255,0.25)';
        }

        if (cardView) {
            cardView.style.background = t.cardBg || 'linear-gradient(135deg, #1b5e20, #4caf50)';
        }

        // Tạo mã QR bằng API QuickChart QR
        const qrImg = document.getElementById('cardQrImg');
        if (qrImg) {
            const qrData = encodeURIComponent(`HOASEN-MEM:${m.Phone}:${m.Card_code}`);
            qrImg.src = `https://quickchart.io/qr?text=${qrData}&size=180&margin=1`;
        }

        // Render lịch sử giao dịch
        const txList = document.getElementById('cardTransactionsList');
        if (txList) {
            if (txs.length === 0) {
                txList.innerHTML = `<small class="text-muted">Chưa có giao dịch tích/tiêu điểm nào.</small>`;
            } else {
                txList.innerHTML = txs.map(tx => {
                    const isPlus = (tx.Type === 'EARN' || tx.Type === 'BONUS' || tx.Type === 'PREPAID_TOPUP' || tx.Points_added > 0);
                    const color = isPlus ? 'text-success' : 'text-danger';
                    const sign = isPlus ? '+' : '-';
                    const amountText = tx.Points_added > 0 ? `${sign}${tx.Points_added} điểm` : (tx.Points_used > 0 ? `-${tx.Points_used} điểm` : `${tx.Description}`);
                    return `
                        <div class="py-1 border-bottom d-flex justify-content-between align-items-center small">
                            <div>
                                <div class="fw-semibold text-dark">${tx.Description || 'Giao dịch điểm'}</div>
                                <small class="text-muted">${tx.Created_at}</small>
                            </div>
                            <span class="fw-bold ${color}">${amountText}</span>
                        </div>
                    `;
                }).join('');
            }
        }

        window.openMemberModalElement('digitalCardModal');
    } catch (e) {
        if (window.toast) window.toast.error(e.message);
    }
};

window.allPrepaidPackagesCache = [];

// Tải danh sách Gói Nạp Ví Trả Trước từ máy chủ và hiển thị ra UI
window.loadPrepaidPackages = async function() {
    const container = document.getElementById('prepaidPackagesContainer');
    try {
        const res = await fetch('/api/members/prepaid-packages?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        const pkgs = data.packages || [];
        window.allPrepaidPackagesCache = pkgs;

        if (container) {
            if (pkgs.length === 0) {
                container.innerHTML = `
                    <div class="col-12 text-center py-4 text-muted">
                        <i class="fa-solid fa-wallet fa-2x mb-2 text-secondary opacity-50"></i>
                        <p class="small">Chưa có gói nạp ví trả trước nào. Nhấn "+ Thêm Gói Mới" để tạo ngay!</p>
                    </div>
                `;
            } else {
                container.innerHTML = pkgs.map(p => {
                    const topupFmt = Number(p.topupAmount || 0).toLocaleString('vi-VN');
                    const bonusFmt = Number(p.bonusAmount || 0).toLocaleString('vi-VN');
                    const totalFmt = Number(p.totalReceived || 0).toLocaleString('vi-VN');
                    const color = p.borderColor || '#2e7d32';
                    const bgColor = p.bgColor || '#f1f8e9';
                    const badge = p.badge || (p.bonusAmount > 0 ? `+ TẶNG ${bonusFmt} đ` : 'GÓI TIẾT KIỆM');

                    return `
                        <div class="col-md-4 col-12" id="prepaid-pkg-card-${p.id}">
                            <div class="card h-100 shadow-sm rounded-4 text-center p-3 position-relative" style="border: 2px solid ${color}; background: ${bgColor}; transition: transform 0.2s;">
                                <!-- Nút Sửa & Xóa ở góc trên thẻ -->
                                <div class="position-absolute top-0 end-0 p-2 d-flex gap-1" style="z-index: 2;">
                                    <button type="button" class="btn btn-sm btn-light border rounded-circle shadow-xs" style="width: 28px; height: 28px; padding: 0;" onclick="window.openManagePrepaidPackageModal(${p.id})" title="Chỉnh sửa gói này">
                                        <i class="fa-solid fa-pen text-primary" style="font-size: 11px;"></i>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-light border rounded-circle shadow-xs" style="width: 28px; height: 28px; padding: 0;" onclick="window.deletePrepaidPackage(${p.id}, '${p.name}')" title="Xóa gói này">
                                        <i class="fa-solid fa-trash text-danger" style="font-size: 11px;"></i>
                                    </button>
                                </div>

                                <div class="fw-bold fs-5 mt-1" style="color: ${color};">${p.name}</div>
                                <div class="text-muted small">Nạp ${topupFmt} đ</div>
                                <hr class="my-2 opacity-25" style="color: ${color};">
                                <div>
                                    <span class="badge text-white py-1 px-2 my-1 shadow-xs" style="background-color: ${color};">${badge}</span>
                                </div>
                                <div class="fs-5 fw-bold text-dark mt-2">${totalFmt} đ</div>
                                <small class="text-muted d-block mb-3">Số dư vào ví</small>
                                <button class="btn btn-sm fw-bold rounded-pill w-100 shadow-sm text-white" style="background-color: ${color};" onclick="window.quickTopupPackage(${p.id})">
                                    <i class="fa-solid fa-plus me-1"></i> Nạp Cho Khách
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Render sang radio trong modal nạp tiền
        window.renderTopupPrepaidRadios();

    } catch (e) {
        console.error('Lỗi loadPrepaidPackages:', e);
    }
};

// Render danh sách radio chọn gói trong Modal Nạp Tiền
window.renderTopupPrepaidRadios = function(defaultPkgId) {
    const radioContainer = document.getElementById('topupPackageRadioGroup');
    if (!radioContainer) return;

    const pkgs = window.allPrepaidPackagesCache || [];
    if (pkgs.length === 0) {
        radioContainer.innerHTML = '<div class="text-muted small p-2">Chưa có gói nạp nào. Vui lòng thêm gói trước!</div>';
        return;
    }

    const firstId = defaultPkgId || pkgs[0].id;
    radioContainer.innerHTML = pkgs.map((p, idx) => {
        const isChecked = p.id == firstId ? 'checked' : '';
        const shortTopup = Math.round(p.topupAmount / 1000);
        const shortBonus = p.bonusAmount > 0 ? `(+${Math.round(p.bonusAmount / 1000)}k)` : '';
        const colSize = pkgs.length <= 3 ? Math.floor(12 / pkgs.length) : 4;

        return `
            <div class="col-${colSize} col-12">
                <input type="radio" class="btn-check" name="topupPackageRadio" id="pkgRadio${p.id}" value="${p.id}" ${isChecked} onchange="window.handleTopupPackageSelect(${p.id})">
                <label class="btn btn-outline-success w-100 py-2 small fw-bold" for="pkgRadio${p.id}">
                    ${p.name}<br><span class="text-dark">${shortTopup}k ${shortBonus}</span>
                </label>
            </div>
        `;
    }).join('');
};

// 14. Mở Modal Nạp Tiền Vào Ví Trả Trước (Prepaid)
window.openTopupPrepaidModal = async function(id, defaultPkgId = null) {
    try {
        const res = await fetch(`/api/members/${id}`);
        if (!res.ok) throw new Error('Không thể tải thông tin');
        const data = await res.json();
        const m = data.member;

        document.getElementById('topupMemberId').value = m.Member_id;
        document.getElementById('topupMemberName').innerText = m.Full_name;
        document.getElementById('topupMemberPhone').innerText = m.Phone;
        document.getElementById('topupCurrentBalance').innerText = Number(m.Prepaid_balance || 0).toLocaleString('vi-VN') + ' đ';

        const chosenPkgId = defaultPkgId || (window.allPrepaidPackagesCache[0] ? window.allPrepaidPackagesCache[0].id : 1);
        window.renderTopupPrepaidRadios(chosenPkgId);
        window.handleTopupPackageSelect(chosenPkgId);
        window.openMemberModalElement('topupPrepaidModal');
    } catch (e) {
        if (window.toast) window.toast.error(e.message);
    }
};

// Nhanh từ tab 2 (chọn gói -> mở modal chọn khách)
window.quickTopupPackage = function(pkgId) {
    if (window.activeViewingMember) {
        window.openTopupPrepaidModal(window.activeViewingMember.Member_id, pkgId);
    } else {
        if (window.toast) window.toast.info('Vui lòng chọn 1 hội viên từ Danh sách để nạp gói!');
        window.switchMemberSubTab('tab-members-list');
    }
};

// Xử lý khi chọn radio gói nạp
window.handleTopupPackageSelect = function(pkgId) {
    const pkgs = window.allPrepaidPackagesCache || [];
    const p = pkgs.find(x => x.id == pkgId) || pkgs[0];

    const radio = document.getElementById(`pkgRadio${pkgId}`);
    if (radio) radio.checked = true;

    if (p) {
        const total = Number(p.totalReceived || (p.topupAmount + (p.bonusAmount || 0)));
        document.getElementById('topupTotalReceived').innerText = total.toLocaleString('vi-VN') + ' đ';
        document.getElementById('topupPayAmount').innerText = Number(p.topupAmount || 0).toLocaleString('vi-VN') + ' đ';
        document.getElementById('topupBonusAmount').innerText = Number(p.bonusAmount || 0).toLocaleString('vi-VN') + ' đ';
    }
};

// Mở Modal Quản Lý Gói Nạp (Thêm / Sửa)
window.openManagePrepaidPackageModal = function(pkgId) {
    const titleEl = document.getElementById('managePrepaidModalTitle');
    const idInp = document.getElementById('editPackageId');
    const nameInp = document.getElementById('editPackageName');
    const topupInp = document.getElementById('editPackageTopup');
    const bonusInp = document.getElementById('editPackageBonus');
    const badgeInp = document.getElementById('editPackageBadge');
    const colorInp = document.getElementById('editPackageBorderColor');
    const sortInp = document.getElementById('editPackageSort');
    const descInp = document.getElementById('editPackageDesc');

    if (pkgId) {
        const p = (window.allPrepaidPackagesCache || []).find(x => x.id == pkgId);
        if (p) {
            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square me-2"></i>Sửa Gói Nạp: ${p.name}`;
            if (idInp) idInp.value = p.id;
            if (nameInp) nameInp.value = p.name;
            if (topupInp) topupInp.value = p.topupAmount;
            if (bonusInp) bonusInp.value = p.bonusAmount;
            if (badgeInp) badgeInp.value = p.badge || '';
            if (colorInp) colorInp.value = p.borderColor || '#2e7d32';
            if (sortInp) sortInp.value = p.sortOrder || 1;
            if (descInp) descInp.value = p.desc || '';
            window.calcPrepaidPackageTotal();
        }
    } else {
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-wallet me-2"></i>Thêm Gói Nạp Ví Trả Trước Mới`;
        if (idInp) idInp.value = '';
        if (nameInp) nameInp.value = '';
        if (topupInp) topupInp.value = '1000000';
        if (bonusInp) bonusInp.value = '100000';
        if (badgeInp) badgeInp.value = '+ TẶNG 100.000 đ';
        if (colorInp) colorInp.value = '#2e7d32';
        if (sortInp) sortInp.value = ((window.allPrepaidPackagesCache || []).length + 1);
        if (descInp) descInp.value = '';
        window.calcPrepaidPackageTotal();
    }

    window.openMemberModalElement('managePrepaidPackageModal');
};

// Tính toán tổng số tiền vào ví khi gõ nạp + tặng
window.calcPrepaidPackageTotal = function() {
    const topup = Number(document.getElementById('editPackageTopup')?.value || 0);
    const bonus = Number(document.getElementById('editPackageBonus')?.value || 0);
    const total = topup + bonus;
    const previewEl = document.getElementById('editPackageTotalPreview');
    if (previewEl) previewEl.innerText = total.toLocaleString('vi-VN') + ' đ';

    const badgeInp = document.getElementById('editPackageBadge');
    if (badgeInp && !badgeInp.dataset.manualEdited) {
        badgeInp.value = bonus > 0 ? `+ TẶNG ${bonus.toLocaleString('vi-VN')} đ` : 'GÓI TIẾT KIỆM';
    }
};

window.selectPrepaidColorPreset = function(color) {
    const colorInp = document.getElementById('editPackageBorderColor');
    if (colorInp) colorInp.value = color;
};

// Lưu Gói Nạp (Thêm mới hoặc Cập nhật)
window.savePrepaidPackage = async function(event) {
    event.preventDefault();
    const id = document.getElementById('editPackageId')?.value;
    const name = document.getElementById('editPackageName')?.value.trim();
    const topup = Number(document.getElementById('editPackageTopup')?.value || 0);
    const bonus = Number(document.getElementById('editPackageBonus')?.value || 0);
    const badge = document.getElementById('editPackageBadge')?.value.trim();
    const color = document.getElementById('editPackageBorderColor')?.value || '#2e7d32';
    const sort = Number(document.getElementById('editPackageSort')?.value || 1);
    const desc = document.getElementById('editPackageDesc')?.value.trim();

    if (!name || topup <= 0) {
        if (window.toast) window.toast.warning('Vui lòng nhập tên gói và số tiền nạp hợp lệ!');
        return;
    }

    const payload = {
        Name: name,
        Topup_amount: topup,
        Bonus_amount: bonus,
        Total_received: topup + bonus,
        Badge_text: badge,
        Border_color: color,
        Bg_color: color === '#2e7d32' ? '#f1f8e9' : (color === '#0288d1' ? '#e3f2fd' : (color === '#f59e0b' ? '#fff8e1' : '#f8f9fa')),
        Text_color: color,
        Description: desc,
        Sort_order: sort
    };

    try {
        const url = id ? `/api/members/prepaid-packages/${id}` : '/api/members/prepaid-packages';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.success) {
            window.closeMemberModalElement('managePrepaidPackageModal');
            if (window.toast) window.toast.success(id ? '✅ Đã cập nhật gói nạp ví thành công!' : '🎉 Đã thêm gói nạp ví mới thành công!');
            await window.loadPrepaidPackages();
        } else {
            alert('Lỗi: ' + (data.error || 'Không thể lưu gói nạp'));
        }
    } catch (err) {
        console.error('Lỗi savePrepaidPackage:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

// Xóa gói nạp ví trả trước
window.deletePrepaidPackage = async function(pkgId, name) {
    const confirmed = (window.toast && typeof window.toast.confirm === 'function')
        ? await window.toast.confirm(`Bạn có chắc chắn muốn xóa gói nạp [${name}]?`, 'Xác nhận xóa gói')
        : confirm(`Bạn có chắc chắn muốn xóa gói nạp [${name}]?`);

    if (!confirmed) return;

    try {
        const res = await fetch(`/api/members/prepaid-packages/${pkgId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            if (window.toast) window.toast.success(`Đã xóa gói nạp [${name}] thành công!`);
            await window.loadPrepaidPackages();
        } else {
            alert('Lỗi xóa: ' + (data.error || 'Thao tác không thành công'));
        }
    } catch (err) {
        console.error('Lỗi deletePrepaidPackage:', err);
        alert('Không thể kết nối máy chủ!');
    }
};

// Submit nạp ví trả trước
window.submitTopupPrepaid = async function(event) {
    event.preventDefault();
    const memberId = document.getElementById('topupMemberId').value;
    const selectedPkg = document.querySelector('input[name="topupPackageRadio"]:checked')?.value || 1;
    const payMethod = document.getElementById('topupPayMethod').value;

    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('hoasen_user') || '{}');
    const staffName = currentUser.Full_name || currentUser.User_name || 'Thu Ngân';

    try {
        const res = await fetch(`/api/members/${memberId}/topup-prepaid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                packageId: selectedPkg,
                paymentMethod: payMethod,
                Staff_name: staffName
            })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Nạp ví thất bại');

        if (window.toast) window.toast.success(data.message || 'Nạp ví thành công!');

        window.closeMemberModalElement('topupPrepaidModal');

        await window.loadMemberStatsOverview();
        await window.loadMembersList();
    } catch (e) {
        if (window.toast) window.toast.error(e.message);
    }
};

// 15. Mở Modal Điều Chỉnh Điểm Thủ Công
window.openAdjustPointsModal = function(id, name) {
    const idEl = document.getElementById('adjustMemberId');
    const nameEl = document.getElementById('adjustMemberName');
    const deltaEl = document.getElementById('adjustPointsDelta');
    const reasonEl = document.getElementById('adjustReason');

    if (idEl) idEl.value = id;
    if (nameEl) nameEl.innerText = name;
    if (deltaEl) deltaEl.value = '';
    if (reasonEl) reasonEl.value = '';

    window.openMemberModalElement('adjustPointsModal');
};

// Submit điều chỉnh điểm
window.submitAdjustPoints = async function(event) {
    event.preventDefault();
    const id = document.getElementById('adjustMemberId').value;
    const delta = document.getElementById('adjustPointsDelta').value;
    const reason = document.getElementById('adjustReason').value.trim();

    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('hoasen_user') || '{}');
    const staffName = currentUser.Full_name || currentUser.User_name || 'Quản Lý';

    try {
        const res = await fetch(`/api/members/${id}/adjust-points`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pointsDelta: delta,
                reason,
                Staff_name: staffName
            })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Điều chỉnh thất bại');

        if (window.toast) window.toast.success(data.message || 'Đã điều chỉnh điểm!');

        window.closeMemberModalElement('adjustPointsModal');

        await window.loadMemberStatsOverview();
        await window.loadMembersList();
    } catch (e) {
        if (window.toast) window.toast.error(e.message);
    }
};

// 16. Xóa Hội Viên
window.deleteMember = function(id, name) {
    if (window.toast && window.toast.confirm(`Bạn có chắc chắn muốn xóa hội viên "${name}" khỏi hệ thống không? Dữ liệu điểm và chi tiêu sẽ bị xóa.`)) {
        fetch(`/api/members/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    window.toast.success('Đã xóa hội viên thành công!');
                    window.loadMemberStatsOverview();
                    window.loadMembersList();
                } else {
                    window.toast.error(data.error || 'Xóa thất bại');
                }
            })
            .catch(err => window.toast.error(err.message));
    }
};

// 17. Mở Modal Tra Cứu Cá Nhân Cho Khách Hàng
window.openCustomerLookupModal = function() {
    const input = document.getElementById('lookupPhoneInput');
    if (input) input.value = '';
    const resArea = document.getElementById('lookupResultArea');
    if (resArea) {
        resArea.style.display = 'none';
        resArea.innerHTML = '';
    }

    window.openMemberModalElement('customerLookupModal');
};

// Thực hiện tra cứu khách hàng
window.doCustomerLookup = async function(explicitPhone) {
    const input = document.getElementById('lookupPhoneInput');
    if (explicitPhone && input) input.value = explicitPhone;
    const phone = explicitPhone || (input ? input.value.trim() : '');
    const resArea = document.getElementById('lookupResultArea');
    if (!phone) {
        if (window.toast) window.toast.warning('Vui lòng nhập số điện thoại hoặc mã định danh của bạn!');
        return;
    }

    if (resArea) {
        resArea.style.display = 'block';
        resArea.innerHTML = `<div class="text-center py-3 text-muted"><i class="fa-solid fa-spinner fa-spin me-1"></i>Đang tra cứu thẻ...</div>`;
    }

    try {
        const res = await fetch(`/api/members/lookup?q=${encodeURIComponent(phone)}`);
        const data = await res.json();

        if (!data.success || !data.found) {
            resArea.innerHTML = `
                <div class="alert alert-warning py-3 text-center border-0 rounded-3">
                    <i class="fa-solid fa-circle-exclamation fs-3 text-warning mb-2"></i>
                    <h6 class="fw-bold text-dark">Chưa Có Thông Tin Hội Viên</h6>
                    <p class="small text-muted mb-2">Số điện thoại <b>${phone}</b> chưa được đăng ký trong hệ thống Chay Hoa Sen.</p>
                    <button class="btn btn-sm btn-success fw-bold rounded-pill px-3" onclick="window.openNewMemberWithPhone('${phone}')">
                        <i class="fa-solid fa-user-plus me-1"></i> Đăng Ký Mầm Sen Ngay
                    </button>
                </div>
            `;
            return;
        }

        const m = data.member;
        const t = m.tierInfo || {};
        const b = m.birthdayInfo || {};

        let bdayHtml = '';
        if (b.isBirthdaySoon) {
            bdayHtml = `
                <div class="alert alert-danger py-2 mb-2 small text-center fw-bold rounded-3">
                    🎂 Chúc Mừng Sinh Nhật Quý Khách! Đặc quyền: ${t.birthdayReward || 'Món quà tri ân'}
                </div>
            `;
        }

        resArea.innerHTML = `
            ${bdayHtml}
            <div class="p-3 rounded-4 shadow-sm text-white mb-3" style="background: ${t.cardBg || 'linear-gradient(135deg, #1b5e20, #4caf50)'};">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="fs-4">${t.icon || '🪷'}</span>
                    <span class="badge bg-white text-dark fw-bold px-2 py-1">${t.name || 'MẦM SEN'}</span>
                </div>
                <h5 class="fw-bold m-0">${m.Full_name}</h5>
                <small class="text-white-50 font-monospace">${m.Phone}</small>

                <div class="row g-2 mt-2 pt-2 border-top border-white-50 text-center">
                    <div class="col-4">
                        <small class="text-white-50 d-block" style="font-size: 10px;">ƯU ĐÃI GIẢM</small>
                        <b class="text-warning fs-6">-${t.discountPercent || 0}%</b>
                    </div>
                    <div class="col-4">
                        <small class="text-white-50 d-block" style="font-size: 10px;">ĐIỂM THƯỞNG</small>
                        <b class="text-warning fs-6">${Number(m.Reward_points || 0).toLocaleString()}</b>
                    </div>
                    <div class="col-4">
                        <small class="text-white-50 d-block" style="font-size: 10px;">VÍ TRẢ TRƯỚC</small>
                        <b class="text-white fs-6">${Number(m.Prepaid_balance || 0).toLocaleString()} đ</b>
                    </div>
                </div>
            </div>

            <div class="text-center p-2 bg-light rounded-3 border">
                <small class="text-muted d-block mb-1">Mã định danh quét tại quầy:</small>
                <b class="font-monospace fs-5 text-dark">${m.Card_code}</b>
                <div class="mt-2">
                    <img src="https://quickchart.io/qr?text=${encodeURIComponent('HOASEN-MEM:' + m.Phone)}&size=130&margin=1" class="img-fluid rounded border p-1 bg-white shadow-sm" style="width: 120px; height: 120px;">
                </div>
            </div>
        `;
    } catch (e) {
        resArea.innerHTML = `<div class="text-danger small text-center py-2">Lỗi: ${e.message}</div>`;
    }
};

// Đăng ký với số điện thoại đã nhập trong popup tra cứu
window.openNewMemberWithPhone = function(phone) {
    window.closeMemberModalElement('customerLookupModal');

    window.openNewMemberModal();
    const phoneInput = document.getElementById('formMemberPhone');
    if (phoneInput) phoneInput.value = phone;
};

// 18. Tặng quà sinh nhật cho hội viên
window.sendBirthdayGift = function(id, name) {
    if (window.toast) {
        window.toast.success(`Đã kích hoạt ưu đãi tặng quà sinh nhật cho Quý khách "${name}"! Nhân viên thu ngân vui lòng in voucher hoặc phục vụ tráng miệng.`);
    }
};

// 19. Bật/tắt sự kiện x2 điểm (Lễ hội chay)
window.toggleFestivalOverride = async function(checked) {
    try {
        const res = await fetch('/api/system-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vegetarian_festival_x2: checked ? '1' : '0'
            })
        });
        if (res.ok) {
            if (window.toast) window.toast.success(checked ? 'Đã BẬT ưu đãi nhân đôi điểm (x2 Points) cho ngày lễ!' : 'Đã TẮT ưu đãi nhân đôi điểm thủ công.');
            await window.loadMemberLunarInfo();
        }
    } catch (e) {
        console.error('Lỗi lưu cài đặt lễ hội chay:', e);
    }
};

// 20. In Thẻ Thành Viên Ra Giấy / Thẻ Nhựa
window.printMemberQrCard = function() {
    const m = window.activeViewingMember;
    if (!m) return;

    const t = m.tierInfo || {};
    const win = window.open('', '_blank', 'width=450,height=300');
    win.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Thẻ Hội Viên - ${m.Full_name}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 15px; display: flex; justify-content: center; }
                    .card-box { width: 340px; height: 200px; border-radius: 12px; background: #1b5e20; color: white; padding: 16px; box-sizing: border-box; position: relative; }
                    .title { font-size: 14px; font-weight: bold; letter-spacing: 1px; }
                    .sub { font-size: 10px; color: #a5d6a7; margin-bottom: 12px; }
                    .name { font-size: 17px; font-weight: bold; margin: 8px 0 2px 0; }
                    .phone { font-size: 13px; font-family: monospace; color: #fff9c4; }
                    .footer { position: absolute; bottom: 12px; left: 16px; right: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .code { font-size: 13px; font-family: monospace; color: #ffe082; font-weight: bold; }
                    .badge { background: rgba(255,255,255,0.25); padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="card-box" style="background: ${t.cardBg || '#1b5e20'};">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <div class="title">NHÀ HÀNG CHAY HOA SEN</div>
                            <div class="sub">HỘI VIÊN THANH TỊNH</div>
                        </div>
                        <span class="badge">${t.name || 'MẦM SEN'}</span>
                    </div>

                    <div class="name">${m.Full_name}</div>
                    <div class="phone">${m.Phone}</div>

                    <div class="footer">
                        <div>
                            <div style="font-size: 8px; color: rgba(255,255,255,0.7);">MÃ ĐỊNH DANH</div>
                            <div class="code">${m.Card_code}</div>
                        </div>
                        <div>
                            <img src="https://quickchart.io/qr?text=${encodeURIComponent('HOASEN-MEM:' + m.Phone)}&size=70&margin=0" style="width: 50px; height: 50px; background: white; padding: 2px; border-radius: 4px;">
                        </div>
                    </div>
                </div>
            </body>
        </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
        win.print();
        win.close();
    }, 400);
};

// In phôi thẻ cứng
window.openPrintPhysicalCardModal = function() {
    window.printMemberQrCard();
};

// 21. Lắng nghe Socket Realtime để cập nhật số liệu
window.setupMemberSocketListeners = function() {
    if (typeof io !== 'function') return;
    const socket = io(window.location.origin);

    socket.on('member_created', () => {
        window.loadMemberStatsOverview();
        window.loadMembersList();
    });

    socket.on('member_balance_updated', (data) => {
        window.loadMemberStatsOverview();
        window.loadMembersList();
        if (window.activeViewingMember && window.activeViewingMember.Member_id === data.Member_id) {
            window.activeViewingMember.Reward_points = data.Reward_points;
            window.activeViewingMember.Prepaid_balance = data.Prepaid_balance;
            window.activeViewingMember.Total_spent = data.Total_spent;
            window.activeViewingMember.Current_tier = data.Current_tier;
        }
    });

    socket.on('member_tier_upgraded', (data) => {
        if (window.toast) {
            window.toast.success(`🎉 Chúc mừng Quý khách ${data.Full_name} đã được thăng hạng thành viên lên [${data.New_tier_name}]!`);
        }
        window.loadMemberStatsOverview();
        window.loadMembersList();
    });

    socket.on('tiers_updated', () => {
        window.loadMemberTierConfig();
        window.loadTiersList();
        window.loadMembersList();
    });
};

// ========================================================
// PHẦN 22: QUẢN LÝ CẤU HÌNH HẠNG THẺ (DYNAMIC TIER CRUD)
// ========================================================
window.cachedTiersList = [];

// Tải và hiển thị danh sách các hạng thẻ động
window.loadTiersList = async function() {
    const tbody = document.getElementById('tiersPolicyTableTbody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/members/tiers?t=' + Date.now());
        if (!res.ok) throw new Error('Không thể tải cấu hình hạng thẻ');
        const data = await res.json();
        const tiers = data.tiers || [];
        window.cachedTiersList = tiers;

        if (tiers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">Chưa có cấu hình hạng thẻ nào.</td></tr>`;
            return;
        }

        tbody.innerHTML = tiers.map((t, idx) => {
            const defBadge = t.Is_default ? `<span class="badge bg-success-subtle text-success ms-1 border border-success">Mặc định</span>` : '';
            return `
                <tr>
                    <td class="text-center fw-bold">${t.Sort_order || (idx + 1)}</td>
                    <td class="text-center fs-4">${t.Icon || '🪷'}</td>
                    <td>
                        <div class="fw-bold" style="color: ${t.Color || '#2e7d32'};">${t.Tier_name} ${defBadge}</div>
                        <small class="text-muted font-monospace">${t.Tier_code}</small>
                    </td>
                    <td class="text-center fw-bold text-dark">
                        ${Number(t.Min_spent || 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td class="text-center fw-bold text-danger">
                        ${t.Discount_percent}%
                    </td>
                    <td class="text-center fw-bold text-success">
                        ${t.Point_rate}%
                    </td>
                    <td class="small">
                        ${t.Birthday_reward || '<span class="text-muted">Chưa cài đặt</span>'}
                    </td>
                    <td class="text-center">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-dark" onclick="window.openEditTierModal(${t.Tier_id})" title="Chỉnh sửa cấu hình hạng">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="window.deleteTier(${t.Tier_id}, '${t.Tier_name.replace(/'/g, "\\'")}')" title="Xóa hạng thẻ">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('Lỗi tải tiers:', e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Lỗi: ${e.message}</td></tr>`;
    }
};

// Mở modal thêm mới hạng thẻ
window.openNewTierModal = function() {
    document.getElementById('formTierId').value = '';
    document.getElementById('formTierCode').value = '';
    document.getElementById('formTierCode').readOnly = false;
    document.getElementById('formTierName').value = '';
    document.getElementById('formTierIcon').value = '🪷';
    document.getElementById('formTierMinSpent').value = '0';
    document.getElementById('formTierDiscount').value = '5';
    document.getElementById('formTierPointRate').value = '3';
    document.getElementById('formTierBirthdayReward').value = '';
    document.getElementById('formTierCardBg').value = 'linear-gradient(135deg, #1b5e20, #4caf50)';
    document.getElementById('formTierSortOrder').value = '10';
    document.getElementById('formTierIsDefault').value = '0';
    document.getElementById('tierFormModalTitle').innerHTML = '<i class="fa-solid fa-plus me-2"></i>Thêm Hạng Thẻ Thành Viên Mới';

    window.openMemberModalElement('tierFormModal');
};

// Mở modal sửa hạng thẻ
window.openEditTierModal = function(tierId) {
    const tier = window.cachedTiersList.find(t => t.Tier_id === tierId);
    if (!tier) return;

    document.getElementById('formTierId').value = tier.Tier_id;
    document.getElementById('formTierCode').value = tier.Tier_code;
    document.getElementById('formTierCode').readOnly = true; // Không đổi mã gốc để tránh sai lệch quan hệ
    document.getElementById('formTierName').value = tier.Tier_name;
    document.getElementById('formTierIcon').value = tier.Icon || '🪷';
    document.getElementById('formTierMinSpent').value = tier.Min_spent || 0;
    document.getElementById('formTierDiscount').value = tier.Discount_percent || 0;
    document.getElementById('formTierPointRate').value = tier.Point_rate || 0;
    document.getElementById('formTierBirthdayReward').value = tier.Birthday_reward || '';
    document.getElementById('formTierCardBg').value = tier.Card_bg || '';
    document.getElementById('formTierSortOrder').value = tier.Sort_order || 10;
    document.getElementById('formTierIsDefault').value = tier.Is_default ? '1' : '0';
    document.getElementById('tierFormModalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square me-2"></i>Chỉnh Sửa Hạng: ${tier.Tier_name}`;

    window.openMemberModalElement('tierFormModal');
};

// Submit form thêm / sửa cấu hình hạng thẻ
window.submitTierForm = async function(event) {
    event.preventDefault();
    const id = document.getElementById('formTierId').value;
    const code = document.getElementById('formTierCode').value.trim().toUpperCase();
    const name = document.getElementById('formTierName').value.trim();
    const icon = document.getElementById('formTierIcon').value.trim() || '🪷';
    const minSpent = parseFloat(document.getElementById('formTierMinSpent').value) || 0;
    const discount = parseFloat(document.getElementById('formTierDiscount').value) || 0;
    const pointRate = parseFloat(document.getElementById('formTierPointRate').value) || 0;
    const bdayReward = document.getElementById('formTierBirthdayReward').value.trim();
    const cardBg = document.getElementById('formTierCardBg').value.trim();
    const sortOrder = parseInt(document.getElementById('formTierSortOrder').value) || 10;
    const isDefault = parseInt(document.getElementById('formTierIsDefault').value) || 0;

    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('hoasen_user') || '{}');
    const staffName = currentUser.Full_name || currentUser.User_name || 'Quản Lý';

    const payload = {
        Tier_code: code,
        Tier_name: name,
        Icon: icon,
        Min_spent: minSpent,
        Discount_percent: discount,
        Point_rate: pointRate,
        Birthday_reward: bdayReward,
        Card_bg: cardBg,
        Sort_order: sortOrder,
        Is_default: isDefault,
        Staff_name: staffName
    };

    try {
        const url = id ? `/api/members/tiers/${id}` : '/api/members/tiers';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Lưu cấu hình thất bại');

        if (window.toast) window.toast.success(data.message || 'Lưu cấu hình hạng thẻ thành công!');
        window.closeMemberModalElement('tierFormModal');

        await window.loadMemberTierConfig();
        await window.loadTiersList();
        await window.loadMembersList();
    } catch (e) {
        if (window.toast) window.toast.error(e.message);
    }
};

// Xóa cấu hình hạng thẻ
window.deleteTier = async function(tierId, tierName) {
    if (!confirm(`Bạn có chắc chắn muốn xóa hạng thẻ "${tierName}" không?`)) return;

    try {
        const currentUser = window.currentUser || JSON.parse(localStorage.getItem('hoasen_user') || '{}');
        const staffName = currentUser.Full_name || currentUser.User_name || 'Quản Lý';

        const res = await fetch(`/api/members/tiers/${tierId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Staff_name: staffName })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Xóa thất bại');

        if (window.toast) window.toast.success(data.message || 'Đã xóa hạng thẻ!');
        await window.loadMemberTierConfig();
        await window.loadTiersList();
        await window.loadMembersList();
    } catch (e) {
        if (window.toast) window.toast.error(e.message);
    }
};

// Quét và xét lại toàn bộ hạng hội viên hàng loạt
window.batchReevaluateTiers = async function() {
    if (!confirm('Hệ thống sẽ quét toàn bộ hội viên và tự động thăng hạng / hạ hạng dựa trên tổng chi tiêu tích lũy hiện tại của từng khách. Bạn có muốn tiếp tục?')) return;

    try {
        const currentUser = window.currentUser || JSON.parse(localStorage.getItem('hoasen_user') || '{}');
        const staffName = currentUser.Full_name || currentUser.User_name || 'Quản Lý';

        const res = await fetch('/api/members/batch-reevaluate-tiers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Staff_name: staffName })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Thực hiện thất bại');

        if (window.toast) {
            window.toast.success(`Đã quét ${data.totalEvaluated} hội viên. Có ${data.updatedCount} hội viên được cập nhật hạng thẻ mới!`);
        }

        await window.loadMemberStatsOverview();
        await window.loadMembersList();
        await window.loadMemberLogs();
    } catch (e) {
        if (window.toast) window.toast.error(e.message);
    }
};

// ========================================================
// PHẦN 23: TRỰC TIẾP THĂNG / ĐỔI HẠNG CHO HỘI VIÊN CỤ THỂ
// ========================================================
window.openChangeTierModal = function(memberId, memberName, currentTierCode) {
    document.getElementById('manualTierMemberId').value = memberId;
    document.getElementById('manualTierMemberName').innerText = memberName;
    document.getElementById('manualTierMemberCurrent').innerText = `Hạng hiện tại: ${currentTierCode}`;
    document.getElementById('manualTierReason').value = '';

    const currentBadgeEl = document.getElementById('manualTierCurrentBadge');
    if (currentBadgeEl) {
        currentBadgeEl.innerText = currentTierCode;
    }

    // Populate select
    const select = document.getElementById('manualTierNewSelect');
    if (select) {
        const tiers = window.cachedTiersList && window.cachedTiersList.length > 0
            ? window.cachedTiersList
            : (window.cachedTiersConfig ? Object.values(window.cachedTiersConfig) : []);

        select.innerHTML = tiers.map(t => {
            const code = t.Tier_code || t.code;
            const name = t.Tier_name || t.name;
            const icon = t.Icon || t.icon || '🪷';
            const disc = t.Discount_percent || t.discountPercent || 0;
            const isSel = (code === currentTierCode) ? 'selected' : '';
            return `<option value="${code}" ${isSel}>${icon} ${name} (Giảm ${disc}%)</option>`;
        }).join('');
    }

    window.openMemberModalElement('changeTierManualModal');
};

// Submit đổi hạng trực tiếp
window.submitChangeTierManual = async function(event) {
    event.preventDefault();
    const memberId = document.getElementById('manualTierMemberId').value;
    const newTier = document.getElementById('manualTierNewSelect').value;
    const reason = document.getElementById('manualTierReason').value.trim();

    if (!newTier) {
        if (window.toast) window.toast.warning('Vui lòng chọn hạng thẻ mới!');
        return;
    }

    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('hoasen_user') || '{}');
    const staffName = currentUser.Full_name || currentUser.User_name || 'Quản Lý';

    try {
        const res = await fetch(`/api/members/${memberId}/change-tier`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                newTier,
                reason,
                Staff_name: staffName
            })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Đổi hạng thất bại');

        if (window.toast) window.toast.success(data.message || 'Đã thay đổi hạng thẻ thành công!');
        window.closeMemberModalElement('changeTierManualModal');

        await window.loadMemberStatsOverview();
        await window.loadMembersList();
        await window.loadMemberLogs();
    } catch (e) {
        if (window.toast) window.toast.error(e.message);
    }
};

// ========================================================
// PHẦN 24: ĐIỀU CHỈNH CHI TIÊU TÍCH LŨY (+/-)
// ========================================================
window.openAdjustSpentModal = function(memberId, memberName, currentSpent) {
    document.getElementById('adjustSpentMemberId').value = memberId;
    document.getElementById('adjustSpentMemberName').innerText = memberName;
    document.getElementById('adjustSpentCurrentVal').innerText = Number(currentSpent || 0).toLocaleString('vi-VN') + ' đ';
    document.getElementById('adjustSpentDelta').value = '';
    document.getElementById('adjustSpentReason').value = '';

    window.openMemberModalElement('adjustSpentModal');
};

// Submit điều chỉnh chi tiêu
window.submitAdjustSpent = async function(event) {
    event.preventDefault();
    const memberId = document.getElementById('adjustSpentMemberId').value;
    const delta = parseFloat(document.getElementById('adjustSpentDelta').value);
    const reason = document.getElementById('adjustSpentReason').value.trim();

    if (isNaN(delta) || delta === 0) {
        if (window.toast) window.toast.warning('Vui lòng nhập số tiền hợp lệ khác 0!');
        return;
    }

    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('hoasen_user') || '{}');
    const staffName = currentUser.Full_name || currentUser.User_name || 'Quản Lý';

    try {
        const res = await fetch(`/api/members/${memberId}/adjust-spent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                spentDelta: delta,
                reason,
                Staff_name: staffName
            })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Điều chỉnh chi tiêu thất bại');

        if (window.toast) window.toast.success(data.message || 'Đã điều chỉnh chi tiêu thành công!');
        window.closeMemberModalElement('adjustSpentModal');

        await window.loadMemberStatsOverview();
        await window.loadMembersList();
        await window.loadMemberLogs();
    } catch (e) {
        if (window.toast) window.toast.error(e.message);
    }
};

// ========================================================
// PHẦN 25: NHẬT KÝ HOẠT ĐỘNG & BIẾN ĐỘNG (AUDIT LOGS)
// ========================================================
window.currentLogActionFilter = 'ALL';

window.filterMemberLogs = function(actionType) {
    window.currentLogActionFilter = actionType;
    window.loadMemberLogs();
};

window.loadMemberLogs = async function() {
    const tbody = document.getElementById('memberLogsTableTbody');
    if (!tbody) return;

    try {
        let url = `/api/members/logs?limit=50&t=${Date.now()}`;
        if (window.currentLogActionFilter && window.currentLogActionFilter !== 'ALL') {
            url += `&action=${encodeURIComponent(window.currentLogActionFilter)}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error('Không thể tải nhật ký');
        const data = await res.json();
        const logs = data.logs || [];

        const infoEl = document.getElementById('memberLogsPaginationInfo');
        if (infoEl) infoEl.innerText = `Hiển thị ${logs.length} bản ghi gần nhất`;

        if (logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Chưa có bản ghi nhật ký nào.</td></tr>`;
            return;
        }

        tbody.innerHTML = logs.map(log => {
            let actionBadge = `<span class="badge bg-secondary">${log.Action_type}</span>`;
            if (log.Action_type === 'TIER_MANUAL_CHANGE') {
                actionBadge = `<span class="badge bg-warning text-dark fw-bold">⭐ Đổi Hạng Thủ Công</span>`;
            } else if (log.Action_type === 'TIER_UPGRADE_AUTO') {
                actionBadge = `<span class="badge bg-success fw-bold">🚀 Tự Động Thăng Hạng</span>`;
            } else if (log.Action_type === 'SPENT_ADJUST') {
                actionBadge = `<span class="badge bg-primary fw-bold">💰 Sửa Chi Tiêu</span>`;
            } else if (log.Action_type === 'POINT_ADJUST') {
                actionBadge = `<span class="badge bg-info text-dark fw-bold">🎯 Sửa Điểm</span>`;
            } else if (log.Action_type === 'PREPAID_TOPUP') {
                actionBadge = `<span class="badge bg-success fw-bold">💳 Nạp Ví</span>`;
            } else if (log.Action_type.startsWith('TIER_CONFIG')) {
                actionBadge = `<span class="badge bg-dark fw-bold">⚙️ Cấu Hình Hạng</span>`;
            } else if (log.Action_type === 'BATCH_EVALUATE') {
                actionBadge = `<span class="badge bg-purple text-white fw-bold" style="background: #6a1b9a;">🔄 Quét Hàng Loạt</span>`;
            }

            let diffText = '';
            if (log.Old_tier || log.New_tier) {
                diffText = `<span class="badge bg-light text-dark border">${log.Old_tier || '---'}</span> <i class="fa-solid fa-arrow-right text-muted mx-1"></i> <span class="badge bg-success text-white">${log.New_tier || '---'}</span>`;
            } else if (log.Old_value !== null || log.New_value !== null) {
                const isMoney = (log.Action_type === 'SPENT_ADJUST' || log.Action_type === 'PREPAID_TOPUP');
                const fmt = (val) => val === null ? '---' : (isMoney ? Number(val).toLocaleString('vi-VN') + ' đ' : val + ' pts');
                diffText = `<span class="text-muted font-monospace">${fmt(log.Old_value)}</span> ➔ <b class="text-primary font-monospace">${fmt(log.New_value)}</b>`;
            }

            const memberName = log.Member_name || (log.Member_phone ? log.Member_phone : '<span class="text-muted">Hệ thống</span>');
            const memberSub = log.Member_phone ? `<small class="text-muted d-block font-monospace">${log.Member_phone}</small>` : '';

            return `
                <tr>
                    <td class="small text-muted font-monospace">${log.Created_at || ''}</td>
                    <td>
                        <div class="fw-bold text-dark">${memberName}</div>
                        ${memberSub}
                    </td>
                    <td>${actionBadge}</td>
                    <td>${diffText}</td>
                    <td class="text-muted">${log.Reason || ''}</td>
                    <td>
                        <span class="badge bg-light text-secondary border fw-semibold">
                            <i class="fa-solid fa-user-shield me-1"></i>${log.Staff_name || 'Hệ thống'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('Lỗi nạp nhật ký:', e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Lỗi: ${e.message}</td></tr>`;
    }
};
