// 입력값 판정만 모읍니다. 안내 문구는 화면마다 가리키는 항목이 달라 호출부에서 정합니다.
export const isPositiveInt = (value) => Number.isInteger(Number(value)) && Number(value) > 0
export const isNonNegativeInt = (value) => Number.isInteger(Number(value)) && Number(value) >= 0

// 폼의 가로·세로·높이를 숫자 배열로 바꿉니다. 저장 본문에 그대로 싣습니다.
export const toDimensions = (form) => [form.width, form.depth, form.height].map(Number)
