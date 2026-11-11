const test=require("node:test");
const assert=require("node:assert/strict");
const RenGlbRuntime=require("../ren-glb-runtime.js");

function tracker(){
 const messages=[];
 return {messages,instance:RenGlbRuntime.createDownloadTracker(message=>messages.push(message))};
}
test("known total reports actual MiB and a bounded percentage",()=>{
 const t=tracker();
 t.instance.update({lengthComputable:true,loaded:5242880,total:10485760});
 assert.match(t.messages.at(-1),/5,0 МБ из 10,0 МБ \(50%\)/);
});
test("unknown size shows bytes only without fabricated total or percentage",()=>{
 const t=tracker();
 t.instance.update({lengthComputable:false,loaded:1048576,total:0});
 assert.match(t.messages.at(-1),/скачано 1,0 МБ/);
 assert.doesNotMatch(t.messages.at(-1),/%|из|неизвестен/);
});
test("reported total persists across events that lose lengthComputable",()=>{
 const t=tracker();
 t.instance.update({lengthComputable:true,loaded:5242880,total:10485760});
 t.instance.update({lengthComputable:false,loaded:7340032,total:0});
 assert.match(t.messages.at(-1),/7,0 МБ из 10,0 МБ \(70%\)/);
});
test("after exceeding size, show preparation instead of 120% or unknown size",()=>{
 const t=tracker();
 t.instance.setTotal(10485760);
 t.instance.update({lengthComputable:false,loaded:12582912});
 assert.match(t.messages.at(-1),/Файл Рена скачан/);
 assert.doesNotMatch(t.messages.at(-1),/120%|неизвестен|12,0 МБ/);
});
test("HEAD size can restore a denominator during unknown-length progress",()=>{
 const t=tracker();
 t.instance.update({lengthComputable:false,loaded:5242880,total:0});
 t.instance.setTotal(10485760);
 assert.match(t.messages.at(-1),/5,0 МБ из 10,0 МБ \(50%\)/);
});
test("invalid events and closed trackers never report progress",()=>{
 const t=tracker();
 t.instance.update({loaded:NaN,total:0});
 t.instance.update({loaded:-1,total:0});
 assert.equal(t.messages.length,0);
 t.instance.update({loaded:1024,total:0});
 t.instance.done();
 t.instance.update({loaded:2048,total:0});
 t.instance.setTotal(4096);
 assert.equal(t.messages.length,1);
});
test("one-shot formatter still supports callers",()=>{
 assert.equal(RenGlbRuntime.formatDownloadProgress({loaded:NaN,total:0}),null);
 assert.match(RenGlbRuntime.formatDownloadProgress({loaded:1048576,lengthComputable:false}),/скачано 1,0 МБ/);
});
