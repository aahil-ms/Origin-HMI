/**
 * server.js
 * Express + Socket.IO server.
 * REST API for workflow management.
 * WebSocket bridge to clients and ROS2.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ros2 = require('./ros2Bridge');
const engine = require('./workflowEngine');

const PORT = process.env.PORT || 3001;


// ── Hackathon Demo: open CORS for tunnel access ─────────────────
const CORS_OPTIONS = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const app = express();
app.use(cors(CORS_OPTIONS));
app.options('*', cors(CORS_OPTIONS));  // pre-flight
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
// Add this exact block
io.on('connection', (socket) => {
  console.log('User connected to ROS 2 Controller');

  socket.on('execute-node', (nodeData) => {
    console.log('Executing Node:', nodeData.label);
    // This sends the move command to your 3D Simulation page
    io.emit('COMMAND_ROBOT_MOVE', { 
      type: nodeData.type, 
      label: nodeData.label 
    });
  });
});
// ─────────────────────────────────────────────────────────────
// REST API
// ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────
// AI Flow Builder — Gemini Integration
// ─────────────────────────────────────────────────────────────
app.post('/api/ai/build-flow', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  // ── If GEMINI_API_KEY is set, call real Gemini API ──────────
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const systemPrompt = `You are a strict industrial robot workflow JSON generator for TVS automotive assembly lines.

RULES — YOU MUST FOLLOW EVERY RULE EXACTLY:
1. Output ONLY a raw JSON object. No markdown. No code fences. No explanation. No conversational text. Start your response with { and end with }.
2. The JSON must have exactly two top-level keys: "nodes" (array) and "edges" (array).
3. Use ONLY these valid node type values: "start", "end", "lidar_scanner", "thermal_threshold", "proximity_sensor", "pneumatic_gripper", "arc_weld_path", "conveyor_sync", "if_else", "parallel_fork", "wait_for_state", "ml_defect_check", "safety_zone_monitor", "navigate", "pick", "place", "wait", "charge".
4. Every node MUST have:
   - "id": a simple incrementing string like "1", "2", "3" (never compound IDs like n1-2)
   - "type": always the string "custom"
   - "position": { "x": 250, "y": <stepIndex * 100> } where stepIndex starts at 100 and increments by 100 per node (Node 1: y=100, Node 2: y=200, etc.)
   - "data": { "label": "<human readable label>", "type": "<one of the valid type values above>" }
5. Always begin with a node of type "start" (id: "1") and end with a node of type "end".
6. The "edges" array must connect nodes SEQUENTIALLY. Each edge must have:
   - "id": "e<number>" e.g., "e1", "e2"
   - "source": the id of the PREVIOUS node
   - "target": the id of the CURRENT node
   - "animated": true
7. Do not skip any id numbers. Do not reuse ids.

EXAMPLE OUTPUT for prompt "scan the part then weld it":
{"nodes":[{"id":"1","type":"custom","position":{"x":250,"y":100},"data":{"label":"Start","type":"start"}},{"id":"2","type":"custom","position":{"x":250,"y":200},"data":{"label":"LiDAR Scan Part","type":"lidar_scanner"}},{"id":"3","type":"custom","position":{"x":250,"y":300},"data":{"label":"Arc Weld Path","type":"arc_weld_path"}},{"id":"4","type":"custom","position":{"x":250,"y":400},"data":{"label":"End","type":"end"}}],"edges":[{"id":"e1","source":"1","target":"2","animated":true},{"id":"e2","source":"2","target":"3","animated":true},{"id":"e3","source":"3","target":"4","animated":true}]}

Now generate a workflow for this task: ${prompt}`;

      const result = await model.generateContent(systemPrompt);
      let text = result.response.text().trim();

      // Robust stripping of any markdown fences Gemini might add
      text = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      // Extract just the JSON object if there's any surrounding text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object found in response');

      const flow = JSON.parse(jsonMatch[0]);

      // Validate the response has the required shape
      if (!Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) {
        throw new Error('Response missing nodes or edges array');
      }

      console.log(`[AI] Gemini generated ${flow.nodes.length} nodes, ${flow.edges.length} edges`);
      return res.json(flow);
    } catch (e) {
      console.error('[AI] Gemini error:', e.message);
      // Fall through to smart mock on parse/API error
    }
  }

  // ── Keyword-based smart mock — vertical layout, TVS node types ──
  console.log('[AI] Using mock flow builder for prompt:', prompt);
  const p = prompt.toLowerCase();
  const nodes = [];
  const edges = [];
  let idCounter = 1;

  const addNode = (label, type) => {
    const id = String(idCounter);
    const prevId = idCounter > 1 ? String(idCounter - 1) : null;
    nodes.push({
      id,
      type: 'custom',
      position: { x: 250, y: idCounter * 100 },
      data: { label, type },
    });
    if (prevId) {
      edges.push({ id: `e${idCounter - 1}`, source: prevId, target: id, animated: true });
    }
    idCounter++;
    return id;
  };

  addNode('Start', 'start');

  // TVS sensor keywords
  if (p.includes('scan') || p.includes('lidar') || p.includes('detect')) {
    addNode('LiDAR Scan', 'lidar_scanner');
  }
  if (p.includes('thermal') || p.includes('heat') || p.includes('temperature')) {
    addNode('Thermal Check', 'thermal_threshold');
  }
  if (p.includes('proximity') || p.includes('nearby') || p.includes('close')) {
    addNode('Proximity Sensor', 'proximity_sensor');
  }
  // TVS actuator keywords
  if (p.includes('grip') || p.includes('grasp') || p.includes('pick') || p.includes('grab')) {
    addNode('Pneumatic Gripper', 'pneumatic_gripper');
  }
  if (p.includes('weld') || p.includes('arc') || p.includes('join')) {
    addNode('Arc Weld Path', 'arc_weld_path');
  }
  if (p.includes('conveyor') || p.includes('belt') || p.includes('sync')) {
    addNode('Conveyor Sync', 'conveyor_sync');
  }
  // Control flow keywords
  if (p.includes('if') || p.includes('condition') || p.includes('check quality') || p.includes('defect')) {
    addNode('IF/ELSE Condition', 'if_else');
  }
  if (p.includes('parallel') || p.includes('fork') || p.includes('simultaneous')) {
    addNode('Parallel Fork', 'parallel_fork');
  }
  if (p.includes('wait') || p.includes('hold') || p.includes('pause')) {
    addNode('Wait for State', 'wait_for_state');
  }
  // AI Vision keywords
  if (p.includes('ml') || p.includes('defect') || p.includes('inspect') || p.includes('vision') || p.includes('quality')) {
    addNode('ML Defect Check', 'ml_defect_check');
  }
  if (p.includes('safety') || p.includes('zone') || p.includes('monitor')) {
    addNode('Safety Zone Monitor', 'safety_zone_monitor');
  }
  // General fallbacks
  if (p.includes('navigate') || p.includes('move') || p.includes('go')) {
    addNode('Navigate', 'navigate');
  }
  if (p.includes('place') || p.includes('drop') || p.includes('deliver')) {
    addNode('Place Object', 'place');
  }
  if (p.includes('charge') || p.includes('battery')) {
    addNode('Charge', 'charge');
  }

  // Fallback if nothing matched
  if (nodes.length === 1) {
    addNode('LiDAR Scan', 'lidar_scanner');
    addNode('ML Defect Check', 'ml_defect_check');
    addNode('Pneumatic Gripper', 'pneumatic_gripper');
  }

  addNode('End', 'end');

  console.log(`[AI] Mock generated ${nodes.length} nodes, ${edges.length} edges`);
  return res.json({ nodes, edges });
});




app.post('/api/users/sync', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email }
    });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workflows', async (req, res) => {
  try {
    const workflows = await prisma.workflow.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

app.post('/api/workflows/save', async (req, res) => {
  try {
    const { name, nodes, edges } = req.body;
    const flow = await prisma.workflow.create({
      data: { 
        name: name || "Untitled Flow", 
        nodes: nodes || [], 
        edges: edges || [] 
      }
    });
    res.status(200).json(flow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// TASK 2 & 3: NEW API ROUTES FOR PROJECTS
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await prisma.workflow.findMany({ orderBy: { createdAt: 'desc' } });
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { name, nodes, edges } = req.body;
    const newProject = await prisma.workflow.create({
      data: { 
        name: name || "Untitled Project", 
        nodes: nodes || [], 
        edges: edges || [] 
      }
    });
    res.status(201).json(newProject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/workflow/run', (req, res) => {
  try {
    const wf = req.body;

    // ── Swarm orchestration: route per-node commands to robot namespaces ──
    if (wf.nodes && Array.isArray(wf.nodes)) {
      wf.nodes.forEach(node => {
        const target = node.data?.robot_target || 'all';
        const namespaces = target === 'all'
          ? ['/robot_a/cmd_vel', '/robot_b/cmd_vel']
          : [`/${target}/cmd_vel`];

        if (node.data?.type === 'navigate' && node.data?.params) {
          const { x = 0, y = 0 } = node.data.params;
          namespaces.forEach(ns => {
            console.log(`[Swarm] Routing navigate (x:${x}, y:${y}) → ${ns}`);
            ros2.publish(ns, 'geometry_msgs/Twist', {
              linear: { x: parseFloat(x), y: 0, z: 0 },
              angular: { x: 0, y: 0, z: 0 }
            });
          });
        }
      });
    }

    engine.loadWorkflow(wf);
    engine.start();
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});


app.post('/api/workflow/pause', (req, res) => {
  engine.pause();
  res.json({ ok: true });
});

app.post('/api/workflow/resume', (req, res) => {
  engine.resume();
  res.json({ ok: true });
});

app.post('/api/workflow/stop', (req, res) => {
  engine.stop();
  res.json({ ok: true });
});

app.post('/api/estop', (req, res) => {
  ros2.emergencyStop();
  engine.stop();
  io.emit('emergency_stop');
  res.json({ ok: true });
});

app.get('/api/status', (req, res) => {
  res.json({
    engine: engine.getStatus(),
    robot: ros2.getSimState(),
  });
});

app.get('/api/log', (req, res) => {
  res.json(engine.getLog());
});

// ─────────────────────────────────────────────────────────────
// Socket.IO
// ─────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('[Socket.IO] Client connected:', socket.id);

  // Send current state on connect
  socket.emit('robot_state', ros2.getSimState());
  socket.emit('engine_status', engine.getStatus());
  socket.emit('log_history', engine.getLog().slice(-50));

  socket.on('disconnect', () => {
    console.log('[Socket.IO] Client disconnected:', socket.id);
  });

  socket.on('cmd_vel', (data) => {
    ros2.publish('/cmd_vel', 'geometry_msgs/Twist', data);
  });

  socket.on('estop', () => {
    ros2.emergencyStop();
    engine.stop();
    io.emit('emergency_stop');
  });
});

// Bridge engine events → Socket.IO
const engineEvents = ['workflow_start', 'workflow_complete', 'workflow_stop', 'workflow_pause',
  'workflow_resume', 'step_start', 'step_complete', 'step_error', 'log'];
engineEvents.forEach(evt => {
  engine.on(evt, (data) => {
    io.emit(evt, data);
    io.emit('engine_status', engine.getStatus());
  });
});

// Bridge ROS2 sim ticks → Socket.IO
ros2.on('sim_tick', (state) => {
  io.emit('robot_state', { ...state, simMode: true });
});

ros2.on('ros_message', (msg) => {
  io.emit('ros_message', msg);
});

ros2.on('emergency_stop', () => {
  io.emit('emergency_stop');
});

// ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🤖 Robot HMI Backend running on http://localhost:${PORT}`);
});
