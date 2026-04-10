# Origin HMI — Visual Robot Control Center

A **visual flow-based Human-Machine Interface** for industrial mobile robots.
Drag-and-drop workflow creation, real-time robot telemetry, manual control, and ROS2 integration — all in the browser.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Flow Builder** | Drag-and-drop nodes, connect them, configure params inline |
| **Templates** | Patrol Route, Pick & Place, Delivery Run pre-built |
| **Execution Engine** | Step-by-step workflow execution with progress tracking |
| **Real-time Dashboard** | Battery, position map, system health, log feed |
| **Manual Control** | Hold-to-drive D-pad for direct robot teleoperation |
| **Emergency Stop** | One-click E-STOP zeroes all velocity commands |
| **ROS2 Bridge** | Connects to rosbridge WebSocket; graceful simulation fallback |
| **Simulation Mode** | Full simulated robot with battery drain, circular motion |

---

## 🚀 Quick Start (Hackathon)

### Prerequisites
- Node.js 18+

### 1. Start the Backend

```bash
cd backend
npm install
npm start
# → Running on http://localhost:3001
```

### 2. Start the Frontend

```bash
cd frontend
npm install       # already done
npm run dev
# → Open http://localhost:5173
```

### 3. (Optional) Connect a Real Robot

If you have a ROS2 robot with rosbridge:

```bash
# On the robot:
ros2 launch rosbridge_server rosbridge_websocket_launch.xml

# Set env var before starting backend:
ROSBRIDGE_URL=ws://<robot-ip>:9090 npm start
```

---

## 🏗 Project Structure

```
Origin hacks/
├── backend/
│   ├── server.js          ← Express + Socket.IO server
│   ├── workflowEngine.js  ← Step-by-step workflow executor
│   ├── ros2Bridge.js      ← ROS2 bridge + sim fallback
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx              ← Main shell + Socket.IO
│   │   ├── components/
│   │   │   ├── Header.jsx       ← Topbar: status, E-STOP, nav
│   │   │   ├── Sidebar.jsx      ← Node palette, workflow controls
│   │   │   ├── FlowBuilder.jsx  ← ReactFlow canvas
│   │   │   ├── CustomNode.jsx   ← Styled flow nodes
│   │   │   ├── Dashboard.jsx    ← Telemetry + logs
│   │   │   ├── ControlPanel.jsx ← Manual drive + log panel
│   │   │   └── EmergencyStop.jsx
│   │   └── index.css            ← Dark industrial design system
│   └── package.json
└── README.md
```

---

## 🎯 Hackathon Pitch Script

> "Origin HMI lets you **program complex robot behaviors without writing a single line of code**.  
> Simply drag mission nodes onto the canvas, connect them in sequence, hit Run — and watch the robot execute.  
> Built-in emergency stop, real-time telemetry dashboard, and ROS2 integration mean it's production-ready from day one."

**Key demo flow:**
1. Load the **Delivery Run** template from the sidebar
2. Adjust the destination X/Y coordinates by clicking a Navigate node
3. Hit **Run** — watch the step progress bar and log feed
4. Hit **E-STOP** for a dramatic safety demo
5. Switch to **Dashboard** to show live battery & position map

---

## 🔌 REST API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/workflows` | List all workflows + templates |
| POST | `/api/workflows` | Save new workflow |
| PUT | `/api/workflows/:id` | Update workflow |
| DELETE | `/api/workflows/:id` | Delete workflow |
| POST | `/api/workflow/run` | Execute a workflow |
| POST | `/api/workflow/pause` | Pause execution |
| POST | `/api/workflow/resume` | Resume execution |
| POST | `/api/workflow/stop` | Stop execution |
| POST | `/api/estop` | Emergency stop |
| GET | `/api/status` | Engine + robot state |
| GET | `/api/log` | Execution log |

## 📡 WebSocket Events

| Event | Direction | Payload |
|---|---|---|
| `robot_state` | Server→Client | Battery, position, simMode |
| `engine_status` | Server→Client | running, step, total |
| `log` | Server→Client | level, message, time |
| `emergency_stop` | Bidirectional | — |
| `cmd_vel` | Client→Server | linear, angular |
| `estop` | Client→Server | — |
