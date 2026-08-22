global.window=global;
require('./engine-core.js');
const E=global.OrapaEngine;
const square=(x,y,size=1)=>[{x,y},{x:x+size,y},{x:x+size,y:y+size},{x,y:y+size}];
const tests=[];
function test(name,callback){try{callback();tests.push(['OK',name]);}catch(error){tests.push(['FAIL',`${name}: ${error.message}`]);}}
function assert(value,message){if(!value)throw new Error(message);}
test('rotation',()=>assert(E.transformVertex([1,2],false,90,{x:4,y:5}).x===2,'rotation incorrecte'));
test('contacts',()=>{assert(E.contactKind(square(0,0),square(1,1))==='corner','pointe');assert(E.contactKind(square(0,0),square(1,0))==='sideTouch','côté');assert(E.contactKind(square(0,0),square(.5,0))==='overlap','chevauchement');});
test('placement',()=>{const pieces=[{id:'a',center:{x:.5,y:.5},poly:square(0,0)}],polygonsFor=p=>[p.poly],bounds={minX:0,minY:0,maxX:3,maxY:3};assert(E.validatePlacement({candidate:{id:'b',center:{x:1.5,y:1.5},poly:square(1,1)},pieces,bounds,polygonsFor}),'pointe refusée');assert(!E.validatePlacement({candidate:{id:'b',center:{x:1.5,y:.5},poly:square(1,0)},pieces,bounds,polygonsFor}),'côté accepté');});
test('onde droite',()=>{const result=E.simulateBeam({side:'top',index:2,pieces:[],width:10,height:8,edgesFor:()=>[],definitionFor:()=>({}),resolveColor:()=>({key:'transparent'})});assert(result.exitSide==='bottom'&&result.exitIndex===2,'mauvaise sortie');});
test('corps noir',()=>{const black={id:'black',type:'black',center:{x:2.5,y:2.5}},edges=[[{x:2,y:2},{x:3,y:2}],[{x:3,y:2},{x:3,y:3}],[{x:3,y:3},{x:2,y:3}],[{x:2,y:3},{x:2,y:2}]],result=E.simulateBeam({side:'top',index:2,pieces:[black],width:10,height:8,edgesFor:()=>edges,definitionFor:()=>({isOnyx:true}),resolveColor:()=>({key:'absorbed'})});assert(result.absorbed===true&&!result.exitSide,'non absorbée');});
tests.forEach(([status,name])=>console.log(`${status} ${name}`));
if(tests.some(([status])=>status==='FAIL'))process.exitCode=1;
