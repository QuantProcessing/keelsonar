/**
 * Real `NewsOut` items captured from https://eqn.news/api/v1/news on 2026-11-17,
 * trimmed to the fields KeelSonar reads. Used by parser tests and the local
 * side panel preview; the preview re-stamps `published_ts` relative to now.
 */
export const EQN_SAMPLE_ITEMS: ReadonlyArray<Record<string, unknown>> = [
  {
    "id": "15339",
    "no": 15339,
    "path": "/main/15339",
    "published_ts": 1794867762959,
    "channels": [
      "main"
    ],
    "kind": "news",
    "source": {
      "slug": "aggrnews",
      "display": "AggrNews",
      "display_zh": "AggrNews"
    },
    "i18n": {
      "en": "*CFTC APPROVES BACKPACK AS FIRST DCO AND DCM UTILIZING BLOCKCHAIN TECHNOLOGY https://t.co/bMcsI0xb2m",
      "zh": "*CFTC批准Backpack成为首个采用区块链技术的DCO和DCM"
    },
    "source_language": "en",
    "coins": [],
    "url": "https://x.com/AggrNews/status/2122455337076662282",
    "data": {},
    "deliveries": [
      {
        "platform": "telegram",
        "channel": "main",
        "url": "https://t.me/BWEnews/16630"
      }
    ]
  },
  {
    "id": "15381",
    "no": 15381,
    "path": "/monitor/15381",
    "published_ts": 1794882455338,
    "channels": [
      "pricechange"
    ],
    "kind": "price",
    "source": {
      "slug": "price_monitor",
      "display": "Price Monitor",
      "display_zh": "价格监测"
    },
    "i18n": {
      "en": "Price Monitor: BLESSUSDT (BLESS) +5.7% in the past 10 seconds",
      "zh": "价格监测：BLESSUSDT (BLESS) 在过去 10 秒内上涨 5.7%。"
    },
    "source_language": "en",
    "coins": [
      {
        "symbol": "BLESS"
      }
    ],
    "url": null,
    "data": {
      "signal": "price_move",
      "symbol": "BLESSUSDT",
      "base": "BLESS",
      "exchange": "binance",
      "market": "perp",
      "window": 10,
      "pct": 5.677972,
      "price": 0.016546,
      "context": {
        "pct_1h": -13.1033,
        "pct_24h": 80.1611
      },
      "vol_24h_usd": 494808275.177402,
      "funding_rate_pct": 0.037191
    },
    "deliveries": [
      {
        "platform": "telegram",
        "channel": "pricechange",
        "url": "https://t.me/EQN_pricechange_monitor/106559"
      }
    ]
  },
  {
    "id": "14009",
    "no": 14009,
    "path": "/monitor/14009",
    "published_ts": 1794472217787,
    "channels": [
      "binance",
      "earn"
    ],
    "kind": "listing",
    "source": {
      "slug": "binance_en",
      "display": "Binance EN",
      "display_zh": "币安重要公告"
    },
    "i18n": {
      "en": "Binance Earn: Dual Investment Supports HYPE",
      "zh": "Binance Earn：双币投资支持 HYPE"
    },
    "source_language": "en",
    "coins": [
      {
        "symbol": "DUAL"
      },
      {
        "symbol": "HYPE"
      }
    ],
    "url": "https://api.eqn.news/public/archive/bn-2314",
    "data": {},
    "deliveries": [
      {
        "platform": "telegram",
        "channel": "binance",
        "url": "https://t.me/EQN_Binance_monitor/2097"
      },
      {
        "platform": "telegram",
        "channel": "earn",
        "url": "https://t.me/eqn_earn/804"
      }
    ]
  },
  {
    "id": "15254",
    "no": 15254,
    "path": "/monitor/15254",
    "published_ts": 1794825166694,
    "channels": [
      "oi"
    ],
    "kind": "oi",
    "source": {
      "slug": "price_oi_move",
      "display": "价格与OI异动",
      "display_zh": "价格与OI异动"
    },
    "i18n": {
      "en": "🔻 [LITUSDT] Shorts building: Binance OI +9.0%, price -12.9% in the past 1 hour, OI $30.5M, OI/market cap 5.1%, 24h -21.8%",
      "zh": "🔻 [LITUSDT] 空头进场：币安未平仓合约量 +9.0%，过去 1 小时价格下跌 12.9%，未平仓合约量 3050 万美元，OI/市值 5.1%，24 小时 -21.8%"
    },
    "source_language": "en",
    "coins": [
      {
        "symbol": "LIT"
      }
    ],
    "url": null,
    "data": {
      "signal": "price_oi_move",
      "symbol": "LITUSDT",
      "base": "LIT",
      "exchange": "binance",
      "market": "perp",
      "window": 3600,
      "pct": -12.866784,
      "price_pct": -12.866784,
      "oi_pct": 9.027535,
      "direction": "down",
      "price": 2.3756,
      "oi_usd": 30483349.27412,
      "price_24h_pct": -21.760037,
      "vol_24h_usd": 63468691.4061,
      "funding_rate_pct": -0.007255
    },
    "deliveries": [
      {
        "platform": "telegram",
        "channel": "oi",
        "url": "https://t.me/EQN_OI_Price_monitor/20647"
      }
    ]
  },
  {
    "id": "15384",
    "no": 15384,
    "path": "/tradfi/15384",
    "published_ts": 1794883154206,
    "channels": [
      "tradfi"
    ],
    "kind": "macro",
    "source": {
      "slug": "tradfin",
      "display": "Tradfin",
      "display_zh": "Tradfin"
    },
    "i18n": {
      "en": "*NVIDIA EMPLOYEES WEIGH CAMPUS DEMONSTRATION IN SUPPORT OF HUANG: WSJ\n\n*SENIOR NVIDIA DIRECTOR LEADS INTERNAL PUSH TO BRING BACK HUANG\n\n*NVIDIA BOARD WARNED OF 'IRREPLACEABLE' TALENT LOSS IF HUANG NOT REINSTATED\n\n$NVDA",
      "zh": "*英伟达员工考虑在园区举行示威活动以支持黄仁勋：华尔街日报\n\n*英伟达高级总监牵头内部推动，要求让黄仁勋回归\n\n*英伟达董事会被告知，若黄仁勋不复职，将面临“不可替代”的人才流失\n\n$NVDA"
    },
    "source_language": "en",
    "coins": [],
    "url": "https://x.com/tradfi/status/2122519896806543684",
    "data": {},
    "deliveries": [
      {
        "platform": "telegram",
        "channel": "tradfi",
        "url": "https://t.me/BWEtradfi/7817"
      }
    ]
  },
  {
    "id": "14273",
    "no": 14273,
    "path": "/main/14273",
    "published_ts": 1794545203692,
    "channels": [
      "main",
      "korea"
    ],
    "kind": "news",
    "source": {
      "slug": "bithumb_listing",
      "display": "Bithumb Listing",
      "display_zh": "Bithumb上新"
    },
    "i18n": {
      "zh": "[新增市场] 新增 Neo Soul(DNA) 韩元市场",
      "ko": "[마켓 추가] 네오소울(DNA) 원화 마켓 추가"
    },
    "source_language": "ko",
    "coins": [
      {
        "symbol": "DNA"
      }
    ],
    "url": "https://feed.bithumb.com/notice/1655643",
    "data": {},
    "deliveries": [
      {
        "platform": "telegram",
        "channel": "main",
        "url": "https://t.me/BWEnews/16626"
      },
      {
        "platform": "telegram",
        "channel": "korea",
        "url": "https://t.me/eqn_korean_monitor/1883"
      }
    ]
  },
  {
    "id": "15266",
    "no": 15266,
    "path": "/monitor/15266",
    "published_ts": 1794828607789,
    "channels": [
      "korea"
    ],
    "kind": "listing",
    "source": {
      "slug": "upbit_monitor",
      "display": "Upbit",
      "display_zh": "Upbit"
    },
    "i18n": {
      "en": "Notice of caution regarding LIT",
      "zh": "LIT 风险提示公告",
      "ko": "라이터(LIT) 유의 촉구 안내"
    },
    "source_language": "ko",
    "coins": [
      {
        "symbol": "LIT"
      }
    ],
    "url": "https://upbit.com/service_center/notice?id=6783",
    "data": {},
    "deliveries": [
      {
        "platform": "telegram",
        "channel": "korea",
        "url": "https://t.me/eqn_korean_monitor/1903"
      }
    ]
  },
  {
    "id": "15096",
    "no": 15096,
    "path": "/monitor/15096",
    "published_ts": 1794780182124,
    "channels": [
      "major"
    ],
    "kind": "window",
    "source": {
      "slug": "price_major_move",
      "display": "价格巨幅波动",
      "display_zh": "价格巨幅波动"
    },
    "i18n": {
      "en": "🔻 [ASTERUSDT] Binance futures price dropped 20.1% in the past 1 hour",
      "zh": "🔻 [ASTERUSDT] 币安期货价格在过去 1 小时内下跌了 20.1%"
    },
    "source_language": "en",
    "coins": [
      {
        "symbol": "ASTER"
      }
    ],
    "url": null,
    "data": {
      "signal": "price_major_move",
      "kind": "window",
      "symbol": "ASTERUSDT",
      "base": "ASTER",
      "exchange": "binance",
      "market": "perp",
      "pct": -20.10728,
      "oi_usd": 72500216.382,
      "window": 3600,
      "direction": "down",
      "price": 0.5213,
      "vol_24h_usd": 417569059.7829,
      "funding_rate_pct": -0.009663,
      "context": {
        "pct_1h": -20.1073,
        "pct_24h": 3.7207
      }
    },
    "deliveries": [
      {
        "platform": "telegram",
        "channel": "major",
        "url": "https://t.me/eqn_bigmoves/817"
      }
    ]
  },
  {
    "id": "15198",
    "no": 15198,
    "path": "/monitor/15198",
    "published_ts": 1794808830157,
    "channels": [
      "tier2"
    ],
    "kind": "listing",
    "source": {
      "slug": "okx_announcements",
      "display": "OKX Announcements",
      "display_zh": "OKX公告"
    },
    "i18n": {
      "en": "OKX to list perpetual future for JCT crypto",
      "zh": "OKX将上线JCT永续合约"
    },
    "source_language": "en",
    "coins": [
      {
        "symbol": "JCT"
      }
    ],
    "url": "https://www.okx.com/help/okx-to-list-perpetual-future-for-janction-crypto",
    "data": {
      "exchange": "okx"
    },
    "deliveries": [
      {
        "platform": "telegram",
        "channel": "tier2",
        "url": "https://t.me/eqn_tier2/7145"
      }
    ]
  },
  {
    "id": "15294",
    "no": 15294,
    "path": "/monitor/15294",
    "published_ts": 1794841561960,
    "channels": [
      "tfmoves"
    ],
    "kind": "news",
    "source": {
      "slug": "price_major_move_us",
      "display": "US Stock Big Move",
      "display_zh": "美股重大行情"
    },
    "i18n": {
      "en": "🔴 TSM (Taiwan Semiconductor Manufacturing Company Limited) fell 5.8% from previous close: $398.63 → $375.66, volume $1.3B (market QQQ -2.2%)",
      "zh": "🔴 TSM（Taiwan Semiconductor Manufacturing Company Limited）较昨收下跌 5.8%：$398.63 → $375.66，成交 $1.3B（大盘 QQQ -2.2%）"
    },
    "source_language": "en",
    "coins": [],
    "url": null,
    "data": {
      "signal": "us_big_move",
      "symbol": "TSM",
      "base": "TSM",
      "name": "Taiwan Semiconductor Manufacturing Company Limited",
      "pct": -5.76,
      "direction": "down",
      "rule": "day",
      "window": null,
      "price": 375.6649,
      "ref_price": 398.63,
      "usd_volume": 1297800974,
      "index_pct": -2.2,
      "group": "mw"
    },
    "deliveries": [
      {
        "platform": "telegram",
        "channel": "tfmoves",
        "url": "https://t.me/bwe_Reserved7/33"
      }
    ]
  },
  {
    "id": "15296",
    "no": 15296,
    "path": "/monitor/15296",
    "published_ts": 1794842948041,
    "channels": [
      "cz"
    ],
    "kind": "tweet",
    "source": {
      "slug": "heyibinance_reply",
      "display": "Heyibinance [reply]",
      "display_zh": "Heyibinance [reply]"
    },
    "i18n": {
      "en": "@BensonTWN Thank you for the correction.\nWhat was stolen from Binance was coins, and Binance's reserves have always been in coins, so there is no need to sell coins to update the reserves.\nIndustry confidence has indeed been affected by the rapid development of AI, including security threats and quantum attacks, but the threats brought by AI also bring opportunities.",
      "zh": "@BensonTWN 谢谢指正。\n币安被盗的是币，币安储备金也一直是币，所以无需卖币更新储备金。\n行业信心确实受到AI高速发展带来的影响，包括安全威胁和量子攻击，但AI带来威胁也会带来机会。"
    },
    "source_language": "zh",
    "coins": [],
    "url": "https://x.com/heyibinance/status/2122351241556824475",
    "data": {},
    "deliveries": [
      {
        "platform": "telegram",
        "channel": "cz",
        "url": "https://t.me/eqn_cz_heyi/3851"
      }
    ]
  },
  {
    "id": "14876",
    "no": 14876,
    "path": "/monitor/14876",
    "published_ts": 1794672431272,
    "channels": [
      "alpha"
    ],
    "kind": "alpha",
    "source": {
      "slug": "aster_perp_listing",
      "display": "Aster Perp Listing",
      "display_zh": "Aster合约上新"
    },
    "i18n": {
      "en": "Aster Perp Listing: SOPHUSDT",
      "zh": "Aster 永续合约上线：SOPHUSDT"
    },
    "source_language": "en",
    "coins": [
      {
        "symbol": "ASTER"
      },
      {
        "symbol": "SOPH"
      }
    ],
    "url": "https://www.asterdex.com/en/futures/v1/SOPHUSDT",
    "data": {},
    "deliveries": [
      {
        "platform": "telegram",
        "channel": "alpha",
        "url": "https://t.me/eqn_alpha_aster/1104"
      }
    ]
  }
];
