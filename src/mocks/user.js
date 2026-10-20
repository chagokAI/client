// 헤더 프로필 메뉴에 표시하는 로그인 사용자 정보입니다.
// TODO: 인증 연동 시 세션에서 가져옵니다.
export const currentUser = {
  name: '김차곡',
  initial: '김',
  role: '운영자',
  employeeId: 'CG-20231',
  team: '물류운영팀',
}

export const centerOptions = [
  { value: 'main', label: 'OO 물류센터' },
  { value: 'icheon', label: '이천 본센터' },
  { value: 'gwangju', label: '광주 분센터' },
]
