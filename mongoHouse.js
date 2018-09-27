const mongoose = require('mongoose');
const fs=require("fs");
const House = require('./mongoScheme/houseSchema');

const logger = require('./log')(module);

const saveHouses = (path) => {
	//проверяем наличие файла со списком домов
	if (!fs.existsSync(`${path}/main.json`)) {
		logger.error(`${path}/main.json not exist!`);
		return 0;
	}

	const dataText = fs.readFileSync(`${path}/main.json`, 'utf-8');
	const houses = JSON.parse(dataText);

	logger.info('Начал просмотр всех имеющихся записей');
	let numberSave = 0;
	for (let element of houses) {
		number+=1; //количество проверенных записей

		const jsonFileName = `${path}/${element.url.split('/')[3]}.json`;
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
			//ключ храним в закодированом виде потому что монгуст не терпит ключи со спец знаками (. , * ` ...)
			house.supportInfo.set(Buffer.from(key).toString('base64'), element.supportInfo[key]);
		});
	
		house.save((err) => {
			numberSave+=1;
			numberSave % 100 === 0 && console.log(`записано ${numberSave} файлов`);
	    if(err) {
				//logger.error(`Ошибка при сохранении записи о доме ${element.url}: ${err.message}`);
	    }
		});
	};
}

if (!fs.existsSync('./html')){
	logger.error(`Не найдена папка ./html`);
	return 0;
}

if (!fs.existsSync('./log')){
  fs.mkdirSync('./log');
}

const main = () => {
	mongoose.connect('mongodb://localhost/houseDB', async (err) => {
		if(err) {
			logger.error(`ошибка при подключении к БД: ${err.message}`);
			throw err;   
	  }
			
		logger.info(`подключении к БД прошло успешно`);

		try {
			//смотрим содержимое ./html
			let dirRegions = fs.readdirSync(`./html`);
			//пробегаем в цикле по всем наименованиям которые есть в ./html
			dirRegions.forEach(dirRegion => {	
				//если точки нет значит мы нашли папку с регионом, потому что если точка етсь то это точно файл
				if(dirRegion.indexOf('.') === -1) {
					let pathRegion = `./html/${dirRegion}`;
					//смотрим содержимое папки региона
					try{
						let dirСities = fs.readdirSync(pathRegion);
						dirСities.forEach(dirCity => {	
							//если точки нет значит мы нашли папку с городом
							if(dirCity.indexOf('.') === -1) {
								let pathCity = `${pathRegion}/${dirCity}`;
								saveHouses(pathCity);
							}
						});
						saveHouses(pathRegion);
					} catch(error) {
						console.log(error.message);
					}
				}
			});
		} catch (error) {
			console.log(error.message);
		}

		console.log('subEnd')
	});
}

const main_city = (path) => {
	mongoose.connect('mongodb://localhost/houseDB', async (err) => {
		if(err) {
			logger.error(`ошибка при подключении к БД: ${err.message}`);
			throw err;   
	  }
			
		logger.info(`подключении к БД прошло успешно`);

		saveHouses(path);

		console.log('subEnd')
	});
}

main_city('./html/leningradskaya-oblast/villozi');

