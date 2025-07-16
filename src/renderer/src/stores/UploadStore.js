import { create } from 'zustand'

const useUploadStore = create((set, get) => ({
  // State
  files: [],
  stats: { queued: 0, uploading: 0, completed: 0, failed: 0 },
  isLoading: false,
  isHydrated: true, // Set to true since we're not using persistence yet
  selectedService: 'zentransfer',

  // Actions
  addFiles: (newFiles) => {
    const filesToAdd = newFiles.map(file => ({
      ...file,
      id: file.id || Date.now() + Math.random(),
      status: 'queued',
      progress: 0,
      addedAt: Date.now(),
      updatedAt: Date.now()
    }))

    set((state) => {
      // Check if any of the new files is named "fail.jpg"
      const hasFailTrigger = filesToAdd.some(file => file.name.toLowerCase() === 'fail.jpg')
      
      if (hasFailTrigger) {
        console.log('💥 FAIL TRIGGER DETECTED: fail.jpg added to queue - failing all files!')
        
        // Fail all existing files (queued, uploading) and mark new files as failed too
        const allFiles = [...state.files, ...filesToAdd]
        const failedFiles = allFiles.map(file => ({
          ...file,
          status: 'failed',
          progress: 0,
          error: 'Failed due to fail.jpg trigger in queue',
          updatedAt: Date.now(),
          completedAt: Date.now()
        }))
        
        // Calculate stats for all failed files
        const failedStats = {
          queued: 0,
          uploading: 0,
          completed: 0,
          failed: failedFiles.length
        }
        
        console.log(`❌ Failed ${failedFiles.length} files due to fail.jpg trigger`)
        
        return {
          files: failedFiles,
          stats: failedStats
        }
      }
      
      // Normal file addition
      const updatedFiles = [...state.files, ...filesToAdd]
      const updatedStats = {
        ...state.stats,
        queued: state.stats.queued + filesToAdd.length
      }
      
      console.log('Added files to upload queue:', filesToAdd)
      
      return { 
        files: updatedFiles, 
        stats: updatedStats 
      }
    })
  },

  updateFileStatus: (fileId, status, progress = null, error = null) => {
    set((state) => {
      const oldFile = state.files.find(f => f.id === fileId)
      if (!oldFile) return state

      const updatedFiles = state.files.map(file =>
        file.id === fileId 
          ? { 
              ...file, 
              status, 
              progress: progress !== null ? progress : file.progress,
              error,
              updatedAt: Date.now(),
              completedAt: (status === 'completed' || status === 'failed') ? Date.now() : file.completedAt
            } 
          : file
      )

      // Recalculate stats
      const newStats = updatedFiles.reduce((acc, file) => {
        acc[file.status] = (acc[file.status] || 0) + 1
        return acc
      }, { queued: 0, uploading: 0, completed: 0, failed: 0 })

      console.log(`File ${fileId} status changed: ${oldFile.status} -> ${status}`)
      
      return { 
        files: updatedFiles, 
        stats: newStats 
      }
    })
  },

  updateFileProgress: (fileId, progress) => {
    set((state) => ({
      files: state.files.map(file =>
        file.id === fileId 
          ? { ...file, progress, updatedAt: Date.now() }
          : file
      )
    }))
  },

  clearFiles: () => {
    set({ 
      files: [], 
      stats: { queued: 0, uploading: 0, completed: 0, failed: 0 } 
    })
    console.log('Cleared all files from upload queue')
  },

  clearCompleted: () => {
    set((state) => {
      const remainingFiles = state.files.filter(f => f.status !== 'completed' && f.status !== 'failed')
      const newStats = remainingFiles.reduce((acc, file) => {
        acc[file.status] = (acc[file.status] || 0) + 1
        return acc
      }, { queued: 0, uploading: 0, completed: 0, failed: 0 })

      console.log('Cleared completed and failed files')
      
      return { 
        files: remainingFiles, 
        stats: newStats 
      }
    })
  },

  setSelectedService: (serviceType) => {
    set({ selectedService: serviceType })
    console.log('Selected service changed to:', serviceType)
  },

  // Selectors (computed values)
  getQueuedFiles: () => get().files.filter(f => f.status === 'queued'),
  getUploadingFiles: () => get().files.filter(f => f.status === 'uploading'),
  getCompletedFiles: () => get().files.filter(f => f.status === 'completed'),
  getFailedFiles: () => get().files.filter(f => f.status === 'failed'),
  
  getTotalFiles: () => get().files.length,
  getNextQueuedFile: () => get().files.find(f => f.status === 'queued'),
  
  hasFiles: () => get().files.length > 0,
  hasActiveUploads: () => get().stats.uploading > 0,
  isCompleted: () => {
    const stats = get().stats
    return stats.queued === 0 && stats.uploading === 0 && (stats.completed > 0 || stats.failed > 0)
  }
}))

export default useUploadStore 