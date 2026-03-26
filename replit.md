# かながわ西部おでかけナビ

## Overview
A regional portal site for western Kanagawa prefecture (大和、小田原周辺) targeting local shops from shopping streets and associations. Built as a **LINE Mini App** with per-shop coupon management, Google Maps embed, full booking/reservation system, and admin dashboard. The UI renders inside a LINE-style phone frame with LINE header navigation.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js
- **Database**: PostgreSQL with Drizzle ORM (shops/coupons), In-memory store (booking system, local dev only)
- **Vercel Serverless**: `api/index.ts` - Raw SQL (neon) for all endpoints including booking. booking_settings table stores table_count/max_party_size/staff_selection_enabled persistently
- **Routing**: wouter
- **LINE Mini App Frame**: `LineAppFrame` component wraps all pages, providing phone mockup on desktop (375x812), LINE-style header with contextual navigation, status bar, and bottom bar

## Pages & Routes
- **Landing Page** (`/`) - 3-button entry: LINE公式アカウント (green→/line), 店舗ミニアプリ (orange→/app), 管理画面 (dark→/admin)
- **LINE Demo** (`/line`) - LINE Official Account talk screen demo with pinned note bar. Back navigates to `/`, opens Mini App at `/app`
- **Top Page** (`/app`) - Hero banner, SVG area map (14 areas), category grid, coupon carousel, genre sections. Wrapped in LineAppFrame
- **List Page** (`/app/list`) - Compact horizontal-card layout, area/category filters, keyword search, favorites filter
- **Detail Page** (`/app/shop/:id`) - Shop info, per-shop coupons, Google Maps embed, reservation button
- **Reservation Page** (`/app/reservation/:id`) - Per-shop multi-step booking wizard: course select → course detail → date/time → confirm (name/email/phone入力) → complete (キャンセルリンク表示)
- **Cancel Page** (`/app/cancel/:shopId/:token`) - Token-based reservation cancel page (メール送付用、localStorageに依存しない)
- **Admin Dashboard** (`/admin`) - 管理者用。店舗一覧、表示順序、予約ON/OFF、LINE設定、クーポン管理。予約有効な店舗には「店舗管理画面を開く」リンク付き
- **Shop Admin Page** (`/admin/shop/:id`) - 各店舗の管理画面。4タブ: コース管理, スタッフ管理, 予約枠管理, 予約一覧。店舗オーナー向け

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

## Booking System (In-Memory, Per-Shop)
- `BookingStoreManager` class in `server/booking-store.ts` - Manages per-shop booking stores
- Each shop with reservations has its own isolated BookingStore (courses, staff, reservations, slots, settings, inquiries)
- Demo data for shops 1 (ラーメン店), 3 (Hair Salon MIKU), 6 (鮨処 匠) with shop-specific courses/staff
- IDs prefixed per shop: `s1-1`, `c1-1`, `r1-1` for shop 1; `s3-1`, `c3-1` for shop 3; etc.
- Staff-course relationships: courses own staff assignment (course.staffIds), staff.courseIds is computed server-side from courses
- Customer booking flow has NO staff selection step (staff removed from customer-facing UI entirely)
- Always uses `__shop__` as staffId for customer reservations; staff management is admin-only
- Time slots: default 10:00-19:00 in 30min intervals, customizable per staff (or shop-level) per day-of-week
- Data resets on server restart (by design for demo)
- All booking API calls require shopId parameter (client passes via URL, admin via shop selector dropdown)

## Favorites (localStorage)
- `client/src/hooks/use-favorites.ts` - `useFavorites()` hook: toggle/check favorites stored in localStorage (`odekake-favorites` key)
- Heart button on shop cards (home ShopCard, list ListShopCard, detail hero image)
- Home page: "お気に入り" section shown when favorites exist (horizontal scroll row)
- List page: "お気に入り" filter toggle button, `?fav=1` URL param support
- Cross-component sync via listener pattern (toggling in one component updates all)

## Key Files
- `shared/schema.ts` - Data models (shops + coupons tables), 14 areas, 6 categories
- `server/routes.ts` - API: shops CRUD, coupons CRUD, booking APIs (staff/courses/reservations/slots/settings/inquiries)
- `server/booking-store.ts` - In-memory booking store with demo data
- `server/storage.ts` - Database storage layer with ordering
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

### Booking APIs (In-Memory, Per-Shop)
- `GET/POST/PUT/DELETE /api/shops/:shopId/staff` - Staff CRUD
- `GET/POST/PUT/DELETE /api/shops/:shopId/courses` - Course CRUD
- `GET/POST/PUT/DELETE /api/shops/:shopId/reservations` - Reservation CRUD
- `GET/PUT/POST /api/shops/:shopId/slots` - Time slot management
- `GET/PUT /api/shops/:shopId/settings` - Store settings
- `GET/POST/PUT /api/shops/:shopId/inquiries` - Customer inquiries
- `GET /api/shops/:shopId/cancel/:token` - Fetch reservation info by cancel token
- `POST /api/shops/:shopId/cancel/:token` - Execute reservation cancel by token
