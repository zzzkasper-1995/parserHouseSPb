const mongoose = require('mongoose');
const fs=require('fs');
const winston = require('winston');
const Schema = mongoose.Schema;

const logger = require('./log')(module);

const Coordinate = require('./mongoScheme/coordinateScheme'); //кординаты точек из которого сделан полигон
const Geo = require('./mongoScheme/geoSchema'); //полигоны
const House = require('./mongoScheme/houseSchema'); //дома

/** возвращает координаты, из таблицы Coordinate, попавшие в полигон и относящиеся к районы с ID = id
 *  arrayParentCoords - [[Number]], массив координат по которым строится полигон
 *  id - Number, ID района по которому идет поиск 
 */
const findCoords = async (arrayParentCoords, id) => {
	let params = {};

	if (arrayParentCoords && arrayParentCoords.length > 0) {
		params.geometry = {
			$geoWithin: { 
				$geometry: { 
					type : 'Polygon' , 
					coordinates: [ arrayParentCoords ] 
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
		logger.error('findCoords ' + id +' '+ arrayParentCoords.length + error.message);
		throw error;
	}
}

/** возвращает дома, из таблицы Houses, попавшие в полигон и относящиеся к районы с ID = id
 *  arrayCoords - [[Number]], массив координат по которым строится полигон
 *  id - Number, ID района по которому идет поиск 
 */
const findHouses = async (arrayCoords, id) => {
	let params = {};

	if (arrayCoords && arrayCoords.length > 0) {
		params.geometry = {
			$geoWithin: { 
				$geometry: { 
					type : 'Polygon' , 
					coordinates: [ arrayCoords ] 
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
		logger.error('findHouses id: '+ id + '. ' + error.message);
		throw error;
	}
}

// формируем массив точек полигона
const getCoords = async (idPolygon) => {
	try{
		let geo = await Geo.findOne({id: idPolygon});
		let coordinate = await findCoords([], geo.id);

		let arrayCoords = [];
		coordinate.forEach(element => {
			arrayCoords.push(element.geometry.coordinates);
		});
		arrayCoords.length > 0 && arrayCoords.push(arrayCoords[0]);
		return arrayCoords;
	} catch (error) {
		logger.error(`getCoords: idPolygon:${idPolygon}. ${error.message}`);
		throw error;
	}
}

/** Подсчет количества подъездов
 *  id - Number, id района
 */
const calculaterPorch = async (houses) => {
	const PORCH_ID = Buffer.from('Количество подъездов').toString('base64');
	try{
		let countPorch = 0;
		houses.forEach(element => {
			elementPorch = parseInt(element.supportInfo.get(PORCH_ID), 10);
			if (!Number.isNaN(elementPorch)) {
				countPorch += elementPorch;
			}
		});
		return countPorch;
	} catch (error) {
		logger.error(`calculaterPorch: ${error.message}`);
		throw error;
	}
}

/** Подсчет количества квартир
 *  id - Number, ID района
 */
const calculaterRoom = async (houses) => {
	const ROOM_ID = Buffer.from('Количество жилых помещений').toString('base64');
	try{
		let countRoom = 0;
		houses.forEach(element => {
			elementRoom = parseInt(element.supportInfo.get(ROOM_ID), 10);
			if (!Number.isNaN(elementRoom)) {
				countRoom += elementRoom;
			}
		});
		return countRoom;
	} catch (error) {
		logger.error(`calculaterRoom: idPolygon:${idPolygon}. ${error.message}`);
		throw error;
	}
}

const calculaterHousePorchRoom = async (idPolygon) => {
	try{
		const arrayCoords = await getCoords(idPolygon);
		if (arrayCoords.length < 1) return {numberHouses: 0, numberPorch: 0, numberRoom: 0};

		const houses = await findHouses(arrayCoords);

		const numberHouses = houses.length;
		const numberPorch = await calculaterPorch(houses);
		const numberRoom = await calculaterRoom(houses);

		return {numberHouses, numberPorch, numberRoom};
	} catch (error) {
		logger.error(`calculaterHousePorchRoom: idPolygon:${idPolygon}. ${error.message}`);
		throw error;
	}
}

// наъождение площади полигона
function calculaterAreaSpace(coords) {
  let areaSpace = 0;
  if (coords.length <= 2) return 0;

  try {
    for (let i = 0; i < coords.length - 1; i += 1) {
      areaSpace += coords[i][0] * coords[i + 1][1];
    }

    for (let i = 0; i < coords.length - 1; i += 1) {
      areaSpace -= coords[i][1] * coords[i + 1][0];
    }

    return Math.abs(areaSpace / 2);
  } catch (error) {
    return 0;
  }
}

const isPointInside = (squareCoords, point) => {
	try{
		return point[0] >= squareCoords.minX &&
			point[0] <= squareCoords.maxX &&
			point[1] >= squareCoords.minY &&
			point[1] >= squareCoords.maxY;
		} catch (error) {
			return false
		};
}

//если больше 70%  точек в нутри то true, иначе false
const isCross = (squareCoords, coords) => {
	let count = 0;
	coords.forEach(coord => {
		if (isPointInside(squareCoords, coord)) {
			count += 1;
		}
	});

	return coords.length / count > 0.5 ? true : false;
}

/*Поиск родителей для полигонов и сохранение информации о них у детей*/
const findAndSaveParentPolygons = async () => {
	try{
		const dateStart = new Date();
		//Поиск всех полигонов
		const geosFind = await Geo.find({});
		
		const geos = await Promise.all( geosFind.map(async geo=>{
			const coords = await getCoords(geo.id);
			let minX, maxX, minY, maxY;
			if(coords.length > 0) {
				minX = maxX = coords[0][0];
				minY = maxY = coords[0][1];
				coords.forEach((coord)=>{
					 if (coord[0] < minX) minX = coord[0];
					 if (coord[1] < minY) minY = coord[1];
					 if (coord[0] > maxX) maxX = coord[0];
					 if (coord[1] > maxY) maxY = coord[1];
				})
			}
			const areaSpace = calculaterAreaSpace(coords);
			return { id: geo.id, areaSpace, squareCoords: {minX, minY, maxX, maxY}, coords};
		}));
		console.log('findAndSaveParentPolygons: расчитал площадь всех полигонов')

		let number = 0;
		for(let parentPolygon of geos) {
			number += 1;
			if (parentPolygon.areaSpace === 0) continue;
			const arrayParentCoords = parentPolygon.coords;
			
			for(let polygon of geos) {
				try {
					if(parentPolygon.id === polygon.id) {
						continue;
					}

					// Если текущий полигон больше потенциально внешнего значит потенциально внешний точно не может быть внешним
					if(polygon.areaSpace > parentPolygon.areaSpace) continue;
					// Если текущий полигон попадает в область между максимальными и минимальными координатами внешнего
					if (!isCross(parentPolygon.squareCoords, polygon.coords)) continue;

					// получаем количество точек текущего полигона
					const countCoordinates = polygon.coords.length;

					//получаю колиечство точек текущего полигона находящихся в нутри потенциально внешнего полигна
					let countCoordinatesIncludePolygon = await findCoords(parentPolygon.coords, polygon.id);
					if (countCoordinatesIncludePolygon) {
						countCoordinatesIncludePolygon = countCoordinatesIncludePolygon.length
					} else continue;

					let percentBig = Math.round(countCoordinatesIncludePolygon/countCoordinates);
					if(percentBig > 0.6) {
						//сохраняем в полигоне информацию о родителе
						await Geo.findOneAndUpdate({ id: polygon.id }, { parentId: parentPolygon.id });
					}
				} catch (error) {
					console.log('findAndSaveParentPolygons litleError:', error.message)
				}
			};

			number % 20 === 0 &&
				console.log(`${(new Date() - dateStart)/1000} сек, findAndSaveParentPolygons: проверено полигонов: ${number}`);
		}
		console.log(`${(new Date() - dateStart)/1000} сек, findAndSaveParentPolygons: закончил поиск родителей, проверенно ${geos.length}`);
	} catch (error) {
		logger.error(`findAndSaveParentPolygons: ${error.message}`);
	}
}

/*Обновление информации полигонов о количестве домов подъездов квартир*/
const updatePolygonsInfo = async () => {
	try{
		const dateStart = new Date();
		//Поиск всех полигонов
		let geo = await Geo.find();
		logger.info('Найдено полигонов: ' + geo.length);

		let number = 0;
		for(let polygon of geo) {
			number += 1;

			try {
				const {numberHouses, numberPorch, numberRoom} = await calculaterHousePorchRoom(polygon.id);
				const rezultUpdate = await Geo.findOneAndUpdate({ id: polygon.id }, { 
					numberHouses: numberHouses,
					numberPorch: numberPorch,
					numberRoom: numberRoom
				});
			} catch (error) {
				logger.error('updatePolygonInfo update Geo: ' + error.message);
			}
			number % 20 === 0 &&
				console.log(`${(new Date() - dateStart)/1000} сек, updatePolygonInfo: проверено полигонов: ${number}`);
		}
		console.log(`${(new Date() - dateStart)/1000} сек, updatePolygonInfo: закончил подсчет домов, подъездов и квартир`);
	} catch (error) {
		logger.error('updatePolygonInfo ' + error.message);
	}
}

/* Главная выполняемая функция */
const main = async () => {
	// если папка для логов не существует, то создать
	!fs.existsSync('./log') && fs.mkdirSync('./log');

	try {
		await mongoose.connect('mongodb://192.168.0.121/houseDB');
		
		await updatePolygonsInfo();
		// await findAndSaveParentPolygons();
	} catch (error){
		logger.error('main ' + error.message);
	}
	console.log('\nДля выхода нажмите "Ctrl+C"');
}

main();

