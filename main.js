const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require('telegram/events')
const WebSocket = require('ws')
const axios = require('axios')
const CryptoJS = require("crypto-js");
const trackOrders = []
let keys = require('./apiKeys.json')
const {RestClientV5} = require('bybit-api');
const clientBybit = new RestClientV5({
  key: keys.bybit[0].apikey,
  secret: keys.bybit[0].secretkey,
});
let breakeven = false
const data = require('./file.json')
const session = new StringSession(`${data.stringSession}`)
const client = new TelegramClient(session, Number(data.apiId), data.apiHash);



if (process.env.NODE_ENV !== 'production'){
  require('electron-reload')(__dirname, {

  })
}

let mainWindow
function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 600,
    height: 550,
    title: "Cesar Bot",
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      preload: path.join(__dirname, "./preload.js"),
      sandbox: false,
    }
  });

  mainWindow.setMenu(null)
  mainWindow.loadFile("./views/index.html");

}
app.whenReady().then(() => {  
  createWindow();      
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
     createWindow()
    }
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.on('connect-telegram', async (e, data) =>{
  client.start()

  const keys = require('./apiKeys.json')
  let channel = BigInt(data.channelId)
  let buy = data.buy
  let sell = data.sell
  let exchange = data.selectedExchange
  if (data.control){
    breakeven = true
  }
  console.log(breakeven)
if (exchange === 'binance') {
    connectToUserDataStream(keys.binance)
}
async function eventPrint(event) {
  const message = event.message;
  if (event.isChannel){
    if (event.chatId['value'] === channel){
      let string = message.text
      let order = extractStr(string, buy, sell)
      console.log(order)
    if (order.tradeType == 'MARKET' && exchange == 'binance')  {
        let options = {
        method: 'GET',
        url: 'https://fapi.binance.com/fapi/v1/premiumIndex',
        params: {symbol: `${order.symbol}`}
      };
    axios.request(options)
      .then( async response =>{
        await response.data
        let symbolPrice = response.data.markPrice
        const binanceKeys = keys.binance
        let qty
        let options = {
          method: 'GET',
          url: 'https://fapi.binance.com/fapi/v1/exchangeInfo',
        }
        axios.request(options)
          .then(async response => {
            await response.data
            let symbols = response.data.symbols
            for (const k of symbols){
              if (k.symbol == order.symbol){
                precision = k.quantityPrecision
                pricePrecision = k.pricePrecision
              }
            }
            for (i=0; i < binanceKeys.length;i++){
              console.log('USDT TO INVEST: ' + binanceKeys[i].amount)
              qty = ((binanceKeys[i].amount * order.leverage) / symbolPrice).toFixed(precision)
              console.log('Base Asset QTY: ' + qty)
              let takeProfitQty = calculateTakeProfits(qty, '0.5', precision)
              console.log(takeProfitQty)
              await changeLeverage(order.symbol, order.leverage, binanceKeys[i].apikey, binanceKeys[i].secretkey)
              await new Promise((resolve) => setTimeout(resolve, 1000));
              await sendOrder(exchange, qty, order.symbol, order.tradeDirection, order.type, symbolPrice, binanceKeys[i].apikey, binanceKeys[i].secretkey)
              await new Promise((resolve) => setTimeout(resolve, 1000));
              let stopSent = await sendStopLoss(order.symbol, order.tradeDirection, qty, order.slPrice, binanceKeys[i].apikey, binanceKeys[i].secretkey)
              await new Promise((resolve) => setTimeout(resolve, 1000))
              let sentTP1 = await sendTakeProfit1(order.symbol, order.tradeDirection,takeProfitQty[0], precision, order.tpPrices, binanceKeys[i].apikey, binanceKeys[i].secretkey )
              await new Promise((resolve) => setTimeout(resolve, 1000))
              let sentTP2 = await sendTakeProfit2(order.symbol,order.tradeDirection,takeProfitQty[1],precision,order.tpPrices, binanceKeys[i].apikey, binanceKeys[i].secretkey)
              let entryPrice = Number(symbolPrice).toFixed(pricePrecision)
              let stopPriceSymbol = {
                "symbol": order.symbol,
                "stopPrice": order.slPrice,
                "entryPrice": entryPrice
              }
              if (!trackOrders[binanceKeys[i].apikey]) {
                trackOrders[binanceKeys[i].apikey] = {};
              }
              trackOrders[binanceKeys[i].apikey] = {...trackOrders[binanceKeys[i].apikey], ...sentTP1, ...sentTP2, ...stopSent,...stopPriceSymbol}
              console.log(trackOrders)
              
            }

          }).catch(error =>{
            console.error(error)
          })
      }).catch(error =>{
        console.log(error.response.data)
      })
      
    } else if (order.tradeType === 'LIMIT' && exchange === 'binance'){
      const binanceKeys = keys.binance
      let qty
      let options = {
        method: 'GET',
        url: 'https://fapi.binance.com/fapi/v1/exchangeInfo',
      }
      axios.request(options)
        .then(async response => {
          await response.data
          let symbols = response.data.symbols
          for (const k of symbols){
            if (k.symbol == order.symbol){
              precision = k.quantityPrecision
            }
          }
          for (i=0; i < binanceKeys.length;i++){
            console.log('USDT TO INVEST: ' + binanceKeys[i].amount)
            qty = ((binanceKeys[i].amount * order.leverage) / order.entryPrice).toFixed(precision)
            console.log('Base Asset QTY: ' + qty)
            let takeProfitQty = calculateTakeProfits(qty, '0.5', precision)
            await changeLeverage(order.symbol, order.leverage, binanceKeys[i].apikey, binanceKeys[i].secretkey)
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await sendOrder(exchange, qty, order.symbol, order.tradeDirection, order.tradeType, order.entryPrice, binanceKeys[i].apikey, binanceKeys[i].secretkey)
            await new Promise((resolve) => setTimeout(resolve, 1000));
            let stopSent = await sendStopLoss(order.symbol, order.tradeDirection, qty, order.slPrice, binanceKeys[i].apikey, binanceKeys[i].secretkey)
            await new Promise((resolve) => setTimeout(resolve, 1000))
            let sentTP1 = await sendTakeProfit1(order.symbol, order.tradeDirection,takeProfitQty[0], precision, order.tpPrices, binanceKeys[i].apikey, binanceKeys[i].secretkey)
            await new Promise((resolve) => setTimeout(resolve, 1000))
            let sentTP2 = await sendTakeProfit2(order.symbol,order.tradeDirection,takeProfitQty[1],precision,order.tpPrices, binanceKeys[i].apikey, binanceKeys[i].secretkey)
            let stopPriceSymbol = {
              "symbol": order.symbol,
              "stopPrice": order.slPrice,
              "entryPrice": order.entryPrice
            }
            if (!trackOrders[binanceKeys[i].apikey]) {
              trackOrders[binanceKeys[i].apikey] = {};
            }
            trackOrders[binanceKeys[i].apikey] = {...trackOrders[binanceKeys[i].apikey], ...sentTP1, ...sentTP2, ...stopSent, stopPriceSymbol}
            console.log(trackOrders)
          }

        }).catch(error =>{
          console.error(error)
        })
    } else if (order.tradeType === 'MARKET' && exchange === 'bybit'){
      await changeLeverageBybit(order.symbol, `${order.leverage}`)
      let decimals = await getPrecision(order.symbol)
      console.log(decimals)
      let price = await getPriceBybit(order.symbol)
      let str = order.tradeDirection
      let side = str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
      let qty = ((keys.bybit[0].amount * order.leverage) / price).toFixed(decimals)
      let takeProfitQty = calculateTakeProfits(qty, '0.5', decimals)

      await new Promise((resolve) => setTimeout(resolve, 1000))
      await createMarketOrder(order.symbol, side, `${qty}`, `${order.slPrice}`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await createLimitOrder(order.symbol,side, `${takeProfitQty[0]}`, `${order.tpPrices[0]}`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await createLimitOrder(order.symbol,side, `${takeProfitQty[1]}`, `${order.tpPrices[1]}`)

    } else if(order.tradeType === 'LIMIT' && exchange === 'bybit'){
      let decimals = await getPrecision(order.symbol)
      let price = await getPriceBybit(order.symbol)
      let str = order.tradeDirection
      let side = str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
      let qty = ((keys.bybit[0].amount * order.leverage) / price).toFixed(decimals)
      let takeProfitQty = calculateTakeProfits(qty, '0.5', decimals)

      await changeLeverageBybit(order.symbol, `${order.leverage}`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await createLimitOrderStopLoss(order.symbol, side, `${qty}`, order.entryPrice,`${order.slPrice}`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await createLimitOrder(order.symbol,side, `${takeProfitQty[0]}`, `${order.tpPrices[0]}`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await createLimitOrder(order.symbol,side, `${takeProfitQty[1]}`, `${order.tpPrices[1]}`)

    } else if(order === 'close' && exchange === 'bybit'){
      let id = message.replyTo.replyToMsgId
      let string = await getSymbol(id, data.channelId)
      let order = extractStr(string, 'BUY', 'SELL')
      let decimals = await getPrecision(order.symbol)
      let str = order.tradeDirection
      let side = str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
      let closeQty = await getDataPosition(order.symbol)
      console.log(closeQty)
      closeMarket(order.symbol, side, closeQty)
      let cancelOrder = await clientBybit.cancelAllOrders({
        category: 'linear',
        symbol: order.symbol
      })
      console.log(cancelOrder)
    } else if(order === 'close' && exchange === 'binance'){
      const binanceKeys = keys.binance
      let id = message.replyTo.replyToMsgId
      let string = await getSymbol(id, data.channelId)
      let order = extractStr(string, 'BUY', 'SELL')
      let options = {
        method: 'GET',
        url: 'https://fapi.binance.com/fapi/v1/exchangeInfo',
      }
      axios.request(options).then(async response => {
          await response.data
          let symbols = response.data.symbols
          for (const k of symbols){
            if (k.symbol == order.symbol){
              precision = k.quantityPrecision
            }
          }
          let oppositeSide = order.tradeDirection === 'BUY' ? 'SELL' : 'BUY'
          for (i=0; i < binanceKeys.length;i++){
            sendOrder(exchange,trackOrders[binanceKeys[i].apikey].stopSize, order.symbol, oppositeSide, 'MARKET', null, binanceKeys[i].apikey, binanceKeys[i].secretkey)
            cancelOrders(order.symbol, binanceKeys[i].apikey, binanceKeys[i].secretkey)
          }
        })
    }
      
    }
  }
}
// adds an event handler for new messages
client.addEventHandler(eventPrint, new NewMessage({}));

})

function extractStr(str, buyStr, sellStr) {
  if (str.startsWith('#')){
    try {
      const assetMatch = str.match(new RegExp(`#([A-Z0-9]+)\\s*\\/\\s*([A-Z0-9]+)\\s*:\\s*(${buyStr}|${sellStr})\\s{0,2}(LIMIT|MARKET)?`, 'i'));
      const asset = assetMatch ? assetMatch[1] : null;
      
      const quote = assetMatch ? assetMatch[2] : null;
      const tradeDirection = assetMatch ? (assetMatch[3].toLowerCase() === buyStr.toLowerCase() ? 'BUY' : 'SELL') : null;
      const tradeType = assetMatch ? assetMatch[4] || 'MARKET' : null;
      
      const symbol = asset && quote ? asset + quote : null;
      // Extract the entry price
      const entryMatch = str.match(/Entry:\s*([\d,\.]+)/i);
      const entryPrice = entryMatch ? parseFloat(entryMatch[1].replace(',', '.')) : null;
  
      // Extract the stop-loss price
      const slMatch = str.match(/SL:\s*([\d,\.]+)/i);
      const slPrice = slMatch ? parseFloat(slMatch[1].replace(',', '.')) : null;
  
      // Extract the take-profit prices
      const tpMatches = str.match(/TP:\s*([\d,\.]+)/ig);
      const tpPrices = tpMatches ? tpMatches.map(tp => parseFloat(tp.match(/TP:\s*([\d,\.]+)/i)[1].replace(',', '.'))) : [];
  
      // Extract the leverage
      const leverageMatch = str.match(/Leverage :\s*(\d+)X/i);
      const leverage = leverageMatch ? parseInt(leverageMatch[1]) : null;
      return {
        symbol,
        quote,
        asset,
        tradeDirection,
        tradeType,
        entryPrice,
        slPrice,
        tpPrices,
        leverage,
      };
        
  } catch (error) {
    console.log(error)
    return null;
  }
  } else if (str.startsWith('Close')){
    return 'close'
  }

}

async function sendOrder(exchange, qty, symbol, side, type, price, apiKey, apiSecret){
 if (exchange === 'binance'){
  console.log('SENDING ORDER...')
  let params
  if (type == 'LIMIT'){
    params = `symbol=${symbol}&side=${side}&price=${price}&type=LIMIT&quantity=${qty}&timeInForce=GTC&recvWindow=60000&timestamp=${Date.now()}`
  } else{
    params = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${qty}&recvWindow=60000&timestamp=${Date.now()}`
  }
  let signatureLeverage = CryptoJS.HmacSHA256(params, apiSecret).toString(CryptoJS.enc.Hex)
  let opt = {
      headers: {
          'X-MBX-APIKEY': `${apiKey}`
      },
      method: 'POST',
      url: `https://fapi.binance.com/fapi/v1/order?${params}&signature=${signatureLeverage}`
  }
  axios.request(opt)
    .then(async response =>{
      await response.data
      console.log(response.data)
    }).catch(error => {
      console.error(error.response.data.msg)
      let err = error.response.data.msg
      mainWindow.webContents.send('error-handle', err)
    })
 }
}
// ('binance', '0.01', 'ETHUSDT', 'BUY', 'LIMIT', '1778','YMph8RIZMFEDEYSlpGzeT1IWhpZK1rxaXX3rD1Ea0rkyyqK8FZYxEa4eLSyFFweV', 'me8x7KbmP5i0Bt8nvSqVhpu5kvnhKbKLQZ9qZlD49FXXCwbD8UpIdDbYcuxdwxtj')
async function sendStopLoss(symbol, side, quantity, stopPrice, apiKey, apiSecret) {
  console.log('Sending STOP LOSS...')
  const baseUrl = 'https://fapi.binance.com';
  const timestamp = Date.now();
  const recvWindow = 60000;
  const stopParams = `symbol=${symbol}&side=${side === 'BUY' ? 'SELL' : 'BUY'}&type=STOP_MARKET&quantity=${quantity}&stopPrice=${stopPrice}&timestamp=${timestamp}&recvWindow=${recvWindow}`;
  const stopSignature = CryptoJS.HmacSHA256(stopParams, apiSecret).toString(CryptoJS.enc.Hex);

  // Send stop-loss order
  let stopOpt = {
    headers: {
      'X-MBX-APIKEY': apiKey
    },
    method: 'POST',
    url: `${baseUrl}/fapi/v1/order?${stopParams}&signature=${stopSignature}`
  };
  let stopOrder;
  try {
    const response = await axios.request(stopOpt);
    stopOrder = response.data;
    return {
      "symbol": stopOrder.symbol,
      "stopOrderId": stopOrder.clientOrderId,
      "stopSize": stopOrder.origQty,
    }
  } catch (error) {
    console.error(error.response.data.msg);
    return;
  }
 
}
async function sendTakeProfit1(symbol, side, quantity, precision, takeProfits, apiKey, apiSecret){
    // Send take-profit orders
    const baseUrl = 'https://fapi.binance.com';
    let timestamp = Date.now()
    let recvWindow = 60000
    const tpParams1 = `symbol=${symbol}&side=${side === 'BUY' ? 'SELL' : 'BUY'}&type=TAKE_PROFIT_MARKET&quantity=${quantity}&stopPrice=${takeProfits[0]}&timestamp=${timestamp}&recvWindow=${recvWindow}`
    const tpSignature = CryptoJS.HmacSHA256(tpParams1, apiSecret).toString(CryptoJS.enc.Hex);
    let tpOpt = {
      headers: {
        'X-MBX-APIKEY': apiKey
      },
      method: 'POST',
      url: `${baseUrl}/fapi/v1/order?${tpParams1}&signature=${tpSignature}`
    };
    try {
      const response = await axios.request(tpOpt);
      const tpOrder = response.data;
      return {
        "symbol": tpOrder.symbol,
        "orderId1": tpOrder.orderId,
        "tp1Size": tpOrder.origQty
      }
    } catch (error) {
      console.error(error.response.data.msg);
      return;
    }
}
async function sendTakeProfit2(symbol, side, quantity, precision, takeProfits, apiKey, apiSecret){
  const baseUrl = 'https://fapi.binance.com'
  let timestamp = Date.now()
  let recvWindow = 60000
  const tpParams2 = `symbol=${symbol}&side=${side === 'BUY' ? 'SELL' : 'BUY'}&type=TAKE_PROFIT_MARKET&quantity=${quantity}&stopPrice=${takeProfits[1]}&timestamp=${timestamp}&recvWindow=${recvWindow}`;
  const tpSignature2 = CryptoJS.HmacSHA256(tpParams2, apiSecret).toString(CryptoJS.enc.Hex);
  let tpOpt2 = {
    headers: {
      'X-MBX-APIKEY': apiKey
    },
    method: 'POST',
    url: `${baseUrl}/fapi/v1/order?${tpParams2}&signature=${tpSignature2}`
  };
  try {
    const response = await axios.request(tpOpt2);
    const tpOrder = response.data;
    console.log(`Take-profit: ${tpOrder.orderId}`);
    return {
      "symbol": tpOrder.symbol,
      "orderId2": tpOrder.orderId
    }
  } catch (error) {
    console.error(error.response.data.msg);
    return;
  }
}
async function changeLeverage(symbol, leverage, apiKey, apiSecret) {
  try {
    const timestamp = Date.now();
    const queryString = `symbol=${symbol}&leverage=${leverage}&timestamp=${timestamp}`;
    const signature = CryptoJS.HmacSHA256(queryString, apiSecret).toString(CryptoJS.enc.Hex);
    const response = await axios({
      method: 'POST',
      url: 'https://fapi.binance.com/fapi/v1/leverage',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-MBX-APIKEY': apiKey
      },
      data: `${queryString}&signature=${signature}`
    });
    console.log(response.data.leverage);
  } catch (error) {
    console.error(error);
  }
}
async function connectToUserDataStream(apiKeysAndSecrets) {
  try {
    const listenKeys = await Promise.all(
      apiKeysAndSecrets.map(async ({ apikey, secretkey, amount }) => {
        const response = await axios.post('https://fapi.binance.com/fapi/v1/listenKey', {}, {
          headers: {
            'X-MBX-APIKEY': apikey
          },
        });
        const listenKey = response.data.listenKey;
        return { apikey, secretkey, listenKey, amount };
      })
    );

    const websockets = listenKeys.map((key) => {
      const ws = new WebSocket(`wss://fstream.binance.com/ws/${key.listenKey}`);

      ws.on('open', () => {
        console.log(`Connected to user data stream for ${key.apikey}`);
      });

      ws.on('message', async (data) => {
        const message = JSON.parse(data);
        if (message.e === 'ORDER_TRADE_UPDATE' && trackOrders[key.apikey]) {
          if(message.o.X === 'FILLED' && message.o.ot === 'TAKE_PROFIT_MARKET' && message.o.i === trackOrders[key.apikey].orderId2){
              cancelOrders(message.o.s, key.apikey, key.secretkey)
          }
          if(message.o.X === 'FILLED' && message.o.ot === 'STOP_MARKET'){
            cancelOrders(message.o.s, key.apikey, key.secretkey)
          }
          if(message.o.X === 'FILLED' && message.o.ot === 'TAKE_PROFIT_MARKET' && message.o.i === trackOrders[key.apikey].orderId1){
            if (breakeven === false) {
              let canceled = await cancelOrder(key.apikey, key.secretkey, message.o.s, trackOrders[key.apikey].stopOrderId)
              let qty = trackOrders[key.apikey].stopSize - trackOrders[key.apikey].tp1Size
              console.log('New Stop Qty: ' + qty)
              console.log(canceled.stopPrice)
              console.log(trackOrders[key.apikey].stopPrice)
              await new Promise((resolve) => setTimeout(resolve, 1000))
              let side = message.o.S === 'BUY' ? 'SELL' : 'BUY'
              console.log(side + ' vs '+ message.o.S )
              let stopUpdate = {
                "stopSize": qty
              }
              await sendStopLoss(message.o.s, side, qty, trackOrders[key.apikey].stopPrice, key.apikey, key.secretkey)
              trackOrders[key.apikey] = {...trackOrders[key.apikey], ...stopUpdate}
              console.log(trackOrders)
            } else if(breakeven === true) {
              await cancelOrder(key.apikey, key.secretkey, message.o.s, trackOrders[key.apikey].stopOrderId)
              let qty = trackOrders[key.apikey].stopSize - trackOrders[key.apikey].tp1Size
              console.log('New Stop Qty: ' + qty)
              console.log(trackOrders[key.apikey].stopPrice)
              await new Promise((resolve) => setTimeout(resolve, 1000))
              let side = message.o.S === 'BUY' ? 'SELL' : 'BUY'
              console.log(side + ' vs '+ message.o.S )
              let stopUpdate = {
                "stopSize": qty
              }
              await sendStopLoss(message.o.s, side, qty, trackOrders[key.apikey].entryPrice, key.apikey, key.secretkey)
              trackOrders[key.apikey] = {...trackOrders[key.apikey], ...stopUpdate}
              console.log(trackOrders)
            }
          }
        }
      });

      // Send a keep-alive request every 30 minutes
      setInterval(() => {
        axios.put('https://fapi.binance.com/fapi/v1/listenKey', {}, {
          headers: {
            'X-MBX-APIKEY': key.apikey
          },
        });
      }, 30 * 60 * 1000);

      return { ws, amount: key.amount };
    });

    return websockets;
  } catch (error) {
    console.error(error);
  }
}
async function cancelOrders(symbol, apiKey, apiSecret){
  let timestamp = Date.now()
  let recvWindow = 60000
  const cancelOrder = `symbol=${symbol}&timestamp=${timestamp}&recvWindow=${recvWindow}`;
  const cancelSign = CryptoJS.HmacSHA256(cancelOrder, apiSecret).toString(CryptoJS.enc.Hex);
  console.log(cancelOrder)
  let options = {
    headers: {
      'X-MBX-APIKEY': apiKey
    },
    method: 'DELETE',
    url: `https://fapi.binance.com/fapi/v1/allOpenOrders?${cancelOrder}&signature=${cancelSign}`
  };
  try {
    const response = await axios.request(options)
    const cancel = response.data
    console.log(`${cancel.msg} for ${symbol}`)
  } catch (error) {
    console.error(error.response.data.msg)
    return
  }
}
async function cancelOrder(apiKey, secretkey, symbol, orderId) {
  let timestamp = Date.now()
  let recvWindow = 60000
  const cancelOrder = `symbol=${symbol}&origClientOrderId=${orderId}&timestamp=${timestamp}&recvWindow=${recvWindow}`;
  const cancelSign = CryptoJS.HmacSHA256(cancelOrder, secretkey).toString(CryptoJS.enc.Hex);
  let options = {
    headers: {
      'X-MBX-APIKEY': apiKey
    },
    method: 'DELETE',
    url: `https://fapi.binance.com/fapi/v1/order?${cancelOrder}&signature=${cancelSign}`
  };
  try {
    const response = await axios.request(options)
    const cancel = response.data
    return {
      "stopPrice": cancel.stopPrice
    }
  } catch (error) {
    console.error(error.response.data.msg)
    return
  }
}
// BYBIT

async function getPriceBybit(symbol) {
  const url = `https://api.bybit.com/derivatives/v3/public/tickers?symbol=${symbol}`;
  
  try {
    const response = await axios.get(url);
    const price = response.data.result.list[0].lastPrice;
    return price
  } catch (error) {
    console.error(error);
  }
}
async function changeLeverageBybit(symbol, leverage) {
  try {
      const setLev = await clientBybit.setLeverage({
        category: "linear",
        buyLeverage: leverage,
        sellLeverage: leverage,
        symbol: symbol
      })
      console.log(`Leverage changed to ${leverage}`)
  } catch (error) {
      console.log(error)
  }
}
async function createLimitOrder(symbol, side, qty, price) {
  try {
      
      const buyOrderResult = await clientBybit.submitOrder({
        "category": "linear",
        "symbol": symbol,
        "side": side === 'Buy' ? 'Sell' : 'Buy',
        "orderType": 'Limit',
        "qty": qty,
        "price": price,
        "timeInForce": "GTC"
      });
      console.log(buyOrderResult);
  } catch (error) {
    console.error(error);
  }
}
async function createLimitOrderStopLoss(symbol, side, qty, price, stopLoss) {
  try {
    
      const buyOrderResult = await clientBybit.submitOrder({
        "category": "linear",
        "symbol": symbol,
        "side": side,
        "orderType": 'Limit',
        "qty": qty,
        "price": price,
        "timeInForce": "PostOnly",
        "stopLoss": stopLoss,
      });
      console.log(buyOrderResult);    
  } catch (error) {
    console.error(error);
  }
}
async function closeMarket(symbol, side, qty){
  try {
    const OrderResult = await clientBybit.submitOrder({
      category: 'linear',
      symbol: symbol,
      orderType: 'Market',
      qty: qty,
      side: side === 'Buy' ? 'Sell' : 'Buy',
    });
    console.log(OrderResult)
  } catch (error) {
    console.log(error)
  }
}
async function createMarketOrder(symbol, side, qty, stopLoss){
  try {
    const OrderResult = await clientBybit.submitOrder({
      category: 'linear',
      symbol: symbol,
      orderType: 'Market',
      qty: qty,
      side: side,
      stopLoss: stopLoss
    });
    console.log(OrderResult)
  } catch (error) {
    console.error(error)
  }
}

async function getPrecision(symbol) {
  try {
    let instrument = await clientBybit.getInstrumentsInfo({
      category: 'linear',
      symbol: `${symbol}`
    })    
    let resp = instrument.result.list[0].lotSizeFilter.qtyStep
    let decimals = countDecimals(resp)
    return decimals
  } catch (error) {
    
  }
}

async function getSymbol(id, channel) {
  const result = await client.invoke(
    new Api.channels.GetMessages({
      channel: `${channel}`,
      id: [id],
    })
  );
  console.log(result.messages[0].message)
  return result.messages[0].message
}

function countDecimals(number) {
  const decimalCount = String(number).split('.')[1];
  return decimalCount ? decimalCount.length : 0;
}
function calculateTakeProfits(orderSize, firstTPPercentage, maxDecimals) {
  // Convert the input strings to numbers
  orderSize = Number(orderSize);
  firstTPPercentage = Number(firstTPPercentage);
  // Calculate the size of the first take profit
  const firstTPSize = orderSize * firstTPPercentage;
  // Round to the desired number of decimals
  const roundedFirstTPSize = Math.ceil(firstTPSize * Math.pow(10, maxDecimals)) / Math.pow(10, maxDecimals);
  // Calculate the size of the second take profit
  const secondTPSize = orderSize - roundedFirstTPSize;
  // Round to the desired number of decimals
  const roundedSecondTPSize = Math.ceil(secondTPSize * Math.pow(10, maxDecimals)) / Math.pow(10, maxDecimals);
  // Return the two take profit levels
  return [roundedFirstTPSize, roundedSecondTPSize];
}
async function getDataPosition(symbol){
  let data = await clientBybit.getPositionInfo({
    category: 'linear',
    symbol: `${symbol}`
  })
  return data.result.list[0].size
}