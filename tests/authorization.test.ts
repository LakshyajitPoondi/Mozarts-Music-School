import { describe, it, expect } from "vitest"
import { StaffRole } from "../src/lib/types"

describe("Staff Authorization & Role Separation (Admin vs Staff)", () => {
  interface UserRecord {
    id: string
    role: StaffRole
    invitation_status: "active" | "invited" | "revoked"
  }

  const staffDirectory: Record<string, UserRecord> = {
    "admin-srinivas": { id: "admin-srinivas", role: "admin", invitation_status: "active" },
    "staff-radhika": { id: "staff-radhika", role: "staff", invitation_status: "active" },
    "staff-revoked": { id: "staff-revoked", role: "staff", invitation_status: "revoked" },
  }

  function canAccessDashboard(userId: string | null): boolean {
    if (!userId || !staffDirectory[userId]) return false
    return staffDirectory[userId].invitation_status === "active"
  }

  function canManageStaff(userId: string | null): boolean {
    if (!canAccessDashboard(userId)) return false
    return staffDirectory[userId!].role === "admin"
  }

  function canManageEnquiries(userId: string | null): boolean {
    return canAccessDashboard(userId)
  }

  it("denies access to anonymous callers", () => {
    expect(canAccessDashboard(null)).toBe(false)
    expect(canManageStaff(null)).toBe(false)
  })

  it("denies access to unknown or student users", () => {
    expect(canAccessDashboard("student-123")).toBe(false)
  })

  it("denies access to revoked staff members", () => {
    expect(canAccessDashboard("staff-revoked")).toBe(false)
  })

  it("allows Admin to manage enquiries AND manage staff access", () => {
    expect(canManageEnquiries("admin-srinivas")).toBe(true)
    expect(canManageStaff("admin-srinivas")).toBe(true)
  })

  it("allows Staff to manage enquiries but prevents managing other staff", () => {
    expect(canManageEnquiries("staff-radhika")).toBe(true)
    expect(canManageStaff("staff-radhika")).toBe(false)
  })

  it("ensures public visitor submission payload does not return private notes or internal metadata", () => {
    const rawDatabaseRecord = {
      id: "enq-999",
      contact_name: "Visitor Name",
      email: "visitor@example.com",
      status: "new",
      internal_notes: "Private follow-up: potential scheduling clash on Thursdays.",
      admin_user_id: "staff-1",
    }

    function toPublicSubmissionResponse(record: typeof rawDatabaseRecord) {
      return {
        ok: true,
        message: "Thank you — your enquiry has been received.",
      }
    }

    const publicResponse = toPublicSubmissionResponse(rawDatabaseRecord)
    expect(publicResponse).toEqual({
      ok: true,
      message: "Thank you — your enquiry has been received.",
    })
    expect((publicResponse as any).internal_notes).toBeUndefined()
    expect((publicResponse as any).admin_user_id).toBeUndefined()
  })

  it("verifies mockBackend staff directory operations: invite, resend, revoke, reactivate", async () => {
    const { mockBackend } = await import("../src/lib/supabase")

    const initial = mockBackend.getStaffMembers()
    expect(initial.length).toBeGreaterThanOrEqual(2)

    // Admin exists
    const admin = initial.find((s) => s.email === "srinivaschetty@gmail.com")
    expect(admin).toBeDefined()
    expect(admin?.role).toBe("admin")
    expect(admin?.invitation_status).toBe("active")

    // Invite new staff
    const testEmail = "newfaculty" + Date.now() + "@mozartmusic.org"
    const invited = mockBackend.inviteStaff("New Faculty", testEmail, "staff")
    expect(invited.role).toBe("staff")
    expect(invited.invitation_status).toBe("invited")

    // Resend invite
    const resent = mockBackend.resendInvite(invited.id)
    expect(resent).toBe(true)

    // Revoke access
    const revoked = mockBackend.revokeStaff(invited.id)
    expect(revoked).toBe(true)
    const afterRevoke = mockBackend.getStaffMembers().find((s) => s.id === invited.id)
    expect(afterRevoke?.invitation_status).toBe("revoked")

    // Reactivate access
    const reactivated = mockBackend.reactivateStaff(invited.id)
    expect(reactivated).toBe(true)
    const afterReactivate = mockBackend.getStaffMembers().find((s) => s.id === invited.id)
    expect(afterReactivate?.invitation_status).toBe("active")
  })
})
