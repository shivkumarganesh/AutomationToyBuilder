/** Trigger a browser download of generated file content. */
export function downloadFile(name: string, content: string | DataView, mime: string) {
  const blob =
    typeof content === 'string'
      ? new Blob([content], { type: mime })
      : new Blob([content.buffer as ArrayBuffer], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
