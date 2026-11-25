// Vercel 서버리스 함수: 프론트엔드 대신 에어코리아 API를 호출해 인증키를 숨기는 프록시 역할
module.exports = async function handler(req, res) {
  // GET 요청만 허용하고 다른 HTTP 메서드는 차단
  if (req.method !== "GET") {
    return res.status(405).json({ error: "허용되지 않은 요청 방식입니다." });
  }

  // 환경변수에서 에어코리아 Decoding 인증키 읽기 (코드에 키를 직접 적지 않음)
  const serviceKey = process.env.AIRKOREA_KEY;
  // 환경변수가 비어 있으면 한국어 오류 메시지 반환
  if (!serviceKey) {
    return res.status(500).json({ error: "서버에 인증키 환경변수가 설정되지 않았습니다." });
  }

  // 쿼리 파라미터에서 시도 이름(sido)을 읽고, 없으면 기본값 '서울' 사용
  const rawSido = Array.isArray(req.query?.sido) ? req.query.sido[0] : req.query?.sido;
  // 공백을 제거한 시도 이름 확정
  const sido = rawSido && String(rawSido).trim() ? String(rawSido).trim() : "서울";

  // 공공데이터포털 에어코리아 실시간 측정정보 요청 기본 주소
  const baseUrl = "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty";
  // Decoding 인증키를 주소에 안전하게 붙이기 위해 encodeURIComponent로 인코딩
  const encodedKey = encodeURIComponent(serviceKey.trim());
  // 나머지 요청 파라미터를 쿼리 문자열로 구성
  const params = new URLSearchParams({
    returnType: "json",
    sidoName: sido,
    numOfRows: "100",
    pageNo: "1",
    ver: "1.3"
  });
  // 최종 요청 URL 조립
  const requestUrl = `${baseUrl}?serviceKey=${encodedKey}&${params.toString()}`;

  try {
    // 에어코리아 API 서버로 데이터 요청 전송
    const apiResponse = await fetch(requestUrl);
    // XML 에러 응답도 직접 검사할 수 있도록 먼저 문자열로 읽기
    const rawText = await apiResponse.text();
    // 응답 문자열 앞뒤 공백 제거
    const trimmedText = rawText.trim();

    // 응답이 XML 형태('<'로 시작)로 오면 인증키나 요청 파라미터 오류로 판단
    if (trimmedText.startsWith("<")) {
      return res.status(502).json({ error: "인증키 또는 요청값을 확인해주세요" });
    }

    // JSON 문자열을 객체로 변환할 변수 선언
    let data;
    try {
      // 응답 텍스트를 JSON으로 파싱
      data = JSON.parse(trimmedText);
    } catch {
      // JSON 파싱에 실패한 경우에도 한국어 오류 메시지 반환
      return res.status(502).json({ error: "인증키 또는 요청값을 확인해주세요" });
    }

    // 응답 본문 헤더의 결과 코드(resultCode) 확인
    const resultCode = data?.response?.header?.resultCode;
    // resultCode가 정상("00")이 아닐 때 한국어 오류 메시지 반환
    if (resultCode !== "00") {
      return res.status(400).json({
        error: `데이터 조회에 실패했습니다. 인증키 또는 요청값을 확인해주세요 (결과 코드: ${resultCode || "없음"})`
      });
    }

    // HTTP 상태가 비정상이면 오류 반환
    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({
        error: "공공데이터 서버 응답이 원활하지 않습니다. 잠시 후 다시 시도해주세요."
      });
    }

    // 정상 JSON 데이터를 클라이언트(브라우저)로 전달
    return res.status(200).json(data);
  } catch {
    // 네트워크 장애 등 예외 발생 시 한국어 오류 메시지 반환
    return res.status(500).json({
      error: "대기오염 정보를 가져오는 중 서버 통신 오류가 발생했습니다."
    });
  }
};
