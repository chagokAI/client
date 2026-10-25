// 규정 문서(markdown) 미리보기용 최소 변환: 제목(#·##)·목록(-)·문단·**굵게** 만 다룹니다.
// 문서는 에이전트 서버의 규정 파일이지만, 글자는 모두 이스케이프한 뒤 태그를 붙입니다.
const escape = (text) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const inline = (text) => escape(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

export function markdownToHtml(markdown) {
  const out = []
  let list = false
  const closeList = () => {
    if (list) out.push('</ul>')
    list = false
  }
  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      closeList()
      continue
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      closeList()
      const level = Math.min(heading[1].length + 2, 5)
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
    } else if (/^\s*[-*]\s+/.test(line)) {
      if (!list) out.push('<ul>')
      list = true
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`)
    } else {
      closeList()
      out.push(`<p>${inline(line)}</p>`)
    }
  }
  closeList()
  return out.join('')
}
