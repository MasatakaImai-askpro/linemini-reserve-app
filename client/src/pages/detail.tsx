import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { useBasePath } from "@/hooks/use-base-path";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Phone,
  Globe,
  CalendarOff,
  Ticket,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Map,
  CalendarCheck,
  Bell,
  Heart,
  Star,
  CalendarX2,
  CheckCircle,
  ThumbsUp,
} from "lucide-react";
import { SiLine } from "react-icons/si";
import type { Shop, Coupon } from "@shared/schema";
import { getAreaName, getCategoryName, isRecentlyUpdated } from "@/lib/data";
import { useFavorites } from "@/hooks/use-favorites";
import { useCoupons } from "@/hooks/use-coupons";
import { useLikes } from "@/hooks/use-likes";

function ImageSlider({
  images,
  shopName,
  favorited,
  onToggleFavorite,
  shopId,
  category,
  area,
  recentlyUpdated,
}: {
  images: string[];
  shopName: string;
  favorited: boolean;
  onToggleFavorite: () => void;
  shopId: number;
  category: string;
  area: string;
  recentlyUpdated: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const goTo = useCallback((index: number) => {
    if (index < 0) setCurrentIndex(images.length - 1);
    else if (index >= images.length) setCurrentIndex(0);
    else setCurrentIndex(index);
  }, [images.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      goTo(diff > 0 ? currentIndex + 1 : currentIndex - 1);
    }
  };

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <div
      className="relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-testid="image-slider"
    >
      <div
        className="flex transition-transform duration-300 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((img, i) => (
          <img
            key={i}
            src={img}
            alt={`${shopName} ${i + 1}`}
            className="w-full h-[250px] md:h-[350px] object-cover flex-shrink-0"
            data-testid={`img-shop-detail${i === 0 ? "" : `-${i + 1}`}`}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

      <button
        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center z-10"
        onClick={onToggleFavorite}
        data-testid={`button-favorite-detail-${shopId}`}
      >
        <Heart className={`w-5 h-5 ${favorited ? "fill-red-500 text-red-500" : "text-white"}`} />
      </button>

      {images.length > 1 && (
        <>
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center z-10"
            onClick={() => goTo(currentIndex - 1)}
            data-testid="button-slider-prev"
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center z-10"
            onClick={() => goTo(currentIndex + 1)}
            data-testid="button-slider-next"
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        </>
      )}

      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge variant="secondary" className="bg-white/90 text-foreground text-xs">
            {category}
          </Badge>
          <Badge variant="secondary" className="bg-white/90 text-foreground text-xs">
            <MapPin className="w-3 h-3 mr-0.5" />
            {area}
          </Badge>
          {recentlyUpdated && (
            <Badge className="bg-orange-500 border-orange-500 text-white text-xs">
              <Bell className="w-3 h-3 mr-0.5" />
              情報更新
            </Badge>
          )}
        </div>
        <h1
          className="text-xl md:text-2xl font-bold text-white"
          data-testid="text-detail-shop-name"
        >
          {shopName}
        </h1>
        {images.length > 1 && (
          <div className="flex items-center gap-1.5 mt-2">
            {images.map((_, i) => (
              <button
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentIndex ? "bg-white w-4" : "bg-white/50"
                }`}
                onClick={() => goTo(i)}
                data-testid={`button-slider-dot-${i}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DetailPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const basePath = useBasePath();
  const isWeb = basePath === "/web";

  const { data: shop, isLoading } = useQuery<Shop>({
    queryKey: ["/api/shops", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/shops/${params.id}`);
      if (!res.ok) throw new Error("Shop not found");
      return res.json();
    },
  });

  const { data: shopCoupons = [] } = useQuery<Coupon[]>({
    queryKey: ["/api/shops", params.id, "coupons"],
    queryFn: async () => {
      const res = await fetch(`/api/shops/${params.id}/coupons`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!params.id,
  });

  const { isFavorite, toggleFavorite } = useFavorites();
  const { acquireCoupon, isAcquired } = useCoupons();
  const { liked, count, like } = useLikes(shop?.id || 0);

  if (isLoading) {
    return (
      <div className="bg-background">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="w-full h-[280px] rounded-md" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="bg-background flex items-center justify-center py-20">
        <Card className="p-8 text-center overflow-visible">
          <h2 className="font-bold text-lg mb-2">お店が見つかりませんでした</h2>
          <Button variant="outline" onClick={() => navigate(basePath)}>
            トップページへ戻る
          </Button>
        </Card>
      </div>
    );
  }

  const isExpiredCoupon = (c: { expiryDate?: string | null }) =>
    !!c.expiryDate && new Date(c.expiryDate) < new Date();
  const regularCoupons = shopCoupons.filter((c) => !c.isLineAccountCoupon && !isExpiredCoupon(c));
  const lineCoupons = shopCoupons.filter((c) => c.isLineAccountCoupon && !isExpiredCoupon(c));
  const recentlyUpdated = isRecentlyUpdated(shop.updatedAt);
  const mapQuery = encodeURIComponent(shop.address);
  const favorited = isFavorite(shop.id);

  const galleryImages = shop.galleryImageUrls?.filter(Boolean) || [];
  const sliderImages = galleryImages.length > 0 ? galleryImages : [shop.imageUrl];
  const reservationPath = shop.reservationUrl
    ? shop.reservationUrl.replace(/^\/(app|web|web-sp)\//, `${basePath}/`)
    : null;

  return (
    <div className={`bg-background ${isWeb ? "max-w-6xl mx-auto" : ""}`}>
      <div className={isWeb ? "" : "max-w-3xl mx-auto"}>
        <ImageSlider
          images={sliderImages}
          shopName={shop.name}
          favorited={favorited}
          onToggleFavorite={() => toggleFavorite(shop.id)}
          shopId={shop.id}
          category={getCategoryName(shop.category)}
          area={getAreaName(shop.area)}
          recentlyUpdated={recentlyUpdated}
        />

        {/* いいねバー */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{count}</span> 人がいいねしています
          </p>
          <button
            onClick={like}
            disabled={liked}
            data-testid={`button-like-${shop.id}`}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold transition-all border ${
              liked
                ? "bg-blue-50 border-blue-300 text-blue-500 cursor-default"
                : "bg-white border-border text-foreground hover:bg-blue-50 hover:border-blue-300 hover:text-blue-500 active:scale-95"
            }`}
          >
            <ThumbsUp className={`w-4 h-4 ${liked ? "fill-blue-500 text-blue-500" : ""}`} />
            {liked ? "いいね済み" : "Good!"}
          </button>
        </div>

        <div className={`py-6 space-y-6 ${isWeb ? "px-6 lg:px-8" : "px-4 md:px-6"}`}>
          {regularCoupons.length > 0 && (
            <Card className="overflow-visible border-2 border-[#06C755]/30 bg-gradient-to-br from-[#06C755]/5 to-card">
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#06C755] flex items-center justify-center">
                    <Ticket className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-[#06C755] font-semibold">クーポン</p>
                    <h3 className="font-bold text-base" data-testid="text-coupon-section-title">
                      {regularCoupons.length}件のクーポン
                    </h3>
                  </div>
                </div>

                <div className="space-y-3">
                  {regularCoupons.map((coupon) => (
                    <CouponCard
                      key={coupon.id}
                      coupon={coupon}
                      shopName={shop.name}
                      acquired={isAcquired(coupon.id)}
                      onAcquire={() => acquireCoupon(coupon, shop.name)}
                    />
                  ))}
                </div>
              </div>
            </Card>
          )}

          {lineCoupons.length > 0 && (
            <Card className="overflow-visible border-2 border-[#06C755]/50 bg-gradient-to-br from-[#06C755]/10 to-card">
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-full bg-[#06C755] flex items-center justify-center">
                    <SiLine className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-[#06C755] font-semibold">LINE公式アカウント限定</p>
                    <h3 className="font-bold text-base" data-testid="text-line-coupon-section-title">
                      LINE友だち追加限定クーポン
                    </h3>
                  </div>
                </div>

                <div className="rounded-md bg-[#06C755]/10 border border-[#06C755]/20 px-3 py-2 mb-4 text-xs text-[#065f36] flex items-start gap-1.5">
                  <SiLine className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>このクーポンはLINE公式アカウントを友だち追加した方のみご利用いただけます</span>
                </div>

                <div className="space-y-3 mb-4">
                  {lineCoupons.map((coupon) => (
                    <CouponCard
                      key={coupon.id}
                      coupon={coupon}
                      shopName={shop.name}
                      acquired={isAcquired(coupon.id)}
                      onAcquire={() => acquireCoupon(coupon, shop.name)}
                      isLine
                    />
                  ))}
                </div>

                {shop.lineAccountUrl && (
                  <Button
                    className="w-full bg-[#06C755] border-[#06C755] text-white font-bold text-xs"
                    asChild
                  >
                    <a
                      href={shop.lineAccountUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="link-shop-line-account"
                      className="flex items-center justify-center gap-1.5 whitespace-nowrap overflow-hidden"
                    >
                      <SiLine className="w-5 h-5 flex-shrink-0" />
                      <span className="truncate">公式LINEアカウント追加はこちら</span>
                    </a>
                  </Button>
                )}
              </div>
            </Card>
          )}

          <Card className="overflow-visible p-5">
            <h2 className="font-bold text-base mb-3" data-testid="text-about-title">
              お店について
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground" data-testid="text-shop-description">
              {shop.description}
            </p>
          </Card>

          {reservationPath && (
            <Button
              className="w-full bg-primary text-primary-foreground font-bold py-6 text-base"
              asChild
            >
              <Link href={reservationPath} data-testid="link-reservation-mid">
                <CalendarCheck className="w-5 h-5 mr-2" />
                予約する
              </Link>
            </Button>
          )}

          <Card className="overflow-visible p-5">
            <h2 className="font-bold text-base mb-3" data-testid="text-info-title">
              店舗情報
            </h2>
            <div className="space-y-3">
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="住所" value={shop.address} testId="text-address" />
              {shop.phone && (
                <InfoRow icon={<Phone className="w-4 h-4" />} label="電話番号" value={shop.phone} testId="text-phone" />
              )}
              {shop.hours && (
                <InfoRow icon={<Clock className="w-4 h-4" />} label="営業時間" value={shop.hours} testId="text-hours" />
              )}
              {shop.closedDays && (
                <InfoRow icon={<CalendarOff className="w-4 h-4" />} label="定休日" value={shop.closedDays} testId="text-closed" />
              )}
              {shop.website && (
                <div className="flex items-start gap-3 text-sm">
                  <Globe className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">ウェブサイト</p>
                    <a
                      href={shop.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary flex items-center gap-1"
                      data-testid="link-website"
                    >
                      {shop.website}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="overflow-visible p-5">
            <div className="flex items-center gap-2 mb-3">
              <Map className="w-4 h-4 text-primary" />
              <h2 className="font-bold text-base" data-testid="text-map-title">アクセス</h2>
            </div>
            <div className="rounded-md overflow-hidden border border-card-border">
              <iframe
                src={`https://maps.google.com/maps?q=${mapQuery}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                width="100%"
                height="300"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`${shop.name}の地図`}
                data-testid="iframe-google-map"
              />
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary flex items-center gap-1 mt-2"
              data-testid="link-google-maps"
            >
              <ExternalLink className="w-3 h-3" />
              Google Mapsで開く
            </a>
          </Card>

          {reservationPath && (
            <Button
              className="w-full bg-primary text-primary-foreground font-bold py-6 text-base"
              asChild
            >
              <Link href={reservationPath} data-testid="link-reservation-bottom">
                <CalendarCheck className="w-5 h-5 mr-2" />
                予約する
              </Link>
            </Button>
          )}

          <div className="flex items-center justify-center gap-2 py-4">
            <Button variant="outline" onClick={() => navigate(basePath)} data-testid="button-back-bottom">
              <ArrowLeft className="w-4 h-4 mr-1" />
              戻る
            </Button>
            <Button variant="outline" asChild>
              <Link href={basePath} data-testid="link-top-bottom">
                トップページ
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {!isWeb && (
        <footer className="bg-card border-t py-6 px-4 mt-4">
          <div className="max-w-3xl mx-auto text-center">
            <Link href={basePath}>
              <span className="text-sm font-bold text-primary cursor-pointer" data-testid="link-footer-detail-home">
                神奈川おでかけナビ
              </span>
            </Link>
            <p className="text-xs text-muted-foreground mt-2">
              &copy; 2026 神奈川おでかけナビ All Rights Reserved.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}

function CouponCard({
  coupon,
  shopName,
  acquired,
  onAcquire,
  isLine = false,
}: {
  coupon: Coupon;
  shopName: string;
  acquired: boolean;
  onAcquire: () => void;
  isLine?: boolean;
}) {
  const borderColor = isLine ? "border-[#06C755]/20" : "border-card-border";
  const expired = coupon.expiryDate ? new Date(coupon.expiryDate) < new Date() : false;

  return (
    <div
      className={`bg-card rounded-md p-4 border ${borderColor} ${expired ? "opacity-60" : ""}`}
      data-testid={`card-coupon-${coupon.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {coupon.isFirstTimeOnly && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                初回限定
              </span>
            )}
            {expired && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                期限切れ
              </span>
            )}
          </div>
          <h4 className="font-bold text-sm mb-1">{coupon.title}</h4>
          {coupon.discount && (
            <p className="text-lg font-bold text-[#06C755] mb-1">{coupon.discount}</p>
          )}
          {coupon.description && (
            <p className="text-xs text-muted-foreground">{coupon.description}</p>
          )}
          {coupon.expiryDate && (
            <div className={`flex items-center gap-1 mt-1.5 text-[10px] ${expired ? "text-red-500" : "text-muted-foreground"}`}>
              <CalendarX2 className="w-3 h-3" />
              有効期限: {new Date(coupon.expiryDate).toLocaleDateString("ja-JP")}
            </div>
          )}
        </div>

        <button
          onClick={onAcquire}
          disabled={acquired || expired}
          className={`flex-shrink-0 flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
            acquired
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : expired
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-[#06C755] text-white hover:bg-[#05a847] active:scale-95"
          }`}
          data-testid={`button-acquire-coupon-${coupon.id}`}
        >
          {acquired ? (
            <>
              <CheckCircle className="w-3.5 h-3.5" />
              取得済み
            </>
          ) : (
            <>
              <Ticket className="w-3.5 h-3.5" />
              取得する
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="font-medium" data-testid={testId}>{value}</p>
      </div>
    </div>
  );
}
