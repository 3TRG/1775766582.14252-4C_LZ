import { apiClient } from './client'

export interface FileInfo {
  id: string
  name: string
  size: number
  type: string
  url: string
  created_at: string
}

export const filesApi = {
  getFiles: async (): Promise<FileInfo[]> => {
    const response = await apiClient.get<FileInfo[]>('/files')
    return response.data
  },

  uploadFile: async (file: File): Promise<FileInfo> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post<FileInfo>('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  deleteFile: async (fileId: string): Promise<void> => {
    await apiClient.delete(`/files/${fileId}`)
  },

  downloadFile: (fileId: string): string => {
    return `${apiClient.defaults.baseURL}/files/${fileId}/download`
  },
}
