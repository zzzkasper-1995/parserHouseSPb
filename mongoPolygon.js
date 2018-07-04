const mongoose = require('mongoose');
const fs=require("fs");
const winston = require('winston');
const Schema = mongoose.Schema;

const logger = require('./log')(module);

const Coordinate = require('./mongoScheme/coordinateScheme'); //кординаты точек из которого сделан полигон
const Geo = require('./mongoScheme/geoSchema'); //полигоны

if (!fs.existsSync('./log')){
  fs.mkdirSync('./log');
}

mongoose.connect('mongodb://localhost/houseDB', (err) => {
	if(err) {
		logger.error(`ошибка при подключении к БД: ${err.message}`);
		throw err;   
   }
		
	logger.info(`подключении к БД прошло успешно`);

	//проверяем наличие файла со списком полигонов
	if (!fs.existsSync('./geoPolygon.json')) {
		logger.error('./geoPolygon.json not exist!');
		return 0;
	}

  //парсим полигоны из файла
	logger.info(`Начал парсить файл ./geoPolygon.json`);
	const dataText = fs.readFileSync('./geoPolygon.json', 'utf-8');
	const geoPolygons = JSON.parse(dataText);
	logger.info(`Закончил парсить файл ./geoPolygon.json`);

	let numberSave = 0;
	let number = 0;

	logger.info('Начал просмотр всех имеющихся полигонов');
	/*console.log(geoPolygons);*/
	for (let element of geoPolygons['features']) {
		number += 1;
		
		//Подготавливаем объект полиглна для записи в БД
		const geo = new Geo ({
			type: element['type'],
			id: element['id'],
			description: element['properties']['description'],
			stroke: element['properties']['stroke'],
			strokeWidth: element['properties']['stroke-width'],
			strokeOpacity: element['properties']['stroke-opacity'],
		});

		element['geometry']['coordinates'].forEach((coordinateElement, index) => {
			//Подготавливаем объект полиглна для записи в БД
			/*console.log('element[id], index, coordinateElement', element['id'], index, coordinateElement);*/
			const coordinate = new Coordinate ({
				id: element['id'],
				number: index,
				geometry: { coordinates: coordinateElement },	
			});

			coordinate.save((err) => {
				if(err) {
					logger.error(`Ошибка при сохранении кординаты с id ${element['id']} и номером ${index}: ${err.message}`);
		    	}
			});
		});

		//монгоДБ при поиске по полигонам просит замкнутый полигон
		//тоесть первая точка должна быть равна последней
		// поэтому мы создаем последнюю точку равную первой
		if(element['geometry']['coordinates'].length>0) {
			const coordinate = new Coordinate ({
				id: element['id'],
				number: element['geometry']['coordinates'].length,
				geometry: { coordinates: element['geometry']['coordinates'][0] },	
			});

			coordinate.save((err) => {
				if(err) {
					logger.error(`Ошибка при сохранении кординаты с id ${element['id']} и номером ${element['geometry']['coordinates'].length}: ${err.message}`);
		    }
			});
		}
	
		geo.save((err) => {
			numberSave+=1;
			//numberSave % 10 === 0 && console.log(`записано ${numberSave} файлов`);
	    if(err) {
				//logger.error(`Ошибка при сохранении полигона с id ${element['id']}: ${err.message}`);
	    }
		});
	};
	logger.info('Все записи отправленны на сохранение, количество полигонов '+ number);
});