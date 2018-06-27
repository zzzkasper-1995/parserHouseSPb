const mongoose = require('mongoose');
const fs=require('fs');
const winston = require('winston');
const Schema = mongoose.Schema;

const logger = require('./log')(module);

const Coordinate = require('./mongoScheme/coordinateScheme'); //кординаты точек из которого сделан полигон
const Geo = require('./mongoScheme/geoSchema'); //полигоны
const House = require('./mongoScheme/houseSchema'); //дома

/** возвращает координаты, из таблицы Coordinate, попавшие в полигон и относящиеся к районы с ID = id
 *  arrayParentCoordinates - [[Number]], массив координат по которым строится полигон
 *  id - Number, ID района по которому идет поиск 
 */
const findCoordinates = async (arrayParentCoordinates, id) => {
	let params = {};

	if (arrayParentCoordinates && arrayParentCoordinates.length > 0) {
		params.geometry = {
			$geoWithin: { 
				$geometry: { 
					type : 'Polygon' , 
					coordinates: [ arrayParentCoordinates ] 
				}
			} 
		};
	}
	
	if(typeof id !== 'undefined') {
		params.id = id;
	}

	try {
		return await Coordinate.find(params);
 	} catch(error) {
		logger.error('findCoordinates ' + id +' '+ arrayParentCoordinates.length + error.message);
		return undefined;
	}
}

const findHouses = async (arrayCoordinates, id) => {
	let params = {};

	if (arrayCoordinates && arrayCoordinates.length > 0) {
		params.geometry = {
			$geoWithin: { 
				$geometry: { 
					type : 'Polygon' , 
					coordinates: [ arrayCoordinates ] 
				}
			} 
		};
	}
	
	if(typeof id !== 'undefined') {
		params.id = id;
	}

	try {
		return await House.find(params);
 	} catch(error) {
		logger.error('findHouses ' + error.message);
		return undefined;
	}
}

/** Обновляет поля в таблице Houses
 * 
 */
const updateHouses = () => {
	/*const QUERY = { id: polygon.id };
	//сохраняем в полигоне информацию о родителе
	try {
		await Geo.findOneAndUpdate(QUERY, { parentId: parentPolygon.id });
		console.log('\nparentPolygon ' + parentPolygon.id +' polygon ' + polygon.id);
		console.log('all ' + countCoordinates + ', include ' + countCoordinatesIncludePolygon + ' percent ' + percentBig);
	} catch (error) {
		logger.error('findAndSaveParentPolygon update Geo: ' + error.message);
	}*/
}

/** Подсчет количества домов
 *  id - Number, ID района
 */
const calculaterHouses = async (idPolygon) => {
	try{
		let geo = await Geo.findOne({id: idPolygon});
		let coordinate = await findCoordinates([], geo.id);

		let arrayCoordinates = [];
		coordinate.forEach(element => {
			arrayCoordinates.push(element.geometry.coordinates);
		});

		let houses = await findHouses(arrayCoordinates);
		return houses.length;
	} catch (error) {
		logger.error('calculaterHouse ' + error.message);
		return undefined;
	}
}

/** Подсчет количества подъездов
 *  id - Number, id района
 */
const calculaterPorch = async (idPolygon) => {
	const PORCH_ID = Buffer.from('Количество подъездов').toString('base64');
	try{
		let geo = await Geo.findOne({id: idPolygon});
		let coordinate = await findCoordinates([], geo.id);

		let arrayCoordinates = [];
		coordinate.forEach(element => {
			arrayCoordinates.push(element.geometry.coordinates);
		});

		let houses = await findHouses(arrayCoordinates);
		
		let countPorch = 0;
		houses.forEach(element => {
			elementPorch = parseInt(element.supportInfo.get(PORCH_ID), 10);
			if (!Number.isNaN(elementPorch)) {
				countPorch += elementPorch;
			}
		});
		return countPorch;
	} catch (error) {
		logger.error('calculaterPorch ' + error.message);
		return undefined;
	}
}

/** Подсчет количества квартир
 *  id - Number, ID района
 */
const calculaterRoom = async (idPolygon) => {
	const ROOM_ID = Buffer.from('Количество жилых помещений').toString('base64');
	try{
		let geo = await Geo.findOne({id: idPolygon});
		let coordinate = await findCoordinates([], geo.id);

		let arrayCoordinates = [];
		coordinate.forEach(element => {
			arrayCoordinates.push(element.geometry.coordinates);
		});

		let houses = await findHouses(arrayCoordinates);
		
		let countRoom = 0;
		houses.forEach(element => {
			elementRoom = parseInt(element.supportInfo.get(ROOM_ID), 10);
			if (!Number.isNaN(elementRoom)) {
				countRoom += elementRoom;
			}
		});
		return countRoom;
	} catch (error) {
		logger.error('calculaterRoom ' + error.message);
		return undefined;
	}
}

/*Поиск родителей для полигонов и сохранение информации о них у детей*/
const findAndSaveParentPolygon = async () => {
	try{	
		//Поиск всех полигонов, кроме тех котоые выделены желтым и оранжевым цветом
		let geo = await Geo.find({ $and: [ { stroke: { $ne: '#ffd21e' } }, { stroke: { $ne: '#ff931e' } } ] });
		logger.info('Найдено полигонов: ' + geo.length);

		let number = 0;
		for(let parentPolygon of geo) {
			number += 1;
			const PARENT_CORDINATES = await findCoordinates([], parentPolygon.id);

			//формируем массив точек (полигон)
			let arrayParentCoordinates = [];
			PARENT_CORDINATES.forEach(element => {
				arrayParentCoordinates.push(element.geometry.coordinates);
			});

			for(let polygon of geo) {
				if(parentPolygon.id === polygon.id) {
					continue;
				}

				//получаю все точеки текущего полигона
				let countCoordinates = await findCoordinates([], polygon.id);
				if (typeof countCoordinates !== 'undefined') {
					countCoordinates = countCoordinates.length
				} else continue;

				//получаю колиечство точек текущего полигона находящихся в нутри потенциально внешнего полигна
				let countCoordinatesIncludePolygon = await findCoordinates(arrayParentCoordinates, polygon.id);
				if (typeof countCoordinatesIncludePolygon !== 'undefined') {
					countCoordinatesIncludePolygon = countCoordinatesIncludePolygon.length
				} else continue;

				let percentBig = Math.round(countCoordinatesIncludePolygon/countCoordinates*100)/100;
				if(percentBig > 0.70) {
					const QUERY = { id: polygon.id };
					//сохраняем в полигоне информацию о родителе
					try {
						await Geo.findOneAndUpdate(QUERY, { parentId: parentPolygon.id });
						console.log('\nparentPolygon ' + parentPolygon.id +' polygon ' + polygon.id);
						console.log('all ' + countCoordinates + ', include ' + countCoordinatesIncludePolygon + ' percent ' + percentBig);
					} catch (error) {
						logger.error('findAndSaveParentPolygon update Geo: ' + error.message);
					}
				}
			};

			number % 20 === 0 && console.log('Проверено полигонов:', number);
		}
		console.log(geo.length);
		console.log('END');
	} catch (error) {
		logger.error('findAndSaveParentPolygon ' + error.message);
	}
}

/*Обновление информации полигонов о количестве домов подъездов квартир*/
const updatePolygonInfo = async () => {
	try{	
		//Поиск всех полигонов, кроме тех котоые выделены желтым и оранжевым цветом
		let geo = await Geo.find();
		logger.info('Найдено полигонов: ' + geo.length);

		let number = 0;
		for(let polygon of geo) {
			number += 1;

			let numberHouses = await calculaterHouses(polygon.id);
			let numberPorch = await calculaterPorch(polygon.id);
			let numberRoom = await calculaterRoom(polygon.id);

			try {
				await Geo.findOneAndUpdate({ id: polygon.id },
					{ 
						numberHouses: numberHouses,
						numberPorch: numberPorch,
						numberRoom: numberRoom
					});
			} catch (error) {
				logger.error('findAndSaveParentPolygon update Geo: ' + error.message);
			}

			number % 20 === 0 && console.log('Проверено полигонов:', number);
		}
		console.log('END');
	} catch (error) {
		logger.error('findAndSaveParentPolygon ' + error.message);
	}
}

/* Главная выполняемая функция */
const main = async () => {
	!fs.existsSync('./log') && fs.mkdirSync('./log'); //если папка для логов не существует, то создать

	try {
		await mongoose.connect('mongodb://localhost/houseDB');
		/*logger.info(`подключении к БД прошло успешно!\n`);
		const POLYGON_ID = 211;

		let numberHouses = await calculaterHouses(POLYGON_ID);
		console.log('Найден', numberHouses, 'дом в ', POLYGON_ID, 'полигоне');

		let numberPorch = await calculaterPorch(POLYGON_ID);
		console.log('Найден', numberPorch, 'подъезд в ', POLYGON_ID, 'полигоне');
		
		let numberRoom = await calculaterRoom(POLYGON_ID);
		console.log('в ', POLYGON_ID, 'полигоне ориентировочно', numberRoom, 'жилых помещений');*/

		await updatePolygonInfo();

		//await findAndSaveParentPolygon();
	} catch (error){
		logger.error('main ' + error.message);
	}
	console.log('\nДля выхода нажмите "Ctrl+C"');
}

main();

