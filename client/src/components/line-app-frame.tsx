import { type ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { X, Home, ChevronLeft, Ticket, CalendarX2, Star, Store } from "lucide-react";
import { SiLine } from "react-icons/si";
import { useCoupons, type AcquiredCoupon } from "@/hooks/use-coupons";

function LineStatusBar() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");

  return (
    <div className="flex items-center justify-between px-4 py-1 bg-black text-white text-[10px] font-medium">
      <span>{hours}:{minutes}</span>
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5">
          <div className="w-1 h-1.5 bg-white rounded-sm" />
          <div className="w-1 h-2 bg-white rounded-sm" />
          <div className="w-1 h-2.5 bg-white rounded-sm" />
          <div className="w-1 h-3 bg-white/40 rounded-sm" />
        </div>
        <span className="ml-1">5G</span>
        <div className="w-5 h-2.5 border border-white rounded-sm ml-1 relative">
          <div className="absolute inset-0.5 bg-white rounded-[1px]" style={{ width: "60%" }} />
        </div>
      </div>
    </div>
  );
}

function isExpired(expiryDate?: string | null): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
}

function CouponWalletModal({ onClose }: { onClose: () => void }) {
  const { acquired, clearAll } = useCoupons();
  const valid = acquired.filter((c) => !isExpired(c.expiryDate));
  const expired = acquired.filter((c) => isExpired(c.expiryDate));

  return (
    <div
      className="absolute inset-0 bg-black/50 z-[200] flex flex-col"
      onClick={onClose}
      data-testid="modal-coupon-wallet"
    >
      <div
        className="bg-background mt-auto rounded-t-2xl max-h-[75%] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm">取得済みクーポン</h2>
            {valid.length > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-1.5 py-0.5">
                {valid.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted"
            data-testid="button-close-coupon-wallet"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {acquired.length === 0 ? (
            <div className="text-center py-10">
              <Ticket className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">まだクーポンを取得していません</p>
              <p className="text-xs text-muted-foreground mt-1">店舗ページでクーポンを取得してください</p>
            </div>
          ) : (
            <>
              {valid.map((c) => (
                <CouponWalletCard key={c.id} coupon={c} />
              ))}
              {expired.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground font-semibold pt-2">期限切れ</p>
                  {expired.map((c) => (
                    <CouponWalletCard key={c.id} coupon={c} faded />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {acquired.length > 0 && (
          <div className="px-4 pb-4 border-t pt-3">
            <button
              onClick={() => { clearAll(); }}
              className="text-xs text-muted-foreground underline"
              data-testid="button-clear-coupons"
            >
              すべてクリア
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CouponWalletCard({ coupon, faded }: { coupon: AcquiredCoupon; faded?: boolean }) {
  return (
    <div className={`rounded-lg border overflow-hidden ${faded ? "opacity-50 border-border" : "border-primary/30"}`} data-testid={`wallet-coupon-${coupon.id}`}>
      {/* 店名ヘッダー */}
      <div className={`flex items-center gap-1.5 px-3 py-1.5 ${faded ? "bg-muted" : "bg-primary"}`}>
        <Store className="w-3.5 h-3.5 text-white flex-shrink-0" />
        <p className="text-sm font-bold text-white truncate">{coupon.shopName}</p>
      </div>
      {/* クーポン内容 */}
      <div className={`p-3 ${faded ? "" : "bg-primary/5"}`}>
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          {coupon.isFirstTimeOnly && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
              初回限定
            </span>
          )}
          {coupon.isLineAccountCoupon && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-[#06C755]/10 text-[#06C755] px-1.5 py-0.5 rounded">
              <SiLine className="w-2.5 h-2.5" />
              LINE限定
            </span>
          )}
        </div>
        <p className="font-bold text-sm">{coupon.title}</p>
        {coupon.discount && <p className="text-primary font-bold text-base mt-0.5">{coupon.discount}</p>}
        {coupon.description && <p className="text-xs text-muted-foreground mt-0.5">{coupon.description}</p>}
        {coupon.expiryDate && (
          <div className={`flex items-center gap-1 mt-2 text-[10px] ${faded ? "text-red-500" : "text-muted-foreground"}`}>
            <CalendarX2 className="w-3 h-3" />
            {faded ? "期限切れ: " : "有効期限: "}
            {new Date(coupon.expiryDate).toLocaleDateString("ja-JP")}
          </div>
        )}
      </div>
    </div>
  );
}

function LineHeader() {
  const [location, navigate] = useLocation();
  const [walletOpen, setWalletOpen] = useState(false);
  const { acquired } = useCoupons();
  const validCount = acquired.filter((c) => !isExpired(c.expiryDate)).length;

  const isHome = location === "/app";
  const getTitle = () => {
    if (isHome) return "かながわスマイルマップ";
    if (location.startsWith("/app/list")) return "お店一覧";
    if (location.startsWith("/app/shop/")) return "お店詳細";
    if (location.startsWith("/app/reservation/")) return "予約";
    return "かながわスマイルマップ";
  };

  return (
    <>
      <div className="flex items-center justify-between px-2 py-1.5 bg-white border-b border-gray-200 sticky top-0 z-50" data-testid="line-header">
        <div className="flex items-center gap-1 min-w-[50px]">
          {!isHome ? (
            <button
              onClick={() => window.history.back()}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              data-testid="button-line-back"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
          ) : (
            <div className="p-1">
              <SiLine className="w-4 h-4 text-[#06C755]" />
            </div>
          )}
        </div>
        <h1 className="text-xs font-semibold text-gray-900 truncate" data-testid="text-line-header-title">
          {getTitle()}
        </h1>
        <div className="flex items-center gap-0.5 min-w-[50px] justify-end">
          <button
            onClick={() => setWalletOpen(true)}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors relative"
            data-testid="button-coupon-wallet"
          >
            <Ticket className="w-3.5 h-3.5 text-gray-500" />
            {validCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary rounded-full text-[8px] font-bold text-primary-foreground flex items-center justify-center">
                {validCount > 9 ? "9+" : validCount}
              </span>
            )}
          </button>
          {!isHome && (
            <button
              onClick={() => navigate("/app")}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              data-testid="button-line-home"
            >
              <Home className="w-3.5 h-3.5 text-gray-500" />
            </button>
          )}
        </div>
      </div>
      {walletOpen && <CouponWalletModal onClose={() => setWalletOpen(false)} />}
    </>
  );
}

function LineBottomBar() {
  return (
    <div className="bg-white border-t border-gray-100 px-4 py-1.5 pb-[env(safe-area-inset-bottom,4px)]">
      <div className="flex items-center justify-center">
        <div className="h-1 w-28 bg-gray-300 rounded-full" />
      </div>
    </div>
  );
}

export default function LineAppFrame({ children }: { children: ReactNode }) {
  // const [location] = useLocation();
  // const isHome = location === "/app";
  return (
    <div className="h-dvh bg-gray-800 flex items-start justify-center md:py-8 md:px-4 overflow-hidden" data-testid="line-app-frame">
      <div className="w-full md:max-w-[375px] md:rounded-[2.5rem] md:overflow-hidden md:shadow-2xl md:border-4 md:border-gray-700 relative bg-background h-full md:h-[min(812px,calc(100dvh-4rem))] flex flex-col">
        <div className="hidden md:block">
          <LineStatusBar />
        </div>
        {/* {!isHome && <LineHeader />} */}
        <LineHeader />
        <div className="flex-1 overflow-y-auto overflow-x-hidden" data-testid="line-app-content">
          {children}
        </div>
        {/* <LineBottomBar /> */}
      </div>
    </div>
  );
}
