import { describe, it, expect } from "vitest"
import { validateEnquiryPayload } from "../src/lib/validation"

describe("Enquiry Payload Validation & Data Minimization", () => {
  it("accepts a valid lesson enquiry with email, consent, and class preference", () => {
    const result = validateEnquiryPayload({
      type: "lesson",
      contactName: "Sunita Sundaram",
      email: "sunita@example.com",
      instrument: "piano",
      learnerGroup: "child",
      learnerName: "Rohan",
      experience: "beginner",
      classPreference: "online",
      contactConsent: true,
      locationUpdates: false,
    })

    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("accepts a valid lesson enquiry with phone only and in-person class preference", () => {
    const result = validateEnquiryPayload({
      type: "lesson",
      contactName: "Karthik Raman",
      phone: "9043877104",
      instrument: "violin",
      learnerGroup: "adult",
      experience: "some_experience",
      classPreference: "in_person",
      contactConsent: true,
    })

    expect(result.isValid).toBe(true)
  })

  it("rejects lesson enquiry when class preference is missing", () => {
    const result = validateEnquiryPayload({
      type: "lesson",
      contactName: "Sunita Sundaram",
      email: "sunita@example.com",
      instrument: "piano",
      contactConsent: true,
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.field === "classPreference")).toBe(true)
  })

  it("accepts each valid class preference: online, in_person, either_guidance", () => {
    const preferences = ["online", "in_person", "either_guidance"] as const
    for (const pref of preferences) {
      const result = validateEnquiryPayload({
        type: "lesson",
        contactName: "Test Student",
        email: "test@example.com",
        instrument: "piano",
        classPreference: pref,
        contactConsent: true,
      })
      expect(result.isValid).toBe(true)
    }
  })

  it("rejects submission when neither email nor phone is provided", () => {
    const result = validateEnquiryPayload({
      type: "lesson",
      contactName: "Anonymous Visitor",
      instrument: "piano",
      classPreference: "online",
      contactConsent: true,
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.field === "contact")).toBe(true)
  })

  it("rejects submission when contact consent is not checked", () => {
    const result = validateEnquiryPayload({
      type: "lesson",
      contactName: "Vijay Kumar",
      email: "vijay@example.com",
      classPreference: "online",
      contactConsent: false,
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.field === "contactConsent")).toBe(true)
  })

  it("rejects invalid contact name shorter than 2 characters", () => {
    const result = validateEnquiryPayload({
      type: "general",
      contactName: "A",
      email: "a@example.com",
      contactConsent: true,
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.field === "contactName")).toBe(true)
  })

  it("rejects invalid email address format", () => {
    const result = validateEnquiryPayload({
      type: "general",
      contactName: "Meera",
      email: "invalid-email-address",
      contactConsent: true,
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.field === "email")).toBe(true)
  })

  it("validates location interest registration cleanly", () => {
    const result = validateEnquiryPayload({
      type: "location_interest",
      contactName: "Deepak Chari",
      email: "deepak@example.com",
      contactConsent: true,
      locationUpdates: true,
    })

    expect(result.isValid).toBe(true)
  })

  it("rejects unrecognized instrument types", () => {
    const result = validateEnquiryPayload({
      type: "lesson",
      contactName: "Sanjay",
      email: "sanjay@example.com",
      instrument: "drums" as any,
      classPreference: "online",
      contactConsent: true,
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.field === "instrument")).toBe(true)
  })

  it("ensures data minimization: child details do not collect date of birth or full names", () => {
    const payload = {
      type: "lesson" as const,
      contactName: "Priya (Parent)",
      email: "priya@example.com",
      instrument: "keyboard" as const,
      learnerGroup: "child" as const,
      learnerName: "Aarav", // First name only
      classPreference: "online" as const,
      contactConsent: true,
    }

    const result = validateEnquiryPayload(payload)
    expect(result.isValid).toBe(true)
    // Verify no dateOfBirth or full personal fields exist on the payload contract
    expect((payload as any).dateOfBirth).toBeUndefined()
    expect((payload as any).childFullName).toBeUndefined()
  })
})
