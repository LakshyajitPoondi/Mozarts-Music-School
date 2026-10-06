import { Enquiry } from "./types"

/**
 * Escapes characters that can trigger spreadsheet formula execution in Excel/Sheets.
 * If a cell begins with '=', '+', '-', '@', tab, or carriage return,
 * it is prefixed with a single quote (') to force literal interpretation.
 */
export function sanitizeCsvField(value: any): string {
  if (value === null || value === undefined) {
    return ""
  }

  let str = String(value)

  // Formula trigger characters
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }

  // Escape double quotes by doubling them
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`
  }

  return str
}

/**
 * Converts an array of enquiries into a CSV string safe from formula injection.
 */
export function exportEnquiriesToCsv(enquiries: Enquiry[]): string {
  const headers = [
    "ID",
    "Submitted At",
    "Enquiry Type",
    "Status",
    "Contact Name",
    "Email",
    "Phone",
    "Preferred Contact",
    "Instrument",
    "Learner Group",
    "Learner First Name",
    "Experience Level",
    "Class Preference",
    "Preferred Times",
    "Message",
    "Location Updates Consent",
    "Source",
  ]

  const rows = enquiries.map((item) => [
    sanitizeCsvField(item.id),
    sanitizeCsvField(new Date(item.created_at).toLocaleString()),
    sanitizeCsvField(item.type),
    sanitizeCsvField(item.status),
    sanitizeCsvField(item.contact_name),
    sanitizeCsvField(item.email || ""),
    sanitizeCsvField(item.phone || ""),
    sanitizeCsvField(item.preferred_contact || ""),
    sanitizeCsvField(item.instrument || ""),
    sanitizeCsvField(item.learner_group || ""),
    sanitizeCsvField(item.learner_name || ""),
    sanitizeCsvField(item.experience || ""),
    sanitizeCsvField(item.class_preference || ""),
    sanitizeCsvField(item.preferred_times || ""),
    sanitizeCsvField(item.message || ""),
    sanitizeCsvField(item.location_updates ? "Yes" : "No"),
    sanitizeCsvField(item.source || ""),
  ])

  const csvLines = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ]

  return csvLines.join("\r\n")
}

/**
 * Triggers a browser download of the generated CSV file.
 */
export function downloadCsvFile(content: string, filename = "mozart-school-enquiries.csv") {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
