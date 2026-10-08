// Service Worker nhận tín hiệu Push Notification ngầm
self.addEventListener('push', function(event) {
    let data = { title: 'Báo Đơn Mới!', body: 'Có đơn hàng mới gửi xuống Bếp!' };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: 'https://cdn-icons-png.flaticon.com/512/3448/3448609.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/3448/3448609.png',
        vibrate: [300, 100, 300, 100, 400],
        data: { url: data.url || '/kitchen' },
        requireInteraction: true
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});