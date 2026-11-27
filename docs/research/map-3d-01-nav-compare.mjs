import {writeFileSync} from 'node:fs';
import {compare} from './map-3d-01-nav-core.mjs';
const report=await compare();
writeFileSync('map-3d-nav-results.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report.results.map(({name,error,passed,total,initBakeMs,queryMedianMs,queryP95Ms})=>({name,error,passed,total,initBakeMs,queryMedianMs,queryP95Ms})),null,2));
if(report.results.filter(x=>!x.error&&x.passed===x.total&&x.name!=='authored-graph-control').length!==2)process.exitCode=1;
