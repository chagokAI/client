import { onMounted, ref, watch } from 'vue'
import { useRemote } from './useRemote'

/**
 * 필터 + 페이지네이션이 있는 목록 화면의 공통 규칙을 한곳에 모은다.
 * - 필터가 바뀌면 항상 1페이지로 되돌린다(이미 1페이지면 그대로 다시 조회한다).
 * - 페이지가 바뀌면 다시 조회한다.
 * - 화면이 열리면 한 번 조회한다.
 *
 * @param filters 감시할 ref 배열. 이 중 하나라도 바뀌면 1페이지부터 다시 조회한다.
 * @param fetcher (signal, page) => Promise. page 는 0부터 시작하는 서버 기준 번호다.
 *                조회 조건이 아직 덜 채워졌으면 null 을 돌려주면 된다(그 회차는 건너뛴다).
 * @param accept  응답을 화면 상태에 반영하는 함수. totalPages 는 반환값으로 알려 준다.
 */
export function useListQuery(filters, fetcher, accept) {
  const { loading, error, load } = useRemote()
  const page = ref(1)
  const totalPages = ref(0)

  function refresh() {
    return load(signal => fetcher(signal, page.value - 1), (response) => {
      if (response == null) return
      totalPages.value = accept(response) ?? 0
    })
  }

  watch(filters, () => { if (page.value !== 1) page.value = 1; else refresh() })
  watch(page, refresh)
  onMounted(refresh)

  return { loading, error, page, totalPages, refresh }
}
