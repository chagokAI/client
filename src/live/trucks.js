import { Truck, TRUCK_MM } from '../digital-twin/packing.js'
import { playbackTiming } from '../digital-twin/playback.js'

const valid = (values) => values.every((v) => Number.isFinite(v) && v > 0)

// 서버에서 이미 포장한 물품의 트럭 위치만 계산한다. 재매칭이나 재고 증감은 하지 않는다.
export function createLiveTruckFlow(world) {
  const line = world.lines[0]
  let truck = new Truck(1, world.truckMm ?? TRUCK_MM)
  const queue = []
  let nextStart = -Infinity
  const timing = playbackTiming(6)

  return {
    accept(item) {
      const dims = [item.box?.innerWidthMm, item.box?.innerDepthMm, item.box?.innerHeightMm]
      const itemDims = [item.itemMm?.widthMm, item.itemMm?.depthMm, item.itemMm?.heightMm]
      if (!valid(dims) || !valid(itemDims)) return false
      let spot = truck.place(dims)
      if (!spot) {
        const next = new Truck(truck.no + 1, truck.size)
        spot = next.place(dims)
        // 빈 트럭에도 못 들어가는 박스로 차량을 늘리지 않는다. 업무상의 포장 성공은 변경하지 않는다.
        if (!spot) return false
        truck = next
      }
      queue.push({
        eventId: item.eventId,
        serverItem: item,
        lane: 0,
        item: { name: item.product?.name ?? '등록 물품', dims: itemDims, source: 'DL 표본 재생' },
        box: {
          code: item.box.code,
          dims,
          ...spot,
          truck: truck.no,
          fill: item.fillRatePct,
          stockAfter: item.box.onHandQty,
        },
      })
      return true
    },
    pump(now = performance.now(), playing = true) {
      if (!world.busy(line)) world.pruneTrucks(line, 4)
      if (!playing || !queue.length || now < nextStart) return
      const event = queue[0]
      if (line.current().no !== event.box.truck) {
        if (world.busy(line)) return
        line.swapTruck(event.box.truck, timing.truckDuration)
        nextStart = now + timing.truckDuration * 1000
        return
      }
      // 트럭 전환·화면 지연 뒤에도 지난 주기를 몰아서 재생하지 않고, 한 건씩 새 간격으로 시작한다.
      if (world.flights.some((f) => f.kind === 'move' && f.line === line && !f.done)) return
      line.push(queue.shift(), timing.itemDuration)
      nextStart = now + timing.intervalMs
    },
    get pending() {
      return queue.length
    },
  }
}
