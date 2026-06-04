import { useEffect } from "react";

export const BASE_URL = "https://linemini-reserve-app.vercel.app";
export const SITE_NAME = "かながわスマイルマップ";

const DEFAULT_DESCRIPTION =
  "神奈川県（厚木・小田原・海老名・相模原）の飲食店・美容室・エステサロン・ラーメン・居酒屋をオンライン予約。本厚木・相模大野・橋本・小田原・海老名駅周辺の店舗を多数掲載。LINEクーポン配信中。";

const DEFAULT_KEYWORDS =
  "神奈川,厚木,小田原,海老名,相模原,本厚木,相模大野,橋本,海老名駅,小田原駅,町田,飲食店,美容室,エステサロン,ラーメン,居酒屋,予約,オンライン予約,クーポン,LINEクーポン";

export interface SEOMeta {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
}

function setMetaByName(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

function setMetaByProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function setJsonLd(id: string, data: object) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function useSEO({
  title,
  description,
  keywords,
  canonical,
  ogImage,
  ogType = "website",
  noindex = false,
}: SEOMeta = {}) {
  useEffect(() => {
    const fullTitle = title
      ? `${title} | ${SITE_NAME}`
      : `${SITE_NAME} | 厚木・小田原・海老名・相模原の飲食店・美容室 予約&クーポン`;
    const desc = description || DEFAULT_DESCRIPTION;
    const kw = keywords || DEFAULT_KEYWORDS;

    document.title = fullTitle;

    setMetaByName("description", desc);
    setMetaByName("keywords", kw);
    setMetaByName("robots", noindex ? "noindex,nofollow" : "index,follow,max-image-preview:large,max-snippet:-1");

    setMetaByProperty("og:title", fullTitle);
    setMetaByProperty("og:description", desc);
    setMetaByProperty("og:type", ogType);
    setMetaByProperty("og:site_name", SITE_NAME);
    if (ogImage) setMetaByProperty("og:image", ogImage);

    setMetaByName("twitter:card", "summary_large_image");
    setMetaByName("twitter:title", fullTitle);
    setMetaByName("twitter:description", desc);

    if (canonical) setLink("canonical", `${BASE_URL}${canonical}`);
  }, [title, description, keywords, canonical, ogImage, ogType, noindex]);
}

export function useJsonLd(id: string, data: object | null) {
  useEffect(() => {
    if (!data) return;
    setJsonLd(id, data);
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, [id, JSON.stringify(data)]);
}

export function buildLocalBusinessLd(shop: {
  id: number;
  name: string;
  description: string;
  address: string;
  phone?: string | null;
  website?: string | null;
  hours?: string | null;
  category: string;
  area: string;
  imageUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const typeMap: Record<string, string> = {
    gourmet: "FoodEstablishment",
    beauty: "BeautySalon",
    shopping: "Store",
    leisure: "EntertainmentBusiness",
    service: "LocalBusiness",
    medical: "MedicalBusiness",
  };
  const schemaType = typeMap[shop.category] || "LocalBusiness";

  return {
    "@context": "https://schema.org",
    "@type": schemaType,
    "@id": `${BASE_URL}/app/shop/${shop.id}`,
    "name": shop.name,
    "description": shop.description,
    "url": `${BASE_URL}/app/shop/${shop.id}`,
    "image": shop.imageUrl || `${BASE_URL}/images/hero-kanagawa.png`,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": shop.address,
      "addressRegion": "神奈川県",
      "addressCountry": "JP"
    },
    ...(shop.phone ? { "telephone": shop.phone } : {}),
    ...(shop.website ? { "sameAs": shop.website } : {}),
    ...(shop.hours ? { "openingHours": shop.hours } : {}),
    ...(shop.latitude && shop.longitude ? {
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": shop.latitude,
        "longitude": shop.longitude
      }
    } : {}),
    "areaServed": {
      "@type": "City",
      "name": shop.area
    },
    "hasMap": `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`,
    "potentialAction": {
      "@type": "ReserveAction",
      "target": `${BASE_URL}/app/reservation/${shop.id}`,
      "result": {
        "@type": "Reservation",
        "name": `${shop.name}の予約`
      }
    }
  };
}

export const AREA_SEO: Record<string, { label: string; description: string; keywords: string }> = {
  atsugi: {
    label: "厚木",
    description: "厚木市・本厚木駅周辺の飲食店・美容室・エステサロン・ラーメン・居酒屋をオンライン予約。クーポンも多数掲載。",
    keywords: "厚木,厚木市,本厚木,本厚木駅,厚木 飲食店,厚木 美容室,厚木 ラーメン,厚木 居酒屋,厚木 エステ,厚木 予約,厚木 クーポン",
  },
  odawara: {
    label: "小田原",
    description: "小田原市・小田原駅周辺の飲食店・美容室・エステサロン・ラーメン・居酒屋をオンライン予約。クーポンも多数掲載。",
    keywords: "小田原,小田原市,小田原駅,小田原 飲食店,小田原 美容室,小田原 ラーメン,小田原 居酒屋,小田原 エステ,小田原 予約,小田原 クーポン",
  },
  ebina: {
    label: "海老名",
    description: "海老名市・海老名駅周辺の飲食店・美容室・エステサロン・ラーメン・居酒屋をオンライン予約。クーポンも多数掲載。",
    keywords: "海老名,海老名市,海老名駅,海老名 飲食店,海老名 美容室,海老名 ラーメン,海老名 居酒屋,海老名 エステ,海老名 予約,海老名 クーポン",
  },
  sagamihara: {
    label: "相模原",
    description: "相模原市（相模大野・橋本・相模原駅）周辺の飲食店・美容室・エステサロン・ラーメン・居酒屋をオンライン予約。クーポンも多数掲載。",
    keywords: "相模原,相模原市,相模大野,橋本,相模原駅,相模大野駅,橋本駅,相模原 飲食店,相模原 美容室,相模原 ラーメン,相模原 居酒屋,相模原 予約",
  },
};

export const CATEGORY_SEO: Record<string, { label: string; description: string; keywords: string }> = {
  gourmet: {
    label: "飲食店・グルメ",
    description: "神奈川県の飲食店（ラーメン・居酒屋・カフェ・和食・洋食・中華）をオンライン予約。厚木・小田原・海老名・相模原エリア対応。",
    keywords: "神奈川 飲食店,神奈川 グルメ,ラーメン,居酒屋,カフェ,和食,予約,神奈川 ランチ,神奈川 ディナー",
  },
  beauty: {
    label: "美容・エステ",
    description: "神奈川県の美容室・ヘアサロン・エステサロン・ネイルサロンをオンライン予約。厚木・小田原・海老名・相模原エリア対応。クーポンあり。",
    keywords: "神奈川 美容室,神奈川 ヘアサロン,神奈川 エステサロン,神奈川 ネイル,美容 予約,エステ 予約,神奈川 美容 クーポン",
  },
};
