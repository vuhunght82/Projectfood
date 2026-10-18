const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.db');

// Tự động nâng cấp cấu trúc bảng USERS với đầy đủ thông tin cá nhân & nhân sự
function ensureUsersSchema(db) {
    try {
        const cols = db.prepare('PRAGMA table_info(USERS)').all().map(c => c.name);
        const addCol = (colName, colDef) => {
            if (!cols.includes(colName)) {
                try {
                    db.exec(`ALTER TABLE USERS ADD COLUMN ${colName} ${colDef}`);
                } catch (e) {}
            }
        };

        addCol('Full_name', 'TEXT');
        addCol('Gender', "TEXT DEFAULT 'Khác'");
        addCol('Birthday', 'TEXT');
        addCol('Phone', 'TEXT');
        addCol('Email', 'TEXT');
        addCol('Address', 'TEXT');
        addCol('Citizen_id', 'TEXT');
        addCol('Shift', "TEXT DEFAULT 'Toàn thời gian'");
        addCol('Hire_date', 'TEXT');
        addCol('Emergency_contact', 'TEXT');
        addCol('Position_note', 'TEXT');
        addCol('Status', "TEXT DEFAULT 'ACTIVE'");
        addCol('Created_at', 'DATETIME');
        addCol('Updated_at', 'DATETIME');
        addCol('Password_changed_at', 'DATETIME');
        addCol('Member_id', 'INTEGER');

        // Đồng bộ dữ liệu mặc định cho các tài khoản cũ chưa có họ tên hoặc ngày sửa
        db.exec(`
            UPDATE USERS 
            SET Created_at = COALESCE(Created_at, datetime('now', 'localtime')),
                Updated_at = COALESCE(Updated_at, Created_at, datetime('now', 'localtime')),
                Status = COALESCE(NULLIF(Status, ''), 'ACTIVE'),
                Gender = COALESCE(NULLIF(Gender, ''), 'Khác'),
                Shift = CASE 
                    WHEN Role = 'CUSTOMER' THEN COALESCE(NULLIF(Shift, ''), 'Khách hàng')
                    ELSE COALESCE(NULLIF(Shift, ''), 'Toàn thời gian')
                END
            WHERE Created_at IS NULL OR Updated_at IS NULL OR Status IS NULL OR Gender IS NULL OR Shift IS NULL
        `);

        // Đồng bộ thông tin từ bảng MEMBERS sang USERS đối với tài khoản khách hàng chưa có Full_name
        try {
            db.exec(`
                UPDATE USERS
                SET Full_name = COALESCE(NULLIF(Full_name, ''), (SELECT m.Full_name FROM MEMBERS m WHERE m.Member_id = USERS.Member_id OR m.Phone = USERS.Phone LIMIT 1)),
                    Birthday = COALESCE(NULLIF(Birthday, ''), (SELECT m.Birthdate FROM MEMBERS m WHERE m.Member_id = USERS.Member_id OR m.Phone = USERS.Phone LIMIT 1)),
                    Email = COALESCE(NULLIF(Email, ''), (SELECT m.Email FROM MEMBERS m WHERE m.Member_id = USERS.Member_id OR m.Phone = USERS.Phone LIMIT 1)),
                    Gender = CASE
                        WHEN (SELECT m.Gender FROM MEMBERS m WHERE m.Member_id = USERS.Member_id OR m.Phone = USERS.Phone LIMIT 1) = 'MALE' THEN 'Nam'
                        WHEN (SELECT m.Gender FROM MEMBERS m WHERE m.Member_id = USERS.Member_id OR m.Phone = USERS.Phone LIMIT 1) = 'FEMALE' THEN 'Nữ'
                        ELSE COALESCE(NULLIF(Gender, ''), 'Khác')
                    END
                WHERE Role = 'CUSTOMER' AND (Full_name IS NULL OR Full_name = '')
            `);
        } catch (eMemSync) {}

        // Điền tên hiển thị mặc định cho các nhân viên hiện có nếu Full_name đang trống
        const defaultStaffProfiles = {
            'vu': { fullName: 'Nguyễn Hoàng Vũ (Quản Lý)', gender: 'Nam', shift: 'Toàn thời gian', note: 'Quản lý điều hành hệ thống' },
            'admin': { fullName: 'Quản Trị Viên Hệ Thống', gender: 'Nam', shift: 'Toàn thời gian', note: 'Quản trị toàn quyền' },
            'quanly': { fullName: 'Quản Lý Nhà Hàng', gender: 'Nữ', shift: 'Toàn thời gian', note: 'Quản lý giám sát ca' },
            'quay': { fullName: 'Thu Ngân Quầy Chính', gender: 'Nữ', shift: 'Ca Sáng', note: 'Phụ trách thu ngân & két tiền' },
            'cashier1': { fullName: 'Thu Ngân Ca 1', gender: 'Nữ', shift: 'Ca Chiều/Tối', note: 'Thu ngân ca chiều' },
            'bep1': { fullName: 'Đầu Bếp Chính (Bếp 1)', gender: 'Nam', shift: 'Toàn thời gian', note: 'Bếp trưởng món chay' },
            'bep2': { fullName: 'Đầu Bếp Phụ (Bếp 2)', gender: 'Nam', shift: 'Ca Chiều/Tối', note: 'Phụ bếp & ra món' },
            'boi': { fullName: 'Nhân Viên Phục Vụ 1', gender: 'Nam', shift: 'Ca Sáng', note: 'Phục vụ bàn & order' },
            'boi2': { fullName: 'Nhân Viên Phục Vụ 2', gender: 'Nữ', shift: 'Ca Chiều/Tối', note: 'Phục vụ bàn & giao món' },
            'a': { fullName: 'Nhân Viên Thu Ngân A', gender: 'Nữ', shift: 'Bán thời gian', note: 'Nhân viên hỗ trợ' }
        };

        const stmtUpdateDefault = db.prepare(`
            UPDATE USERS 
            SET Full_name = ?, Gender = COALESCE(NULLIF(Gender, 'Khác'), ?), Shift = COALESCE(NULLIF(Shift, ''), ?), Position_note = COALESCE(NULLIF(Position_note, ''), ?)
            WHERE LOWER(User_name) = ? AND (Full_name IS NULL OR TRIM(Full_name) = '')
        `);

        for (const [uname, info] of Object.entries(defaultStaffProfiles)) {
            stmtUpdateDefault.run(info.fullName, info.gender, info.shift, info.note, uname);
        }
    } catch (err) {
        console.error('Lỗi ensureUsersSchema:', err.message);
    }
}

// Khởi chạy nâng cấp CSDL ngay khi nạp route
try {
    const initDb = new Database(DB_PATH);
    ensureUsersSchema(initDb);
    initDb.close();
} catch (eInit) {
    console.error('Không thể khởi tạo schema USERS:', eInit.message);
}

// Chuẩn hóa đối tượng user trả về cho Client
function normalizeUserRow(u) {
    if (!u) return null;
    const roleVal = u.Role || u.role || u.User_role || 'WAITER';
    return {
        User_id: u.User_id || u.user_id || u.id,
        User_name: u.User_name || u.user_name || u.username || '',
        User_password: u.User_password || u.user_password || u.Password || '',
        User_role: roleVal,
        Role: roleVal,
        Full_name: u.Full_name || u.full_name || u.User_name || '',
        Gender: u.Gender || 'Khác',
        Birthday: u.Birthday || '',
        Phone: u.Phone || '',
        Email: u.Email || '',
        Address: u.Address || '',
        Citizen_id: u.Citizen_id || '',
        Shift: u.Shift || (roleVal === 'CUSTOMER' ? 'Khách hàng' : 'Toàn thời gian'),
        Hire_date: u.Hire_date || '',
        Emergency_contact: u.Emergency_contact || '',
        Position_note: u.Position_note || '',
        Status: u.Status || 'ACTIVE',
        Member_id: u.Member_id || null,
        Created_at: u.Created_at || u.created_at || '',
        Updated_at: u.Updated_at || u.updated_at || u.Created_at || '',
        Password_changed_at: u.Password_changed_at || ''
    };
}

// GET: Lấy danh sách toàn bộ người dùng
router.get('/', (req, res) => {
    try {
        const db = new Database(DB_PATH);
        ensureUsersSchema(db);
        const rawUsers = db.prepare(`
            SELECT * FROM USERS
            ORDER BY 
                CASE Role
                    WHEN 'ADMIN' THEN 1
                    WHEN 'CASHIER' THEN 2
                    WHEN 'WAITER' THEN 3
                    WHEN 'KITCHEN' THEN 4
                    ELSE 5
                END ASC,
                User_id DESC
        `).all();
        db.close();

        const users = rawUsers.map(normalizeUserRow);
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi CSDL: ' + err.message });
    }
});

// GET: Lấy chi tiết 1 người dùng theo ID
router.get('/:id', (req, res) => {
    try {
        const db = new Database(DB_PATH, { readonly: true });
        const row = db.prepare('SELECT * FROM USERS WHERE User_id = ?').get(req.params.id);
        db.close();
        if (!row) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng!' });
        }
        res.json({ success: true, user: normalizeUserRow(row) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST: Thêm người dùng mới với đầy đủ thông tin cá nhân & nhân sự
router.post('/', (req, res) => {
    try {
        const {
            User_name,
            User_password,
            User_role,
            Role,
            Full_name,
            Gender,
            Birthday,
            Phone,
            Email,
            Address,
            Citizen_id,
            Shift,
            Hire_date,
            Emergency_contact,
            Position_note,
            Status
        } = req.body;

        const cleanUsername = String(User_name || '').trim();
        const cleanPassword = String(User_password || '').trim();

        if (!cleanUsername || !cleanPassword) {
            return res.status(400).json({ error: 'Tên đăng nhập và Mật khẩu không được để trống!' });
        }

        const roleInput = String(User_role || Role || 'WAITER').toUpperCase();
        const validRole = ['ADMIN', 'CASHIER', 'KITCHEN', 'WAITER', 'CUSTOMER'].includes(roleInput)
            ? roleInput
            : 'WAITER';

        const validStatus = ['ACTIVE', 'LOCKED'].includes(String(Status || '').toUpperCase())
            ? String(Status).toUpperCase()
            : 'ACTIVE';

        const db = new Database(DB_PATH);
        ensureUsersSchema(db);

        // Kiểm tra trùng tên đăng nhập
        const existing = db.prepare('SELECT User_id FROM USERS WHERE LOWER(User_name) = LOWER(?)').get(cleanUsername);
        if (existing) {
            db.close();
            return res.status(400).json({ error: `Tên đăng nhập "${cleanUsername}" đã tồn tại trong hệ thống!` });
        }

        const stmt = db.prepare(`
            INSERT INTO USERS (
                User_name, User_password, Role, Full_name, Gender, Birthday,
                Phone, Email, Address, Citizen_id, Shift, Hire_date,
                Emergency_contact, Position_note, Status,
                Created_at, Updated_at, Password_changed_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?,
                datetime('now', 'localtime'), datetime('now', 'localtime'), datetime('now', 'localtime')
            )
        `);

        const result = stmt.run(
            cleanUsername,
            cleanPassword,
            validRole,
            String(Full_name || cleanUsername).trim(),
            String(Gender || 'Khác').trim(),
            String(Birthday || '').trim(),
            String(Phone || '').trim(),
            String(Email || '').trim(),
            String(Address || '').trim(),
            String(Citizen_id || '').trim(),
            String(Shift || (validRole === 'CUSTOMER' ? 'Khách hàng' : 'Toàn thời gian')).trim(),
            String(Hire_date || '').trim(),
            String(Emergency_contact || '').trim(),
            String(Position_note || '').trim(),
            validStatus
        );

        const newUser = db.prepare('SELECT * FROM USERS WHERE User_id = ?').get(result.lastInsertRowid);
        db.close();

        res.json({
            success: true,
            message: 'Tạo tài khoản và hồ sơ người dùng thành công!',
            user: normalizeUserRow(newUser)
        });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Tên đăng nhập này đã tồn tại!' });
        }
        res.status(500).json({ error: err.message });
    }
});

// POST: Nhân viên / Người dùng tự đổi mật khẩu (hoặc Quản lý đổi mật khẩu)
router.post('/change-password', (req, res) => {
    try {
        const { User_id, User_name, currentPassword, newPassword, adminOverride } = req.body;

        if (!newPassword || String(newPassword).trim().length < 1) {
            return res.status(400).json({ error: 'Vui lòng nhập mật khẩu mới!' });
        }

        const db = new Database(DB_PATH);
        ensureUsersSchema(db);

        let userRow = null;
        if (User_id) {
            userRow = db.prepare('SELECT * FROM USERS WHERE User_id = ?').get(User_id);
        }
        if (!userRow && User_name) {
            userRow = db.prepare('SELECT * FROM USERS WHERE LOWER(User_name) = LOWER(?)').get(String(User_name).trim());
        }

        if (!userRow) {
            db.close();
            return res.status(404).json({ error: 'Không tìm thấy tài khoản người dùng!' });
        }

        // Nếu không phải chế độ Admin cấp lại mật khẩu thì bắt buộc kiểm tra mật khẩu hiện tại
        if (!adminOverride) {
            const curPwdInput = String(currentPassword || '').trim();
            const actualPwd = String(userRow.User_password || '').trim();
            if (!curPwdInput) {
                db.close();
                return res.status(400).json({ error: 'Vui lòng nhập mật khẩu hiện tại để xác thực!' });
            }
            if (curPwdInput !== actualPwd) {
                db.close();
                return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác!' });
            }
        }

        const cleanNewPwd = String(newPassword).trim();

        db.prepare(`
            UPDATE USERS 
            SET User_password = ?,
                Updated_at = datetime('now', 'localtime'),
                Password_changed_at = datetime('now', 'localtime')
            WHERE User_id = ?
        `).run(cleanNewPwd, userRow.User_id);

        // Nếu tài khoản có liên kết với bảng MEMBERS thì đồng bộ mật khẩu sang MEMBERS
        if (userRow.Member_id || userRow.Phone) {
            try {
                db.prepare(`
                    UPDATE MEMBERS 
                    SET Password = ?, Updated_at = datetime('now', 'localtime')
                    WHERE Member_id = ? OR Phone = ?
                `).run(cleanNewPwd, userRow.Member_id || -1, userRow.Phone || '');
            } catch (eMem) {}
        }

        const updatedUser = db.prepare('SELECT * FROM USERS WHERE User_id = ?').get(userRow.User_id);
        db.close();

        res.json({
            success: true,
            message: 'Đổi mật khẩu thành công!',
            user: normalizeUserRow(updatedUser)
        });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi khi đổi mật khẩu: ' + err.message });
    }
});

// PUT: Nhân viên tự cập nhật hồ sơ cá nhân (& tùy chọn đổi mật khẩu)
router.put('/self-profile/:id', (req, res) => {
    try {
        const userId = req.params.id;
        const {
            Full_name,
            Gender,
            Birthday,
            Phone,
            Email,
            Address,
            Citizen_id,
            Emergency_contact,
            currentPassword,
            newPassword
        } = req.body;

        const db = new Database(DB_PATH);
        ensureUsersSchema(db);

        const existing = db.prepare('SELECT * FROM USERS WHERE User_id = ?').get(userId);
        if (!existing) {
            db.close();
            return res.status(404).json({ error: 'Không tìm thấy tài khoản của bạn!' });
        }

        let finalPassword = existing.User_password;
        let pwdChangedSql = '';

        // Nếu người dùng có nhập mật khẩu mới để đổi luôn
        if (newPassword && String(newPassword).trim().length > 0) {
            const curPwdInput = String(currentPassword || '').trim();
            if (curPwdInput !== String(existing.User_password || '').trim()) {
                db.close();
                return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác, không thể đổi mật khẩu mới!' });
            }
            finalPassword = String(newPassword).trim();
            pwdChangedSql = ", Password_changed_at = datetime('now', 'localtime')";
        }

        db.prepare(`
            UPDATE USERS
            SET Full_name = ?,
                Gender = ?,
                Birthday = ?,
                Phone = ?,
                Email = ?,
                Address = ?,
                Citizen_id = ?,
                Emergency_contact = ?,
                User_password = ?,
                Updated_at = datetime('now', 'localtime')
                ${pwdChangedSql}
            WHERE User_id = ?
        `).run(
            String(Full_name ?? existing.Full_name ?? '').trim(),
            String(Gender ?? existing.Gender ?? 'Khác').trim(),
            String(Birthday ?? existing.Birthday ?? '').trim(),
            String(Phone ?? existing.Phone ?? '').trim(),
            String(Email ?? existing.Email ?? '').trim(),
            String(Address ?? existing.Address ?? '').trim(),
            String(Citizen_id ?? existing.Citizen_id ?? '').trim(),
            String(Emergency_contact ?? existing.Emergency_contact ?? '').trim(),
            finalPassword,
            userId
        );

        const updated = db.prepare('SELECT * FROM USERS WHERE User_id = ?').get(userId);
        db.close();

        res.json({
            success: true,
            message: 'Đã cập nhật thông tin cá nhân thành công!',
            user: normalizeUserRow(updated)
        });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi cập nhật hồ sơ cá nhân: ' + err.message });
    }
});

// PUT: Cập nhật toàn bộ thông tin người dùng (Dành cho Quản trị viên)
router.put('/:id', (req, res) => {
    try {
        const userId = req.params.id;
        const {
            User_name,
            User_password,
            User_role,
            Role,
            Full_name,
            Gender,
            Birthday,
            Phone,
            Email,
            Address,
            Citizen_id,
            Shift,
            Hire_date,
            Emergency_contact,
            Position_note,
            Status
        } = req.body;

        const db = new Database(DB_PATH);
        ensureUsersSchema(db);

        const existing = db.prepare('SELECT * FROM USERS WHERE User_id = ?').get(userId);
        if (!existing) {
            db.close();
            return res.status(404).json({ error: 'Không tìm thấy tài khoản cần sửa!' });
        }

        const cleanUsername = String(User_name || existing.User_name || '').trim();
        const cleanPassword = String(User_password !== undefined && User_password !== '' ? User_password : existing.User_password).trim();

        // Kiểm tra trùng User_name với người khác
        const conflictUser = db.prepare('SELECT User_id FROM USERS WHERE LOWER(User_name) = LOWER(?) AND User_id != ?').get(cleanUsername, userId);
        if (conflictUser) {
            db.close();
            return res.status(400).json({ error: `Tên đăng nhập "${cleanUsername}" đã được sử dụng bởi tài khoản khác!` });
        }

        const roleInput = String(User_role || Role || existing.Role || 'WAITER').toUpperCase();
        const validRole = ['ADMIN', 'CASHIER', 'KITCHEN', 'WAITER', 'CUSTOMER'].includes(roleInput)
            ? roleInput
            : (existing.Role || 'WAITER');

        const validStatus = ['ACTIVE', 'LOCKED'].includes(String(Status || '').toUpperCase())
            ? String(Status).toUpperCase()
            : (existing.Status || 'ACTIVE');

        const isPasswordChanged = cleanPassword !== String(existing.User_password || '');
        const pwdChangedSql = isPasswordChanged ? ", Password_changed_at = datetime('now', 'localtime')" : '';

        db.prepare(`
            UPDATE USERS 
            SET User_name = ?,
                User_password = ?,
                Role = ?,
                Full_name = ?,
                Gender = ?,
                Birthday = ?,
                Phone = ?,
                Email = ?,
                Address = ?,
                Citizen_id = ?,
                Shift = ?,
                Hire_date = ?,
                Emergency_contact = ?,
                Position_note = ?,
                Status = ?,
                Updated_at = datetime('now', 'localtime')
                ${pwdChangedSql}
            WHERE User_id = ?
        `).run(
            cleanUsername,
            cleanPassword,
            validRole,
            String(Full_name ?? existing.Full_name ?? cleanUsername).trim(),
            String(Gender ?? existing.Gender ?? 'Khác').trim(),
            String(Birthday ?? existing.Birthday ?? '').trim(),
            String(Phone ?? existing.Phone ?? '').trim(),
            String(Email ?? existing.Email ?? '').trim(),
            String(Address ?? existing.Address ?? '').trim(),
            String(Citizen_id ?? existing.Citizen_id ?? '').trim(),
            String(Shift ?? existing.Shift ?? 'Toàn thời gian').trim(),
            String(Hire_date ?? existing.Hire_date ?? '').trim(),
            String(Emergency_contact ?? existing.Emergency_contact ?? '').trim(),
            String(Position_note ?? existing.Position_note ?? '').trim(),
            validStatus,
            userId
        );

        // Nếu có liên kết hội viên, đồng bộ mật khẩu và thông tin cơ bản
        if (existing.Member_id) {
            try {
                db.prepare(`
                    UPDATE MEMBERS
                    SET Full_name = COALESCE(NULLIF(?, ''), Full_name),
                        Phone = COALESCE(NULLIF(?, ''), Phone),
                        Email = COALESCE(NULLIF(?, ''), Email),
                        Birthdate = COALESCE(NULLIF(?, ''), Birthdate),
                        Password = ?,
                        Updated_at = datetime('now', 'localtime')
                    WHERE Member_id = ?
                `).run(
                    String(Full_name || '').trim(),
                    String(Phone || '').trim(),
                    String(Email || '').trim(),
                    String(Birthday || '').trim(),
                    cleanPassword,
                    existing.Member_id
                );
            } catch (eSync) {}
        }

        const updated = db.prepare('SELECT * FROM USERS WHERE User_id = ?').get(userId);
        db.close();

        res.json({
            success: true,
            message: 'Cập nhật hồ sơ người dùng thành công!',
            user: normalizeUserRow(updated)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT: Khóa / Mở khóa nhanh trạng thái tài khoản
router.put('/:id/status', (req, res) => {
    try {
        const userId = req.params.id;
        const { Status } = req.body;
        const nextStatus = String(Status || '').toUpperCase() === 'LOCKED' ? 'LOCKED' : 'ACTIVE';

        const db = new Database(DB_PATH);
        ensureUsersSchema(db);
        db.prepare(`
            UPDATE USERS 
            SET Status = ?, Updated_at = datetime('now', 'localtime')
            WHERE User_id = ?
        `).run(nextStatus, userId);
        const updated = db.prepare('SELECT * FROM USERS WHERE User_id = ?').get(userId);
        db.close();

        res.json({
            success: true,
            message: nextStatus === 'LOCKED' ? 'Đã tạm khóa tài khoản!' : 'Đã kích hoạt lại tài khoản!',
            user: normalizeUserRow(updated)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Xóa người dùng
router.delete('/:id', (req, res) => {
    try {
        const db = new Database(DB_PATH);
        db.prepare('DELETE FROM USERS WHERE User_id = ?').run(req.params.id);
        db.close();
        res.json({ success: true, message: 'Xóa tài khoản thành công!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;