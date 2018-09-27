const mongoose = require('mongoose');

const geoSchema = mongoose.Schema({
	type: String,
	id: { type: Number, unique: true, index: true },
	parentId: Number,
	description: { type: String, index: true },
	stroke: String,
	strokeWidth: String,
	strokeOpacity: Number,
	numberHouses: Number,
	numberPorch: Number,
	numberRoom: Number,
	areaSpace: Number,
	squareCoords: Number,
});

const Geo = mongoose.model('Geo', geoSchema);

module.exports = Geo;