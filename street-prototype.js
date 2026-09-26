(function(){
  'use strict';

  const SVG_NS='http://www.w3.org/2000/svg';
  const APP_VERSION=(()=>{try{return new URL(document.currentScript?.src||location.href,location.href).searchParams.get('v')||null;}catch(_error){return null;}})();
  const EDGE=38;
  const TRI_H=Math.sqrt(3)*EDGE/2;
  const STREET_WALL_WIDTH=EDGE*.07;
  const BOARD_ROWS=[
    [4,18],[3,19],[2,20],[1,21],[0,20],[1,19],[2,18],[3,17]
  ];
  const COLORS={blue:'#2f6fd1',white:'#f5f1e8',yellow:'#e0a72e',red:'#d1293d'};
  const STREET_MIX={
    blue:{name:'Bleu',hex:'#2f6fd1'},red:{name:'Rouge',hex:'#d1293d'},white:{name:'Blanc',hex:'#f5f1e8'},yellow:{name:'Jaune',hex:'#e0a72e'},
    'red+yellow':{name:'Orange',hex:'#e0763c'},'blue+red':{name:'Violet',hex:'#9b4fd1'},'blue+yellow':{name:'Vert',hex:'#5cb82f'},
    'red+white':{name:'Rose',hex:'#f2a7bd'},'white+yellow':{name:'Jaune clair',hex:'#f5f0a3'},'blue+white':{name:'Bleu ciel',hex:'#a8d8f0'},
    'red+white+yellow':{name:'Orange clair',hex:'#eec397'},'blue+red+white':{name:'Violet clair',hex:'#cdaee6'},'blue+white+yellow':{name:'Vert clair',hex:'#aee089'},
    'blue+red+yellow':{name:'Noir',hex:'#171310'},'blue+red+white+yellow':{name:'Gris',hex:'#8f8f8f'}
  };
  const STREET_TRANSPARENT={name:'Transparent',hex:'#8a93a3'};
  const LABELS=['5','6','7','8','9','10','11','12','13','14','N','M','L','K','J','I','H','G','F','E','D','C','B','A','1','2','3','4'];
  const SAVE_KEY='orapa_street_creation_v3';
  const EPS=1e-6;

  const PIECES=[
    {id:'blueSmall',name:'Bleue — 1 triangle',color:'blue',pivot:[1/3,1/3],poly:[[0,0],[1,0],[0,1]],walls:[]},
    {id:'blueLarge',name:'Bleue — 4 triangles',color:'blue',pivot:[0,1],poly:[[0,0],[1,0],[1,2],[0,2]],walls:[]},
    {id:'whiteSmall',name:'Blanche — 2 triangles + mur',color:'white',pivot:[1,0],poly:[[0,0],[1,0],[1,1],[0,1]],walls:[[[1,0],[2,-1]]]},
    {id:'whiteLarge',name:'Blanche — hexagone + mur',color:'white',pivot:[0,0],poly:[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]],walls:[[[1,0],[2,0]]]},
    {id:'yellowLarge',name:'Jaune — 4 triangles',color:'yellow',pivot:[0,1],poly:[[0,0],[1,0],[1,2],[0,2]],walls:[]},
    {id:'yellowBent',name:'Jaune — 2 demi-hexagones décalés',color:'yellow',pivot:[1.5,0],poly:[[0,0],[1,0],[2,-1],[3,-1],[3,0],[2,0],[1,1],[0,1]],walls:[]},
    {id:'redWall',name:'Rouge — 2 triangles + mur',color:'red',pivot:[1,1],poly:[[0,0],[1,0],[1,1],[0,1]],walls:[[[1,1],[2,1]]]},
  ];
  const MIRROR_DISABLED=new Set(['blueSmall','whiteSmall','whiteLarge']);

  const byId=id=>document.getElementById(id);
  const svgEl=(name,attrs={})=>{
    const el=document.createElementNS(SVG_NS,name);
    Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
    return el;
  };
  const keyPoint=p=>`${p.q},${p.r}`;
  const screenPoint=p=>({x:p.q*EDGE/2,y:p.r*TRI_H});
  const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
  const mul=(a,n)=>({x:a.x*n,y:a.y*n});
  const dot=(a,b)=>a.x*b.x+a.y*b.y;
  const cross=(a,b)=>a.x*b.y-a.y*b.x;
  const norm=a=>{const n=Math.hypot(a.x,a.y)||1;return {x:a.x/n,y:a.y/n};};
  const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const samePoint=(a,b,e=.02)=>Math.hypot(a.x-b.x,a.y-b.y)<e;
  const pairKey=(a,b)=>[a,b].sort().join('|');

  function makeBoard(){
    const vertices=new Map();
    BOARD_ROWS.forEach(([min,max],r)=>{for(let q=min;q<=max;q+=2)vertices.set(`${q},${r}`,{q,r});});
    const triangles=[];
    let id=0;
    for(let r=0;r<7;r++){
      const min=Math.min(BOARD_ROWS[r][0],BOARD_ROWS[r+1][0])-2;
      const max=Math.max(BOARD_ROWS[r][1],BOARD_ROWS[r+1][1])+2;
      for(let q=min;q<=max;q++){
        const down=[vertices.get(`${q},${r}`),vertices.get(`${q+2},${r}`),vertices.get(`${q+1},${r+1}`)];
        if(down.every(Boolean))triangles.push({id:id++,points:down.map(screenPoint)});
        const up=[vertices.get(`${q},${r}`),vertices.get(`${q-1},${r+1}`),vertices.get(`${q+1},${r+1}`)];
        if(up.every(Boolean))triangles.push({id:id++,points:up.map(screenPoint)});
      }
    }
    const edges=new Map();
    triangles.forEach(tri=>{
      for(let i=0;i<3;i++){
        const a=tri.points[i],b=tri.points[(i+1)%3];
        const ka=`${a.x.toFixed(3)},${a.y.toFixed(3)}`,kb=`${b.x.toFixed(3)},${b.y.toFixed(3)}`;
        const k=pairKey(ka,kb);
        const item=edges.get(k)||{a,b,triangles:[]};
        item.triangles.push(tri);
        edges.set(k,item);
      }
    });
    const boundary=[...edges.values()].filter(edge=>edge.triangles.length===1);
    const adjacency=new Map();
    boundary.forEach((edge,index)=>{
      [edge.a,edge.b].forEach(point=>{
        const k=`${point.x.toFixed(3)},${point.y.toFixed(3)}`;
        if(!adjacency.has(k))adjacency.set(k,[]);
        adjacency.get(k).push({index,point});
      });
    });
    let start=boundary.reduce((best,edge)=>{
      for(const point of [edge.a,edge.b])if(!best||point.y<best.y-EPS||(Math.abs(point.y-best.y)<EPS&&point.x<best.x))best=point;
      return best;
    },null);
    let current=start,previous=null;
    const ordered=[];
    for(let guard=0;guard<boundary.length;guard++){
      const k=`${current.x.toFixed(3)},${current.y.toFixed(3)}`;
      const candidates=(adjacency.get(k)||[]).filter(item=>!ordered.includes(item.index));
      let chosen=candidates[0];
      if(guard===0)chosen=candidates.find(item=>{
        const edge=boundary[item.index],other=samePoint(edge.a,current)?edge.b:edge.a;
        return Math.abs(other.y-current.y)<.02&&other.x>current.x;
      })||chosen;
      if(!chosen)break;
      const edge=boundary[chosen.index];
      const other=samePoint(edge.a,current)?edge.b:edge.a;
      ordered.push(chosen.index);previous=current;current=other;
    }
    const orderedBoundary=ordered.map((index,i)=>({...boundary[index],label:LABELS[i],index:i}));
    const polygon=[start];
    current=start;
    orderedBoundary.forEach(edge=>{current=samePoint(edge.a,current)?edge.b:edge.a;polygon.push(current);});
    polygon.pop();
    const center=polygon.reduce((sum,p)=>add(sum,p),{x:0,y:0});center.x/=polygon.length;center.y/=polygon.length;
    orderedBoundary.forEach(edge=>{
      edge.mid=midpoint(edge.a,edge.b);
      const tri=edge.triangles[0];
      const otherMids=[];
      for(let i=0;i<3;i++){
        const m=midpoint(tri.points[i],tri.points[(i+1)%3]);
        if(!samePoint(m,edge.mid))otherMids.push(m);
      }
      edge.directions=otherMids.map(m=>norm(sub(m,edge.mid))).sort((a,b)=>Math.atan2(a.y,a.x)-Math.atan2(b.y,b.x));
      const tangent=norm(sub(edge.b,edge.a));
      let outward={x:-tangent.y,y:tangent.x};
      if(dot(outward,sub(edge.mid,center))<0)outward=mul(outward,-1);
      edge.outward=outward;
    });
    return {vertices,triangles,edges:[...edges.values()],boundary:orderedBoundary,polygon,center,width:21*EDGE/2,height:7*TRI_H};
  }

  const BOARD=makeBoard();

  function axialTransform(point,rotation,flipped){
    let [a,b]=point;
    if(flipped)[a,b]=[a+b,-b];
    for(let i=0;i<rotation;i++)[a,b]=[-b,a+b];
    return [a,b];
  }
  function axialVectorToScreen([a,b]){return {x:(a+b/2)*EDGE,y:b*TRI_H};}
  function applyPieceMirror(piece){
    if(MIRROR_DISABLED.has(piece.id))return false;
    const turningOn=!piece.flipped;
    const rotationCompensation=piece.id==='redWall'?1:(piece.id==='blueLarge'||piece.id==='yellowLarge'?2:0);
    piece.rotation=(piece.rotation+(turningOn?rotationCompensation:6-rotationCompensation))%6;
    piece.flipped=turningOn;
    return true;
  }
  function pieceGeometry(piece){
    const definition=PIECES.find(item=>item.id===piece.id);
    const legacyAnchor=piece.anchor?.q!==undefined;
    const center=legacyAnchor?screenPoint(piece.anchor):piece.anchor;
    const transform=point=>{
      if(legacyAnchor){const [a,b]=axialTransform(point,piece.rotation,piece.flipped);return add(center,axialVectorToScreen([a,b]));}
      const relative=[point[0]-definition.pivot[0],point[1]-definition.pivot[1]];
      return add(center,axialVectorToScreen(axialTransform(relative,piece.rotation,piece.flipped)));
    };
    return {definition,poly:definition.poly.map(transform),walls:definition.walls.map(w=>w.map(transform))};
  }
  function visualWallsFor(geometry){
    return geometry.walls.map(wall=>{
      const direction=norm(sub(wall[1],wall[0]));
      return [add(wall[0],mul(direction,-EDGE*.24)),wall[1]];
    });
  }
  function visualWallPolygonsFor(geometry){
    return visualWallsFor(geometry).map((wall,index)=>{
      const direction=norm(sub(wall[1],wall[0]));
      let normal={x:-direction.y,y:direction.x};
      const half=STREET_WALL_WIDTH/2;
      const bevel=half/Math.tan(Math.PI/3);
      const startTop=add(wall[0],mul(normal,half));
      const startBottom=add(wall[0],mul(normal,-half));
      const shoulder=add(wall[1],mul(direction,-bevel));
      if(geometry.definition.id==='redWall'){
        const physical=geometry.walls[index];
        const probeBase=add(physical[0],mul(direction,-4));
        if(!pointInPolygon(add(probeBase,mul(normal,STREET_WALL_WIDTH)),geometry.poly,true))normal=mul(normal,-1);
        const innerStart=add(wall[0],mul(normal,STREET_WALL_WIDTH));
        const innerShoulder=add(add(wall[1],mul(direction,-STREET_WALL_WIDTH/Math.tan(Math.PI/3))),mul(normal,STREET_WALL_WIDTH));
        return [wall[0],wall[1],innerShoulder,innerStart];
      }
      return [startTop,add(shoulder,mul(normal,half)),wall[1],add(shoulder,mul(normal,-half)),startBottom];
    });
  }
  function pointOnSegment(p,a,b,tolerance=.05){
    const ab=sub(b,a),ap=sub(p,a);
    return Math.abs(cross(ab,ap))<=tolerance&&dot(ap,ab)>=-tolerance&&dot(sub(p,b),ab)<=tolerance;
  }
  function pointInPolygon(point,poly,includeBoundary=true){
    const onBoundary=poly.some((p,i)=>pointOnSegment(point,p,poly[(i+1)%poly.length]));
    if(onBoundary)return includeBoundary;
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      if(((a.y>point.y)!==(b.y>point.y))&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    return inside;
  }
  function segmentIntersection(a,b,c,d,includeEnds=true){
    const r=sub(b,a),s=sub(d,c),den=cross(r,s),ca=sub(c,a);
    if(Math.abs(den)<EPS)return null;
    const t=cross(ca,s)/den,u=cross(ca,r)/den;
    const lo=includeEnds?-EPS:EPS,hi=includeEnds?1+EPS:1-EPS;
    if(t>=lo&&t<=hi&&u>=lo&&u<=hi)return {point:add(a,mul(r,t)),t,u};
    return null;
  }
  function collinearOverlap(a,b,c,d){
    const ab=sub(b,a);
    if(Math.abs(cross(ab,sub(c,a)))>.05||Math.abs(cross(ab,sub(d,a)))>.05)return false;
    const length2=dot(ab,ab);if(length2<EPS)return false;
    const t1=dot(sub(c,a),ab)/length2,t2=dot(sub(d,a),ab)/length2;
    return Math.min(1,Math.max(t1,t2))-Math.max(0,Math.min(t1,t2))>.02;
  }
  function polygonsConflict(a,b){
    for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
      const a1=a[i],a2=a[(i+1)%a.length],b1=b[j],b2=b[(j+1)%b.length];
      if(collinearOverlap(a1,a2,b1,b2))return 'side';
      const hit=segmentIntersection(a1,a2,b1,b2,false);if(hit)return 'overlap';
    }
    if(pointInPolygon(a[0],b,false)||pointInPolygon(b[0],a,false))return 'overlap';
    const sharedTriangle=BOARD.triangles.some(triangle=>{
      const center=triangle.points.reduce((sum,point)=>add(sum,point),{x:0,y:0});
      center.x/=3;center.y/=3;
      return pointInPolygon(center,a,false)&&pointInPolygon(center,b,false);
    });
    if(sharedTriangle)return 'overlap';
    return null;
  }
  function directlyReachablePieceIds(placed,geometries){
    const segments=[];
    placed.forEach(piece=>{
      const geometry=geometries.get(piece.id);
      geometry.poly.forEach((point,index)=>segments.push({a:point,b:geometry.poly[(index+1)%geometry.poly.length],piece}));
      geometry.walls.forEach(wall=>segments.push({a:wall[0],b:wall[1],piece}));
    });
    const reachable=new Set();
    BOARD.boundary.forEach(edge=>edge.directions.forEach(direction=>{
      const contacts=segments.filter(segment=>pointOnSegment(edge.mid,segment.a,segment.b,.2));
      if(contacts.length){contacts.forEach(segment=>reachable.add(segment.piece.id));return;}
      const origin=add(edge.mid,mul(direction,.1));
      let nearest=null;
      segments.forEach(segment=>{
        const hit=raySegmentHit(origin,direction,segment.a,segment.b);
        if(hit&&(!nearest||hit.t<nearest.t))nearest={...hit,...segment};
      });
      if(nearest)reachable.add(nearest.piece.id);
    }));
    return reachable;
  }
  function validatePieces(pieces,checkReachability=true){
    const issues=new Map();
    const placed=pieces.filter(piece=>piece.anchor);
    const geometries=new Map(placed.map(piece=>[piece.id,pieceGeometry(piece)]));
    placed.forEach(piece=>{
      const geo=geometries.get(piece.id);
      if(geo.poly.some(p=>!pointInPolygon(p,BOARD.polygon,true))||geo.walls.some(w=>w.some(p=>!pointInPolygon(p,BOARD.polygon,true))))issues.set(piece.id,'La pièce doit rester entièrement dans la grille.');
    });
    for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){
      const pa=placed[i],pb=placed[j],a=geometries.get(pa.id),b=geometries.get(pb.id);
      const conflict=polygonsConflict(a.poly,b.poly);
      if(conflict){const message=conflict==='side'?'Deux pièces ne peuvent pas partager un côté.':'Deux pièces ne peuvent pas se chevaucher.';issues.set(pa.id,message);issues.set(pb.id,message);}
      for(const wall of a.walls){
        if(b.poly.some((p,k)=>collinearOverlap(wall[0],wall[1],p,b.poly[(k+1)%b.poly.length])||segmentIntersection(wall[0],wall[1],p,b.poly[(k+1)%b.poly.length],false))||pointInPolygon(midpoint(wall[0],wall[1]),b.poly,false)){issues.set(pa.id,'Un mur traverse ou longe une autre pièce.');issues.set(pb.id,'Un mur traverse ou longe une autre pièce.');}
      }
      for(const wall of b.walls){
        if(a.poly.some((p,k)=>collinearOverlap(wall[0],wall[1],p,a.poly[(k+1)%a.poly.length])||segmentIntersection(wall[0],wall[1],p,a.poly[(k+1)%a.poly.length],false))||pointInPolygon(midpoint(wall[0],wall[1]),a.poly,false)){issues.set(pa.id,'Un mur traverse ou longe une autre pièce.');issues.set(pb.id,'Un mur traverse ou longe une autre pièce.');}
      }
    }
    if(checkReachability){
      const reachable=directlyReachablePieceIds(placed,geometries);
      placed.forEach(piece=>{if(!reachable.has(piece.id)&&!issues.has(piece.id))issues.set(piece.id,'Chaque pièce doit pouvoir être atteinte par au moins une onde sans rebond.');});
    }
    return issues;
  }
  function raySegmentHit(origin,direction,a,b){
    const s=sub(b,a),ao=sub(a,origin),den=cross(direction,s);
    if(Math.abs(den)<EPS)return null;
    const t=cross(ao,s)/den,u=cross(ao,direction)/den;
    if(t>0.02&&u>-EPS&&u<1+EPS)return {t,point:add(origin,mul(direction,t)),segment:[a,b]};
    return null;
  }
  function resolveStreetColor(colors){return colors.size?STREET_MIX[[...colors].sort().join('+')]||STREET_TRANSPARENT:STREET_TRANSPARENT;}
  function reflectedDirection(direction,a,b){
    const tangent=norm(sub(b,a));let normal={x:-tangent.y,y:tangent.x};
    if(dot(direction,normal)>0)normal=mul(normal,-1);
    return norm(sub(direction,mul(normal,2*dot(direction,normal))));
  }
  function matchingExitDirection(edge,outwardDirection){
    const inward=mul(outwardDirection,-1);let best=0,bestDot=-Infinity;
    edge.directions.forEach((direction,index)=>{const score=dot(direction,inward);if(score>bestDot){best=index;bestDot=score;}});
    return best;
  }
  function traceRay(edgeIndex,directionIndex,pieces){
    const entry=BOARD.boundary[edgeIndex],segments=[];
    pieces.filter(p=>p.anchor).forEach(piece=>{
      const geo=pieceGeometry(piece);
      geo.poly.forEach((p,i)=>segments.push({a:p,b:geo.poly[(i+1)%geo.poly.length],piece,color:geo.definition.color}));
      geo.walls.forEach(w=>segments.push({a:w[0],b:w[1],piece,color:geo.definition.color,wall:true}));
    });
    let direction=entry.directions[directionIndex],colorSet=new Set(),points=[entry.mid],exit=null,exitDirectionIndex=null,loop=false;
    // Une pièce peut poser l'un de ses murs exactement sur le bord. L'onde
    // frappe alors ce mur avant même d'entrer : elle ressort par l'autre
    // flèche de la même case, comme un rebond sur place.
    const entryContacts=segments.filter(segment=>pointOnSegment(entry.mid,segment.a,segment.b,.2));
    if(entryContacts.length){
      entryContacts.forEach(segment=>colorSet.add(segment.color));
      const reflected=reflectedDirection(direction,entryContacts[0].a,entryContacts[0].b);
      exitDirectionIndex=matchingExitDirection(entry,reflected);
      return {entry,entryDirectionIndex:directionIndex,exit:entry,exitDirectionIndex,points,colors:[...colorSet],color:resolveStreetColor(colorSet),bounced:true,loop:false};
    }
    let origin=add(entry.mid,mul(direction,.1));
    const visited=new Set();
    for(let bounce=0;bounce<40;bounce++){
      const stateKey=`${origin.x.toFixed(2)},${origin.y.toFixed(2)}:${direction.x.toFixed(3)},${direction.y.toFixed(3)}`;
      if(visited.has(stateKey)){loop=true;break;}visited.add(stateKey);
      let nearest=null;
      segments.forEach(segment=>{const hit=raySegmentHit(origin,direction,segment.a,segment.b);if(hit&&(!nearest||hit.t<nearest.t))nearest={...hit,...segment,type:'piece'};});
      BOARD.boundary.forEach(edge=>{const hit=raySegmentHit(origin,direction,edge.a,edge.b);if(hit&&(!nearest||hit.t<nearest.t))nearest={...hit,edge,type:'exit'};});
      if(!nearest)break;
      points.push(nearest.point);
      if(nearest.type==='exit'){exit=nearest.edge;exitDirectionIndex=matchingExitDirection(exit,direction);break;}
      colorSet.add(nearest.color);
      direction=reflectedDirection(direction,nearest.a,nearest.b);
      origin=add(nearest.point,mul(direction,.15));
    }
    return {entry,entryDirectionIndex:directionIndex,exit,exitDirectionIndex,points,colors:[...colorSet],color:resolveStreetColor(colorSet),bounced:exit===entry,loop};
  }
  function laneName(labels){
    const [a,b]=labels;
    if(/^[ABC]$/.test(a))return `${a}${b}`;
    if(/^[ABC]$/.test(b))return `${b}${a}`;
    if(/^\d+$/.test(a)&&!/^\d+$/.test(b))return `${a}${b}`;
    if(/^\d+$/.test(b)&&!/^\d+$/.test(a))return `${b}${a}`;
    return `${a}${b}`;
  }
  function emptyLane(edge,directionIndex){
    const direction=edge.directions[directionIndex],origin=add(edge.mid,mul(direction,.1));
    let nearest=null;
    BOARD.boundary.forEach(target=>{
      if(target===edge)return;
      const hit=raySegmentHit(origin,direction,target.a,target.b);
      if(hit&&(!nearest||hit.t<nearest.t))nearest={...hit,target};
    });
    const labels=nearest?[edge.label,nearest.target.label]:null;
    return nearest?{a:edge.mid,b:nearest.point,labels,name:laneName(labels)}:null;
  }
  const LANES=(()=>{
    const map=new Map();
    BOARD.boundary.forEach(edge=>edge.directions.forEach((_,i)=>{
      const lane=emptyLane(edge,i);if(!lane)return;
      const k=pairKey(...lane.labels);if(!map.has(k))map.set(k,lane);
    }));
    return [...map.values()];
  })();
  function coordinateForTriangle(triangle){
    const center=triangle.points.reduce((sum,p)=>add(sum,p),{x:0,y:0});center.x/=3;center.y/=3;
    const options=[];
    for(let i=0;i<LANES.length;i++)for(let j=i+1;j<LANES.length;j++){
      const hit=segmentIntersection(LANES[i].a,LANES[i].b,LANES[j].a,LANES[j].b,true);
      if(hit&&pointInPolygon(hit.point,triangle.points,true))options.push({lanes:[LANES[i],LANES[j]],distance:Math.hypot(hit.point.x-center.x,hit.point.y-center.y)});
    }
    options.sort((a,b)=>a.distance-b.distance||a.lanes[0].name.localeCompare(b.lanes[0].name,undefined,{numeric:true}));
    const selected=options[0]?.lanes;
    if(!selected)return 'Coordonnée indéterminée';
    selected.sort((a,b)=>{
      const angle=lane=>Math.atan2(lane.b.y-lane.a.y,lane.b.x-lane.a.x)*180/Math.PI;
      const aa=angle(a),ab=angle(b);
      if((aa<-90&&ab>90)||(ab<-90&&aa>90))return aa<-90?-1:1;
      return 0;
    });
    return selected.map(l=>l.name).join(' ');
  }
  function triangleCenter(triangle){
    const center=triangle.points.reduce((sum,p)=>add(sum,p),{x:0,y:0});
    center.x/=3;center.y/=3;
    return center;
  }
  function queryPieces(){return state.mode==='solo'?(state.secretPieces||[]):state.pieces;}
  function coordinateResultForTriangle(triangle){
    const center=triangleCenter(triangle);
    const colors=new Set();
    queryPieces().filter(piece=>piece.anchor).forEach(piece=>{
      const geometry=pieceGeometry(piece);
      if(pointInPolygon(center,geometry.poly,true))colors.add(geometry.definition.color);
    });
    if(!colors.size)return {empty:true,name:'Vide',hex:null,colors:[]};
    const result=resolveStreetColor(colors);
    return {empty:false,name:result.name,hex:result.hex,colors:[...colors]};
  }

  const freshPieces=()=>PIECES.map(def=>({id:def.id,anchor:null,rotation:0,flipped:false}));
  let state={mode:'gm',pieces:freshPieces(),secretPieces:[],selected:'blueSmall',tool:'pieces',waveModeActive:false,previewWave:null,started:false,traces:[],coords:[],draftCells:{},gridId:null,gridAlias:null,attempts:0,over:false,result:null,startedAt:null,rank:null};
  let wavePreference='auto';
  let streetAttempt=null;
  let streetSync=Promise.resolve();
  let selectedWaveEdge=null;
  let directionChoicesHideTimer=null;
  function resolvedWavePreference(){
    if(wavePreference!=='auto')return wavePreference;
    return window.matchMedia('(max-width: 640px)').matches?'choices':'arrows';
  }
  function clearDirectionChoicesTimer(){
    if(directionChoicesHideTimer){clearTimeout(directionChoicesHideTimer);directionChoicesHideTimer=null;}
  }
  function scheduleDirectionChoicesHide(edgeIndex){
    clearDirectionChoicesTimer();
    directionChoicesHideTimer=setTimeout(()=>{
      directionChoicesHideTimer=null;
      if(selectedWaveEdge===edgeIndex){selectedWaveEdge=null;render();}
    },2000);
  }

  function load(){
    try{
      const saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
      if(saved?.pieces?.length===PIECES.length)state={...state,...saved,traces:[],coords:[]};
    }catch(_error){}
  }
  function save(){
    try{localStorage.setItem(SAVE_KEY,JSON.stringify({...state,traces:[],coords:[]}));}catch(_error){}
  }
  function shuffled(items){
    const result=[...items];
    for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
    return result;
  }
  function randomizePieces(){
    const vertices=[...BOARD.vertices.values()].map(screenPoint);
    for(let boardAttempt=0;boardAttempt<180;boardAttempt++){
      const placed=[];
      const definitions=shuffled(PIECES);
      let failed=false;
      for(const definition of definitions){
        let accepted=null;
        for(let pieceAttempt=0;pieceAttempt<420;pieceAttempt++){
          const target=vertices[Math.floor(Math.random()*vertices.length)];
          const candidate={id:definition.id,anchor:{...target},rotation:Math.floor(Math.random()*6),flipped:Math.random()<.5};
          candidate.anchor=snapPieceAnchor(candidate,target);
          if(validatePieces([...placed,candidate],false).size===0){accepted=candidate;break;}
        }
        if(!accepted){failed=true;break;}
        placed.push(accepted);
      }
      if(!failed&&validatePieces(placed,true).size===0){
        const byPiece=new Map(placed.map(piece=>[piece.id,piece]));
        state.pieces=PIECES.map(definition=>byPiece.get(definition.id));
        state.selected=state.pieces[0].id;state.traces=[];state.coords=[];state.tool='pieces';
        return true;
      }
    }
    return false;
  }
  const STREET_VERTICES=[...BOARD.vertices.values()].map(screenPoint);
  function encodeStreetGrid(pieces){
    if(pieces.length!==PIECES.length||validatePieces(pieces,true).size)return null;
    const bytes=[];
    for(const definition of PIECES){
      const piece=pieces.find(item=>item.id===definition.id);if(!piece?.anchor)return null;
      const first=pieceGeometry(piece).poly[0];
      let index=0,distance=Infinity;
      STREET_VERTICES.forEach((point,i)=>{const value=Math.hypot(point.x-first.x,point.y-first.y);if(value<distance){distance=value;index=i;}});
      if(distance>.1||index>255)return null;
      bytes.push(index,(piece.rotation%6)|((piece.flipped?1:0)<<3));
    }
    bytes.push(bytes.reduce((value,byte)=>value^byte,0)^0x5a);
    const hex=bytes.map(byte=>byte.toString(16).padStart(2,'0')).join('').toUpperCase();
    return `ST1-${hex.match(/.{1,4}/g).join('-')}`;
  }
  function decodeStreetGrid(input){
    const clean=String(input||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(!clean.startsWith('ST1'))return null;
    const hex=clean.slice(3);if(hex.length!==PIECES.length*4+2||!/^[0-9A-F]+$/.test(hex))return null;
    const bytes=hex.match(/../g).map(value=>parseInt(value,16));
    const checksum=bytes.pop();if(((bytes.reduce((value,byte)=>value^byte,0)^0x5a)&255)!==checksum)return null;
    const pieces=[];
    for(let i=0;i<PIECES.length;i++){
      const vertex=STREET_VERTICES[bytes[i*2]],meta=bytes[i*2+1];if(!vertex||meta>13||(meta&7)>5)return null;
      const piece={id:PIECES[i].id,anchor:{...vertex},rotation:meta&7,flipped:!!(meta&8)};
      const definition=PIECES[i],first=definition.poly[0],relative=[first[0]-definition.pivot[0],first[1]-definition.pivot[1]];
      piece.anchor=sub(vertex,axialVectorToScreen(axialTransform(relative,piece.rotation,piece.flipped)));pieces.push(piece);
    }
    if(validatePieces(pieces,true).size)return null;
    return {variant:'street',pieces,id:encodeStreetGrid(pieces)};
  }
  function geometrySignature(piece){
    const geometry=pieceGeometry(piece),point=p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    const polygon=geometry.poly.map(point).sort().join('|');
    const walls=geometry.walls.map(wall=>wall.map(point).sort().join('>')).sort().join('|');
    return `${polygon}#${walls}`;
  }
  function guessIsCorrect(){
    return PIECES.every(definition=>{
      const guess=state.pieces.find(piece=>piece.id===definition.id),secret=state.secretPieces.find(piece=>piece.id===definition.id);
      return guess?.anchor&&secret?.anchor&&geometrySignature(guess)===geometrySignature(secret);
    });
  }
  function streetProgress(){return {pieces:state.pieces,traces:state.traces.map(trace=>({entryIndex:trace.entry.index,entryDirectionIndex:trace.entryDirectionIndex,exitIndex:trace.exit?.index??null,exitDirectionIndex:trace.exitDirectionIndex,points:trace.points,colors:trace.colors,color:trace.color,bounced:trace.bounced,loop:trace.loop,time:trace.time})),coords:state.coords,draftCells:state.draftCells,attempts:state.attempts,startedAt:state.startedAt};}
  function restoreStreetProgress(progress){
    if(!progress||typeof progress!=='object')return;
    if(Array.isArray(progress.pieces)&&progress.pieces.length===PIECES.length)state.pieces=progress.pieces;
    state.coords=Array.isArray(progress.coords)?progress.coords:[];state.draftCells=progress.draftCells&&typeof progress.draftCells==='object'?progress.draftCells:{};state.attempts=Math.max(0,Number(progress.attempts)||0);state.startedAt=Number(progress.startedAt)||Date.now();
    state.traces=(Array.isArray(progress.traces)?progress.traces:[]).map(item=>({...item,entry:BOARD.boundary[item.entryIndex],exit:item.exitIndex==null?null:BOARD.boundary[item.exitIndex]})).filter(item=>item.entry);
  }
  function recordStreetAction(kind){
    if(state.mode!=='solo'||state.over||!streetAttempt?.attempt_id||!currentPlayerAccount?.session_token)return;
    if(!state.startedAt)state.startedAt=Date.now();
    const payload={p_session_token:currentPlayerAccount.session_token,p_attempt_id:streetAttempt.attempt_id,p_action_id:crypto.randomUUID(),p_action_kind:kind,p_progress:streetProgress()};
    streetSync=streetSync.then(async()=>{const result=await supabaseRpc('orapa_record_active_attempt_action',payload);if(result?.attempt)streetAttempt=result.attempt;}).catch(error=>{console.warn('Synchronisation Street différée :',error);showErrorToast('Le coup est conservé à l’écran, mais sa synchronisation a échoué.');});
    return streetSync;
  }
  function pointsAttr(points){return points.map(p=>`${p.x},${p.y}`).join(' ');}
  function clipPolygonToHalfPlane(points,center,normal){
    const output=[];
    points.forEach((current,index)=>{
      const previous=points[(index+points.length-1)%points.length];
      const currentDistance=dot(sub(current,center),normal),previousDistance=dot(sub(previous,center),normal);
      const currentInside=currentDistance>=-EPS,previousInside=previousDistance>=-EPS;
      if(currentInside!==previousInside){
        const ratio=previousDistance/(previousDistance-currentDistance);
        output.push(add(previous,mul(sub(current,previous),ratio)));
      }
      if(currentInside)output.push(current);
    });
    return output;
  }
  function caseExitInfoPosition(edge,box,direction,otherDirection){
    const half=norm(sub(direction,otherDirection));
    const top=new Set(['5','6','7','8','9','10','11']);
    const bottom=new Set(['D','E','F','G','H','I','J']);
    const left=new Set(['1','2','3','4','A','B','C']);
    if(top.has(edge.label)){
      const onLeft=half.x<0;
      return {x:onLeft?box.left+3:box.right-3,y:box.bottom-4,anchor:onLeft?'start':'end'};
    }
    if(bottom.has(edge.label)){
      const onLeft=half.x<0;
      return {x:onLeft?box.left+3:box.right-3,y:box.top+4,anchor:onLeft?'start':'end'};
    }
    const onTop=half.y<0;
    if(left.has(edge.label))return {x:box.right-3,y:onTop?box.top+4:box.bottom-4,anchor:'end'};
    return {x:box.left+3,y:onTop?box.top+4:box.bottom-4,anchor:'start'};
  }
  function svgClientPoint(clientX,clientY,svg){
    const point=svg.createSVGPoint();point.x=clientX;point.y=clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }
  function snapPieceAnchor(piece,target){
    const definition=PIECES.find(item=>item.id===piece.id),first=definition.poly[0];
    const relative=[first[0]-definition.pivot[0],first[1]-definition.pivot[1]];
    const firstOffset=axialVectorToScreen(axialTransform(relative,piece.rotation,piece.flipped));
    let best=null,bestDistance=Infinity;
    BOARD.vertices.forEach(vertex=>{
      const point=screenPoint(vertex),candidate=sub(point,firstOffset),distance=Math.hypot(candidate.x-target.x,candidate.y-target.y);
      if(distance<bestDistance){best={x:candidate.x,y:candidate.y};bestDistance=distance;}
    });
    return best;
  }
  function piecePreview(piece){
    const geo=pieceGeometry({...piece,anchor:{x:0,y:0}}),wallPolygons=visualWallPolygonsFor(geo),all=[...geo.poly,...wallPolygons.flat()];
    const xs=all.map(p=>p.x),ys=all.map(p=>p.y),pad=9;
    const minX=Math.min(...xs)-pad,minY=Math.min(...ys)-pad,width=Math.max(...xs)-Math.min(...xs)+pad*2,height=Math.max(...ys)-Math.min(...ys)+pad*2;
    return `<svg viewBox="${minX} ${minY} ${width} ${height}" aria-hidden="true"><polygon points="${pointsAttr(geo.poly)}" fill="${COLORS[geo.definition.color]}"/>${wallPolygons.map(poly=>`<polygon points="${pointsAttr(poly)}" fill="${COLORS[geo.definition.color]}"/>`).join('')}</svg>`;
  }
  function createPieceGhost(piece){
    const geo=pieceGeometry({...piece,anchor:{x:0,y:0}}),wallPolygons=visualWallPolygonsFor(geo),ghost=svgEl('svg',{width:1,height:1,class:'street-drag-ghost','aria-hidden':'true'});
    ghost.appendChild(svgEl('polygon',{points:pointsAttr(geo.poly),fill:COLORS[geo.definition.color]}));
    wallPolygons.forEach(poly=>ghost.appendChild(svgEl('polygon',{points:pointsAttr(poly),fill:COLORS[geo.definition.color],class:'street-wall'})));
    document.body.appendChild(ghost);return ghost;
  }
  function attachPieceGesture(element,piece){
    element.addEventListener('touchstart',event=>event.preventDefault(),{passive:false});
    element.addEventListener('touchmove',event=>event.preventDefault(),{passive:false});
    element.addEventListener('pointerdown',event=>{
      if((state.started&&state.mode!=='solo')||state.over)return;
      if(state.mode==='solo'&&(state.tool==='hint'||state.tool==='draft'))return;
      event.preventDefault();event.stopPropagation();state.selected=piece.id;
      const startX=event.clientX,startY=event.clientY,pointerId=event.pointerId;
      try{element.setPointerCapture?.(pointerId);}catch(_error){}
      let moved=false,longPressed=false,ghost=null,ghostFrame=0,ghostX=startX,ghostY=startY,ghostScale=1;
      element.classList.add('gesture-active');
      const timer=setTimeout(()=>{
        if(moved)return;
        longPressed=true;
        if(!applyPieceMirror(piece))return;
        if(navigator.vibrate)navigator.vibrate(15);
        render();
      },480);
      const positionGhost=(x,y)=>{ghostX=x;ghostY=y;if(ghostFrame)return;ghostFrame=requestAnimationFrame(()=>{ghostFrame=0;if(ghost?.isConnected)ghost.style.transform=`translate3d(${ghostX}px,${ghostY}px,0) scale(${ghostScale})`;});};
      const startDrag=()=>{
        const matrix=byId('streetBoard')?.getScreenCTM();
        ghostScale=matrix?Math.hypot(matrix.a,matrix.b):1;
        ghost=createPieceGhost(piece);element.classList.add('dragging');positionGhost(startX,startY);
      };
      const cleanup=()=>{clearTimeout(timer);if(ghostFrame)cancelAnimationFrame(ghostFrame);element.classList.remove('gesture-active','dragging');try{if(element.hasPointerCapture?.(pointerId))element.releasePointerCapture(pointerId);}catch(_error){}window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);window.removeEventListener('pointercancel',onCancel);};
      const onMove=moveEvent=>{
        if(moveEvent.pointerId!==pointerId)return;
        if(moveEvent.cancelable)moveEvent.preventDefault();
        if(!moved&&Math.hypot(moveEvent.clientX-startX,moveEvent.clientY-startY)>9){moved=true;clearTimeout(timer);startDrag();}
        if(moved)positionGhost(moveEvent.clientX,moveEvent.clientY);
      };
      const onUp=upEvent=>{
        if(upEvent.pointerId!==pointerId)return;
        const wasMoved=moved;cleanup();
        if(wasMoved){
          const svg=byId('streetBoard'),local=svgClientPoint(upEvent.clientX,upEvent.clientY,svg);
          if(pointInPolygon(local,BOARD.polygon,true))piece.anchor=snapPieceAnchor(piece,local);
          else piece.anchor=null;
          ghost?.remove();
        }else if(!longPressed){piece.rotation=(piece.rotation+1)%6;if(piece.anchor&&piece.anchor.q===undefined)piece.anchor=snapPieceAnchor(piece,piece.anchor);}
        render();
      };
      const onCancel=cancelEvent=>{if(cancelEvent.pointerId!==pointerId)return;cleanup();ghost?.remove();};
      window.addEventListener('pointermove',onMove,{passive:false});window.addEventListener('pointerup',onUp,{passive:false});window.addEventListener('pointercancel',onCancel);
    });
  }
  function renderPalette(){
    const host=byId('streetPalette');host.innerHTML='';
    const pieces=state.pieces.filter(piece=>!piece.anchor);
    pieces.forEach(piece=>{
      const def=PIECES.find(d=>d.id===piece.id),tile=document.createElement('div');
      tile.className=`street-piece-card${state.selected===piece.id?' selected':''}`;
      tile.dataset.piece=piece.id;tile.setAttribute('role','button');tile.setAttribute('tabindex','0');tile.setAttribute('aria-label',def.name);tile.title=def.name;
      tile.innerHTML=piecePreview(piece);
      attachPieceGesture(tile,piece);host.appendChild(tile);
    });
    if(!pieces.length)host.innerHTML='<p class="street-palette-empty">Toutes les pièces sont placées sur la grille.</p>';
  }
  function renderBoard(){
    const svg=byId('streetBoard');svg.innerHTML='';
    const useDirectionChoices=resolvedWavePreference()==='choices';
    const previewTrace=state.mode==='solo'&&state.waveModeActive&&state.previewWave
      ?traceRay(state.previewWave.edgeIndex,state.previewWave.directionIndex,state.pieces)
      :null;
    const displayTraceAt=(edgeIndex,directionIndex)=>findTraceAt(edgeIndex,directionIndex);
    svg.classList.toggle('coordinate-mode',state.started);
    svg.classList.toggle('solo',state.mode==='solo');
    svg.classList.toggle('wave-choice-mode',useDirectionChoices);
    svg.classList.toggle('started',!!state.started);
    svg.classList.toggle('cell-tool-active',state.mode==='solo'&&(state.tool==='hint'||state.tool==='draft'));
    svg.classList.toggle('hint-mode',state.mode==='solo'&&state.tool==='hint');
    svg.classList.toggle('draft-mode',state.mode==='solo'&&state.tool==='draft');
    const margin=useDirectionChoices?31:43;
    svg.setAttribute('viewBox',`${-margin} ${-margin} ${BOARD.width+margin*2} ${BOARD.height+margin*2}`);
    const boardGroup=svgEl('g',{class:'street-grid'});
    BOARD.triangles.forEach(triangle=>{
      const key=String(triangle.id),draftEmpty=!!state.draftCells?.[key];
      const poly=svgEl('polygon',{points:pointsAttr(triangle.points),class:`street-cell${draftEmpty?' draft-empty':''}`,'data-cell':triangle.id});
      poly.addEventListener('click',async event=>{
        if(!state.started)return;
        if(useDirectionChoices&&selectedWaveEdge!==null)return;
        event.stopPropagation();
        if(state.mode==='solo'&&state.tool==='draft'){
          state.draftCells=state.draftCells&&typeof state.draftCells==='object'?state.draftCells:{};
          if(state.draftCells[key])delete state.draftCells[key];else state.draftCells[key]=true;
          render();return;
        }
        if(state.mode==='solo'&&state.tool!=='hint')return;
        if(state.coords.some(item=>item.triangle===triangle.id))return;
        const coord=coordinateForTriangle(triangle);
        if(state.mode==='solo'&&!await gameConfirm(`Révéler le contenu de la case ${coord} ?`,'Demander un indice','Révéler','Annuler'))return;
        const result=coordinateResultForTriangle(triangle);
        state.coords.push({triangle:triangle.id,text:coord,...result,time:new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})});
        if(state.mode==='solo')state.tool='pieces';
        render();void recordStreetAction('coord');
      });boardGroup.appendChild(poly);
    });
    svg.appendChild(boardGroup);
    const labelGroup=svgEl('g',{class:'street-labels'});
    BOARD.boundary.forEach((edge,edgeIndex)=>{
      const labelPos=add(edge.mid,mul(edge.outward,useDirectionChoices?19:31));
      if(useDirectionChoices){
        const box={left:labelPos.x-16,right:labelPos.x+16,top:labelPos.y-13,bottom:labelPos.y+13};
        const clipId=`street-label-clip-${edgeIndex}`;
        const clip=svgEl('clipPath',{id:clipId});clip.appendChild(svgEl('rect',{x:box.left,y:box.top,width:32,height:26,rx:6}));labelGroup.appendChild(clip);
        labelGroup.appendChild(svgEl('rect',{x:box.left,y:box.top,width:32,height:26,rx:6,class:'street-label-base'}));
        const rectangle=[{x:box.left,y:box.top},{x:box.right,y:box.top},{x:box.right,y:box.bottom},{x:box.left,y:box.bottom}];
        edge.directions.forEach((direction,directionIndex)=>{
          const usedTrace=displayTraceAt(edgeIndex,directionIndex);if(!usedTrace)return;
          const otherDirection=edge.directions[directionIndex===0?1:0];
          const half=clipPolygonToHalfPlane(rectangle,labelPos,sub(direction,otherDirection));
          labelGroup.appendChild(svgEl('polygon',{points:pointsAttr(half),class:`street-label-result${usedTrace.color.name==='Transparent'?' transparent':''}`,style:`--street-result:${usedTrace.color.hex}`,'clip-path':`url(#${clipId})`}));
          const exitInfo=traceExitInfo(usedTrace,edgeIndex,directionIndex);
          if(exitInfo){
            const infoPos=caseExitInfoPosition(edge,box,direction,otherDirection);
            const info=svgEl('text',{x:infoPos.x,y:infoPos.y,'text-anchor':infoPos.anchor,'dominant-baseline':'central',class:'street-label-exit-info'});info.textContent=exitInfo;labelGroup.appendChild(info);
          }
        });
        const hit=svgEl('rect',{x:box.left,y:box.top,width:32,height:26,rx:6,class:`street-label-hit${selectedWaveEdge===edgeIndex?' active':''}${state.started?'':' disabled'}`,'data-label-edge':edgeIndex});
        hit.addEventListener('click',event=>{event.stopPropagation();if(!state.started)return;clearDirectionChoicesTimer();selectedWaveEdge=selectedWaveEdge===edgeIndex?null:edgeIndex;render();});
        labelGroup.appendChild(hit);
      }
      const label=svgEl('text',{x:labelPos.x,y:labelPos.y,'text-anchor':'middle','dominant-baseline':'central',class:`street-label${useDirectionChoices?' clickable':''}${selectedWaveEdge===edgeIndex?' active':''}`});label.textContent=edge.label;labelGroup.appendChild(label);
      const tangent=norm(sub(edge.b,edge.a));
      if(useDirectionChoices&&state.started&&selectedWaveEdge===edgeIndex){
        edge.directions.forEach((direction,directionIndex)=>{
          const lane=emptyLane(edge,directionIndex),destination=lane?.labels?.find(value=>value!==edge.label)||'?';
          const center=add(edge.mid,mul(direction,48));
          const usedTrace=displayTraceAt(edgeIndex,directionIndex);
          const choice=svgEl('g',{class:`street-direction-choice-svg${usedTrace?' used':''}${usedTrace?.color?.name==='Transparent'?' transparent':''}`,'data-edge':edgeIndex,'data-direction':directionIndex});
          const box=svgEl('rect',{x:center.x-15,y:center.y-11,width:30,height:22,rx:5,style:usedTrace?`--street-result:${usedTrace.color.hex}`:''});
          const text=svgEl('text',{x:center.x,y:center.y,'text-anchor':'middle','dominant-baseline':'central'});text.textContent=`→ ${destination}`;
          choice.appendChild(box);choice.appendChild(text);
          choice.addEventListener('click',event=>{event.stopPropagation();if(state.mode==='solo'&&state.waveModeActive&&usedTrace)showPreviewWave(edgeIndex,directionIndex,usedTrace);else if(usedTrace)showStreetTraceFeedback(usedTrace,edgeIndex,directionIndex);else launchWave(edgeIndex,directionIndex);scheduleDirectionChoicesHide(edgeIndex);});
          labelGroup.appendChild(choice);
        });
      }
      if(!useDirectionChoices)edge.directions.forEach((direction,directionIndex)=>{
        const side=dot(direction,tangent)<0?-1:1;
        const pos=add(add(edge.mid,mul(edge.outward,10)),mul(tangent,side*10));
        const perpendicular={x:-direction.y,y:direction.x};
        const rearA=add(add(pos,mul(direction,-5)),mul(perpendicular,4.5));
        const rearB=add(add(pos,mul(direction,-5)),mul(perpendicular,-4.5));
        const arrow=[add(pos,mul(direction,7)),rearA,rearB];
        const usedTrace=displayTraceAt(edgeIndex,directionIndex);
        const button=svgEl('polygon',{points:pointsAttr(arrow),class:`street-ray-button${usedTrace?' used':''}${state.started?'':' disabled'}`,'data-edge':edgeIndex,'data-direction':directionIndex,style:usedTrace?`--street-result:${usedTrace.color.hex}`:''});
        button.addEventListener('click',event=>{event.stopPropagation();if(state.mode==='solo'&&state.waveModeActive&&usedTrace)showPreviewWave(edgeIndex,directionIndex,usedTrace);else if(usedTrace)showStreetTraceFeedback(usedTrace,edgeIndex,directionIndex);else launchWave(edgeIndex,directionIndex);});labelGroup.appendChild(button);
        const exitInfo=usedTrace&&traceExitInfo(usedTrace,edgeIndex,directionIndex);
        if(exitInfo){
          const leftSide=['1','2','3','4','A','B','C'].includes(edge.label);
          const rightSide=['12','13','14','N','M','L','K'].includes(edge.label);
          let rearOuter,extension,infoPos,anchor;
          if(leftSide){
            rearOuter=dot(sub(rearA,edge.mid),edge.outward)>dot(sub(rearB,edge.mid),edge.outward)?rearA:rearB;
            extension=norm(sub(rearOuter,pos));infoPos=add(rearOuter,mul(extension,5));
            infoPos.x=rearOuter.x-2;anchor='end';
          }else if(rightSide){
            rearOuter=dot(sub(rearA,edge.mid),edge.outward)>dot(sub(rearB,edge.mid),edge.outward)?rearA:rearB;
            extension=norm(sub(rearOuter,pos));infoPos=add(rearOuter,mul(extension,5));
            infoPos.x=rearOuter.x+2;anchor='start';
          }else{
            rearOuter=dot(sub(rearA,edge.mid),tangent)*side>dot(sub(rearB,edge.mid),tangent)*side?rearA:rearB;
            extension=norm(sub(rearOuter,pos));infoPos=add(rearOuter,mul(extension,5));
            anchor=Math.abs(extension.x)<.28?'middle':extension.x>0?'end':'start';
          }
          const info=svgEl('text',{x:infoPos.x,y:infoPos.y,'text-anchor':anchor,'dominant-baseline':'central',class:'street-ray-exit-info'});info.textContent=exitInfo;labelGroup.appendChild(info);
        }
      });
    });svg.appendChild(labelGroup);
    if(state.mode!=='solo')state.traces.forEach(trace=>{
      if(trace.points.length>1){
        const stroke=trace.color?.hex||STREET_TRANSPARENT.hex;
        svg.appendChild(svgEl('polyline',{points:pointsAttr(trace.points),class:'street-trace-halo',stroke}));
        svg.appendChild(svgEl('polyline',{points:pointsAttr(trace.points),class:'street-trace',stroke}));
      }
    });
    if(previewTrace?.points?.length>1){
      const stroke=previewTrace.color?.hex||STREET_TRANSPARENT.hex;
      svg.appendChild(svgEl('polyline',{points:pointsAttr(previewTrace.points),class:'street-trace-halo street-preview-trace',stroke}));
      svg.appendChild(svgEl('polyline',{points:pointsAttr(previewTrace.points),class:'street-trace street-preview-trace',stroke}));
    }
    const issues=validatePieces(state.pieces);
    state.pieces.filter(piece=>piece.anchor).forEach(piece=>{
      const geo=pieceGeometry(piece),group=svgEl('g',{class:`street-piece${state.selected===piece.id?' selected':''}${state.mode!=='solo'&&issues.has(piece.id)?' invalid':''}`,'data-piece':piece.id});
      const poly=svgEl('polygon',{points:pointsAttr(geo.poly),fill:COLORS[geo.definition.color]});group.appendChild(poly);
      visualWallPolygonsFor(geo).forEach(wall=>group.appendChild(svgEl('polygon',{points:pointsAttr(wall),fill:COLORS[geo.definition.color],class:'street-wall'})));
      attachPieceGesture(group,piece);svg.appendChild(group);
    });
    state.coords.forEach(item=>{
      const tri=BOARD.triangles.find(t=>t.id===item.triangle);if(!tri)return;
      const center=triangleCenter(tri);
      if(item.empty){
        const group=svgEl('g',{class:'street-coordinate-empty'}),radius=5.2;
        group.appendChild(svgEl('line',{x1:center.x-radius,y1:center.y-radius,x2:center.x+radius,y2:center.y+radius}));
        group.appendChild(svgEl('line',{x1:center.x+radius,y1:center.y-radius,x2:center.x-radius,y2:center.y+radius}));
        svg.appendChild(group);
      }else svg.appendChild(svgEl('circle',{cx:center.x,cy:center.y,r:5.5,fill:item.hex,class:'street-coordinate-color'}));
    });
    svg.appendChild(labelGroup);
  }
  function findTraceAt(edgeIndex,directionIndex){
    return state.traces.find(trace=>(trace.entry.index===edgeIndex&&trace.entryDirectionIndex===directionIndex)||(trace.exit?.index===edgeIndex&&trace.exitDirectionIndex===directionIndex));
  }
  function traceExitInfo(trace,edgeIndex,directionIndex){
    if(!trace?.exit)return '';
    const fromEntry=trace.entry.index===edgeIndex&&trace.entryDirectionIndex===directionIndex;
    const partner=fromEntry?trace.exit:trace.entry;
    const partnerDirection=fromEntry?trace.exitDirectionIndex:trace.entryDirectionIndex;
    return partner?`${partner.label}${historyDirectionArrow(partner,partnerDirection)}`:'';
  }
  function traceControl(edgeIndex,directionIndex){
    const board=byId('streetBoard');
    return board.querySelector(`[data-edge="${edgeIndex}"][data-direction="${directionIndex}"]`)||board.querySelector(`[data-label-edge="${edgeIndex}"]`);
  }
  function pulseStreetControl(edgeIndex,directionIndex){
    const control=traceControl(edgeIndex,directionIndex);if(!control)return;
    control.classList.remove('pulse');void control.getBoundingClientRect();control.classList.add('pulse');
    setTimeout(()=>control.classList.remove('pulse'),1000);
  }
  function showStreetBubble(element,text){
    if(!element)return;
    let bubble=byId('labelBubble');
    if(!bubble){bubble=document.createElement('div');bubble.id='labelBubble';bubble.className='label-bubble';document.body.appendChild(bubble);}
    bubble.textContent=text;bubble.style.whiteSpace='pre';bubble.classList.add('show');
    const rect=element.getBoundingClientRect(),width=bubble.offsetWidth,height=bubble.offsetHeight,margin=8;
    let left=rect.left+rect.width/2;left=Math.max(width/2+margin,Math.min(window.innerWidth-width/2-margin,left));
    const above=rect.top-height-10>=0;bubble.classList.toggle('below',!above);bubble.style.left=`${left}px`;bubble.style.top=`${above?rect.top:rect.bottom}px`;
    clearTimeout(showStreetBubble._timer);showStreetBubble._timer=setTimeout(()=>bubble.classList.remove('show'),1600);
  }
  function showStreetTraceFeedback(trace,edgeIndex,directionIndex){
    const origin=trace.entry.index===edgeIndex&&trace.entryDirectionIndex===directionIndex;
    const partner=origin?trace.exit:trace.entry;
    const partnerDirection=origin?trace.exitDirectionIndex:trace.entryDirectionIndex;
    let text;
    if(!trace.exit)text=trace.loop?'Onde prisonnière':'Aucune sortie';
    else if(trace.exit.index===trace.entry.index)text=`${trace.entry.label} ↔\n${trace.color.name}`;
    else text=`Sort en ${partner.label} ${historyDirectionArrow(partner,partnerDirection)}\n${trace.color.name}`;
    const control=traceControl(edgeIndex,directionIndex);showStreetBubble(control,text);pulseStreetControl(edgeIndex,directionIndex);
    if(partner)pulseStreetControl(partner.index,partnerDirection);
  }
  function showPreviewWave(edgeIndex,directionIndex,realTrace=null){
    if(!state.started||state.mode!=='solo'||!state.waveModeActive)return;
    state.previewWave={edgeIndex,directionIndex};
    render();
    if(realTrace)setTimeout(()=>showStreetTraceFeedback(realTrace,edgeIndex,directionIndex),0);
  }
  function launchWave(edgeIndex,directionIndex){
    if(!state.started)return;
    const usedTrace=findTraceAt(edgeIndex,directionIndex);
    if(usedTrace)return showStreetTraceFeedback(usedTrace,edgeIndex,directionIndex);
    if(state.mode!=='solo'&&validatePieces(state.pieces).size)return setMessage('Corrige les placements rouges avant de lancer une onde.',true);
    const trace=traceRay(edgeIndex,directionIndex,queryPieces());
    trace.time=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    state.traces.push(trace);
    if(state.mode==='solo'&&state.waveModeActive)state.previewWave={edgeIndex,directionIndex};
    render();void recordStreetAction('ray');setTimeout(()=>showStreetTraceFeedback(trace,edgeIndex,directionIndex),0);
  }
  function historyDirectionArrow(edge,directionIndex){
    const direction=edge?.directions?.[directionIndex];if(!direction)return '';
    const angle=Math.atan2(direction.y,direction.x)*180/Math.PI;
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" transform="rotate(${angle} 8 8)"/></svg>`;
  }
  function historyEndpoint(edge,directionIndex){
    return `<b>${edge.label} <span class="street-history-arrow">${historyDirectionArrow(edge,directionIndex)}</span></b>`;
  }
  function renderHistory(){
    const host=byId('streetHistory'),items=[];
    state.coords.slice().reverse().forEach(item=>{
      const marker=`<span class="street-history-swatch" style="--street-result:${item.empty?'#6b6355':item.hex}"></span>`;
      items.push(`<li class="street-history-item">${marker}<span><b>${item.text}</b> — ${item.name}</span>${item.time?`<span class="street-history-time">${item.time}</span>`:''}</li>`);
    });
    state.traces.slice().reverse().forEach(trace=>{
      const color=trace.color||resolveStreetColor(new Set(trace.colors||[]));
      const entry=historyEndpoint(trace.entry,trace.entryDirectionIndex);
      const exit=trace.exit?historyEndpoint(trace.exit,trace.exitDirectionIndex):'';
      const result=trace.loop?`${entry} — Prisonnière`:(!trace.exit?`${entry} — Sans sortie`:(trace.exit.index===trace.entry.index?`${entry} ↔ ${exit}`:`${entry} — ${exit}`));
      const special=color.name==='Transparent'?' transparent':'';
      items.push(`<li class="street-history-item"><span class="street-history-swatch${special}" style="--street-result:${color.hex}"></span><span>${result} — ${color.name}</span>${trace.time?`<span class="street-history-time">${trace.time}</span>`:''}</li>`);
    });
    host.innerHTML=items.length?items.join(''):'<li class="empty">Aucun coup joué.</li>';
    byId('streetHistoryMoveCount').textContent=`${state.traces.length}🔦 / ${state.coords.length}📍`;
  }
  function toggleHistory(forceOpen){
    const disclosure=byId('streetHistoryDisclosure');
    const open=forceOpen===undefined?disclosure.classList.contains('collapsed'):!!forceOpen;
    disclosure.classList.toggle('collapsed',!open);
    byId('streetHistoryToggle').setAttribute('aria-expanded',String(open));
    byId('streetHistoryToggleIndicator').textContent=open?'−':'+';
  }
  function setMessage(text,error=false){const el=byId('streetStartBlockMsg');el.textContent=text;el.style.color=error?'#f5b8ae':'var(--text-faint)';}
  function elapsedMs(){return Math.max(0,Date.now()-(state.startedAt||Date.now()));}
  function streetSummary(success=state.result==='win'){
    const name=currentPlayerAccount?.display_name||'Anonyme',cost=state.traces.length+state.coords.length*3,date=new Date().toLocaleDateString('fr-FR');
    return `Orapa Street · ${date}\n${name} - ${success?'🏅':'😞'} - ${cost} pts (${state.traces.length}🔦/${state.coords.length}📍) - ID: ${publicGridId(state.gridId)}\nhttps://argone57.github.io/Orapa-Mine/`;
  }
  function ensureStreetModal(){
    let backdrop=byId('streetResultModal');if(backdrop)return backdrop;
    backdrop=document.createElement('div');backdrop.id='streetResultModal';backdrop.className='modal-backdrop';
    backdrop.innerHTML='<div class="modal"><button class="close-x" id="streetResultClose">×</button><h2 id="streetResultTitle"></h2><p id="streetResultMessage"></p><p id="streetResultScore"></p><p id="streetResultRank" class="rank-line"></p><p>Grille : <b id="streetResultId"></b></p><div id="streetResultActions" class="controls victory-actions" data-orapa-myludo-result="false"><button class="primary" id="streetResultRanking">🏆 Classement</button><button class="ghost" id="streetResultCopy">📋 Copier résumé</button><button class="ghost" id="streetResultHome">← Accueil</button></div></div>';
    document.body.appendChild(backdrop);
    byId('streetResultClose').onclick=()=>backdrop.classList.remove('open');
    byId('streetResultHome').onclick=()=>{backdrop.classList.remove('open');close(true);};
    byId('streetResultCopy').onclick=()=>navigator.clipboard?.writeText(streetSummary()).then(()=>showToast('Résumé copié !'));
    byId('streetResultRanking').onclick=()=>openStreetRanking(state.gridId);
    return backdrop;
  }
  async function openStreetRanking(gridId){
    return openGridRanking(gridId,false,false);
  }
  function openStreetRowsModal(title,rows,empty='Aucune partie enregistrée.'){
    let modal=byId('streetRowsModal');if(!modal){modal=document.createElement('div');modal.id='streetRowsModal';modal.className='modal-backdrop';document.body.appendChild(modal);}
    modal.innerHTML=`<div class="modal"><button class="close-x" id="streetRowsClose">×</button><h2>${title}</h2><div class="ranking-list">${rows.length?rows.map((row,index)=>`<button class="ranking-row street-row-open" data-index="${index}" style="width:100%;text-align:left"><span>${row.player_name?escapeHtml(row.player_name):`<b>${escapeHtml(publicGridId(row.grid_id))}</b>`}</span><span>${row.success===undefined?`${row.participation_count||0} 👥`:`${row.success?'✅':'❌'} ${row.cost} pts · ${formatDuration(row.time_ms)}`}</span></button>`).join(''):`<div class="history-empty">${empty}</div>`}</div></div>`;
    byId('streetRowsClose').onclick=()=>modal.classList.remove('open');
    modal.querySelectorAll('.street-row-open').forEach(button=>button.onclick=()=>{const row=rows[Number(button.dataset.index)];if(row.grid_id)openStreetRanking(row.grid_id);});
    modal.classList.add('open');
  }
  async function openStreetGlobalHistory(){selectGridHistoryMode('street');byId('rankingsModal')?.classList.add('open');}
  async function openStreetCatalog(){try{const rows=await supabaseRpc('orapa_street_grid_catalog',{p_sort:'popular',p_limit:100,p_offset:0,p_session_token:currentPlayerAccount?.session_token||''});openStreetRowsModal('🏠 Grilles Orapa Street',rows||[],'Aucune grille Street partagée.');}catch(error){showErrorToast(error.message);}}
  async function openMyStreetHistory(){return openMyStreetGridHistory();}
  async function openMySharedStreet(){try{const rows=await supabaseRpc('orapa_my_shared_street_grids',{p_session_token:currentPlayerAccount.session_token,p_limit:100,p_offset:0});openStreetRowsModal('🏠 Mes grilles Street partagées',rows||[],'Aucune grille Street partagée.');}catch(error){showErrorToast(error.message);}}
  async function finishStreetAttempt(success){
    state.over=true;state.result=success?'win':'lose';
    if(!success)state.pieces=state.secretPieces.map(piece=>({...piece,anchor:{...piece.anchor}}));
    const cost=state.traces.length+state.coords.length*3,time=elapsedMs();
    let submitted=null;
    const closingAttempt=streetAttempt;
    try{
      submitted=await supabaseRpc('orapa_submit_street_grid_score',{p_grid_id:state.gridId,p_session_token:currentPlayerAccount.session_token,p_success:success,p_cost:cost,p_ray_count:state.traces.length,p_coord_count:state.coords.length,p_time_ms:time,p_first_try:success&&state.attempts===0});
      if(activeAttempt?.attempt_id===closingAttempt?.attempt_id)activeAttempt=null;
      streetAttempt=null;state.rank=Number(submitted?.rank)||null;
    }catch(error){showErrorToast(`Enregistrement Street impossible : ${error.message}`);}
    render();
    const modal=ensureStreetModal();
    byId('streetResultTitle').textContent=success?'🏆 Victoire !':'💥 Défaite';
    byId('streetResultMessage').textContent=success?'Tu as retrouvé la disposition exacte des sept pièces !':'La seconde proposition est incorrecte : la grille secrète est révélée.';
    byId('streetResultScore').textContent=`${cost} pts (${state.traces.length}🔦 + ${state.coords.length}📍) · ${formatDuration(time)}`;
    byId('streetResultRank').textContent=state.rank?`Classé #${state.rank} dans le classement de cette grille`:'';
    byId('streetResultId').textContent=publicGridId(state.gridId);
    byId('streetResultActions').dataset.orapaMyludoResult=submitted?.accepted===false?'false':'true';
    modal.classList.add('open');
  }
  async function proposeStreetSolution(){
    if(state.mode!=='solo'||state.over||state.pieces.some(piece=>!piece.anchor)||validatePieces(state.pieces,true).size)return;
    try{
      const current=await supabaseRpc('orapa_get_active_attempt',{p_session_token:currentPlayerAccount.session_token});
      if(!current||current.game_kind!=='street'||current.reference!==state.gridId){showErrorToast('Cette tentative Street n’est plus active. Elle a peut-être été terminée sur un autre appareil.');return;}
      streetAttempt=current;
    }catch(error){showErrorToast('Impossible de vérifier la tentative avant la proposition.');return;}
    if(guessIsCorrect()){await recordStreetAction('proposal');await finishStreetAttempt(true);return;}
    state.attempts++;
    await recordStreetAction('proposal');
    if(state.attempts>=2){await finishStreetAttempt(false);return;}
    render();showErrorToast('Solution incorrecte. Il te reste une proposition.');
  }
  async function loadStreetPreference(){
    if(!currentPlayerAccount?.session_token)return;
    try{const value=await supabaseRpc('orapa_get_street_preferences',{p_session_token:currentPlayerAccount.session_token});if(['auto','arrows','choices'].includes(value?.wave_controls))wavePreference=value.wave_controls;}catch(error){console.warn('Préférence Street indisponible',error);}
  }
  async function shareStreet(){
    const id=encodeStreetGrid(state.pieces);if(!id)return;
    try{await supabaseRpc('orapa_share_street_grid',{p_grid_id:id,p_session_token:currentPlayerAccount.session_token});state.gridId=id;state.gridAlias=await ensureGridAlias(id,'street');await navigator.clipboard?.writeText(gridChallengeText(id));showToast('Grille Street partagée et identifiant copié !');}
    catch(error){showErrorToast(`Partage impossible : ${error.message}`);}
  }
  function render(){
    renderPalette();renderBoard();renderHistory();
    const issues=validatePieces(state.pieces),placed=state.pieces.filter(p=>p.anchor).length;
    const complete=placed===PIECES.length&&!issues.size;
    const preStart=!state.started;
    const showPalette=preStart||(state.mode==='solo'&&!state.over);
    byId('streetRandom').hidden=!preStart;
    byId('streetShare').hidden=!preStart;
    byId('streetStart').hidden=!preStart;
    byId('streetEnd').hidden=preStart||state.over||state.mode!=='solo';
    byId('streetEnd').textContent=state.attempts?'Proposer une seconde solution':'Proposer une solution';
    byId('streetEnd').disabled=state.mode==='solo'&&!complete;
    byId('streetStart').disabled=!complete;
    byId('streetShare').disabled=!complete;
    byId('streetPaletteTitle').style.display=showPalette?'flex':'none';
    byId('streetPalette').style.display=showPalette?'flex':'none';
    byId('streetSetupHint').style.display=showPalette?'block':'none';
    byId('streetStartBlockMsg').style.display=preStart?'block':'none';
    byId('streetWaveSetting').hidden=true;
    byId('streetWavePreference').value=wavePreference;
    const showCellTools=state.mode==='solo'&&state.started&&!state.over;
    byId('streetCellTools').hidden=!showCellTools;
    byId('streetHint').classList.toggle('active',showCellTools&&state.tool==='hint');
    byId('streetHint').textContent=state.tool==='hint'?'🔍 Mode indice activé':'🔍 Demander un indice';
    byId('streetDraft').classList.toggle('active',showCellTools&&state.tool==='draft');
    byId('streetDraft').textContent=state.tool==='draft'?'◻️ Masquage activé':'◻️ Masquer les cases';
    byId('streetShowWave').classList.toggle('active',showCellTools&&state.waveModeActive);
    byId('streetShowWave').textContent=state.waveModeActive?'〽️ Mode onde activé':'〽️ Afficher une onde';
    const pill=byId('streetPrototype').querySelector('.mode-pill');
    pill.classList.toggle('live',state.started);
    pill.querySelector('span:last-child').textContent=state.over?(state.result==='win'?'Victoire':'Défaite'):(state.started?(state.mode==='solo'?'Partie en cours':'Test de la grille'):'Placement des pièces');
    if(preStart){clearDirectionChoicesTimer();selectedWaveEdge=null;}
    if(state.started)setMessage('',false);
    else if(issues.size)setMessage([...new Set(issues.values())][0],true);
    else if(placed<PIECES.length)setMessage('Place toutes les pièces avant de démarrer.',true);
    else setMessage('');
    if(state.mode==='gm')save();
  }
  function bind(){
    const create=byId('createStreetMode');
    if(!create)return;
    create.addEventListener('click',()=>openCreation());
    byId('streetClose').addEventListener('click',()=>close());
    byId('streetRandom').addEventListener('click',()=>{if(state.started)return;if(!randomizePieces())setMessage('Impossible de trouver un placement valide. Réessaie.',true);render();});
    byId('streetStart').addEventListener('click',()=>{if(state.started||byId('streetStart').disabled)return;state.started=true;state.startedAt=Date.now();state.tool='pieces';state.traces=[];state.coords=[];clearDirectionChoicesTimer();selectedWaveEdge=null;toggleHistory(false);render();});
    byId('streetEnd').addEventListener('click',()=>void proposeStreetSolution());
    byId('streetShare').addEventListener('click',()=>void shareStreet());
    byId('streetReset').addEventListener('click',async()=>{
      if(!confirm(state.mode==='solo'?'Abandonner cette partie et recommencer ?':'Effacer tous les placements et l’historique Street ?'))return;
      if(state.mode==='solo'&&streetAttempt?.attempt_id)try{const abandonedAttempt=streetAttempt;await supabaseRpc('orapa_abandon_street_attempt',{p_session_token:currentPlayerAccount.session_token,p_attempt_id:abandonedAttempt.attempt_id});if(activeAttempt?.attempt_id===abandonedAttempt.attempt_id)activeAttempt=null;streetAttempt=null;}catch(error){showErrorToast('Abandon impossible : '+error.message);return;}
      if(state.mode==='solo'){await openSolo();return;}
      state={mode:'gm',pieces:freshPieces(),secretPieces:[],selected:'blueSmall',tool:'pieces',waveModeActive:false,previewWave:null,started:false,traces:[],coords:[],draftCells:{},gridId:null,gridAlias:null,attempts:0,over:false,result:null,startedAt:null,rank:null};clearDirectionChoicesTimer();selectedWaveEdge=null;localStorage.removeItem(SAVE_KEY);render();
    });
    byId('streetHistoryToggle').addEventListener('click',()=>toggleHistory());
    byId('streetHint').addEventListener('click',()=>{state.tool=state.tool==='hint'?'pieces':'hint';clearDirectionChoicesTimer();selectedWaveEdge=null;render();});
    byId('streetDraft').addEventListener('click',()=>{state.tool=state.tool==='draft'?'pieces':'draft';clearDirectionChoicesTimer();selectedWaveEdge=null;render();});
    byId('streetShowWave').addEventListener('click',()=>{state.waveModeActive=!state.waveModeActive;if(!state.waveModeActive)state.previewWave=null;clearDirectionChoicesTimer();selectedWaveEdge=null;render();});
    byId('streetWavePreference').addEventListener('change',event=>{
      wavePreference=event.target.value;clearDirectionChoicesTimer();selectedWaveEdge=null;render();
      if(currentPlayerAccount?.session_token)void supabaseRpc('orapa_set_street_preferences',{p_session_token:currentPlayerAccount.session_token,p_wave_controls:wavePreference}).then(()=>showToast('Préférence Street enregistrée')).catch(error=>showErrorToast('Enregistrement impossible : '+error.message));
    });
    const narrowScreen=window.matchMedia('(max-width: 640px)');
    const refreshAutomaticControls=()=>{if(wavePreference==='auto'&&!byId('streetPrototype').hidden){clearDirectionChoicesTimer();selectedWaveEdge=null;render();}};
    if(narrowScreen.addEventListener)narrowScreen.addEventListener('change',refreshAutomaticControls);else narrowScreen.addListener(refreshAutomaticControls);
  }
  async function openCreation(){
    if(!currentPlayerAccount){byId('createModeModal')?.classList.remove('open');openAccountModal();return;}
    byId('createModeModal')?.classList.remove('open');
    await loadStreetPreference();
    state={mode:'gm',pieces:freshPieces(),secretPieces:[],selected:'blueSmall',tool:'pieces',waveModeActive:false,previewWave:null,started:false,traces:[],coords:[],draftCells:{},gridId:null,gridAlias:null,attempts:0,over:false,result:null,startedAt:null,rank:null};load();
    byId('streetPrototype').querySelector('.subtitle').textContent='Console du maître du jeu';
    byId('streetPrototype').hidden=false;document.body.classList.add('street-open');document.body.classList.remove('home-view');toggleHistory(false);render();
  }
  async function openSolo(gridId=null,resumeAttempt=null){
    if(!currentPlayerAccount?.session_token){closeSoloChoiceModal?.();openAccountModal();return false;}
    await loadStreetPreference();
    let decoded=gridId?decodeStreetGrid(gridId):null;
    if(gridId&&!decoded){showErrorToast('Identifiant Street invalide.');return false;}
    if(!decoded){const pieces=freshPieces();state.pieces=pieces;if(!randomizePieces()){showErrorToast('Impossible de générer une grille Street.');return false;}decoded={variant:'street',pieces:state.pieces.map(piece=>({...piece,anchor:{...piece.anchor}}))};decoded.id=encodeStreetGrid(decoded.pieces);}
    if(gridId&&!resumeAttempt){
      const status=await supabaseRpc('orapa_get_street_grid_status',{p_grid_id:decoded.id,p_session_token:currentPlayerAccount.session_token}).catch(()=>null);
      if(status?.is_creator){showErrorToast('Cette grille Street est la tienne et ne peut pas être résolue avec ce compte.');return false;}
      if(status?.already_played){showErrorToast('Cette grille Street a déjà été jouée avec ce compte.');return false;}
    }
    const gridAlias=await ensureGridAlias(decoded.id,'street');
    const target={kind:'street',reference:decoded.id,context:{},progress:{}};
    const start=resumeAttempt?{ok:true,attempt:resumeAttempt,resumed:true}:await prepareNewActiveAttempt(target,true);
    if(!start?.ok){if(start?.reason==='already_played')showErrorToast('Cette grille Street a déjà été jouée avec ce compte.');else if(start?.resume&&start.attempt)await resumeServerAttempt(start.attempt);return false;}
    streetAttempt=start.attempt;
    state={mode:'solo',pieces:freshPieces(),secretPieces:decoded.pieces.map(piece=>({...piece,anchor:{...piece.anchor}})),selected:'blueSmall',tool:'pieces',waveModeActive:false,previewWave:null,started:true,traces:[],coords:[],draftCells:{},gridId:decoded.id,gridAlias,attempts:0,over:false,result:null,startedAt:null,rank:null};
    if(start.resumed)restoreStreetProgress(start.attempt?.progress);
    byId('soloChoiceModal')?.classList.remove('open');document.body.classList.remove('solo-menu-open');
    byId('streetPrototype').querySelector('.subtitle').textContent='Grille classique';
    byId('streetPrototype').hidden=false;document.body.classList.add('street-open');document.body.classList.remove('home-view');toggleHistory(false);render();return true;
  }
  function close(force=false){
    if(state.mode==='solo'&&!state.over&&!force){showToast('La partie Street reste en cours sur ce compte.');}
    clearDirectionChoicesTimer();selectedWaveEdge=null;byId('streetPrototype').hidden=true;document.body.classList.remove('street-open');document.body.classList.add('home-view');
  }

  document.addEventListener('orapa:myludo-request',async()=>{
    if(state.mode!=='solo'||!state.over)return;
    let preferences={player_mode:'default',custom_player_name:'',fill_score:false,location_mode:'default',custom_location:'',exclude_from_statistics:false,auto_submit:false,duplicate_detection:true};
    try{preferences=await loadMyludoPreferences();}catch(_error){}
    const payload={schemaVersion:1,source:'orapa-mine',gameId:101482,gameVariant:'street',isDaily:false,dedupeReference:state.gridId,solo:true,online:true,win:state.result==='win',playerName:preferences.player_mode==='custom'?preferences.custom_player_name:'',resultPlayerName:currentPlayerAccount?.display_name||'',score:preferences.fill_score?(state.traces.length+state.coords.length*3):null,date:new Date().toISOString().slice(0,10),durationMinutes:Math.max(1,Math.round(elapsedMs()/60000)),location:preferences.location_mode==='custom'?preferences.custom_location:'Orapa-Mine',excludeFromStatistics:!!preferences.exclude_from_statistics,autoSubmit:!!preferences.auto_submit,duplicateDetection:preferences.duplicate_detection!==false,comment:streetSummary(),options:{}};
    document.dispatchEvent(new CustomEvent('orapa:myludo-result',{detail:JSON.stringify(payload)}));
  });
  window.OrapaStreetPrototype={open:openCreation,openCreation,openSolo,resume:attempt=>openSolo(attempt.reference,attempt),close,decode:decodeStreetGrid,encode:encodeStreetGrid,openRanking:openStreetRanking,openGlobalHistory:openStreetGlobalHistory,openCatalog:openStreetCatalog,openMyHistory:openMyStreetHistory,openMyShared:openMySharedStreet,debug:{BOARD,LANES,PIECES,axialTransform,applyPieceMirror,pieceGeometry,visualWallsFor,visualWallPolygonsFor,snapPieceAnchor,coordinateForTriangle,traceRay,validatePieces}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
