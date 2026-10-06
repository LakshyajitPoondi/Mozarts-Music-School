import { useEffect } from "react"

interface PrivacyNoticeModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function PrivacyNoticeModal({ isOpen, onClose }: PrivacyNoticeModalProps) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-title"
    >
      <div className="relative w-full max-w-2xl bg-white text-black border border-black shadow-2xl p-6 sm:p-10 my-8 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-xl font-light hover:opacity-60 transition-opacity p-2 leading-none"
          aria-label="Close privacy policy"
        >
          ✕
        </button>

        <div className="border-b border-black/15 pb-4 mb-6">
          <p className="text-[10px] tracking-[0.2em] font-semibold text-neutral-500 uppercase">
            Mozart School Of Western Classical Music
          </p>
          <h2 id="privacy-title" className="text-2xl sm:text-3xl font-serif font-normal mt-1">
            Privacy & Data Notice
          </h2>
          <p className="text-xs text-neutral-600 mt-1">
            Last updated: October 2026 · Transparent and respectful data stewardship
          </p>
        </div>

        <div className="space-y-6 text-xs text-neutral-700 leading-relaxed font-sans">
          <section>
            <h3 className="text-sm font-serif font-semibold text-black mb-1">
              1. What Information We Collect
            </h3>
            <p>
              When you get in touch with Mozart School through our website, we collect only the necessary details required to respond to your specific enquiry:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 pl-1 text-neutral-800">
              <li><strong>Contact Details:</strong> Your name, email address, and/or telephone number.</li>
              <li><strong>Musical Interests:</strong> Your chosen instrument (Piano, Keyboard, Violin), learner group (Child, Teen, Adult), experience level, class preference (Online, In-person, Either / Guidance), and preferred practice days or times.</li>
              <li><strong>Guardian Details for Minors:</strong> For child and teenage learners, we strictly request a parent or guardian’s contact information. We do not ask for or store children’s full names, dates of birth, or sensitive background data.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-serif font-semibold text-black mb-1">
              2. How We Use Your Information
            </h3>
            <p>
              Your details are used strictly to:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 pl-1 text-neutral-800">
              <li>Respond directly to your lesson enquiry or general message.</li>
              <li>Provide personalized advice on instruments and beginner pathways.</li>
              <li>Notify you of our new physical class location when ready, if and only if you explicitly opted into location updates.</li>
            </ul>
            <p className="mt-2 text-neutral-600 italic">
              We never sell, rent, or trade your personal data. We do not assume location update consent permits unrelated promotional marketing.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-serif font-semibold text-black mb-1">
              3. Data Retention Policy
            </h3>
            <p>
              We retain prospective student enquiries for a maximum period of <strong>12 to 24 months</strong> from the date of submission, after which records are permanently deleted unless an active teaching relationship is established.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-serif font-semibold text-black mb-1">
              4. Security & Protection
            </h3>
            <p>
              Submissions are safeguarded by cryptographic token verification, server-side rate limiting, Row Level Security (RLS) in PostgreSQL, and strict access controls restricted to authorized school staff.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-serif font-semibold text-black mb-1">
              5. Your Rights & Contact Details
            </h3>
            <p>
              You have the right to request access to any personal data held about you, request corrections, or request immediate deletion of your records at any time.
            </p>
            <div className="mt-3 p-3 bg-neutral-100 border border-black/15 text-neutral-800">
              <p><strong>School Privacy Contact:</strong></p>
              <p>Srinivas Chetty</p>
              <p>Email: <a href="mailto:srinivaschetty@gmail.com" className="underline font-medium">srinivaschetty@gmail.com</a></p>
              <p>Telephone: <a href="tel:9043877104" className="underline font-medium">9043877104</a></p>
            </div>
          </section>
        </div>

        <div className="mt-8 pt-4 border-t border-black/15 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-black text-white text-xs font-medium uppercase tracking-wider hover:bg-neutral-800 transition"
          >
            Close Notice
          </button>
        </div>
      </div>
    </div>
  )
}
