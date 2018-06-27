const http = require('http');
const fetch = require('isomorphic-unfetch');
const fs=require('fs');
const winston = require('winston');
const { JSDOM } = require('jsdom');

const logger = require('./log')(module);

// параметры по умолчанию
let URL = 'http://dom.mingkh.ru';
let rowCount = -1; //количество адрессов (если -1 то выведет ВСЕ)
let pauseTime = 250;

//поверяем наличие файла с конфигами
if (fs.existsSync(`./config.json`)) {
  const configText = fs.readFileSync('./config.json', 'utf-8');
  const config = JSON.parse(configText);
  URL = config.URL;
  rowCount = config.rowCount; //количество адрессов (если -1 то выведет ВСЕ)
  pauseTime = config.pauseTime;
} else {
  logger.error('./config.json not exist! The default settings are used');
}

//Если папка для хранения html и json домов не существует то создать
if (!fs.existsSync('./html')){
  fs.mkdirSync('./html');
}

//Если папка для хранения логов не существует то создать
if (!fs.existsSync('./log')){
  fs.mkdirSync('./log');
}

// функция делает паузу программы
const pause = (ms) => {
  const date = new Date();
  let curDate = null;
  do { curDate = new Date(); }
  while(curDate-date < ms);
}

// функция получает весь список адресов по городу
const getListHouses = async (regionUrl = 'sankt-peterburg', cityUrl) => {
  try{
    logger.info('getListHouses start');
    
    while(true) {
      logger.info(`get data from ${cityUrl}`);
      let body = `current=1&rowCount=${rowCount}&region_url=${regionUrl}`;
      body += cityUrl ? `&city_url=${cityUrl}` : '';

      const responseFetch = await fetch('http://dom.mingkh.ru/api/houses', {
          method: 'POST',
          headers: {
            Accept: '*/*',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          },
          body: `${body}`,
        });
      
      if (responseFetch.ok) {
        logger.info('I got all the addresses');
        return await responseFetch.json();
      }

      logger.info('I did not receive all the addresses, I ll repeat in 1 minute');
      pause(60000);
    }

  } catch (error) {
    logger.error('getListHouses:' + error.message)
  }
};

// скопировать html-файл дома
const getHtmlHouses = async (region = 'default', listHouses, city) => {
  const date = new Date();

  for (let house of listHouses) {
    logger.info('getHtmlHouses: id house ' + house.url);

    try {
      const houseId = house.url.split('/')[3];
      const houseUrl = URL+house.url;

      //если html для данного дома нет то создать
      let fileName = `./html/${region}`;
      fileName += city ? `/${city}`: '';
      fileName += `/${houseId}.html`;

      if (!fs.existsSync(fileName)) {
        const houseFetch = await fetch(houseUrl);
        if (houseFetch.ok) {
          const houseHtml = await houseFetch.text();
          fs.writeFileSync(fileName, houseHtml, 'utf-8');
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
}

//записать json-файл с информацией о доме
//json-файлы создаются путем распарсивания html-файлов лежащих в папке ./html
const writeJsonHouses = (path) => {
  fs.readdir(`${path}`, async (err, files) => {
    logger.info('Запись файлов JSON начнется через 5 сек');
    pause(5000);
    
    //парсин операция долгая и для большого количества файлов может занять продолжительное время
    //поэтому в переменную number мы сохраняем обработаное количество файлов и выводим это числов консоль
    let number = 0;

    try{
      for (let file of files) {
        if(file.split('.').length>0 && file.split('.')[1] === 'html') {
          number+=1;
          //еслт json для данного html нет то создать

          if (!fs.existsSync(`${path}/${file.split('.')[0]}.json`)) {
            const dom = await JSDOM.fromFile(`${path}/${file}`, {});
            let json = {'id': file.split('.')[0]};
            
            //вытаскиваем информация из DOM
            let houseTable = dom.window.document.querySelectorAll('.col-md-6 .table.table-striped tbody');
            houseTable.forEach(table => {
              houseChildren = table.children;
              for (let i=0; i<houseChildren.length; i++) {
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

            fs.writeFileSync(`${path}/${file.split('.')[0]}.json`, JSON.stringify(json), 'utf-8');
            console.log('Конвертировано в JSON ' + number + ' файл ' + path);
          } else {
            console.log(number + ' ый(ой) файл пропущен, он уже конвертирован в JSON');
          }
        } 
      };
    } catch (error) {
      logger.error('writeJsonHouses:' + error.message)
    }

    logger.info(`JSON файлы ${path} записаны`);
  });
}

//главная исполняемая функция программы
const main = async (region, cityList) => {

  if(cityList!==undefined) {
    console.log(1);
    for(let city of cityList) {
      try {
        //Если папка для хранения информации о домах города не существует то создать
        if (!fs.existsSync(`./html/${region}`)){
          fs.mkdirSync(`./html/${region}`);
        }
        if (!fs.existsSync(`./html/${region}/${city}`)){
          fs.mkdirSync(`./html/${region}/${city}`);
        }

        let result = await getListHouses(region, city);
        logger.info('server promise then OK: total = ' + result.total);
        fs.writeFileSync(`./html/${region}/${city}/main.json`, JSON.stringify(result.rows), 'utf-8');
        await getHtmlHouses(region, result.rows, city);
        console.log(0);
        const path = `./html/${region}/${city}`
        writeJsonHouses(path);
      } catch(error) {
        logger.error(`main: ${error.message}`);
      }
    }
  } else {
    console.log(2);
    try {
      //Если папка для хранения информации о домах города не существует то создать
      if (!fs.existsSync(`./html/${region}`)){
        fs.mkdirSync(`./html/${region}`);
      }

      let result = await getListHouses(region); //let result = await getListHouses(region, city);
      logger.info('server promise then OK: total = ' + result.total);
      fs.writeFileSync(`./html/${region}/main.json`, JSON.stringify(result.rows), 'utf-8');
      await getHtmlHouses(region, result.rows);
      const path = `./html/${region}`
      writeJsonHouses(path);
    } catch(error) {
      logger.error(`main: ${error.message}`);
    }
  }
}


  //регион
  let region = 'leningradskaya-oblast';

  //для выборки данных по городам
  //Список городов для указанного региона
  const cityList = [
    'boksitogorsk',
    'volhov',
  ];

main(region, cityList);
//region = 'sankt-peterburg';
//main(region);