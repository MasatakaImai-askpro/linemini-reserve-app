import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useLogout } from "@/hooks/use-auth";
import { LogOut } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Settings,
  Ticket,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  MapPin,
  ExternalLink,
  Store,
  Copy,
  Check,
  Search,
} from "lucide-react";
import { SiLine } from "react-icons/si";
import { AREAS, CATEGORIES, SUBCATEGORIES } from "@shared/schema";
import type { Shop, Coupon } from "@shared/schema";
import { getAreaName, getCategoryName } from "@/lib/data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function CopyableUrl({ label, path }: { label: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `${window.location.origin}${path}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <code className="flex-1 bg-muted px-1.5 py-0.5 rounded text-[11px] truncate">{fullUrl}</code>
      <button
        onClick={handleCopy}
        className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="URLをコピー"
      >
        {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

function ShopEditor({ shop, onClose }: { shop: Shop; onClose: () => void }) {
  const { toast } = useToast();
  const [displayOrder, setDisplayOrder] = useState(shop.displayOrder.toString());
  const [lineAccountUrl, setLineAccountUrl] = useState(shop.lineAccountUrl || "");
  const [reservationEnabled, setReservationEnabled] = useState(!!shop.reservationUrl);
  const [subcategory, setSubcategory] = useState(shop.subcategory || "");
  const subcategoryOptions = SUBCATEGORIES[shop.category] ?? [];

  const { data: shopCoupons = [], isLoading: couponsLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/shops", shop.id.toString(), "coupons"],
    queryFn: async () => {
      const res = await fetch(`/api/shops/${shop.id}/coupons`);
      return res.json();
    },
  });

  const updateShopMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/shops/${shop.id}`, {
        displayOrder: parseInt(displayOrder) || 0,
        lineAccountUrl: lineAccountUrl || null,
        reservationUrl: reservationEnabled ? `/app/reservation/${shop.id}` : null,
        subcategory: subcategory || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shops"] });
      toast({ title: "店舗情報を更新しました" });
    },
    onError: () => {
      toast({ title: "更新に失敗しました", variant: "destructive" });
    },
  });

  const [newCouponTitle, setNewCouponTitle] = useState("");
  const [newCouponDescription, setNewCouponDescription] = useState("");
  const [newCouponDiscount, setNewCouponDiscount] = useState("");
  const [newCouponIsLine, setNewCouponIsLine] = useState(false);
  const [newCouponIsFirstTimeOnly, setNewCouponIsFirstTimeOnly] = useState(false);
  const [newCouponExpiry, setNewCouponExpiry] = useState("");

  const createCouponMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/shops/${shop.id}/coupons`, {
        title: newCouponTitle,
        description: newCouponDescription || null,
        discount: newCouponDiscount || null,
        isLineAccountCoupon: newCouponIsLine,
        isFirstTimeOnly: newCouponIsFirstTimeOnly,
        expiryDate: newCouponExpiry || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shops", shop.id.toString(), "coupons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      setNewCouponTitle("");
      setNewCouponDescription("");
      setNewCouponDiscount("");
      setNewCouponIsLine(false);
      setNewCouponIsFirstTimeOnly(false);
      setNewCouponExpiry("");
      toast({ title: "クーポンを追加しました" });
    },
    onError: () => {
      toast({ title: "クーポンの追加に失敗しました", variant: "destructive" });
    },
  });

  const deleteCouponMutation = useMutation({
    mutationFn: async (couponId: number) => {
      await apiRequest("DELETE", `/api/coupons/${couponId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shops", shop.id.toString(), "coupons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({ title: "クーポンを削除しました" });
    },
    onError: () => {
      toast({ title: "クーポンの削除に失敗しました", variant: "destructive" });
    },
  });

  const isLineCouponWithoutUrl = newCouponIsLine && !shop.lineAccountUrl;

  return (
    <Card className="overflow-visible p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base" data-testid={`text-admin-shop-${shop.id}`}>{shop.name}</h3>
        <Button size="sm" variant="ghost" onClick={onClose} data-testid={`button-close-editor-${shop.id}`}>
          <ChevronUp className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">表示順序（数値が高いほど上に表示）</label>
          <Input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            placeholder="0"
            data-testid={`input-display-order-${shop.id}`}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">予約機能</label>
          <Select value={reservationEnabled ? "on" : "off"} onValueChange={(v) => setReservationEnabled(v === "on")}>
            <SelectTrigger data-testid={`select-reservation-${shop.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="on">有効</SelectItem>
              <SelectItem value="off">無効</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">LINE公式アカウントURL</label>
          <Input
            value={lineAccountUrl}
            onChange={(e) => setLineAccountUrl(e.target.value)}
            placeholder="https://line.me/R/ti/p/@..."
            data-testid={`input-line-url-${shop.id}`}
          />
        </div>
        {subcategoryOptions.length > 0 && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">サブカテゴリ</label>
            <Select value={subcategory || "none"} onValueChange={(v) => setSubcategory(v === "none" ? "" : v)}>
              <SelectTrigger data-testid={`select-subcategory-${shop.id}`}>
                <SelectValue placeholder="未選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未選択</SelectItem>
                {subcategoryOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {reservationEnabled && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-1.5" data-testid={`text-reservation-url-${shop.id}`}>
          <p className="text-xs font-semibold text-muted-foreground mb-2">予約ページURL</p>
          <CopyableUrl label="WEB版" path={`/reservation/${shop.id}`} />
          <CopyableUrl label="LINEミニアプリ版" path={`/app/reservation/${shop.id}`} />
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          onClick={() => updateShopMutation.mutate()}
          disabled={updateShopMutation.isPending}
          data-testid={`button-save-shop-${shop.id}`}
        >
          <Save className="w-4 h-4 mr-1" />
          {updateShopMutation.isPending ? "保存中..." : "店舗設定を保存"}
        </Button>

        {/* <Link href={`/admin/shop/${shop.id}`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5" data-testid={`button-shop-manage-${shop.id}`}>
            <ExternalLink className="w-3.5 h-3.5" />
            店舗管理画面を開く
          </Button>
        </Link> */}
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1.5" 
          data-testid={`button-shop-manage-${shop.id}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(`/admin/shop/${shop.id}`, '_blank', 'noopener,noreferrer');
          }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          店舗管理画面を開く
        </Button>
      </div>

      <div className="border-t pt-4">
        <h4 className="font-semibold text-sm mb-3 flex items-center gap-1">
          <Ticket className="w-4 h-4" />
          クーポン管理
        </h4>

        {couponsLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="space-y-2 mb-4">
            {shopCoupons.map((coupon) => (
              <div key={coupon.id} className="flex items-center justify-between p-3 rounded-md border bg-card" data-testid={`admin-coupon-${coupon.id}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{coupon.title}</span>
                    {coupon.isLineAccountCoupon && (
                      <Badge className="bg-[#06C755] border-[#06C755] text-white text-xs">
                        <SiLine className="w-3 h-3 mr-0.5" />
                        LINE限定
                      </Badge>
                    )}
                    {coupon.discount && (
                      <Badge variant="secondary" className="text-xs">{coupon.discount}</Badge>
                    )}
                  </div>
                  {coupon.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{coupon.description}</p>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => deleteCouponMutation.mutate(coupon.id)}
                  disabled={deleteCouponMutation.isPending}
                  data-testid={`button-delete-coupon-${coupon.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {shopCoupons.length === 0 && (
              <p className="text-xs text-muted-foreground">クーポンが登録されていません</p>
            )}
          </div>
        )}

        <div className="p-4 rounded-md border border-dashed bg-accent/30">
          <h5 className="text-xs font-semibold mb-2 flex items-center gap-1">
            <Plus className="w-3 h-3" />
            新しいクーポンを追加
          </h5>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">※LINE公式アカウント限定クーポンはLINE公式アカウントURLがない場合、追加できません。</label>
          <div className="space-y-2">
            <Input
              placeholder="クーポンタイトル"
              value={newCouponTitle}
              onChange={(e) => setNewCouponTitle(e.target.value)}
              data-testid={`input-new-coupon-title-${shop.id}`}
            />
            <Input
              placeholder="割引内容（例: 100円OFF）"
              value={newCouponDiscount}
              onChange={(e) => setNewCouponDiscount(e.target.value)}
              data-testid={`input-new-coupon-discount-${shop.id}`}
            />
            <Input
              placeholder="説明（任意）"
              value={newCouponDescription}
              onChange={(e) => setNewCouponDescription(e.target.value)}
              data-testid={`input-new-coupon-description-${shop.id}`}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">有効期限（空白=期限なし）</label>
                <Input
                  type="date"
                  value={newCouponExpiry}
                  onChange={(e) => setNewCouponExpiry(e.target.value)}
                  className="text-xs"
                  data-testid={`input-new-coupon-expiry-${shop.id}`}
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">種別</label>
                <Select value={newCouponIsLine ? "line" : "regular"} onValueChange={(v) => setNewCouponIsLine(v === "line")}>
                  <SelectTrigger className="text-xs" data-testid={`select-new-coupon-type-${shop.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">通常クーポン</SelectItem>
                    <SelectItem value="line">LINE公式アカウント限定</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={newCouponIsFirstTimeOnly}
                  onChange={(e) => setNewCouponIsFirstTimeOnly(e.target.checked)}
                  className="rounded"
                  data-testid={`checkbox-first-time-only-${shop.id}`}
                />
                ⭐ 初回限定クーポン
              </label>
              <Button
                size="sm"
                onClick={() => createCouponMutation.mutate()}
                disabled={!newCouponTitle || isLineCouponWithoutUrl ||createCouponMutation.isPending}
                data-testid={`button-add-coupon-${shop.id}`}
              >
                <Plus className="w-4 h-4 mr-1" />
                追加
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function AddShopDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const subcategoryOptions = category ? (SUBCATEGORIES[category] ?? []) : [];

  const createShopMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/shops", {
        name,
        description,
        area,
        category,
        subcategory: subcategory || null,
        address,
        phone: phone || null,
        imageUrl: "/images/shop-default.png",
        displayOrder: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shops"] });
      toast({ title: "店舗を追加しました" });
      setName(""); setDescription(""); setArea(""); setCategory(""); setSubcategory("");
      setAddress(""); setPhone("");
      onClose();
    },
    onError: () => {
      toast({ title: "店舗の追加に失敗しました", variant: "destructive" });
    },
  });

  const canSubmit = name.trim() && description.trim() && area && category && address.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-4 h-4" />
            店舗を追加
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">店舗名 *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: カフェ さくら" data-testid="input-new-shop-name" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">説明 *</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="店舗の説明" rows={2} data-testid="input-new-shop-description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">エリア *</label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger data-testid="select-new-shop-area">
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a.slug} value={a.slug}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">業種 *</label>
              <Select value={category} onValueChange={(v) => { setCategory(v); setSubcategory(""); }}>
                <SelectTrigger data-testid="select-new-shop-category">
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {subcategoryOptions.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">サブカテゴリ</label>
              <Select value={subcategory || "none"} onValueChange={(v) => setSubcategory(v === "none" ? "" : v)}>
                <SelectTrigger data-testid="select-new-shop-subcategory">
                  <SelectValue placeholder="選択（任意）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未選択</SelectItem>
                  {subcategoryOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">住所 *</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="例: 神奈川県大和市中央1-2-3" data-testid="input-new-shop-address" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">電話番号</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="例: 046-000-0000" data-testid="input-new-shop-phone" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button
            onClick={() => createShopMutation.mutate()}
            disabled={!canSubmit || createShopMutation.isPending}
            data-testid="button-submit-new-shop"
          >
            <Plus className="w-4 h-4 mr-1" />
            {createShopMutation.isPending ? "追加中..." : "店舗を追加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShopManagementTab() {
  const [expandedShopId, setExpandedShopId] = useState<number | null>(null);
  const [filterArea, setFilterArea] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [showAddShop, setShowAddShop] = useState(false);

  const { data: shops = [], isLoading } = useQuery<Shop[]>({
    queryKey: ["/api/shops"],
  });

  const filteredShops = shops.filter((shop) => {
    if (filterArea !== "all" && shop.area !== filterArea) return false;
    if (filterCategory !== "all" && shop.category !== filterCategory) return false;
    if (searchKeyword.trim() && !shop.name.includes(searchKeyword.trim())) return false;
    return true;
  });

  return (
    <>
      <Card className="p-4 mb-6 overflow-visible">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="店舗名で検索..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="pl-10"
              data-testid="input-admin-search"
            />
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <Select value={filterArea} onValueChange={setFilterArea}>
              <SelectTrigger className="md:w-[160px]" data-testid="select-admin-area">
                <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="エリア" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべてのエリア</SelectItem>
                {AREAS.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="md:w-[160px]" data-testid="select-admin-category">
                <SelectValue placeholder="業種" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての業種</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Badge variant="secondary" className="self-center">
              {filteredShops.length}件
            </Badge>
            <div className="md:ml-auto">
              <Button onClick={() => setShowAddShop(true)} data-testid="button-add-shop">
                <Plus className="w-4 h-4 mr-1" />
                店舗を追加
              </Button>
            </div>
          </div>
        </div>
      </Card>
      <AddShopDialog open={showAddShop} onClose={() => setShowAddShop(false)} />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-md" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredShops.map((shop) => (
            expandedShopId === shop.id ? (
              <ShopEditor key={shop.id} shop={shop} onClose={() => setExpandedShopId(null)} />
            ) : (
              <Card
                key={shop.id}
                className="overflow-visible p-5 cursor-pointer hover-elevate active-elevate-2"
                onClick={() => setExpandedShopId(shop.id)}
                data-testid={`card-admin-shop-${shop.id}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <img
                      src={shop.imageUrl}
                      alt={shop.name}
                      className="w-16 h-16 rounded-md object-cover flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-bold text-base">{shop.name}</span>
                        <Badge variant="outline" className="text-xs px-2 py-0.5">
                          {getCategoryName(shop.category)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{getAreaName(shop.area)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        <span>表示順: {shop.displayOrder}</span>
                        {shop.lineAccountUrl && (
                          <Badge className="bg-[#06C755] border-[#06C755] text-white text-xs px-2 py-0.5">
                            <SiLine className="w-3 h-3 mr-1" />
                            LINE連携
                          </Badge>
                        )}
                        {shop.reservationUrl && (
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">予約あり</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </div>
              </Card>
            )
          ))}
        </div>
      )}
    </>
  );
}

export default function AdminPage() {
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-2 px-4 md:px-8 h-14">
          <div className="flex items-center gap-2 flex-1">
            <Settings className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm" data-testid="text-admin-title">管理画面</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="gap-1.5 text-muted-foreground"
            data-testid="button-logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            ログアウト
          </Button>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold mb-2" data-testid="text-admin-heading">管理ダッシュボード</h1>
          <p className="text-sm text-muted-foreground">
            店舗の設定・クーポン・表示順序を管理できます。予約関連の管理は各店舗の管理画面から行えます。
          </p>
        </div>

        <ShopManagementTab />
      </div>
    </div>
  );
}
