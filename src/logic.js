export const CAUTION_TAGS = ['排队久', '偏咸', '偏油', '分量少', '性价比一般', '偏辣', '出餐慢']

export function readStoredValue(storage, key, fallback, validate = () => true) {
  try {
    const raw = storage?.getItem(key)
    if (!raw) return fallback
    const value = JSON.parse(raw)
    return validate(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function writeStoredValue(storage, key, value) {
  try {
    if (!storage) return false
    storage?.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function aggregateDish(dish, reviews) {
  const own = reviews.filter(review => review.dishId === dish.id)
  const rating = own.length ? Math.round(own.reduce((sum, review) => sum + review.score, 0) / own.length * 10) / 10 : null
  const cautions = [...new Set(own.flatMap(review => review.tags || []).filter(tag => CAUTION_TAGS.includes(tag)))]
  const lows = own.filter(review => review.score <= 3)
  const highs = own.filter(review => review.score >= 4)
  return {
    reviewCount: own.length,
    rating,
    positiveCount: highs.length,
    cautionCount: lows.length + own.filter(review => (review.tags || []).some(tag => CAUTION_TAGS.includes(tag))).length,
    cautions,
    lowSample: own.length < 5,
    contested: lows.length > 0 && highs.length > 0,
    reviews: own,
  }
}

export function selectCandidates(dishes, { budget = '不限', taste = '都可以', meal = '随时', hall = '不限食堂' }) {
  const caps = { '15元以内': 15, '20元以内': 20 }
  const cap = caps[budget] ?? Infinity
  const tasteMap = { 清淡: '清淡', 重口: '重口', 甜口: '甜口' }
  return dishes
    .filter(dish => dish.price <= cap)
    .filter(dish => taste === '都可以' || (dish.flavors || []).includes(tasteMap[taste] || taste))
    .filter(dish => meal === '随时' || dish.meals.includes(meal))
    .filter(dish => hall === '不限食堂' || dish.hall === hall)
    .map(dish => {
      const rating = dish.rating ?? 3.5
      const volumeSignal = Math.log1p(dish.reviewCount || 0) / Math.log(11)
      const budgetSignal = Number.isFinite(cap) ? (cap - dish.price) / cap : 0
      return { ...dish, matchScore: rating * 0.68 + volumeSignal * 0.2 + budgetSignal * 0.12 }
    })
    .sort((a, b) => b.matchScore - a.matchScore)
}

export function nextRecommendation(candidates, currentId = null) {
  if (!candidates.length) return null
  const index = candidates.findIndex(item => item.id === currentId)
  return candidates[(index + 1 + candidates.length) % candidates.length]
}
