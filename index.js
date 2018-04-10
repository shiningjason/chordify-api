const fetch = require('node-fetch')
const { send, createError } = require('micro')

const REGEXP_UG_PAGE_CONTENT = /<script>\s*window\.UGAPP\.store\.page = (.*);\s*<\/script>/

async function queryUgChordChartUrlByKeyword(keyword) {
  const url = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${keyword}`
  const response = await fetch(url)
  const html = await response.text()

  let results
  try {
    const matches = html.match(REGEXP_UG_PAGE_CONTENT)
    const content = JSON.parse(matches[1])
    results = content.data.results
  } catch (e) {
    throw createError(500, 'Unexpected error')
  }
  if (!results) {
    throw createError(404, 'Not found')
  }

  const charts = results
    .filter(result => result.type === 'Chords' && result.tab_access_type === 'public')
    .sort((a, b) => (a.votes > b.votes ? -1 : a.votes < b.votes ? 1 : 0))
  return charts[0].tab_url
}

async function getUgChordChartByUrl(url) {
  const response = await fetch(url)
  const html = await response.text()
  let data
  try {
    const matches = html.match(REGEXP_UG_PAGE_CONTENT)
    const content = JSON.parse(matches[1])
    data = content.data
  } catch (e) {
    throw createError(500, 'Unexpected error')
  }
  const { tab: song, tab_view: chart } = data
  return {
    name: song.song_name,
    artist: song.artist_name,
    key: chart.meta.tonality,
    capo: chart.meta.capo,
    tuning: chart.meta.tuning,
    chart: chart.wiki_tab.content
  }
}

module.exports = async (req, res) => {
  const keyword = req.url.slice(1).replace('%20', '+')
  try {
    const chartUrl = await queryUgChordChartUrlByKeyword(keyword)
    const chart = await getUgChordChartByUrl(chartUrl)
    send(res, 200, chart)
  } catch (e) {
    send(res, e.statusCode, { message: e.message })
  }
}
