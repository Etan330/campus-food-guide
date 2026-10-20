import test from 'node:test'
import assert from 'node:assert/strict'
import { selectCandidates, nextRecommendation, aggregateDish, readStoredValue, writeStoredValue } from '../src/logic.js'

const dishes = [
  { id: 1, price: 14, hall: '东苑食堂', meals: ['午餐'], flavors: ['清淡'], stall: '小炒' },
  { id: 2, price: 18, hall: '知味堂', meals: ['晚餐'], flavors: ['重口'], stall: '川味' },
  { id: 3, price: 13, hall: '东苑食堂', meals: ['晚餐'], flavors: ['清淡'], stall: '小炒' },
]

test('recommendation obeys budget, taste, meal, and hall together', () => {
  assert.deepEqual(selectCandidates(dishes, { budget: '15元以内', taste: '清淡', meal: '晚餐', hall: '东苑食堂' }).map(x => x.id), [3])
})

test('no candidate means empty result and never relaxes a hard condition', () => {
  assert.deepEqual(selectCandidates(dishes, { budget: '15元以内', taste: '重口', meal: '午餐', hall: '东苑食堂' }), [])
})

test('rotation walks every eligible dish before starting over', () => {
  const candidates = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
  let current = null
  const seen = []
  for (let i = 0; i < 4; i++) { current = nextRecommendation(candidates, current?.id); seen.push(current.id) }
  assert.deepEqual(seen, [1, 2, 3, 4])
})

test('rating, count, and caution summary derive from one review list', () => {
  const stats = aggregateDish({ id: 1 }, [
    { dishId: 1, score: 5, tags: ['分量足'], text: '热乎' },
    { dishId: 1, score: 2, tags: ['排队久', '偏咸'], text: '午高峰等得久' },
    { dishId: 2, score: 1, tags: [], text: 'other dish' },
  ])
  assert.equal(stats.reviewCount, 2)
  assert.equal(stats.rating, 3.5)
  assert.deepEqual(stats.cautions, ['排队久', '偏咸'])
})

test('storage helpers survive malformed data and unavailable writes', () => {
  assert.deepEqual(readStoredValue({ getItem: () => '{' }, 'reviews', []), [])
  assert.deepEqual(readStoredValue({ getItem: () => '{"x":1}' }, 'favorites', [], Array.isArray), [])
  assert.equal(writeStoredValue({ setItem: () => { throw new Error('blocked') } }, 'favorites', []), false)
})
