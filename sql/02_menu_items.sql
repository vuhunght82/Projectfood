CREATE TABLE IF NOT EXISTS MENU_ITEMS (
    Item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    Category_id INTEGER NOT NULL,
    Item_code TEXT NOT NULL UNIQUE,          -- Mã món (VD: CHAY01, NUOC02)
    Item_name TEXT NOT NULL,                 -- Tên món (VD: "Lẩu nấm thanh ngọt", "Phở chay Tẩm Bổ")
    Base_price INTEGER NOT NULL,             -- Giá bán (VNĐ)
    Cost_price INTEGER DEFAULT 0,            -- Giá vốn ước tính (VNĐ)
    Image_url TEXT,                          -- Đường dẫn ảnh món ăn
    Description TEXT,                        -- Mô tả món ăn
    Is_available INTEGER DEFAULT 1 CHECK (Is_available IN (0, 1)), -- 1: Còn món, 0: Hết món
    Printer_target TEXT DEFAULT 'KITCHEN_MAIN', -- Định tuyến máy in bếp (VD: KITCHEN_MAIN, BAR)
    Created_at TEXT DEFAULT (datetime('now', 'localtime')),
    
    FOREIGN KEY (Category_id) REFERENCES CATEGORIES(Category_id) ON DELETE CASCADE
); -- Đã sửa: Thêm dấu đóng ngoặc ) và dấu ; ở đây