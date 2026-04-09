import { useEffect, useState, useRef } from 'react'
import { useFilesStore } from '@/store'
import { filesApi } from '@/api'
import { Button } from '@/components/common'
import { formatFileSize, formatTime } from '@/utils/format'

export default function Files() {
  const { files, setFiles, addFile, removeFile, uploadProgress, setUploadProgress, clearUploadProgress } = useFilesStore()
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    try {
      setIsLoading(true)
      const data = await filesApi.getFiles()
      setFiles(data)
    } catch (error) {
      console.error('Failed to load files:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const fileId = Date.now().toString()

    try {
      setUploadProgress(fileId, 0)
      const fileInfo = await filesApi.uploadFile(file)
      addFile(fileInfo)
    } catch (error) {
      console.error('Failed to upload file:', error)
    } finally {
      clearUploadProgress(fileId)
      e.target.value = ''
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    try {
      await filesApi.deleteFile(fileId)
      removeFile(fileId)
    } catch (error) {
      console.error('Failed to delete file:', error)
    }
  }

  const handleDownload = (fileId: string) => {
    const url = filesApi.downloadFile(fileId)
    window.open(url, '_blank')
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return (
        <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    }
    if (type.includes('pdf')) {
      return (
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    }
    return (
      <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-100">文件</h2>
        <Button onClick={() => fileInputRef.current?.click()}>
          上传文件
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {/* Upload progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="mb-4 p-4 quantum-card">
          {Object.entries(uploadProgress).map(([fileId, progress]) => (
            <div key={fileId} className="flex items-center">
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="ml-3 text-sm text-slate-400">{progress}%</span>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <svg className="w-16 h-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p>暂无文件</p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="quantum-card p-4 flex items-center hover:border-indigo-500/50 transition-colors"
            >
              {getFileIcon(file.type)}
              <div className="ml-4 flex-1 min-w-0">
                <p className="font-medium text-slate-100 truncate">{file.name}</p>
                <p className="text-sm text-slate-400">
                  {formatFileSize(file.size)} · {formatTime(file.created_at)}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleDownload(file.id)}
                >
                  下载
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDeleteFile(file.id)}
                >
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
