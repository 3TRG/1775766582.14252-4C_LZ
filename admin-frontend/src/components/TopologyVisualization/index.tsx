import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Node {
  id: number;
  type: 'leader' | 'follower';
  x: number;
  y: number;
  label: string;
  desc: string;
  isOnline?: boolean;
}

interface TopologyVisualizationProps {
  participants?: number;
  nodes?: Array<{ id: number; type: 'leader' | 'follower'; label?: string; isOnline?: boolean }>;
}

const TopologyVisualization: React.FC<TopologyVisualizationProps> = ({ 
  participants = 15, 
  nodes: explicitNodes
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !tooltipRef.current) return;

    const svg = d3.select(svgRef.current);
    const connectionsLayer = svg.select('#connections-layer');
    const nodesLayer = svg.select('#nodes-layer');
    const labelsLayer = svg.select('#labels-layer');
    const tooltip = d3.select(tooltipRef.current);

    // 清空现有内容
    connectionsLayer.selectAll('*').remove();
    nodesLayer.selectAll('*').remove();
    labelsLayer.selectAll('*').remove();

    // 配置参数
    const n = explicitNodes?.length ? explicitNodes.length : participants;
    const centerX = 200;
    const centerY = 140;
    const radius = 90;
    const innerRadius = 50;

    // 生成节点数据 - 只保留leader和follower
    const nodes: Node[] = [];
    const numLeaders = explicitNodes?.length
      ? explicitNodes.filter(n => n.type === 'leader').length
      : Math.min(2, n);
    const numFollowers = n - numLeaders;

    // 领导者节点（外层）
    const leaderList = explicitNodes?.length
      ? explicitNodes.filter(n => n.type === 'leader')
      : Array.from({ length: numLeaders }, (_, i) => ({ id: i + 1, type: 'leader' as const, label: `P${i + 1}`, isOnline: false }));

    for (let i = 0; i < leaderList.length; i++) {
      const angle = (i / numLeaders) * Math.PI * 2 - Math.PI / 2;
      const leader = leaderList[i];
      nodes.push({
        id: leader.id,
        type: 'leader',
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        label: leader.label || `P${leader.id}`,
        desc: '领导者 - 负责QKA密钥协商',
        isOnline: leader.isOnline ?? false
      });
    }

    // 跟随者节点（内层或外层）
    const followerList = explicitNodes?.length
      ? explicitNodes.filter(n => n.type === 'follower')
      : Array.from({ length: numFollowers }, (_, i) => ({ id: numLeaders + i + 1, type: 'follower' as const, label: `P${numLeaders + i + 1}`, isOnline: false }));

    for (let i = 0; i < followerList.length; i++) {
      const angle = (i / Math.max(numFollowers, 1)) * Math.PI * 2 - Math.PI / 2;
      const r = numFollowers <= 4 ? innerRadius : radius * 0.6;

      const follower = followerList[i];
      nodes.push({
        id: follower.id,
        type: 'follower',
        x: centerX + Math.cos(angle) * r,
        y: centerY + Math.sin(angle) * r,
        label: follower.label || `P${follower.id}`,
        desc: '跟随者 - 接收密钥分发',
        isOnline: follower.isOnline ?? false
      });
    }

    // 绘制连接线（领导者之间全连接）
    const leaders = nodes.filter(n => n.type === 'leader');
    for (let i = 0; i < leaders.length; i++) {
      for (let j = i + 1; j < leaders.length; j++) {
        const leader1 = leaders[i];
        const leader2 = leaders[j];
        if (leader1 && leader2 && leader1.x !== undefined && leader1.y !== undefined && leader2.x !== undefined && leader2.y !== undefined) {
          connectionsLayer.append('line')
            .attr('x1', leader1.x)
            .attr('y1', leader1.y)
            .attr('x2', leader2.x)
            .attr('y2', leader2.y)
            .attr('stroke', 'url(#connection-gradient)')
            .attr('stroke-width', '2')
            .attr('opacity', '0.6')
            .classed('connection-line', true);
        }
      }
    }

    // 绘制领导者到跟随者的连接
    nodes.filter(n => n.type !== 'leader').forEach((follower, idx) => {
      if (follower && follower.x !== undefined && follower.y !== undefined) {
        const leader = leaders[idx % leaders.length];
        if (leader && leader.x !== undefined && leader.y !== undefined) {
          connectionsLayer.append('line')
            .attr('x1', leader.x)
            .attr('y1', leader.y)
            .attr('x2', follower.x)
            .attr('y2', follower.y)
            .attr('stroke', 'rgba(136, 146, 176, 0.3)')
            .attr('stroke-width', '1')
            .attr('stroke-dasharray', '4,4');
        }
      }
    });

    // 绘制节点
    nodes.forEach((node, index) => {
      // 确保节点有有效的坐标
      if (!node || node.x === undefined || node.y === undefined) {
        console.warn('[Topology] 跳过无效节点:', node);
        return;
      }
      
      const g = nodesLayer.append('g')
        .classed('node-group', true)
        .attr('data-node-id', node.id)
        .attr('data-node-type', node.type)
        .style('opacity', '0')
        .style('transform', 'scale(0)')
        .style('transition', 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)')
        .style('transform-origin', 'center');

      // 外发光圈 - 在线用户显示发光效果
      g.append('circle')
        .attr('cx', node.x)
        .attr('cy', node.y)
        .attr('r', node.type === 'leader' ? 18 : 14)
        .attr('fill', node.isOnline ? 'url(#node-glow-online)' : 'url(#node-glow)')
        .classed('node-glow', true)
        .style('opacity', node.isOnline ? '1' : '0.6')
        .style('transition', 'opacity 0.3s ease');

      // 主节点圆
      const circle = g.append('circle')
        .attr('cx', node.x)
        .attr('cy', node.y)
        .attr('r', node.type === 'leader' ? 14 : 10)
        .attr('filter', 'url(#glow-filter)')
        .classed('node-circle', true)
        .style('transition', 'all 0.3s ease');

      // 根据类型和在线状态设置颜色
      let fillColor, strokeColor;
      if (node.type === 'leader') {
        fillColor = '#00d4ff';
        strokeColor = '#ffffff';
      } else {
        // 跟随者根据在线状态显示不同颜色
        fillColor = node.isOnline ? '#00ff88' : '#8892b0';
        strokeColor = '#ffffff';
      }

      circle.attr('fill', fillColor).attr('stroke', strokeColor).attr('stroke-width', '3');

      // 节点标签（P1, P2等）
      g.append('text')
        .attr('x', node.x)
        .attr('y', node.y + 4)
        .attr('text-anchor', 'middle')
        .attr('fill', '#ffffff')
        .attr('font-size', node.type === 'leader' ? '11' : '9')
        .attr('font-weight', 'bold')
        .text(node.label);

      // 外部标签
      labelsLayer.append('text')
        .attr('x', node.x)
        .attr('y', node.y + (node.type === 'leader' ? 28 : 22))
        .attr('text-anchor', 'middle')
        .attr('fill', '#ccd6f6')
        .attr('font-size', '10')
        .text(node.type === 'leader' ? 'Leader' : node.isOnline ? 'Online' : 'Offline');

      // 添加交互事件
      g.on('mouseenter', (event) => {
        const statusText = node.isOnline ? '在线' : '离线';
        tooltip.select('.tooltip-header').text(`${node.label} - ${node.type === 'leader' ? '领导者节点' : '跟随者节点'} (${statusText})`)
          .style('color', node.type === 'leader' ? '#00d4ff' : node.isOnline ? '#00ff88' : '#8892b0');
        
        tooltip.select('.tooltip-content').html(`
          <div class="tooltip-row"><span>类型:</span> <span>${node.desc}</span></div>
          <div class="tooltip-row"><span>ID:</span> <span>${node.id}</span></div>
          <div class="tooltip-row"><span>状态:</span> <span>${statusText}</span></div>
        `);
        
        tooltip.classed('hidden', false);
        moveTooltip(event);
        
        circle.attr('r', node.type === 'leader' ? 16 : 12);
        g.select('.node-glow').style('opacity', '1');
      });

      g.on('mouseleave', () => {
        tooltip.classed('hidden', true);
        circle.attr('r', node.type === 'leader' ? 14 : 10);
        g.select('.node-glow').style('opacity', node.isOnline ? '1' : '0.6');
      });

      g.on('mousemove', moveTooltip);

      // 入场动画
      setTimeout(() => {
        g.style('opacity', '1').style('transform', 'scale(1)');
      }, index * 100);
    });

    // 移动提示框
    function moveTooltip(event: MouseEvent) {
      if (!tooltipRef.current) return;
      const container = svgRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      
      const x = event.clientX - rect.left + 15;
      const y = event.clientY - rect.top - 10;
      
      tooltip.style('left', `${x}px`).style('top', `${y}px`);
    }

    // 更新统计
    const onlineCount = nodes.filter(n => n.isOnline).length;
    const statTotal = document.getElementById('stat-total');
    const statLeaders = document.getElementById('stat-leaders');
    const statFollowers = document.getElementById('stat-followers');
    const statOnline = document.getElementById('stat-online');
    
    if (statTotal) statTotal.textContent = n.toString();
    if (statLeaders) statLeaders.textContent = numLeaders.toString();
    if (statFollowers) statFollowers.textContent = numFollowers.toString();
    if (statOnline) statOnline.textContent = onlineCount.toString();

  }, [participants, explicitNodes]);

  return (
    <div className="topology-viz bg-[rgba(0,0,0,0.35)] rounded-xl border border-[rgba(0,212,255,0.15)] p-4 flex flex-col gap-4">
      <div className="topology-canvas h-[260px] md:h-[300px] bg-[rgba(0,0,0,0.28)] rounded-2xl border border-[rgba(0,212,255,0.08)] overflow-hidden relative">
        <svg width="100%" height="100%" ref={svgRef} viewBox="0 0 400 280">
          {/* 背景网格 */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,212,255,0.05)" strokeWidth="3"/>
            </pattern>
            <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0,212,255,0.8)"/>
              <stop offset="100%" stopColor="rgba(0,212,255,0)"/>
            </radialGradient>
            <radialGradient id="node-glow-online" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0,255,136,0.8)"/>
              <stop offset="100%" stopColor="rgba(0,255,136,0)"/>
            </radialGradient>
            <filter id="glow-filter" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <linearGradient id="connection-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00d4ff"/>
              <stop offset="100%" stopColor="#9d4edd"/>
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)"/>
          <g id="connections-layer"></g>
          <g id="nodes-layer"></g>
          <g id="labels-layer"></g>
        </svg>
        
        {/* 光标跟随提示框 */}
        <div id="node-tooltip" ref={tooltipRef} className="node-tooltip hidden absolute bg-[rgba(16,20,40,0.95)] border border-[rgba(0,212,255,0.3)] rounded-xl p-3 min-w-[180px] pointer-events-none z-10 backdrop-blur-md shadow-xl transition-opacity">
          <div className="tooltip-header font-bold mb-2 pb-2 border-b border-[rgba(255,255,255,0.1)]"></div>
          <div className="tooltip-content text-sm text-gray-300"></div>
        </div>
      </div>
      
      {/* 图例和统计信息 - 只保留领导者、跟随者和在线状态 */}
      <div className="topology-legend grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="legend-item flex items-center gap-3 p-3 bg-[rgba(255,255,255,0.03)] rounded-xl">
          <span className="legend-dot leader w-3 h-3 rounded-full bg-quantum-blue shadow-[0_0_10px_rgba(0,212,255,0.5)]"></span>
          <div className="min-w-0">
            <div className="text-sm text-gray-200 font-semibold">领导者 (Leader)</div>
            <div className="text-xs text-gray-400">负责密钥协商</div>
          </div>
          <div className="ml-auto">
            <span className="stat-value text-lg font-bold text-quantum-blue font-mono" id="stat-leaders">0</span>
          </div>
        </div>
        <div className="legend-item flex items-center gap-3 p-3 bg-[rgba(255,255,255,0.03)] rounded-xl">
          <span className="legend-dot follower w-3 h-3 rounded-full bg-gray-400"></span>
          <div className="min-w-0">
            <div className="text-sm text-gray-200 font-semibold">跟随者 (Follower)</div>
            <div className="text-xs text-gray-400">接收密钥分发</div>
          </div>
          <div className="ml-auto">
            <span className="stat-value text-lg font-bold text-quantum-blue font-mono" id="stat-followers">0</span>
          </div>
        </div>
        <div className="legend-item flex items-center gap-3 p-3 bg-[rgba(255,255,255,0.03)] rounded-xl">
          <span className="legend-dot online w-3 h-3 rounded-full bg-quantum-green shadow-[0_0_10px_rgba(0,255,136,0.5)]"></span>
          <div className="min-w-0">
            <div className="text-sm text-gray-200 font-semibold">在线用户</div>
            <div className="text-xs text-gray-400">当前在线</div>
          </div>
          <div className="ml-auto">
            <span className="stat-value text-lg font-bold text-quantum-green font-mono" id="stat-online">0</span>
          </div>
        </div>
        <div className="legend-item flex items-center gap-3 p-3 bg-[rgba(255,255,255,0.03)] rounded-xl">
          <span className="legend-dot total w-3 h-3 rounded-full bg-white"></span>
          <div className="min-w-0">
            <div className="text-sm text-gray-200 font-semibold">总节点</div>
            <div className="text-xs text-gray-400">所有参与者</div>
          </div>
          <div className="ml-auto">
            <span className="stat-value text-lg font-bold text-white font-mono" id="stat-total">0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopologyVisualization;
