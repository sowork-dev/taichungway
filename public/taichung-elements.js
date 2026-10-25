/* Original illustrations referenced to municipal sources; no third-party art copied. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TaichungElements=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MAP_NOTICE='取材真實臺中地標的非比例遊戲地圖；位置與動線為示意，政策適用範圍不受遊戲分區限制。';
const ZONES=Object.freeze({
 living:{label:'舊城生活',anchors:['臺中驛','柳川水岸','第二市場'],palette:['#af735d','#e6d6b3','#698e87'],localLife:'市場攤商、通勤與家庭照顧'},
 innovation:{label:'水湳創新',anchors:['臺中國際會展中心','中央公園'],palette:['#d8dfca','#8eab92','#91b3b4'],localLife:'會展、機械產業與公園日常'},
 culture:{label:'文化走廊',anchors:['草悟道','臺中國家歌劇院','東勢客家文化園區'],palette:['#d6c7a7','#66896a','#a1bba6'],localLife:'藝文活動、文化交流；各地標保留實際區位標籤'},
 nature:{label:'山城田野',anchors:['新社菇園','東勢山城'],palette:['#668751','#c4b18a','#9eac7b'],localLife:'菇農、田野與山城聚落'},
 connection:{label:'海線門戶',anchors:['高美濕地','海線風車'],palette:['#7b9997','#cfb888','#8babb1'],localLife:'海線景觀、移動與城市連結'}
});
const REFERENCES=Object.freeze([
 {id:'station',title:'臺中驛',realArea:'中區',sourceUrl:'https://tcmb.culture.tw/zh-tw/detail?id=188176&indexCode=Culture_Object',features:['紅磚','白色飾帶','鐘塔']},
 {id:'market',title:'第二市場',realArea:'中區',sourceUrl:'https://travel.taichung.gov.tw/zh-tw/tourist/tour/839',features:['市場街屋','攤商','麻芛等在地小吃']},
 {id:'liuchuan',title:'柳川水岸',realArea:'中區水岸段',sourceUrl:'https://travel.taichung.gov.tw/zh-tw/tourist/tour/839',features:['市區河岸','步道','沿岸綠意']},
 {id:'shuinan',title:'水湳會展與中央公園',realArea:'西屯區水湳經貿園區',sourceUrl:'https://www.xitun.taichung.gov.tw/831932/832094/832100/922723/post',features:['會展場館','中央公園綠地']},
 {id:'greenway',title:'草悟道',realArea:'西區',sourceUrl:'https://travel.taichung.gov.tw/zh-tw/tourist/tour/851',features:['綠色廊道','市民廣場','藝文生活']},
 {id:'theater',title:'臺中國家歌劇院',realArea:'西屯區',sourceUrl:'https://www.npac-ntt.org/about/architecture/design',features:['弧形曲牆','孔洞','流動線條']},
 {id:'mushroom',title:'新社菇園',realArea:'新社區',sourceUrl:'https://travel.taichung.gov.tw/zh-tw/tourist/tour/869',features:['香菇農遊','菇園與田野']},
 {id:'hakka',title:'東勢客家文化園區',realArea:'東勢區',sourceUrl:'https://www.hakka.taichung.gov.tw/28009/28168/28189/376717',features:['舊火車站','客家文化']},
 {id:'coast',title:'高美濕地',realArea:'清水區',sourceUrl:'https://taichung.travel/zh-tw/attractions/intro/1416',features:['濕地','海堤','風力發電風車']},
 {id:'food',title:'臺中在地小吃',realArea:'臺中各地，非每區均有',sourceUrl:'https://travel.taichung.gov.tw/zh-tw/experience/souvenirs',features:['麻薏','大麵羹','太陽餅']}
].map(r=>Object.freeze({...r,rights:'reference-only-original-drawing'})));
function rect(c,x,y,w,h,color,r=0){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function label(c,text,x,y,size=12,color='#334f48'){c.fillStyle=color;c.font='800 '+size+'px -apple-system,"PingFang TC",sans-serif';c.textAlign='center';c.fillText(text,x,y);}
function arch(c,x,y,w,h,color){c.fillStyle=color;c.beginPath();c.moveTo(x,y+h);c.lineTo(x,y+w/2);c.arc(x+w/2,y+w/2,w/2,Math.PI,0);c.lineTo(x+w,y+h);c.closePath();c.fill();}
// Symbolic original silhouettes, not replicas of third-party illustrations or maps.
function draw(c,kind,x,y,width,height,time=0){
 if(!['station','market','theater','expo','mushroom','hakka','windmill'].includes(kind))return false;
 c.save();c.translate(x,y);c.scale(width/210,height/145);
 if(kind==='station'){
  rect(c,-4,139,219,14,'#9a9c85',3);rect(c,0,35,210,105,'#ae735c',3);rect(c,0,64,210,8,'#eadfc3');rect(c,0,126,210,9,'#eadfc3');
  for(let row=0;row<5;row++)for(let col=0;col<14;col++){const bx=col*16+(row%2)*8;if(bx<210)rect(c,bx,43+row*19,Math.min(13,210-bx),2,'#b58d75');}
  rect(c,78,-4,54,145,'#e2dac1',4);rect(c,84,-13,42,16,'#746f5a',3);rect(c,91,-20,28,8,'#8b8064',3);
  c.fillStyle='#f2edda';c.beginPath();c.arc(105,27,18,0,Math.PI*2);c.fill();c.strokeStyle='#646d59';c.lineWidth=2;c.beginPath();c.moveTo(94,19);c.lineTo(105,27);c.lineTo(115,15);c.stroke();
  for(const a of [17,48,143,174])arch(c,a,81,23,45,'#587972');arch(c,91,79,28,61,'#455c58');rect(c,82,52,46,19,'#f2e8c9',2);label(c,'臺中驛',105,65,10);label(c,'紅磚與鐘塔意象',105,157,10);
 }else if(kind==='market'){
  rect(c,-3,135,216,17,'#90977b',2);rect(c,0,8,210,128,'#d5c5a4',3);rect(c,8,18,194,37,'#dcd3b7',3);label(c,'第二市場・舊城日常',105,43,13);
  for(let i=0;i<6;i++){rect(c,7+i*33,61,29,16,i%2?'#e6dbb9':'#a17058',2);rect(c,8+i*33,82,26,40,'#617971',2);}
  rect(c,8,117,194,17,'#ad8a62',2);label(c,'麻薏  /  大麵羹',105,130,11,'#f2e1bc');
 }else if(kind==='theater'){
  rect(c,-5,136,220,15,'#8ea38b',3);rect(c,0,4,210,132,'#e1dfca',15);c.fillStyle='#c0cabb';c.beginPath();c.moveTo(0,10);c.bezierCurveTo(42,-18,75,38,111,12);c.bezierCurveTo(156,-14,180,32,210,6);c.lineTo(210,47);c.bezierCurveTo(160,20,92,60,0,30);c.fill();
  for(const [a,b,w,h] of [[18,43,39,61],[84,30,44,83],[154,48,40,60]]){arch(c,a,b,w,h,'#71938b');rect(c,a+6,b+17,w-12,h-13,'#48756f',12);}
  rect(c,55,112,100,24,'#eae3c6',3);label(c,'臺中國家歌劇院',105,128,11);label(c,'西屯・曲牆意象',105,157,10);
 }else if(kind==='expo'){
  rect(c,-5,132,220,19,'#93aa8c',4);rect(c,0,34,210,103,'#a6c4bb',3);for(let i=0;i<8;i++)rect(c,8+i*26,54,3,79,'#dde4cd');
  c.fillStyle='#dce2cb';c.beginPath();c.moveTo(-9,38);c.bezierCurveTo(52,-18,140,-8,220,31);c.lineTo(215,49);c.bezierCurveTo(132,18,55,20,-5,56);c.closePath();c.fill();
  rect(c,21,78,168,31,'#e2d8b8',3);label(c,'水湳・國際會展',105,99,14);rect(c,87,112,37,25,'#50796f',2);for(const a of [11,181]){c.fillStyle='#6f915e';c.beginPath();c.arc(a,125,19,0,Math.PI*2);c.fill();}
 }else if(kind==='mushroom'){
  rect(c,-6,134,224,18,'#8c9b6b',4);rect(c,0,32,210,108,'#ccbb8f',3);c.fillStyle='#6f8a58';c.beginPath();c.moveTo(-8,36);c.lineTo(105,-8);c.lineTo(219,36);c.closePath();c.fill();
  for(let i=0;i<4;i++){const a=18+i*47;rect(c,a+8,78,12,36,'#eddbb3',5);c.fillStyle='#a47e53';c.beginPath();c.ellipse(a+14,79,22,13,0,Math.PI,2*Math.PI);c.fill();rect(c,a+1,117,31,10,'#9a875c',2);}
  rect(c,39,37,132,23,'#e5d5a7',3);label(c,'新社・菇園田野',105,53,13);label(c,'農業場景意象',105,155,10);
 }else if(kind==='hakka'){
  rect(c,0,39,210,100,'#d7c6a5',3);c.fillStyle='#6d8065';c.beginPath();c.moveTo(-8,40);c.lineTo(22,11);c.lineTo(190,11);c.lineTo(219,40);c.closePath();c.fill();
  rect(c,46,48,118,25,'#efe2bd',3);label(c,'東勢・客家文化',105,66,12);for(const a of [17,62,127,172])rect(c,a,83,23,33,'#6b8f81',2);rect(c,92,85,27,54,'#547564',2);rect(c,-3,139,217,9,'#9d9d82');
  for(let i=0;i<12;i++)rect(c,i*19,153,13,4,'#908469');rect(c,0,148,210,3,'#626e64');rect(c,0,162,210,3,'#626e64');
 }else{
  rect(c,-8,115,226,34,'#a4b6a0',8);rect(c,-8,137,226,21,'#9ebbbb',6);rect(c,27,18,8,115,'#dfe2cd',3);rect(c,140,0,9,136,'#e2e4cf',3);
  for(const [a,b,r] of [[31,21,36],[145,4,45]]){c.save();c.translate(a,b);c.rotate(-.35);for(let i=0;i<3;i++){c.rotate(Math.PI*2/3);c.fillStyle='#edf0d9';c.beginPath();c.moveTo(-3,0);c.lineTo(-2,-r);c.lineTo(4,-10);c.lineTo(4,0);c.closePath();c.fill();}c.restore();c.fillStyle='#d3d8c1';c.beginPath();c.arc(a,b,5,0,Math.PI*2);c.fill();}
  rect(c,38,109,144,23,'#ede0b9',3);label(c,'清水・高美濕地',110,125,12);label(c,'海線風車與濕地意象',105,174,10);
 }
 c.restore();return true;
}
const MISSION_SCENES=Object.freeze({commute:'在臺中驛前的遊戲場景，一位通勤族向你招手。',childcare:'在第二市場意象的街區，顧攤的家長需要幫忙。',care:'在舊城巷弄裡，你遇見正在照顧家人的居民。','exhibition-168':'在水湳會展意象的街區，你遇見準備參展的在地業者。','robot-city':'在創新街區，一位機械產業工作者想了解轉型方向。','culture-starlight':'沿著草悟道綠廊的意象，一位創作者想參與城市文化。','smart-agriculture':'在新社菇園的遊戲場景，一位農友正在思考經營難題。',hakka:'來到東勢舊站與客家文化的意象，先從生活故事認識政策。'});
return{MAP_NOTICE,ZONES,REFERENCES,MISSION_SCENES,draw};
});
