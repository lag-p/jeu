// Read-only presentation of the shared local atlas. No motion extrapolation.
function characterAppearance(entity) {
    if(entity.role==='PLAYER')return 'player';
    if(entity.type==='customer'){let hash=0;for(const c of String(entity.businessId))hash=(hash*31+c.charCodeAt(0))>>>0;return `customer${hash%4}`;}
    return entity.role==='police'?'police':entity.role;
}
function characterPose(entity,previous=0) {
    if(entity.motion){const {dx,dy,distance}=entity.motion;const direction=(Math.round(Math.atan2(dy,dx)/(Math.PI/4))+8)%8;
        return {direction,frame:entity.walking?4+Math.floor(distance/WALKING_CONFIG.stridePixels*6)%6:Math.floor(game.clock.elapsed*2)%4};}
    const p=entity.nextPoint,dx=p?(p.x-entity.x)*8.53:0,dy=p?(p.y-entity.y)*18.44:0;
    const direction=Math.hypot(dx,dy)>1e-7 ? (dy>=0?(dx>=0?0:1):(dx<0?2:3)) : previous;
    const frame=entity.walking ? 4+Math.floor(game.clock.elapsed*10)%6 : Math.floor(game.clock.elapsed*2)%4;
    return {direction,frame,name:`${characterAppearance(entity)}-${direction}-${frame}`};
}
function createRasterCharacter(scene,entity) {
    const pose=characterPose(entity),modern=scene.textures.exists('people-v3')&&scene.textures.get('people-v3').has(`${characterAppearance(entity)}-0-0`);
    const atlas=modern||scene.textures.exists('people')&&scene.textures.get('people').has(`${characterAppearance(entity)}-0-0`);
    let body;
    if(atlas)body=scene.add.image(0,0,modern?'people-v3':'people',`${characterAppearance(entity)}-0-0`).setOrigin(.5,82/96).setScale(.11);
    else {
        // Local articulated silhouette when the atlas fails, not a rectangular marker.
        body=scene.add.graphics();body.fillStyle(0x101820,.22).fillEllipse(0,.3,4,1.5);
        body.lineStyle(.8,0x263542,1).lineBetween(-.5,-3,-.8,0).lineBetween(.5,-3,.8,0);
        body.lineStyle(1.6,entity.color,1).lineBetween(0,-5.5,0,-3);
        body.lineStyle(.6,entity.color,1).lineBetween(-.8,-5,-1.5,-3).lineBetween(.8,-5,1.5,-3);
        body.fillStyle(0xd4a581).fillCircle(0,-6.5,.9);
    }
    const container=scene.add.container(0,0,[body]).setSize(8,12);container.setData('isoKey',entity.key);
    const hit=scene.add.circle(0,0,18,0xffffff,.001),selection=scene.add.ellipse(0,0,6,3).setStrokeStyle(.65,0xf5edcd).setVisible(false);
    return {container,body,hit,selection,entity,character:true,atlas,modern,direction:0,scene};
}
function syncRasterCharacter(visual,entity) {
    const pose=characterPose(entity,visual.direction);visual.direction=pose.direction;
    const direction=entity.motion?pose.direction:visual.direction;
    const frame=visual.modern?pose.frame:pose.frame?1+(pose.frame-1)%4:0;
    const legacyDirection=entity.motion?Math.floor(((direction+7)%8)/2):direction;
    const name=`${characterAppearance(entity)}-${visual.modern?direction:legacyDirection}-${frame}`;
    if(visual.atlas&&visual.body.texture.has(name)&&visual.body.frame.name!==name)visual.body.setFrame(name);
    if(visual.atlas&&isRasterMap()){
        const scene=visual.scene,zoom=scene.cameras.main.zoom,min=scene.masterActive?scene.rasterMinZoom():zoom;
        // Hauteur monde fixe : 24 px CSS au cadrage initial, elle diminue au
        // dézoom et augmente naturellement au zoom au lieu d'être constante.
        visual.body.setScale((24/min)/66);
    }
}
