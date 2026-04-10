/**
 * DigitalTwinMaster.jsx
 * ─────────────────────────────────────────────────────────────────────
 * Unified master component that wraps RobotSim with fullscreen-aware
 * configuration. All 3D state, event listeners, and visual logic live
 * in RobotSim.jsx — this component is the public face for both the
 * mini panel and the fullscreen monitor modal.
 *
 * Props:
 *   isFullscreen  (bool)   — if true: wider FOV, borderless, LIVE badge,
 *                            and "⚡ EXECUTE WAREHOUSE RUN" button
 *   hideLog       (bool)   — suppress the execution log overlay
 */

import RobotSim from './RobotSim'

export default function DigitalTwinMaster({ isFullscreen = false, hideLog = false }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <RobotSim isFullscreen={isFullscreen} hideLog={hideLog} />
    </div>
  )
}
