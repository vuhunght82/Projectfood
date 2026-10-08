CREATE TABLE IF NOT EXISTS ORDER_LOGS (
            Log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            Order_code TEXT NOT NULL,
            Modified_by TEXT DEFAULT 'Hệ thống',
            Old_content TEXT,
            New_content TEXT,
            Modified_at DATETIME DEFAULT (datetime('now', 'localtime'))
        )