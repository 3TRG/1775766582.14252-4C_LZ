import { create } from 'zustand'

interface UIState {
  sidebarCollapsed: boolean
  rightPanelOpen: boolean
  activeModal: string | null
  modalData: unknown
  toasts: Toast[]

  // Actions
  toggleSidebar: () => void
  setRightPanelOpen: (open: boolean) => void
  openModal: (modalId: string, data?: unknown) => void
  closeModal: () => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  rightPanelOpen: false,
  activeModal: null,
  modalData: null,
  toasts: [],

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),

  openModal: (modalId, data) =>
    set({ activeModal: modalId, modalData: data }),

  closeModal: () => set({ activeModal: null, modalData: null }),

  addToast: (toast) => {
    const id = Date.now().toString()
    const newToast = { ...toast, id }

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }))

    // Auto remove after duration
    const duration = toast.duration || 3000
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    }, duration)
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))
