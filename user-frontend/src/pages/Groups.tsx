import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGroupsStore } from '@/store'
import { groupsApi } from '@/api'
import { Avatar, Button, Modal, Input } from '@/components/common'
import type { Group } from '@/types'

export default function Groups() {
  const navigate = useNavigate()
  const { groups, setGroups, addGroup } = useGroupsStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')

  useEffect(() => {
    loadGroups()
  }, [])

  const loadGroups = async () => {
    try {
      setIsLoading(true)
      const data = await groupsApi.getGroups()
      setGroups(data)
    } catch (error) {
      console.error('Failed to load groups:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return

    try {
      const group = await groupsApi.createGroup({
        name: groupName,
        description: groupDesc || undefined,
      })
      addGroup(group)
      setShowCreateModal(false)
      setGroupName('')
      setGroupDesc('')
    } catch (error) {
      console.error('Failed to create group:', error)
    }
  }

  return (
    <div className="h-full flex">
      {/* Groups list */}
      <div className="w-80 bg-slate-800/30 border-r border-slate-700/50 flex flex-col">
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-100">群组</h2>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              创建群组
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              暂无群组
            </div>
          ) : (
            <div className="p-2">
              {groups.map((group) => (
                <GroupItem
                  key={group.group_id}
                  group={group}
                  onChat={() => navigate(`/chat?group_id=${group.group_id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Group detail */}
      <div className="flex-1 flex items-center justify-center text-slate-400">
        <p>选择一个群组查看详情</p>
      </div>

      {/* Create group modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="创建群组"
      >
        <div className="space-y-4">
          <Input
            label="群组名称"
            placeholder="请输入群组名称"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              群组描述 (选填)
            </label>
            <textarea
              placeholder="请输入群组描述"
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              取消
            </Button>
            <Button onClick={handleCreateGroup} disabled={!groupName.trim()}>
              创建
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function GroupItem({ group, onChat }: { group: Group; onChat: () => void }) {
  return (
    <div className="flex items-center p-3 rounded-lg hover:bg-slate-700/50 cursor-pointer group" onClick={onChat}>
      <Avatar name={group.name} src={group.avatar} size="md" />
      <div className="ml-3 flex-1 min-w-0">
        <p className="font-medium text-slate-100 truncate">{group.name}</p>
        <p className="text-sm text-slate-400">{group.member_count} 成员</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onChat()
        }}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-indigo-400 transition-opacity"
        title="发消息"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    </div>
  )
}
