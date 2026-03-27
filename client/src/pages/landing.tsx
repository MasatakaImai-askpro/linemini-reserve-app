import { useLocation } from "wouter";
import { SiLine } from "react-icons/si";
import { Store, CalendarCheck, ChevronRight, Globe } from "lucide-react";

export default function LandingPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-orange-50 to-amber-50 flex flex-col" data-testid="landing-frame">
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full">
        <div className="mb-10 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center mx-auto mb-5 shadow-lg">
            <span className="text-3xl text-white font-bold">西</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-landing-title">
            神奈川おでかけナビ
          </h1>
          <p className="text-sm text-muted-foreground">デモ環境</p>
        </div>

        <div className="w-full space-y-4">
          <button
            onClick={() => navigate("/line")}
            className="w-full bg-[#06C755] hover:bg-[#05b34d] active:scale-[0.98] rounded-xl p-5 flex items-center gap-4 transition-all shadow-md"
            data-testid="button-landing-line"
          >
            <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <SiLine className="w-7 h-7 text-white" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-base font-bold text-white">LINE公式アカウント</p>
              <p className="text-xs text-white/80">トーク画面のデモ</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/60 flex-shrink-0" />
          </button>

          <button
            onClick={() => navigate("/app")}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.98] rounded-xl p-5 flex items-center gap-4 transition-all shadow-md"
            data-testid="button-landing-app"
          >
            <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <Store className="w-7 h-7 text-white" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-base font-bold text-white">店舗ミニアプリ</p>
              <p className="text-xs text-white/80">お店検索・クーポン・予約</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/60 flex-shrink-0" />
          </button>

          <button
            onClick={() => navigate("/web")}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 active:scale-[0.98] rounded-xl p-5 flex items-center gap-4 transition-all shadow-md"
            data-testid="button-landing-web"
          >
            <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <Globe className="w-7 h-7 text-white" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-base font-bold text-white">WEB版サイト</p>
              <p className="text-xs text-white/80">PC・スマホ対応レスポンシブ表示</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/60 flex-shrink-0" />
          </button>

          <button
            onClick={() => navigate("/admin")}
            className="w-full bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 active:scale-[0.98] rounded-xl p-5 flex items-center gap-4 transition-all shadow-md"
            data-testid="button-landing-admin"
          >
            <div className="w-12 h-12 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
              <CalendarCheck className="w-7 h-7 text-white" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-base font-bold text-white">管理画面</p>
              <p className="text-xs text-white/80">店舗・予約の管理設定</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/60 flex-shrink-0" />
          </button>
        </div>
      </div>

      <div className="px-6 pb-8 pt-4 text-center">
        <p className="text-xs text-muted-foreground">
          &copy; 2026 神奈川おでかけナビ
        </p>
      </div>
    </div>
  );
}
