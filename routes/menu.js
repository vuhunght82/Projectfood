const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../database.db');
const UPLOAD_DIR = path.join(__dirname, '../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `dish-${Date.now()}${ext}`);
    }
});
const upload = multer({ storage });

// GET: Lấy danh sách món ăn
router.get('/menu', (req, res) => {
    try {
        const db = new Database(DB_PATH, { readonly: true });
        const items = db.prepare('SELECT * FROM MENU_ITEMS ORDER BY Item_id DESC').all();
        db.close();
        res.json(items || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST: Thêm món mới
router.post('/menu', upload.single('image'), (req, res) => {
    try {
        const { Category_id, Item_code, Item_name, Base_price, Cost_price, Is_available, Printer_target, Image_url, Description, Toppings } = req.body;
        
        let finalImageUrl = Image_url || '/uploads/dish-sample.jpg';
        if (req.file) {
            finalImageUrl = `/uploads/${req.file.filename}`;
        }

        const db = new Database(DB_PATH);
        const stmt = db.prepare(`
            INSERT INTO MENU_ITEMS 
            (Category_id, Item_code, Item_name, Base_price, Cost_price, Is_available, Printer_target, Image_url, Description, Toppings)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
            Category_id, Item_code, Item_name, 
            Base_price || 0, Cost_price || 0, 
            Is_available ?? 1, Printer_target || 'KITCHEN_MAIN', 
            finalImageUrl, Description || '',
            typeof Toppings === 'string' ? Toppings : JSON.stringify(Toppings || [])
        );
        db.close();

        res.json({ success: true, id: info.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT: Cập nhật món ăn
router.put('/menu/:id', upload.single('image'), (req, res) => {
    try {
        const itemId = req.params.id;
        const { Category_id, Item_code, Item_name, Base_price, Cost_price, Is_available, Printer_target, Image_url, Description, Toppings } = req.body;

        const db = new Database(DB_PATH);
        
        let finalImageUrl = Image_url;
        if (req.file) {
            finalImageUrl = `/uploads/${req.file.filename}`;
        } else if (!finalImageUrl) {
            const currentItem = db.prepare('SELECT Image_url FROM MENU_ITEMS WHERE Item_id = ?').get(itemId);
            finalImageUrl = currentItem ? currentItem.Image_url : '/uploads/dish-sample.jpg';
        }

        const stmt = db.prepare(`
            UPDATE MENU_ITEMS SET 
                Category_id = ?, 
                Item_code = ?, 
                Item_name = ?, 
                Base_price = ?, 
                Cost_price = ?, 
                Is_available = ?, 
                Printer_target = ?, 
                Image_url = ?, 
                Description = ?,
                Toppings = ?
            WHERE Item_id = ?
        `);

        stmt.run(
            Category_id, Item_code, Item_name, 
            Base_price || 0, Cost_price || 0, 
            Is_available ?? 1, Printer_target || 'KITCHEN_MAIN', 
            finalImageUrl, Description || '',
            typeof Toppings === 'string' ? Toppings : JSON.stringify(Toppings || []),
            itemId
        );
        db.close();

        res.json({ success: true, message: 'Cập nhật món thành công' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Xóa món ăn
router.delete('/menu/:id', (req, res) => {
    try {
        const db = new Database(DB_PATH);
        const stmt = db.prepare('DELETE FROM MENU_ITEMS WHERE Item_id = ?');
        stmt.run(req.params.id);
        db.close();
        res.json({ message: 'Đã xóa món thành công' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;