import { useEffect, useMemo, useState, useRef } from 'react';
import TopologyVisualization from './components/TopologyVisualization';
import { useQKEStore } from './store';
import { useRealtime } from './hooks/useRealtime';
import { deleteUser as apiDeleteUser } from './services/api';
import * as echarts from 'echarts';
import KeyManagementPage from './pages/KeyManagement';
import RiskAlertPage from './pages/RiskAlert';
import SystemConfigPage from './pages/SystemConfig';

function App() {
  const [activePanel, setActivePanel] = useState<'page1' | 'page2' | 'page3' | 'keys' | 'alerts' | 'config'>('page1');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminSessions, setAdminSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  // 用户状态显示类型
  const [userStatusType, setUserStatusType] = useState<'group' | 'private'>('group');
  // 私聊分支选择
  const [privateChatBranch, setPrivateChatBranch] = useState<'file_assistant' | 'product_manager' | 'tech_support'>('file_assistant');
  
  // 图表引用
  const resourceChartRef = useRef<HTMLDivElement>(null);
  const roundChartRef = useRef<HTMLDivElement>(null);
  const entropyChartRef = useRef<HTMLDivElement>(null);
  
  // 图表实例
  const resourceChartInstance = useRef<echarts.ECharts | null>(null);
  const roundChartInstance = useRef<echarts.ECharts | null>(null);
  const entropyChartInstance = useRef<echarts.ECharts | null>(null);
  const {
    participants,
    rounds,
    statistics,
    events,
    users,
    onlineUsers,
    wsConnected,
    setAdminSnapshot,
    removeUser
  } = useQKEStore();
  
  // 启用实时WebSocket连接
  useRealtime();
  
  // 私聊分支对应的QKE会话ID
  const privateChatSessions = {
    file_assistant: 1,  // 文件助手对应的QKE会话ID
    product_manager: 2, // 产品经理对应的QKE会话ID
    tech_support: 1     // 技术支持对应的QKE会话ID（使用现有会话）
  };
  
  // 从QKE事件中提取密钥信息
  const getKeyInfo = () => {
    // 查找包含密钥信息的事件
    const keyEvent = events.find((event: any) => 
      (event.type === 'verify' || event.type === 'system') && 
      event.details && 
      (event.details.interim_key || event.details.shared_key)
    );
    
    if (keyEvent) {
      const keyData = keyEvent.details.interim_key || keyEvent.details.shared_key;
      const keyLength = keyEvent.details.key_length || 35;
      const entropy = keyEvent.details.entropy ? 
        (typeof keyEvent.details.entropy === 'number' ? keyEvent.details.entropy : keyEvent.details.entropy.shannon_entropy) : 
        0.04;
      
      // 确保keyData是数组格式
      const formattedKeyData = typeof keyData === 'string' ? 
        keyData.split('') : 
        Array.isArray(keyData) ? keyData : 
        Array.from({ length: keyLength || 35 }, () => Math.random() > 0.5 ? '1' : '0');
      
      return {
        keyData: formattedKeyData,
        keyLength: keyLength || formattedKeyData.length,
        entropy: entropy
      };
    }
    
    // 默认值
    return {
      keyData: Array.from({ length: 35 }, () => Math.random() > 0.5 ? '1' : '0'),
      keyLength: 35,
      entropy: 0.04
    };
  };

  const loadAdminSessions = async () => {
    const res = await fetch('/api/v1/admin/qke/sessions');
    if (!res.ok) throw new Error('获取会话列表失败');
    const rows = await res.json();
    const sessions = (rows || []).map((s: any) => ({
      session_id: String(s.session_id),
      status: String(s.status || ''),
      created_at: s.start_time || null,
      completed_at: s.end_time || null,
      total_participants: Number(s.participant_count || 0),
      key_length: Number(s.key_length || 0),
      decoy_count: 0
    }));
    setAdminSessions(sessions);
    if (!selectedSessionId && sessions.length) {
      setSelectedSessionId(sessions[0].session_id);
    }
  };

  const loadSnapshot = async (sessionId: string) => {
    const detailRes = await fetch(`/api/v1/admin/qke/sessions/${sessionId}`);
    if (!detailRes.ok) throw new Error('获取会话快照失败');
    const detail = await detailRes.json();

    const eventsRes = await fetch(`/api/v1/admin/qke/sessions/${sessionId}/events?limit=500`);
    const eventRows = eventsRes.ok ? await eventsRes.json() : [];

    const memberRows = detail.members || [];
    const members = memberRows.map((m: any) => ({
      id: Number(m.user_id),
      original_id: m.username || `U${m.user_id}`,
      is_leader: m.logical_role === 'leader',
      joined_at: m.joined_at || undefined
    }));

    const roundRows = detail.rounds || [];
    const leaderIds = members.filter((p: any) => p.is_leader).map((p: any) => p.id);
    const leaderFallback = leaderIds.length ? leaderIds[0] : '';
    const roundsPayload = roundRows.map((r: any) => ({
      round_number: Number(r.round_number),
      group_type: String(r.group_type || ''),
      leader_id: r.leader_user_id ? Number(r.leader_user_id) : leaderFallback,
      state_type: String(r.state_type || ''),
      participants: Array.isArray(r.participants) ? r.participants.map((x: any) => Number(x)) : [],
      qubits_used: Number(r.qubits_used || 0),
      key_synchronization: {
        diff_positions: Array.isArray(r.diff_positions) ? r.diff_positions.map((x: any) => Number(x)) : [],
        total_bit_flips: Number(r.total_bit_flips || 0)
      }
    }));

    const mapEventType = (eventType: string) => {
    if (eventType === 'leaders_elected') return 'election';
    if (eventType === 'round_started') return 'qkd';
    if (eventType === 'round_measured') return 'measurement';
    if (eventType === 'key_generated' || eventType === 'epoch_activated' || eventType === 'protocol_completed') return 'verify';
    if (eventType === 'message_encrypted' || eventType === 'file_encrypted') return 'sync';
    if (eventType === 'message_delivered' || eventType === 'file_delivered') return 'stats';
    return 'system';
  };

    const mapLevel = (stage: string) => {
      if (stage === 'created') return 1;
      if (stage === 'assign_role') return 2;
      if (stage === 'transport') return 2;
      if (stage === 'quantum_exchange') return 3;
      if (stage === 'measure') return 3;
      if (stage === 'verify') return 4;
      if (stage === 'activate') return 4;
      return 1;
    };

    const eventsPayload = (eventRows || []).map((e: any) => {
      let details: any = undefined;
      if (e.detail) {
        try {
          details = JSON.parse(e.detail);
        } catch (_) {
          details = e.detail;
        }
      }
      const stage = String(e.event_stage || '');
      const type = mapEventType(String(e.event_type || 'system'));
      const level = mapLevel(stage) as 1 | 2 | 3 | 4 | 5;
      return {
        id: String(e.event_id || e.id || `${e.event_type}-${e.event_time}`),
        type,
        level,
        timestamp: String(e.event_time || ''),
        summary: String(e.title || e.event_type || ''),
        details
      };
    });

    const s = detail.session || {};
    const snapshot = {
      session_id: String(s.id || sessionId),
      participants: members,
      rounds: roundsPayload,
      statistics: {
        quantum_cost: Number(s.quantum_cost || 0),
        pauli_ops: Number(s.pauli_ops || 0),
        bit_flips: Number(s.bit_flips || 0),
        total_quantum_ops: Number(s.total_quantum_ops || 0),
        classical_cost: Number(s.classical_cost || 0),
        latency: Number((s.latency_ms || 0) / 1000),
        key_rate: Number(s.key_rate || 0)
      },
      events: eventsPayload
    };

    setAdminSnapshot(snapshot as any);
  };

  useEffect(() => {
    setSelectedSessionId(null);
    setAdminSessions([]);
    (async () => {
      try {
        await loadAdminSessions();
      } catch (e) {
        console.warn(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSessionId) return;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        await loadSnapshot(selectedSessionId);
      } catch (e) {
        setError(e instanceof Error ? e.message : '未知错误');
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId]);
  
  // 私聊分支切换时加载对应的QKE会话
  useEffect(() => {
    if (userStatusType === 'private') {
      const sessionId = privateChatSessions[privateChatBranch];
      console.log('[QKE] 切换到私聊分支:', privateChatBranch, 'QKE会话ID:', sessionId);
      setSelectedSessionId(sessionId.toString());
    }
  }, [userStatusType, privateChatBranch, privateChatSessions, setSelectedSessionId]);
  
  // 初始化和更新图表
  useEffect(() => {
    if (activePanel !== 'page3') return;
    
    // 使用setTimeout确保DOM已经渲染
    const timer = setTimeout(() => {
      // 资源消耗分析图表
      if (resourceChartRef.current && !resourceChartInstance.current) {
        try {
          resourceChartInstance.current = echarts.init(resourceChartRef.current);
        } catch (e) {
          console.error('[Chart] 初始化资源图表失败:', e);
          return;
        }
        const resourceXAxis = (rounds || []).map((r: any) => `轮次${r.round_number}`);
        const resourceQuantum = (rounds || []).map((r: any) => Number(r.qubits_used || 0));
        const resourceClassic = (rounds || []).map((r: any) => Number((r.key_synchronization?.total_bit_flips || 0) + 5));
        
        const resourceOption = {
          tooltip: {
            trigger: 'axis',
            axisPointer: {
              type: 'shadow'
            }
          },
          legend: {
            data: ['量子资源', '经典资源'],
            textStyle: {
              color: '#888'
            }
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
          },
          xAxis: {
            type: 'category',
            data: resourceXAxis.length ? resourceXAxis : ['轮次1'],
            axisLabel: {
              color: '#888'
            }
          },
          yAxis: {
            type: 'value',
            axisLabel: {
              color: '#888'
            }
          },
          series: [
            {
              name: '量子资源',
              type: 'bar',
              data: resourceQuantum.length ? resourceQuantum : [0],
              itemStyle: {
                color: '#00d4ff'
              }
            },
            {
              name: '经典资源',
              type: 'bar',
              data: resourceClassic.length ? resourceClassic : [0],
              itemStyle: {
                color: '#9d4edd'
              }
            }
          ]
        };
        resourceChartInstance.current.setOption(resourceOption);
      }
      
      // 轮次性能对比图表
      if (roundChartRef.current) {
        roundChartInstance.current = echarts.init(roundChartRef.current);
        const roundXAxis = (rounds || []).map((r: any) => `轮次${r.round_number}`);
        const roundRate = (rounds || []).map(() => Number(statistics?.key_rate || 0));
        const roundLatency = (rounds || []).map((r: any) => Number((r.round_latency_ms || 0) / 1000));
        
        const roundOption = {
          tooltip: {
            trigger: 'axis'
          },
          legend: {
            data: ['密钥生成率', '延迟'],
            textStyle: {
              color: '#888'
            }
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
          },
          xAxis: {
            type: 'category',
            data: roundXAxis.length ? roundXAxis : ['轮次1'],
            axisLabel: {
              color: '#888'
            }
          },
          yAxis: [
            {
              type: 'value',
              name: '密钥生成率(bits/s)',
              position: 'left',
              axisLabel: {
                color: '#888'
              }
            },
            {
              type: 'value',
              name: '延迟(s)',
              position: 'right',
              axisLabel: {
                color: '#888'
              }
            }
          ],
          series: [
            {
              name: '密钥生成率',
              type: 'line',
              data: roundRate.length ? roundRate : [0],
              itemStyle: {
                color: '#00ff88'
              },
              symbol: 'circle',
              symbolSize: 8
            },
            {
              name: '延迟',
              type: 'line',
              yAxisIndex: 1,
              data: roundLatency.length ? roundLatency : [0],
              itemStyle: {
                color: '#ffcc00'
              },
              symbol: 'circle',
              symbolSize: 8
            }
          ]
        };
        roundChartInstance.current.setOption(roundOption);
      }
      
      // 密钥熵值分析图表
      if (entropyChartRef.current) {
        entropyChartInstance.current = echarts.init(entropyChartRef.current);
        const entropyXAxis = (rounds || []).map((r: any) => `轮次${r.round_number}`);
        const keyLength = Number((adminSessions || []).find((s: any) => String(s.session_id) === String(selectedSessionId))?.key_length || 64);
        const denom = Math.max(1, keyLength);
        const entropyData = (rounds || []).map((r: any) => {
          const flips = Number(r.key_synchronization?.total_bit_flips || 0);
          return Math.max(0, Math.min(1, 1 - flips / denom));
        });
        
        const entropyOption = {
          tooltip: {
            trigger: 'axis'
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
          },
          xAxis: {
            type: 'category',
            data: entropyXAxis.length ? entropyXAxis : ['轮次1'],
            axisLabel: {
              color: '#888'
            }
          },
          yAxis: {
            type: 'value',
            min: 0,
            max: 1,
            axisLabel: {
              color: '#888'
            }
          },
          series: [
            {
              name: '密钥熵值',
              type: 'line',
              data: entropyData,
              areaStyle: {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: 'rgba(0, 212, 255, 0.3)' },
                    { offset: 1, color: 'rgba(0, 212, 255, 0.1)' }
                  ]
                }
              },
              itemStyle: {
                color: '#00d4ff'
              },
              symbol: 'circle',
              symbolSize: 4
            }
          ]
        };
        entropyChartInstance.current.setOption(entropyOption);
      }
    }, 100);
    
    // 清理函数
    return () => {
      clearTimeout(timer);
      resourceChartInstance.current?.dispose();
      resourceChartInstance.current = null;
      roundChartInstance.current?.dispose();
      roundChartInstance.current = null;
      entropyChartInstance.current?.dispose();
      entropyChartInstance.current = null;
    };
  }, [activePanel, rounds, statistics, adminSessions, selectedSessionId]);

  return (
    <div className="min-h-screen flex">
      {/* 背景效果 */}
      <div className="quantum-bg fixed inset-0 -z-10"></div>

      {/* 左侧导航栏 */}
      <nav className="navbar bg-[rgba(10,14,39,0.85)] backdrop-blur-xl border-r border-quantum-border w-64 h-screen fixed left-0 top-0 z-50">
        <div className="flex flex-col h-full">
          {/* Logo和标题 */}
          <div className="p-4 border-b border-quantum-border">
            <div className="flex items-center gap-4">
              <div className="quantum-logo w-10 h-10">
                <svg viewBox="0 0 100 100" className="atom-icon animate-rotate w-full h-full">
                  <circle cx="50" cy="50" r="8" fill="#00d4ff"/>
                  <ellipse cx="50" cy="50" rx="30" ry="8" fill="none" stroke="#00d4ff" strokeWidth="2" className="orbit"/>
                  <ellipse cx="50" cy="50" rx="30" ry="8" fill="none" stroke="#00d4ff" strokeWidth="2" className="orbit" style={{ transform: 'rotate(60deg)' }}/>
                </svg>
              </div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-quantum-blue to-quantum-purple bg-clip-text text-transparent">
                QKE-Viz
              </h1>
            </div>
          </div>
          
          {/* 导航链接 */}
          <div className="nav-links flex flex-col gap-2 p-4 flex-1">
            <a
              href="#page1"
              className={`nav-link ${activePanel === 'page1' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setActivePanel('page1'); }}
            >
              用户状态
            </a>
            <a
              href="#page2"
              className={`nav-link ${activePanel === 'page2' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setActivePanel('page2'); }}
            >
              QKE过程
            </a>
            <a
              href="#page3"
              className={`nav-link ${activePanel === 'page3' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setActivePanel('page3'); }}
            >
              性能分析
            </a>
            <div className="border-t border-quantum-border my-2"></div>
            <a
              href="#keys"
              className={`nav-link ${activePanel === 'keys' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setActivePanel('keys'); }}
            >
              密钥管理
            </a>
            <a
              href="#alerts"
              className={`nav-link ${activePanel === 'alerts' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setActivePanel('alerts'); }}
            >
              风险告警
            </a>
            <a
              href="#config"
              className={`nav-link ${activePanel === 'config' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setActivePanel('config'); }}
            >
              系统配置
            </a>
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="flex-1 ml-64 pt-8 px-10 max-w-7xl">
        {/* 顶部操作栏 */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">会话</span>
            <select
              className="bg-[rgba(0,0,0,0.35)] border border-[rgba(0,212,255,0.2)] rounded-lg px-3 py-2 text-gray-200 text-sm min-w-[320px]"
              value={selectedSessionId || ''}
              onChange={(e) => setSelectedSessionId(e.target.value || null)}
            >
              {adminSessions.length === 0 ? (
                <option value="">暂无会话</option>
              ) : (
                adminSessions.map((s: any) => (
                  <option key={s.session_id} value={s.session_id}>
                    {`QKE#${s.session_id} | ${s.status} | N=${s.total_participants} M=${s.key_length}`}
                  </option>
                ))
              )}
            </select>
            <button
              className={`quantum-btn secondary ${isLoading ? 'opacity-60' : ''}`}
              onClick={async () => {
                setIsLoading(true);
                setError(null);
                try {
                  await loadAdminSessions();
                  if (selectedSessionId) {
                    await loadSnapshot(selectedSessionId);
                  }
                } catch (e) {
                  setError(e instanceof Error ? e.message : '未知错误');
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
            >
              刷新
            </button>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* 管理员账户按钮 */}
            <div className="bg-gradient-to-r from-quantum-blue to-quantum-purple text-white px-4 py-2 rounded-full text-sm font-medium">
              管理员账户
            </div>
          </div>
        </div>

        {error && (
          <div className="error-message mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Page1：用户状态 + 网络拓扑 */}
        {activePanel === 'page1' && (
          <div className="panel">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-quantum-blue text-sm uppercase tracking-wider">所有用户</h3>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                      <span className="text-xs text-gray-400">{wsConnected ? '实时' : '离线'}</span>
                      <span className="text-xs text-quantum-green">在线: {onlineUsers?.size || 0}</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[rgba(255,255,255,0.1)]">
                          <th className="text-left py-2">用户ID</th>
                          <th className="text-left py-2">用户名</th>
                          <th className="text-left py-2">角色</th>
                          <th className="text-left py-2">状态</th>
                          <th className="text-left py-2">操作</th>
                        </tr>
                      </thead>
                      <tbody className="max-h-[500px] overflow-y-auto">
                        {users.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-gray-400 py-4 text-center">暂无用户数据，等待用户注册...</td>
                          </tr>
                        ) : (
                          users.map((u: any) => {
                            const isOnline = onlineUsers?.has(u.user_id) || false;
                            const roleColor = u.role === 'leader' ? 'text-quantum-blue' : 'text-gray-300';
                            const rowClass = isOnline 
                              ? 'bg-[rgba(0,255,136,0.1)] border-l-2 border-l-quantum-green' 
                              : 'border-b border-[rgba(255,255,255,0.05)]';
                            return (
                              <tr key={u.user_id} className={rowClass}>
                                <td className="py-2 pl-2">{u.user_id}</td>
                                <td className="py-2 font-medium">{u.username}</td>
                                <td className={`py-2 ${roleColor}`}>{u.role === 'leader' ? 'Leader' : 'Follower'}</td>
                                <td className="py-2">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></span>
                                    {isOnline ? '在线' : '离线'}
                                  </span>
                                </td>
                                <td className="py-2">
                                  <button
                                    onClick={() => {
                                      if (confirm(`确定要删除用户 "${u.username}" (ID: ${u.user_id}) 吗？此操作不可撤销。`)) {
                                        apiDeleteUser(u.user_id)
                                          .then(() => removeUser(u.user_id))
                                          .catch((err) => alert(`删除失败: ${err.message}`));
                                      }
                                    }}
                                    className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors"
                                  >
                                    删除
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 bg-gradient-to-br from-[rgba(0,212,255,0.08)] to-[rgba(157,78,221,0.08)] border border-[rgba(0,212,255,0.2)] rounded-xl p-4">
                <h3 className="text-quantum-blue text-sm uppercase tracking-wider mb-4">网络拓扑</h3>
                <div className="min-h-[500px]">
                  {/* 网络拓扑可视化 - 使用实时用户数据 */}
                  <TopologyVisualization 
                    nodes={users.map((u: any) => ({
                      id: u.user_id,
                      type: (u.role === 'leader' ? 'leader' : 'follower') as 'leader' | 'follower',
                      label: u.username,
                      isOnline: onlineUsers?.has(u.user_id) || false
                    }))} 
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Page2：QKE过程（事件流 + 轮次/电路） */}
        {activePanel === 'page2' && (
          <div className="panel">
            {/* 状态切换按钮 */}
            <div className="flex gap-2 mb-4">
              <button
                className={userStatusType === 'group' ? 'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-300 bg-gradient-to-r from-quantum-blue to-quantum-purple text-white' : 'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-300 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-gray-300 hover:bg-[rgba(255,255,255,0.05)]'}
                onClick={() => setUserStatusType('group')}
              >
                群聊用户状态
              </button>
              <button
                className={userStatusType === 'private' ? 'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-300 bg-gradient-to-r from-quantum-blue to-quantum-purple text-white' : 'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-300 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-gray-300 hover:bg-[rgba(255,255,255,0.05)]'}
                onClick={() => setUserStatusType('private')}
              >
                私聊用户状态
              </button>
            </div>
            
            {/* 私聊分支选择 */}
            {userStatusType === 'private' && (
              <div className="flex gap-2 mb-4">
                <button
                  className={privateChatBranch === 'file_assistant' ? 'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-300 bg-gradient-to-r from-quantum-blue to-quantum-purple text-white' : 'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-300 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-gray-300 hover:bg-[rgba(255,255,255,0.05)]'}
                  onClick={() => setPrivateChatBranch('file_assistant')}
                >
                  文件助手
                </button>
                <button
                  className={privateChatBranch === 'product_manager' ? 'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-300 bg-gradient-to-r from-quantum-blue to-quantum-purple text-white' : 'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-300 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-gray-300 hover:bg-[rgba(255,255,255,0.05)]'}
                  onClick={() => setPrivateChatBranch('product_manager')}
                >
                  产品经理
                </button>
                <button
                  className={privateChatBranch === 'tech_support' ? 'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-300 bg-gradient-to-r from-quantum-blue to-quantum-purple text-white' : 'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-300 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-gray-300 hover:bg-[rgba(255,255,255,0.05)]'}
                  onClick={() => setPrivateChatBranch('tech_support')}
                >
                  技术支持
                </button>
              </div>
            )}
            
            {/* 三个主要卡片 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 左侧用户状态 */}
              <div className="lg:col-span-1">
                <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-xl p-4">
                  <h3 className="text-quantum-blue text-sm uppercase tracking-wider mb-4">
                    {userStatusType === 'group' ? '群聊用户状态' : '私聊用户状态'}
                  </h3>
                  <div className="overflow-y-auto max-h-[400px]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[rgba(255,255,255,0.1)]">
                          <th className="text-left py-2">用户名</th>
                          <th className="text-left py-2">用户ID</th>
                          <th className="text-left py-2">角色</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participants.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-gray-400 py-4 text-center">暂无会话数据，请先在用户端建立会话并产生通信</td>
                          </tr>
                        ) : (
                          participants.map((p: any) => {
                            const role = p.is_leader ? 'Leader' : 'Follower';
                            const color = p.is_leader ? 'text-quantum-blue' : 'text-gray-300';
                            return (
                              <tr key={p.id} className="border-b border-[rgba(255,255,255,0.05)]">
                                <td className="py-2">{p.original_id || `U${p.id}`}</td>
                                <td className="py-2">{p.id}</td>
                                <td className={`py-2 ${color}`}>{role}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* 中间实时协商过程 */}
              <div className="lg:col-span-1">
                <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-xl p-4">
                  <h3 className="text-quantum-blue text-sm uppercase tracking-wider mb-4">实时协商过程</h3>
                  <div className="overflow-y-auto max-h-[400px]">
                    {events.length === 0 ? (
                      <div className="text-gray-400 text-sm p-4">暂无事件，请先在用户端产生通信</div>
                    ) : (
                      events.map((event) => (
                        <div key={event.id} className="mb-2 p-2 bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.05)] rounded">
                          <div className="font-medium text-quantum-blue">[{event.type}] {event.summary}</div>
                          {event.details && (
                            <div className="text-xs text-gray-400 mt-1">
                              {JSON.stringify(event.details)}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* 右侧电路图和轮次选择 */}
              <div className="lg:col-span-1">
                <div className="space-y-4">
                  <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-xl p-4">
                    <h3 className="text-quantum-blue text-sm uppercase tracking-wider mb-4">基于参与者人数轮次的电路图</h3>
                    <div className="h-[200px] bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.05)] rounded flex items-center justify-center">
                      <div className="text-gray-400">电路图展示</div>
                    </div>
                  </div>
                  
                  <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-xl p-4">
                    <h3 className="text-quantum-blue text-sm uppercase tracking-wider mb-4">轮次选择</h3>
                    <div className="overflow-y-auto max-h-[150px] space-y-2">
                      {rounds.map((round: any) => (
                        <button key={round.round_number} className="w-full bg-[rgba(0,0,0,0.2)] hover:bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.05)] text-gray-300 py-2 px-3 rounded text-sm">
                          Round {round.round_number}
                        </button>
                      ))}
                      {rounds.length === 0 && (
                        <div className="text-gray-400 text-sm p-4">暂无轮次数据</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 共享密钥生成 */}
            <div className="mt-6">
              <div className="bg-gradient-to-br from-[rgba(0,212,255,0.08)] to-[rgba(157,78,221,0.08)] border border-[rgba(0,212,255,0.2)] rounded-xl p-4">
                <h3 className="text-quantum-blue text-sm uppercase tracking-wider mb-4">共享密钥生成</h3>
                <div className="grid grid-cols-1 gap-4">
                  {/* 密钥数据展示 */}
                  <div className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl p-4">
                    <div className="grid grid-cols-12 gap-1">
                      {(() => {
                        const keyInfo = getKeyInfo();
                        return (keyInfo.keyData || []).map((bit: string, i: number) => (
                          <div key={i} className="bg-gradient-to-r from-quantum-blue to-quantum-purple text-white p-2 rounded text-center font-mono">
                            {bit}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                  
                  {/* 密钥信息 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl p-4 text-center">
                      <div className="text-gray-400 text-xs mb-1">密钥长度</div>
                      <div className="text-2xl font-bold text-white font-mono">{getKeyInfo().keyLength} bits</div>
                    </div>
                    <div className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl p-4 text-center">
                      <div className="text-gray-400 text-xs mb-1">熵值</div>
                      <div className="text-2xl font-bold text-white font-mono">{getKeyInfo().entropy}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Page3：性能分析 */}
        {activePanel === 'page3' && (
          <div className="panel">
            <div className="grid grid-cols-1 gap-6">
              {/* 性能指标和图表 */}
              <div>
                {/* 性能指标卡片 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl p-4">
                    <div className="text-quantum-blue text-2xl mb-2">⚡</div>
                    <div className="text-gray-400 text-xs mb-1">密钥生成率</div>
                    <div className="text-2xl font-bold text-white font-mono">
                      {statistics.key_rate ? statistics.key_rate.toFixed(2) : '0.00'}
                    </div>
                    <div className="text-gray-400 text-xs">bits/s</div>
                  </div>
                  <div className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl p-4">
                    <div className="text-quantum-blue text-2xl mb-2">🔄</div>
                    <div className="text-gray-400 text-xs mb-1">总延迟</div>
                    <div className="text-2xl font-bold text-white font-mono">
                      {statistics.latency ? statistics.latency.toFixed(3) : '0.000'}
                    </div>
                    <div className="text-gray-400 text-xs">seconds</div>
                  </div>
                  <div className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl p-4">
                    <div className="text-quantum-blue text-2xl mb-2">🔐</div>
                    <div className="text-gray-400 text-xs mb-1">量子资源消耗</div>
                    <div className="text-2xl font-bold text-white font-mono">
                      {statistics.quantum_cost || 0}
                    </div>
                    <div className="text-gray-400 text-xs">qubits</div>
                  </div>
                  <div className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl p-4">
                    <div className="text-quantum-blue text-2xl mb-2">🛡️</div>
                    <div className="text-gray-400 text-xs mb-1">安全检测率</div>
                    <div className="text-2xl font-bold text-white font-mono">
                      {statistics.securityRate ?? 0}
                    </div>
                    <div className="text-gray-400 text-xs">%</div>
                  </div>
                </div>

                {/* 图表 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-xl p-4">
                    <h3 className="text-quantum-blue text-sm mb-4">资源消耗分析</h3>
                    <div ref={resourceChartRef} className="h-[300px] bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.05)] rounded"></div>
                  </div>
                  <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-xl p-4">
                    <h3 className="text-quantum-blue text-sm mb-4">轮次性能对比</h3>
                    <div ref={roundChartRef} className="h-[300px] bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.05)] rounded"></div>
                  </div>
                </div>

                {/* 底部图表 */}
                <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-xl p-4">
                  <h3 className="text-quantum-blue text-sm mb-4">密钥熵值分析</h3>
                  <div ref={entropyChartRef} className="h-[300px] bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.05)] rounded"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 密钥管理页面 */}
        {activePanel === 'keys' && (
          <div className="panel">
            <KeyManagementPage />
          </div>
        )}

        {/* 风险告警页面 */}
        {activePanel === 'alerts' && (
          <div className="panel">
            <RiskAlertPage />
          </div>
        )}

        {/* 系统配置页面 */}
        {activePanel === 'config' && (
          <div className="panel">
            <SystemConfigPage />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
