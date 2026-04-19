var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-sMBBIW/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/calendar.js
var CALCOM_API_BASE = "https://api.cal.com/v1";
var getAvailability = /* @__PURE__ */ __name(async (apiKey, eventTypeId, startDate, endDate) => {
  const url = new URL(`${CALCOM_API_BASE}/availability`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("eventTypeId", eventTypeId);
  url.searchParams.set("startTime", startDate);
  url.searchParams.set("endTime", endDate);
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Cal.com API error (${response.status}):`, errorText);
      return { error: `Failed to fetch availability: ${response.status}` };
    }
    const data = await response.json();
    return { slots: data.slots || data };
  } catch (error) {
    console.error("Cal.com availability error:", error);
    return { error: "Failed to connect to calendar service" };
  }
}, "getAvailability");
var getEventTypes = /* @__PURE__ */ __name(async (apiKey) => {
  const url = `${CALCOM_API_BASE}/event-types?apiKey=${apiKey}`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      return { error: `Failed to fetch event types: ${response.status}` };
    }
    const data = await response.json();
    return { eventTypes: data.event_types || data };
  } catch (error) {
    console.error("Cal.com event types error:", error);
    return { error: "Failed to fetch event types" };
  }
}, "getEventTypes");
var createBooking = /* @__PURE__ */ __name(async (apiKey, bookingData) => {
  const url = `${CALCOM_API_BASE}/bookings?apiKey=${apiKey}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(bookingData)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Cal.com booking error (${response.status}):`, errorText);
      return { error: `Failed to create booking: ${response.status}` };
    }
    const data = await response.json();
    return { booking: data };
  } catch (error) {
    console.error("Cal.com booking error:", error);
    return { error: "Failed to create booking" };
  }
}, "createBooking");
var validateBookingRequest = /* @__PURE__ */ __name((body) => {
  const required = ["eventTypeId", "start", "name", "email"];
  for (const field of required) {
    if (!body[field]) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return { valid: false, error: "Invalid email address" };
  }
  return { valid: true };
}, "validateBookingRequest");
var handleCalendar = /* @__PURE__ */ __name(async (request, env, ctx, origin) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
  const url = new URL(request.url);
  const apiKey = env.CALCOM_API_KEY;
  if (!apiKey) {
    console.error("CALCOM_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: "Calendar service is not configured" }),
      { status: 500, headers: corsHeaders }
    );
  }
  try {
    if (request.method === "GET" && url.pathname.includes("/availability")) {
      const eventTypeId = url.searchParams.get("eventTypeId");
      const startDate = url.searchParams.get("startDate") || (/* @__PURE__ */ new Date()).toISOString();
      const endDate = url.searchParams.get("endDate") || new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString();
      if (!eventTypeId) {
        return new Response(
          JSON.stringify({ error: "eventTypeId is required" }),
          { status: 400, headers: corsHeaders }
        );
      }
      const result = await getAvailability(apiKey, eventTypeId, startDate, endDate);
      if (result.error) {
        return new Response(
          JSON.stringify({ error: result.error }),
          { status: 500, headers: corsHeaders }
        );
      }
      return new Response(
        JSON.stringify({ slots: result.slots }),
        { status: 200, headers: corsHeaders }
      );
    }
    if (request.method === "GET" && url.pathname.includes("/event-types")) {
      const result = await getEventTypes(apiKey);
      if (result.error) {
        return new Response(
          JSON.stringify({ error: result.error }),
          { status: 500, headers: corsHeaders }
        );
      }
      return new Response(
        JSON.stringify({ eventTypes: result.eventTypes }),
        { status: 200, headers: corsHeaders }
      );
    }
    if (request.method === "POST" && url.pathname.includes("/book")) {
      const body = await request.json();
      const validation = validateBookingRequest(body);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: 400, headers: corsHeaders }
        );
      }
      const bookingData = {
        eventTypeId: parseInt(body.eventTypeId),
        start: body.start,
        responses: {
          name: body.name,
          email: body.email,
          notes: body.notes || ""
        },
        timeZone: body.timeZone || "America/New_York",
        language: body.language || "en",
        metadata: {}
      };
      const result = await createBooking(apiKey, bookingData);
      if (result.error) {
        return new Response(
          JSON.stringify({ error: result.error }),
          { status: 500, headers: corsHeaders }
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          message: "Booking confirmed!",
          booking: result.booking
        }),
        { status: 200, headers: corsHeaders }
      );
    }
    return new Response(
      JSON.stringify({ error: "Invalid calendar endpoint" }),
      { status: 404, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Calendar Handler Error:", error);
    return new Response(
      JSON.stringify({ error: "Invalid request format" }),
      { status: 400, headers: corsHeaders }
    );
  }
}, "handleCalendar");

// src/chat.js
var sanitizeInput = /* @__PURE__ */ __name((text) => {
  if (typeof text !== "string")
    return "";
  let sanitized = text.replace(/<[^>]*>/g, "").replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/on\w+\s*=\s*(['"]?).*?\1/gi, "").replace(/(?:javascript|data|vbscript):/gi, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/gi, "").replace(/\s+/g, " ").trim();
  return sanitized.slice(0, 5e3);
}, "sanitizeInput");
var validateChatRequest = /* @__PURE__ */ __name((body) => {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }
  if (!body.message) {
    return { valid: false, error: "Message is required" };
  }
  if (typeof body.message !== "string") {
    return { valid: false, error: "Message must be a string" };
  }
  const message = sanitizeInput(body.message);
  if (message.length < 1) {
    return { valid: false, error: "Message cannot be empty" };
  }
  if (message.length > 5e3) {
    return { valid: false, error: "Message exceeds 5000 character limit" };
  }
  const suspiciousPatterns = [
    /\{[\s\S]*\}[\s\S]*\{/,
    // Multiple JSON-like objects (potential prompt injection)
    /(system|assistant|user):\s*\n/i,
    // Potential role injection
    /ignore (previous|all|above) instructions/i
    // Common prompt injection
  ];
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(message)) {
      console.warn("Suspicious pattern detected in message");
    }
  }
  return { valid: true, message };
}, "validateChatRequest");
var SYSTEM_PROMPT = `You are the TechGuru AI Assistant. Be concise, professional, and helpful.

CRITICAL RESPONSE LIMITS:
- Keep ALL responses under 100 words maximum
- Answers should be 2-4 sentences or 3-5 bullet points
- No rambling or repetition
- Direct and actionable always

COMPANY INFO:
TechGuru, founded by Lucas Thompson, delivers enterprise-grade DevOps, AI & cloud automation for startups and solo founders. We create scalable, efficient solutions that grow with your business\u2014without the enterprise price tag.

SERVICES & PRICING:

1. AI Assistants & Automation Systems
- Lite Build: $1,500\u2013$2,500
- Pro Automations: $3,500\u2013$7,000
- Enterprise Multi-Agent: $8,000\u2013$15,000

2. Operations & Workflow Engineering
- Audit Only: $1,000\u2013$1,800
- Workflow Redesign: $2,500\u2013$5,500
- Full Overhaul: $6,000\u2013$10,500

3. Knowledge, SOP & Playbook Systems
- SOP Starter: $1,200\u2013$1,800
- Full Playbook System: $2,800\u2013$5,000
- Enterprise Knowledge Base: $5,500\u2013$9,000

4. Custom Micro-Tools & Internal Utilities
- Simple Micro-App: $1,500\u2013$2,500
- Advanced Tool: $3,500\u2013$6,000
- Full Internal Suite: $7,000\u2013$12,000

5. Strategic Technology & Product Consulting
- Hourly Consulting: $125\u2013$250/hr
- Tech Strategy Blueprint: $1,500\u2013$3,000
- Full System Roadmap: $3,000\u2013$6,000

Plus: Custom Projects tailored to your needs.

YOUR ROLE:
- Discover what visitors need and their business context
- Recommend services that match their situation
- Share relevant pricing ranges
- Guide them to contact form for proposals
- Be transparent: you are an AI assistant, not human staff

DO:
- Ask 1-2 focused discovery questions per reply
- Provide brief, high-level guidance
- Reference service tiers by name when relevant
- Mention pricing ranges to set expectations
- Suggest contacting for custom solutions

DON'T:
- Promise specific outcomes, timelines, or guarantees
- Give legal/financial/tax advice
- Ask for passwords, API keys, or sensitive data
- Claim to be TechGuru staff
- Give away full implementations

TONE: Professional, confident, solution-oriented. Plain text only\u2014no markdown, emojis, asterisks, or special formatting.`;
var callClaudeAPI = /* @__PURE__ */ __name(async (message, apiKey) => {
  const url = "https://api.anthropic.com/v1/messages";
  const payload = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: message
      }
    ]
  };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3e4);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API HTTP Status:", response.status);
      console.error("Claude API Raw Response:", errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        return { error: `API error (${response.status}): ${errorText}` };
      }
      console.error("Claude API Error Response:", JSON.stringify(errorData));
      if (response.status === 401) {
        return { error: "API authentication failed. Please check your API key." };
      }
      const errorMessage = errorData.error?.message || errorData.message || JSON.stringify(errorData.error) || JSON.stringify(errorData) || "Failed to get response from AI service";
      return { error: String(errorMessage) };
    }
    const data = await response.json();
    const reply = data.content[0]?.text || "No response generated";
    return { reply };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      return { error: "Request timed out. Please try again." };
    }
    console.error("Chat API Error:", error);
    return { error: "An error occurred while processing your message. Please try again." };
  }
}, "callClaudeAPI");
var handleChat = /* @__PURE__ */ __name(async (request, env, ctx, origin) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
  try {
    const body = await request.json();
    const validation = validateChatRequest(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: corsHeaders }
      );
    }
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Service is not properly configured" }),
        { status: 500, headers: corsHeaders }
      );
    }
    const result = await callClaudeAPI(validation.message, apiKey);
    if (result.error) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 503, headers: corsHeaders }
      );
    }
    return new Response(
      JSON.stringify({ reply: result.reply }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Chat Handler Error:", error);
    return new Response(
      JSON.stringify({ error: "Invalid request format" }),
      { status: 400, headers: corsHeaders }
    );
  }
}, "handleChat");

// src/notifications.js
var sendTelegramMessage = /* @__PURE__ */ __name(async (env, message) => {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("Telegram notifications skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing.");
    return { success: false, error: "Configuration missing" };
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML"
      })
    });
    if (!response.ok) {
      const error = await response.text();
      console.error("Telegram API error:", error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
    return { success: false, error: err.message };
  }
}, "sendTelegramMessage");

// src/contact.js
var isValidEmail = /* @__PURE__ */ __name((email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email) && email.length <= 254;
}, "isValidEmail");
var sanitizeText = /* @__PURE__ */ __name((text, maxLength = 1e3) => {
  if (typeof text !== "string")
    return "";
  return text.replace(/<[^>]*>/g, "").replace(/[^\w\s\-.,!?()']/g, "").trim().slice(0, maxLength);
}, "sanitizeText");
var validateContactRequest = /* @__PURE__ */ __name((body) => {
  const errors = [];
  if (!body?.name || typeof body.name !== "string") {
    errors.push("Name is required");
  } else if (body.name.length < 2 || body.name.length > 100) {
    errors.push("Name must be between 2-100 characters");
  }
  if (!body?.email || !isValidEmail(body.email)) {
    errors.push("Valid email address is required");
  }
  if (!body?.message || typeof body.message !== "string") {
    errors.push("Message is required");
  } else if (body.message.length < 10 || body.message.length > 5e3) {
    errors.push("Message must be between 10-5000 characters");
  }
  if (body?.subject && typeof body.subject === "string") {
    if (body.subject.length > 200) {
      errors.push("Subject must be under 200 characters");
    }
  }
  if (body?.company && typeof body.company !== "string") {
    errors.push("Company name must be a string");
  }
  if (body?.phone && typeof body.phone !== "string") {
    errors.push("Phone number must be a string");
  }
  if (body?.service && typeof body.service !== "string") {
    errors.push("Service selection must be a string");
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    data: {
      name: sanitizeText(body.name, 100),
      email: body.email.toLowerCase().trim(),
      message: sanitizeText(body.message, 5e3),
      subject: body.subject ? sanitizeText(body.subject, 200) : "New TechGuru Contact Form Submission",
      company: body.company ? sanitizeText(body.company, 100) : "Not provided",
      phone: body.phone ? sanitizeText(body.phone, 20) : "Not provided",
      service: body.service ? sanitizeText(body.service, 50) : "General Inquiry"
    }
  };
}, "validateContactRequest");
var checkRateLimit = /* @__PURE__ */ __name(async (kv, clientIp) => {
  const key = `ratelimit:contact:${clientIp}`;
  const current = await kv.get(key, "json") || { count: 0, timestamp: Date.now() };
  const oneHourAgo = Date.now() - 36e5;
  if (current.timestamp < oneHourAgo) {
    await kv.put(key, JSON.stringify({ count: 1, timestamp: Date.now() }), { expirationTtl: 3600 });
    return { allowed: true, remaining: 4 };
  }
  if (current.count >= 5) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((current.timestamp + 36e5 - Date.now()) / 1e3) };
  }
  current.count++;
  await kv.put(key, JSON.stringify(current), { expirationTtl: 3600 });
  return { allowed: true, remaining: 5 - current.count };
}, "checkRateLimit");
var sendViaWeb3Forms = /* @__PURE__ */ __name(async (data, web3FormsKey) => {
  const url = "https://api.web3forms.com/submit";
  const payload = {
    access_key: web3FormsKey,
    subject: data.subject || "New Contact Form Submission",
    from_name: "TechGuru Automated System",
    name: data.name,
    email: data.email,
    message: data.message,
    // Using string interpolation for Web3Forms so it formats nicely in their default template
    "Company": data.company,
    "Phone": data.phone,
    "Service Interest": data.service
  };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Web3Forms email failed (${response.status}):`, errorText);
      throw new Error(`Web3Forms failed: ${response.status} - ${errorText}`);
    }
    return { success: true };
  } catch (error) {
    console.error("Web3Forms Email Error:", error);
    return { success: false, error: error.message };
  }
}, "sendViaWeb3Forms");
var getClientIp = /* @__PURE__ */ __name((request) => {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0] || "unknown";
}, "getClientIp");
var handleContact = /* @__PURE__ */ __name(async (request, env, ctx, origin) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
  try {
    const body = await request.json();
    const validation = validateContactRequest(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: validation.errors }),
        { status: 400, headers: corsHeaders }
      );
    }
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit(env.RATE_LIMIT, clientIp);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too many submissions. Please try again later.",
          retryAfter: rateLimit.retryAfter
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Retry-After": rateLimit.retryAfter
          }
        }
      );
    }
    const web3FormsKey = env.WEB3FORMS_ACCESS_KEY;
    if (!web3FormsKey) {
      console.error("WEB3FORMS_ACCESS_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Form service is not properly configured" }),
        { status: 500, headers: corsHeaders }
      );
    }
    const result = await sendViaWeb3Forms(
      validation.data,
      web3FormsKey
    );
    if (!result.success) {
      return new Response(
        JSON.stringify({ error: "Failed to process submission. Please try again." }),
        { status: 500, headers: corsHeaders }
      );
    }
    ctx.waitUntil((async () => {
      const tgMessage = `\u{1F680} <b>New TechGuru Lead!</b>

\u{1F464} <b>Name:</b> ${validation.data.name}
\u{1F4E7} <b>Email:</b> ${validation.data.email}
\u{1F4BC} <b>Service:</b> ${validation.data.service}
\u{1F4DE} <b>Phone:</b> ${validation.data.phone}
\u{1F3E2} <b>Company:</b> ${validation.data.company}

\u{1F4AC} <b>Message:</b>
<i>${validation.data.message}</i>`;
      await sendTelegramMessage(env, tgMessage);
    })());
    return new Response(
      JSON.stringify({
        success: true,
        message: "Thank you for your inquiry! We will contact you soon.",
        remaining: rateLimit.remaining
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Contact Handler Error:", error);
    return new Response(
      JSON.stringify({ error: "Invalid request format" }),
      { status: 400, headers: corsHeaders }
    );
  }
}, "handleContact");

// src/subscribe.js
var isValidEmail2 = /* @__PURE__ */ __name((email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email) && email.length <= 254;
}, "isValidEmail");
var validateSubscribeRequest = /* @__PURE__ */ __name((body) => {
  if (!body?.email || !isValidEmail2(body.email)) {
    return { valid: false, error: "Valid email address is required" };
  }
  return {
    valid: true,
    data: {
      email: body.email.toLowerCase().trim(),
      source: body.source || "lead-magnet"
    }
  };
}, "validateSubscribeRequest");
var checkRateLimit2 = /* @__PURE__ */ __name(async (kv, clientIp) => {
  if (!kv) {
    console.warn("RATE_LIMIT KV namespace not configured");
    return { allowed: true, remaining: 999 };
  }
  const key = `ratelimit:subscribe:${clientIp}`;
  const current = await kv.get(key, "json") || { count: 0, timestamp: Date.now() };
  const oneHourAgo = Date.now() - 36e5;
  if (current.timestamp < oneHourAgo) {
    await kv.put(key, JSON.stringify({ count: 1, timestamp: Date.now() }), { expirationTtl: 3600 });
    return { allowed: true, remaining: 2 };
  }
  if (current.count >= 3) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((current.timestamp + 36e5 - Date.now()) / 1e3) };
  }
  current.count++;
  await kv.put(key, JSON.stringify(current), { expirationTtl: 3600 });
  return { allowed: true, remaining: 3 - current.count };
}, "checkRateLimit");
var sendViaWeb3Forms2 = /* @__PURE__ */ __name(async (email, source, web3FormsKey) => {
  const url = "https://api.web3forms.com/submit";
  const payload = {
    access_key: web3FormsKey,
    subject: `New Newsletter Subscription via ${source}`,
    from_name: "TechGuru Subscription Module",
    email,
    "Source": source
  };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Web3Forms subscription failed (${response.status}):`, errorText);
      throw new Error(`Web3Forms failed: ${response.status}`);
    }
    return { success: true };
  } catch (error) {
    console.error("Web3Forms Subscribe Error:", error);
    return { success: false, error: error.message };
  }
}, "sendViaWeb3Forms");
var getClientIp2 = /* @__PURE__ */ __name((request) => {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0] || "unknown";
}, "getClientIp");
var handleSubscribe = /* @__PURE__ */ __name(async (request, env, ctx, origin) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
  try {
    const body = await request.json();
    const validation = validateSubscribeRequest(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: corsHeaders }
      );
    }
    const clientIp = getClientIp2(request);
    const rateLimit = await checkRateLimit2(env.RATE_LIMIT, clientIp);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too many requests. Please try again later.",
          retryAfter: rateLimit.retryAfter
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Retry-After": String(rateLimit.retryAfter)
          }
        }
      );
    }
    const web3FormsKey = env.WEB3FORMS_ACCESS_KEY;
    if (!web3FormsKey) {
      console.error("WEB3FORMS_ACCESS_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Form service is not properly configured" }),
        { status: 500, headers: corsHeaders }
      );
    }
    const emailResult = await sendViaWeb3Forms2(
      validation.data.email,
      validation.data.source,
      web3FormsKey
    );
    if (!emailResult.success) {
      return new Response(
        JSON.stringify({ error: "Failed to complete subscription. Please try again." }),
        { status: 500, headers: corsHeaders }
      );
    }
    ctx.waitUntil((async () => {
      const tgMessage = `\u{1F4EC} <b>New Newsletter Signup!</b>

\u{1F4EE} <b>Email:</b> ${validation.data.email}
\u{1F4F1} <b>Source:</b> ${validation.data.source}`;
      await sendTelegramMessage(env, tgMessage);
    })());
    return new Response(
      JSON.stringify({
        success: true,
        message: "Success! Check your inbox for the starter kit."
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Subscribe Handler Error:", error);
    return new Response(
      JSON.stringify({ error: "Invalid request format" }),
      { status: 400, headers: corsHeaders }
    );
  }
}, "handleSubscribe");

// src/index.js
var getCorsHeaders = /* @__PURE__ */ __name((origin) => {
  const allowedOrigins = [
    "https://techguruofficial.us",
    "https://www.techguruofficial.us",
    "http://localhost:8000",
    // for local dev
    "http://127.0.0.1:8000",
    // for local dev
    "http://localhost:3000",
    // for local dev
    "http://localhost:5500",
    // VS Code Live Server
    "http://127.0.0.1:5500",
    // VS Code Live Server
    "http://localhost:5501",
    // VS Code Live Server alt
    "http://127.0.0.1:5501",
    // VS Code Live Server alt
    "http://localhost:5173",
    // Vite
    "http://localhost:4173"
    // Vite preview
  ];
  const isAllowed = allowedOrigins.includes(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://techguruofficial.us",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}, "getCorsHeaders");
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "https://techguruofficial.us";
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin)
      });
    }
    if (url.pathname === "/api/health" && request.method === "GET") {
      return new Response(
        JSON.stringify({ status: "ok", message: "TechGuru API is running" }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...getCorsHeaders(origin)
          }
        }
      );
    }
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env, ctx, origin);
    }
    if (url.pathname === "/api/contact" && request.method === "POST") {
      return handleContact(request, env, ctx, origin);
    }
    if (url.pathname === "/api/subscribe" && request.method === "POST") {
      return handleSubscribe(request, env, ctx, origin);
    }
    if (url.pathname.startsWith("/api/calendar")) {
      return handleCalendar(request, env, ctx, origin);
    }
    return new Response(
      JSON.stringify({ error: "Endpoint not found" }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(origin)
        }
      }
    );
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-sMBBIW/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-sMBBIW/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
