const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');
const DB_PATH = path.join(__dirname, '../database.db');

// Helper phát Socket cập nhật số lượng đơn cho Navbar Badges
function emitOrderBadgeCounts(io) {
    if (!io) return;
    try {
        const db = new Database(DB_PATH, { readonly: true });
        const pendingRow = db.prepare(`
            SELECT COUNT(*) as count FROM ORDERS 
            WHERE Status = 'PROCESSING' OR Status IS NULL OR Status = '' OR Status = 'PENDING' OR UPPER(Status) IN ('COOKING', 'ACCEPTED')
        `).get();
        const readyRow = db.prepare(`
            SELECT COUNT(*) as count FROM ORDERS WHERE UPPER(Status) = 'READY'
        `).get();
        db.close();
        io.emit('order_counts_updated', {
            pendingKitchenCount: pendingRow ? pendingRow.count : 0,
            readyOrdersCount: readyRow ? readyRow.count : 0
        });
    } catch(e) {}
}

// 1. GET: Lấy danh sách đơn chờ cho Bếp (Khớp chính xác Field CSDL)
router.get('/pending-orders', (req, res) => {
    try {
        const db = new Database(DB_PATH, { readonly: true });
        
        // Lấy tất cả đơn hàng đang chờ xử lý từ bảng ORDERS
        const orders = db.prepare(`
            SELECT Order_id, Order_code, Order_type, Table_number, Table_name, Customer_name, Final_amount, Total_amount, Note, Status, Is_edited, Created_at,
                   Delivery_platform, Customer_phone, Delivery_address, Payment_type,
                   Staff_name, Created_by, Paid_by, Member_id, Member_name, Member_tier, Member_phone
            FROM ORDERS 
            WHERE Status = 'PROCESSING' OR Status IS NULL OR Status = '' OR Status = 'PENDING' OR UPPER(Status) IN ('COOKING', 'ACCEPTED')
            ORDER BY Order_id DESC
        `).all();

        // Lấy danh sách món từ ORDER_DETAILS với đúng các trường: Item_name, Quantity, Unit_price, Total_price
        const result = orders.map(order => {
            const numericOrderId = Number(order.Order_id);
            let items = [];

            try {
                items = db.prepare(`
                    SELECT Detail_id, Order_id, Item_name, Quantity, Unit_price, Total_price, Note, Toppings 
                    FROM ORDER_DETAILS 
                    WHERE Order_id = ?
                `).all(numericOrderId);
            } catch (e) {
                console.error('Lỗi SELECT ORDER_DETAILS:', e.message);
                items = [];
            }

            return {
                ...order,
                Items: items || [],
                items: items || []
            };
        });

        db.close();
        res.json(result);
    } catch (err) {
        console.error('❌ Lỗi GET /api/kitchen/pending-orders:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 1.5. PUT: Bếp chấp nhận đơn hàng (Chuyển sang COOKING)
router.put('/accept-order/:id', (req, res) => {
    try {
        const orderIdentifier = req.params.id;
        const db = new Database(DB_PATH);
        db.prepare(`
            UPDATE ORDERS 
            SET Status = 'COOKING' 
            WHERE Order_id = ? OR Order_code = ?
        `).run(orderIdentifier, orderIdentifier);
        db.close();

        const io = req.app.get('io');
        if (io) {
            io.emit('order_status_updated', { Order_id: orderIdentifier, Status: 'COOKING' });
            io.emit('kitchen_order_accepted', { Order_id: orderIdentifier, Status: 'COOKING' });
            emitOrderBadgeCounts(io);
        }

        res.json({ success: true, message: 'Đã chấp nhận đơn hàng!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. PUT: Cập nhật trạng thái đơn thành READY (Bếp báo xong)
router.put('/update-status/:id', (req, res) => {
    try {
        const orderIdentifier = req.params.id;
        const { Status, Staff_username, Staff_name, Staff_role } = req.body;
        const newStatus = Status || 'READY';

        const db = new Database(DB_PATH);
        const orderInfo = db.prepare(`SELECT Order_id, Order_code, Table_number, Final_amount, Total_amount FROM ORDERS WHERE Order_id = ? OR Order_code = ?`).get(orderIdentifier, orderIdentifier);

        const staffUser = Staff_username || 'bep';
        db.prepare(`
            UPDATE ORDERS 
            SET Status = ?,
                Cooked_by = CASE WHEN ? = 'READY' THEN ? ELSE Cooked_by END
            WHERE Order_id = ? OR Order_code = ?
        `).run(newStatus, newStatus, staffUser, orderIdentifier, orderIdentifier);

        // Ghi nhận KPI Bếp nấu xong món
        if (newStatus === 'READY' && orderInfo) {
            try {
                db.prepare(`
                    INSERT INTO STAFF_KPI_LOGS (Staff_username, Staff_name, Staff_role, Action_type, Order_id, Order_code, Table_number, Amount, Note)
                    VALUES (?, ?, ?, 'COOK_FINISH', ?, ?, ?, ?, 'Bếp hoàn thành chế biến')
                `).run(
                    staffUser,
                    Staff_name || 'Bếp Hoa Sen',
                    Staff_role || 'KITCHEN',
                    orderInfo.Order_id,
                    orderInfo.Order_code,
                    orderInfo.Table_number,
                    orderInfo.Final_amount || orderInfo.Total_amount || 0
                );
            } catch (kpiErr) {
                console.error('Lỗi ghi KPI bếp:', kpiErr.message);
            }
        }

        db.close();

        const io = req.app.get('io');
        if (io) {
            io.emit('order_status_updated', { 
                Order_id: orderInfo ? orderInfo.Order_id : orderIdentifier, 
                Order_code: orderInfo ? orderInfo.Order_code : orderIdentifier, 
                Status: newStatus 
            });
            if (newStatus === 'READY') {
                io.emit('waiter_order_ready', {
                    Order_id: orderInfo ? orderInfo.Order_id : orderIdentifier,
                    Order_code: orderInfo ? orderInfo.Order_code : orderIdentifier,
                    Table_number: orderInfo ? orderInfo.Table_number : '',
                    Table_name: orderInfo ? orderInfo.Table_number : ''
                });
            }
            emitOrderBadgeCounts(io);
        }

        res.json({ success: true, message: 'Đã cập nhật trạng thái đơn!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. PUT: Bếp hủy đơn
router.put('/cancel-order/:id', (req, res) => {
    try {
        const orderIdentifier = req.params.id;
        const { Reason } = req.body;

        const db = new Database(DB_PATH);
        const orderInfo = db.prepare(`SELECT Order_id, Order_code, Table_number FROM ORDERS WHERE Order_id = ? OR Order_code = ?`).get(orderIdentifier, orderIdentifier);

        db.prepare(`
            UPDATE ORDERS 
            SET Status = 'CANCELLED', Note = COALESCE(Note, '') || ' [Hủy bếp: ' || ? || ']' 
            WHERE Order_id = ? OR Order_code = ?
        `).run(Reason || 'Hết món', orderIdentifier, orderIdentifier);

        if (orderInfo && orderInfo.Table_number) {
            try {
                const cleanTable = orderInfo.Table_number.replace(/^Bàn\s*/i, 'B').trim();
                db.prepare(`
                    UPDATE DINING_TABLES
                    SET Status = 'EMPTY', Current_order_id = NULL, Current_order_code = NULL, Current_amount = 0, Payment_status = 'UNPAID', Current_guests = 0, Updated_at = datetime('now', 'localtime')
                    WHERE (LOWER(Table_name) = LOWER(?) OR LOWER(Table_code) = LOWER(?) OR LOWER(Table_name) = LOWER(?))
                      AND (Current_order_id = ? OR Current_order_code = ?)
                `).run(orderInfo.Table_number, orderInfo.Table_number, cleanTable, orderInfo.Order_id, orderInfo.Order_code);
            } catch (tblErr) {
                console.error('Lỗi cập nhật bàn khi hủy đơn:', tblErr.message);
            }
        }
        db.close();

        const io = req.app.get('io');
        if (io) {
            io.emit('kitchen_order_cancelled', { Order_id: orderIdentifier });
            io.emit('order_status_updated', { Order_id: orderIdentifier, Status: 'CANCELLED' });
            io.emit('table_updated');
            io.emit('tables_list_changed');
            emitOrderBadgeCounts(io);
        }

        res.json({ success: true, message: 'Đã hủy đơn thành công!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. GET: Lấy danh sách các đơn bếp ĐÃ LÀM XONG (Status = 'READY') cho Màn hình Nhận Món / Trả Món
router.get('/ready-orders', (req, res) => {
    try {
        const db = new Database(DB_PATH, { readonly: true });
        const orders = db.prepare(`
            SELECT Order_id, Order_code, Order_type, Table_number, Table_name, Customer_name, 
                   Payment_method, Payment_status, Paid_by, Paid_at, Final_amount, Total_amount, Note, Status, Is_edited, Created_at,
                   Delivery_platform, Customer_phone, Delivery_address, Payment_type,
                   Staff_name, Created_by, Member_id, Member_name, Member_tier, Member_phone
            FROM ORDERS 
            WHERE UPPER(Status) = 'READY'
            ORDER BY Order_id DESC
        `).all();

        const result = orders.map(order => {
            const numericOrderId = Number(order.Order_id);
            let items = [];
            try {
                items = db.prepare(`
                    SELECT Detail_id, Order_id, Item_name, Quantity, Unit_price, Total_price, Note, Toppings 
                    FROM ORDER_DETAILS 
                    WHERE Order_id = ?
                `).all(numericOrderId);
            } catch (e) {
                items = [];
            }
            return {
                ...order,
                Items: items || [],
                items: items || []
            };
        });

        db.close();
        res.json(result);
    } catch (err) {
        console.error('❌ Lỗi GET /api/kitchen/ready-orders:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 5. PUT: Xác nhận bồi bàn đã trả món cho khách / hoàn thành đơn
router.put('/deliver-order/:id', (req, res) => {
    try {
        const orderIdentifier = req.params.id;
        const { Delivered_by, Staff_name, Staff_role } = req.body || {};
        const staffUser = Delivered_by || 'Nhân viên';

        const db = new Database(DB_PATH);
        const orderInfo = db.prepare(`SELECT Order_id, Order_code, Table_number, Final_amount, Total_amount FROM ORDERS WHERE Order_id = ? OR Order_code = ?`).get(orderIdentifier, orderIdentifier);

        db.prepare(`
            UPDATE ORDERS 
            SET Status = 'COMPLETED' 
            WHERE Order_id = ? OR Order_code = ?
        `).run(orderIdentifier, orderIdentifier);

        // Ghi nhận KPI Bồi bàn trả món cho khách
        if (orderInfo) {
            try {
                db.prepare(`
                    INSERT INTO STAFF_KPI_LOGS (Staff_username, Staff_name, Staff_role, Action_type, Order_id, Order_code, Table_number, Amount, Note)
                    VALUES (?, ?, ?, 'ORDER_SERVED', ?, ?, ?, ?, 'Bồi bàn hoàn tất phục vụ món')
                `).run(
                    staffUser,
                    Staff_name || staffUser,
                    Staff_role || 'WAITER',
                    orderInfo.Order_id,
                    orderInfo.Order_code,
                    orderInfo.Table_number,
                    orderInfo.Final_amount || orderInfo.Total_amount || 0
                );
            } catch (kpiErr) {
                console.error('Lỗi ghi KPI bồi bàn:', kpiErr.message);
            }
        }

        // Đồng bộ giải phóng bàn ăn nếu đơn thuộc về bàn
        if (orderInfo && orderInfo.Table_number) {
            try {
                const cleanTable = orderInfo.Table_number.replace(/^Bàn\s*/i, 'B').trim();
                db.prepare(`
                    UPDATE DINING_TABLES
                    SET Status = 'EMPTY', Current_order_id = NULL, Current_order_code = NULL, Current_amount = 0, Payment_status = 'UNPAID', Current_guests = 0, Updated_at = datetime('now', 'localtime')
                    WHERE (LOWER(Table_name) = LOWER(?) OR LOWER(Table_code) = LOWER(?) OR LOWER(Table_name) = LOWER(?))
                      AND (Current_order_id = ? OR Current_order_code = ?)
                `).run(orderInfo.Table_number, orderInfo.Table_number, cleanTable, orderInfo.Order_id, orderInfo.Order_code);
            } catch (tblErr) {
                console.error('Lỗi cập nhật bàn khi deliver đơn:', tblErr.message);
            }
        }

        db.close();

        const io = req.app.get('io');
        if (io) {
            io.emit('order_status_updated', { 
                Order_id: orderInfo ? orderInfo.Order_id : orderIdentifier, 
                Order_code: orderInfo ? orderInfo.Order_code : orderIdentifier, 
                Status: 'COMPLETED' 
            });
            io.emit('table_updated', { Table_name: orderInfo ? orderInfo.Table_number : null, Status: 'EMPTY' });
            io.emit('tables_list_changed');
            emitOrderBadgeCounts(io);
        }

        res.json({ success: true, message: 'Đã hoàn tất trả món cho khách!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. PUT: Chuyển đổi trạng thái thanh toán (PAID / UNPAID) kèm ghi nhận người thu tiền
router.put('/toggle-payment/:id', (req, res) => {
    try {
        const orderIdentifier = req.params.id;
        const { Paid_by, Staff_name, Staff_role } = req.body || {};
        const staffUser = Paid_by || 'Thu Ngân';

        const db = new Database(DB_PATH);
        const orderInfo = db.prepare(`SELECT Order_id, Order_code, Table_number, Final_amount, Total_amount, Payment_status, Payment_method FROM ORDERS WHERE Order_id = ? OR Order_code = ?`).get(orderIdentifier, orderIdentifier);

        if (!orderInfo) {
            db.close();
            return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
        }

        const isCurrentlyPaid = (orderInfo.Payment_status === 'PAID');
        const newStatus = isCurrentlyPaid ? 'UNPAID' : 'PAID';
        const finalPaidBy = isCurrentlyPaid ? null : staffUser;
        const finalPaidAt = isCurrentlyPaid ? null : new Date().toISOString().replace('T', ' ').substring(0, 19);

        db.prepare(`
            UPDATE ORDERS 
            SET Payment_status = ?, Paid_by = ?, Paid_at = CASE WHEN ? = 'PAID' THEN datetime('now', 'localtime') ELSE NULL END
            WHERE Order_id = ? OR Order_code = ?
        `).run(newStatus, finalPaidBy, newStatus, orderIdentifier, orderIdentifier);

        // Ghi nhận KPI Thu tiền nếu chuyển sang PAID
        if (newStatus === 'PAID') {
            try {
                const amount = Number(orderInfo.Final_amount || orderInfo.Total_amount || 0);
                db.prepare(`
                    INSERT INTO STAFF_KPI_LOGS (Staff_username, Staff_name, Staff_role, Action_type, Order_id, Order_code, Table_number, Amount, Note)
                    VALUES (?, ?, ?, 'PAYMENT_COLLECTED', ?, ?, ?, ?, ?)
                `).run(
                    staffUser,
                    Staff_name || staffUser,
                    Staff_role || 'CASHIER',
                    orderInfo.Order_id,
                    orderInfo.Order_code,
                    orderInfo.Table_number,
                    amount,
                    `Thu tiền (${orderInfo.Payment_method || 'CASH'}) - ${amount.toLocaleString('vi-VN')} đ`
                );
            } catch (kpiErr) {
                console.error('Lỗi ghi KPI thu tiền:', kpiErr.message);
            }
        }

        db.close();

        const io = req.app.get('io');
        if (io) {
            io.emit('order_status_updated', { 
                Order_id: orderInfo.Order_id, 
                Order_code: orderInfo.Order_code, 
                Payment_status: newStatus,
                Paid_by: finalPaidBy,
                Paid_at: finalPaidAt
            });
        }

        res.json({ success: true, Payment_status: newStatus, Paid_by: finalPaidBy, Paid_at: finalPaidAt });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. GET: Lấy nhật ký công việc của nhân viên bếp đang đăng nhập
router.get('/my-logs', (req, res) => {
    try {
        const username = String(req.query.username || '').toLowerCase();
        if (!username) {
            return res.status(400).json({ error: 'Thiếu thông tin tên đăng nhập nhân viên' });
        }

        const db = new Database(DB_PATH, { readonly: true });
        
        // Lấy danh sách nhật ký chế biến của bếp
        const logs = db.prepare(`
            SELECT Log_id, Staff_username, Staff_name, Staff_role, Action_type, Order_id, Order_code, Table_number, Amount, Note, Created_at
            FROM STAFF_KPI_LOGS
            WHERE LOWER(Staff_username) = ? AND Action_type = 'COOK_FINISH'
            ORDER BY Log_id DESC
            LIMIT 200
        `).all(username);

        // Với mỗi log, lấy thêm chi tiết các món ăn trong đơn hàng đó từ ORDER_DETAILS
        const enrichedLogs = logs.map(log => {
            let items = [];
            if (log.Order_id) {
                try {
                    items = db.prepare(`
                        SELECT Item_name, Quantity, Note, Toppings 
                        FROM ORDER_DETAILS 
                        WHERE Order_id = ?
                    `).all(log.Order_id);
                } catch(e) {}
            }
            return {
                ...log,
                items: items || []
            };
        });

        // Tính thống kê hôm nay
        const todayStr = new Date().toISOString().substring(0, 10);
        let todayOrdersCount = 0;
        let todayItemsCount = 0;

        enrichedLogs.forEach(l => {
            const dateStr = (l.Created_at || '').substring(0, 10);
            if (dateStr === todayStr) {
                todayOrdersCount++;
                if (Array.isArray(l.items) && l.items.length > 0) {
                    todayItemsCount += l.items.reduce((sum, item) => sum + Number(item.Quantity || 1), 0);
                } else {
                    todayItemsCount += 1;
                }
            }
        });

        db.close();

        res.json({
            success: true,
            todayStats: {
                completedOrders: todayOrdersCount,
                completedItems: todayItemsCount
            },
            logs: enrichedLogs
        });
    } catch (err) {
        console.error('❌ Lỗi GET /api/kitchen/my-logs:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;