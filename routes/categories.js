const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.db');

// GET: Lấy danh sách danh mục (BẮT BỘC PHẢI CÓ)
router.get('/categories', (req, res) => {
    try {
        const db = new Database(DB_PATH, { readonly: true });
        const categories = db.prepare('SELECT * FROM CATEGORIES ORDER BY Display_order ASC').all();
        db.close();
        res.json(categories || []);
    } catch (err) {
        console.error('Lỗi GET /api/categories:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST: Thêm danh mục
router.post('/categories', (req, res) => {
    try {
        const { Category_name, Display_order } = req.body;
        const db = new Database(DB_PATH);
        const stmt = db.prepare('INSERT INTO CATEGORIES (Category_name, Display_order) VALUES (?, ?)');
        const info = stmt.run(Category_name, Display_order || 1);
        db.close();
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT: Cập nhật danh mục
router.put('/categories/:id', (req, res) => {
    try {
        const { Category_name, Display_order } = req.body;
        const db = new Database(DB_PATH);
        const stmt = db.prepare('UPDATE CATEGORIES SET Category_name = ?, Display_order = ? WHERE Category_id = ?');
        stmt.run(Category_name, Display_order || 1, req.params.id);
        db.close();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Xóa danh mục
router.delete('/categories/:id', (req, res) => {
    try {
        const db = new Database(DB_PATH);
        const stmt = db.prepare('DELETE FROM CATEGORIES WHERE Category_id = ?');
        stmt.run(req.params.id);
        db.close();
        res.json({ message: 'Đã xóa danh mục thành công' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;