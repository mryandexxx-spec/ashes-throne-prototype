"""Adapt only authored footprint and presentation in temporary lab copies.
The tested Recast options, path checks, controller and animation state machine remain unchanged.
"""
from pathlib import Path
p=Path('map-3d-01-nav-core.mjs');s=p.read_text()
a=s.index('const positions=[],indices=[];');e=s.index('const cases=',a)
s=s[:a]+"import {positions,indices,authoredFloor,height as y} from './topology.mjs';\n"+s[e:]
a=s.index('function floor(x,z){');e=s.index('function clear(x,z)',a)
s=s[:a]+"function floor(x,z){return authoredFloor(x,z);}\n"+s[e:]
p.write_text(s)
