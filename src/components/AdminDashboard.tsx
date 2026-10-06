import { useEffect, useState, useMemo } from "react"
import { Enquiry, EnquiryStatus, EnquiryType, InstrumentType, StaffMember, StaffRole } from "../lib/types"
import { supabase, isLiveSupabaseConfigured, mockBackend } from "../lib/supabase"
import { exportEnquiriesToCsv, downloadCsvFile } from "../lib/csv"

export default function AdminDashboard({ onExit }: { onExit: () => void }) {
  // Auth state
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; role: StaffRole; name: string } | null>(null)
  const [authEmail, setAuthEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [passwordResetSent, setPasswordResetSent] = useState(false)

  // Navigation tab: 'enquiries' or 'staff'
  const [currentTab, setCurrentTab] = useState<"enquiries" | "staff">("enquiries")

  // Enquiries & management state
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  // Filters & Search for Enquiries
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterInstrument, setFilterInstrument] = useState<string>("all")

  // Note authoring state
  const [newNoteText, setNewNoteText] = useState("")
  const [isSubmittingNote, setIsSubmittingNote] = useState(false)

  // Deletion confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Staff Management state
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteName, setInviteName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<StaffRole>("staff")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null)

  // Check auth session on mount
  useEffect(() => {
    async function checkSession() {
      if (isLiveSupabaseConfigured && supabase) {
        const { data } = await supabase.auth.getSession()
        if (data?.session?.user) {
          const userEmail = data.session.user.email || "srinivaschetty@gmail.com"
          // Check staff_members table
          const { data: staffData } = await supabase
            .from("staff_members")
            .select("role, name, invitation_status")
            .eq("email", userEmail)
            .single()

          if (staffData && staffData.invitation_status !== "revoked") {
            setCurrentUser({
              id: data.session.user.id,
              email: userEmail,
              role: staffData.role as StaffRole,
              name: staffData.name || userEmail.split("@")[0],
            })
          } else {
            // Check fallback in admin_users
            const { data: adminRecord } = await supabase
              .from("admin_users")
              .select("user_id")
              .eq("user_id", data.session.user.id)
              .single()

            if (adminRecord) {
              setCurrentUser({
                id: data.session.user.id,
                email: userEmail,
                role: "admin",
                name: "Administrator",
              })
            }
          }
        }
      } else {
        const mockUser = mockBackend.getMockUser()
        if (mockUser) {
          setCurrentUser(mockUser)
        }
      }
    }
    checkSession()
  }, [])

  // Load enquiries
  const fetchEnquiries = async () => {
    if (!currentUser) return
    setLoadingData(true)
    try {
      if (isLiveSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from("enquiries")
          .select("*, enquiry_notes(*), notification_jobs(*)")
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Failed to load enquiries:", error)
          setActionMessage("Error fetching enquiries. Ensure your account is authorized.")
        } else if (data) {
          const mapped: Enquiry[] = data.map((item: any) => ({
            ...item,
            notes: item.enquiry_notes || [],
            notification_jobs: item.notification_jobs || [],
          }))
          setEnquiries(mapped)
          if (selectedEnquiry) {
            const updated = mapped.find((e) => e.id === selectedEnquiry.id)
            if (updated) setSelectedEnquiry(updated)
          }
        }
      } else {
        const items = mockBackend.getEnquiries()
        setEnquiries(items)
        if (selectedEnquiry) {
          const updated = items.find((e) => e.id === selectedEnquiry.id)
          if (updated) setSelectedEnquiry(updated)
        }
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoadingData(false)
    }
  }

  // Load staff
  const fetchStaff = async () => {
    if (!currentUser) return
    setLoadingStaff(true)
    try {
      if (isLiveSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from("staff_members")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Failed to load staff members:", error)
        } else if (data) {
          setStaffMembers(data)
        }
      } else {
        const list = mockBackend.getStaffMembers()
        setStaffMembers(list)
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoadingStaff(false)
    }
  }

  useEffect(() => {
    if (currentUser) {
      fetchEnquiries()
      fetchStaff()
    }
  }, [currentUser])

  // Sign In handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError(null)

    try {
      if (isLiveSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        })

        if (error) {
          setAuthError(error.message)
        } else if (data.user) {
          const email = data.user.email || authEmail
          const { data: staffRecord } = await supabase
            .from("staff_members")
            .select("role, name, invitation_status")
            .eq("email", email.toLowerCase())
            .single()

          if (staffRecord) {
            if (staffRecord.invitation_status === "revoked") {
              await supabase.auth.signOut()
              setAuthError("Access revoked: This account is no longer authorized.")
              return
            }
            setCurrentUser({
              id: data.user.id,
              email,
              role: staffRecord.role as StaffRole,
              name: staffRecord.name || email.split("@")[0],
            })
          } else {
            // Check admin_users fallback
            const { data: adminRecord } = await supabase
              .from("admin_users")
              .select("user_id")
              .eq("user_id", data.user.id)
              .single()

            if (!adminRecord) {
              await supabase.auth.signOut()
              setAuthError("Access denied: Your account is not in the authorized staff directory.")
            } else {
              setCurrentUser({
                id: data.user.id,
                email,
                role: "admin",
                name: "Administrator",
              })
            }
          }
        }
      } else {
        // Preview mode mock authentication
        if (authPassword.length < 4) {
          setAuthError("Please enter a password with at least 4 characters.")
        } else {
          const normalizedEmail = authEmail.trim().toLowerCase()
          const staffList = mockBackend.getStaffMembers()
          const matched = staffList.find((s) => s.email.toLowerCase() === normalizedEmail)

          if (matched && matched.invitation_status === "revoked") {
            setAuthError("Access revoked: This account is no longer authorized.")
            return
          }

          const role: StaffRole = matched ? matched.role : normalizedEmail.includes("staff") ? "staff" : "admin"
          const name = matched ? matched.name : role === "admin" ? "Srinivas Chetty (Admin)" : "Staff Member"

          const mockUser = {
            id: matched?.id || (role === "admin" ? "user-admin" : "user-staff"),
            email: normalizedEmail || "srinivaschetty@gmail.com",
            role,
            name,
          }
          mockBackend.setMockUser(mockUser)
          setCurrentUser(mockUser)
        }
      }
    } catch (err: any) {
      setAuthError(err.message || "An unexpected error occurred.")
    } finally {
      setAuthLoading(false)
    }
  }

  // Quick switch for Preview mode
  const handleQuickLogin = (email: string, role: StaffRole, name: string) => {
    const mockUser = {
      id: role === "admin" ? "staff-01" : "staff-02",
      email,
      role,
      name,
    }
    mockBackend.setMockUser(mockUser)
    setCurrentUser(mockUser)
    setAuthError(null)
  }

  // Password Recovery handler
  const handlePasswordReset = async () => {
    if (!authEmail) {
      setAuthError("Please enter your staff email above to request a reset link.")
      return
    }
    setAuthLoading(true)
    try {
      if (isLiveSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(authEmail)
        if (error) {
          setAuthError(error.message)
        } else {
          setPasswordResetSent(true)
        }
      } else {
        setPasswordResetSent(true)
      }
    } finally {
      setAuthLoading(false)
    }
  }

  // Sign out handler
  const handleSignOut = async () => {
    if (isLiveSupabaseConfigured && supabase) {
      await supabase.auth.signOut()
    } else {
      mockBackend.setMockUser(null)
    }
    setCurrentUser(null)
    setSelectedEnquiry(null)
  }

  // Update Enquiry Status handler
  const handleStatusChange = async (enquiryId: string, newStatus: EnquiryStatus) => {
    if (isLiveSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from("enquiries")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", enquiryId)

      if (error) {
        setActionMessage("Failed to update status: " + error.message)
      } else {
        fetchEnquiries()
      }
    } else {
      mockBackend.updateStatus(enquiryId, newStatus)
      fetchEnquiries()
    }
  }

  // Add Note handler
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEnquiry || !newNoteText.trim() || !currentUser) return

    setIsSubmittingNote(true)
    try {
      if (isLiveSupabaseConfigured && supabase) {
        const { error } = await supabase.from("enquiry_notes").insert({
          enquiry_id: selectedEnquiry.id,
          admin_user_id: currentUser.id,
          admin_email: currentUser.email,
          note: newNoteText.trim(),
        })

        if (error) {
          setActionMessage("Error saving note: " + error.message)
        } else {
          setNewNoteText("")
          fetchEnquiries()
        }
      } else {
        mockBackend.addNote(selectedEnquiry.id, newNoteText.trim(), currentUser.email)
        setNewNoteText("")
        fetchEnquiries()
      }
    } finally {
      setIsSubmittingNote(false)
    }
  }

  // Delete Enquiry handler
  const handleDeleteEnquiry = async (id: string) => {
    if (isLiveSupabaseConfigured && supabase) {
      const { error } = await supabase.from("enquiries").delete().eq("id", id)
      if (error) {
        setActionMessage("Failed to delete record: " + error.message)
      } else {
        setDeleteConfirmId(null)
        if (selectedEnquiry?.id === id) setSelectedEnquiry(null)
        fetchEnquiries()
      }
    } else {
      mockBackend.deleteEnquiry(id)
      setDeleteConfirmId(null)
      if (selectedEnquiry?.id === id) setSelectedEnquiry(null)
      fetchEnquiries()
    }
  }

  // Retry notification handler
  const handleRetryNotification = async (jobId: string) => {
    if (isLiveSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from("notification_jobs")
        .update({
          status: "pending",
          attempts: 0,
          next_attempt_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", jobId)

      if (error) {
        setActionMessage("Failed to queue retry: " + error.message)
      } else {
        setActionMessage("Notification re-queued for delivery.")
        fetchEnquiries()
      }
    } else {
      mockBackend.retryNotification(jobId)
      setActionMessage("Mock notification re-sent successfully.")
      fetchEnquiries()
    }
  }

  // -------------------------------------------------------------
  // Staff Management Actions (Admin Only)
  // -------------------------------------------------------------
  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || currentUser.role !== "admin") {
      setInviteError("Unauthorized: Only administrators can invite new staff members.")
      return
    }

    if (!inviteName.trim()) {
      setInviteError("Please provide the staff member's full name.")
      return
    }

    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      setInviteError("Please provide a valid email address.")
      return
    }

    setInviteLoading(true)
    setInviteError(null)
    setInviteSuccess(null)

    try {
      if (isLiveSupabaseConfigured && supabase) {
        const { error } = await supabase.from("staff_members").insert({
          name: inviteName.trim(),
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          invitation_status: "invited",
        })

        if (error) {
          setInviteError(error.message)
        } else {
          setInviteSuccess(`Invitation successfully dispatched to ${inviteEmail.trim().toLowerCase()}.`)
          setInviteName("")
          setInviteEmail("")
          setShowInviteForm(false)
          fetchStaff()
        }
      } else {
        mockBackend.inviteStaff(inviteName, inviteEmail, inviteRole)
        setInviteSuccess(`Invitation successfully sent to ${inviteEmail.trim().toLowerCase()}.`)
        setInviteName("")
        setInviteEmail("")
        setShowInviteForm(false)
        fetchStaff()
      }
    } catch (err: any) {
      setInviteError(err.message || "Failed to invite staff member.")
    } finally {
      setInviteLoading(false)
    }
  }

  const handleResendInvite = async (id: string, email: string) => {
    if (!currentUser || currentUser.role !== "admin") return
    try {
      if (isLiveSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("staff_members")
          .update({ invited_at: new Date().toISOString() })
          .eq("id", id)

        if (error) {
          setActionMessage("Failed to resend invitation: " + error.message)
        } else {
          setActionMessage(`Invitation resent to ${email}.`)
          fetchStaff()
        }
      } else {
        mockBackend.resendInvite(id)
        setActionMessage(`Invitation resent to ${email}.`)
        fetchStaff()
      }
    } catch (err: any) {
      setActionMessage("Error: " + err.message)
    }
  }

  const handleRevokeStaff = async (id: string, email: string) => {
    if (!currentUser || currentUser.role !== "admin") return
    try {
      if (isLiveSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("staff_members")
          .update({ invitation_status: "revoked" })
          .eq("id", id)

        if (error) {
          setActionMessage("Failed to revoke staff access: " + error.message)
        } else {
          setActionMessage(`Access revoked for ${email}.`)
          setRevokeConfirmId(null)
          fetchStaff()
        }
      } else {
        mockBackend.revokeStaff(id)
        setActionMessage(`Access revoked for ${email}.`)
        setRevokeConfirmId(null)
        fetchStaff()
      }
    } catch (err: any) {
      setActionMessage("Error: " + err.message)
    }
  }

  const handleReactivateStaff = async (id: string, email: string) => {
    if (!currentUser || currentUser.role !== "admin") return
    try {
      if (isLiveSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("staff_members")
          .update({ invitation_status: "active" })
          .eq("id", id)

        if (error) {
          setActionMessage("Failed to restore access: " + error.message)
        } else {
          setActionMessage(`Access restored for ${email}.`)
          fetchStaff()
        }
      } else {
        mockBackend.reactivateStaff(id)
        setActionMessage(`Access restored for ${email}.`)
        fetchStaff()
      }
    } catch (err: any) {
      setActionMessage("Error: " + err.message)
    }
  }

  // Filtered and searched enquiries
  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((item) => {
      if (filterType !== "all" && item.type !== filterType) return false
      if (filterStatus !== "all" && item.status !== filterStatus) return false
      if (filterInstrument !== "all" && item.instrument !== filterInstrument) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = item.contact_name?.toLowerCase().includes(q)
        const matchesEmail = item.email?.toLowerCase().includes(q)
        const matchesPhone = item.phone?.toLowerCase().includes(q)
        const matchesMsg = item.message?.toLowerCase().includes(q)
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesMsg) return false
      }

      return true
    })
  }, [enquiries, filterType, filterStatus, filterInstrument, searchQuery])

  // CSV Export handler
  const handleExportCsv = () => {
    const csvContent = exportEnquiriesToCsv(filteredEnquiries)
    downloadCsvFile(csvContent, `mozart-school-enquiries-${new Date().toISOString().split("T")[0]}.csv`)
  }

  // -------------------------------------------------------------
  // VIEW: Login Screen
  // -------------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-white text-black flex flex-col justify-center items-center p-6 selection:bg-black selection:text-white">
        <div className="w-full max-w-md border border-black p-8 sm:p-10 shadow-lg">
          <div className="text-center mb-8">
            <span className="inline-block text-3xl font-serif mb-1">M</span>
            <p className="text-[10px] tracking-[0.25em] font-semibold text-neutral-500 uppercase">
              Mozart School Of Western Classical Music
            </p>
            <h1 className="text-2xl font-serif font-medium mt-2">
              Staff Administration
            </h1>
            <p className="text-xs text-neutral-600 mt-1">
              Invite-only portal for school staff and enquiry management.
            </p>
            {!isLiveSupabaseConfigured && (
              <div className="mt-4 p-3 bg-neutral-100 border border-black/20 text-[11px] text-neutral-700 text-left space-y-2">
                <p className="font-semibold text-black">Preview Mode Credentials:</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin("srinivaschetty@gmail.com", "admin", "Srinivas Chetty")}
                    className="flex-1 py-1.5 px-2 bg-black text-white text-[10px] uppercase tracking-wider font-medium hover:bg-neutral-800 transition"
                  >
                    Login as Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin("radhika@mozartmusic.org", "staff", "Radhika K.")}
                    className="flex-1 py-1.5 px-2 border border-black text-black text-[10px] uppercase tracking-wider font-medium hover:bg-neutral-100 transition"
                  >
                    Login as Staff
                  </button>
                </div>
                <p className="text-[10px] text-neutral-500">
                  Or enter any staff email with 4+ character password below.
                </p>
              </div>
            )}
          </div>

          {authError && (
            <div className="mb-6 p-3 bg-neutral-100 border-l-2 border-black text-xs text-black">
              {authError}
            </div>
          )}

          {passwordResetSent ? (
            <div className="mb-6 p-4 bg-neutral-100 text-xs text-neutral-800 space-y-2 border border-black/20">
              <p className="font-semibold text-black">Password reset requested</p>
              <p>If an approved staff account exists for {authEmail}, a secure password reset link has been dispatched.</p>
              <button
                type="button"
                onClick={() => setPasswordResetSent(false)}
                className="text-[11px] font-semibold underline mt-2 block"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1">
                  Staff Email
                </label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="srinivaschetty@gmail.com"
                  className="w-full border border-black/30 p-2 text-xs focus:outline-hidden focus:border-black"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    className="text-[10px] text-neutral-500 hover:text-black underline"
                  >
                    Forgot?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-black/30 p-2 text-xs focus:outline-hidden focus:border-black"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition disabled:opacity-50"
                >
                  {authLoading ? "Authenticating..." : "Sign In to Dashboard"}
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 pt-4 border-t border-black/15 text-center">
            <button
              type="button"
              onClick={onExit}
              className="text-xs text-neutral-600 hover:text-black hover:underline"
            >
              ← Return to public website
            </button>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // VIEW: Main Authenticated Dashboard
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-white text-black font-sans flex flex-col">
      {/* Top Header */}
      <header className="border-b border-black px-6 py-4 flex flex-wrap justify-between items-center gap-4 bg-white sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <span className="font-serif text-2xl font-semibold">M</span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-wide uppercase">
                Mozart School Administration
              </h1>
              <span className={`px-2 py-0.5 text-[9px] uppercase tracking-wider font-semibold ${
                currentUser.role === "admin"
                  ? "bg-black text-white"
                  : "border border-black text-black"
              }`}>
                {currentUser.role === "admin" ? "Admin" : "Staff"}
              </span>
            </div>
            <p className="text-[11px] text-neutral-600 mt-0.5">
              Logged in as <span className="font-medium text-black">{currentUser.email}</span>
              {" "}·{" "}
              <span className="inline-block px-1.5 py-0.2 border border-black/30 text-[9px] uppercase tracking-wider">
                {isLiveSupabaseConfigured ? "Live Supabase" : "Mock Storage"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentTab === "enquiries" && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 border border-black text-xs font-medium hover:bg-neutral-100 transition flex items-center gap-1.5"
              title="Export filtered records safe from formula injection"
            >
              <span>↓</span> Export Safe CSV
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            className="px-3 py-1.5 border border-black/30 text-xs font-medium hover:bg-neutral-100 transition"
          >
            Public Site
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-3 py-1.5 bg-black text-white text-xs font-medium hover:bg-neutral-800 transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex border-b border-black bg-white px-6">
        <button
          type="button"
          onClick={() => setCurrentTab("enquiries")}
          className={`py-3 px-5 text-xs font-semibold uppercase tracking-wider border-b-2 transition -mb-px flex items-center gap-2 ${
            currentTab === "enquiries"
              ? "border-black text-black"
              : "border-transparent text-neutral-500 hover:text-black"
          }`}
        >
          <span>Enquiries</span>
          <span className="px-1.5 py-0.2 bg-neutral-100 text-black text-[10px] border border-black/20">
            {enquiries.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab("staff")}
          className={`py-3 px-5 text-xs font-semibold uppercase tracking-wider border-b-2 transition -mb-px flex items-center gap-2 ${
            currentTab === "staff"
              ? "border-black text-black"
              : "border-transparent text-neutral-500 hover:text-black"
          }`}
        >
          <span>Staff Management</span>
          <span className="px-1.5 py-0.2 bg-neutral-100 text-black text-[10px] border border-black/20">
            {staffMembers.length}
          </span>
          {currentUser.role !== "admin" && (
            <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-normal">
              (Admin Only)
            </span>
          )}
        </button>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="bg-neutral-100 border-b border-black/20 px-6 py-2 text-xs flex justify-between items-center">
          <span>{actionMessage}</span>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-neutral-500 hover:text-black font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: ENQUIRIES VIEW */}
      {/* ------------------------------------------------------------- */}
      {currentTab === "enquiries" && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Column: Filter Controls and List */}
          <div className="w-full lg:w-5/12 xl:w-4/12 border-r border-black/20 flex flex-col h-auto lg:h-[calc(100vh-117px)] bg-neutral-50/50">
            {/* Search & Filter Toolbar */}
            <div className="p-4 border-b border-black/15 bg-white space-y-3">
              <div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, phone, or message..."
                  className="w-full border border-black/30 p-2 text-xs focus:outline-hidden focus:border-black"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-neutral-500 mb-0.5">Type</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full border border-black/30 p-1.5 text-xs bg-white focus:outline-hidden"
                  >
                    <option value="all">All Types</option>
                    <option value="lesson">Lesson</option>
                    <option value="location_interest">Location</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-semibold text-neutral-500 mb-0.5">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full border border-black/30 p-1.5 text-xs bg-white focus:outline-hidden"
                  >
                    <option value="all">All Statuses</option>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="awaiting_reply">Awaiting Reply</option>
                    <option value="enrolled">Enrolled</option>
                    <option value="closed">Closed</option>
                    <option value="spam">Spam</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-semibold text-neutral-500 mb-0.5">Instrument</label>
                  <select
                    value={filterInstrument}
                    onChange={(e) => setFilterInstrument(e.target.value)}
                    className="w-full border border-black/30 p-1.5 text-xs bg-white focus:outline-hidden"
                  >
                    <option value="all">All</option>
                    <option value="piano">Piano</option>
                    <option value="keyboard">Keyboard</option>
                    <option value="violin">Violin</option>
                    <option value="unsure">Unsure</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] text-neutral-500 pt-1">
                <span>Showing {filteredEnquiries.length} of {enquiries.length} enquiries</span>
                {loadingData && <span>Refreshing...</span>}
              </div>
            </div>

            {/* Enquiry List */}
            <div className="flex-1 overflow-y-auto divide-y divide-black/10">
              {filteredEnquiries.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500">
                  No matching enquiries found.
                </div>
              ) : (
                filteredEnquiries.map((item) => {
                  const isSelected = selectedEnquiry?.id === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedEnquiry(item)}
                      className={`w-full text-left p-4 transition flex flex-col gap-1.5 ${
                        isSelected
                          ? "bg-black text-white"
                          : "hover:bg-neutral-100 text-black bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`font-semibold ${isSelected ? "text-white" : "text-black"}`}>
                          {item.contact_name}
                        </span>
                        <span className={`text-[10px] ${isSelected ? "text-neutral-300" : "text-neutral-500"}`}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
                        <span
                          className={`px-1.5 py-0.5 font-medium uppercase tracking-wider ${
                            item.status === "new"
                              ? isSelected ? "bg-white text-black" : "bg-black text-white"
                              : isSelected ? "border border-neutral-400 text-neutral-200" : "border border-black/30 text-neutral-700"
                          }`}
                        >
                          {item.status}
                        </span>

                        <span className={`capitalize ${isSelected ? "text-neutral-300" : "text-neutral-600"}`}>
                          {item.type.replace("_", " ")}
                        </span>

                        {item.instrument && (
                          <span className={`capitalize ${isSelected ? "text-neutral-300" : "text-neutral-600"}`}>
                            · {item.instrument}
                          </span>
                        )}

                        {item.class_preference && (
                          <span className={`capitalize px-1 py-0.2 border text-[9px] ${
                            isSelected ? "border-neutral-400 text-neutral-200" : "border-black/30 text-neutral-700"
                          }`}>
                            {item.class_preference.replace("_", " ")}
                          </span>
                        )}
                      </div>

                      {item.message && (
                        <p className={`text-[11px] line-clamp-1 mt-0.5 ${isSelected ? "text-neutral-300" : "text-neutral-500"}`}>
                          {item.message}
                        </p>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed View */}
          <div className="flex-1 h-auto lg:h-[calc(100vh-117px)] overflow-y-auto p-6 lg:p-8 bg-white">
            {!selectedEnquiry ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-400">
                <span className="text-4xl font-serif mb-2">♪</span>
                <p className="text-sm font-serif">Select an enquiry to view details</p>
                <p className="text-xs text-neutral-500 max-w-sm mt-1">
                  Manage contact status, review musical preferences, author private staff notes, and inspect notification delivery outcomes.
                </p>
              </div>
            ) : (
              <div className="max-w-3xl space-y-8">
                {/* Header Info */}
                <div className="border-b border-black pb-6 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] tracking-wider uppercase font-semibold text-neutral-500 mb-1">
                      <span>Enquiry ID: {selectedEnquiry.id}</span>
                      <span>·</span>
                      <span>Source: {selectedEnquiry.source}</span>
                    </div>
                    <h2 className="text-2xl font-serif font-medium">
                      {selectedEnquiry.contact_name}
                    </h2>
                    <p className="text-xs text-neutral-600 mt-1">
                      Submitted on {new Date(selectedEnquiry.created_at).toLocaleString()}
                    </p>
                  </div>

                  {/* Status Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                      Status:
                    </span>
                    <select
                      value={selectedEnquiry.status}
                      onChange={(e) => handleStatusChange(selectedEnquiry.id, e.target.value as EnquiryStatus)}
                      className="border border-black p-1.5 text-xs font-semibold uppercase tracking-wider bg-white focus:outline-hidden"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="awaiting_reply">Awaiting Reply</option>
                      <option value="enrolled">Enrolled</option>
                      <option value="closed">Closed</option>
                      <option value="spam">Spam</option>
                    </select>
                  </div>
                </div>

                {/* Action Buttons: Click-to-call, click-to-email */}
                <div className="flex flex-wrap gap-3">
                  {selectedEnquiry.phone && (
                    <a
                      href={`tel:${selectedEnquiry.phone}`}
                      className="px-4 py-2 bg-black text-white text-xs font-semibold tracking-wider uppercase hover:bg-neutral-800 transition flex items-center gap-2"
                    >
                      <span>📞</span> Call {selectedEnquiry.phone}
                    </a>
                  )}
                  {selectedEnquiry.email && (
                    <a
                      href={`mailto:${selectedEnquiry.email}?subject=Mozart%20School%20Follow-up`}
                      className="px-4 py-2 border border-black text-xs font-semibold tracking-wider uppercase hover:bg-neutral-100 transition flex items-center gap-2"
                    >
                      <span>✉</span> Email {selectedEnquiry.email}
                    </a>
                  )}
                </div>

                {/* Main Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-neutral-50 p-6 border border-black/15 text-xs">
                  <div>
                    <span className="block text-[10px] uppercase font-semibold text-neutral-500 mb-0.5">
                      Contact Information
                    </span>
                    <p><strong>Name:</strong> {selectedEnquiry.contact_name}</p>
                    <p><strong>Email:</strong> {selectedEnquiry.email || "—"}</p>
                    <p><strong>Phone:</strong> {selectedEnquiry.phone || "—"}</p>
                    <p><strong>Preferred Contact:</strong> <span className="capitalize">{selectedEnquiry.preferred_contact || "Either"}</span></p>
                  </div>

                  <div>
                    <span className="block text-[10px] uppercase font-semibold text-neutral-500 mb-0.5">
                      Musical Request
                    </span>
                    <p><strong>Type:</strong> <span className="capitalize">{selectedEnquiry.type.replace("_", " ")}</span></p>
                    <p><strong>Instrument:</strong> <span className="capitalize">{selectedEnquiry.instrument || "—"}</span></p>
                    <p><strong>Learner Group:</strong> <span className="capitalize">{selectedEnquiry.learner_group || "—"}</span></p>
                    {selectedEnquiry.learner_name && (
                      <p><strong>Learner First Name:</strong> {selectedEnquiry.learner_name}</p>
                    )}
                    <p><strong>Experience:</strong> <span className="capitalize">{selectedEnquiry.experience?.replace("_", " ") || "—"}</span></p>
                    <p className="mt-1">
                      <strong>Class Preference:</strong>{" "}
                      <span className="capitalize font-medium">
                        {selectedEnquiry.class_preference
                          ? selectedEnquiry.class_preference.replace("_", " ")
                          : "Not specified"}
                      </span>
                    </p>
                    {selectedEnquiry.class_preference === "in_person" && (
                      <p className="mt-0.5 text-[10px] text-neutral-600 italic">
                        In-person classes are coming soon — A welcoming new space is on the way.
                      </p>
                    )}
                  </div>

                  {selectedEnquiry.preferred_times && (
                    <div className="sm:col-span-2">
                      <span className="block text-[10px] uppercase font-semibold text-neutral-500 mb-0.5">
                        Preferred Days / Times
                      </span>
                      <p className="italic text-neutral-800">{selectedEnquiry.preferred_times}</p>
                    </div>
                  )}

                  {selectedEnquiry.message && (
                    <div className="sm:col-span-2">
                      <span className="block text-[10px] uppercase font-semibold text-neutral-500 mb-0.5">
                        Visitor Note / Message
                      </span>
                      <p className="bg-white p-3 border border-black/15 text-neutral-800 whitespace-pre-line">
                        {selectedEnquiry.message}
                      </p>
                    </div>
                  )}

                  <div className="sm:col-span-2 pt-2 border-t border-black/10 flex flex-wrap gap-4 text-[11px] text-neutral-600">
                    <span><strong>Contact Consent:</strong> Granted ({new Date(selectedEnquiry.consented_at).toLocaleDateString()})</span>
                    <span><strong>Location Updates:</strong> {selectedEnquiry.location_updates ? "Opted In" : "Not requested"}</span>
                    <span><strong>Consent Version:</strong> {selectedEnquiry.consent_version}</span>
                  </div>
                </div>

                {/* Notification Jobs Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-black">
                    Transactional Notifications
                  </h3>
                  {selectedEnquiry.notification_jobs && selectedEnquiry.notification_jobs.length > 0 ? (
                    <div className="border border-black/15 divide-y divide-black/10 text-xs">
                      {selectedEnquiry.notification_jobs.map((job) => (
                        <div key={job.id} className="p-3 flex items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold capitalize">
                                {job.kind.replace("_", " ")}:
                              </span>
                              <span className="text-neutral-600">{job.recipient}</span>
                              <span
                                className={`px-1.5 py-0.2 text-[9px] uppercase font-bold tracking-wider ${
                                  job.status === "sent"
                                    ? "bg-black text-white"
                                    : job.status === "failed"
                                    ? "bg-neutral-200 text-black border border-black"
                                    : "bg-neutral-100 text-neutral-700"
                                }`}
                              >
                                {job.status}
                              </span>
                            </div>
                            {job.last_error && (
                              <p className="text-[11px] text-neutral-600 mt-0.5">
                                Error: {job.last_error}
                              </p>
                            )}
                            <p className="text-[10px] text-neutral-400 mt-0.5">
                              Attempts: {job.attempts} · Subject: "{job.subject}"
                            </p>
                          </div>

                          {job.status === "failed" && (
                            <button
                              type="button"
                              onClick={() => handleRetryNotification(job.id)}
                              className="px-2.5 py-1 border border-black text-[10px] font-semibold uppercase hover:bg-neutral-100 transition"
                            >
                              Retry Send
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500 italic">No notification records queued for this enquiry.</p>
                  )}
                </div>

                {/* Private Staff Notes */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-black">
                      Private Staff Notes
                    </h3>
                    <span className="text-[10px] text-neutral-500 italic">Staff access only · Never visible to visitors</span>
                  </div>

                  {/* Add new note form */}
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      rows={2}
                      required
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Record conversation outcome, trial date discussion, or teacher notes..."
                      className="w-full border border-black/30 p-2.5 text-xs text-black focus:outline-hidden focus:border-black resize-none"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmittingNote || !newNoteText.trim()}
                        className="px-4 py-1.5 bg-black text-white text-xs font-medium uppercase tracking-wider hover:bg-neutral-800 transition disabled:opacity-50"
                      >
                        {isSubmittingNote ? "Saving..." : "Add Private Note"}
                      </button>
                    </div>
                  </form>

                  {/* Notes List */}
                  <div className="space-y-2 pt-2">
                    {selectedEnquiry.notes && selectedEnquiry.notes.length > 0 ? (
                      selectedEnquiry.notes.map((note) => (
                        <div key={note.id} className="p-3 bg-neutral-100 border-l-2 border-black text-xs">
                          <div className="flex justify-between items-center text-[10px] text-neutral-500 mb-1">
                            <span className="font-semibold text-black">{note.admin_email || "Staff"}</span>
                            <span>{new Date(note.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-neutral-800 whitespace-pre-line">{note.note}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-neutral-500 italic">No notes recorded yet for this enquiry.</p>
                    )}
                  </div>
                </div>

                {/* Controlled Deletion Controls (GDPR / Privacy) */}
                <div className="pt-8 border-t border-black/15 flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-black">
                      Data Retention & Erasure
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      Permanently delete this enquiry and associated notes upon visitor request.
                    </p>
                  </div>

                  {deleteConfirmId === selectedEnquiry.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteEnquiry(selectedEnquiry.id)}
                        className="px-3 py-1.5 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition"
                      >
                        Confirm Erase
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-3 py-1.5 border border-black/30 text-xs hover:bg-neutral-100 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(selectedEnquiry.id)}
                      className="px-3 py-1.5 border border-black/40 text-xs text-neutral-700 hover:text-black hover:border-black transition"
                    >
                      Delete Record
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: STAFF MANAGEMENT VIEW */}
      {/* ------------------------------------------------------------- */}
      {currentTab === "staff" && (
        <div className="flex-1 p-6 lg:p-10 max-w-6xl mx-auto w-full">
          {currentUser.role !== "admin" ? (
            /* Staff role: Access denied notice */
            <div className="max-w-xl mx-auto py-16 text-center space-y-4">
              <span className="text-3xl font-serif">M</span>
              <h2 className="text-xl font-serif font-medium">Administrator Access Required</h2>
              <p className="text-xs text-neutral-600 leading-relaxed">
                You are currently signed in as <span className="font-semibold text-black">{currentUser.email}</span> with standard <strong>Staff</strong> permissions. Staff members can view and manage all student enquiries and private notes, but cannot invite, modify, or revoke staff accounts.
              </p>
              <div className="p-3 bg-neutral-100 border border-black/20 text-[11px] text-neutral-700 max-w-md mx-auto text-left">
                <strong>Need access changes?</strong> Contact authorized administrator Srinivas Chetty (<a href="mailto:srinivaschetty@gmail.com" className="underline font-medium">srinivaschetty@gmail.com</a>) to update team accounts.
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentTab("enquiries")}
                  className="px-5 py-2 bg-black text-white text-xs font-medium uppercase tracking-wider hover:bg-neutral-800 transition"
                >
                  Return to Enquiries
                </button>
              </div>
            </div>
          ) : (
            /* Admin role: Full Staff Management UI */
            <div className="space-y-8">
              {/* Header and Scope Statement */}
              <div className="border-b border-black pb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] tracking-[0.2em] font-semibold text-neutral-500 uppercase">
                    Access Control & Directory
                  </p>
                  <h2 className="text-2xl font-serif font-medium mt-1">
                    School Staff Management
                  </h2>
                  <p className="text-xs text-neutral-600 mt-1 max-w-2xl">
                    Invite-only directory for school staff access only. Administrators can invite faculty by email, resend invitations, and revoke access.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowInviteForm(!showInviteForm)
                    setInviteError(null)
                    setInviteSuccess(null)
                  }}
                  className="px-4 py-2 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition flex items-center gap-2"
                >
                  <span>{showInviteForm ? "✕ Close Form" : "+ Invite Staff Member"}</span>
                </button>
              </div>

              {/* Strict Non-Scope Clarification Banner */}
              <div className="p-3 bg-neutral-50 border border-black/15 text-[11px] text-neutral-700 flex items-start gap-2.5">
                <span className="font-bold text-black">Notice:</span>
                <span>
                  This page is strictly for managing school staff access only. It does not handle students, payments, fees, attendance, lesson schedules, or bookings.
                </span>
              </div>

              {/* Success / Error notification for invitations */}
              {inviteSuccess && (
                <div className="p-3 bg-neutral-100 border-l-2 border-black text-xs text-black flex justify-between items-center">
                  <span>{inviteSuccess}</span>
                  <button
                    type="button"
                    onClick={() => setInviteSuccess(null)}
                    className="text-neutral-500 hover:text-black font-bold ml-4"
                  >
                    ✕
                  </button>
                </div>
              )}

              {inviteError && (
                <div className="p-3 bg-neutral-100 border-l-2 border-black text-xs text-black flex justify-between items-center">
                  <span>{inviteError}</span>
                  <button
                    type="button"
                    onClick={() => setInviteError(null)}
                    className="text-neutral-500 hover:text-black font-bold ml-4"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Invite Form Drawer */}
              {showInviteForm && (
                <div className="border border-black p-6 bg-white shadow-sm space-y-4">
                  <div className="border-b border-black/15 pb-2 flex justify-between items-center">
                    <h3 className="text-xs font-semibold uppercase tracking-wider">
                      Invite a New School Staff Member
                    </h3>
                    <span className="text-[10px] text-neutral-500">Email Invitation Flow</span>
                  </div>

                  <form onSubmit={handleInviteStaff} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                          placeholder="e.g. Radhika K."
                          className="w-full border border-black/30 p-2 text-xs focus:outline-hidden focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1">
                          Staff Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="e.g. radhika@mozartmusic.org"
                          className="w-full border border-black/30 p-2 text-xs focus:outline-hidden focus:border-black"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5">
                        Assigned Role *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label
                          className={`p-3 border cursor-pointer transition flex flex-col gap-1 ${
                            inviteRole === "staff"
                              ? "border-black bg-neutral-50"
                              : "border-black/20 hover:border-black/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="invite_role"
                              checked={inviteRole === "staff"}
                              onChange={() => setInviteRole("staff")}
                              className="accent-black"
                            />
                            <span className="font-semibold text-black uppercase tracking-wider text-[11px]">Staff Role</span>
                          </div>
                          <p className="text-[10px] text-neutral-600 pl-5">
                            Can view enquiries, update status, and add private staff notes. Cannot manage other staff accounts.
                          </p>
                        </label>

                        <label
                          className={`p-3 border cursor-pointer transition flex flex-col gap-1 ${
                            inviteRole === "admin"
                              ? "border-black bg-neutral-50"
                              : "border-black/20 hover:border-black/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="invite_role"
                              checked={inviteRole === "admin"}
                              onChange={() => setInviteRole("admin")}
                              className="accent-black"
                            />
                            <span className="font-semibold text-black uppercase tracking-wider text-[11px]">Admin Role</span>
                          </div>
                          <p className="text-[10px] text-neutral-600 pl-5">
                            Full privileges: Can manage enquiries and invite, resend, or revoke staff access.
                          </p>
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-black/15">
                      <button
                        type="button"
                        onClick={() => setShowInviteForm(false)}
                        className="px-4 py-2 border border-black/30 text-xs font-medium hover:bg-neutral-100 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={inviteLoading}
                        className="px-6 py-2 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition disabled:opacity-50"
                      >
                        {inviteLoading ? "Sending Invitation..." : "Send Staff Invitation"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Staff Table */}
              <div className="border border-black overflow-hidden">
                <div className="p-4 bg-neutral-50 border-b border-black flex justify-between items-center text-xs">
                  <div>
                    <h3 className="font-semibold uppercase tracking-wider text-black">
                      Staff Directory ({staffMembers.length})
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Authorised team members with dashboard access.
                    </p>
                  </div>
                  {loadingStaff && <span className="text-[11px] text-neutral-500">Refreshing...</span>}
                </div>

                {loadingStaff && staffMembers.length === 0 ? (
                  <div className="p-12 text-center text-xs text-neutral-500">
                    Loading staff directory...
                  </div>
                ) : staffMembers.length === 0 ? (
                  <div className="p-12 text-center text-xs text-neutral-500">
                    No staff members found. Click "+ Invite Staff Member" to add faculty.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-black/20 bg-white text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">
                          <th className="p-3.5 pl-4">Staff Name</th>
                          <th className="p-3.5">Email Address</th>
                          <th className="p-3.5">Role</th>
                          <th className="p-3.5">Invitation Status</th>
                          <th className="p-3.5">Date Added</th>
                          <th className="p-3.5 pr-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/10 bg-white">
                        {staffMembers.map((staff) => {
                          const isSelf = staff.email.toLowerCase() === currentUser.email.toLowerCase()
                          return (
                            <tr key={staff.id} className="hover:bg-neutral-50/70 transition">
                              <td className="p-3.5 pl-4 font-semibold text-black">
                                <div className="flex items-center gap-2">
                                  <span>{staff.name}</span>
                                  {isSelf && (
                                    <span className="text-[9px] uppercase px-1 py-0.2 bg-neutral-200 text-black border border-black/20">
                                      You
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3.5 text-neutral-700">
                                {staff.email}
                              </td>
                              <td className="p-3.5">
                                <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold ${
                                  staff.role === "admin"
                                    ? "bg-black text-white"
                                    : "border border-black text-black"
                                }`}>
                                  {staff.role === "admin" ? "Admin" : "Staff"}
                                </span>
                              </td>
                              <td className="p-3.5">
                                <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium ${
                                  staff.invitation_status === "active"
                                    ? "bg-black text-white"
                                    : staff.invitation_status === "invited"
                                    ? "border border-black/40 text-neutral-700 bg-neutral-100"
                                    : "border border-black/20 text-neutral-400 line-through"
                                }`}>
                                  {staff.invitation_status}
                                </span>
                              </td>
                              <td className="p-3.5 text-neutral-600 text-[11px]">
                                {new Date(staff.created_at).toLocaleDateString()}
                              </td>
                              <td className="p-3.5 pr-4 text-right space-x-2">
                                {staff.invitation_status === "invited" && (
                                  <button
                                    type="button"
                                    onClick={() => handleResendInvite(staff.id, staff.email)}
                                    className="px-2.5 py-1 border border-black text-[10px] uppercase font-semibold hover:bg-neutral-100 transition"
                                  >
                                    Resend Invite
                                  </button>
                                )}

                                {staff.invitation_status === "active" && !isSelf && (
                                  revokeConfirmId === staff.id ? (
                                    <span className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleRevokeStaff(staff.id, staff.email)}
                                        className="px-2 py-1 bg-black text-white text-[10px] uppercase font-semibold hover:bg-neutral-800 transition"
                                      >
                                        Confirm Revoke
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setRevokeConfirmId(null)}
                                        className="px-2 py-1 border border-black/30 text-[10px] hover:bg-neutral-100 transition"
                                      >
                                        Cancel
                                      </button>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setRevokeConfirmId(staff.id)}
                                      className="px-2.5 py-1 border border-black/40 text-[10px] uppercase font-medium hover:border-black hover:text-black transition"
                                    >
                                      Revoke Access
                                    </button>
                                  )
                                )}

                                {staff.invitation_status === "revoked" && !isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => handleReactivateStaff(staff.id, staff.email)}
                                    className="px-2.5 py-1 border border-black text-[10px] uppercase font-semibold hover:bg-neutral-100 transition"
                                  >
                                    Reactivate
                                  </button>
                                )}

                                {isSelf && (
                                  <span className="text-[10px] text-neutral-400 italic">Current Session</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
