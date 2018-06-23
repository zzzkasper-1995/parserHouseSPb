const mongoose = require('mongoose');

const geoSchema = mongoose.Schema({
	type: String,
	id: { type: Number, unique: true, index: true },
	parentId: Number,
	description: { type: String, index: true },
	stroke: String,
	strokeWidth: String,
	strokeOpacity: Number,
});

const Geo = mongoose.model('Geo', geoSchema);

module.exports = Geo;