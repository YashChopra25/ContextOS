/** RFC 4180 CSV parser: quoted fields, escaped quotes, embedded newlines, CRLF and a leading BOM. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "")
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }
    if (char === '"') quoted = true
    else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      field = ""
    } else field += char
  }
  row.push(field)
  if (row.some((value) => value.trim())) rows.push(row)
  return rows
}
