import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogout } from "@/hooks/use-auth";
import {
  Store,
  LogOut,
  ListOrdered,
  Users,
  Clock,
  CalendarCheck,
  ImageIcon,
  Save,
  X,
  Upload,
  Settings,
  LayoutGrid,
  CreditCard,
  CircleCheck,
  CircleAlert,
  CircleDashed,
  ExternalLink,
  Unlink,
} from "lucide-react";
import { SiStripe } from "react-icons/si";
import type { Shop } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CourseManagement } from "@/components/admin/course-management";
import { StaffManagement } from "@/components/admin/staff-management";
import { SlotManagement } from "@/components/admin/slot-management";
import { ReservationList } from "@/components/admin/reservation-list";
import { fetchSettings, updateSettings } from "@/lib/booking-api";

type ShopAdminTab = "images" | "courses" | "staff" | "slots" | "reservations" | "settings" | "payment";

function ImageUploadSlot({
  label,
  value,
  onChange,
  uploadTestId,
  removeTestId,
  previewTestId,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  uploadTestId: string;
  removeTestId: string;
  previewTestId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onChange(data.url);
    } catch {
      onChange("");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          data-testid={uploadTestId}
        >
          <Upload className="w-4 h-4 mr-1" />
          {uploading ? "アップロード中..." : "画像を選択"}
        </Button>
        {value && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onChange("")}
            data-testid={removeTestId}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      {value && (
        <img
          src={value}
          alt={label}
          className="w-40 h-28 object-cover rounded-md border mt-2"
          data-testid={previewTestId}
        />
      )}
    </div>
  );
}

function StripeConnectPanel({ shopId }: { shopId: number }) {
  const { toast } = useToast();

  const { data: stripeStatus, refetch: refetchStripeStatus } = useQuery({
    queryKey: ["/api/stripe/connect/status", shopId],
    queryFn: async () => {
      const res = await fetch(`/api/stripe/connect/status/${shopId}`);
      return res.json();
    },
    staleTime: 30000,
  });

  const onboardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/stripe/connect/onboard/${shopId}`, {});
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
        setTimeout(() => refetchStripeStatus(), 3000);
      } else {
        toast({ title: "Stripe接続の開始に失敗しました", description: data.error || "", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      const isSettingsError = msg.includes("Country and Capabilities") || msg.includes("capabilities");
      toast({
        title: "Stripe接続の開始に失敗しました",
        description: isSettingsError
          ? "StripeダッシュボードでJPのExpress機能を有効化してください"
          : msg.split(":").slice(1).join(":").trim() || "しばらくしてから再度お試しください",
        variant: "destructive",
      });
    },
  });

  const dashboardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/stripe/connect/dashboard/${shopId}`, {});
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      if (data.url) window.open(data.url, "_blank");
    },
    onError: (err: any) => {
      const msg = err?.message?.split(":").slice(1).join(":").trim() || "";
      toast({ title: "ダッシュボードのリンク取得に失敗しました", description: msg, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/stripe/connect/disconnect/${shopId}`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Stripe連携を解除しました" });
      refetchStripeStatus();
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/connect/status", shopId] });
    },
    onError: (err: any) => {
      toast({ title: "連携解除に失敗しました", description: err?.message || "", variant: "destructive" });
    },
  });

  return (
    <div data-testid="admin-shop-payment">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <SiStripe className="w-5 h-5 text-[#635BFF]" />
          Stripe Connect 決済連携
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          前払いコースのオンライン決済を受け取るためのStripe Connect設定
        </p>
      </div>

      <Card className="overflow-visible p-5 space-y-4">
        <div className="flex items-center gap-2">
          {(stripeStatus?.connected || stripeStatus?.status === "active") ? (
            <CircleCheck className="w-5 h-5 text-green-600" />
          ) : stripeStatus?.status === "pending" ? (
            <CircleAlert className="w-5 h-5 text-amber-500" />
          ) : (
            <CircleDashed className="w-5 h-5 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold">
            {(stripeStatus?.connected || stripeStatus?.status === "active")
              ? "接続済み（決済受取可能）"
              : stripeStatus?.status === "pending"
              ? "設定中（オンボーディング未完了）"
              : "未接続"}
          </span>
          {stripeStatus?.accountId && (
            <span className="text-xs text-muted-foreground ml-auto font-mono">{stripeStatus.accountId}</span>
          )}
        </div>

        {!(stripeStatus?.connected || stripeStatus?.status === "active") && (
          <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-800" data-testid="notice-stripe-incomplete">
            <span className="font-semibold">Stripe Connectの設定が完了すれば、事前決済のコースがご利用いただけます。</span>
            {stripeStatus?.status === "pending" && (
              <span className="block mt-1">オンボーディングが未完了です。「設定を再開」から手続きを完了してください。</span>
            )}
          </div>
        )}

        {(stripeStatus?.connected || stripeStatus?.status === "active") && (
          <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2.5 text-xs text-green-800">
            前払いコースの決済を受け取る準備ができています。
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {!(stripeStatus?.connected || stripeStatus?.status === "active") && (
            <Button
              size="sm"
              className="gap-1.5 bg-[#635BFF] hover:bg-[#635BFF]/90 text-white"
              onClick={() => onboardMutation.mutate()}
              disabled={onboardMutation.isPending}
              data-testid="button-stripe-onboard"
            >
              <CreditCard className="w-3.5 h-3.5" />
              {onboardMutation.isPending ? "処理中..." :
                stripeStatus?.status === "pending" ? "設定を再開" : "Stripe連携を開始"}
            </Button>
          )}
          {(stripeStatus?.connected || stripeStatus?.status === "active") && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => dashboardMutation.mutate()}
              disabled={dashboardMutation.isPending}
              data-testid="button-stripe-dashboard"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {dashboardMutation.isPending ? "取得中..." : "Stripeダッシュボードを開く"}
            </Button>
          )}
          {stripeStatus?.accountId && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (window.confirm("Stripe連携を解除しますか？\n解除後は事前決済が利用できなくなります。")) {
                  disconnectMutation.mutate();
                }
              }}
              disabled={disconnectMutation.isPending}
              data-testid="button-stripe-disconnect"
            >
              <Unlink className="w-3.5 h-3.5" />
              {disconnectMutation.isPending ? "解除中..." : "連携を解除"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-muted-foreground"
            onClick={() => refetchStripeStatus()}
            data-testid="button-stripe-refresh"
          >
            状態を更新
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ShopSettingsPanel({ shopId }: { shopId: number }) {
  const { toast } = useToast();
  const [tableCount, setTableCount] = useState("");
  const [maxPartySize, setMaxPartySize] = useState("");
  const [staffSelectionEnabled, setStaffSelectionEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchSettings(shopId).then((s) => {
      setTableCount(s.table_count ?? "");
      setMaxPartySize(s.max_party_size ?? "");
      setStaffSelectionEnabled(s.staff_selection_enabled === "true");
      setLoaded(true);
    });
  }, [shopId]);

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(shopId, {
        table_count: tableCount || "0",
        max_party_size: maxPartySize || "0",
      });
      toast({ title: "設定を保存しました" });
    } catch {
      toast({ title: "保存に失敗しました", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <div className="py-10 text-center text-muted-foreground text-sm">読み込み中...</div>;

  if (staffSelectionEnabled) {
    return (
      <div data-testid="admin-shop-settings">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-foreground">予約設定</h2>
        </div>
        <Card className="overflow-visible p-5">
          <p className="text-sm text-muted-foreground">
            スタッフ指名ありの店舗では、卓数・上限人数の設定は不要です。
            スタッフ個別の予約枠管理をご利用ください。
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div data-testid="admin-shop-settings">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-foreground">予約設定</h2>
        <p className="text-sm text-muted-foreground">指名なし予約の同時受付数と1予約あたりの上限人数を設定</p>
      </div>
      <Card className="overflow-visible p-5 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="table-count" className="flex items-center gap-1.5 text-sm font-semibold">
            <LayoutGrid className="h-4 w-4 text-primary" />
            卓数（同時に受け付ける予約の最大数）
          </Label>
          <div className="flex items-center gap-3 max-w-xs">
            <Input
              id="table-count"
              type="number"
              min="0"
              max="100"
              value={tableCount}
              onChange={(e) => setTableCount(e.target.value)}
              placeholder="例: 5"
              className="w-28"
              data-testid="input-table-count"
            />
            <span className="text-sm text-muted-foreground">卓 / 台 / 組</span>
          </div>
          <p className="text-xs text-muted-foreground">
            同じ時間帯に受け付ける予約の最大数です。0または空欄の場合はスタッフの空き状況で制御されます。
          </p>
        </div>

        <div className="border-t pt-5 space-y-2">
          <Label htmlFor="max-party-size" className="flex items-center gap-1.5 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" />
            1予約あたりの上限人数
          </Label>
          <div className="flex items-center gap-3 max-w-xs">
            <Input
              id="max-party-size"
              type="number"
              min="0"
              max="100"
              value={maxPartySize}
              onChange={(e) => setMaxPartySize(e.target.value)}
              placeholder="例: 6"
              className="w-28"
              data-testid="input-max-party-size"
            />
            <span className="text-sm text-muted-foreground">名まで</span>
          </div>
          <p className="text-xs text-muted-foreground">
            予約確認画面で選択できる人数の上限です。0または空欄の場合は最大20名まで選択可能です。
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          data-testid="button-save-shop-settings"
        >
          <Save className="w-4 h-4 mr-1" />
          {saving ? "保存中..." : "設定を保存"}
        </Button>
      </Card>
    </div>
  );
}

function ImageManagement({ shop }: { shop: Shop }) {
  const { toast } = useToast();
  const [reservationImageUrl, setReservationImageUrl] = useState(shop.reservationImageUrl || "");
  const [gallery1, setGallery1] = useState(shop.galleryImageUrls?.[0] || "");
  const [gallery2, setGallery2] = useState(shop.galleryImageUrls?.[1] || "");
  const [gallery3, setGallery3] = useState(shop.galleryImageUrls?.[2] || "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const galleryImageUrls = [gallery1, gallery2, gallery3].filter(Boolean);
      await apiRequest("PUT", `/api/shops/${shop.id}`, {
        reservationImageUrl: reservationImageUrl || null,
        galleryImageUrls: galleryImageUrls.length > 0 ? galleryImageUrls : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shops"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shops", shop.id.toString()] });
      toast({ title: "画像設定を保存しました" });
    },
    onError: () => {
      toast({ title: "保存に失敗しました", variant: "destructive" });
    },
  });

  return (
    <div data-testid="admin-image-management">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-foreground">画像管理</h2>
        <p className="text-sm text-muted-foreground">予約ページと店舗詳細ページの画像を設定</p>
      </div>

      <Card className="overflow-visible p-5 space-y-6">
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-primary" />
            予約ページ画像（1枚）
          </h3>
          <ImageUploadSlot
            label="予約ページ画像"
            value={reservationImageUrl}
            onChange={setReservationImageUrl}
            uploadTestId="upload-reservation-image"
            removeTestId="remove-reservation-image"
            previewTestId="img-reservation-preview"
          />
        </div>

        <div className="border-t pt-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-primary" />
            店舗詳細画像（3枚・スライド表示）
          </h3>
          <div className="space-y-3">
            {[
              { label: "画像1", value: gallery1, setter: setGallery1, num: "1" },
              { label: "画像2", value: gallery2, setter: setGallery2, num: "2" },
              { label: "画像3", value: gallery3, setter: setGallery3, num: "3" },
            ].map((item) => (
              <ImageUploadSlot
                key={item.num}
                label={item.label}
                value={item.value}
                onChange={item.setter}
                uploadTestId={`upload-gallery-${item.num}`}
                removeTestId={`remove-gallery-${item.num}`}
              />
            ))}
          </div>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          data-testid="button-save-images"
        >
          <Save className="w-4 h-4 mr-1" />
          {saveMutation.isPending ? "保存中..." : "画像設定を保存"}
        </Button>
      </Card>
    </div>
  );
}

function LogoutButton() {
  const logout = useLogout();
  return (
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
  );
}

export default function ShopAdminPage() {
  const params = useParams<{ id: string }>();
  const shopId = parseInt(params.id || "0");

  const [activeTab, setActiveTab] = useState<ShopAdminTab>("images");

  const { data: shop, isLoading } = useQuery<Shop>({
    queryKey: ["/api/shops", params.id],
  });

  const tabs: { id: ShopAdminTab; label: string; icon: typeof Store }[] = [
    { id: "images", label: "画像管理", icon: ImageIcon },
    { id: "courses", label: "コース管理", icon: ListOrdered },
    { id: "staff", label: "スタッフ管理", icon: Users },
    { id: "slots", label: "予約枠管理", icon: Clock },
    { id: "reservations", label: "予約一覧", icon: CalendarCheck },
    { id: "settings", label: "予約設定", icon: Settings },
    { id: "payment", label: "決済設定", icon: CreditCard },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
          <div className="flex items-center gap-2 px-4 md:px-8 h-14">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
        </header>
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-12 w-full mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center overflow-visible">
          <h2 className="font-bold text-lg mb-2">店舗が見つかりませんでした</h2>
        </Card>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-2 px-4 md:px-8 h-14">
          <div className="flex items-center gap-2 flex-1">
            <Store className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm" data-testid="text-shop-admin-title">店舗管理</span>
          </div>
          <LogoutButton />
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <img
              src={shop.imageUrl}
              alt={shop.name}
              className="w-10 h-10 rounded-md object-cover"
            />
            <div>
              <h1 className="text-xl font-bold" data-testid="text-shop-admin-name">{shop.name}</h1>
              <p className="text-sm text-muted-foreground">
                コース・スタッフ・予約の管理
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-1 mb-6 overflow-x-auto border-b border-border">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`tab-shop-admin-${tab.id}`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "images" && <ImageManagement shop={shop} />}
        {activeTab === "courses" && <CourseManagement shopId={shopId} />}
        {activeTab === "staff" && <StaffManagement shopId={shopId} />}
        {activeTab === "slots" && <SlotManagement shopId={shopId} />}
        {activeTab === "reservations" && <ReservationList shopId={shopId} />}
        {activeTab === "settings" && <ShopSettingsPanel shopId={shopId} />}
        {activeTab === "payment" && <StripeConnectPanel shopId={shopId} />}
      </div>
    </div>
  );
}
