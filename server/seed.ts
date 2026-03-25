import { db } from "./db";
import { areas, categories, subCategories, shops, coupons, shopCategories, users } from "../shared/schema";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

// ─────────────────────────────
// エリアマスタ
// ─────────────────────────────
const seedAreas = [
  { slug: "odawara",        name: "小田原", label: "小田原エリア" },
  { slug: "yamato",         name: "大和",   label: "大和エリア" },
  { slug: "hadano",         name: "秦野",   label: "秦野エリア" },
  { slug: "hiratsuka",      name: "平塚",   label: "平塚エリア" },
  { slug: "atsugi",         name: "厚木",   label: "厚木エリア" },
  { slug: "isehara",        name: "伊勢原", label: "伊勢原エリア" },
  { slug: "ebina",          name: "海老名", label: "海老名エリア" },
  { slug: "zama",           name: "座間",   label: "座間エリア" },
  { slug: "ayase",          name: "綾瀬",   label: "綾瀬エリア" },
  { slug: "chigasaki",      name: "茅ヶ崎", label: "茅ヶ崎エリア" },
  { slug: "ninomiya",       name: "二宮",   label: "二宮エリア" },
  { slug: "oiso",           name: "大磯",   label: "大磯エリア" },
  { slug: "minamiashigara", name: "南足柄", label: "南足柄エリア" },
  { slug: "kaisei",         name: "開成",   label: "開成エリア" },
];

// ─────────────────────────────
// カテゴリマスタ
// ─────────────────────────────
const seedCategories = [
  { slug: "gourmet",  name: "グルメ",        icon: "utensils" },
  { slug: "beauty",   name: "美容・健康",     icon: "sparkles" },
  { slug: "shopping", name: "ショッピング",   icon: "shopping-bag" },
  { slug: "leisure",  name: "レジャー・体験", icon: "map-pin" },
  { slug: "service",  name: "サービス",       icon: "wrench" },
  { slug: "medical",  name: "医療・福祉",     icon: "heart-pulse" },
];


// ─────────────────────────────
// サブカテゴリマスタ
// ─────────────────────────────
const seedSubCategories = [
  // グルメ
  { categorySlug: "gourmet", slug: "washoku",   name: "和食",       icon: "utensils" },
  { categorySlug: "gourmet", slug: "yoshoku",   name: "洋食",       icon: "utensils" },
  { categorySlug: "gourmet", slug: "chuka",     name: "中華",       icon: "utensils" },
  { categorySlug: "gourmet", slug: "italian",   name: "イタリアン", icon: "utensils" },
  { categorySlug: "gourmet", slug: "izakaya",   name: "居酒屋",     icon: "utensils" },
  { categorySlug: "gourmet", slug: "cafe",      name: "カフェ",     icon: "coffee" },
  { categorySlug: "gourmet", slug: "ramen",     name: "ラーメン",   icon: "utensils" },
  { categorySlug: "gourmet", slug: "sushi",     name: "寿司・海鮮", icon: "utensils" },
  { categorySlug: "gourmet", slug: "sweets",    name: "スイーツ",   icon: "cake" },
  { categorySlug: "gourmet", slug: "gourmet_other",     name: "その他",     icon: "more-horizontal" },
  // 美容・健康
  { categorySlug: "beauty", slug: "hair",      name: "ヘアサロン",       icon: "scissors" },
  { categorySlug: "beauty", slug: "esthe",     name: "エステ",           icon: "sparkles" },
  { categorySlug: "beauty", slug: "nail",      name: "ネイル",           icon: "sparkles" },
  { categorySlug: "beauty", slug: "massage",   name: "マッサージ・整体", icon: "heart-pulse" },
  { categorySlug: "beauty", slug: "fitness",   name: "フィットネス",     icon: "dumbbell" },
  { categorySlug: "beauty", slug: "beauty_other",     name: "その他",           icon: "more-horizontal" },
  // ショッピング
  { categorySlug: "shopping", slug: "fashion",     name: "ファッション",   icon: "shopping-bag" },
  { categorySlug: "shopping", slug: "goods",       name: "雑貨",           icon: "shopping-bag" },
  { categorySlug: "shopping", slug: "food",        name: "食料品・惣菜",   icon: "shopping-cart" },
  { categorySlug: "shopping", slug: "electronics", name: "家電・デジタル", icon: "monitor" },
  { categorySlug: "shopping", slug: "books",       name: "書籍・文具",     icon: "book" },
  { categorySlug: "shopping", slug: "shopping_other",       name: "その他",         icon: "more-horizontal" },
  // レジャー・体験
  { categorySlug: "leisure", slug: "sightseeing",   name: "観光スポット",   icon: "map-pin" },
  { categorySlug: "leisure", slug: "onsen",         name: "温泉・スパ",     icon: "droplets" },
  { categorySlug: "leisure", slug: "outdoor",       name: "アウトドア",     icon: "tree-pine" },
  { categorySlug: "leisure", slug: "experience",    name: "体験・教室",     icon: "graduation-cap" },
  { categorySlug: "leisure", slug: "entertainment", name: "エンタメ",       icon: "music" },
  { categorySlug: "leisure", slug: "leisure_other",         name: "その他",         icon: "more-horizontal" },
  // サービス
  { categorySlug: "service", slug: "cleaning",   name: "クリーニング",       icon: "washing-machine" },
  { categorySlug: "service", slug: "repair",     name: "修理・メンテナンス", icon: "wrench" },
  { categorySlug: "service", slug: "school",     name: "教室・スクール",     icon: "graduation-cap" },
  { categorySlug: "service", slug: "realestate", name: "不動産",             icon: "home" },
  { categorySlug: "service", slug: "service_other",      name: "その他",             icon: "more-horizontal" },
  // 医療・福祉
  { categorySlug: "medical", slug: "clinic",   name: "病院・クリニック", icon: "stethoscope" },
  { categorySlug: "medical", slug: "dental",   name: "歯科",             icon: "smile" },
  { categorySlug: "medical", slug: "pharmacy", name: "調剤薬局",         icon: "pill" },
  { categorySlug: "medical", slug: "care",     name: "介護・福祉",       icon: "heart-handshake" },
  { categorySlug: "medical", slug: "medical_other",    name: "その他",           icon: "more-horizontal" },
];
// ─────────────────────────────
// 店舗データ（areaSlug・categorySlugで参照）
// ─────────────────────────────
const seedShops = [
  {
    name: "麺処 小田原屋",
    description: "地元で愛され続けて30年。自家製麺と豚骨魚介スープが自慢のラーメン店。小田原の新鮮な魚介を使った特製つけ麺も人気です。",
    areaSlug: "odawara",
    categorySlugs: ["gourmet"],
    imageUrl: "/images/shop-ramen.png",
    address: "神奈川県小田原市栄町2-1-5",
    phone: "0465-22-xxxx",
    hours: "11:00〜21:00",
    closedDays: "毎週火曜日",
    website: "https://example.com",
    displayOrder: 10,
    lineAccountUrl: "https://line.me/R/ti/p/@odawaraya",
    galleryImageUrls: ["/images/shop-ramen.png", "/images/shop-izakaya.png", "/images/shop-cafe.png"],
  },
  {
    name: "Boulangerie Soleil",
    description: "フランスで修行したシェフが焼き上げる本格パン。毎朝焼きたてのクロワッサンとバゲットが人気。季節限定のデニッシュも見逃せません。",
    areaSlug: "yamato",
    categorySlugs: ["gourmet"],
    imageUrl: "/images/shop-bakery.png",
    address: "神奈川県大和市中央2-3-10",
    phone: "046-260-xxxx",
    hours: "7:00〜18:00",
    closedDays: "毎週月曜日・火曜日",
    displayOrder: 5,
    galleryImageUrls: ["/images/shop-bakery.png", "/images/shop-cafe.png", "/images/shop-flower.png"],
  },
  {
    name: "Hair Salon MIKU",
    description: "大和駅徒歩3分。経験豊富なスタイリストが、あなたの魅力を引き出すヘアスタイルをご提案。カラーやパーマも得意です。",
    areaSlug: "yamato",
    categorySlugs: ["beauty"],
    imageUrl: "/images/shop-salon.png",
    address: "神奈川県大和市大和南1-5-2",
    phone: "046-261-xxxx",
    hours: "10:00〜20:00",
    closedDays: "毎週水曜日",
    website: "https://example.com",
    displayOrder: 8,
    lineAccountUrl: "https://line.me/R/ti/p/@miku-salon",
    galleryImageUrls: ["/images/shop-salon.png", "/images/shop-spa.png", "/images/shop-flower.png"],
  },
  {
    name: "居酒屋 海の幸",
    description: "小田原漁港直送の新鮮な魚介を楽しめる居酒屋。刺身盛り合わせや地魚の煮付けが名物。日本酒の品揃えも豊富です。",
    areaSlug: "odawara",
    categorySlugs: ["gourmet"],
    imageUrl: "/images/shop-izakaya.png",
    address: "神奈川県小田原市本町3-7-1",
    phone: "0465-24-xxxx",
    hours: "17:00〜23:00",
    closedDays: "毎週日曜日",
    displayOrder: 7,
    galleryImageUrls: ["/images/shop-izakaya.png", "/images/shop-sushi.png", "/images/shop-cafe.png"],
  },
  {
    name: "Cafe Komorebi",
    description: "緑に囲まれた癒しのカフェ。自家焙煎コーヒーとハンドメイドスイーツでゆったりとしたひとときを。Wi-Fi完備でテレワークにも。",
    areaSlug: "hadano",
    categorySlugs: ["gourmet"],
    imageUrl: "/images/shop-cafe.png",
    address: "神奈川県秦野市曲松1-2-8",
    phone: "0463-81-xxxx",
    hours: "9:00〜18:00",
    closedDays: "毎週木曜日",
    displayOrder: 3,
  },
  {
    name: "鮨処 匠",
    description: "カウンター8席のみの本格江戸前鮨。大将が一貫一貫丁寧に握ります。ランチのおまかせ握りセットは予約必須の人気メニュー。",
    areaSlug: "hiratsuka",
    categorySlugs: ["gourmet"],
    imageUrl: "/images/shop-sushi.png",
    address: "神奈川県平塚市紅谷町5-3-2",
    phone: "0463-21-xxxx",
    hours: "11:30〜14:00 / 17:00〜22:00",
    closedDays: "毎週月曜日",
    displayOrder: 9,
    lineAccountUrl: "https://line.me/R/ti/p/@sushi-takumi",
    galleryImageUrls: ["/images/shop-sushi.png", "/images/shop-izakaya.png", "/images/shop-ramen.png"],
  },
  {
    name: "リラクゼーション 和の庵",
    description: "日頃の疲れを癒す和のリラクゼーションサロン。アロマオイルを使った全身マッサージや足つぼが人気。完全予約制で落ち着いた空間。",
    areaSlug: "atsugi",
    categorySlugs: ["beauty"],
    imageUrl: "/images/shop-spa.png",
    address: "神奈川県厚木市中町2-6-15",
    phone: "046-225-xxxx",
    hours: "10:00〜21:00",
    closedDays: "不定休",
    displayOrder: 6,
    galleryImageUrls: ["/images/shop-spa.png", "/images/shop-salon.png", "/images/shop-gym.png"],
  },
  {
    name: "フィットネスジム POWER",
    description: "最新マシン完備のフィットネスジム。パーソナルトレーニングや各種スタジオプログラムも充実。初心者から上級者まで対応。",
    areaSlug: "isehara",
    categorySlugs: ["leisure"],
    imageUrl: "/images/shop-gym.png",
    address: "神奈川県伊勢原市板戸1-8-3",
    phone: "0463-94-xxxx",
    hours: "6:00〜23:00",
    closedDays: "年中無休",
    displayOrder: 4,
  },
  {
    name: "フラワーショップ 花音",
    description: "季節の花々を取り揃えたフラワーショップ。アレンジメントやブーケのオーダーも承ります。ギフトラッピングも無料。",
    areaSlug: "yamato",
    categorySlugs: ["shopping"],
    imageUrl: "/images/shop-flower.png",
    address: "神奈川県大和市鶴間1-4-7",
    phone: "046-274-xxxx",
    hours: "9:30〜19:00",
    closedDays: "毎週水曜日",
    displayOrder: 2,
  },
  {
    name: "小田原城下 甘味処 桜",
    description: "小田原城のそばにある和菓子カフェ。手作りのわらび餅やあんみつが人気。抹茶セットで小田原散策の休憩にぴったり。",
    areaSlug: "odawara",
    categorySlugs: ["gourmet"],
    imageUrl: "/images/shop-cafe.png",
    address: "神奈川県小田原市城内4-2-1",
    phone: "0465-23-xxxx",
    hours: "10:00〜17:00",
    closedDays: "毎週火曜日",
    displayOrder: 5,
    galleryImageUrls: ["/images/shop-cafe.png", "/images/shop-bakery.png", "/images/shop-flower.png"],
  },
  {
    name: "整体院 からだ工房",
    description: "骨盤矯正と姿勢改善の専門院。肩こり・腰痛・頭痛でお悩みの方に。丁寧なカウンセリングと施術で根本改善を目指します。",
    areaSlug: "hadano",
    categorySlugs: ["medical"],
    imageUrl: "/images/shop-spa.png",
    address: "神奈川県秦野市大秦町3-5-12",
    phone: "0463-83-xxxx",
    hours: "9:00〜20:00",
    closedDays: "毎週日曜日・祝日",
    displayOrder: 4,
  },
  {
    name: "パソコン修理 テクノサポート",
    description: "パソコンやスマホのトラブルならお任せ。データ復旧、液晶交換、ウイルス駆除など幅広く対応。出張サービスも行っています。",
    areaSlug: "hiratsuka",
    categorySlugs: ["service"],
    imageUrl: "/images/shop-gym.png",
    address: "神奈川県平塚市宝町8-1-6",
    phone: "0463-35-xxxx",
    hours: "10:00〜19:00",
    closedDays: "毎週日曜日",
    displayOrder: 1,
  },
  {
    name: "海老名ベーカリー ブレッドガーデン",
    description: "海老名駅直結のベーカリー。天然酵母を使用したこだわりのパンが50種類以上。イートインスペースもあり。",
    areaSlug: "ebina",
    categorySlugs: ["gourmet"],
    imageUrl: "/images/shop-bakery.png",
    address: "神奈川県海老名市中央1-1-1",
    phone: "046-234-xxxx",
    hours: "8:00〜20:00",
    closedDays: "年中無休",
    displayOrder: 6,
  },
  {
    name: "茅ヶ崎サーフショップ WAVE",
    description: "サーフボードやウェットスーツの販売・レンタル。初心者向けサーフィンスクールも開催。海好きが集まるお店です。",
    areaSlug: "chigasaki",
    categorySlugs: ["leisure"],
    imageUrl: "/images/shop-gym.png",
    address: "神奈川県茅ヶ崎市東海岸南3-2-5",
    phone: "0467-82-xxxx",
    hours: "9:00〜19:00",
    closedDays: "毎週火曜日",
    displayOrder: 5,
  },
];

// ─────────────────────────────
// クーポンデータ（shopNameで参照）
// ─────────────────────────────
const seedCoupons = [
  {
    shopName: "麺処 小田原屋",
    title: "ラーメン全品100円引き",
    description: "クーポン提示でラーメン全品が100円引きになります。他の割引との併用はできません。",
    discountType: "AMOUNT" as const,
    discountValue: 100,
    isFirstTimeOnly: false,
  },
  {
    shopName: "麺処 小田原屋",
    title: "LINE公式アカウント限定トッピング無料",
    description: "LINE公式アカウントを友だち追加で、お好きなトッピングを1つ無料サービス��",
    discountType: "FREE" as const,
    discountValue: 0,
    isFirstTimeOnly: false,
  },
  {
    shopName: "Boulangerie Soleil",
    title: "お買い上げ500円以上でミニパンプレゼント",
    description: "500円以上お買い上げでお好きなミニパンを1つプレゼント。",
    discountType: "FREE" as const,
    discountValue: 0,
    isFirstTimeOnly: false,
  },
  {
    shopName: "Hair Salon MIKU",
    title: "初回カット20%OFF",
    description: "初めてのご来店のお客様限定。カット施術が20%OFFになります。",
    discountType: "PERCENTAGE" as const,
    discountValue: 20,
    isFirstTimeOnly: true,
  },
  {
    shopName: "Hair Salon MIKU",
    title: "LINE友達限定ヘッドスパ無料",
    description: "LINE公式アカウントを友だち追加で、カット時にヘッドスパを無料サービス。",
    discountType: "FREE" as const,
    discountValue: 0,
    isFirstTimeOnly: false,
  },
  {
    shopName: "居酒屋 海の幸",
    title: "お会計10%OFF",
    description: "4名様以上のグループでのご利用も可能です。",
    discountType: "PERCENTAGE" as const,
    discountValue: 10,
    isFirstTimeOnly: false,
  },
  {
    shopName: "鮨処 匠",
    title: "ランチセット1品サービス",
    description: "ランチタイムにおまかせセットをご注文のお客様に、小鉢を1品サービス。",
    discountType: "FREE" as const,
    discountValue: 0,
    isFirstTimeOnly: false,
  },
  {
    shopName: "鮨処 匠",
    title: "LINE限定 握り1貫サービス",
    description: "LINE公式アカウント友だち追加で、お好きな握りを1貫サービス。",
    discountType: "FREE" as const,
    discountValue: 0,
    isFirstTimeOnly: false,
  },
  {
    shopName: "リラクゼーション 和の庵",
    title: "60分コース500円引き",
    description: "全身リラクゼーション60分以上のコースが500円引きになります。",
    discountType: "AMOUNT" as const,
    discountValue: 500,
    isFirstTimeOnly: false,
  },
  {
    shopName: "フィットネスジム POWER",
    title: "体験利用無料",
    description: "通常1,100円の体験利用が無料！マシンエリアとスタジオプログラムをお試しいただけます。",
    discountType: "FREE" as const,
    discountValue: 0,
    isFirstTimeOnly: true,
  },
  {
    shopName: "小田原城下 甘味処 桜",
    title: "抹茶セット100円引き",
    description: "人気の抹茶セット（抹茶＋季節の和菓子）が100円引きになります。",
    discountType: "AMOUNT" as const,
    discountValue: 100,
    isFirstTimeOnly: false,
  },
  {
    shopName: "整体院 からだ工房",
    title: "初回施術料30%OFF",
    description: "初めての方限定。全メニューの施術料が30%OFFになります。",
    discountType: "PERCENTAGE" as const,
    discountValue: 30,
    isFirstTimeOnly: true,
  },
  {
    shopName: "海老名ベーカリー ブレッドガーデン",
    title: "食パン1斤プレゼント",
    description: "1,000円以上のお買い上げで当店自慢の食パン1斤をプレゼント。",
    discountType: "FREE" as const,
    discountValue: 0,
    isFirstTimeOnly: false,
  },
];

// ─────────────────────────────
// seed実行
// ─────────────────────────────
export async function seedDatabase() {
  // 1. エリア投入
  const existingAreas = await db.select().from(areas);
  if (existingAreas.length === 0) {
    console.log("Seeding areas...");
    await db.insert(areas).values(seedAreas);
    console.log(`Seeded ${seedAreas.length} areas`);
  } else {
    console.log(`Areas already exist (${existingAreas.length}), skipping...`);
  }

  // 2. カテゴリ投入
  const existingCategories = await db.select().from(categories);
  if (existingCategories.length === 0) {
    console.log("Seeding categories...");
    await db.insert(categories).values(seedCategories);
    console.log(`Seeded ${seedCategories.length} categories`);
  } else {
    console.log(`Categories already exist (${existingCategories.length}), skipping...`);
  }
  // 2.5. サブカテゴリ投入
  const existingSubCategories = await db.select().from(subCategories);
  if (existingSubCategories.length === 0) {
    console.log("Seeding subCategories...");
    const allCategories = await db.select().from(categories);
    for (const sub of seedSubCategories) {
      const category = allCategories.find(c => c.slug === sub.categorySlug);
      if (!category) {
        console.warn(`Category not found: ${sub.categorySlug}`);
        continue;
      }
      await db.insert(subCategories).values({
        category_id: category.id,
        slug:        sub.slug,
        name:        sub.name,
        icon:        sub.icon,
      });
    }
    console.log(`Seeded ${seedSubCategories.length} subCategories`);
  } else {
    console.log(`SubCategories already exist (${existingSubCategories.length}), skipping...`);
  }
  // 3. 店舗投入
  const existingShops = await db.select().from(shops);
  if (existingShops.length === 0) {
    console.log("Seeding shops...");

    const allAreas = await db.select().from(areas);
    const allCategories = await db.select().from(categories);

    for (const seedShop of seedShops) {
      const area = allAreas.find(a => a.slug === seedShop.areaSlug);
      if (!area) {
        console.warn(`Area not found: ${seedShop.areaSlug}`);
        continue;
      }

      const [insertedShop] = await db.insert(shops).values({
        slug:            nanoid(10),
        name:            seedShop.name,
        description:     seedShop.description,
        areaId:          area.id,
        area:            seedShop.areaSlug,
        category:        seedShop.categorySlugs[0] ?? "",
        imageUrl:        seedShop.imageUrl,
        address:         seedShop.address,
        phone:           seedShop.phone,
        hours:           seedShop.hours,
        closedDays:      seedShop.closedDays,
        website:         seedShop.website ?? null,
        displayOrder:    seedShop.displayOrder,
        lineAccountUrl:  seedShop.lineAccountUrl ?? null,
        galleryImageUrls: seedShop.galleryImageUrls ?? null,
      }).returning();

      // 中間テーブル（shopCategories）投入
      for (const categorySlug of seedShop.categorySlugs) {
        const category = allCategories.find(c => c.slug === categorySlug);
        if (category) {
          await db.insert(shopCategories).values({
            shopId:     insertedShop.id,
            categoryId: category.id,
          });
        }
      }
    }
    console.log(`Seeded ${seedShops.length} shops`);
  } else {
    console.log(`Shops already exist (${existingShops.length}), skipping...`);
  }

  // 4. クーポン投入
  const existingCoupons = await db.select().from(coupons);
  if (existingCoupons.length === 0) {
    console.log("Seeding coupons...");

    const allShops = await db.select().from(shops);

    for (const seedCoupon of seedCoupons) {
      const shop = allShops.find(s => s.name === seedCoupon.shopName);
      if (!shop) {
        console.warn(`Shop not found: ${seedCoupon.shopName}`);
        continue;
      }
      await db.insert(coupons).values({
        shopId:         shop.id,
        title:          seedCoupon.title,
        description:    seedCoupon.description,
        discountType:   seedCoupon.discountType,
        discountValue:  seedCoupon.discountValue,
        isFirstTimeOnly: seedCoupon.isFirstTimeOnly,
      });
    }
    console.log(`Seeded ${seedCoupons.length} coupons`);
  } else {
    console.log(`Coupons already exist (${existingCoupons.length}), skipping...`);
  }

  // ─────────────────────────────
  // 初期ユーザー
  // ─────────────────────────────
  const existingUsers = await db.select().from(users);
  if (existingUsers.length === 0) {
    const adminHash = await bcrypt.hash("admin123", 10);
    await db.insert(users).values({
      username: "admin",
      passwordHash: adminHash,
      role: "admin",
      shopId: null,
    });

    // 予約機能がある店舗に店舗管理者アカウントを作成
    const reservationShopIds = [1, 3, 6, 17, 20, 24, 26, 28];
    const allShops = await db.select().from(shops);
    const reservationShops = allShops.filter(s => reservationShopIds.includes(s.id));

    for (const shop of reservationShops) {
      const hash = await bcrypt.hash("shop123", 10);
      await db.insert(users).values({
        username: `shop${shop.id}`,
        passwordHash: hash,
        role: "shop_admin",
        shopId: shop.id,
      });
    }
    console.log(`Seeded users: admin + ${reservationShops.length} shop admins`);
  } else {
    console.log(`Users already exist (${existingUsers.length}), skipping...`);
  }
}
