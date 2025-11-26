/**
 * Contact Form Endpoint Handler
 * Validates form data, applies rate-limiting, sends emails via Zoho Mail
 * 
 * Environment variables required:
 * - ZOHO_MAIL_API_KEY: Zoho Mail API key
 * - NOTIFICATION_EMAIL: Email to receive notifications (lucas@techguruofficial.us)
 * - REPLY_TO_EMAIL: Reply-to email (info@techguruofficial.us)
 * - SENDGRID_API_KEY (alternative): SendGrid API key for email
 */

/**
 * Email validation regex (RFC 5322 simplified)
 */
const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email) && email.length <= 254;
};

/**
 * Sanitize text input - prevent XSS
 */
const sanitizeText = (text, maxLength = 1000) => {
  if (typeof text !== 'string') return '';
  
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[^\w\s\-.,!?()']/g, '') // Remove special chars except basic punctuation
    .trim()
    .slice(0, maxLength);
};

/**
 * Validate contact form payload
 */
const validateContactRequest = (body) => {
  const errors = [];

  // Name validation
  if (!body?.name || typeof body.name !== 'string') {
    errors.push('Name is required');
  } else if (body.name.length < 2 || body.name.length > 100) {
    errors.push('Name must be between 2-100 characters');
  }

  // Email validation
  if (!body?.email || !isValidEmail(body.email)) {
    errors.push('Valid email address is required');
  }

  // Message validation
  if (!body?.message || typeof body.message !== 'string') {
    errors.push('Message is required');
  } else if (body.message.length < 10 || body.message.length > 5000) {
    errors.push('Message must be between 10-5000 characters');
  }

  // Subject validation (optional)
  if (body?.subject && typeof body.subject === 'string') {
    if (body.subject.length > 200) {
      errors.push('Subject must be under 200 characters');
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
      message: sanitizeText(body.message, 5000),
      subject: body.subject ? sanitizeText(body.subject, 200) : 'New TechGuru Contact Form Submission',
    },
  };
};

/**
 * Check rate-limiting using Cloudflare KV
 * Limit: 5 submissions per IP per hour
 */
const checkRateLimit = async (kv, clientIp) => {
  const key = `ratelimit:contact:${clientIp}`;
  const current = await kv.get(key, 'json') || { count: 0, timestamp: Date.now() };
  
  const oneHourAgo = Date.now() - 3600000;
  
  // Reset counter if outside 1-hour window
  if (current.timestamp < oneHourAgo) {
    await kv.put(key, JSON.stringify({ count: 1, timestamp: Date.now() }), { expirationTtl: 3600 });
    return { allowed: true, remaining: 4 };
  }

  // Check if limit exceeded
  if (current.count >= 5) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((current.timestamp + 3600000 - Date.now()) / 1000) };
  }

  // Increment counter
  current.count++;
  await kv.put(key, JSON.stringify(current), { expirationTtl: 3600 });
  
  return { allowed: true, remaining: 5 - current.count };
};

/**
 * Send emails via SendGrid (recommended for reliability)
 */
const sendEmailViaSendGrid = async (data, sendGridKey, notificationEmail, replyToEmail) => {
  const url = 'https://api.sendgrid.com/v3/mail/send';

  // Email to client (confirmation)
  const clientEmail = {
    personalizations: [
      {
        to: [{ email: data.email, name: data.name }],
        subject: 'We received your inquiry - TechGuru',
      },
    ],
    from: {
      email: replyToEmail,
      name: 'TECHGURU',
    },
    content: [
      {
        type: 'text/html',
        value: `<h2>Thank you for contacting TechGuru!</h2>
<p>Hi ${data.name},</p>
<p>We received your message and will get back to you within 24 hours.</p>
<p><strong>Your Message:</strong></p>
<p>${data.message.replace(/\n/g, '<br>')}</p>
<p>Best regards,<br>TechGuru Team</p>`,
      },
    ],
  };

  // Email to admin (notification)
  const adminEmail = {
    personalizations: [
      {
        to: [{ email: notificationEmail, name: 'TechGuru Admin' }],
        subject: `New Contact Form Submission: ${data.subject}`,
      },
    ],
    from: {
      email: replyToEmail,
      name: 'TECHGURU',
    },
    replyTo: {
      email: data.email,
      name: data.name,
    },
    content: [
      {
        type: 'text/html',
        value: `<h2>New Contact Form Submission</h2>
<p><strong>Name:</strong> ${data.name}</p>
<p><strong>Email:</strong> ${data.email}</p>
<p><strong>Subject:</strong> ${data.subject}</p>
<p><strong>Message:</strong></p>
<p>${data.message.replace(/\n/g, '<br>')}</p>
<p><em>Sent at: ${new Date().toISOString()}</em></p>`,
      },
    ],
  };

  try {
    // Send confirmation to client
    const clientResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clientEmail),
    });

    if (!clientResponse.ok) {
      const errorText = await clientResponse.text();
      console.error(`SendGrid client email failed (${clientResponse.status}):`, errorText);
      throw new Error(`SendGrid client email failed: ${clientResponse.status} - ${errorText}`);
    }

    // Send notification to admin
    const adminResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(adminEmail),
    });

    if (!adminResponse.ok) {
      const errorText = await adminResponse.text();
      console.error(`SendGrid admin email failed (${adminResponse.status}):`, errorText);
      throw new Error(`SendGrid admin email failed: ${adminResponse.status} - ${errorText}`);
    }

    return { success: true };
  } catch (error) {
    console.error('SendGrid Email Error:', error);
    return { success: false, error: error.message };
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
 * Main contact handler
 */
export const handleContact = async (request, env, ctx, origin) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = await request.json();

    // Validate request
    const validation = validateContactRequest(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: validation.errors }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check rate-limiting
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit(env.RATE_LIMIT, clientIp);
    
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Too many submissions. Please try again later.',
          retryAfter: rateLimit.retryAfter,
        }),
        { 
          status: 429, 
          headers: {
            ...corsHeaders,
            'Retry-After': rateLimit.retryAfter,
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

    // Send emails
    await sendEmailViaSendGrid(
      validation.data,
      sendGridKey,
      adminEmail,
      adminEmail
    );

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Thank you for your inquiry! We will contact you soon.',
        remaining: rateLimit.remaining,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Contact Handler Error:', error);
    return new Response(
      JSON.stringify({ error: 'Invalid request format' }),
      { status: 400, headers: corsHeaders }
    );
  }
};
