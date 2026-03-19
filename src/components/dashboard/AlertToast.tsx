'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Bell, Plane, X } from 'lucide-react'

export default function AlertToast() {
  const [notification, setNotification] = useState<any>(null)

  useEffect(() => {
    const channel = supabase
      .channel('realtime_notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          setNotification(payload.new)
          // Auto-hide após 10 segundos
          setTimeout(() => setNotification(null), 10000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (!notification) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-bounce">
      <div className="bg-blue-600 text-white p-4 rounded-lg shadow-2xl border border-blue-400 flex items-start gap-4 max-w-sm">
        <div className="bg-blue-500 p-2 rounded-full">
          <Plane className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold flex items-center gap-2">
            <Bell className="h-4 w-4" /> OPORTUNIDADE!
          </h4>
          <p className="text-sm opacity-90">
            Passagem encontrada na {notification.airline} por {notification.found_miles.toLocaleString()} milhas!
          </p>
        </div>
        <button onClick={() => setNotification(null)} className="hover:bg-blue-700 p-1 rounded">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}