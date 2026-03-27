import { type ReactNode, useState } from "react";
import { useLocation, Link } from "wouter";
import { Home, List, Ticket, CalendarX2, ChevronLeft, Menu, X as XIcon } from "lucide-react";
import { useCoupons, type AcquiredCoupon } from "@/hooks/use-coupons";

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
      className="fixed inset-0 bg-black/50 z-[200] flex items-end sm:items-center justify-center"
      onClick={onClose}
      data-testid="modal-coupon-wallet"
    >
      <div
        className="bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] flex flex-col"
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
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {acquired.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">クーポンはまだありません</p>
          )}
          {valid.map((c) => <WalletCouponRow key={c.id} coupon={c} />)}
          {expired.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground pt-3 pb-1">期限切れ</p>
              {expired.map((c) => <WalletCouponRow key={c.id} coupon={c} faded />)}
            </>
          )}
        </div>
        {acquired.length > 0 && (
          <div className="px-4 pb-4 pt-2 border-t">
            <button onClick={() => { clearAll(); onClose(); }} className="text-xs text-destructive hover:underline">
              すべてクリア
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function WalletCouponRow({ coupon, faded }: { coupon: AcquiredCoupon; faded?: boolean }) {
  return (
    <div className={`flex gap-3 p-3 rounded-lg border ${faded ? "opacity-50" : "bg-background"}`}>
      <div className={`w-1 rounded-full flex-shrink-0 ${coupon.isLineAccountCoupon ? "bg-[#06C755]" : "bg-primary"}`} />
      <div className="flex-1 min-w-0">
        {coupon.isLineAccountCoupon && (
          <span className="text-[10px] font-bold bg-[#06C755] text-white px-1.5 py-0.5 rounded mb-1 inline-block">LINE限定</span>
        )}
        <p className="font-bold text-sm">{coupon.title}</p>
        {coupon.discount && <p className="text-primary font-bold text-sm">{coupon.discount}</p>}
        {coupon.expiryDate && (
          <p className={`text-[10px] mt-1 flex items-center gap-1 ${faded ? "text-red-500" : "text-muted-foreground"}`}>
            <CalendarX2 className="w-3 h-3" />
            {faded ? "期限切れ: " : "有効期限: "}{new Date(coupon.expiryDate).toLocaleDateString("ja-JP")}
          </p>
        )}
      </div>
    </div>
  );
}

export function WebAppFrame({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [walletOpen, setWalletOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { acquired } = useCoupons();
  const validCount = acquired.filter((c) => !isExpired(c.expiryDate)).length;

  const isHome = location === "/web" || location === "/web/";
  const isListPage = location.startsWith("/web/list");

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col" data-testid="web-app-frame">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-4 h-14">
          {!isHome && (
            <button
              onClick={() => window.history.back()}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
              data-testid="button-web-back"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}

          <Link href="/web" className="flex items-center gap-2 flex-shrink-0 mr-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-sm">
              <span className="text-sm text-white font-bold">西</span>
            </div>
            <span className="font-bold text-sm text-gray-900 hidden sm:block">神奈川おでかけナビ</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/web"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isHome ? "bg-orange-50 text-orange-600" : "text-gray-600 hover:bg-gray-100"
              }`}
              data-testid="link-web-home"
            >
              <Home className="w-4 h-4" />
              トップ
            </Link>
            <Link
              href="/web/list"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isListPage ? "bg-orange-50 text-orange-600" : "text-gray-600 hover:bg-gray-100"
              }`}
              data-testid="link-web-list"
            >
              <List className="w-4 h-4" />
              お店一覧
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setWalletOpen(true)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors relative"
              data-testid="button-web-coupon-wallet"
              aria-label="クーポンウォレット"
            >
              <Ticket className="w-5 h-5 text-gray-600" />
              {validCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                  {validCount > 9 ? "9+" : validCount}
                </span>
              )}
            </button>
            <button
              className="md:hidden p-2 rounded-full hover:bg-gray-100 transition-colors"
              onClick={() => setMenuOpen((v) => !v)}
              data-testid="button-web-menu"
              aria-label="メニュー"
            >
              {menuOpen ? <XIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t bg-white px-4 py-2 shadow-md">
            <Link href="/web" className="flex items-center gap-2 py-3 text-sm font-medium text-gray-700 border-b" onClick={() => setMenuOpen(false)}>
              <Home className="w-4 h-4 text-primary" /> トップ
            </Link>
            <Link href="/web/list" className="flex items-center gap-2 py-3 text-sm font-medium text-gray-700" onClick={() => setMenuOpen(false)}>
              <List className="w-4 h-4 text-primary" /> お店一覧
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1 w-full">
        {children}
      </main>

      <footer className="bg-white border-t py-6 mt-4">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="font-bold text-primary text-sm mb-1">神奈川おでかけナビ</p>
          <p className="text-xs text-muted-foreground">&copy; 2026 神奈川おでかけナビ</p>
        </div>
      </footer>

      {walletOpen && <CouponWalletModal onClose={() => setWalletOpen(false)} />}
    </div>
  );
}
