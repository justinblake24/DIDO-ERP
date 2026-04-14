INSERT INTO "User" (id, email, name, role, "createdAt") VALUES
  ('user_justin',   'justin@eduwill.net',   'Justin', 'ADMIN',    NOW()),
  ('user_sehee',    'sehee@eduwill.net',    '김세희', 'MANAGER',  NOW()),
  ('user_jinkyung', 'jinkyung@eduwill.net', '김진경', 'OPERATOR', NOW()),
  ('user_hyejin',   'hyejin@eduwill.net',   '정혜진', 'OPERATOR', NOW()),
  ('user_viewer',   'viewer@eduwill.net',   '대표',   'VIEWER',   NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO "Vendor" (id, name, country, currency, active, "createdAt") VALUES
  ('v01', '사브와 프로페셔널', 'KR', 'KRW', true, NOW()),
  ('v02', '맑은농산', 'KR', 'KRW', true, NOW()),
  ('v03', '모아트랩파트너스', 'KR', 'KRW', true, NOW()),
  ('v04', '미스티', 'KR', 'KRW', true, NOW()),
  ('v05', '㈜피치코리아', 'KR', 'KRW', true, NOW()),
  ('v06', '㈜대시앤도트', 'KR', 'KRW', true, NOW()),
  ('v07', 'YIWU PULA FOOD CO.,LTD', 'CN', 'USD', true, NOW()),
  ('v08', 'YIWU MITANG FOOD CO.,LTD', 'CN', 'USD', true, NOW()),
  ('v09', 'Guangdong Province Jiacai Food Co., Ltd', 'CN', 'USD', true, NOW())
ON CONFLICT (name) DO NOTHING;

INSERT INTO "PurchaseOrder" (id, "poNumber", "issueDate", "vendorId", status, "createdById", "createdAt", "updatedAt") VALUES
  ('po01', 'DHPO-251017-056',     '2025-10-17', 'v01', 'COMPLETED', 'user_justin', NOW(), NOW()),
  ('po02', 'DHPO-260213-004',     '2026-02-13', 'v02', 'INVOICED',  'user_justin', NOW(), NOW()),
  ('po03', 'DHPO-251224-071',     '2025-12-24', 'v03', 'SHIPPED',   'user_justin', NOW(), NOW()),
  ('po04', 'DHPO-251224-072',     '2025-12-24', 'v03', 'PAID',      'user_justin', NOW(), NOW()),
  ('po05', 'DHPO-260309-006',     '2026-03-09', 'v04', 'SHIPPED',   'user_justin', NOW(), NOW()),
  ('po06', 'DHPO-251113-061',     '2025-11-13', 'v02', 'COMPLETED', 'user_justin', NOW(), NOW()),
  ('po07', 'DHPO-260309-007',     '2026-03-09', 'v05', 'PAID',      'user_justin', NOW(), NOW()),
  ('po08', 'DHPO-251128-064',     '2025-11-28', 'v06', 'INVOICED',  'user_justin', NOW(), NOW()),
  ('po09', 'DHPO-(I)251210M-066', '2025-12-10', 'v09', 'ISSUED',    'user_justin', NOW(), NOW()),
  ('po10', 'DHPO-(I)251222M-067', '2025-12-22', 'v09', 'COMPLETED', 'user_justin', NOW(), NOW()),
  ('po11', 'DHPO-(I)251222M-069', '2025-12-22', 'v07', 'COMPLETED', 'user_justin', NOW(), NOW()),
  ('po12', 'DHPO-(I)260114M-002', '2026-01-14', 'v07', 'COMPLETED', 'user_justin', NOW(), NOW())
ON CONFLICT ("poNumber") DO NOTHING;

INSERT INTO "POItem" (id, "poId", "productName", quantity, unit, "unitPrice", currency, "totalAmount", "sortOrder") VALUES
  ('item01', 'po01', '사브와 헤어텍스쳐라이저', 4807, 'EA', 6900, 'KRW', 33168300, 0),
  ('item02', 'po01', '사브와 헤어엘릭서', 5000, 'EA', 8720, 'KRW', 43600000, 1),
  ('item03', 'po01', '사브와 애니메이터', 4736, 'EA', 6870, 'KRW', 32536320, 2),
  ('item04', 'po02', '두바이 쫀득 쿠키 (556 Cartons, 144ea/CTN)', 80064, 'EA', 1300, 'KRW', 104083200, 0),
  ('item05', 'po03', '모아트랩 백스테이지 약산성 포밍 오일 클렌저', 3025, 'EA', 3800, 'KRW', 11495000, 0),
  ('item06', 'po03', '모아트랩 백스테이지 시카세라 프라이밍 모이스처 크림', 3008, 'EA', 7000, 'KRW', 21056000, 1),
  ('item07', 'po03', '모아트랩 백스테이지 시카세라 프라이밍 에센스', 3042, 'EA', 7000, 'KRW', 21294000, 2),
  ('item08', 'po04', '모아트랩 백스테이지 약산성 포밍 오일 클렌저', 1540, 'EA', 4180, 'KRW', 6437200, 0),
  ('item09', 'po04', '모아트랩 백스테이지 시카세라 프라이밍 모이스처 크림', 1472, 'EA', 7700, 'KRW', 11334400, 1),
  ('item10', 'po04', '모아트랩 백스테이지 시카세라 프라이밍 에센스', 1482, 'EA', 7700, 'KRW', 11411400, 2),
  ('item11', 'po05', '꾸덕젤리 블루베리맛 (278 Cartons, 72ea/CTN)', 20016, 'EA', 1545, 'KRW', 30924720, 0),
  ('item12', 'po06', '설빙 초코 스모어', 16800, 'EA', 620, 'KRW', 10416000, 0),
  ('item13', 'po06', '설빙 초코스모어 (위생허가용)', 60, 'EA', 620, 'KRW', 37200, 1),
  ('item14', 'po06', '설빙 딸기스모어 (위생허가용)', 60, 'EA', 620, 'KRW', 37200, 2),
  ('item15', 'po07', '수박모양 미니젤리 (18 Carton, 120ea/CTN)', 2160, 'EA', 910, 'KRW', 1965600, 0),
  ('item16', 'po07', '블루베리모양 미니젤리 (5 Carton, 120ea/CTN)', 600, 'EA', 910, 'KRW', 546000, 1),
  ('item17', 'po07', '애플망고모양 미니젤리 (4 Carton, 120ea/CTN)', 480, 'EA', 910, 'KRW', 436800, 2),
  ('item18', 'po08', '뽀작뽀작 극한일상 리무버 씰 (안!건강해)', 500, 'EA', 920, 'KRW', 460000, 0),
  ('item19', 'po08', '뽀작뽀작 감정기복 리무버 씰 (불타오르네)', 500, 'EA', 960, 'KRW', 480000, 1),
  ('item20', 'po08', '뽀작뽀작 감정기복 리무버 씰 (눈누난나)', 500, 'EA', 960, 'KRW', 480000, 2),
  ('item21', 'po09', 'BongBong Tears Of Strawberry', 88992, 'EA', 0.45, 'USD', 40046.4, 0),
  ('item22', 'po09', 'BongBong Tears Of La France', 71280, 'EA', 0.45, 'USD', 32076, 1),
  ('item23', 'po09', 'BongBong Tears Of Grape', 86736, 'EA', 0.45, 'USD', 39031.2, 2),
  ('item24', 'po10', 'Shinako BongBong 2 (Grape & Strawberry)', 51024, 'EA', 0.97, 'USD', 49493.28, 0),
  ('item25', 'po10', 'Shinako BongBong 2 (Shine Muscat & Pineapple)', 56592, 'EA', 0.97, 'USD', 54894.24, 1),
  ('item26', 'po11', 'BongBong Tears Of Strawberry', 20016, 'EA', 0.45, 'USD', 9007.2, 0),
  ('item27', 'po11', 'BongBong Tears Of La France', 24768, 'EA', 0.45, 'USD', 11145.6, 1),
  ('item28', 'po11', 'BongBong Tears Of Grape', 34992, 'EA', 0.45, 'USD', 15746.4, 2),
  ('item29', 'po12', 'BongBong Tears Of Peach', 24000, 'Bags', 0.45, 'USD', 10800, 0)
ON CONFLICT (id) DO NOTHING;

SELECT 'Users' as tbl, COUNT(*) FROM "User"
UNION ALL SELECT 'Vendors', COUNT(*) FROM "Vendor"
UNION ALL SELECT 'POs', COUNT(*) FROM "PurchaseOrder"
UNION ALL SELECT 'Items', COUNT(*) FROM "POItem";
