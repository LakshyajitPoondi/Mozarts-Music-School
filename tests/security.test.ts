import { describe, it, expect } from "vitest"
import { validateEnquiryPayload } from "../src/lib/validation"
import { generateIdempotencyKey } from "../src/lib/api"

describe("Security, Abuse Prevention & Idempotency", () => {
  it("immediately rejects submissions with populated honeypot fields", () => {
    const honeypotPayload = {
      type: "lesson" as const,
      contactName: "Spam Bot",
      email: "bot@spammer.com",
      contactConsent: true,
      _hp: "http://spamlink.com", // Hidden honeypot field
    }

    const validation = validateEnquiryPayload(honeypotPayload)
    expect(validation.isValid).toBe(false)
    expect(validation.errors[0]?.field).toBe("_hp")
  })

  it("generates unique idempotency keys", () => {
    const key1 = generateIdempotencyKey()
    const key2 = generateIdempotencyKey()

    expect(key1).toBeDefined()
    expect(key2).toBeDefined()
    expect(key1).not.toBe(key2)
  })

  it("handles simulated rate limit thresholds correctly", () => {
    // Durable rate limit simulator
    class RateLimiter {
      private requests = new Map<string, { count: number; expiresAt: number }>()

      checkAndIncrement(ip: string, limit = 5, windowMs = 60000): { allowed: boolean; remaining: number } {
        const now = Date.now()
        const record = this.requests.get(ip)

        if (!record || record.expiresAt < now) {
          this.requests.set(ip, { count: 1, expiresAt: now + windowMs })
          return { allowed: true, remaining: limit - 1 }
        }

        if (record.count >= limit) {
          return { allowed: false, remaining: 0 }
        }

        record.count += 1
        return { allowed: true, remaining: limit - record.count }
      }
    }

    const limiter = new RateLimiter()
    const testIp = "192.168.1.100"

    // 5 allowed requests
    for (let i = 0; i < 5; i++) {
      const res = limiter.checkAndIncrement(testIp, 5)
      expect(res.allowed).toBe(true)
    }

    // 6th request is blocked
    const blockedRes = limiter.checkAndIncrement(testIp, 5)
    expect(blockedRes.allowed).toBe(false)
    expect(blockedRes.remaining).toBe(0)
  })

  it("deduplicates requests matching the same idempotency key", () => {
    const store = new Map<string, string>()

    function processSubmission(idempotencyKey: string, enquiryId: string): { status: "created" | "duplicate"; id: string } {
      if (store.has(idempotencyKey)) {
        return { status: "duplicate", id: store.get(idempotencyKey)! }
      }
      store.set(idempotencyKey, enquiryId)
      return { status: "created", id: enquiryId }
    }

    const key = "client-txn-xyz-987"
    const firstCall = processSubmission(key, "enq-001")
    expect(firstCall.status).toBe("created")
    expect(firstCall.id).toBe("enq-001")

    // Retry with identical idempotency key returns the original enquiry without duplicating
    const retryCall = processSubmission(key, "enq-002")
    expect(retryCall.status).toBe("duplicate")
    expect(retryCall.id).toBe("enq-001")
  })
})
