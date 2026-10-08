const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');
const nodemailer = require('nodemailer');
const DB_PATH = path.join(__dirname, '../database.db');

function getDb() {
    return new Database(DB_PATH);
}

// Đảm bảo bảng MARKETING_EMAIL_LOGS tồn tại
function ensureMarketingEmailLogsTable(db) {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS MARKETING_EMAIL_LOGS (
                Log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Campaign_id INTEGER,
                Campaign_name TEXT,
                Voucher_code TEXT,
                Member_id INTEGER,
                Member_name TEXT,
                Email TEXT NOT NULL,
                Phone TEXT,
                Subject TEXT,
                Discount_text TEXT,
                Status TEXT DEFAULT 'SUCCESS',
                Error_message TEXT,
                Sent_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);
    } catch (e) {
        console.error('Lỗi khởi tạo bảng MARKETING_EMAIL_LOGS:', e.message);
    }
}

// Đọc thông tin cấu hình SMTP từ SYSTEM_CONFIG
function getSmtpConfig(db) {
    const rows = db.prepare("SELECT Key, Value FROM SYSTEM_CONFIG WHERE Key LIKE 'smtp_%'").all();
    const config = {};
    rows.forEach(r => {
        try { config[r.Key] = JSON.parse(r.Value); } catch(e) { config[r.Key] = r.Value; }
    });

    const host = (config.smtp_host || 'smtp.gmail.com').trim();
    const port = Number(config.smtp_port) || 465;
    const user = (config.smtp_user || '').trim();
    const pass = (config.smtp_pass || '').replace(/\s+/g, '').trim(); // Loại bỏ khoảng cách nếu copy Google App Password
    const secure = (config.smtp_secure !== undefined) ? (config.smtp_secure === 1 || config.smtp_secure === '1' || config.smtp_secure === true) : (port === 465);
    const fromName = (config.smtp_from_name || 'Nhà Hàng Hoa Sen').trim();

    return { host, port, user, pass, secure, fromName };
}

// Tạo transporter nodemailer
function createTransporter(smtpConfig) {
    if (!smtpConfig || !smtpConfig.user || !smtpConfig.pass) {
        return null;
    }
    return nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass
        },
        tls: {
            rejectUnauthorized: false
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000
    });
}

// Xây dựng nội dung HTML email gửi voucher đẹp mắt
function buildVoucherEmailHtml({ memberName, campaignTitle, voucherCode, discountText, minOrderText, expiryDateFormatted, customMessage, fromName }) {
    return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <!-- HEADER -->
        <div style="background: linear-gradient(135deg, #1e7e34 0%, #155724 100%); padding: 30px 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 1px;">🌸 ${fromName || 'NHÀ HÀNG HOA SEN'}</h1>
            <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; font-weight: 500;">Món Quà Tri Ân & Mã Ưu Đãi Độc Quyền Dành Riêng Cho Quý Khách</p>
        </div>

        <!-- BODY -->
        <div style="padding: 30px 25px; background: #ffffff;">
            <p style="font-size: 16px; color: #334155; margin-top: 0;">Xin chào <b>${memberName || 'Quý khách'}</b>,</p>
            <p style="font-size: 15px; color: #475569; line-height: 1.6;">
                ${customMessage ? customMessage.replace(/\n/g, '<br>') : `Nhà Hàng Hoa Sen xin gửi tặng Quý khách mã giảm giá độc quyền từ chương trình <b>"${campaignTitle}"</b>. Quý khách có thể sử dụng khi dùng bữa tại nhà hàng hoặc đặt món trực tuyến!` }
            </p>

            <!-- VOUCHER CARD BOX -->
            <div style="margin: 25px 0; background: #fffdf5; border: 2px dashed #f59e0b; border-radius: 14px; padding: 22px; text-align: center; position: relative;">
                <div style="display: inline-block; background: #f59e0b; color: white; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; margin-bottom: 10px;">
                    MÃ GIẢM GIÁ ĐỘC QUYỀN
                </div>
                <div style="font-size: 24px; font-weight: 800; color: #b45309; margin-bottom: 6px;">
                    ${discountText}
                </div>
                <div style="font-size: 13px; color: #78350f; margin-bottom: 16px;">
                    ${campaignTitle}
                </div>

                <!-- CODE DISPLAY -->
                <div style="background: #ffffff; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; display: inline-block; min-width: 220px; margin-bottom: 12px; box-shadow: 0 2px 5px rgba(245,158,11,0.1);">
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 22px; font-weight: 900; letter-spacing: 3px; color: #d97706;">
                        ${voucherCode}
                    </span>
                </div>
                <div style="font-size: 12px; color: #92400e;">
                    <i>(Quý khách sao chép mã này hoặc báo với thu ngân/phục vụ khi thanh toán)</i>
                </div>
            </div>

            <!-- DETAILS TABLE -->
            <div style="background: #f1f5f9; border-radius: 10px; padding: 16px; margin-bottom: 25px; font-size: 13px; color: #475569;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px 0; font-weight: 600; width: 140px;">⏱️ Hạn sử dụng:</td>
                        <td style="padding: 5px 0; color: #dc2626; font-weight: bold;">${expiryDateFormatted || '30 ngày kể từ ngày nhận'}</td>
                    </tr>
                    ${minOrderText ? `
                    <tr>
                        <td style="padding: 5px 0; font-weight: 600;">💰 Đơn tối thiểu:</td>
                        <td style="padding: 5px 0;">${minOrderText}</td>
                    </tr>` : ''}
                    <tr>
                        <td style="padding: 5px 0; font-weight: 600;">📍 Áp dụng:</td>
                        <td style="padding: 5px 0;">Dùng tại bàn & Đặt món mang về</td>
                    </tr>
                </table>
            </div>

            <!-- FOOTER NOTE -->
            <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
                Kính chúc Quý khách cùng gia đình luôn an lạc, thưởng thức những bữa ăn thanh tịnh và ngon miệng tại <b>${fromName || 'Nhà Hàng Hoa Sen'}</b>!
            </p>
        </div>

        <!-- FOOTER -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 20px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0 0 4px 0;">Đây là email tự động gửi từ hệ thống quản lý khách hàng <b>${fromName || 'Nhà Hàng Hoa Sen'}</b>.</p>
            <p style="margin: 0;">Nếu Quý khách cần hỗ trợ, vui lòng liên hệ hotline hoặc quầy thu ngân.</p>
        </div>
    </div>
    `;
}

// 1. GET /api/marketing/campaigns - Lấy danh sách chiến dịch
router.get('/campaigns', (req, res) => {
    try {
        const db = getDb();
        // Tự động đồng bộ số lượt đã dùng thực tế từ bảng ORDERS
        try {
            db.exec(`
                UPDATE MARKETING_CAMPAIGNS 
                SET Usage_count = (
                    SELECT COUNT(*) 
                    FROM ORDERS 
                    WHERE UPPER(ORDERS.Voucher_code) = UPPER(MARKETING_CAMPAIGNS.Code)
                      AND (ORDERS.Status IS NULL OR ORDERS.Status != 'CANCELLED')
                )
                WHERE Code IS NOT NULL AND Code != '';
            `);
        } catch (eSync) {
            console.warn('Lỗi đồng bộ Usage_count từ ORDERS:', eSync.message);
        }

        const campaigns = db.prepare(`
            SELECT * FROM MARKETING_CAMPAIGNS 
            ORDER BY Is_active DESC, Campaign_id DESC
        `).all();
        db.close();
        res.json({ success: true, campaigns });
    } catch (err) {
        console.error('Lỗi GET /api/marketing/campaigns:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. POST /api/marketing/campaigns - Tạo chiến dịch mới
router.post('/campaigns', (req, res) => {
    try {
        const {
            Campaign_name,
            Code,
            Campaign_type = 'BILL_AMOUNT',
            Discount_type = 'PERCENT',
            Discount_value = 0,
            Min_bill_amount = 0,
            Max_discount_amount = null,
            Usage_limit = null,
            Min_membership_months = 0,
            Target_tier = 'ALL',
            Start_date = null,
            End_date = null,
            Description = '',
            Show_banner = 0,
            Badge_text = null,
            Price_text = null,
            Image_url = null,
            Is_active = 1
        } = req.body;

        if (!Campaign_name || !Code || !Discount_value) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc (Tên, Mã Voucher, Mức Giảm)!' });
        }

        const cleanCode = String(Code).toUpperCase().trim();
        const db = getDb();

        // Kiểm tra trùng mã
        const existing = db.prepare("SELECT Campaign_id FROM MARKETING_CAMPAIGNS WHERE Code = ?").get(cleanCode);
        if (existing) {
            db.close();
            return res.status(400).json({ success: false, error: `Mã Voucher [${cleanCode}] đã tồn tại!` });
        }

        const stmt = db.prepare(`
            INSERT INTO MARKETING_CAMPAIGNS (
                Name, Campaign_name, Code, Type, Campaign_type, Discount_type, Discount_value,
                Min_order_amount, Min_bill_amount, Max_discount_amount, Usage_limit, Usage_count,
                Min_member_tenure_months, Min_membership_months, Target_tier, Start_date, End_date,
                Description, Show_banner, Badge_text, Price_text, Image_url, Is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            Campaign_name.trim(),
            Campaign_name.trim(),
            cleanCode,
            Campaign_type,
            Campaign_type,
            Discount_type,
            Number(Discount_value),
            Number(Min_bill_amount || 0),
            Number(Min_bill_amount || 0),
            Max_discount_amount ? Number(Max_discount_amount) : null,
            Usage_limit ? Number(Usage_limit) : null,
            Number(Min_membership_months || 0),
            Number(Min_membership_months || 0),
            Target_tier,
            Start_date || null,
            End_date || null,
            Description ? Description.trim() : null,
            Number(Show_banner || 0),
            Badge_text || null,
            Price_text || null,
            Image_url || null,
            Number(Is_active || 1)
        );

        db.close();
        const io = req.app.get('io');
        if (io) io.emit('banners_updated');

        res.json({ success: true, message: 'Đã tạo chiến dịch thành công!', campaignId: result.lastInsertRowid });
    } catch (err) {
        console.error('Lỗi POST /api/marketing/campaigns:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. PUT /api/marketing/campaigns/:id - Cập nhật chiến dịch
router.put('/campaigns/:id', (req, res) => {
    try {
        const id = req.params.id;
        const {
            Campaign_name = '',
            Name = '',
            Code,
            Campaign_type = 'BILL_AMOUNT',
            Type = 'BILL_AMOUNT',
            Discount_type = 'PERCENT',
            Discount_value = 0,
            Min_bill_amount = 0,
            Min_order_amount = 0,
            Max_discount_amount = null,
            Usage_limit = null,
            Min_membership_months = 0,
            Min_member_tenure_months = 0,
            Target_tier = 'ALL',
            Start_date = null,
            End_date = null,
            Description = '',
            Show_banner = 0,
            Badge_text = null,
            Price_text = null,
            Image_url = null,
            Is_active = 1
        } = req.body;

        const displayName = (Campaign_name || Name || '').trim();
        const displayType = Campaign_type || Type || 'BILL_AMOUNT';
        const displayMinBill = Number(Min_bill_amount || Min_order_amount || 0);
        const displayMinMonths = Number(Min_membership_months || Min_member_tenure_months || 0);

        const cleanCode = String(Code).toUpperCase().trim();
        const db = getDb();

        const existing = db.prepare("SELECT Campaign_id FROM MARKETING_CAMPAIGNS WHERE Code = ? AND Campaign_id != ?").get(cleanCode, id);
        if (existing) {
            db.close();
            return res.status(400).json({ success: false, error: `Mã [${cleanCode}] đã được dùng bởi chiến dịch khác!` });
        }

        db.prepare(`
            UPDATE MARKETING_CAMPAIGNS SET
                Name = ?,
                Campaign_name = ?,
                Code = ?,
                Type = ?,
                Campaign_type = ?,
                Discount_type = ?,
                Discount_value = ?,
                Min_order_amount = ?,
                Min_bill_amount = ?,
                Max_discount_amount = ?,
                Usage_limit = ?,
                Min_member_tenure_months = ?,
                Min_membership_months = ?,
                Target_tier = ?,
                Start_date = ?,
                End_date = ?,
                Description = ?,
                Show_banner = ?,
                Badge_text = ?,
                Price_text = ?,
                Image_url = ?,
                Is_active = ?
            WHERE Campaign_id = ?
        `).run(
            displayName,
            displayName,
            cleanCode,
            displayType,
            displayType,
            Discount_type,
            Number(Discount_value),
            displayMinBill,
            displayMinBill,
            Max_discount_amount ? Number(Max_discount_amount) : null,
            Usage_limit ? Number(Usage_limit) : null,
            displayMinMonths,
            displayMinMonths,
            Target_tier,
            Start_date || null,
            End_date || null,
            Description ? Description.trim() : null,
            Number(Show_banner || 0),
            Badge_text || null,
            Price_text || null,
            Image_url || null,
            Number(Is_active || 1),
            id
        );

        db.close();
        const io = req.app.get('io');
        if (io) io.emit('banners_updated');

        res.json({ success: true, message: 'Đã cập nhật chiến dịch thành công!' });
    } catch (err) {
        console.error('Lỗi PUT /api/marketing/campaigns:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. DELETE /api/marketing/campaigns/:id - Xóa chiến dịch
router.delete('/campaigns/:id', (req, res) => {
    try {
        const id = req.params.id;
        const db = getDb();
        db.prepare("DELETE FROM MARKETING_CAMPAIGNS WHERE Campaign_id = ?").run(id);
        db.close();
        res.json({ success: true, message: 'Đã xóa chiến dịch thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. POST /api/marketing/push-vouchers - Đẩy mã giảm giá cho thành viên
router.post('/push-vouchers', (req, res) => {
    try {
        const campaignId = req.body.Campaign_id || req.body.campaignId;
        const targetType = req.body.Target_type || req.body.targetType || 'ALL';
        const targetTier = req.body.Target_tier || req.body.targetTier || 'ALL';
        const minMonths = Number(req.body.Min_tenure_months || req.body.minMonths || 0);
        const randomLimit = Number(req.body.Random_count || req.body.randomLimit || 20);
        const expiryDays = Number(req.body.Expiry_days || req.body.expiryDays || 30);
        const customExpiryDate = req.body.Custom_expiry_date || req.body.customExpiryDate || null;

        if (!campaignId) {
            return res.status(400).json({ success: false, error: 'Thiếu mã chiến dịch!' });
        }

        const db = getDb();
        const campaign = db.prepare("SELECT * FROM MARKETING_CAMPAIGNS WHERE Campaign_id = ?").get(campaignId);
        if (!campaign) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy chiến dịch nguồn!' });
        }

        let members = [];
        if (targetType === 'TIER') {
            if (targetTier === 'ALL') {
                members = db.prepare("SELECT Member_id, Full_name, Phone, Email, Current_tier, Created_at FROM MEMBERS WHERE Is_active = 1").all();
            } else {
                members = db.prepare("SELECT Member_id, Full_name, Phone, Email, Current_tier, Created_at FROM MEMBERS WHERE Current_tier = ? AND Is_active = 1").all(targetTier);
            }
        } else if (targetType === 'TENURE') {
            const months = Math.max(1, minMonths || 3);
            const sql = `
                SELECT Member_id, Full_name, Phone, Email, Current_tier, Created_at
                FROM MEMBERS 
                WHERE Is_active = 1 AND ((julianday('now') - julianday(Created_at)) / 30.44) >= ?
            `;
            members = db.prepare(sql).all(months);
        } else if (targetType === 'RANDOM' || targetType === 'RANDOM_SAMPLE') {
            const count = Math.max(1, randomLimit || 10);
            members = db.prepare("SELECT Member_id, Full_name, Phone, Email, Current_tier, Created_at FROM MEMBERS WHERE Is_active = 1 ORDER BY RANDOM() LIMIT ?").all(count);
        } else {
            members = db.prepare("SELECT Member_id, Full_name, Phone, Email, Current_tier, Created_at FROM MEMBERS WHERE Is_active = 1").all();
        }

        if (members.length === 0) {
            db.close();
            return res.json({ success: true, assignedCount: 0, message: 'Không tìm thấy hội viên nào khớp tiêu chí!' });
        }

        let expirySqlParam = customExpiryDate;
        if (!expirySqlParam) {
            const expD = Math.max(1, expiryDays);
            expirySqlParam = new Date(Date.now() + expD * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        }

        const insertVoucher = db.prepare(`
            INSERT INTO MEMBER_VOUCHERS (Member_id, Campaign_id, Voucher_code, Title, Discount_type, Discount_value, Min_order_amount, Max_discount_amount, Expiry_date, Status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNUSED')
        `);

        let count = 0;
        const pushTx = db.transaction((list) => {
            for (const m of list) {
                const uniqueCode = `${campaign.Code}-${m.Member_id}-${Math.floor(100 + Math.random() * 900)}`;
                insertVoucher.run(
                    m.Member_id,
                    campaign.Campaign_id,
                    uniqueCode,
                    campaign.Campaign_name || campaign.Name,
                    campaign.Discount_type,
                    campaign.Discount_value,
                    campaign.Min_bill_amount || 0,
                    campaign.Max_discount_amount || null,
                    expirySqlParam
                );
                count++;
            }
        });

        pushTx(members);
        db.close();

        const io = req.app.get('io');
        if (io) io.emit('vouchers_updated');

        res.json({
            success: true,
            assignedCount: count,
            expiryDate: expirySqlParam,
            message: `Đã đẩy thành công mã ưu đãi tới ${count} hội viên (HSD: ${expirySqlParam})!`
        });
    } catch (err) {
        console.error('Lỗi POST /api/marketing/push-vouchers:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5.5. GET /api/marketing/member-vouchers-history - Lấy danh sách toàn bộ lịch sử đẩy voucher
router.get('/member-vouchers-history', (req, res) => {
    try {
        const { search = '', status = 'ALL', campaignId = '' } = req.query;
        const db = getDb();

        // Tự động đồng bộ trạng thái hết hạn theo thời gian hiện tại
        try {
            db.exec(`
                UPDATE MEMBER_VOUCHERS 
                SET Status = 'EXPIRED' 
                WHERE Status = 'UNUSED' AND Expiry_date IS NOT NULL AND Expiry_date < datetime('now', 'localtime');

                UPDATE MEMBER_VOUCHERS 
                SET Status = 'UNUSED' 
                WHERE Status = 'EXPIRED' AND Expiry_date IS NOT NULL AND Expiry_date >= datetime('now', 'localtime');
            `);
        } catch (eSync) {}

        let sql = `
            SELECT v.*, 
                   m.Full_name as Member_name, 
                   m.Phone as Member_phone, 
                   m.Current_tier as Member_tier,
                   c.Code as Campaign_code,
                   c.Campaign_name
            FROM MEMBER_VOUCHERS v
            LEFT JOIN MEMBERS m ON v.Member_id = m.Member_id
            LEFT JOIN MARKETING_CAMPAIGNS c ON v.Campaign_id = c.Campaign_id
            WHERE 1=1
        `;
        const params = [];

        if (status && status !== 'ALL') {
            sql += ` AND v.Status = ?`;
            params.push(status);
        }

        if (campaignId) {
            sql += ` AND v.Campaign_id = ?`;
            params.push(campaignId);
        }

        if (search && search.trim() !== '') {
            const s = `%${search.trim().toUpperCase()}%`;
            const sRaw = `%${search.trim()}%`;
            sql += ` AND (UPPER(v.Voucher_code) LIKE ? OR UPPER(v.Title) LIKE ? OR m.Full_name LIKE ? OR m.Phone LIKE ?)`;
            params.push(s, s, sRaw, sRaw);
        }

        sql += ` ORDER BY v.Voucher_id DESC`;

        const history = db.prepare(sql).all(...params);
        db.close();

        res.json({ success: true, history, totalCount: history.length });
    } catch (err) {
        console.error('Lỗi GET /api/marketing/member-vouchers-history:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5.6. PUT /api/marketing/member-vouchers/:voucherId/expiry - Sửa hạn sử dụng mã đã đẩy (Gia hạn / Thu hẹp)
router.put('/member-vouchers/:voucherId/expiry', (req, res) => {
    try {
        const voucherId = req.params.voucherId;
        const { Expiry_date } = req.body;
        if (!Expiry_date) {
            return res.status(400).json({ success: false, error: 'Vui lòng cung cấp hạn sử dụng mới!' });
        }

        const db = getDb();
        const voucher = db.prepare("SELECT * FROM MEMBER_VOUCHERS WHERE Voucher_id = ?").get(voucherId);
        if (!voucher) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy thông tin voucher!' });
        }

        const now = new Date();
        const newExp = new Date(Expiry_date);
        let newStatus = voucher.Status;

        // Nếu gia hạn thời gian sau hiện tại
        if (newExp > now) {
            if (voucher.Status === 'EXPIRED') {
                newStatus = 'UNUSED'; // Khôi phục lại hiệu lực
            }
        } else {
            if (voucher.Status === 'UNUSED') {
                newStatus = 'EXPIRED'; // Tự động hết hạn
            }
        }

        db.prepare(`
            UPDATE MEMBER_VOUCHERS 
            SET Expiry_date = ?, Status = ?
            WHERE Voucher_id = ?
        `).run(Expiry_date, newStatus, voucherId);

        db.close();

        const io = req.app.get('io');
        if (io) io.emit('vouchers_updated');

        res.json({
            success: true,
            newStatus,
            Expiry_date,
            message: `✅ Đã cập nhật hạn sử dụng mã thành [${Expiry_date}]!`
        });
    } catch (err) {
        console.error('Lỗi PUT /api/marketing/member-vouchers/:voucherId/expiry:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5.7. POST /api/marketing/member-vouchers/:voucherId/cancel - Hủy mã voucher đã đẩy
router.post('/member-vouchers/:voucherId/cancel', (req, res) => {
    try {
        const voucherId = req.params.voucherId;
        const db = getDb();
        db.prepare("UPDATE MEMBER_VOUCHERS SET Status = 'CANCELLED' WHERE Voucher_id = ?").run(voucherId);
        db.close();

        const io = req.app.get('io');
        if (io) io.emit('vouchers_updated');

        res.json({ success: true, message: 'Đã hủy mã voucher thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5.8. DELETE /api/marketing/member-vouchers/:voucherId - Xóa 1 dòng voucher khỏi lịch sử
router.delete('/member-vouchers/:voucherId', (req, res) => {
    try {
        const voucherId = req.params.voucherId;
        const db = getDb();
        db.prepare("DELETE FROM MEMBER_VOUCHERS WHERE Voucher_id = ?").run(voucherId);
        db.close();

        const io = req.app.get('io');
        if (io) io.emit('vouchers_updated');

        res.json({ success: true, message: 'Đã xóa dòng lịch sử voucher!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5.9. POST /api/marketing/member-vouchers/bulk-delete - Xóa nhiều dòng lịch sử (Theo ID hoặc Theo loại)
router.post('/member-vouchers/bulk-delete', (req, res) => {
    try {
        const { voucherIds = [], deleteType = '' } = req.body;
        const db = getDb();

        let deletedCount = 0;
        if (deleteType === 'ALL_EXPIRED') {
            const info = db.prepare("DELETE FROM MEMBER_VOUCHERS WHERE Status = 'EXPIRED' OR (Expiry_date IS NOT NULL AND Expiry_date < datetime('now', 'localtime'))").run();
            deletedCount = info.changes;
        } else if (deleteType === 'ALL_CANCELLED') {
            const info = db.prepare("DELETE FROM MEMBER_VOUCHERS WHERE Status = 'CANCELLED'").run();
            deletedCount = info.changes;
        } else if (deleteType === 'ALL_USED') {
            const info = db.prepare("DELETE FROM MEMBER_VOUCHERS WHERE Status = 'USED'").run();
            deletedCount = info.changes;
        } else if (Array.isArray(voucherIds) && voucherIds.length > 0) {
            const placeholders = voucherIds.map(() => '?').join(',');
            const info = db.prepare(`DELETE FROM MEMBER_VOUCHERS WHERE Voucher_id IN (${placeholders})`).run(...voucherIds);
            deletedCount = info.changes;
        }

        db.close();

        const io = req.app.get('io');
        if (io) io.emit('vouchers_updated');

        res.json({ success: true, deletedCount, message: `Đã xóa thành công ${deletedCount} dòng lịch sử!` });
    } catch (err) {
        console.error('Lỗi bulk-delete vouchers:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. GET /api/marketing/member-vouchers/:memberId - Lấy danh sách voucher của hội viên (kèm trạng thái)
router.get('/member-vouchers/:memberId', (req, res) => {
    try {
        const memberId = req.params.memberId;
        const db = getDb();
        // Tự động cập nhật hết hạn
        try {
            db.exec(`
                UPDATE MEMBER_VOUCHERS 
                SET Status = 'EXPIRED' 
                WHERE Status = 'UNUSED' AND Expiry_date IS NOT NULL AND Expiry_date < datetime('now', 'localtime');
            `);
        } catch (e) {}

        const vouchers = db.prepare(`
            SELECT * FROM MEMBER_VOUCHERS 
            WHERE Member_id = ?
            ORDER BY Voucher_id DESC
        `).all(memberId);
        db.close();
        res.json({ success: true, vouchers });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 7. POST /api/marketing/verify-voucher - Kiểm tra & tính toán mã giảm giá tại giỏ hàng
router.post('/verify-voucher', (req, res) => {
    try {
        const Code = req.body.Code || req.body.code;
        const Member_id = req.body.Member_id || req.body.memberId;
        const Subtotal = req.body.Subtotal !== undefined ? req.body.Subtotal : (req.body.subtotal !== undefined ? req.body.subtotal : (req.body.billAmount || 0));

        if (!Code) {
            return res.status(400).json({ success: false, valid: false, error: 'Vui lòng nhập mã giảm giá!' });
        }

        const cleanCode = String(Code).toUpperCase().trim();
        const db = getDb();
        const subtotalNum = Number(Subtotal || 0);

        // 1. Kiểm tra voucher riêng của thành viên
        let voucher = null;
        if (Member_id) {
            voucher = db.prepare(`
                SELECT v.*, c.Campaign_type, c.Min_membership_months, c.Target_tier, c.Min_bill_amount
                FROM MEMBER_VOUCHERS v
                LEFT JOIN MARKETING_CAMPAIGNS c ON v.Campaign_id = c.Campaign_id
                WHERE v.Voucher_code = ? AND v.Member_id = ? AND v.Status = 'UNUSED'
            `).get(cleanCode, Member_id);
        }

        // 2. Nếu không tìm thấy voucher cá nhân, tìm trong bảng chiến dịch chung
        if (!voucher) {
            const camp = db.prepare(`
                SELECT *, 0 as Voucher_id, Code as Voucher_code, Campaign_name as Title
                FROM MARKETING_CAMPAIGNS 
                WHERE Code = ? AND Is_active = 1
            `).get(cleanCode);

            if (camp) {
                voucher = {
                    Voucher_id: 0,
                    Voucher_code: camp.Code,
                    Title: camp.Campaign_name,
                    Discount_type: camp.Discount_type,
                    Discount_value: camp.Discount_value,
                    Min_order_amount: camp.Min_bill_amount,
                    Max_discount_amount: camp.Max_discount_amount,
                    Campaign_type: camp.Campaign_type,
                    Min_membership_months: camp.Min_membership_months,
                    Target_tier: camp.Target_tier,
                    Usage_limit: camp.Usage_limit,
                    Usage_count: camp.Usage_count
                };
            }
        }

        if (!voucher) {
            db.close();
            return res.status(400).json({
                success: false,
                valid: false,
                reason: `Mã giảm giá "${cleanCode}" không tồn tại hoặc đã hết hạn!`
            });
        }

        // Kiểm tra thời hạn hiệu lực cụ thể
        if (voucher.Expiry_date && new Date(voucher.Expiry_date) < new Date()) {
            db.close();
            return res.status(400).json({
                success: false,
                valid: false,
                reason: `Mã giảm giá "${cleanCode}" đã hết hạn sử dụng!`
            });
        }

        if (voucher.Status && voucher.Status !== 'UNUSED') {
            db.close();
            const statusMsg = voucher.Status === 'CANCELLED' ? 'đã bị hủy' : (voucher.Status === 'USED' ? 'đã được sử dụng' : 'không còn hiệu lực');
            return res.status(400).json({
                success: false,
                valid: false,
                reason: `Mã giảm giá "${cleanCode}" ${statusMsg}!`
            });
        }

        // Kiểm tra số lượt dùng thực tế nếu là chiến dịch có giới hạn số lượng
        const actualOrderCount = db.prepare("SELECT COUNT(*) as cnt FROM ORDERS WHERE UPPER(Voucher_code) = ? AND (Status IS NULL OR Status != 'CANCELLED')").get(cleanCode)?.cnt || 0;
        const currentUsage = Math.max(Number(voucher.Usage_count || 0), actualOrderCount);
        if (voucher.Usage_limit && currentUsage >= voucher.Usage_limit) {
            db.close();
            return res.status(400).json({ 
                success: false, 
                valid: false, 
                reason: `Mã giảm giá "${cleanCode}" đã hết lượt sử dụng (${currentUsage}/${voucher.Usage_limit})!` 
            });
        }

        // Kiểm tra đơn hàng tối thiểu
        const minOrder = Number(voucher.Min_order_amount || voucher.Min_bill_amount || 0);
        if (minOrder > 0 && subtotalNum < minOrder) {
            db.close();
            return res.status(400).json({
                success: false,
                valid: false,
                reason: `Đơn hàng chưa đạt mức tối thiểu ${minOrder.toLocaleString('vi-VN')}đ để dùng mã này!`
            });
        }

        // Kiểm tra thâm niên nếu là chiến dịch dành riêng cho hội viên lâu năm
        if (voucher.Campaign_type === 'MEMBER_TENURE' && Number(voucher.Min_membership_months || voucher.Min_member_tenure_months || 0) > 0) {
            if (!Member_id) {
                db.close();
                return res.status(400).json({
                    success: false,
                    valid: false,
                    reason: 'Mã này dành riêng cho hội viên có thâm niên. Vui lòng quét thẻ hội viên trước!'
                });
            }
            const mem = db.prepare("SELECT Created_at FROM MEMBERS WHERE Member_id = ?").get(Member_id);
            if (mem) {
                const memCreated = new Date(mem.Created_at || Date.now());
                const monthsDiff = (Date.now() - memCreated) / (1000 * 60 * 60 * 24 * 30.44);
                const reqMonths = Number(voucher.Min_membership_months || voucher.Min_member_tenure_months || 3);
                if (monthsDiff < reqMonths) {
                    db.close();
                    return res.status(400).json({
                        success: false,
                        valid: false,
                        reason: `Mã này yêu cầu thẻ hoạt động trên ${reqMonths} tháng (Quý khách đạt ~${Math.floor(monthsDiff)} tháng)!`
                    });
                }
            }
        }

        // Kiểm tra hạng thẻ
        if (voucher.Target_tier && voucher.Target_tier !== 'ALL') {
            if (!Member_id) {
                db.close();
                return res.status(400).json({
                    success: false,
                    valid: false,
                    reason: `Mã này chỉ áp dụng cho hội viên hạng [${voucher.Target_tier}]. Vui lòng áp dụng thẻ trước!`
                });
            }
            const mem = db.prepare("SELECT Current_tier FROM MEMBERS WHERE Member_id = ?").get(Member_id);
            if (!mem || mem.Current_tier !== voucher.Target_tier) {
                db.close();
                return res.status(400).json({
                    success: false,
                    valid: false,
                    reason: `Mã này chỉ áp dụng cho hạng hội viên [${voucher.Target_tier}]!`
                });
            }
        }

        // Tính số tiền giảm giá
        let discountAmount = 0;
        if (voucher.Discount_type === 'PERCENT') {
            discountAmount = Math.round(subtotalNum * (Number(voucher.Discount_value || 0) / 100));
            if (voucher.Max_discount_amount && voucher.Max_discount_amount > 0) {
                discountAmount = Math.min(discountAmount, Number(voucher.Max_discount_amount));
            }
        } else {
            discountAmount = Math.min(subtotalNum, Number(voucher.Discount_value || 0));
        }

        db.close();

        res.json({
            success: true,
            valid: true,
            voucher: {
                voucherId: voucher.Voucher_id || 0,
                code: cleanCode,
                name: voucher.Title || voucher.Name,
                title: voucher.Title || voucher.Name,
                discountType: voucher.Discount_type,
                discountValue: voucher.Discount_value,
                discountAmount: discountAmount,
                minOrderAmount: voucher.Min_order_amount,
                maxDiscountAmount: voucher.Max_discount_amount
            },
            message: `Áp dụng thành công mã "${cleanCode}", giảm -${discountAmount.toLocaleString('vi-VN')}đ!`
        });
    } catch (err) {
        console.error('Lỗi POST /api/marketing/verify-voucher:', err);
        res.status(500).json({ success: false, valid: false, error: err.message });
    }
});

// 8. GET /api/marketing/export-emails - Lấy danh sách email khách hàng
router.get('/export-emails', (req, res) => {
    try {
        const { tier = 'ALL' } = req.query;
        const db = getDb();
        let sql = "SELECT Member_id, Full_name, Phone, Email, Current_tier, Created_at FROM MEMBERS WHERE Email IS NOT NULL AND Email != '' AND Is_active = 1";
        const params = [];
        if (tier !== 'ALL') {
            sql += " AND Current_tier = ?";
            params.push(tier);
        }
        sql += " ORDER BY Member_id DESC";
        const members = db.prepare(sql).all(...params);
        db.close();
        res.json({ success: true, count: members.length, members });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8.5. POST /api/marketing/send-email-vouchers - Gửi mã giảm giá riêng vào Email của các khách hàng được chọn
router.post('/send-email-vouchers', async (req, res) => {
    try {
        const {
            campaignId,
            memberIds = [], // Danh sách ID khách hàng được quản lý tích chọn
            customSubject = '',
            customMessage = ''
        } = req.body;

        if (!campaignId) {
            return res.status(400).json({ success: false, error: 'Vui lòng chọn chiến dịch khuyến mãi!' });
        }

        if (!Array.isArray(memberIds) || memberIds.length === 0) {
            return res.status(400).json({ success: false, error: 'Vui lòng tích chọn ít nhất một khách hàng có email!' });
        }

        const db = getDb();
        ensureMarketingEmailLogsTable(db);

        const campaign = db.prepare("SELECT * FROM MARKETING_CAMPAIGNS WHERE Campaign_id = ?").get(campaignId);
        if (!campaign) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy chiến dịch khuyến mãi!' });
        }

        // Lấy danh sách hội viên hợp lệ có Email
        const placeholders = memberIds.map(() => '?').join(',');
        const members = db.prepare(`
            SELECT Member_id, Full_name, Phone, Email, Current_tier 
            FROM MEMBERS 
            WHERE Member_id IN (${placeholders}) AND Email IS NOT NULL AND Email != '' AND Is_active = 1
        `).all(...memberIds);

        if (members.length === 0) {
            db.close();
            return res.status(400).json({ success: false, error: 'Các khách hàng được chọn hiện chưa có địa chỉ Email!' });
        }

        // Lấy cấu hình SMTP
        const smtpConfig = getSmtpConfig(db);
        const transporter = createTransporter(smtpConfig);

        const isSmtpConfigured = !!transporter;
        const fromName = smtpConfig.fromName || 'Nhà Hàng Hoa Sen';
        const senderAddress = isSmtpConfigured ? `"${fromName}" <${smtpConfig.user}>` : null;

        // Chuẩn bị thông tin giảm giá
        const discountText = campaign.Discount_type === 'PERCENT'
            ? `Giảm ${campaign.Discount_value}%${campaign.Max_discount_amount ? ` (Tối đa ${Number(campaign.Max_discount_amount).toLocaleString('vi-VN')}đ)` : ''}`
            : `Giảm ${Number(campaign.Discount_value || 0).toLocaleString('vi-VN')}đ`;

        const minOrderNum = Number(campaign.Min_bill_amount || campaign.Min_order_amount || 0);
        const minOrderText = minOrderNum > 0 ? `Đơn từ ${minOrderNum.toLocaleString('vi-VN')}đ` : '';

        // Tính ngày hết hạn (30 ngày sau)
        const expiryDateObj = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const expiryDateFormatted = `${String(expiryDateObj.getDate()).padStart(2, '0')}/${String(expiryDateObj.getMonth() + 1).padStart(2, '0')}/${expiryDateObj.getFullYear()}`;
        const expiryIso = expiryDateObj.toISOString().slice(0, 19).replace('T', ' ');

        const defaultSubject = `[Ưu Đãi] Tặng bạn mã giảm giá ${discountText} - ${fromName}`;
        const finalSubject = (customSubject && customSubject.trim()) ? customSubject.trim() : defaultSubject;

        console.log(`\n============================================================`);
        console.log(`🚀 [MARKETING EMAIL DISPATCH] Bắt đầu tiến trình gửi ${members.length} email voucher...`);
        console.log(`   - Chiến dịch: [${campaign.Code}] ${campaign.Campaign_name || campaign.Name}`);
        console.log(`   - Mức giảm: ${discountText}`);
        if (isSmtpConfigured) {
            console.log(`   - SMTP Server: ${smtpConfig.host}:${smtpConfig.port} | SSL/TLS: ${smtpConfig.secure}`);
            console.log(`   - Tài khoản gửi: ${smtpConfig.user}`);
            console.log(`   - Tên hiển thị: ${fromName}`);
        } else {
            console.warn(`   ⚠️ [CẢNH BÁO SMTP] Chưa cấu hình tài khoản Email SMTP gửi trong Cài đặt hệ thống!`);
            console.warn(`   ⚠️ Các mã voucher vẫn được tạo trong kho của khách nhưng email mạng sẽ không gửi đi được.`);
        }
        console.log(`============================================================`);

        const insertVoucherStmt = db.prepare(`
            INSERT INTO MEMBER_VOUCHERS (
                Member_id, Campaign_id, Voucher_code, Title, Discount_type, 
                Discount_value, Min_order_amount, Max_discount_amount, Expiry_date, Status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNUSED')
        `);

        const insertLogStmt = db.prepare(`
            INSERT INTO MARKETING_EMAIL_LOGS (
                Campaign_id, Campaign_name, Voucher_code, Member_id, Member_name,
                Email, Phone, Subject, Discount_text, Status, Error_message, Sent_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
        `);

        let successCount = 0;
        let failedCount = 0;
        const sentResults = [];

        for (const m of members) {
            // Sinh mã voucher riêng biệt cho từng email của khách
            const uniqueCode = `${campaign.Code}-${m.Member_id}-${Math.floor(100 + Math.random() * 900)}`;

            // Lưu voucher vào kho của khách
            try {
                insertVoucherStmt.run(
                    m.Member_id,
                    campaign.Campaign_id,
                    uniqueCode,
                    campaign.Campaign_name || campaign.Name,
                    campaign.Discount_type,
                    campaign.Discount_value,
                    minOrderNum,
                    campaign.Max_discount_amount || null,
                    expiryIso
                );
            } catch (errVoucher) {
                console.error(`❌ Lỗi tạo record voucher cho ${m.Full_name}:`, errVoucher.message);
            }

            // Gửi email thực tế qua SMTP
            let sendStatus = 'SUCCESS';
            let sendErrorMsg = null;

            if (!isSmtpConfigured) {
                sendStatus = 'FAILED';
                sendErrorMsg = 'Chưa cấu hình tài khoản SMTP (Email & Mật khẩu ứng dụng Google) trong Cài đặt hệ thống.';
                console.warn(`⚠️ [EMAIL CHƯA GỬI] ${m.Full_name} <${m.Email}>: ${sendErrorMsg}`);
                failedCount++;
            } else {
                try {
                    const emailHtml = buildVoucherEmailHtml({
                        memberName: m.Full_name,
                        campaignTitle: campaign.Campaign_name || campaign.Name,
                        voucherCode: uniqueCode,
                        discountText: discountText,
                        minOrderText: minOrderText,
                        expiryDateFormatted: expiryDateFormatted,
                        customMessage: customMessage,
                        fromName: fromName
                    });

                    const info = await transporter.sendMail({
                        from: senderAddress,
                        to: m.Email,
                        subject: finalSubject,
                        text: `Xin chào ${m.Full_name || 'Quý khách'}! ${fromName} gửi tặng bạn mã giảm giá ${discountText}. Mã ưu đãi: ${uniqueCode} (Hạn sử dụng: ${expiryDateFormatted || '30 ngày'}). Cảm ơn quý khách!`,
                        html: emailHtml
                    });

                    console.log(`✅ [EMAIL THÀNH CÔNG] Đã gửi tới: ${m.Full_name} <${m.Email}> | Mã: ${uniqueCode} | MessageId: ${info.messageId}`);
                    successCount++;
                } catch (sendErr) {
                    sendStatus = 'FAILED';
                    sendErrorMsg = sendErr.message || 'Lỗi không xác định khi gửi email';
                    console.error(`❌ [EMAIL THẤT BẠI] Gửi tới ${m.Full_name} <${m.Email}> thất bại: ${sendErrorMsg}`);
                    failedCount++;
                }
            }

            // Ghi nhận vào bảng nhật ký MARKETING_EMAIL_LOGS
            try {
                insertLogStmt.run(
                    campaign.Campaign_id,
                    campaign.Campaign_name || campaign.Name,
                    uniqueCode,
                    m.Member_id,
                    m.Full_name,
                    m.Email,
                    m.Phone || '',
                    finalSubject,
                    discountText,
                    sendStatus,
                    sendErrorMsg
                );
            } catch (errLog) {
                console.error(`❌ Lỗi ghi log email:`, errLog.message);
            }

            sentResults.push({
                memberId: m.Member_id,
                fullName: m.Full_name,
                email: m.Email,
                voucherCode: uniqueCode,
                status: sendStatus,
                error: sendErrorMsg
            });
        }

        db.close();

        console.log(`\n📊 [KẾT QUẢ GỬI EMAIL] Tổng số: ${members.length} | Thành công: ${successCount} | Thất bại: ${failedCount}`);
        console.log(`============================================================\n`);

        const io = req.app.get('io');
        if (io) {
            io.emit('vouchers_updated');
            io.emit('marketing_emails_sent', {
                campaignId: campaign.Campaign_id,
                total: members.length,
                successCount,
                failedCount
            });
        }

        let userMsg = '';
        if (successCount > 0 && failedCount === 0) {
            userMsg = `🎉 Đã gửi thành công ${successCount} email mã giảm giá tới hòm thư của khách hàng!`;
        } else if (successCount > 0 && failedCount > 0) {
            userMsg = `⚠️ Đã gửi thành công ${successCount} email, nhưng có ${failedCount} email gặp sự cố. Vui lòng kiểm tra Bảng Lịch Sử Gửi Email.`;
        } else {
            userMsg = `❌ Không thể gửi email qua mạng (${failedCount} thất bại). ${!isSmtpConfigured ? 'Vui lòng cấu hình tài khoản Email SMTP trong Cài đặt hệ thống!' : 'Vui lòng kiểm tra lại mật khẩu ứng dụng Gmail hoặc kết nối mạng!'}`;
        }

        res.json({
            success: successCount > 0 || (isSmtpConfigured === false),
            total: members.length,
            successCount,
            failedCount,
            sentResults,
            isSmtpConfigured,
            message: userMsg
        });
    } catch (err) {
        console.error('Lỗi POST /api/marketing/send-email-vouchers:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8.6. POST /api/marketing/test-email - Kiểm tra kết nối SMTP & gửi email thử nghiệm
router.post('/test-email', async (req, res) => {
    try {
        const {
            toEmail,
            smtpHost,
            smtpPort,
            smtpUser,
            smtpPass,
            smtpFromName,
            smtpSecure
        } = req.body;

        const db = getDb();
        ensureMarketingEmailLogsTable(db);
        const savedConfig = getSmtpConfig(db);
        db.close();

        const host = (smtpHost || savedConfig.host || 'smtp.gmail.com').trim();
        const port = Number(smtpPort || savedConfig.port || 465);
        const user = (smtpUser || savedConfig.user || '').trim();
        const pass = (smtpPass || savedConfig.pass || '').replace(/\s+/g, '').trim();
        const secure = (smtpSecure !== undefined) ? (smtpSecure === true || smtpSecure === '1' || smtpSecure === 1) : (port === 465 || savedConfig.secure);
        const fromName = (smtpFromName || savedConfig.fromName || 'Nhà Hàng Hoa Sen').trim();
        const targetEmail = (toEmail || user).trim();

        if (!user || !pass) {
            return res.status(400).json({
                success: false,
                error: 'Vui lòng nhập đầy đủ Email gửi và Mật khẩu ứng dụng (Google App Password 16 chữ cái) để kiểm tra!'
            });
        }

        if (!targetEmail) {
            return res.status(400).json({
                success: false,
                error: 'Vui lòng nhập Email người nhận thư thử nghiệm!'
            });
        }

        console.log(`\n============================================================`);
        console.log(`🔍 [TEST EMAIL SMTP] Đang kiểm tra kết nối SMTP...`);
        console.log(`   - Host: ${host}:${port} | Secure (SSL): ${secure}`);
        console.log(`   - Tài khoản gửi: ${user}`);
        console.log(`   - Người nhận test: ${targetEmail}`);
        console.log(`============================================================`);

        const transporter = nodemailer.createTransport({
            host: host,
            port: port,
            secure: secure,
            auth: {
                user: user,
                pass: pass
            },
            tls: {
                rejectUnauthorized: false
            },
            connectionTimeout: 12000,
            greetingTimeout: 12000,
            socketTimeout: 15000
        });

        // 1. Xác thực kết nối
        await transporter.verify();
        console.log(`✅ [TEST EMAIL SMTP] Xác thực tài khoản SMTP thành công!`);

        // 2. Gửi thử nghiệm 1 email
        const testVoucherCode = `TEST-HOASEN-${Math.floor(1000 + Math.random() * 9000)}`;
        const testInfo = await transporter.sendMail({
            from: `"${fromName}" <${user}>`,
            to: targetEmail,
            subject: `[TEST THÀNH CÔNG] Thử Nghiệm Kết Nối SMTP - ${fromName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                    <div style="background: linear-gradient(135deg, #2e7d32, #1b5e20); color: white; padding: 25px; text-align: center;">
                        <h2 style="margin: 0; font-size: 22px;">🌸 ${fromName}</h2>
                        <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Kiểm Tra Kết Nối Máy Chủ Gửi Email</p>
                    </div>
                    <div style="padding: 25px; background: #ffffff; color: #333333;">
                        <div style="background: #e8f5e9; border: 1px solid #c8e6c9; border-radius: 8px; padding: 15px; text-align: center; margin-bottom: 20px;">
                            <h3 style="color: #2e7d32; margin: 0 0 6px 0;">🎉 Kết Nối SMTP Hoàn Hảo!</h3>
                            <p style="margin: 0; font-size: 14px; color: #388e3c;">Email thử nghiệm đã được chuyển đi thành công tới hòm thư của bạn.</p>
                        </div>
                        <p style="font-size: 14px;">Xin chào quản trị viên,</p>
                        <p style="font-size: 14px; line-height: 1.5;">Hệ thống gửi Email Marketing & Voucher của nhà hàng đã được kết nối thành công với máy chủ SMTP. Dưới đây là thông số thử nghiệm:</p>
                        <ul style="font-size: 14px; line-height: 1.8; color: #424242;">
                            <li><b>Máy chủ SMTP:</b> ${host}:${port}</li>
                            <li><b>Tài khoản gửi:</b> ${user}</li>
                            <li><b>Mã voucher mẫu:</b> <span style="color: #d84315; font-weight: bold; font-family: monospace; background: #fff3e0; padding: 2px 6px; border-radius: 4px;">${testVoucherCode}</span></li>
                            <li><b>Thời gian gửi:</b> ${new Date().toLocaleString('vi-VN')}</li>
                        </ul>
                        <p style="font-size: 13px; color: #757575; margin-top: 20px;">Từ bây giờ bạn có thể an tâm sử dụng tính năng "Gửi Mã Vào Email" trong tab Marketing để gửi ưu đãi tới từng khách hàng!</p>
                    </div>
                    <div style="background: #f5f5f5; padding: 12px; text-align: center; font-size: 12px; color: #757575; border-top: 1px solid #e0e0e0;">
                        Thư này được tạo tự động từ chức năng kiểm tra SMTP trong Cài Đặt Hệ Thống.
                    </div>
                </div>
            `
        });

        console.log(`✅ [TEST EMAIL THÀNH CÔNG] Đã gửi thư test tới ${targetEmail} | MessageId: ${testInfo.messageId}`);
        console.log(`============================================================\n`);

        res.json({
            success: true,
            message: `🎉 Kết nối SMTP hoàn hảo! Đã gửi thành công email thử nghiệm tới ${targetEmail}.`,
            messageId: testInfo.messageId
        });
    } catch (err) {
        console.error(`❌ [TEST EMAIL THẤT BẠI] Lỗi kết nối SMTP:`, err.message);
        console.log(`============================================================\n`);

        let helpHint = '';
        if (err.message && (err.message.includes('535') || err.message.includes('Username and Password not accepted') || err.message.includes('BadCredentials'))) {
            helpHint = '💡 HƯỚNG DẪN GMAIL: Google không cho phép dùng mật khẩu đăng nhập bình thường. Bạn cần: 1) Bật Xác minh 2 bước trong tài khoản Google -> 2) Truy cập https://myaccount.google.com/apppasswords để tạo "Mật khẩu ứng dụng" (16 ký tự) và dán vào ô Mật khẩu SMTP.';
        } else if (err.message && (err.message.includes('ETIMEDOUT') || err.message.includes('ESOCKETTIMEDOUT') || err.message.includes('ECONNREFUSED'))) {
            helpHint = '💡 HƯỚNG DẪN KẾT NỐI: Không kết nối được đến máy chủ SMTP. Vui lòng kiểm tra lại Host và Cổng (Gmail SSL dùng cổng 465, TLS dùng cổng 587).';
        }

        res.status(400).json({
            success: false,
            error: err.message,
            help: helpHint
        });
    }
});

// 8.7. GET /api/marketing/email-logs - Lấy lịch sử gửi email voucher
router.get('/email-logs', (req, res) => {
    try {
        const { search = '', status = 'ALL', limit = 100 } = req.query;
        const db = getDb();
        ensureMarketingEmailLogsTable(db);

        let sql = "SELECT * FROM MARKETING_EMAIL_LOGS WHERE 1=1";
        const params = [];

        if (status && status !== 'ALL') {
            sql += " AND Status = ?";
            params.push(status);
        }

        if (search && search.trim()) {
            const kw = `%${search.trim()}%`;
            sql += " AND (Member_name LIKE ? OR Email LIKE ? OR Phone LIKE ? OR Voucher_code LIKE ? OR Campaign_name LIKE ? OR Subject LIKE ?)";
            params.push(kw, kw, kw, kw, kw, kw);
        }

        sql += " ORDER BY Log_id DESC LIMIT ?";
        params.push(Number(limit) || 100);

        const logs = db.prepare(sql).all(...params);

        // Thống kê sơ bộ
        const stats = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN Status = 'SUCCESS' THEN 1 ELSE 0 END) as successCount,
                SUM(CASE WHEN Status = 'FAILED' THEN 1 ELSE 0 END) as failedCount
            FROM MARKETING_EMAIL_LOGS
        `).get();

        db.close();

        res.json({
            success: true,
            logs,
            stats: {
                total: stats?.total || 0,
                successCount: stats?.successCount || 0,
                failedCount: stats?.failedCount || 0
            }
        });
    } catch (err) {
        console.error('Lỗi GET /api/marketing/email-logs:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8.8. DELETE /api/marketing/email-logs - Xóa lịch sử gửi email (đơn lẻ / hàng loạt)
router.delete('/email-logs', (req, res) => {
    try {
        const { logId, logIds, deleteType } = req.body || {};
        const db = getDb();
        ensureMarketingEmailLogsTable(db);

        let deletedCount = 0;
        if (logId) {
            const info = db.prepare("DELETE FROM MARKETING_EMAIL_LOGS WHERE Log_id = ?").run(logId);
            deletedCount = info.changes;
        } else if (deleteType === 'ALL') {
            const info = db.prepare("DELETE FROM MARKETING_EMAIL_LOGS").run();
            deletedCount = info.changes;
        } else if (deleteType === 'ALL_FAILED') {
            const info = db.prepare("DELETE FROM MARKETING_EMAIL_LOGS WHERE Status = 'FAILED'").run();
            deletedCount = info.changes;
        } else if (deleteType === 'ALL_SUCCESS') {
            const info = db.prepare("DELETE FROM MARKETING_EMAIL_LOGS WHERE Status = 'SUCCESS'").run();
            deletedCount = info.changes;
        } else if (Array.isArray(logIds) && logIds.length > 0) {
            const placeholders = logIds.map(() => '?').join(',');
            const info = db.prepare(`DELETE FROM MARKETING_EMAIL_LOGS WHERE Log_id IN (${placeholders})`).run(...logIds);
            deletedCount = info.changes;
        }

        db.close();

        res.json({
            success: true,
            deletedCount,
            message: `Đã xóa thành công ${deletedCount} dòng lịch sử gửi email!`
        });
    } catch (err) {
        console.error('Lỗi DELETE /api/marketing/email-logs:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// BẢO MẬT MÃ OTP 6 SỐ 30 GIÂY CHO MÃ QR KHÁCH HÀNG
// ==========================================

// 9. POST /api/marketing/security-code - Tạo / làm mới mã xác thực 6 số cho khách hàng
router.post('/security-code', (req, res) => {
    try {
        const Member_id = req.body.Member_id || req.body.memberId;
        const Phone = req.body.Phone || req.body.phone;
        if (!Member_id && !Phone) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin hội viên!' });
        }

        const db = getDb();
        const mem = db.prepare("SELECT Member_id, Phone, Full_name FROM MEMBERS WHERE Member_id = ? OR Phone = ?").get(Member_id || 0, Phone || '');
        if (!mem) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy thông tin hội viên!' });
        }

        // Sinh 6 số ngẫu nhiên an toàn: 100000 - 999999
        const code = String(Math.floor(100000 + Math.random() * 900000));
        // Thời hạn 30 giây: epoch timestamp (ms)
        const nowMs = Date.now();
        const expiresAt = nowMs + 32000; // 32s trừ hao độ trễ mạng

        // Vô hiệu mã cũ
        db.prepare("DELETE FROM MEMBER_SECURITY_CODES WHERE Member_id = ? OR Phone = ?").run(mem.Member_id, mem.Phone);

        // Lưu mã mới
        db.prepare(`
            INSERT INTO MEMBER_SECURITY_CODES (Member_id, Phone, Code, Expires_at, Is_used)
            VALUES (?, ?, ?, ?, 0)
        `).run(mem.Member_id, mem.Phone, code, expiresAt);

        db.close();

        res.json({
            success: true,
            code: code,
            ttlSeconds: 30,
            expiresAt: expiresAt,
            message: 'Đã cấp mã xác thực OTP 6 số bảo mật (hiệu lực 30 giây)!'
        });
    } catch (err) {
        console.error('Lỗi POST /api/marketing/security-code:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 10. POST /api/marketing/verify-security-code - Nhân viên xác thực mã 6 số còn hiệu lực để áp dụng thẻ
router.post('/verify-security-code', (req, res) => {
    try {
        const Member_id = req.body.Member_id || req.body.memberId;
        const Phone = req.body.Phone || req.body.phone;
        const Code = req.body.Code || req.body.code;
        if (!Code || (!Member_id && !Phone)) {
            return res.status(400).json({ success: false, error: 'Vui lòng nhập đầy đủ mã OTP 6 số!' });
        }

        const inputCode = String(Code).trim();
        const db = getDb();
        const mem = db.prepare("SELECT Member_id, Phone, Full_name, Current_tier FROM MEMBERS WHERE Member_id = ? OR Phone = ?").get(Member_id || 0, Phone || '');
        if (!mem) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy thông tin hội viên!' });
        }

        const secRecord = db.prepare(`
            SELECT * FROM MEMBER_SECURITY_CODES 
            WHERE (Member_id = ? OR Phone = ?) AND Is_used = 0 
            ORDER BY Security_id DESC LIMIT 1
        `).get(mem.Member_id, mem.Phone);

        if (!secRecord) {
            db.close();
            return res.status(400).json({ success: false, error: 'Mã xác thực đã hết hiệu lực hoặc chưa được tạo. Vui lòng yêu cầu khách hàng bấm "Làm mới mã"!' });
        }

        const nowMs = Date.now();
        if (nowMs > secRecord.Expires_at) {
            db.close();
            return res.status(400).json({ success: false, error: '⏱️ Mã 6 số đã quá 30 giây và hết hiệu lực! Vui lòng nhờ khách hàng bấm nút làm mới mã để lấy mã mới.' });
        }

        if (String(secRecord.Code) !== inputCode) {
            db.close();
            return res.status(400).json({ success: false, error: '❌ Mã 6 số không chính xác! Vui lòng kiểm tra lại màn hình của khách hàng.' });
        }

        // Đánh dấu mã đã sử dụng một lần (One-Time Password)
        db.prepare("UPDATE MEMBER_SECURITY_CODES SET Is_used = 1 WHERE Security_id = ?").run(secRecord.Security_id);
        db.close();

        // 🌟 Bắn Socket thông báo để phía khách hàng tự động đóng Modal QR & OTP ngay lập tức
        try {
            const io = req.app.get('io');
            if (io) {
                io.emit('customer_security_code_verified', {
                    memberId: mem.Member_id,
                    phone: mem.Phone,
                    fullName: mem.Full_name,
                    timestamp: Date.now()
                });
            }
        } catch (socketErr) {
            console.warn('Lỗi emit customer_security_code_verified:', socketErr.message);
        }

        res.json({
            success: true,
            verified: true,
            memberId: mem.Member_id,
            memberName: mem.Full_name,
            message: `✅ Xác thực danh tính thành công cho khách hàng ${mem.Full_name}! Đã kích hoạt áp dụng thẻ lên giỏ hàng.`
        });
    } catch (err) {
        console.error('Lỗi POST /api/marketing/verify-security-code:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// 11. HỆ THỐNG HẸN ĐẶT LỊCH MARKETING & TỰ ĐỘNG GỬI EMAIL (MARKETING SCHEDULES)
// ==========================================

// Đảm bảo bảng MARKETING_SCHEDULES tồn tại và khởi tạo dữ liệu mẫu
function ensureMarketingSchedulesTable(db) {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS MARKETING_SCHEDULES (
                Schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Schedule_name TEXT NOT NULL,
                Schedule_type TEXT NOT NULL,
                Send_time TEXT DEFAULT '08:00',
                Specific_date TEXT,
                Target_audience TEXT NOT NULL,
                Selected_member_ids TEXT,
                Campaign_id INTEGER,
                Subject TEXT,
                Message TEXT,
                Is_active INTEGER DEFAULT 1,
                Last_run_at DATETIME,
                Last_run_status TEXT,
                Last_run_summary TEXT,
                Created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                Updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        const count = db.prepare("SELECT COUNT(*) as c FROM MARKETING_SCHEDULES").get().c;
        if (count === 0) {
            // Lấy 1 Campaign_id hợp lệ
            const camp = db.prepare("SELECT Campaign_id FROM MARKETING_CAMPAIGNS WHERE Is_active = 1 LIMIT 1").get();
            const campId = camp ? camp.Campaign_id : 1;

            const insertStmt = db.prepare(`
                INSERT INTO MARKETING_SCHEDULES (
                    Schedule_name, Schedule_type, Send_time, Target_audience, Campaign_id, Subject, Message, Is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            `);

            insertStmt.run(
                'Ưu Đãi Ngày Rằm (15 Âm Lịch) - Mua 3 Tính 2 Cho Thành Viên Hạng Mầm',
                'LUNAR_15',
                '08:00',
                'TIER_MAM',
                campId,
                '[Hoa Sen] Ưu Đãi Ngày Rằm 15 Âm Lịch: Mua 3 Tính 2 Cho Hội Viên Mầm Sen',
                'Nhà Hàng Hoa Sen kính gửi tặng Quý khách mã ưu đãi đặc biệt nhân ngày Rằm tháng này. Kính chúc Quý khách và gia đình có một bữa ăn thanh tịnh, an vui!'
            );

            insertStmt.run(
                'Ưu Đãi Mùng 1 Âm Lịch Đầu Tháng Cho Toàn Bộ Hội Viên',
                'LUNAR_1',
                '08:00',
                'ALL_EMAIL',
                campId,
                '[Hoa Sen] Khởi Đầu Tháng Mới An Lạc - Mã Ưu Đãi Mùng 1 Âm Lịch',
                'Đầu tháng bình an và may mắn! Hoa Sen xin gửi tặng Quý khách mã khuyến mãi dùng bữa đầu tháng.'
            );

            insertStmt.run(
                'Mừng Sinh Nhật Hội Viên Trong Tháng',
                'BIRTHDAY_MONTH',
                '08:00',
                'BIRTHDAY_THIS_MONTH',
                campId,
                '[Hoa Sen] Chúc Mừng Sinh Nhật Quý Khách - Quà Tặng Tri Ân Độc Quyền',
                'Nhân dịp tháng sinh nhật của Quý khách, Nhà Hàng Hoa Sen xin gửi lời chúc an lành nhất cùng món quà ưu đãi tri ân!'
            );

            console.log('-> Đã khởi tạo 3 lịch hẹn Marketing tự động mẫu trong CSDL!');
        }
    } catch (e) {
        console.error('Lỗi khởi tạo bảng MARKETING_SCHEDULES:', e.message);
    }
}

// Hàm thực thi gửi chiến dịch theo lịch hẹn
async function executeMarketingScheduleById(scheduleId, isManualTrigger = false, ioInstance = null) {
    const db = getDb();
    ensureMarketingEmailLogsTable(db);
    ensureMarketingSchedulesTable(db);

    try {
        const schedule = db.prepare("SELECT * FROM MARKETING_SCHEDULES WHERE Schedule_id = ?").get(scheduleId);
        if (!schedule) {
            db.close();
            return { success: false, error: 'Không tìm thấy lịch hẹn!' };
        }

        // Tìm chiến dịch liên kết
        let campaign = null;
        if (schedule.Campaign_id) {
            campaign = db.prepare("SELECT * FROM MARKETING_CAMPAIGNS WHERE Campaign_id = ?").get(schedule.Campaign_id);
        }
        if (!campaign) {
            campaign = db.prepare("SELECT * FROM MARKETING_CAMPAIGNS WHERE Is_active = 1 ORDER BY Campaign_id DESC LIMIT 1").get();
        }

        if (!campaign) {
            db.prepare(`
                UPDATE MARKETING_SCHEDULES 
                SET Last_run_at = datetime('now', 'localtime'),
                    Last_run_status = 'FAILED',
                    Last_run_summary = 'Không tìm thấy chiến dịch khuyến mãi liên kết.'
                WHERE Schedule_id = ?
            `).run(scheduleId);
            db.close();
            return { success: false, error: 'Không tìm thấy chiến dịch khuyến mãi nào để áp dụng!' };
        }

        // Lọc đối tượng hội viên nhận mã có Email
        let members = [];
        const aud = schedule.Target_audience || 'ALL_EMAIL';

        if (aud === 'ALL_EMAIL' || aud === 'ALL') {
            members = db.prepare(`
                SELECT Member_id, Full_name, Phone, Email, Current_tier, Birthdate 
                FROM MEMBERS 
                WHERE Email IS NOT NULL AND Email != '' AND (Is_active IS NULL OR Is_active = 1)
            `).all();
        } else if (aud === 'TIER_MAM') {
            members = db.prepare(`
                SELECT Member_id, Full_name, Phone, Email, Current_tier, Birthdate 
                FROM MEMBERS 
                WHERE (Current_tier = 'MAM_SEN' OR Current_tier IS NULL OR Current_tier = '') 
                  AND Email IS NOT NULL AND Email != '' AND (Is_active IS NULL OR Is_active = 1)
            `).all();
        } else if (aud === 'TIER_BUP' || aud === 'TIER_CHOI') {
            members = db.prepare(`
                SELECT Member_id, Full_name, Phone, Email, Current_tier, Birthdate 
                FROM MEMBERS 
                WHERE Current_tier IN ('BUP_SEN', 'CHOI_SEN') 
                  AND Email IS NOT NULL AND Email != '' AND (Is_active IS NULL OR Is_active = 1)
            `).all();
        } else if (aud === 'TIER_HONG' || aud === 'TIER_HOA') {
            members = db.prepare(`
                SELECT Member_id, Full_name, Phone, Email, Current_tier, Birthdate 
                FROM MEMBERS 
                WHERE Current_tier IN ('SEN_HONG', 'HOA_SEN') 
                  AND Email IS NOT NULL AND Email != '' AND (Is_active IS NULL OR Is_active = 1)
            `).all();
        } else if (aud === 'TIER_KIM_CUONG' || aud === 'TIER_VANG') {
            members = db.prepare(`
                SELECT Member_id, Full_name, Phone, Email, Current_tier, Birthdate 
                FROM MEMBERS 
                WHERE Current_tier IN ('SEN_KIM_CUONG', 'SEN_VANG') 
                  AND Email IS NOT NULL AND Email != '' AND (Is_active IS NULL OR Is_active = 1)
            `).all();
        } else if (aud === 'BIRTHDAY_THIS_MONTH' || aud === 'BIRTHDAY') {
            const currentMonth = new Date().getMonth() + 1;
            const currentMonthStr = String(currentMonth).padStart(2, '0');
            members = db.prepare(`
                SELECT Member_id, Full_name, Phone, Email, Current_tier, Birthdate 
                FROM MEMBERS 
                WHERE (
                    strftime('%m', Birthdate) = ? 
                    OR SUBSTR(Birthdate, 6, 2) = ?
                ) AND Email IS NOT NULL AND Email != '' AND (Is_active IS NULL OR Is_active = 1)
            `).all(currentMonthStr, currentMonthStr);
        } else if (aud === 'SELECTED_MEMBERS' || aud === 'SELECTED') {
            let ids = [];
            try { ids = JSON.parse(schedule.Selected_member_ids || '[]'); } catch(e) {}
            if (Array.isArray(ids) && ids.length > 0) {
                const placeholders = ids.map(() => '?').join(',');
                members = db.prepare(`
                    SELECT Member_id, Full_name, Phone, Email, Current_tier, Birthdate 
                    FROM MEMBERS 
                    WHERE Member_id IN (${placeholders}) 
                      AND Email IS NOT NULL AND Email != '' AND (Is_active IS NULL OR Is_active = 1)
                `).all(...ids);
            }
        }

        if (members.length === 0) {
            const summary = 'Không có hội viên nào phù hợp tiêu chí hoặc chưa có địa chỉ Email.';
            db.prepare(`
                UPDATE MARKETING_SCHEDULES 
                SET Last_run_at = datetime('now', 'localtime'),
                    Last_run_status = 'NO_RECIPIENTS',
                    Last_run_summary = ?
                WHERE Schedule_id = ?
            `).run(summary, scheduleId);
            db.close();

            return {
                success: true,
                count: 0,
                message: summary
            };
        }

        // Lấy cấu hình SMTP
        const smtpConfig = getSmtpConfig(db);
        const transporter = createTransporter(smtpConfig);
        const isSmtpConfigured = !!transporter;
        const fromName = smtpConfig.fromName || 'Nhà Hàng Hoa Sen';
        const senderAddress = isSmtpConfigured ? `"${fromName}" <${smtpConfig.user}>` : null;

        // Chuẩn bị thông tin giảm giá
        const discountText = campaign.Discount_type === 'PERCENT'
            ? `Giảm ${campaign.Discount_value}%${campaign.Max_discount_amount ? ` (Tối đa ${Number(campaign.Max_discount_amount).toLocaleString('vi-VN')}đ)` : ''}`
            : `Giảm ${Number(campaign.Discount_value || 0).toLocaleString('vi-VN')}đ`;

        const minOrderNum = Number(campaign.Min_bill_amount || campaign.Min_order_amount || 0);
        const minOrderText = minOrderNum > 0 ? `Đơn từ ${minOrderNum.toLocaleString('vi-VN')}đ` : '';

        // Hạn sử dụng: 30 ngày kể từ lúc phát
        const expiryDateObj = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const expiryDateFormatted = `${String(expiryDateObj.getDate()).padStart(2, '0')}/${String(expiryDateObj.getMonth() + 1).padStart(2, '0')}/${expiryDateObj.getFullYear()}`;
        const expiryIso = expiryDateObj.toISOString().slice(0, 19).replace('T', ' ');

        const defaultSubject = `[Ưu Đãi] Tặng bạn mã giảm giá ${discountText} - ${fromName}`;
        const finalSubject = (schedule.Subject && schedule.Subject.trim()) ? schedule.Subject.trim() : defaultSubject;
        const finalCustomMsg = schedule.Message || '';

        console.log(`\n============================================================`);
        console.log(`⏰ [SCHEDULE DISPATCH] Chạy lịch hẹn [${schedule.Schedule_id}] "${schedule.Schedule_name}"...`);
        console.log(`   - Đối tượng: ${aud} (${members.length} hội viên có email)`);
        console.log(`   - Chiến dịch: [${campaign.Code}] ${campaign.Campaign_name || campaign.Name}`);
        console.log(`============================================================`);

        const insertVoucherStmt = db.prepare(`
            INSERT INTO MEMBER_VOUCHERS (
                Member_id, Campaign_id, Voucher_code, Title, Discount_type, 
                Discount_value, Min_order_amount, Max_discount_amount, Expiry_date, Status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNUSED')
        `);

        const insertLogStmt = db.prepare(`
            INSERT INTO MARKETING_EMAIL_LOGS (
                Campaign_id, Campaign_name, Voucher_code, Member_id, Member_name,
                Email, Phone, Subject, Discount_text, Status, Error_message, Sent_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
        `);

        let successCount = 0;
        let failedCount = 0;

        for (const m of members) {
            const uniqueCode = `${campaign.Code}-${m.Member_id}-${Math.floor(100 + Math.random() * 900)}`;

            // Lưu voucher vào kho thành viên
            try {
                insertVoucherStmt.run(
                    m.Member_id,
                    campaign.Campaign_id,
                    uniqueCode,
                    campaign.Campaign_name || campaign.Name,
                    campaign.Discount_type,
                    campaign.Discount_value,
                    minOrderNum,
                    campaign.Max_discount_amount || null,
                    expiryIso
                );
            } catch (eVouch) {
                console.error(`Lỗi tạo voucher cho ${m.Full_name}:`, eVouch.message);
            }

            // Gửi email
            let sendStatus = 'SUCCESS';
            let sendErrorMsg = null;

            if (!isSmtpConfigured) {
                sendStatus = 'FAILED';
                sendErrorMsg = 'Chưa cấu hình tài khoản SMTP gửi email trong Cài đặt hệ thống.';
                failedCount++;
            } else {
                try {
                    const emailHtml = buildVoucherEmailHtml({
                        memberName: m.Full_name,
                        campaignTitle: campaign.Campaign_name || campaign.Name,
                        voucherCode: uniqueCode,
                        discountText: discountText,
                        minOrderText: minOrderText,
                        expiryDateFormatted: expiryDateFormatted,
                        customMessage: finalCustomMsg,
                        fromName: fromName
                    });

                    await transporter.sendMail({
                        from: senderAddress,
                        to: m.Email,
                        subject: finalSubject,
                        text: `Xin chào ${m.Full_name}! ${fromName} gửi tặng bạn mã giảm giá ${discountText}. Mã ưu đãi: ${uniqueCode}. Hạn dùng: ${expiryDateFormatted}. Cảm ơn bạn!`,
                        html: emailHtml
                    });

                    successCount++;
                } catch (sendErr) {
                    sendStatus = 'FAILED';
                    sendErrorMsg = sendErr.message || 'Lỗi gửi email';
                    failedCount++;
                }
            }

            // Ghi log
            try {
                insertLogStmt.run(
                    campaign.Campaign_id,
                    campaign.Campaign_name || campaign.Name,
                    uniqueCode,
                    m.Member_id,
                    m.Full_name,
                    m.Email,
                    m.Phone || '',
                    finalSubject,
                    discountText,
                    sendStatus,
                    sendErrorMsg
                );
            } catch (eLog) {}
        }

        const runStatus = successCount === members.length ? 'SUCCESS' : (successCount > 0 ? 'PARTIAL' : 'FAILED');
        const summaryText = `Đã gửi thành công ${successCount}/${members.length} email (${failedCount} thất bại).`;

        db.prepare(`
            UPDATE MARKETING_SCHEDULES 
            SET Last_run_at = datetime('now', 'localtime'),
                Last_run_status = ?,
                Last_run_summary = ?,
                Updated_at = datetime('now', 'localtime')
            WHERE Schedule_id = ?
        `).run(runStatus, summaryText, scheduleId);

        db.close();

        if (ioInstance) {
            ioInstance.emit('vouchers_updated');
            ioInstance.emit('marketing_schedule_executed', { scheduleId, successCount, failedCount });
            ioInstance.emit('marketing_emails_sent', {
                campaignId: campaign.Campaign_id,
                total: members.length,
                successCount,
                failedCount
            });
        }

        return {
            success: true,
            total: members.length,
            successCount,
            failedCount,
            summary: summaryText,
            message: `🎉 Đã hoàn tất thực thi lịch hẹn "${schedule.Schedule_name}": ${summaryText}`
        };
    } catch (err) {
        console.error('Lỗi executeMarketingScheduleById:', err);
        try { db.close(); } catch(e) {}
        return { success: false, error: err.message };
    }
}

// Scheduler Timer: Tự động chạy nền kiểm tra mỗi 60 giây
let marketingSchedulerTimer = null;
function startMarketingScheduler(getIoFn) {
    if (marketingSchedulerTimer) clearInterval(marketingSchedulerTimer);

    marketingSchedulerTimer = setInterval(async () => {
        try {
            const db = getDb();
            ensureMarketingSchedulesTable(db);

            // Lấy thời gian hiện tại theo múi giờ Việt Nam (GMT+7)
            const now = new Date();
            const nowUtc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const vnTime = new Date(nowUtc + (3600000 * 7));

            const currentHour = String(vnTime.getHours()).padStart(2, '0');
            const currentMin = String(vnTime.getMinutes()).padStart(2, '0');
            const currentTimeStr = `${currentHour}:${currentMin}`;

            const dd = vnTime.getDate();
            const mm = vnTime.getMonth() + 1;
            const yy = vnTime.getFullYear();
            const todaySolarDate = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;

            let lunarInfo = { lunarDay: 1, lunarMonth: 1, lunarYear: yy };
            try {
                const membersMod = require('./members');
                if (membersMod && membersMod.getTodayLunarInfo) {
                    lunarInfo = membersMod.getTodayLunarInfo(db);
                }
            } catch(eLunar) {}

            const activeSchedules = db.prepare("SELECT * FROM MARKETING_SCHEDULES WHERE Is_active = 1").all();
            db.close();

            for (const sched of activeSchedules) {
                // 1. Nếu đã chạy trong ngày hôm nay rồi -> bỏ qua
                if (sched.Last_run_at) {
                    const lastRunDate = sched.Last_run_at.substring(0, 10);
                    if (lastRunDate === todaySolarDate) {
                        continue;
                    }
                }

                // 2. Kiểm tra giờ gửi
                const targetTime = sched.Send_time || '08:00';
                if (currentTimeStr < targetTime) {
                    continue;
                }

                // 3. Kiểm tra điều kiện lịch
                let matched = false;
                if (sched.Schedule_type === 'LUNAR_1_15') {
                    if (lunarInfo.lunarDay === 1 || lunarInfo.lunarDay === 15) matched = true;
                } else if (sched.Schedule_type === 'LUNAR_1') {
                    if (lunarInfo.lunarDay === 1) matched = true;
                } else if (sched.Schedule_type === 'LUNAR_15') {
                    if (lunarInfo.lunarDay === 15) matched = true;
                } else if (sched.Schedule_type === 'BIRTHDAY_MONTH') {
                    // Chạy vào đầu tháng hoặc mỗi ngày (tự động lọc ra thành viên sinh nhật tháng này)
                    matched = true;
                } else if (sched.Schedule_type === 'SPECIFIC_DATE') {
                    if (sched.Specific_date && sched.Specific_date === todaySolarDate) matched = true;
                } else if (sched.Schedule_type === 'DAILY') {
                    matched = true;
                }

                if (matched) {
                    console.log(`⏰ [AUTO MARKETING ENGINE] Tự động kích hoạt lịch [${sched.Schedule_id}] ${sched.Schedule_name}`);
                    const io = typeof getIoFn === 'function' ? getIoFn() : null;
                    await executeMarketingScheduleById(sched.Schedule_id, false, io);
                }
            }
        } catch (errLoop) {
            console.error('Lỗi marketing scheduler loop:', errLoop.message);
        }
    }, 60000);
}

// Khởi chạy scheduler tự động
try {
    startMarketingScheduler();
} catch(eStart) {}

// ==========================================
// APIS QUẢN LÝ LỊCH HẸN MARKETING
// ==========================================

// 1. GET /api/marketing/schedules - Lấy toàn bộ danh sách lịch hẹn
router.get('/schedules', (req, res) => {
    try {
        const db = getDb();
        ensureMarketingSchedulesTable(db);

        const schedules = db.prepare(`
            SELECT s.*, 
                   c.Campaign_name, c.Code as Campaign_code, c.Discount_type, c.Discount_value
            FROM MARKETING_SCHEDULES s
            LEFT JOIN MARKETING_CAMPAIGNS c ON s.Campaign_id = c.Campaign_id
            ORDER BY s.Is_active DESC, s.Schedule_id DESC
        `).all();

        // Lấy thông tin Âm lịch hôm nay để hiển thị badge
        let lunarInfo = null;
        try {
            const membersMod = require('./members');
            if (membersMod && membersMod.getTodayLunarInfo) {
                lunarInfo = membersMod.getTodayLunarInfo(db);
            }
        } catch(eL) {}

        db.close();
        res.json({ success: true, schedules, lunarInfo });
    } catch (err) {
        console.error('Lỗi GET /api/marketing/schedules:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. GET /api/marketing/schedules/:id - Chi tiết 1 lịch hẹn
router.get('/schedules/:id', (req, res) => {
    try {
        const db = getDb();
        ensureMarketingSchedulesTable(db);
        const schedule = db.prepare("SELECT * FROM MARKETING_SCHEDULES WHERE Schedule_id = ?").get(req.params.id);
        db.close();

        if (!schedule) return res.status(404).json({ success: false, error: 'Không tìm thấy lịch hẹn!' });
        res.json({ success: true, schedule });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. POST /api/marketing/schedules - Tạo lịch hẹn mới
router.post('/schedules', (req, res) => {
    try {
        const {
            Schedule_name,
            Schedule_type = 'LUNAR_15',
            Send_time = '08:00',
            Specific_date = null,
            Target_audience = 'ALL_EMAIL',
            Selected_member_ids = '[]',
            Campaign_id = null,
            Subject = '',
            Message = '',
            Is_active = 1
        } = req.body;

        if (!Schedule_name) {
            return res.status(400).json({ success: false, error: 'Vui lòng nhập tên lịch hẹn Marketing!' });
        }

        const db = getDb();
        ensureMarketingSchedulesTable(db);

        const stmt = db.prepare(`
            INSERT INTO MARKETING_SCHEDULES (
                Schedule_name, Schedule_type, Send_time, Specific_date,
                Target_audience, Selected_member_ids, Campaign_id, Subject, Message, Is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
            Schedule_name.trim(),
            Schedule_type,
            Send_time || '08:00',
            Specific_date || null,
            Target_audience,
            typeof Selected_member_ids === 'object' ? JSON.stringify(Selected_member_ids) : (Selected_member_ids || '[]'),
            Campaign_id ? Number(Campaign_id) : null,
            Subject || '',
            Message || '',
            Number(Is_active ?? 1)
        );

        db.close();

        const io = req.app.get('io');
        if (io) io.emit('marketing_schedules_updated');

        res.json({
            success: true,
            Schedule_id: info.lastInsertRowid,
            message: 'Đã tạo lịch hẹn Marketing tự động thành công!'
        });
    } catch (err) {
        console.error('Lỗi POST /api/marketing/schedules:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. PUT /api/marketing/schedules/:id - Cập nhật lịch hẹn
router.put('/schedules/:id', (req, res) => {
    try {
        const id = req.params.id;
        const {
            Schedule_name,
            Schedule_type,
            Send_time,
            Specific_date,
            Target_audience,
            Selected_member_ids,
            Campaign_id,
            Subject,
            Message,
            Is_active
        } = req.body;

        const db = getDb();
        ensureMarketingSchedulesTable(db);

        db.prepare(`
            UPDATE MARKETING_SCHEDULES
            SET Schedule_name = COALESCE(?, Schedule_name),
                Schedule_type = COALESCE(?, Schedule_type),
                Send_time = COALESCE(?, Send_time),
                Specific_date = COALESCE(?, Specific_date),
                Target_audience = COALESCE(?, Target_audience),
                Selected_member_ids = COALESCE(?, Selected_member_ids),
                Campaign_id = COALESCE(?, Campaign_id),
                Subject = COALESCE(?, Subject),
                Message = COALESCE(?, Message),
                Is_active = COALESCE(?, Is_active),
                Updated_at = datetime('now', 'localtime')
            WHERE Schedule_id = ?
        `).run(
            Schedule_name ? Schedule_name.trim() : null,
            Schedule_type || null,
            Send_time || null,
            Specific_date || null,
            Target_audience || null,
            typeof Selected_member_ids === 'object' ? JSON.stringify(Selected_member_ids) : (Selected_member_ids || null),
            Campaign_id ? Number(Campaign_id) : null,
            Subject !== undefined ? Subject : null,
            Message !== undefined ? Message : null,
            Is_active !== undefined ? Number(Is_active) : null,
            id
        );

        db.close();

        const io = req.app.get('io');
        if (io) io.emit('marketing_schedules_updated');

        res.json({ success: true, message: 'Cập nhật lịch hẹn thành công!' });
    } catch (err) {
        console.error('Lỗi PUT /api/marketing/schedules/:id:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. PUT /api/marketing/schedules/:id/toggle - Bật / Tắt kích hoạt lịch hẹn
router.put('/schedules/:id/toggle', (req, res) => {
    try {
        const id = req.params.id;
        const db = getDb();
        ensureMarketingSchedulesTable(db);

        const current = db.prepare("SELECT Is_active FROM MARKETING_SCHEDULES WHERE Schedule_id = ?").get(id);
        if (!current) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy lịch hẹn!' });
        }

        const newStatus = current.Is_active === 1 ? 0 : 1;
        db.prepare("UPDATE MARKETING_SCHEDULES SET Is_active = ?, Updated_at = datetime('now', 'localtime') WHERE Schedule_id = ?").run(newStatus, id);
        db.close();

        const io = req.app.get('io');
        if (io) io.emit('marketing_schedules_updated');

        res.json({
            success: true,
            Is_active: newStatus,
            message: newStatus === 1 ? 'Đã kích hoạt lịch hẹn!' : 'Đã tạm dừng lịch hẹn!'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. DELETE /api/marketing/schedules/:id - Xóa lịch hẹn
router.delete('/schedules/:id', (req, res) => {
    try {
        const id = req.params.id;
        const db = getDb();
        ensureMarketingSchedulesTable(db);

        db.prepare("DELETE FROM MARKETING_SCHEDULES WHERE Schedule_id = ?").run(id);
        db.close();

        const io = req.app.get('io');
        if (io) io.emit('marketing_schedules_updated');

        res.json({ success: true, message: 'Đã xóa lịch hẹn Marketing thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 7. POST /api/marketing/schedules/:id/run-now - Thực thi lịch hẹn ngay lập tức
router.post('/schedules/:id/run-now', async (req, res) => {
    try {
        const id = req.params.id;
        const io = req.app.get('io');
        const result = await executeMarketingScheduleById(id, true, io);

        if (io) io.emit('marketing_schedules_updated');

        res.json(result);
    } catch (err) {
        console.error('Lỗi run-now:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
module.exports.ensureMarketingSchedulesTable = ensureMarketingSchedulesTable;
module.exports.executeMarketingScheduleById = executeMarketingScheduleById;
module.exports.startMarketingScheduler = startMarketingScheduler;


