import { SubmissionPayload } from "./types"
import { supabase, isLiveSupabaseConfigured, mockBackend } from "./supabase"
import { validateEnquiryPayload } from "./validation"

export interface ApiResponse {
  ok: boolean
  message: string
  error?: string
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return "key-" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

export async function submitEnquiry(payload: SubmissionPayload): Promise<ApiResponse> {
  // 1. Client-side validation check
  const validation = validateEnquiryPayload(payload)
  if (!validation.isValid) {
    return {
      ok: false,
      message: validation.errors[0]?.message || "Validation failed.",
      error: validation.errors[0]?.message,
    }
  }

  // 2. Attach idempotency key if missing
  const completePayload: SubmissionPayload = {
    ...payload,
    idempotencyKey: payload.idempotencyKey || generateIdempotencyKey(),
    consentVersion: payload.consentVersion || "v1",
  }

  // 3. Live Edge Function submission
  if (isLiveSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.functions.invoke("submit-enquiry", {
        body: completePayload,
      })

      if (error) {
        console.error("Edge function error:", error)
        return {
          ok: false,
          message: error.message || "Failed to submit enquiry. Please call or email the school.",
          error: error.message,
        }
      }

      return {
        ok: true,
        message: data?.message || "Thank you. Your enquiry has been received.",
      }
    } catch (err: any) {
      console.error("Network error during submission:", err)
      return {
        ok: false,
        message: "Network error. Please try again or reach us directly by phone or email.",
        error: err.message,
      }
    }
  }

  // 4. Local preview fallback (Simulated Edge Function execution)
  await new Promise((resolve) => setTimeout(resolve, 450))

  try {
    mockBackend.addEnquiry({
      type: completePayload.type,
      contact_name: completePayload.contactName,
      email: completePayload.email ? completePayload.email.trim().toLowerCase() : null,
      phone: completePayload.phone ? completePayload.phone.trim() : null,
      preferred_contact: completePayload.preferredContact || (completePayload.email && completePayload.phone ? "either" : completePayload.email ? "email" : "phone"),
      instrument: completePayload.instrument || null,
      learner_group: completePayload.learnerGroup || null,
      learner_name: completePayload.learnerName ? completePayload.learnerName.trim() : null,
      experience: completePayload.experience || null,
      class_preference: completePayload.classPreference || null,
      preferred_times: completePayload.preferredTimes ? completePayload.preferredTimes.trim() : null,
      message: completePayload.message ? completePayload.message.trim() : null,
      status: "new",
      source: completePayload.source || "website_form",
      contact_consent: completePayload.contactConsent,
      location_updates: Boolean(completePayload.locationUpdates),
      consent_version: "v1",
      consented_at: new Date().toISOString(),
      idempotency_key: completePayload.idempotencyKey || null,
      metadata: { isPreviewMock: true },
    })

    return {
      ok: true,
      message: completePayload.type === "location_interest"
        ? "Thank you for registering your interest. Our welcoming new space is on the way, and we’ll share an update when there is news."
        : "Thank you for getting in touch with Mozart School. We’ve received your enquiry and will be in touch soon.",
    }
  } catch (err: any) {
    return {
      ok: false,
      message: "An unexpected error occurred. Please try again or call 9043877104.",
      error: err.message,
    }
  }
}
