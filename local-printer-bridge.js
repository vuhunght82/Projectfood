/**
 * CẦU NỐI MÁY IN NHIỆT LAN CỤC BỘ (LOCAL PRINTER BRIDGE)
 * -------------------------------------------------------------
 * Mục đích:
 * Dùng khi Server chạy trên Cloud VPS (Internet) nhưng Máy In Bill nằm trong mạng Wi-Fi LAN tại quán.
 * Chỉ cần chạy file này trên bất kỳ máy tính / laptop / mini PC nào trong quán (cùng mạng Wi-Fi với máy in bill):
 *    node local-printer-bridge.js
 *
 * File này sẽ tự kết nối tới Server Cloud qua Socket.io.
 * Mỗi khi nhân viên bấm "In Bill" / "Thanh Toán & In" / "In Bếp" trên Tablet Android Chrome,
 * Server bắn lệnh qua Socket.io -> File này nhận lệnh và mở TCP Socket nội bộ xả thẳng vào IP máy in LAN (Cổng 9100)!
 */

const net = require('net');
const io = require('socket.io-client');

// Địa chỉ Server Cloud của quán (đổi nếu dùng domain khác)
const SERVER_URL = process.env.SERVER_URL || 'http://221.132.21.152:3000';

// IP mặc định của máy in bill tại quán (nếu server không chỉ định)
const DEFAULT_PRINTER_IP = process.env.PRINTER_IP || '192.168.1.77';
const DEFAULT_PRINTER_PORT = parseInt(process.env.PRINTER_PORT || '9100', 10);

console.log('====================================================');
console.log(' 🖨️  HOA SEN LOCAL PRINTER BRIDGE (MẠNG LAN 9100)  ');
console.log('====================================================');
console.log(`📡 Đang kết nối tới Máy Chủ Cloud: ${SERVER_URL}`);
console.log(`🎯 Máy in mặc định: ${DEFAULT_PRINTER_IP}:${DEFAULT_PRINTER_PORT}`);
console.log('----------------------------------------------------');

const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 2000
});

socket.on('connect', () => {
    console.log(`[${new Date().toLocaleTimeString('vi-VN')}] ✅ Đã kết nối tới Server Cloud! Sẵn sàng nhận lệnh in...`);
});

socket.on('disconnect', () => {
    console.log(`[${new Date().toLocaleTimeString('vi-VN')}] ⚠️ Mất kết nối tới Server Cloud, đang thử kết nối lại...`);
});

socket.on('lan_print_job', (job) => {
    if (!job || !job.escposBase64) return;

    const host = job.host || DEFAULT_PRINTER_IP;
    const port = job.port || DEFAULT_PRINTER_PORT;
    const target = job.target || 'BILL';

    console.log(`[${new Date().toLocaleTimeString('vi-VN')}] 📥 Nhận lệnh in [${target}] -> Đang gửi tới máy in [${host}:${port}]...`);

    try {
        const buffer = Buffer.from(job.escposBase64, 'base64');
        const client = new net.Socket();
        client.setTimeout(3500);

        client.connect(port, host, () => {
            client.write(buffer, (err) => {
                client.end();
                if (err) {
                    console.error(`❌ Lỗi ghi dữ liệu tới [${host}:${port}]:`, err.message);
                } else {
                    console.log(`✅ [THÀNH CÔNG] Đã in xong và cắt giấy tại máy in [${host}:${port}] (${buffer.length} bytes)!`);
                }
            });
        });

        client.on('error', (err) => {
            console.error(`❌ Không thể kết nối tới [${host}:${port}]:`, err.message);
            client.destroy();
        });

        client.on('timeout', () => {
            console.error(`❌ Hết thời gian chờ kết nối tới [${host}:${port}]! Vui lòng kiểm tra IP và dây mạng máy in.`);
            client.destroy();
        });
    } catch (e) {
        console.error('❌ Lỗi xử lý lệnh in:', e.message);
    }
});

