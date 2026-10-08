const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../database.db'));
const DB_PATH = path.join(__dirname, '../database.db');
const { processOrderLoyalty } = require('./members');

// GET: Lấy danh sách tất cả đơn hàng
router.get('/', (req, res) => {
    try {
        const db = new Database(DB_PATH, { readonly: true });
        const orders = db.prepare('SELECT * FROM ORDERS ORDER BY Order_id DESC').all();
        const result = orders.map(order => {
            let items = [];
            try {
                items = db.prepare('SELECT * FROM ORDER_DETAILS WHERE Order_id = ?').all(order.Order_id);
            } catch (e) { items = []; }
            if (!items || items.length === 0) {
                try {
                    items = db.prepare('SELECT * FROM ORDER_ITEMS WHERE order_id = ?').all(order.Order_id);
                } catch (e2) { items = []; }
            }
            return { ...order, items };
        });
        db.close();
        res.json(result);
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// Hàm helper phát Socket đếm số đơn cho Navbar (Nhận món & Màn hình bếp)
function emitOrderBadgeCounts(io, database) {
    if (!io) return;
    try {
        const pendingRow = database.prepare(`
            SELECT COUNT(*) as count FROM ORDERS 
            WHERE Status = 'PROCESSING' OR Status IS NULL OR Status = '' OR Status = 'PENDING' OR UPPER(Status) IN ('COOKING', 'ACCEPTED')
        `).get();
        const readyRow = database.prepare(`
            SELECT COUNT(*) as count FROM ORDERS WHERE UPPER(Status) = 'READY'
        `).get();
        io.emit('order_counts_updated', {
            pendingKitchenCount: pendingRow ? pendingRow.count : 0,
            readyOrdersCount: readyRow ? readyRow.count : 0
        });
    } catch(e) {}
}

// GET: Lấy số lượng đơn cho Navbar Badges
router.get('/badge-counts', (req, res) => {
    try {
        const pendingRow = db.prepare(`
            SELECT COUNT(*) as count FROM ORDERS 
            WHERE Status = 'PROCESSING' OR Status IS NULL OR Status = '' OR Status = 'PENDING' OR UPPER(Status) IN ('COOKING', 'ACCEPTED')
        `).get();
        const readyRow = db.prepare(`
            SELECT COUNT(*) as count FROM ORDERS WHERE UPPER(Status) = 'READY'
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

// POST: Tạo đơn hàng mới hoặc Cập nhật đơn hàng từ POS / Điện thoại
router.post('/', (req, res) => {
    try {
        const { Table_number, Table_name, Order_type, Customer_name, Payment_method, Payment_status, Paid_by, Staff_name, Staff_role, Note, items, totalAmount } = req.body;
        
        // 🚨 LẤY MÃ SỬA ĐƠN VÀ LỌC SẠCH DẤU #
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
        const finalTotal = (totalAmount !== undefined && totalAmount !== null && !isNaN(Number(totalAmount))) ? Number(totalAmount) : calculatedTotal;
        const tableName = Table_number || Table_name || 'Bàn 01';

        // 🌟 1. NẾU LÀ SỬA ĐƠN HÀNG -> UPDATE CSDL VÀ BẬT Is_edited = 1
        if (editingOrderId) {
            const cleanCode = editingOrderId;
            const codeWithPrefix = cleanCode.startsWith('CHAY-') ? cleanCode : ('CHAY-' + cleanCode);
            const codeWithoutPrefix = cleanCode.replace('CHAY-', '');

            // 1. TÌM ID CỦA ĐƠN HÀNG TRONG CSDL
            const targetOrder = db.prepare(`SELECT Order_id FROM ORDERS WHERE Order_code = ? OR Order_code = ? OR Order_id = ?`).get(codeWithPrefix, cleanCode, cleanCode);
            const targetId = targetOrder ? targetOrder.Order_id : cleanCode;

            // 2. LẤY NỘI DUNG CŨ TỪ BẢNG ORDER_DETAILS LƯU DẠNG JSON
            const oldDetails = db.prepare(`SELECT Item_name, Quantity, Unit_price, Total_price, Note, Toppings FROM ORDER_DETAILS WHERE Order_id = ?`).all(targetId);
            const oldContentStr = JSON.stringify(oldDetails);

            // 3. THỰC HIỆN UPDATE ĐƠN HÀNG
            const stmtUpdate = db.prepare(`
                UPDATE ORDERS 
                SET Table_number = ?, Order_type = ?, Customer_name = ?, Payment_method = ?, Final_amount = ?, Note = ?, Is_edited = 1 
                WHERE Order_code = ? OR Order_code = ? OR Order_code = ? OR Order_id = ?
            `);

            stmtUpdate.run(
                tableName, Order_type || 'DINE_IN', Customer_name || 'Khách vãng lai', 
                Payment_method || 'CASH', finalTotal, Note || '', 
                codeWithPrefix, cleanCode, codeWithoutPrefix, cleanCode
            );

            // 4. GHI NHẬT KÝ VÀO ORDER_LOGS DẠNG JSON CHO CẢ NỘI DUNG MỚI
            try {
                const newItemsPayload = Array.isArray(items) && items.length > 0 ? items.map(i => ({
                    Item_name: i.name || i.Item_name || 'Món chay',
                    Quantity: Number(i.quantity || i.Quantity || 1),
                    Unit_price: Number(i.price || i.Unit_price || 35000),
                    Total_price: Number(i.quantity || i.Quantity || 1) * Number(i.price || i.Unit_price || 35000),
                    Note: i.note || i.Note || '',
                    Toppings: typeof i.toppings === 'string' ? i.toppings : (Array.isArray(i.toppings) ? (i.toppings.map(t => `${t.name} (+${Number(t.price).toLocaleString()}đ)`).join(', ')) : '')
                })) : [];
                const newContentStr = JSON.stringify(newItemsPayload);

                const stmtLog = db.prepare(`
                    INSERT INTO ORDER_LOGS (Order_code, Modified_by, Old_content, New_content)
                    VALUES (?, ?, ?, ?)
                `);
                stmtLog.run(
                    codeWithPrefix, 
                    Staff_name || 'Quản Lý', 
                    oldContentStr, 
                    newContentStr
                );
            } catch (logErr) {
                console.error('Lỗi chèn log:', logErr.message);
            }

            // 5. XÓA MÓN CŨ & CHÈN DANH SÁCH MÓN MỚI
            db.prepare(`DELETE FROM ORDER_DETAILS WHERE Order_id = ?`).run(targetId);

            if (Array.isArray(items) && items.length > 0) {
                const stmtDetail = db.prepare(`INSERT INTO ORDER_DETAILS (Order_id, Item_name, Quantity, Unit_price, Total_price, Note, Toppings) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                items.forEach(i => {
                    const price = Number(i.price || i.Unit_price || 35000);
                    const qty = Number(i.quantity || i.Quantity || 1);
                    const itemNote = i.note || i.Note || '';
                    const itemToppings = typeof i.toppings === 'string' ? i.toppings : (Array.isArray(i.toppings) ? (i.toppings.map(t => `${t.name} (+${Number(t.price).toLocaleString()}đ)`).join(', ')) : '');
                    stmtDetail.run(targetId, i.name || i.Item_name || 'Món chay', qty, price, qty * price, itemNote, itemToppings);
                });
            }

            // Cập nhật thông tin bàn ăn nếu có bàn
            if (tableName) {
                try {
                    const cleanTable = tableName.replace(/^Bàn\s*/i, 'B').trim();
                    db.prepare(`
                        UPDATE DINING_TABLES
                        SET Current_amount = ?,
                            Updated_at = datetime('now', 'localtime')
                        WHERE LOWER(Table_name) = LOWER(?) OR LOWER(Table_code) = LOWER(?) OR LOWER(Table_name) = LOWER(?)
                    `).run(finalTotal, tableName, tableName, cleanTable);
                } catch (tblErr) {
                    console.error('Lỗi cập nhật bàn khi sửa đơn:', tblErr.message);
                }
            }

            // 🌟 5.1. BẮT BUỘC BẮN SOCKET BÁO BẾP KHI CÓ ĐƠN ĐƯỢC SỬA
            const io = req.app.get('io');
            if (io) {
                io.emit('kitchen_new_order', { 
                    Order_id: targetId, 
                    Order_code: codeWithPrefix, 
                    Table_name: tableName,
                    Table_number: tableName,
                    Is_edited: 1,
                    Items: items,
                    items: items,
                    Final_amount: finalTotal,
                    Created_at: new Date().toLocaleString('vi-VN')
                });
                io.emit('table_updated', { Table_name: tableName, Current_amount: finalTotal });
                emitOrderBadgeCounts(io, db);
            }

            // 6. PHẢN HỒI JSON THÀNH CÔNG VỀ CHO CLIENT
            return res.json({ 
                success: true, 
                message: 'Cập nhật đơn thành công', 
                Order_code: codeWithPrefix, 
                Final_amount: finalTotal, 
                Is_edited: 1 
            });
        }
        
        // 🌟 2. KIỂM TRA XEM BÀN NÀY ĐÃ CÓ ĐƠN ĐANG PHỤC VỤ (GỌI THÊM MÓN) HAY CHƯA
        let activeOrder = null;
        let diningTable = null;

        if (tableName && tableName !== 'Mang về' && tableName !== 'Đơn Web Giao Hàng') {
            const cleanTable = tableName.replace(/^Bàn\s*/i, 'B').trim();
            diningTable = db.prepare(`
                SELECT * FROM DINING_TABLES 
                WHERE LOWER(Table_name) = LOWER(?) OR LOWER(Table_code) = LOWER(?) OR LOWER(Table_name) = LOWER(?)
            `).get(tableName, tableName, cleanTable);

            // Kiểm tra mã đơn do client gửi lên hoặc lấy từ bàn
            const reqOrderCode = req.body.targetOrderCode || req.body.activeOrderCode || (diningTable ? diningTable.Current_order_code : null);
            if (reqOrderCode) {
                const cleanTargetCode = String(reqOrderCode).replace('#', '').trim();
                const codeWithPrefix = cleanTargetCode.startsWith('CHAY-') ? cleanTargetCode : ('CHAY-' + cleanTargetCode);
                activeOrder = db.prepare(`
                    SELECT * FROM ORDERS 
                    WHERE (Order_code = ? OR Order_code = ? OR Order_id = ?)
                      AND UPPER(Status) NOT IN ('COMPLETED', 'SERVED', 'CANCELLED', 'CANCELED')
                `).get(codeWithPrefix, cleanTargetCode, cleanTargetCode);
            }

            // Fallback: Tìm đơn đang hoạt động theo tên bàn
            if (!activeOrder) {
                activeOrder = db.prepare(`
                    SELECT * FROM ORDERS 
                    WHERE (LOWER(Table_number) = LOWER(?) OR LOWER(Table_name) = LOWER(?))
                      AND UPPER(Status) NOT IN ('COMPLETED', 'SERVED', 'CANCELLED', 'CANCELED')
                    ORDER BY Order_id DESC LIMIT 1
                `).get(tableName, tableName);
            }
        }

        const isAddMore = Boolean(req.body.isAddMore || (activeOrder && activeOrder.Order_id));

        // 🌟 NẾU LÀ GỌI THÊM MÓN CHO BÀN ĐANG PHỤC VỤ -> BỔ SUNG VÀO ĐƠN CŨ, KHÔNG TẠO ĐƠN MỚI
        if (isAddMore && activeOrder) {
            const targetOrderId = activeOrder.Order_id;
            const targetOrderCode = activeOrder.Order_code;

            // 1. Tính tổng tiền món mới bổ sung và cộng dồn vào đơn
            const addedAmount = calculatedTotal;
            const prevFinalAmount = Number(activeOrder.Final_amount || activeOrder.Total_amount || 0);
            const newFinalTotal = prevFinalAmount + addedAmount;

            // 2. Trạng thái thanh toán
            const isPaidImmediate = (Payment_status === 'PAID') || (Payment_method === 'CASH' && Paid_by) || (Payment_method === 'PREPAID');
            let newPaymentStatus = activeOrder.Payment_status || 'UNPAID';
            let paidUser = activeOrder.Paid_by;

            if (isPaidImmediate) {
                paidUser = Paid_by || Staff_name || 'Nhân viên';
                if (activeOrder.Payment_status === 'PAID') {
                    newPaymentStatus = 'PAID';
                }
                try {
                    db.prepare(`
                        INSERT INTO STAFF_KPI_LOGS (Staff_username, Staff_name, Staff_role, Action_type, Order_id, Order_code, Table_number, Amount, Note)
                        VALUES (?, ?, ?, 'PAYMENT_COLLECTED', ?, ?, ?, ?, ?)
                    `).run(
                        paidUser,
                        Staff_name || paidUser,
                        Staff_role || 'WAITER',
                        targetOrderId,
                        targetOrderCode,
                        tableName,
                        addedAmount,
                        `Thu tiền mặt món gọi thêm (${tableName}) - ${addedAmount.toLocaleString('vi-VN')} đ`
                    );
                } catch(e) {}
            } else {
                newPaymentStatus = 'UNPAID';
            }

            // 3. Lấy nội dung cũ ghi log
            const oldDetails = db.prepare(`SELECT Item_name, Quantity, Unit_price, Total_price, Note, Toppings FROM ORDER_DETAILS WHERE Order_id = ?`).all(targetOrderId);

            // 4. CHÈN THÊM CÁC MÓN MỚI VÀO ORDER_DETAILS (TUYỆT ĐỐI GIỮ NGUYÊN MÓN CŨ)
            if (Array.isArray(items) && items.length > 0) {
                const stmtDetail = db.prepare(`
                    INSERT INTO ORDER_DETAILS (Order_id, Item_name, Quantity, Unit_price, Total_price, Note, Toppings) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                items.forEach(i => {
                    const price = Number(i.price || i.Unit_price || 35000);
                    const qty = Number(i.quantity || i.Quantity || 1);
                    const rawNote = i.note || i.Note || '';
                    const taggedNote = rawNote ? `${rawNote} [Gọi thêm]` : `[Gọi thêm]`;
                    const itemToppings = typeof i.toppings === 'string' ? i.toppings : (Array.isArray(i.toppings) ? (i.toppings.map(t => `${t.name} (+${Number(t.price).toLocaleString()}đ)`).join(', ')) : '');
                    stmtDetail.run(targetOrderId, i.name || i.Item_name || 'Món chay', qty, price, qty * price, taggedNote, itemToppings);
                });
            }

            // 5. Cập nhật ORDERS
            const extraNote = Note ? ` | Thêm: ${Note}` : '';
            db.prepare(`
                UPDATE ORDERS 
                SET Final_amount = ?,
                    Total_amount = ?,
                    Payment_status = ?,
                    Status = 'PROCESSING',
                    Is_edited = 2,
                    Note = CASE WHEN Note IS NULL OR Note = '' THEN ? ELSE (Note || ?) END
                WHERE Order_id = ?
            `).run(newFinalTotal, newFinalTotal, newPaymentStatus, (Note || 'Gọi thêm món'), extraNote, targetOrderId);

            // 6. Cập nhật DINING_TABLES giữ nguyên mã đơn và cập nhật tổng tiền
            if (diningTable) {
                db.prepare(`
                    UPDATE DINING_TABLES
                    SET Status = 'SERVING',
                        Current_order_id = ?,
                        Current_order_code = ?,
                        Current_amount = ?,
                        Payment_status = ?,
                        Updated_at = datetime('now', 'localtime')
                    WHERE Table_id = ?
                `).run(targetOrderId, targetOrderCode, newFinalTotal, newPaymentStatus, diningTable.Table_id);
            }

            // 7. Ghi log ORDER_LOGS
            try {
                const newDetails = db.prepare(`SELECT Item_name, Quantity, Unit_price, Total_price, Note, Toppings FROM ORDER_DETAILS WHERE Order_id = ?`).all(targetOrderId);
                db.prepare(`
                    INSERT INTO ORDER_LOGS (Order_code, Modified_by, Old_content, New_content)
                    VALUES (?, ?, ?, ?)
                `).run(targetOrderCode, Staff_name || 'Bồi bàn', JSON.stringify(oldDetails), JSON.stringify(newDetails));
            } catch(e) {}

            // 8. Bắn Socket thông báo Realtime cho Bếp, Bàn & Đơn Hàng
            const io = req.app.get('io');
            if (io) {
                io.emit('kitchen_new_order', { 
                    Order_id: targetOrderId, 
                    Order_code: targetOrderCode, 
                    Table_name: tableName,
                    Table_number: tableName,
                    Customer_name: activeOrder ? activeOrder.Customer_name : 'Khách',
                    Is_edited: 2,
                    Is_add_more: 1,
                    New_items: items,
                    Items: items,
                    items: items,
                    Final_amount: newFinalTotal,
                    Created_at: new Date().toLocaleString('vi-VN')
                });
                io.emit('table_updated', {
                    Table_name: tableName,
                    Status: 'SERVING',
                    Current_order_id: targetOrderId,
                    Current_order_code: targetOrderCode,
                    Current_amount: newFinalTotal,
                    Payment_status: newPaymentStatus
                });
                io.emit('tables_list_changed');
                io.emit('order_status_updated', {
                    Order_id: targetOrderId,
                    Order_code: targetOrderCode,
                    Payment_status: newPaymentStatus,
                    Final_amount: newFinalTotal
                });
                emitOrderBadgeCounts(io, db);
            }

            return res.json({ 
                success: true, 
                isAddMore: true,
                message: `Đã bổ sung ${items.length} món vào bàn ${tableName} (Đơn #${targetOrderCode})`, 
                Order_id: targetOrderId, 
                Order_code: targetOrderCode, 
                Final_amount: newFinalTotal, 
                Payment_status: newPaymentStatus,
                Is_edited: 2 
            });
        }
        
        // 🔵 3. ĐƠN MỚI TẠO (BÀN MỚI HOẶC MANG VỀ)
        else {
            const orderCode = 'CHAY-' + Date.now().toString().slice(-6);
            const isPaid = (Payment_status === 'PAID') || (Payment_method === 'CASH' && Paid_by) || (Payment_method === 'PREPAID');
            const paymentStat = isPaid ? 'PAID' : 'UNPAID';
            const paidUser = isPaid ? (Paid_by || Staff_name || 'Nhân viên') : null;

            let deliveryPlatform = req.body.Delivery_platform || req.body.deliveryPlatform || '';
            if (!deliveryPlatform && tableName && (tableName.startsWith('Đơn Giao') || tableName.startsWith('Đơn Shipper'))) {
                deliveryPlatform = tableName.replace(/^Đơn (Giao|Shipper)\s*-\s*/i, '').trim();
            }
            const customerPhone = req.body.Customer_phone || req.body.customerPhone || '';
            const deliveryAddress = req.body.Delivery_address || req.body.deliveryAddress || '';
            const paymentType = req.body.Payment_type || req.body.paymentType || (Payment_method === 'CASH' ? 'COD' : 'TRANSFER');
            const shippingFee = Number(req.body.Shipping_fee || req.body.shippingFee || 0);

            const memberId = req.body.Member_id || null;
            const memberPhone = req.body.Member_phone || customerPhone || '';
            const memberName = req.body.Member_name || '';
            const memberTier = req.body.Member_tier || '';
            const discountPercent = Number(req.body.Discount_percent || 0);
            const discountAmount = Number(req.body.Discount_amount || 0);
            const pointsUsed = Number(req.body.Points_used || 0);
            const pointsAmount = Number(req.body.Points_amount || 0);
            const pointsEarned = Number(req.body.Points_earned || 0);
            const prepaidUsed = Number(req.body.Prepaid_used || 0);
            const voucherCode = req.body.Voucher_code ? String(req.body.Voucher_code).trim().toUpperCase() : null;
            const voucherDiscount = Number(req.body.Voucher_discount || 0);

            const isDelivery = Boolean(deliveryPlatform || deliveryAddress || Order_type === 'DELIVERY' || Order_type === 'TAKE_AWAY');
            const finalOrderType = isDelivery ? (deliveryAddress ? 'DELIVERY' : 'TAKE_AWAY') : (Order_type || 'DINE_IN');

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

            const staffCreator = Staff_name || Paid_by || 'Bồi bàn';
            const stmtOrder = db.prepare(`
                INSERT INTO ORDERS (
                    Order_code, Order_type, Table_number, Customer_name, Payment_method, 
                    Payment_status, Paid_by, Paid_at, Final_amount, Note, Status, 
                    Is_edited, Staff_name, Created_by, Delivery_platform, Customer_phone, 
                    Delivery_address, Payment_type, Shipping_fee,
                    Member_id, Member_phone, Member_name, Member_tier,
                    Discount_percent, Discount_amount, Points_used, Points_amount, Points_earned, Prepaid_used,
                    Voucher_code, Voucher_discount
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ${isPaid ? "datetime('now', 'localtime')" : "NULL"}, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const finalCustomerName = (memberName && memberName.trim() && memberName !== 'Khách vãng lai') 
                ? memberName.trim() 
                : (Customer_name && Customer_name.trim() ? Customer_name.trim() : 'Khách vãng lai');

            const info = stmtOrder.run(
                orderCode, finalOrderType, tableName, finalCustomerName, Payment_method || 'CASH', 
                paymentStat, paidUser, finalTotal, Note || '', initialStatus, staffCreator, staffCreator,
                deliveryPlatform, customerPhone, deliveryAddress, paymentType, shippingFee,
                memberId, memberPhone, memberName || finalCustomerName, memberTier,
                discountPercent, discountAmount, pointsUsed, pointsAmount, pointsEarned, prepaidUsed,
                voucherCode, voucherDiscount
            );
            const newOrderId = info.lastInsertRowid;

            // Đánh dấu voucher đã sử dụng nếu có
            if (voucherCode) {
                try {
                    // 1. Tăng số lượt đã dùng trong bảng chiến dịch MARKETING_CAMPAIGNS
                    db.prepare(`
                        UPDATE MARKETING_CAMPAIGNS 
                        SET Usage_count = COALESCE(Usage_count, 0) + 1 
                        WHERE UPPER(Code) = ?
                    `).run(voucherCode);

                    // 2. Nếu là hội viên cụ thể, đánh dấu đã dùng trong MEMBER_VOUCHERS
                    if (memberId) {
                        db.prepare(`
                            UPDATE MEMBER_VOUCHERS 
                            SET Status = 'USED', Used_at = datetime('now', 'localtime'), Used_order_code = ?
                            WHERE Member_id = ? AND UPPER(Voucher_code) = ? AND Status = 'UNUSED'
                        `).run(orderCode, memberId, voucherCode);
                    }
                } catch (vErr) {
                    console.warn('Lỗi đánh dấu voucher đã dùng:', vErr.message);
                }
            }

            if (Array.isArray(items) && items.length > 0) {
                const stmtDetail = db.prepare(`INSERT INTO ORDER_DETAILS (Order_id, Item_name, Quantity, Unit_price, Total_price, Note, Toppings) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                items.forEach(i => {
                    const price = Number(i.price || i.Unit_price || 35000);
                    const qty = Number(i.quantity || i.Quantity || 1);
                    const itemNote = i.note || i.Note || '';
                    const itemToppings = typeof i.toppings === 'string' ? i.toppings : (Array.isArray(i.toppings) ? (i.toppings.map(t => `${t.name} (+${Number(t.price).toLocaleString()}đ)`).join(', ')) : '');
                    stmtDetail.run(newOrderId, i.name || i.Item_name || 'Món chay', qty, price, qty * price, itemNote, itemToppings);
                });
            }

            // Ghi nhật ký KPI nếu thu tiền mặt ngay
            if (isPaid) {
                try {
                    db.prepare(`
                        INSERT INTO STAFF_KPI_LOGS (Staff_username, Staff_name, Staff_role, Action_type, Order_id, Order_code, Table_number, Amount, Note)
                        VALUES (?, ?, ?, 'PAYMENT_COLLECTED', ?, ?, ?, ?, ?)
                    `).run(
                        paidUser,
                        Staff_name || paidUser,
                        Staff_role || 'WAITER',
                        newOrderId,
                        orderCode,
                        tableName,
                        finalTotal,
                        `Thu tiền mặt ngay lúc đặt đơn (${tableName}) - ${finalTotal.toLocaleString('vi-VN')} đ`
                    );
                } catch (kpiErr) {
                    console.error('Lỗi ghi KPI thu tiền mặt:', kpiErr.message);
                }
            }

            // Xử lý tích điểm & khấu trừ hội viên Hoa Sen tự động khi tạo đơn
            if (memberId || memberPhone) {
                try {
                    const ioObj = req.app.get('io');
                    processOrderLoyalty(db, newOrderId, paidUser || staffCreator, ioObj);
                } catch (loyErr) {
                    console.error('Lỗi tích điểm hội viên khi tạo đơn:', loyErr.message);
                }
            }

            // Cập nhật trạng thái Bàn Ăn sang SERVING
            if (tableName && tableName !== 'Mang về' && tableName !== 'Đơn Web Giao Hàng') {
                try {
                    const cleanTable = tableName.replace(/^Bàn\s*/i, 'B').trim();
                    const curTable = db.prepare(`
                        SELECT * FROM DINING_TABLES 
                        WHERE LOWER(Table_name) = LOWER(?) OR LOWER(Table_code) = LOWER(?) OR LOWER(Table_name) = LOWER(?)
                    `).get(tableName, tableName, cleanTable);

                    if (curTable) {
                        const guests = curTable.Current_guests > 0 ? curTable.Current_guests : 1;
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
                        `).run(newOrderId, orderCode, finalTotal, paymentStat, guests, curTable.Table_id);

                        if (curTable.Status === 'EMPTY') {
                            db.prepare(`
                                INSERT INTO GUEST_LOGS (Table_id, Table_name, Guest_count, Action_type, Order_id, Order_code, Staff_username)
                                VALUES (?, ?, ?, 'CHECK_IN', ?, ?, ?)
                            `).run(curTable.Table_id, curTable.Table_name, guests, newOrderId, orderCode, staffCreator);
                        }
                    }
                } catch (tblErr) {
                    console.error('Lỗi cập nhật bàn khi tạo đơn:', tblErr.message);
                }
            }

            // 🌟 BẮN SOCKET BÁO BẾP & THU NGÂN KHI CÓ ĐƠN HÀNG MỚI TẠO
            const io = req.app.get('io');
            if (io) {
                io.emit('kitchen_new_order', { 
                    Order_id: newOrderId, 
                    Order_code: orderCode, 
                    Table_name: tableName,
                    Table_number: tableName,
                    Customer_name: finalCustomerName,
                    Order_type: finalOrderType,
                    Delivery_platform: deliveryPlatform,
                    deliveryPlatform: deliveryPlatform,
                    Final_amount: finalTotal,
                    Status: initialStatus,
                    Note: Note || '',
                    Items: items,
                    items: items,
                    Is_edited: 0,
                    Created_at: new Date().toLocaleString('vi-VN')
                });
                io.emit('table_updated', {
                    Table_name: tableName,
                    Status: 'SERVING',
                    Current_order_id: newOrderId,
                    Current_amount: finalTotal,
                    Payment_status: paymentStat
                });
                io.emit('tables_list_changed');
                if (isPaid) {
                    io.emit('order_status_updated', {
                        Order_id: newOrderId,
                        Order_code: orderCode,
                        Payment_status: 'PAID',
                        Paid_by: paidUser
                    });
                }
                emitOrderBadgeCounts(io, db);
            }

            return res.json({ 
                success: true, 
                message: 'Gửi đơn xuống Bếp thành công', 
                Order_id: newOrderId, 
                Order_code: orderCode, 
                Final_amount: finalTotal, 
                Payment_status: paymentStat,
                Paid_by: paidUser,
                Is_edited: 0 
            });
        }
    } catch (err) {
        console.error('❌ Lỗi POST /api/orders:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// POST: Tự động chốt đơn khi khách thanh toán Web
router.post('/auto-checkout', (req, res) => {
    try {
        const { Customer_name, Customer_phone, Delivery_address, Payment_method, items, Note } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Giỏ hàng đang trống!' });
        }

        const db = new Database(DB_PATH);
        const orderCodeStr = 'AUTOCHAY-' + Date.now();
        const totalAmount = items.reduce((sum, i) => sum + (Number(i.Quantity || i.quantity || 1) * Number(i.Base_price || i.price || 0)), 0);

        let createdOrderId = orderCodeStr;

        const transaction = db.transaction(() => {
            try {
                const stmtOrder = db.prepare(`
                    INSERT INTO ORDERS (Order_id, Order_code, Table_id, Table_name, Order_type, Customer_name, Note, Total_amount, Final_amount, Status, Created_at)
                    VALUES (?, ?, '', ?, 'DELIVERY', ?, ?, ?, ?, 'PENDING', DATETIME('now', 'localtime'))
                `);
                stmtOrder.run(orderCodeStr, orderCodeStr, Delivery_address || 'Địa chỉ giao hàng', Customer_name || 'Khách Đặt Web', Note || 'Đơn thanh toán tự động', totalAmount, totalAmount);
            } catch (e) {
                const stmtFallback = db.prepare(`
                    INSERT INTO ORDERS (Order_code, Table_id, Table_name, Order_type, Customer_name, Note, Total_amount, Final_amount, Status, Created_at)
                    VALUES (?, '', ?, 'DELIVERY', ?, ?, ?, ?, 'PENDING', DATETIME('now', 'localtime'))
                `);
                const info = stmtFallback.run(orderCodeStr, Delivery_address || 'Địa chỉ giao hàng', Customer_name || 'Khách Đặt Web', Note || 'Đơn thanh toán tự động', totalAmount, totalAmount);
                createdOrderId = info.lastInsertRowid;
            }

            items.forEach(it => {
                const qty = Number(it.Quantity || it.quantity) || 1;
                const price = Number(it.Base_price || it.price) || 0;
                const itemName = String(it.Item_name || it.name || 'Món chay');

                try {
                    const stmtItem = db.prepare(`
                        INSERT INTO ORDER_ITEMS (order_id, item_id, item_name, quantity, price, note, printer_target)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `);
                    stmtItem.run(createdOrderId, Number(it.Item_id || it.id) || 0, itemName, qty, price, '', 'KITCHEN_MAIN');
                } catch (eItem) {
                    const stmtDetail = db.prepare(`
                        INSERT INTO ORDER_DETAILS (Order_id, Item_name, Quantity, Unit_price, Total_price)
                        VALUES (?, ?, ?, ?, ?)
                    `);
                    stmtDetail.run(createdOrderId, itemName, qty, price, qty * price);
                }
            });
        });

        transaction();
        db.close();

        // Bắn Socket báo Bếp
        const io = req.app.get('io');
        if (io) {
            io.emit('kitchen_new_order', { Order_id: createdOrderId, Order_code: orderCodeStr, Table_name: 'Đơn Web Giao Hàng' });
        }

        res.json({ success: true, message: 'Thanh toán thành công!', Order_id: createdOrderId, Order_code: orderCodeStr });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 1. API XÁC NHẬN THANH TOÁN & GHI NHẬN NGƯỜI THU TIỀN
// ==========================================
router.put('/:id/confirm-payment', (req, res) => {
    try {
        const orderIdentifier = req.params.id;
        const { Paid_by, Staff_name, Staff_role, Payment_method } = req.body || {};
        const staffUser = Paid_by || 'Thu Ngân';
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        const orderInfo = db.prepare(`SELECT Order_id, Order_code, Table_number, Final_amount, Total_amount, Payment_method FROM ORDERS WHERE Order_id = ? OR Order_code = ?`).get(orderIdentifier, orderIdentifier);

        if (!orderInfo) {
            return res.status(404).json({ error: 'Không tìm thấy đơn hàng!' });
        }

        const method = Payment_method || orderInfo.Payment_method || 'CASH';
        const amount = Number(orderInfo.Final_amount || orderInfo.Total_amount || 0);

        db.prepare(`
            UPDATE ORDERS 
            SET Payment_status = 'PAID', Paid_by = ?, Paid_at = datetime('now', 'localtime'), Payment_method = ?
            WHERE Order_id = ? OR Order_code = ?
        `).run(staffUser, method, orderIdentifier, orderIdentifier);

        // Ghi nhật ký KPI thu tiền cho Thu ngân
        try {
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
                `Thu tiền thành công (${method}) - ${amount.toLocaleString('vi-VN')} đ`
            );
        } catch (kpiErr) {
            console.error('Lỗi ghi KPI thu tiền:', kpiErr.message);
        }

        // Cập nhật trạng thái thanh toán của bàn ăn tương ứng
        if (orderInfo.Table_number) {
            try {
                const cleanTable = orderInfo.Table_number.replace(/^Bàn\s*/i, 'B').trim();
                db.prepare(`
                    UPDATE DINING_TABLES 
                    SET Payment_status = 'PAID', Updated_at = datetime('now', 'localtime')
                    WHERE LOWER(Table_name) = LOWER(?) OR LOWER(Table_code) = LOWER(?) OR LOWER(Table_name) = LOWER(?)
                `).run(orderInfo.Table_number, orderInfo.Table_number, cleanTable);
            } catch (tblErr) {
                console.error('Lỗi cập nhật trạng thái thanh toán bàn:', tblErr.message);
            }
        }

        // Tích điểm và thăng hạng hội viên Hoa Sen tự động
        try {
            const ioObj = req.app.get('io');
            processOrderLoyalty(db, orderIdentifier, staffUser, ioObj);
        } catch (loyErr) {
            console.error('Lỗi tích điểm hội viên khi xác nhận thanh toán đơn:', loyErr.message);
        }

        const io = req.app.get('io');
        if (io) {
            io.emit('order_status_updated', {
                Order_id: orderInfo.Order_id,
                Order_code: orderInfo.Order_code,
                Payment_status: 'PAID',
                Paid_by: staffUser,
                Paid_at: now
            });
            io.emit('table_updated', {
                Table_name: orderInfo.Table_number,
                Payment_status: 'PAID'
            });
            io.emit('tables_list_changed');
        }

        res.json({ success: true, message: 'Đã xác nhận thu tiền thành công!', Paid_by: staffUser, Paid_at: now });
    } catch (err) {
        console.error('Lỗi confirm-payment:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 2. API THỐNG KÊ KPI & NHẬT KÝ NHÂN VIÊN
// ==========================================
router.get('/kpi/stats', (req, res) => {
    try {
        const timeRange = req.query.timeRange || 'TODAY';
        
        let dateFilter = '';
        if (timeRange === 'TODAY') {
            dateFilter = "AND date(Created_at) = date('now', 'localtime')";
        } else if (timeRange === 'WEEK') {
            dateFilter = "AND date(Created_at) >= date('now', '-7 days', 'localtime')";
        } else if (timeRange === 'MONTH') {
            dateFilter = "AND strftime('%Y-%m', Created_at) = strftime('%Y-%m', 'now', 'localtime')";
        }

        // 1. Thống kê tổng hợp theo từng nhân viên
        const summary = db.prepare(`
            SELECT 
                Staff_username,
                MAX(Staff_name) as Staff_name,
                MAX(Staff_role) as Staff_role,
                COUNT(CASE WHEN Action_type = 'COOK_FINISH' THEN 1 END) as cook_count,
                COUNT(CASE WHEN Action_type = 'ORDER_SERVED' THEN 1 END) as served_count,
                COUNT(CASE WHEN Action_type = 'ORDER_CREATED' THEN 1 END) as created_count,
                COUNT(CASE WHEN Action_type = 'PAYMENT_COLLECTED' THEN 1 END) as payment_count,
                COALESCE(SUM(CASE WHEN Action_type = 'PAYMENT_COLLECTED' THEN Amount ELSE 0 END), 0) as total_revenue_collected,
                COUNT(*) as total_actions
            FROM STAFF_KPI_LOGS
            WHERE 1=1 ${dateFilter}
            GROUP BY Staff_username
            ORDER BY total_actions DESC
        `).all();

        // 2. Lấy 100 nhật ký gần nhất
        const logs = db.prepare(`
            SELECT * FROM STAFF_KPI_LOGS
            WHERE 1=1 ${dateFilter}
            ORDER BY Log_id DESC
            LIMIT 100
        `).all();

        res.json({ summary, logs });
    } catch (err) {
        console.error('Lỗi GET /api/orders/kpi/stats:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// API LẤY LỊCH SỬ SỬA ĐƠN HÀNG (Cho nút "Sử" màu tím)
// ==========================================
router.get('/:code/history', (req, res) => {
    try {
        const codeParam = req.params.code;
        if (!codeParam) return res.json([]);

        // Lọc sạch dấu # và khoảng trắng
        const cleanCode = String(codeParam).replace('#', '').trim();
        const codeWithPrefix = cleanCode.startsWith('CHAY-') ? cleanCode : ('CHAY-' + cleanCode);
        const codeWithoutPrefix = cleanCode.replace('CHAY-', '');

        // Truy vấn bảng ORDER_LOGS khớp tất cả các kiểu định dạng mã
        const logs = db.prepare(`
            SELECT * FROM ORDER_LOGS 
            WHERE Order_code = ? OR Order_code = ? OR Order_code = ? OR Order_code = ?
            ORDER BY Log_id DESC
        `).all(cleanCode, codeWithPrefix, codeWithoutPrefix, '#' + codeWithPrefix);

        return res.json(Array.isArray(logs) ? logs : []);
    } catch (err) {
        console.error('❌ Lỗi GET /api/orders/:code/history:', err.message);
        return res.json([]);
    }
});

// GET: Lấy thông tin chi tiết 1 đơn hàng theo ID hoặc Order_code
router.get('/:id', (req, res) => {
    try {
        const idOrCode = req.params.id;
        const cleanCode = String(idOrCode).replace('#', '').trim();
        const codeWithPrefix = cleanCode.startsWith('CHAY-') ? cleanCode : ('CHAY-' + cleanCode);

        const db = new Database(DB_PATH, { readonly: true });
        const order = db.prepare(`
            SELECT * FROM ORDERS 
            WHERE Order_id = ? OR Order_code = ? OR Order_code = ? OR Order_code = ?
            LIMIT 1
        `).get(idOrCode, cleanCode, codeWithPrefix, '#' + codeWithPrefix);

        if (!order) {
            db.close();
            return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
        }

        let items = [];
        try {
            items = db.prepare('SELECT * FROM ORDER_DETAILS WHERE Order_id = ?').all(order.Order_id);
        } catch (e) { items = []; }
        if (!items || items.length === 0) {
            try {
                items = db.prepare('SELECT * FROM ORDER_ITEMS WHERE order_id = ?').all(order.Order_id);
            } catch (e2) { items = []; }
        }

        db.close();
        res.json({ success: true, order: { ...order, items } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;