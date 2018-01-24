const {app, BrowserWindow} = require('electron')
const path = require('path')
const url = require('url')
const ipc = require('electron').ipcMain

//火币
const moment = require('moment')
const webSocket = require('ws')
const pako = require('pako')

const WS_URL = 'ws://api.huobi.pro/ws'

var wsflag = false //websocket开启标志
var orderbook = {}
var symbols = new Array()
var ws = new webSocket(WS_URL)

var subsymbol='btcusdt' //订阅主题类型
var subperiod='60min' //时间间隔 $period 可选值：{ 1min, 5min, 15min, 30min, 60min, 1day, 1mon, 1week, 1year }

var miniwinFlag=0 //标志变量，如果为0表示未将币值名称发给小窗体，为1表示发送过了（确保窗口初始化时只发送一次ipc消息）

symbols.push(subsymbol)//加入默认订阅的主题




//接收前端的各种请求
ipc.on('userrequst',function(event,arg){
  if(arg=='close'){
     win.close()
  }else if(arg=='showmini'){
     miniwinFlag=0;
     miniwin = new BrowserWindow({
       width: 280,
       height: 220,
       frame:false,
       title:"火币小程序",
       icon: __dirname + './assets/img/icon.png',
       transparent:true,
       fullscreenable :false
     })
     // 然后加载应用的 index.html。
     miniwin.loadURL(url.format({
       pathname: path.join(__dirname, 'miniwindow.html'),
       protocol: 'file:',
       slashes: true
     }))

     //miniwin.webContents.openDevTools()

     win.hide()//隐藏主窗体
     // 当 window 被关闭，这个事件会被触发。
     miniwin.on('closed', () => {
       win.show()
       mini = null
     })
  }else{
    subtype(arg)
  }
})

//订阅相关的主题信息
function subtype(types){
    //订阅之前判断网络状态
    if(wsflag){
      //首先取消订阅之前的主题
      console.log("net works")
      var oldsub=symbols.shift()
      console.log(oldsub)
      symbols.push(types) //将新的主题放入订阅数组
      ws.send(JSON.stringify({
        "unsub": `market.${oldsub}.kline.`+subperiod,
        "id": `${oldsub}`
      }))
    }else{
      console.log('Net error!')
    }

}



function handle(data){
  let symbol = data.ch.split('.')[1];
  let channel = data.ch.split('.')[2];
  switch(channel){
    case 'depth':
      //console.log('depth',data)
      break;
    case 'kline':
      //console.log('kline',data.tick)
      win.webContents.send('kline',data.tick)
      if(miniwin!=null && !(miniwin.isDestroyed())){
        miniwin.webContents.send('kline',data.tick)
        if(miniwinFlag==0){
           miniwin.webContents.send('coinname',symbols[0].slice(0,-4).toUpperCase())
           console.log(symbols[0].slice(0,-4))
           miniwinFlag=1;
        }
      }
      break;
  }
}

//订阅
function subscribe(ws){
  //订阅深度
  /*for(let symbol of symbols){
    ws.send(JSON.stringify({
      "sub":`market.${symbol}.depth.60min`,
      "id":`${symbol}`
    }))
  }*/

  //订阅K线
  for(let symbol of symbols){
    ws.send(JSON.stringify({
      "sub": `market.${symbol}.kline.`+subperiod,
      "id": `${symbol}`
    }))
  }
}

// //请求
// function request(ws){
//   for(let symbol of symbols){
//     ws.send(JSON.stringify({
//       "req": `market.${symbol}.kline.60min`,
//       "id": `${symbol}`
//     }))
//   }
// }

//初始化websocket
function wbinit(){
  ws = new webSocket(WS_URL)
  ws.on('open',()=>{
    subscribe(ws) //首次登录订阅默认主题
    wsflag=true
  })

  ws.on('message',(data)=>{
    let text = pako.inflate(data,{to:'string'})
    let msg = JSON.parse(text);
    if(msg.ping){
      ws.send(JSON.stringify({
        pong:msg.ping
      }))
    }else if(msg.tick){
      handle(msg)
    }else if(msg.unsubbed){
      subscribe(ws) //如果取消上一个订阅成功，则订阅新的主题
    }
  })

  ws.on('close',()=>{
    console.log('close');
    wsflag=false
    wbinit();
  })

  ws.on('error',err=>{
    console.log('error',err)
    wsflag=false
    wbinit();
  })
}


// 保持一个对于 window 对象的全局引用，如果你不这样做，
// 当 JavaScript 对象被垃圾回收， window 会被自动地关闭
let win
let miniwin

function createWindow () {
  // 创建浏览器窗口。
  win = new BrowserWindow({
    width: 1000,
    height: 500,
    frame:false,
    title:"火币小程序",
    icon: __dirname + './assets/img/icon.png',
    fullscreenable:false
  })

  // 然后加载应用的 index.html。
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))


  // 打开开发者工具。
 //win.webContents.openDevTools()

  // 当 window 被关闭，这个事件会被触发。
  win.on('closed', () => {
    // 取消引用 window 对象，如果你的应用支持多窗口的话，
    // 通常会把多个 window 对象存放在一个数组里面，
    // 与此同时，你应该删除相应的元素。
    win = null
  })

}

// Electron 会在初始化后并准备
// 创建浏览器窗口时，调用这个函数。
// 部分 API 在 ready 事件触发后才能使用。
app.on('ready', createWindow)

// 当全部窗口关闭时退出。
app.on('window-all-closed', () => {
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // 在macOS上，当单击dock图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  if (win === null) {
    createWindow()
  }
})

//初始化websocket
wbinit();

// 在这文件，你可以续写应用剩下主进程代码。
// 也可以拆分成几个文件，然后用 require 导入。
