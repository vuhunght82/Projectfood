/**
 * HỆ THỐNG ÂM THANH THÔNG BÁO THỜI GIAN THỰC (SOUND SERVICE)
 * Hỗ trợ 5 kiểu chuông mẫu chuẩn Web Audio API + Phát file âm thanh tùy chỉnh từ máy tính (.mp3, .wav, .ogg)
 * Hỗ trợ điều chỉnh Âm lượng (0-100%), Số lần lặp (Repeat Count) và Thời gian cách nhau (Repeat Interval)
 */

(function(window) {
    let globalAudioCtx = null;
    let activeTimers = [];

    let _unlockedHtml5Audio = null;

    // Mở khóa AudioContext & HTML5 Audio khi người dùng tương tác với trình duyệt (đặc biệt hữu ích trên Chrome/iOS Safari)
    async function getAudioContext() {
        if (!globalAudioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                globalAudioCtx = new AudioContext();
            }
        }
        if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
            try {
                await globalAudioCtx.resume();
            } catch (e) {
                console.warn('AudioContext resume warning:', e);
            }
        }
        return globalAudioCtx;
    }

    function unlockAudio() {
        getAudioContext();
        try {
            if (!_unlockedHtml5Audio) {
                _unlockedHtml5Audio = new Audio();
            }
            _unlockedHtml5Audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
            const p = _unlockedHtml5Audio.play();
            if (p !== undefined) {
                p.then(() => {
                    _unlockedHtml5Audio.pause();
                }).catch(() => {});
            }
        } catch(e) {}
    }

    // Đăng ký sự kiện click / touch toàn cục để mở khóa audio trên toàn trang
    ['click', 'touchstart', 'touchend', 'keydown'].forEach(evt => {
        document.addEventListener(evt, () => {
            unlockAudio();
        }, { capture: true, once: false });
    });

    // 5 Kiểu âm thanh mẫu tổng hợp bằng Web Audio API
    const SoundSynthesizers = {
        // Kiểu 1: Chuông Ding-Dong du dương
        dingdong: function(ctx, volumeFactor) {
            const now = ctx.currentTime;
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(volumeFactor, now);
            masterGain.connect(ctx.destination);

            // Nốt "Ding" (587.33Hz - D5)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(587.33, now);
            gain1.gain.setValueAtTime(0.7, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc1.connect(gain1);
            gain1.connect(masterGain);
            osc1.start(now);
            osc1.stop(now + 0.6);

            // Nốt "Dong" (880Hz - A5)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880, now + 0.22);
            gain2.gain.setValueAtTime(0.85, now + 0.22);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
            osc2.connect(gain2);
            gain2.connect(masterGain);
            osc2.start(now + 0.22);
            osc2.stop(now + 0.9);
        },

        // Kiểu 2: Chuông Bếp Ting-Ting đanh vang (Classic Service Bell)
        kitchen_bell: function(ctx, volumeFactor) {
            const now = ctx.currentTime;
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(volumeFactor, now);
            masterGain.connect(ctx.destination);

            // Ting 1
            [1244.5, 1864].forEach(freq => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now);
                gain.gain.setValueAtTime(0.6, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(now);
                osc.stop(now + 0.45);
            });

            // Ting 2
            [1396.9, 2093].forEach(freq => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + 0.16);
                gain.gain.setValueAtTime(0.75, now + 0.16);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(now + 0.16);
                osc.stop(now + 0.75);
            });
        },

        // Kiểu 3: Còi Beep-Beep kép dứt khoát (Double Beep Alert)
        beep_alert: function(ctx, volumeFactor) {
            const now = ctx.currentTime;
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(volumeFactor * 0.8, now);
            masterGain.connect(ctx.destination);

            // Beep 1
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(1046.5, now); // C6
            gain1.gain.setValueAtTime(0.8, now);
            gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
            osc1.connect(gain1);
            gain1.connect(masterGain);
            osc1.start(now);
            osc1.stop(now + 0.14);

            // Beep 2
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1318.5, now + 0.18); // E6
            gain2.gain.setValueAtTime(0.9, now + 0.18);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.36);
            osc2.connect(gain2);
            gain2.connect(masterGain);
            osc2.start(now + 0.18);
            osc2.stop(now + 0.36);
        },

        // Kiểu 4: Chuông Cảnh Báo Khẩn (Urgent Alarm Chime)
        urgent_alarm: function(ctx, volumeFactor) {
            const now = ctx.currentTime;
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(volumeFactor * 0.8, now);
            masterGain.connect(ctx.destination);

            for (let i = 0; i < 3; i++) {
                const t = now + (i * 0.18);
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(880, t);
                osc.frequency.linearRampToValueAtTime(1320, t + 0.12);
                gain.gain.setValueAtTime(0.5, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(t);
                osc.stop(t + 0.15);
            }
        },

        // Kiểu 5: Tiếng Kèn Chúc Mừng vui tươi (Fanfare / Arpeggio Chime)
        fanfare: function(ctx, volumeFactor) {
            const now = ctx.currentTime;
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(volumeFactor, now);
            masterGain.connect(ctx.destination);

            const notes = [
                { f: 523.25, start: 0, dur: 0.15 },    // C5
                { f: 659.25, start: 0.12, dur: 0.15 }, // E5
                { f: 783.99, start: 0.24, dur: 0.15 }, // G5
                { f: 1046.50, start: 0.38, dur: 0.45 } // C6
            ];

            notes.forEach(n => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(n.f, now + n.start);
                gain.gain.setValueAtTime(0.7, now + n.start);
                gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(now + n.start);
                osc.stop(now + n.start + n.dur);
            });
        }
    };

    // Bộ nhớ đệm lưu trữ AudioBuffer đã giải mã
    const audioBufferCache = new Map();

    // Tải trước và giải mã file âm thanh tùy chỉnh
    async function preloadAudio(url) {
        if (!url || audioBufferCache.has(url)) return;
        try {
            const ctx = await getAudioContext();
            if (!ctx) return;
            const res = await fetch(url, { cache: 'force-cache' });
            if (!res.ok) return;
            const arrayBuffer = await res.arrayBuffer();
            const decoded = await ctx.decodeAudioData(arrayBuffer);
            if (decoded) {
                audioBufferCache.set(url, decoded);
                console.log('✅ [SoundService] Đã nạp sẵn file âm thanh:', url);
            }
        } catch (e) {
            console.warn('[SoundService] Lỗi preload âm thanh:', e);
        }
    }

    // Hàm phát một lần duy nhất (Hỗ trợ 100% Mobile Background & Desktop)
    function playSingleSound(soundType, customSoundUrl, volumePercent) {
        const volumeFactor = Math.max(0.1, (Number(volumePercent) || 80) / 100);

        // 🌟 1. PHÁT FILE ÂM THANH TÙY CHỈNH (.mp3, .wav, .m4a, .ogg)
        if (soundType === 'custom_file' && customSoundUrl) {
            try {
                const audioPlayer = _unlockedHtml5Audio || new Audio();
                audioPlayer.src = customSoundUrl;
                audioPlayer.volume = Math.min(1.0, volumeFactor);
                audioPlayer.currentTime = 0;
                const p = audioPlayer.play();
                if (p !== undefined) {
                    p.catch(e => {
                        console.warn('[SoundService] Audio element play error, thử Web Audio API Buffer:', e);
                        playBufferAudio(customSoundUrl, volumeFactor);
                    });
                }
                return;
            } catch (e) {
                console.warn('[SoundService] Lỗi tạo Audio element, fallback buffer:', e);
                playBufferAudio(customSoundUrl, volumeFactor);
                return;
            }
        }

        // 🌟 2. PHÁT CHUÔNG TỔNG HỢP WEB AUDIO API (dingdong, kitchen_bell, beep_alert, urgent_alarm, fanfare)
        try {
            getAudioContext().then(ctx => {
                if (!ctx) return;
                const synthFunc = SoundSynthesizers[soundType] || SoundSynthesizers.kitchen_bell;
                synthFunc(ctx, volumeFactor);
            }).catch(e => {
                console.error('[SoundService] Lỗi phát chuông tổng hợp:', e);
            });
        } catch (e) {
            console.error('[SoundService] Lỗi getAudioContext:', e);
        }
    }

    async function playBufferAudio(url, volumeFactor) {
        try {
            const ctx = await getAudioContext();
            if (!ctx) return;
            if (ctx.state === 'suspended') {
                await ctx.resume().catch(() => {});
            }
            let audioBuf = audioBufferCache.get(url);
            if (!audioBuf) {
                const response = await fetch(url);
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    audioBuf = await ctx.decodeAudioData(arrayBuffer);
                    audioBufferCache.set(url, audioBuf);
                }
            }
            if (audioBuf) {
                const source = ctx.createBufferSource();
                const gainNode = ctx.createGain();
                gainNode.gain.setValueAtTime(volumeFactor, ctx.currentTime);
                source.buffer = audioBuf;
                source.connect(gainNode);
                gainNode.connect(ctx.destination);
                source.start(0);
            }
        } catch(e) {
            console.warn('[SoundService] playBufferAudio error:', e);
        }
    }

    // Dừng tất cả các vòng lặp âm thanh đang chờ
    function stopAllAlertSounds() {
        activeTimers.forEach(id => clearTimeout(id));
        activeTimers = [];
    }

    /**
     * Phát chuông báo động theo chu kỳ lặp và thời gian cách nhau
     * @param {Object} options 
     *  - type: 'dingdong' | 'kitchen_bell' | 'beep_alert' | 'urgent_alarm' | 'fanfare' | 'custom_file'
     *  - customUrl: Đường dẫn file âm thanh tùy chỉnh
     *  - volume: 0 -> 100
     *  - repeatCount: Số lần lặp (ví dụ 3 lần cho bếp, 1 lần cho nhận món)
     *  - repeatInterval: Khoảng cách giữa các lần lặp (tính theo giây, ví dụ 2s)
     */
    function playAlertSound(options) {
        options = options || {};
        const soundType = options.type || 'kitchen_bell';
        const customUrl = options.customUrl || '';
        const volume = Number(options.volume ?? 80);
        const repeatCount = Math.max(1, parseInt(options.repeatCount || 1, 10));
        const repeatIntervalSec = Math.max(0.5, parseFloat(options.repeatInterval || 2));

        stopAllAlertSounds();

        // Phát ngay lần đầu tiên
        playSingleSound(soundType, customUrl, volume);

        // Lặp các lần tiếp theo nếu repeatCount > 1
        for (let i = 1; i < repeatCount; i++) {
            const delayMs = i * repeatIntervalSec * 1000;
            const timerId = setTimeout(() => {
                playSingleSound(soundType, customUrl, volume);
            }, delayMs);
            activeTimers.push(timerId);
        }
    }

    // Nút nghe thử (Chỉ phát 1 lần để xem trước kèm thông báo)
    function testPlaySound(soundType, customUrl, volume) {
        stopAllAlertSounds();
        playSingleSound(soundType, customUrl, volume);
        if (window.toast && typeof window.toast.info === 'function') {
            const soundName = PRESET_SOUND_NAMES[soundType] || soundType;
            window.toast.info(`🔔 Đang phát thử: ${soundName} (Âm lượng ${volume || 80}%)`);
        }
    }

    // Danh sách tên hiển thị thân thiện cho 5 kiểu chuông
    const PRESET_SOUND_NAMES = {
        'dingdong': '1. Chuông Ding-Dong Du Dương',
        'kitchen_bell': '2. Chuông Bếp Ting-Ting Đanh Vang',
        'beep_alert': '3. Còi Beep-Beep Kép Dứt Khoát',
        'urgent_alarm': '4. Chuông Báo Động Dồn Dập',
        'fanfare': '5. Tiếng Kèn Chúc Mừng Vui Tươi',
        'custom_file': '📁 Âm Thanh Tùy Chỉnh (Tải Từ Máy Tính)'
    };

    let currentTtsAudio = null;

    /**
     * Phát giọng đọc thông báo Tiếng Việt thông minh chuẩn HD (Hỗ trợ 100% Mobile, Tablet & PC)
     * @param {string} text Nội dung cần đọc
     * @param {Object} options { volume: 0-100, onEnded: callback, rate: 1.0 }
     */
    function speakVietnamese(text, options = {}) {
        if (!text || typeof window === 'undefined') return;
        const cleanText = String(text).trim();
        if (!cleanText) return;

        const vol = options.volume !== undefined ? Math.max(0.1, Number(options.volume) / 100) : 1.0;
        const finalVol = Math.min(1.0, vol);

        // Dừng âm thanh giọng đọc trước đó nếu đang chạy
        if (currentTtsAudio) {
            try {
                currentTtsAudio.pause();
                currentTtsAudio.currentTime = 0;
            } catch(e) {}
            currentTtsAudio = null;
        }

        // Phương án 1: Phát qua Audio MP3 chuẩn từ máy chủ /api/tts (Tương thích 100% iOS Safari, Android Chrome, Tablet, Desktop)
        try {
            const ttsAudioUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&_t=${Date.now()}`;
            const audio = new Audio(ttsAudioUrl);
            audio.volume = finalVol;
            currentTtsAudio = audio;

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    if (typeof options.onEnded === 'function') {
                        audio.onended = options.onEnded;
                    }
                }).catch((playErr) => {
                    console.warn('[SoundService] Audio play error, fallback to Web Speech API:', playErr.message);
                    fallbackWebSpeechSynthesis(cleanText, options, finalVol);
                });
                return;
            }
        } catch (audioErr) {
            console.warn('[SoundService] Audio element error, falling back:', audioErr);
        }

        // Phương án 2: Dự phòng bằng Web Speech Synthesis
        fallbackWebSpeechSynthesis(cleanText, options, finalVol);
    }

    function fallbackWebSpeechSynthesis(cleanText, options, finalVol) {
        if (!('speechSynthesis' in window)) return;
        try {
            if (window.speechSynthesis.paused) window.speechSynthesis.resume();
            window.speechSynthesis.cancel();

            const utter = new SpeechSynthesisUtterance(cleanText);
            utter.lang = 'vi-VN';
            utter.rate = options.rate || 1.0;
            utter.pitch = options.pitch || 1.0;
            utter.volume = finalVol;

            const getBestVoice = () => {
                const voices = window.speechSynthesis.getVoices() || [];
                return voices.find(v => v.lang === 'vi-VN' || v.lang === 'vi_VN' || (v.lang && v.lang.toLowerCase().includes('vi')) || (v.name && v.name.toLowerCase().includes('vietnam')));
            };

            const viVoice = getBestVoice();
            if (viVoice) utter.voice = viVoice;

            setTimeout(() => {
                try {
                    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
                    if (!utter.voice) {
                        const fb = getBestVoice();
                        if (fb) utter.voice = fb;
                    }
                    window.speechSynthesis.speak(utter);
                } catch(e) {}
            }, 60);
        } catch(e) {}
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = () => {
                try { window.speechSynthesis.getVoices(); } catch(e) {}
            };
        }
        try { window.speechSynthesis.getVoices(); } catch(e) {}
    }

    // Xuất ra phạm vi toàn cục window
    window.SoundService = {
        playSingleSound,
        playAlertSound,
        testPlaySound,
        preloadAudio,
        speakVietnamese,
        stopAllAlertSounds,
        PRESET_SOUND_NAMES,
        getAudioContext,
        unlockAudio
    };

})(window);
