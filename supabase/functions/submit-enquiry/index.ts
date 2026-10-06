import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0"

// Allowed CORS origins
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "*").split(",").map((o) => o.trim())

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || ""
  const isAllowed = ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin || "*" : ALLOWED_ORIGINS[0] || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  }
}

interface EnquiryInput {
  type: "lesson" | "location_interest" | "general"
  contactName: string
  email?: string
  phone?: string
  preferredContact?: "email" | "phone" | "either"
  instrument?: "piano" | "keyboard" | "violin" | "unsure"
  learnerGroup?: "child" | "teen" | "adult"
  learnerName?: string
  experience?: "beginner" | "some_experience" | "experienced"
  classPreference?: "online" | "in_person" | "either_guidance"
  preferredTimes?: string
  message?: string
  source?: string
  contactConsent: boolean
  locationUpdates?: boolean
  consentVersion?: string
  turnstileToken?: string
  idempotencyKey?: string
  // Honeypot fields (must be empty)
  _hp?: string
  honeypot?: string
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  try {
    const rawBody = await req.json()
    const data: EnquiryInput = rawBody

    // 1. Honeypot verification (Reject bot submissions immediately)
    if (data._hp || data.honeypot) {
      console.warn("Spam honeypot triggered")
      // Return fake success to confuse spam scrapers without creating any DB records
      return new Response(
        JSON.stringify({ ok: true, message: "Thank you — your enquiry has been received." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 2. Input validation & data minimization
    if (!["lesson", "location_interest", "general"].includes(data.type)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid enquiry type specified." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const contactName = (data.contactName || "").trim()
    if (contactName.length < 2 || contactName.length > 120) {
      return new Response(
        JSON.stringify({ ok: false, error: "Please provide a valid contact name (2-120 characters)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Clean and normalize contact methods
    const email = data.email ? data.email.trim().toLowerCase() : null
    const phone = data.phone ? data.phone.replace(/[^0-9+() -]/g, "").trim() : null

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (email && !emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Please provide a valid email address." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (phone && (phone.length < 7 || phone.length > 30)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Please provide a valid phone number." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!email && !phone) {
      return new Response(
        JSON.stringify({ ok: false, error: "Please provide at least one contact method (email or phone)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Consent check
    if (!data.contactConsent) {
      return new Response(
        JSON.stringify({ ok: false, error: "You must consent to be contacted regarding your enquiry." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Instrument and learner group validation for lesson enquiries
    if (data.type === "lesson") {
      if (data.instrument && !["piano", "keyboard", "violin", "unsure"].includes(data.instrument)) {
        return new Response(
          JSON.stringify({ ok: false, error: "Invalid instrument selection." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
      if (data.learnerGroup && !["child", "teen", "adult"].includes(data.learnerGroup)) {
        return new Response(
          JSON.stringify({ ok: false, error: "Invalid learner group selection." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
      if (!data.classPreference || !["online", "in_person", "either_guidance"].includes(data.classPreference)) {
        return new Response(
          JSON.stringify({ ok: false, error: "Please select your class preference: Online, In-person, or Either / I’d like guidance." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }

    // Initialize Supabase client with privileged service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration environment variables.")
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration error. Please contact the school directly." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Durable Rate Limiting by client IP
    const clientIp = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "unknown"
    const rateLimitKey = `enquiry_ip:${clientIp}`
    const now = new Date()

    const { data: currentLimit } = await supabase
      .from("rate_limits")
      .select("count, expires_at")
      .eq("key", rateLimitKey)
      .single()

    if (currentLimit && new Date(currentLimit.expires_at) > now) {
      if (currentLimit.count >= 10) { // Limit to 10 submissions per IP per 15 minutes
        return new Response(
          JSON.stringify({ ok: false, error: "Too many enquiries from this network. Please wait a few minutes or call us directly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
      await supabase
        .from("rate_limits")
        .update({ count: currentLimit.count + 1 })
        .eq("key", rateLimitKey)
    } else {
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString()
      await supabase
        .from("rate_limits")
        .upsert({ key: rateLimitKey, count: 1, window_start: now.toISOString(), expires_at: expiresAt })
    }

    // 4. Cloudflare Turnstile Verification (if secret is configured)
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY")
    if (turnstileSecret && turnstileSecret !== "mock-turnstile-secret") {
      if (!data.turnstileToken) {
        return new Response(
          JSON.stringify({ ok: false, error: "Spam check token missing. Please try again." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      const verifyFormData = new FormData()
      verifyFormData.append("secret", turnstileSecret)
      verifyFormData.append("response", data.turnstileToken)
      if (clientIp !== "unknown") {
        verifyFormData.append("remoteip", clientIp)
      }

      const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: verifyFormData,
      })
      const turnstileOutcome = await turnstileRes.json()

      if (!turnstileOutcome.success) {
        console.warn("Turnstile challenge failed:", turnstileOutcome["error-codes"])
        return new Response(
          JSON.stringify({ ok: false, error: "Spam challenge could not be verified. Please try again." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }

    // 5. Atomic database insertion & notification job creation
    const ownerEmail = Deno.env.get("OWNER_EMAIL") || "srinivaschetty@gmail.com"
    const idempotencyKey = data.idempotencyKey || req.headers.get("x-idempotency-key") || null

    const { data: enquiryId, error: dbError } = await supabase.rpc("submit_enquiry_atomic", {
      p_type: data.type,
      p_contact_name: contactName,
      p_email: email,
      p_phone: phone,
      p_preferred_contact: data.preferredContact || (email && phone ? "either" : email ? "email" : "phone"),
      p_instrument: data.instrument || null,
      p_learner_group: data.learnerGroup || null,
      p_learner_name: data.learnerName ? data.learnerName.trim().slice(0, 80) : null,
      p_experience: data.experience || null,
      p_class_preference: data.classPreference || null,
      p_preferred_times: data.preferredTimes ? data.preferredTimes.trim().slice(0, 300) : null,
      p_message: data.message ? data.message.trim().slice(0, 3000) : null,
      p_source: (data.source || "website_form").slice(0, 80),
      p_contact_consent: Boolean(data.contactConsent),
      p_location_updates: Boolean(data.locationUpdates),
      p_consent_version: data.consentVersion || "v1",
      p_idempotency_key: idempotencyKey,
      p_metadata: {
        userAgent: req.headers.get("user-agent") || "unknown",
        submittedAt: now.toISOString(),
      },
      p_owner_email: ownerEmail,
    })

    if (dbError) {
      console.error("Database submission error:", dbError)
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to record enquiry. Please contact the school directly." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Success response: Generic, dignified, no private data leaked
    return new Response(
      JSON.stringify({
        ok: true,
        message: data.type === "location_interest"
          ? "Thank you for registering your interest. In-person classes are coming soon — A welcoming new space is on the way, and we’ll keep you informed."
          : "Thank you for getting in touch with Mozart School. Online classes are available now, and in-person classes are coming soon. We’ve received your enquiry and will be in touch soon.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Unexpected handler exception:", err)
    return new Response(
      JSON.stringify({ ok: false, error: "An unexpected error occurred. Please try again or call the school." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
