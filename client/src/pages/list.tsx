import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Clock,
  Phone,
  Bell,
  X,
  Heart,
} from "lucide-react";
import { AREAS, CATEGORIES, SUBCATEGORIES } from "@shared/schema";
import type { Shop } from "@shared/schema";
import { getAreaName, getCategoryName, isRecentlyUpdated, sortByDisplayOrderAndDate } from "@/lib/data";
import { useState, useMemo } from "react";
import { useFavorites } from "@/hooks/use-favorites";

export default function ListPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const rawArea = params.get("area");
  const rawCategory = params.get("category");
  const initialArea = (rawArea && rawArea !== "undefined" && rawArea !== "null") ? rawArea : "all";
  const initialCategory = (rawCategory && rawCategory !== "undefined" && rawCategory !== "null") ? rawCategory : "all";
  const initialQ = params.get("q") || "";

  const [area, setArea] = useState(initialArea);
  const [category, setCategory] = useState(initialCategory);
  const [subcategory, setSubcategory] = useState(params.get("subcategory") || "all");
  const [keyword, setKeyword] = useState(initialQ);
  const [favOnly, setFavOnly] = useState(params.get("fav") === "1");
  const [, navigate] = useLocation();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();

  const subcategoryOptions = category !== "all" ? (SUBCATEGORIES[category] ?? []) : [];

  const { data: shops = [], isLoading } = useQuery<Shop[]>({
    queryKey: ["/api/shops"],
  });

  const filteredShops = useMemo(() => {
    const filtered = shops.filter((shop) => {
      if (favOnly && !favorites.includes(shop.id)) return false;
      if (area !== "all" && shop.area !== area) return false;
      if (category !== "all" && shop.category !== category) return false;
      if (subcategory !== "all" && shop.subcategory !== subcategory) return false;
      if (keyword) {
        const q = keyword.toLowerCase();
        return (
          shop.name.toLowerCase().includes(q) ||
          shop.description.toLowerCase().includes(q) ||
          shop.address.toLowerCase().includes(q)
        );
      }
      return true;
    });
    return sortByDisplayOrderAndDate(filtered);
  }, [shops, area, category, subcategory, keyword, favOnly, favorites]);

  const pageTitle = useMemo(() => {
    if (favOnly && area === "all" && category === "all" && !keyword) return "お気に入りのお店";
    const parts: string[] = [];
    if (favOnly) parts.push("お気に入り");
    if (area !== "all") parts.push(getAreaName(area));
    if (category !== "all") parts.push(getCategoryName(category));
    if (subcategory !== "all") {
      const sub = subcategoryOptions.find((s) => s.id === subcategory);
      if (sub) parts.push(sub.name);
    }
    if (keyword) parts.push(`「${keyword}」`);
    return parts.length > 0 ? parts.join(" / ") + " の検索結果" : "すべてのお店";
  }, [area, category, subcategory, subcategoryOptions, keyword, favOnly]);

  const hasFilters = area !== "all" || category !== "all" || subcategory !== "all" || keyword !== "" || favOnly;

  return (
    <div className="bg-background px-3 py-3">
      <div className="bg-card rounded-lg border p-2.5 mb-3">
        <div className="flex gap-2 mb-2">
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger className="flex-1 h-8 text-xs" data-testid="select-list-area">
              <MapPin className="w-3 h-3 mr-1 text-muted-foreground flex-shrink-0" />
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

          <Select value={category} onValueChange={(v) => { setCategory(v); setSubcategory("all"); }}>
            <SelectTrigger className="flex-1 h-8 text-xs" data-testid="select-list-category">
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
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="キーワード..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="h-8 text-xs pl-7"
              data-testid="input-list-keyword"
            />
          </div>
          <Button
            size="sm"
            variant={favOnly ? "default" : "outline"}
            className={`h-8 px-2 text-xs flex-shrink-0 ${favOnly ? "bg-red-500 hover:bg-red-600 border-red-500" : ""}`}
            onClick={() => setFavOnly(!favOnly)}
            data-testid="button-toggle-favorites"
          >
            <Heart className={`w-3.5 h-3.5 mr-0.5 ${favOnly ? "fill-white text-white" : ""}`} />
            お気に入り
          </Button>
          {hasFilters && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs text-muted-foreground"
              onClick={() => { setArea("all"); setCategory("all"); setSubcategory("all"); setKeyword(""); setFavOnly(false); }}
              data-testid="button-clear-filters"
            >
              <X className="w-3 h-3 mr-0.5" />
              クリア
            </Button>
          )}
        </div>
      </div>

      {subcategoryOptions.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2" style={{ scrollbarWidth: "none" }}>
          <button
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-bold border transition-all ${subcategory === "all" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-amber-900 border-gray-200 hover:border-orange-300"}`}
            onClick={() => setSubcategory("all")}
            data-testid="button-subcategory-all"
          >
            すべて
          </button>
          {subcategoryOptions.map((sub) => (
            <button
              key={sub.id}
              className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-bold border transition-all ${subcategory === sub.id ? "bg-orange-500 text-white border-orange-500" : "bg-white text-amber-900 border-gray-200 hover:border-orange-300"}`}
              onClick={() => setSubcategory(sub.id)}
              data-testid={`button-subcategory-${sub.id}`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-2.5">
        <h1 className="text-sm font-bold truncate mr-2" data-testid="text-list-title">{pageTitle}</h1>
        <Badge variant="secondary" className="text-xs flex-shrink-0" data-testid="badge-result-count">
          {filteredShops.length}件
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))}
        </div>
      ) : filteredShops.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-sm mb-1.5" data-testid="text-no-results">
            該当するお店が見つかりませんでした
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            検索条件を変更してお試しください
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setArea("all"); setCategory("all"); setKeyword(""); setFavOnly(false); }}
            data-testid="button-reset-search"
          >
            条件をリセット
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredShops.map((shop) => (
            <ListShopCard key={shop.id} shop={shop} isFav={isFavorite(shop.id)} onToggleFav={() => toggleFavorite(shop.id)} />
          ))}
        </div>
      )}

      <footer className="text-center py-4 mt-4">
        <Link href="/app">
          <span className="text-xs font-bold text-primary cursor-pointer" data-testid="link-footer-home">
            神奈川おでかけナビ
          </span>
        </Link>
        <p className="text-[10px] text-muted-foreground mt-1">
          &copy; 2026 神奈川おでかけナビ
        </p>
      </footer>
    </div>
  );
}

function ListShopCard({ shop, isFav, onToggleFav }: { shop: Shop; isFav: boolean; onToggleFav: () => void }) {
  const recentlyUpdated = isRecentlyUpdated(shop.updatedAt);

  return (
    <Link href={`/app/shop/${shop.id}`}>
      <Card
        className="overflow-hidden cursor-pointer hover-elevate active-elevate-2 transition-transform"
        data-testid={`card-list-shop-${shop.id}`}
      >
        <div className="flex">
          <div className="relative w-[110px] flex-shrink-0">
            <img
              src={shop.imageUrl}
              alt={shop.name}
              className="w-full h-full object-cover"
              style={{ minHeight: "100px" }}
              loading="lazy"
            />
            <button
              className="absolute top-1 left-1 w-7 h-7 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFav(); }}
              data-testid={`button-favorite-list-shop-${shop.id}`}
            >
              <Heart className={`w-4 h-4 ${isFav ? "fill-red-500 text-red-500" : "text-white"}`} />
            </button>
            {recentlyUpdated && (
              <div className="absolute top-1 right-1">
                <Badge className="bg-orange-500 border-orange-500 text-white text-[10px] px-1 py-0">
                  <Bell className="w-2.5 h-2.5 mr-0.5" />
                  更新
                </Badge>
              </div>
            )}
          </div>
          <div className="flex-1 p-2.5 min-w-0">
            <div className="flex items-center gap-1 mb-1 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                {getCategoryName(shop.category)}
              </Badge>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                <MapPin className="w-2.5 h-2.5 mr-0.5" />
                {getAreaName(shop.area)}
              </Badge>
            </div>
            <h3 className="font-bold text-xs mb-0.5 truncate" data-testid={`text-list-shop-name-${shop.id}`}>
              {shop.name}
            </h3>
            <p className="text-[10px] text-muted-foreground line-clamp-2 mb-1.5 leading-tight">
              {shop.description}
            </p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
              {shop.hours && (
                <span className="flex items-center gap-0.5 truncate">
                  <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                  {shop.hours}
                </span>
              )}
            </div>
            <span className="text-[10px] text-primary font-medium flex items-center gap-0.5">
              詳細を見る
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
