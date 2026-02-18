'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Lightbulb, Frown, HelpCircle, Newspaper, Link2, Plus, X, Search, 
  Trash2, Edit3, Check, Moon, Sun, Sparkles, Image as ImageIcon, 
  Filter, XCircle, Bell, BellRing, Loader2, ChevronDown, ChevronUp, 
  Wand2, Cloud, Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { AnalyzeResponse } from '@/app/api/analyze/route'
import { NotificationPermissionDialog } from '@/components/NotificationPermissionDialog'
import { SyncDialog } from '@/components/SyncDialog'

type NoteType = 'idea' | 'complaint' | 'confusion' | 'news' | 'link'

interface Note {
  id: string
  content: string
  type: NoteType
  tags: string[]
  images: string[]
  createdAt: string
  reminderAt?: string
  aiSuggestion?: string
  aiTypeReason?: string
  isAiAnalyzed?: boolean
}

const noteTypes: { type: NoteType; label: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }[] = [
  { type: 'idea', label: '灵感', icon: <Lightbulb className="w-4 h-4" />, color: 'text-amber-500', bgColor: 'bg-amber-500/10 hover:bg-amber-500/20', borderColor: 'border-amber-500' },
  { type: 'complaint', label: '牢骚', icon: <Frown className="w-4 h-4" />, color: 'text-red-500', bgColor: 'bg-red-500/10 hover:bg-red-500/20', borderColor: 'border-red-500' },
  { type: 'confusion', label: '困惑', icon: <HelpCircle className="w-4 h-4" />, color: 'text-purple-500', bgColor: 'bg-purple-500/10 hover:bg-purple-500/20', borderColor: 'border-purple-500' },
  { type: 'news', label: '资讯', icon: <Newspaper className="w-4 h-4" />, color: 'text-blue-500', bgColor: 'bg-blue-500/10 hover:bg-blue-500/20', borderColor: 'border-blue-500' },
  { type: 'link', label: '链接', icon: <Link2 className="w-4 h-4" />, color: 'text-green-500', bgColor: 'bg-green-500/10 hover:bg-green-500/20', borderColor: 'border-green-500' },
]

const getTypeConfig = (type: NoteType) => noteTypes.find(t => t.type === type) || noteTypes[0]

const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const formatReminderTime = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const isUrl = (text: string): boolean => {
  try { new URL(text); return true } catch { return false }
}

const compressImage = (file: File, maxWidth = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = document.createElement('img')
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width, height = img.height
        if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth }
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const STORAGE_KEY = 'sui-shou-ji-notes'
const SYNC_CODE_KEY = 'sui-shou-ji-sync-code'
const LAST_SYNC_KEY = 'sui-shou-ji-last-sync'

const requestNotificationPermission = async (): Promise<'granted' | 'denied' | 'default'> => {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission !== 'denied') return await Notification.requestPermission()
  return Notification.permission
}

const sendNotification = (title: string, body: string) => {
  if (Notification.permission === 'granted') new Notification(title, { body, icon: '/favicon.ico', tag: 'sui-shou-ji-reminder' })
}

const exportToCSV = (notes: Note[]) => {
  const headers = ['内容', '类型', '标签', '创建时间', '提醒时间', 'AI建议']
  const typeLabels: Record<NoteType, string> = { idea: '灵感', complaint: '牢骚', confusion: '困惑', news: '资讯', link: '链接' }
  const rows = notes.map(note => [
    note.content.replace(/"/g, '""'), typeLabels[note.type], note.tags.join(';'),
    new Date(note.createdAt).toLocaleString('zh-CN'),
    note.reminderAt ? new Date(note.reminderAt).toLocaleString('zh-CN') : '', note.aiSuggestion || ''
  ])
  const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `随手记_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}
export default function Home() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const [notes, setNotes] = useState<Note[]>(() => {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) try { return JSON.parse(stored) } catch (e) { console.error(e) }
    return []
  })
  
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const savedTheme = localStorage.getItem('theme')
    return savedTheme ? savedTheme === 'dark' : prefersDark
  })

  const [syncCode, setSyncCode] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(SYNC_CODE_KEY) || ''
  })
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(LAST_SYNC_KEY) || ''
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const [showSyncDialog, setShowSyncDialog] = useState(false)
  const [showNotificationDialog, setShowNotificationDialog] = useState(false)
  const [notificationStatus, setNotificationStatus] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default')

  const [content, setContent] = useState('')
  const [selectedType, setSelectedType] = useState<NoteType>('idea')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<NoteType | null>(null)
  const [showRemindersOnly, setShowRemindersOnly] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editTagInput, setEditTagInput] = useState('')
  const [reminderTime, setReminderTime] = useState<string>('')
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string>('')
  const [aiTypeReason, setAiTypeReason] = useState<string>('')
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(new Set())
  const isInitialized = useRef(false)
  const reminderCheckRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isInitialized.current) localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
    else isInitialized.current = true
  }, [notes])

  useEffect(() => {
    if (syncCode) localStorage.setItem(SYNC_CODE_KEY, syncCode)
    else localStorage.removeItem(SYNC_CODE_KEY)
  }, [syncCode])

  useEffect(() => { if (lastSyncTime) localStorage.setItem(LAST_SYNC_KEY, lastSyncTime) }, [lastSyncTime])

  useEffect(() => {
    if (isDark) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark') }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light') }
  }, [isDark])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) { setNotificationStatus('unsupported'); return }
    setNotificationStatus(Notification.permission)
    const interval = setInterval(() => setNotificationStatus(Notification.permission), 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items; if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) try { setImages(prev => [...prev, await compressImage(file)]); toast({ title: '图片已添加' }) } catch { toast({ title: '图片处理失败', variant: 'destructive' }) }
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [toast])

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date()
      notes.forEach(note => {
        if (note.reminderAt) {
          const reminderDate = new Date(note.reminderAt)
          const diff = Math.abs(reminderDate.getTime() - now.getTime())
          if (diff < 60000 && reminderDate <= now) {
            sendNotification('⏰ 提醒', note.content.slice(0, 50) + (note.content.length > 50 ? '...' : ''))
            setNotes(prev => prev.map(n => n.id === note.id ? { ...n, reminderAt: undefined } : n))
          }
        }
      })
    }
    reminderCheckRef.current = setInterval(checkReminders, 30000)
    return () => { if (reminderCheckRef.current) clearInterval(reminderCheckRef.current) }
  }, [notes])

  const createSyncCode = useCallback(async (): Promise<string | null> => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/sync', { method: 'POST' })
      const data = await response.json()
      if (response.ok) { setSyncCode(data.syncCode); return data.syncCode }
      throw new Error(data.error)
    } catch (error) {
      console.error(error); toast({ title: '创建同步码失败', variant: 'destructive' }); return null
    } finally { setIsSyncing(false) }
  }, [toast])

  const syncUp = useCallback(async () => {
    if (!syncCode) return
    setIsSyncing(true)
    try {
      const response = await fetch(`/api/sync/${syncCode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes }) })
      const data = await response.json()
      if (response.ok) { setLastSyncTime(new Date().toISOString()); toast({ title: '上传成功', description: `已同步 ${notes.length} 条记录` }) }
      else throw new Error(data.error)
    } catch (error) { console.error(error); toast({ title: '上传失败', variant: 'destructive' }) }
    finally { setIsSyncing(false) }
  }, [syncCode, notes, toast])

  const syncDown = useCallback(async () => {
    if (!syncCode) return
    setIsSyncing(true)
    try {
      const response = await fetch(`/api/sync/${syncCode}`)
      const data = await response.json()
      if (response.ok) { setNotes(data.notes); setLastSyncTime(new Date().toISOString()); toast({ title: '下载成功', description: `已同步 ${data.notes.length} 条记录` }) }
      else throw new Error(data.error)
    } catch (error) { console.error(error); toast({ title: '下载数据失败', variant: 'destructive' }) }
    finally { setIsSyncing(false) }
  }, [syncCode, toast])

  const analyzeContent = useCallback(async () => {
    if (!content.trim()) { toast({ title: '请先输入内容', variant: 'destructive' }); return }
    setIsAiAnalyzing(true)
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: content.trim() }) })
      const data: AnalyzeResponse = await response.json()
      if (!response.ok) throw new Error(data.error || 'AI 分析失败')
      setSelectedType(data.type as NoteType)
      if (data.tags?.length > 0) setTags(prev => { const newTags = [...prev]; data.tags.forEach(tag => { if (!newTags.includes(tag)) newTags.push(tag) }); return newTags })
      setAiSuggestion(data.suggestions || ''); setAiTypeReason(data.typeReason || '')
      toast({ title: 'AI 分析完成', description: `已识别为「${getTypeConfig(data.type as NoteType).label}」类型` })
    } catch (error) {
      console.error(error); toast({ title: 'AI 分析失败', description: '请检查网络连接后重试', variant: 'destructive' })
    } finally { setIsAiAnalyzing(false) }
  }, [content, toast])

  const addTag = useCallback((tag: string, isEdit = false) => {
    const trimmedTag = tag.trim(); if (!trimmedTag) return
    if (isEdit) { setEditTags(prev => prev.includes(trimmedTag) ? prev : [...prev, trimmedTag]); setEditTagInput('') }
    else { setTags(prev => prev.includes(trimmedTag) ? prev : [...prev, trimmedTag]); setTagInput('') }
  }, [])

  const removeTag = useCallback((tag: string, isEdit = false) => {
    if (isEdit) setEditTags(prev => prev.filter(t => t !== tag))
    else setTags(prev => prev.filter(t => t !== tag))
  }, [])

  const handleContentChange = useCallback((value: string) => {
    setContent(value)
    if (value.trim() && isUrl(value.trim())) setSelectedType('link')
  }, [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return
    for (const file of files) {
      if (file.type.startsWith('image/')) try { setImages(prev => [...prev, await compressImage(file)]) } catch { toast({ title: '图片处理失败', variant: 'destructive' }) }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSetReminder = async () => {
    const permission = await requestNotificationPermission()
    if (permission === 'granted' && !reminderTime) {
      const defaultTime = new Date(Date.now() + 3600000)
      defaultTime.setMinutes(defaultTime.getMinutes() - defaultTime.getTimezoneOffset())
      setReminderTime(defaultTime.toISOString().slice(0, 16))
      return
    }
    if (permission === 'denied') { setShowNotificationDialog(true); return }
    toast({ title: '需要通知权限', description: '提醒功能需要开启通知权限', variant: 'destructive' })
  }

  const addNote = useCallback(async () => {
    if (!content.trim() && images.length === 0) { toast({ title: '请输入内容', variant: 'destructive' }); return }
    if (reminderTime) {
      const permission = await requestNotificationPermission()
      if (permission === 'denied') { setShowNotificationDialog(true); return }
      if (permission !== 'granted') { toast({ title: '通知权限未开启', variant: 'destructive' }); return }
    }
    const newNote: Note = { id: Date.now().toString(), content: content.trim(), type: selectedType, tags, images, createdAt: new Date().toISOString(), reminderAt: reminderTime || undefined, aiSuggestion: aiSuggestion || undefined, aiTypeReason: aiTypeReason || undefined, isAiAnalyzed: !!aiSuggestion || !!aiTypeReason }
    setNotes(prev => [newNote, ...prev])
    setContent(''); setTags([]); setImages([]); setSelectedType('idea'); setReminderTime(''); setAiSuggestion(''); setAiTypeReason('')
    toast({ title: '记录成功', description: reminderTime ? `已设置提醒：${formatReminderTime(reminderTime)}` : '你的想法已保存~' })
  }, [content, selectedType, tags, images, reminderTime, aiSuggestion, aiTypeReason, toast])

  const deleteNote = useCallback((id: string) => { setNotes(prev => prev.filter(n => n.id !== id)); toast({ title: '已删除' }) }, [toast])
  const startEdit = useCallback((note: Note) => { setEditingId(note.id); setEditContent(note.content); setEditTags([...note.tags]) }, [])
  const cancelEdit = useCallback(() => { setEditingId(null); setEditContent(''); setEditTags([]); setEditTagInput('') }, [])
  const saveEdit = useCallback((id: string) => {
    if (!editContent.trim()) { toast({ title: '内容不能为空', variant: 'destructive' }); return }
    setNotes(prev => prev.map(n => n.id === id ? { ...n, content: editContent.trim(), tags: editTags } : n))
    cancelEdit(); toast({ title: '保存成功' })
  }, [editContent, editTags, cancelEdit, toast])
  const toggleSuggestion = (id: string) => setExpandedSuggestions(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const clearFilters = () => { setFilterType(null); setShowRemindersOnly(false) }

  const filteredNotes = notes.filter(note => {
    if (showRemindersOnly && (!note.reminderAt || new Date(note.reminderAt) < new Date())) return false
    if (filterType && note.type !== filterType) return false
    const query = searchQuery.toLowerCase()
    return note.content.toLowerCase().includes(query) || note.tags.some(tag => tag.toLowerCase().includes(query))
  })

  const pendingRemindersCount = notes.filter(n => n.reminderAt && new Date(n.reminderAt) > new Date()).length

  const handleKeyDown = (e: React.KeyboardEvent, isEdit = false) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTag(isEdit ? editTagInput : tagInput, isEdit) }
  }
    return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">随手记</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">记录每一个灵感瞬间</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {syncCode && (
              <Badge variant="outline" className="gap-1 px-2 py-1 cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-950 font-mono" onClick={() => setShowSyncDialog(true)}>
                <Cloud className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-violet-600 dark:text-violet-400">{syncCode}</span>
              </Badge>
            )}
            {pendingRemindersCount > 0 && (
              <Badge variant="outline" className="gap-1 px-2 py-1 cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950" onClick={() => setShowRemindersOnly(!showRemindersOnly)}>
                <BellRing className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-orange-600 dark:text-orange-400">{pendingRemindersCount}</span>
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={() => setShowSyncDialog(true)} className="rounded-full" title="云同步"><Cloud className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" onClick={() => { if (notes.length === 0) { toast({ title: '没有数据可导出', variant: 'destructive' }); return } exportToCSV(notes); toast({ title: '导出成功', description: `已导出 ${notes.length} 条记录` }) }} className="rounded-full" title="导出 CSV"><Download className="w-5 h-5" /></Button>
            {notificationStatus === 'denied' && (
              <Button variant="ghost" size="icon" onClick={() => setShowNotificationDialog(true)} className="rounded-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950" title="通知权限已关闭"><BellRing className="w-5 h-5" /></Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setIsDark(!isDark)} className="rounded-full">{isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</Button>
          </div>
        </header>

        <div className="mb-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input placeholder="搜索内容或标签..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl shadow-sm" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1"><Filter className="w-4 h-4" />筛选：</span>
            <Button variant={showRemindersOnly ? 'default' : 'outline'} size="sm" onClick={() => setShowRemindersOnly(!showRemindersOnly)} className={cn('h-7 text-xs rounded-full gap-1', showRemindersOnly ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'text-slate-600 dark:text-slate-400')}>
              <Bell className="w-3.5 h-3.5" />待提醒{pendingRemindersCount > 0 && <span className="ml-0.5 bg-white/20 px-1.5 rounded-full">{pendingRemindersCount}</span>}
            </Button>
            <Button variant={filterType === null && !showRemindersOnly ? 'default' : 'outline'} size="sm" onClick={clearFilters} className={cn('h-7 text-xs rounded-full', filterType === null && !showRemindersOnly ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-400')}>全部</Button>
            {noteTypes.map(({ type, label, icon }) => (
              <Button key={type} variant={filterType === type ? 'default' : 'outline'} size="sm" onClick={() => { setFilterType(type === filterType ? null : type); setShowRemindersOnly(false) }} className={cn('h-7 text-xs rounded-full gap-1', filterType === type ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-400')}>{icon}{label}</Button>
            ))}
            {(filterType || showRemindersOnly) && <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs rounded-full text-slate-400 hover:text-slate-600"><XCircle className="w-4 h-4" />清除筛选</Button>}
          </div>
        </div>

        <Card className="mb-8 overflow-hidden border-0 shadow-lg shadow-slate-200/50 dark:shadow-none dark:border dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {noteTypes.map(({ type, label, icon, color, bgColor, borderColor }) => (
                <Button key={type} variant="outline" size="sm" onClick={() => setSelectedType(type)} className={cn('h-9 gap-1.5 rounded-full transition-all border-2', selectedType === type ? `${bgColor} ${borderColor} ${color} font-medium` : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700')}>
                  {icon}<span>{label}</span>
                </Button>
              ))}
              {aiTypeReason && <Badge variant="outline" className="gap-1 px-2 py-1 text-xs text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800"><Wand2 className="w-3 h-3" />AI识别: {aiTypeReason}</Badge>}
            </div>
            <Textarea ref={textareaRef} placeholder="写下你的想法... 可以直接粘贴图片！" value={content} onChange={(e) => handleContentChange(e.target.value)} className="min-h-24 resize-none border-0 bg-transparent focus-visible:ring-0 text-lg placeholder:text-slate-400 dark:placeholder:text-slate-500 p-0" />
            {images.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">{images.map((img, index) => (
                <div key={index} className="relative group">
                  <img src={img} alt={`预览 ${index + 1}`} className="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                  <button onClick={() => setImages(prev => prev.filter((_, i) => i !== index))} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                </div>
              ))}</div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {tags.map((tag) => (<Badge key={tag} variant="secondary" className="gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{tag}<X className="w-3 h-3 cursor-pointer hover:text-red-500 transition-colors" onClick={() => removeTag(tag)} /></Badge>))}
              <Input placeholder="添加标签..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => handleKeyDown(e)} className="w-24 h-7 text-sm border-0 bg-slate-100 dark:bg-slate-800 rounded-full px-3 focus-visible:ring-0" />
            </div>
            {reminderTime && (
              <div className="mt-3 flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                <Bell className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-orange-700 dark:text-orange-300">提醒时间：{formatReminderTime(reminderTime)}</span>
                <Button variant="ghost" size="sm" onClick={() => setReminderTime('')} className="h-6 w-6 p-0 text-orange-500 hover:text-orange-700"><X className="w-3.5 h-3.5" /></Button>
              </div>
            )}
            {aiSuggestion && (
              <div className="mt-3 flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-purple-700 dark:text-purple-300">AI建议：{aiSuggestion}</span>
              </div>
            )}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 flex-wrap">
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
                <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400"><ImageIcon className="w-4 h-4" />图片</Button>
                <Button variant="ghost" size="sm" onClick={handleSetReminder} className={cn('gap-1.5', reminderTime ? 'text-orange-500 hover:text-orange-600' : 'text-slate-500 hover:text-slate-700')}><Bell className="w-4 h-4" />{reminderTime ? '修改提醒' : '设置提醒'}</Button>
                <input type="datetime-local" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="h-8 text-xs border border-slate-200 dark:border-slate-700 rounded-md px-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300" min={new Date().toISOString().slice(0, 16)} />
                <Button variant="ghost" size="sm" onClick={analyzeContent} disabled={isAiAnalyzing || !content.trim()} className="gap-1.5 text-purple-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950">
                  {isAiAnalyzing ? <><Loader2 className="w-4 h-4 animate-spin" />分析中</> : <><Wand2 className="w-4 h-4" />AI 分析</>}
                </Button>
              </div>
              <Button onClick={addNote} disabled={!content.trim() && images.length === 0} className="gap-2 rounded-full px-6 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-purple-500/25">
                <Plus className="w-4 h-4" /><span>记下来</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {filteredNotes.length === 0 && (searchQuery || filterType || showRemindersOnly) && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              {showRemindersOnly ? <><Bell className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>暂无待提醒的记录</p></> : <><Search className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>没有找到匹配的记录</p></>}
              {(filterType || showRemindersOnly) && <Button variant="link" onClick={clearFilters} className="mt-2">清除筛选</Button>}
            </div>
          )}
          {filteredNotes.length === 0 && !searchQuery && !filterType && !showRemindersOnly && notes.length === 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>还没有记录，写下你的第一条吧~</p>
              <p className="text-sm mt-2">💡 提示：可以直接 Ctrl+V 粘贴图片，点击「AI 分析」自动分类！</p>
            </div>
          )}
          {filteredNotes.map((note) => {
            const typeConfig = getTypeConfig(note.type)
            const isEditing = editingId === note.id
            const isSuggestionExpanded = expandedSuggestions.has(note.id)
            return (
              <Card key={note.id} className={cn('group transition-all duration-200 hover:shadow-md overflow-hidden', 'border-l-4', note.type === 'idea' && 'border-l-amber-500', note.type === 'complaint' && 'border-l-red-500', note.type === 'confusion' && 'border-l-purple-500', note.type === 'news' && 'border-l-blue-500', note.type === 'link' && 'border-l-green-500')}>
                <CardContent className="p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="min-h-20 resize-none" autoFocus />
                      <div className="flex flex-wrap items-center gap-2">
                        {editTags.map((tag) => (<Badge key={tag} variant="secondary" className="gap-1 px-2.5 py-1 rounded-full">{tag}<X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => removeTag(tag, true)} /></Badge>))}
                        <Input placeholder="添加标签..." value={editTagInput} onChange={(e) => setEditTagInput(e.target.value)} onKeyDown={(e) => handleKeyDown(e, true)} className="w-24 h-7 text-sm border-0 bg-slate-100 dark:bg-slate-800 rounded-full px-3" />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={cancelEdit}>取消</Button>
                        <Button size="sm" onClick={() => saveEdit(note.id)} className="gap-1"><Check className="w-4 h-4" />保存</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={cn('gap-1 px-2.5 py-1 rounded-full border', typeConfig.color, typeConfig.bgColor, typeConfig.borderColor)}>{typeConfig.icon}<span>{typeConfig.label}</span></Badge>
                          {note.isAiAnalyzed && <Badge variant="outline" className="gap-1 px-1.5 py-0.5 text-[10px] text-purple-500 border-purple-200 dark:border-purple-800"><Wand2 className="w-2.5 h-2.5" />AI</Badge>}
                          <span className="text-xs text-slate-400 dark:text-slate-500">{formatTime(note.createdAt)}</span>
                          {note.reminderAt && <Badge variant="outline" className="gap-1 px-2 py-0.5 text-xs text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800"><Bell className="w-3 h-3" />{formatReminderTime(note.reminderAt)}</Badge>}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(note)} className="h-8 w-8 text-slate-400 hover:text-blue-500"><Edit3 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteNote(note.id)} className="h-8 w-8 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      {note.images && note.images.length > 0 && <div className="flex flex-wrap gap-2 mb-3">{note.images.map((img, index) => <img key={index} src={img} alt={`图片 ${index + 1}`} className="max-w-full h-auto rounded-lg border border-slate-200 dark:border-slate-700 max-h-48 object-cover" />)}</div>}
                      {note.content && <p className="text-slate-700 dark:text-slate-300 break-words leading-relaxed">{note.content}</p>}
                      {note.tags.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{note.tags.map((tag) => <Badge key={tag} variant="outline" className="text-xs px-2 py-0.5 rounded-full text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700">#{tag}</Badge>)}</div>}
                      {note.aiSuggestion && (
                        <div className="mt-3">
                          <button onClick={() => toggleSuggestion(note.id)} className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-600 transition-colors">
                            <Sparkles className="w-3 h-3" />AI 建议{isSuggestionExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          {isSuggestionExpanded && <p className="mt-1 text-sm text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 rounded-lg p-2">{note.aiSuggestion}</p>}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
        {notes.length > 0 && <div className="mt-8 text-center text-sm text-slate-400 dark:text-slate-500">共 {notes.length} 条记录{(searchQuery || filterType) && ` · 筛选到 ${filteredNotes.length} 条`}</div>}
      </div>
      <SyncDialog open={showSyncDialog} onOpenChange={setShowSyncDialog} syncCode={syncCode} onSyncCodeChange={setSyncCode} onSyncUp={syncUp} onSyncDown={syncDown} onCreateSyncCode={createSyncCode} isSyncing={isSyncing} lastSyncTime={lastSyncTime} />
      <NotificationPermissionDialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog} />
    </div>
  )
}
