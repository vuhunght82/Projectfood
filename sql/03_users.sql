CREATE TABLE IF NOT EXISTS USERS (
    User_id INTEGER PRIMARY KEY AUTOINCREMENT,
    User_name TEXT UNIQUE NOT NULL,
    User_password TEXT NOT NULL,
    Role TEXT CHECK(Role IN ('ADMIN', 'CASHIER', 'KITCHEN', 'WAITER', 'CUSTOMER')) DEFAULT 'WAITER',
    Created_at DATETIME DEFAULT (DATETIME('now', 'localtime'))
);

-- Thêm tài khoản admin mặc định nếu chưa có
INSERT OR IGNORE INTO USERS (User_name, User_password, Role) VALUES ('admin', '123456', 'ADMIN');
INSERT OR IGNORE INTO USERS (User_name, User_password, Role) VALUES ('vu', '123456', 'ADMIN');