import { useCallback, useRef, useState, useEffect, Suspense } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  MarkerType, Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'
import CustomNode from './CustomNode'
import AIChatPanel from './AIChatPanel'
import { supabase } from '../supabaseClient'
import { Sparkles, Mic, Loader, Plus, ExternalLink, Play, BookOpen, MousePointer, Link2, Settings, Save } from 'lucide-react'
import RobotSim from './RobotSim'
import { io } from 'socket.io-client'
import { getCoordinatesForNode } from '../MapConfig'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://yummy-foxes-report.loca.lt'

// --- GLOBAL EXECUTION LOG ---
function GlobalExecLog() {
  const [logs, setLogs] = useState([])
  const ref = useRef()
  
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [logs])

  useEffect(() => {
    const handler = (e) => setLogs(p => [...p.slice(-40), e.detail])
    window.addEventListener('ROBOT_LOG', handler)
    return () => window.removeEventListener('ROBOT_LOG', handler)
  }, [])

  return (
    <div style={{
      position: 'absolute', top: 24, left: 24, width: 340, zIndex: 100,
      background: 'rgba(11, 15, 25, 0.85)', backdropFilter: 'blur(12px)',
      border: '1px solid var(--border-accent)', borderRadius: 12,
      fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: '0.75rem',
      boxShadow: '0 12px 40px rgba(0,0,0,0.5)', pointerEvents: 'none'
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff', fontWeight: 700, letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1s infinite' }} />
        LIVE EXECUTION LOG
      </div>
      <div ref={ref} style={{ padding: '12px 16px', maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {logs.length === 0 && <div style={{ color: '#4b5563', fontStyle: 'italic' }}>Awaiting workflow activation...</div>}
        {logs.map((l, i) => (
           <div key={i} style={{ color: l.c || '#22c55e', lineHeight: 1.5 }}>{l.t}</div>
        ))}
      </div>
    </div>
  )
}

// --- FLOATING OPERATOR MANUAL ---
function OperatorManual() {
  const [open, setOpen] = useState(false)
  
  return (
    <div 
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        position: 'absolute', top: 24, right: 24, zIndex: 100,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 24, cursor: 'pointer', boxShadow: 'var(--shadow-md)',
        color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600,
        transition: 'all 0.2s',
      }}>
        <BookOpen size={14} style={{ color: 'var(--accent)' }} /> 
        Help & Manual
      </div>
      
      {open && (
        <div style={{
          marginTop: 12, width: 260,
          background: 'rgba(17, 21, 32, 0.95)', backdropFilter: 'blur(12px)',
          border: '1px solid var(--border)', borderRadius: 16,
          padding: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          animation: 'fadeIn 0.2s ease', color: 'var(--text-primary)',
        }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
            Operator Manual
          </div>
          {[
            { icon: MousePointer, color: '#00d4ff', title: 'Drag & Drop',   desc: 'Pull nodes from the left menu.' },
            { icon: Link2,        color: '#a855f7', title: 'Connect',        desc: 'Draw lines between processing blocks.' },
            { icon: Settings,     color: '#f59e0b', title: 'Configure',      desc: 'Click any node to change settings.' },
            { icon: Play,         color: '#22c55e', title: 'Execute',        desc: 'Hit EXECUTE to fire the sequence.' },
          ].map(({ icon: Icon, color, title, desc }, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, background: `${color}18`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={12} style={{ color }} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.2 }}>{title}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.3, marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// Hardcoded degree values per node type — sent as robot-command socket event
const NODE_DEGREES = {
  start:               { base: 0,   arm1: 0,    arm2: 0   },
  end:                 { base: 0,   arm1: 0,    arm2: 0   },
  lidar_scanner:       { base: 90,  arm1: 20,   arm2: 0   },
  thermal_threshold:   { base: -45, arm1: 30,   arm2: 20  },
  proximity_sensor:    { base: 0,   arm1: 30,   arm2: 30  },
  pneumatic_gripper:   { base: 0,   arm1: -65,  arm2: 60  },
  arc_weld_path:       { base: 45,  arm1: -45,  arm2: 65  },
  conveyor_sync:       { base: 90,  arm1: -25,  arm2: 20  },
  if_else:             { base: -25, arm1: -25,  arm2: 25  },
  parallel_fork:       { base: 25,  arm1: -30,  arm2: 30  },
  wait_for_state:      { base: 0,   arm1: 10,   arm2: -5  },
  ml_defect_check:     { base: 0,   arm1: -35,  arm2: 10  },
  safety_zone_monitor: { base: -90, arm1: -20,  arm2: 5   },
  navigate:            { base: 0,   arm1: 20,   arm2: 35  },
  pick:                { base: 0,   arm1: -65,  arm2: 60  },
  place:               { base: 50,  arm1: -55,  arm2: 45  },
  wait:                { base: 0,   arm1: 5,    arm2: -5  },
  charge:              { base: 0,   arm1: 20,   arm2: -10 },
}

const nodeTypes = { custom: CustomNode }

const DEFAULT_NODES = [
  { id: 'start-1', type: 'custom', position: { x: 80, y: 180 }, data: { label: 'Start', type: 'start' } },
]
const DEFAULT_EDGES = []

function makeNode(type, label, position, extraData = {}) {
  return {
    id: `${type}-${Date.now()}`,
    type: 'custom',
    position,
    data: { label, type, params: extraData },
  }
}

export default function FlowBuilder({ currentWorkflow, setCurrentWorkflow, engineStatus, setActiveTab, activeTab }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(DEFAULT_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState(DEFAULT_EDGES)
  const reactFlowWrapper = useRef(null)
  const [rfInstance, setRfInstance] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [workflowRunning, setWorkflowRunning] = useState(false)
  const [fleetMode, setFleetMode] = useState(false)
  const [activeNodes, setActiveNodes] = useState({ alpha: null, beta: null })
  const channelRef = useRef(null)
  const isReceivingRef = useRef(false)
  const socketRef = useRef(null)
  const [saveIndicator, setSaveIndicator] = useState(false)
  const botPosRef = useRef({ x: 0, z: 0 })

  // Sync bot position from global event
  useEffect(() => {
    const handler = (e) => { botPosRef.current = { x: e.detail.x, z: e.detail.z } }
    window.addEventListener('AMR_POSITION', handler)
    return () => window.removeEventListener('AMR_POSITION', handler)
  }, [])

  // Listen for fleet mode toggle from RobotSim HUD
  useEffect(() => {
    const handler = (e) => setFleetMode(e.detail.enabled)
    window.addEventListener('FLEET_MODE_TOGGLE', handler)
    return () => window.removeEventListener('FLEET_MODE_TOGGLE', handler)
  }, [])

  // Socket for emitting robot-command to simulation
  useEffect(() => {
    const sock = io(BACKEND, { transports: ['websocket'] })
    socketRef.current = sock
    return () => sock.disconnect()
  }, [])

  // Bridge: let Sidebar save/load flow without prop-drilling
  useEffect(() => {
    const saveHandler = async (e) => {
      const workflowName = prompt("Enter a name for this Workflow:", currentWorkflow?.name || "Untitled Logistics Flow");
      if (!workflowName) return;

      try {
        const stored = localStorage.getItem('ORIGIN_WORKFLOWS')
        const workflows = stored ? JSON.parse(stored) : []
        const newWf = {
          id: currentWorkflow?.id && !currentWorkflow.id.startsWith('tpl-') ? currentWorkflow.id : `wf-${Date.now()}`,
          name: workflowName,
          nodes,
          edges,
          updated_at: new Date().toISOString()
        }
        
        const existingIdx = workflows.findIndex(w => w.id === newWf.id)
        if (existingIdx > -1) {
          workflows[existingIdx] = newWf
        } else {
          workflows.push(newWf)
        }
        
        localStorage.setItem('ORIGIN_WORKFLOWS', JSON.stringify(workflows))
        setCurrentWorkflow(newWf)
        
        // Trigger HUD
        setSaveIndicator(true)
        setTimeout(() => setSaveIndicator(false), 2000)
        
        window.dispatchEvent(new CustomEvent('WORKFLOW_SAVED', { detail: newWf }));
      } catch (err) {
        console.error("Local Save Failed", err);
        window.dispatchEvent(new CustomEvent('WORKFLOW_SAVE_ERROR', { detail: { msg: 'Local storage full or inaccessible.' } }));
      }
    }
    window.addEventListener('SAVE_CURRENT_FLOW', saveHandler);
    return () => window.removeEventListener('SAVE_CURRENT_FLOW', saveHandler);
  }, [nodes, edges, currentWorkflow])

  // Supabase Realtime Collaboration
  useEffect(() => {
    const channel = supabase.channel('workflow-room', {
      config: { broadcast: { self: false } }
    })
    channelRef.current = channel
    channel
      .on('broadcast', { event: 'flow-update' }, ({ payload }) => {
        isReceivingRef.current = true
        if (payload.nodes) setNodes(payload.nodes)
        if (payload.edges) setEdges(payload.edges)
        setTimeout(() => { isReceivingRef.current = false }, 80)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Sync workflow → canvas
  useEffect(() => {
    if (!currentWorkflow) {
      setNodes(DEFAULT_NODES)
      setEdges(DEFAULT_EDGES)
      setSelectedNode(null)
      return
    }
    const wfNodes = (currentWorkflow.nodes || []).map(n => ({ ...n, type: 'custom' }))
    setNodes(wfNodes)
    setEdges(currentWorkflow.edges || [])
    setSelectedNode(null)
  }, [currentWorkflow?.id])

  // Sync canvas → workflow state
  useEffect(() => {
    setCurrentWorkflow(prev =>
      prev
        ? { ...prev, nodes, edges }
        : { name: 'New Workflow', nodes, edges }
    )
  }, [nodes, edges])

  // Wrapped handlers with broadcast
  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes)
    if (!isReceivingRef.current) {
      setNodes(currentNodes => {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'flow-update',
          payload: { nodes: currentNodes, edges: undefined },
        })
        return currentNodes
      })
    }
  }, [onNodesChange])

  const handleEdgesChange = useCallback((changes) => {
    onEdgesChange(changes)
    if (!isReceivingRef.current) {
      setEdges(currentEdges => {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'flow-update',
          payload: { nodes: undefined, edges: currentEdges },
        })
        return currentEdges
      })
    }
  }, [onEdgesChange])

  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({
      ...params,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent)' },
      style: { stroke: 'var(--accent)', strokeWidth: 2 },
    }, eds))
  }, [])

  const onDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    const type  = e.dataTransfer.getData('application/reactflow-type')
    const label = e.dataTransfer.getData('application/reactflow-label')
    if (!type || !rfInstance) return
    const bounds = reactFlowWrapper.current.getBoundingClientRect()
    const pos = rfInstance.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top })
    let endNode = null
    if (type !== 'end') {
      const hasEnd = nodes.some(n => n.data?.type === 'end')
      if (!hasEnd) {
        endNode = makeNode('end', '🏁 End', { x: pos.x + 220, y: pos.y })
      }
    }
    const newNode = makeNode(type, label.replace(/^[^\s]+\s/, ''), pos)
    setNodes(nds => endNode ? [...nds, newNode, endNode] : [...nds, newNode])
  }, [rfInstance, nodes])

  const onNodeClick = useCallback((_, node) => setSelectedNode(node), [])
  const onPaneClick  = useCallback(() => setSelectedNode(null), [])

  function updateNodeParam(nodeId, key, value) {
    setNodes(nds => nds.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, params: { ...n.data.params, [key]: value } } } : n
    ))
  }

  function updateNodeLabel(nodeId, label) {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, label } } : n))
  }

  function deleteSelectedNode() {
    if (!selectedNode) return
    setNodes(nds => nds.filter(n => n.id !== selectedNode.id))
    setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id))
    setSelectedNode(null)
  }



  // ── Execute Workflow Step-by-Step ──────────────────────────────
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))

  const executeWarehouseLogistics = async () => {
    if (workflowRunning || nodes.length === 0) return
    setWorkflowRunning(true)
    setActiveNodes({ alpha: null, beta: null })

    const edgeMap = {}
    edges.forEach(e => { edgeMap[e.source] = e.target })
    const nodeMap = {}
    nodes.forEach(n => { nodeMap[n.id] = n })

    const startNode = nodes.find(n => n.data?.type === 'start') || nodes[0]
    const ordered = []
    let curId = startNode?.id
    const visited = new Set()
    while (curId && !visited.has(curId)) {
      visited.add(curId)
      if (nodeMap[curId]) ordered.push(nodeMap[curId])
      curId = edgeMap[curId]
    }
    const sequence = ordered.length > 1 ? ordered : nodes

    const getWmsCoords = (type) => {
      const t = (type || '').toLowerCase()
      if (t.includes('scan') || t.includes('lidar')) return [4, 4]
      if (t.includes('gripper') || t.includes('pick')) return [-4, 4]
      if (t.includes('thermal')) return [4, -4]
      if (t.includes('safety')) return [-4, -4]
      if (t.includes('stop_1')) return [4, 4]
      if (t.includes('stop_2')) return [-4, 2]
      if (t.includes('dock') || t.includes('charge')) return [0, -5]
      if (t.includes('start') || t.includes('end')) return [0, 0]
      return [2, 2]
    }

    const runBotWorker = async (threadNodes, botId, colorHex) => {
      for (let i = 0; i < threadNodes.length; i++) {
        const node = threadNodes[i]
        const label = node.data?.label || node.data?.type || 'idle'
        const nodeType = node.data?.type || 'idle'

        setActiveNodes(prev => ({ ...prev, [botId.toLowerCase()]: node.id }))

        // Handle Relative Movement Nodes
        if (nodeType === 'linear_front' || nodeType === 'linear_back' || nodeType === 'lateral_strafe') {
          const { x: curX, z: curZ } = botPosRef.current
          let targetX = curX
          let targetZ = curZ
          
          if (nodeType === 'linear_front') targetZ -= 5
          if (nodeType === 'linear_back')  targetZ += 5
          if (nodeType === 'lateral_strafe') targetX += 5
          
          window.dispatchEvent(new CustomEvent('SMOOTH_MOVE', { detail: { x: targetX, z: targetZ, direction: nodeType.replace('linear_', '') } }))
          window.dispatchEvent(new CustomEvent('ROBOT_LOG', { detail: { t: `📐 Rel-Nav: ${nodeType.replace('_', ' ')} → [${targetX.toFixed(1)}, ${targetZ.toFixed(1)}]`, c: '#34d399' } }))
          await sleep(2000)
          continue
        }

        const [x, z] = getWmsCoords(nodeType)
        window.dispatchEvent(new CustomEvent(`NAVIGATE_TO`, { detail: { x, z, nodeType: label } }))

        await sleep(2000)

        if (nodeType.includes('dock') || nodeType.includes('charge')) {
          window.dispatchEvent(new CustomEvent('ROBOT_LOG', { detail: { t: `⚡ Docked at Charging Port for 5s...`, c: '#fbbf24' } }))
          await sleep(5000)
          window.dispatchEvent(new CustomEvent('ROBOT_LOG', { detail: { t: `✅ Battery restored. Resuming.`, c: colorHex } }))
          continue
        }

        const deg = NODE_DEGREES[nodeType] || { base: 0, arm1: 0, arm2: 0 }
        socketRef.current?.emit('execute-node', { type: nodeType, label, ...deg })
        
        // 2. Complex Kinematics Animation (The "Dip" and "Tuck")
        if (nodeType === 'pick' || nodeType === 'place') {
          // Step A: Dip Down (-45 deg shoulder)
          window.dispatchEvent(new CustomEvent(`ROBOT_CMD`, { detail: { type: nodeType, label } }))
          await sleep(1000)

          // Step B: Tuck Back up smoothly before moving
          window.dispatchEvent(new CustomEvent(`ROBOT_CMD`, { detail: { type: 'tuck', label: 'Tucking Arm' } }))
          await sleep(1000)
        } else {
          // Normal Command 
          window.dispatchEvent(new CustomEvent(`ROBOT_CMD`, { detail: { type: nodeType, label } }))
          await sleep(2000)
        }
      }
      setActiveNodes({ alpha: null, beta: null })
    }

    // Execute only Alpha/Single mode
    await runBotWorker(sequence, 'ALPHA', '#00d4ff')

    setWorkflowRunning(false)
    setActiveNodes({ alpha: null, beta: null })
  }

  // alias for the Run button
  const handleRunWorkflow = executeWarehouseLogistics

  // Bridge: both mini-sim and fullscreen buttons wire to the same runner
  useEffect(() => {
    const fn = () => handleRunWorkflow();
    window.addEventListener('EXECUTE_FROM_SIM', fn);
    window.addEventListener('START_GLOBAL_RUN', fn);
    return () => {
      window.removeEventListener('EXECUTE_FROM_SIM', fn);
      window.removeEventListener('START_GLOBAL_RUN', fn);
    };
  })


  const applySuggestion = (type) => {
    if (!selectedNode) return
    const newNodeData = makeNode(type, type === 'wait' ? 'Wait' : 'Pick Item', { x: selectedNode.position.x + 200, y: selectedNode.position.y })
    const newEdge = {
      id: `e-${selectedNode.id}-${newNodeData.id}`,
      source: selectedNode.id, target: newNodeData.id,
      animated: true, style: { stroke: 'var(--accent)', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent)' }
    }
    setNodes(nds => [...nds, newNodeData])
    setEdges(eds => [...eds, newEdge])
  }

  const handleNodesGenerated = useCallback((newNodes, newEdges, replace = false) => {
    const stampedNodes = newNodes.map(n => ({ ...n, type: 'custom' }))
    const stampedEdges = newEdges.map(e => ({
      ...e,
      animated: true,
      style: { stroke: 'var(--accent)', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent)' },
    }))
    if (replace) {
      setNodes(stampedNodes)
      setEdges(stampedEdges)
    } else {
      const offset = { x: 80, y: nodes.length > 0 ? 300 : 180 }
      const appendNodes = stampedNodes.map((n, i) => ({
        ...n,
        id: `ai-${Date.now()}-${i}`,
        position: { x: (n.position?.x || i * 220) + offset.x, y: (n.position?.y || 0) + offset.y },
      }))
      const idMap = {}
      newNodes.forEach((n, i) => { idMap[n.id] = appendNodes[i].id })
      const appendEdges = stampedEdges.map((e, i) => ({
        ...e,
        id: `ai-e-${Date.now()}-${i}`,
        source: idMap[e.source] || e.source,
        target: idMap[e.target] || e.target,
      }))
      setNodes(nds => [...nds, ...appendNodes])
      setEdges(eds => [...eds, ...appendEdges])
    }
  }, [nodes])

  const executingIndex = engineStatus.running ? engineStatus.currentStep - 1 : -1
  const currentNodeType = (
    engineStatus.running && nodes[executingIndex]
      ? nodes[executingIndex].data?.type
      : 'idle'
  ) || 'idle'

  // Dispatch window event for RobotSim PiP + emit socket for remote sim
  useEffect(() => {
    if (!engineStatus.running || !nodes[executingIndex]) return
    const nodeType = nodes[executingIndex].data?.type || 'idle'
    const label    = nodes[executingIndex].data?.label || nodeType
    // Window event — drives local PiP RobotSim
    window.dispatchEvent(new CustomEvent('WORKFLOW_STEP_UPDATE', {
      detail: { stepType: nodeType, label }
    }))
    // Socket — drives remote sim on second laptop
    const degrees = NODE_DEGREES[nodeType] || { base: 0, arm1: 0, arm2: 0 }
    socketRef.current?.emit('execute-node', { type: nodeType, label, ...degrees })
  }, [engineStatus.currentStep, engineStatus.running])

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>

      {/* LEFT pane: React Flow canvas (60%) */}
      <div ref={reactFlowWrapper} style={{ flex: 1, height: '100%', position: 'relative' }}>
        <ReactFlow
          nodes={nodes.map((n, i) => {
            const isAlpha = n.id === activeNodes.alpha
            const isBeta = n.id === activeNodes.beta
            return {
              ...n,
              style: isAlpha 
                ? { boxShadow: '0 0 20px #00d4ff, 0 0 40px #00d4ff50', border: '2px solid #00d4ff', borderRadius: 10, transition: 'all 0.3s' }
                : (isBeta 
                  ? { boxShadow: '0 0 20px #a855f7, 0 0 40px #a855f750', border: '2px solid #a855f7', borderRadius: 10, transition: 'all 0.3s' }
                  : {}),
              data: { ...n.data, executing: isAlpha || isBeta },
            }
          })}
          edges={edges.map(e => {
            const isAlphaActive = e.target === activeNodes.alpha
            const isBetaActive = e.target === activeNodes.beta
            if (isAlphaActive) return { ...e, style: { stroke: '#00d4ff', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#00d4ff' }, animated: true }
            if (isBetaActive) return { ...e, style: { stroke: '#a855f7', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' }, animated: true }
            return { ...e, animated: false, style: { stroke: 'rgba(0,212,255,0.4)', strokeWidth: 2 } }
          })}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode="Delete"
          style={{ background: 'var(--bg-base)' }}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: 'var(--accent)', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent)' },
          }}
        >
          <Background color="#1e2535" gap={24} size={1.5} />
          <Controls style={{ bottom: 24, left: 16 }} />
          <MiniMap
            nodeColor={(n) => {
              const t = n.data?.type
              if (t === 'start') return '#22c55e'
              if (t === 'end') return '#ef4444'
              if (t === 'navigate') return '#00d4ff'
              if (t === 'pick' || t === 'place') return '#a855f7'
              return '#8b95b0'
            }}
            style={{ bottom: 24, right: 16 }}
          />
          <Panel position="top-center">
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '6px 14px', fontSize: '0.75rem',
              color: 'var(--text-muted)', display: 'flex', gap: 16,
            }}>
              <span>Drag nodes from sidebar · Connect outputs to inputs</span>
              <span style={{ color: 'var(--border)' }}>|</span>
              <span>Delete key removes selected</span>
            </div>
          </Panel>
          <Panel position="bottom-center" style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: 30 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              background: 'rgba(17, 21, 32, 0.85)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24,
              padding: '12px 24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}>

              {/* Run Workflow button (Primary Action) */}
              <button
                onClick={handleRunWorkflow}
                disabled={workflowRunning || nodes.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 24px', borderRadius: 12,
                  border: 'none',
                  background: workflowRunning ? '#166534' : '#22c55e',
                  color: '#fff', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.05em',
                  cursor: workflowRunning ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', whiteSpace: 'nowrap',
                  transition: 'all 0.2s', opacity: workflowRunning ? 0.8 : 1,
                  boxShadow: workflowRunning ? 'none' : '0 4px 12px rgba(34,197,94,0.4)',
                }}
                onMouseEnter={e => { if (!workflowRunning) e.currentTarget.style.transform = 'scale(1.05)' }}
                onMouseLeave={e => { if (!workflowRunning) e.currentTarget.style.transform = 'scale(1)' }}
              >
                {workflowRunning ? <Loader size={16} className="spin" /> : <Play size={16} fill="currentColor" />}
                {workflowRunning ? 'EXECUTING WORKFLOW...' : 'EXECUTE WORKFLOW'}
              </button>

            </div>
          </Panel>
        </ReactFlow>

        <AIChatPanel onNodesGenerated={handleNodesGenerated} />

        {selectedNode && (
          <>
            <div style={{
              position: 'absolute', top: 16, right: 16, width: 240,
              background: 'var(--bg-surface)', border: '1px solid var(--border-accent)',
              borderRadius: 14, padding: 16, boxShadow: 'var(--glow-accent)',
              animation: 'fadeIn 0.2s ease', zIndex: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3>Edit Node</h3>
                <button onClick={() => setSelectedNode(null)} className="btn btn-ghost btn-sm btn-icon">x</button>
              </div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Label</label>
              <input value={selectedNode.data.label}
                onChange={e => { updateNodeLabel(selectedNode.id, e.target.value); setSelectedNode(s => ({ ...s, data: { ...s.data, label: e.target.value } })) }}
                style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit', marginBottom: 10, outline: 'none' }}
              />
              {selectedNode.data.type === 'navigate' && (
                <>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Target X (m)</label>
                  <input type="number" defaultValue={selectedNode.data.params?.x || 0} onChange={e => updateNodeParam(selectedNode.id, 'x', parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit', marginBottom: 6, outline: 'none' }} />
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Target Y (m)</label>
                  <input type="number" defaultValue={selectedNode.data.params?.y || 0} onChange={e => updateNodeParam(selectedNode.id, 'y', parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit', marginBottom: 6, outline: 'none' }} />
                </>
              )}
              {selectedNode.data.type === 'wait' && (
                <>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Duration (s)</label>
                  <input type="number" defaultValue={selectedNode.data.params?.duration || 2} onChange={e => updateNodeParam(selectedNode.id, 'duration', parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit', marginBottom: 6, outline: 'none' }} />
                </>
              )}
              {selectedNode.data.type === 'speak' && (
                <>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Text</label>
                  <input defaultValue={selectedNode.data.params?.text || ''} onChange={e => updateNodeParam(selectedNode.id, 'text', e.target.value)} style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit', marginBottom: 6, outline: 'none' }} />
                </>
              )}
              {selectedNode.data.type === 'pick' && (
                <>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Target Object</label>
                  <input defaultValue={selectedNode.data.params?.target || ''} onChange={e => updateNodeParam(selectedNode.id, 'target', e.target.value)} style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit', marginBottom: 6, outline: 'none' }} />
                </>
              )}
              {selectedNode.data.type === 'place' && (
                <>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Drop Location</label>
                  <input defaultValue={selectedNode.data.params?.location || ''} onChange={e => updateNodeParam(selectedNode.id, 'location', e.target.value)} style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit', marginBottom: 6, outline: 'none' }} />
                </>
              )}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Target Robot</label>
                <select
                  value={selectedNode.data.robot_target || 'all'}
                  onChange={e => {
                    const val = e.target.value
                    setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, robot_target: val } } : n))
                    setSelectedNode(s => ({ ...s, data: { ...s.data, robot_target: val } }))
                  }}
                  style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', marginBottom: 6 }}
                >
                  <option value="all">All Robots</option>
                  <option value="robot_a">Robot A</option>
                  <option value="robot_b">Robot B</option>
                </select>
              </div>
              <button onClick={deleteSelectedNode} className="btn btn-danger btn-sm" style={{ width: '100%', marginTop: 8 }}>
                Delete Node
              </button>
            </div>

            <div style={{
              position: 'absolute', top: 16, right: 266, width: 180,
              background: 'rgba(24, 29, 42, 0.85)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: 12,
              padding: 12, boxShadow: '0 0 20px rgba(168, 85, 247, 0.2)',
              animation: 'slideIn 0.3s ease', zIndex: 10
            }}>
              <h4 style={{ fontSize: '0.75rem', marginBottom: 8, color: 'var(--accent2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={12} /> AI Suggests:
              </h4>
              <button onClick={() => applySuggestion('wait')} className="btn btn-ghost btn-sm" style={{ width: '100%', marginBottom: 6, justifyContent: 'flex-start', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
                <Plus size={12} color="#f59e0b" /> Add Wait
              </button>
              <button onClick={() => applySuggestion('pick')} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
                <Plus size={12} color="#a855f7" /> Add Pick
              </button>
            </div>
          </>
        )}
      </div>

      <GlobalExecLog />
      <OperatorManual />

      {/* Save Status HUD */}
      <div style={{
        position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 1000, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 20px', borderRadius: 12,
        background: 'rgba(11, 15, 25, 0.9)', backdropFilter: 'blur(12px)',
        border: '1px solid',
        borderColor: saveIndicator ? '#22c55e' : 'rgba(255,255,255,0.1)',
        boxShadow: saveIndicator ? '0 0 20px rgba(34, 197, 94, 0.4)' : 'none',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        opacity: saveIndicator ? 1 : 0,
        transform: `translateX(-50%) translateY(${saveIndicator ? 0 : -20}px)`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: saveIndicator ? '#22c55e20' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Save size={18} color={saveIndicator ? '#22c55e' : '#fff'} />
        </div>
        <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em' }}>
          WORKFLOW SYNCED TO CACHE
        </span>
      </div>

      {/* PiP RobotSim — bottom-right overlay */}
      {activeTab !== 'simulation' && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, width: 340, height: 260,
          borderRadius: 14, overflow: 'hidden', zIndex: 50,
          border: '1px solid #00d4ff30', boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}>
          <button
            onClick={() => setActiveTab && setActiveTab('simulation')}
            style={{
              position: 'absolute', top: 12, right: 12, zIndex: 60,
              background: 'rgba(0, 212, 255, 0.2)', border: '1px solid #00d4ff', borderRadius: '50%',
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#00d4ff', cursor: 'pointer', backdropFilter: 'blur(4px)',
              transition: 'all 0.2s', boxShadow: '0 0 10px rgba(0,212,255,0.3)',
            }}
            title="Enlarge to Fullscreen"
          >
            <ExternalLink size={12} />
          </button>
          <RobotSim hideLog={true} />
        </div>
      )}

    </div>
  )
}
