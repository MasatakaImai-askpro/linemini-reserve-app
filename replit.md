# かながわ西部おでかけナビ

## Overview
A regional portal site for western Kanagawa prefecture (大和、小田原周辺) targeting local shops from shopping streets and associations. Built as a **LINE Mini App** with per-shop coupon management, Google Maps embed, full booking/reservation system, and admin dashboard. The UI renders inside a LINE-style phone frame with LINE header navigation.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js
- **Database**: PostgreSQL with Neon SQL (全データ：shops/coupons/booking系全て)
- **Routing**: wouter
- **LINE Mini App Frame**: `LineAppFrame` component wraps all pages, providing phone mockup on desktop (375x812), LINE-style header with contextual navigation, status bar, and bottom bar

## Pages & Routes
- **Landing Page** (`/`) - 3-button entry: LINE公式アカウント (green→/line), おでかけナビを開く (orange→/app), 管理画面 (dark→/admin)
- **LINE Demo** (`/line`) - LINE Official Account talk screen demo with pinned note bar. Back navigates to `/`, opens Mini App at `/app`
- **Top Page** (`/app`) - Hero banner, SVG area map (14 areas), category grid, coupon carousel, genre sections. Wrapped in LineAppFrame
- **List Page** (`/app/list`) - Compact horizontal-card layout, area/category filters, keyword search, favorites filter
- **Detail Page** (`/app/shop/:id`) - Shop info, per-shop coupons, Google Maps embed, reservation button
- **Reservation Page** (`/app/reservation/:id`) - Per-shop multi-step booking wizard: course select → course detail → date/time → confirm (name/email/phone入力) → complete (キャンセルリンク表示)
- **Cancel Page** (`/app/cancel/:shopId/:token`) - Token-based reservation cancel page (メール送付用、localStorageに依存しない)
- **Admin Dashboard** (`/admin`) - 管理者用。店舗一覧、表示順序、予約ON/OFF、LINE設定、クーポン管理。予約有効な店舗には「店舗管理画面を開く」リンク付き
- **Shop Admin Page** (`/admin/shop/:id`) - 各店舗の管理画面。4タブ: コース管理, スタッフ管理, 予約枠管理, 予約一覧。店舗オーナー向け

## ルート統合（URL統一）
- **ミニアプリとWEB版は `/app/*` に統一**。`/web/*` は後方互換リダイレクト（→`/app/*`）のみ
- `useBasePath()` は常に `"/app"` を返すシンプルな実装
- 全ページが `LineAppFrame`（電話フレーム + LINEヘッダー）で表示
- `WebAppFrame`/`WebSpFrame` コンポーネントは残存するが現在未使用（将来の拡張用）
- wouter v3のネストルーティングバグを回避するため、全ルートをApp.tsx内でフラット定義

## LINE Mini App Integration
- `LineAppFrame` wraps `/app/*` routes in `App.tsx`
- Desktop: 375px wide phone frame centered on gray-800 background with rounded corners and shadow
- Mobile: full-width layout filling viewport
- LINE header: sticky, shows page-specific titles, contextual back/home/close buttons
- Close button (X) on home navigates to `/` landing page
- No per-page headers - navigation handled entirely by LINE header
- Reservation URLs: internal paths (`/app/reservation/{shopId}`), never external URLs
- Reservation toggle: admin uses select (有効/無効) with auto-generated internal URL

## Database Tables
- `shops` - Shop data with displayOrder, lineAccountUrl, hasLineAccountCoupon, reservationUrl (internal path or null), reservationImageUrl (予約ページ画像), galleryImageUrls (店舗詳細スライド用3枚), updatedAt, latitude/longitude
- `coupons` - Per-shop coupons with isLineAccountCoupon flag, linked to shops via shopId

## Booking System (PostgreSQL, Per-Shop)
- 全予約データはNeon PostgreSQLに永続化（`booking_staff`, `booking_courses`, `booking_reservations`, `booking_settings`テーブル）
- 初回アクセス時に`initBookingTables()`でテーブルを自動作成
- デモデータは`seedShopIfEmpty(shopId)`でコースが0件の店舗に自動挿入（shop 1: ラーメン店, shop 3: Hair Salon MIKU）
- Staff-course relationships: courses own staff assignment (course.staffIds), staff.courseIds is computed server-side from courses
- Customer booking flow has NO staff selection step (staff removed from customer-facing UI entirely)
- Always uses `__shop__` as staffId for customer reservations; staff management is admin-only
- Time slots: default 10:00-19:00 in 30min intervals
- All booking API calls require shopId parameter (client passes via URL, admin via shop selector dropdown)

## Favorites (localStorage)
- `client/src/hooks/use-favorites.ts` - `useFavorites()` hook: toggle/check favorites stored in localStorage (`odekake-favorites` key)
- Heart button on shop cards (home ShopCard, list ListShopCard, detail hero image)
- Home page: "お気に入り" section shown when favorites exist (horizontal scroll row)
- List page: "お気に入り" filter toggle button, `?fav=1` URL param support
- Cross-component sync via listener pattern (toggling in one component updates all)

## Key Files
- `shared/schema.ts` - Data models (shops + coupons tables), 14 areas, 6 categories
- `api/index.ts` - **メインエントリー**。全APIルート・DBヘルパー・ミドルウェアを一元管理。ensureSetup()でマイグレーション+シード+ルート登録を一括実行
- `server/index.ts` - ローカル開発用薄いラッパー（api/index.tsからimport、Vite追加のみ）
- `server/seed.ts` - Demo seed data (14 shops, 13 coupons)
- `client/src/components/line-app-frame.tsx` - LINE Mini App phone frame wrapper with header, status bar, bottom bar
- `client/src/lib/booking-api.ts` - Booking types (Staff, Course, Reservation, TimeSlot, StoreSettings) and API fetch functions
- `client/src/pages/home.tsx` - Top page
- `client/src/pages/list.tsx` - List page
- `client/src/pages/detail.tsx` - Detail page with Google Maps + coupons
- `client/src/pages/reservation.tsx` - Multi-step booking flow
- `client/src/pages/admin.tsx` - Admin dashboard (店舗設定・クーポン管理のみ)
- `client/src/pages/shop-admin.tsx` - Per-shop management page (コース・スタッフ・予約枠・予約一覧)
- `client/src/components/booking/` - CourseSelect, CourseDetail, StaffSelect, DateTimeSelect, PaymentConfirm, BookingComplete
- `client/src/components/admin/` - CourseManagement, StaffManagement, SlotManagement, ReservationList
- `client/src/hooks/use-favorites.ts` - Favorites hook (localStorage, listener sync)
- `client/src/lib/data.ts` - Helper functions (area/category names, sorting, update detection)

## Design
- Warm Japanese-themed color palette (orange/amber primary)
- Noto Sans JP font
- LINE green (#06C755) for LINE account coupon sections and booking confirmations
- Orange badge for recently updated shops (within 1 week)
- Body background: gray-800 (simulates phone on dark surface)
- Content scrolls within LINE frame independently

## API Endpoints
### File Upload
- `POST /api/upload` - Upload image file (multer, max 5MB, jpeg/png/gif/webp)
- `/uploads/*` - Static file serving for uploaded images
- Files stored in `server/uploads/` directory

### Shop/Coupon APIs (PostgreSQL)
- `GET /api/shops` - All shops (sorted by displayOrder desc, updatedAt desc)
- `GET /api/shops/:id` - Single shop
- `PUT /api/shops/:id` - Update shop settings
- `GET /api/shops/:id/coupons` - Shop's coupons
- `POST /api/shops/:id/coupons` - Create coupon
- `GET /api/coupons` - All coupons
- `PUT /api/coupons/:id` - Update coupon
- `DELETE /api/coupons/:id` - Delete coupon

### Booking APIs (PostgreSQL, Per-Shop)
- `GET/POST/PUT/DELETE /api/shops/:shopId/staff` - Staff CRUD
- `GET/POST/PUT/DELETE /api/shops/:shopId/courses` - Course CRUD
- `GET/POST/PUT/DELETE /api/shops/:shopId/reservations` - Reservation CRUD
- `GET/PUT/POST /api/shops/:shopId/slots` - Time slot management
- `GET/PUT /api/shops/:shopId/settings` - Store settings
- `GET/POST/PUT /api/shops/:shopId/inquiries` - Customer inquiries
- `GET /api/shops/:shopId/cancel/:token` - Fetch reservation info by cancel token
- `POST /api/shops/:shopId/cancel/:token` - Execute reservation cancel by token
