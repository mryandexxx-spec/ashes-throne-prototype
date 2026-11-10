"""ENV021 Art Pass 012 — modular geological macroforms, clay research only.
Rebuilds the far scarp as a broad multi-buttress landmass. Fighter anchor
areas and gameplay are unchanged. NO art approval, no runtime integration.
"""
import importlib.util
import math
from pathlib import Path

spec = importlib.util.spec_from_file_location("env021_pass011", Path(__file__).with_name("env021-art-pass-011.py"))
previous = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)
core = previous.base
smooth01, pos = core.smooth01, core.pos

def gauss(a, c, w):
    return math.exp(-((a-c)/w)**2)

def lip(a):
    # Isolated multi-meter collapses without a wavy fence silhouette.
    bays = (.66*gauss(a,-7.5,1.9)+.82*gauss(a,6.8,2.3))
    crown = .34*gauss(a,-2.0,3.0)+.23*gauss(a,12.0,2.6)
    return 4.12 + .26*math.sin(.24*a) + crown - bays

def left_edge(a):
    # Keep ally capsules protected, but remove the excess white foreground.
    return -3.93-.16*math.sin(a*.20+.7)-.12*gauss(a,-8,2.4)

def surface(s,a):
    # Preserve original standing planes; modify only the shoulder and cap.
    shape=previous.surface(s,a)
    land=smooth01((-s-3.22)/1.3)
    crown=smooth01((s-3.08)/max(.6,lip(a)-3.08))
    shear=(.26*gauss(a,-5.8,1.1)+.32*gauss(a,6.4,1.4))
    return shape - .30*land - shear*crown

def opposite_bank():
    """Continuous cliff with asymmetric geological masses, no pasted blocks.

    Front face is a connected height field of tilted fractured buttresses.
    Its deep joints, horizontal beds and a broad irregular rear plateau
    share one contiguous triangle surface rather than disconnected props.
    """
    verts=[];faces=[]
    def vertex(s,a,z):
        verts.append(pos(s,a,z));return len(verts)-1
    def quad(i,j,k,l):
        faces.extend(((i,j,k),(i,k,l)))
    na,nv,nb=129,65,31
    fronts=[];backs=[]
    for j in range(na):
        a=-26.0+j*58.0/(na-1)
        # Two flanking promontories frame a deeply recessed central gully.
        gully = 4.8*gauss(a,1.7,3.9)+2.0*gauss(a,-14.0,2.8)+2.6*gauss(a,19.0,3.2)
        thrust = -2.0*gauss(a,-6.9,3.1)-1.9*gauss(a,11.2,3.9)
        front = 18.8+gully+thrust+.57*math.sin(a*.19)
        breaks = (1.25*gauss(a,-17.0,.85)+2.0*gauss(a,-1.4,1.1)
                  +1.4*gauss(a,9.2,.95)+1.8*gauss(a,23.0,.85))
        crest = (-5.9+2.1*gauss(a,-7.0,4.6)+2.6*gauss(a,12.5,5.1)
                 -1.75*gauss(a,2.6,3.7)-breaks+.35*math.sin(a*.3))
        face=[]
        for k in range(nv):
            t=k/(nv-1);depth=37*t
            # Bed-resistant cap and middle benches, soft beds retreat.
            layers=((0,.0),(3.3,.28),(7.4,2.4),(11.6,.66),
                    (17.5,3.1),(23.0,1.15),(30.2,3.5),(37.0,2.6))
            retreat=layers[-1][1]
            for (d0,v0),(d1,v1) in zip(layers,layers[1:]):
                if depth<=d1:
                    q=smooth01((depth-d0)/(d1-d0))
                    retreat=v0*(1-q)+v1*q
                    break
            # Buttress nose attenuates with depth (not a rectangular column).
            nose=(1-t)**1.4*(1.05*gauss(a,-8.3,2.7)+.97*gauss(a,11.0,3.8))
            joints=(.72+1.25*t)*sum(gauss(a-c-.055*depth,0,w)
                for c,w in ((-17,.73),(-1.4,.66),(9.2,.75),(23,.63)))
            # Fissures become shallow gullies in soft middle layers.
            weather=.45*math.sin(.34*a+.08*depth)*math.sin(math.pi*t)
            face.append(vertex(front+1.3*t+retreat+joints+weather-nose,a,crest-depth))
        fronts.append(face)
        back=[]
        for k in range(nb):
            u=k/(nb-1)
            crest_joint=.72*sum(gauss(a-q,0,w) for q,w in ((-17,.73),(-1.4,.66),(9.2,.75),(23,.63)))
            crest_nose=1.05*gauss(a,-8.3,2.7)+.97*gauss(a,11.0,3.8)
            s=front+crest_joint-crest_nose+18*u
            # Tall near crest, eroded basin and far shoulder: several depths
            # in the horizon without adding a second mesh or skybox.
            z=crest-(.5*u+4.2*u*u+2.2*smooth01((u-.58)/.30))
            z+=.75*math.sin(a*.12+.45)*math.sin(math.pi*u)
            back.append(vertex(s,a,z))
        backs.append(back)
    for j in range(na-1):
        for k in range(nv-1):
            quad(fronts[j][k],fronts[j+1][k],
                 fronts[j+1][k+1],fronts[j][k+1])
        for k in range(nb-1):
            quad(backs[j][k],backs[j][k+1],
                 backs[j+1][k+1],backs[j+1][k])
    return core.mesh("ENV021_far_buttressed_layered_mass",verts,faces)

def build(scan_path):
    # Pass010 owns the vetted CC0 import and marker/GLB staging.
    core.lip=lip
    core.left_edge=left_edge
    core.surface=surface
    core.opposite_bank=opposite_bank
    result=core.build(scan_path)
    result["stage"]="ART_PASS_012_NOT_APPROVED"
    result["form"]="asymmetric buttress masses, stepped sedimentary wall, reduced foreground shoulder"
    result["note"]="Experimental clay only; un-welded CC0 scan; actual Babylon cameras and HUD require review"
    return result
