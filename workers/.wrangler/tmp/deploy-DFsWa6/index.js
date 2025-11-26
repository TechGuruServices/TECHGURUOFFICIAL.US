var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/chat.js
var sanitizeInput = /* @__PURE__ */ __name((text) => {
  if (typeof text !== "string") return "";
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
    model: "claude-opus-4-1",
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

// src/contact.js
var isValidEmail = /* @__PURE__ */ __name((email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email) && email.length <= 254;
}, "isValidEmail");
var sanitizeText = /* @__PURE__ */ __name((text, maxLength = 1e3) => {
  if (typeof text !== "string") return "";
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
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    data: {
      name: sanitizeText(body.name, 100),
      email: body.email.toLowerCase().trim(),
      message: sanitizeText(body.message, 5e3),
      subject: body.subject ? sanitizeText(body.subject, 200) : "New TechGuru Contact Form Submission"
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
var sendEmailViaSendGrid = /* @__PURE__ */ __name(async (data, sendGridKey, notificationEmail, replyToEmail) => {
  const url = "https://api.sendgrid.com/v3/mail/send";
  const clientEmail = {
    personalizations: [
      {
        to: [{ email: data.email, name: data.name }],
        subject: "We received your inquiry - TechGuru"
      }
    ],
    from: {
      email: replyToEmail,
      name: "TECHGURU"
    },
    content: [
      {
        type: "text/html",
        value: `<h2>Thank you for contacting TechGuru!</h2>
<p>Hi ${data.name},</p>
<p>We received your message and will get back to you within 24 hours.</p>
<p><strong>Your Message:</strong></p>
<p>${data.message.replace(/\n/g, "<br>")}</p>
<p>Best regards,<br>TechGuru Team</p>`
      }
    ]
  };
  const adminEmail = {
    personalizations: [
      {
        to: [{ email: notificationEmail, name: "TechGuru Admin" }],
        subject: `New Contact Form Submission: ${data.subject}`
      }
    ],
    from: {
      email: replyToEmail,
      name: "TECHGURU"
    },
    replyTo: {
      email: data.email,
      name: data.name
    },
    content: [
      {
        type: "text/html",
        value: `<h2>New Contact Form Submission</h2>
<p><strong>Name:</strong> ${data.name}</p>
<p><strong>Email:</strong> ${data.email}</p>
<p><strong>Subject:</strong> ${data.subject}</p>
<p><strong>Message:</strong></p>
<p>${data.message.replace(/\n/g, "<br>")}</p>
<p><em>Sent at: ${(/* @__PURE__ */ new Date()).toISOString()}</em></p>`
      }
    ]
  };
  try {
    const clientResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendGridKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(clientEmail)
    });
    if (!clientResponse.ok) {
      const errorText = await clientResponse.text();
      console.error(`SendGrid client email failed (${clientResponse.status}):`, errorText);
      throw new Error(`SendGrid client email failed: ${clientResponse.status} - ${errorText}`);
    }
    const adminResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendGridKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(adminEmail)
    });
    if (!adminResponse.ok) {
      const errorText = await adminResponse.text();
      console.error(`SendGrid admin email failed (${adminResponse.status}):`, errorText);
      throw new Error(`SendGrid admin email failed: ${adminResponse.status} - ${errorText}`);
    }
    return { success: true };
  } catch (error) {
    console.error("SendGrid Email Error:", error);
    return { success: false, error: error.message };
  }
}, "sendEmailViaSendGrid");
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
    const sendGridKey = env.SENDGRID_API_KEY;
    const adminEmail = env.ADMIN_EMAIL || "info@techguruofficial.us";
    if (!sendGridKey) {
      console.error("SENDGRID_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service is not properly configured" }),
        { status: 500, headers: corsHeaders }
      );
    }
    await sendEmailViaSendGrid(
      validation.data,
      sendGridKey,
      adminEmail,
      adminEmail
    );
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
var sendWelcomeEmail = /* @__PURE__ */ __name(async (email, sendGridKey, replyToEmail) => {
  const url = "https://api.sendgrid.com/v3/mail/send";
  const welcomeEmail = {
    personalizations: [
      {
        to: [{ email }],
        subject: "\u{1F389} Your AI Automation Starter Kit is Ready!"
      }
    ],
    from: {
      email: replyToEmail,
      name: "TECHGURU"
    },
    content: [
      {
        type: "text/html",
        value: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Inter', Arial, sans-serif; background: #080a0f; color: #f2f4fa; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: rgba(255,255,255,0.03); border-radius: 24px; padding: 40px; border: 1px solid rgba(255,255,255,0.1); }
    h1 { background: linear-gradient(45deg, #4a6cf7, #a274ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 20px; }
    p { line-height: 1.7; color: rgba(242,244,250,0.85); }
    .resource { background: rgba(74,108,247,0.1); border-radius: 12px; padding: 20px; margin: 15px 0; border-left: 3px solid #4a6cf7; }
    .resource h3 { color: #f2f4fa; margin: 0 0 8px 0; }
    .resource p { margin: 0; font-size: 14px; }
    .cta { display: inline-block; background: linear-gradient(135deg, #4a6cf7, #a274ff); color: #fff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; margin-top: 20px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 13px; color: rgba(242,244,250,0.6); }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome to TECHGURU! \u{1F680}</h1>
    <p>Thank you for downloading the AI Automation Starter Kit. You're now part of 2,500+ professionals who are streamlining their operations with automation.</p>

    <p><strong>Here's what's inside your kit:</strong></p>

    <div class="resource">
      <h3>\u{1F4C4} 5 GPT Prompt Templates</h3>
      <p>Ready-to-use prompts for content creation, customer support, data analysis, code review, and meeting summaries.</p>
    </div>

    <div class="resource">
      <h3>\u{1F4D8} Automation Playbook</h3>
      <p>Step-by-step guide to identifying automation opportunities and implementing your first workflow.</p>
    </div>

    <div class="resource">
      <h3>\u{1F4CA} AI Tools Comparison Cheat Sheet</h3>
      <p>Side-by-side comparison of 15+ AI tools with pricing, use cases, and recommendations.</p>
    </div>

    <div class="resource">
      <h3>\u2705 Workflow Optimization Checklist</h3>
      <p>Audit your current processes and identify quick wins for automation.</p>
    </div>

    <p><strong>Ready to take it further?</strong></p>
    <p>Book a free 30-minute strategy call and we'll help you identify the highest-impact automation opportunities for your business.</p>

    <a href="https://cal.com/techguru/strategy-call" class="cta">Book Your Free Strategy Call \u2192</a>

    <div class="footer">
      <p>TECHGURU | Premium Automation & AI Systems</p>
      <p>Fort Lauderdale, FL 33308</p>
      <p>Questions? Reply to this email or visit <a href="https://techguruofficial.us" style="color: #4a6cf7;">techguruofficial.us</a></p>
      <p style="margin-top: 15px;"><a href="https://techguruofficial.us/unsubscribe" style="color: rgba(242,244,250,0.5);">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`
      }
    ]
  };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendGridKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(welcomeEmail)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SendGrid welcome email failed (${response.status}):`, errorText);
      throw new Error(`SendGrid failed: ${response.status}`);
    }
    return { success: true };
  } catch (error) {
    console.error("SendGrid Email Error:", error);
    return { success: false, error: error.message };
  }
}, "sendWelcomeEmail");
var sendAdminNotification = /* @__PURE__ */ __name(async (email, source, sendGridKey, adminEmail, replyToEmail) => {
  const url = "https://api.sendgrid.com/v3/mail/send";
  const adminNotification = {
    personalizations: [
      {
        to: [{ email: adminEmail }],
        subject: `\u{1F4EC} New Subscriber: ${email}`
      }
    ],
    from: {
      email: replyToEmail,
      name: "TECHGURU System"
    },
    content: [
      {
        type: "text/html",
        value: `<h2>New Lead Magnet Subscriber</h2>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Source:</strong> ${source}</p>
<p><strong>Timestamp:</strong> ${(/* @__PURE__ */ new Date()).toISOString()}</p>`
      }
    ]
  };
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendGridKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(adminNotification)
    });
  } catch (error) {
    console.error("Admin notification failed:", error);
  }
}, "sendAdminNotification");
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
    const sendGridKey = env.SENDGRID_API_KEY;
    const adminEmail = env.ADMIN_EMAIL || "info@techguruofficial.us";
    if (!sendGridKey) {
      console.error("SENDGRID_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service is not properly configured" }),
        { status: 500, headers: corsHeaders }
      );
    }
    const emailResult = await sendWelcomeEmail(
      validation.data.email,
      sendGridKey,
      adminEmail
    );
    if (!emailResult.success) {
      return new Response(
        JSON.stringify({ error: "Failed to send welcome email. Please try again." }),
        { status: 500, headers: corsHeaders }
      );
    }
    ctx.waitUntil(
      sendAdminNotification(
        validation.data.email,
        validation.data.source,
        sendGridKey,
        adminEmail,
        adminEmail
      )
    );
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

// src/index.js
var getCorsHeaders = /* @__PURE__ */ __name((origin) => {
  const allowedOrigins = [
    "https://techguruofficial.us",
    "https://www.techguruofficial.us",
    "http://localhost:8000",
    // for local dev
    "http://127.0.0.1:8000",
    // for local dev
    "http://localhost:3000"
    // for local dev
  ];
  const isAllowed = allowedOrigins.includes(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://techguruofficial.us",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}, "getCorsHeaders");
var index_default = {
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
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
