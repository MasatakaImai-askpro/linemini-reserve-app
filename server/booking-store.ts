import { randomBytes } from "crypto";

export interface Staff {
  id: string;
  name: string;
  role: string;
  avatar: string;
  courseIds: string[];
}

export interface Course {
  id: string;
  name: string;
  category: string;
  duration: number;
  price: number;
  description: string;
  prepaymentOnly: boolean;
  imageUrl: string | null;
  staffIds: string[];
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface Reservation {
  id: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  date: string;
  time: string;
  staffId: string;
  courseId: string;
  status: "confirmed" | "pending" | "cancelled";
  paid: boolean;
  partySize?: number;
  reservationToken?: string;
}

interface SlotEntry {
  id: string;
  staffId: string;
  dayOfWeek: number;
  time: string;
  available: boolean;
}

interface Inquiry {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
  status: string;
  createdAt: string;
}

interface ShopBookingData {
  staff: Staff[];
  courses: Course[];
  reservations: Reservation[];
  settings: Record<string, string>;
}

const SHOP_BOOKING_DATA: Record<number, ShopBookingData> = {
  1: {
    staff: [
      { id: "s1-1", name: "佐藤 健太", role: "料理長", avatar: "佐健", courseIds: ["c1-1", "c1-2"] },
      { id: "s1-2", name: "高橋 裕子", role: "副料理長", avatar: "高裕", courseIds: ["c1-1", "c1-3"] },
    ],
    courses: [
      { id: "c1-1", name: "特製ラーメンコース", category: "食事", duration: 60, price: 2800, description: "自家製麺と特製スープの極上ラーメンコース。前菜・餃子・デザート付き。", prepaymentOnly: false, imageUrl: null, staffIds: ["s1-1", "s1-2"] },
      { id: "c1-2", name: "宴会プラン（2時間）", category: "宴会", duration: 120, price: 4500, description: "飲み放題付き宴会プラン。ラーメン・チャーハン・餃子など全8品。", prepaymentOnly: true, imageUrl: null, staffIds: ["s1-1"] },
      { id: "c1-3", name: "ランチセット予約", category: "食事", duration: 45, price: 1200, description: "日替わりラーメン＋ミニチャーハン＋ドリンクのお得なランチセット。", prepaymentOnly: false, imageUrl: null, staffIds: ["s1-2"] },
    ],
    reservations: [
      { id: "r1-1", customerName: "田中 太郎", date: "2026-03-10", time: "12:00", staffId: "s1-1", courseId: "c1-1", status: "confirmed", paid: true },
      { id: "r1-2", customerName: "山田 花子", date: "2026-03-10", time: "18:00", staffId: "s1-1", courseId: "c1-2", status: "pending", paid: false },
    ],
    settings: {
      store_name: "麺処 小田原屋",
      store_description: "自家製麺と厳選スープのこだわりラーメン店",
      store_address: "神奈川県小田原市栄町2-1-5",
      store_phone: "0465-22-1234",
      store_email: "info@odawaraya.jp",
      store_hours: "11:00〜22:00（L.O. 21:30）",
      store_closed_days: "毎週水曜日",
      banner_url: "",
      staff_selection_enabled: "false",
      table_count: "5",
      max_party_size: "6",
    },
  },
  3: {
    staff: [
      { id: "s3-1", name: "田中 美咲", role: "オーナースタイリスト", avatar: "田美", courseIds: ["c3-1", "c3-2", "c3-3", "c3-4"] },
      { id: "s3-2", name: "佐藤 優花", role: "シニアスタイリスト", avatar: "佐優", courseIds: ["c3-1", "c3-2", "c3-3"] },
      { id: "s3-3", name: "山本 凛", role: "スタイリスト", avatar: "山凛", courseIds: ["c3-1", "c3-2"] },
      { id: "s3-4", name: "鈴木 愛", role: "ジュニアスタイリスト", avatar: "鈴愛", courseIds: ["c3-1"] },
    ],
    courses: [
      { id: "c3-1", name: "カット", category: "ヘア", duration: 60, price: 4400, description: "カウンセリング・シャンプー・カット・ブロー込みのスタンダードメニュー。", prepaymentOnly: false, imageUrl: null, staffIds: ["s3-1", "s3-2", "s3-3", "s3-4"] },
      { id: "c3-2", name: "カット＋カラー", category: "ヘア", duration: 120, price: 9800, description: "カットとカラーのセットメニュー。オーガニックカラー使用。", prepaymentOnly: false, imageUrl: null, staffIds: ["s3-1", "s3-2", "s3-3"] },
      { id: "c3-3", name: "カット＋パーマ", category: "ヘア", duration: 150, price: 13200, description: "カットとパーマのセットメニュー。デジタルパーマも対応。", prepaymentOnly: false, imageUrl: null, staffIds: ["s3-1", "s3-2"] },
      { id: "c3-4", name: "ヘッドスパ", category: "リラクゼーション", duration: 45, price: 5500, description: "頭皮ケア＆リラクゼーション。炭酸泉使用。", prepaymentOnly: false, imageUrl: null, staffIds: ["s3-1"] },
    ],
    reservations: [
      { id: "r3-1", customerName: "高橋 花子", date: "2026-03-10", time: "10:00", staffId: "s3-1", courseId: "c3-1", status: "confirmed", paid: true },
      { id: "r3-2", customerName: "伊藤 明美", date: "2026-03-10", time: "11:30", staffId: "s3-2", courseId: "c3-2", status: "confirmed", paid: true },
      { id: "r3-3", customerName: "渡辺 美穂", date: "2026-03-10", time: "14:00", staffId: "s3-1", courseId: "c3-4", status: "pending", paid: false },
      { id: "r3-4", customerName: "中村 さくら", date: "2026-03-11", time: "10:00", staffId: "s3-3", courseId: "c3-1", status: "confirmed", paid: false },
    ],
    settings: {
      store_name: "Hair Salon MIKU",
      store_description: "あなたの魅力を引き出すヘアサロン",
      store_address: "神奈川県大和市中央3-5-8",
      store_phone: "046-261-3456",
      store_email: "info@salon-miku.jp",
      store_hours: "10:00〜20:00（最終受付19:00）",
      store_closed_days: "毎週火曜日",
      banner_url: "",
      staff_selection_enabled: "true",
    },
  },
  6: {
    staff: [
      { id: "s6-1", name: "小林 大将", role: "大将（板前）", avatar: "小大", courseIds: ["c6-1", "c6-2", "c6-3"] },
      { id: "s6-2", name: "加藤 職人", role: "二番手", avatar: "加職", courseIds: ["c6-1", "c6-2"] },
    ],
    courses: [
      { id: "c6-1", name: "おまかせ握りコース", category: "寿司", duration: 90, price: 8800, description: "旬のネタを大将が厳選。握り10貫＋お椀＋デザート。", prepaymentOnly: true, imageUrl: null, staffIds: ["s6-1", "s6-2"] },
      { id: "c6-2", name: "特上握りコース", category: "寿司", duration: 120, price: 15800, description: "最高級ネタの特上握り15貫＋前菜3種＋お椀＋デザート。", prepaymentOnly: true, imageUrl: null, staffIds: ["s6-1", "s6-2"] },
      { id: "c6-3", name: "カウンター席予約", category: "席予約", duration: 60, price: 0, description: "カウンター席の予約。お料理は当日注文。", prepaymentOnly: false, imageUrl: null, staffIds: ["s6-1"] },
    ],
    reservations: [
      { id: "r6-1", customerName: "木村 一郎", date: "2026-03-10", time: "18:00", staffId: "s6-1", courseId: "c6-1", status: "confirmed", paid: true },
      { id: "r6-2", customerName: "松本 恵子", date: "2026-03-11", time: "12:00", staffId: "s6-2", courseId: "c6-2", status: "pending", paid: false },
    ],
    settings: {
      store_name: "鮨処 匠",
      store_description: "小田原の新鮮な魚介を職人技で握る本格寿司店",
      store_address: "神奈川県小田原市本町1-8-12",
      store_phone: "0465-34-5678",
      store_email: "info@sushi-takumi.jp",
      store_hours: "11:30〜14:00 / 17:00〜22:00",
      store_closed_days: "毎週月曜日",
      banner_url: "",
      staff_selection_enabled: "true",
    },
  },
  17: {
    staff: [
      { id: "s17-1", name: "山田 彩華", role: "トップスタイリスト", avatar: "山彩", courseIds: ["c17-1", "c17-2", "c17-3", "c17-4"] },
      { id: "s17-2", name: "中村 恵理", role: "シニアスタイリスト", avatar: "中恵", courseIds: ["c17-1", "c17-2", "c17-3"] },
      { id: "s17-3", name: "田中 悠希", role: "スタイリスト", avatar: "田悠", courseIds: ["c17-1", "c17-2"] },
    ],
    courses: [
      { id: "c17-1", name: "カット", category: "ヘア", duration: 60, price: 5500, description: "カウンセリング・シャンプー・カット・ブロー込み。横浜で人気の技術派サロン。", prepaymentOnly: false, imageUrl: null, staffIds: ["s17-1", "s17-2", "s17-3"] },
      { id: "c17-2", name: "カット＋カラー", category: "ヘア", duration: 120, price: 12000, description: "カットとカラーのフルコース。イルミナカラー・アディクシーカラー対応。", prepaymentOnly: false, imageUrl: null, staffIds: ["s17-1", "s17-2", "s17-3"] },
      { id: "c17-3", name: "トリートメント単品", category: "ヘアケア", duration: 45, price: 4400, description: "傷んだ髪を徹底補修。TOKIO・ケラスターゼなど高品質トリートメント。", prepaymentOnly: false, imageUrl: null, staffIds: ["s17-1", "s17-2"] },
      { id: "c17-4", name: "パーミング（パーマ）", category: "ヘア", duration: 150, price: 15000, description: "デジタルパーマ・コールドパーマ各種対応。カット込みプライス。", prepaymentOnly: true, imageUrl: null, staffIds: ["s17-1"] },
    ],
    reservations: [
      { id: "r17-1", customerName: "鈴木 美里", date: "2026-03-20", time: "10:00", staffId: "s17-1", courseId: "c17-2", status: "confirmed", paid: true },
      { id: "r17-2", customerName: "小林 奈緒", date: "2026-03-20", time: "13:00", staffId: "s17-2", courseId: "c17-1", status: "confirmed", paid: false },
    ],
    settings: {
      store_name: "Beauty Lounge 横浜",
      store_description: "横浜関内のトータルビューティーサロン",
      store_address: "神奈川県横浜市中区本町3-24",
      store_phone: "045-222-1234",
      store_email: "info@beauty-yokohama.jp",
      store_hours: "10:00〜20:00（最終受付19:00）",
      store_closed_days: "毎週水曜日",
      banner_url: "",
      staff_selection_enabled: "false",
    },
  },
  20: {
    staff: [
      { id: "s20-1", name: "橋本 涼子", role: "アロマセラピスト", avatar: "橋涼", courseIds: ["c20-1", "c20-2", "c20-3"] },
      { id: "s20-2", name: "伊藤 美月", role: "スパセラピスト", avatar: "伊美", courseIds: ["c20-1", "c20-2"] },
    ],
    courses: [
      { id: "c20-1", name: "全身アロマトリートメント", category: "リラクゼーション", duration: 90, price: 9800, description: "天然アロマオイルを使った全身の深部ケア。日常の疲れをリセット。", prepaymentOnly: false, imageUrl: null, staffIds: ["s20-1", "s20-2"] },
      { id: "c20-2", name: "岩盤浴＋マッサージセット", category: "温浴", duration: 120, price: 7800, description: "60分岩盤浴と60分ボディマッサージのお得なセットプラン。", prepaymentOnly: false, imageUrl: null, staffIds: ["s20-1", "s20-2"] },
      { id: "c20-3", name: "贅沢プレミアムコース", category: "リラクゼーション", duration: 150, price: 18000, description: "フェイシャル・ボディ・ヘッドスパのフルパッケージ。最高の癒しを体験。", prepaymentOnly: true, imageUrl: null, staffIds: ["s20-1"] },
    ],
    reservations: [
      { id: "r20-1", customerName: "加藤 早苗", date: "2026-03-21", time: "11:00", staffId: "s20-1", courseId: "c20-1", status: "confirmed", paid: true },
    ],
    settings: {
      store_name: "温浴スパ 厚木の湯",
      store_description: "丹沢の天然水を使用した癒しの温泉スパ",
      store_address: "神奈川県厚木市中町2-8-1",
      store_phone: "046-222-1234",
      store_email: "info@atsugi-spa.jp",
      store_hours: "10:00〜22:00（最終受付20:30）",
      store_closed_days: "年中無休",
      banner_url: "",
      staff_selection_enabled: "false",
      table_count: "3",
      max_party_size: "2",
    },
  },
  24: {
    staff: [
      { id: "s24-1", name: "石田 康平", role: "オーナーシェフ", avatar: "石康", courseIds: ["c24-1", "c24-2", "c24-3"] },
      { id: "s24-2", name: "佐々木 和香", role: "パティシエ", avatar: "佐和", courseIds: ["c24-2", "c24-3"] },
    ],
    courses: [
      { id: "c24-1", name: "絶景テラスランチ", category: "食事", duration: 90, price: 3800, description: "富士山を望むテラス席での特別ランチ。季節野菜のプレートと特製スープ付き。", prepaymentOnly: false, imageUrl: null, staffIds: ["s24-1", "s24-2"] },
      { id: "c24-2", name: "アフタヌーンティーセット", category: "カフェ", duration: 60, price: 2400, description: "箱根の素材を使ったスイーツ3種＋選べるドリンク。", prepaymentOnly: false, imageUrl: null, staffIds: ["s24-1", "s24-2"] },
      { id: "c24-3", name: "サンセットディナーコース", category: "食事", duration: 120, price: 8800, description: "夕暮れの富士山を眺めながらの特別ディナー。全5品。完全予約制。", prepaymentOnly: true, imageUrl: null, staffIds: ["s24-1"] },
    ],
    reservations: [
      { id: "r24-1", customerName: "山田 健三", date: "2026-03-22", time: "12:00", staffId: "s24-1", courseId: "c24-1", status: "confirmed", paid: false },
      { id: "r24-2", customerName: "西村 明子", date: "2026-03-22", time: "15:00", staffId: "s24-2", courseId: "c24-2", status: "confirmed", paid: true },
    ],
    settings: {
      store_name: "箱根山荘カフェ",
      store_description: "大涌谷近くの絶景カフェ・レストラン",
      store_address: "神奈川県足柄下郡箱根町仙石原82-1",
      store_phone: "0460-84-1234",
      store_email: "info@hakone-cafe.jp",
      store_hours: "10:00〜17:00（ディナーは予約のみ）",
      store_closed_days: "毎週火曜日",
      banner_url: "",
      staff_selection_enabled: "false",
      table_count: "10",
      max_party_size: "8",
    },
  },
  26: {
    staff: [
      { id: "s26-1", name: "鈴木 大輔", role: "店主", avatar: "鈴大", courseIds: ["c26-1", "c26-2", "c26-3"] },
      { id: "s26-2", name: "渡辺 健", role: "副店主", avatar: "渡健", courseIds: ["c26-1", "c26-2"] },
    ],
    courses: [
      { id: "c26-1", name: "御殿場高原ラーメンセット", category: "食事", duration: 45, price: 1500, description: "看板の鶏白湯ラーメン＋餃子3個＋ライスのお得セット。", prepaymentOnly: false, imageUrl: null, staffIds: ["s26-1", "s26-2"] },
      { id: "c26-2", name: "宴会コース（2時間）", category: "宴会", duration: 120, price: 3800, description: "飲み放題付き全8品。ラーメン・餃子・唐揚げなど御殿場名物料理を堪能。", prepaymentOnly: true, imageUrl: null, staffIds: ["s26-1"] },
      { id: "c26-3", name: "ランチ限定特盛セット", category: "食事", duration: 30, price: 1200, description: "平日11:00〜14:00限定。特盛ラーメン＋ドリンク付き。", prepaymentOnly: false, imageUrl: null, staffIds: ["s26-1", "s26-2"] },
    ],
    reservations: [
      { id: "r26-1", customerName: "田中 孝一", date: "2026-03-23", time: "18:00", staffId: "s26-1", courseId: "c26-2", status: "confirmed", paid: true },
    ],
    settings: {
      store_name: "御殿場高原ラーメン",
      store_description: "富士山の湧き水で炊く鶏白湯スープが自慢",
      store_address: "静岡県御殿場市新橋910-3",
      store_phone: "0550-82-1234",
      store_email: "info@gotemba-ramen.jp",
      store_hours: "11:00〜21:00（L.O. 20:30）",
      store_closed_days: "毎週木曜日",
      banner_url: "",
      staff_selection_enabled: "false",
      table_count: "6",
      max_party_size: "4",
    },
  },
  28: {
    staff: [
      { id: "s28-1", name: "木村 奈々", role: "オーナースタイリスト", avatar: "木奈", courseIds: ["c28-1", "c28-2", "c28-3", "c28-4"] },
      { id: "s28-2", name: "松田 由香", role: "シニアスタイリスト", avatar: "松由", courseIds: ["c28-1", "c28-2", "c28-3"] },
      { id: "s28-3", name: "吉田 莉子", role: "スタイリスト", avatar: "吉莉", courseIds: ["c28-1", "c28-2"] },
    ],
    courses: [
      { id: "c28-1", name: "カット", category: "ヘア", duration: 60, price: 4000, description: "カウンセリング・シャンプー・カット・ブロー込み。20年以上の実績ある技術。", prepaymentOnly: false, imageUrl: null, staffIds: ["s28-1", "s28-2", "s28-3"] },
      { id: "c28-2", name: "カット＋カラー", category: "ヘア", duration: 120, price: 9500, description: "カットとカラーのセットメニュー。ダメージレスカラー対応。", prepaymentOnly: false, imageUrl: null, staffIds: ["s28-1", "s28-2", "s28-3"] },
      { id: "c28-3", name: "着付けサービス", category: "着付け", duration: 60, price: 8000, description: "振袖・訪問着・留袖など各種着付け対応。ヘアセット込みプランあり。", prepaymentOnly: true, imageUrl: null, staffIds: ["s28-1", "s28-2"] },
      { id: "c28-4", name: "ヘアセット＋着付けセット", category: "着付け", duration: 90, price: 12000, description: "ヘアセットと着付けのフルコース。成人式・七五三・結婚式に。", prepaymentOnly: true, imageUrl: null, staffIds: ["s28-1"] },
    ],
    reservations: [
      { id: "r28-1", customerName: "森田 千夏", date: "2026-03-24", time: "09:00", staffId: "s28-1", courseId: "c28-3", status: "confirmed", paid: true },
      { id: "r28-2", customerName: "上田 里奈", date: "2026-03-24", time: "11:00", staffId: "s28-2", courseId: "c28-1", status: "confirmed", paid: false },
    ],
    settings: {
      store_name: "ヘアーズ 座間",
      store_description: "地域密着20年以上の信頼と実績ある美容室",
      store_address: "神奈川県座間市相模が丘1-45-3",
      store_phone: "046-255-1234",
      store_email: "info@hairs-zama.jp",
      store_hours: "9:30〜19:30（最終受付18:30）",
      store_closed_days: "毎週月曜日",
      banner_url: "",
      staff_selection_enabled: "false",
    },
  },
};

class BookingStore {
  staff: Staff[];
  courses: Course[];
  reservations: Reservation[];
  settings: Record<string, string>;
  inquiries: Inquiry[] = [];
  slots: SlotEntry[] = [];
  private nextId = 100;

  constructor(data: ShopBookingData) {
    this.staff = JSON.parse(JSON.stringify(data.staff));
    this.courses = JSON.parse(JSON.stringify(data.courses));
    this.reservations = JSON.parse(JSON.stringify(data.reservations));
    this.settings = { ...data.settings };
  }

  genId() {
    return String(this.nextId++);
  }

  genToken() {
    return randomBytes(32).toString("hex");
  }

  // 予約済み時間から、コースdurationを考慮してブロックされるスロットセットを返す
  private getBlockedSlots(staffId: string, date: string): Set<string> {
    const blocked = new Set<string>();
    const staffReservations = this.reservations.filter(
      (r) => r.date === date && r.staffId === staffId && r.status !== "cancelled"
    );
    for (const r of staffReservations) {
      const course = this.courses.find((c) => c.id === r.courseId);
      const duration = course?.duration ?? 30;
      const slotsNeeded = Math.ceil(duration / 30);
      const [rh, rm] = r.time.split(":").map(Number);
      let totalMin = rh * 60 + rm;
      for (let i = 0; i < slotsNeeded; i++) {
        const sh = Math.floor(totalMin / 60);
        const sm = totalMin % 60;
        blocked.add(`${sh}:${String(sm).padStart(2, "0")}`);
        totalMin += 30;
      }
    }
    return blocked;
  }

  getTimeSlots(staffId: string, date: string, courseId?: string): TimeSlot[] {
    const dateObj = new Date(date + "T00:00:00");
    const dayOfWeek = dateObj.getDay();

    const course = courseId ? this.courses.find((c) => c.id === courseId) : null;
    const duration = course?.duration ?? 30;
    const slotsNeeded = Math.ceil(duration / 30);

    // あるスロット時刻から slotsNeeded 分の連続空きがあるか判定
    const isAvailable = (time: string, blocked: Set<string>): boolean => {
      const [h, m] = time.split(":").map(Number);
      let totalMin = h * 60 + m;
      // 最後のスロットが 19:00 を超えないこと（10:00-19:00 が営業範囲）
      if (totalMin + (slotsNeeded - 1) * 30 > 19 * 60) return false;
      for (let i = 0; i < slotsNeeded; i++) {
        const sh = Math.floor(totalMin / 60);
        const sm = totalMin % 60;
        if (blocked.has(`${sh}:${String(sm).padStart(2, "0")}`)) return false;
        totalMin += 30;
      }
      return true;
    };

    // デフォルトスロット一覧（10:00〜19:00 の30分刻み）
    const defaultSlotTimes: string[] = [];
    for (let h = 10; h <= 19; h++) {
      for (const m of [0, 30]) {
        if (h === 19 && m === 30) continue;
        defaultSlotTimes.push(`${h}:${String(m).padStart(2, "0")}`);
      }
    }

    if (staffId === "__shop__") {
      const tableCount = parseInt(this.settings.table_count || "0", 10);

      if (tableCount > 0) {
        // 卓数モード: 同時間帯の重複予約数 < tableCount なら available
        return defaultSlotTimes.map((time) => {
          const [h, m] = time.split(":").map(Number);
          const startMin = h * 60 + m;
          // コース終了時間が営業終了（19:00）を超えないこと
          if (startMin + duration > 19 * 60) return { time, available: false };

          // 指名なし予約のうち、この時間帯と重複する予約数をカウント
          const count = this.reservations.filter((r) => {
            if (r.status === "cancelled") return false;
            if (r.date !== date) return false;
            if (r.staffId !== "__shop__") return false;
            const rCourse = this.courses.find((c) => c.id === r.courseId);
            const rDuration = rCourse?.duration ?? 30;
            const [rh, rm] = r.time.split(":").map(Number);
            const rStartMin = rh * 60 + rm;
            const rEndMin = rStartMin + rDuration;
            const slotEndMin = startMin + duration;
            return rStartMin < slotEndMin && rEndMin > startMin;
          }).length;

          return { time, available: count < tableCount };
        });
      }

      // tableCount 未設定: コースに対応できるスタッフのいずれかが duration 分空いている時間のみ available
      const candidateIds = course?.staffIds?.length
        ? course.staffIds
        : this.staff.map((s) => s.id);

      const candidateBlocked = candidateIds.map((sid) =>
        this.getBlockedSlots(sid, date)
      );

      return defaultSlotTimes.map((time) => ({
        time,
        available: candidateBlocked.some((blocked) =>
          isAvailable(time, blocked)
        ),
      }));
    }

    // 指名あり: カスタムスロットがあればそれを使う
    const customSlots = this.slots.filter(
      (s) => s.staffId === staffId && s.dayOfWeek === dayOfWeek
    );
    const blocked = this.getBlockedSlots(staffId, date);

    if (customSlots.length > 0) {
      return customSlots
        .map((s) => ({
          time: s.time,
          available: s.available && isAvailable(s.time, blocked),
        }))
        .sort((a, b) => a.time.localeCompare(b.time));
    }

    return defaultSlotTimes.map((time) => ({
      time,
      available: isAvailable(time, blocked),
    }));
  }

  getStaffSlots(staffId: string): SlotEntry[] {
    return this.slots.filter((s) => s.staffId === staffId);
  }

  /**
   * スタッフあり設定で指名なし予約時に、対象日時に空きのあるスタッフを1名返す。
   * コースのdurationを考慮して連続した空きがあるスタッフを選ぶ。
   * 空きがなければ null を返す。
   */
  findAvailableStaff(date: string, time: string, courseId?: string): string | null {
    const course = courseId ? this.courses.find((c) => c.id === courseId) : null;
    const duration = course?.duration ?? 30;
    const slotsNeeded = Math.ceil(duration / 30);

    const [h, m] = time.split(":").map(Number);
    const startMin = h * 60 + m;

    const candidateIds = course?.staffIds?.length
      ? course.staffIds
      : this.staff.map((s) => s.id);

    for (const sid of candidateIds) {
      const blocked = this.getBlockedSlots(sid, date);
      let available = true;
      let totalMin = startMin;
      for (let i = 0; i < slotsNeeded; i++) {
        const sh = Math.floor(totalMin / 60);
        const sm = totalMin % 60;
        if (blocked.has(`${sh}:${String(sm).padStart(2, "0")}`)) {
          available = false;
          break;
        }
        totalMin += 30;
      }
      if (available) return sid;
    }
    return null;
  }
}

class BookingStoreManager {
  private stores = new Map<number, BookingStore>();

  getStore(shopId: number): BookingStore | undefined {
    if (!this.stores.has(shopId)) {
      const data = SHOP_BOOKING_DATA[shopId];
      if (!data) return undefined;
      this.stores.set(shopId, new BookingStore(data));
    }
    return this.stores.get(shopId);
  }

  getShopIdsWithBooking(): number[] {
    return Object.keys(SHOP_BOOKING_DATA).map(Number);
  }
}

export const bookingManager = new BookingStoreManager();

export function formatPrice(price: number): string {
  return `¥${price.toLocaleString()}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}
