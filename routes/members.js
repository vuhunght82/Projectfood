const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');
const DB_PATH = path.join(__dirname, '../database.db');

function getDb() {
    return new Database(DB_PATH);
}

// ==========================================
// 1. THUẬT TOÁN ÂM LỊCH VIỆT NAM (HỒ NGỌC ĐỨC)
// ==========================================
function jdFromDate(dd, mm, yy) {
    const a = Math.floor((14 - mm) / 12);
    const y = yy + 4800 - a;
    const m = mm + 12 * a - 3;
    return dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function getNewMoonDay(k, timeZone) {
    const T = k / 1236.85;
    const T2 = T * T;
    const T3 = T2 * T;
    const dr = Math.PI / 180;
    let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
    const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
    const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
    const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
    let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
    C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(2 * dr * Mpr);
    C1 = C1 - 0.0004 * Math.sin(3 * dr * Mpr);
    C1 = C1 + 0.0104 * Math.sin(2 * dr * F) - 0.0051 * Math.sin((M + Mpr) * dr);
    C1 = C1 - 0.0074 * Math.sin((M - Mpr) * dr) + 0.0004 * Math.sin((2 * F + M) * dr);
    C1 = C1 - 0.0004 * Math.sin((2 * F - M) * dr) - 0.0006 * Math.sin((2 * F + Mpr) * dr);
    C1 = C1 + 0.0010 * Math.sin((2 * F - Mpr) * dr) + 0.0005 * Math.sin((2 * Mpr + M) * dr);
    let deltat;
    if (T < -11) deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
    else deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
    const JdNew = Jd1 + C1 - deltat;
    return Math.floor(JdNew + 0.5 + timeZone / 24);
}

function getSunLongitude(dayNumber, timeZone) {
    const T = (dayNumber - 2451545.5 - timeZone / 24) / 36525;
    const T2 = T * T;
    const dr = Math.PI / 180;
    const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    const DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
    let L = L0 + DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
    L = L * dr;
    L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
    return Math.floor(L / Math.PI * 6);
}

function getLunarMonth11(yy, timeZone) {
    const off = jdFromDate(31, 12, yy) - 2415021;
    const k = Math.floor(off / 29.530588853);
    let nm = getNewMoonDay(k, timeZone);
    const sunLong = getSunLongitude(nm, timeZone);
    if (sunLong >= 9) nm = getNewMoonDay(k - 1, timeZone);
    return nm;
}

function convertSolar2Lunar(dd, mm, yy, timeZone = 7) {
    const dayNumber = jdFromDate(dd, mm, yy);
    const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
    let monthStart = getNewMoonDay(k + 1, timeZone);
    if (monthStart > dayNumber) monthStart = getNewMoonDay(k, timeZone);
    let a11 = getLunarMonth11(yy, timeZone);
    let b11 = a11;
    let year = yy;
    if (a11 >= monthStart) {
        year = yy - 1;
        a11 = getLunarMonth11(yy - 1, timeZone);
    } else {
        b11 = getLunarMonth11(yy + 1, timeZone);
    }
    const lunarDay = dayNumber - monthStart + 1;
    const diff = Math.floor((monthStart - a11) / 29);
    let lunarMonth = (diff + 11) % 12;
    if (lunarMonth === 0) lunarMonth = 12;
    return { lunarDay, lunarMonth, lunarYear: year };
}

// ==========================================
// 2. CẤU HÌNH HẠNG THẺ & QUYỀN LỢI HOA SEN
// ==========================================
const DEFAULT_TIER_CONFIG = {
    MAM_SEN: {
        code: 'MAM_SEN',
        name: 'Mầm Sen',
        badgeTitle: 'Thành viên mới',
        icon: '🌱',
        minSpent: 0,
        discountPercent: 0,
        pointRate: 0.03, // 3%
        birthdayReward: 'Tặng 01 món tráng miệng thanh tịnh trong tuần sinh nhật',
        color: '#2e7d32',
        cardBg: 'linear-gradient(135deg, #1b5e20, #4caf50)',
        textColor: '#ffffff',
        sortOrder: 1,
        isDefault: 1
    },
    BUP_SEN: {
        code: 'BUP_SEN',
        name: 'Búp Sen',
        badgeTitle: 'Hạng Bạc',
        icon: '🪷',
        minSpent: 2000000,
        discountPercent: 5,
        pointRate: 0.03, // 3%
        birthdayReward: 'Tặng voucher 50.000đ dịp sinh nhật',
        color: '#0288d1',
        cardBg: 'linear-gradient(135deg, #0277bd, #00b0ff)',
        textColor: '#ffffff',
        sortOrder: 2,
        isDefault: 0
    },
    SEN_HONG: {
        code: 'SEN_HONG',
        name: 'Sen Hồng',
        badgeTitle: 'Hạng Vàng',
        icon: '🌸',
        minSpent: 6000000,
        discountPercent: 10,
        pointRate: 0.05, // 5%
        birthdayReward: 'Tặng voucher 100.000đ + Ưu tiên giữ bàn đẹp',
        color: '#d81b60',
        cardBg: 'linear-gradient(135deg, #ad1457, #f06292)',
        textColor: '#ffffff',
        sortOrder: 3,
        isDefault: 0
    },
    SEN_KIM_CUONG: {
        code: 'SEN_KIM_CUONG',
        name: 'Sen Kim Cương',
        badgeTitle: 'Hạng VIP',
        icon: '💎',
        minSpent: 15000000,
        discountPercent: 15,
        pointRate: 0.05, // 5%
        birthdayReward: 'Quà tri ân đặc biệt + Miễn phí phòng riêng/VIP',
        color: '#6a1b9a',
        cardBg: 'linear-gradient(135deg, #4a148c, #ab47bc, #f59e0b)',
        textColor: '#ffffff',
        sortOrder: 4,
        isDefault: 0
    }
};

function getPrepaidPackagesFromDb(db, includeInactive = false) {
    try {
        const query = includeInactive 
            ? "SELECT * FROM PREPAID_PACKAGES ORDER BY Sort_order ASC, Topup_amount ASC, Package_id ASC"
            : "SELECT * FROM PREPAID_PACKAGES WHERE Is_active = 1 ORDER BY Sort_order ASC, Topup_amount ASC, Package_id ASC";
        const rows = db.prepare(query).all();
        if (rows && rows.length > 0) {
            return rows.map(r => ({
                id: r.Package_id,
                name: r.Name,
                topupAmount: Number(r.Topup_amount || 0),
                bonusAmount: Number(r.Bonus_amount || 0),
                totalReceived: Number(r.Total_received || (r.Topup_amount + (r.Bonus_amount || 0))),
                desc: r.Description || '',
                badge: r.Badge_text || '',
                bgColor: r.Bg_color || '#f1f8e9',
                borderColor: r.Border_color || '#2e7d32',
                textColor: r.Text_color || '#2e7d32',
                sortOrder: r.Sort_order || 0,
                isActive: r.Is_active ?? 1
            }));
        }
    } catch(e) {}
    return [
        { id: 1, name: 'Gói An Lạc', topupAmount: 1000000, bonusAmount: 100000, totalReceived: 1100000, desc: 'Nạp 1.000.000đ tặng 100.000đ', badge: '+ TẶNG 100.000 đ', bgColor: '#f1f8e9', borderColor: '#2e7d32', textColor: '#2e7d32', sortOrder: 1, isActive: 1 },
        { id: 2, name: 'Gói Tinh Tấn', topupAmount: 2000000, bonusAmount: 250000, totalReceived: 2250000, desc: 'Nạp 2.000.000đ tặng 250.000đ', badge: '+ TẶNG 250.000 đ', bgColor: '#e3f2fd', borderColor: '#0288d1', textColor: '#0288d1', sortOrder: 2, isActive: 1 },
        { id: 3, name: 'Gói Hỷ Xả', topupAmount: 5000000, bonusAmount: 750000, totalReceived: 5750000, desc: 'Nạp 5.000.000đ tặng 750.000đ', badge: '+ TẶNG 750.000 đ', bgColor: '#fff8e1', borderColor: '#f59e0b', textColor: '#b45309', sortOrder: 3, isActive: 1 }
    ];
}

// Lấy toàn bộ danh sách & map hạng thẻ từ CSDL
function getTierConfigFromDb(db) {
    try {
        const rows = db.prepare("SELECT * FROM MEMBER_TIERS WHERE Is_active = 1 ORDER BY Sort_order ASC, Min_spent ASC").all();
        if (rows && rows.length > 0) {
            const map = {};
            rows.forEach(r => {
                map[r.Tier_code] = {
                    id: r.Tier_id,
                    code: r.Tier_code,
                    name: r.Tier_name,
                    badgeTitle: r.Badge_title || '',
                    icon: r.Icon || '🪷',
                    minSpent: Number(r.Min_spent || 0),
                    discountPercent: Number(r.Discount_percent || 0),
                    pointRate: Number(r.Point_rate || 0.03),
                    birthdayReward: r.Birthday_reward || '',
                    color: r.Color || '#2e7d32',
                    cardBg: r.Card_bg || 'linear-gradient(135deg, #1b5e20, #4caf50)',
                    textColor: r.Text_color || '#ffffff',
                    sortOrder: r.Sort_order || 0,
                    isDefault: r.Is_default || 0
                };
            });
            return { map, list: rows };
        }
    } catch (e) {
        console.warn('Lỗi đọc MEMBER_TIERS:', e.message);
    }
    return { map: DEFAULT_TIER_CONFIG, list: Object.values(DEFAULT_TIER_CONFIG) };
}

// Xác định hạng thẻ tương ứng từ tổng chi tiêu
function calculateTierBySpent(totalSpent, db) {
    const spent = Number(totalSpent || 0);
    if (db) {
        try {
            const rows = db.prepare("SELECT * FROM MEMBER_TIERS WHERE Is_active = 1 ORDER BY Min_spent DESC, Sort_order DESC").all();
            if (rows && rows.length > 0) {
                for (const r of rows) {
                    if (spent >= Number(r.Min_spent || 0)) {
                        return r.Tier_code;
                    }
                }
                const def = rows.find(r => r.Is_default === 1) || rows[rows.length - 1];
                return def ? def.Tier_code : 'MAM_SEN';
            }
        } catch (e) {}
    }
    if (spent >= 15000000) return 'SEN_KIM_CUONG';
    if (spent >= 6000000) return 'SEN_HONG';
    if (spent >= 2000000) return 'BUP_SEN';
    return 'MAM_SEN';
}

// Ghi nhật ký biến động hội viên
function logMemberAction(db, data) {
    try {
        db.prepare(`
            INSERT INTO MEMBER_LOGS (
                Member_id, Member_name, Member_phone, Action_type, 
                Old_tier, New_tier, Old_value, New_value, Reason, Staff_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            data.Member_id || null,
            data.Member_name || null,
            data.Member_phone || null,
            data.Action_type,
            data.Old_tier || null,
            data.New_tier || null,
            data.Old_value ? (typeof data.Old_value === 'object' ? JSON.stringify(data.Old_value) : String(data.Old_value)) : null,
            data.New_value ? (typeof data.New_value === 'object' ? JSON.stringify(data.New_value) : String(data.New_value)) : null,
            data.Reason || '',
            data.Staff_name || 'Hệ thống'
        );
    } catch (e) {
        console.warn('Lỗi ghi MEMBER_LOGS:', e.message);
    }
}

// Kiểm tra thông tin Âm lịch hôm nay và ưu đãi x2 điểm
function getTodayLunarInfo(db) {
    const now = new Date();
    const dd = now.getDate();
    const mm = now.getMonth() + 1;
    const yy = now.getFullYear();

    let lunar = { lunarDay: 1, lunarMonth: 1, lunarYear: yy };
    try {
        lunar = convertSolar2Lunar(dd, mm, yy, 7);
    } catch (e) {
        console.warn('Lỗi tính âm lịch:', e.message);
    }

    const isVegetarianDay = (lunar.lunarDay === 1 || lunar.lunarDay === 15);

    // Kiểm tra cấu hình override từ SYSTEM_CONFIG nếu có
    let festivalOverride = false;
    try {
        if (db) {
            const row = db.prepare("SELECT Value FROM SYSTEM_CONFIG WHERE Key = 'vegetarian_festival_x2'").get();
            if (row && (row.Value === '1' || row.Value === '"1"' || row.Value === 'true')) {
                festivalOverride = true;
            }
        }
    } catch (eCfg) {}

    const isDoublePoints = isVegetarianDay || festivalOverride;

    let dayLabel = `Ngày ${lunar.lunarDay} Tháng ${lunar.lunarMonth} Âm Lịch`;
    if (lunar.lunarDay === 1) dayLabel = `Mùng 1 Tháng ${lunar.lunarMonth} Âm Lịch (Ngày Chay)`;
    else if (lunar.lunarDay === 15) dayLabel = `Rằm Tháng ${lunar.lunarMonth} Âm Lịch (Ngày Chay Rằm)`;

    return {
        solarDate: `${dd}/${mm}/${yy}`,
        lunarDay: lunar.lunarDay,
        lunarMonth: lunar.lunarMonth,
        lunarYear: lunar.lunarYear,
        lunarText: dayLabel,
        isVegetarianDay,
        festivalOverride,
        isDoublePoints
    };
}

// Kiểm tra xem thành viên có sinh nhật trong tuần này không
function checkBirthdayStatus(birthdateStr) {
    if (!birthdateStr) return { isBirthdaySoon: false, isBirthdayToday: false, daysUntil: null };
    try {
        const parts = birthdateStr.split('-');
        if (parts.length < 3) return { isBirthdaySoon: false, isBirthdayToday: false, daysUntil: null };

        const bMonth = parseInt(parts[1], 10);
        const bDay = parseInt(parts[2], 10);

        const now = new Date();
        const currentYear = now.getFullYear();

        // Ngày sinh nhật trong năm hiện tại
        let nextBirthday = new Date(currentYear, bMonth - 1, bDay);
        // Nếu sinh nhật đã qua quá 7 ngày, tính năm tới nếu cần
        const todayStart = new Date(currentYear, now.getMonth(), now.getDate());
        const diffMs = nextBirthday.getTime() - todayStart.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        const isBirthdayToday = (diffDays === 0);
        const isBirthdaySoon = (diffDays >= -3 && diffDays <= 7); // Trong khoảng 3 ngày trước đến 7 ngày tới

        return {
            isBirthdaySoon,
            isBirthdayToday,
            daysUntil: diffDays,
            bMonth,
            bDay
        };
    } catch (e) {
        return { isBirthdaySoon: false, isBirthdayToday: false, daysUntil: null };
    }
}

// ==========================================
// 3. CÁC API ENDPOINTS
// ==========================================

// 1. GET /api/members/lunar/today - Lấy thông tin Âm lịch & ưu đãi x2
router.get('/lunar/today', (req, res) => {
    try {
        const db = getDb();
        const info = getTodayLunarInfo(db);
        db.close();
        res.json({ success: true, ...info });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. GET /api/members/tier-config - Cấu hình các hạng thẻ & gói nạp
router.get('/tier-config', (req, res) => {
    try {
        const db = getDb();
        const { map, list } = getTierConfigFromDb(db);
        const prepaidPackages = getPrepaidPackagesFromDb(db, false);
        db.close();
        res.json({
            success: true,
            tiers: map,
            tiersList: list,
            prepaidPackages: prepaidPackages,
            pointExchangeRate: 1000 // 1 điểm = 1000đ
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2.0. GET /api/members/prepaid-packages - Lấy danh sách gói nạp ví trả trước
router.get('/prepaid-packages', (req, res) => {
    try {
        const db = getDb();
        const packages = getPrepaidPackagesFromDb(db, true);
        db.close();
        res.json({ success: true, packages });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2.0.1. POST /api/members/prepaid-packages - Thêm gói nạp ví trả trước
router.post('/prepaid-packages', (req, res) => {
    try {
        const {
            Name,
            Topup_amount,
            Bonus_amount,
            Total_received,
            Badge_text,
            Bg_color,
            Border_color,
            Text_color,
            Description,
            Sort_order
        } = req.body;

        if (!Name || !Topup_amount) {
            return res.status(400).json({ success: false, error: 'Tên gói và Số tiền nạp không được để trống!' });
        }

        const topup = Number(Topup_amount);
        const bonus = Number(Bonus_amount || 0);
        const total = Number(Total_received || (topup + bonus));
        const badge = Badge_text || (bonus > 0 ? `+ TẶNG ${bonus.toLocaleString('vi-VN')} đ` : '');

        const db = getDb();
        const info = db.prepare(`
            INSERT INTO PREPAID_PACKAGES (
                Name, Topup_amount, Bonus_amount, Total_received, Badge_text, Bg_color, Border_color, Text_color, Description, Sort_order, Is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
            Name,
            topup,
            bonus,
            total,
            badge,
            Bg_color || '#f1f8e9',
            Border_color || '#2e7d32',
            Text_color || '#2e7d32',
            Description || `Nạp ${topup.toLocaleString('vi-VN')}đ tặng ${bonus.toLocaleString('vi-VN')}đ`,
            Number(Sort_order || 0)
        );
        db.close();

        res.json({ success: true, packageId: info.lastInsertRowid, message: 'Đã thêm gói nạp ví trả trước thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2.0.2. PUT /api/members/prepaid-packages/:id - Sửa gói nạp ví trả trước
router.put('/prepaid-packages/:id', (req, res) => {
    try {
        const id = req.params.id;
        const {
            Name,
            Topup_amount,
            Bonus_amount,
            Total_received,
            Badge_text,
            Bg_color,
            Border_color,
            Text_color,
            Description,
            Sort_order,
            Is_active
        } = req.body;

        const db = getDb();
        const existing = db.prepare("SELECT * FROM PREPAID_PACKAGES WHERE Package_id = ?").get(id);
        if (!existing) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy gói nạp này!' });
        }

        const topup = Topup_amount !== undefined ? Number(Topup_amount) : existing.Topup_amount;
        const bonus = Bonus_amount !== undefined ? Number(Bonus_amount) : existing.Bonus_amount;
        const total = Total_received !== undefined ? Number(Total_received) : (topup + bonus);

        db.prepare(`
            UPDATE PREPAID_PACKAGES
            SET Name = COALESCE(?, Name),
                Topup_amount = ?,
                Bonus_amount = ?,
                Total_received = ?,
                Badge_text = COALESCE(?, Badge_text),
                Bg_color = COALESCE(?, Bg_color),
                Border_color = COALESCE(?, Border_color),
                Text_color = COALESCE(?, Text_color),
                Description = COALESCE(?, Description),
                Sort_order = COALESCE(?, Sort_order),
                Is_active = COALESCE(?, Is_active),
                Updated_at = datetime('now', 'localtime')
            WHERE Package_id = ?
        `).run(
            Name,
            topup,
            bonus,
            total,
            Badge_text,
            Bg_color,
            Border_color,
            Text_color,
            Description,
            Sort_order,
            Is_active,
            id
        );
        db.close();

        res.json({ success: true, message: 'Đã cập nhật gói nạp ví trả trước thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2.0.3. DELETE /api/members/prepaid-packages/:id - Xóa gói nạp ví trả trước
router.delete('/prepaid-packages/:id', (req, res) => {
    try {
        const id = req.params.id;
        const db = getDb();
        db.prepare("DELETE FROM PREPAID_PACKAGES WHERE Package_id = ?").run(id);
        db.close();
        res.json({ success: true, message: 'Đã xóa gói nạp ví trả trước thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2.1. GET /api/members/tiers - Lấy danh sách toàn bộ hạng thẻ
router.get('/tiers', (req, res) => {
    try {
        const db = getDb();
        const { list } = getTierConfigFromDb(db);
        db.close();
        res.json({ success: true, tiers: list });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2.2. POST /api/members/tiers - Thêm hạng thẻ mới
router.post('/tiers', (req, res) => {
    try {
        const {
            Tier_code,
            Tier_name,
            Badge_title,
            Icon,
            Min_spent = 0,
            Discount_percent = 0,
            Point_rate = 0.03,
            Birthday_reward,
            Color = '#2e7d32',
            Card_bg,
            Text_color = '#ffffff',
            Sort_order = 0,
            Is_default = 0,
            Staff_name = 'Quản Lý'
        } = req.body;

        if (!Tier_name) {
            return res.status(400).json({ success: false, error: 'Vui lòng nhập Tên hạng thẻ!' });
        }

        const rawCode = (Tier_code || Tier_name).trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
        const code = rawCode || `TIER_${Date.now()}`;

        const db = getDb();

        const dup = db.prepare("SELECT Tier_id FROM MEMBER_TIERS WHERE Tier_code = ?").get(code);
        if (dup) {
            db.close();
            return res.status(400).json({ success: false, error: `Mã hạng thẻ '${code}' đã tồn tại! Vui lòng chọn mã khác.` });
        }

        // Nếu đặt Is_default = 1, bỏ default của các hạng khác
        if (Number(Is_default) === 1) {
            db.prepare("UPDATE MEMBER_TIERS SET Is_default = 0").run();
        }

        const stmt = db.prepare(`
            INSERT INTO MEMBER_TIERS (
                Tier_code, Tier_name, Badge_title, Icon, Min_spent, 
                Discount_percent, Point_rate, Birthday_reward, Color, Card_bg, Text_color, Sort_order, Is_default, Is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `);

        const defaultBg = Card_bg || `linear-gradient(135deg, ${Color}, #4caf50)`;
        const info = stmt.run(
            code,
            Tier_name.trim(),
            Badge_title || '',
            Icon || '🪷',
            Number(Min_spent || 0),
            Number(Discount_percent || 0),
            Number(Point_rate || 0.03),
            Birthday_reward || '',
            Color,
            defaultBg,
            Text_color,
            Number(Sort_order || 0),
            Number(Is_default || 0)
        );

        // Ghi nhật ký
        logMemberAction(db, {
            Action_type: 'TIER_CONFIG_CREATE',
            New_tier: code,
            New_value: { Tier_code: code, Tier_name, Min_spent, Discount_percent, Point_rate },
            Reason: `Tạo hạng thẻ mới: [${Tier_name}] (Chi tiêu >= ${Number(Min_spent || 0).toLocaleString()}đ, Giảm ${Discount_percent}%, Tích ${(Number(Point_rate || 0.03) * 100).toFixed(0)}%)`,
            Staff_name
        });

        db.close();

        const io = req.app.get('io');
        if (io) io.emit('tiers_updated');

        res.status(201).json({
            success: true,
            Tier_id: info.lastInsertRowid,
            message: `Đã thêm hạng thẻ [${Tier_name}] thành công!`
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2.3. PUT /api/members/tiers/:id - Cập nhật hạng thẻ
router.put('/tiers/:id', (req, res) => {
    try {
        const tierId = req.params.id;
        const {
            Tier_name,
            Badge_title,
            Icon,
            Min_spent,
            Discount_percent,
            Point_rate,
            Birthday_reward,
            Color,
            Card_bg,
            Text_color,
            Sort_order,
            Is_default,
            Staff_name = 'Quản Lý'
        } = req.body;

        const db = getDb();
        const current = db.prepare("SELECT * FROM MEMBER_TIERS WHERE Tier_id = ?").get(tierId);
        if (!current) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy hạng thẻ này!' });
        }

        if (Number(Is_default) === 1) {
            db.prepare("UPDATE MEMBER_TIERS SET Is_default = 0 WHERE Tier_id != ?").run(tierId);
        }

        db.prepare(`
            UPDATE MEMBER_TIERS 
            SET Tier_name = COALESCE(?, Tier_name),
                Badge_title = COALESCE(?, Badge_title),
                Icon = COALESCE(?, Icon),
                Min_spent = COALESCE(?, Min_spent),
                Discount_percent = COALESCE(?, Discount_percent),
                Point_rate = COALESCE(?, Point_rate),
                Birthday_reward = COALESCE(?, Birthday_reward),
                Color = COALESCE(?, Color),
                Card_bg = COALESCE(?, Card_bg),
                Text_color = COALESCE(?, Text_color),
                Sort_order = COALESCE(?, Sort_order),
                Is_default = COALESCE(?, Is_default),
                Updated_at = datetime('now', 'localtime')
            WHERE Tier_id = ?
        `).run(
            Tier_name ? Tier_name.trim() : current.Tier_name,
            Badge_title !== undefined ? Badge_title : current.Badge_title,
            Icon || current.Icon,
            Min_spent !== undefined ? Number(Min_spent) : current.Min_spent,
            Discount_percent !== undefined ? Number(Discount_percent) : current.Discount_percent,
            Point_rate !== undefined ? Number(Point_rate) : current.Point_rate,
            Birthday_reward !== undefined ? Birthday_reward : current.Birthday_reward,
            Color || current.Color,
            Card_bg || current.Card_bg,
            Text_color || current.Text_color,
            Sort_order !== undefined ? Number(Sort_order) : current.Sort_order,
            Is_default !== undefined ? Number(Is_default) : current.Is_default,
            tierId
        );

        // Ghi nhật ký
        logMemberAction(db, {
            Action_type: 'TIER_CONFIG_UPDATE',
            New_tier: current.Tier_code,
            Old_value: current,
            New_value: { Tier_name, Min_spent, Discount_percent, Point_rate, Birthday_reward },
            Reason: `Cập nhật cấu hình hạng thẻ [${current.Tier_name} -> ${Tier_name || current.Tier_name}]`,
            Staff_name
        });

        db.close();

        const io = req.app.get('io');
        if (io) io.emit('tiers_updated');

        res.json({ success: true, message: `Đã cập nhật hạng thẻ [${Tier_name || current.Tier_name}] thành công!` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2.4. DELETE /api/members/tiers/:id - Xóa hạng thẻ
router.delete('/tiers/:id', (req, res) => {
    try {
        const tierId = req.params.id;
        const db = getDb();
        const tier = db.prepare("SELECT * FROM MEMBER_TIERS WHERE Tier_id = ?").get(tierId);
        if (!tier) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy hạng thẻ này!' });
        }

        // Kiểm tra xem có hội viên nào đang ở hạng này không
        const memCount = db.prepare("SELECT COUNT(*) as count FROM MEMBERS WHERE Current_tier = ?").get(tier.Tier_code).count;
        if (memCount > 0) {
            db.close();
            return res.status(400).json({
                success: false,
                error: `Không thể xóa hạng thẻ "${tier.Tier_name}" vì đang có ${memCount} hội viên thuộc hạng này! Vui lòng chuyển hạng cho các hội viên trước khi xóa.`
            });
        }

        db.prepare("DELETE FROM MEMBER_TIERS WHERE Tier_id = ?").run(tierId);

        // Ghi nhật ký
        logMemberAction(db, {
            Action_type: 'TIER_CONFIG_DELETE',
            Old_tier: tier.Tier_code,
            Old_value: tier,
            Reason: `Xóa hạng thẻ [${tier.Tier_name}] khỏi hệ thống`,
            Staff_name: req.body?.Staff_name || req.query?.Staff_name || 'Quản Lý'
        });

        db.close();

        const io = req.app.get('io');
        if (io) io.emit('tiers_updated');

        res.json({ success: true, message: `Đã xóa hạng thẻ [${tier.Tier_name}] thành công!` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. GET /api/members/lookup - Tra cứu nhanh thành viên theo SĐT hoặc Mã Thẻ QR
router.get('/lookup', (req, res) => {
    try {
        const rawQuery = (req.query.q || req.query.phone || req.query.cardCode || '').trim();
        if (!rawQuery) {
            return res.status(400).json({ success: false, error: 'Vui lòng cung cấp số điện thoại hoặc mã thẻ!' });
        }

        let query = rawQuery;
        let qrPhone = '';
        let qrCode = '';

        if (rawQuery.startsWith('HOASEN-MEM:')) {
            const parts = rawQuery.split(':');
            qrPhone = parts[1] || '';
            qrCode = parts[2] || '';
            query = qrCode || qrPhone || rawQuery;
        } else if (rawQuery.startsWith('{')) {
            try {
                const parsed = JSON.parse(rawQuery);
                qrPhone = parsed.phone || parsed.Phone || '';
                qrCode = parsed.cardCode || parsed.Card_code || '';
                query = qrCode || qrPhone || rawQuery;
            } catch (e) {}
        }

        const db = getDb();
        const cleanPhone = (qrPhone || query).replace(/\D/g, '');

        let member = null;
        if (qrCode) {
            member = db.prepare(`SELECT * FROM MEMBERS WHERE Card_code = ? COLLATE NOCASE OR Phone = ?`).get(qrCode, qrPhone || query);
        }
        if (!member && cleanPhone.length >= 7) {
            member = db.prepare(`
                SELECT * FROM MEMBERS 
                WHERE Phone = ? OR Phone LIKE ? OR Card_code = ? COLLATE NOCASE
            `).get(cleanPhone, `%${cleanPhone}`, query);
        }
        if (!member) {
            member = db.prepare(`
                SELECT * FROM MEMBERS 
                WHERE Card_code = ? COLLATE NOCASE OR Phone = ? OR Member_id = ?
            `).get(query, query, isNaN(Number(query)) ? -1 : Number(query));
        }

        if (!member) {
            db.close();
            return res.json({ success: false, found: false, message: 'Chưa có thông tin thành viên với mã định danh này.' });
        }

        const { map: tierMap } = getTierConfigFromDb(db);
        const tierInfo = tierMap[member.Current_tier] || tierMap.MAM_SEN || DEFAULT_TIER_CONFIG.MAM_SEN;
        const lunarInfo = getTodayLunarInfo(db);
        const birthdayInfo = checkBirthdayStatus(member.Birthdate);

        const actualPointRate = lunarInfo.isDoublePoints ? (tierInfo.pointRate * 2) : tierInfo.pointRate;

        db.close();

        return res.json({
            success: true,
            found: true,
            member: {
                ...member,
                tierInfo: {
                    ...tierInfo,
                    actualPointRate,
                    isDoublePoints: lunarInfo.isDoublePoints
                },
                lunarInfo,
                birthdayInfo
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. GET /api/members - Danh sách thành viên (lọc theo hạng, tìm kiếm)
router.get('/', (req, res) => {
    try {
        const { search, tier, page = 1, limit = 50 } = req.query;
        const db = getDb();
        const { map: tierMap } = getTierConfigFromDb(db);

        let sql = "SELECT * FROM MEMBERS WHERE 1=1";
        const params = [];

        if (tier && tier !== 'ALL') {
            sql += " AND Current_tier = ?";
            params.push(tier);
        }

        if (search) {
            const cleanSearch = `%${search.trim()}%`;
            sql += " AND (Full_name LIKE ? OR Phone LIKE ? OR Card_code LIKE ?)";
            params.push(cleanSearch, cleanSearch, cleanSearch);
        }

        sql += " ORDER BY Total_spent DESC, Member_id DESC LIMIT ? OFFSET ?";
        params.push(Number(limit), (Number(page) - 1) * Number(limit));

        const members = db.prepare(sql).all(...params);

        let countSql = "SELECT COUNT(*) as count FROM MEMBERS WHERE 1=1";
        const countParams = [];
        if (tier && tier !== 'ALL') {
            countSql += " AND Current_tier = ?";
            countParams.push(tier);
        }
        if (search) {
            const cleanSearch = `%${search.trim()}%`;
            countSql += " AND (Full_name LIKE ? OR Phone LIKE ? OR Card_code LIKE ?)";
            countParams.push(cleanSearch, cleanSearch, cleanSearch);
        }
        const total = db.prepare(countSql).get(...countParams).count;

        const formatted = members.map(m => ({
            ...m,
            tierInfo: tierMap[m.Current_tier] || tierMap.MAM_SEN || DEFAULT_TIER_CONFIG.MAM_SEN,
            birthdayInfo: checkBirthdayStatus(m.Birthdate)
        }));

        db.close();

        res.json({
            success: true,
            members: formatted,
            total,
            page: Number(page),
            limit: Number(limit)
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. GET /api/members/stats/overview - Thống kê tổng quan & sinh nhật sắp tới
router.get('/stats/overview', (req, res) => {
    try {
        const db = getDb();
        const { map: tierMap, list: tierList } = getTierConfigFromDb(db);

        const totalMembers = db.prepare("SELECT COUNT(*) as count FROM MEMBERS WHERE Is_active = 1").get().count;
        const totalSpentAll = db.prepare("SELECT SUM(Total_spent) as total FROM MEMBERS").get().total || 0;
        const totalPointsAll = db.prepare("SELECT SUM(Reward_points) as total FROM MEMBERS").get().total || 0;
        const totalPrepaidAll = db.prepare("SELECT SUM(Prepaid_balance) as total FROM MEMBERS").get().total || 0;

        // Phân bố theo từng hạng thẻ động
        const tierCounts = {};
        tierList.forEach(t => {
            const c = db.prepare("SELECT COUNT(*) as c FROM MEMBERS WHERE Current_tier = ?").get(t.Tier_code)?.c || 0;
            tierCounts[t.Tier_code] = c;
        });

        const allWithBday = db.prepare("SELECT Member_id, Full_name, Phone, Current_tier, Birthdate FROM MEMBERS WHERE Birthdate IS NOT NULL AND Birthdate != ''").all();
        const upcomingBirthdays = allWithBday.filter(m => {
            const status = checkBirthdayStatus(m.Birthdate);
            return status.isBirthdaySoon;
        }).map(m => ({
            ...m,
            tierInfo: tierMap[m.Current_tier] || tierMap.MAM_SEN || DEFAULT_TIER_CONFIG.MAM_SEN,
            birthdayInfo: checkBirthdayStatus(m.Birthdate)
        }));

        const lunarToday = getTodayLunarInfo(db);

        db.close();

        res.json({
            success: true,
            totalMembers,
            totalSpentAll,
            totalPointsAll,
            totalPrepaidAll,
            tierCounts,
            upcomingBirthdays,
            lunarToday
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5.5. GET /api/members/logs - Lấy danh sách nhật ký hoạt động hội viên & cấu hình
router.get('/logs', (req, res) => {
    try {
        const { memberId, actionType, page = 1, limit = 50 } = req.query;
        const db = getDb();

        let sql = "SELECT * FROM MEMBER_LOGS WHERE 1=1";
        const params = [];

        if (memberId) {
            sql += " AND Member_id = ?";
            params.push(memberId);
        }
        if (actionType && actionType !== 'ALL') {
            sql += " AND Action_type = ?";
            params.push(actionType);
        }

        sql += " ORDER BY Log_id DESC LIMIT ? OFFSET ?";
        params.push(Number(limit), (Number(page) - 1) * Number(limit));

        const logs = db.prepare(sql).all(...params);

        let countSql = "SELECT COUNT(*) as count FROM MEMBER_LOGS WHERE 1=1";
        const countParams = [];
        if (memberId) {
            countSql += " AND Member_id = ?";
            countParams.push(memberId);
        }
        if (actionType && actionType !== 'ALL') {
            countSql += " AND Action_type = ?";
            countParams.push(actionType);
        }
        const total = db.prepare(countSql).get(...countParams).count;

        db.close();

        res.json({
            success: true,
            logs,
            total,
            page: Number(page),
            limit: Number(limit)
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5.5 GET /api/members/my-card - Tra cứu thẻ của chính khách hàng đã đăng nhập (Bảo mật, không cho xem thẻ người khác)
router.get('/my-card', (req, res) => {
    try {
        const username = (req.query.username || '').trim();
        const userId = req.query.userId || '';
        const db = getDb();
        let member = null;

        if (userId) {
            const numId = isNaN(Number(userId)) ? -1 : Number(userId);
            const u = db.prepare("SELECT * FROM USERS WHERE User_id = ? OR User_id = ?").get(numId, userId);
            if (u && u.Member_id) {
                member = db.prepare("SELECT * FROM MEMBERS WHERE Member_id = ?").get(u.Member_id);
            }
            if (!member && u && u.Phone) {
                member = db.prepare("SELECT * FROM MEMBERS WHERE Phone = ?").get(u.Phone);
            }
        }
        if (!member && username) {
            const u = db.prepare("SELECT * FROM USERS WHERE User_name = ? COLLATE NOCASE").get(username);
            if (u && u.Member_id) {
                member = db.prepare("SELECT * FROM MEMBERS WHERE Member_id = ?").get(u.Member_id);
            }
            if (!member && u && u.Phone) {
                member = db.prepare("SELECT * FROM MEMBERS WHERE Phone = ?").get(u.Phone);
            }
        }
        if (!member && username) {
            member = db.prepare("SELECT * FROM MEMBERS WHERE Phone = ? OR Card_code = ? COLLATE NOCASE").get(username, username);
        }

        if (!member) {
            db.close();
            return res.status(404).json({ success: false, error: 'Chưa liên kết thẻ hội viên cho tài khoản này.' });
        }

        const memberId = member.Member_id;
        const { map: tierMap } = getTierConfigFromDb(db);

        const transactions = db.prepare(`
            SELECT * FROM POINT_TRANSACTIONS 
            WHERE Member_id = ? 
            ORDER BY Transaction_id DESC LIMIT 50
        `).all(memberId);

        const memberLogs = db.prepare(`
            SELECT * FROM MEMBER_LOGS 
            WHERE Member_id = ? 
            ORDER BY Log_id DESC LIMIT 50
        `).all(memberId);

        const recentOrders = db.prepare(`
            SELECT Order_id, Order_code, Table_number, Final_amount, Status, Payment_status, Created_at, Discount_amount, Points_used, Points_earned
            FROM ORDERS 
            WHERE Member_id = ? OR Customer_phone = ? 
            ORDER BY Order_id DESC LIMIT 25
        `).all(memberId, member.Phone);

        const itemsStmt = db.prepare(`
            SELECT Item_name, Quantity, Unit_price, Total_price, Note
            FROM ORDER_DETAILS
            WHERE Order_id = ?
        `);
        for (const ord of recentOrders) {
            ord.items = itemsStmt.all(ord.Order_id);
        }

        db.close();

        return res.json({
            success: true,
            member: {
                ...member,
                tierInfo: tierMap[member.Current_tier] || tierMap.MAM_SEN || DEFAULT_TIER_CONFIG.MAM_SEN,
                birthdayInfo: checkBirthdayStatus(member.Birthdate)
            },
            transactions,
            memberLogs,
            recentOrders
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. GET /api/members/:id - Xem chi tiết hồ sơ & lịch sử giao dịch
router.get('/:id', (req, res) => {
    try {
        const memberId = req.params.id;
        const db = getDb();
        const { map: tierMap } = getTierConfigFromDb(db);

        const member = db.prepare("SELECT * FROM MEMBERS WHERE Member_id = ?").get(memberId);
        if (!member) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy thành viên này!' });
        }

        const transactions = db.prepare(`
            SELECT * FROM POINT_TRANSACTIONS 
            WHERE Member_id = ? 
            ORDER BY Transaction_id DESC LIMIT 50
        `).all(memberId);

        const memberLogs = db.prepare(`
            SELECT * FROM MEMBER_LOGS 
            WHERE Member_id = ? 
            ORDER BY Log_id DESC LIMIT 50
        `).all(memberId);

        const recentOrders = db.prepare(`
            SELECT Order_id, Order_code, Table_number, Final_amount, Status, Payment_status, Created_at, Discount_amount, Points_used, Points_earned
            FROM ORDERS 
            WHERE Member_id = ? OR Customer_phone = ? 
            ORDER BY Order_id DESC LIMIT 15
        `).all(memberId, member.Phone);

        db.close();

        res.json({
            success: true,
            member: {
                ...member,
                tierInfo: tierMap[member.Current_tier] || tierMap.MAM_SEN || DEFAULT_TIER_CONFIG.MAM_SEN,
                birthdayInfo: checkBirthdayStatus(member.Birthdate)
            },
            transactions,
            memberLogs,
            recentOrders
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 7. POST /api/members - Đăng ký thành viên mới (nhanh chóng)
router.post('/', (req, res) => {
    try {
        const { Phone, Full_name, Birthdate, Gender, Notes, Created_by, Email } = req.body;
        if (!Phone || !Full_name) {
            return res.status(400).json({ success: false, error: 'Vui lòng nhập đầy đủ Số điện thoại và Họ tên!' });
        }

        const cleanPhone = Phone.replace(/\D/g, '').trim();
        if (cleanPhone.length < 8) {
            return res.status(400).json({ success: false, error: 'Số điện thoại không hợp lệ!' });
        }

        const db = getDb();
        const existing = db.prepare("SELECT Member_id, Full_name, Phone FROM MEMBERS WHERE Phone = ?").get(cleanPhone);
        if (existing) {
            db.close();
            return res.status(400).json({
                success: false,
                error: `Số điện thoại ${cleanPhone} đã được đăng ký cho thành viên: ${existing.Full_name}!`
            });
        }

        const { list: tierList, map: tierMap } = getTierConfigFromDb(db);
        const defaultTier = tierList.find(t => t.Is_default === 1) || tierList[0] || { Tier_code: 'MAM_SEN' };
        const initialTierCode = defaultTier.Tier_code || 'MAM_SEN';

        const cardCode = 'HS-' + cleanPhone.slice(-6);

        const finalPassword = (req.body.Password && String(req.body.Password).trim()) ? String(req.body.Password).trim() : '123456';
        const cleanEmail = Email ? String(Email).trim() : '';

        const stmt = db.prepare(`
            INSERT INTO MEMBERS (
                Phone, Full_name, Birthdate, Gender, Current_tier, 
                Total_spent, Reward_points, Prepaid_balance, Card_code, Notes, Password, Email
            ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?)
        `);

        const info = stmt.run(cleanPhone, Full_name.trim(), Birthdate || null, Gender || 'OTHER', initialTierCode, cardCode, Notes || '', finalPassword, cleanEmail);
        const newMemberId = info.lastInsertRowid;

        // Tự động tạo / đồng bộ tài khoản USERS cho khách hàng để khách tự đăng nhập
        try {
            const existingUser = db.prepare("SELECT User_id FROM USERS WHERE User_name = ? OR Phone = ?").get(cleanPhone, cleanPhone);
            if (existingUser) {
                db.prepare(`
                    UPDATE USERS 
                    SET User_password = ?, Role = 'CUSTOMER', Member_id = ?, Phone = ?
                    WHERE User_id = ?
                `).run(finalPassword, newMemberId, cleanPhone, existingUser.User_id);
            } else {
                db.prepare(`
                    INSERT INTO USERS (User_name, User_password, Role, Member_id, Phone, Created_at)
                    VALUES (?, ?, 'CUSTOMER', ?, ?, datetime('now', 'localtime'))
                `).run(cleanPhone, finalPassword, newMemberId, cleanPhone);
            }
        } catch (uErr) {
            console.warn('Lỗi đồng bộ USERS cho hội viên:', uErr.message);
        }

        // Ghi transaction khởi tạo
        db.prepare(`
            INSERT INTO POINT_TRANSACTIONS (Member_id, Type, Description, Created_by)
            VALUES (?, 'BONUS', 'Đăng ký thành viên Chay Hoa Sen thành công!', ?)
        `).run(newMemberId, Created_by || 'Hệ thống');

        // Ghi nhật ký khởi tạo
        logMemberAction(db, {
            Member_id: newMemberId,
            Member_name: Full_name.trim(),
            Member_phone: cleanPhone,
            Action_type: 'MEMBER_REGISTER',
            New_tier: initialTierCode,
            Reason: `Đăng ký hội viên mới với hạng khởi tạo [${defaultTier.Tier_name || initialTierCode}]`,
            Staff_name: Created_by || 'Hệ thống'
        });

        const newMember = db.prepare("SELECT * FROM MEMBERS WHERE Member_id = ?").get(newMemberId);
        db.close();

        const io = req.app.get('io');
        if (io) io.emit('member_created', { Member_id: newMemberId, Full_name, Phone: cleanPhone });

        res.status(201).json({
            success: true,
            Member_id: newMemberId,
            message: `Chúc mừng Quý khách ${Full_name} đã gia nhập Hội Viên Hoa Sen!`,
            member: {
                ...newMember,
                tierInfo: tierMap[initialTierCode] || DEFAULT_TIER_CONFIG.MAM_SEN
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8. PUT /api/members/:id - Cập nhật thông tin thành viên
router.put('/:id', (req, res) => {
    try {
        const memberId = req.params.id;
        const { Full_name, Phone, Birthdate, Gender, Notes, Is_active, Staff_name = 'Quản Lý', Password, Email } = req.body;

        const db = getDb();
        const current = db.prepare("SELECT * FROM MEMBERS WHERE Member_id = ?").get(memberId);
        if (!current) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy thành viên này!' });
        }

        let cleanPhone = current.Phone;
        if (Phone) {
            cleanPhone = Phone.replace(/\D/g, '').trim();
            const dup = db.prepare("SELECT Member_id FROM MEMBERS WHERE Phone = ? AND Member_id != ?").get(cleanPhone, memberId);
            if (dup) {
                db.close();
                return res.status(400).json({ success: false, error: 'Số điện thoại này đã thuộc về hội viên khác!' });
            }
        }

        const newPwd = (Password && String(Password).trim()) ? String(Password).trim() : current.Password;
        const newEmail = Email !== undefined ? String(Email).trim() : current.Email;

        db.prepare(`
            UPDATE MEMBERS 
            SET Full_name = COALESCE(?, Full_name),
                Phone = ?,
                Birthdate = ?,
                Gender = COALESCE(?, Gender),
                Notes = COALESCE(?, Notes),
                Is_active = COALESCE(?, Is_active),
                Password = ?,
                Email = ?,
                Updated_at = datetime('now', 'localtime')
            WHERE Member_id = ?
        `).run(
            Full_name ? Full_name.trim() : current.Full_name,
            cleanPhone,
            Birthdate !== undefined ? Birthdate : current.Birthdate,
            Gender || current.Gender,
            Notes !== undefined ? Notes : current.Notes,
            Is_active !== undefined ? Is_active : current.Is_active,
            newPwd,
            newEmail,
            memberId
        );

        if (Password && String(Password).trim()) {
            db.prepare(`
                UPDATE USERS 
                SET User_password = ?, Phone = ?
                WHERE Member_id = ? OR Phone = ? OR User_name = ?
            `).run(newPwd, cleanPhone, memberId, current.Phone, current.Phone);
        }

        logMemberAction(db, {
            Member_id: memberId,
            Member_name: Full_name || current.Full_name,
            Member_phone: cleanPhone,
            Action_type: 'MEMBER_UPDATE',
            Old_value: { name: current.Full_name, phone: current.Phone, birthdate: current.Birthdate },
            New_value: { name: Full_name || current.Full_name, phone: cleanPhone, birthdate: Birthdate },
            Reason: 'Cập nhật thông tin cá nhân hội viên',
            Staff_name
        });

        const updated = db.prepare("SELECT * FROM MEMBERS WHERE Member_id = ?").get(memberId);
        db.close();

        res.json({ success: true, message: 'Đã cập nhật thông tin thành viên thành công!', member: updated });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8.0. POST /api/members/change-password - Khách hàng tự đổi mật khẩu tài khoản
router.post('/change-password', (req, res) => {
    try {
        const { currentPassword, newPassword, username, userId } = req.body;
        if (!newPassword || newPassword.trim().length < 3) {
            return res.status(400).json({ success: false, error: 'Mật khẩu mới phải có ít nhất 3 ký tự!' });
        }
        if (!currentPassword) {
            return res.status(400).json({ success: false, error: 'Vui lòng nhập mật khẩu hiện tại!' });
        }

        const db = getDb();
        let user = null;
        let member = null;

        if (userId) {
            const numId = isNaN(Number(userId)) ? -1 : Number(userId);
            user = db.prepare("SELECT * FROM USERS WHERE User_id = ? OR User_id = ?").get(numId, userId);
        }
        if (!user && username) {
            user = db.prepare("SELECT * FROM USERS WHERE User_name = ? COLLATE NOCASE").get(username);
        }

        if (user && user.Member_id) {
            member = db.prepare("SELECT * FROM MEMBERS WHERE Member_id = ?").get(user.Member_id);
        }
        if (!member && user && user.Phone) {
            member = db.prepare("SELECT * FROM MEMBERS WHERE Phone = ?").get(user.Phone);
        }
        if (!member && username) {
            member = db.prepare("SELECT * FROM MEMBERS WHERE Phone = ? OR Card_code = ?").get(username, username);
        }

        const validPwd = (user && user.User_password === currentPassword) || (member && member.Password === currentPassword);
        if (!validPwd) {
            db.close();
            return res.status(400).json({ success: false, error: 'Mật khẩu hiện tại không chính xác!' });
        }

        const finalNewPwd = newPassword.trim();

        if (user) {
            db.prepare("UPDATE USERS SET User_password = ? WHERE User_id = ?").run(finalNewPwd, user.User_id);
        }
        if (member) {
            db.prepare("UPDATE MEMBERS SET Password = ? WHERE Member_id = ?").run(finalNewPwd, member.Member_id);
            try {
                const existingU = db.prepare("SELECT User_id FROM USERS WHERE Phone = ? OR Member_id = ?").get(member.Phone, member.Member_id);
                if (existingU) {
                    db.prepare("UPDATE USERS SET User_password = ?, Role = 'CUSTOMER', Member_id = ? WHERE User_id = ?").run(finalNewPwd, member.Member_id, existingU.User_id);
                } else {
                    db.prepare("INSERT INTO USERS (User_name, User_password, Role, Member_id, Phone, Created_at) VALUES (?, ?, 'CUSTOMER', ?, ?, datetime('now', 'localtime'))").run(member.Phone, finalNewPwd, member.Member_id, member.Phone);
                }
            } catch (eU) {}
            logMemberAction(db, {
                Member_id: member.Member_id,
                Member_name: member.Full_name,
                Member_phone: member.Phone,
                Action_type: 'PASSWORD_CHANGED',
                Reason: 'Khách hàng tự đổi mật khẩu tài khoản thành công',
                Staff_name: member.Full_name
            });
        }

        db.close();
        return res.json({ success: true, message: 'Đổi mật khẩu thành công! Quý khách vui lòng ghi nhớ mật khẩu mới.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8.1. POST /api/members/:id/change-tier - Quản lý trực tiếp thăng hạng / hạ hạng / đổi hạng cho khách hàng
router.post('/:id/change-tier', (req, res) => {
    try {
        const memberId = req.params.id;
        const newTierCode = req.body.newTierCode || req.body.newTier;
        const reason = req.body.reason;
        const Staff_name = req.body.Staff_name || 'Quản Lý';

        if (!newTierCode) {
            return res.status(400).json({ success: false, error: 'Vui lòng chọn hạng thẻ mới!' });
        }

        const db = getDb();
        const member = db.prepare("SELECT * FROM MEMBERS WHERE Member_id = ?").get(memberId);
        if (!member) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy thành viên này!' });
        }

        const { map: tierMap, list: tierList } = getTierConfigFromDb(db);
        const targetTier = tierMap[newTierCode] || tierList.find(t => t.Tier_code === newTierCode);
        if (!targetTier) {
            db.close();
            return res.status(400).json({ success: false, error: `Hạng thẻ '${newTierCode}' không tồn tại trong hệ thống!` });
        }

        const oldTierCode = member.Current_tier;
        const oldTierName = tierMap[oldTierCode]?.name || oldTierCode;
        const newTierName = targetTier.name || targetTier.Tier_name || newTierCode;

        db.prepare(`
            UPDATE MEMBERS 
            SET Current_tier = ?, 
                Tier_expiry = datetime('now', '+12 months', 'localtime'),
                Updated_at = datetime('now', 'localtime')
            WHERE Member_id = ?
        `).run(newTierCode, memberId);

        // Ghi nhật ký biến động hạng
        logMemberAction(db, {
            Member_id: memberId,
            Member_name: member.Full_name,
            Member_phone: member.Phone,
            Action_type: 'TIER_MANUAL_CHANGE',
            Old_tier: oldTierCode,
            New_tier: newTierCode,
            Old_value: { tierCode: oldTierCode, tierName: oldTierName },
            New_value: { tierCode: newTierCode, tierName: newTierName },
            Reason: reason || `Quản lý trực tiếp chuyển hạng thẻ [${oldTierName}] -> [${newTierName}]`,
            Staff_name
        });

        const updated = db.prepare("SELECT * FROM MEMBERS WHERE Member_id = ?").get(memberId);
        db.close();

        const io = req.app.get('io');
        if (io) {
            io.emit('member_tier_upgraded', {
                Member_id: memberId,
                Full_name: member.Full_name,
                Old_tier: oldTierCode,
                New_tier: newTierCode,
                New_tier_name: newTierName,
                isManual: true,
                reason: reason || ''
            });
            io.emit('member_balance_updated', {
                Member_id: memberId,
                Current_tier: newTierCode
            });
        }

        res.json({
            success: true,
            message: `Đã chuyển đổi hạng thẻ cho Quý khách ${member.Full_name} sang [${newTierName}] thành công!`,
            member: {
                ...updated,
                tierInfo: targetTier
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8.2. POST /api/members/:id/adjust-spent - Quản lý điều chỉnh chi tiêu tích lũy (+ / -) & tự động xét lại hạng
router.post('/:id/adjust-spent', (req, res) => {
    try {
        const memberId = req.params.id;
        const { spentDelta, reason, Staff_name = 'Quản Lý' } = req.body;
        const delta = Number(spentDelta || 0);

        if (isNaN(delta) || delta === 0) {
            return res.status(400).json({ success: false, error: 'Số tiền chi tiêu điều chỉnh không hợp lệ!' });
        }

        const db = getDb();
        const member = db.prepare("SELECT * FROM MEMBERS WHERE Member_id = ?").get(memberId);
        if (!member) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy thành viên này!' });
        }

        const oldSpent = Number(member.Total_spent || 0);
        const newSpent = Math.max(0, oldSpent + delta);

        // Tự động xét lại hạng thẻ theo chi tiêu mới
        const newTier = calculateTierBySpent(newSpent, db);
        const hasTierChanged = (newTier !== member.Current_tier);

        db.prepare(`
            UPDATE MEMBERS 
            SET Total_spent = ?,
                Current_tier = ?,
                Updated_at = datetime('now', 'localtime')
            WHERE Member_id = ?
        `).run(newSpent, newTier, memberId);

        // Ghi nhật ký điều chỉnh chi tiêu
        logMemberAction(db, {
            Member_id: memberId,
            Member_name: member.Full_name,
            Member_phone: member.Phone,
            Action_type: 'SPENT_ADJUST',
            Old_tier: member.Current_tier,
            New_tier: newTier,
            Old_value: oldSpent,
            New_value: newSpent,
            Reason: `Điều chỉnh chi tiêu ${delta > 0 ? ('+' + delta.toLocaleString('vi-VN') + 'đ') : (delta.toLocaleString('vi-VN') + 'đ')}. Lý do: ${reason || 'Quản lý điều chỉnh'}${hasTierChanged ? ` (Đổi hạng -> ${newTier})` : ''}`,
            Staff_name
        });

        const { map: tierMap } = getTierConfigFromDb(db);
        const updated = db.prepare("SELECT * FROM MEMBERS WHERE Member_id = ?").get(memberId);
        db.close();

        const io = req.app.get('io');
        if (io) {
            io.emit('member_balance_updated', {
                Member_id: memberId,
                Total_spent: newSpent,
                Current_tier: newTier
            });
            if (hasTierChanged) {
                io.emit('member_tier_upgraded', {
                    Member_id: memberId,
                    Full_name: member.Full_name,
                    Old_tier: member.Current_tier,
                    New_tier: newTier,
                    New_tier_name: tierMap[newTier]?.name || newTier
                });
            }
        }

        res.json({
            success: true,
            message: `Đã cập nhật chi tiêu tích lũy: ${newSpent.toLocaleString('vi-VN')}đ ${hasTierChanged ? `(Hạng thẻ mới: ${tierMap[newTier]?.name || newTier})` : ''}`,
            newSpent,
            newTier,
            hasTierChanged,
            member: updated
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8.3. POST /api/members/batch-reevaluate-tiers - Quét & xét duyệt lại hạng thẻ cho toàn bộ hội viên theo chi tiêu tích lũy
router.post('/batch-reevaluate-tiers', (req, res) => {
    try {
        const { Staff_name = 'Quản Lý' } = req.body;
        const db = getDb();
        const { map: tierMap } = getTierConfigFromDb(db);

        const allMembers = db.prepare("SELECT Member_id, Full_name, Phone, Total_spent, Current_tier FROM MEMBERS WHERE Is_active = 1").all();
        let upgradedCount = 0;
        let downgradedCount = 0;
        const changes = [];

        const updateStmt = db.prepare("UPDATE MEMBERS SET Current_tier = ?, Updated_at = datetime('now', 'localtime') WHERE Member_id = ?");

        const tx = db.transaction((members) => {
            for (const m of members) {
                const targetTier = calculateTierBySpent(m.Total_spent, db);
                if (targetTier !== m.Current_tier) {
                    updateStmt.run(targetTier, m.Member_id);
                    const oldTierName = tierMap[m.Current_tier]?.name || m.Current_tier;
                    const newTierName = tierMap[targetTier]?.name || targetTier;

                    const isUp = (tierMap[targetTier]?.minSpent || 0) >= (tierMap[m.Current_tier]?.minSpent || 0);
                    if (isUp) upgradedCount++; else downgradedCount++;

                    logMemberAction(db, {
                        Member_id: m.Member_id,
                        Member_name: m.Full_name,
                        Member_phone: m.Phone,
                        Action_type: 'BATCH_EVALUATE',
                        Old_tier: m.Current_tier,
                        New_tier: targetTier,
                        Reason: `Quét tự động đồng bộ hạng: [${oldTierName}] -> [${newTierName}] (Chi tiêu: ${Number(m.Total_spent || 0).toLocaleString()}đ)`,
                        Staff_name
                    });

                    changes.push({
                        Member_id: m.Member_id,
                        Full_name: m.Full_name,
                        oldTier: m.Current_tier,
                        newTier: targetTier,
                        oldTierName,
                        newTierName
                    });
                }
            }
        });

        tx(allMembers);
        db.close();

        const io = req.app.get('io');
        if (io && changes.length > 0) {
            io.emit('member_created'); // Trigger reload all list
        }

        res.json({
            success: true,
            totalEvaluated: allMembers.length,
            totalChanged: changes.length,
            upgradedCount,
            downgradedCount,
            changes,
            message: `Đã quét xét duyệt ${allMembers.length} hội viên: Có ${changes.length} hội viên được cập nhật lại hạng (${upgradedCount} thăng hạng, ${downgradedCount} giảm hạng).`
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 9. POST /api/members/:id/topup-prepaid - Nạp tiền vào ví trả trước (Prepaid)
router.post('/:id/topup-prepaid', (req, res) => {
    try {
        const memberId = req.params.id;
        const { packageId, packageKey, customAmount, cashAmount, customBonus, paymentMethod, Staff_name, staffUsername } = req.body;

        let topup = 0;
        let bonus = 0;
        let packageName = 'Gói tùy chỉnh';

        const db = getDb();
        const pId = packageId || (packageKey === 'AN_LAC' ? 1 : (packageKey === 'TINH_TAN' ? 2 : (packageKey === 'HY_XA' ? 3 : null)));
        if (pId) {
            const allPkgs = getPrepaidPackagesFromDb(db, true);
            const pkg = allPkgs.find(p => p.id === Number(pId));
            if (pkg) {
                topup = pkg.topupAmount;
                bonus = pkg.bonusAmount;
                packageName = pkg.name;
            }
        } else if (customAmount || cashAmount) {
            topup = Number(customAmount || cashAmount);
            bonus = Number(customBonus || 0);
        }

        if (topup <= 0) {
            db.close();
            return res.status(400).json({ success: false, error: 'Số tiền nạp phải lớn hơn 0đ!' });
        }

        const totalAdd = topup + bonus;

        const member = db.prepare("SELECT * FROM MEMBERS WHERE Member_id = ?").get(memberId);
        if (!member) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy thành viên này!' });
        }

        const newBalance = Number(member.Prepaid_balance || 0) + totalAdd;

        db.prepare(`
            UPDATE MEMBERS 
            SET Prepaid_balance = ?, Updated_at = datetime('now', 'localtime') 
            WHERE Member_id = ?
        `).run(newBalance, memberId);

        // Ghi transaction lịch sử nạp ví
        db.prepare(`
            INSERT INTO POINT_TRANSACTIONS (
                Member_id, Prepaid_added, Amount_applied, Type, Description, Created_by
            ) VALUES (?, ?, ?, 'PREPAID_TOPUP', ?, ?)
        `).run(
            memberId,
            totalAdd,
            topup,
            `Nạp ${packageName}: Nạp ${topup.toLocaleString('vi-VN')}đ + Tặng ${bonus.toLocaleString('vi-VN')}đ (${paymentMethod || 'Tiền mặt'})`,
            Staff_name || staffUsername || 'Thu Ngân'
        );

        // Ghi nhật ký
        logMemberAction(db, {
            Member_id: memberId,
            Member_name: member.Full_name,
            Member_phone: member.Phone,
            Action_type: 'PREPAID_TOPUP',
            Old_value: member.Prepaid_balance,
            New_value: newBalance,
            Reason: `Nạp ví trả trước ${totalAdd.toLocaleString('vi-VN')}đ (${packageName})`,
            Staff_name: Staff_name || staffUsername || 'Thu Ngân'
        });

        db.close();

        const io = req.app.get('io');
        if (io) io.emit('member_balance_updated', { Member_id: memberId, Prepaid_balance: newBalance });

        res.json({
            success: true,
            message: `Nạp thành công ${totalAdd.toLocaleString('vi-VN')}đ vào ví trả trước cho ${member.Full_name}!`,
            newBalance: newBalance,
            Prepaid_balance: newBalance,
            topupAmount: topup,
            bonusAmount: bonus
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 10. POST /api/members/:id/adjust-points - Điều chỉnh điểm thưởng thủ công
router.post('/:id/adjust-points', (req, res) => {
    try {
        const memberId = req.params.id;
        const { pointsDelta, reason, Staff_name } = req.body;
        const delta = parseInt(pointsDelta, 10);

        if (isNaN(delta) || delta === 0) {
            return res.status(400).json({ success: false, error: 'Số điểm điều chỉnh không hợp lệ!' });
        }

        const db = getDb();
        const member = db.prepare("SELECT * FROM MEMBERS WHERE Member_id = ?").get(memberId);
        if (!member) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy thành viên!' });
        }

        const newPoints = Math.max(0, Number(member.Reward_points || 0) + delta);

        db.prepare(`
            UPDATE MEMBERS 
            SET Reward_points = ?, Updated_at = datetime('now', 'localtime') 
            WHERE Member_id = ?
        `).run(newPoints, memberId);

        db.prepare(`
            INSERT INTO POINT_TRANSACTIONS (
                Member_id, Points_added, Points_used, Type, Description, Created_by
            ) VALUES (?, ?, ?, 'MANUAL_ADJUST', ?, ?)
        `).run(
            memberId,
            delta > 0 ? delta : 0,
            delta < 0 ? Math.abs(delta) : 0,
            `Quản lý điều chỉnh điểm: ${reason || 'Bù điểm dịch vụ'}`,
            Staff_name || req.body.staffUsername || 'Quản Lý'
        );

        // Ghi nhật ký
        logMemberAction(db, {
            Member_id: memberId,
            Member_name: member.Full_name,
            Member_phone: member.Phone,
            Action_type: 'POINTS_ADJUST',
            Old_value: member.Reward_points,
            New_value: newPoints,
            Reason: `Điều chỉnh ${delta > 0 ? ('+' + delta) : delta} điểm. Lý do: ${reason || 'Quản lý điều chỉnh'}`,
            Staff_name: Staff_name || req.body.staffUsername || 'Quản Lý'
        });

        db.close();

        const io = req.app.get('io');
        if (io) io.emit('member_balance_updated', { Member_id: memberId, Reward_points: newPoints });

        res.json({
            success: true,
            message: `Đã điều chỉnh ${delta > 0 ? ('+' + delta) : delta} điểm cho thành viên!`,
            newPoints: newPoints,
            Reward_points: newPoints
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 11. POST /api/members/apply-order-loyalty - Tính toán & chốt điểm / chiết khấu khi thanh toán đơn
router.post('/apply-order-loyalty', (req, res) => {
    try {
        const {
            Member_id,
            Order_id,
            Order_code,
            Bill_amount,
            Points_to_use = 0,
            Use_prepaid = false,
            Staff_name
        } = req.body;

        if (!Member_id) {
            return res.status(400).json({ success: false, error: 'Thiếu Member_id!' });
        }

        const db = getDb();
        const member = db.prepare("SELECT * FROM MEMBERS WHERE Member_id = ?").get(Member_id);
        if (!member) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy thành viên!' });
        }

        const { map: tierMap } = getTierConfigFromDb(db);
        const tierInfo = tierMap[member.Current_tier] || tierMap.MAM_SEN || DEFAULT_TIER_CONFIG.MAM_SEN;
        const lunarInfo = getTodayLunarInfo(db);
        const actualPointRate = lunarInfo.isDoublePoints ? (tierInfo.pointRate * 2) : tierInfo.pointRate;

        const subtotal = Number(Bill_amount || 0);

        // 1. Chiết khấu theo hạng thẻ
        const discountPercent = tierInfo.discountPercent || 0;
        const discountAmount = Math.round(subtotal * (discountPercent / 100));
        let amountAfterDiscount = Math.max(0, subtotal - discountAmount);

        // 2. Dùng điểm thưởng (1 điểm = 1.000đ)
        const maxPointsCanUse = Math.min(member.Reward_points || 0, Math.floor(amountAfterDiscount / 1000));
        const actualPointsUsed = Math.min(Number(Points_to_use || 0), maxPointsCanUse);
        const pointsAmount = actualPointsUsed * 1000;
        let amountAfterPoints = Math.max(0, amountAfterDiscount - pointsAmount);

        // 3. Dùng ví trả trước nếu được chọn
        let prepaidUsed = 0;
        if (Use_prepaid && (member.Prepaid_balance > 0)) {
            prepaidUsed = Math.min(member.Prepaid_balance, amountAfterPoints);
            amountAfterPoints = Math.max(0, amountAfterPoints - prepaidUsed);
        }

        // 4. Điểm tích lũy được cộng từ đơn hàng này (tính trên số tiền thực trả sau chiết khấu)
        const pointsEarned = Math.floor((amountAfterDiscount * actualPointRate) / 1000);

        // Cập nhật CSDL thành viên
        const newRewardPoints = (member.Reward_points - actualPointsUsed) + pointsEarned;
        const newPrepaidBalance = Math.max(0, (member.Prepaid_balance || 0) - prepaidUsed);
        const newTotalSpent = Number(member.Total_spent || 0) + amountAfterDiscount;

        // Xét thăng hạng tự động theo CSDL MEMBER_TIERS
        const newTier = calculateTierBySpent(newTotalSpent, db);
        const hasUpgraded = (newTier !== member.Current_tier);

        db.prepare(`
            UPDATE MEMBERS 
            SET Reward_points = ?,
                Prepaid_balance = ?,
                Total_spent = ?,
                Current_tier = ?,
                Tier_expiry = datetime('now', '+12 months', 'localtime'),
                Updated_at = datetime('now', 'localtime')
            WHERE Member_id = ?
        `).run(newRewardPoints, newPrepaidBalance, newTotalSpent, newTier, Member_id);

        if (actualPointsUsed > 0) {
            db.prepare(`
                INSERT INTO POINT_TRANSACTIONS (Member_id, Order_id, Order_code, Points_used, Amount_applied, Type, Description, Created_by)
                VALUES (?, ?, ?, ?, ?, 'REDEEM', ?, ?)
            `).run(Member_id, Order_id || null, Order_code || '', actualPointsUsed, pointsAmount, `Trừ ${actualPointsUsed} điểm thanh toán đơn #${Order_code || ''}`, Staff_name || 'Thu Ngân');
        }

        if (pointsEarned > 0) {
            const doubleMsg = lunarInfo.isDoublePoints ? ' (Ưu đãi x2 Ngày Chay Âm Lịch)' : '';
            db.prepare(`
                INSERT INTO POINT_TRANSACTIONS (Member_id, Order_id, Order_code, Points_added, Amount_applied, Type, Description, Created_by)
                VALUES (?, ?, ?, ?, ?, 'EARN', ?, ?)
            `).run(Member_id, Order_id || null, Order_code || '', pointsEarned, Math.round(amountAfterDiscount), `Tích +${pointsEarned} điểm từ đơn #${Order_code || ''}${doubleMsg}`, Staff_name || 'Thu Ngân');
        }

        if (prepaidUsed > 0) {
            db.prepare(`
                INSERT INTO POINT_TRANSACTIONS (Member_id, Order_id, Order_code, Prepaid_used, Amount_applied, Type, Description, Created_by)
                VALUES (?, ?, ?, ?, ?, 'PREPAID_PAY', ?, ?)
            `).run(Member_id, Order_id || null, Order_code || '', prepaidUsed, prepaidUsed, `Thanh toán ${prepaidUsed.toLocaleString('vi-VN')}đ từ Ví Trả Trước đơn #${Order_code || ''}`, Staff_name || 'Thu Ngân');
        }

        if (hasUpgraded) {
            logMemberAction(db, {
                Member_id,
                Member_name: member.Full_name,
                Member_phone: member.Phone,
                Action_type: 'TIER_UPGRADE_AUTO',
                Old_tier: member.Current_tier,
                New_tier: newTier,
                Reason: `Tự động thăng hạng lên [${tierMap[newTier]?.name || newTier}] khi hoàn tất đơn #${Order_code || ''} (Chi tiêu tích lũy: ${newTotalSpent.toLocaleString('vi-VN')}đ)`,
                Staff_name: Staff_name || 'Hệ thống'
            });
        }

        db.close();

        const io = req.app.get('io');
        if (io && hasUpgraded) {
            io.emit('member_tier_upgraded', {
                Member_id,
                Full_name: member.Full_name,
                Old_tier: member.Current_tier,
                New_tier: newTier,
                New_tier_name: tierMap[newTier]?.name || newTier
            });
        }

        res.json({
            success: true,
            summary: {
                subtotal,
                discountPercent,
                discountAmount,
                actualPointsUsed,
                pointsAmount,
                prepaidUsed,
                finalCashToPay: amountAfterPoints,
                pointsEarned,
                newRewardPoints,
                newPrepaidBalance,
                newTotalSpent,
                oldTier: member.Current_tier,
                newTier,
                hasUpgraded,
                isDoublePoints: lunarInfo.isDoublePoints
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 12. DELETE /api/members/:id - Khóa / Xóa thành viên
router.delete('/:id', (req, res) => {
    try {
        const memberId = req.params.id;
        const db = getDb();
        const member = db.prepare("SELECT * FROM MEMBERS WHERE Member_id = ?").get(memberId);
        if (member) {
            logMemberAction(db, {
                Member_id: memberId,
                Member_name: member.Full_name,
                Member_phone: member.Phone,
                Action_type: 'MEMBER_DELETE',
                Old_tier: member.Current_tier,
                Reason: `Xóa hội viên ${member.Full_name} (${member.Phone}) khỏi hệ thống`,
                Staff_name: req.body?.Staff_name || req.query?.Staff_name || 'Quản Lý'
            });
        }
        db.prepare("DELETE FROM POINT_TRANSACTIONS WHERE Member_id = ?").run(memberId);
        db.prepare("DELETE FROM MEMBERS WHERE Member_id = ?").run(memberId);
        db.close();

        res.json({ success: true, message: 'Đã xóa hội viên thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 13. Helper xử lý tích điểm & thăng hạng tự động khi tạo đơn / thanh toán đơn hàng
function processOrderLoyalty(db, orderIdentifier, staffName = 'Thu Ngân', io = null) {
    try {
        let order = db.prepare(`
            SELECT * FROM ORDERS 
            WHERE Order_id = ? OR Order_code = ?
        `).get(orderIdentifier, orderIdentifier);

        if (!order) {
            const cleanId = String(orderIdentifier).replace(/^#/, '').trim();
            order = db.prepare(`
                SELECT * FROM ORDERS 
                WHERE Order_id = ? OR Order_code = ? OR Order_code LIKE ?
            `).get(cleanId, cleanId, `%${cleanId}%`);
        }

        if (!order) return null;

        let member = null;
        if (order.Member_id) {
            member = db.prepare("SELECT * FROM MEMBERS WHERE Member_id = ?").get(order.Member_id);
        }
        if (!member && order.Member_phone) {
            const cleanPhone = String(order.Member_phone).replace(/\D/g, '');
            if (cleanPhone.length >= 7) {
                member = db.prepare("SELECT * FROM MEMBERS WHERE Phone = ? OR Phone LIKE ?").get(cleanPhone, `%${cleanPhone}`);
            }
        }

        if (!member) return null;

        if (!order.Member_id && member.Member_id) {
            db.prepare("UPDATE ORDERS SET Member_id = ? WHERE Order_id = ?").run(member.Member_id, order.Order_id);
            order.Member_id = member.Member_id;
        }

        const alreadyDone = db.prepare(`
            SELECT Transaction_id FROM POINT_TRANSACTIONS 
            WHERE Member_id = ? AND (Order_id = ? OR Order_code = ?) AND Type IN ('EARN', 'REDEEM', 'PREPAID_PAY')
        `).get(member.Member_id, order.Order_id, order.Order_code);

        if (alreadyDone) {
            return null;
        }

        const { map: tierMap } = getTierConfigFromDb(db);
        const lunarInfo = getTodayLunarInfo(db);
        const tierInfo = tierMap[member.Current_tier] || tierMap.MAM_SEN || DEFAULT_TIER_CONFIG.MAM_SEN;
        const actualPointRate = lunarInfo.isDoublePoints ? (tierInfo.pointRate * 2) : tierInfo.pointRate;

        const finalAmount = Number(order.Final_amount || 0);
        const pointsUsed = Number(order.Points_used || 0);
        const prepaidUsed = Number(order.Prepaid_used || 0);
        const pointsAmount = Number(order.Points_amount || (pointsUsed * 1000));
        const spendingIncrease = finalAmount + prepaidUsed;

        let pointsEarned = Number(order.Points_earned || 0);
        if (pointsEarned <= 0 && spendingIncrease > 0) {
            pointsEarned = Math.floor((spendingIncrease * actualPointRate) / 1000);
        }

        const newRewardPoints = Math.max(0, (member.Reward_points - pointsUsed) + pointsEarned);
        const newPrepaidBalance = Math.max(0, (member.Prepaid_balance || 0) - prepaidUsed);
        const newTotalSpent = Number(member.Total_spent || 0) + spendingIncrease;

        const newTier = calculateTierBySpent(newTotalSpent, db);
        const hasUpgraded = (newTier !== member.Current_tier);

        db.prepare(`
            UPDATE MEMBERS 
            SET Reward_points = ?,
                Prepaid_balance = ?,
                Total_spent = ?,
                Current_tier = ?,
                Tier_expiry = datetime('now', '+12 months', 'localtime'),
                Updated_at = datetime('now', 'localtime')
            WHERE Member_id = ?
        `).run(newRewardPoints, newPrepaidBalance, newTotalSpent, newTier, member.Member_id);

        if (pointsUsed > 0) {
            db.prepare(`
                INSERT INTO POINT_TRANSACTIONS (Member_id, Order_id, Order_code, Points_used, Amount_applied, Type, Description, Created_by)
                VALUES (?, ?, ?, ?, ?, 'REDEEM', ?, ?)
            `).run(member.Member_id, order.Order_id, order.Order_code, pointsUsed, pointsAmount, `Trừ ${pointsUsed} điểm khi thanh toán đơn #${order.Order_code}`, staffName);
        }

        if (pointsEarned > 0) {
            const doubleMsg = lunarInfo.isDoublePoints ? ' (Ưu đãi x2 Ngày Chay Âm Lịch)' : '';
            db.prepare(`
                INSERT INTO POINT_TRANSACTIONS (Member_id, Order_id, Order_code, Points_added, Amount_applied, Type, Description, Created_by)
                VALUES (?, ?, ?, ?, ?, 'EARN', ?, ?)
            `).run(member.Member_id, order.Order_id, order.Order_code, pointsEarned, Math.round(finalAmount), `Tích +${pointsEarned} điểm từ đơn #${order.Order_code}${doubleMsg}`, staffName);
        }

        if (prepaidUsed > 0) {
            db.prepare(`
                INSERT INTO POINT_TRANSACTIONS (Member_id, Order_id, Order_code, Prepaid_used, Amount_applied, Type, Description, Created_by)
                VALUES (?, ?, ?, ?, ?, 'PREPAID_PAY', ?, ?)
            `).run(member.Member_id, order.Order_id, order.Order_code, prepaidUsed, prepaidUsed, `Thanh toán ${prepaidUsed.toLocaleString('vi-VN')}đ từ Ví Trả Trước đơn #${order.Order_code}`, staffName);
        }

        if (hasUpgraded) {
            logMemberAction(db, {
                Member_id: member.Member_id,
                Member_name: member.Full_name,
                Member_phone: member.Phone,
                Action_type: 'TIER_UPGRADE_AUTO',
                Old_tier: member.Current_tier,
                New_tier: newTier,
                Reason: `Tự động thăng hạng lên [${tierMap[newTier]?.name || newTier}] khi hoàn tất đơn #${order.Order_code} (Chi tiêu tích lũy: ${newTotalSpent.toLocaleString('vi-VN')}đ)`,
                Staff_name: staffName
            });
        }

        db.prepare(`
            UPDATE ORDERS 
            SET Points_earned = ?, Member_tier = ?
            WHERE Order_id = ? OR Order_code = ?
        `).run(pointsEarned, newTier, order.Order_id, order.Order_code);

        if (io) {
            io.emit('member_balance_updated', {
                Member_id: member.Member_id,
                Reward_points: newRewardPoints,
                Prepaid_balance: newPrepaidBalance,
                Total_spent: newTotalSpent,
                Current_tier: newTier
            });

            if (hasUpgraded) {
                io.emit('member_tier_upgraded', {
                    Member_id: member.Member_id,
                    Full_name: member.Full_name,
                    Old_tier: member.Current_tier,
                    New_tier: newTier,
                    New_tier_name: tierMap[newTier]?.name || newTier
                });
            }
        }

        return {
            memberId: member.Member_id,
            pointsEarned,
            pointsUsed,
            prepaidUsed,
            newRewardPoints,
            newPrepaidBalance,
            newTotalSpent,
            newTier,
            hasUpgraded
        };
    } catch (err) {
        console.error('Lỗi processOrderLoyalty:', err.message);
        return null;
    }
}

module.exports = router;
module.exports.DEFAULT_TIER_CONFIG = DEFAULT_TIER_CONFIG;
module.exports.getTierConfigFromDb = getTierConfigFromDb;
module.exports.getTodayLunarInfo = getTodayLunarInfo;
module.exports.convertSolar2Lunar = convertSolar2Lunar;
module.exports.calculateTierBySpent = calculateTierBySpent;
module.exports.checkBirthdayStatus = checkBirthdayStatus;
module.exports.processOrderLoyalty = processOrderLoyalty;
module.exports.logMemberAction = logMemberAction;
