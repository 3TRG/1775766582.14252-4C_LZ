/**
 * QKE过程数据类型定义
 *
 * 本文件定义 QKE 协商过程的可视化数据类型，
 * 以及将后端 WS 推送的 QKE 事件转换为前端 QKEProcessData 格式的转换器。
 * 实际数据从后端 REST API + WebSocket 事件流获取。
 */

export interface QKEProcessData {
  currentRound: number;
  totalRounds: number;
  protocolStage: string; // 'qka-leaders', 'qkd-rounds', 'completed', 'failed'
  participants: Array<{
    id: number;
    isLeader: boolean;
    status: string; // 'joined', 'running', 'completed', 'failed'
  }>;
  keyMetrics: {
    entropy: number;
    qber: number;
    keyRate: number;
  };
  rounds: Array<{
    roundNumber: number;
    stateType: string;
    qubitsUsed: number;
    circuitImg?: string;
    status: string; // 'pending', 'running', 'completed', 'failed'
    title?: string;
    description?: string;
    diff_positions?: number[];
  }>;
}

/**
 * 将后端 WS 推送的 QKE 事件转换为前端 QKEProcessData 格式
 */
export function qkeEventToProcessData(
  eventType: string,
  eventData: Record<string, unknown>,
  prev: QKEProcessData | null,
): QKEProcessData | null {
  // 协商开始 — 初始化
  if (eventType === 'session_created') {
    const detail = eventData as { participant_count?: number; protocol_path?: string };
    return {
      currentRound: 0,
      totalRounds: 4,
      protocolStage: 'qka-leaders',
      participants: [],
      rounds: [],
      keyMetrics: { entropy: 0, qber: 0, keyRate: 0 },
    };
  }

  // 领导者选举
  if (eventType === 'leaders_elected') {
    const detail = eventData as { leaders?: number[] };
    const leaders = detail?.leaders ?? [];
    return {
      ...(prev ?? {
        currentRound: 0,
        totalRounds: 4,
        protocolStage: 'qka-leaders',
        participants: [],
        keyMetrics: { entropy: 0, qber: 0, keyRate: 0 },
      }),
      participants: leaders.map((id: number) => ({ id, isLeader: true, status: 'completed' })),
    };
  }

  // 轮次开始 / 测量
  if (eventType === 'round_started' || eventType === 'round_measured') {
    const detail = eventData as { group_type?: string; state_type?: string; diff_positions?: number[] };
    const roundNo = Number((eventData as { round_number?: number })?.round_number ?? 0);
    const prevData: QKEProcessData = prev ?? {
      currentRound: 0,
      totalRounds: 4,
      protocolStage: 'qkd-rounds',
      participants: [],
      keyMetrics: { entropy: 0.7, qber: 0.05, keyRate: 800 },
      rounds: [],
    };
    const existingRound = prevData.rounds.find((r) => r.roundNumber === roundNo);
    const rounds = existingRound
      ? prevData.rounds.map((r) =>
          r.roundNumber === roundNo
            ? {
                ...r,
                status: eventType === 'round_measured' ? 'completed' : r.status,
                diff_positions: (detail?.diff_positions ?? r.diff_positions) as number[] | undefined,
              }
            : r,
        )
      : [
          ...prevData.rounds,
          {
            roundNumber: roundNo,
            stateType: detail?.state_type ?? 'Bell',
            qubitsUsed: 2,
            status: eventType === 'round_measured' ? 'completed' : 'running',
            diff_positions: detail?.diff_positions ?? [],
          },
        ];

    return {
      ...prevData,
      rounds,
      currentRound: roundNo,
      protocolStage: eventType === 'round_measured' ? 'qkd-rounds' : prevData.protocolStage,
    };
  }

  // 密钥生成 / 完成
  if (eventType === 'key_generated' || eventType === 'protocol_completed') {
    const detail = eventData as { key_length?: number; entropy?: number; qber?: number };
    return {
      ...(prev ?? {
        currentRound: 0,
        totalRounds: 4,
        protocolStage: 'completed',
        participants: [],
        keyMetrics: { entropy: 0, qber: 0, keyRate: 0 },
        rounds: [],
      }),
      protocolStage: 'completed',
      currentRound: prev?.totalRounds ?? 4,
      keyMetrics: {
        entropy: typeof detail?.entropy === 'number' ? detail.entropy : 0.98,
        qber: typeof detail?.qber === 'number' ? detail.qber : 0.02,
        keyRate: prev?.keyMetrics?.keyRate ?? 1200,
      },
    };
  }

  // 其他事件 — 不改变 QKEProcessData，返回原值
  return prev;
}
