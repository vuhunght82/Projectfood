const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.db');

// Tọa độ gốc Nhà Hàng Chay Hoa Sen (Bà Điểm, Hóc Môn / Q.12)
const RESTAURANT_LAT = 10.8351;
const RESTAURANT_LNG = 106.6020;

// Hàm tính khoảng cách GPS Haversine (km)
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
}

// API Quét xem Shipper có ở gần Nhà Hàng không (bán kính 1km, 2km...)
router.get('/nearby-orders', (req, res) => {
    try {
        const shipperLat = Number(req.query.shipper_lat);
        const shipperLng = Number(req.query.shipper_lng);
        const maxRadius = Number(req.query.radius) || 2;

        if (!shipperLat || !shipperLng) {
            return res.status(400).json({ error: 'Chưa nhận được GPS của Shipper!' });
        }

        const distanceFromRest = calculateDistanceKm(shipperLat, shipperLng, RESTAURANT_LAT, RESTAURANT_LNG);

        if (distanceFromRest > maxRadius) {
            return res.json({
                in_range: false,
                distance_to_restaurant: distanceFromRest,
                message: `Bạn đang ở cách nhà hàng ${distanceFromRest} km (ngoài bán kính ${maxRadius} km). Hãy di chuyển lại gần hơn!`,
                orders: []
            });
        }

        const db = new Database(DB_PATH, { readonly: true });
        const orders = db.prepare(`
            SELECT Order_id, Order_code, Customer_name, Table_number as Phone, Delivery_address, Final_amount, Note, Created_at
            FROM ORDERS 
            WHERE (Shipper_id IS NULL OR Shipping_status = 'PENDING')
            ORDER BY Order_id DESC
        `).all();
        db.close();

        res.json({
            in_range: true,
            distance_to_restaurant: distanceFromRest,
            orders: orders
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// API Shipper bấm nhận đơn
router.post('/accept-order', (req, res) => {
    try {
        const { Order_id, Shipper_id } = req.body;
        const db = new Database(DB_PATH);
        
        const order = db.prepare('SELECT Shipper_id FROM ORDERS WHERE Order_id = ?').get(Order_id);
        if (order && order.Shipper_id) {
            db.close();
            return res.status(400).json({ error: 'Đơn hàng này đã có Shipper khác nhận!' });
        }

        db.prepare('UPDATE ORDERS SET Shipper_id = ?, Shipping_status = "ACCEPTED", Status = "DELIVERING" WHERE Order_id = ?')
          .run(Shipper_id, Order_id);
        db.close();

        res.json({ success: true, message: 'Nhận đơn thành công!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;