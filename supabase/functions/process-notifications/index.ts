import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Mozart School <enquiries@mozartmusic.org>"
const OWNER_EMAIL = Deno.env.get("OWNER_EMAIL") || "srinivaschetty@gmail.com"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

interface NotificationJob {
  id: string
  enquiry_id: string
  kind: "owner_alert" | "visitor_acknowledgement"
  recipient: string
  subject: string
  attempts: number
}

serve(async (req: Request) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Supabase credentials missing" }), { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // 1. Claim a batch of up to 10 notification jobs with 5-minute lease
    const { data: jobs, error: claimError } = await supabase.rpc("claim_notification_jobs", {
      p_batch_size: 10,
      p_lease_seconds: 300,
    })

    if (claimError) {
      console.error("Error claiming jobs:", claimError)
      return new Response(JSON.stringify({ error: claimError.message }), { status: 500 })
    }

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ message: "No pending jobs to process", processed: 0 }), { status: 200 })
    }

    const results = []

    for (const job of (jobs as NotificationJob[])) {
      try {
        // Fetch full enquiry details for the job
        const { data: enquiry, error: enquiryError } = await supabase
          .from("enquiries")
          .select("*")
          .eq("id", job.enquiry_id)
          .single()

        if (enquiryError || !enquiry) {
          throw new Error(`Enquiry record ${job.enquiry_id} not found: ${enquiryError?.message}`)
        }

        let htmlContent = ""
        let replyTo = undefined

        if (job.kind === "owner_alert") {
          replyTo = enquiry.email || undefined
          htmlContent = `
            <!DOCTYPE html>
            <html>
              <head><meta charset="utf-8"></head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111; line-height: 1.6; padding: 24px;">
                <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e5e5e5; padding: 32px; border-radius: 4px;">
                  <h2 style="font-family: Georgia, serif; font-weight: normal; margin-top: 0; border-bottom: 2px solid #000; padding-bottom: 12px;">
                    Mozart School — ${job.subject}
                  </h2>
                  <p><strong>Enquiry Type:</strong> ${enquiry.type}</p>
                  <p><strong>Contact Name:</strong> ${enquiry.contact_name}</p>
                  <p><strong>Email:</strong> ${enquiry.email || 'Not provided'}</p>
                  <p><strong>Phone:</strong> ${enquiry.phone || 'Not provided'}</p>
                  <p><strong>Preferred Contact:</strong> ${enquiry.preferred_contact || 'Either'}</p>
                  ${enquiry.instrument ? `<p><strong>Instrument:</strong> ${enquiry.instrument}</p>` : ''}
                  ${enquiry.learner_group ? `<p><strong>Learner Group:</strong> ${enquiry.learner_group}</p>` : ''}
                  ${enquiry.learner_name ? `<p><strong>Learner Name:</strong> ${enquiry.learner_name}</p>` : ''}
                  ${enquiry.experience ? `<p><strong>Experience:</strong> ${enquiry.experience}</p>` : ''}
                  ${enquiry.class_preference ? `<p><strong>Class Preference:</strong> <span style="text-transform: capitalize;">${enquiry.class_preference.replace('_', ' ')}</span></p>` : ''}
                  ${enquiry.preferred_times ? `<p><strong>Preferred Times:</strong> ${enquiry.preferred_times}</p>` : ''}
                  ${enquiry.message ? `<p><strong>Message:</strong><br><blockquote style="background: #f9f9f9; padding: 12px; margin: 8px 0; border-left: 3px solid #000;">${enquiry.message}</blockquote></p>` : ''}
                  <p><strong>Location Updates Consent:</strong> ${enquiry.location_updates ? 'Yes' : 'No'}</p>
                  <p><strong>Source:</strong> ${enquiry.source}</p>
                  <p><strong>Submitted:</strong> ${new Date(enquiry.created_at).toLocaleString()}</p>
                  <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;">
                  <p style="font-size: 13px; color: #666;">
                    Log in to the staff dashboard to reply, add notes, or manage enrolment status.
                  </p>
                </div>
              </body>
            </html>
          `
        } else {
          // Visitor acknowledgement
          htmlContent = `
            <!DOCTYPE html>
            <html>
              <head><meta charset="utf-8"></head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111; line-height: 1.6; padding: 24px;">
                <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e5e5e5; padding: 32px; border-radius: 4px;">
                  <h2 style="font-family: Georgia, serif; font-weight: normal; margin-top: 0; border-bottom: 2px solid #000; padding-bottom: 12px;">
                    Mozart School Of Western Classical Music
                  </h2>
                  <p>Dear ${enquiry.contact_name},</p>
                  <p>
                    Thank you for reaching out to us. We have received your ${enquiry.type === 'location_interest' ? 'location-interest registration' : 'lesson enquiry'} and will get in touch with you directly to discuss the next steps.
                  </p>
                  <div style="background: #f7f7f7; border-left: 3px solid #000; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0; font-weight: 500;">
                      Online and in-person classes are available.
                    </p>
                    <p style="margin: 8px 0 0; font-style: italic; color: #444;">
                      “Coming soon — A welcoming new space is on the way.”
                    </p>
                    <p style="margin: 6px 0 0; font-size: 13px; color: #555;">
                      Online classes are available now. Our in-person studio is being prepared, and we will keep you informed as opening updates are confirmed.
                    </p>
                  </div>
                  <p>
                    If you have any immediate questions in the meantime, you are welcome to reach us by telephone or email:
                  </p>
                  <p style="font-size: 14px;">
                    <strong>Telephone:</strong> <a href="tel:9043877104" style="color: #000;">9043877104</a><br>
                    <strong>Email:</strong> <a href="mailto:srinivaschetty@gmail.com" style="color: #000;">srinivaschetty@gmail.com</a>
                  </p>
                  <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;">
                  <p style="font-size: 12px; color: #888; margin-bottom: 0;">
                    Mozart School Of Western Classical Music · Chennai
                  </p>
                </div>
              </body>
            </html>
          `
        }

        let providerMessageId = null

        // Send via Resend if API key is provided
        if (RESEND_API_KEY && RESEND_API_KEY !== "mock-resend-key") {
          const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: [job.recipient],
              reply_to: replyTo,
              subject: job.subject,
              html: htmlContent,
            }),
          })

          const resendData = await resendResponse.json()

          if (!resendResponse.ok) {
            throw new Error(`Resend API error (${resendResponse.status}): ${JSON.stringify(resendData)}`)
          }

          providerMessageId = resendData.id
        } else {
          // Dev / mock mode logging
          console.log(`[DEV EMAIL MOCK] Sending email to ${job.recipient} with subject "${job.subject}"`)
          providerMessageId = `mock-${crypto.randomUUID()}`
        }

        // Update job status to 'sent'
        await supabase
          .from("notification_jobs")
          .update({
            status: "sent",
            provider_message_id: providerMessageId,
            last_error: null,
            processing_token: null,
            processing_expires_at: null,
          })
          .eq("id", job.id)

        results.push({ id: job.id, status: "sent", providerMessageId })
      } catch (err: any) {
        console.error(`Failed to process job ${job.id}:`, err)
        const isExhausted = job.attempts >= 5
        const nextAttempt = new Date(Date.now() + Math.pow(2, job.attempts) * 60 * 1000).toISOString()

        await supabase
          .from("notification_jobs")
          .update({
            status: isExhausted ? "failed" : "pending",
            last_error: err?.message || String(err),
            next_attempt_at: nextAttempt,
            processing_token: null,
            processing_expires_at: null,
          })
          .eq("id", job.id)

        results.push({ id: job.id, status: "failed", error: err?.message })
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), { status: 200 })
  } catch (err: any) {
    console.error("Worker fatal error:", err)
    return new Response(JSON.stringify({ error: err?.message }), { status: 500 })
  }
})
