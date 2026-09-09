"""Small procedural matte palette; no external images or Python packages."""
import bpy


def material(name, color, concrete=False, emission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = .88
    shader.inputs['Specular IOR Level'].default_value = .18
    if emission:
        shader.inputs['Emission Color'].default_value = (*color, 1)
        shader.inputs['Emission Strength'].default_value = emission
    if concrete:
        coords = nodes.new('ShaderNodeTexCoord')
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 1.7
        noise.inputs['Detail'].default_value = 2
        links.new(coords.outputs['Object'], noise.inputs['Vector'])
        ramp = nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = .15
        ramp.color_ramp.elements[0].color = (*(c * .76 for c in color), 1)
        ramp.color_ramp.elements[1].position = .85
        ramp.color_ramp.elements[1].color = (*color, 1)
        links.new(noise.outputs['Fac'], ramp.inputs[0])
        links.new(ramp.outputs[0], shader.inputs['Base Color'])
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .12
        bump.inputs['Distance'].default_value = .025
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs[0], shader.inputs['Normal'])
    return mat


def palette():
    return {
        'concrete': material('Beton clair patine', (.57, .61, .64), True),
        'base': material('Soubassement bleu gris', (.16, .24, .30), True),
        'blue': material('Cages bleu profond', (.035, .105, .19), True),
        'roof': material('Etancheite mate', (.12, .155, .19), True),
        'frame': material('Menuiserie aluminium peint', (.56, .61, .64)),
        'glass': material('Vitrage nuit', (.025, .065, .10)),
        'lit': material('Vitrage ambre', (1, .54, .19), emission=1.5),
        'door': material('Portes acier', (.035, .075, .10)),
        'tech': material('Zinc mat', (.29, .34, .38)),
        'shutter': material('Volets ivoire grise', (.39, .43, .46)),
        'stain': material('Traces sous appuis', (.34, .39, .43), True),
    }
