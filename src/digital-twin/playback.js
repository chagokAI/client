// 시뮬레이션과 라이브가 같은 속도에서 같은 이동·트럭 전환 시간을 사용한다.
export function playbackTiming(speed) {
  const itemDuration = speed >= 20 ? 0 : Math.max(0.6, Math.min(5, 8 / speed))
  return { intervalMs: 1000 / speed, itemDuration, truckDuration: itemDuration === 0 ? 0.3 : 1.5 }
}
