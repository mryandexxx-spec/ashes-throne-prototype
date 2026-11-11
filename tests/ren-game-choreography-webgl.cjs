'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:932,height:430}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8765/');
  await page.evaluate(()=>{selectedLeaderId=null;selectedPartyIds=['ren'];battleIsCampaign=false;battleIsStoryDemo=false;resetBattle();state.fighters.forEach(f=>{f.hp=f.maxHp=10000;});syncBattleUI();showScreen('battle');});
  await page.waitForFunction(()=>renGlbRuntime?.isReady,{timeout:90000});
  await page.evaluate(()=>{stopBattleRendering();engine.getDeltaTime=()=>0;});
  const initial=await page.evaluate(()=>({meshes:scene.meshes.length,groups:scene.animationGroups.length}));
  const records=[];
  for(const speed of [1,2,4]){
   await page.evaluate(speed=>{BattleSpeed.set(speed);},speed);
   const before=await page.evaluate(()=>state.allyActions);
   await page.locator('#basicAbilityBtn').click();
   const contact=await page.evaluate(()=>{
    const count=state.allyActions;document.getElementById('basicAbilityBtn').click();
    if(state.allyActions!==count)throw Error('Second action started during presentation');
    BattleAnimation.tick(0);const a=BattleAnimation.activity('ren');
    if(!a.plan)throw Error('Live game did not use distance choreography');
    while(BattleAnimation.activity('ren').elapsedMs<a.plan.contactMs){
     const left=a.plan.contactMs-BattleAnimation.activity('ren').elapsedMs;BattleAnimation.tick(Math.min(100,left));
    }
    renderBattleFrame();
    const target=meshes[a.targetId].body.position,hand=scene.transformNodes.find(n=>n.name==='mixamorig:RightHand').getAbsolutePosition();
    return {actions:state.allyActions,planMs:a.plan.durationMs,contactError:RenChoreography.contactError(hand,target),yaw:meshes.ren.body.rotation.y};
   });
   assert.equal(contact.actions,before+1);assert.ok(contact.contactError<.05,JSON.stringify(contact));records.push({speed,...contact});
   if(speed===1){fs.mkdirSync('artifacts/ren-choreography',{recursive:true});await page.screenshot({path:'artifacts/ren-choreography/game-contact.png'});}
   await page.evaluate(()=>{
    let frames=0;while(BattleAnimation.pending()&&frames++<1000){BattleAnimation.tick(100,BattleSpeed.multiplier());renderBattleFrame();}
    if(BattleAnimation.pending())throw Error('Live queue hung');syncBattleUI();
   });
   assert.equal(await page.locator('#basicAbilityBtn').isEnabled(),true);
  }
  await page.evaluate(()=>{state.fighters.filter(f=>f.side==='enemy').forEach(f=>{f.hp=1;f.protection=0;});});
  for(let i=0;i<3&&await page.evaluate(()=>state.active);i++){
   await page.locator('#basicAbilityBtn').click();
   await page.evaluate(()=>{for(let i=0;i<1000&&BattleAnimation.pending();i++){BattleAnimation.tick(100,4);renderBattleFrame();}});
  }
  const finished=await page.evaluate(()=>({active:state.active,pending:BattleAnimation.pending(),transition:isVisualTransition(),winner:state.winner}));
  assert.equal(finished.active,false);assert.equal(finished.pending,0);assert.equal(finished.transition,false);assert.equal(finished.winner,'ally');
  await page.locator('#battleRetryBtn').click();await page.locator('#squadStart').click();
  const restarted=await page.evaluate(()=>{stopBattleRendering();return {active:state.active,pending:BattleAnimation.pending(),meshes:scene.meshes.length,groups:scene.animationGroups.length};});
  assert.equal(restarted.active,true);assert.equal(restarted.pending,0);assert.equal(restarted.meshes,initial.meshes);assert.equal(restarted.groups,initial.groups);
  await page.evaluate(()=>showScreen('home'));
  assert.equal(await page.evaluate(()=>BattleAnimation.pending()),0);assert.deepEqual(errors,[]);
  fs.writeFileSync('artifacts/ren-choreography/live-game.json',JSON.stringify({records,finished,restarted},null,2));
  console.log('RENCHOR021 live WebGL',JSON.stringify({records,finished,restarted}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
