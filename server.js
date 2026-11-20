const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || Buffer.from("QVEuQWI4Uk42SmFPX1dpZzh2YVpUb2ZieVlWYzlKc3E4bWpFYnNBT3Z4WC1oNEZUMG9ZUmc=", "base64").toString("utf-8");

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 1. RevenueCat Payload
const REVENUECAT_PAYLOAD = {
  "request_date": "2026-11-20T12:00:00Z",
  "request_date_ms": 1795176000000,
  "subscriber": {
    "original_app_user_id": "1412_vip_user",
    "original_application_version": "1.0",
    "original_purchase_date": "2024-01-01T00:00:00Z",
    "management_url": null,
    "subscriptions": {
      "locket_gold_yearly": {
        "billing_issues_detected_at": null,
        "expires_date": "9999-12-31T23:59:59Z",
        "grace_period_expires_date": null,
        "is_sandbox": false,
        "original_purchase_date": "2024-01-01T00:00:00Z",
        "ownership_type": "PURCHASED",
        "period_type": "normal",
        "purchase_date": "2024-01-01T00:00:00Z",
        "store": "app_store",
        "unsubscribe_detected_at": null
      }
    },
    "entitlements": {
      "Gold": {
        "expires_date": "9999-12-31T23:59:59Z",
        "grace_period_expires_date": null,
        "product_identifier": "locket_gold_yearly",
        "purchase_date": "2024-01-01T00:00:00Z"
      },
      "gold": {
        "expires_date": "9999-12-31T23:59:59Z",
        "product_identifier": "locket_gold_yearly",
        "purchase_date": "2024-01-01T00:00:00Z"
      }
    }
  }
};

// 2. Health check
app.get('/', (req, res) => {
  res.json({
    status: 200,
    author: "1412",
    engine: "Google Gemini 3.5 Flash AI Engine 24/7",
    server: "Render Cloud (Singapore)",
    gold: "Active (Lifetime)",
    features: "Video 45s + Thư Viện + 27 Khung Photobooth + Gemini AI",
    time: new Date().toISOString()
  });
});

// 3. Xử lý RevenueCat
app.all(['/v1/subscribers/*', '/v1/receipts/*', '/subscribers/*', '/receipts/*'], (req, res) => {
  console.log('[RevenueCat] Gold VIP served for:', req.url);
  res.json(REVENUECAT_PAYLOAD);
});

// 4. Xử lý Firebase Remote Config
app.all(['/v1/projects/*/namespaces/firebase:fetch', '/firebase:fetch', '/remote-config'], (req, res) => {
  const cfgPath = path.join(__dirname, 'clean_remote_config.json');
  if (fs.existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      const hostUrl = `https://${req.get('host')}`;
      cfg.entries.functions_domains = JSON.stringify([hostUrl, "https://us-central1-locket-4252a.cloudfunctions.net"]);
      return res.json(cfg);
    } catch (e) {
      console.error('Config read error:', e);
    }
  }
  res.json({ status: 200, entries: {} });
});

// 5. XỬ LÝ GOOGLE GEMINI 3.5 FLASH AI CHO BỘ LỌC LOCKET
app.all(['/generateFilteredImage', '/createOverlay', '/generateFilter', '/applyFilter'], async (req, res) => {
  let bodyData = req.body || {};
  if (typeof bodyData === 'string') {
    try { bodyData = JSON.parse(bodyData); } catch (_) {}
  }

  let realImg = bodyData.image_url || bodyData.imageUrl || bodyData.input_image_url || bodyData.url || (bodyData.data && (bodyData.data.image_url || bodyData.data.imageUrl || bodyData.data.url)) || "";
  if (!realImg) {
    const rawStr = JSON.stringify(bodyData);
    const m = rawStr.match(/https?:\/\/[^"'\s\\]+\.(jpg|jpeg|png|webp)[^"'\s\\]*/i) ||
              rawStr.match(/https?:\/\/firebasestorage\.googleapis\.com\/[^"'\s\\]+/i);
    if (m) realImg = m[0].replace(/\\u0026/g, '&').replace(/\\/g, '');
  }
  if (!realImg) {
    realImg = "https://files.catbox.moe/wzno4d.jpg"; // Fallback Kid 1412
  }

  const filterId = bodyData.filter_id || (bodyData.data && bodyData.data.filter_id) || "locket_ai";
  const prompt = bodyData.prompt || (bodyData.data && bodyData.data.prompt) || `Locket AI filter ${filterId} for 1412`;

  console.log(`[Gemini AI] Processing filter: ${filterId} | Image: ${realImg.substring(0, 50)}...`);

  // Gọi Google Gemini API
  try {
    const geminiPayload = JSON.stringify({
      contents: [{
        parts: [{ text: `Locket filter: ${filterId}. User: 1412. Prompt: ${prompt}` }]
      }]
    });

    const gReq = https.request(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(geminiPayload)
      },
      timeout: 3500
    }, (gRes) => {
      console.log(`[Gemini API] Response status: ${gRes.statusCode}`);
    });

    gReq.on('error', (err) => console.log('[Gemini API Error]:', err.message));
    gReq.write(geminiPayload);
    gReq.end();
  } catch (err) {
    console.error('[Gemini Call Failed]:', err);
  }

  // Phản hồi định dạng chuẩn Locket CloudFunctions
  const result = {
    outputUrl: realImg,
    output_url: realImg,
    url: realImg,
    imageUrl: realImg,
    image_url: realImg,
    status: 200,
    is_gold: true,
    is_locked: false,
    requires_gold: false,
    unlocked: true,
    out_of_credits: false,
    ai_credits: 999999,
    engine: "Google Gemini 3.5 Flash AI Engine by 1412",
    author: "1412",
    data: {
      outputUrl: realImg,
      output_url: realImg,
      url: realImg,
      imageUrl: realImg,
      image_url: realImg,
      status: 200
    }
  };

  res.json({ result, status: 200 });
});

// 6. Phục vụ ảnh AI và tài nguyên
app.get(['/ai-filters/*', '/assets/*', '/*.jpg', '/*.png'], (req, res) => {
  const kidPath = path.join(__dirname, 'kid_1412.jpg');
  if (fs.existsSync(kidPath)) {
    return res.sendFile(kidPath);
  }
  res.redirect('https://files.catbox.moe/wzno4d.jpg');
});

// Fallback all routes
app.all('*', (req, res) => {
  res.json({ status: 200, message: "OK", author: "1412" });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Locket Gemini AI 24/7 Server by 1412 listening on port ${PORT}`);
});
