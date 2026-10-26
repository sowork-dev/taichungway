'use strict';
// Local-only complete app. Production runs play-server.cjs behind same-origin TLS.
const path=require('node:path');
const {createPlayServer}=require('./play-server.cjs');
const port=Number(process.env.PORT??8765);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT must be 0..65535');
const host='127.0.0.1';
const server=createPlayServer({staticDir:path.resolve(__dirname,'../public')});
server.listen(port,host,()=>process.stdout.write(JSON.stringify({url:'http://'+host+':'+server.address().port})+'\n'));
let stopping=false;
function stop(){if(stopping)return;stopping=true;server.closePlay();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
