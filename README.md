# Copy Signal Bot
# Description
This an Electron desktop app that connects different API Keys for BINANCE and BYBIT in order to process all the trading signals incoming to the specific channel, with an specific format and place the order on the selected platform. User will be able to add several API Keys via UI and a custom amount for each API KEY (This is to give the user the ability to control how much every individual wants to invest per trade) and can also be modified or deleted through the UI. This feature only work for BINANCE and BYBIT will only read the FIRST API KEY added, anyother ByBit api key will be ignored and will the app won't place any order<br />
This bot uses ```telegram``` bot API to listen incoming messages from a specific channel in order to process the messages using REGEX.<br />
Messages will be received via websocket connection to avoid exceeding the limits and rates of Telegram. This should be previously connected using the ```API ID```, ```API Hash``` and ```sessionstring``` which can be obtained using [This repository](https://github.com/cambiosdak/Telegram-api-connector)<br />
In order to connect this app, you need the output file of the ```Telegram-api-connector``` repository, it's called "file.json" and should replace the existing one in this repository<br /> <br />
> NOTE THAT THIS WILL ONLY WORK WITH A PERSONAL ACCOUNT, IT'S NOT MEANT TO BE USED WITH TELEGRAM BOTS.

This app will automatically adjust leverage and use the designed amount for each account, place BOTH Take Profits (split in 50/50 of the order quantity), stop loss and move the STOP LOSS to Breakeven once the first Take Profit is filled, as well as adjust the amount of the Stop Loss (only for Binance)

# Usage
Before running this program, you need to:
- download this repository: [Telegram API Connector](https://github.com/cambiosdak/Telegram-api-connector)
- Once you have downloaded, download this repository and placed it inside "botApp" folder.
- Run the batch file and follow the process on the Telegram API Connector] Repository
- Then install the following dependecies via npm: <br />
```npm install telegram ws axios crypto-js bybit-api```
- npm run start and start adding the api keys desired.

```
Considerations:

This repository should be INSIDE the "botApp" of Telegram API Connector, and it should not be run until "file.json" is created sucessfully 
Otherwise application won't be able to authenticate and connect.

```
Message structure:
```
#BNB/USDT:  BUY
Entry:  326,0000
SL:  321,1100
TP:  334,1500
TP:  350,4500
Leverage : 20X
```
or 
```
#OP/USDT: BUY LIMIT
Entry:  2,600
SL:  2,535
TP:  2,665
TP:  2,795
Leverage : 20X
```

* If you want to process a different signal, you have to modify the function that handels the received message to extract symbol, stop loss, take profits and leverage as well as spaces, decimals, if it's using comma or dot for the decimals, etc*
# License

[MIT](https://opensource.org/license/mit/)
# References

- Websocket library: https://www.npmjs.com/package/ws
- Crypto-JS: https://www.npmjs.com/package/crypto-js
- Telegram connector: https://www.npmjs.com/package/telegram
- Bybit API Connector: https://github.com/tiagosiebler/bybit-api
- Electron App: https://www.electronjs.org/
