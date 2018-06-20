const http = require("http");
const fetch = require('isomorphic-unfetch');
const fs=require("fs");
const winston = require('winston');

const logger = require('./log')(module);

// пауза программы
const pause = (ms) => {
  const date = new Date();
  let curDate = null;
  do { curDate = new Date(); }
  while(curDate-date < ms);
}

const URL = 'http://dom.mingkh.ru';
const rowCount = 10; //количество адрессов (если -1 то выведет ВСЕ)
const pauseTime = 250; 

// Получаем весь список адресов СПб
let parser = async () => {
  try{
    logger.info('server start');
    
    while(true) {
      logger.info('server get data from ' + URL);
      const responseFetch = await fetch('http://dom.mingkh.ru/api/houses', {
          method: 'POST',
          headers: {
            Accept: '*/*',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          },
          body: `current=1&rowCount=${rowCount}&region_url=sankt-peterburg`,
        });
      
      if (responseFetch.ok) {
        logger.info('I got all the addresses');
        return responseFetch.json();
      }

      logger.info('I did not receive all the addresses, I ll repeat in 1 minute');
      pause(60000);
    }

  } catch (error) {
    logger.error('server catch error:' + error.message)
  }
};

//Из списка адресов получаем всю информацию о домах
parser().then(async (result) => {
  logger.info('server promise then OK: lenght =' + result.rows.length);
  
  const date = new Date();
  for (let house of result.rows) {
    logger.info('id house:' + house.url);

    try {
      const houseId = house.url.split('/')[3];
      const houseUrl = URL+house.url;

      if (!fs.existsSync(`./html/${houseId}.html`)) {
        const houseFetch = await fetch(houseUrl);
        if (houseFetch.ok) {
          const houseHtml = await houseFetch.text();
          fs.writeFileSync(`./html/${houseId}.html`, houseHtml, 'utf-8', ()=>{});
        } else {
          logger.error('error get html' + houseId + error);
          pause(30000);
        }
        pause(pauseTime);
      }
    } catch (error) {
      pause(30000);
      logger.error('server in while:' + error.message);
    }
  }

  fs.readdir('./html', (err, files) => {
    files.forEach(file => {
      console.log(file);
    });
  })
  console.log(new Date()-date);
}).catch((error) => {
  logger.error('server promise catch' + error.message)
});