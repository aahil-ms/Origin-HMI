export const STATION_MAP = {
  START: [0, 0],
  LIDAR_STATION: [3, 2],
  ASSEMBLY_LINE: [-3, 4],
  STORAGE: [4, -2],
}

// Helper to map node types to coordinates
export function getCoordinatesForNode(nodeType) {
  if (!nodeType) return STATION_MAP.START
  const t = nodeType.toLowerCase()
  if (t === 'start' || t === 'end') return STATION_MAP.START
  if (t === 'lidar_scanner' || t.includes('lidar') || t.includes('scan')) return STATION_MAP.LIDAR_STATION
  if (t.includes('weld') || t.includes('assembly') || t.includes('place')) return STATION_MAP.ASSEMBLY_LINE
  if (t.includes('pick') || t.includes('storage')) return STATION_MAP.STORAGE
  
  // Default fallback if unknown
  return [ (Math.random() * 4 - 2), (Math.random() * 4 - 2) ] // Random nearby location for dynamically named nodes
}
