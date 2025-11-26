/**
 * Subscribe Endpoint Handler
 * Handles newsletter/lead magnet subscriptions
 * Sends welcome email with starter kit links via SendGrid
 *
 * Environment variables required:
 * - SENDGRID_API_KEY: SendGrid API key for email
 * - ADMIN_EMAIL: Email to receive notifications
 */

/**
 * Email validation regex (RFC 5322 simplified)
 */
const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email) && email.length <= 254;
};

/**
 * Validate subscribe request payload
 */
const validateSubscribeRequest = (body) => {
  if (!body?.email || !isValidEmail(body.email)) {
    return { valid: false, error: 'Valid email address is required' };
  }

  return {
    valid: true,
    data: {
      email: body.email.toLowerCase().trim(),
      source: body.source || 'lead-magnet',
    },
  };
};

/**
 * Check rate-limiting using Cloudflare KV
 * Limit: 3 subscriptions per IP per hour
 */
const checkRateLimit = async (kv, clientIp) => {
  if (!kv) {
    // If KV is not configured, allow the request but log a warning
    console.warn('RATE_LIMIT KV namespace not configured');
    return { allowed: true, remaining: 999 };
  }

  const key = `ratelimit:subscribe:${clientIp}`;
  const current = await kv.get(key, 'json') || { count: 0, timestamp: Date.now() };

  const oneHourAgo = Date.now() - 3600000;

  // Reset counter if outside 1-hour window
  if (current.timestamp < oneHourAgo) {
    await kv.put(key, JSON.stringify({ count: 1, timestamp: Date.now() }), { expirationTtl: 3600 });
    return { allowed: true, remaining: 2 };
  }

  // Check if limit exceeded
  if (current.count >= 3) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((current.timestamp + 3600000 - Date.now()) / 1000) };
  }

  // Increment counter
  current.count++;
  await kv.put(key, JSON.stringify(current), { expirationTtl: 3600 });

  return { allowed: true, remaining: 3 - current.count };
};

/**
 * Send welcome email with starter kit via SendGrid
 */
const sendWelcomeEmail = async (email, sendGridKey, replyToEmail) => {
  const url = 'https://api.sendgrid.com/v3/mail/send';

  const welcomeEmail = {
    personalizations: [
      {
        to: [{ email: email }],
        subject: '🎉 Your AI Automation Starter Kit is Ready!',
      },
    ],
    from: {
      email: replyToEmail,
      name: 'TECHGURU',
    },
    content: [
      {
        type: 'text/html',
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
    <h1>Welcome to TECHGURU! 🚀</h1>
    <p>Thank you for downloading the AI Automation Starter Kit. You're now part of 2,500+ professionals who are streamlining their operations with automation.</p>

    <p><strong>Here's what's inside your kit:</strong></p>

    <div class="resource">
      <h3>📄 5 GPT Prompt Templates</h3>
      <p>Ready-to-use prompts for content creation, customer support, data analysis, code review, and meeting summaries.</p>
    </div>

    <div class="resource">
      <h3>📘 Automation Playbook</h3>
      <p>Step-by-step guide to identifying automation opportunities and implementing your first workflow.</p>
    </div>

    <div class="resource">
      <h3>📊 AI Tools Comparison Cheat Sheet</h3>
      <p>Side-by-side comparison of 15+ AI tools with pricing, use cases, and recommendations.</p>
    </div>

    <div class="resource">
      <h3>✅ Workflow Optimization Checklist</h3>
      <p>Audit your current processes and identify quick wins for automation.</p>
    </div>

    <p><strong>Ready to take it further?</strong></p>
    <p>Book a free 30-minute strategy call and we'll help you identify the highest-impact automation opportunities for your business.</p>

    <a href="https://cal.com/techguru/strategy-call" class="cta">Book Your Free Strategy Call →</a>

    <div class="footer">
      <p>TECHGURU | Premium Automation & AI Systems</p>
      <p>Fort Lauderdale, FL 33308</p>
      <p>Questions? Reply to this email or visit <a href="https://techguruofficial.us" style="color: #4a6cf7;">techguruofficial.us</a></p>
      <p style="margin-top: 15px;"><a href="https://techguruofficial.us/unsubscribe" style="color: rgba(242,244,250,0.5);">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`,
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(welcomeEmail),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SendGrid welcome email failed (${response.status}):`, errorText);
      throw new Error(`SendGrid failed: ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    console.error('SendGrid Email Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification to admin about new subscriber
 */
const sendAdminNotification = async (email, source, sendGridKey, adminEmail, replyToEmail) => {
  const url = 'https://api.sendgrid.com/v3/mail/send';

  const adminNotification = {
    personalizations: [
      {
        to: [{ email: adminEmail }],
        subject: `📬 New Subscriber: ${email}`,
      },
    ],
    from: {
      email: replyToEmail,
      name: 'TECHGURU System',
    },
    content: [
      {
        type: 'text/html',
        value: `<h2>New Lead Magnet Subscriber</h2>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Source:</strong> ${source}</p>
<p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>`,
      },
    ],
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(adminNotification),
    });
  } catch (error) {
    // Non-critical, just log
    console.error('Admin notification failed:', error);
  }
};

/**
 * Get client IP from request
 */
const getClientIp = (request) => {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0] ||
    'unknown'
  );
};

/**
 * Main subscribe handler
 */
export const handleSubscribe = async (request, env, ctx, origin) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = await request.json();

    // Validate request
    const validation = validateSubscribeRequest(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check rate-limiting
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit(env.RATE_LIMIT, clientIp);

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests. Please try again later.',
          retryAfter: rateLimit.retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Retry-After': String(rateLimit.retryAfter),
          },
        }
      );
    }

    // Check for API keys
    const sendGridKey = env.SENDGRID_API_KEY;
    const adminEmail = env.ADMIN_EMAIL || 'info@techguruofficial.us';

    if (!sendGridKey) {
      console.error('SENDGRID_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service is not properly configured' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Send welcome email to subscriber
    const emailResult = await sendWelcomeEmail(
      validation.data.email,
      sendGridKey,
      adminEmail
    );

    if (!emailResult.success) {
      return new Response(
        JSON.stringify({ error: 'Failed to send welcome email. Please try again.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Send admin notification (fire and forget)
    ctx.waitUntil(
      sendAdminNotification(
        validation.data.email,
        validation.data.source,
        sendGridKey,
        adminEmail,
        adminEmail
      )
    );

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Success! Check your inbox for the starter kit.',
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Subscribe Handler Error:', error);
    return new Response(
      JSON.stringify({ error: 'Invalid request format' }),
      { status: 400, headers: corsHeaders }
    );
  }
};
