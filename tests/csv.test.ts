import { describe, it, expect } from "vitest"
import { sanitizeCsvField, exportEnquiriesToCsv } from "../src/lib/csv"
import { Enquiry } from "../src/lib/types"

describe("CSV Export & Spreadsheet Formula Injection Prevention", () => {
  it("prepends dangerous formula prefixes with a single quote", () => {
    // Tests for spreadsheet injection triggers: =, +, -, @, tab
    expect(sanitizeCsvField("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)")
    expect(sanitizeCsvField("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0")
    expect(sanitizeCsvField("-2+3+cmd|' /C calc'!A0")).toBe("'-2+3+cmd|' /C calc'!A0")
    expect(sanitizeCsvField("@HYPERLINK(\"http://evil.com\")")).toBe('"\'@HYPERLINK(""http://evil.com"")"')
    expect(sanitizeCsvField("\tDangerousTab")).toBe("'\tDangerousTab")
  })

  it("safely retains ordinary benign values without prefixing", () => {
    expect(sanitizeCsvField("John Doe")).toBe("John Doe")
    expect(sanitizeCsvField("9043877104")).toBe("9043877104")
    expect(sanitizeCsvField("piano")).toBe("piano")
    expect(sanitizeCsvField(null)).toBe("")
    expect(sanitizeCsvField(undefined)).toBe("")
  })

  it("properly quotes values containing commas, quotes, and newlines", () => {
    expect(sanitizeCsvField("Hello, world")).toBe('"Hello, world"')
    expect(sanitizeCsvField('He said "Hello"')).toBe('"He said ""Hello"""')
  })

  it("exports an entire batch of enquiries with safe formula escaping", () => {
    const mockEnquiries: Enquiry[] = [
      {
        id: "e1",
        created_at: "2026-10-05T10:00:00Z",
        updated_at: "2026-10-05T10:00:00Z",
        type: "lesson",
        contact_name: "=MaliciousFormula",
        email: "victim@example.com",
        phone: "+919043877104",
        preferred_contact: "email",
        instrument: "piano",
        learner_group: "adult",
        learner_name: null,
        experience: "beginner",
        class_preference: "online",
        preferred_times: "Weekends",
        message: "Hello, looking for lessons.",
        status: "new",
        source: "website",
        contact_consent: true,
        location_updates: false,
        consent_version: "v1",
        consented_at: "2026-10-05T10:00:00Z",
        idempotency_key: "k1",
        metadata: {},
      },
    ]

    const csvOutput = exportEnquiriesToCsv(mockEnquiries)
    expect(csvOutput).toContain("ID,Submitted At,Enquiry Type")
    // Malicious formula in contact_name was escaped to '=MaliciousFormula
    expect(csvOutput).toContain("'=MaliciousFormula")
    // Phone starting with + was escaped to '+919043877104
    expect(csvOutput).toContain("'+919043877104")
  })
})
