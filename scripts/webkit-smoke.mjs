import assert from 'node:assert/strict'
import { chromium, webkit, devices } from 'playwright'
const url='http://127.0.0.1:4189/campus-food-guide/'
for (const [engine,browserType] of [['WebKit',webkit],['Chromium',chromium]]) {
 const browser=await browserType.launch(engine==='Chromium'?{headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']}:{headless:true})
 try {
  for(const width of [320,375,390,414,768,1440]) {
   const context=await browser.newContext({viewport:{width,height:width<821?844:1000},isMobile:width<821,hasTouch:width<821,deviceScaleFactor:width<821?3:1})
   const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message))
   await page.goto(url,{waitUntil:'networkidle'}); await page.waitForTimeout(100)
   const result=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,nav:!!document.querySelector('.mobile-nav')&&getComputedStyle(document.querySelector('.mobile-nav')).display!=='none'}))
   assert.equal(result.scroll,width,`${engine} horizontal overflow at ${width}px`)
   assert.equal(result.nav,width<821,`${engine} navigation breakpoint at ${width}px`)
   if(width===320||width===390) {
    if(width===390) await page.screenshot({path:`/tmp/fandian-ui-review/home-${engine.toLowerCase()}-${width}.png`,fullPage:false})
    await page.getByRole('button',{name:'吃什么',exact:true}).click()
    await page.getByRole('button',{name:'20元以内'}).click();await page.getByRole('button',{name:'清淡'}).click();await page.getByRole('button',{name:'晚餐',exact:true}).click();await page.getByRole('button',{name:'南区二食堂'}).click();await page.getByRole('button',{name:'帮我挑一道'}).click()
    assert.equal(await page.locator('.recommend-info').count(),1,`${engine} recommendation interaction`)
    if(width===390) await page.screenshot({path:`/tmp/fandian-ui-review/decide-${engine.toLowerCase()}-${width}.png`,fullPage:false})
    await page.getByRole('button',{name:'首页',exact:true}).click();await page.getByRole('button',{name:'逛一逛'}).click();await page.getByRole('button',{name:/查看/}).first().click()
    await page.getByRole('button',{name:'写点评'}).click();await page.getByLabel('写下你的真实感受').focus()
    assert.equal(await page.locator('[role=dialog]').count(),1,`${engine} review dialog`)
    if(width===390) await page.screenshot({path:`/tmp/fandian-ui-review/review-${engine.toLowerCase()}-${width}.png`,fullPage:false})
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('[role=dialog]').count(),0,`${engine} Escape closes dialog`)
   }
   assert.deepEqual(errors,[],`${engine} errors at ${width}px: ${errors.join('; ')}`)
   await context.close();console.log(`${engine} ${width}px: no overflow; key navigation/dialog passed where exercised`)
  }
 } finally { await browser.close() }
}
const safariLike=await webkit.launch({headless:true})
try {
 const context=await safariLike.newContext(devices['iPhone 13'])
 const page=await context.newPage()
 await page.goto(url,{waitUntil:'networkidle'})
 const result=await page.evaluate(()=>({ua:navigator.userAgent,width:innerWidth,scroll:document.documentElement.scrollWidth,viewport:document.querySelector('meta[name="viewport"]').content}))
 assert.match(result.ua,/iPhone.*Safari/)
 assert.equal(result.width,result.scroll,'iPhone Safari profile should not overflow')
 assert.match(result.viewport,/viewport-fit=cover/)
 console.log('iPhone 13 Safari/WebKit profile:',JSON.stringify({width:result.width,overflow:false,viewportFitCover:true}))
 await context.close()
} finally {await safariLike.close()}
