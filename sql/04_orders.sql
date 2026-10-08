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
