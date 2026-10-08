const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { Server } = require('socket.io');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.set('io', io);

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.db');

// Cấu hình Multer cho tải ảnh QR, File âm thanh hệ thống & Banner TV Smart
const systemStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const upDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(upDir)) fs.mkdirSync(upDir, { recursive: true });
        cb(null, upDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        let prefix = 'file';
        if (file.fieldname === 'soundFile') prefix = 'sound';
        else if (file.fieldname === 'qrImage') prefix = 'qr';
        else if (file.fieldname === 'bannerImage') prefix = 'banner';
        else if (file.fieldname === 'musicFile' || (file.mimetype && file.mimetype.startsWith('audio/'))) prefix = 'ambient_music';
        else if (file.fieldname === 'bgImage') prefix = 'tv_bg';
        cb(null, `${prefix}_${Date.now()}${ext}`);
    }
});
const systemUpload = multer({ storage: systemStorage });

// ==========================================
// 1. KHỞI TẠO CSDL SQLITE & BỔ SUNG CỘT / BẢNG
// ==========================================
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

function initDatabase() {
    try {
        const addColumnSafe = (sql) => {
            try { db.prepare(sql).run(); } catch (e) { /* Cột đã tồn tại */ }
        };

        // Bổ sung các cột bắt buộc vào bảng ORDERS
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Total_amount REAL DEFAULT 0;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Final_amount REAL DEFAULT 0;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Table_id TEXT DEFAULT '';");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Table_name TEXT DEFAULT '';");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Table_number TEXT DEFAULT '';");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Status TEXT DEFAULT 'PROCESSING';");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Order_code TEXT DEFAULT '';");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Cancel_role TEXT;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Cancel_reason TEXT;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Is_edited INTEGER DEFAULT 0;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Updated_at DATETIME;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Note TEXT;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Staff_name TEXT;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Created_by TEXT;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Delivery_platform TEXT DEFAULT '';");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Customer_phone TEXT DEFAULT '';");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Delivery_address TEXT DEFAULT '';");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Shipping_fee REAL DEFAULT 0;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Payment_type TEXT DEFAULT 'COD';");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Shipping_status TEXT DEFAULT 'PENDING';");
        addColumnSafe("ALTER TABLE ORDER_DETAILS ADD COLUMN Note TEXT;");
        addColumnSafe("ALTER TABLE ORDER_DETAILS ADD COLUMN Toppings TEXT;");
        addColumnSafe("ALTER TABLE MENU_ITEMS ADD COLUMN Toppings TEXT;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Member_id INTEGER;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Member_phone TEXT DEFAULT '';");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Member_name TEXT DEFAULT '';");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Member_tier TEXT DEFAULT '';");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Discount_percent REAL DEFAULT 0;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Discount_amount REAL DEFAULT 0;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Points_used INTEGER DEFAULT 0;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Points_amount REAL DEFAULT 0;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Points_earned INTEGER DEFAULT 0;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Prepaid_used REAL DEFAULT 0;");

        // Tạo bảng DELIVERY_PLATFORMS để quản lý nền tảng giao hàng
        db.exec(`
            CREATE TABLE IF NOT EXISTS DELIVERY_PLATFORMS (
                Platform_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Platform_name TEXT NOT NULL,
                Platform_code TEXT NOT NULL UNIQUE,
                Fee_percentage REAL DEFAULT 0,
                Icon_class TEXT DEFAULT 'fa-solid fa-motorcycle',
                Color_code TEXT DEFAULT '#ff5722',
                Is_active INTEGER DEFAULT 1,
                Sort_order INTEGER DEFAULT 0,
                Created_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Khởi tạo các nền tảng phổ biến nếu bảng chưa có dữ liệu
        try {
            const countPlatforms = db.prepare(`SELECT COUNT(*) as count FROM DELIVERY_PLATFORMS`).get().count;
            if (countPlatforms === 0) {
                const stmtInitPlat = db.prepare(`
                    INSERT INTO DELIVERY_PLATFORMS (Platform_name, Platform_code, Fee_percentage, Icon_class, Color_code, Sort_order)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);
                stmtInitPlat.run('GrabFood', 'GRABFOOD', 20, 'fa-solid fa-motorcycle', '#00b14f', 1);
                stmtInitPlat.run('ShopeeFood', 'SHOPEEFOOD', 20, 'fa-solid fa-bag-shopping', '#ee4d2d', 2);
                stmtInitPlat.run('BeFood', 'BEFOOD', 20, 'fa-solid fa-motorcycle', '#ffcc00', 3);
                stmtInitPlat.run('Hotline Quán', 'HOTLINE', 0, 'fa-solid fa-phone', '#2e7d32', 4);
                stmtInitPlat.run('Khách Lấy (Mang Về)', 'TAKEAWAY', 0, 'fa-solid fa-box-archive', '#0288d1', 5);
            }
        } catch (eInitPlat) {}

        // Tạo bảng USERS nếu chưa có
        db.exec(`
            CREATE TABLE IF NOT EXISTS USERS (
                User_id INTEGER PRIMARY KEY AUTOINCREMENT,
                User_name TEXT UNIQUE NOT NULL,
                Password TEXT NOT NULL,
                Full_name TEXT,
                Role TEXT DEFAULT 'WAITER',
                Phone TEXT
            );
        `);

        // Tạo bảng ORDER_LOGS để ghi vết lịch sử chỉnh sửa
        db.exec(`
            CREATE TABLE IF NOT EXISTS ORDER_LOGS (
                Log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Order_code TEXT NOT NULL,
                Modified_by TEXT DEFAULT 'Hệ thống',
                Old_content TEXT,
                New_content TEXT,
                Modified_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Tạo bảng LOGIN_HISTORY để ghi nhận thiết bị, vị trí GPS và lịch sử đăng nhập
        db.exec(`
            CREATE TABLE IF NOT EXISTS LOGIN_HISTORY (
                History_id INTEGER PRIMARY KEY AUTOINCREMENT,
                User_id INTEGER,
                Username TEXT NOT NULL,
                Full_name TEXT,
                Role TEXT,
                User_type TEXT DEFAULT 'STAFF',
                Client_ip TEXT,
                User_agent TEXT,
                Device_info TEXT,
                Latitude REAL,
                Longitude REAL,
                Location_address TEXT,
                Distance_to_restaurant REAL,
                Status TEXT DEFAULT 'SUCCESS',
                Note TEXT,
                Login_time DATETIME DEFAULT (datetime('now', 'localtime')),
                Logout_time DATETIME
            );
        `);

        // Migration thêm cột Payment_status, Paid_by, Paid_at an toàn
        try {
            db.exec("ALTER TABLE ORDERS ADD COLUMN Payment_status TEXT DEFAULT 'UNPAID';");
        } catch (e) {}
        try {
            db.exec("ALTER TABLE ORDERS ADD COLUMN Paid_by TEXT;");
        } catch (e) {}
        try {
            db.exec("ALTER TABLE ORDERS ADD COLUMN Paid_at DATETIME;");
        } catch (e) {}

        // Tạo bảng STAFF_KPI_LOGS để ghi nhận KPI & nhật ký nhân viên
        db.exec(`
            CREATE TABLE IF NOT EXISTS STAFF_KPI_LOGS (
                Log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Staff_username TEXT NOT NULL,
                Staff_name TEXT,
                Staff_role TEXT,
                Action_type TEXT NOT NULL,
                Order_id INTEGER,
                Order_code TEXT,
                Table_number TEXT,
                Amount REAL DEFAULT 0,
                Item_count INTEGER DEFAULT 0,
                Note TEXT,
                Created_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Tạo bảng SYSTEM_CONFIG để lưu cấu hình Máy in, Mẫu Bill, Âm thanh & Phân quyền
        db.exec(`
            CREATE TABLE IF NOT EXISTS SYSTEM_CONFIG (
                Key TEXT PRIMARY KEY,
                Value TEXT,
                Updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Bổ sung cột Guest_count cho ORDERS
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Guest_count INTEGER DEFAULT 1;");

        // Tạo bảng DINING_TABLES lưu danh sách phòng bàn & số ghế
        db.exec(`
            CREATE TABLE IF NOT EXISTS DINING_TABLES (
                Table_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Table_code TEXT UNIQUE NOT NULL,
                Table_name TEXT NOT NULL,
                Area TEXT DEFAULT 'Tầng 1',
                Capacity INTEGER DEFAULT 4,
                Current_guests INTEGER DEFAULT 0,
                Status TEXT DEFAULT 'EMPTY',
                Current_order_id INTEGER,
                Current_order_code TEXT,
                Current_amount REAL DEFAULT 0,
                Payment_status TEXT DEFAULT 'UNPAID',
                Note TEXT,
                Sort_order INTEGER DEFAULT 0,
                Created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                Updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Tạo bảng GUEST_LOGS lưu lịch sử khách ngồi bàn để thống kê lượng khách
        db.exec(`
            CREATE TABLE IF NOT EXISTS GUEST_LOGS (
                Log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Table_id INTEGER,
                Table_name TEXT,
                Order_id INTEGER,
                Order_code TEXT,
                Guest_count INTEGER DEFAULT 1,
                Action_type TEXT,
                Staff_username TEXT,
                Note TEXT,
                Created_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Khởi tạo danh sách bàn mẫu nếu chưa có dữ liệu
        const tableCountCheck = db.prepare("SELECT COUNT(*) as count FROM DINING_TABLES").get();
        if (tableCountCheck.count === 0) {
            const stmtTableInsert = db.prepare(`
                INSERT INTO DINING_TABLES (Table_code, Table_name, Area, Capacity, Sort_order)
                VALUES (?, ?, ?, ?, ?)
            `);
            const defaultTables = [
                // Tầng 1
                ['B01', 'Bàn 01', 'Tầng 1', 4, 1],
                ['B02', 'Bàn 02', 'Tầng 1', 4, 2],
                ['B03', 'Bàn 03', 'Tầng 1', 2, 3],
                ['B04', 'Bàn 04', 'Tầng 1', 6, 4],
                ['B05', 'Bàn 05', 'Tầng 1', 4, 5],
                ['B06', 'Bàn 06', 'Tầng 1', 8, 6],
                // Tầng 2
                ['B07', 'Bàn 07', 'Tầng 2', 4, 7],
                ['B08', 'Bàn 08', 'Tầng 2', 4, 8],
                ['B09', 'Bàn 09', 'Tầng 2', 6, 9],
                ['B10', 'Bàn 10', 'Tầng 2', 4, 10],
                // Sân Vườn
                ['SV01', 'Bàn SV 01', 'Sân Vườn', 4, 11],
                ['SV02', 'Bàn SV 02', 'Sân Vườn', 6, 12],
                // Phòng VIP
                ['VIP01', 'Phòng VIP 1', 'Phòng VIP', 10, 13],
                ['VIP02', 'Phòng VIP 2', 'Phòng VIP', 12, 14]
            ];
            for (const t of defaultTables) {
                stmtTableInsert.run(t[0], t[1], t[2], t[3], t[4]);
            }
            console.log("-> Đã khởi tạo 14 bàn ăn mặc định cho nhà hàng!");
        }

        // Khởi tạo tài khoản mặc định
        const stmtCheck = db.prepare("SELECT COUNT(*) as count FROM USERS WHERE User_name = ?");
        if (stmtCheck.get('vu').count === 0) {
            const stmtInsert = db.prepare(`
                INSERT INTO USERS (User_name, Password, Full_name, Role, Phone)
                VALUES (?, ?, ?, ?, ?)
            `);
            stmtInsert.run('vu', '111', 'Vũ (Quản Lý)', 'ADMIN', '0901234567');
            stmtInsert.run('bep', '111', 'Bếp Hoa Sen', 'KITCHEN', '0907654321');
            stmtInsert.run('thu-ngan', '111', 'Thu Ngân', 'CASHIER', '0908888888');
            console.log("-> Đã tạo các tài khoản mặc định (vu/111, bep/111)");
        }

        // Tạo bảng PROMOTION_BANNERS cho màn hình TV Nhận Món
        db.exec(`
            CREATE TABLE IF NOT EXISTS PROMOTION_BANNERS (
                Banner_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Title TEXT NOT NULL,
                Subtitle TEXT,
                Badge_text TEXT DEFAULT 'MỚI',
                Price_text TEXT,
                Image_url TEXT NOT NULL,
                Sort_order INTEGER DEFAULT 0,
                Is_active INTEGER DEFAULT 1,
                Created_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Khởi tạo các banner quảng cáo món mới / combo mẫu
        const bannerCount = db.prepare("SELECT COUNT(*) as count FROM PROMOTION_BANNERS").get();
        if (bannerCount.count === 0) {
            const stmtBanner = db.prepare(`
                INSERT INTO PROMOTION_BANNERS (Title, Subtitle, Badge_text, Price_text, Image_url, Sort_order, Is_active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            `);
            stmtBanner.run("Combo Cơm Chay An Lạc", "Đầy đủ khai vị, món chính & canh dưỡng sinh thanh tịnh", "COMBO HOT", "Chỉ từ 79.000đ", "/uploads/dish-sample.jpg", 1);
            stmtBanner.run("Lẩu Nấm Thập Cẩm Hoa Sen", "Hương vị nấm tươi thanh ngọt tự nhiên, ấm lòng sum vầy", "GIẢM 20%", "Chỉ 189.000đ", "/uploads/dish-sample.jpg", 2);
            stmtBanner.run("Gỏi Cuốn Ngũ Sắc Thanh Vị", "Món mới tuần này - thanh mát, giòn ngọt chấm sốt mè rang", "MÓN MỚI", "Chỉ 45.000đ", "/uploads/dish-sample.jpg", 3);
            stmtBanner.run("Trà Hạt Sen Long Nhãn Tuyết Nhĩ", "Giải nhiệt thanh mát, bồi bổ cơ thể, an thần ngủ ngon", "ƯU ĐÃI", "Chỉ 35.000đ", "/uploads/dish-sample.jpg", 4);
            console.log("-> Đã khởi tạo 4 banner khuyến mại món mới mẫu cho Smart TV!");
        }

        // Khởi tạo cấu hình mặc định cho Smart TV Nhận Món nếu chưa có
        const defaultTvConfigs = [
            ['tv_banner_enabled', '1'],
            ['tv_banner_position', 'TOP'],
            ['tv_banner_effect', 'slide'],
            ['tv_banner_speed', '800'],
            ['tv_banner_interval', '5'],
            ['tv_bg_type', 'COLOR'],
            ['tv_bg_value', '#f4fbf5'],
            ['tv_screensaver_enabled', '1'],
            ['tv_screensaver_idle_seconds', '30'],
            ['tv_ambient_music_enabled', '0'],
            ['tv_ambient_music_volume', '35'],
            ['tv_ambient_music_url', ''],
            ['shift_start_time', '06:00'],
            ['shift_end_time', '22:30'],
            ['auto_clear_on_shift_end', '1'],
            ['auto_clear_previous_day', '1']
        ];
        const stmtSysCheck = db.prepare("SELECT Value FROM SYSTEM_CONFIG WHERE Key = ?");
        const stmtSysInsert = db.prepare("INSERT INTO SYSTEM_CONFIG (Key, Value, Updated_at) VALUES (?, ?, datetime('now', 'localtime'))");
        defaultTvConfigs.forEach(([k, v]) => {
            if (!stmtSysCheck.get(k)) {
                stmtSysInsert.run(k, v);
            }
        });

        // Tạo bảng PREPAID_PACKAGES (Cấu hình Gói Nạp Ví Trả Trước Động)
        db.exec(`
            CREATE TABLE IF NOT EXISTS PREPAID_PACKAGES (
                Package_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                Topup_amount REAL NOT NULL,
                Bonus_amount REAL DEFAULT 0,
                Total_received REAL NOT NULL,
                Badge_text TEXT DEFAULT '',
                Bg_color TEXT DEFAULT '#f1f8e9',
                Border_color TEXT DEFAULT '#2e7d32',
                Text_color TEXT DEFAULT '#2e7d32',
                Description TEXT DEFAULT '',
                Sort_order INTEGER DEFAULT 0,
                Is_active INTEGER DEFAULT 1,
                Created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                Updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Khởi tạo 3 gói nạp trả trước mẫu nếu chưa có
        try {
            const countPrepaid = db.prepare("SELECT COUNT(*) as count FROM PREPAID_PACKAGES").get().count;
            if (countPrepaid === 0) {
                const stmtPrepaidInit = db.prepare(`
                    INSERT INTO PREPAID_PACKAGES (
                        Name, Topup_amount, Bonus_amount, Total_received, Badge_text, Bg_color, Border_color, Text_color, Description, Sort_order, Is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                `);
                stmtPrepaidInit.run('Gói An Lạc', 1000000, 100000, 1100000, '+ TẶNG 100.000 đ', '#f1f8e9', '#2e7d32', '#2e7d32', 'Nạp 1.000.000đ tặng 100.000đ vào số dư ví', 1);
                stmtPrepaidInit.run('Gói Tinh Tấn', 2000000, 250000, 2250000, '+ TẶNG 250.000 đ', '#e3f2fd', '#0288d1', '#0288d1', 'Nạp 2.000.000đ tặng 250.000đ vào số dư ví', 2);
                stmtPrepaidInit.run('Gói Hỷ Xả', 5000000, 750000, 5750000, '+ TẶNG 750.000 đ', '#fff8e1', '#f59e0b', '#b45309', 'Nạp 5.000.000đ tặng 750.000đ vào số dư ví', 3);
                console.log("-> Đã khởi tạo 3 gói nạp ví trả trước mẫu trong CSDL!");
            }
        } catch (ePrepaidInit) {
            console.error('Lỗi khởi tạo gói ví trả trước:', ePrepaidInit.message);
        }

        // Tạo bảng FLOATING_QUICK_BUTTONS (Quản lý các nút icon nổi phía dưới: Giỏ hàng, Grab, Shopee, Hotline...)
        db.exec(`
            CREATE TABLE IF NOT EXISTS FLOATING_QUICK_BUTTONS (
                Button_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Button_label TEXT NOT NULL,
                Icon_class TEXT NOT NULL,
                Bg_color TEXT NOT NULL,
                Action_type TEXT NOT NULL,
                Action_target TEXT DEFAULT '',
                Tooltip_text TEXT DEFAULT '',
                Sort_order INTEGER DEFAULT 0,
                Is_active INTEGER DEFAULT 1,
                Created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                Updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Khởi tạo các nút icon nổi mặc định phía dưới nếu chưa có
        try {
            const countFloatBtns = db.prepare("SELECT COUNT(*) as count FROM FLOATING_QUICK_BUTTONS").get().count;
            if (countFloatBtns === 0) {
                const stmtFloatInit = db.prepare(`
                    INSERT INTO FLOATING_QUICK_BUTTONS (
                        Button_label, Icon_class, Bg_color, Action_type, Action_target, Tooltip_text, Sort_order, Is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                `);
                stmtFloatInit.run('GrabFood', 'fa-solid fa-motorcycle', '#00b14f', 'SHIPPER_PLATFORM', 'GRABFOOD', 'Đặt đơn Shipper GrabFood', 1);
                stmtFloatInit.run('ShopeeFood', 'fa-solid fa-bag-shopping', '#ee4d2d', 'SHIPPER_PLATFORM', 'SHOPEEFOOD', 'Đặt đơn Shipper ShopeeFood', 2);
                stmtFloatInit.run('Hotline Quán', 'fa-solid fa-phone', '#0288d1', 'HOTLINE', 'HOTLINE', 'Gọi hotline hỗ trợ & đặt bàn', 3);
                console.log("-> Đã khởi tạo các nút icon nổi phía dưới mẫu trong CSDL!");
            }
        } catch (eFloatInit) {
            console.error('Lỗi khởi tạo nút icon nổi:', eFloatInit.message);
        }

        // Tạo bảng MEMBER_TIERS (Cấu hình Hạng Thẻ Hội Viên Động)
        db.exec(`
            CREATE TABLE IF NOT EXISTS MEMBER_TIERS (
                Tier_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Tier_code TEXT UNIQUE NOT NULL,
                Tier_name TEXT NOT NULL,
                Badge_title TEXT DEFAULT '',
                Icon TEXT DEFAULT '🪷',
                Min_spent REAL DEFAULT 0,
                Discount_percent REAL DEFAULT 0,
                Point_rate REAL DEFAULT 0.03,
                Birthday_reward TEXT DEFAULT '',
                Color TEXT DEFAULT '#2e7d32',
                Card_bg TEXT DEFAULT 'linear-gradient(135deg, #1b5e20, #4caf50)',
                Text_color TEXT DEFAULT '#ffffff',
                Sort_order INTEGER DEFAULT 0,
                Is_default INTEGER DEFAULT 0,
                Is_active INTEGER DEFAULT 1,
                Created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                Updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Khởi tạo 4 hạng thẻ mặc định Hoa Sen nếu bảng chưa có
        try {
            const countTiers = db.prepare("SELECT COUNT(*) as count FROM MEMBER_TIERS").get().count;
            if (countTiers === 0) {
                const stmtTierInit = db.prepare(`
                    INSERT INTO MEMBER_TIERS (
                        Tier_code, Tier_name, Badge_title, Icon, Min_spent, 
                        Discount_percent, Point_rate, Birthday_reward, Color, Card_bg, Text_color, Sort_order, Is_default, Is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                `);
                stmtTierInit.run('MAM_SEN', 'Mầm Sen', 'Thành viên mới', '🌱', 0, 0, 0.03, 'Tặng 01 món tráng miệng thanh tịnh trong tuần sinh nhật', '#2e7d32', 'linear-gradient(135deg, #1b5e20, #4caf50)', '#ffffff', 1, 1);
                stmtTierInit.run('BUP_SEN', 'Búp Sen', 'Hạng Bạc', '🪷', 2000000, 5, 0.03, 'Tặng voucher 50.000đ dịp sinh nhật', '#0288d1', 'linear-gradient(135deg, #0277bd, #00b0ff)', '#ffffff', 2, 0);
                stmtTierInit.run('SEN_HONG', 'Sen Hồng', 'Hạng Vàng', '🌸', 6000000, 10, 0.05, 'Tặng voucher 100.000đ + Ưu tiên giữ bàn đẹp', '#d81b60', 'linear-gradient(135deg, #ad1457, #f06292)', '#ffffff', 3, 0);
                stmtTierInit.run('SEN_KIM_CUONG', 'Sen Kim Cương', 'Hạng VIP', '💎', 15000000, 15, 0.05, 'Quà tri ân đặc biệt + Miễn phí phòng riêng/VIP', '#6a1b9a', 'linear-gradient(135deg, #4a148c, #ab47bc, #f59e0b)', '#ffffff', 4, 0);
                console.log("-> Đã khởi tạo 4 hạng thẻ thành viên mặc định trong CSDL!");
            }
        } catch (eTierInit) {
            console.error('Lỗi khởi tạo hạng thẻ mẫu:', eTierInit.message);
        }

        // Tạo bảng MEMBER_LOGS (Nhật ký biến động hạng thẻ, điều chỉnh chi tiêu, điểm, ví & cấu hình)
        db.exec(`
            CREATE TABLE IF NOT EXISTS MEMBER_LOGS (
                Log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Member_id INTEGER,
                Member_name TEXT,
                Member_phone TEXT,
                Action_type TEXT NOT NULL,
                Old_tier TEXT,
                New_tier TEXT,
                Old_value TEXT,
                New_value TEXT,
                Reason TEXT,
                Staff_name TEXT DEFAULT 'Hệ thống',
                Created_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Tạo bảng MEMBERS (Thành viên / Hội viên Chay Hoa Sen)
        db.exec(`
            CREATE TABLE IF NOT EXISTS MEMBERS (
                Member_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Phone TEXT NOT NULL UNIQUE,
                Full_name TEXT NOT NULL,
                Birthdate TEXT,
                Gender TEXT DEFAULT 'OTHER',
                Current_tier TEXT DEFAULT 'MAM_SEN',
                Total_spent REAL DEFAULT 0,
                Reward_points INTEGER DEFAULT 0,
                Prepaid_balance REAL DEFAULT 0,
                Tier_expiry DATETIME,
                Card_code TEXT UNIQUE,
                Notes TEXT,
                Is_active INTEGER DEFAULT 1,
                Created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                Updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Tạo bảng POINT_TRANSACTIONS (Lịch sử giao dịch điểm & nạp ví)
        db.exec(`
            CREATE TABLE IF NOT EXISTS POINT_TRANSACTIONS (
                Transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Member_id INTEGER NOT NULL,
                Order_id INTEGER,
                Order_code TEXT,
                Points_added INTEGER DEFAULT 0,
                Points_used INTEGER DEFAULT 0,
                Amount_applied REAL DEFAULT 0,
                Prepaid_added REAL DEFAULT 0,
                Prepaid_used REAL DEFAULT 0,
                Type TEXT NOT NULL,
                Description TEXT,
                Created_by TEXT,
                Created_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Khởi tạo các hội viên mẫu đại diện 4 hạng hoa sen nếu chưa có
        try {
            const countMembers = db.prepare("SELECT COUNT(*) as count FROM MEMBERS").get().count;
            if (countMembers === 0) {
                const stmtInitMem = db.prepare(`
                    INSERT INTO MEMBERS (Phone, Full_name, Birthdate, Gender, Current_tier, Total_spent, Reward_points, Prepaid_balance, Card_code, Notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                // 1. Mầm Sen
                stmtInitMem.run('0912345678', 'Chị Lan (Mầm Sen)', '1995-10-05', 'FEMALE', 'MAM_SEN', 450000, 13, 0, 'HS-345678', 'Khách thích ăn nấm đùi gà, ít đường');
                // 2. Búp Sen
                stmtInitMem.run('0987654321', 'Anh Tuấn (Búp Sen)', '1988-08-15', 'MALE', 'BUP_SEN', 3200000, 96, 0, 'HS-654321', 'Khách quen văn phòng, ăn trưa thứ 2,4,6');
                // 3. Sen Hồng
                stmtInitMem.run('0903112233', 'Cô Tâm (Sen Hồng)', '1970-10-03', 'FEMALE', 'SEN_HONG', 8500000, 425, 500000, 'HS-112233', 'Khách VIP ăn trường, thường đi cùng gia đình dịp cuối tuần');
                // 4. Sen Kim Cương
                stmtInitMem.run('0909888999', 'Bác Thiện Tâm (Sen Kim Cương VIP)', '1962-12-01', 'MALE', 'SEN_KIM_CUONG', 18000000, 900, 2000000, 'HS-888999', 'Khách VIP thân thiết lâu năm, ưu tiên giữ bàn góc thanh tịnh');
                console.log("-> Đã khởi tạo 4 hội viên đại diện 4 hạng Hoa Sen mẫu!");
            }
        } catch (eMemInit) {
            console.error('Lỗi khởi tạo hội viên mẫu:', eMemInit.message);
        }

        // Bổ sung các cột Marketing & Email cho MEMBERS & ORDERS
        addColumnSafe("ALTER TABLE MEMBERS ADD COLUMN Email TEXT;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Voucher_code TEXT;");
        addColumnSafe("ALTER TABLE ORDERS ADD COLUMN Voucher_discount REAL DEFAULT 0;");

        // Tạo bảng MARKETING_CAMPAIGNS (Quản lý chiến dịch quảng cáo, giảm giá, sự kiện)
        db.exec(`
            CREATE TABLE IF NOT EXISTS MARKETING_CAMPAIGNS (
                Campaign_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT,
                Campaign_name TEXT,
                Code TEXT UNIQUE NOT NULL,
                Type TEXT,
                Campaign_type TEXT,
                Discount_type TEXT DEFAULT 'PERCENT',
                Discount_value REAL NOT NULL,
                Min_order_amount REAL DEFAULT 0,
                Min_bill_amount REAL DEFAULT 0,
                Max_discount_amount REAL DEFAULT 0,
                Usage_limit INTEGER,
                Usage_count INTEGER DEFAULT 0,
                Combo_category TEXT,
                Day_of_week TEXT,
                Event_name TEXT,
                Start_date DATETIME,
                End_date DATETIME,
                Min_member_tenure_months INTEGER DEFAULT 0,
                Min_membership_months INTEGER DEFAULT 0,
                Target_tier TEXT DEFAULT 'ALL',
                Banner_id INTEGER,
                Show_banner INTEGER DEFAULT 0,
                Description TEXT,
                Is_active INTEGER DEFAULT 1,
                Created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                Updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Di chuyển và đồng bộ các cột an toàn nếu đã có bảng từ trước
        addColumnSafe("ALTER TABLE MARKETING_CAMPAIGNS ADD COLUMN Campaign_name TEXT;");
        addColumnSafe("ALTER TABLE MARKETING_CAMPAIGNS ADD COLUMN Campaign_type TEXT;");
        addColumnSafe("ALTER TABLE MARKETING_CAMPAIGNS ADD COLUMN Min_bill_amount REAL DEFAULT 0;");
        addColumnSafe("ALTER TABLE MARKETING_CAMPAIGNS ADD COLUMN Min_membership_months INTEGER DEFAULT 0;");
        addColumnSafe("ALTER TABLE MARKETING_CAMPAIGNS ADD COLUMN Usage_limit INTEGER;");
        addColumnSafe("ALTER TABLE MARKETING_CAMPAIGNS ADD COLUMN Usage_count INTEGER DEFAULT 0;");
        addColumnSafe("ALTER TABLE MARKETING_CAMPAIGNS ADD COLUMN Show_banner INTEGER DEFAULT 0;");
        try {
            db.exec("UPDATE MARKETING_CAMPAIGNS SET Campaign_name = COALESCE(Campaign_name, Name), Name = COALESCE(Name, Campaign_name), Campaign_type = COALESCE(Campaign_type, Type), Type = COALESCE(Type, Campaign_type), Min_bill_amount = COALESCE(Min_bill_amount, Min_order_amount), Min_order_amount = COALESCE(Min_order_amount, Min_bill_amount), Min_membership_months = COALESCE(Min_membership_months, Min_member_tenure_months), Min_member_tenure_months = COALESCE(Min_member_tenure_months, Min_membership_months);");
        } catch (eSync) {}

        // Khởi tạo một số chiến dịch Marketing mẫu nếu chưa có
        try {
            const countCamp = db.prepare("SELECT COUNT(*) as count FROM MARKETING_CAMPAIGNS").get().count;
            if (countCamp === 0) {
                const stmtCampInit = db.prepare(`
                    INSERT INTO MARKETING_CAMPAIGNS (
                        Name, Code, Type, Discount_type, Discount_value, Min_order_amount, Max_discount_amount,
                        Day_of_week, Min_member_tenure_months, Target_tier, Description, Is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                `);
                stmtCampInit.run('Ưu Đãi Ngày Rằm & Mùng Một', 'NGAYCHAY10', 'DAY_OF_WEEK', 'PERCENT', 10, 200000, 50000, '0,1,5', 0, 'ALL', 'Giảm 10% tối đa 50k vào ngày chay định kỳ (Chủ nhật, Thứ 2, Thứ 6)');
                stmtCampInit.run('Tri Ân Hội Viên Thân Thiết Trên 6 Tháng', 'TRIAN6THANG', 'MEMBER_TENURE', 'PERCENT', 15, 300000, 100000, '', 6, 'ALL', 'Dành riêng cho khách hàng đồng hành cùng quán trên 6 tháng');
                stmtCampInit.run('Giảm 50K Hóa Đơn Trưa Trên 400K', 'TRUA50K', 'BILL_AMOUNT', 'FIXED', 50000, 400000, 50000, '', 0, 'ALL', 'Áp dụng cho mọi hóa đơn ăn trưa từ 400.000đ');
                console.log("-> Đã khởi tạo 3 chiến dịch Marketing ưu đãi mẫu trong CSDL!");
            }
        } catch (eCampInit) {
            console.error('Lỗi khởi tạo chiến dịch mẫu:', eCampInit.message);
        }

        // Tạo bảng MEMBER_VOUCHERS (Kho mã giảm giá phát riêng cho từng thành viên)
        db.exec(`
            CREATE TABLE IF NOT EXISTS MEMBER_VOUCHERS (
                Voucher_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Member_id INTEGER NOT NULL,
                Campaign_id INTEGER,
                Voucher_code TEXT NOT NULL,
                Title TEXT NOT NULL,
                Discount_type TEXT DEFAULT 'PERCENT',
                Discount_value REAL NOT NULL,
                Min_order_amount REAL DEFAULT 0,
                Max_discount_amount REAL DEFAULT 0,
                Start_date DATETIME,
                End_date DATETIME,
                Status TEXT DEFAULT 'UNUSED',
                Used_at DATETIME,
                Used_order_code TEXT,
                Created_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Tạo bảng MEMBER_SECURITY_CODES (Mã bảo mật OTP 6 số 30 giây khi quét mã QR khách hàng)
        db.exec(`
            CREATE TABLE IF NOT EXISTS MEMBER_SECURITY_CODES (
                Security_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Member_id INTEGER NOT NULL,
                Phone TEXT NOT NULL,
                Code TEXT NOT NULL,
                Expires_at INTEGER NOT NULL,
                Is_used INTEGER DEFAULT 0,
                Created_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Tạo bảng MARKETING_EMAIL_LOGS (Lịch sử gửi email voucher cho khách hàng)
        db.exec(`
            CREATE TABLE IF NOT EXISTS MARKETING_EMAIL_LOGS (
                Log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Campaign_id INTEGER,
                Campaign_name TEXT,
                Voucher_code TEXT,
                Member_id INTEGER,
                Member_name TEXT,
                Email TEXT NOT NULL,
                Phone TEXT,
                Subject TEXT,
                Discount_text TEXT,
                Status TEXT DEFAULT 'SUCCESS',
                Error_message TEXT,
                Sent_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Tạo bảng MARKETING_SCHEDULES (Lên lịch tự động gửi chiến dịch theo Âm Lịch, Sinh Nhật, Ngày Cụ Thể)
        db.exec(`
            CREATE TABLE IF NOT EXISTS MARKETING_SCHEDULES (
                Schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
                Schedule_name TEXT NOT NULL,
                Schedule_type TEXT NOT NULL,
                Send_time TEXT DEFAULT '08:00',
                Specific_date TEXT,
                Target_audience TEXT NOT NULL,
                Selected_member_ids TEXT,
                Campaign_id INTEGER,
                Subject TEXT,
                Message TEXT,
                Is_active INTEGER DEFAULT 1,
                Last_run_at DATETIME,
                Last_run_status TEXT,
                Last_run_summary TEXT,
                Created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                Updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);

        console.log("✅ [SQLite] Đã đồng bộ cấu trúc CSDL thành công!");
    } catch (err) {
        console.error('❌ Lỗi khởi tạo CSDL:', err.message);
    }
}
initDatabase();

// ==========================================
// 2. MIDDLEWARE & STATIC FILES
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/views', express.static(path.join(__dirname, 'views')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'public', 'sw.js')));

// Hỗ trợ tải giao diện cài đặt hệ thống ở mọi định dạng URL (tránh lỗi fetch 404 / connection refused)
// Hỗ trợ tải giao diện cài đặt hệ thống ở mọi định dạng URL (tránh lỗi fetch 404 / connection refused)
// Chỉ khi nào code front-end yêu cầu đường dẫn /views/... thì mới trả về file giao diện con
app.get(['/views/system-settings.html', '/views/system_settings.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'system-settings.html'));
});
// ==========================================
// 3. KẾT NỐI REALTIME SOCKET.IO & QUẢN LÝ PHIÊN
// ==========================================
// Tạo bảng ACTIVE_SESSIONS nếu chưa có để lưu phiên đăng nhập thực tế
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS ACTIVE_SESSIONS (
            User_id TEXT PRIMARY KEY,
            Username TEXT,
            Full_name TEXT,
            Role TEXT,
            Client_ip TEXT,
            User_agent TEXT,
            Session_token TEXT,
            Login_time DATETIME DEFAULT (datetime('now', 'localtime'))
        );
    `);
    const cols = db.prepare("PRAGMA table_info(ACTIVE_SESSIONS)").all();
    if (!cols.some(c => c.name === 'Session_token')) {
        db.exec("ALTER TABLE ACTIVE_SESSIONS ADD COLUMN Session_token TEXT;");
    }
} catch(e) {
    console.error('Lỗi khởi tạo ACTIVE_SESSIONS:', e.message);
}

// Quản lý phiên đăng nhập nhân viên/admin thời gian thực (Đơn máy / Đa máy)
const activeStaffSessions = new Map(); // Key: userId / username (string), Value: { ip, userAgent, loginTime, sessionToken, socketId }

// Hàm kiểm tra một tài khoản có đang áp dụng chính sách 1 máy (SINGLE) hay không
function isUserSingleDeviceMode(userId, username) {
    try {
        const uKey = String(username || '').toLowerCase();
        const uidStr = String(userId || '');

        // 1. Kiểm tra cấu hình riêng của nhân viên trong user_login_policy
        const pRow = db.prepare("SELECT Value FROM SYSTEM_CONFIG WHERE Key = 'user_login_policy'").get();
        if (pRow && pRow.Value) {
            let p = pRow.Value;
            try { p = JSON.parse(p); } catch(e) {}
            if (p && typeof p === 'object') {
                if (uKey && p[uKey]) {
                    const val = String(p[uKey]).toUpperCase();
                    if (val === 'SINGLE') return true;
                    if (val === 'MULTI') return false;
                }
                if (uidStr && p[uidStr]) {
                    const val = String(p[uidStr]).toUpperCase();
                    if (val === 'SINGLE') return true;
                    if (val === 'MULTI') return false;
                }
            }
        }

        // 2. Fallback về cấu hình chung hệ thống
        const row = db.prepare("SELECT Value FROM SYSTEM_CONFIG WHERE Key = 'allow_multi_login'").get();
        if (row && row.Value) {
            let v = row.Value;
            try { v = JSON.parse(v); } catch(e) {}
            return String(v).trim().toUpperCase() === 'SINGLE';
        }
    } catch(e) {}
    return false;
}

// Hàm helper phát Socket đếm số đơn cho Navbar (Nhận món & Màn hình bếp)
function emitOrderBadgeCounts(ioInstance, database) {
    if (!ioInstance) return;
    try {
        const dbInstance = database || db;
        const pendingRow = dbInstance.prepare(`
            SELECT COUNT(*) as count FROM ORDERS 
            WHERE Status = 'PROCESSING' OR Status IS NULL OR Status = '' OR Status = 'PENDING' OR UPPER(Status) IN ('COOKING', 'ACCEPTED')
        `).get();
        const readyRow = dbInstance.prepare(`
            SELECT COUNT(*) as count FROM ORDERS WHERE UPPER(Status) = 'READY'
        `).get();
        ioInstance.emit('order_counts_updated', {
            pendingKitchenCount: pendingRow ? pendingRow.count : 0,
            readyOrdersCount: readyRow ? readyRow.count : 0
        });
    } catch(e) {
        console.warn('Lỗi emitOrderBadgeCounts:', e.message);
    }
}

io.on('connection', (socket) => {
    console.log('⚡ Thiết bị kết nối Realtime ID:', socket.id);

    // Đăng ký phiên người dùng với socket
    socket.on('register_user_session', (userData) => {
        if (!userData) return;
        const uid = userData.userId ? String(userData.userId) : null;
        const uname = userData.username ? String(userData.username).toLowerCase() : null;
        const token = userData.sessionToken;

        if (uid) socket.userId = uid;
        if (uname) socket.username = uname;

        // Kiểm tra tính hợp lệ của phiên đối với chế độ Đơn máy (Single-device)
        if (uid || uname) {
            const isSingle = isUserSingleDeviceMode(uid, uname);
            if (isSingle) {
                const active = db.prepare("SELECT Session_token FROM ACTIVE_SESSIONS WHERE User_id = ? OR LOWER(Username) = ?").get(uid || '', uname || '');
                if (active && active.Session_token && token && active.Session_token !== token) {
                    // Thiết bị này giữ sessionToken cũ -> lập tức gửi lệnh đăng xuất thiết bị này
                    socket.emit('force_logout_user', {
                        userId: uid,
                        username: uname,
                        reason: 'Tài khoản của bạn vừa được đăng nhập trên một thiết bị khác.'
                    });
                }
            }
        }
    });

    socket.on('client_submit_order', (orderData) => {
        console.log('🔔 Có đơn hàng mới từ điện thoại:', orderData ? (orderData.Order_id || orderData.Order_code) : '');
        io.emit('kitchen_new_order', orderData);
        emitOrderBadgeCounts(io, db);
    });

    socket.on('kitchen_new_order', (orderData) => {
        console.log('🔔 [Socket] Đơn hàng mới gửi xuống Bếp:', orderData ? (orderData.Order_id || orderData.Order_code) : '');
        io.emit('kitchen_new_order', orderData);
        emitOrderBadgeCounts(io, db);
    });

    socket.on('kitchen_finish_order', (orderData) => {
        console.log('✅ Bếp đã hoàn thành đơn:', orderData ? (orderData.Order_id || orderData.Order_code) : '');
        io.emit('waiter_order_ready', orderData);
        emitOrderBadgeCounts(io, db);
    });
});

// ==========================================
// 4. ROUTERS API CON
// ==========================================
app.use('/api/users', require('./routes/users'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/shipper', require('./routes/shipper'));
app.use('/api', require('./routes/categories'));
app.use('/api', require('./routes/menu'));
const kitchenRouter = require('./routes/kitchen');
app.use('/api/kitchen', kitchenRouter);
app.use('/api/tables', require('./routes/tables'));
const marketingRoute = require('./routes/marketing');
// 👉 THÊM DÒNG NÀY:
app.use('/api/members', require('./routes/members'));
app.use('/api/marketing', marketingRoute);
try {
    if (typeof marketingRoute.startMarketingScheduler === 'function') {
        marketingRoute.startMarketingScheduler(() => io);
    }
} catch(eStartMkt) {}

// ==========================================
// 4.5. NỀN TẢNG GIAO HÀNG (DELIVERY PLATFORMS) & BADGE COUNTS
// ==========================================
// Lấy danh sách nền tảng giao hàng (chỉ lấy đang kích hoạt cho app/pos)
app.get('/api/delivery-platforms', (req, res) => {
    try {
        const platforms = db.prepare('SELECT * FROM DELIVERY_PLATFORMS WHERE Is_active = 1 ORDER BY Sort_order ASC, Platform_id ASC').all();
        res.json({ success: true, platforms });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Lấy toàn bộ danh sách nền tảng giao hàng (cả active & inactive cho trang cài đặt quản lý)
app.get('/api/delivery-platforms/all', (req, res) => {
    try {
        const platforms = db.prepare('SELECT * FROM DELIVERY_PLATFORMS ORDER BY Sort_order ASC, Platform_id ASC').all();
        res.json({ success: true, platforms });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Thêm nền tảng mới
app.post('/api/delivery-platforms', (req, res) => {
    try {
        const { Platform_name, Platform_code, Fee_percentage, Icon_class, Color_code, Sort_order, Is_active } = req.body;
        if (!Platform_name) return res.status(400).json({ success: false, error: 'Tên nền tảng không được để trống' });
        
        const code = (Platform_code || Platform_name).toUpperCase().replace(/[^A-Z0-9]/g, '_');
        const stmt = db.prepare(`
            INSERT INTO DELIVERY_PLATFORMS (Platform_name, Platform_code, Fee_percentage, Icon_class, Color_code, Sort_order, Is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
            Platform_name,
            code,
            Number(Fee_percentage || 0),
            Icon_class || 'fa-solid fa-motorcycle',
            Color_code || '#ff5722',
            Number(Sort_order || 0),
            Number(Is_active ?? 1)
        );
        io.emit('delivery_platforms_updated', { action: 'create', platformId: info.lastInsertRowid });
        res.json({ success: true, Platform_id: info.lastInsertRowid, message: 'Thêm nền tảng giao hàng thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Sửa nền tảng
app.put('/api/delivery-platforms/:id', (req, res) => {
    try {
        const id = req.params.id;
        const { Platform_name, Platform_code, Fee_percentage, Icon_class, Color_code, Sort_order, Is_active } = req.body;
        db.prepare(`
            UPDATE DELIVERY_PLATFORMS 
            SET Platform_name = COALESCE(?, Platform_name),
                Platform_code = COALESCE(?, Platform_code),
                Fee_percentage = COALESCE(?, Fee_percentage),
                Icon_class = COALESCE(?, Icon_class),
                Color_code = COALESCE(?, Color_code),
                Sort_order = COALESCE(?, Sort_order),
                Is_active = COALESCE(?, Is_active)
            WHERE Platform_id = ?
        `).run(Platform_name, Platform_code, Fee_percentage, Icon_class, Color_code, Sort_order, Is_active, id);
        io.emit('delivery_platforms_updated', { action: 'update', platformId: id });
        res.json({ success: true, message: 'Cập nhật nền tảng giao hàng thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Xóa nền tảng
app.delete('/api/delivery-platforms/:id', (req, res) => {
    try {
        const id = req.params.id;
        db.prepare('DELETE FROM DELIVERY_PLATFORMS WHERE Platform_id = ?').run(id);
        io.emit('delivery_platforms_updated', { action: 'delete', platformId: id });
        res.json({ success: true, message: 'Đã xóa nền tảng giao hàng thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// 4.5.1. QUẢN LÝ LỊCH SỬ & VỊ TRÍ THIẾT BỊ ĐĂNG NHẬP (LOGIN HISTORY)
// ==========================================
// Helper định dạng thời lượng trực tuyến thành chuỗi dễ đọc
function formatDurationText(seconds) {
    if (seconds == null || isNaN(seconds) || seconds < 0) return '--';
    const s = Math.round(seconds);
    if (s < 60) return `${s} giây`;
    const m = Math.floor(s / 60);
    const remSec = s % 60;
    if (m < 60) {
        return remSec > 0 ? `${m} phút ${remSec}s` : `${m} phút`;
    }
    const h = Math.floor(m / 60);
    const remMin = m % 60;
    if (h < 24) {
        return remMin > 0 ? `${h} giờ ${remMin}p` : `${h} giờ`;
    }
    const d = Math.floor(h / 24);
    const remHours = h % 24;
    return `${d} ngày ${remHours}h`;
}

// Lấy danh sách lịch sử đăng nhập kèm thời lượng & biểu đồ phân tích thói quen
app.get('/api/login-history', (req, res) => {
    try {
        const { type, role, keyword, from_date, to_date, limit = 150, offset = 0 } = req.query;
        let whereClauses = [];
        let params = [];

        if (type && type !== 'ALL') {
            whereClauses.push('User_type = ?');
            params.push(type.toUpperCase());
        }

        if (role && role !== 'ALL') {
            whereClauses.push('Role = ?');
            params.push(role);
        }

        if (keyword) {
            whereClauses.push('(Username LIKE ? OR Full_name LIKE ? OR Client_ip LIKE ? OR Device_info LIKE ? OR Note LIKE ?)');
            const kw = `%${keyword}%`;
            params.push(kw, kw, kw, kw, kw);
        }

        if (from_date) {
            whereClauses.push('date(Login_time) >= date(?)');
            params.push(from_date);
        }

        if (to_date) {
            whereClauses.push('date(Login_time) <= date(?)');
            params.push(to_date);
        }

        const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        const totalCount = db.prepare(`SELECT COUNT(*) as count FROM LOGIN_HISTORY ${whereSql}`).get(...params).count;

        const rawRows = db.prepare(`
            SELECT * FROM LOGIN_HISTORY 
            ${whereSql} 
            ORDER BY History_id DESC 
            LIMIT ? OFFSET ?
        `).all(...params, Number(limit), Number(offset));

        // Tính toán thời lượng Online cho từng bản ghi
        const nowMs = Date.now();
        const rows = rawRows.map(r => {
            let durationSec = null;
            const isOnline = (r.Status === 'SUCCESS');
            const loginDate = r.Login_time ? new Date(r.Login_time.replace(' ', 'T')) : null;
            const logoutDate = r.Logout_time ? new Date(r.Logout_time.replace(' ', 'T')) : null;

            if (loginDate && !isNaN(loginDate.getTime())) {
                if (logoutDate && !isNaN(logoutDate.getTime())) {
                    durationSec = Math.max(0, Math.floor((logoutDate.getTime() - loginDate.getTime()) / 1000));
                } else if (isOnline) {
                    durationSec = Math.max(0, Math.floor((nowMs - loginDate.getTime()) / 1000));
                }
            }

            return {
                ...r,
                isOnline,
                duration_seconds: durationSec,
                duration_text: formatDurationText(durationSec)
            };
        });

        // ==========================================
        // THỐNG KÊ & PHÂN TÍCH THÓI QUEN (ANALYTICS)
        // ==========================================
        let stats = {
            totalLogins: totalCount,
            staffToday: 0,
            customerToday: 0,
            onlineNow: 0,
            mobileCount: 0,
            desktopCount: 0,
            avgCustomerDurationText: '--',
            avgStaffDurationText: '--',
            peakHourText: '--'
        };

        let hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            hourLabel: `${h}h`,
            staff: 0,
            customer: 0,
            total: 0
        }));

        let deviceBreakdown = {
            iPhone: 0,
            Android: 0,
            Windows: 0,
            Mac: 0,
            Other: 0
        };

        let dailyTrendMap = {};
        // Tạo sẵn 7 ngày gần nhất
        for (let i = 6; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86400000);
            const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            dailyTrendMap[dStr] = { date: dStr, label, staff: 0, customer: 0, total: 0 };
        }

        let totalCustDur = 0, countCustDur = 0;
        let totalStaffDur = 0, countStaffDur = 0;

        try {
            // Lấy tất cả lịch sử để phân tích tổng quan
            const allLogins = db.prepare("SELECT User_type, Device_info, Login_time, Logout_time, Status FROM LOGIN_HISTORY ORDER BY History_id DESC LIMIT 500").all();
            
            stats.staffToday = db.prepare("SELECT COUNT(DISTINCT Username) as c FROM LOGIN_HISTORY WHERE User_type = 'STAFF' AND date(Login_time) = date('now', 'localtime')").get().c;
            stats.customerToday = db.prepare("SELECT COUNT(DISTINCT Username) as c FROM LOGIN_HISTORY WHERE User_type = 'CUSTOMER' AND date(Login_time) = date('now', 'localtime')").get().c;
            stats.onlineNow = db.prepare("SELECT COUNT(*) as c FROM LOGIN_HISTORY WHERE Status = 'SUCCESS'").get().c;
            stats.mobileCount = db.prepare("SELECT COUNT(*) as c FROM LOGIN_HISTORY WHERE Device_info LIKE '%📱%'").get().c;
            stats.desktopCount = db.prepare("SELECT COUNT(*) as c FROM LOGIN_HISTORY WHERE Device_info LIKE '%💻%'").get().c;

            allLogins.forEach(l => {
                const dev = l.Device_info || '';
                if (dev.includes('iPhone') || dev.includes('iPad') || dev.includes('iOS')) deviceBreakdown.iPhone++;
                else if (dev.includes('Android')) deviceBreakdown.Android++;
                else if (dev.includes('Windows')) deviceBreakdown.Windows++;
                else if (dev.includes('Mac') || dev.includes('macOS')) deviceBreakdown.Mac++;
                else deviceBreakdown.Other++;

                if (l.Login_time) {
                    try {
                        const lDate = new Date(l.Login_time.replace(' ', 'T'));
                        if (!isNaN(lDate.getTime())) {
                            const hr = lDate.getHours();
                            if (hr >= 0 && hr < 24) {
                                if (l.User_type === 'STAFF') hourlyDistribution[hr].staff++;
                                else hourlyDistribution[hr].customer++;
                                hourlyDistribution[hr].total++;
                            }

                            const dStr = `${lDate.getFullYear()}-${String(lDate.getMonth() + 1).padStart(2, '0')}-${String(lDate.getDate()).padStart(2, '0')}`;
                            if (dailyTrendMap[dStr]) {
                                if (l.User_type === 'STAFF') dailyTrendMap[dStr].staff++;
                                else dailyTrendMap[dStr].customer++;
                                dailyTrendMap[dStr].total++;
                            }

                            // Tính thời lượng
                            if (l.Logout_time) {
                                const outDate = new Date(l.Logout_time.replace(' ', 'T'));
                                if (!isNaN(outDate.getTime())) {
                                    const sec = Math.max(0, (outDate.getTime() - lDate.getTime()) / 1000);
                                    if (l.User_type === 'CUSTOMER') {
                                        totalCustDur += sec;
                                        countCustDur++;
                                    } else {
                                        totalStaffDur += sec;
                                        countStaffDur++;
                                    }
                                }
                            }
                        }
                    } catch(eD) {}
                }
            });

            if (countCustDur > 0) {
                stats.avgCustomerDurationText = formatDurationText(totalCustDur / countCustDur);
            }
            if (countStaffDur > 0) {
                stats.avgStaffDurationText = formatDurationText(totalStaffDur / countStaffDur);
            }

            // Tìm khung giờ cao điểm (Peak Hours)
            let maxHour = 0, maxVal = 0;
            hourlyDistribution.forEach(h => {
                if (h.total > maxVal) {
                    maxVal = h.total;
                    maxHour = h.hour;
                }
            });
            if (maxVal > 0) {
                stats.peakHourText = `${maxHour}h - ${maxHour + 1}h (${maxVal} lượt)`;
            }
        } catch(eAnalytics) {
            console.error('Lỗi tính analytics login-history:', eAnalytics.message);
        }

        res.json({
            success: true,
            total: totalCount,
            rows,
            stats,
            analytics: {
                hourlyDistribution,
                deviceBreakdown,
                dailyTrend: Object.values(dailyTrendMap)
            }
        });
    } catch (err) {
        console.error('Lỗi GET /api/login-history:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Sửa thông tin / ghi chú bản ghi lịch sử đăng nhập
app.put('/api/login-history/:id', (req, res) => {
    try {
        const id = req.params.id;
        const { Note, Status, Location_address } = req.body;
        db.prepare(`
            UPDATE LOGIN_HISTORY 
            SET Note = COALESCE(?, Note),
                Status = COALESCE(?, Status),
                Location_address = COALESCE(?, Location_address)
            WHERE History_id = ?
        `).run(Note, Status, Location_address, id);
        res.json({ success: true, message: 'Cập nhật lịch sử đăng nhập thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Xóa 1 bản ghi lịch sử
app.delete('/api/login-history/:id', (req, res) => {
    try {
        const id = req.params.id;
        db.prepare('DELETE FROM LOGIN_HISTORY WHERE History_id = ?').run(id);
        if (typeof io !== 'undefined' && io) {
            io.emit('login_history_updated');
        }
        res.json({ success: true, message: 'Đã xóa bản ghi lịch sử thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Xóa hàng loạt / dọn dẹp lịch sử đăng nhập
app.delete('/api/login-history', (req, res) => {
    try {
        const { older_than_days, clear_all } = req.body || {};
        if (clear_all) {
            db.prepare('DELETE FROM LOGIN_HISTORY').run();
            if (typeof io !== 'undefined' && io) {
                io.emit('login_history_updated');
            }
            return res.json({ success: true, message: 'Đã xóa toàn bộ lịch sử đăng nhập!' });
        }
        if (older_than_days) {
            const days = parseInt(older_than_days, 10);
            db.prepare(`DELETE FROM LOGIN_HISTORY WHERE Login_time < datetime('now', '-${days} days')`).run();
            if (typeof io !== 'undefined' && io) {
                io.emit('login_history_updated');
            }
            return res.json({ success: true, message: `Đã dọn dẹp các bản ghi lịch sử cũ hơn ${days} ngày!` });
        }
        db.prepare('DELETE FROM LOGIN_HISTORY').run();
        if (typeof io !== 'undefined' && io) {
            io.emit('login_history_updated');
        }
        res.json({ success: true, message: 'Đã xóa lịch sử đăng nhập thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Đăng xuất từ xa thiết bị
app.post('/api/login-history/force-logout/:id', (req, res) => {
    try {
        const id = req.params.id;
        const row = db.prepare('SELECT * FROM LOGIN_HISTORY WHERE History_id = ?').get(id);
        if (!row) return res.status(404).json({ success: false, error: 'Không tìm thấy phiên đăng nhập' });

        io.emit('force_logout_user', {
            userId: String(row.User_id || ''),
            username: row.Username,
            reason: 'Phiên làm việc trên thiết bị này vừa bị Quản trị viên ngắt kết nối từ xa.'
        });

        db.prepare(`
            UPDATE LOGIN_HISTORY 
            SET Status = 'FORCE_LOGGED_OUT', Logout_time = datetime('now', 'localtime') 
            WHERE History_id = ?
        `).run(id);

        if (row.User_id) {
            try {
                db.prepare('DELETE FROM ACTIVE_SESSIONS WHERE User_id = ? OR LOWER(Username) = ?').run(String(row.User_id), String(row.Username).toLowerCase());
            } catch(e) {}
            activeStaffSessions.delete(String(row.User_id));
        }
        if (row.Username) {
            activeStaffSessions.delete(String(row.Username).toLowerCase());
        }

        if (typeof io !== 'undefined' && io) {
            io.emit('login_history_updated');
        }

        res.json({ success: true, message: `Đã ngắt kết nối từ xa thiết bị của [${row.Full_name || row.Username}]!` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// 4.6. QUẢN LÝ NÚT ICON NỔI PHÍA DƯỚI (FLOATING QUICK BUTTONS)
// ==========================================
app.get('/api/floating-buttons', (req, res) => {
    try {
        const buttons = db.prepare('SELECT * FROM FLOATING_QUICK_BUTTONS WHERE Is_active = 1 ORDER BY Sort_order ASC, Button_id ASC').all();
        res.json({ success: true, buttons });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/floating-buttons/all', (req, res) => {
    try {
        const buttons = db.prepare('SELECT * FROM FLOATING_QUICK_BUTTONS ORDER BY Sort_order ASC, Button_id ASC').all();
        res.json({ success: true, buttons });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/floating-buttons', (req, res) => {
    try {
        const { Button_label, Icon_class, Bg_color, Action_type, Action_target, Tooltip_text, Sort_order } = req.body;
        if (!Button_label) return res.status(400).json({ success: false, error: 'Tên nút không được để trống' });
        const stmt = db.prepare(`
            INSERT INTO FLOATING_QUICK_BUTTONS (Button_label, Icon_class, Bg_color, Action_type, Action_target, Tooltip_text, Sort_order, Is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `);
        const info = stmt.run(
            Button_label,
            Icon_class || 'fa-solid fa-circle',
            Bg_color || '#2e7d32',
            Action_type || 'SHIPPER_PLATFORM',
            Action_target || '',
            Tooltip_text || Button_label,
            Number(Sort_order || 0)
        );
        res.json({ success: true, Button_id: info.lastInsertRowid, message: 'Thêm nút icon nổi thành công' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/floating-buttons/:id', (req, res) => {
    try {
        const id = req.params.id;
        const { Button_label, Icon_class, Bg_color, Action_type, Action_target, Tooltip_text, Sort_order, Is_active } = req.body;
        db.prepare(`
            UPDATE FLOATING_QUICK_BUTTONS
            SET Button_label = COALESCE(?, Button_label),
                Icon_class = COALESCE(?, Icon_class),
                Bg_color = COALESCE(?, Bg_color),
                Action_type = COALESCE(?, Action_type),
                Action_target = COALESCE(?, Action_target),
                Tooltip_text = COALESCE(?, Tooltip_text),
                Sort_order = COALESCE(?, Sort_order),
                Is_active = COALESCE(?, Is_active),
                Updated_at = datetime('now', 'localtime')
            WHERE Button_id = ?
        `).run(Button_label, Icon_class, Bg_color, Action_type, Action_target, Tooltip_text, Sort_order, Is_active, id);
        res.json({ success: true, message: 'Cập nhật nút icon nổi thành công' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/floating-buttons/:id', (req, res) => {
    try {
        const id = req.params.id;
        db.prepare('DELETE FROM FLOATING_QUICK_BUTTONS WHERE Button_id = ?').run(id);
        res.json({ success: true, message: 'Đã xóa nút icon nổi thành công' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// 4.7. TỰ ĐỘNG LÀM SẠCH BÀN & ĐƠN HÀNG HẾT CA LÀM VIỆC (SHIFT CLEANUP)
// ==========================================
function performShiftCleanup(manualTrigger = false) {
    try {
        const configs = {};
        db.prepare("SELECT Key, Value FROM SYSTEM_CONFIG WHERE Key IN ('shift_start_time', 'shift_end_time', 'auto_clear_on_shift_end', 'auto_clear_previous_day')").all().forEach(r => {
            try { configs[r.Key] = JSON.parse(r.Value); } catch(e) { configs[r.Key] = r.Value; }
        });

        const autoClearPrev = String(configs.auto_clear_previous_day ?? '1') === '1';
        const autoClearShiftEnd = String(configs.auto_clear_on_shift_end ?? '1') === '1';
        const shiftStart = configs.shift_start_time || '06:00';
        const shiftEnd = configs.shift_end_time || '22:30';

        const now = new Date();
        const currentHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

        let shouldCleanShift = manualTrigger;

        if (!manualTrigger && autoClearShiftEnd) {
            if (shiftEnd > shiftStart) {
                if (currentHHMM >= shiftEnd || currentHHMM < shiftStart) {
                    shouldCleanShift = true;
                }
            } else {
                if (currentHHMM >= shiftEnd && currentHHMM < shiftStart) {
                    shouldCleanShift = true;
                }
            }
        }

        let cleanedOrdersCount = 0;
        let cleanedTablesCount = 0;

        // 1. Dọn đơn hàng tồn từ ngày hôm trước
        if (autoClearPrev || manualTrigger) {
            const oldOrders = db.prepare(`
                SELECT Order_id, Order_code, Table_number, Table_name, Created_at
                FROM ORDERS
                WHERE date(Created_at) < date('now', 'localtime')
                  AND UPPER(Status) NOT IN ('COMPLETED', 'SERVED', 'CANCELLED', 'CANCELED')
            `).all();

            if (oldOrders.length > 0) {
                const cancelStmt = db.prepare(`
                    UPDATE ORDERS 
                    SET Status = 'CANCELLED', 
                        Note = COALESCE(Note, '') || ' [Hệ thống tự động hủy dọn bàn qua ngày mới]',
                        Updated_at = datetime('now', 'localtime')
                    WHERE Order_id = ?
                `);
                oldOrders.forEach(o => {
                    cancelStmt.run(o.Order_id);
                    cleanedOrdersCount++;
                });
            }
        }

        // 2. Dọn đơn hàng khi hết ca làm việc
        if (shouldCleanShift) {
            const shiftExpiredOrders = db.prepare(`
                SELECT Order_id, Order_code, Table_number, Table_name, Created_at
                FROM ORDERS
                WHERE UPPER(Status) NOT IN ('COMPLETED', 'SERVED', 'CANCELLED', 'CANCELED')
                  AND time(Created_at) <= ?
            `).all(shiftEnd);

            if (shiftExpiredOrders.length > 0) {
                const cancelShiftStmt = db.prepare(`
                    UPDATE ORDERS 
                    SET Status = 'CANCELLED', 
                        Note = COALESCE(Note, '') || ' [Tự động dọn bàn khi hết ca làm việc]',
                        Updated_at = datetime('now', 'localtime')
                    WHERE Order_id = ?
                `);
                shiftExpiredOrders.forEach(o => {
                    cancelShiftStmt.run(o.Order_id);
                    cleanedOrdersCount++;
                });
            }
        }

        // 3. Giải phóng bàn trong DINING_TABLES
        const allTables = db.prepare("SELECT Table_id, Table_name, Table_code, Status, Current_order_id, Current_order_code FROM DINING_TABLES").all();
        const activeTodayOrders = db.prepare(`
            SELECT Order_id, Order_code, Table_number, Table_name
            FROM ORDERS
            WHERE UPPER(Status) NOT IN ('COMPLETED', 'SERVED', 'CANCELLED', 'CANCELED')
              AND date(Created_at) = date('now', 'localtime')
        `).all();

        const resetTableStmt = db.prepare(`
            UPDATE DINING_TABLES 
            SET Status = 'EMPTY', 
                Current_order_id = NULL, 
                Current_order_code = NULL, 
                Current_amount = 0, 
                Payment_status = 'UNPAID', 
                Current_guests = 0, 
                Updated_at = datetime('now', 'localtime')
            WHERE Table_id = ?
        `);

        allTables.forEach(tbl => {
            const tName = String(tbl.Table_name || '').toLowerCase().trim();
            const tCode = String(tbl.Table_code || '').toLowerCase().trim();
            const hasValidActiveOrder = activeTodayOrders.some(o => {
                const oTable = String(o.Table_number || o.Table_name || '').toLowerCase().trim();
                return oTable === tName || oTable === tCode || (oTable && (tName.includes(oTable) || oTable.includes(tName)));
            });

            if (!hasValidActiveOrder && (tbl.Status === 'SERVING' || tbl.Current_order_id)) {
                resetTableStmt.run(tbl.Table_id);
                cleanedTablesCount++;
            }
        });

        if (cleanedOrdersCount > 0 || cleanedTablesCount > 0) {
            console.log(`[ShiftCleanup] Đã dọn sạch ${cleanedOrdersCount} đơn treo & giải phóng ${cleanedTablesCount} bàn.`);
            if (typeof io !== 'undefined') {
                io.emit('table_updated', { refreshed: true });
                io.emit('order_status_updated', { refreshed: true });
                io.emit('order_counts_updated');
            }
        }

        return { success: true, cleanedOrdersCount, cleanedTablesCount };
    } catch (e) {
        console.error('[ShiftCleanup] Lỗi dọn bàn ca làm việc:', e.message);
        return { success: false, error: e.message };
    }
}

app.post('/api/tables/cleanup-shift', (req, res) => {
    const result = performShiftCleanup(true);
    res.json(result);
});

// Chạy dọn bàn khi khởi động và định kỳ mỗi 60 giây
setTimeout(() => performShiftCleanup(false), 3000);
setInterval(() => performShiftCleanup(false), 60 * 1000);

// API Đếm số lượng đơn cho Navbar Badge (Màn hình bếp & Nhận món)
app.get('/api/orders/badge-counts', (req, res) => {
    try {
        const pendingRow = db.prepare(`
            SELECT COUNT(*) as count FROM ORDERS 
            WHERE Status = 'PROCESSING' OR Status IS NULL OR Status = '' OR Status = 'PENDING' OR UPPER(Status) IN ('COOKING', 'ACCEPTED')
        `).get();
        const readyRow = db.prepare(`
            SELECT COUNT(*) as count FROM ORDERS 
            WHERE UPPER(Status) = 'READY'
        `).get();
        res.json({ 
            success: true, 
            pendingKitchenCount: pendingRow ? pendingRow.count : 0, 
            readyOrdersCount: readyRow ? readyRow.count : 0 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// 5. SYSTEM & AUTH APIS
// ==========================================
// API Lấy cấu hình hệ thống
app.get('/api/system-config', (req, res) => {
    try {
        const rows = db.prepare("SELECT Key, Value FROM SYSTEM_CONFIG WHERE Key NOT IN ('config', 'success')").all();
        const config = {};
        rows.forEach(r => {
            try {
                config[r.Key] = JSON.parse(r.Value);
            } catch (e) {
                config[r.Key] = r.Value;
            }
        });
        res.json({ success: true, config, ...config });
    } catch (err) {
        console.error('Lỗi GET /api/system-config:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API Cập nhật cấu hình hệ thống
app.post('/api/system-config', (req, res) => {
    try {
        const configData = req.body || {};
        delete configData.config;
        delete configData.success;
        const stmt = db.prepare(`
            INSERT INTO SYSTEM_CONFIG (Key, Value, Updated_at) 
            VALUES (?, ?, datetime('now', 'localtime'))
            ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value, Updated_at = excluded.Updated_at
        `);
        const insertMany = db.transaction((data) => {
            for (const [key, val] of Object.entries(data)) {
                if (key === 'config' || key === 'success') continue;
                stmt.run(key, JSON.stringify(val));
            }
        });
        insertMany(configData);
        
        // Đồng bộ realtime tới tất cả màn hình kết nối
        io.emit('system_config_updated', configData);
        
        res.json({ success: true, message: 'Đã lưu cấu hình hệ thống thành công!' });
    } catch (err) {
        console.error('Lỗi POST /api/system-config:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API Tải lên hình ảnh QR Code hóa đơn
app.post('/api/system-config/upload-qr', systemUpload.single('qrImage'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Chưa chọn file ảnh QR!' });
        }
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ success: true, qrUrl: fileUrl, filename: req.file.filename });
    } catch (err) {
        console.error('Lỗi upload-qr:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API Tải lên File âm thanh chuông báo (.mp3, .wav, .ogg)
app.post('/api/system-config/upload-sound', systemUpload.single('soundFile'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Chưa chọn file âm thanh!' });
        }
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ success: true, soundUrl: fileUrl, filename: req.file.filename });
    } catch (err) {
        console.error('Lỗi upload-sound:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API Tải lên Logo nhà hàng / web
app.post('/api/system-config/upload-logo', systemUpload.single('logoImage'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Chưa chọn file ảnh Logo!' });
        }
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ success: true, logoUrl: fileUrl, filename: req.file.filename });
    } catch (err) {
        console.error('Lỗi upload-logo:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API Chuyển văn bản thành giọng đọc Tiếng Việt chuẩn (Universal Text-to-Speech cho mọi thiết bị Mobile & PC)
app.get('/api/tts', async (req, res) => {
    try {
        const text = String(req.query.text || '').trim();
        if (!text) return res.status(400).send('Missing text parameter');

        const safeText = text.substring(0, 250);
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(safeText)}`;

        const https = require('https');
        const httpsReq = https.get(ttsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://translate.google.com/'
            },
            timeout: 6000
        }, (ttsRes) => {
            if (ttsRes.statusCode === 200) {
                res.setHeader('Content-Type', 'audio/mpeg');
                res.setHeader('Cache-Control', 'public, max-age=86400');
                ttsRes.pipe(res);
            } else {
                res.status(ttsRes.statusCode || 500).send('TTS upstream error');
            }
        });

        httpsReq.on('error', (err) => {
            console.error('[TTS Proxy Error]', err.message);
            res.status(500).send('TTS error: ' + err.message);
        });

        httpsReq.on('timeout', () => {
            httpsReq.destroy();
            res.status(504).send('TTS timeout');
        });
    } catch (e) {
        console.error('[TTS Error]', e);
        res.status(500).send('Server TTS Error');
    }
});

// ==========================================
// APIS BANNER QUẢNG CÁO MÓN MỚI & COMBO SMART TV
// ==========================================

// 1. GET: Lấy danh sách banner
app.get('/api/promotion-banners', (req, res) => {
    try {
        const activeOnly = req.query.activeOnly === '1';
        const sql = activeOnly
            ? "SELECT * FROM PROMOTION_BANNERS WHERE Is_active = 1 ORDER BY Sort_order ASC, Banner_id DESC"
            : "SELECT * FROM PROMOTION_BANNERS ORDER BY Sort_order ASC, Banner_id DESC";
        const banners = db.prepare(sql).all();

        // Tự động gộp thêm các banner từ CHIẾN DỊCH MARKETING ĐANG CHẠY (có Show_banner = 1)
        if (activeOnly) {
            try {
                const mktCampaigns = db.prepare(`
                    SELECT 
                        (Campaign_id + 10000) as Banner_id,
                        COALESCE(Campaign_name, Name) as Title,
                        Description as Subtitle,
                        COALESCE(Badge_text, 'ƯU ĐÃI') as Badge_text,
                        COALESCE(Price_text, CASE WHEN Discount_type = 'PERCENT' THEN ('Giảm ' || Discount_value || '%') ELSE ('Giảm ' || Discount_value || 'đ') END) as Price_text,
                        COALESCE(Image_url, '/uploads/banner_1790164138400.jpg') as Image_url,
                        0 as Sort_order,
                        Is_active
                    FROM MARKETING_CAMPAIGNS
                    WHERE Is_active = 1 AND Show_banner = 1
                    ORDER BY Campaign_id DESC
                `).all();

                if (Array.isArray(mktCampaigns) && mktCampaigns.length > 0) {
                    // Đưa banner chiến dịch marketing lên đầu để khách hàng và màn hình nhận món thấy ngay
                    banners.unshift(...mktCampaigns);
                }
            } catch (mktErr) {
                console.warn('Lỗi gộp banner marketing:', mktErr.message);
            }
        }

        res.json({ success: true, banners });
    } catch (err) {
        console.error('Lỗi GET /api/promotion-banners:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. POST: Thêm banner mới
app.post('/api/promotion-banners', (req, res) => {
    try {
        const { Title, Subtitle, Badge_text, Price_text, Image_url, Sort_order, Is_active } = req.body;
        if (!Title || !Image_url) {
            return res.status(400).json({ success: false, error: 'Vui lòng nhập tiêu đề và chọn ảnh banner!' });
        }
        const info = db.prepare(`
            INSERT INTO PROMOTION_BANNERS (Title, Subtitle, Badge_text, Price_text, Image_url, Sort_order, Is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            Title, 
            Subtitle || '', 
            Badge_text || 'MỚI', 
            Price_text || '', 
            Image_url, 
            Number(Sort_order || 0), 
            Number(Is_active ?? 1)
        );

        io.emit('banners_updated');
        res.json({ success: true, message: 'Đã thêm banner thành công!', Banner_id: info.lastInsertRowid });
    } catch (err) {
        console.error('Lỗi POST /api/promotion-banners:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. PUT: Cập nhật banner
app.put('/api/promotion-banners/:id', (req, res) => {
    try {
        const id = req.params.id;
        const { Title, Subtitle, Badge_text, Price_text, Image_url, Sort_order, Is_active } = req.body;
        db.prepare(`
            UPDATE PROMOTION_BANNERS
            SET Title = COALESCE(?, Title),
                Subtitle = COALESCE(?, Subtitle),
                Badge_text = COALESCE(?, Badge_text),
                Price_text = COALESCE(?, Price_text),
                Image_url = COALESCE(?, Image_url),
                Sort_order = COALESCE(?, Sort_order),
                Is_active = COALESCE(?, Is_active)
            WHERE Banner_id = ?
        `).run(Title, Subtitle, Badge_text, Price_text, Image_url, Sort_order, Is_active, id);

        io.emit('banners_updated');
        res.json({ success: true, message: 'Cập nhật banner thành công!' });
    } catch (err) {
        console.error('Lỗi PUT /api/promotion-banners:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. DELETE: Xóa banner
app.delete('/api/promotion-banners/:id', (req, res) => {
    try {
        const id = req.params.id;
        db.prepare("DELETE FROM PROMOTION_BANNERS WHERE Banner_id = ?").run(id);
        io.emit('banners_updated');
        res.json({ success: true, message: 'Đã xóa banner thành công!' });
    } catch (err) {
        console.error('Lỗi DELETE /api/promotion-banners:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Tải ảnh banner từ máy tính
app.post('/api/promotion-banners/upload-image', systemUpload.single('bannerImage'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Chưa chọn file ảnh banner!' });
        }
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ success: true, imageUrl: fileUrl, filename: req.file.filename });
    } catch (err) {
        console.error('Lỗi upload-image banner:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. Tải nhạc nền du dương cho Smart TV (.mp3, .wav, .ogg)
app.post('/api/promotion-banners/upload-music', systemUpload.single('musicFile'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Chưa chọn file nhạc nền!' });
        }
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ success: true, musicUrl: fileUrl, filename: req.file.filename });
    } catch (err) {
        console.error('Lỗi upload-music:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 7. Tải hình nền trang Nhận Món (.jpg, .png, .webp)
app.post('/api/promotion-banners/upload-bg', systemUpload.single('bgImage'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Chưa chọn file ảnh nền!' });
        }
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ success: true, bgUrl: fileUrl, filename: req.file.filename });
    } catch (err) {
        console.error('Lỗi upload-bg:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Tính khoảng cách giữa 2 tọa độ GPS theo công thức Haversine (đơn vị: mét)
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = Number(lat1) * Math.PI / 180;
    const φ2 = Number(lat2) * Math.PI / 180;
    const Δφ = (Number(lat2) - Number(lat1)) * Math.PI / 180;
    const Δλ = (Number(lon2) - Number(lon1)) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Phân tích User-Agent để nhận biết loại thiết bị, hệ điều hành & trình duyệt
function parseUserAgentInfo(ua) {
    if (!ua) return 'Không xác định';
    let device = '💻 Máy tính (Desktop)';
    let os = 'Hệ điều hành';
    let browser = 'Trình duyệt Web';

    const uaLower = ua.toLowerCase();

    // Phát hiện thiết bị & Hệ điều hành
    if (uaLower.includes('iphone')) {
        device = '📱 iPhone';
        os = 'iOS';
    } else if (uaLower.includes('ipad')) {
        device = '📱 iPad';
        os = 'iPadOS';
    } else if (uaLower.includes('android')) {
        device = uaLower.includes('mobile') ? '📱 Điện thoại Android' : '📱 Máy tính bảng Android';
        os = 'Android';
    } else if (uaLower.includes('windows nt 10.0')) {
        os = 'Windows 10/11';
        device = '💻 Máy tính Windows';
    } else if (uaLower.includes('windows nt 6.3') || uaLower.includes('windows nt 6.2') || uaLower.includes('windows nt 6.1')) {
        os = 'Windows PC';
        device = '💻 Máy tính Windows';
    } else if (uaLower.includes('macintosh') || uaLower.includes('mac os x')) {
        os = 'macOS';
        device = '💻 MacBook / Mac';
    } else if (uaLower.includes('linux')) {
        os = 'Linux';
        device = '💻 Máy tính Linux';
    }

    // Phát hiện trình duyệt
    if (uaLower.includes('zalo')) {
        browser = 'Zalo App';
    } else if (uaLower.includes('coccoc') || uaLower.includes('coc_coc')) {
        browser = 'Cốc Cốc';
    } else if (uaLower.includes('edg/')) {
        browser = 'Microsoft Edge';
    } else if (uaLower.includes('opr/') || uaLower.includes('opera')) {
        browser = 'Opera';
    } else if (uaLower.includes('chrome') && !uaLower.includes('edg/')) {
        browser = 'Google Chrome';
    } else if (uaLower.includes('safari') && !uaLower.includes('chrome')) {
        browser = 'Apple Safari';
    } else if (uaLower.includes('firefox')) {
        browser = 'Mozilla Firefox';
    }

    return `${device} (${os}) • ${browser}`;
}

app.post('/api/login', (req, res) => {
    try {
        const { User_name, User_password, forceLogout } = req.body;
        if (!User_name || !User_password) {
            return res.status(400).json({ success: false, error: 'Vui lòng nhập đầy đủ tên tài khoản/số điện thoại và mật khẩu!' });
        }

        const accountInput = String(User_name).trim();
        const pwdInput = String(User_password).trim();

        let user = null;
        let memberInfo = null;

        // 1. Kiểm tra trong bảng USERS (hỗ trợ User_name hoặc Phone)
        try {
            user = db.prepare(`
                SELECT * FROM USERS 
                WHERE (User_name = ? COLLATE NOCASE OR Phone = ?) 
                  AND User_password = ?
            `).get(accountInput, accountInput, pwdInput);
        } catch (e1) {
            console.error('Lỗi query USERS:', e1.message);
        }

        // 2. Nếu chưa tìm thấy trong USERS, kiểm tra trực tiếp trong bảng MEMBERS (bằng SĐT hoặc Mã thẻ)
        if (!user) {
            try {
                const member = db.prepare(`
                    SELECT * FROM MEMBERS 
                    WHERE (Phone = ? OR Card_code = ? COLLATE NOCASE) 
                      AND Password = ? 
                      AND (Is_active IS NULL OR Is_active = 1)
                `).get(accountInput, accountInput, pwdInput);

                if (member) {
                    memberInfo = member;
                    // Tự động tìm hoặc tạo tài khoản USERS tương ứng
                    let existingU = db.prepare(`SELECT * FROM USERS WHERE Phone = ? OR Member_id = ?`).get(member.Phone, member.Member_id);
                    if (existingU) {
                        db.prepare(`UPDATE USERS SET User_password = ?, Role = 'CUSTOMER', Member_id = ? WHERE User_id = ?`).run(pwdInput, member.Member_id, existingU.User_id);
                        user = { ...existingU, User_password: pwdInput, Role: 'CUSTOMER', Member_id: member.Member_id, Phone: member.Phone };
                    } else {
                        const insertU = db.prepare(`
                            INSERT INTO USERS (User_name, User_password, Role, Member_id, Phone, Created_at)
                            VALUES (?, ?, 'CUSTOMER', ?, ?, datetime('now', 'localtime'))
                        `).run(member.Phone, pwdInput, member.Member_id, member.Phone);
                        user = {
                            User_id: insertU.lastInsertRowid,
                            User_name: member.Phone,
                            User_password: pwdInput,
                            Role: 'CUSTOMER',
                            Member_id: member.Member_id,
                            Phone: member.Phone
                        };
                    }
                }
            } catch (em) {
                console.error('Lỗi query MEMBERS trong login:', em.message);
            }
        }

        // 3. Nếu tìm thấy user từ USERS, nạp thêm thông tin hội viên nếu có
        if (user && !memberInfo) {
            try {
                if (user.Member_id) {
                    memberInfo = db.prepare('SELECT Member_id, Phone, Full_name, Card_code, Current_tier, Prepaid_balance, Reward_points FROM MEMBERS WHERE Member_id = ?').get(user.Member_id);
                }
                if (!memberInfo && user.Phone) {
                    memberInfo = db.prepare('SELECT Member_id, Phone, Full_name, Card_code, Current_tier, Prepaid_balance, Reward_points FROM MEMBERS WHERE Phone = ?').get(user.Phone);
                }
                if (!memberInfo) {
                    memberInfo = db.prepare('SELECT Member_id, Phone, Full_name, Card_code, Current_tier, Prepaid_balance, Reward_points FROM MEMBERS WHERE Card_code = ? COLLATE NOCASE OR Phone = ?').get(user.User_name, user.User_name);
                }
            } catch (eMem) {}
        }

        if (user) {
            const role = user.Role || user.role || 'WAITER';
            const fullName = (memberInfo && memberInfo.Full_name) || user.Full_name || user.full_name || user.User_name || 'Khách Hàng';
            const userIdStr = String(user.User_id || user.id || 1);
            const isStaff = !['CUSTOMER', 'KHÁCH HÀNG', 'KHACHHANG'].includes(String(role).toUpperCase());

            // 4. KIỂM TRA ĐỊNH VỊ GPS GEOFENCING (BẮT BUỘC CÓ MẶT TẠI QUÁN MỚI ĐƯỢC ĐĂNG NHẬP)
            if (isStaff) {
                const usernameKey = String(user.User_name || '').toLowerCase();
                const roleUpper = String(role || user.Role || '').toUpperCase();
                const isAdmin = ['ADMIN', 'QUẢN LÝ', 'QUANLY', 'MANAGER'].includes(roleUpper) || usernameKey === 'admin' || usernameKey === 'vu';

                // Quản trị viên (Admin / Quản lý / vu / admin) luôn được tự do đăng nhập mọi nơi, không bị ràng buộc GPS
                if (!isAdmin) {
                    let sysConfig = {};
                    try {
                        const rows = db.prepare("SELECT Key, Value FROM SYSTEM_CONFIG WHERE Key IN ('restaurant_lat', 'restaurant_lng', 'gps_allowed_radius_meters', 'user_gps_policy')").all();
                        rows.forEach(r => {
                            try { sysConfig[r.Key] = JSON.parse(r.Value); } catch(e) { sysConfig[r.Key] = r.Value; }
                        });
                    } catch(eCfg) {}

                    const userGpsPolicy = sysConfig.user_gps_policy || {};
                    const userPolicy = userGpsPolicy[usernameKey] || 'ALLOW_ANYWHERE';

                    if (userPolicy === 'REQUIRE_GPS') {
                        const targetLat = parseFloat(sysConfig.restaurant_lat || 0);
                        const targetLng = parseFloat(sysConfig.restaurant_lng || 0);
                        const allowedRadius = parseInt(sysConfig.gps_allowed_radius_meters || 100, 10);

                        if (targetLat && targetLng) {
                            const clientLat = parseFloat(req.body.latitude);
                            const clientLng = parseFloat(req.body.longitude);

                            if (isNaN(clientLat) || isNaN(clientLng)) {
                                return res.status(403).json({
                                    success: false,
                                    gps_required: true,
                                    error: 'Tài khoản nhân viên này yêu cầu xác thực vị trí tại quán. Vui lòng bật định vị GPS (Location) trên thiết bị và cấp quyền để đăng nhập!'
                                });
                            }

                            const distMeters = calculateDistanceMeters(clientLat, clientLng, targetLat, targetLng);
                            if (distMeters > allowedRadius) {
                                return res.status(403).json({
                                    success: false,
                                    gps_denied: true,
                                    distance: Math.round(distMeters),
                                    allowedRadius: allowedRadius,
                                    error: `Bạn đang ở cách quán ${Math.round(distMeters)} mét (Vượt quá bán kính cho phép: ${allowedRadius}m). Vui lòng có mặt tại quán để đăng nhập!`
                                });
                            }
                        }
                    }
                }
            }

            // 5. KIỂM TRA CHÍNH SÁCH ĐĂNG NHẬP ĐƠN MÁY / ĐA MÁY (CHO NHÂN VIÊN)
            let sessionToken = null;
            if (isStaff) {
                const usernameKey = String(user.User_name || '').toLowerCase();
                const isSingleMode = isUserSingleDeviceMode(userIdStr, user.User_name);

                if (isSingleMode) {
                    const activeRow = db.prepare("SELECT * FROM ACTIVE_SESSIONS WHERE User_id = ? OR LOWER(Username) = ?").get(userIdStr, usernameKey);
                    const hasActiveSession = Boolean(activeRow) || activeStaffSessions.has(userIdStr) || activeStaffSessions.has(usernameKey);

                    if (hasActiveSession) {
                        // Nếu chưa chọn Đẩy phiên (forceLogout) -> Cảnh báo tài khoản đang đăng nhập ở máy khác
                        if (!forceLogout) {
                            return res.status(200).json({
                                success: false,
                                conflict: true,
                                message: `Tài khoản "${fullName}" hiện đang đăng nhập trên một thiết bị/máy khác.`,
                                user: {
                                    User_id: user.User_id,
                                    User_name: user.User_name,
                                    Full_name: fullName,
                                    Role: role
                                }
                            });
                        }

                        // Nếu người dùng chọn Đẩy phiên (forceLogout === true) -> Gửi lệnh logout đến máy cũ qua Socket.IO
                        io.emit('force_logout_user', {
                            userId: userIdStr,
                            username: user.User_name,
                            reason: 'Tài khoản của bạn vừa được đăng nhập trên một thiết bị khác.'
                        });

                        // Xóa phiên cũ khỏi CSDL
                        try {
                            db.prepare("DELETE FROM ACTIVE_SESSIONS WHERE User_id = ? OR LOWER(Username) = ?").run(userIdStr, usernameKey);
                        } catch(eDel) {}
                    }

                    // Khởi tạo Token định danh phiên đăng nhập duy nhất cho thiết bị này
                    sessionToken = 'hs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

                    // Cập nhật phiên đăng nhập mới nhất vào bộ nhớ và CSDL
                    const sessObj = {
                        ip: req.ip || req.connection.remoteAddress || '',
                        userAgent: req.headers['user-agent'] || '',
                        loginTime: Date.now(),
                        sessionToken: sessionToken
                    };
                    activeStaffSessions.set(userIdStr, sessObj);
                    if (usernameKey) activeStaffSessions.set(usernameKey, sessObj);

                    try {
                        db.prepare(`
                            INSERT INTO ACTIVE_SESSIONS (User_id, Username, Full_name, Role, Client_ip, User_agent, Session_token, Login_time)
                            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
                            ON CONFLICT(User_id) DO UPDATE SET 
                                Username = excluded.Username,
                                Full_name = excluded.Full_name,
                                Role = excluded.Role,
                                Client_ip = excluded.Client_ip,
                                User_agent = excluded.User_agent,
                                Session_token = excluded.Session_token,
                                Login_time = excluded.Login_time
                        `).run(userIdStr, user.User_name || '', fullName, role, sessObj.ip, sessObj.userAgent, sessionToken);
                    } catch(eIns) {
                        console.error('Lỗi lưu ACTIVE_SESSIONS:', eIns.message);
                    }
                }
            }

            // Ghi nhận lịch sử và vị trí thiết bị vào LOGIN_HISTORY
            try {
                const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '';
                const cleanIp = String(rawIp).replace(/^.*:/, '') || '127.0.0.1';
                const rawUa = req.headers['user-agent'] || '';
                const devInfo = parseUserAgentInfo(rawUa);
                const clientLat = parseFloat(req.body.latitude);
                const clientLng = parseFloat(req.body.longitude);
                const hasGps = !isNaN(clientLat) && !isNaN(clientLng);

                let distMeters = null;
                if (hasGps) {
                    let sysLat = null, sysLng = null;
                    try {
                        const rLat = db.prepare("SELECT Value FROM SYSTEM_CONFIG WHERE Key = 'restaurant_lat'").get();
                        const rLng = db.prepare("SELECT Value FROM SYSTEM_CONFIG WHERE Key = 'restaurant_lng'").get();
                        if (rLat) sysLat = parseFloat(JSON.parse(rLat.Value));
                        if (rLng) sysLng = parseFloat(JSON.parse(rLng.Value));
                    } catch(eG) {}
                    if (sysLat && sysLng) {
                        distMeters = Math.round(calculateDistanceMeters(clientLat, clientLng, sysLat, sysLng));
                    }
                }

                const uType = isStaff ? 'STAFF' : 'CUSTOMER';
                db.prepare(`
                    INSERT INTO LOGIN_HISTORY (
                        User_id, Username, Full_name, Role, User_type, 
                        Client_ip, User_agent, Device_info, 
                        Latitude, Longitude, Distance_to_restaurant, 
                        Status, Login_time
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUCCESS', datetime('now', 'localtime'))
                `).run(
                    user.User_id || user.id || null,
                    user.User_name || user.username || accountInput,
                    fullName,
                    role,
                    uType,
                    cleanIp,
                    rawUa,
                    devInfo,
                    hasGps ? clientLat : null,
                    hasGps ? clientLng : null,
                    distMeters
                );

                if (typeof io !== 'undefined' && io) {
                    io.emit('login_history_updated', { userId: user.User_id, username: user.User_name, action: 'LOGIN' });
                }
            } catch(eHist) {
                console.error('Lỗi ghi LOGIN_HISTORY:', eHist.message);
            }

            res.json({
                success: true,
                message: 'Đăng nhập thành công!',
                user: {
                    User_id: user.User_id || user.id || 1,
                    User_name: user.User_name || user.username || accountInput,
                    Full_name: fullName,
                    Role: role,
                    Member_id: memberInfo ? memberInfo.Member_id : (user.Member_id || null),
                    Phone: memberInfo ? memberInfo.Phone : (user.Phone || null),
                    Card_code: memberInfo ? memberInfo.Card_code : null,
                    sessionToken: sessionToken
                }
            });
        } else {
            res.status(401).json({ success: false, error: 'Tên đăng nhập, số điện thoại hoặc mật khẩu không chính xác!' });
        }
    } catch (err) {
        console.error('Lỗi xử lý đăng nhập:', err);
        res.status(500).json({ success: false, error: 'Lỗi server: ' + err.message });
    }
});

// API Kiểm tra trạng thái hiệu lực của phiên đăng nhập (Heartbeat / Polling phòng ngừa mất kết nối)
app.get('/api/verify-session', (req, res) => {
    try {
        const { userId, username, sessionToken } = req.query;
        if (!userId && !username) {
            return res.json({ valid: true });
        }

        const uidStr = String(userId || '');
        const uKey = String(username || '').toLowerCase();

        // Khách hàng không bị giới hạn đơn máy
        try {
            const userRow = db.prepare("SELECT Role FROM USERS WHERE User_id = ? OR LOWER(User_name) = ?").get(uidStr, uKey);
            if (userRow && ['CUSTOMER', 'KHÁCH HÀNG', 'KHACHHANG'].includes(String(userRow.Role).toUpperCase())) {
                return res.json({ valid: true });
            }
        } catch(eU) {}

        const isSingle = isUserSingleDeviceMode(uidStr, uKey);
        if (!isSingle) {
            return res.json({ valid: true });
        }

        const active = db.prepare("SELECT Session_token FROM ACTIVE_SESSIONS WHERE User_id = ? OR LOWER(Username) = ?").get(uidStr, uKey);
        if (!active) {
            // Không tìm thấy phiên làm việc trong bảng ACTIVE_SESSIONS
            return res.json({ valid: false, reason: 'SESSION_NOT_FOUND' });
        }

        if (active.Session_token && sessionToken && active.Session_token !== sessionToken) {
            // Token của client này không trùng khớp với Token của phiên mới nhất -> Bị chiếm quyền
            return res.json({ valid: false, reason: 'SESSION_DISPLACED' });
        }

        return res.json({ valid: true });
    } catch (err) {
        res.json({ valid: true });
    }
});

// API Đăng Xuất Hệ Thống (Xóa session active & cập nhật lịch sử)
app.post('/api/logout', (req, res) => {
    try {
        const { userId, username } = req.body || {};
        const uidStr = userId ? String(userId) : null;
        const uKey = username ? String(username).toLowerCase() : null;

        if (uidStr) {
            activeStaffSessions.delete(uidStr);
            try { db.prepare("DELETE FROM ACTIVE_SESSIONS WHERE User_id = ?").run(uidStr); } catch(e) {}
        }
        if (uKey) {
            activeStaffSessions.delete(uKey);
            try { db.prepare("DELETE FROM ACTIVE_SESSIONS WHERE LOWER(Username) = ?").run(uKey); } catch(e) {}
        }

        // Cập nhật trạng thái trong LOGIN_HISTORY thành LOGGED_OUT và ghi nhận Logout_time
        try {
            if (uidStr && uKey) {
                db.prepare(`
                    UPDATE LOGIN_HISTORY 
                    SET Status = 'LOGGED_OUT', Logout_time = datetime('now', 'localtime')
                    WHERE (User_id = ? OR LOWER(Username) = ?) AND Status = 'SUCCESS'
                `).run(uidStr, uKey);
            } else if (uidStr) {
                db.prepare(`
                    UPDATE LOGIN_HISTORY 
                    SET Status = 'LOGGED_OUT', Logout_time = datetime('now', 'localtime')
                    WHERE User_id = ? AND Status = 'SUCCESS'
                `).run(uidStr);
            } else if (uKey) {
                db.prepare(`
                    UPDATE LOGIN_HISTORY 
                    SET Status = 'LOGGED_OUT', Logout_time = datetime('now', 'localtime')
                    WHERE LOWER(Username) = ? AND Status = 'SUCCESS'
                `).run(uKey);
            }
        } catch(eHist) {
            console.error('Lỗi cập nhật Logout LOGIN_HISTORY:', eHist.message);
        }

        // Bắn Socket.IO cập nhật tức thì đến toàn bộ Quản lý đang mở tab Lịch sử thiết bị
        if (typeof io !== 'undefined' && io) {
            io.emit('login_history_updated', { userId: uidStr, username: uKey, action: 'LOGOUT' });
        }

        res.json({ success: true, message: 'Đăng xuất thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/subscribe-push', (req, res) => {
    res.status(200).json({ success: true, message: 'Đã nhận Push Subscription' });
});

// ==========================================
// 6. ORDER MANAGEMENT APIS
// ==========================================

// Lấy danh sách đơn hàng cho POS / Đơn Hàng (Trả về Is_edited và danh sách món)
app.get('/api/orders', (req, res) => {
    try {
        const orders = db.prepare(`SELECT * FROM ORDERS ORDER BY Created_at DESC`).all();
        const getDetails = db.prepare(`SELECT * FROM ORDER_DETAILS WHERE Order_id = ?`);

        const result = orders.map(o => {
            const items = getDetails.all(o.Order_id);
            return {
                ...o,
                items: items,
                Is_edited: Number(o.Is_edited || 0), // Luôn trả về 1 hoặc 0
                Total_amount: o.Final_amount || o.Total_amount || 0
            };
        });

        res.json(result);
    } catch (err) {
        console.error('Lỗi GET /api/orders:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Tạo đơn mới HOẶC Lưu đơn đã sửa (Bật Is_edited = 1)
app.post('/api/orders', (req, res) => {
    try {
        const { Table_number, Table_name, Order_type, Customer_name, Payment_method, Note, items, totalAmount } = req.body;
        
        let rawEditId = req.body.editingOrderId || req.body.editing_order_id || req.body.editOrderId;
        let editingOrderId = null;

        if (rawEditId && String(rawEditId).trim() !== '' && String(rawEditId) !== 'null' && String(rawEditId) !== 'undefined') {
            editingOrderId = String(rawEditId).replace('#', '').trim();
        }

        let calculatedTotal = 0;
        if (Array.isArray(items)) {
            calculatedTotal = items.reduce((sum, item) => {
                const price = Number(item.price || item.Unit_price || 35000);
                const qty = Number(item.quantity || item.Quantity || 1);
                return sum + (price * qty);
            }, 0);
        }
        const finalTotal = totalAmount && Number(totalAmount) > 0 ? Number(totalAmount) : calculatedTotal;
        const tableName = Table_number || Table_name || 'Bàn 01';

        // 🌟 1. SỬA ĐƠN HÀNG
        if (editingOrderId) {
            const cleanCode = editingOrderId;
            const codeWithPrefix = cleanCode.startsWith('CHAY-') ? cleanCode : ('CHAY-' + cleanCode);
            const codeWithoutPrefix = cleanCode.replace('CHAY-', '');

            // Thực hiện Cập nhật CSDL
            const stmtUpdate = db.prepare(`
                UPDATE ORDERS 
                SET Table_number = ?, Order_type = ?, Customer_name = ?, Payment_method = ?, Final_amount = ?, Note = ?, Is_edited = 1 
                WHERE Order_code = ? OR Order_code = ? OR Order_code = ? OR Order_id = ?
            `);

            const info = stmtUpdate.run(
                tableName, 
                Order_type || 'DINE_IN', 
                Customer_name || 'Khách vãng lai', 
                Payment_method || 'CASH', 
                finalTotal, 
                Note || '', 
                codeWithPrefix, 
                cleanCode, 
                codeWithoutPrefix, 
                cleanCode
            );

            // 🔍 KIỂM TRA LẠI GIÁ TRỊ THỰC TẾ TRONG CSDL
            const checkUpdatedRow = db.prepare(`
                SELECT Order_id, Order_code, Is_edited FROM ORDERS 
                WHERE Order_code = ? OR Order_code = ? OR Order_id = ?
            `).get(codeWithPrefix, cleanCode, cleanCode);

            const actualIsEdited = checkUpdatedRow ? checkUpdatedRow.Is_edited : 'KHÔNG TÌM THẤY DÒNG';

            console.log(`\n==================================================`);
            console.log(`🔍 [LOG SỬA ĐƠN] Đã gửi lệnh UPDATE cho đơn: "${codeWithPrefix}"`);
            console.log(`🔍 [LOG SỬA ĐƠN] Số dòng CSDL được cập nhật (info.changes): ${info.changes}`);
            console.log(`🔥 [LOG SỬA ĐƠN] Giá trị Is_edited THỰC TẾ trong CSDL lúc này: ${actualIsEdited}`);
            console.log(`==================================================\n`);

            // Xóa món cũ & chèn danh sách món mới
            const targetId = checkUpdatedRow ? checkUpdatedRow.Order_id : cleanCode;
            db.prepare(`DELETE FROM ORDER_DETAILS WHERE Order_id = ?`).run(targetId);

            if (Array.isArray(items) && items.length > 0) {
                const stmtDetail = db.prepare(`INSERT INTO ORDER_DETAILS (Order_id, Item_name, Quantity, Unit_price, Total_price) VALUES (?, ?, ?, ?, ?)`);
                items.forEach(i => {
                    const price = Number(i.price || i.Unit_price || 35000);
                    const qty = Number(i.quantity || i.Quantity || 1);
                    stmtDetail.run(targetId, i.name || i.Item_name || 'Món chay', qty, price, qty * price);
                });
            }

            // Phát Socket.IO để Client nạp lại tức thì
            if (typeof io !== 'undefined' && io) {
                io.emit('order_status_updated', {
                    Order_id: targetId,
                    Order_code: codeWithPrefix,
                    Is_edited: 1
                });
            }

            return res.json({ 
                success: true, 
                message: 'Cập nhật đơn thành công', 
                Order_code: codeWithPrefix, 
                Final_amount: finalTotal, 
                Is_edited: 1 
            });
        } 
        
        // 🌟 1.5. BỔ SUNG MÓN VÀO ĐƠN ĐANG PHỤC VỤ (GỌI THÊM)
        else if (req.body.isAddMore && (req.body.targetOrderCode || req.body.activeOrderCode)) {
            const targetCode = req.body.targetOrderCode || req.body.activeOrderCode;
            const cleanTarget = String(targetCode).replace('#', '').trim();
            const targetWithPrefix = cleanTarget.startsWith('CHAY-') ? cleanTarget : ('CHAY-' + cleanTarget);

            const existingOrder = db.prepare(`
                SELECT Order_id, Order_code, Final_amount, Total_amount, Status 
                FROM ORDERS 
                WHERE Order_code = ? OR Order_code = ? OR Order_id = ?
            `).get(targetWithPrefix, cleanTarget, cleanTarget);

            if (existingOrder) {
                const orderId = existingOrder.Order_id;
                const newItemsTotal = calculatedTotal;
                const updatedFinalAmount = Number(existingOrder.Final_amount || existingOrder.Total_amount || 0) + newItemsTotal;

                // Cập nhật đơn hàng: cộng dồn tổng tiền và bật Is_edited = 1
                db.prepare(`
                    UPDATE ORDERS 
                    SET Final_amount = ?, Is_edited = 1, Updated_at = datetime('now', 'localtime')
                    WHERE Order_id = ?
                `).run(updatedFinalAmount, orderId);

                // Thêm các món mới vào ORDER_DETAILS với ghi chú [Gọi thêm]
                if (Array.isArray(items) && items.length > 0) {
                    const stmtDetail = db.prepare(`
                        INSERT INTO ORDER_DETAILS (Order_id, Item_name, Quantity, Unit_price, Total_price, Note) 
                        VALUES (?, ?, ?, ?, ?, ?)
                    `);
                    items.forEach(i => {
                        const price = Number(i.price || i.Unit_price || 35000);
                        const qty = Number(i.quantity || i.Quantity || 1);
                        let itemNote = i.note || '';
                        if (!itemNote.includes('[Gọi thêm]')) {
                            itemNote = itemNote ? `[Gọi thêm] ${itemNote}` : '[Gọi thêm]';
                        }
                        stmtDetail.run(orderId, i.name || i.Item_name || 'Món chay', qty, price, qty * price, itemNote);
                    });
                }

                // Cập nhật số tiền hiển thị trên bàn ăn
                const cleanT = tableName.replace(/^Bàn\s*/i, 'B').toLowerCase().trim();
                db.prepare(`
                    UPDATE DINING_TABLES 
                    SET Current_amount = ?, Updated_at = datetime('now', 'localtime')
                    WHERE Table_name = ? OR Table_code = ? OR Table_code = ?
                `).run(updatedFinalAmount, tableName, tableName, cleanT);

                // Bắn Socket thông báo realtime tới Bếp và Thu ngân
                if (typeof io !== 'undefined' && io) {
                    io.emit('order_status_updated', {
                        Order_id: orderId,
                        Order_code: existingOrder.Order_code,
                        Is_edited: 1,
                        isAddMore: true
                    });
                    io.emit('kitchen_new_order', {
                        Order_id: orderId,
                        Order_code: existingOrder.Order_code,
                        Table_number: tableName,
                        isAddMore: true,
                        Items: items
                    });
                    io.emit('table_updated', {
                        Table_name: tableName,
                        Current_amount: updatedFinalAmount
                    });
                }

                return res.json({ 
                    success: true, 
                    message: `Đã bổ sung ${items ? items.length : 0} món gọi thêm vào đơn #${existingOrder.Order_code}!`, 
                    Order_id: orderId, 
                    Order_code: existingOrder.Order_code, 
                    Final_amount: updatedFinalAmount, 
                    Is_edited: 1,
                    isAddMore: true
                });
            }
        }

        // 🔵 2. ĐƠN MỚI TẠO
        else {
            const orderCode = 'CHAY-' + Date.now().toString().slice(-6);
            let isKitchenAutoAccept = false;
            try {
                const sysRow = db.prepare(`SELECT Value FROM SYSTEM_CONFIG WHERE Key = 'kitchen_auto_accept' OR Key = 'kitchenAutoAccept'`).get();
                if (sysRow) {
                    let val = sysRow.Value;
                    try { val = JSON.parse(val); } catch(e) {}
                    if (val === true || val === 'true' || val === 1 || val === '1') {
                        isKitchenAutoAccept = true;
                    }
                }
            } catch(e) {}
            const initialStatus = isKitchenAutoAccept ? 'COOKING' : 'PROCESSING';

            const stmtOrder = db.prepare(`
                INSERT INTO ORDERS (Order_code, Order_type, Table_number, Customer_name, Payment_method, Final_amount, Note, Status, Is_edited)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            `);
            const info = stmtOrder.run(orderCode, Order_type || 'DINE_IN', tableName, Customer_name || 'Khách vãng lai', Payment_method || 'CASH', finalTotal, Note || '', initialStatus);
            const newOrderId = info.lastInsertRowid;

            if (Array.isArray(items) && items.length > 0) {
                const stmtDetail = db.prepare(`INSERT INTO ORDER_DETAILS (Order_id, Item_name, Quantity, Unit_price, Total_price) VALUES (?, ?, ?, ?, ?)`);
                items.forEach(i => {
                    const price = Number(i.price || i.Unit_price || 35000);
                    const qty = Number(i.quantity || i.Quantity || 1);
                    stmtDetail.run(newOrderId, i.name || i.Item_name || 'Món chay', qty, price, qty * price);
                });
            }

            if (io) {
                io.emit('kitchen_new_order', {
                    Order_id: newOrderId,
                    Order_code: orderCode,
                    Table_name: tableName,
                    Table_number: tableName,
                    Items: items,
                    items: items,
                    Final_amount: finalTotal,
                    Is_edited: 0
                });
                emitOrderBadgeCounts(io, db);
            }

            return res.json({ success: true, message: 'Gửi đơn xuống Bếp thành công', Order_id: newOrderId, Order_code: orderCode, Final_amount: finalTotal, Is_edited: 0 });
        }
    } catch (err) {
        console.error('❌ Lỗi POST /api/orders:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// Cập nhật trạng thái "XONG" / "ĐANG LÀM"
// Cập nhật trạng thái "XONG" / "ĐANG LÀM"
app.put('/api/orders/:id/status', (req, res) => {
    try {
        const idParam = req.params.id;
        const { status } = req.body;
        const newStatus = (status || 'COMPLETED').toUpperCase();

        const numericId = parseInt(idParam, 10) || 0;
        const codeWithPrefix = idParam.startsWith('CHAY-') ? idParam : ('CHAY-' + idParam);

        // Lấy thông tin đơn hàng trước khi update để biết bàn nào
        const orderInfo = db.prepare(`SELECT Order_id, Order_code, Table_number FROM ORDERS WHERE Order_id = ? OR Order_code = ? OR Order_code = ?`).get(numericId, idParam, codeWithPrefix);

        const stmt = db.prepare(`
            UPDATE ORDERS 
            SET Status = ?, Cancel_role = NULL, Cancel_reason = NULL 
            WHERE Order_id = ? OR Order_code = ? OR Order_code = ?
        `);
        const info = stmt.run(newStatus, numericId, idParam, codeWithPrefix);

        // Nếu chuyển sang COMPLETED, SERVED hoặc CANCELED -> tự động giải phóng bàn
        if (['COMPLETED', 'SERVED', 'CANCELED', 'CANCELLED'].includes(newStatus) && orderInfo && orderInfo.Table_number) {
            try {
                const cleanTable = orderInfo.Table_number.replace(/^Bàn\s*/i, 'B').trim();
                db.prepare(`
                    UPDATE DINING_TABLES
                    SET Status = 'EMPTY', Current_order_id = NULL, Current_order_code = NULL, Current_amount = 0, Payment_status = 'UNPAID', Current_guests = 0, Updated_at = datetime('now', 'localtime')
                    WHERE (LOWER(Table_name) = LOWER(?) OR LOWER(Table_code) = LOWER(?) OR LOWER(Table_name) = LOWER(?))
                      AND (Current_order_id = ? OR Current_order_code = ?)
                `).run(orderInfo.Table_number, orderInfo.Table_number, cleanTable, orderInfo.Order_id, orderInfo.Order_code);
            } catch(e) {}
        }

        console.log(`✅ [SQLite] Cập nhật đơn #${idParam} -> Status: ${newStatus}`);

        if (typeof io !== 'undefined' && io) {
            io.emit('order_status_updated', {
                Order_id: numericId || idParam,
                Order_code: codeWithPrefix,
                Status: newStatus
            });
            io.emit('table_updated', { Table_name: orderInfo ? orderInfo.Table_number : null, Status: 'EMPTY' });
            io.emit('tables_list_changed');
        }

        return res.json({ success: true, message: 'Đã lưu trạng thái vào CSDL thành công!' });
    } catch (err) {
        console.error('❌ Lỗi PUT /api/orders/:id/status:', err.message);
        return res.status(500).json({ error: 'Lỗi CSDL: ' + err.message });
    }
});

// Cập nhật HỦY ĐƠN HÀNG (Kèm vai trò & Lý do)
app.put('/api/orders/:id/cancel', (req, res) => {
    try {
        const id = req.params.id;
        const { cancelRole, cancelNote } = req.body;
        const role = cancelRole || 'Bếp';
        const note = cancelNote || 'Hủy đơn hàng';

        const orderInfo = db.prepare(`SELECT Order_id, Order_code, Table_number FROM ORDERS WHERE Order_id = ? OR Order_code = ?`).get(id, id);

        const stmt = db.prepare(`
            UPDATE ORDERS 
            SET Status = 'CANCELED', Cancel_role = ?, Cancel_reason = ?, Note = ? 
            WHERE Order_id = ? OR Order_code = ?
        `);
        stmt.run(role, note, note, id, id);

        if (orderInfo && orderInfo.Table_number) {
            try {
                const cleanTable = orderInfo.Table_number.replace(/^Bàn\s*/i, 'B').trim();
                db.prepare(`
                    UPDATE DINING_TABLES
                    SET Status = 'EMPTY', Current_order_id = NULL, Current_order_code = NULL, Current_amount = 0, Payment_status = 'UNPAID', Current_guests = 0, Updated_at = datetime('now', 'localtime')
                    WHERE (LOWER(Table_name) = LOWER(?) OR LOWER(Table_code) = LOWER(?) OR LOWER(Table_name) = LOWER(?))
                      AND (Current_order_id = ? OR Current_order_code = ?)
                `).run(orderInfo.Table_number, orderInfo.Table_number, cleanTable, orderInfo.Order_id, orderInfo.Order_code);
            } catch(e) {}
        }

        console.log(`⛔ [SQLite] Đã hủy đơn #${id} do [${role}]: ${note}`);

        if (typeof io !== 'undefined' && io) {
            io.emit('order_status_updated', { Order_id: id, Status: 'CANCELED', Cancel_role: role, Cancel_reason: note });
            io.emit('table_updated', { Table_name: orderInfo ? orderInfo.Table_number : null, Status: 'EMPTY' });
            io.emit('tables_list_changed');
        }

        res.json({ success: true, message: 'Đã hủy đơn thành công!' });
    } catch (err) {
        console.error('Lỗi PUT /cancel:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Xóa vĩnh viễn đơn hàng
app.delete('/api/orders/:id', (req, res) => {
    try {
        const id = req.params.id;
        const orderInfo = db.prepare(`SELECT Order_id, Order_code, Table_number FROM ORDERS WHERE Order_id = ? OR Order_code = ?`).get(id, id);

        db.prepare(`DELETE FROM ORDER_DETAILS WHERE Order_id = (SELECT Order_id FROM ORDERS WHERE Order_id = ? OR Order_code = ?)`).run(id, id);
        db.prepare(`DELETE FROM ORDERS WHERE Order_id = ? OR Order_code = ?`).run(id, id);

        if (orderInfo && orderInfo.Table_number) {
            try {
                const cleanTable = orderInfo.Table_number.replace(/^Bàn\s*/i, 'B').trim();
                db.prepare(`
                    UPDATE DINING_TABLES
                    SET Status = 'EMPTY', Current_order_id = NULL, Current_order_code = NULL, Current_amount = 0, Payment_status = 'UNPAID', Current_guests = 0, Updated_at = datetime('now', 'localtime')
                    WHERE (LOWER(Table_name) = LOWER(?) OR LOWER(Table_code) = LOWER(?) OR LOWER(Table_name) = LOWER(?))
                      AND (Current_order_id = ? OR Current_order_code = ?)
                `).run(orderInfo.Table_number, orderInfo.Table_number, cleanTable, orderInfo.Order_id, orderInfo.Order_code);
            } catch(e) {}
        }

        if (typeof io !== 'undefined' && io) {
            io.emit('order_status_updated', { Order_id: id, Status: 'DELETED' });
            io.emit('table_updated', { Table_name: orderInfo ? orderInfo.Table_number : null, Status: 'EMPTY' });
            io.emit('tables_list_changed');
        }

        res.json({ success: true, message: 'Đã xóa vĩnh viễn đơn hàng!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 7. ORDER LOGS & HISTORY APIS
// ==========================================

// Ghi nhật ký vết chỉnh sửa đơn hàng
app.post('/api/orders/log', (req, res) => {
    try {
        const { Order_code, Modified_by, Old_content, New_content } = req.body;
        const stmt = db.prepare(`
            INSERT INTO ORDER_LOGS (Order_code, Modified_by, Old_content, New_content)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(Order_code || 'CHAY-ORDER', Modified_by || 'Quản Lý', Old_content || '', New_content || '');
        return res.json({ success: true, message: 'Đã lưu lịch sử sửa đơn' });
    } catch (err) {
        console.error('❌ Lỗi lưu ORDER_LOGS:', err.message);
        return res.json({ success: false, message: 'Không thể ghi log nhưng đơn vẫn sửa bình thường' });
    }
});

// Lấy lịch sử vết chỉnh sửa theo mã đơn
app.get('/api/orders/:code/history', (req, res) => {
    try {
        const code = req.params.code;
        const cleanCode = code.replace('CHAY-', '');
        
        const logs = db.prepare(`
            SELECT * FROM ORDER_LOGS 
            WHERE Order_code = ? OR Order_code = ? OR Order_code = ?
            ORDER BY Log_id DESC
        `).all(code, 'CHAY-' + cleanCode, cleanCode);

        return res.json(Array.isArray(logs) ? logs : []);
    } catch (err) {
        console.error('❌ Lỗi GET /api/orders/:code/history:', err.message);
        return res.json([]);
    }
});

// ==========================================
// 8. KITCHEN (KDS) APIS
// ==========================================
app.get('/api/kitchen/pending-orders', (req, res) => {
    try {
        const orders = db.prepare(`
            SELECT * FROM ORDERS 
            WHERE (Status IS NULL OR Status = '' OR UPPER(Status) IN ('PENDING', 'PROCESSING', 'COOKING', 'ACCEPTED'))
              AND (Cancel_role IS NULL OR Cancel_role = '')
            ORDER BY Order_id DESC
        `).all();

        const getDetails = db.prepare(`SELECT Detail_id, Item_name, Quantity, Unit_price, Total_price, Note, Toppings FROM ORDER_DETAILS WHERE Order_id = ?`);

        const result = orders.map(order => {
            const items = getDetails.all(order.Order_id);
            return {
                Order_id: order.Order_id,
                Order_code: order.Order_code || order.Order_id,
                Order_type: order.Order_type || 'DINE_IN',
                Table_number: order.Table_number || 'Bàn 01',
                Customer_name: order.Customer_name || 'Khách vãng lai',
                Payment_method: order.Payment_method || 'CASH',
                Final_amount: order.Final_amount || 0,
                Note: order.Note || '',
                Status: order.Status || 'PROCESSING',
                Created_at: order.Created_at,
                items: items
            };
        });

        res.json(result);
    } catch (err) {
        console.error('❌ Lỗi tại /api/kitchen/pending-orders:', err.message);
        res.status(500).json({ error: 'Lỗi CSDL: ' + err.message });
    }
});

app.put('/api/kitchen/accept-order/:id', (req, res) => {
    try {
        const stmt = db.prepare('UPDATE ORDERS SET Status = ? WHERE Order_id = ? OR Order_code = ?');
        stmt.run('COOKING', req.params.id, req.params.id);

        io.emit('order_status_updated', { Order_id: req.params.id, Status: 'COOKING' });
        io.emit('kitchen_order_accepted', { Order_id: req.params.id, Status: 'COOKING' });
        res.json({ success: true, Status: 'COOKING', message: 'Đã chấp nhận đơn hàng!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/kitchen/update-status/:id', (req, res) => {
    try {
        const { Status } = req.body;
        const stmt = db.prepare('UPDATE ORDERS SET Status = ? WHERE Order_id = ?');
        stmt.run(Status, req.params.id);

        io.emit('order_status_updated', { Order_id: req.params.id, Status });
        res.json({ success: true, Status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/kitchen/cancel-order/:id', (req, res) => {
    try {
        const { Reason } = req.body;
        const orderId = req.params.id;
        
        const stmt = db.prepare(`
            UPDATE ORDERS 
            SET Status = 'CANCELLED', 
                Note = CASE WHEN Note IS NULL OR Note = '' THEN ? ELSE Note || ' | [HỦY BẾP: ' || ? || ']' END 
            WHERE Order_id = ?
        `);
        stmt.run(`Lý do: ${Reason || 'Hết món/Thiếu đồ'}`, Reason || 'Hết món', orderId);

        if (io) {
            io.emit('kitchen_order_cancelled', { Order_id: orderId, Reason: Reason || 'Hết món' });
        }

        res.json({ success: true, message: 'Đã hủy đơn thành công' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/kitchen/history', (req, res) => {
    try {
        const { filterType, startDate, endDate } = req.query;

        let dateCondition = "";
        let params = [];

        if (filterType === 'TODAY') {
            dateCondition = "AND DATE(o.Created_at) = DATE('now', 'localtime')";
        } else if (filterType === 'WEEK') {
            dateCondition = "AND DATE(o.Created_at) >= DATE('now', '-7 days', 'localtime')";
        } else if (filterType === 'MONTH') {
            dateCondition = "AND strftime('%Y-%m', o.Created_at) = strftime('%Y-%m', 'now', 'localtime')";
        } else if (filterType === 'CUSTOM' && startDate && endDate) {
            dateCondition = "AND DATE(o.Created_at) BETWEEN DATE(?) AND DATE(?)";
            params.push(startDate, endDate);
        }

        const query = `
            SELECT o.* FROM ORDERS o
            WHERE o.Status IN ('READY', 'COMPLETED', 'CANCELLED') ${dateCondition}
            ORDER BY o.Created_at DESC
        `;

        const orders = db.prepare(query).all(...params) || [];

        const formatted = orders.map(order => {
            let items = [];
            try {
                items = db.prepare('SELECT * FROM ORDER_DETAILS WHERE Order_id = ?').all(order.Order_id);
            } catch (e2) { items = []; }
            return {
                ...order,
                Items: items.map(it => ({
                    Item_name: it.item_name || it.Item_name || 'Món ăn',
                    Quantity: it.quantity || it.Quantity || 1,
                    Note: it.note || it.Note || ''
                }))
            };
        });

        res.json(formatted);
    } catch (err) {
        console.error('Lỗi API Lịch sử Bếp:', err);
        res.json([]);
    }
});

// ==========================================
// 9. VAPID PUSH NOTIFICATION SETUP
// ==========================================
const webpush = require('web-push');

let vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || ''
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    const generated = webpush.generateVAPIDKeys();
    vapidKeys.publicKey = generated.publicKey;
    vapidKeys.privateKey = generated.privateKey;
}

try {
    webpush.setVapidDetails('mailto:hoasen@restaurant.com', vapidKeys.publicKey, vapidKeys.privateKey);
} catch (errVapid) {}

app.get('/api/push/public-key', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
});

// ==========================================
// 10. SPA CATCH-ALL ROUTE & SERVER LISTEN
// ==========================================
app.get(['/', '/orders', '/cart', '/categories', '/menu', '/menu-cards', '/users', '/payments', '/shipper', '/system-settings', '/system_settings', '/system settings', '/kitchen', '/ready-orders', '/tables', '/members', '/membership', '/tra-cuu-thanh-vien'], (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`===================================================`);
    console.log(`🚀 Server Nhà Hàng Chay Hoa Sen đang chạy: http://localhost:${PORT}`);
    console.log(`📱 Kết nối Điện Thoại cùng mạng Wifi: http://192.168.1.12:${PORT}`);
    console.log(`===================================================`);
});

// HTTPS cho điện thoại/tablet: trình duyệt chỉ cho mở Camera trực tiếp (quét QR live) khi trang chạy HTTPS
const HTTPS_PORT = 3443;
try {
    const keyPath = path.join(__dirname, 'certs', 'key.pem');
    const certPath = path.join(__dirname, 'certs', 'cert.pem');
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        const https = require('https');
        const httpsServer = https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, app);
        io.engine.attach(httpsServer, { path: '/socket.io/' });
        // Phục vụ file socket.io.js cho trình duyệt trên cổng HTTPS
        const engineListeners = httpsServer.listeners('request').slice();
        httpsServer.removeAllListeners('request');
        httpsServer.on('request', (req, res) => {
            if (req.url && req.url.startsWith('/socket.io/socket.io.js')) {
                try {
                    const clientPath = path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js');
                    if (!fs.existsSync(clientPath)) throw new Error('missing');
                    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
                    return fs.createReadStream(clientPath).pipe(res);
                } catch (e) { /* bỏ qua, chuyển tiếp */ }
            }
            engineListeners.forEach(fn => fn.call(httpsServer, req, res));
        });
        httpsServer.on('error', (e) => console.error('⚠️ Không mở được HTTPS:', e.message));
        httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
            console.log(`🔒 HTTPS (quét QR bằng camera điện thoại): https://192.168.1.12:${HTTPS_PORT}`);
        });
    }
} catch (eHttps) {
    console.error('⚠️ Lỗi khởi tạo HTTPS:', eHttps.message);
}