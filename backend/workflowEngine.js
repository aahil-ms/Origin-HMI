/**
 * workflowEngine.js
 * Parses and step-by-step executes visual workflows.
 * Each node type maps to a ROS2 action or service call.
 */

const { EventEmitter } = require('events');
const ros2 = require('./ros2Bridge');

const STEP_DELAY_MS = 1500; // simulated step execution time

class WorkflowEngine extends EventEmitter {
  constructor() {
    super();
    this.running = false;
    this.paused = false;
    this.currentWorkflow = null;
    this.currentStepIndex = 0;
    this.executionLog = [];
    this._stepTimer = null;
  }

  loadWorkflow(workflow) {
    if (this.running) {
      throw new Error('Cannot load workflow while one is already running.');
    }
    this.currentWorkflow = workflow;
    this.currentStepIndex = 0;
    this.executionLog = [];
    this.emit('workflow_loaded', { name: workflow.name, steps: workflow.nodes.length });
  }

  start() {
    if (!this.currentWorkflow) throw new Error('No workflow loaded.');
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this._log('info', `▶ Workflow "${this.currentWorkflow.name}" started`);
    this.emit('workflow_start', { name: this.currentWorkflow.name });
    this._executeNext();
  }

  pause() {
    this.paused = true;
    clearTimeout(this._stepTimer);
    this._log('warn', '⏸ Workflow paused');
    this.emit('workflow_pause');
  }

  resume() {
    if (!this.running) return;
    this.paused = false;
    this._log('info', '▶ Workflow resumed');
    this.emit('workflow_resume');
    this._executeNext();
  }

  stop() {
    this.running = false;
    this.paused = false;
    clearTimeout(this._stepTimer);
    this._log('warn', '⏹ Workflow stopped');
    this.emit('workflow_stop');
    this.currentStepIndex = 0;
  }

  _executeNext() {
    if (!this.running || this.paused) return;
    const nodes = this.currentWorkflow.nodes;

    if (this.currentStepIndex >= nodes.length) {
      this.running = false;
      this._log('success', `✅ Workflow "${this.currentWorkflow.name}" completed`);
      this.emit('workflow_complete', { name: this.currentWorkflow.name });
      return;
    }

    const node = nodes[this.currentStepIndex];
    this.emit('step_start', { index: this.currentStepIndex, node });
    this._log('info', `→ Step ${this.currentStepIndex + 1}: ${node.data.label}`);

    this._executeNode(node).then(() => {
      this._log('success', `✓ Step ${this.currentStepIndex + 1}: ${node.data.label} done`);
      this.emit('step_complete', { index: this.currentStepIndex, node });
      this.currentStepIndex++;
      this._stepTimer = setTimeout(() => this._executeNext(), STEP_DELAY_MS);
    }).catch((err) => {
      this._log('error', `✗ Step ${this.currentStepIndex + 1} failed: ${err.message}`);
      this.emit('step_error', { index: this.currentStepIndex, node, error: err.message });
      this.stop();
    });
  }

  _executeNode(node) {
    return new Promise((resolve, reject) => {
      const type = node.type || node.data?.type || 'unknown';
      const params = node.data?.params || {};

      switch (type) {
        case 'navigate':
          ros2.publish('/move_base_simple/goal', 'geometry_msgs/PoseStamped', {
            header: { frame_id: 'map' },
            pose: {
              position: { x: params.x || 0, y: params.y || 0, z: 0 },
              orientation: { w: 1 },
            },
          });
          setTimeout(resolve, 2000);
          break;

        case 'dock':
          ros2.callService('/dock', 'std_srvs/Trigger', {});
          setTimeout(resolve, 1500);
          break;

        case 'undock':
          ros2.callService('/undock', 'std_srvs/Trigger', {});
          setTimeout(resolve, 1500);
          break;

        case 'pick':
          ros2.callService('/arm/pick', 'robot_msgs/PickRequest', {
            target: params.target || 'object',
          });
          setTimeout(resolve, 2500);
          break;

        case 'place':
          ros2.callService('/arm/place', 'robot_msgs/PlaceRequest', {
            location: params.location || 'drop_zone',
          });
          setTimeout(resolve, 2500);
          break;

        case 'wait':
          setTimeout(resolve, (params.duration || 2) * 1000);
          break;

        case 'speak':
          ros2.publish('/tts/say', 'std_msgs/String', { data: params.text || 'Hello' });
          setTimeout(resolve, 1000);
          break;

        case 'charge':
          ros2.callService('/go_charge', 'std_srvs/Trigger', {});
          setTimeout(resolve, 2000);
          break;

        case 'start':
        case 'end':
          resolve();
          break;

        default:
          resolve(); // unknown nodes are skipped gracefully
      }
    });
  }

  _log(level, message) {
    const entry = { time: new Date().toISOString(), level, message };
    this.executionLog.push(entry);
    this.emit('log', entry);
  }

  getLog() {
    return [...this.executionLog];
  }

  getStatus() {
    return {
      running: this.running,
      paused: this.paused,
      currentStep: this.currentStepIndex,
      totalSteps: this.currentWorkflow?.nodes?.length || 0,
      workflowName: this.currentWorkflow?.name || null,
    };
  }
}

module.exports = new WorkflowEngine();
