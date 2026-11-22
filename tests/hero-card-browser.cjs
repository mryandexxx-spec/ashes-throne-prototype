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
  await page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:60000});
  await page.evaluate(()=>{selectedHeroId='ren';showScreen('heroDetail');});
  await page.waitForFunction(()=>document.querySelector('#detailHeroStage').classList.contains('has-ren-3d'),null,{timeout:45000});
  async function drawn(){
   const pixels=await page.evaluate(()=>new Promise((resolve,reject)=>{
    const engine=BABYLON.EngineStore.Instances.find(e=>e.getRenderingCanvas()?.id==='renCard3DCanvas');
    const scene=engine?.scenes[0];if(!scene){reject(Error('No card engine'));return;}
    const timer=setTimeout(()=>reject(Error('No rendered card frame after resize')),5000);
    scene.onAfterRenderObservable.addOnce(()=>{
     Promise.resolve(engine.readPixels(0,0,engine.getRenderWidth(),engine.getRenderHeight())).then(bytes=>{
      clearTimeout(timer);let n=0;for(let i=3;i<bytes.length;i+=4)if(bytes[i]>20)n++;resolve(n);
     },reject);
    });
   }));
   assert.ok(pixels>100,'Real non-transparent GLB pixels must be rendered: '+pixels);
   console.log('real GLB pixels',pixels);
  }
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
   await page.setViewportSize({width:w,height:h});await page.waitForTimeout(500);await drawn();await fits(`${w}x${h}`);
   await page.screenshot({path:`artifacts/hero-card-${useWebkit?'webkit':'chromium'}-${w}x${h}.png`});
  }

  // ROSTERDOSSIER001: all five heroes use one responsive ability/action layout.
  for(const heroId of ['ren','nada','liora','art','sava']){
   await page.evaluate(id=>{selectedHeroId=id;showScreen('heroDetail');},heroId);
   for(const [width,height] of [[844,390],[932,430],[844,320]]){
    await page.setViewportSize({width,height});
    const measured=await page.evaluate(()=>{
     const root=document.documentElement;
     const cards=[...document.querySelectorAll('#heroAbilityList .hero-ability-card')];
     const conflict=cards.filter(card=>card.querySelector('.hero-ability-thumb')&&
      card.querySelector('.hero-card-ability-icon')).length;
     const overlaps=cards.filter(card=>{
      const art=card.querySelector('.hero-ability-thumb'),name=card.querySelector('.hero-ability-title-text');
      if(!art||!name)return false;
      const a=art.getBoundingClientRect(),n=name.getBoundingClientRect(),c=card.getBoundingClientRect();
      return a.right>n.left+1||n.right>c.right+1||n.bottom>c.bottom+1;
     }).length;
     const panel=document.querySelector('#heroDetail .hero-detail-progression').getBoundingClientRect();
     const actions=[...document.querySelectorAll('#heroDetail .hero-card-links button')];
     const clipped=actions.filter(el=>{
      const box=el.getBoundingClientRect();
      return box.height<43||box.width<43||box.top<panel.top-1||
       box.bottom>panel.bottom+1||box.bottom>innerHeight-16+1;
     }).map(el=>el.textContent);
     return {cards:cards.length,art:cards.filter(c=>c.querySelector('.hero-ability-thumb')).length,
      conflict,overlaps,clipped,overflow:root.scrollWidth>innerWidth+1||root.scrollHeight>innerHeight+1};
    });
    assert.ok(measured.cards>=4,heroId+': missing ability cards');
    assert.ok(measured.art>=4,heroId+': missing approved illustrations');
    assert.equal(measured.conflict,0,heroId+': duplicated legacy glyph');
    assert.equal(measured.overlaps,0,heroId+': icon/title overlap at '+width+'x'+height);
    assert.deepEqual(measured.clipped,[],heroId+': clipped bottom controls at '+width+'x'+height);
    assert.equal(measured.overflow,false,heroId+': document overflow at '+width+'x'+height);
    console.log('ROSTERDOSSIER001',heroId,width,height,measured);
   }
  }
  await page.evaluate(()=>{selectedHeroId='ren';showScreen('heroDetail');});
  await page.setViewportSize({width:844,height:390});
  await page.setViewportSize({width:844,height:390});
  // GEARSLOTUX001: initial save has no resources; each of the six slots
  // advertises farming before the player opens the recipe.
  assert.equal(await page.locator('#gearSlots .gear-slot--missing').count(),6);
  assert.equal(await page.locator('#gearSlots .gear-slot-indicator svg').count(),6);
  await page.locator('#gearSlots button').nth(0).click();
  assert.equal(await page.locator('#heroDetail').evaluate(n=>n.classList.contains('gear-ux-active')),true);
  assert.equal(await page.locator('#heroGearDialog').evaluate(n=>n.open),false,'Gear must not cover the 3D hero');
  assert.match(await page.locator('#gearUxLeft').textContent(),/Короткий клинок/);
  assert.match(await page.locator('#gearUxRight').textContent(),/Материалы для изготовления/);
  for(const [w,h] of [[844,390],[932,430]]){
   await page.setViewportSize({width:w,height:h});
   const dims=await page.evaluate(()=>{
    const stage=document.querySelector('#detailHeroStage').getBoundingClientRect();
    const root=document.documentElement;
    return {horizontalOverflow:root.scrollWidth>innerWidth+1,verticalOverflow:root.scrollHeight>innerHeight+1,
     stageHeight:stage.height,panelsVisible:['gearUxLeft','gearUxRight'].every(id=>document.getElementById(id).getBoundingClientRect().height>130)};
   });
   assert.equal(dims.horizontalOverflow,false);assert.equal(dims.verticalOverflow,false);
   assert.ok(dims.stageHeight>160);assert.equal(dims.panelsVisible,true);
   await page.screenshot({path:`artifacts/gear-ux-004-${useWebkit?'webkit':'chromium'}-${w}x${h}.png`});
  }
  await page.setViewportSize({width:844,height:390});
  await page.locator('#gearUxRight .gear-ux-find').first().click();
  assert.match(await page.locator('#gearUxLeft').textContent(),/Где добыть/);
  const farm=page.locator('#gearUxLeft .gear-ux-source-actions button.primary').first();
  assert.equal(await farm.isEnabled(),true,'First available mission remains playable');
  await farm.click();
  assert.equal(await page.locator('#squad').evaluate(n=>n.classList.contains('active')),true);
  await page.locator('#squadBack').click();
  assert.equal(await page.locator('#heroDetail').evaluate(n=>n.classList.contains('active')),true);
  assert.equal(await page.evaluate(()=>selectedGearSlot),0);
  assert.equal(await page.locator('#heroDetail').evaluate(n=>n.classList.contains('gear-ux-active')),true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#heroDetail').evaluate(n=>n.classList.contains('gear-ux-active')),false);
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
  assert.equal(await page.locator('#gearSlots button').first().getAttribute('data-gear-state'),'ready',
   'Developer materials must unlock crafting directly on the hero card');
  assert.equal(await page.locator('#gearSlots button').first().locator('.gear-slot-indicator').textContent(),'+');
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
  await page.locator('#gearUxRight .gear-ux-craft').click();
  assert.equal(await page.evaluate(()=>!!ProgressCore.gearState(progress,'ren').slots[0]),true);
  assert.equal(await page.locator('#gearSlots button').first().getAttribute('data-gear-state'),'installed',
   'The crafted item must immediately change to the equipped state');
  assert.equal(await page.locator('#gearSlots button').first().locator('.gear-slot-indicator').textContent(),'✓');
  await page.keyboard.press('Escape');
  await page.locator('#detailBack').click();assert.equal(await page.locator('#collection').evaluate(n=>n.classList.contains('active')),true);
  assert.equal(await page.evaluate(()=>document.body.classList.contains('hero-card-mode')),false);
  await page.evaluate(()=>{selectedHeroId='nada';showScreen('heroDetail');});await fits('other playable hero');
  await page.locator('#detailHome').click();
  await page.evaluate(()=>{selectedHeroId='ren';showScreen('heroDetail');});
  await page.waitForFunction(()=>document.querySelector('#detailHeroStage').classList.contains('has-ren-3d'),null,{timeout:45000});
  await fits('re-entry');
  // ART3D001: Art and Sava both load their skinned GLBs, keeping the 2D portrait as fallback.
  for(const id of ['art','sava']){
   await page.evaluate(heroId=>{selectedHeroId=heroId;showScreen('heroDetail');},id);
   await page.waitForFunction(heroId=>{
    const img=document.getElementById('detailRenPortrait');
    return !!img&&img.complete&&img.naturalWidth>0&&img.src.includes(heroId+'-portrait-ui.webp');
   },id,{timeout:15000});
   await page.waitForFunction(()=>document.getElementById('detailHeroStage').classList.contains('has-ren-3d'),null,{timeout:45000});
   const info=await page.evaluate(()=>({
    name:document.getElementById('detailName').textContent,
    image:document.getElementById('detailRenPortrait').getAttribute('src'),
    imageVisible:!document.getElementById('detailRenPortrait').hidden,
    stageHasPortrait:document.getElementById('detailHeroStage').classList.contains('has-ren-portrait'),
    viewerHidden:document.getElementById('renCard3DCanvas').hidden,
    stats:document.getElementById('detailStats').textContent,
    gear:document.querySelectorAll('#gearSlots button').length
   }));
   assert.equal(info.name,id==='art'?'Арт':'Сава');
   assert.equal(info.image,'assets/'+id+'-portrait-ui.webp?v=2');
   assert.equal(info.imageVisible,false,'3D replaces the portrait after successful import');
   assert.equal(info.stageHasPortrait,true);
   assert.equal(info.viewerHidden,false,'3D viewer is visible for Art and Sava');
   assert.ok(info.stats.includes('Здоровье'));
   assert.equal(info.gear,6);
   await fits('ARTSAVA001 '+id);
   await page.locator('#detailBiography').click();
   assert.equal(await page.locator('#heroBiographyDialog').evaluate(n=>n.open),true);
   const bio=await page.locator('#heroBiographyText').textContent();
   assert.ok(bio.length>50);
   await page.evaluate(()=>document.getElementById('heroBiographyDialog').close());
  }
  assert.deepEqual(errors,[]);
  console.log('HEROCARD001 browser passed',useWebkit?'WebKit':'Chromium');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
