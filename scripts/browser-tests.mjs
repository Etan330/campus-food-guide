import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const baseURL = 'http://127.0.0.1:4189/campus-food-guide/'
const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4189', '--strictPort'], { stdio: 'ignore' })
let browser
try {
  let ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    try { ready = (await fetch(baseURL)).ok; if (ready) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  assert.ok(ready, 'preview server should become available')
  browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(baseURL)
  assert.match(await page.locator('main').innerText(), /从口碑稳的开始/)
  await page.getByRole('button', { name: '逛一逛' }).click()
  const imageFailures = await page.locator('img').evaluateAll(async images => { for (const image of images) image.loading = 'eager'; await Promise.all(images.map(image => image.decode().catch(() => null))); return images.filter(image => !image.naturalWidth).map(image => image.src) })
  assert.deepEqual(imageFailures, [], `broken visible catalog images: ${imageFailures.join(', ')}`)
  await page.getByRole('button', { name: '首页', exact: true }).click()

  // Search, location, category, and stall filters compose into exactly one result.
  await page.getByRole('button', { name: '逛一逛' }).click()
  await page.getByPlaceholder('搜菜名、窗口、食堂').fill('香菇滑鸡煲仔饭')
  await page.getByRole('button', { name: '南区二食堂' }).click()
  await page.getByRole('button', { name: '砂锅', exact: true }).click()
  await page.locator('.inline-select').selectOption({ label: '砂锅日记' })
  assert.match(await page.locator('.result-line').innerText(), /找到 1 道/)
  assert.equal(await page.locator('.dish-card').count(), 1)
  await page.getByRole('button', { name: '清除搜索' }).click()
  assert.ok(await page.locator('.dish-card').count() > 1)
  await page.getByPlaceholder('搜菜名、窗口、食堂').fill('没有这道菜')
  assert.match(await page.locator('.empty-state').innerText(), /还没找到/)
  await page.getByRole('button', { name: '清空搜索与筛选' }).click()

  // Detail shows aligned review count/rating and both praise and cautions. User review persists.
  await page.getByRole('button', { name: '查看招牌番茄肥牛拌饭详情' }).click()
  assert.match(await page.getByRole('dialog').innerText(), /偏甜|排队久/)
  assert.match(await page.getByRole('dialog').innerText(), /3 条/)
  await page.getByRole('button', { name: '写点评' }).click()
  await page.getByRole('button', { name: '2 分' }).click()
  await page.getByRole('button', { name: '分量少', exact: true }).click()
  await page.getByLabel('写下你的真实感受').fill('份量偏少，口味也略甜。')
  await page.getByRole('button', { name: '发布点评' }).click()
  assert.match(await page.locator('.toast').innerText(), /评分和统计已更新/)
  await page.getByRole('button', { name: '查看招牌番茄肥牛拌饭详情' }).click()
  assert.match(await page.getByRole('dialog').innerText(), /4 条/)
  assert.match(await page.getByRole('dialog').innerText(), /分量少/)
  assert.match(await page.getByRole('dialog').innerText(), /3\.8/)
  await page.reload()
  await page.getByRole('button', { name: '逛一逛' }).click()
  await page.getByPlaceholder('搜菜名、窗口、食堂').fill('招牌番茄肥牛拌饭')
  await page.getByRole('button', { name: '查看招牌番茄肥牛拌饭详情' }).click()
  assert.match(await page.getByRole('dialog').innerText(), /份量偏少，口味也略甜/)
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('dialog').count(), 0)

  // Favorites sync between views and persist after reload.
  await page.getByRole('button', { name: '关闭菜品详情' }).count().then(async count => { if (count) await page.getByRole('button', { name: '关闭菜品详情' }).click() })
  const firstCard = page.locator('.dish-card').first()
  const firstName = await firstCard.locator('.dish-name-button').innerText()
  await firstCard.locator('.dish-favorite').click()
  await page.locator('.side-nav button').nth(3).click()
  assert.match(await page.locator('.dish-name-button').allTextContents().then(xs => xs.join(' ')), new RegExp(firstName))
  await page.reload()
  await page.locator('.side-nav button').nth(3).click()
  await page.locator('.dish-favorite').first().click()
  assert.match(await page.locator('.empty-state').innerText(), /还没有收藏的菜/)

  // Recommendation enforces hard constraints and never silently relaxes them.
  await page.getByRole('button', { name: '吃什么', exact: true }).click()
  await page.getByRole('button', { name: '20元以内' }).click()
  await page.getByRole('button', { name: '清淡' }).click()
  await page.getByRole('button', { name: '晚餐', exact: true }).click()
  await page.getByRole('button', { name: '南区二食堂' }).click()
  await page.getByRole('button', { name: '帮我挑一道' }).click()
  const recommendation = page.locator('.recommend-info')
  assert.equal(await recommendation.count(), 1)
  const firstRecommendation = await recommendation.locator('h2').innerText()
  assert.match(await recommendation.innerText(), /¥(1[0-9]|20)/)
  assert.match(await recommendation.innerText(), /清淡口味标签匹配/)
  assert.match(await recommendation.innerText(), /供应晚餐/)
  assert.match(await recommendation.innerText(), /就在南区二食堂/)
  assert.equal(await page.locator('.result-label button').isDisabled(), true)
  assert.equal(await recommendation.locator('h2').innerText(), firstRecommendation)
  await page.getByRole('button', { name: '清淡' }).click()
  await page.getByRole('button', { name: '晚餐', exact: true }).click()
  await page.getByRole('button', { name: '南区二食堂' }).click()
  await page.getByRole('button', { name: '不限', exact: true }).click()
  await page.getByRole('button', { name: '都可以' }).click()
  await page.getByRole('button', { name: '随时', exact: true }).click()
  await page.getByRole('button', { name: '帮我挑一道' }).click()
  const firstBroadRecommendation = await recommendation.locator('h2').innerText()
  await page.getByRole('button', { name: '换一个', exact: true }).click()
  assert.notEqual(await recommendation.locator('h2').innerText(), firstBroadRecommendation)
  await page.getByRole('button', { name: '早餐', exact: true }).click()
  await page.getByRole('button', { name: '帮我挑一道' }).click()
  assert.match(await page.locator('.no-match').innerText(), /没有完全匹配/)
  assert.match(await page.locator('.no-match').innerText(), /没有放宽/)

  // Desktop and mobile layout: no horizontal overflow, fixed navigation remains visible.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '首页', exact: true }).click()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  assert.equal(overflow, false, 'mobile layout must not overflow horizontally')
  assert.equal(await page.locator('.mobile-nav').isVisible(), true)
  await page.getByRole('button', { name: '看口碑与提醒' }).click()
  const modalBox = await page.locator('.detail-modal').boundingBox()
  assert.ok(modalBox && modalBox.width <= 390 && modalBox.height <= 844, 'detail modal should fit mobile viewport')
  assert.deepEqual(errors, [], `browser runtime errors: ${errors.join('; ')}`)
  console.log('Browser flow passed: search/filters/empty state, detail/negative review/persistence, favorite/persistence, recommendation constraints/swap/no match, mobile viewport.')
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
