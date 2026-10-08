/**
 * ready-tv-screensaver.js
 * Quản lý Banner Món Mới / Combo Khuyến Mại & Chế Độ Trình Chiếu Smart TV Toàn Màn Hình
 * Cho Màn Hình Nhận Món (Bếp Xong)
 */

(function(window) {
    const ReadyTV = {
        banners: [],
        config: {
            tv_banner_enabled: '1',
            tv_banner_position: 'TOP',
            tv_banner_effect: 'slide',
            tv_banner_speed: '800',
            tv_banner_interval: '5',
            tv_bg_type: 'COLOR',
            tv_bg_value: '#f4fbf5',
            tv_screensaver_enabled: '1',
            tv_screensaver_idle_seconds: '30',
            tv_ambient_music_enabled: '0',
            tv_ambient_music_volume: '35',
            tv_ambient_music_url: ''
        },
        currentSlideIndex: 0,
        slideTimer: null,
        idleTimer: null,
        idleCountdown: 30,
        isScreensaverActive: false,
        isMusicPlaying: false,
        ambientAudioEl: null,
        webAudioZenTimer: null,
        webAudioZenCtx: null,
        currentOrderCount: 0,
        editingBannerId: null,

        // 1. Khởi tạo toàn bộ hệ thống
        async init() {
            await this.loadConfig();
            await this.loadBanners();
            this.applyBackground();
            this.renderBannerContainer();
            this.startSlideShow();
            this.setupSocketListeners();
            this.setupMusic();
            this.updateToolbarUI();
        },

        // 2. Nạp cấu hình từ Server (SYSTEM_CONFIG)
        async loadConfig() {
            try {
                const res = await fetch('/api/system-config?t=' + Date.now());
                if (res.ok) {
                    const data = await res.json();
                    const cfg = (data && data.config) ? data.config : data;
                    Object.keys(this.config).forEach(key => {
                        if (cfg && cfg[key] !== undefined) {
                            this.config[key] = String(cfg[key]);
                        }
                    });
                }
            } catch (err) {
                console.warn('Lỗi đọc cấu hình TV Ready:', err);
            }
        },

        // 3. Nạp danh sách banner khuyến mại từ CSDL
        async loadBanners() {
            try {
                const res = await fetch('/api/promotion-banners?activeOnly=1&t=' + Date.now());
                if (res.ok) {
                    const data = await res.json();
                    this.banners = Array.isArray(data.banners) ? data.banners : [];
                }
            } catch (err) {
                console.warn('Lỗi nạp banner khuyến mại:', err);
                this.banners = [];
            }
        },

        // 4. Áp dụng hình nền hoặc màu nền cho trang nhận món
        applyBackground() {
            const container = document.getElementById('readyOrdersContainer') || document.querySelector('.ready-orders-wrapper') || document.body;
            if (!container) return;

            if (this.config.tv_bg_type === 'IMAGE' && this.config.tv_bg_value) {
                container.style.backgroundImage = `url('${this.config.tv_bg_value}')`;
                container.style.backgroundSize = 'cover';
                container.style.backgroundPosition = 'center';
                container.style.backgroundAttachment = 'fixed';
                container.style.backgroundColor = 'transparent';
            } else {
                container.style.backgroundImage = 'none';
                container.style.backgroundColor = this.config.tv_bg_value || '#f4fbf5';
            }
        },

        // 5. Render Banner Container theo vị trí đã cấu hình (TOP, BOTTOM, LEFT, RIGHT)
        renderBannerContainer() {
            const isEnabled = this.config.tv_banner_enabled === '1' && this.banners.length > 0;
            const topEl = document.getElementById('readyBannerTop');
            const bottomEl = document.getElementById('readyBannerBottom');
            const leftEl = document.getElementById('readyBannerLeft');
            const rightEl = document.getElementById('readyBannerRight');

            // Ẩn tất cả các khung trước
            [topEl, bottomEl, leftEl, rightEl].forEach(el => {
                if (el) {
                    el.style.display = 'none';
                    el.innerHTML = '';
                }
            });

            if (!isEnabled) return;

            let targetEl = null;
            const pos = (this.config.tv_banner_position || 'TOP').toUpperCase();

            if (pos === 'BOTTOM') targetEl = bottomEl;
            else if (pos === 'LEFT') targetEl = leftEl;
            else if (pos === 'RIGHT') targetEl = rightEl;
            else targetEl = topEl;

            if (!targetEl) return;
            targetEl.style.display = 'block';

            const isVertical = (pos === 'LEFT' || pos === 'RIGHT');
            const transitionEffect = this.config.tv_banner_effect || 'slide';
            const speed = parseInt(this.config.tv_banner_speed, 10) || 800;

            targetEl.innerHTML = `
                <div class="ready-banner-wrapper ${isVertical ? 'vertical-layout' : 'horizontal-layout'} effect-${transitionEffect}" style="--transition-speed: ${speed}ms;">
                    <div class="ready-banner-slides" id="readyBannerSlidesTrack">
                        ${this.banners.map((b, idx) => this.generateBannerSlideHtml(b, idx, isVertical)).join('')}
                    </div>
                    <!-- Thanh điều khiển và Dots -->
                    <div class="ready-banner-controls">
                        <button type="button" class="btn-banner-prev" onclick="window.readyTvScreensaver.prevSlide()"><i class="fa-solid fa-chevron-left"></i></button>
                        <div class="ready-banner-dots">
                            ${this.banners.map((_, idx) => `<span class="banner-dot ${idx === 0 ? 'active' : ''}" onclick="window.readyTvScreensaver.goToSlide(${idx})"></span>`).join('')}
                        </div>
                        <button type="button" class="btn-banner-next" onclick="window.readyTvScreensaver.nextSlide()"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                </div>
            `;

            this.updateSlideDisplay();
        },

        // HTML cho từng slide
        generateBannerSlideHtml(b, idx, isVertical) {
            const badge = b.Badge_text ? `<span class="promo-badge">${b.Badge_text}</span>` : '';
            const price = b.Price_text ? `<div class="promo-price">${b.Price_text}</div>` : '';
            const subtitle = b.Subtitle ? `<p class="promo-subtitle">${b.Subtitle}</p>` : '';
            const img = b.Image_url || '/uploads/dish-sample.jpg';

            return `
                <div class="ready-banner-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
                    <div class="promo-card ${isVertical ? 'promo-card-vertical' : 'promo-card-horizontal'}">
                        <div class="promo-image-box">
                            <img src="${img}" alt="${b.Title}" onerror="this.src='/uploads/dish-sample.jpg'">
                            ${badge}
                        </div>
                        <div class="promo-info-box">
                            <h3 class="promo-title">${b.Title}</h3>
                            ${subtitle}
                            ${price}
                        </div>
                    </div>
                </div>
            `;
        },

        // 6. Chuyển đổi Slide tự động theo chu kỳ
        startSlideShow() {
            if (this.slideTimer) clearInterval(this.slideTimer);
            if (this.banners.length <= 1) return;

            const intervalSec = Math.max(2, parseInt(this.config.tv_banner_interval, 10) || 5);
            this.slideTimer = setInterval(() => {
                this.nextSlide();
            }, intervalSec * 1000);
        },

        nextSlide() {
            if (this.banners.length === 0) return;
            this.currentSlideIndex = (this.currentSlideIndex + 1) % this.banners.length;
            this.updateSlideDisplay();
        },

        prevSlide() {
            if (this.banners.length === 0) return;
            this.currentSlideIndex = (this.currentSlideIndex - 1 + this.banners.length) % this.banners.length;
            this.updateSlideDisplay();
        },

        goToSlide(idx) {
            if (idx >= 0 && idx < this.banners.length) {
                this.currentSlideIndex = idx;
                this.updateSlideDisplay();
                this.startSlideShow(); // reset chu kỳ
            }
        },

        updateSlideDisplay() {
            const slides = document.querySelectorAll('.ready-banner-slide');
            const dots = document.querySelectorAll('.banner-dot');

            slides.forEach((slide, idx) => {
                if (idx === this.currentSlideIndex) {
                    slide.classList.add('active');
                } else {
                    slide.classList.remove('active');
                }
            });

            dots.forEach((dot, idx) => {
                if (idx === this.currentSlideIndex) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });

            // Nếu đang trong chế độ Screensaver toàn màn hình, cũng update slide toàn màn hình
            if (this.isScreensaverActive) {
                this.updateScreensaverSlide();
            }
        },

        // 7. Quản lý trạng thái Đơn hàng & Bộ đếm Nhàn rỗi (Screensaver Timer)
        setOrderCount(count) {
            this.currentOrderCount = Number(count || 0);

            // NẾU CÓ ĐƠN (> 0): LẬP TỨC THOÁT TOÀN MÀN HÌNH NẾU ĐANG BẬT & HỦY TIMER
            if (this.currentOrderCount > 0) {
                this.stopIdleTimer();
                if (this.isScreensaverActive) {
                    this.exitScreensaver();
                    if (window.toast) {
                        window.toast.info('🔔 Đã có món mới sẵn sàng! Ưu tiên hiển thị danh sách đơn.');
                    }
                }
            } else {
                // NẾU HẾT ĐƠN (== 0): BẮT ĐẦU ĐẾM NGƯỢC ĐỂ VÀO TOÀN MÀN HÌNH
                if (this.config.tv_screensaver_enabled === '1' && !this.isScreensaverActive) {
                    this.startIdleTimer();
                }
            }
        },

        startIdleTimer() {
            this.stopIdleTimer();
            const idleSec = Math.max(5, parseInt(this.config.tv_screensaver_idle_seconds, 10) || 30);
            this.idleCountdown = idleSec;

            this.idleTimer = setInterval(() => {
                this.idleCountdown--;
                if (this.idleCountdown <= 0) {
                    this.stopIdleTimer();
                    if (this.currentOrderCount === 0 && this.config.tv_screensaver_enabled === '1') {
                        this.enterScreensaver();
                    }
                }
            }, 1000);
        },

        stopIdleTimer() {
            if (this.idleTimer) {
                clearInterval(this.idleTimer);
                this.idleTimer = null;
            }
        },

        // 8. Chế độ Toàn Màn Hình Screensaver (Smart TV Showcase)
        ensureDefaultBanners() {
            if (!this.banners || this.banners.length === 0) {
                this.banners = [
                    {
                        Title: 'Lẩu Nấm Thần Tiên Hoa Sen',
                        Subtitle: 'Hương vị thanh tịnh - Nước dùng đậm đà thảo mộc',
                        Badge_text: 'MÓN ĐẶC SẮC',
                        Price_text: 'Chỉ từ 199.000đ',
                        Image_url: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=1000'
                    },
                    {
                        Title: 'Combo Cơm Chay An Lạc',
                        Subtitle: 'Đầy đủ dinh dưỡng - Tươi ngon trọn vẹn mỗi ngày',
                        Badge_text: 'COMBO HOT',
                        Price_text: 'Chỉ 79.000đ',
                        Image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1000'
                    },
                    {
                        Title: 'Đậu Hũ Non Hấp Hồng Kông',
                        Subtitle: 'Mềm mịn béo ngậy - Sốt xì dầu nấm đông cô',
                        Badge_text: 'BÁN CHẠY',
                        Price_text: 'Chỉ 55.000đ',
                        Image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1000'
                    }
                ];
            }
        },

        // 8.1 Kích hoạt trình chiếu toàn màn hình ngay lập tức (không cần chờ 10s/30s hết đơn)
        startFullscreenShowcase() {
            this.stopIdleTimer();
            this.ensureDefaultBanners();
            this.enterScreensaver();

            // Nếu chưa bật Fullscreen trình duyệt thì tự động phóng to
            if (!document.fullscreenElement && typeof this.toggleBrowserFullscreen === 'function') {
                this.toggleBrowserFullscreen();
            }
        },

        enterScreensaver() {
            const overlay = document.getElementById('readyFullscreenScreensaver');
            if (!overlay) return;
            this.ensureDefaultBanners();

            this.isScreensaverActive = true;
            overlay.style.display = 'flex';
            document.body.classList.add('ready-screensaver-open');

            this.updateScreensaverSlide();
            this.startSlideShow();

            // Nếu cấu hình có bật nhạc, tự động phát nhạc du dương
            if (this.config.tv_ambient_music_enabled === '1') {
                this.playMusic();
            }
        },

        exitScreensaver() {
            const overlay = document.getElementById('readyFullscreenScreensaver');
            if (overlay) {
                overlay.style.display = 'none';
            }
            this.isScreensaverActive = false;
            document.body.classList.remove('ready-screensaver-open');
        },

        updateScreensaverSlide() {
            const container = document.getElementById('screensaverSlideContent');
            if (!container || this.banners.length === 0) return;

            const b = this.banners[this.currentSlideIndex] || this.banners[0];
            const badge = b.Badge_text ? `<span class="screensaver-badge">${b.Badge_text}</span>` : '';
            const price = b.Price_text ? `<div class="screensaver-price">${b.Price_text}</div>` : '';
            const img = b.Image_url || '/uploads/dish-sample.jpg';
            const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

            container.innerHTML = `
                <div class="screensaver-showcase-card animate-enter">
                    <div class="screensaver-img-wrapper">
                        <img src="${img}" alt="${b.Title}" class="screensaver-food-img">
                        ${badge}
                    </div>
                    <div class="screensaver-info-wrapper">
                        <div class="screensaver-brand">
                            <i class="fa-solid fa-leaf text-success me-2"></i> NHÀ HÀNG CHAY HOA SEN
                            <span class="screensaver-clock ms-3"><i class="fa-regular fa-clock me-1"></i>${nowTime}</span>
                        </div>
                        <h1 class="screensaver-title">${b.Title}</h1>
                        <p class="screensaver-subtitle">${b.Subtitle || 'Thanh tịnh an lạc - Tươi ngon mỗi ngày'}</p>
                        ${price}
                        <div class="screensaver-hint">
                            <i class="fa-solid fa-bell-concierge me-1 text-warning"></i> Khi bếp hoàn tất món mới, màn hình sẽ tự động hiển thị số đơn phục vụ!
                        </div>
                    </div>
                </div>
            `;
        },

        // 9. Quản lý Âm Thanh Du Dương / Nhạc Nền Smart TV
        setupMusic() {
            if (!this.ambientAudioEl) {
                this.ambientAudioEl = new Audio();
                this.ambientAudioEl.loop = true;
            }
            const vol = (parseInt(this.config.tv_ambient_music_volume, 10) || 35) / 100;
            this.ambientAudioEl.volume = Math.max(0, Math.min(1, vol));

            if (this.config.tv_ambient_music_url) {
                this.ambientAudioEl.src = this.config.tv_ambient_music_url;
            }
        },

        toggleMusic() {
            if (this.isMusicPlaying) {
                this.pauseMusic();
            } else {
                this.playMusic();
            }
        },

        playMusic() {
            this.setupMusic();
            const vol = (parseInt(this.config.tv_ambient_music_volume, 10) || 35) / 100;

            if (this.config.tv_ambient_music_url) {
                this.ambientAudioEl.play().then(() => {
                    this.isMusicPlaying = true;
                    this.updateToolbarUI();
                }).catch(err => {
                    console.warn('Không thể tự động phát file nhạc:', err);
                    this.playZenSynthesizer(vol);
                });
            } else {
                // Dùng bộ tổng hợp âm thanh thiền du dương bằng Web Audio API
                this.playZenSynthesizer(vol);
            }
        },

        pauseMusic() {
            if (this.ambientAudioEl) {
                this.ambientAudioEl.pause();
            }
            this.stopZenSynthesizer();
            this.isMusicPlaying = false;
            this.updateToolbarUI();
        },

        // Bộ Synthesizer phát âm thanh chuông xoay Tây Tạng & Đàn tranh thiền du dương
        playZenSynthesizer(volumeFactor) {
            this.stopZenSynthesizer();
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                if (!this.webAudioZenCtx) this.webAudioZenCtx = new AudioContext();
                if (this.webAudioZenCtx.state === 'suspended') this.webAudioZenCtx.resume();

                const pentatonicScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33]; // Âm giai ngũ cung C D E G A C D
                let noteIdx = 0;

                const playChime = () => {
                    if (!this.isMusicPlaying || !this.webAudioZenCtx) return;
                    const ctx = this.webAudioZenCtx;
                    const now = ctx.currentTime;
                    const freq = pentatonicScale[noteIdx % pentatonicScale.length];
                    noteIdx++;

                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now);

                    // Harmonics dịu êm
                    const masterGain = ctx.createGain();
                    masterGain.gain.setValueAtTime(volumeFactor * 0.25, now);
                    masterGain.connect(ctx.destination);

                    gain.gain.setValueAtTime(0.001, now);
                    gain.gain.exponentialRampToValueAtTime(0.4, now + 0.3);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);

                    osc.connect(gain);
                    gain.connect(masterGain);

                    osc.start(now);
                    osc.stop(now + 3.3);
                };

                this.isMusicPlaying = true;
                this.updateToolbarUI();
                playChime();
                this.webAudioZenTimer = setInterval(playChime, 3800);
            } catch (e) {
                console.warn('Lỗi Zen Synthesizer:', e);
            }
        },

        stopZenSynthesizer() {
            if (this.webAudioZenTimer) {
                clearInterval(this.webAudioZenTimer);
                this.webAudioZenTimer = null;
            }
        },

        // 10. Chuyển đổi Chế độ Toàn Màn Hình Trình Duyệt (Fullscreen API)
        toggleBrowserFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    if (window.toast) window.toast.warning('Trình duyệt chặn mở toàn màn hình tự động');
                });
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        },

        // Cập nhật nút bấm trên thanh công cụ
        updateToolbarUI() {
            const musicBtn = document.getElementById('tvAmbientMusicBtn');
            if (musicBtn) {
                musicBtn.className = `btn btn-sm rounded-pill px-3 fw-bold ${this.isMusicPlaying ? 'btn-success' : 'btn-outline-secondary'}`;
                musicBtn.innerHTML = `<i class="fa-solid ${this.isMusicPlaying ? 'fa-music fa-bounce' : 'fa-volume-xmark'} me-1"></i> Nhạc Nền: ${this.isMusicPlaying ? 'Bật' : 'Tắt'}`;
            }
        },

        // 11. Socket Realtime: Đón nhận sự kiện cập nhật cấu hình và banner
        setupSocketListeners() {
            if (!window.socket) return;

            window.socket.off('banners_updated');
            window.socket.on('banners_updated', async () => {
                await this.loadBanners();
                this.renderBannerContainer();
                if (this.isScreensaverActive) this.updateScreensaverSlide();
            });

            window.socket.off('system_config_updated');
            window.socket.on('system_config_updated', async (newCfg) => {
                if (newCfg) {
                    Object.keys(this.config).forEach(k => {
                        if (newCfg[k] !== undefined) this.config[k] = String(newCfg[k]);
                    });
                } else {
                    await this.loadConfig();
                }
                this.applyBackground();
                this.renderBannerContainer();
                this.setupMusic();
            });
        },

        // ==========================================
        // 12. QUẢN LÝ MODAL CÀI ĐẶT TV & KHO ẢNH
        // ==========================================
        openConfigModal() {
            const modal = document.getElementById('readyScreenConfigModal');
            if (!modal) return;
            modal.style.display = 'flex';
            this.switchConfigTab('tab-tv-banners');
            this.populateConfigForm();
            this.renderBannersManageTable();
        },

        closeConfigModal() {
            const modal = document.getElementById('readyScreenConfigModal');
            if (modal) modal.style.display = 'none';
        },

        switchConfigTab(tabId) {
            document.querySelectorAll('#tvConfigTabs .nav-link').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tv-config-tab-pane').forEach(p => p.classList.add('d-none'));

            const btn = document.getElementById(`btn-${tabId}`);
            const pane = document.getElementById(tabId);
            if (btn) btn.classList.add('active');
            if (pane) pane.classList.remove('d-none');
        },

        populateConfigForm() {
            // Tab 2: Vị trí & Hiệu ứng
            const posEl = document.getElementById('cfgTvBannerPos');
            const effEl = document.getElementById('cfgTvBannerEffect');
            const spdEl = document.getElementById('cfgTvBannerSpeed');
            const intEl = document.getElementById('cfgTvBannerInterval');
            const enBannerEl = document.getElementById('cfgTvBannerEnabled');

            if (posEl) posEl.value = this.config.tv_banner_position || 'TOP';
            if (effEl) effEl.value = this.config.tv_banner_effect || 'slide';
            if (spdEl) spdEl.value = this.config.tv_banner_speed || '800';
            if (intEl) intEl.value = this.config.tv_banner_interval || '5';
            if (enBannerEl) enBannerEl.checked = this.config.tv_banner_enabled === '1';

            // Tab 3: Screensaver
            const enSaverEl = document.getElementById('cfgTvScreensaverEnabled');
            const idleSecEl = document.getElementById('cfgTvIdleSeconds');
            if (enSaverEl) enSaverEl.checked = this.config.tv_screensaver_enabled === '1';
            if (idleSecEl) idleSecEl.value = this.config.tv_screensaver_idle_seconds || '30';

            // Tab 4: Âm thanh & Hình nền
            const enMusicEl = document.getElementById('cfgTvMusicEnabled');
            const volEl = document.getElementById('cfgTvMusicVolume');
            const volValEl = document.getElementById('cfgTvMusicVolumeVal');
            const bgTypeEl = document.getElementById('cfgTvBgType');
            const bgValEl = document.getElementById('cfgTvBgValue');

            if (enMusicEl) enMusicEl.checked = this.config.tv_ambient_music_enabled === '1';
            if (volEl) {
                volEl.value = this.config.tv_ambient_music_volume || '35';
                if (volValEl) volValEl.innerText = volEl.value + '%';
            }
            if (bgTypeEl) bgTypeEl.value = this.config.tv_bg_type || 'COLOR';
            if (bgValEl) bgValEl.value = this.config.tv_bg_value || '#f4fbf5';
        },

        // Lưu cấu hình TV vào CSDL
        async saveTvSettings(e) {
            if (e) e.preventDefault();

            const pos = document.getElementById('cfgTvBannerPos')?.value || 'TOP';
            const eff = document.getElementById('cfgTvBannerEffect')?.value || 'slide';
            const spd = document.getElementById('cfgTvBannerSpeed')?.value || '800';
            const intv = document.getElementById('cfgTvBannerInterval')?.value || '5';
            const enBanner = document.getElementById('cfgTvBannerEnabled')?.checked ? '1' : '0';

            const enSaver = document.getElementById('cfgTvScreensaverEnabled')?.checked ? '1' : '0';
            const idleSec = document.getElementById('cfgTvIdleSeconds')?.value || '30';

            const enMusic = document.getElementById('cfgTvMusicEnabled')?.checked ? '1' : '0';
            const vol = document.getElementById('cfgTvMusicVolume')?.value || '35';
            const bgType = document.getElementById('cfgTvBgType')?.value || 'COLOR';
            const bgVal = document.getElementById('cfgTvBgValue')?.value || '#f4fbf5';

            const payload = {
                tv_banner_enabled: enBanner,
                tv_banner_position: pos,
                tv_banner_effect: eff,
                tv_banner_speed: spd,
                tv_banner_interval: intv,
                tv_screensaver_enabled: enSaver,
                tv_screensaver_idle_seconds: idleSec,
                tv_ambient_music_enabled: enMusic,
                tv_ambient_music_volume: vol,
                tv_bg_type: bgType,
                tv_bg_value: bgVal
            };

            try {
                const res = await fetch('/api/system-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    if (window.toast) window.toast.success('Đã lưu cấu hình Smart TV & Banner thành công!');
                    Object.assign(this.config, payload);
                    this.applyBackground();
                    this.renderBannerContainer();
                    this.setupMusic();
                    this.closeConfigModal();
                } else {
                    if (window.toast) window.toast.error('Lỗi lưu cấu hình: ' + (data.error || ''));
                }
            } catch (err) {
                console.error('Lỗi saveTvSettings:', err);
                if (window.toast) window.toast.error('Lỗi kết nối máy chủ!');
            }
        },

        // Render Bảng Quản lý Banners trong Modal
        async renderBannersManageTable() {
            const tbody = document.getElementById('manageBannersTableBody');
            if (!tbody) return;

            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải kho ảnh...</td></tr>';

            try {
                const res = await fetch('/api/promotion-banners?t=' + Date.now());
                const data = await res.json();
                const banners = data.banners || [];

                if (banners.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3 text-muted">Kho ảnh banner đang trống. Hãy thêm banner mới bên dưới!</td></tr>';
                    return;
                }

                tbody.innerHTML = banners.map(b => {
                    const isActive = Number(b.Is_active ?? 1) === 1;
                    return `
                        <tr>
                            <td style="width: 70px;">
                                <img src="${b.Image_url}" style="width: 55px; height: 40px; object-fit: cover; border-radius: 6px;" onerror="this.src='/uploads/dish-sample.jpg'">
                            </td>
                            <td>
                                <div class="fw-bold text-dark">${b.Title}</div>
                                <small class="text-muted text-truncate d-block" style="max-width: 200px;">${b.Subtitle || ''}</small>
                            </td>
                            <td><span class="badge bg-warning text-dark fw-bold">${b.Badge_text || 'MỚI'}</span></td>
                            <td class="fw-bold text-success small">${b.Price_text || ''}</td>
                            <td>
                                <div class="form-check form-switch m-0">
                                    <input class="form-check-input" type="checkbox" ${isActive ? 'checked' : ''} onchange="window.readyTvScreensaver.toggleBannerActive(${b.Banner_id}, this.checked)" style="cursor: pointer;">
                                </div>
                            </td>
                            <td class="text-end">
                                <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2 me-1" onclick="window.readyTvScreensaver.editBanner(${b.Banner_id})"><i class="fa-solid fa-pen"></i></button>
                                <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2" onclick="window.readyTvScreensaver.deleteBanner(${b.Banner_id}, '${b.Title.replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash"></i></button>
                            </td>
                        </tr>
                    `;
                }).join('');
            } catch (err) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3 text-danger">Lỗi tải danh sách banner!</td></tr>';
            }
        },

        resetBannerForm() {
            this.editingBannerId = null;
            const titleEl = document.getElementById('bannerFormTitle');
            const submitBtn = document.getElementById('bannerSubmitBtn');
            const inpTitle = document.getElementById('bannerInpTitle');
            const inpSub = document.getElementById('bannerInpSubtitle');
            const inpBadge = document.getElementById('bannerInpBadge');
            const inpPrice = document.getElementById('bannerInpPrice');
            const inpOrder = document.getElementById('bannerInpOrder');
            const inpImgUrl = document.getElementById('bannerInpImageUrl');
            const imgPreview = document.getElementById('bannerImgPreview');

            if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-plus-circle me-1"></i> Thêm Món Mới / Combo Khuyến Mại Mới';
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-plus me-1"></i> Thêm Vào Kho Ảnh';
            if (inpTitle) inpTitle.value = '';
            if (inpSub) inpSub.value = '';
            if (inpBadge) inpBadge.value = 'MỚI';
            if (inpPrice) inpPrice.value = '';
            if (inpOrder) inpOrder.value = '0';
            if (inpImgUrl) inpImgUrl.value = '';
            if (imgPreview) imgPreview.src = '/uploads/dish-sample.jpg';
        },

        async editBanner(id) {
            try {
                const res = await fetch('/api/promotion-banners?t=' + Date.now());
                const data = await res.json();
                const b = (data.banners || []).find(item => item.Banner_id == id);
                if (!b) return;

                this.editingBannerId = id;
                const titleEl = document.getElementById('bannerFormTitle');
                const submitBtn = document.getElementById('bannerSubmitBtn');
                const inpTitle = document.getElementById('bannerInpTitle');
                const inpSub = document.getElementById('bannerInpSubtitle');
                const inpBadge = document.getElementById('bannerInpBadge');
                const inpPrice = document.getElementById('bannerInpPrice');
                const inpOrder = document.getElementById('bannerInpOrder');
                const inpImgUrl = document.getElementById('bannerInpImageUrl');
                const imgPreview = document.getElementById('bannerImgPreview');

                if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square me-1"></i> Hiệu Chỉnh: ${b.Title}`;
                if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-check me-1"></i> Cập Nhật Banner';
                if (inpTitle) inpTitle.value = b.Title || '';
                if (inpSub) inpSub.value = b.Subtitle || '';
                if (inpBadge) inpBadge.value = b.Badge_text || 'MỚI';
                if (inpPrice) inpPrice.value = b.Price_text || '';
                if (inpOrder) inpOrder.value = b.Sort_order || '0';
                if (inpImgUrl) inpImgUrl.value = b.Image_url || '';
                if (imgPreview) imgPreview.src = b.Image_url || '/uploads/dish-sample.jpg';

                // Cuộn xuống form
                titleEl?.scrollIntoView({ behavior: 'smooth' });
            } catch (err) {
                console.error('Lỗi editBanner:', err);
            }
        },

        async saveBannerForm(e) {
            if (e) e.preventDefault();

            const title = document.getElementById('bannerInpTitle')?.value?.trim();
            const subtitle = document.getElementById('bannerInpSubtitle')?.value?.trim();
            const badge = document.getElementById('bannerInpBadge')?.value?.trim();
            const price = document.getElementById('bannerInpPrice')?.value?.trim();
            const sortOrder = parseInt(document.getElementById('bannerInpOrder')?.value, 10) || 0;
            const imageUrl = document.getElementById('bannerInpImageUrl')?.value?.trim();

            if (!title) {
                if (window.toast) window.toast.warning('Vui lòng nhập tên món hoặc combo!');
                return;
            }
            if (!imageUrl) {
                if (window.toast) window.toast.warning('Vui lòng tải ảnh món ăn từ máy tính!');
                return;
            }

            const payload = {
                Title: title,
                Subtitle: subtitle,
                Badge_text: badge,
                Price_text: price,
                Sort_order: sortOrder,
                Image_url: imageUrl,
                Is_active: 1
            };

            try {
                let res;
                if (this.editingBannerId) {
                    res = await fetch(`/api/promotion-banners/${this.editingBannerId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } else {
                    res = await fetch('/api/promotion-banners', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }

                const data = await res.json();
                if (data.success) {
                    if (window.toast) window.toast.success(this.editingBannerId ? 'Đã cập nhật banner thành công!' : 'Đã thêm banner vào kho ảnh!');
                    this.resetBannerForm();
                    this.renderBannersManageTable();
                } else {
                    if (window.toast) window.toast.error(data.error || 'Lỗi lưu banner!');
                }
            } catch (err) {
                console.error('Lỗi saveBannerForm:', err);
                if (window.toast) window.toast.error('Lỗi kết nối máy chủ!');
            }
        },

        async toggleBannerActive(id, isActive) {
            try {
                await fetch(`/api/promotion-banners/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ Is_active: isActive ? 1 : 0 })
                });
                if (window.toast) window.toast.success('Đã cập nhật trạng thái hiển thị!');
            } catch (err) {}
        },

        async deleteBanner(id, title) {
            if (!confirm(`Bạn có chắc muốn xóa banner "${title}" khỏi kho ảnh không?`)) return;

            try {
                const res = await fetch(`/api/promotion-banners/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    if (window.toast) window.toast.success(`Đã xóa banner "${title}"!`);
                    this.renderBannersManageTable();
                } else {
                    if (window.toast) window.toast.error(data.error || 'Không thể xóa banner!');
                }
            } catch (err) {
                if (window.toast) window.toast.error('Lỗi kết nối máy chủ!');
            }
        },

        // Upload ảnh banner từ file máy tính
        async uploadBannerImageFile(fileInput) {
            const file = fileInput.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('bannerImage', file);

            try {
                const res = await fetch('/api/promotion-banners/upload-image', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.success && data.imageUrl) {
                    const inpUrl = document.getElementById('bannerInpImageUrl');
                    const imgPreview = document.getElementById('bannerImgPreview');
                    if (inpUrl) inpUrl.value = data.imageUrl;
                    if (imgPreview) imgPreview.src = data.imageUrl;
                    if (window.toast) window.toast.success('Đã tải ảnh lên thành công!');
                } else {
                    if (window.toast) window.toast.error('Lỗi tải ảnh: ' + (data.error || ''));
                }
            } catch (err) {
                if (window.toast) window.toast.error('Không thể tải file ảnh!');
            }
        },

        // Upload file nhạc du dương từ máy tính
        async uploadMusicFile(fileInput) {
            const file = fileInput.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('musicFile', file);

            try {
                const res = await fetch('/api/promotion-banners/upload-music', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.success && data.musicUrl) {
                    this.config.tv_ambient_music_url = data.musicUrl;
                    const musicStatusEl = document.getElementById('cfgTvMusicStatus');
                    if (musicStatusEl) musicStatusEl.innerHTML = `<span class="badge bg-success">Đã nạp file: ${data.filename}</span>`;
                    if (window.toast) window.toast.success('Đã tải nhạc nền thành công!');
                } else {
                    if (window.toast) window.toast.error('Lỗi tải nhạc: ' + (data.error || ''));
                }
            } catch (err) {
                if (window.toast) window.toast.error('Không thể tải file nhạc!');
            }
        },

        // Upload ảnh nền trang nhận món từ máy tính
        async uploadBgImageFile(fileInput) {
            const file = fileInput.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('bgImage', file);

            try {
                const res = await fetch('/api/promotion-banners/upload-bg', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.success && data.bgUrl) {
                    const bgTypeEl = document.getElementById('cfgTvBgType');
                    const bgValEl = document.getElementById('cfgTvBgValue');
                    if (bgTypeEl) bgTypeEl.value = 'IMAGE';
                    if (bgValEl) bgValEl.value = data.bgUrl;
                    if (window.toast) window.toast.success('Đã tải ảnh nền thành công!');
                } else {
                    if (window.toast) window.toast.error('Lỗi tải ảnh nền: ' + (data.error || ''));
                }
            } catch (err) {
                if (window.toast) window.toast.error('Không thể tải file ảnh nền!');
            }
        }
    };

    window.readyTvScreensaver = ReadyTV;
})(window);
