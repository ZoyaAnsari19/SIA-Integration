'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { MessageAttachment } from '@/components/support/MessageAttachment'
import {
  getAdminTicket,
  assignTicketToMe,
  addAdminMessage,
  uploadAdminAttachment,
  reassignTicket,
  closeAdminTicket,
  type AdminTicketThread,
} from '@/lib/api/support'
import { getMyPermissions } from '@/lib/api/sub-admins'

interface PendingAttachment {
  url: string
  type: string
  filename: string
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN')
}

export default function AdminSupportTicketPage() {
  const params = useParams()
  const id = params?.id as string
  const [ticket, setTicket] = useState<AdminTicketThread | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adminRole, setAdminRole] = useState<string>('')
  const [messageText, setMessageText] = useState('')
  const [sendLoading, setSendLoading] = useState(false)
  const [assignLoading, setAssignLoading] = useState(false)
  const [closeLoading, setCloseLoading] = useState(false)
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [reassignUserId, setReassignUserId] = useState('')
  const [reassignLoading, setReassignLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  // Ref so Send always has latest attachments (avoids stale state after voice upload)
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([])

  const fetchTicket = useCallback(async () => {
    if (!id || id === 'undefined' || id === 'null') {
      setLoading(false)
      setError('Invalid ticket ID')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getAdminTicket(id)
      setTicket(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ticket')
      setTicket(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchTicket()
  }, [fetchTicket])

  useEffect(() => {
    getMyPermissions().then(({ role }) => setAdminRole(role)).catch(() => setAdminRole(''))
  }, [])

  const handleAssignToMe = async () => {
    if (!id) return
    setAssignLoading(true)
    setSendError(null)
    try {
      await assignTicketToMe(id)
      await fetchTicket()
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to assign')
    } finally {
      setAssignLoading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setUploadingFile(true)
    try {
      const response = await uploadAdminAttachment(id, file)
      const url = (response?.url ?? '').toString().trim()
      if (!url || url.toLowerCase() === 'empty') {
        setSendError('Upload did not return a valid URL')
        return
      }
      const type = (response?.type ?? '').toString() || 'application/octet-stream'
      const filename = (response?.filename ?? file?.name ?? '').toString() || 'file'
      const next = [...pendingAttachmentsRef.current, { url, type, filename }]
      pendingAttachmentsRef.current = next
      setPendingAttachments(next)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingFile(false)
      e.target.value = ''
    }
  }

  const removePending = (url: string) => {
    pendingAttachmentsRef.current = pendingAttachmentsRef.current.filter((a) => a.url !== url)
    setPendingAttachments(pendingAttachmentsRef.current.slice())
  }

  const startRecording = useCallback(async () => {
    if (!id) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recordedChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(recordedChunksRef.current, { type: mimeType })
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type })
        setUploadingFile(true)
        setSendError(null)
        try {
          const response = await uploadAdminAttachment(id, file)
          const url = (response?.url ?? '').toString().trim()
          if (!url || url.toLowerCase() === 'empty') {
            setSendError('Upload did not return a valid URL')
            return
          }
          const type = (response?.type ?? 'audio/webm').toString()
          const filename = (response?.filename ?? file?.name ?? `voice-${Date.now()}.webm`).toString()
          const next = [...pendingAttachmentsRef.current, { url, type, filename }]
          pendingAttachmentsRef.current = next
          setPendingAttachments(next)
        } catch (err) {
          setSendError(err instanceof Error ? err.message : 'Voice upload failed')
        } finally {
          setUploadingFile(false)
        }
      }

      recorder.start(1000)
      setIsRecording(true)
    } catch (err) {
      setSendError('Microphone access is needed to record voice.')
    }
  }, [id])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
      setIsRecording(false)
    }
  }, [])

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = messageText.trim()
    // Read from ref once; only include items with non-empty url (never send empty objects)
    const fromRef = pendingAttachmentsRef.current
    const attachmentsToSend = fromRef
      .filter((a) => a && typeof a.url === 'string' && a.url.trim() !== '')
      .map((a) => ({
        url: String(a.url).trim(),
        type: typeof a.type === 'string' ? a.type : 'voice',
        filename: typeof a.filename === 'string' ? a.filename : `voice-${Date.now()}.webm`,
      }))
    if (!text && attachmentsToSend.length === 0) {
      setSendError('Enter a message or add an attachment.')
      return
    }
    if (!id) return

    // Build body first (do NOT clear ref/state before this). Backend accepts attachment-only when message_text is null/omitted.
    const body: {
      message_text?: string | null
      attachment_urls?: Array<{ url: string; type: string; filename: string }>
    } = {
      message_text: text || null,
    }
    if (attachmentsToSend.length > 0) {
      body.attachment_urls = attachmentsToSend
    }
    if (attachmentsToSend.length > 0) {
      body.attachment_urls = attachmentsToSend
    }

    setSendLoading(true)
    setSendError(null)
    pendingAttachmentsRef.current = []
    setPendingAttachments([])
    setMessageText('')

    try {
      await addAdminMessage(id, body)
      await fetchTicket()
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to send reply')
    } finally {
      setSendLoading(false)
    }
  }

  const handleReassign = async () => {
    const uid = reassignUserId.trim()
    if (!id || !uid) return
    const num = parseInt(uid, 10)
    if (Number.isNaN(num)) {
      setSendError('Enter a valid user ID')
      return
    }
    setReassignLoading(true)
    setSendError(null)
    try {
      await reassignTicket(id, { assigned_to: num })
      setReassignUserId('')
      await fetchTicket()
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to reassign')
    } finally {
      setReassignLoading(false)
    }
  }

  const handleCloseTicket = async () => {
    if (!id) return
    setCloseLoading(true)
    setSendError(null)
    try {
      await closeAdminTicket(id)
      await fetchTicket()
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to close ticket')
    } finally {
      setCloseLoading(false)
    }
  }

  if (loading && !ticket) {
    return (
      <div className="py-12 text-center text-slate-500">
        Loading ticket...
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="space-y-4">
        <Link href="/support/tickets" className="text-blue-600 hover:underline">
          ← Back to Tickets
        </Link>
        <Card title="Error">
          <p className="text-red-600">{error || 'Ticket not found.'}</p>
        </Card>
      </div>
    )
  }

  const isClosed = ticket.status === 'closed'
  const canReply = !isClosed && (ticket.assigned_to != null || adminRole === 'SUPER_ADMIN')
  // If ticket has assigned_to set, hide "Assign to me" button.
  const isAssigned = ticket.assigned_to != null
  const showAssignButton = !isClosed && !isAssigned

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Link href="/support/tickets" className="text-blue-600 hover:underline">
          Support Tickets
        </Link>
        <span>/</span>
        <span>Ticket #{ticket?.id ?? id ?? '—'}</span>
      </div>

      <Card title={`Ticket #${ticket?.id ?? id ?? '—'}`}>
        <div className="space-y-4">
          {/* User & meta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">User</p>
              {ticket.user?.display_id && (
                <p className="text-xs text-slate-500">ID: {ticket.user.display_id}</p>
              )}
              <p className="font-medium">
                {ticket.user?.name || (ticket.user_id != null ? `User #${ticket.user_id}` : '—')}
              </p>
              {ticket.user?.email && <p className="text-sm text-slate-600">{ticket.user.email}</p>}
              {ticket.user?.phone && <p className="text-sm text-slate-600">{ticket.user.phone}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Topic / Subject</p>
              <p className="text-sm">{ticket.pre_question || ticket.subject || 'No subject'}</p>
              <p className="text-xs text-slate-500 mt-1">Created {formatDate(ticket.created_at)}</p>
              <p className="text-xs text-slate-500">Status: {ticket.status} · Assigned: {ticket.assigned_to_user?.name || 'Unassigned'}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {showAssignButton && (
              <button
                type="button"
                onClick={handleAssignToMe}
                disabled={assignLoading}
                className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {assignLoading ? 'Assigning...' : 'Assign to me'}
              </button>
            )}
            {adminRole === 'SUPER_ADMIN' && !isClosed && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  placeholder="Reassign to user ID"
                  value={reassignUserId}
                  onChange={(e) => setReassignUserId(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm w-40"
                />
                <button
                  type="button"
                  onClick={handleReassign}
                  disabled={reassignLoading}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                >
                  {reassignLoading ? '...' : 'Reassign'}
                </button>
                <span className="text-xs text-slate-500">
                  Sub-admin ID: Master → Admin Management (ID column)
                </span>
              </div>
            )}
            {!isClosed && (
              <button
                type="button"
                onClick={handleCloseTicket}
                disabled={closeLoading}
                className="rounded-lg border border-red-500 text-red-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {closeLoading ? 'Closing...' : 'Close ticket'}
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-slate-700 mb-2">Conversation</p>
            <div className="max-h-[400px] overflow-y-auto space-y-3">
              {(Array.isArray(ticket?.messages) ? ticket.messages : []).map((m, idx) => (
                <div
                  key={m?.id ?? `msg-${idx}`}
                  className={`flex ${m.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-2 ${
                      m.sender_type === 'admin'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {m.message_text && <p className="text-sm whitespace-pre-wrap">{m.message_text}</p>}
                    {(() => {
                      // Same logic as user side: support attachment_urls array OR single attachment_url/type/filename
                      const raw = (m as any).attachment_urls
                      const singleUrl = (m as any).attachment_url as string | undefined
                      const singleType = (m as any).attachment_type as string | undefined
                      const singleFilename = (m as any).attachment_filename as string | undefined

                      const attachments: Array<{ url?: string; type?: string; filename?: string }> = []
                      if (Array.isArray(raw) && raw.length > 0) {
                        raw.forEach((a: any) => {
                          const url =
                            (typeof a?.url === 'string' && a.url) ||
                            (typeof a?.file_url === 'string' && a.file_url) ||
                            (typeof a?.attachment_url === 'string' && a.attachment_url) ||
                            ''
                          const type = (typeof a?.type === 'string' && a.type) || (typeof a?.mime_type === 'string' && a.mime_type) || ''
                          const filename = (typeof a?.filename === 'string' && a.filename) || (typeof a?.name === 'string' && a.name) || ''
                          attachments.push({ url, type, filename })
                        })
                      } else if (singleUrl) {
                        attachments.push({ url: singleUrl, type: singleType, filename: singleFilename })
                      }

                      const visible = attachments.filter((a) => a.url)
                      if (visible.length === 0) return null

                      return (
                        <div className="mt-2 space-y-2">
                          {visible.map((att, i) => (
                            <MessageAttachment
                              key={att.url || `${att.filename ?? 'attachment'}-${i}`}
                              attachmentUrl={att.url ?? null}
                              attachmentType={att.type ?? null}
                              filename={att.filename ?? null}
                            />
                          ))}
                        </div>
                      )
                    })()}
                    <p className={`text-xs mt-1 ${m.sender_type === 'admin' ? 'text-blue-100' : 'text-slate-500'}`}>
                      {m.sender_type === 'admin' ? 'Support' : 'User'} · {formatDate(m.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reply form */}
          {canReply && (
            <>
              {sendError && (
                <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">{sendError}</div>
              )}
              {pendingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pendingAttachments.map((a, index) => {
                    const t = (a.type || '').toLowerCase()
                    const icon = t === 'image' ? '🖼️' : t === 'voice' || t === 'audio' || t.startsWith('audio/') ? '🎙' : '📎'
                    return (
                      <span
                        key={a.url || `${a.filename ?? 'attachment'}-${index}`}
                        className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-xs"
                      >
                        {icon} {a.filename || 'Attachment'}
                        <button type="button" onClick={() => removePending(a.url)} className="text-slate-600 hover:text-red-600" aria-label="Remove">
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
              <form onSubmit={handleSendReply} className="flex gap-2 flex-wrap">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf,audio/webm,audio/ogg,audio/mp4,audio/mpeg"
                  className="hidden"
                  id="admin-support-file"
                  onChange={handleFileSelect}
                  disabled={uploadingFile}
                />
                <label
                  htmlFor="admin-support-file"
                  className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 bg-white cursor-pointer hover:bg-slate-50 disabled:opacity-50"
                >
                  {uploadingFile ? '…' : '📎'}
                </label>
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={uploadingFile}
                  className={`flex items-center justify-center w-10 h-10 rounded-lg border text-sm ${
                    isRecording ? 'border-red-500 text-red-600' : 'border-slate-300 text-slate-700'
                  }`}
                >
                  {isRecording ? '■' : '🎙'}
                </button>
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your reply..."
                  className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={sendLoading || (messageText.trim() === '' && pendingAttachments.length === 0)}
                  className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {sendLoading ? 'Sending...' : 'Send'}
                </button>
              </form>
            </>
          )}

          {isClosed && (
            <p className="text-sm text-slate-500 text-center py-2">This ticket is closed.</p>
          )}
        </div>
      </Card>
    </div>
  )
}
