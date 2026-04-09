import { Avatar } from '@/components/common'
import type { Group } from '@/types'

interface GroupListProps {
  groups: Group[]
  onSelect: (group: Group) => void
  selectedId?: number
}

export default function GroupList({ groups, onSelect, selectedId }: GroupListProps) {
  return (
    <div className="h-full overflow-y-auto">
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">暂无群组</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-700/50">
          {groups.map((group) => (
            <div
              key={group.group_id}
              onClick={() => onSelect(group)}
              className={`flex items-center p-3 cursor-pointer transition-colors ${
                selectedId === group.group_id
                  ? 'bg-indigo-600/20'
                  : 'hover:bg-slate-800'
              }`}
            >
              <Avatar name={group.name} src={group.avatar} size="md" />
              <div className="ml-3 flex-1 min-w-0">
                <p className="font-medium text-slate-100 truncate">{group.name}</p>
                <p className="text-sm text-slate-400">
                  {group.member_count} 成员
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
