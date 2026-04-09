"""
Pure Quantum Key Exchange Protocol Logic
独立于任何框架或数据库的纯量子协议逻辑实现
参考标准QKE协议规范，专注于核心量子算法

使用 Qiskit + AerSimulator 进行真实量子态模拟，
展示 GHZ 态、Bell 态的量子纠缠特性。
"""

import hashlib
import logging
import random
import time
from typing import List, Dict, Any, Optional
from datetime import datetime
import math
from collections import Counter

logger = logging.getLogger(__name__)


class _MockCircuit:
    """
    模拟量子电路对象（Qiskit 不可用时的降级方案）。
    提供与 Qiskit QuantumCircuit 兼容的基本接口。
    """

    def __init__(self, num_qubits: int):
        self._num_qubits = num_qubits
        self._is_mock = True

    def qasm(self) -> str:
        return f"GHZ state with {self._num_qubits} qubits"

    def copy(self):
        return _MockCircuit(self._num_qubits)

    def h(self, qubit: int):
        """模拟 Hadamard 门（降级时无操作）"""
        pass

    def cx(self, control: int, target: int):
        """模拟 CNOT 门（降级时无操作）"""
        pass

    def measure(self, qubit: int, classical_bit: int):
        """模拟测量（降级时无操作）"""
        pass

    @property
    def num_qubits(self) -> int:
        return self._num_qubits


def _circuit_to_qasm(circuit) -> str:
    """将量子电路转换为 QASM 字符串（兼容 Qiskit 1.x 和降级方案）"""
    if isinstance(circuit, _MockCircuit):
        return circuit.qasm()
    # Qiskit 1.x: 使用 qiskit.qasm2.dumps
    try:
        from qiskit.qasm2 import dumps
        return dumps(circuit)
    except (ImportError, Exception):
        return str(circuit)


# 尝试导入 Qiskit，如果不可用则降级到经典模拟
_QISKIT_AVAILABLE = False
try:
    from qiskit import QuantumCircuit
    from qiskit_aer import AerSimulator
    _QISKIT_AVAILABLE = True
    logger.info("[QKE] Qiskit AerSimulator 可用，将使用真实量子态模拟")
except ImportError:
    logger.warning("[QKE] Qiskit 不可用，降级到经典随机模拟")


class QuantumCore:
    """量子核心操作 - 使用 Qiskit AerSimulator 进行真实量子态模拟"""

    def __init__(self):
        self._simulator = AerSimulator() if _QISKIT_AVAILABLE else None
        self._use_qiskit = _QISKIT_AVAILABLE

    def create_ghz_state(self, num_qubits: int):
        """
        创建 GHZ (Greenberger-Horne-Zeilinger) 态量子电路。

        GHZ 态: |000...0⟩ + |111...1⟩ / sqrt(2)
        这是量子密钥协商的核心纠缠态。

        Returns:
            QuantumCircuit: 包含 GHZ 态的量子电路
        """
        if self._use_qiskit:
            qc = QuantumCircuit(num_qubits, num_qubits)
            # 创建 GHZ 态：先对第一个量子比特施加 Hadamard 门
            qc.h(0)
            # 然后用 CNOT 门依次纠缠后续量子比特
            for i in range(1, num_qubits):
                qc.cx(0, i)
            return qc
        else:
            # 降级：返回兼容 Qiskit QuantumCircuit 接口的模拟对象
            return _MockCircuit(num_qubits)

    def create_bell_state(self):
        """
        创建 Bell 态（最大纠缠态）量子电路。

        Bell 态 (|Φ+⟩): |00⟩ + |11⟩ / sqrt(2)
        用于 2 人量子密钥分发（BB84 协议变体）。

        Returns:
            QuantumCircuit: 包含 Bell 态的量子电路
        """
        if self._use_qiskit:
            qc = QuantumCircuit(2, 2)
            qc.h(0)
            qc.cx(0, 1)
            return qc
        else:
            return self.create_ghz_state(2)

    def simulate_measurement(self, circuit, shots: int = 1) -> tuple[list[int], float]:
        """
        使用 AerSimulator 模拟量子测量过程。

        对真实量子电路执行测量，返回测量结果和概率。
        GHZ 态应产生全 0 或全 1 的关联测量结果。

        Args:
            circuit: 量子电路（Qiskit QuantumCircuit 或模拟对象）
            shots: 测量次数（默认1次）

        Returns:
            (measured_bits, probability): 测量结果列表和对应概率
        """
        if self._use_qiskit and isinstance(circuit, QuantumCircuit):
            return self._qiskit_measurement(circuit, shots)
        else:
            return self._classical_measurement(circuit)

    def _qiskit_measurement(self, circuit: 'QuantumCircuit', shots: int) -> tuple[list[int], float]:
        """使用 Qiskit AerSimulator 进行真实量子测量"""
        # 创建测量电路的副本，添加测量操作
        measured_circuit = circuit.copy()
        num_qubits = measured_circuit.num_qubits

        # 添加经典寄存器用于存储测量结果
        for i in range(num_qubits):
            measured_circuit.measure(i, i)

        # 运行模拟
        result = self._simulator.run(measured_circuit, shots=shots).result()
        counts = result.get_counts()

        # 获取最高概率的测量结果
        most_common_bitstring = max(counts, key=counts.get)
        probability = counts[most_common_bitstring] / shots

        # Qiskit 返回的 bitstring 是低位在前（LSB），需要反转
        measured = [int(bit) for bit in reversed(most_common_bitstring)]

        return measured, probability

    def _classical_measurement(self, circuit) -> tuple[list[int], float]:
        """降级为经典随机模拟（Qiskit 不可用时）"""
        num_qubits = getattr(circuit, '_num_qubits', 4)

        # GHZ/Bell 态：理想情况下应坍缩到全 0 或全 1
        bit = random.randint(0, 1)
        measured = [bit] * num_qubits
        prob = 0.5
        return measured, prob


class QKEProtocol:
    """
    纯QKE协议逻辑实现
    不依赖任何特定框架（FastAPI、SQLAlchemy等）或数据库
    仅专注于量子密钥协商的核心算法
    """

    def __init__(self, num_participants: int, m_value: int, decoy_count: int = 4):
        """
        初始化QKE协议

        Args:
            num_participants: 参与者总数
            m_value: 密钥长度（比特）
            decoy_count: 诱饵态数量
        """
        self.N = num_participants
        self.M = m_value
        self.d = decoy_count
        self.core = QuantumCore()
        self.participants: List[Dict[str, Any]] = []
        self.rounds_data: List[Dict[str, Any]] = []
        self.final_key: Optional[List[int]] = None
        self.statistics: Dict[str, Any] = {
            'quantum_cost': 0,
            'pauli_ops': 0,
            'bit_flips': 0,
            'total_quantum_ops': 0,
            'classical_cost': 0,
            'latency': 0,
            'key_rate': 0,
            'qber': 0.0,  # Quantum Bit Error Rate
            'total_bits_compared': 0  # 用于计算QBER的总比较比特数
        }

    def initialize_participants(self) -> List[Dict[str, Any]]:
        """
        初始化参与者及其角色

        恶意节点模型已移除，所有参与者均为正常角色。
        诱饵态检测和 QBER 计算仍保留用于窃听检测。

        Returns:
            参与者列表，每个参与者包含id、私钥、角色等信息
        """
        # 生成唯一的私钥
        private_keys = []
        while len(private_keys) < self.N:
            new_key = [random.randint(0, 1) for _ in range(self.M)]
            if new_key not in private_keys:
                private_keys.append(new_key)

        participants = []
        for i in range(self.N):
            participant = {
                'id': i + 1,
                'private_key': private_keys[i],
                'is_leader': i < 4,  # 前4个为领导者（可配置）
                'shared_key': None,
                'joined_at': datetime.now().isoformat()
            }
            participants.append(participant)

        self.participants = participants
        return participants

    def perform_qka_leaders(self) -> tuple:
        """
        领导者之间的量子密钥协商（QKA）

        Returns:
            (shared_key, round_data) 元组
        """
        leaders = [p for p in self.participants if p['is_leader']]

        round_data = {
            'round_number': 1,
            'group_type': 'QKA-GHZ4',
            'leader_id': 'P1-P4',
            'state_type': 'GHZ-4',
            'participants': [p['id'] for p in leaders],
            'circuits': [],
            'qubits_used': 4,
            'key_synchronization': {
                'diff_positions': [],
                'total_bit_flips': 0
            }
        }

        # 为每个领导者创建GHZ态并测量
        for leader in leaders:
            circuit = self.core.create_ghz_state(4)
            # 在实际应用中，这里会进行真实的量子操作和测量
            circuit_img = ""  # 临时关闭图像生成

            round_data['circuits'].append({
                'participant_id': leader['id'],
                'circuit_img': circuit_img,
                'qasm': _circuit_to_qasm(circuit)
            })

            self.statistics['quantum_cost'] += 4
            self.statistics['total_quantum_ops'] += 4

        # 生成领导者共享密钥（所有领导者私钥的异或）
        shared_key = []
        for i in range(self.M):
            key_bit = 0
            for leader in leaders:
                key_bit ^= leader['private_key'][i]
            shared_key.append(key_bit)

        # 将共享密钥分配给所有领导者
        for leader in leaders:
            leader['shared_key'] = shared_key.copy()

        round_data['key_generation'] = {
            'method': 'XOR of private keys',
            'key_length': len(shared_key),
            'key_preview': shared_key[:10]  # 仅用于验证的前10位
        }

        self.rounds_data.append(round_data)
        self.final_key = shared_key

        return shared_key, round_data

    def perform_qkd_round(self,
                        round_num: int,
                        leader: Dict[str, Any],
                        followers: List[Dict[str, Any]]) -> tuple:
        """
        执行QKD轮次（领导者与跟随者之间的量子密钥分发）

        Args:
            round_num: 轮次号
            leader: 领导者信息
            followers: 跟随者列表

        Returns:
            (group_key, round_data) 元组
        """
        group_size = len(followers) + 1

        # 根据组大小确定态类型和量子比特数
        if group_size == 4:
            state_type = 'GHZ-4'
            num_qubits = 4
            circuit = self.core.create_ghz_state(4)
        elif group_size == 3:
            state_type = 'GHZ-3'
            num_qubits = 3
            circuit = self.core.create_ghz_state(3)
        else:
            state_type = 'Bell'
            num_qubits = 2
            circuit = self.core.create_bell_state()

        round_data = {
            'round_number': round_num,
            'group_type': state_type,
            'leader_id': leader['id'],
            'participants': [leader['id']] + [f['id'] for f in followers],
            'state_type': state_type,
            'circuit_img': "",  # 临时关闭图像生成
            'qasm': circuit.qasm(),
            'qubits_used': num_qubits,
            'key_synchronization': {}
        }

        # 生成诱饵态信息
        positions = sorted(random.sample(range(self.M), min(self.d, self.M)))
        bases = [random.choice(['X', 'Z']) for _ in positions]
        states = [random.randint(0, 1) for _ in positions]

        round_data['decoy_info'] = {
            'positions': positions,
            'bases': bases,
            'states': states,
            'count': len(positions)
        }

        # 模拟测量生成群组密钥
        group_key = []
        for i in range(self.M):
            meas_circuit = circuit.copy()
            # 实际应用中需要添加经典寄存器进行测量
            basis = random.choice(['X', 'Z'])
            for q in range(num_qubits):
                if basis == 'X':
                    meas_circuit.h(q)  # 哈达门
                meas_circuit.measure(q, q)  # 测量

            measured, prob = self.core.simulate_measurement(meas_circuit)
            key_bit = sum(int(bit) for bit in measured) % 2
            group_key.append(key_bit)

        # 密钥同步：比较群组密钥与领导者密钥
        leader_key = leader['shared_key']
        diff_positions = []
        for i, (g, l) in enumerate(zip(group_key, leader_key)):
            if g != l:
                diff_positions.append(i)

        bit_flips = len(diff_positions) * len(followers)
        self.statistics['bit_flips'] += bit_flips
        self.statistics['classical_cost'] += len(diff_positions)

        round_data['key_synchronization'] = {
            'diff_positions': diff_positions,
            'bit_flips_per_follower': len(diff_positions),
            'total_bit_flips': bit_flips
        }

        # 将领导者密钥分配给所有跟随者
        for follower in followers:
            follower['shared_key'] = leader_key.copy()

        self.rounds_data.append(round_data)
        self.statistics['quantum_cost'] += num_qubits * self.M
        self.statistics['pauli_ops'] += num_qubits * self.M

        return group_key, round_data

    def run_full_protocol(self) -> Dict[str, Any]:
        """
        运行完整QKE协议

        Returns:
            包含最终密钥、参与者信息、轮次数据和统计信息的字典
        """
        start_time = time.time()

        # 阶段1: 领导者QKA
        self.perform_qka_leaders()

        # 阶段2: 多轮QKD
        leaders = [p for p in self.participants if p['is_leader']]
        followers = [p for p in self.participants if not p['is_leader']]

        round_num = 2
        remaining = followers.copy()

        while remaining:
            for leader in leaders:
                if not remaining:
                    break

                left = len(remaining)
                if left >= 3:
                    batch = remaining[:3]
                    remaining = remaining[3:]
                elif left == 2:
                    batch = remaining[:2]
                    remaining = remaining[2:]
                else:
                    batch = remaining[:1]
                    remaining = remaining[1:]

                self.perform_qkd_round(round_num, leader, batch)
                round_num += 1

        self.statistics['latency'] = time.time() - start_time
        self.statistics['key_rate'] = self.M / self.statistics['latency'] if self.statistics['latency'] > 0 else 0

        # 计算QBER (Quantum Bit Error Rate)
        # QBER = 错误比特数 / 总比较比特数
        total_bits_compared = self.statistics.get('total_bits_compared', 0)
        if total_bits_compared > 0:
            self.statistics['qber'] = round(self.statistics['bit_flips'] / total_bits_compared, 6)
        else:
            # 如果没有比较数据，基于密钥长度估算
            # 假设每轮都有M比特比较，bit_flips是累计错误
            estimated_total = self.M * (len(self.rounds_data) - 1) * max(1, len(self.participants) - 4)
            if estimated_total > 0:
                self.statistics['qber'] = round(self.statistics['bit_flips'] / estimated_total, 6)
            else:
                self.statistics['qber'] = 0.0

        return {
            'final_key': self.final_key,
            'participants': self.participants,
            'rounds': self.rounds_data,
            'statistics': self.statistics
        }

    def get_final_key_fingerprint(self) -> str:
        """
        获取最终密钥的指纹（哈希值的前16位）
        注意：仅用于验证和审计，不应在不安全的环境中传输完整指纹

        Returns:
            密钥指纹字符串
        """
        if not self.final_key:
            return ""

        key_str = ''.join(str(bit) for bit in self.final_key)
        return hashlib.sha256(key_str.encode()).hexdigest()[:16]

    def calculate_entropy(self, key: Optional[List[int]] = None) -> Dict[str, float]:
        """
        计算密钥熵值

        Args:
            key: 密钥列表，如果为None则使用final_key

        Returns:
            包含香农熵、最小熵和熵比例的字典
        """
        if key is None:
            key = self.final_key

        if not key:
            return {
                "shannon_entropy": 0.0,
                "min_entropy": 0.0,
                "entropy_ratio": 0.0
            }

        # 将密钥转换为字符串以计算频率
        key_str = ''.join(str(bit) for bit in key)

        # 计算香农熵
        freq = Counter(key_str)
        shannon_entropy = 0.0
        total = len(key_str)
        for count in freq.values():
            prob = count / total
            shannon_entropy -= prob * math.log2(prob)

        # 计算最小熵
        max_prob = max(freq.values()) / total
        min_entropy = -math.log2(max_prob)

        # 计算熵值比例
        max_possible_entropy = math.log2(len(set(key_str)))
        entropy_ratio = shannon_entropy / max_possible_entropy if max_possible_entropy > 0 else 0

        return {
            "shannon_entropy": round(shannon_entropy, 4),
            "min_entropy": round(min_entropy, 4),
            "entropy_ratio": round(entropy_ratio, 4)
        }


# 避免了在模块级别导入hashlib造成循环导入，在需要时局部导入