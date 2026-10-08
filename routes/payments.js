const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.db');

// Tự động khởi tạo bảng PAYMENT_METHODS nếu chưa có
(function initPaymentTable() {
    try {
        const db = new Database(DB_PATH);
        db.exec(`
            CREATE TABLE IF NOT EXISTS PAYMENT_METHODS (
                Payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Payment_code TEXT UNIQUE NOT NULL,
                Payment_name TEXT NOT NULL,
                Guide_info TEXT,
                Is_active INTEGER DEFAULT 1
            );
        `);
        
        const count = db.prepare('SELECT count(*) as total FROM PAYMENT_METHODS').get().total;
        if (count === 0) {
            const insert = db.prepare('INSERT INTO PAYMENT_METHODS (Payment_code, Payment_name, Guide_info) VALUES (?, ?, ?)');
            insert.run('CASH', 'Tiền Mặt', 'Thanh toán trực tiếp tại quầy');
            insert.run('BANK_TRANSFER', 'Chuyển Khoản QR Ngân Hàng', 'Quét mã VietQR chuyển khoản');
            insert.run('MOMO', 'Ví Điện Tử MoMo', 'Chuyển tiền qua SĐT MoMo');
            insert.run('CARD', 'Thẻ Visa / Mastercard', 'Quẹt thẻ qua máy POS');
        }
        db.close();
    } catch (e) {
        console.error('Lỗi tạo bảng PAYMENT_METHODS:', e.message);
    }
})();

// GET: Lấy danh sách phương thức thanh toán
router.get('/', (req, res) => {
    try {
        const db = new Database(DB_PATH, { readonly: true });
        const list = db.prepare('SELECT * FROM PAYMENT_METHODS ORDER BY Payment_id ASC').all();
        db.close();
        res.json(list);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST: Thêm mới phương thức thanh toán
router.post('/', (req, res) => {
    try {
        const { Payment_code, Payment_name, Guide_info, Is_active } = req.body;
        const db = new Database(DB_PATH);
        db.prepare('INSERT INTO PAYMENT_METHODS (Payment_code, Payment_name, Guide_info, Is_active) VALUES (?, ?, ?, ?)')
          .run(Payment_code, Payment_name, Guide_info || '', Is_active !== undefined ? Is_active : 1);
        db.close();
        res.json({ success: true, message: 'Thêm phương thức thành công!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT: Cập nhật phương thức thanh toán
router.put('/:id', (req, res) => {
    try {
        const { Payment_code, Payment_name, Guide_info, Is_active } = req.body;
        const db = new Database(DB_PATH);
        db.prepare('UPDATE PAYMENT_METHODS SET Payment_code = ?, Payment_name = ?, Guide_info = ?, Is_active = ? WHERE Payment_id = ?')
          .run(Payment_code, Payment_name, Guide_info || '', Is_active, req.params.id);
        db.close();
        res.json({ success: true, message: 'Cập nhật thành công!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE: Xóa phương thức thanh toán
router.delete('/:id', (req, res) => {
    try {
        const db = new Database(DB_PATH);
        db.prepare('DELETE FROM PAYMENT_METHODS WHERE Payment_id = ?').run(req.params.id);
        db.close();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;