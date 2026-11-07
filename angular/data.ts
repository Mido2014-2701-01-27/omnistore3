import type { Lang, Product } from './types.js';

// SECURITY NOTE: promo codes are checked in the browser, so anyone can read
// them or change the discount in DevTools. A real store must re-validate the
// code and recompute totals on the server at checkout.
export const PROMO_CODES: Readonly<Record<string, number>> = {
  "SAVE10": 10,
  "DISCOUNT20": 20,
  "WELCOME15": 15,
  "GAMER25": 25,
  "FLASH30": 30
};

export const FREE_DELIVERY_AT = 100;
export const DELIVERY_FEE = 10;

export const customJewelry: Record<Lang, Product[]> = {
  en: [
    {
      id: 9001,
      title: "Men's Solid Gold Signet Ring",
      category: "custom-jewelry",
      price: 199.99,
      description: "14K gold plated classic signet ring for men. Premium polished finish.",
      thumbnail: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=500&q=80",
      rating: 4.8
    },
    {
      id: 9002,
      title: "Silver Titanium Band Ring",
      category: "custom-jewelry",
      price: 85.00,
      description: "Brushed titanium steel ring band. Durable, scratch-resistant, and hypoallergenic.",
      thumbnail: "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=500&q=80",
      rating: 4.7
    }
  ],
  ar: [
    {
      id: 9001,
      title: "خاتم ختامي رجالي من الذهب الخالص",
      category: "custom-jewelry",
      price: 199.99,
      description: "خاتم رجالي كلاسيكي مطلي بالذهب عيار 14. لمسة نهائية مصقولة فاخرة.",
      thumbnail: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=500&q=80",
      rating: 4.8
    },
    {
      id: 9002,
      title: "خاتم تيتانيوم فضي",
      category: "custom-jewelry",
      price: 85.00,
      description: "حلقة من الفولاذ والتيتانيوم المصقول. متينة ومقاومة للخدش وآمنة للبشرة.",
      thumbnail: "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=500&q=80",
      rating: 4.7
    }
  ]
};

export const customPCs: Record<Lang, Product[]> = {
  en: [
    {
      id: 8001,
      title: "Apex RTX 4080 Gaming Desktop Rig",
      category: "custom-pc",
      price: 2199.99,
      description: "Intel i9-13900K, NVIDIA RTX 4080 16GB, 32GB DDR5 RAM, 2TB NVMe SSD, Custom Liquid Cooling & RGB Glass Chassis.",
      thumbnail: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=500&q=80",
      rating: 4.9
    }
  ],
  ar: [
    {
      id: 8001,
      title: "كمبيوتر ألعاب أيبكس RTX 4080",
      category: "custom-pc",
      price: 2199.99,
      description: "معالج Intel i9-13900K، بطاقة شاشة RTX 4080 16GB، ذاكرة 32GB DDR5، قرص 2TB NVMe SSD، تبريد مائي مخصص وهيكل زجاجي RGB.",
      thumbnail: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=500&q=80",
      rating: 4.9
    }
  ]
};

export const offlineProductsFallback: Record<Lang, Product[]> = {
  en: [
    {
      id: 7001,
      title: "Artisanal Dark Roasted Coffee Beans",
      category: "groceries",
      price: 24.99,
      description: "100% Arabica single-origin whole coffee beans with rich chocolate aroma.",
      thumbnail: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=500&q=80",
      rating: 4.8
    },
    {
      id: 7002,
      title: "Organic Matcha Green Tea Powder",
      category: "groceries",
      price: 18.50,
      description: "Ceremonial grade pure Japanese matcha tea powder for lattes and beverages.",
      thumbnail: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=500&q=80",
      rating: 4.6
    },
    {
      id: 7003,
      title: "Tailored Slim Fit Cotton Shirt",
      category: "mens-shirts",
      price: 49.99,
      description: "Breathable 100% Egyptian cotton button-down shirt suitable for modern wear.",
      thumbnail: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=500&q=80",
      rating: 4.5
    },
    {
      id: 7004,
      title: "Classic Leather Oxford Shoes",
      category: "mens-shoes",
      price: 129.99,
      description: "Handcrafted genuine leather formal dress shoes for modern dress styling.",
      thumbnail: "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=500&q=80",
      rating: 4.9
    },
    {
      id: 7005,
      title: "Silk Evening Cocktail Dress",
      category: "womens-dresses",
      price: 159.00,
      description: "Elegant black silk dress designed with refined stitching and backless line.",
      thumbnail: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=500&q=80",
      rating: 4.7
    },
    {
      id: 7006,
      title: "Luxury Leather Shoulder Tote",
      category: "womens-bags",
      price: 189.50,
      description: "Spacious full-grain leather tote bag with secure brass zipping.",
      thumbnail: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=500&q=80",
      rating: 4.8
    },
    {
      id: 7007,
      title: "Pro Mechanical Gaming Keyboard",
      category: "mobile-accessories",
      price: 89.99,
      description: "RGB hot-swappable mechanical switches with ultra-fast tactile response.",
      thumbnail: "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=500&q=80",
      rating: 4.7
    },
    {
      id: 7008,
      title: "Nordic Minimalist Lounge Chair",
      category: "furniture",
      price: 249.00,
      description: "Ergonomic oak wood framed accent chair with soft linen cushioning.",
      thumbnail: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=500&q=80",
      rating: 4.9
    }
  ],
  ar: [
    {
      id: 7001,
      title: "حبوب قهوة محمصة داكنة فاخرة",
      category: "groceries",
      price: 24.99,
      description: "حبوب قهوة أرابيكا كاملة 100% بنكهة الشوكولاتة الغنية.",
      thumbnail: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=500&q=80",
      rating: 4.8
    },
    {
      id: 7002,
      title: "مسحوق الشاي الأخضر الماتشا العضوي",
      category: "groceries",
      price: 18.50,
      description: "مسحوق شاي ماتشا ياباني نقي وفاخر للمشروبات واللاتيه.",
      thumbnail: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=500&q=80",
      rating: 4.6
    },
    {
      id: 7003,
      title: "قميص قطني مريح وأنيق",
      category: "mens-shirts",
      price: 49.99,
      description: "قميص مصنوع من القطن المصري 100% مسامي ومناسب للإطلالات الحديثة.",
      thumbnail: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=500&q=80",
      rating: 4.5
    },
    {
      id: 7004,
      title: "حذاء أكسفورد جلدي كلاسيكي",
      category: "mens-shoes",
      price: 129.99,
      description: "حذاء رسمي مصنوع يدويًا من الجلد الطبيعي للإطلالات الرسمية العصريّة.",
      thumbnail: "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=500&q=80",
      rating: 4.9
    },
    {
      id: 7005,
      title: "فستان سهرة حريري",
      category: "womens-dresses",
      price: 159.00,
      description: "فستان أسود حريري أنيق بتصميم راقٍ وغرز متقنة.",
      thumbnail: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=500&q=80",
      rating: 4.7
    },
    {
      id: 7006,
      title: "حقيبة كتف جلدية فاخرة",
      category: "womens-bags",
      price: 189.50,
      description: "حقيبة واسعة مصنوعة من الجلد الطبيعي الكامل مع سحاب نحاسي آمن.",
      thumbnail: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=500&q=80",
      rating: 4.8
    },
    {
      id: 7007,
      title: "لوحة مفاتيح ألعاب ميكانيكية احترافية",
      category: "mobile-accessories",
      price: 89.99,
      description: "مفاتيح ميكانيكية قابلة للتبديل مع إضاءة RGB واستجابة فائقة السرعة.",
      thumbnail: "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=500&q=80",
      rating: 4.7
    },
    {
      id: 7008,
      title: "كرسي مريح بتصميم اسكندنافي بسيّط",
      category: "furniture",
      price: 249.00,
      description: "كرسي بمقعد مريح وإطار من خشب البلوط مع وسائد كتانية ناعمة.",
      thumbnail: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=500&q=80",
      rating: 4.9
    }
  ]
};

export const categoryQueries: Record<string, string[]> = {
  'food-drink': ['groceries'],
  'clothing-men': ['mens-shirts', 'mens-shoes'],
  'clothing-women': ['womens-dresses', 'tops', 'womens-shoes', 'womens-bags'],
  'jewelry-men': ['womens-jewelery', 'mens-watches'],
  'gaming': ['laptops'],
  'peripherals': ['mobile-accessories', 'tablets'],
  'furniture': ['furniture', 'home-decoration']
};

export const categoryBadgeLabels: Record<Lang, Record<string, string>> = {
  en: {
    'groceries': 'Food & Drink',
    'mens-shirts': "Men's Clothing",
    'mens-shoes': "Men's Shoes",
    'womens-dresses': "Women's Dresses",
    'tops': "Women's Tops",
    'womens-shoes': "Women's Shoes",
    'womens-bags': "Women's Bags",
    'mens-watches': "Watches & Accessories",
    'womens-jewelery': "Jewelry & Rings",
    'custom-jewelry': "Fine Jewelry & Rings",
    'custom-pc': "Gaming PCs & Laptops",
    'laptops': "High-Performance Laptops",
    'mobile-accessories': "Peripherals & Accessories",
    'tablets': "Tablets & Hardware",
    'furniture': "Furniture",
    'home-decoration': "Home Decor"
  },
  ar: {
    'groceries': 'الأطعمة والمشروبات',
    'mens-shirts': "ملابس رجالية",
    'mens-shoes': "أحذية رجالية",
    'womens-dresses': "فساتين نسائية",
    'tops': "بلوزات نسائية",
    'womens-shoes': "أحذية نسائية",
    'womens-bags': "حقائب نسائية",
    'mens-watches': "ساعات وإكسسوارات",
    'womens-jewelery': "مجوهرات وخواتم",
    'custom-jewelry': "مجوهرات فاخرة وخواتم",
    'custom-pc': "أجهزة كمبيوتر محمولة ومكتبية للألعاب",
    'laptops': "أجهزة كمبيوتر محمولة عالية الأداء",
    'mobile-accessories': "ملحقات وإكسسوارات",
    'tablets': "أجهزة لوحية وأجهزة",
    'furniture': "الأثاث",
    'home-decoration': "ديكور المنزل"
  }
};
