/**
 * rosService.js
 * Attempts a live roslibjs connection to ws://localhost:9090.
 * Falls back silently — the main arm state is driven by Socket.IO from our backend.
 */

let ros = null
let armStateTopic = null
const listeners = new Set()

export function initRosConnection(url = 'ws://localhost:9090') {
  try {
    if (typeof window === 'undefined' || !window.ROSLIB) return
    ros = new window.ROSLIB.Ros({ url })

    ros.on('connection', () => console.log('[ROS] Connected to rosbridge at', url))
    ros.on('error',      (e) => console.warn('[ROS] rosbridge unavailable:', e))
    ros.on('close',      () => console.log('[ROS] rosbridge connection closed'))

    armStateTopic = new window.ROSLIB.Topic({
      ros,
      name:        '/hmi_workflow_status',
      messageType: 'std_msgs/String',
    })

    armStateTopic.subscribe((msg) => {
      try {
        const data = JSON.parse(msg.data)
        listeners.forEach(cb => cb(data))
      } catch (_) {}
    })
  } catch (e) {
    console.warn('[ROS] roslibjs not available — using Socket.IO fallback')
  }
}

export function onArmState(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function publishArmCommand(pose) {
  if (!armStateTopic) return
  try {
    armStateTopic.publish(new window.ROSLIB.Message({ data: JSON.stringify(pose) }))
  } catch (_) {}
}
