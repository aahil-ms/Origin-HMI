/**
 * ros2Bridge.js
 * Connects to a rosbridge WebSocket server (ws://localhost:9090).
 * Falls back to a rich simulation mode when rosbridge is unavailable.
 */

const WebSocket = require('ws');
const { EventEmitter } = require('events');

const ROSBRIDGE_URL = process.env.ROSBRIDGE_URL || 'ws://localhost:9090';

class ROS2Bridge extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.connected = false;
    this.simMode = false;
    this.simState = {
      battery: 85,
      position: { x: 0, y: 0, theta: 0 },
      status: 'idle',
      speed: 0,
    };
    this._simInterval = null;
    this._tryConnect();
  }

  _tryConnect() {
    try {
      this.ws = new WebSocket(ROSBRIDGE_URL, { handshakeTimeout: 3000 });

      this.ws.on('open', () => {
        console.log('[ROS2Bridge] Connected to rosbridge at', ROSBRIDGE_URL);
        this.connected = true;
        this.simMode = false;
        clearInterval(this._simInterval);
        this.emit('connected');
        this._subscribe('/robot/status');
        this._subscribe('/battery_state');
        this._subscribe('/odom');
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data);
          this.emit('ros_message', msg);
        } catch (e) {}
      });

      this.ws.on('close', () => {
        console.log('[ROS2Bridge] Disconnected — falling back to simulation.');
        this._enterSimMode();
      });

      this.ws.on('error', () => {
        console.log('[ROS2Bridge] Cannot reach rosbridge — running simulation.');
        this._enterSimMode();
      });
    } catch (e) {
      this._enterSimMode();
    }
  }

  _enterSimMode() {
    this.connected = false;
    this.simMode = true;
    this.emit('sim_mode');
    clearInterval(this._simInterval);
    this._simInterval = setInterval(() => this._tickSim(), 1000);
  }

  _tickSim() {
    // Slowly drain battery, move robot in a circle
    this.simState.battery = Math.max(0, this.simState.battery - 0.05);
    this.simState.position.theta += 0.02;
    // Normalize theta to [-π, π] to avoid unbounded accumulation
    if (this.simState.position.theta > Math.PI) {
      this.simState.position.theta -= 2 * Math.PI;
    }
    this.simState.position.x = 5 * Math.cos(this.simState.position.theta);
    this.simState.position.y = 5 * Math.sin(this.simState.position.theta);
    this.emit('sim_tick', { ...this.simState });
  }

  _subscribe(topic) {
    if (!this.connected || !this.ws) return;
    this.ws.send(JSON.stringify({
      op: 'subscribe',
      topic,
    }));
  }

  publish(topic, type, message) {
    if (this.connected && this.ws) {
      this.ws.send(JSON.stringify({ op: 'publish', topic, type, msg: message }));
      return true;
    }
    // Simulation: absorb publish and update sim state
    console.log(`[SIM PUBLISH] ${topic}:`, JSON.stringify(message));
    if (topic === '/cmd_vel') {
      this.simState.speed = Math.sqrt(
        (message.linear?.x || 0) ** 2 + (message.linear?.y || 0) ** 2
      );
      this.simState.status = this.simState.speed > 0 ? 'moving' : 'idle';
    }
    return false;
  }

  callService(service, type, args = {}) {
    if (this.connected && this.ws) {
      this.ws.send(JSON.stringify({ op: 'call_service', service, type, args }));
    } else {
      console.log(`[SIM SERVICE] ${service}:`, JSON.stringify(args));
    }
  }

  getSimState() {
    return { ...this.simState, simMode: this.simMode };
  }

  emergencyStop() {
    this.simState.status = 'emergency_stop';
    this.simState.speed = 0;
    this.publish('/cmd_vel', 'geometry_msgs/Twist', {
      linear: { x: 0, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: 0 },
    });
    this.emit('emergency_stop');
    console.log('[ROS2Bridge] EMERGENCY STOP TRIGGERED');
  }
}

module.exports = new ROS2Bridge();
