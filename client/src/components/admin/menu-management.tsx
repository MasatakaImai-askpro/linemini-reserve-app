import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Eye, EyeOff, Save, X, Upload, ImageIcon, GripVertical
} from "lucide-react";

type MenuItem = {
  id: number;
  shopId: number;
  name: string;
  price: number;
  comment: string;
  imageUrl: string | null;
  isVisible: boolean;
  displayOrder: number;
};

type MenuItemForm = {
  name: string;
  price: string;
  comment: string;
  imageUrl: string;
};

const EMPTY_FORM: MenuItemForm = { name: "", price: "", comment: "", imageUrl: "" };

function ImageUploadButton({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onChange(data.url);
    } catch {
      // silent
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="relative w-full h-28 rounded-md overflow-hidden border">
          <img src={value} alt="menu" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5"
            data-testid="button-menu-remove-image"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="w-full h-28 border-2 border-dashed border-muted-foreground/30 rounded-md flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/50 transition-colors"
          data-testid="button-menu-upload-image"
        >
          <ImageIcon className="w-5 h-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{uploading ? "アップロード中..." : "画像を選択"}</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
        disabled={uploading}
      />
    </div>
  );
}

function AddMenuItemForm({
  shopId,
  onClose,
}: {
  shopId: number;
  onClose: () => void;
}) {
  const [form, setForm] = useState<MenuItemForm>(EMPTY_FORM);
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/shops/${shopId}/menu-items`, {
        name: form.name.trim(),
        price: parseInt(form.price) || 0,
        comment: form.comment.slice(0, 20),
        imageUrl: form.imageUrl || null,
        isVisible: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shops", shopId.toString(), "menu-items"] });
      toast({ title: "メニューを追加しました" });
      onClose();
    },
    onError: () => toast({ title: "追加に失敗しました", variant: "destructive" }),
  });

  return (
    <Card className="overflow-visible p-4 border-primary/30 border-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">新しいメニューを追加</h3>
        <Button size="icon" variant="ghost" onClick={onClose} className="h-6 w-6">
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">商品イメージ</Label>
          <ImageUploadButton
            value={form.imageUrl}
            onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
          />
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="add-menu-name">商品名 *</Label>
            <Input
              id="add-menu-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="例: チーズバーガー"
              className="h-8 text-sm"
              data-testid="input-menu-name"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="add-menu-price">価格 (円)</Label>
            <Input
              id="add-menu-price"
              type="number"
              min="0"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="例: 980"
              className="h-8 text-sm"
              data-testid="input-menu-price"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="add-menu-comment">
              コメント <span className="text-muted-foreground">({form.comment.length}/20文字)</span>
            </Label>
            <Input
              id="add-menu-comment"
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value.slice(0, 20) }))}
              placeholder="例: 人気No.1"
              className="h-8 text-sm"
              data-testid="input-menu-comment"
              maxLength={20}
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <Button size="sm" variant="outline" onClick={onClose}>キャンセル</Button>
        <Button
          size="sm"
          onClick={() => createMutation.mutate()}
          disabled={!form.name.trim() || createMutation.isPending}
          data-testid="button-menu-add-submit"
        >
          <Plus className="w-3 h-3 mr-1" />
          {createMutation.isPending ? "追加中..." : "追加"}
        </Button>
      </div>
    </Card>
  );
}

function MenuItemCard({
  item,
  shopId,
}: {
  item: MenuItem;
  shopId: number;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<MenuItemForm>({
    name: item.name,
    price: item.price.toString(),
    comment: item.comment || "",
    imageUrl: item.imageUrl || "",
  });
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<MenuItem>) => {
      const payload = {
        ...data,
        is_visible: data.isVisible,
        image_url: data.imageUrl,
        display_order: data.displayOrder
      };
      await apiRequest("PUT", `/api/shops/${shopId}/menu-items/${item.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shops", shopId.toString(), "menu-items"] });
    },
    onError: () => toast({ title: "更新に失敗しました", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/shops/${shopId}/menu-items/${item.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shops", shopId.toString(), "menu-items"] });
      toast({ title: "削除しました" });
    },
    onError: () => toast({ title: "削除に失敗しました", variant: "destructive" }),
  });

  const handleSave = () => {
    updateMutation.mutate({
      name: form.name.trim(),
      price: parseInt(form.price) || 0,
      comment: form.comment.slice(0, 20),
      imageUrl: form.imageUrl || null,
    } as any);
    setEditing(false);
  };

  if (editing) {
    return (
      <Card className="overflow-visible p-4 border-primary/30 border-2" data-testid={`card-menu-item-${item.id}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">メニューを編集</h3>
          <Button size="icon" variant="ghost" onClick={() => setEditing(false)} className="h-6 w-6">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">商品イメージ</Label>
            <ImageUploadButton
              value={form.imageUrl}
              onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
            />
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">商品名 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-8 text-sm"
                data-testid={`input-menu-edit-name-${item.id}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">価格 (円)</Label>
              <Input
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="h-8 text-sm"
                data-testid={`input-menu-edit-price-${item.id}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">コメント ({form.comment.length}/20文字)</Label>
              <Input
                value={form.comment}
                onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value.slice(0, 20) }))}
                maxLength={20}
                className="h-8 text-sm"
                data-testid={`input-menu-edit-comment-${item.id}`}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>キャンセル</Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!form.name.trim() || updateMutation.isPending}
            data-testid={`button-menu-save-${item.id}`}
          >
            <Save className="w-3 h-3 mr-1" />
            保存
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden" data-testid={`card-menu-item-${item.id}`}>
      <div className="flex gap-3">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-20 h-20 object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-20 h-20 bg-muted flex items-center justify-center flex-shrink-0">
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0 py-2 pr-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate" data-testid={`text-menu-name-${item.id}`}>{item.name}</p>
              <p className="text-primary font-bold text-sm">¥{item.price.toLocaleString()}</p>
              {item.comment && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.comment}</p>
              )}
              <span className={`inline-flex items-center gap-1 text-xs mt-1 px-1.5 py-0.5 rounded-full ${item.isVisible ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {item.isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {item.isVisible ? "表示中" : "非表示"}
              </span>
            </div>
            <div className="flex flex-col gap-1 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => setEditing(true)}
                data-testid={`button-menu-edit-${item.id}`}
              >
                編集
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => updateMutation.mutate({ isVisible: !item.isVisible } as any)}
                // onClick={() => {
                //   const nextValue = !item.isVisible;
                //   updateMutation.mutate({ isVisible: nextValue });
                // }}
                disabled={updateMutation.isPending}
                data-testid={`button-menu-toggle-${item.id}`}
              >
                {item.isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                data-testid={`button-menu-delete-${item.id}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function MenuManagement({ shopId }: { shopId: number }) {
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: items, isLoading } = useQuery<MenuItem[]>({
    queryKey: ["/api/shops", shopId.toString(), "menu-items"],
    queryFn: async () => {
      const res = await fetch(`/api/shops/${shopId}/menu-items?all=true`);
      if (!res.ok) throw new Error("Failed to fetch");
      const rawData = await res.json();
      
      return rawData.map ((item: any) => ({
        ...item,
        isVisible: item.is_visible,
        imageUrl: item.image_url,
        displayOrder: item.display_order,
        shopId: item.shop_id
      }))
    },
  });

  return (
    <div data-testid="admin-menu-management">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">メニュー管理</h2>
          <p className="text-sm text-muted-foreground">予約ページに表示するメニュー（商品）を管理</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddForm(true)}
          disabled={showAddForm}
          data-testid="button-menu-add"
        >
          <Plus className="w-4 h-4 mr-1" />
          メニューを追加
        </Button>
      </div>

      {showAddForm && (
        <div className="mb-4">
          <AddMenuItemForm shopId={shopId} onClose={() => setShowAddForm(false)} />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !items || items.length === 0 ? (
        <Card className="overflow-visible p-8 text-center">
          <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">メニューがまだありません</p>
          <p className="text-xs text-muted-foreground mt-1">「メニューを追加」ボタンから追加してください</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <MenuItemCard key={item.id} item={item} shopId={shopId} />
          ))}
        </div>
      )}
    </div>
  );
}
