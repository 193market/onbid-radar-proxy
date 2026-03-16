const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

const SERVICE_KEY = 'xsG0WMPtWS1mUarzKPkfhWjUUvyKIqfBF34M5NHtM7PcQykB9r9bfji96dhrfkH0peDerZ6iDfVqwSoYS9SEcQ==';
const BASE = 'https://apis.data.go.kr/B010003';

// ── 필드 정규화 (차세대 API → 프론트엔드 호환 필드명) ──────────────

function normDate(dt) {
  if (!dt) return '';
  return String(dt).slice(0, 8); // YYYYMMDDHHMM → YYYYMMDD
}

function safeNum(val) {
  const n = parseFloat(String(val || '').replace(/,/g, ''));
  return (isNaN(n) || n < 0) ? 0 : n;
}

function calcDpst(minBid) {
  return String(Math.floor(safeNum(minBid) * 0.1));
}

function normTime(dt) {
  if (!dt) return '';
  const s = String(dt);
  if (s.length >= 12) return `${s.slice(8,10)}:${s.slice(10,12)}`;
  return '';
}

function yn(v) { return v === 'Y' ? '✅ 가능' : v === 'N' ? '❌ 불가' : ''; }

function normalizeRealestate(item) {
  if (!item || !item.cltrMngNo) return item;
  const minBid = safeNum(item.lowstBidPrcIndctCont);
  const apprAmt = safeNum(item.apslEvlAmt);
  const cltrNo = item.cltrMngNo;
  return {
    ...item,
    cltrNo,
    cltrNm: item.onbidCltrNm,
    cltrKndNm: item.cltrUsgSclsCtgrNm || item.cltrUsgMclsCtgrNm || '부동산',
    cltrMclsNm: item.cltrUsgMclsCtgrNm || '',
    cltrSclsNm: item.cltrUsgSclsCtgrNm || '',
    apprAmt: String(apprAmt),
    minBidAmt: String(minBid),
    dpstAmt: calcDpst(minBid),
    forfeitCnt: String(item.usbdNft || 0),
    stDt: normDate(item.cltrBidBgngDt),
    enDt: normDate(item.cltrBidEndDt),
    stTime: normTime(item.cltrBidBgngDt),
    enTime: normTime(item.cltrBidEndDt),
    sidoNm: item.lctnSdnm,
    sigunguNm: item.lctnSggnm,
    eupmyundongNm: item.lctnEmdNm,
    pbancClsfNm: item.prptDivNm,
    bddprNm: item.bidDivNm,
    bidMthodNm: item.bidMthodNm || '',
    cptnMthodNm: item.cptnMthodNm || '',
    totalamtUnpcDivNm: item.totalamtUnpcDivNm || '',
    ctrtMthdNm: item.dspsMthodNm,
    dspsInstNm: item.exctOrgNm,
    cltrMgmtInstNm: item.rqstOrgNm,
    cltrAr: String(item.bldSqms || item.landSqms || ''),
    lndAr: String(item.landSqms || ''),
    bldgAr: String(item.bldSqms || ''),
    collbBidPsblYn: yn(item.collbBidPsblYn),
    twtmGthrBidPsblYn: yn(item.twtmGthrBidPsblYn),
    subtBidPsblYn: yn(item.subtBidPsblYn),
    alcYn: item.alcYn === 'Y' ? '✅ 있음' : '없음',
    batcBidYn: item.batcBidYn === 'Y' ? '✅ 일괄입찰' : '',
    evcRsbyTrgtCont: item.evcRsbyTrgtCont || '',
    imgUrl: item.thnlImgUrlAdr || '',
    onbidUrl: `https://www.onbid.co.kr/op/cta/cltrdtl/collateralRealEstateDetail.do?cltrNo=${cltrNo}`,
  };
}

function normalizeCar(item) {
  if (!item || !item.cltrMngNo) return item;
  const minBid = item.lowstBidPrcIndctCont || '0';
  const yearMatch = (item.onbidCltrNm || '').match(/(\d{4})년식/);
  return {
    ...item,
    cltrNo: item.cltrMngNo,
    cltrNm: item.onbidCltrNm,
    cltrKndNm: item.cltrUsgSclsCtgrNm || item.cltrUsgMclsCtgrNm || '차량',
    apprAmt: String(item.apslEvlAmt || 0),
    minBidAmt: String(minBid),
    dpstAmt: calcDpst(minBid),
    forfeitCnt: String(item.usbdNft || 0),
    stDt: normDate(item.cltrBidBgngDt),
    enDt: normDate(item.cltrBidEndDt),
    sidoNm: item.lctnSdnm,
    sigunguNm: item.lctnSggnm,
    eupmyundongNm: item.lctnEmdNm,
    pbancClsfNm: item.prptDivNm,
    bddprNm: item.bidDivNm,
    ctrtMthodNm: item.dspsMthodNm,
    dspsInstNm: item.exctOrgNm,
    cltrMgmtInstNm: item.rqstOrgNm,
    mfgYr: yearMatch ? yearMatch[1] : null,
    carMakerNm: item.cltrMkrNm,
    carModelNm: item.carVhknNm || item.carMdlNm,
    imgUrl: item.thnlImgUrlAdr || '',
  };
}

function normalizeMovable(item) {
  if (!item || !item.cltrMngNo) return item;
  const minBid = item.lowstBidPrcIndctCont || '0';
  return {
    ...item,
    cltrNo: item.cltrMngNo,
    cltrNm: item.onbidCltrNm,
    cltrKndNm: item.cltrUsgSclsCtgrNm || item.cltrUsgMclsCtgrNm || '동산',
    apprAmt: String(item.apslEvlAmt || 0),
    minBidAmt: String(minBid),
    dpstAmt: calcDpst(minBid),
    forfeitCnt: String(item.usbdNft || 0),
    stDt: normDate(item.cltrBidBgngDt),
    enDt: normDate(item.cltrBidEndDt),
    sidoNm: item.lctnSdnm,
    sigunguNm: item.lctnSggnm,
    eupmyundongNm: item.lctnEmdNm,
    pbancClsfNm: item.prptDivNm,
    bddprNm: item.bidDivNm,
    ctrtMthdNm: item.dspsMthodNm,
    dspsInstNm: item.exctOrgNm,
    cltrMgmtInstNm: item.rqstOrgNm,
    mvastCnt: item.qntyCont,
    mvastUnit: '개',
    mvastLoc: [item.lctnSdnm, item.lctnSggnm, item.lctnEmdNm].filter(Boolean).join(' '),
    imgUrl: item.thnlImgUrlAdr || '',
  };
}

// ── 차세대 API 호출 (다중 prptDivCd 병렬 조회 후 합산) ──────────────

const PRPT_DIV_CDS = ['0007', '0010', '0002']; // 압류재산, 국유재산, 공유재산

async function proxyGetNew(res, endpoint, normalizer, params) {
  const { pageNo = 1, numOfRows = 20, sido = '', sigungu = '' } = params;
  const perType = Math.max(1, Math.ceil(numOfRows / PRPT_DIV_CDS.length));

  try {
    const calls = PRPT_DIV_CDS.map(prptDivCd => {
      const qs = new URLSearchParams({
        serviceKey: SERVICE_KEY,
        resultType: 'json',
        pageNo,
        numOfRows: perType,
        prptDivCd,
        dspsMthodCd: '0001', // 매각
        bidDivCd: '0001',    // 전자입찰
        ...(sido ? { lctnSdnm: sido } : {}),      // 시도 필터 (API 직접 지원 확인)
        ...(sigungu ? { lctnSggnm: sigungu } : {}),
      }).toString();
      const url = `${BASE}/${endpoint}?${qs}`;
      return fetch(url, { timeout: 15000 })
        .then(r => r.json())
        .catch(() => null);
    });

    const results = await Promise.all(calls);
    let allItems = [];
    let totalCount = 0;

    for (const json of results) {
      if (!json) continue;
      const body = json?.body || json;
      const raw = body?.items?.item || body?.items || [];
      const arr = (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
      allItems = allItems.concat(arr.map(normalizer).filter(i => i && i.cltrNo));
      totalCount += parseInt(body?.totalCount || 0);
    }

    // 입찰 종료일 오름차순 정렬 (마감 임박 순)
    allItems.sort((a, b) => (a.enDt || '').localeCompare(b.enDt || ''));

    res.json({ items: allItems, totalCount });
  } catch (e) {
    res.status(500).json({ error: e.message, items: [] });
  }
}

// ── 구형(공고/입찰결과/국유지/비축) API 호출 ──────────────────────────

async function proxyGet(res, endpoint, params) {
  const qs = new URLSearchParams({ serviceKey: SERVICE_KEY, type: 'json', ...params }).toString();
  const url = `${BASE}/${endpoint}?${qs}`;
  try {
    const r = await fetch(url, { timeout: 15000 });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch {
      return res.status(502).json({ error: 'Invalid JSON', raw: text.slice(0, 200) });
    }
    const body = json?.response?.body || json?.body || json;
    const items = body?.items?.item || body?.items || [];
    const totalCount = body?.totalCount || 0;
    res.json({ items: Array.isArray(items) ? items : [items], totalCount });
  } catch (e) {
    res.status(500).json({ error: e.message, items: [] });
  }
}

// ── 목록 API ──────────────────────────────────────────────────────────

// 부동산 물건목록
app.get('/proxy/realestate', (req, res) => {
  const { pageNo = 1, numOfRows = 20, sido = '', sigungu = '' } = req.query;
  proxyGetNew(res, 'OnbidRlstListSrvc/getRlstCltrList', normalizeRealestate, { pageNo, numOfRows, sido, sigungu });
});

// 차량 물건목록
app.get('/proxy/car', (req, res) => {
  const { pageNo = 1, numOfRows = 20 } = req.query;
  proxyGetNew(res, 'OnbidCarListSrvc/getCarCltrList', normalizeCar, { pageNo, numOfRows });
});

// 동산 물건목록
app.get('/proxy/movable', (req, res) => {
  const { pageNo = 1, numOfRows = 20, sido = '' } = req.query;
  proxyGetNew(res, 'OnbidMvastListSrvc/getMvastCltrList', normalizeMovable, { pageNo, numOfRows, sido });
});

// 공고목록
app.get('/proxy/announcement', (req, res) => {
  const { pageNo = 1, numOfRows = 50 } = req.query;
  proxyGet(res, 'OnbidPbancListSrvc/getOnbidPbancList', { pageNo, numOfRows });
});

// 입찰결과목록
app.get('/proxy/bidresult', (req, res) => {
  proxyGet(res, 'OnbidCltrBidRsltListSrvc/getOnbidCltrBidRsltList', { cltrNo: req.query.cltrNo, numOfRows: 20 });
});

// 국유지 개발현황
app.get('/proxy/govland', (req, res) => {
  const { pageNo = 1, numOfRows = 20 } = req.query;
  proxyGet(res, 'GvwsDistDvlp/getGvwsDistDvlpList', { pageNo, numOfRows });
});

// 비축부동산 명세
app.get('/proxy/reserve', (req, res) => {
  const { pageNo = 1, numOfRows = 20 } = req.query;
  proxyGet(res, 'kamcoRlctRlst/getKamcoRlctRlstList', { pageNo, numOfRows });
});

// ── 상세 API ──────────────────────────────────────────────────────────
// 상세 API는 목록 조회 결과로 대체 (cltrMngNo로 재조회)

async function detailViaList(res, endpoint, normalizer, cltrNo) {
  try {
    const calls = PRPT_DIV_CDS.map(prptDivCd => {
      const qs = new URLSearchParams({
        serviceKey: SERVICE_KEY,
        resultType: 'json',
        pageNo: 1,
        numOfRows: 1,
        prptDivCd,
        dspsMthodCd: '0001',
        bidDivCd: '0001',
        onbidCltrMngNo: cltrNo,
      }).toString();
      return fetch(`${BASE}/${endpoint}?${qs}`, { timeout: 15000 })
        .then(r => r.json())
        .catch(() => null);
    });

    const results = await Promise.all(calls);
    for (const json of results) {
      if (!json) continue;
      const body = json?.body || json;
      const raw = body?.items?.item || body?.items || [];
      const arr = Array.isArray(raw) ? raw : [raw];
      const item = arr.find(i => i && i.cltrMngNo === cltrNo);
      if (item) return res.json({ items: [normalizer(item)] });
    }
    res.json({ items: [] });
  } catch (e) {
    res.status(500).json({ error: e.message, items: [] });
  }
}

app.get('/proxy/realestate/detail', (req, res) => {
  if (!req.query.cltrNo) return res.status(400).json({ error: 'cltrNo required', items: [] });
  detailViaList(res, 'OnbidRlstListSrvc/getRlstCltrList', normalizeRealestate, req.query.cltrNo);
});

app.get('/proxy/car/detail', (req, res) => {
  if (!req.query.cltrNo) return res.status(400).json({ error: 'cltrNo required', items: [] });
  detailViaList(res, 'OnbidCarListSrvc/getCarCltrList', normalizeCar, req.query.cltrNo);
});

app.get('/proxy/movable/detail', (req, res) => {
  if (!req.query.cltrNo) return res.status(400).json({ error: 'cltrNo required', items: [] });
  detailViaList(res, 'OnbidMvastListSrvc/getMvastCltrList', normalizeMovable, req.query.cltrNo);
});

// ── 이미지 프록시 (CORS 우회) ──────────────────────────────
app.get('/proxy/img', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.startsWith('https://op.onbid')) {
    return res.status(400).send('invalid url');
  }
  try {
    const imgRes = await fetch(url, {
      headers: { 'Referer': 'https://www.onbid.co.kr/' },
      timeout: 8000,
    });
    if (!imgRes.ok) return res.status(imgRes.status).send('fetch failed');
    res.set('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    imgRes.body.pipe(res);
  } catch (e) {
    res.status(500).send('proxy error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Onbid Proxy running on port ${PORT}`));
