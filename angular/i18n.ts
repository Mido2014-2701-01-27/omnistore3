import type { Lang } from './types.js';

type Dict = Record<string, string>;

const base: Record<Lang, Dict> = {
  en: {
    welcome_back: "Welcome Back",
    create_account: "Create Account",
    full_name: "Full Name",
    email_label: "Email Address",
    password_label: "Password",
    login_btn: "Log In",
    signup_btn: "Sign Up",
    signup_link: "Sign Up",
    no_account: "Don't have an account?",
    has_account: "Already have an account?",
    continue_guest: "Continue as Guest",
    guest_user: "Guest User",
    guest_prompt_title: "Sign In Required",
    guest_prompt_msg: "Please log in or create an account to complete your purchase.",
    cancel: "Cancel",
    welcome_user: "Welcome, ",
    logout: "LOG OUT",
    cart: "Cart",
    cat_all: "All Items",
    cat_food: "Food & Drinks",
    cat_men: "Men's Apparel",
    cat_women: "Women's Apparel",
    cat_jewelry: "Watches & Jewelry",
    cat_gaming: "Gaming Laptops & PCs",
    cat_peripherals: "Tech Accessories",
    cat_furniture: "Furniture",
    product_details: "Product Details",
    add_to_cart: "Add to Reserve",
    reviews_title: "Customer Reviews & Ratings",
    your_cart: "Your Shopping Cart",
    subtotal: "Subtotal",
    delivery_fee: "Delivery Fee",
    free_delivery: "FREE",
    discount: "Discount",
    promo_code_placeholder: "Enter Promo Code",
    apply_promo: "Apply",
    total: "Total",
    checkout: "Checkout",
    order_success: "Order Placed Successfully!",
    continue_shopping: "Continue Shopping",
    toast_added: "Added to selection:",
    toast_removed: "Removed from selection:",
    toast_empty_cart: "Your selection is empty!",
    toast_checkout_success: "Acquisition completed successfully!",
    toast_promo_applied: "Promo code applied successfully!",
    toast_promo_invalid: "Invalid promo code!",
    validation_required: "Please fill out this field.",
    // Validation Modal Titles & Messages
    action_rejected_title: "Action Rejected",
    err_missing_name: "Please enter your name to complete registration.",
    err_pass_length: "Your password must be at least 8 characters long.",
    err_pass_weak: "Your password is too weak. Please choose a stronger combination.",
    modal_understood_btn: "Understood"
  },
  ar: {
    welcome_back: "مرحباً بعودتك",
    create_account: "إنشاء حساب جديد",
    full_name: "الاسم الكامل",
    email_label: "البريد الإلكتروني",
    password_label: "كلمة المرور",
    login_btn: "تسجيل الدخول",
    signup_btn: "إنشاء حساب",
    signup_link: "إنشاء حساب",
    no_account: "ليس لديك حساب؟",
    has_account: "لديك حساب بالفعل؟",
    continue_guest: "المتابعة كضيف",
    guest_user: "زائر",
    guest_prompt_title: "يتطلب تسجيل الدخول",
    guest_prompt_msg: "يرجى تسجيل الدخول أو إنشاء حساب لإتمام عملية الشراء.",
    cancel: "إلغاء",
    welcome_user: "أهلاً بك، ",
    logout: "تسجيل الخروج",
    cart: "السلة",
    cat_all: "جميع المنتجات",
    cat_food: "الأطعمة والمشروبات",
    cat_men: "ملابس رجالية",
    cat_women: "ملابس نسائية",
    cat_jewelry: "ساعات والمجوهرات",
    cat_gaming: "كمبيوترات وأجهزة ألعاب",
    cat_peripherals: "إكسسوارات تقنية",
    cat_furniture: "الأثاث",
    product_details: "تفاصيل المنتج",
    add_to_cart: "إضافة إلى السلة",
    reviews_title: "تقييمات وآراء العملاء",
    your_cart: "سلة التسوق الخاصة بك",
    subtotal: "المجموع الفرعي",
    delivery_fee: "رسوم التوصيل",
    free_delivery: "مجاني",
    discount: "الخصم",
    promo_code_placeholder: "أدخل رمز التخفيض",
    apply_promo: "تطبيق",
    total: "المجموع الكلي",
    checkout: "إتمام الشراء",
    order_success: "تم إرسال الطلب بنجاح!",
    continue_shopping: "متابعة التسوق",
    toast_added: "تمت الإضافة إلى السلة:",
    toast_removed: "تم الحذف من السلة:",
    toast_empty_cart: "سلة التسوق فارغة!",
    toast_checkout_success: "تم إتمام عملية الشراء بنجاح!",
    toast_promo_applied: "تم تطبيق رمز التخفيض بنجاح!",
    toast_promo_invalid: "رمز التخفيض غير صالحة!",
    validation_required: "يرجى ملء هذا الحقل.",
    // Validation Modal Titles & Messages
    action_rejected_title: "تم رفض الإجراء",
    err_missing_name: "يرجى إدخال اسمك لإكمال عملية التسجيل.",
    err_pass_length: "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.",
    err_pass_weak: "كلمة المرور ضعيفة جداً. يرجى اختيار كلمة مرور أَقوى.",
    modal_understood_btn: "حسناً"
  }
};

// New strings used by the added features.
const extra: Record<Lang, Dict> = {
  en: {
    undo: 'Undo',
    qty_more: 'Add one more',
    qty_less: 'Remove one',
    remove_item: 'Remove item',
    cart_empty: 'Your vault selection is currently empty.',
    promo_active: 'Code applied',
    promo_remove: 'Remove',
    toast_promo_removed: 'Promo code removed.',
    toast_restored: 'Item restored.',
    price_max: 'Max price',
    sort_rating: 'Top rated',
    clear_filters: 'Clear filters',
    results: 'products',
    offline_banner: "Couldn't reach the live catalogue, so you're seeing a sample selection.",
    retry: 'Retry',
    strength_label: 'Password strength',
    strength_0: 'Too short',
    strength_1: 'Weak',
    strength_2: 'Fair',
    strength_3: 'Good',
    strength_4: 'Strong',
    help_title: 'Keyboard shortcuts',
    help_search: 'Focus the search box',
    help_palette: 'Open the command palette',
    help_help: 'Show this list',
    help_close: 'Close any open window',
    cart_saved_items: 'items',
    wish_empty: 'Nothing saved yet. Tap the heart on a product to keep it here.'
  },
  ar: {
    undo: 'تراجع',
    qty_more: 'أضف واحداً',
    qty_less: 'أزل واحداً',
    remove_item: 'حذف المنتج',
    cart_empty: 'سلة التسوق فارغة حالياً.',
    promo_active: 'تم تطبيق الرمز',
    promo_remove: 'إزالة',
    toast_promo_removed: 'تمت إزالة رمز التخفيض.',
    toast_restored: 'تمت استعادة المنتج.',
    price_max: 'أعلى سعر',
    sort_rating: 'الأعلى تقييماً',
    clear_filters: 'مسح التصفية',
    results: 'منتج',
    offline_banner: 'تعذّر الوصول إلى الكتالوج المباشر، لذلك نعرض تشكيلة تجريبية.',
    retry: 'إعادة المحاولة',
    strength_label: 'قوة كلمة المرور',
    strength_0: 'قصيرة جداً',
    strength_1: 'ضعيفة',
    strength_2: 'مقبولة',
    strength_3: 'جيدة',
    strength_4: 'قوية',
    help_title: 'اختصارات لوحة المفاتيح',
    help_search: 'التركيز على خانة البحث',
    help_palette: 'فتح لوحة الأوامر',
    help_help: 'عرض هذه القائمة',
    help_close: 'إغلاق أي نافذة مفتوحة',
    cart_saved_items: 'منتجات',
    wish_empty: 'لا يوجد شيء محفوظ بعد. اضغط على القلب في أي منتج لحفظه هنا.'
  }
};

export const translations: Record<Lang, Dict> = {
  en: { ...base.en, ...extra.en },
  ar: { ...base.ar, ...extra.ar }
};

/** Look up a string; falls back to English, then to the key itself. */
export const tr = (key: string, lang: Lang): string => translations[lang][key] ?? translations.en[key] ?? key;

// ---------- Engagement layer strings ----------
export interface EngageText {
  pts: string; lvl: string; rewards: string; streak: string; next: string; ach: string;
  search: string; saved: string; free: string; more: (n: string) => string;
  daily: (n: number, p: number) => string; up: (n: number) => string; unlocked: string; how: string;
  sort: string; s1: string; s2: string; s3: string; s4: string;
  gift: string; giftT: string; giftTap: string; giftWon: (n: number) => string; giftDone: string;
  empty: string; top: string; guestHud: string;
}

export const engageText: Record<Lang, EngageText> = {
  en: {
    pts: 'pts', lvl: 'Lvl', rewards: 'Your Rewards', streak: 'Day streak', next: 'to next level', ach: 'Achievements',
    search: 'Search products…', saved: '♥ Saved', free: '🎉 Free delivery unlocked!', more: (n) => `Add $${n} more for free delivery`,
    daily: (n, p) => `Day ${n} streak! +${p} pts`, up: (n) => `Level up! You reached Level ${n} 🎉`, unlocked: 'Unlocked:',
    how: 'Earn points: +10 per item, +5 per ♥, +50 per order, plus a daily visit bonus and a daily gift.',
    sort: 'Sort: Featured', s1: 'Price: Low → High', s2: 'Price: High → Low', s3: 'Name: A → Z', s4: 'Top rated',
    gift: '🎁 Daily Gift', giftT: 'Your Daily Gift', giftTap: 'Tap the box to open it!', giftWon: (n) => `You won +${n} pts! 🎉`,
    giftDone: 'Already opened today. Come back tomorrow!', empty: 'No products match your filters 🔍', top: 'Back to top',
    guestHud: '🔒 Log in to earn points'
  },
  ar: {
    pts: 'نقطة', lvl: 'مستوى', rewards: 'مكافآتك', streak: 'أيام متتالية', next: 'للمستوى التالي', ach: 'الإنجازات',
    search: 'ابحث عن منتج…', saved: '♥ المحفوظة', free: '🎉 تم فتح التوصيل المجاني!', more: (n) => `أضف $${n} للحصول على توصيل مجاني`,
    daily: (n, p) => `سلسلة ${n} أيام! +${p} نقطة`, up: (n) => `ارتقيت إلى المستوى ${n} 🎉`, unlocked: 'إنجاز جديد:',
    how: 'اكسب نقاطاً: +10 لكل منتج، +5 لكل ♥، +50 لكل طلب، ومكافأة زيارة يومية وهدية يومية.',
    sort: 'الترتيب: المميز', s1: 'السعر: من الأقل للأعلى', s2: 'السعر: من الأعلى للأقل', s3: 'الاسم: أ ← ي', s4: 'الأعلى تقييماً',
    gift: '🎁 هدية اليوم', giftT: 'هديتك اليومية', giftTap: 'اضغط على الصندوق لفتحه!', giftWon: (n) => `ربحت +${n} نقطة! 🎉`,
    giftDone: 'فتحت هديتك اليوم. عد غداً!', empty: 'لا توجد منتجات تطابق التصفية 🔍', top: 'للأعلى',
    guestHud: '🔒 سجّل الدخول لتكسب النقاط'
  }
};

// ---------- Feature layer strings (wheel, palette, voice...) ----------
export interface WowText {
  wheel: string; wheelT: string; spin: string; spun: string; again: string;
  codeWon: (c: string) => string; codeApplied: string; codeReady: string; ptsWon: (n: number) => string;
  surprise: string; mic: string; micOn: string; similar: string; recent: string; palPh: string; none: string;
  a_cart: string; a_rewards: string; a_gift: string; a_wheel: string; a_surprise: string; a_theme: string;
  a_lang: string; a_top: string; a_help: string; cat: string; prod: string;
}

export const wowText: Record<Lang, WowText> = {
  en: {
    wheel: '🎡 Royal Wheel', wheelT: 'Royal Wheel', spin: 'Spin', spun: 'Come back tomorrow for another spin', again: 'Spinning…',
    codeWon: (c) => `You won code ${c}!`, codeApplied: 'Applied to your cart.', codeReady: 'Added to your promo field. Apply it in your cart.',
    ptsWon: (n) => `+${n} points added!`, surprise: '🎲 Surprise me', mic: 'Search by voice', micOn: 'Listening…',
    similar: 'You may also like', recent: 'Recently viewed', palPh: 'Type a command or search a product…', none: 'Nothing found',
    a_cart: 'Open cart', a_rewards: 'Open rewards', a_gift: 'Open daily gift', a_wheel: 'Spin the Royal Wheel',
    a_surprise: 'Surprise me with a product', a_theme: 'Switch light / dark mode', a_lang: 'Switch to العربية',
    a_top: 'Scroll to top', a_help: 'Show keyboard shortcuts', cat: 'Category', prod: 'Product'
  },
  ar: {
    wheel: '🎡 عجلة الملوك', wheelT: 'عجلة الملوك', spin: 'أدر العجلة', spun: 'عد غداً لمحاولة جديدة', again: 'جارٍ الدوران…',
    codeWon: (c) => `ربحت الرمز ${c}!`, codeApplied: 'تم تطبيقه على سلتك.', codeReady: 'أُضيف إلى خانة الرمز. طبّقه من السلة.',
    ptsWon: (n) => `تمت إضافة ${n} نقطة!`, surprise: '🎲 فاجئني', mic: 'البحث الصوتي', micOn: 'أستمع…',
    similar: 'قد يعجبك أيضاً', recent: 'شوهد مؤخراً', palPh: 'اكتب أمراً أو ابحث عن منتج…', none: 'لا توجد نتائج',
    a_cart: 'افتح السلة', a_rewards: 'افتح المكافآت', a_gift: 'افتح هدية اليوم', a_wheel: 'أدر عجلة الملوك',
    a_surprise: 'فاجئني بمنتج', a_theme: 'تبديل الوضع الفاتح / الداكن', a_lang: 'Switch to English',
    a_top: 'للأعلى', a_help: 'اعرض اختصارات لوحة المفاتيح', cat: 'قسم', prod: 'منتج'
  }
};
