import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { SiLine } from "react-icons/si";
import { ChevronLeft, Phone, Menu, Plus, Image, Mic, ExternalLink, MapPin, ChevronRight } from "lucide-react";

function DemoStatusBar() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");

  return (
    <div className="flex items-center justify-between px-4 py-1 bg-[#06C755] text-white text-[10px] font-medium">
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

function ChatBubble({ text, time, delay }: { text: string; time: string; delay: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!visible) return null;

  return (
    <div className="flex items-end gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="w-8 h-8 rounded-full bg-[#06C755] flex items-center justify-center flex-shrink-0">
        <SiLine className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white rounded-2xl rounded-bl-md px-3 py-2 max-w-[240px] shadow-sm">
        <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-line">{text}</p>
      </div>
      <span className="text-[9px] text-gray-400 flex-shrink-0 self-end">{time}</span>
    </div>
  );
}

function PinnedNote({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full bg-white/95 backdrop-blur-sm border-b border-gray-200 px-3 py-2 flex items-center gap-2.5 active:bg-gray-50 transition-colors"
      data-testid="button-pinned-note"
    >
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-sm">
        <MapPin className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[#06C755] font-bold">ノート</span>
        </div>
        <p className="text-xs font-bold text-gray-800 truncate">かながわスマイルマップを開く</p>
        <p className="text-[10px] text-gray-500 truncate">お店検索・クーポン・予約はこちら</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
    </button>
  );
}

export default function LineDemoPage() {
  const [, navigate] = useLocation();
  const [transitioning, setTransitioning] = useState(false);

  const handleOpenMiniApp = () => {
    setTransitioning(true);
    setTimeout(() => {
      navigate("/app");
    }, 600);
  };

  return (
    <div className="h-full bg-gray-800 flex items-start justify-center md:py-8 md:px-4" data-testid="line-demo-frame">
      <div
        className={`w-full md:max-w-[375px] md:rounded-[2.5rem] md:overflow-hidden md:shadow-2xl md:border-4 md:border-gray-700 relative bg-[#7494C0] h-full md:h-[min(812px,calc(100dvh-4rem))] flex flex-col transition-all duration-500 ${transitioning ? "scale-95 opacity-0" : ""}`}
      >
        <div className="hidden md:block">
          <DemoStatusBar />
        </div>

        <div className="flex items-center justify-between px-2 py-1.5 bg-[#06C755]">
          <button className="p-1" onClick={() => navigate("/")} data-testid="button-demo-back">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-white">かながわスマイルマップ</span>
            <span className="text-[9px] text-white/70">公式アカウント</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1">
              <Phone className="w-4 h-4 text-white" />
            </button>
            <button className="p-1">
              <Menu className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <PinnedNote onOpen={handleOpenMiniApp} />

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ background: "linear-gradient(180deg, #7494C0 0%, #6B8BB5 100%)" }}>
          <div className="text-center">
            <span className="text-[10px] text-white/60 bg-black/10 rounded-full px-3 py-0.5">今日</span>
          </div>

          <ChatBubble
            text={"友だち追加ありがとうございます！🎉\n\nかながわスマイルマップの公式アカウントです。"}
            time="10:00"
            delay={300}
          />

          <ChatBubble
            text={"神奈川のお得な情報やクーポンをお届けします✨\n\nトーク上部の固定リンクからいつでもスマイルマップを開けます！"}
            time="10:00"
            delay={800}
          />

          <ChatBubble
            text={"🎫 今週のおすすめクーポン\n\n・麺処 小田原屋「ラーメン100円引き」\n・鮨処 匠「握り1貫サービス」\n・Hair Salon MIKU「初回カット20%OFF」"}
            time="10:01"
            delay={1300}
          />
        </div>

        <div className="bg-white border-t border-gray-200 px-2 py-1.5 flex items-center gap-1.5">
          <button className="p-1.5 text-gray-400">
            <Plus className="w-5 h-5" />
          </button>
          <div className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-xs text-gray-400">
            メッセージを入力
          </div>
          <button className="p-1.5 text-gray-400">
            <Image className="w-5 h-5" />
          </button>
          <button className="p-1.5 text-gray-400">
            <Mic className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-white px-4 py-1.5 pb-[env(safe-area-inset-bottom,4px)]">
          <div className="flex items-center justify-center">
            <div className="h-1 w-28 bg-gray-300 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
