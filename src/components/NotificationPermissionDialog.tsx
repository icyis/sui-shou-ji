'use client'

import { Bell } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationPermissionDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Bell className="w-5 h-5 text-orange-500" />
            开启通知权限
          </DialogTitle>
          <DialogDescription className="text-left pt-2">
            提醒功能需要开启浏览器通知权限
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">请按以下步骤操作：</p>
            <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside">
              <li>点击地址栏左侧的 🔒 图标</li>
              <li>找到「通知」选项</li>
              <li>选择「允许」</li>
              <li>刷新页面后生效</li>
            </ol>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => onOpenChange(false)} className="bg-orange-500 hover:bg-orange-600">我知道了</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
