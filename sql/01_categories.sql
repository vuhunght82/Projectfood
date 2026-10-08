CREATE TABLE IF NOT EXISTS CATEGORIES (
    Category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    Category_name TEXT NOT NULL UNIQUE,     -- Tên danh mục (VD: "Lẩu Chay", "Món Điểm Tâm", "Nước Uống")
    Display_order INTEGER DEFAULT 0,        -- Thứ tự hiển thị trên menu
    Is_active INTEGER DEFAULT 1 CHECK (Is_active IN (0, 1)), -- 1: Hiện, 0: Ẩn
    Created_at TEXT DEFAULT (datetime('now', 'localtime'))
);