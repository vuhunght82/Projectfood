-- Kích hoạt khóa ngoại
PRAGMA foreign_keys = ON;

-- ==========================================
-- 1. BẢNG DANH MỤC MÓN (CATEGORIES)
-- ==========================================
CREATE TABLE IF NOT EXISTS CATEGORIES (
    Category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    Category_name TEXT NOT NULL UNIQUE,     -- Tên danh mục (VD: "Lẩu Chay", "Món Điểm Tâm", "Nước Uống")
    Display_order INTEGER DEFAULT 0,        -- Thứ tự hiển thị trên menu
    Is_active INTEGER DEFAULT 1 CHECK (Is_active IN (0, 1)), -- 1: Hiện, 0: Ẩn
    Created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- ==========================================
-- 2. BẢNG MÓN ĂN / THỰC ĐƠN (MENU_ITEMS)
-- ==========================================
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

-- ==========================================
-- 3. BẢNG ĐƠN HÀNG (ORDERS)
-- ==========================================
CREATE TABLE IF NOT EXISTS ORDERS (
    Order_id INTEGER PRIMARY KEY AUTOINCREMENT,
    Order_code TEXT UNIQUE NOT NULL,
    Order_type TEXT DEFAULT 'DINE_IN',
    Table_number TEXT,
    Customer_name TEXT,
    Payment_method TEXT DEFAULT 'CASH',     -- Phương thức thanh toán (CASH, BANK_TRANSFER, MOMO, CARD)
    Final_amount REAL DEFAULT 0,
    Note TEXT,
    Created_at DATETIME DEFAULT (datetime('now', 'localtime'))
);

-- ==========================================
-- 4. BẢNG CHI TIẾT ĐƠN HÀNG (ORDER_DETAILS)
-- ==========================================
CREATE TABLE IF NOT EXISTS ORDER_DETAILS (
    Detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
    Order_id INTEGER NOT NULL,
    Item_name TEXT NOT NULL,
    Quantity INTEGER NOT NULL DEFAULT 1,
    Unit_price REAL NOT NULL DEFAULT 0,
    Total_price REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (Order_id) REFERENCES ORDERS(Order_id) ON DELETE CASCADE
);

-- ==========================================
-- 5. BẢNG NGƯỜI DÙNG (USERS)
-- ==========================================
CREATE TABLE IF NOT EXISTS USERS (
    User_id INTEGER PRIMARY KEY AUTOINCREMENT,
    User_name TEXT UNIQUE NOT NULL,
    User_password TEXT NOT NULL,
    Full_name TEXT,
    Role TEXT DEFAULT 'CUSTOMER',
    Created_at DATETIME DEFAULT (datetime('now', 'localtime'))
);