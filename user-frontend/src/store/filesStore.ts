import { create } from 'zustand'
import type { FileInfo } from '@/api/files'

interface FilesState {
  files: FileInfo[]
  isLoading: boolean
  uploadProgress: Record<string, number>

  // Actions
  setFiles: (files: FileInfo[]) => void
  addFile: (file: FileInfo) => void
  removeFile: (fileId: string) => void
  setLoading: (loading: boolean) => void
  setUploadProgress: (fileId: string, progress: number) => void
  clearUploadProgress: (fileId: string) => void
}

export const useFilesStore = create<FilesState>((set) => ({
  files: [],
  isLoading: false,
  uploadProgress: {},

  setFiles: (files) => set({ files }),

  addFile: (file) =>
    set((state) => ({
      files: [file, ...state.files],
    })),

  removeFile: (fileId) =>
    set((state) => ({
      files: state.files.filter((f) => f.id !== fileId),
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  setUploadProgress: (fileId, progress) =>
    set((state) => ({
      uploadProgress: { ...state.uploadProgress, [fileId]: progress },
    })),

  clearUploadProgress: (fileId) =>
    set((state) => {
      const { [fileId]: _, ...rest } = state.uploadProgress
      return { uploadProgress: rest }
    }),
}))
