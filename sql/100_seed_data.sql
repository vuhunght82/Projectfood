-- 1. TÀI KHOẢN MẪU
INSERT OR REPLACE INTO USERS (User_name, User_password, Role) VALUES 
('vu', '111', 'ADMIN'),
('admin', '123456', 'ADMIN'),
('cashier1', '123456', 'CASHIER'),
('shipper1', '123456', 'WAITER');

-- 2. 10 DANH MỤC
INSERT OR IGNORE INTO CATEGORIES (Category_id, Category_name, Display_order) VALUES
(1, 'Món Điểm Tâm & Bún/Phở', 1),
(2, 'Món Khai Vị & Gỏi', 2),
(3, 'Món Cơm & Cơm Chiên', 3),
(4, 'Món Lẩu Chay Thanh Đạm', 4),
(5, 'Món Kho & Xào Mặn', 5),
(6, 'Món Canh & Lẩu Cốc', 6),
(7, 'Món Chiên & Rán Giòn', 7),
(8, 'Món Hấp & Luộc Thanh Tịnh', 8),
(9, 'Tráng Miệng & Chè Chay', 9),
(10, 'Nước Uống & Trà Thảo Mộc', 10);

-- 3. MÓN ĂN VỚI HÌNH CỰC ĐẸP TỪ CDN UNSPLASH
INSERT OR REPLACE INTO MENU_ITEMS (Category_id, Item_code, Item_name, Base_price, Image_url, Description) VALUES
-- Danh mục 1: Bún / Phở
(1, 'DT001', 'Phở Chay Hoa Sen', 45000, 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=500', 'Nước dùng ngầm từ củ quả thanh ngọt'),
(1, 'DT002', 'Bún Huế Chay', 45000, 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=500', 'Đậm đà vị sa tế chay và nấm đông cô'),
(1, 'DT003', 'Bún Riêu Chay', 40000, 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500', 'Riêu làm từ đậu hũ non và váng đậu'),
(1, 'DT004', 'Hủ Tiếu Nam Vang Chay', 45000, 'https://images.unsplash.com/photo-1591814468924-caf88d1232e1?w=500', 'Hủ tiếu dai thơm tô điểm nấm và chả chay'),
(1, 'DT005', 'Bánh Canh Nấm Chay', 40000, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500', 'Nước dùng sánh béo thơm mùi hành boaro'),

-- Danh mục 2: Khai Vị & Gỏi
(2, 'KV001', 'Gỏi Ngó Sen Tôm Chay', 65000, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500', 'Ngó sen giòn ngọt tôm chay giòn'),
(2, 'KV002', 'Gỏi Củ Hủ Dừa Chay', 70000, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500', 'Đặc sản miền tây thanh ngọt mát lành'),
(2, 'KV003', 'Chả Giò Hoa Sen Giòn', 55000, 'https://images.unsplash.com/photo-1541529086526-db283c563270?w=500', 'Nhân khoai môn nấm đông cô giòn rụm'),

-- Danh mục 3: Cơm Chiên
(3, 'C001', 'Cơm Chiên Dương Châu Chay', 50000, 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500', 'Hạt cơm vàng óng kèm rủ hạt ngũ sắc'),
(3, 'C002', 'Cơm Chiên Hạt Sen Hoa Sen', 60000, 'https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=500', 'Cơm gói lá sen thơm lừng mùi thảo mộc'),
(3, 'C003', 'Cơm Chiên Sốt Khóm (Dứa)', 65000, 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500', 'Phục vụ trong trái dứa chua ngọt'),

-- Danh mục 4: Lẩu Chay
(4, 'L001', 'Lẩu Nấm Thần Tiên Hoa Sen', 199000, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500', 'Mười loại nấm quý thanh lọc cơ thể'),
(4, 'L002', 'Lẩu Thái Chua Cay Chay', 189000, 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500', 'Nước lẩu thơm vị sả tắc và ớt chưng'),

-- Danh mục 5: Kho & Xào
(5, 'KX001', 'Nấm Rơm Kho Quẹt', 65000, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500', 'Ăn kèm rau luộc thập cẩm giòn ngọt'),
(5, 'KX002', 'Đậu Hũ Kho Nấm Tiêu Xanh', 55000, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500', 'Đậu hũ chiên thấm vị tiêu cay nhẹ'),

-- Danh mục 6: Canh
(6, 'CN001', 'Canh Chua Chay Nam Bộ', 50000, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500', 'Nấu me chua đậu bọc giá đậu nhút'),
(6, 'CN002', 'Canh Rong Biển Đậu Hũ', 45000, 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500', 'Thanh mát bổ dưỡng phong cách Hàn'),

-- Danh mục 7: Chiên Rán
(7, 'CH001', 'Đậu Hũ Lướt Ván Càng Xanh', 45000, 'https://images.unsplash.com/photo-1541529086526-db283c563270?w=500', 'Bên ngoài giòn mềm mịn bên trong'),
(7, 'CH002', 'Nấm Kim Chiên Xù', 50000, 'https://images.unsplash.com/photo-1562967914-608f82629710?w=500', 'Giòn rụm chấm tương xí muội'),

-- Danh mục 8: Hấp Luộc
(8, 'H001', 'Rau Luộc Thập Cẩm Kho Quẹt', 55000, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500', 'Bầu, củ cải, đậu que, bắp cải'),
(8, 'H002', 'Đậu Hũ Non Hấp Hồng Kông', 55000, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500', 'Sốt xì dầu thơm boaro gừng thái'),

-- Danh mục 9: Tráng Miệng
(9, 'TM001', 'Chè Bưởi An Giang', 25000, 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500', 'Cùi bưởi giòn sần sật cốt dừa'),
(9, 'TM002', 'Chè Hạt Sen Long Nhãn', 30000, 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500', 'Thanh mát ngủ ngon giấc'),

-- Danh mục 10: Nước Uống
(10, 'NU001', 'Trà Sen Vàng Kem Béo', 35000, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500', 'Trà thanh nhẹ vãng củ sen tươi'),
(10, 'NU002', 'Trà Đào Sả Tắc', 30000, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500', 'Đào miếng giòn chua ngọt');