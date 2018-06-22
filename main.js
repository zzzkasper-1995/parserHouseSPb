const http = require("http");
const fetch = require('isomorphic-unfetch');
const fs=require("fs");
const winston = require('winston');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const logger = require('./log')(module);

// пауза программы
const pause = (ms) => {
  const date = new Date();
  let curDate = null;
  do { curDate = new Date(); }
  while(curDate-date < ms);
}

const URL = 'http://dom.mingkh.ru';
const rowCount = 150; //количество адрессов (если -1 то выведет ВСЕ)
const pauseTime = 250;

if (!fs.existsSync('./html')){
  fs.mkdirSync('./html');
}

if (!fs.existsSync('./log')){
  fs.mkdirSync('./log');
}

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

  fs.writeFileSync(`./html/main.json`, JSON.stringify(result.rows), 'utf-8');
  for (let house of result.rows) {
    logger.info('id house:' + house.url);

    try {
      const houseId = house.url.split('/')[3];
      const houseUrl = URL+house.url;

      if (!fs.existsSync(`./html/${houseId}.html`)) {
        const houseFetch = await fetch(houseUrl);
        if (houseFetch.ok) {
          const houseHtml = await houseFetch.text();
          fs.writeFileSync(`./html/${houseId}.html`, houseHtml, 'utf-8');
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
  console.log('На создание и проверку HTML файлов затрачено:' + new Date()-date + ' мс');

  fs.readdir('./html', async (err, files) => {
    logger.info('Запись файлов JSON начнется через 5 сек');
    pause(5000);
    let number = 0;

    for (let file of files) {
      number = file.split('.')[1] === 'json' ? number+=1 : number;

      const dom = await JSDOM.fromFile('./html/' + file, {});
      if (!fs.existsSync(`./html/${file.split('.')[0]}.json`)) {
        let json = {'id': file.split('.')[0]};
        
        let houseTable = dom.window.document.querySelectorAll('.col-md-6 .table.table-striped tbody');
        houseTable.forEach(table => {
          houseChildren = table.children;
          for (var i=0; i<houseChildren.length; i++) {
            let key = houseChildren[i].children[0].innerHTML.replace('<sup>2</sup>', '.кв');
            let value = houseChildren[i].children.length>=3 ?
                        houseChildren[i].children[2].innerHTML:
                        houseChildren[i].children[1].innerHTML;

            json[key] = value;
          }

          let houseLng = dom.window.document.querySelector('input#mapcenterlng').value;
          let houseLat = dom.window.document.querySelector('input#mapcenterlat').value;
          json['coordinates'] = [houseLng, houseLat];
        });

        fs.writeFileSync(`./html/${file.split('.')[0]}.json`, JSON.stringify(json), 'utf-8');
      }
      
      file.split('.')[1] === 'json' && console.log('Конвертировано в JSON ' + number + ' файл');
    };

    logger.info('JSON файлы записаны');
  });

}).catch((error) => {
  logger.error('server promise catch' + error.message)
});