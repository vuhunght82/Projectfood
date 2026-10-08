/**
 * js/guest-home.js
 * Quản lý giao diện Trang Chủ Khách Hàng (khi chưa đăng nhập tài khoản nhân viên)
 * - Banner quảng cáo động / Slide chạy chuyển động mượt mà
 * - Các món chay ưu đãi, combo nổi bật
 * - Màu sắc chủ đạo đồng bộ từ "Thương hiệu & Logo web" (--primary-color)
 * - Tối ưu hoá chuẩn Responsive cho Điện thoại & Tablet
 */

(function(window) {
    let allDishesCache = [];
    let allCategoriesCache = [];
    let activeCategoryFilter = 'ALL';

    // 1. Khởi tạo toàn bộ trang khách hàng
    window.initGuestHome = async function() {
        await Promise.allSettled([
            loadGuestBanners(),
            loadGuestMenuAndCategories(),
            loadGuestPrepaidPackages(),
            loadGuestRestaurantInfo()
        ]);
        
        // Khởi động carousel Bootstrap nếu có
        setupGuestCarousel();

        // Bảo mật thông tin thẻ: Chỉ hiện khi khách đã đăng nhập tài khoản của mình
        setupGuestMemberSection();
    };

    // 2. Nạp Banners quảng cáo động từ CSDL
    async function loadGuestBanners() {
        const inner = document.getElementById('guestCarouselInner');
        const indicators = document.getElementById('guestCarouselIndicators');
        if (!inner) return;

        try {
            const res = await fetch('/api/promotion-banners?activeOnly=1&t=' + Date.now());
            if (!res.ok) return;
            const data = await res.json();
            const banners = Array.isArray(data.banners) ? data.banners : [];

            if (banners.length === 0) {
                // Giữ lại slide mẫu mặc định
                return;
            }

            window._guestSlideIndex = 0;

            // Renders indicators
            if (indicators) {
                indicators.innerHTML = banners.map((b, idx) => `
                    <button type="button" data-bs-target="#guestHeroCarousel" data-bs-slide-to="${idx}" onclick="window.guestCarouselGoTo(${idx})"
                            class="${idx === 0 ? 'active' : ''}" aria-current="${idx === 0 ? 'true' : 'false'}"></button>
                `).join('');
            }

            // Renders slides
            inner.innerHTML = banners.map((b, idx) => {
                const img = b.Image_url || '/uploads/banner_1790164138400.jpg';
                const badge = b.Badge_text || 'ƯU ĐÃI';
                const title = b.Title || 'Món Chay Thanh Tịnh';
                const subtitle = b.Subtitle || 'Nguyên liệu tươi ngon mỗi ngày, dưỡng sinh an lành.';
                const price = b.Price_text || '';

                return `
                    <div class="carousel-item ${idx === 0 ? 'active' : ''}" data-index="${idx}">
                        <div class="guest-hero-slide" style="background-image: url('${img}');">
                            <div class="container h-100 d-flex flex-column justify-content-center text-white py-4 py-md-5">
                                <div class="guest-slide-badge mb-2 mb-md-3">
                                    <span class="badge rounded-pill px-3 py-2 text-uppercase fw-bold shadow-sm" style="background: var(--primary-color, #2e7d32); font-size: 12.5px; letter-spacing: 0.5px;">
                                        <i class="fa-solid fa-sparkles me-1"></i> ${badge}
                                    </span>
                                </div>
                                <h2 class="display-6 display-md-5 fw-bold mb-2 mb-md-3 guest-slide-title text-shadow">${title}</h2>
                                <p class="lead mb-3 mb-md-4 text-white-50 guest-slide-desc" style="max-width: 620px;">
                                    ${subtitle}
                                </p>
                                <div class="d-flex flex-wrap align-items-center gap-2 gap-md-3">
                                    ${price ? `<span class="fs-4 fs-md-3 fw-bold text-warning guest-slide-price">${price}</span>` : ''}
                                    <button class="btn rounded-pill px-3 px-md-4 py-2 fw-bold text-white shadow-sm" onclick="window.scrollToGuestDishes()" style="background-color: var(--primary-color, #2e7d32);">
                                        <i class="fa-solid fa-utensils me-2"></i>Xem Thực Đơn Món Chay
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (e) {
            console.warn('Lỗi nạp banners khách hàng:', e);
        }
    }

    // 3. Khởi tạo Slider cho banner với thời gian & hiệu ứng tùy biến (Tự động chuyển mượt mà, không phụ thuộc thư viện ngoài)
    window._guestSlideIndex = 0;

    window.guestCarouselGoTo = function(idx) {
        const carouselEl = document.getElementById('guestHeroCarousel');
        if (!carouselEl) return;
        const items = carouselEl.querySelectorAll('.carousel-inner .carousel-item');
        const indicators = carouselEl.querySelectorAll('.carousel-indicators button');
        const total = items.length;
        if (total <= 1) return;

        if (idx < 0) idx = total - 1;
        if (idx >= total) idx = 0;
        window._guestSlideIndex = idx;

        // Nếu có Bootstrap Carousel, giải phóng cờ sliding để không bị treo
        if (typeof bootstrap !== 'undefined' && bootstrap.Carousel) {
            const inst = bootstrap.Carousel.getInstance(carouselEl);
            if (inst) {
                try {
                    inst._isSliding = false;
                    inst.to(idx);
                } catch (e) {}
            }
        }

        // Cập nhật DOM trực tiếp để đảm bảo hiển thị 100% chuẩn xác
        items.forEach((item, i) => {
            if (i === idx) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        indicators.forEach((ind, i) => {
            if (i === idx) {
                ind.classList.add('active');
                ind.setAttribute('aria-current', 'true');
            } else {
                ind.classList.remove('active');
                ind.removeAttribute('aria-current');
            }
        });
    };

    window.guestCarouselNext = function() {
        const carouselEl = document.getElementById('guestHeroCarousel');
        if (!carouselEl) return;
        const total = carouselEl.querySelectorAll('.carousel-inner .carousel-item').length;
        if (total <= 1) return;
        window.guestCarouselGoTo((window._guestSlideIndex + 1) % total);
    };

    window.guestCarouselPrev = function() {
        const carouselEl = document.getElementById('guestHeroCarousel');
        if (!carouselEl) return;
        const total = carouselEl.querySelectorAll('.carousel-inner .carousel-item').length;
        if (total <= 1) return;
        window.guestCarouselGoTo((window._guestSlideIndex - 1 + total) % total);
    };

    async function setupGuestCarousel() {
        const carouselEl = document.getElementById('guestHeroCarousel');
        if (!carouselEl) return;

        let interval = 4000;
        let effect = 'slide';
        let speed = 800;

        try {
            let savedCfg = JSON.parse(localStorage.getItem('hoasen_system_config') || '{}');
            if (!savedCfg.home_slide_interval) {
                const res = await fetch('/api/system-config?t=' + Date.now());
                if (res.ok) {
                    const data = await res.json();
                    savedCfg = (data && data.config) ? data.config : (data || {});
                }
            }
            let rawInterval = Number(savedCfg.home_slide_interval || 4);
            if (isNaN(rawInterval) || rawInterval <= 0) rawInterval = 4;
            if (rawInterval <= 30) rawInterval = rawInterval * 1000;
            interval = rawInterval;
            effect = savedCfg.home_slide_effect || 'slide';
            speed = Number(savedCfg.home_slide_speed || 800);
        } catch (e) {}

        // Thiết lập biến CSS tốc độ chuyển slide
        carouselEl.style.setProperty('--slide-transition-duration', `${speed}ms`);

        // Gỡ các class hiệu ứng cũ
        carouselEl.classList.remove('carousel-fade', 'carousel-effect-zoom', 'carousel-effect-flip', 'carousel-effect-slide');

        // Luôn đảm bảo class slide tồn tại
        carouselEl.classList.add('slide');

        if (effect === 'fade') {
            carouselEl.classList.add('carousel-fade');
        } else if (effect === 'zoom') {
            carouselEl.classList.add('carousel-effect-zoom');
        } else if (effect === 'flip') {
            carouselEl.classList.add('carousel-effect-flip');
        } else {
            carouselEl.classList.add('carousel-effect-slide');
        }

        // Tích hợp thao tác vuốt cảm ứng trên màn hình điện thoại & máy tính bảng
        let touchStartX = 0;
        let touchEndX = 0;
        carouselEl.ontouchstart = (e) => {
            if (e.changedTouches && e.changedTouches[0]) {
                touchStartX = e.changedTouches[0].screenX;
            }
        };
        carouselEl.ontouchend = (e) => {
            if (e.changedTouches && e.changedTouches[0]) {
                touchEndX = e.changedTouches[0].screenX;
                if (touchEndX < touchStartX - 45) {
                    window.guestCarouselNext();
                } else if (touchEndX > touchStartX + 45) {
                    window.guestCarouselPrev();
                }
            }
        };

        // Bật chu kỳ chuyển hình tự động độc lập, mượt mà
        if (window._guestCarouselTimer) {
            clearInterval(window._guestCarouselTimer);
        }
        window._guestCarouselTimer = setInterval(() => {
            const el = document.getElementById('guestHeroCarousel');
            if (!el) {
                clearInterval(window._guestCarouselTimer);
                return;
            }
            // Tạm dừng khi chuột đang rê vào banner
            if (el.matches(':hover')) return;
            window.guestCarouselNext();
        }, interval);
    }

    // 4. Nạp Danh mục & Danh sách món ăn ưu đãi
    async function loadGuestMenuAndCategories() {
        const pillsContainer = document.getElementById('guestCategoryFilterPills');
        const grid = document.getElementById('guestDishesGrid');

        try {
            const [catRes, menuRes] = await Promise.all([
                fetch('/api/categories?t=' + Date.now()),
                fetch('/api/menu?t=' + Date.now())
            ]);

            const categories = catRes.ok ? await catRes.json() : [];
            const menu = menuRes.ok ? await menuRes.json() : [];

            allCategoriesCache = Array.isArray(categories) ? categories : [];
            allDishesCache = Array.isArray(menu) ? menu : [];

            // Render category filter pills
            if (pillsContainer) {
                let pillsHtml = `
                    <button class="guest-cat-pill active" onclick="window.filterGuestDishes('ALL', this)">
                        Tất Cả Món (${allDishesCache.length})
                    </button>
                `;
                allCategoriesCache.forEach(c => {
                    const count = allDishesCache.filter(d => String(d.Category_id) === String(c.Category_id)).length;
                    if (count > 0) {
                        pillsHtml += `
                            <button class="guest-cat-pill" onclick="window.filterGuestDishes('${c.Category_id}', this)">
                                ${c.Category_name} (${count})
                            </button>
                        `;
                    }
                });
                pillsContainer.innerHTML = pillsHtml;
            }

            renderGuestDishes();

        } catch (err) {
            console.error('Lỗi nạp thực đơn khách:', err);
            if (grid) {
                grid.innerHTML = '<div class="col-12 text-center text-danger py-4">Không thể kết nối đến máy chủ thực đơn. Vui lòng thử lại!</div>';
            }
        }
    }

    // 5. Hiển thị danh sách món theo bộ lọc
    function renderGuestDishes() {
        const grid = document.getElementById('guestDishesGrid');
        if (!grid) return;

        let filtered = allDishesCache;
        if (activeCategoryFilter !== 'ALL') {
            filtered = allDishesCache.filter(d => String(d.Category_id) === String(activeCategoryFilter));
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="col-12 text-center py-5 text-muted">
                    <i class="fa-solid fa-bowl-rice fa-3x mb-3 text-secondary opacity-50"></i>
                    <p>Chưa có món ăn nào trong danh mục này.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(dish => {
            const id = dish.Item_id || dish.id;
            const name = dish.Item_name || 'Món chay';
            const price = Number(dish.Base_price || dish.Price || 0);
            const formattedPrice = price.toLocaleString('vi-VN') + ' đ';
            const img = dish.Image_url || '/uploads/dish-sample.jpg';
            const desc = dish.Description || 'Món chay thanh tịnh, chế biến từ rau củ tươi.';
            const isAvail = Number(dish.Is_available ?? 1) === 1;

            return `
                <div class="col">
                    <div class="guest-dish-card" style="${!isAvail ? 'opacity: 0.6; filter: grayscale(75%); background: #fdfdfe;' : ''}">
                        <div class="guest-dish-img-wrap" style="position: relative;">
                            <img src="${img}" alt="${name}" loading="lazy" onerror="this.src='/uploads/dish-sample.jpg'" style="${!isAvail ? 'filter: grayscale(80%) brightness(0.9);' : ''}">
                            ${!isAvail ? `
                                <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 2;">
                                    <span class="badge bg-danger shadow fw-bold px-3 py-1 fs-6 rounded-pill">
                                        <i class="fa-solid fa-ban me-1"></i> HẾT MÓN
                                    </span>
                                </div>
                            ` : `
                                <span class="guest-dish-badge bg-success text-white"><i class="fa-solid fa-leaf me-1"></i>Thanh tịnh</span>
                            `}
                        </div>
                        <div class="guest-dish-body">
                            <h6 class="guest-dish-name" title="${name}">${name}</h6>
                            <p class="guest-dish-desc">${desc}</p>
                            <div class="guest-dish-footer d-flex justify-content-between align-items-center">
                                <span class="guest-dish-price">${formattedPrice}</span>
                                ${isAvail ? `
                                    <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill small">
                                        <i class="fa-solid fa-leaf me-1"></i>Thanh Đạm
                                    </span>
                                ` : `
                                    <span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 rounded-pill small fw-bold">
                                        <i class="fa-solid fa-ban me-1"></i>Hết Món
                                    </span>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 6. Lọc món theo danh mục
    window.filterGuestDishes = function(catId, btnEl) {
        activeCategoryFilter = catId;
        document.querySelectorAll('.guest-cat-pill').forEach(btn => btn.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');
        renderGuestDishes();
    };

    // 7. Thêm món vào giỏ hàng từ trang khách
    window.addGuestDishToCart = function(id, name, price, img) {
        if (typeof window.addToCart === 'function') {
            window.addToCart({
                id: id,
                name: name,
                price: price,
                image: img
            });
        }

        // Tạo hiệu ứng rung nút giỏ hàng nổi
        const fab = document.getElementById('floatingCartBtn');
        if (fab) {
            fab.classList.remove('bounce');
            void fab.offsetWidth; // trigger reflow
            fab.classList.add('bounce');
        }
    };

    // 8. Nạp gói ví trả trước động để khách tham khảo
    async function loadGuestPrepaidPackages() {
        const container = document.getElementById('guestPrepaidPackagesRow');
        if (!container) return;

        try {
            const res = await fetch('/api/members/prepaid-packages?t=' + Date.now());
            if (!res.ok) return;
            const data = await res.json();
            const packages = Array.isArray(data.packages) ? data.packages : [];

            if (packages.length === 0) return;

            container.innerHTML = packages.map(pkg => {
                const name = pkg.name || pkg.Name || 'Gói Nạp Ví';
                const topup = Number(pkg.topupAmount ?? pkg.Topup_amount ?? 0);
                const bonus = Number(pkg.bonusAmount ?? pkg.Bonus_amount ?? 0);
                const total = Number(pkg.totalReceived ?? pkg.Total_received ?? (topup + bonus));
                const badge = pkg.badge || pkg.Badge_text || `+ TẶNG ${(total - topup).toLocaleString('vi-VN')} đ`;
                const bg = pkg.bgColor || pkg.Bg_color || '#f1f8e9';
                const border = pkg.borderColor || pkg.Border_color || '#2e7d32';
                const text = pkg.textColor || pkg.Text_color || '#2e7d32';

                return `
                    <div class="col-sm-4">
                        <div class="card h-100 border-2 rounded-4 shadow-sm p-3 text-center bg-white" style="border-color: ${border} !important;">
                            <span class="badge py-2 mb-2 rounded-pill fw-bold" style="background-color: ${bg}; color: ${text};">
                                ${badge}
                            </span>
                            <h6 class="fw-bold mb-1 text-dark">${name}</h6>
                            <div class="fs-5 fw-bold mb-1" style="color: ${text};">${topup.toLocaleString('vi-VN')} đ</div>
                            <small class="text-muted">Nhận ngay ${total.toLocaleString('vi-VN')}đ vào ví</small>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.warn('Lỗi nạp gói trả trước khách:', e);
        }
    }

    // 9. Nạp thông tin quán & Ca làm việc
    async function loadGuestRestaurantInfo() {
        try {
            const res = await fetch('/api/system-config?t=' + Date.now());
            if (!res.ok) return;
            const data = await res.json();
            const cfg = data.config || data || {};

            const name = cfg.restaurant_name || cfg.resName || 'Nhà Hàng Chay Hoa Sen';
            const addr = cfg.restaurant_address || cfg.resAddr || '123 Đường Hoa Sen, TP. Hồ Chí Minh';
            const phone = cfg.restaurant_phone || cfg.resPhone || '0901234567';
            const wifi = cfg.resWifi || 'Wifi: ChayHoaSen / Pass: 88888888';
            const start = cfg.shift_start_time || '06:00';
            const end = cfg.shift_end_time || '22:30';

            const lat = String(cfg.restaurant_lat || cfg.brand_lat || '10.776889').trim();
            const lng = String(cfg.restaurant_lng || cfg.brand_lng || '106.700806').trim();

            window._storeLat = lat;
            window._storeLng = lng;
            window._storeName = name;
            window._storeAddress = addr;

            const nameEl = document.getElementById('guestRestaurantName');
            const addrEl = document.getElementById('guestRestaurantAddress');
            const phoneEl = document.getElementById('guestRestaurantPhone');
            const wifiEl = document.getElementById('guestRestaurantWifi');
            const shiftEl = document.getElementById('guestShiftHours');

            if (nameEl) nameEl.innerText = name;
            if (addrEl) addrEl.innerText = addr;
            if (phoneEl) {
                phoneEl.innerText = phone;
                phoneEl.href = `tel:${phone}`;
            }
            if (wifiEl) wifiEl.innerText = wifi;
            if (shiftEl) shiftEl.innerText = `${start} - ${end}`;

            // Cập nhật Bản Đồ Cửa Hàng
            const mapStoreName = document.getElementById('guestMapStoreName');
            const mapStoreAddr = document.getElementById('guestMapStoreAddress');
            const mapBadge = document.getElementById('guestMapBadgeName');
            const mapCoords = document.getElementById('guestMapCoordsText');
            const mapIframe = document.getElementById('guestStoreMapIframe');
            const btnDirections = document.getElementById('btnDirectionsMap');

            if (mapStoreName) mapStoreName.innerText = name;
            if (mapStoreAddr) mapStoreAddr.innerText = addr;
            if (mapBadge) mapBadge.innerText = name;
            if (mapCoords) mapCoords.innerText = `${lat}, ${lng}`;

            const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lat + ',' + lng)}`;
            if (btnDirections) {
                btnDirections.href = directionsUrl;
            }

            if (mapIframe) {
                const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(lat + ',' + lng)}&hl=vi&z=16&output=embed`;
                if (mapIframe.src !== embedUrl) {
                    mapIframe.src = embedUrl;
                }
            }

        } catch (e) {
            console.warn('Lỗi nạp info quán:', e);
        }
    }

    // 9.1. Chia Sẻ Vị Trí Cửa Hàng
    window.shareStoreLocation = function() {
        const lat = window._storeLat || '10.776889';
        const lng = window._storeLng || '106.700806';
        const name = window._storeName || 'Nhà Hàng Chay Hoa Sen';
        const addr = window._storeAddress || '123 Đường Hoa Sen, TP. Hồ Chí Minh';
        const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lat + ',' + lng)}`;

        if (navigator.share) {
            navigator.share({
                title: name,
                text: `${name} - Địa chỉ: ${addr}`,
                url: mapUrl
            }).catch(() => {});
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(`${name} - ${addr}\nChỉ đường: ${mapUrl}`)
                .then(() => {
                    if (window.toast) window.toast.success('Đã sao chép liên kết bản đồ chỉ đường!');
                    else alert('Đã sao chép liên kết bản đồ chỉ đường:\n' + mapUrl);
                })
                .catch(() => {
                    prompt('Sao chép liên kết chỉ đường đến nhà hàng:', mapUrl);
                });
        } else {
            prompt('Sao chép liên kết chỉ đường đến nhà hàng:', mapUrl);
        }
    };

    // 10. Cuộn mượt mà xuống danh mục món & Thẻ hội viên
    window.scrollToGuestDishes = function() {
        const sec = document.getElementById('guestDishesSection');
        if (sec) {
            sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    window.scrollToMemberSection = function() {
        const sec = document.getElementById('guestMemberLookupSection');
        if (sec) {
            sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // 11. Cấu hình bảo mật thẻ hội viên: Chỉ hiển thị khi khách hàng đã đăng nhập tài khoản của mình
    function setupGuestMemberSection() {
        const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || 'null');
        const isCustomer = user && String(user.Role || user.role).toUpperCase() === 'CUSTOMER';

        const loginPrompt = document.getElementById('guestMemberLoginPrompt');
        const loggedInHeader = document.getElementById('guestMemberLoggedInHeader');
        const resultBox = document.getElementById('guestMemberLookupResult');

        // Các khu vực thực đơn / giỏ hàng / banner
        const dishesSec = document.getElementById('guestDishesSection');
        const heroSec = document.querySelector('.guest-hero-section');
        const featuresSec = document.querySelector('.guest-features-section');
        const prepaidSec = document.querySelector('.guest-prepaid-section');

        if (isCustomer) {
            // Khi đăng nhập là khách hàng: Ẩn thực đơn chọn món & giỏ hàng (chỉ quản lý/nhân viên gọi món), nhưng GIỮ LẠI HERO BANNER QUẢNG CÁO ĐỂ KHÁCH THẤY NGAY ƯU ĐÃI & CHIẾN DỊCH
            if (dishesSec) dishesSec.style.display = 'none';
            if (heroSec) heroSec.style.display = 'block'; // Luôn cho khách hàng nhìn thấy Banner quảng cáo & ưu đãi nổi bật
            if (featuresSec) featuresSec.style.display = 'none';
            if (prepaidSec) prepaidSec.style.display = 'none';

            if (loginPrompt) loginPrompt.style.display = 'none';
            if (loggedInHeader) loggedInHeader.style.display = 'block';
            if (resultBox) resultBox.style.display = 'block';

            const greetingName = document.getElementById('guestCustomerGreetingName');
            if (greetingName) greetingName.innerText = user.Full_name || user.User_name;
            window.loadMyMemberCard();
        } else {
            // Khi chưa đăng nhập: Hiển thị giới thiệu quán, thực đơn ưu đãi
            if (dishesSec) dishesSec.style.display = 'block';
            if (heroSec) heroSec.style.display = 'block';
            if (featuresSec) featuresSec.style.display = 'block';
            if (prepaidSec) prepaidSec.style.display = 'block';

            if (loginPrompt) loginPrompt.style.display = 'block';
            if (loggedInHeader) loggedInHeader.style.display = 'none';
            if (resultBox) resultBox.style.display = 'none';
        }
    }
    window.setupGuestMemberSection = setupGuestMemberSection;

    // 12. Tự động tải thẻ hội viên của chính khách hàng đã đăng nhập (Bảo mật: không cho nhập SĐT người khác)
    window.loadMyMemberCard = async function() {
        const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || 'null');
        if (!user) {
            setupGuestMemberSection();
            return;
        }

        const resultBox = document.getElementById('guestMemberLookupResult');
        if (resultBox) resultBox.style.display = 'block';

        const nameEl = document.getElementById('guestCardMemberName');
        if (nameEl) nameEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang tải...';

        try {
            const username = user.User_name || user.username || '';
            const userId = user.User_id || user.id || '';
            const res = await fetch(`/api/members/my-card?username=${encodeURIComponent(username)}&userId=${encodeURIComponent(userId)}&t=${Date.now()}`);
            const data = await res.json();

            if (!res.ok || !data.success || !data.member) {
                if (nameEl) nameEl.innerText = user.Full_name || user.User_name;
                const tbody = document.getElementById('guestMemberLogsTableBody');
                if (tbody) {
                    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-warning"><i class="fa-solid fa-circle-exclamation me-1"></i> ${data.error || 'Tài khoản chưa được liên kết với hồ sơ hội viên. Vui lòng liên hệ quầy thu ngân.'}</td></tr>`;
                }
                const ordersTbody = document.getElementById('guestMemberOrdersTableBody');
                if (ordersTbody) {
                    ordersTbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Chưa có lịch sử đơn hàng.</td></tr>`;
                }
                return;
            }

            window._currentGuestMember = data.member;
            renderMemberCardDetails(data.member, data.transactions || [], data.memberLogs || [], data.recentOrders || []);
        } catch (err) {
            console.error('Lỗi loadMyMemberCard:', err);
            if (nameEl) nameEl.innerText = user.Full_name || user.User_name;
        }
    };

    // Hàm mở Modal Mã QR & OTP Cá Nhân cho Khách Hàng
    window.openMyPersonalQrModal = async function() {
        if (window._currentGuestMember) {
            if (typeof window.openCustomerQrWelcomeModal === 'function') {
                window.openCustomerQrWelcomeModal(window._currentGuestMember);
                return;
            }
        }
        const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || 'null');
        if (!user) {
            if (typeof window.openLoginModal === 'function') window.openLoginModal();
            return;
        }
        try {
            const username = user.User_name || user.username || '';
            const userId = user.User_id || user.id || '';
            const res = await fetch(`/api/members/my-card?username=${encodeURIComponent(username)}&userId=${encodeURIComponent(userId)}&t=${Date.now()}`);
            const data = await res.json();
            if (data.success && data.member) {
                window._currentGuestMember = data.member;
                if (typeof window.openCustomerQrWelcomeModal === 'function') {
                    window.openCustomerQrWelcomeModal(data.member);
                }
            } else {
                if (typeof window.openCustomerQrWelcomeModal === 'function') {
                    window.openCustomerQrWelcomeModal(user);
                }
            }
        } catch (e) {
            if (typeof window.openCustomerQrWelcomeModal === 'function') {
                window.openCustomerQrWelcomeModal(user);
            }
        }
    };

    // 13. Hiển thị thông tin Thẻ Mockup, Lịch sử đơn hàng đã đặt & Toàn bộ nhật ký dùng thẻ
    function renderMemberCardDetails(member, transactions, memberLogs, recentOrders) {
        // Điền thông tin vào Thẻ Mockup
        const nameEl = document.getElementById('guestCardMemberName');
        const tierBadgeEl = document.getElementById('guestCardTierBadge');
        const codeEl = document.getElementById('guestCardCode');
        const prepaidEl = document.getElementById('guestCardPrepaidBalance');
        const pointsEl = document.getElementById('guestCardPoints');
        const cardMockup = document.getElementById('guestMemberCardMockup');

        const tierName = member.tierInfo?.name || member.Current_tier || 'Mầm Sen';
        const tierBg = member.tierInfo?.cardBg || 'linear-gradient(135deg, #1b5e20, #4caf50)';

        if (nameEl) nameEl.innerText = member.Full_name || 'Khách Hàng';
        if (tierBadgeEl) tierBadgeEl.innerText = tierName.toUpperCase();
        if (codeEl) codeEl.innerText = member.Card_code || ('HS-' + String(member.Member_id).padStart(6, '0'));
        if (prepaidEl) prepaidEl.innerText = Number(member.Prepaid_balance || 0).toLocaleString('vi-VN') + ' đ';
        if (pointsEl) pointsEl.innerText = Number(member.Reward_points || 0).toLocaleString('vi-VN') + ' điểm';
        if (cardMockup) cardMockup.style.background = tierBg;

        // Điền bảng thông tin chi tiết
        const phoneEl = document.getElementById('guestInfoPhone');
        const joinEl = document.getElementById('guestInfoJoinDate');
        const spentEl = document.getElementById('guestInfoTotalSpent');
        const discEl = document.getElementById('guestInfoDiscount');
        const birthEl = document.getElementById('guestInfoBirthday');

        if (phoneEl) phoneEl.innerText = member.Phone ? member.Phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') : '---';
        if (joinEl) joinEl.innerText = member.Created_at ? new Date(member.Created_at).toLocaleDateString('vi-VN') : '---';
        if (spentEl) spentEl.innerText = Number(member.Total_spent || 0).toLocaleString('vi-VN') + ' đ';
        if (discEl) discEl.innerText = (member.tierInfo?.discountPercent || 0) + '%';
        if (birthEl) birthEl.innerText = member.tierInfo?.birthdayReward || 'Ưu đãi sinh nhật thanh tịnh';

        // 🌟 NẠP & HIỂN THỊ CÁC CHIẾN DỊCH QUẢNG CÁO & MÃ GIẢM GIÁ CHO HỘI VIÊN
        loadGuestPromotions(member);

        // 🌟 1. HIỂN THỊ LỊCH SỬ ĐƠN HÀNG ĐÃ ĐẶT TẠI QUÁN
        const ordersTbody = document.getElementById('guestMemberOrdersTableBody');
        const ordersCountBadge = document.getElementById('guestOrdersCountBadge');
        const orderList = Array.isArray(recentOrders) ? recentOrders : [];

        if (ordersCountBadge) ordersCountBadge.innerText = `${orderList.length} đơn gần nhất`;

        if (ordersTbody) {
            if (orderList.length === 0) {
                ordersTbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center py-4 text-muted">
                            <i class="fa-solid fa-receipt fa-2x mb-2 text-secondary opacity-50"></i>
                            <div>Quý khách chưa có đơn hàng nào được ghi nhận tại quán.</div>
                        </td>
                    </tr>
                `;
            } else {
                ordersTbody.innerHTML = orderList.map(ord => {
                    // Định dạng Ngày Giờ Tháng Năm rõ ràng
                    let dateFormatted = '---';
                    if (ord.Created_at) {
                        try {
                            const d = new Date(ord.Created_at);
                            if (!isNaN(d.getTime())) {
                                const pad = n => String(n).padStart(2, '0');
                                dateFormatted = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
                            } else {
                                dateFormatted = ord.Created_at;
                            }
                        } catch(e) {
                            dateFormatted = ord.Created_at;
                        }
                    }

                    // Danh sách món đã đặt
                    let itemsHtml = '<span class="text-muted small">Chi tiết đơn</span>';
                    if (Array.isArray(ord.items) && ord.items.length > 0) {
                        itemsHtml = ord.items.map(it => {
                            const name = it.Item_name || 'Món chay';
                            const qty = it.Quantity || 1;
                            const note = it.Note ? ` <span class="text-danger small">(${it.Note})</span>` : '';
                            return `<span class="badge bg-light text-dark border me-1 mb-1 p-2"><b>${name}</b> <span class="badge bg-success ms-1">x${qty}</span>${note}</span>`;
                        }).join(' ');
                    }

                    // Badge Trạng thái
                    const statusUpper = String(ord.Status || '').toUpperCase();
                    let statusBadge = '<span class="badge bg-secondary">Khác</span>';
                    if (statusUpper === 'PENDING') statusBadge = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning fw-bold">🕒 Chờ Bếp</span>';
                    else if (statusUpper === 'COOKING') statusBadge = '<span class="badge bg-primary-subtle text-primary border border-primary fw-bold">🍳 Đang Nấu</span>';
                    else if (statusUpper === 'READY') statusBadge = '<span class="badge bg-info-subtle text-info border border-info fw-bold">🍜 Chờ Phục Vụ</span>';
                    else if (statusUpper === 'COMPLETED') statusBadge = '<span class="badge bg-success-subtle text-success border border-success fw-bold">✅ Hoàn Tất</span>';
                    else if (statusUpper === 'CANCELLED') statusBadge = '<span class="badge bg-danger-subtle text-danger border border-danger fw-bold">❌ Đã Hủy</span>';

                    const payUpper = String(ord.Payment_status || '').toUpperCase();
                    const payBadge = payUpper === 'PAID' 
                        ? '<span class="badge bg-success text-white ms-1" style="font-size: 10px;">Đã TT</span>'
                        : '<span class="badge bg-secondary text-white ms-1" style="font-size: 10px;">Chưa TT</span>';

                    const orderCodeStr = ord.Order_code || `#${ord.Order_id}`;
                    const tableStr = ord.Table_number ? `<span class="badge bg-light text-dark border me-1">${ord.Table_number}</span>` : '';

                    return `
                        <tr>
                            <td class="ps-3 text-nowrap">
                                <span class="fw-bold font-monospace text-primary">${orderCodeStr}</span>
                                <div class="mt-1">${tableStr}</div>
                            </td>
                            <td class="text-nowrap font-monospace text-secondary small">
                                <i class="fa-regular fa-clock me-1 text-muted"></i>${dateFormatted}
                            </td>
                            <td>${itemsHtml}</td>
                            <td class="text-end fw-bold text-success font-monospace">
                                ${Number(ord.Final_amount || 0).toLocaleString('vi-VN')} đ
                            </td>
                            <td class="text-center pe-3">
                                <div>${statusBadge}</div>
                                <div class="mt-1">${payBadge}</div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // 🌟 2. TỔNG HỢP TOÀN BỘ NHẬT KÝ DÙNG THẺ (VÍ / ĐIỂM)
        const tbody = document.getElementById('guestMemberLogsTableBody');
        const countBadge = document.getElementById('guestLogsCountBadge');

        const allLogs = [];

        // Thêm từ memberLogs (nạp ví, trừ ví, v.v.)
        memberLogs.forEach(l => {
            allLogs.push({
                time: l.Created_at,
                action: l.Action_type,
                desc: l.Description || l.Action_type,
                amountChange: l.Amount_change || 0,
                pointsChange: l.Points_change || 0,
                prepaidAfter: l.Prepaid_after,
                pointsAfter: l.Points_after,
                type: 'MEMBER_LOG'
            });
        });

        // Thêm từ point transactions nếu chưa có
        transactions.forEach(t => {
            allLogs.push({
                time: t.Created_at,
                action: t.Transaction_type,
                desc: t.Description || (t.Transaction_type === 'EARN' ? 'Tích điểm đơn hàng' : 'Đổi điểm'),
                amountChange: 0,
                pointsChange: t.Points_amount || 0,
                prepaidAfter: null,
                pointsAfter: t.Balance_after,
                type: 'POINT_TX'
            });
        });

        // Sắp xếp thời gian mới nhất lên đầu
        allLogs.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));

        if (countBadge) countBadge.innerText = `${allLogs.length} giao dịch gần nhất`;

        if (tbody) {
            if (allLogs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Chưa có giao dịch dùng thẻ hoặc nạp ví nào được ghi nhận.</td></tr>';
            } else {
                tbody.innerHTML = allLogs.map(item => {
                    const dateStr = item.time ? new Date(item.time).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '---';
                    
                    let actionBadge = '<span class="badge bg-secondary-subtle text-secondary">Giao dịch</span>';
                    let deltaStr = '';
                    let afterStr = '---';

                    if (item.action === 'TOPUP_PREPAID' || item.action === 'PREPAID_TOPUP') {
                        actionBadge = '<span class="badge bg-success-subtle text-success fw-bold">💰 Nạp Ví Trả Trước</span>';
                        deltaStr = `<span class="text-success fw-bold">+${Number(item.amountChange).toLocaleString('vi-VN')} đ</span>`;
                        if (item.prepaidAfter !== null && item.prepaidAfter !== undefined) {
                            afterStr = `Ví: ${Number(item.prepaidAfter).toLocaleString('vi-VN')} đ`;
                        }
                    } else if (item.action === 'PREPAID_PAYMENT' || item.action === 'PAYMENT_PREPAID') {
                        actionBadge = '<span class="badge bg-danger-subtle text-danger fw-bold">💳 Thanh Toán Bằng Ví</span>';
                        deltaStr = `<span class="text-danger fw-bold">-${Number(Math.abs(item.amountChange)).toLocaleString('vi-VN')} đ</span>`;
                        if (item.prepaidAfter !== null && item.prepaidAfter !== undefined) {
                            afterStr = `Ví: ${Number(item.prepaidAfter).toLocaleString('vi-VN')} đ`;
                        }
                    } else if (item.action === 'EARN' || item.action === 'POINT_EARNED') {
                        actionBadge = '<span class="badge bg-primary-subtle text-primary fw-bold">⭐ Tích Điểm Đơn Hàng</span>';
                        deltaStr = `<span class="text-primary fw-bold">+${Number(item.pointsChange).toLocaleString('vi-VN')} đ</span>`;
                        if (item.pointsAfter !== null && item.pointsAfter !== undefined) {
                            afterStr = `${Number(item.pointsAfter).toLocaleString('vi-VN')} điểm`;
                        }
                    } else if (item.action === 'REDEEM' || item.action === 'POINT_USED') {
                        actionBadge = '<span class="badge bg-warning-subtle text-warning-emphasis fw-bold">🎁 Đổi Điểm Giảm Tiền</span>';
                        deltaStr = `<span class="text-warning-emphasis fw-bold">-${Number(Math.abs(item.pointsChange)).toLocaleString('vi-VN')} đ</span>`;
                        if (item.pointsAfter !== null && item.pointsAfter !== undefined) {
                            afterStr = `${Number(item.pointsAfter).toLocaleString('vi-VN')} điểm`;
                        }
                    } else {
                        actionBadge = `<span class="badge bg-light text-dark border">${item.action}</span>`;
                        if (item.amountChange) {
                            deltaStr = `${Number(item.amountChange).toLocaleString('vi-VN')} đ`;
                        } else if (item.pointsChange) {
                            deltaStr = `${Number(item.pointsChange).toLocaleString('vi-VN')} điểm`;
                        }
                    }

                    return `
                        <tr>
                            <td class="ps-3 text-nowrap"><small class="text-muted">${dateStr}</small></td>
                            <td>${actionBadge}</td>
                            <td class="text-center">${deltaStr}</td>
                            <td class="text-center font-monospace small fw-bold">${afterStr}</td>
                            <td class="pe-3 small text-muted">${item.desc}</td>
                        </tr>
                    `;
                }).join('');
            }
        }
    }

    // 14. Quản lý Modal Đổi Mật Khẩu Khách Hàng
    window.openCustomerChangePasswordModal = function() {
        const modal = document.getElementById('customerChangePasswordModal');
        if (!modal) return;
        document.getElementById('customerChangePasswordForm')?.reset();
        const msgEl = document.getElementById('custChangePwdMsg');
        if (msgEl) {
            msgEl.classList.add('d-none');
            msgEl.innerText = '';
        }
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const bsModal = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
            bsModal.show();
        } else {
            modal.style.display = 'block';
            modal.classList.add('show');
        }
    };

    window.closeCustomerChangePasswordModal = function() {
        const modal = document.getElementById('customerChangePasswordModal');
        if (!modal) return;
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) bsModal.hide();
        }
        modal.style.display = 'none';
        modal.classList.remove('show');
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) backdrop.remove();
        document.body.classList.remove('modal-open');
    };

    window.toggleCustPwdVisibility = function(inputId, btnEl) {
        const input = document.getElementById(inputId);
        if (!input) return;
        const icon = btnEl ? btnEl.querySelector('i') : null;
        if (input.type === 'password') {
            input.type = 'text';
            if (icon) {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
        } else {
            input.type = 'password';
            if (icon) {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        }
    };

    window.handleCustomerPasswordChange = async function(event) {
        if (event) event.preventDefault();
        const currentPassword = document.getElementById('custCurrentPwd')?.value || '';
        const newPassword = document.getElementById('custNewPwd')?.value || '';
        const confirmPassword = document.getElementById('custConfirmPwd')?.value || '';
        const msgEl = document.getElementById('custChangePwdMsg');

        if (!currentPassword || !newPassword) {
            if (msgEl) {
                msgEl.innerText = 'Vui lòng điền đầy đủ các thông tin!';
                msgEl.classList.remove('d-none');
            }
            return;
        }

        if (newPassword.length < 3) {
            if (msgEl) {
                msgEl.innerText = 'Mật khẩu mới phải có ít nhất 3 ký tự!';
                msgEl.classList.remove('d-none');
            }
            return;
        }

        if (newPassword !== confirmPassword) {
            if (msgEl) {
                msgEl.innerText = 'Xác nhận mật khẩu mới không trùng khớp!';
                msgEl.classList.remove('d-none');
            }
            return;
        }

        const user = window.currentUser || JSON.parse(localStorage.getItem('restaurant_user') || '{}');
        const username = user.User_name || user.username || '';
        const userId = user.User_id || user.id || '';

        try {
            const btn = document.getElementById('btnSubmitCustPwd');
            if (btn) btn.disabled = true;

            const res = await fetch('/api/members/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword, username, userId })
            });

            const data = await res.json();
            if (btn) btn.disabled = false;

            if (res.ok && data.success) {
                const prefillAccount = user.Phone || user.User_name || username || '';

                // Đóng modal đổi mật khẩu
                window.closeCustomerChangePasswordModal();

                // Đăng xuất tài khoản khách hàng để yêu cầu đăng nhập lại
                localStorage.removeItem('restaurant_user');
                window.currentUser = null;

                if (typeof checkAuthStatus === 'function') {
                    checkAuthStatus();
                }

                if (typeof navigateTo === 'function') {
                    navigateTo('/');
                }

                if (window.toast) {
                    window.toast.success('Đổi mật khẩu thành công! Vui lòng đăng nhập lại bằng mật khẩu mới.');
                } else {
                    alert('Đổi mật khẩu thành công! Vui lòng đăng nhập lại bằng mật khẩu mới.');
                }

                // Tự động mở lại modal đăng nhập và điền sẵn số điện thoại / tài khoản
                setTimeout(() => {
                    if (typeof openLoginModal === 'function') {
                        openLoginModal(prefillAccount);
                    }
                }, 400);
            } else {
                if (msgEl) {
                    msgEl.innerText = data.error || 'Có lỗi xảy ra khi đổi mật khẩu!';
                    msgEl.classList.remove('d-none');
                }
            }
        } catch (err) {
            console.error('Lỗi đổi mật khẩu:', err);
            if (msgEl) {
                msgEl.innerText = 'Lỗi kết nối máy chủ. Vui lòng thử lại!';
                msgEl.classList.remove('d-none');
            }
        }
    };

    // 14. Nạp & Hiển thị Chiến Dịch Quảng Cáo & Voucher Riêng Của Khách
    async function loadGuestPromotions(member) {
        const row = document.getElementById('guestPromotionsRow');
        const badge = document.getElementById('guestVouchersCountBadge');
        if (!row) return;

        try {
            const memberId = member ? (member.Member_id || member.Id) : null;
            let myVouchers = [];

            if (memberId) {
                try {
                    const vRes = await fetch(`/api/marketing/member-vouchers/${memberId}?t=` + Date.now());
                    const vData = await vRes.json();
                    if (vRes.ok && vData.success) {
                        myVouchers = vData.vouchers || [];
                    }
                } catch(e) {}
            }

            // Tải danh sách chiến dịch chung đang chạy
            const cRes = await fetch('/api/marketing/campaigns?t=' + Date.now());
            const cData = await cRes.json();
            const campaigns = ((cData.campaigns || []).filter(c => (c.Is_active == 1 && c.Show_banner == 1))) || [];

            const totalCount = myVouchers.length + campaigns.length;
            if (badge) badge.innerText = `${totalCount} Ưu Đãi Đang Chạy`;

            if (totalCount === 0) {
                row.innerHTML = `
                    <div class="col-12 text-center py-4 text-muted">
                        <i class="fa-solid fa-gift fa-2x mb-2 text-warning opacity-75"></i>
                        <div>Hiện chưa có voucher hoặc chiến dịch mới. Nhà hàng sẽ sớm gửi các ưu đãi hấp dẫn tới bạn!</div>
                    </div>
                `;
                return;
            }

            let html = '';
            const now = new Date();

            // 1. Voucher cá nhân hóa được quản lý gửi riêng
            myVouchers.forEach(v => {
                const discText = v.Discount_type === 'PERCENT' ? `Giảm ${v.Discount_value}%` : `Giảm ${Number(v.Discount_value || 0).toLocaleString('vi-VN')}đ`;
                
                let isExpired = false;
                let expiryFormatted = 'Không giới hạn';
                let remainingText = '';

                if (v.Expiry_date) {
                    try {
                        const ed = new Date(v.Expiry_date);
                        if (!isNaN(ed.getTime())) {
                            expiryFormatted = `${String(ed.getHours()).padStart(2,'0')}:${String(ed.getMinutes()).padStart(2,'0')} ${String(ed.getDate()).padStart(2,'0')}/${String(ed.getMonth()+1).padStart(2,'0')}/${cdFormattedYear(ed)}`;
                            const diffMs = ed.getTime() - now.getTime();
                            if (diffMs <= 0) {
                                isExpired = true;
                            } else {
                                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                if (diffDays > 0) remainingText = `(Còn ${diffDays} ngày)`;
                                else remainingText = `(Còn ${diffHours} giờ)`;
                            }
                        }
                    } catch(e) {}
                }

                const isCancelled = v.Status === 'CANCELLED';
                const isUsed = v.Status === 'USED';
                const isInactive = isExpired || isCancelled || isUsed || v.Status === 'EXPIRED';

                let statusBadge = '<span class="badge bg-warning text-dark fw-bold rounded-pill px-2 py-1"><i class="fa-solid fa-crown me-1"></i>VOUCHER RIÊNG</span>';
                if (isUsed) {
                    statusBadge = '<span class="badge bg-primary text-white fw-bold rounded-pill px-2 py-1"><i class="fa-solid fa-check me-1"></i>ĐÃ SỬ DỤNG</span>';
                } else if (isCancelled) {
                    statusBadge = '<span class="badge bg-danger text-white fw-bold rounded-pill px-2 py-1"><i class="fa-solid fa-ban me-1"></i>ĐÃ BỊ HỦY</span>';
                } else if (isExpired || v.Status === 'EXPIRED') {
                    statusBadge = '<span class="badge bg-secondary text-white fw-bold rounded-pill px-2 py-1"><i class="fa-solid fa-clock-rotate-left me-1"></i>ĐÃ HẾT HẠN</span>';
                }

                const cardStyle = isInactive
                    ? 'border-color: #cbd5e1 !important; background: #f8fafc; opacity: 0.65;'
                    : 'border-color: #f59e0b !important; background: linear-gradient(135deg, #fffbeb 0%, #ffffff 100%);';

                html += `
                    <div class="col-md-6 col-lg-4">
                        <div class="card h-100 border-2 rounded-4 shadow-sm overflow-hidden" style="${cardStyle}">
                            <div class="card-body p-3 d-flex flex-column justify-content-between">
                                <div>
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        ${statusBadge}
                                        <span class="${isInactive ? 'text-muted' : 'text-danger'} fw-bold fs-6">${discText}</span>
                                    </div>
                                    <h6 class="fw-bold ${isInactive ? 'text-secondary' : 'text-dark'} mb-1">${v.Title || 'Ưu Đãi Hội Viên'}</h6>
                                    <small class="text-muted d-block mb-1">Đơn tối thiểu: ${v.Min_order_amount ? Number(v.Min_order_amount).toLocaleString('vi-VN') + 'đ' : 'Không giới hạn'}</small>
                                    
                                    <!-- HIỂN THỊ THỜI HẠN SỬ DỤNG TRÊN MÀN HÌNH KHÁCH -->
                                    <div class="mt-1 small fw-bold ${isExpired || v.Status === 'EXPIRED' ? 'text-danger' : (isInactive ? 'text-muted' : 'text-success')}">
                                        <i class="fa-regular fa-clock me-1"></i>HSD: ${expiryFormatted} ${remainingText}
                                    </div>
                                </div>
                                <div class="mt-2 pt-2 border-top d-flex justify-content-between align-items-center">
                                    <span class="badge ${isInactive ? 'bg-secondary text-white' : 'bg-dark text-warning'} font-monospace fs-6 px-3 py-2 rounded-3">${v.Voucher_code}</span>
                                    ${isInactive ? `
                                        <button class="btn btn-sm btn-secondary fw-bold rounded-pill px-2" disabled title="Mã không khả dụng">
                                            <i class="fa-solid fa-lock me-1"></i>${isUsed ? 'Đã Dùng' : (isCancelled ? 'Đã Hủy' : 'Hết Hạn')}
                                        </button>
                                    ` : `
                                        <button class="btn btn-sm btn-outline-warning text-dark fw-bold rounded-pill px-2" onclick="navigator.clipboard.writeText('${v.Voucher_code}'); if(window.toast) window.toast.success('Đã chép mã: ${v.Voucher_code}'); else alert('Đã chép mã: ${v.Voucher_code}');">
                                            <i class="fa-regular fa-copy me-1"></i>Chép Mã
                                        </button>
                                    `}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            function cdFormattedYear(d) { return d.getFullYear(); }

            // 2. Chiến dịch marketing đang chạy
            campaigns.forEach(c => {
                const discText = c.Discount_type === 'PERCENT' ? `-${c.Discount_value}%` : `-${Number(c.Discount_value || 0).toLocaleString('vi-VN')}đ`;
                const img = c.Image_url || '/uploads/banner_1790164138400.jpg';
                const badgeText = c.Badge_text || 'CHIẾN DỊCH';
                const priceText = c.Price_text || discText;
                const name = c.Campaign_name || c.Name || 'Chiến Dịch Ưu Đãi';

                html += `
                    <div class="col-md-6 col-lg-4">
                        <div class="card h-100 border-0 rounded-4 shadow-sm overflow-hidden bg-white">
                            <div class="position-relative" style="height: 120px; background-image: url('${img}'); background-size: cover; background-position: center;">
                                <span class="position-absolute top-0 start-0 m-2 badge bg-success text-white fw-bold rounded-pill px-2 py-1 shadow-sm">
                                    ${badgeText}
                                </span>
                                <span class="position-absolute bottom-0 end-0 m-2 badge bg-warning text-dark fw-bold rounded-pill px-3 py-1 shadow-sm fs-6">
                                    ${priceText}
                                </span>
                            </div>
                            <div class="card-body p-3 d-flex flex-column justify-content-between">
                                <div>
                                    <h6 class="fw-bold text-dark mb-1">${name}</h6>
                                    <p class="small text-muted mb-2 text-truncate" style="max-height: 38px;">${c.Description || 'Ưu đãi ẩm thực chay dành cho quý khách hàng.'}</p>
                                </div>
                                <div class="mt-2 pt-2 border-top d-flex justify-content-between align-items-center">
                                    <span class="badge bg-light text-primary border font-monospace fs-6 px-2 py-1">${c.Code}</span>
                                    <button class="btn btn-sm btn-outline-success fw-bold rounded-pill px-2" onclick="navigator.clipboard.writeText('${c.Code}'); if(window.toast) window.toast.success('Đã chép mã: ${c.Code}'); else alert('Đã chép mã: ${c.Code}');">
                                        <i class="fa-regular fa-copy me-1"></i>Chép Mã
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            row.innerHTML = html;
        } catch (e) {
            console.warn('Lỗi loadGuestPromotions:', e);
            row.innerHTML = `<div class="col-12 text-center text-muted py-3">Không thể nạp chiến dịch quảng cáo.</div>`;
        }
    }
    window.loadGuestPromotions = loadGuestPromotions;
    if (typeof io === 'function') {
        const sock = window.socket || io(window.location.origin);
        sock.on('banners_updated', () => {
            loadGuestBanners().then(() => setupGuestCarousel());
        });
        sock.on('vouchers_updated', () => {
            if (typeof loadGuestPromotions === 'function') {
                loadGuestPromotions(window._currentGuestMember);
            }
        });
        sock.on('campaigns_updated', () => {
            if (typeof loadGuestPromotions === 'function') {
                loadGuestPromotions(window._currentGuestMember);
            }
        });
        sock.on('system_config_updated', (newCfg) => {
            if (newCfg && (newCfg.home_slide_interval || newCfg.home_slide_effect || newCfg.home_slide_speed)) {
                setupGuestCarousel();
            }
            if (newCfg && (newCfg.restaurant_lat || newCfg.restaurant_lng || newCfg.restaurant_name || newCfg.restaurant_address)) {
                if (typeof loadGuestRestaurantInfo === 'function') loadGuestRestaurantInfo();
            }
        });
    }

})(window);

