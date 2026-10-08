const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.db');

// GET: Lấy danh sách người dùng
router.get('/', (req, res) => {
    try {
        const db = new Database(DB_PATH, { readonly: true });
        const rawUsers = db.prepare('SELECT * FROM USERS').all();
        db.close();

        const users = rawUsers.map(u => ({
            User_id: u.User_id || u.user_id || u.id,
            User_name: u.User_name || u.user_name || u.username || '',
            User_password: u.User_password || u.user_password || '******',
            User_role: u.Role || u.role || u.User_role || 'WAITER',
            Created_at: u.Created_at || u.created_at || ''
        }));

        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi CSDL: ' + err.message });
    }
});

// POST: Thêm người dùng mới
router.post('/', (req, res) => {
    try {
        const { User_name, User_password, User_role } = req.body;
        if (!User_name || !User_password) {
            return res.status(400).json({ error: 'Tên đăng nhập và Mật khẩu không được để trống!' });
        }

        const validRole = ['ADMIN', 'CASHIER', 'KITCHEN', 'WAITER', 'CUSTOMER'].includes(User_role) 
            ? User_role 
            : 'WAITER';

        const db = new Database(DB_PATH);
        const stmt = db.prepare('INSERT INTO USERS (User_name, User_password, Role) VALUES (?, ?, ?)');
        stmt.run(User_name, User_password, validRole);
        db.close();

        res.json({ success: true, message: 'Tạo tài khoản thành công!' });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Tên đăng nhập này đã tồn tại!' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT: Cập nhật thông tin người dùng
router.put('/:id', (req, res) => {
    try {
        const { User_name, User_password, User_role } = req.body;
        const db = new Database(DB_PATH);
        db.prepare('UPDATE USERS SET User_name = ?, User_password = ?, Role = ? WHERE User_id = ?')
          .run(User_name, User_password, User_role, req.params.id);
        db.close();
        res.json({ success: true, message: 'Cập nhật thành công!' });
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