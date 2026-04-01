import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useBasePath } from "@/hooks/use-base-path";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  MapPin,
  ChevronRight,
  Ticket,
  UtensilsCrossed,
  Sparkles,
  ShoppingBag,
  MapPinned,
  Wrench,
  HeartPulse,
  ChevronLeft,
  RefreshCw,
  Bell,
  Heart,
} from "lucide-react";
import { AREAS, CATEGORIES } from "@shared/schema";
import type { Shop, Coupon } from "@shared/schema";
import { getCategoryName, getAreaName, isRecentlyUpdated, sortByUpdatedAt } from "@/lib/data";
import KanagawaMap from "@/components/kanagawa-map";
import { useFavorites } from "@/hooks/use-favorites";

const categoryIcons: Record<string, any> = {
  gourmet: UtensilsCrossed,
  beauty: Sparkles,
  shopping: ShoppingBag,
  leisure: MapPinned,
  service: Wrench,
  medical: HeartPulse,
};

function HeroSection({ isWeb }: { isWeb?: boolean }) {
  return (
    <div className={`relative w-full overflow-hidden ${isWeb ? "h-[260px]" : "h-[160px]"}`}>
      <img
        src="/images/hero-kanagawa.png"
        alt="Kanagawa"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center">
        <Badge
          variant="secondary"
          className="mb-2 bg-white/20 text-white border-white/30 backdrop-blur-sm text-[10px] px-2 py-0.5"
          data-testid="badge-portal-label"
        >
          <MapPin className="w-2.5 h-2.5 mr-0.5" />
          神奈川県全域・静岡県東部
        </Badge>
        <h1
          className={`font-bold text-white mb-1 tracking-tight ${isWeb ? "text-3xl" : "text-lg"}`}
          data-testid="text-hero-title"
        >
          神奈川おでかけナビ
        </h1>
        <p
          className={`text-white/80 leading-relaxed ${isWeb ? "text-sm mt-1" : "text-[10px]"}`}
          data-testid="text-hero-description"
        >
          神奈川県・静岡県東部エリアのお店をまとめてご紹介
        </p>
      </div>
    </div>
  );
}

function SearchBar({
  onSearch,
  isWeb,
}: {
  onSearch: (area: string, category: string, keyword: string) => void;
  isWeb?: boolean;
}) {
  const [area, setArea] = useState("all");
  const [category, setCategory] = useState("all");
  const [keyword, setKeyword] = useState("");

  const handleSearch = () => {
    onSearch(area, category, keyword);
  };

  if (isWeb) {
    return (
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-card border border-card-border rounded-xl p-4 -mt-8 relative z-20 shadow-lg">
          <div className="flex flex-wrap gap-3 items-end">
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger className="w-[160px]" data-testid="select-area">
                <MapPin className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                <SelectValue placeholder="エリア" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべてのエリア</SelectItem>
                {AREAS.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[140px]" data-testid="select-category">
                <SelectValue placeholder="業種" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての業種</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex flex-1 min-w-[200px] gap-2">
              <Input
                placeholder="キーワードで検索..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
                data-testid="input-keyword"
              />
              <Button onClick={handleSearch} data-testid="button-search">
                <Search className="w-4 h-4 mr-1" />
                検索
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-card-border rounded-md p-2.5 -mt-6 relative z-20 mx-3">
      <div className="flex flex-col gap-2">
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger data-testid="select-area">
            <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="エリアを選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべてのエリア</SelectItem>
            {AREAS.map((a) => (
              <SelectItem key={a.slug} value={a.slug}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger data-testid="select-category">
            <SelectValue placeholder="業種を選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての業種</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-1 gap-2">
          <Input
            placeholder="キーワードで検索..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
            data-testid="input-keyword"
          />
          <Button onClick={handleSearch} data-testid="button-search">
            <Search className="w-4 h-4 mr-1" />
            検索
          </Button>
        </div>
      </div>
    </div>
  );
}

function AutoScrollRow({ shops, title, categoryId, icon, isWeb }: { shops: Shop[]; title: string; categoryId: string; icon?: any; isWeb?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const animationRef = useRef<number>();
  const scrollSpeedRef = useRef(0.5);
  const basePath = useBasePath();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isWeb) return;
    const container = scrollRef.current;
    if (!container || shops.length <= 2) return;
    const animate = () => {
      if (!isPaused && container) {
        const maxScroll = container.scrollWidth - container.clientWidth
        if (container.scrollLeft < maxScroll -1) {
          container.scrollLeft += scrollSpeedRef.current;
        } else {
        }
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isPaused, shops.length, isWeb]);

  const scroll = (direction: "left" | "right") => {
    const container = scrollRef.current;
    if (!container) return;

    const firstCard = container.querySelector(":first-child") as HTMLElement;
    if(!firstCard) return;

    const cardWidth = firstCard.getBoundingClientRect().width;
    const gap = 10;
    const scrollAmount = (cardWidth + gap) * 2;

    const currentScroll = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;

    // 右クリックで既に右端にいるなら何もしない
    if (direction === "right" && currentScroll >= maxScroll - 5) return;
    // 左クリックで既に左端にいるなら何もしない
    if (direction === "left" && currentScroll <= 5) return;

    setIsPaused(true);
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
    setTimeout(() => {
      setIsPaused(false);
    }, 500)
  };

  const IconComponent = icon || categoryIcons[categoryId] || MapPinned;
  if (shops.length === 0) return null;

  return (
    <section className={`mb-6 ${isWeb ? "" : "mb-4"}`} data-testid={`section-category-${categoryId}`}>
      <div className={`flex items-center justify-between mb-2 ${isWeb ? "px-4" : "px-3"}`}>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
            <IconComponent className="w-3 h-3 text-primary" />
          </div>
          <h2 className={`font-bold ${isWeb ? "text-base" : "text-sm"}`} data-testid={`text-category-title-${categoryId}`}>
            {title}
          </h2>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {shops.length}件
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {!isWeb && (
            <>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => scroll("left")} data-testid={`button-scroll-left-${categoryId}`}>
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => scroll("right")} data-testid={`button-scroll-right-${categoryId}`}>
                <ChevronRight className="w-3 h-3" />
              </Button>
            </>
          )}
          {isWeb && (
            <button
              onClick={() => navigate(`${basePath}/list?category=${categoryId}`)}
              className="text-xs text-primary flex items-center gap-0.5 hover:underline"
            >
              すべて見る <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {isWeb ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 px-4">
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} isWeb />
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto scrollbar-hide px-3 pb-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      )}
    </section>
  );
}

function ShopCard({ shop, isWeb }: { shop: Shop; isWeb?: boolean }) {
  const [, navigate] = useLocation();
  const basePath = useBasePath();
  const { isFavorite, toggleFavorite } = useFavorites();
  const recentlyUpdated = isRecentlyUpdated(shop.updatedAt);
  const favorited = isFavorite(shop.id);

  return (
    <Card
      className={`overflow-visible cursor-pointer hover-elevate active-elevate-2 transition-transform ${isWeb ? "w-full" : "flex-shrink-0 w-[160px]"}`}
      onClick={() => navigate(`${basePath}/shop/${shop.id}`)}
      data-testid={`card-shop-${shop.id}`}
    >
      <div className="relative">
        <img
          src={shop.imageUrl}
          alt={shop.name}
          className={`w-full object-cover rounded-t-md ${isWeb ? "h-[150px]" : "h-[100px]"}`}
          loading="lazy"
        />
        <button
          className="absolute top-1 left-1 w-7 h-7 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); toggleFavorite(shop.id); }}
          data-testid={`button-favorite-shop-${shop.id}`}
        >
          <Heart className={`w-4 h-4 ${favorited ? "fill-red-500 text-red-500" : "text-white"}`} />
        </button>
        {recentlyUpdated && (
          <Badge className="absolute top-1 right-1 bg-orange-500 border-orange-500 text-white text-[9px] px-1.5 py-0">
            <Bell className="w-2.5 h-2.5 mr-0.5" />
            更新
          </Badge>
        )}
      </div>
      <div className="p-2">
        <div className="flex items-center gap-1 mb-0.5">
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {getCategoryName(shop.category)}
          </Badge>
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <MapPin className="w-2.5 h-2.5" />
            {getAreaName(shop.area)}
          </span>
        </div>
        <h3 className={`font-semibold line-clamp-1 ${isWeb ? "text-sm" : "text-xs"}`} data-testid={`text-shop-name-${shop.id}`}>
          {shop.name}
        </h3>
        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
          {shop.description}
        </p>
      </div>
    </Card>
  );
}

function AreaMapSection() {
  return (
    <section className="mb-4 px-3">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
          <MapPinned className="w-3 h-3 text-primary" />
        </div>
        <h2 className="text-sm font-bold" data-testid="text-area-map-title">エリアから探す</h2>
      </div>

      <div className="overflow-hidden rounded-lg bg-amber-50/50 border border-amber-100">
        <KanagawaMap />
      </div>
    </section>
  );
}

function CategoryGrid({ isWeb }: { isWeb?: boolean }) {
  const [, navigate] = useLocation();
  const basePath = useBasePath();

  return (
    <section className={`mb-4 ${isWeb ? "px-4 py-6" : "px-3"}`}>
      <div className="flex items-center gap-1.5 mb-3">
        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
          <Search className="w-3 h-3 text-primary" />
        </div>
        <h2 className={`font-bold ${isWeb ? "text-base" : "text-sm"}`} data-testid="text-category-grid-title">ジャンルから探す</h2>
      </div>

      <div className={`grid gap-2 ${isWeb ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-3"}`}>
        {CATEGORIES.map((cat) => {
          const Icon = categoryIcons[cat.id] || MapPinned;
          return (
            <Card
              key={cat.id}
              className={`flex flex-col items-center gap-1.5 cursor-pointer hover-elevate active-elevate-2 overflow-visible ${isWeb ? "p-4" : "p-2.5"}`}
              onClick={() => navigate(`${basePath}/list?category=${cat.id}`)}
              data-testid={`card-category-${cat.id}`}
            >
              <div className={`rounded-full bg-primary/10 flex items-center justify-center ${isWeb ? "w-12 h-12" : "w-8 h-8"}`}>
                <Icon className={`text-primary ${isWeb ? "w-6 h-6" : "w-4 h-4"}`} />
              </div>
              <span className={`font-medium text-center ${isWeb ? "text-sm" : "text-[10px]"}`}>{cat.name}</span>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function CouponUpdateSection({ coupons, shops, isWeb }: { coupons: Coupon[]; shops: Shop[]; isWeb?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const animationRef = useRef<number>();
  const [, navigate] = useLocation();
  const basePath = useBasePath();

  useEffect(() => {
    if (isWeb) return;
    const container = scrollRef.current;
    if (!container || coupons.length <= 2) return;
    const animate = () => {
      if (!isPaused && container) {
        // 現在の端っこまでの余裕を計算
        const maxScroll = container.scrollWidth - container.clientWidth;
        
        // 端に達していない時だけ進める
        if (container.scrollLeft < maxScroll) {
          container.scrollLeft += 0.5;
        } else {
        }
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isPaused, coupons.length, isWeb]);

  const scroll = (direction: "left" | "right") => {
    const container = scrollRef.current;
    if (!container) return;

    const firstCard = container.querySelector(":first-child") as HTMLElement;
    if (!firstCard) return;

    const cardWidth = firstCard.getBoundingClientRect().width;
    const gap = 10;

    const scrollAmount = (cardWidth + gap) * 2;

    const currentScroll = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;

    if (direction === "right" && currentScroll >= maxScroll - 5) return;
    if (direction === "left" && currentScroll <= 5) return;

    setIsPaused(true)
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });

    setTimeout(() => {
      setIsPaused(false);
    }, 500)
  };

  const latestCouponsMap = new Map();
  const hasOtherCouponsMap = new Map();

  const sortedCoupons = [...coupons].sort((a, b) =>
    new Date (b.createdAt).getTime() - new Date (a.createdAt).getTime()
  );

  sortedCoupons.forEach((coupon) => {
    if(!hasOtherCouponsMap.has(coupon.shopId)) {
      latestCouponsMap.set(coupon.shopId, coupon);
      hasOtherCouponsMap.set(coupon.shopId, false);
    } else {
      hasOtherCouponsMap.set(coupon.shopId, true)
    }
  });

  const displayCoupons = Array.from(latestCouponsMap.values());

  const CouponCard = ({ 
    coupon, 
    hasOthers 
  }: { 
    coupon: any; 
    hasOthers?: boolean 
  }) => {
    const shop = shops.find((s) => s.id === coupon.shopId);
    if (!shop) return null;

    return (
      <Card
        className={`flex-shrink-0 overflow-visible cursor-pointer hover-elevate active-elevate-2 transition-transform ${
          isWeb ? "w-full" : "w-[160px]"
        }`}
        onClick={() => navigate(`${basePath}/shop/${shop.id}`)}
        data-testid={`card-coupon-update-${coupon.id}`}
      >
        <div className="relative">
          <img
            src={shop.imageUrl}
            alt={shop.name}
            className={`w-full object-cover rounded-t-md ${isWeb ? "h-[110px]" : "h-[80px]"}`}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-t-md" />
          <div className="absolute bottom-1 left-2 right-2">
            <p className="text-white text-[10px] font-bold line-clamp-1">{shop.name}</p>
          </div>
          
          {/* クーポンバッジ */}
          <Badge className="absolute top-1 right-1 bg-[#06C755] border-[#06C755] text-white text-[8px] px-1 py-0 gap-0.5">
            <Ticket className="w-2 h-2" /> クーポン
          </Badge>

          {/* その他クーポンありバッジ (アプリ版の横スクロール時などに表示) */}
          {hasOthers && (
          <Badge 
              variant="outline" 
              className={`
                absolute text-[8px] px-1 py-0 border-zinc-300 text-zinc-700 bg-zinc-100 shadow-sm
                ${isWeb 
                  ? "-top-28 left-24"
                  : "-top-20 left-12"
                }
              `}
            >
              その他あり
            </Badge>
          )}
        </div>

        <div className="p-2">
          <div className="flex flex-wrap items-center gap-1 mb-1">
            {coupon.isLineAccountCoupon && (
              <Badge className="bg-[#06C755] border-[#06C755] text-white text-[9px] px-1 py-0">LINE限定</Badge>
            )}
            <Badge variant="secondary" className="text-[9px] px-1 py-0 font-bold text-[#06C755]">
              {coupon.discount}
            </Badge>
          </div>
          <h3 className="font-bold text-xs line-clamp-1">{coupon.title}</h3>
          {coupon.description && (
            <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{coupon.description}</p>
          )}
        </div>
      </Card>
    );
  };


  return (
    <section className="mb-4" data-testid="section-coupon-updates">
      <div className={`flex items-center justify-between mb-2 ${isWeb ? "" : "px-3"}`}>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded bg-[#06C755]/10 flex items-center justify-center">
            <Ticket className="w-3 h-3 text-[#06C755]" />
          </div>
          <h2 className={`font-bold ${isWeb ? "text-base" : "text-sm"}`} data-testid="text-coupon-update-title">
            クーポン更新！
          </h2>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-[#06C755]/10 text-[#06C755]">
            <RefreshCw className="w-2.5 h-2.5 mr-0.5" />
            NEW
          </Badge>
        </div>
        {!isWeb && (
          <div className="flex items-center gap-0.5">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => scroll("left")} data-testid="button-coupon-scroll-left">
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => scroll("right")} data-testid="button-coupon-scroll-right">
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {isWeb ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {displayCoupons.slice(0, 10).map((coupon) => (
            <CouponCard 
              key={coupon.id} 
              coupon={coupon} 
              hasOthers={hasOtherCouponsMap.get(coupon.shopId)} 
            />
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto scrollbar-hide px-3 pb-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {displayCoupons.map((coupon) => (
            <CouponCard 
              key={coupon.id} 
              coupon={coupon} 
              hasOthers={hasOtherCouponsMap.get(coupon.shopId)} 
            />
          ))}
        </div>
      )}

    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 px-3 mt-4">
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <Skeleton className="h-4 w-24 mb-2" />
          <div className="flex gap-2.5">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="w-[160px] h-[160px] rounded-md flex-shrink-0" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const [, navigate] = useLocation();
  const basePath = useBasePath();
  const isWeb = basePath === "/web";
  const { data: shops = [], isLoading } = useQuery<Shop[]>({
    queryKey: ["/api/shops"],
  });

  const { data: allCoupons = [] } = useQuery<Coupon[]>({
    queryKey: ["/api/coupons"],
  });


  const handleSearch = (area: string, category: string, keyword: string) => {
    const params = new URLSearchParams();
    if (area && area !== "all") params.set("area", area);
    if (category && category !== "all") params.set("category", category);
    if (keyword) params.set("q", keyword);
    navigate(`${basePath}/list?${params.toString()}`);
  };

  const groupedShops: Record<string, Shop[]> = {};
  for (const shop of shops) {
    if (!groupedShops[shop.category]) {
      groupedShops[shop.category] = [];
    }
    groupedShops[shop.category].push(shop);
  }

  for (const key of Object.keys(groupedShops)) {
    groupedShops[key] = sortByUpdatedAt(groupedShops[key]);
  }

  const { favorites } = useFavorites();
  const favoriteShops = shops.filter((s) => favorites.includes(s.id));

  const recentCoupons = [...allCoupons]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  return (
    <div className="bg-background">
      <HeroSection isWeb={isWeb} />
      <SearchBar onSearch={handleSearch} isWeb={isWeb} />

      <div className={`mt-4 ${isWeb ? "max-w-6xl mx-auto px-4" : ""}`}>
        {!isWeb && <AreaMapSection />}
        <CategoryGrid isWeb={isWeb} />

        {!isLoading && recentCoupons.length > 0 && (
          <CouponUpdateSection coupons={recentCoupons} shops={shops} isWeb={isWeb} />
        )}

        {!isLoading && favoriteShops.length > 0 && (
          <section className={`mb-4 ${isWeb ? "" : "px-3"}`} data-testid="section-favorites">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded bg-red-500/10 flex items-center justify-center">
                  <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                </div>
                <h2 className={`font-bold ${isWeb ? "text-base" : "text-sm"}`}>お気に入り</h2>
              </div>
              <Link href={`${basePath}/list?fav=1`}>
                <span className="text-xs text-primary cursor-pointer flex items-center gap-0.5" data-testid="link-favorites-all">
                  すべて見る
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            </div>
            {isWeb ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {favoriteShops.map((shop) => (
                  <ShopCard key={shop.id} shop={shop} isWeb />
                ))}
              </div>
            ) : (
              <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
                {favoriteShops.map((shop) => (
                  <ShopCard key={shop.id} shop={shop} />
                ))}
              </div>
            )}
          </section>
        )}

        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {CATEGORIES.map((cat) => {
              const catShops = groupedShops[cat.slug] || [];
              return (
                <AutoScrollRow
                  key={cat.slug}
                  shops={catShops}
                  title={cat.name}
                  categoryId={cat.slug}
                  isWeb={isWeb}
                />
              );
            })}
          </>
        )}
      </div>

      {!isWeb && (
        <footer className="bg-card border-t py-4 px-3">
          <div className="text-center">
            <p className="font-bold text-primary text-xs mb-1" data-testid="text-footer-title">
              神奈川おでかけナビ
            </p>
            <p className="text-[10px] text-muted-foreground mb-2">
              神奈川県全域・静岡県東部エリアの商店街・組合加盟店のポータルサイト
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {AREAS.map((a) => (
                <Link key={a.id} href={`${basePath}/list?area=${a.id}`}>
                  <span className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors" data-testid={`link-footer-area-${a.id}`}>
                    {a.name}
                  </span>
                </Link>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              &copy; 2026 神奈川おでかけナビ
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
