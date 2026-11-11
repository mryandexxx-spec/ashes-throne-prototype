"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,webkit}=require('playwright');
(async()=>{
 const useWebkit=process.env.HERO_BROWSER==='webkit';
 const browser=await (useWebkit?webkit:chromium).launch(useWebkit?{headless:true}:{headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl']});
 fs.mkdirSync('artifacts',{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'load'});
  await page.evaluate(()=>{selectedHeroId='ren';showScreen('heroDetail');});
  await page.waitForFunction(()=>document.querySelector('#detailHeroStage').classList.contains('has-ren-3d'),null,{timeout:45000});
  async function fits(label){
   const boxes=await page.evaluate(()=>{
    const ids=['heroDetail','detailHeroStage','heroAbilityList','gearSlots','detailUpgrade','starRankVisual','starShardCount','detailBiography'];
    const buttons=[...document.querySelectorAll('#heroDetail [data-hero-ability],#gearSlots button,#heroDetail button')].filter(n=>n.getClientRects().length);
    return {overflow:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,
     outside:ids.filter(id=>{let r=document.getElementById(id).getBoundingClientRect();return r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1}),
     tiny:buttons.filter(b=>{let r=b.getBoundingClientRect();return r.width<43||r.height<43}).map(b=>b.id||b.dataset.heroAbility),
     outsideButtons:buttons.filter(n=>{let r=n.getBoundingClientRect();return r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1}).map(n=>n.id||n.dataset.heroAbility),
     model:document.getElementById('detailHeroStage').getBoundingClientRect().height};
   });
   console.log(label,boxes);assert.equal(boxes.overflow,false);assert.deepEqual(boxes.outside,[]);assert.deepEqual(boxes.tiny,[]);assert.deepEqual(boxes.outsideButtons,[]);assert.ok(boxes.model>160);
  }
  for(const [w,h] of [[844,390],[932,430],[844,320]]){
   await page.setViewportSize({width:w,height:h});await page.waitForTimeout(150);await fits(`${w}x${h}`);
   await page.screenshot({path:`artifacts/hero-card-${useWebkit?'webkit':'chromium'}-${w}x${h}.png`});
  }
  await page.setViewportSize({width:844,height:390});
  await page.locator('#gearSlots button').nth(0).click();assert.equal(await page.locator('#heroGearDialog').evaluate(n=>n.open),true);
  await page.locator('#heroGearDialog [data-hero-dialog-close]').click();
  await page.locator('[data-hero-ability=basic]').click();assert.equal(await page.locator('#skillUpgradeDialog').evaluate(n=>n.open),true);
  await page.locator('#skillUpgradeClose').click();
  await page.locator('[data-hero-ability=passive]').click();assert.equal(await page.locator('#heroAbilityDialog').evaluate(n=>n.open),true);
  await page.locator('#heroAbilityDialog [data-hero-dialog-close]').click();
  await page.locator('[data-hero-dialog=heroStatsDialog]').click();assert.equal(await page.locator('#heroStatsDialog').evaluate(n=>n.open),true);
  await page.locator('#heroStatsDialog [data-hero-dialog-close]').click();
  await page.locator('#detailBiography').click();assert.equal(await page.locator('#heroBiographyDialog').evaluate(n=>n.open),true);
  await page.evaluate(()=>document.getElementById('heroBiographyDialog').close());
  // Real existing debug action grants resources; purchases still go through the live UI.
  await page.evaluate(()=>{document.getElementById('devResourcesGrant').click();renderHeroDetail();});
  const before=await page.evaluate(()=>({level:progress.levels.ren,currency:progress.currency,rank:StarCore.rankOf(progress,'ren')}));
  await fits('resources/star upgrade available');
  await page.setViewportSize({width:844,height:320});
  await page.evaluate(()=>{document.getElementById('app').style.padding='0 44px 21px';});
  await fits('low Safari with simulated safe-area and available star upgrade');
  await page.evaluate(()=>{document.getElementById('app').style.padding='';});
  await page.setViewportSize({width:844,height:390});
  await page.locator('#detailUpgrade').click();
  const after=await page.evaluate(()=>({level:progress.levels.ren,currency:progress.currency}));
  assert.equal(after.level,before.level+1);assert.ok(after.currency<before.currency);
  await page.locator('#starPromoteButton').click();assert.equal(await page.evaluate(()=>StarCore.rankOf(progress,'ren')),before.rank+1);
  await page.locator('#gearSlots button').nth(0).click();
  await page.locator('#gearEquipNext').click();
  assert.equal(await page.evaluate(()=>!!ProgressCore.gearState(progress,'ren').slots[0]),true);
  await page.locator('#heroGearDialog [data-hero-dialog-close]').click();
  await page.locator('#detailBack').click();assert.equal(await page.locator('#collection').evaluate(n=>n.classList.contains('active')),true);
  assert.equal(await page.evaluate(()=>document.body.classList.contains('hero-card-mode')),false);
  await page.evaluate(()=>{selectedHeroId='kael';showScreen('heroDetail');});await fits('other hero');
  await page.locator('#detailHome').click();
  await page.evaluate(()=>{selectedHeroId='ren';showScreen('heroDetail');});
  await page.waitForFunction(()=>document.querySelector('#detailHeroStage').classList.contains('has-ren-3d'),null,{timeout:45000});
  await fits('re-entry');assert.deepEqual(errors,[]);
  console.log('HEROCARD001 browser passed',useWebkit?'WebKit':'Chromium');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
