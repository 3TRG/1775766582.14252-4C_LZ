import React from 'react';
import { useQKEStore } from '../../store';

interface QKEEvent {
  id: string;
  type: 'system' | 'election' | 'qka' | 'qkd' | 'measurement' | 'sync' | 'verify' | 'security' | 'stats';
  level: 1 | 2 | 3 | 4 | 5;
  timestamp: string;
  summary: string;
  details?: any;
  isExpanded?: boolean;
}

const EventTimeline: React.FC = () => {
  const { events, toggleEventExpansion } = useQKEStore();

  // 获取最近的50个事件，按时间倒序
  const visibleEvents = [...events]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50);

  const getEventTypeColor = (type: QKEEvent['type']) => {
    switch (type) {
      case 'system': return 'bg-gray-100 text-gray-800';
      case 'election': return 'bg-blue-100 text-blue-800';
      case 'qka': return 'bg-green-100 text-green-800';
      case 'qkd': return 'bg-yellow-100 text-yellow-800';
      case 'measurement': return 'bg-purple-100 text-purple-800';
      case 'sync': return 'bg-indigo-100 text-indigo-800';
      case 'verify': return 'bg-red-100 text-red-800';
      case 'security': return 'bg-orange-100 text-orange-800';
      case 'stats': return 'bg-teal-100 text-teal-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventLevelColor = (level: QKEEvent['level']) => {
    switch (level) {
      case 1: return 'border-l-2 border-blue-500';
      case 2: return 'border-l-2 border-green-500';
      case 3: return 'border-l-2 border-yellow-500';
      case 4: return 'border-l-2 border-red-500';
      case 5: return 'border-l-2 border-purple-500';
      default: return 'border-l-2 border-gray-500';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  if (visibleEvents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold text-gray-800">事件时间线</h3>
        </div>
        <div className="text-center py-8 text-gray-500">
          暂无事件记录
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="flex justify-between items-start px-4 pt-3 pb-2">
        <h3 className="text-lg font-semibold text-gray-800">事件时间线</h3>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">显示最近 {visibleEvents.length} 条</span>
        </div>
      </div>
      <div className="border-t border-gray-200">
        <div className="space-y-1">
          {visibleEvents.map((event) => (
            <div
              key={event.id}
              className={`border-l-4 pl-3 py-2 ${getEventLevelColor(event.level)} hover:bg-gray-50 transition-colors`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center space-x-2">
                  <span className={`${getEventTypeColor(event.type)} text-xs px-2 py-0.5 rounded-full`}>
                    {event.type}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
                <button
                  onClick={() => toggleEventExpansion(event.id)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {event.isExpanded ? '收起' : '展开'}
                </button>
              </div>
              <div className="flex-1 min-w-0 break-words text-sm text-gray-700">
                {event.summary}
              </div>
              {event.isExpanded && event.details && (
                <div className="mt-2 pl-4 text-xs text-gray-600 break-words">
                  <pre className="bg-gray-50 p-2 rounded">{JSON.stringify(event.details, null, 2)}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EventTimeline;