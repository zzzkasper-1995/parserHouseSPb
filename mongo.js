const mongoose = require('mongoose');
const fs=require("fs");
const winston = require('winston');

const Schema = mongoose.Schema;
const House = require('./houseSchema');

const logger = require('./log')(module);

if (!fs.existsSync('./html')){
	logger.error(`Не найдена папка ./html`);
	return 0;
}

if (!fs.existsSync('./log')){
  fs.mkdirSync('./log');
}

mongoose.connect('mongodb://localhost/houseDB', (err) => {
	if(err) {
		logger.error(`ошибка при подключении к БД: ${err.message}`);
		throw err;   
   }
		
	logger.info(`подключении к БД прошло успешно`);

	//проверяем наличие файла со списком домов
	if (!fs.existsSync('./html/main.json')) {
		logger.error('./html/main.json not exist!');
		return 0;
	}

	const dataText = fs.readFileSync('./html/main.json', 'utf-8');
	const houses = JSON.parse(dataText);

	logger.info('Начал просмотр всех имеющихся записей');
	let numberSave = 0;
	let number = 0;
	for (let element of houses) {
		number+=1; //количество проверенных записей

		const jsonFileName = `./html/${element.url.split('/')[3]}.json`;
		//Если есть файл с детализация по дому, то вытаскиваем его поля 
		if (fs.existsSync(jsonFileName)) {			
			const supportInfoText = fs.readFileSync(jsonFileName, 'utf-8');
			const supportInfo = JSON.parse(supportInfoText);
			element.geometry = supportInfo.coordinates;
			element.supportInfo = supportInfo;
		} else {
			logger.error(`${jsonFileName} not exist!`);
			element.geometry = [];
			element.supportInfo = {};
		}
		
		//Подготавливаем объект для записи в БД
		const house = new House ({
			url: element.url,
			address: element.address,
			square: element.square,
			year: element.year,
			floors: element.floors,
			managestartdate: element.managestartdate,
			geometry: { coordinates: element.geometry },
			supportInfo: { },
		});

		// заполняем поле дополнительной информации
		Object.keys(element.supportInfo).forEach(key => {
			//ключ храним в закодированом виде потому что мангуст не терпит ключи со спец знаками (. , * ` ...)
			house.supportInfo.set(Buffer.from(key).toString('base64'), element.supportInfo[key]);
		});
	
		house.save((err) => {
			numberSave+=1;
			numberSave % 100 === 0 && console.log(`записано ${numberSave} файлов`);
	    if(err) {
				logger.error(`Ошибка при сохранении записи о доме ${element.url}: ${err.message}`);
	    }
		});
	};
	logger.info('Все записи отправленны на сохранение, количество записей '+ number);
});