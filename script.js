// 우리 서버리스 함수(/api/dust) 호출 기본 경로 상수 정의
const API_URL = "/api/dust";

// 시도 선택 드롭다운 HTML 요소 가져오기
const sidoSelect = document.getElementById("sido-select");
// 상단 대표 공기 신호등 요약 카드 요소 가져오기
const summarySectionEl = document.getElementById("summary-section");
// 선택한 시도 이름을 표시할 HTML 요소 가져오기
const selectedSidoEl = document.getElementById("selected-sido");
// 대표 등급 이모지를 표시할 HTML 요소 가져오기
const summaryEmojiEl = document.getElementById("summary-emoji");
// 대표 등급 글자를 표시할 HTML 요소 가져오기
const summaryGradeTextEl = document.getElementById("summary-grade-text");
// 지역 평균 미세먼지 수치를 표시할 HTML 요소 가져오기
const averagePm10El = document.getElementById("average-pm10");
// 평균 수치 단위를 표시할 HTML 요소 가져오기
const averageUnitEl = document.getElementById("average-unit");
// 등급에 따른 한 줄 행동 요령 문구를 표시할 HTML 요소 가져오기
const summaryAdviceEl = document.getElementById("summary-advice");
// 로딩 및 오류 안내 메시지를 표시할 HTML 요소 가져오기
const statusMessageEl = document.getElementById("status-message");
// 가로 막대그래프 섹션 요소 가져오기
const chartSectionEl = document.getElementById("chart-section");
// 그래프 높이를 유동적으로 조절할 컨테이너 요소 가져오기
const chartContainerEl = document.getElementById("chart-container");
// Chart.js 그래프를 그릴 캔버스 요소 가져오기
const chartCanvasEl = document.getElementById("pm10-chart");
// 그래프용 측정값이 없을 때 보여줄 안내 문구 요소 가져오기
const chartEmptyEl = document.getElementById("chart-empty");
// 측정소 카드 목록을 담을 HTML 요소 가져오기
const stationListEl = document.getElementById("station-list");

// 등급 코드에 따른 색상 클래스, 이모지, 라벨, 안내 문구, 막대 색상 매핑 객체
const GRADE_INFO_MAP = {
  // 1등급은 파란색, 좋음, 맑은 공기 안내 문구로 설정
  "1": {
    className: "grade-1",
    emoji: "🔵",
    label: "좋음",
    advice: "공기가 맑아 야외 활동하기 좋아요",
    isWarning: false,
    barBg: "rgba(37, 99, 235, 0.85)",
    barBorder: "#2563eb"
  },
  // 2등급은 초록색, 보통, 일상 활동 안내 문구로 설정
  "2": {
    className: "grade-2",
    emoji: "🟢",
    label: "보통",
    advice: "무난한 대기 상태예요. 평소처럼 활동하세요",
    isWarning: false,
    barBg: "rgba(22, 163, 74, 0.85)",
    barBorder: "#16a34a"
  },
  // 3등급은 주황색, 나쁨, 마스크 안내 문구로 설정
  "3": {
    className: "grade-3",
    emoji: "🟠",
    label: "나쁨",
    advice: "외출 시 마스크를 챙기세요",
    isWarning: true,
    barBg: "rgba(234, 88, 12, 0.85)",
    barBorder: "#ea580c"
  },
  // 4등급은 빨간색, 매우나쁨, 마스크 안내 문구로 설정
  "4": {
    className: "grade-4",
    emoji: "🔴",
    label: "매우나쁨",
    advice: "외출 시 마스크를 챙기세요",
    isWarning: true,
    barBg: "rgba(220, 38, 38, 0.85)",
    barBorder: "#dc2626"
  }
};

// 등급 값이 비어 있을 때 사용할 기본 회색 정보 객체
const UNKNOWN_GRADE_INFO = {
  className: "grade-unknown",
  emoji: "⚪",
  label: "정보 없음",
  advice: "현재 이 지역의 대기 상태 정보를 확인할 수 없어요",
  isWarning: false,
  barBg: "rgba(107, 114, 128, 0.85)",
  barBorder: "#6b7280"
};

// 빠른 연속 선택 시 이전 요청 결과를 무시하기 위한 요청 번호 변수
let currentRequestId = 0;
// 기존 Chart.js 인스턴스를 정리하고 새로 그리기 위한 참조 변수
let pm10ChartInstance = null;

// 측정값이 유효한 숫자인지 확인해 숫자 또는 null을 반환하는 함수
function parseValidNumber(rawValue) {
  // 값이 없거나 null, undefined이면 계산에서 제외하기 위해 null 반환
  if (rawValue === null || rawValue === undefined) {
    return null;
  }
  // 양쪽 공백을 제거한 문자열로 변환
  const trimmed = String(rawValue).trim();
  // 빈 문자열이거나 "-"로 오면 계산하지 않고 null 반환
  if (trimmed === "" || trimmed === "-") {
    return null;
  }
  // 문자열 값을 숫자 타입으로 변환
  const parsed = Number(trimmed);
  // 유한한 숫자가 아니면 null 반환
  if (!Number.isFinite(parsed)) {
    return null;
  }
  // 정상적인 숫자면 그대로 반환
  return parsed;
}

// 화면에 표시할 미세먼지 측정값 문자열을 만드는 함수
function formatMeasureValue(rawValue) {
  // 유효한 숫자인지 먼저 검사
  const numericValue = parseValidNumber(rawValue);
  // 숫자가 아니거나 "-"로 왔으면 "측정 안 됨" 문구 반환
  if (numericValue === null) {
    return "측정 안 됨";
  }
  // 정상 수치면 단위와 함께 반환
  return `${numericValue} ㎍/㎥`;
}

// API 측정 시각 문자열("2026-10-28 16:00")을 한국어 형식으로 변환하는 함수
function formatKoreanDateTime(rawDataTime) {
  // 값이 없거나 "-"이면 "측정 안 됨" 반환
  if (!rawDataTime || String(rawDataTime).trim() === "" || String(rawDataTime).trim() === "-") {
    return "측정 안 됨";
  }
  // 앞뒤 공백을 제거한 문자열 준비
  const trimmed = String(rawDataTime).trim();
  // YYYY-MM-DD HH:MM 형식에서 연, 월, 일, 시, 분 추출
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  // 정규식 형식이 맞지 않으면 원문 뒤에 기준만 붙여 반환
  if (!match) {
    return `${trimmed} 기준`;
  }
  // 각 날짜와 시간 숫자를 추출해 앞자리 0 정리
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  // 분이 00이면 "시 기준"까지만 깔끔하게 표시하고, 분이 있으면 분까지 표시
  if (minute === 0) {
    return `${year}년 ${month}월 ${day}일 ${hour}시 기준`;
  }
  // 분 단위까지 포함된 한국어 시각 문자열 반환
  return `${year}년 ${month}월 ${day}일 ${hour}시 ${minute}분 기준`;
}

// 등급 값에 맞는 카드 색상 클래스와 등급 정보를 반환하는 함수
function getGradeInfo(pm10Grade) {
  // 등급 값이 비어 있거나 문자열이 아니면 빈 문자열로 처리
  const key = pm10Grade ? String(pm10Grade).trim() : "";
  // 매핑된 등급 정보가 있으면 반환하고 없으면 회색 정보 객체 반환
  return GRADE_INFO_MAP[key] || UNKNOWN_GRADE_INFO;
}

// 지역 평균 미세먼지 수치를 에어코리아 기준(0~30, 31~80, 81~150, 151~)에 따라 등급 코드로 바꾸는 함수
function getGradeCodeFromAverage(average) {
  // 평균 30 이하이면 1등급(좋음) 반환
  if (average <= 30) {
    return "1";
  }
  // 평균 80 이하이면 2등급(보통) 반환
  if (average <= 80) {
    return "2";
  }
  // 평균 150 이하이면 3등급(나쁨) 반환
  if (average <= 150) {
    return "3";
  }
  // 평균 150 초과이면 4등급(매우나쁨) 반환
  return "4";
}

// 상태 안내 메시지를 화면에 표시하는 함수
function setStatusMessage(message, isError = false) {
  // 전달받은 안내 문구를 텍스트로 설정
  statusMessageEl.textContent = message;
  // 오류 여부에 따라 error 클래스를 추가하거나 제거
  statusMessageEl.classList.toggle("error", isError);
}

// 상단 대표 공기 신호등 영역의 배경색과 텍스트를 갱신하는 보조 함수
function updateSummaryBanner(gradeInfo, averageText, showUnit, notMeasured = false) {
  // 기존 등급 색상 클래스를 모두 제거한 뒤 새 등급 클래스 적용
  summarySectionEl.classList.remove("grade-1", "grade-2", "grade-3", "grade-4", "grade-unknown");
  summarySectionEl.classList.add(gradeInfo.className);
  // 이모지와 대표 등급 글자 갱신
  summaryEmojiEl.textContent = gradeInfo.emoji;
  summaryGradeTextEl.textContent = gradeInfo.label;
  // 평균 수치 텍스트와 보조 스타일 갱신
  averagePm10El.textContent = averageText;
  averagePm10El.classList.toggle("not-measured", notMeasured);
  // 단위 표시 여부 설정
  averageUnitEl.style.display = showUnit ? "inline" : "none";
  // 한 줄 행동 요령 안내 문구와 강조 스타일 갱신
  summaryAdviceEl.textContent = gradeInfo.advice;
  summaryAdviceEl.classList.toggle("warning", gradeInfo.isWarning);
}

// 측정소 목록의 유효한 미세먼지 값을 모아 평균을 계산하고 대표 신호등 상태를 표시하는 함수
function renderAveragePm10(sidoName, items) {
  // 상단 요약 제목의 시도 이름 갱신
  selectedSidoEl.textContent = sidoName;
  // "-" 등을 제외한 유효한 미세먼지 숫자만 배열로 추출
  const validValues = items
    .map((item) => parseValidNumber(item.pm10Value))
    .filter((value) => value !== null);

  // 유효한 측정값이 하나도 없을 때 처리
  if (validValues.length === 0) {
    // 회색 상태와 "측정 안 됨" 문구로 요약 카드 갱신
    updateSummaryBanner(UNKNOWN_GRADE_INFO, "측정 안 됨", false, true);
    return;
  }

  // 유효한 수치들의 합계를 계산
  const sum = validValues.reduce((acc, current) => acc + current, 0);
  // 평균을 구해 소수점 첫째 자리까지 반올림한 숫자로 변환
  const average = Number((sum / validValues.length).toFixed(1));
  // 평균 수치에 해당하는 대표 등급 정보 가져오기
  const gradeCode = getGradeCodeFromAverage(average);
  const gradeInfo = getGradeInfo(gradeCode);
  // 대표 이모지, 등급 글자, 평균 수치, 한 줄 안내 문구까지 한 번에 반영
  updateSummaryBanner(gradeInfo, String(average), true, false);
}

// 전국 조회 여부에 따라 그래프와 카드에서 공통으로 쓸 측정소 이름 반환 함수
function formatStationTitle(selectedSido, item) {
  // 측정소 이름이 비어 있을 때 기본 문자열 지정
  const stationNameText = item.stationName || "이름 없음";
  // 전국 조회일 때는 시도 이름을 앞에 붙여 구분하기 쉽게 반환
  return selectedSido === "전국" && item.sidoName
    ? `${item.sidoName} ${stationNameText}`
    : stationNameText;
}

// 기존 그래프를 파기하고 그래프 영역을 숨기는 함수
function clearPm10Chart() {
  // 이미 그려진 차트가 있으면 메모리 누수와 캔버스 충돌 방지를 위해 제거
  if (pm10ChartInstance) {
    pm10ChartInstance.destroy();
    pm10ChartInstance = null;
  }
  // 그래프 영역 전체를 숨김 처리
  chartSectionEl.hidden = true;
}

// 측정소별 미세먼지 수치를 높은 순 상위 10개 가로 막대그래프로 그리는 함수
function renderPm10Chart(selectedSido, items) {
  // 기존 차트가 남아 있으면 먼저 정리
  if (pm10ChartInstance) {
    pm10ChartInstance.destroy();
    pm10ChartInstance = null;
  }

  // 측정소 목록 자체가 없으면 그래프 영역을 숨기고 종료
  if (items.length === 0) {
    chartSectionEl.hidden = true;
    return;
  }

  // 그래프 섹션을 화면에 표시
  chartSectionEl.hidden = false;

  // '측정 안 됨'인 측정소를 제외하고 숫자 수치가 있는 항목만 모아서 높은 순 정렬 후 상위 10개 추출
  const topTen = items
    .map((item) => ({
      item,
      pm10Num: parseValidNumber(item.pm10Value)
    }))
    .filter((entry) => entry.pm10Num !== null)
    .sort((a, b) => b.pm10Num - a.pm10Num)
    .slice(0, 10);

  // 유효한 측정값이 하나도 없거나 Chart 라이브러리를 불러오지 못한 경우 처리
  if (topTen.length === 0 || typeof Chart === "undefined") {
    chartContainerEl.hidden = true;
    chartEmptyEl.hidden = false;
    chartEmptyEl.textContent =
      typeof Chart === "undefined"
        ? "그래프 라이브러리를 불러오지 못했습니다."
        : "그래프로 표시할 측정값이 없습니다.";
    return;
  }

  // 캔버스 컨테이너를 보이고 빈 안내 문구는 숨기기
  chartContainerEl.hidden = false;
  chartEmptyEl.hidden = true;
  // 측정소 개수에 맞춰 막대 간격이 자연스럽게 보이도록 높이 동적 설정
  chartContainerEl.style.height = `${Math.max(180, topTen.length * 36 + 56)}px`;

  // 각 측정소의 이름, 수치, 등급별 배경색·테두리색·라벨 배열 생성
  const labels = topTen.map((entry) => formatStationTitle(selectedSido, entry.item));
  const values = topTen.map((entry) => entry.pm10Num);
  const gradeInfos = topTen.map((entry) => getGradeInfo(entry.item.pm10Grade));
  const backgroundColors = gradeInfos.map((info) => info.barBg);
  const borderColors = gradeInfos.map((info) => info.barBorder);

  // Chart.js로 가로 막대그래프 생성
  pm10ChartInstance = new Chart(chartCanvasEl, {
    // 막대그래프 타입 지정
    type: "bar",
    // 측정소별 수치와 등급별 막대 색상 데이터 연결
    data: {
      labels,
      datasets: [
        {
          label: "미세먼지",
          data: values,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1.5,
          borderRadius: 6
        }
      ]
    },
    // 가로 방향 배치, 한국어 툴팁 및 축 옵션 설정
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const gradeLabel = gradeInfos[context.dataIndex]?.label || "정보 없음";
              return ` 미세먼지: ${context.parsed.x} ㎍/㎥ (${gradeLabel})`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: "미세먼지 (㎍/㎥)"
          }
        },
        y: {
          ticks: {
            autoSkip: false
          }
        }
      }
    }
  });
}

// 측정소 데이터 배열을 받아 카드 목록 DOM을 생성하는 함수
function renderStationCards(selectedSido, items) {
  // 기존에 화면에 있던 측정소 카드를 모두 비우기
  stationListEl.innerHTML = "";

  // 측정소 데이터가 비어 있으면 안내 문구 표시 후 종료
  if (items.length === 0) {
    setStatusMessage("표시할 측정소 정보가 없습니다.");
    return;
  }

  // DOM 추가 성능을 높이기 위해 문서 조각 객체 생성
  const fragment = document.createDocumentFragment();

  // 각 측정소 항목마다 카드를 하나씩 생성
  items.forEach((item) => {
    // 등급 값에 따른 색상 클래스와 라벨 가져오기
    const gradeInfo = getGradeInfo(item.pm10Grade);
    // 카드 전체를 감쌀 article 요소 생성
    const card = document.createElement("article");
    // 기본 카드 클래스와 등급 색상 클래스 적용
    card.className = `station-card ${gradeInfo.className}`;

    // 카드 상단 영역 요소 생성
    const cardHeader = document.createElement("div");
    // 상단 정렬 클래스 지정
    cardHeader.className = "card-header";

    // 측정소 이름을 표시할 제목 요소 생성
    const stationTitle = document.createElement("h2");
    // 측정소 이름 스타일 클래스 지정
    stationTitle.className = "station-name";
    // 시도별·전국 조회 기준에 맞는 측정소 이름 설정
    stationTitle.textContent = formatStationTitle(selectedSido, item);

    // 등급 이름을 표시할 배지 요소 생성
    const gradeBadge = document.createElement("span");
    // 등급 배지 스타일 클래스 지정
    gradeBadge.className = "grade-badge";
    // 등급 이모지와 한국어 이름 함께 넣기
    gradeBadge.textContent = `${gradeInfo.emoji} ${gradeInfo.label}`;

    // 카드 상단에 측정소 이름과 등급 배지 추가
    cardHeader.appendChild(stationTitle);
    cardHeader.appendChild(gradeBadge);

    // 카드 본문 수치 영역 요소 생성
    const cardBody = document.createElement("div");
    // 카드 본문 스타일 클래스 지정
    cardBody.className = "card-body";

    // 미세먼지 수치 행 생성
    const pm10Row = createMetricRow("미세먼지", formatMeasureValue(item.pm10Value));
    // 초미세먼지 수치 행 생성
    const pm25Row = createMetricRow("초미세먼지", formatMeasureValue(item.pm25Value));

    // 측정 시각을 표시할 요소 생성
    const timeRow = document.createElement("p");
    // 측정 시각 스타일 클래스 지정
    timeRow.className = "metric-time";
    // 한국어 날짜·시간 형식("2026년 10월 28일 16시 기준")으로 변환해 표시
    timeRow.textContent = formatKoreanDateTime(item.dataTime);

    // 카드 본문에 미세먼지, 초미세먼지, 측정 시각 추가
    cardBody.appendChild(pm10Row);
    cardBody.appendChild(pm25Row);
    cardBody.appendChild(timeRow);

    // 완성된 상단과 본문을 카드에 조립
    card.appendChild(cardHeader);
    card.appendChild(cardBody);
    // 문서 조각에 카드 추가
    fragment.appendChild(card);
  });

  // 모든 카드를 한 번에 화면 그리드에 반영
  stationListEl.appendChild(fragment);
  // 총 몇 개의 측정소를 불러왔는지 한국어로 안내
  setStatusMessage(`총 ${items.length}개 측정소 정보를 불러왔습니다.`);
}

// 카드 안의 수치 한 줄(라벨 + 값)을 만드는 보조 함수
function createMetricRow(labelText, valueText) {
  // 한 줄을 감쌀 div 요소 생성
  const row = document.createElement("div");
  // 한 줄 정렬용 클래스 지정
  row.className = "metric-row";

  // 항목 이름(미세먼지/초미세먼지) 요소 생성
  const label = document.createElement("span");
  // 라벨 스타일 클래스 지정
  label.className = "metric-label";
  // 라벨 글자 넣기
  label.textContent = labelText;

  // 수치 값 요소 생성
  const value = document.createElement("span");
  // 값 스타일 클래스 지정
  value.className = "metric-value";
  // 포맷된 수치 글자 넣기
  value.textContent = valueText;

  // 줄 요소에 라벨과 값을 순서대로 추가
  row.appendChild(label);
  row.appendChild(value);
  // 완성된 줄 요소 반환
  return row;
}

// 선택한 시도를 쿼리 파라미터로 붙여 /api/dust 요청 URL을 만드는 함수
function buildRequestUrl(sidoName) {
  // 시도 이름만 쿼리에 담아 서버리스 함수로 전달 (인증키는 서버에서 처리)
  const params = new URLSearchParams({ sido: sidoName });
  // /api/dust?sido=서울 형태의 최종 경로 반환
  return `${API_URL}?${params.toString()}`;
}

// 선택한 시도의 대기오염 데이터를 서버리스 함수에서 비동기로 불러오는 함수
async function fetchAirQuality(sidoName) {
  // 이번 호출에 고유한 요청 번호를 부여해 최신 요청만 화면에 반영
  const requestId = ++currentRequestId;

  // 상단 시도 이름과 로딩 중 상태 UI를 먼저 표시
  selectedSidoEl.textContent = sidoName;
  updateSummaryBanner(
    {
      className: "grade-unknown",
      emoji: "⚪",
      label: "불러오는 중",
      advice: "최신 공기 상태를 확인하고 있어요",
      isWarning: false
    },
    "-",
    true,
    false
  );
  // 데이터를 불러오는 동안 화면에 "불러오는 중..." 표시
  setStatusMessage("불러오는 중...");
  // 기존 그래프와 카드 목록을 비워 새 데이터 준비
  clearPm10Chart();
  stationListEl.innerHTML = "";

  try {
    // 최종 요청 URL 생성 (/api/dust?sido=...)
    const requestUrl = buildRequestUrl(sidoName);
    // 서버리스 함수로 GET 요청 전송
    const response = await fetch(requestUrl);

    // 응답이 도착했을 때 더 최신 요청이 이미 시작되었으면 무시
    if (requestId !== currentRequestId) {
      return;
    }

    // 응답 본문을 JSON 객체로 변환 (JSON이 아니면 null 처리)
    const data = await response.json().catch(() => null);
    // JSON 변환 후에도 더 최신 요청이 시작되었으면 무시
    if (requestId !== currentRequestId) {
      return;
    }

    // 서버리스 함수에서 오류를 반환했으면 해당 한국어 메시지 표시
    if (!response.ok) {
      throw new Error(data?.error || `서버 응답 오류 (상태 코드: ${response.status})`);
    }

    // 응답 데이터가 비어 있거나 올바른 JSON 형식이 아니면 오류 처리
    if (!data) {
      throw new Error("응답 데이터를 해석할 수 없습니다.");
    }

    // 응답 헤더와 바디 추출
    const header = data?.response?.header;
    const body = data?.response?.body;

    // 결과 코드가 정상("00")이 아니면 오류 처리
    if (header && header.resultCode !== "00") {
      throw new Error("인증키 또는 요청값을 확인해주세요");
    }

    // 측정소 목록 배열이 없으면 빈 배열로 안전하게 처리
    const items = Array.isArray(body?.items) ? body.items : [];
    // 상단 지역 평균 미세먼지 수치와 대표 신호등 상태 표시
    renderAveragePm10(sidoName, items);
    // 측정소별 미세먼지 상위 10개 가로 막대그래프 그리기
    renderPm10Chart(sidoName, items);
    // 측정소 카드 목록 화면에 출력
    renderStationCards(sidoName, items);
  } catch (error) {
    // 최신 요청이 아니면 오류 표시도 건너뛰기
    if (requestId !== currentRequestId) {
      return;
    }
    // 오류 발생 시 평균 영역과 그래프, 카드 목록 초기화
    renderAveragePm10(sidoName, []);
    clearPm10Chart();
    stationListEl.innerHTML = "";
    // 한국어 오류 메시지 표시
    setStatusMessage(`데이터를 불러오지 못했습니다. (${error.message})`, true);
  }
}

// 드롭다운에서 다른 시도를 선택할 때마다 해당 지역 데이터를 다시 조회
sidoSelect.addEventListener("change", (event) => {
  // 선택된 시도 값을 가져와 조회 함수 호출
  fetchAirQuality(event.target.value);
});

// 웹페이지가 처음 열릴 때 기본 선택된 시도 데이터를 바로 불러오기
document.addEventListener("DOMContentLoaded", () => {
  // 현재 드롭다운에 선택된 시도 값으로 첫 조회 실행
  fetchAirQuality(sidoSelect.value);
});
