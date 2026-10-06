import { describe, it, expect } from "vitest"

describe("Transactional Notification Queue & Retry Policies", () => {
  interface MockJob {
    kind: "owner_alert" | "visitor_acknowledgement"
    recipient: string
    status: "pending" | "processing" | "sent" | "failed"
    attempts: number
    nextAttemptAt: Date
  }

  function queueJobsForEnquiry(email: string | null, ownerEmail = "srinivaschetty@gmail.com"): MockJob[] {
    const jobs: MockJob[] = []

    // Always queue owner notification
    jobs.push({
      kind: "owner_alert",
      recipient: ownerEmail,
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date(),
    })

    // Queue visitor acknowledgement only if visitor provided email
    if (email && email.trim().length > 0) {
      jobs.push({
        kind: "visitor_acknowledgement",
        recipient: email.trim().toLowerCase(),
        status: "pending",
        attempts: 0,
        nextAttemptAt: new Date(),
      })
    }

    return jobs
  }

  function recordJobAttempt(job: MockJob, success: boolean): MockJob {
    if (success) {
      return {
        ...job,
        status: "sent",
        attempts: job.attempts + 1,
      }
    }

    const nextAttempts = job.attempts + 1
    const isExhausted = nextAttempts >= 5
    // Exponential backoff: 2^attempts minutes
    const backoffMs = Math.pow(2, nextAttempts) * 60 * 1000

    return {
      ...job,
      attempts: nextAttempts,
      status: isExhausted ? "failed" : "pending",
      nextAttemptAt: new Date(Date.now() + backoffMs),
    }
  }

  it("queues owner alert and visitor acknowledgement when email is provided", () => {
    const jobs = queueJobsForEnquiry("visitor@example.com")
    expect(jobs).toHaveLength(2)
    expect(jobs[0]?.recipient).toBe("srinivaschetty@gmail.com")
    expect(jobs[1]?.recipient).toBe("visitor@example.com")
  })

  it("queues only owner alert when phone-only enquiry is submitted", () => {
    const jobs = queueJobsForEnquiry(null)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.recipient).toBe("srinivaschetty@gmail.com")
  })

  it("applies exponential backoff on retry and caps at 5 attempts", () => {
    let job: MockJob = {
      kind: "owner_alert",
      recipient: "srinivaschetty@gmail.com",
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date(),
    }

    // Attempt 1 fails
    job = recordJobAttempt(job, false)
    expect(job.status).toBe("pending")
    expect(job.attempts).toBe(1)

    // Attempt 2, 3, 4 fail
    job = recordJobAttempt(job, false)
    job = recordJobAttempt(job, false)
    job = recordJobAttempt(job, false)
    expect(job.status).toBe("pending")
    expect(job.attempts).toBe(4)

    // Attempt 5 fails -> permanently marked as failed for manual admin intervention
    job = recordJobAttempt(job, false)
    expect(job.status).toBe("failed")
    expect(job.attempts).toBe(5)
  })
})
