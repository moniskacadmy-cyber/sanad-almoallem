// Adds the read-only parent portal link to the EXISTING WhatsApp messages (no second notification system).
export function appendParentLink(
  text: string,
  student: { parentPortalUrl?: string | null; parentPortalExpiresAtMs?: number | null },
  nowMs: number = Date.now()
): string {
  const url = student.parentPortalUrl;
  if (!url || (student.parentPortalExpiresAtMs && student.parentPortalExpiresAtMs < nowMs)) return text;
  return `${text}\n\n📲 تابعوا الطالب أونلاين (حضور، حصص قادمة، مذكرات - للقراءة فقط):\n${url}`;
}
