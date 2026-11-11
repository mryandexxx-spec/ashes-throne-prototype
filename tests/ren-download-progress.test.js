const test=require("node:test");
const assert=require("node:assert/strict");
const RenGlbRuntime=require("../ren-glb-runtime.js");

test("Ren GLB bytes show loaded and total in MiB",()=>{
 const text=RenGlbRuntime.formatDownloadProgress({lengthComputable:true,loaded:5242880,total:10485760});
 assert.match(text,/5,0 МБ из 10,0 МБ/);
 assert.match(text,/50%/);
});
test("Unknown total never shows fabricated percent or denominator",()=>{
 const text=RenGlbRuntime.formatDownloadProgress({lengthComputable:false,loaded:1048576,total:0});
 assert.match(text,/скачано 1,0 МБ/);
 assert.match(text,/общий объём неизвестен/);
 assert.doesNotMatch(text,/%/);
});
test("Invalid progress events do not invent byte counts",()=>{
 assert.equal(RenGlbRuntime.formatDownloadProgress({loaded:NaN,total:0}),null);
 assert.equal(RenGlbRuntime.formatDownloadProgress({loaded:-1,total:100}),null);
});
test("An over-reported loaded count is capped by known total",()=>{
 const text=RenGlbRuntime.formatDownloadProgress({lengthComputable:true,loaded:120,total:100});
 assert.match(text,/100%/);
 assert.doesNotMatch(text,/120%/);
});
