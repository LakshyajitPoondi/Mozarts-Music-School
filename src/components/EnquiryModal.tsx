import { useEffect, useState } from "react"
import { EnquiryType, InstrumentType, LearnerGroupType, ExperienceLevelType, ClassPreference } from "../lib/types"
import { submitEnquiry } from "../lib/api"

interface EnquiryModalProps {
  isOpen: boolean
  onClose: () => void
  initialType?: EnquiryType
  initialInstrument?: InstrumentType
  source?: string
}

export default function EnquiryModal({
  isOpen,
  onClose,
  initialType = "lesson",
  initialInstrument,
  source = "website",
}: EnquiryModalProps) {
  const [type, setType] = useState<EnquiryType>(initialType)
  const [instrument, setInstrument] = useState<InstrumentType>(initialInstrument || "piano")
  const [learnerGroup, setLearnerGroup] = useState<LearnerGroupType>("child")
  const [learnerName, setLearnerName] = useState("")
  const [experience, setExperience] = useState<ExperienceLevelType>("beginner")
  const [classPreference, setClassPreference] = useState<ClassPreference>("online")
  const [contactName, setContactName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [preferredContact, setPreferredContact] = useState<"email" | "phone" | "either">("either")
  const [preferredTimes, setPreferredTimes] = useState("")
  const [message, setMessage] = useState("")
  const [contactConsent, setContactConsent] = useState(false)
  const [locationUpdates, setLocationUpdates] = useState(false)
  const [honeypot, setHoneypot] = useState("")

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Sync state when props change
  useEffect(() => {
    if (isOpen) {
      setType(initialType)
      if (initialInstrument) {
        setInstrument(initialInstrument)
      }
      setErrorMsg(null)
      setSuccessMsg(null)
    }
  }, [isOpen, initialType, initialInstrument])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!contactName.trim()) {
      setErrorMsg("Please enter your name.")
      return
    }

    if (!email.trim() && !phone.trim()) {
      setErrorMsg("Please provide at least one contact method (email or phone).")
      return
    }

    if (!contactConsent) {
      setErrorMsg("Please check the box to confirm consent to be contacted.")
      return
    }

    setLoading(true)

    const payload = {
      type,
      contactName,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      preferredContact,
      instrument: type === "lesson" || type === "location_interest" ? instrument : undefined,
      learnerGroup: type === "lesson" ? learnerGroup : undefined,
      learnerName: type === "lesson" && (learnerGroup === "child" || learnerGroup === "teen") ? learnerName.trim() : undefined,
      experience: type === "lesson" ? experience : undefined,
      classPreference: type === "lesson" ? classPreference : undefined,
      preferredTimes: type === "lesson" ? preferredTimes.trim() : undefined,
      message: message.trim() || undefined,
      source,
      contactConsent,
      locationUpdates: type === "location_interest" ? true : locationUpdates,
      _hp: honeypot,
    }

    const res = await submitEnquiry(payload)
    setLoading(false)

    if (res.ok) {
      setSuccessMsg(res.message)
    } else {
      setErrorMsg(res.message || "An unexpected error occurred. Please try again.")
    }
  }

  const resetAndClose = () => {
    setSuccessMsg(null)
    setErrorMsg(null)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="relative w-full max-w-xl bg-white text-black border border-black shadow-2xl p-6 sm:p-10 my-8 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={resetAndClose}
          className="absolute top-5 right-5 text-xl font-light hover:opacity-60 transition-opacity p-2 leading-none"
          aria-label="Close form"
        >
          ✕
        </button>

        {successMsg ? (
          <div className="py-8 text-center space-y-5">
            <span className="inline-block text-3xl font-serif">♪</span>
            <h2 id="modal-title" className="text-2xl font-serif font-medium">
              Thank You
            </h2>
            <p className="text-sm text-neutral-700 leading-relaxed max-w-md mx-auto">
              {successMsg}
            </p>
            <div className="p-4 bg-neutral-100 text-xs text-neutral-600 border-l-2 border-black max-w-md mx-auto text-left space-y-1">
              <p className="font-semibold text-black">What happens next:</p>
              <p>We review every note personally and will get in touch with you shortly.</p>
              <p className="italic">Online and in-person classes are available. For in-person learning: “Coming soon — A welcoming new space is on the way.”</p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={resetAndClose}
                className="px-6 py-2.5 bg-black text-white text-xs tracking-wider uppercase font-medium hover:bg-neutral-800 transition"
              >
                Return to Website
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-6 border-b border-black/15 pb-4">
              <p className="text-[10px] tracking-[0.2em] font-semibold text-neutral-500 uppercase">
                Mozart School Of Western Classical Music
              </p>
              <h2 id="modal-title" className="text-2xl sm:text-3xl font-serif font-normal mt-1">
                {type === "lesson" && "Make a Lesson Enquiry"}
                {type === "location_interest" && "Register Your Location Interest"}
                {type === "general" && "Send Us a Note"}
              </h2>
              <p className="text-xs text-neutral-600 mt-1">
                {type === "lesson" && "Online and in-person classes are available. Tell us who is learning and what instrument calls to you."}
                {type === "location_interest" && "In-person classes are coming soon — A welcoming new space is on the way. Register your interest and we’ll keep you informed."}
                {type === "general" && "Have a question about our classical curriculum or teaching approach? We are here to help."}
              </p>
            </div>

            {errorMsg && (
              <div className="mb-6 p-4 bg-neutral-100 border-l-2 border-black text-xs text-black">
                <p className="font-semibold">Unable to submit enquiry:</p>
                <p className="mt-0.5">{errorMsg}</p>
                <p className="mt-2 text-[11px] text-neutral-600">
                  You can also call us directly at{" "}
                  <a href="tel:9043877104" className="font-semibold underline">
                    9043877104
                  </a>{" "}
                  or email{" "}
                  <a href="mailto:srinivaschetty@gmail.com" className="font-semibold underline">
                    srinivaschetty@gmail.com
                  </a>.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
              {/* Hidden Honeypot */}
              <input
                type="text"
                name="user_note_verify"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />

              {/* Form Type Tabs (if user wants to toggle) */}
              <div className="flex border border-black/20 text-[11px]">
                <button
                  type="button"
                  onClick={() => setType("lesson")}
                  className={`flex-1 py-1.5 text-center transition ${type === "lesson" ? "bg-black text-white font-medium" : "bg-transparent text-neutral-600 hover:text-black"}`}
                >
                  Lesson Enquiry
                </button>
                <button
                  type="button"
                  onClick={() => setType("location_interest")}
                  className={`flex-1 py-1.5 text-center border-l border-black/20 transition ${type === "location_interest" ? "bg-black text-white font-medium" : "bg-transparent text-neutral-600 hover:text-black"}`}
                >
                  Location Interest
                </button>
                <button
                  type="button"
                  onClick={() => setType("general")}
                  className={`flex-1 py-1.5 text-center border-l border-black/20 transition ${type === "general" ? "bg-black text-white font-medium" : "bg-transparent text-neutral-600 hover:text-black"}`}
                >
                  General Note
                </button>
              </div>

              {/* Lesson Specific: Instrument & Learner Selection */}
              {(type === "lesson" || type === "location_interest") && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5">
                    Instrument
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: "piano", label: "Piano" },
                      { id: "keyboard", label: "Keyboard" },
                      { id: "violin", label: "Violin" },
                      { id: "unsure", label: "Not Sure" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setInstrument(item.id as InstrumentType)}
                        className={`py-2 px-1 text-center border text-[11px] transition ${
                          instrument === item.id
                            ? "border-black bg-black text-white font-medium"
                            : "border-black/20 text-black hover:border-black"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {type === "lesson" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5">
                        Learner Group
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: "child", label: "Child" },
                          { id: "teen", label: "Teen" },
                          { id: "adult", label: "Adult" },
                        ].map((grp) => (
                          <button
                            key={grp.id}
                            type="button"
                            onClick={() => setLearnerGroup(grp.id as LearnerGroupType)}
                            className={`py-1.5 text-center border text-[11px] transition ${
                              learnerGroup === grp.id
                                ? "border-black bg-black text-white font-medium"
                                : "border-black/20 text-black hover:border-black"
                            }`}
                          >
                            {grp.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5">
                        Experience Level
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: "beginner", label: "Beginner" },
                          { id: "some_experience", label: "Some" },
                          { id: "experienced", label: "Experienced" },
                        ].map((exp) => (
                          <button
                            key={exp.id}
                            type="button"
                            onClick={() => setExperience(exp.id as ExperienceLevelType)}
                            className={`py-1.5 text-center border text-[11px] transition ${
                              experience === exp.id
                                ? "border-black bg-black text-white font-medium"
                                : "border-black/20 text-black hover:border-black"
                            }`}
                          >
                            {exp.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Class Preference */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider">
                        Class Preference *
                      </label>
                      <span className="text-[10px] text-neutral-500">
                        Online and in-person classes are available.
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "online", label: "Online" },
                        { id: "in_person", label: "In-person" },
                        { id: "either_guidance", label: "Either / I’d like guidance" },
                      ].map((pref) => (
                        <button
                          key={pref.id}
                          type="button"
                          onClick={() => setClassPreference(pref.id as ClassPreference)}
                          className={`py-2 px-2 text-center border text-[11px] transition ${
                            classPreference === pref.id
                              ? "border-black bg-black text-white font-medium"
                              : "border-black/20 text-black hover:border-black"
                          }`}
                        >
                          {pref.label}
                        </button>
                      ))}
                    </div>
                    {classPreference === "in_person" && (
                      <p className="mt-1.5 text-[10px] text-neutral-600 italic">
                        In-person classes are coming soon — A welcoming new space is on the way.
                      </p>
                    )}
                  </div>

                  {(learnerGroup === "child" || learnerGroup === "teen") && (
                    <div className="p-3 bg-neutral-100 border border-black/15 text-[11px] text-neutral-700">
                      <p className="font-medium text-black">Parent / Guardian Contact</p>
                      <p className="mt-0.5">
                        Please provide the parent or guardian’s contact details below. We do not collect children’s full names or dates of birth.
                      </p>
                      <div className="mt-2">
                        <label className="block text-[10px] uppercase font-semibold text-neutral-600 mb-1">
                          Student First Name (Optional)
                        </label>
                        <input
                          type="text"
                          value={learnerName}
                          onChange={(e) => setLearnerName(e.target.value)}
                          placeholder="First name only"
                          maxLength={50}
                          className="w-full bg-white border border-black/30 p-1.5 text-xs text-black focus:outline-hidden focus:border-black"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Contact Information */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1">
                    {learnerGroup === "child" || learnerGroup === "teen" ? "Parent / Guardian Name *" : "Your Name *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Full name"
                    maxLength={120}
                    className="w-full border border-black/30 p-2 text-xs text-black focus:outline-hidden focus:border-black"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      maxLength={255}
                      className="w-full border border-black/30 p-2 text-xs text-black focus:outline-hidden focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 9043877104"
                      maxLength={30}
                      className="w-full border border-black/30 p-2 text-xs text-black focus:outline-hidden focus:border-black"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-neutral-500 italic">
                  * At least one contact method (email or phone) is required so we can reply.
                </p>
              </div>

              {/* Preferred Contact Method */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1">
                  Preferred Contact Method
                </label>
                <div className="flex gap-4 text-xs">
                  {[
                    { id: "either", label: "Either" },
                    { id: "phone", label: "Phone call" },
                    { id: "email", label: "Email" },
                  ].map((m) => (
                    <label key={m.id} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="preferred_contact"
                        checked={preferredContact === m.id}
                        onChange={() => setPreferredContact(m.id as any)}
                        className="accent-black"
                      />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Preferred Times (Preferences only) */}
              {type === "lesson" && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1">
                    Preferred Days & Times <span className="font-normal lowercase text-neutral-500">(Preferences only — not a booking)</span>
                  </label>
                  <input
                    type="text"
                    value={preferredTimes}
                    onChange={(e) => setPreferredTimes(e.target.value)}
                    placeholder="e.g. Weekdays after 4pm, or Saturday mornings"
                    maxLength={300}
                    className="w-full border border-black/30 p-2 text-xs text-black focus:outline-hidden focus:border-black"
                  />
                </div>
              )}

              {/* Message */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1">
                  {type === "lesson" ? "Additional Notes (Optional)" : "Message *"}
                </label>
                <textarea
                  rows={type === "general" ? 4 : 2}
                  required={type === "general"}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    type === "lesson"
                      ? "Tell us about musical goals, favourite pieces, or any questions..."
                      : "How can we help you?"
                  }
                  maxLength={3000}
                  className="w-full border border-black/30 p-2 text-xs text-black focus:outline-hidden focus:border-black resize-none"
                />
              </div>

              {/* Consents */}
              <div className="space-y-2 pt-1 border-t border-black/15">
                <label className="flex items-start gap-2.5 cursor-pointer text-[11px] text-neutral-800">
                  <input
                    type="checkbox"
                    required
                    checked={contactConsent}
                    onChange={(e) => setContactConsent(e.target.checked)}
                    className="accent-black mt-0.5"
                  />
                  <span>
                    <strong>Required:</strong> I consent to Mozart School contacting me regarding this enquiry.
                  </span>
                </label>

                {type !== "location_interest" && (
                  <label className="flex items-start gap-2.5 cursor-pointer text-[11px] text-neutral-700">
                    <input
                      type="checkbox"
                      checked={locationUpdates}
                      onChange={(e) => setLocationUpdates(e.target.checked)}
                      className="accent-black mt-0.5"
                    />
                    <span>
                      Keep me informed when updates about the new school location are confirmed.
                    </span>
                  </label>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-black/15">
                <div className="text-[10px] text-neutral-500">
                  Protected by Turnstile & strict privacy.
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={resetAndClose}
                    className="flex-1 sm:flex-none px-4 py-2.5 border border-black/30 text-xs font-medium hover:bg-neutral-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 sm:flex-none px-6 py-2.5 bg-black text-white text-xs font-medium tracking-wide uppercase hover:bg-neutral-800 transition disabled:opacity-50"
                  >
                    {loading ? "Sending..." : "Submit Enquiry"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
