const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

const SERVICE_KEY = 'xsG0WMPtWS1mUarzKPkfhWjUUvyKIqfBF34M5NHtM7PcQykB9r9bfji96dhrfkH0peDerZ6iDfVqwSoYS9SEcQ==';
const BASE = 'https://apis.data.go.kr/B010003';

async function proxyGet(res, endpoint, params) {
  const qs = new URLSearchParams({ serviceKey: SERVICE_KEY, type: 'json', ...params }).toString();
  const url = `${BASE}/${endpoint}?${qs}`;
  try {
    const r = await fetch(url, { timeout: 8000 });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { return res.status(502).json({ error: 'Invalid JSON', raw: text.slice(0, 200) }); }
    // 공공데이터 응답 정규화
    const body = json?.response?.body || json?.body || json;
    const items = body?.items?.item || body?.items || [];
    const totalCount = body?.totalCount || 0;
    res.json({ items: Array.isArray(items) ? items : [items], totalCount });
  } catch (e) {
    res.status(500).json({ error: e.message, items: [] });
  }
}

// 부동산 물건목록
app.get('/proxy/realestate', (req, res) => {
  const { pageNo = 1, numOfRows = 20, sido = '' } = req.query;
  const params = { pageNo, numOfRows };
  if (sido) params.sido = sido;
  proxyGet(res, 'OnbidRlstListSrvc/getOnbidRlstList', params);
});

// 차량 물건목록
app.get('/proxy/car', (req, res) => {
  proxyGet(res, 'OnbidCarListSrvc/getOnbidCarList', { pageNo: req.query.pageNo || 1, numOfRows: req.query.numOfRows || 20 });
});

// 동산 물건목록
app.get('/proxy/movable', (req, res) => {
  proxyGet(res, 'OnbidMvastListSrvc/getOnbidMvastList', { pageNo: req.query.pageNo || 1, numOfRows: req.query.numOfRows || 20 });
});

// 공고목록
app.get('/proxy/announcement', (req, res) => {
  proxyGet(res, 'OnbidPbancListSrvc/getOnbidPbancList', { pageNo: req.query.pageNo || 1, numOfRows: req.query.numOfRows || 30 });
});

// 입찰결과목록
app.get('/proxy/bidresult', (req, res) => {
  proxyGet(res, 'OnbidCltrBidRsltListSrvc/getOnbidCltrBidRsltList', { cltrNo: req.query.cltrNo, numOfRows: 20 });
});

// 국유지 개발현황
app.get('/proxy/govland', (req, res) => {
  proxyGet(res, 'GvwsDistDvlp/getGvwsDistDvlpList', { pageNo: req.query.pageNo || 1, numOfRows: req.query.numOfRows || 20 });
});

// 비축부동산 명세
app.get('/proxy/reserve', (req, res) => {
  proxyGet(res, 'kamcoRlctRlst/getKamcoRlctRlstList', { pageNo: req.query.pageNo || 1, numOfRows: req.query.numOfRows || 20 });
});

// ── money-aura: 환율 (수출입은행) ──
app.get('/proxy/exchange', async (req, res) => {
  const EXIM_KEY = 'C5Qu02DnCxRkltde9Kk6VevXpaBeJWAj';
  try {
    // 최근 영업일 탐색 (오늘~5일 전)
    for (let i = 0; i < 6; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
      const url = `https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${EXIM_KEY}&searchdate=${ds}&data=AP01`;
      const r = await fetch(url, { redirect: 'follow', timeout: 8000 });
      const text = await r.text();
      if (!text || text.trim() === '' || text.trim() === '[]') continue;
      let json; try { json = JSON.parse(text); } catch { continue; }
      if (!Array.isArray(json) || json.length === 0) continue;
      const targets = ['USD', 'JPY(100)', 'EUR'];
      const result = json.filter(item => targets.includes(item.cur_nm) || targets.includes(item.cur_unit));
      if (result.length > 0) return res.json({ data: result, date: ds });
    }
    res.status(502).json({ error: 'No exchange data available' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── money-aura: 금감원 예금 금리 ──
app.get('/proxy/fss-deposit', async (req, res) => {
  const FSS_KEY = '7cdf933c0e7a5e910842eae90b292d9b';
  try {
    const r = await fetch(
      `https://finlife.fss.or.kr/finlifeapi/depositProductsSearch.json?auth=${FSS_KEY}&topFinGrpNo=020000&pageNo=1`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }
    );
    const json = await r.json();
    res.json(json);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── money-aura: 금감원 적금 금리 ──
app.get('/proxy/fss-saving', async (req, res) => {
  const FSS_KEY = '7cdf933c0e7a5e910842eae90b292d9b';
  try {
    const r = await fetch(
      `https://finlife.fss.or.kr/finlifeapi/savingProductsSearch.json?auth=${FSS_KEY}&topFinGrpNo=020000&pageNo=1`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }
    );
    const json = await r.json();
    res.json(json);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Onbid Proxy running on port ${PORT}`));
