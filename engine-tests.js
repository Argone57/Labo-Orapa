(function(){
  'use strict';
  const E=window.OrapaEngine,results=[],assert=(condition,label)=>{if(!condition)throw new Error(label);results.push(`✓ ${label}`);};
  const run=(label,test)=>{try{test();}catch(error){results.push(`✗ ${label}\n  ${error.message}`);}};
  const square=(x,y,size=1)=>[{x,y},{x:x+size,y},{x:x+size,y:y+size},{x,y:y+size}];
  run('Transformations',()=>{
    assert(JSON.stringify(E.transformVertex([1,2],false,90,{x:4,y:5}))===JSON.stringify({x:2,y:6}),'rotation à 90°');
    assert(JSON.stringify(E.transformVertex([1,2],true,0,{x:4,y:5}))===JSON.stringify({x:3,y:7}),'miroir horizontal');
  });
  run('Contacts',()=>{
    assert(E.contactKind(square(0,0),square(1,1))==='corner','contact par une pointe autorisé');
    assert(E.contactKind(square(0,0),square(1,0))==='sideTouch','côté partagé détecté');
    assert(E.contactKind(square(0,0),square(.5,0))==='overlap','chevauchement détecté');
  });
  run('Placement générique',()=>{
    const pieces=[{id:'a',center:{x:.5,y:.5},poly:square(0,0)}],polygonsFor=piece=>[piece.poly];
    assert(E.validatePlacement({candidate:{id:'b',center:{x:1.5,y:1.5},poly:square(1,1)},pieces,bounds:{minX:0,minY:0,maxX:3,maxY:3},polygonsFor}),'contact ponctuel accepté');
    assert(!E.validatePlacement({candidate:{id:'b',center:{x:1.5,y:.5},poly:square(1,0)},pieces,bounds:{minX:0,minY:0,maxX:3,maxY:3},polygonsFor}),'côté partagé refusé');
  });
  run('Onde sans obstacle',()=>{
    const result=E.simulateBeam({side:'top',index:2,pieces:[],width:10,height:8,edgesFor:()=>[],definitionFor:()=>({}),resolveColor:()=>({key:'transparent'})});
    assert(result.exitSide==='bottom'&&result.exitIndex===2,'sortie opposée correcte');
  });
  run('Corps noir',()=>{
    const black={id:'black',type:'black',center:{x:2.5,y:2.5}},edges=[[{x:2,y:2},{x:3,y:2}],[{x:3,y:2},{x:3,y:3}],[{x:3,y:3},{x:2,y:3}],[{x:2,y:3},{x:2,y:2}]];
    const result=E.simulateBeam({side:'top',index:2,pieces:[black],width:10,height:8,edgesFor:()=>edges,definitionFor:()=>({isOnyx:true}),resolveColor:()=>({key:'absorbed'})});
    assert(result.absorbed===true&&result.exitSide===null,'onde absorbée sans sortie');
  });
  const failures=results.filter(line=>line.startsWith('✗')).length;
  document.documentElement.dataset.tests=failures?'failed':'passed';
  document.getElementById('results').textContent=`${results.join('\n')}\n\n${failures?`${failures} échec(s)`:'Tous les tests sont réussis.'}`;
})();
