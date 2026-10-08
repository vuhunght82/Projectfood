const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');
const DB_PATH = path.join(__dirname, '../database.db');
const { processOrderLoyalty } = require('./members');

// Helper kết nối CSDL
function getDb(readonly = false) {
    const db = new Database(DB_PATH, { readonly });
    db.pragma('journal_mode = WAL');
    return db;
}

// 1. GET: Lấy danh sách toàn bộ phòng bàn kèm trạng thái đơn hàng thời gian thực
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const tables = db.prepare(`SELECT * FROM DINING_TABLES ORDER BY Area, Sort_order, Table_id`).all();

        // Lấy danh sách đơn hàng đang phục vụ (chưa hoàn thành / chưa hủy)
        const activeOrders = db.prepare(`
            SELECT Order_id, Order_code, Table_number, Table_name, Final_amount, Total_amount, Payment_status, Guest_count, Status, Created_at
            FROM ORDERS
            WHERE UPPER(Status) NOT IN ('COMPLETED', 'SERVED', 'CANCELLED', 'CANCELED')
              AND date(Created_at) = date('now', 'localtime')
            ORDER BY Order_id DESC
        `).all();

        // Cập nhật trạng thái thực tế cho từng bàn
        const enrichedTables = tables.map(table => {
            // Tìm đơn hàng đang phục vụ khớp với tên bàn hoặc mã bàn
            const activeOrder = activeOrders.find(o => {
                const oTable = String(o.Table_number || o.Table_name || '').toLowerCase().trim();
                const tName = String(table.Table_name || '').toLowerCase().trim();
                const tCode = String(table.Table_code || '').toLowerCase().trim();
                return oTable === tName || oTable === tCode || (oTable && (tName.includes(oTable) || oTable.includes(tName)));
            });

            if (activeOrder) {
                const amount = Number(activeOrder.Final_amount || activeOrder.Total_amount || 0);
                const guests = Number(activeOrder.Guest_count || table.Current_guests || 1);
                const paymentStatus = String(activeOrder.Payment_status || 'UNPAID').toUpperCase();

                // Đồng bộ lại vào bảng nếu có thay đổi
                if (table.Status !== 'SERVING' || table.Current_order_id !== activeOrder.Order_id || table.Current_amount !== amount || table.Payment_status !== paymentStatus) {
                    db.prepare(`
                        UPDATE DINING_TABLES 
                        SET Status = 'SERVING', Current_order_id = ?, Current_order_code = ?, Current_amount = ?, Payment_status = ?, Current_guests = CASE WHEN Current_guests <= 0 THEN ? ELSE Current_guests END, Updated_at = datetime('now', 'localtime')
                        WHERE Table_id = ?
                    `).run(activeOrder.Order_id, activeOrder.Order_code, amount, paymentStatus, guests, table.Table_id);
                }

                return {
                    ...table,
                    Status: 'SERVING',
                    Current_order_id: activeOrder.Order_id,
                    Current_order_code: activeOrder.Order_code,
                    Current_amount: amount,
                    Payment_status: paymentStatus,
                    Current_guests: table.Current_guests > 0 ? table.Current_guests : guests,
                    Order_created_at: activeOrder.Created_at
                };
            } else {
                // Không có đơn hàng nào đang hoạt động cho bàn này.
                // Nếu bàn trước đó có Current_order_id hoặc đang SERVING -> tự động giải phóng bàn về EMPTY
                if (table.Current_order_id || table.Status === 'SERVING') {
                    db.prepare(`
                        UPDATE DINING_TABLES 
                        SET Status = 'EMPTY', Current_order_id = NULL, Current_order_code = NULL, Current_amount = 0, Payment_status = 'UNPAID', Current_guests = 0, Updated_at = datetime('now', 'localtime')
                        WHERE Table_id = ?
                    `).run(table.Table_id);

                    return {
                        ...table,
                        Status: 'EMPTY',
                        Current_order_id: null,
                        Current_order_code: null,
                        Current_amount: 0,
                        Payment_status: 'UNPAID',
                        Current_guests: 0
                    };
                }
            }

            return table;
        });

        db.close();
        res.json({ success: true, tables: enrichedTables });
    } catch (err) {
        console.error('❌ Lỗi GET /api/tables:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. POST: Thêm bàn mới
router.post('/', (req, res) => {
    try {
        const { Table_code, Table_name, Area, Capacity, Sort_order } = req.body;
        if (!Table_name) {
            return res.status(400).json({ success: false, error: 'Tên bàn không được để trống!' });
        }

        const db = getDb();
        const code = Table_code || `B${Date.now().toString().slice(-4)}`;
        const area = Area || 'Tầng 1';
        const capacity = parseInt(Capacity || 4, 10);
        const sort = parseInt(Sort_order || 0, 10);

        const stmt = db.prepare(`
            INSERT INTO DINING_TABLES (Table_code, Table_name, Area, Capacity, Sort_order)
            VALUES (?, ?, ?, ?, ?)
        `);
        const info = stmt.run(code, Table_name, area, capacity, sort);
        db.close();

        const io = req.app.get('io');
        if (io) io.emit('tables_list_changed');

        res.json({ success: true, message: 'Đã thêm bàn mới thành công!', Table_id: info.lastInsertRowid });
    } catch (err) {
        console.error('❌ Lỗi POST /api/tables:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. PUT: Cập nhật thông tin cấu hình bàn (Tên, Khu vực, Số ghế)
router.put('/:id', (req, res) => {
    try {
        const tableId = req.params.id;
        const { Table_name, Table_code, Area, Capacity, Note, Sort_order } = req.body;

        const db = getDb();
        db.prepare(`
            UPDATE DINING_TABLES 
            SET Table_name = COALESCE(?, Table_name),
                Table_code = COALESCE(?, Table_code),
                Area = COALESCE(?, Area),
                Capacity = COALESCE(?, Capacity),
                Note = COALESCE(?, Note),
                Sort_order = COALESCE(?, Sort_order),
                Updated_at = datetime('now', 'localtime')
            WHERE Table_id = ?
        `).run(Table_name, Table_code, Area, Capacity ? parseInt(Capacity, 10) : null, Note, Sort_order ? parseInt(Sort_order, 10) : null, tableId);

        db.close();

        const io = req.app.get('io');
        if (io) io.emit('tables_list_changed');

        res.json({ success: true, message: 'Đã cập nhật thông tin bàn thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. DELETE: Xóa bàn (Chỉ khi bàn trống)
router.delete('/:id', (req, res) => {
    try {
        const tableId = req.params.id;
        const db = getDb();

        const table = db.prepare('SELECT * FROM DINING_TABLES WHERE Table_id = ?').get(tableId);
        if (!table) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy bàn cần xóa!' });
        }

        if (table.Status === 'SERVING' || table.Current_guests > 0 || table.Current_order_id) {
            db.close();
            return res.status(400).json({ success: false, error: 'Không thể xóa bàn đang có khách hoặc đang phục vụ!' });
        }

        db.prepare('DELETE FROM DINING_TABLES WHERE Table_id = ?').run(tableId);
        db.close();

        const io = req.app.get('io');
        if (io) io.emit('tables_list_changed');

        res.json({ success: true, message: 'Đã xóa bàn thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. PUT: Tăng / Giảm hoặc Thay đổi Số Khách Đang Ngồi Trên Bàn
router.put('/:id/guests', (req, res) => {
    try {
        const tableId = req.params.id;
        const { delta, guests, Staff_username } = req.body;

        const db = getDb();
        const table = db.prepare('SELECT * FROM DINING_TABLES WHERE Table_id = ?').get(tableId);
        if (!table) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy bàn!' });
        }

        let newGuests = table.Current_guests;
        if (delta !== undefined) {
            newGuests = Math.max(0, newGuests + parseInt(delta, 10));
        } else if (guests !== undefined) {
            newGuests = Math.max(0, parseInt(guests, 10));
        }

        // Cập nhật trạng thái bàn: Nếu khách > 0 mà đang EMPTY -> chuyển sang SERVING
        let newStatus = table.Status;
        if (newGuests > 0 && table.Status === 'EMPTY') {
            newStatus = 'SERVING';
        } else if (newGuests === 0 && !table.Current_order_id) {
            newStatus = 'EMPTY';
        }

        db.prepare(`
            UPDATE DINING_TABLES 
            SET Current_guests = ?, Status = ?, Updated_at = datetime('now', 'localtime')
            WHERE Table_id = ?
        `).run(newGuests, newStatus, tableId);

        // Ghi nhật ký khách ngồi bàn vào GUEST_LOGS
        try {
            db.prepare(`
                INSERT INTO GUEST_LOGS (Table_id, Table_name, Order_id, Order_code, Guest_count, Action_type, Staff_username, Note)
                VALUES (?, ?, ?, ?, ?, 'GUEST_CHANGE', ?, ?)
            `).run(
                table.Table_id,
                table.Table_name,
                table.Current_order_id,
                table.Current_order_code,
                newGuests,
                Staff_username || 'nhanvien',
                `Cập nhật số khách: ${newGuests} người`
            );
        } catch(logErr) {}

        // Nếu bàn có đơn hàng đang chạy, cập nhật cả Guest_count trong ORDERS
        if (table.Current_order_id) {
            try {
                db.prepare('UPDATE ORDERS SET Guest_count = ? WHERE Order_id = ?').run(newGuests, table.Current_order_id);
            } catch(e) {}
        }

        db.close();

        const io = req.app.get('io');
        if (io) {
            io.emit('table_updated', {
                Table_id: tableId,
                Current_guests: newGuests,
                Status: newStatus
            });
        }

        res.json({ success: true, Current_guests: newGuests, Status: newStatus });
    } catch (err) {
        console.error('❌ Lỗi cập nhật số khách:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. POST: Đổi Bàn / Chuyển Bàn (Chuyển toàn bộ đơn hàng và khách sang bàn mới)
router.post('/transfer', (req, res) => {
    try {
        const { fromTableId, toTableId, Staff_username } = req.body;
        if (!fromTableId || !toTableId) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin bàn chuyển!' });
        }
        if (fromTableId === toTableId) {
            return res.status(400).json({ success: false, error: 'Bàn chuyển đến phải khác bàn hiện tại!' });
        }

        const db = getDb();
        const fromTable = db.prepare('SELECT * FROM DINING_TABLES WHERE Table_id = ?').get(fromTableId);
        const toTable = db.prepare('SELECT * FROM DINING_TABLES WHERE Table_id = ?').get(toTableId);

        if (!fromTable || !toTable) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy thông tin bàn!' });
        }

        // Cập nhật đơn hàng trong bảng ORDERS sang số bàn mới
        if (fromTable.Current_order_id || fromTable.Current_order_code) {
            db.prepare(`
                UPDATE ORDERS 
                SET Table_number = ?, Table_name = ?, Note = COALESCE(Note, '') || ' [Đổi từ ' || ? || ']'
                WHERE Order_id = ? OR Order_code = ?
            `).run(toTable.Table_name, toTable.Table_name, fromTable.Table_name, fromTable.Current_order_id, fromTable.Current_order_code);
        }

        // Chuyển thông tin sang toTable
        const transferredGuests = fromTable.Current_guests > 0 ? fromTable.Current_guests : 1;
        db.prepare(`
            UPDATE DINING_TABLES 
            SET Status = 'SERVING',
                Current_order_id = ?,
                Current_order_code = ?,
                Current_amount = ?,
                Payment_status = ?,
                Current_guests = ?,
                Updated_at = datetime('now', 'localtime')
            WHERE Table_id = ?
        `).run(fromTable.Current_order_id, fromTable.Current_order_code, fromTable.Current_amount, fromTable.Payment_status, transferredGuests, toTable.Table_id);

        // Đưa fromTable về trạng thái trống
        db.prepare(`
            UPDATE DINING_TABLES 
            SET Status = 'EMPTY',
                Current_order_id = NULL,
                Current_order_code = NULL,
                Current_amount = 0,
                Payment_status = 'UNPAID',
                Current_guests = 0,
                Updated_at = datetime('now', 'localtime')
            WHERE Table_id = ?
        `).run(fromTable.Table_id);

        // Ghi log chuyển bàn
        try {
            db.prepare(`
                INSERT INTO GUEST_LOGS (Table_id, Table_name, Order_id, Order_code, Guest_count, Action_type, Staff_username, Note)
                VALUES (?, ?, ?, ?, ?, 'TRANSFER_TABLE', ?, ?)
            `).run(
                toTable.Table_id,
                toTable.Table_name,
                fromTable.Current_order_id,
                fromTable.Current_order_code,
                transferredGuests,
                Staff_username || 'nhanvien',
                `Chuyển từ ${fromTable.Table_name} sang ${toTable.Table_name}`
            );
        } catch(e) {}

        db.close();

        const io = req.app.get('io');
        if (io) {
            io.emit('table_transferred', {
                fromTableId,
                toTableId,
                fromTableName: fromTable.Table_name,
                toTableName: toTable.Table_name
            });
        }

        res.json({
            success: true,
            message: `Đã chuyển thành công từ [${fromTable.Table_name}] sang [${toTable.Table_name}]!`
        });
    } catch (err) {
        console.error('❌ Lỗi chuyển bàn:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 7. POST: Dọn Bàn / Trả Bàn Trống (Sau khi khách thanh toán và ra về)
router.post('/:id/clear', (req, res) => {
    try {
        const tableId = req.params.id;
        const { Staff_username } = req.body;

        const db = getDb();
        const table = db.prepare('SELECT * FROM DINING_TABLES WHERE Table_id = ?').get(tableId);
        if (!table) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy bàn!' });
        }

        // Hoàn thành các đơn hàng đang phục vụ của bàn này nếu có
        try {
            const cleanTable = table.Table_name.replace(/^Bàn\s*/i, 'B').trim();
            db.prepare(`
                UPDATE ORDERS 
                SET Status = 'COMPLETED' 
                WHERE (Table_number = ? OR Table_name = ? OR Table_number = ? OR Table_name = ? OR Order_id = ?)
                  AND UPPER(Status) NOT IN ('COMPLETED', 'SERVED', 'CANCELLED', 'CANCELED')
            `).run(table.Table_name, table.Table_name, cleanTable, cleanTable, table.Current_order_id || -1);
        } catch (eOrder) {
            console.error('Lỗi đóng đơn khi dọn bàn:', eOrder.message);
        }

        db.prepare(`
            UPDATE DINING_TABLES 
            SET Status = 'EMPTY',
                Current_order_id = NULL,
                Current_order_code = NULL,
                Current_amount = 0,
                Payment_status = 'UNPAID',
                Current_guests = 0,
                Updated_at = datetime('now', 'localtime')
            WHERE Table_id = ?
        `).run(tableId);

        // Ghi nhận log dọn bàn
        try {
            db.prepare(`
                INSERT INTO GUEST_LOGS (Table_id, Table_name, Order_id, Order_code, Guest_count, Action_type, Staff_username, Note)
                VALUES (?, ?, ?, ?, 0, 'CHECK_OUT', ?, 'Dọn bàn hoàn tất')
            `).run(table.Table_id, table.Table_name, table.Current_order_id, table.Current_order_code, Staff_username || 'nhanvien');
        } catch(e) {}

        db.close();

        const io = req.app.get('io');
        if (io) io.emit('table_updated', { Table_id: tableId, Status: 'EMPTY', Current_guests: 0 });

        res.json({ success: true, message: `Bàn [${table.Table_name}] đã được dọn sạch và sẵn sàng đón khách mới!` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 7.5. POST: Xác nhận thanh toán trực tiếp tại bàn
router.post('/:id/pay', (req, res) => {
    try {
        const tableId = req.params.id;
        const { Staff_username, Staff_name, Staff_role, Payment_method, Member_id, Member_phone, Member_name, Member_tier, Discount_percent, Discount_amount, Points_used, Points_amount, Prepaid_used, Final_amount } = req.body || {};
        const staffUser = Staff_username || 'Thu Ngân';
        const method = Payment_method || 'CASH';

        const db = getDb();
        const table = db.prepare('SELECT * FROM DINING_TABLES WHERE Table_id = ?').get(tableId);
        if (!table) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy bàn!' });
        }

        const orderId = table.Current_order_id;
        const orderCode = table.Current_order_code;
        const amount = Number(Final_amount !== undefined ? Final_amount : (table.Current_amount || 0));

        // 1. Cập nhật đơn hàng sang PAID nếu có
        if (orderId || orderCode) {
            try {
                db.prepare(`
                    UPDATE ORDERS 
                    SET Payment_status = 'PAID', Paid_by = ?, Paid_at = datetime('now', 'localtime'), Payment_method = ?,
                        Member_id = COALESCE(?, Member_id),
                        Member_phone = COALESCE(?, Member_phone),
                        Member_name = COALESCE(?, Member_name),
                        Member_tier = COALESCE(?, Member_tier),
                        Discount_percent = COALESCE(?, Discount_percent),
                        Discount_amount = COALESCE(?, Discount_amount),
                        Points_used = COALESCE(?, Points_used),
                        Points_amount = COALESCE(?, Points_amount),
                        Prepaid_used = COALESCE(?, Prepaid_used),
                        Final_amount = COALESCE(?, Final_amount)
                    WHERE Order_id = ? OR Order_code = ?
                `).run(
                    staffUser, method,
                    Member_id || null, Member_phone || null, Member_name || null, Member_tier || null,
                    Discount_percent !== undefined ? Discount_percent : null,
                    Discount_amount !== undefined ? Discount_amount : null,
                    Points_used !== undefined ? Points_used : null,
                    Points_amount !== undefined ? Points_amount : null,
                    Prepaid_used !== undefined ? Prepaid_used : null,
                    Final_amount !== undefined ? Final_amount : null,
                    orderId || -1, orderCode || ''
                );
            } catch (e) {
                console.error('Lỗi cập nhật đơn khi thanh toán bàn:', e.message);
            }

            // Tích điểm và thăng hạng thành viên Hoa Sen tự động
            try {
                const ioObj = req.app.get('io');
                processOrderLoyalty(db, orderId || orderCode, staffUser, ioObj);
            } catch (loyErr) {
                console.error('Lỗi tích điểm hội viên khi thanh toán bàn:', loyErr.message);
            }
        }

        // 2. Cập nhật bàn sang PAID
        db.prepare(`
            UPDATE DINING_TABLES 
            SET Payment_status = 'PAID', Current_amount = ?, Updated_at = datetime('now', 'localtime')
            WHERE Table_id = ?
        `).run(amount, tableId);

        // 3. Ghi nhận KPI cho nhân viên thu tiền
        try {
            db.prepare(`
                INSERT INTO STAFF_KPI_LOGS (Staff_username, Staff_name, Staff_role, Action_type, Order_id, Order_code, Table_number, Amount, Note)
                VALUES (?, ?, ?, 'PAYMENT_COLLECTED', ?, ?, ?, ?, ?)
            `).run(
                staffUser,
                Staff_name || staffUser,
                Staff_role || 'WAITER',
                orderId || 0,
                orderCode || '',
                table.Table_name,
                amount,
                `Thu tiền tại bàn [${table.Table_name}] (${method}) - ${amount.toLocaleString('vi-VN')} đ`
            );
        } catch (kpiErr) {
            console.error('Lỗi ghi KPI thu tiền bàn:', kpiErr.message);
        }

        db.close();

        // 4. Phát tín hiệu Realtime qua Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.emit('table_updated', {
                Table_id: tableId,
                Table_name: table.Table_name,
                Payment_status: 'PAID'
            });
            if (orderId) {
                io.emit('order_status_updated', {
                    Order_id: orderId,
                    Order_code: orderCode,
                    Payment_status: 'PAID',
                    Paid_by: staffUser,
                    Payment_method: method
                });
            }
            io.emit('tables_list_changed');
        }

        res.json({
            success: true,
            message: `Đã xác nhận thu tiền cho [${table.Table_name}] thành công!`,
            Payment_status: 'PAID'
        });
    } catch (err) {
        console.error('❌ Lỗi POST /api/tables/:id/pay:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8. GET: Thống kê lượng khách theo thời gian & tỷ lệ lấp đầy ghế
router.get('/guest-stats', (req, res) => {
    try {
        const { timeRange, dateFrom, dateTo } = req.query;
        const db = getDb(true);

        const now = new Date();
        const todayStr = now.toISOString().substring(0, 10);

        // 1. Thống kê bàn và tổng sức chứa hiện tại
        const tables = db.prepare('SELECT Capacity, Current_guests, Status FROM DINING_TABLES').all();
        const totalCapacity = tables.reduce((sum, t) => sum + (t.Capacity || 0), 0);
        const currentSeated = tables.reduce((sum, t) => sum + (t.Current_guests || 0), 0);
        const occupiedTablesCount = tables.filter(t => t.Status === 'SERVING' || t.Current_guests > 0).length;
        const emptyTablesCount = tables.length - occupiedTablesCount;
        const currentOccupancyRate = totalCapacity > 0 ? Math.round((currentSeated / totalCapacity) * 100) : 0;

        // 2. Thống kê lượt khách từ đơn hàng trong kỳ lọc
        let orderDateFilter = "date(Created_at) = date('now', 'localtime')";
        if (timeRange === 'WEEK') {
            orderDateFilter = "date(Created_at) >= date('now', 'localtime', '-7 days')";
        } else if (timeRange === 'MONTH') {
            orderDateFilter = "strftime('%Y-%m', Created_at) = strftime('%Y-%m', 'now', 'localtime')";
        } else if (dateFrom && dateTo) {
            orderDateFilter = `date(Created_at) BETWEEN '${dateFrom}' AND '${dateTo}'`;
        }

        const orderStats = db.prepare(`
            SELECT 
                COUNT(*) as totalOrders,
                COALESCE(SUM(CASE WHEN Guest_count > 0 THEN Guest_count ELSE 1 END), 0) as totalGuests,
                COALESCE(SUM(CASE WHEN Payment_status = 'PAID' THEN Final_amount ELSE 0 END), 0) as paidRevenue
            FROM ORDERS
            WHERE UPPER(Status) NOT IN ('CANCELLED', 'CANCELED') AND ${orderDateFilter}
        `).get();

        // 3. Phân bố lượng khách theo 24 khung giờ trong ngày hôm nay (Xác định giờ cao điểm)
        const hourlyDistribution = Array(24).fill(0);
        const hourlyOrders = db.prepare(`
            SELECT strftime('%H', Created_at) as hour, SUM(CASE WHEN Guest_count > 0 THEN Guest_count ELSE 1 END) as guests
            FROM ORDERS
            WHERE date(Created_at) = date('now', 'localtime') AND UPPER(Status) NOT IN ('CANCELLED', 'CANCELED')
            GROUP BY hour
        `).all();

        hourlyOrders.forEach(h => {
            const hr = parseInt(h.hour, 10);
            if (!isNaN(hr) && hr >= 0 && hr < 24) {
                hourlyDistribution[hr] = h.guests || 0;
            }
        });

        // Tìm giờ cao điểm (giờ có lượng khách đông nhất)
        let peakHour = 12;
        let peakMaxGuests = 0;
        hourlyDistribution.forEach((guests, hr) => {
            if (guests > peakMaxGuests) {
                peakMaxGuests = guests;
                peakHour = hr;
            }
        });
        const peakHourStr = peakMaxGuests > 0 ? `${peakHour}h:00 - ${peakHour + 1}h:00 (${peakMaxGuests} khách)` : 'Đang cập nhật';

        db.close();

        res.json({
            success: true,
            summary: {
                totalCapacity,
                currentSeated,
                occupiedTablesCount,
                emptyTablesCount,
                currentOccupancyRate,
                totalGuestsInPeriod: orderStats.totalGuests || 0,
                totalOrdersInPeriod: orderStats.totalOrders || 0,
                paidRevenueInPeriod: orderStats.paidRevenue || 0,
                avgSpendPerGuest: orderStats.totalGuests > 0 ? Math.round(orderStats.paidRevenue / orderStats.totalGuests) : 0,
                peakHour: peakHourStr
            },
            hourlyDistribution
        });
    } catch (err) {
        console.error('❌ Lỗi thống kê lượng khách:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
