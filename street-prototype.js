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
  const SAVE_KEY='orapa_street_prototype_v2';
  const WAVE_PREFERENCE_KEY='orapa_street_wave_preference_v1';
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
  function coordinateResultForTriangle(triangle){
    const center=triangleCenter(triangle);
    const colors=new Set();
    state.pieces.filter(piece=>piece.anchor).forEach(piece=>{
      const geometry=pieceGeometry(piece);
      if(pointInPolygon(center,geometry.poly,true))colors.add(geometry.definition.color);
    });
    if(!colors.size)return {empty:true,name:'Vide',hex:null,colors:[]};
    const result=resolveStreetColor(colors);
    return {empty:false,name:result.name,hex:result.hex,colors:[...colors]};
  }

  let state={pieces:PIECES.map(def=>({id:def.id,anchor:null,rotation:0,flipped:false})),selected:'blueSmall',tool:'pieces',started:false,traces:[],coords:[]};
  let wavePreference='auto';
  let selectedWaveEdge=null;
  let directionChoicesHideTimer=null;
  try{
    const savedPreference=localStorage.getItem(WAVE_PREFERENCE_KEY);
    if(['auto','arrows','choices'].includes(savedPreference))wavePreference=savedPreference;
  }catch(_error){}

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
      if(state.started)return;
      event.preventDefault();event.stopPropagation();state.selected=piece.id;
      const startX=event.clientX,startY=event.clientY,pointerId=event.pointerId;
      try{element.setPointerCapture?.(pointerId);}catch(_error){}
      let moved=false,longPressed=false,ghost=null,ghostFrame=0,ghostX=startX,ghostY=startY;
      element.classList.add('gesture-active');
      const timer=setTimeout(()=>{
        if(moved)return;
        longPressed=true;piece.flipped=!piece.flipped;
        if(piece.anchor&&piece.anchor.q===undefined)piece.anchor=snapPieceAnchor(piece,piece.anchor);
        if(navigator.vibrate)navigator.vibrate(15);
        render();
      },480);
      const positionGhost=(x,y)=>{ghostX=x;ghostY=y;if(ghostFrame)return;ghostFrame=requestAnimationFrame(()=>{ghostFrame=0;if(ghost?.isConnected)ghost.style.transform=`translate3d(${ghostX}px,${ghostY}px,0)`;});};
      const startDrag=()=>{ghost=createPieceGhost(piece);element.classList.add('dragging');positionGhost(startX,startY);};
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
    svg.classList.toggle('coordinate-mode',state.started);
    svg.classList.toggle('wave-choice-mode',useDirectionChoices);
    svg.classList.toggle('started',!!state.started);
    const margin=useDirectionChoices?31:39;
    svg.setAttribute('viewBox',`${-margin} ${-margin} ${BOARD.width+margin*2} ${BOARD.height+margin*2}`);
    const boardGroup=svgEl('g',{class:'street-grid'});
    BOARD.triangles.forEach(triangle=>{
      const poly=svgEl('polygon',{points:pointsAttr(triangle.points),class:'street-cell','data-cell':triangle.id});
      poly.addEventListener('click',event=>{
        if(!state.started)return;
        if(useDirectionChoices&&selectedWaveEdge!==null)return;
        event.stopPropagation();
        if(state.coords.some(item=>item.triangle===triangle.id))return;
        const coord=coordinateForTriangle(triangle),result=coordinateResultForTriangle(triangle);
        state.coords.push({triangle:triangle.id,text:coord,...result,time:new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})});render();
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
          const usedTrace=findTraceAt(edgeIndex,directionIndex);if(!usedTrace)return;
          const otherDirection=edge.directions[directionIndex===0?1:0];
          const half=clipPolygonToHalfPlane(rectangle,labelPos,sub(direction,otherDirection));
          labelGroup.appendChild(svgEl('polygon',{points:pointsAttr(half),class:`street-label-result${usedTrace.color.name==='Transparent'?' transparent':''}`,style:`--street-result:${usedTrace.color.hex}`,'clip-path':`url(#${clipId})`}));
        });
        const hit=svgEl('rect',{x:box.left,y:box.top,width:32,height:26,rx:6,class:`street-label-hit${selectedWaveEdge===edgeIndex?' active':''}${state.started?'':' disabled'}`});
        hit.addEventListener('click',event=>{event.stopPropagation();if(!state.started)return;clearDirectionChoicesTimer();selectedWaveEdge=selectedWaveEdge===edgeIndex?null:edgeIndex;render();});
        labelGroup.appendChild(hit);
      }
      const label=svgEl('text',{x:labelPos.x,y:labelPos.y,'text-anchor':'middle','dominant-baseline':'central',class:`street-label${useDirectionChoices?' clickable':''}${selectedWaveEdge===edgeIndex?' active':''}`});label.textContent=edge.label;labelGroup.appendChild(label);
      const tangent=norm(sub(edge.b,edge.a));
      if(useDirectionChoices&&state.started&&selectedWaveEdge===edgeIndex){
        edge.directions.forEach((direction,directionIndex)=>{
          const lane=emptyLane(edge,directionIndex),destination=lane?.labels?.find(value=>value!==edge.label)||'?';
          const center=add(edge.mid,mul(direction,48));
          const usedTrace=findTraceAt(edgeIndex,directionIndex);
          const choice=svgEl('g',{class:`street-direction-choice-svg${usedTrace?' used':''}${usedTrace?.color?.name==='Transparent'?' transparent':''}`,'data-edge':edgeIndex,'data-direction':directionIndex});
          const box=svgEl('rect',{x:center.x-15,y:center.y-11,width:30,height:22,rx:5,style:usedTrace?`--street-result:${usedTrace.color.hex}`:''});
          const text=svgEl('text',{x:center.x,y:center.y,'text-anchor':'middle','dominant-baseline':'central'});text.textContent=`→ ${destination}`;
          choice.appendChild(box);choice.appendChild(text);
          choice.addEventListener('click',event=>{event.stopPropagation();if(usedTrace)showStreetTraceFeedback(usedTrace,edgeIndex,directionIndex);else launchWave(edgeIndex,directionIndex);scheduleDirectionChoicesHide(edgeIndex);});
          labelGroup.appendChild(choice);
        });
      }
      if(!useDirectionChoices)edge.directions.forEach((direction,directionIndex)=>{
        const side=dot(direction,tangent)<0?-1:1;
        const pos=add(add(edge.mid,mul(edge.outward,10)),mul(tangent,side*10));
        const perpendicular={x:-direction.y,y:direction.x};
        const arrow=[add(pos,mul(direction,7)),add(add(pos,mul(direction,-5)),mul(perpendicular,4.5)),add(add(pos,mul(direction,-5)),mul(perpendicular,-4.5))];
        const usedTrace=findTraceAt(edgeIndex,directionIndex);
        const button=svgEl('polygon',{points:pointsAttr(arrow),class:`street-ray-button${usedTrace?' used':''}${state.started?'':' disabled'}`,'data-edge':edgeIndex,'data-direction':directionIndex,style:usedTrace?`--street-result:${usedTrace.color.hex}`:''});
        button.addEventListener('click',event=>{event.stopPropagation();if(usedTrace)showStreetTraceFeedback(usedTrace,edgeIndex,directionIndex);else launchWave(edgeIndex,directionIndex);});labelGroup.appendChild(button);
      });
    });svg.appendChild(labelGroup);
    state.traces.forEach((trace,index)=>{
      if(trace.points.length>1){
        const stroke=trace.color?.hex||STREET_TRANSPARENT.hex;
        svg.appendChild(svgEl('polyline',{points:pointsAttr(trace.points),class:'street-trace-halo',stroke}));
        svg.appendChild(svgEl('polyline',{points:pointsAttr(trace.points),class:'street-trace',stroke}));
      }
    });
    const issues=validatePieces(state.pieces);
    state.pieces.filter(piece=>piece.anchor).forEach(piece=>{
      const geo=pieceGeometry(piece),group=svgEl('g',{class:`street-piece${state.selected===piece.id?' selected':''}${issues.has(piece.id)?' invalid':''}`,'data-piece':piece.id});
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
  function traceControl(edgeIndex,directionIndex){
    return byId('streetBoard').querySelector(`[data-edge="${edgeIndex}"][data-direction="${directionIndex}"]`);
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
    let text;
    if(!trace.exit)text=trace.loop?'Onde prisonnière':'Aucune sortie';
    else if(trace.exit.index===trace.entry.index)text=`${trace.entry.label} ↔\n${trace.color.name}`;
    else text=`Sort en ${partner.label}\n${trace.color.name}`;
    const control=traceControl(edgeIndex,directionIndex);showStreetBubble(control,text);pulseStreetControl(edgeIndex,directionIndex);
    if(partner){
      const partnerDirection=origin?trace.exitDirectionIndex:trace.entryDirectionIndex;
      pulseStreetControl(partner.index,partnerDirection);
    }
  }
  function launchWave(edgeIndex,directionIndex){
    if(!state.started)return;
    const usedTrace=findTraceAt(edgeIndex,directionIndex);
    if(usedTrace)return showStreetTraceFeedback(usedTrace,edgeIndex,directionIndex);
    if(validatePieces(state.pieces).size)return setMessage('Corrige les placements rouges avant de lancer une onde.',true);
    const trace=traceRay(edgeIndex,directionIndex,state.pieces);
    trace.time=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    state.traces.push(trace);render();setTimeout(()=>showStreetTraceFeedback(trace,edgeIndex,directionIndex),0);
  }
  function renderHistory(){
    const host=byId('streetHistory'),items=[];
    state.coords.slice().reverse().forEach(item=>{
      const marker=`<span class="street-history-swatch" style="--street-result:${item.empty?'#6b6355':item.hex}"></span>`;
      items.push(`<li class="street-history-item">${marker}<span><b>${item.text}</b> — ${item.name}</span>${item.time?`<span class="street-history-time">${item.time}</span>`:''}</li>`);
    });
    state.traces.slice().reverse().forEach(trace=>{
      const color=trace.color||resolveStreetColor(new Set(trace.colors||[]));
      const result=trace.loop?'Prisonnière':(!trace.exit?'Sans sortie':(trace.exit===trace.entry?`<b>${trace.entry.label}</b> ↔`:`<b>${trace.entry.label}</b> — <b>${trace.exit.label}</b>`));
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
  function render(){
    renderPalette();renderBoard();renderHistory();
    const issues=validatePieces(state.pieces),placed=state.pieces.filter(p=>p.anchor).length;
    const complete=placed===PIECES.length&&!issues.size;
    const preStart=!state.started;
    byId('streetRandom').hidden=!preStart;
    byId('streetShare').hidden=!preStart;
    byId('streetStart').hidden=!preStart;
    byId('streetEnd').hidden=preStart;
    byId('streetStart').disabled=!complete;
    byId('streetShare').disabled=true;
    byId('streetPaletteTitle').style.display=preStart?'flex':'none';
    byId('streetPalette').style.display=preStart?'flex':'none';
    byId('streetSetupHint').style.display=preStart?'block':'none';
    byId('streetStartBlockMsg').style.display=preStart?'block':'none';
    byId('streetWaveSetting').hidden=preStart;
    byId('streetWavePreference').value=wavePreference;
    const pill=byId('streetPrototype').querySelector('.mode-pill');
    pill.classList.toggle('live',state.started);
    pill.querySelector('span:last-child').textContent=state.started?'Partie en cours':'Placement des pièces';
    if(preStart){clearDirectionChoicesTimer();selectedWaveEdge=null;}
    if(state.started)setMessage('',false);
    else if(issues.size)setMessage([...new Set(issues.values())][0],true);
    else if(placed<PIECES.length)setMessage('Place toutes les pièces avant de démarrer.',true);
    else setMessage('');
    save();
  }
  function bind(){
    const create=byId('createStreetMode');
    if(!create)return;
    create.addEventListener('click',open);
    byId('streetClose').addEventListener('click',close);
    byId('streetRandom').addEventListener('click',()=>{if(state.started)return;if(!randomizePieces())setMessage('Impossible de trouver un placement valide. Réessaie.',true);render();});
    byId('streetStart').addEventListener('click',()=>{if(state.started||byId('streetStart').disabled)return;state.started=true;state.tool='pieces';state.traces=[];state.coords=[];clearDirectionChoicesTimer();selectedWaveEdge=null;render();});
    byId('streetEnd').addEventListener('click',close);
    byId('streetReset').addEventListener('click',()=>{if(!confirm('Effacer tous les placements et l’historique Street ?'))return;state={pieces:PIECES.map(def=>({id:def.id,anchor:null,rotation:0,flipped:false})),selected:'blueSmall',tool:'pieces',started:false,traces:[],coords:[]};clearDirectionChoicesTimer();selectedWaveEdge=null;localStorage.removeItem(SAVE_KEY);render();});
    byId('streetClearTests').addEventListener('click',()=>{state.traces=[];state.coords=[];render();});
    byId('streetHistoryToggle').addEventListener('click',()=>toggleHistory());
    byId('streetDiagnostic').addEventListener('click',async()=>{
      const issues=validatePieces(state.pieces);
      const report={prototype:'ORAPA-STREET-2',appVersion:APP_VERSION,createdAt:new Date().toISOString(),pieces:state.pieces.map(piece=>({...piece})),validation:[...issues.entries()].map(([piece,message])=>({piece,message})),coordinates:state.coords.map(item=>({...item})),rays:state.traces.map(trace=>({entry:trace.entry.label,entryDirection:trace.entryDirectionIndex,exit:trace.exit?.label||null,exitDirection:trace.exitDirectionIndex??null,bounced:!!trace.bounced,loop:!!trace.loop,colors:trace.colors,color:trace.color,time:trace.time||null,points:trace.points.map(p=>({x:+p.x.toFixed(2),y:+p.y.toFixed(2)}))}))};
      const text=`ORAPA STREET — RAPPORT DE CRÉATION\n${JSON.stringify(report,null,2)}`;
      try{await navigator.clipboard.writeText(text);setMessage('Diagnostic copié. Tu peux le coller avec une capture pour signaler un problème.');}
      catch(_error){setMessage('La copie automatique a échoué sur ce navigateur.',true);}
    });
    byId('streetWavePreference').addEventListener('change',event=>{
      wavePreference=event.target.value;clearDirectionChoicesTimer();selectedWaveEdge=null;
      try{localStorage.setItem(WAVE_PREFERENCE_KEY,wavePreference);}catch(_error){}
      render();
    });
    const narrowScreen=window.matchMedia('(max-width: 640px)');
    const refreshAutomaticControls=()=>{if(wavePreference==='auto'&&!byId('streetPrototype').hidden){clearDirectionChoicesTimer();selectedWaveEdge=null;render();}};
    if(narrowScreen.addEventListener)narrowScreen.addEventListener('change',refreshAutomaticControls);else narrowScreen.addListener(refreshAutomaticControls);
  }
  function open(){
    byId('createModeModal')?.classList.remove('open');
    byId('streetPrototype').hidden=false;document.body.classList.add('street-open');document.body.classList.remove('home-view');load();render();
  }
  function close(){clearDirectionChoicesTimer();selectedWaveEdge=null;byId('streetPrototype').hidden=true;document.body.classList.remove('street-open');document.body.classList.add('home-view');}

  window.OrapaStreetPrototype={open,close,debug:{BOARD,LANES,PIECES,axialTransform,pieceGeometry,visualWallsFor,visualWallPolygonsFor,snapPieceAnchor,coordinateForTriangle,traceRay,validatePieces}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
