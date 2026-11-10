"""ENV021 Art Pass015: near-shelf relief + layered escarpment, with Blockout014A far wall.

Experimental 3D terrain geometry; texture/PBR and runtime deployment pending.
Deliberately retains the entire horizontal fighting corridor and far bank.
"""
import importlib.util
import math
from pathlib import Path

spec=importlib.util.spec_from_file_location("env021_blockout014",Path(__file__).with_name("env021-blockout-014.py"))
previous=importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)
core=previous.core
pos=core.pos
smooth01=core.smooth01

def gauss(x,c,w):
    return math.exp(-((x-c)/w)**2)

# A less symmetric shelf edge, no large floating appendage or sudden crop.
def outline(a):
    l,r=previous.outline(a,"A")
    # Remaining entirely outside six fighter bases.
    return l-.7*gauss(a,-5.2,1.5)-.85*gauss(a,5.9,1.7),r-.55*gauss(a,-5.0,.9)-.45*gauss(a,5.9,1.3)

def surface(s,a):
    # Flat rectangular fighting corridor cannot carry sculpt-level ridges.
    # All displacement fades to zero within the safe base footprint.
    safe=smooth01((max(abs(s)-3.08,abs(a)-2.68))/1.30)
    h=-.04+(previous.height(s,a,"A")+.04)*safe
    side=smooth01((abs(s)-3.00)/2.7)
    ends=smooth01((abs(a)-2.60)/3.9)
    # Three *continuous geological fractures* with slanting traces and
    # width variation. These are narrow recessed cuts, not surface noise.
    joint=(.19*gauss(a-.35*s,-5.4,.20)
          +.13*gauss(a+.29*s,5.2,.17)
          +.11*gauss(s+.21*a,-4.3,.17))
    # Macro caprock undulation and resistant bed edges only outside the
    # protected standing stage.
    strata=(.32*math.sin(.66*a-.21*s)+.16*math.sin(.45*s+.32*a))
    cap= -.26*side-.19*ends +.24*ends*side
    return h+safe*(.20*strata*(.25+.75*max(side,ends))-joint*(.3+.7*max(side,ends))+cap)

def near_mass():
    """Sculpt the verified Blockout014A mesh without altering its topology.

    This avoids reintroducing experimental loose geometry in a GLB exporter
    that has already passed native Babylon checks for the same mesh indices.
    """
    ob=previous.near_mass("A")
    # In the Blender-free smoke test core.mesh returns (name, raw_verts,
    # triangles); expose the identical shape transform on that representation.
    raw=isinstance(ob,tuple)
    if raw:
        name,points,faces=ob
        class Co:
            def __init__(self,p): self.x,self.y,self.z=p
        class Vert:
            def __init__(self,p): self.co=Co(p)
        vertices=[Vert(p) for p in points]
    else:
        vertices=ob.data.vertices
    # The base comprises 91 x 45 contiguous top vertices, then 30 rear-wall,
    # 30 front-wall and 45 floor vertices per longitudinal sample. No index
    # or face count changes, so the known valid mesh topology is preserved.
    top_count=91*45
    per_row=30+30+45
    touched=0
    for i,vert in enumerate(vertices):
        p=vert.co
        s=-(p.x*core.RIGHT[0]+p.y*core.RIGHT[1])
        a=-(p.x*core.AWAY[0]+p.y*core.AWAY[1])
        if i<top_count:
            before=previous.height(s,a,"A")
            after=surface(s,a)
            vert.co.z+=after-before
            # Keep the six battle footprints as flat as the source.
            touched+=abs(after-before)>1e-9
        else:
            local=(i-top_count)%per_row
            left,right=previous.outline(a,"A")
            side=left if local<30 else right
            offset=surface(side,a)-previous.height(side,a,"A")
            vert.co.z+=offset
            # The visible front scarp gets joints and uneven bed faces,
            # but only as controlled deformation of its native vertices.
            if 30<=local<60:
                t=((local-30)+1)/30
                cut=(.32*gauss(a,-5.0,.65)+.43*gauss(a,5.5,.65))
                indent=t*(.18*math.sin(.57*a+2.7*t)-cut)
                new_s=s+indent
                coords=pos(new_s,a,float(vert.co.z))
                vert.co.x,vert.co.y=coords[0],coords[1]
    if raw:
        transformed=[(v.co.x,v.co.y,v.co.z) for v in vertices]
        return ("ENV021_015_near_layered_shelf",transformed,faces)
    ob.data.update()
    # Low-poly talus and broken caprock around the playable area. Rocks are
    # joined into the near sculpt (still one exported GLB mesh), and placed
    # outside the full six-fighter corridor; the far bank is untouched.
    import bpy
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    fragments=0
    rock_objects=[]
    for flank in ("landward","rim"):
        for i in range(16):
            a=-7.05+i*.90
            l,r=outline(a)
            if flank=="landward":
                s=l+.55+.47*((i*5)%7)/7
            else:
                s=r-.26-.40*((i*7)%11)/11
            radius=.19+.27*((i*3)%9)/9
            h=.16+.34*((i*5)%13)/13
            p=pos(s,a,surface(s,a)+h*.38)
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=p)
            rock=bpy.context.object
            rock.name="ENV021_015_talus_"+flank+"_"+str(i)
            rock.scale=(radius*1.35,radius*.82,h)
            rock.rotation_euler=(.15*math.sin(i),.20*math.cos(i*.9),.9*math.sin(i*.47))
            rock_objects.append(rock)
            fragments+=1
    # Blender primitive_add deselects previous objects. Explicitly reselect
    # all pieces before joining or the exported GLB will contain 30+ meshes.
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    for rock in rock_objects:
        rock.select_set(True)
    rock_names=[rock.name for rock in rock_objects]
    bpy.context.view_layer.objects.active=ob
    bpy.ops.object.join()
    assert all(name not in bpy.data.objects for name in rock_names)
    ob.data.update()
    print("ENV021_PASS015_JOINED_FRAGMENTS",fragments,flush=True)
    print("ENV021_PASS015_PROVEN_BASE_RESCULPT",len(ob.data.vertices),
          len(ob.data.polygons),"top displaced",touched,flush=True)
    ob.name="ENV021_015_near_layered_shelf"
    return ob

def stone_texture(ob):
    """Deterministic self-contained albedo + UV on the near mesh.

    No provider image or external licensed material. Preview-grade texture,
    packed into the Blender source and GLB. Not an optimized game PBR asset.
    """
    import bpy
    image=bpy.data.images.new("ENV021_015_weathered_rock_384",width=384,height=384,alpha=True)
    pixels=[]
    def noise(x,y):
        return (.47*math.sin(12.3*x+7.2*y)*math.sin(6.4*y-4.2*x)
                +.25*math.sin(35.1*x+23.7*y)*math.sin(39.5*y-15.2*x)
                +.12*math.sin(93*x-17*y)*math.sin(106*y+28*x))
    for iy in range(384):
        y=iy/384
        for ix in range(384):
            x=ix/384
            n=noise(x,y)
            thin=.5*(math.sin(23*x+5*math.sin(9*y))+1)
            fissure=max(0.,1.-abs(math.sin(21*x+15*y+1.5*math.sin(8*y)))*18)
            seam=max(0.,1.-abs(math.sin(63*y+4*math.sin(13*x)))*24)
            crack=max(fissure*.55,seam*.35)
            warm=max(0.,math.sin(14*y+8*x))*max(0.,n)
            gray=.60+.16*n-.13*crack
            pixels.extend((max(.06,min(.88,gray+.065*warm)),
                           max(.06,min(.88,gray*.93+.025*thin)),
                           max(.06,min(.88,gray*.83-.03*warm)),1))
    image.pixels.foreach_set(pixels)
    image.pack()
    material=bpy.data.materials.new("ENV021_015_PBR_rough_cliff_albedo")
    material.diffuse_color=(.69,.65,.59,1)
    material.use_nodes=True
    nodes=material.node_tree.nodes
    principled=nodes.get("Principled BSDF")
    tex=nodes.new("ShaderNodeTexImage")
    tex.name="ENV021_015_PACKED_ROCK_ALBEDO"
    tex.image=image
    material.node_tree.links.new(tex.outputs["Color"],principled.inputs["Base Color"])
    principled.inputs["Metallic"].default_value=0.0
    principled.inputs["Roughness"].default_value=.93
    ob.data.materials.clear();ob.data.materials.append(material)
    uvs=ob.data.uv_layers.new(name="ENV021_015_UV0")
    for poly in ob.data.polygons:
        side=abs(poly.normal.z)<.65
        for li in poly.loop_indices:
            p=ob.data.vertices[ob.data.loops[li].vertex_index].co
            s=-(p.x*core.RIGHT[0]+p.y*core.RIGHT[1])
            a=-(p.x*core.AWAY[0]+p.y*core.AWAY[1])
            # Top planar projection and near-vertical wall projection
            # in stable authoring-space meters; repeat terrain tile.
            if side:
                uvs.data[li].uv=(a*.19,(p.z+6)*.19)
            else:
                uvs.data[li].uv=(s*.19,a*.19)
    print("ENV021_PASS015_TEXTURE_PACKED_UV",len(uvs.data),flush=True)


def build(scan_path=None):
    import bpy
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for a in (-1.9,0,1.9):
        left,right=outline(a)
        assert left < -3.15 and right > 3.15
        for s in (-2.45,2.45):
            assert abs(surface(s,a)+.04)<1e-9
    near=near_mass()
    far=previous.far_mass("A")  # Preserve the far wall that owner likes.
    stone_texture(near)
    core.material(far,"ENV021_014A_FarPreserved",(.44,.48,.50,1))
    core.markers()
    return {
      "stage":"ART_PASS_015_UNREVIEWED",
      "source":"Derived from Blockout014A; sculpted near-bank bedding and inset fragments",
      "far_wall":"UNCHANGED_BLOCKOUT_014A",
      "sky":"REAL_TIME_TEST_ONLY_ATMOSPHERE",
      "material":"PACKED_384_ROCK_ALBEDO_AND_UV0_EXPERIMENTAL",
      "safe_fighter_zone":"s ±2.45; a -1.9,0,1.9; flat +0.04 correction",
      "note":"No CC0 scan imported; 3D mesh and Babylon sky experiment; NOT approved for game."
    }
